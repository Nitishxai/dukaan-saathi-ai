import type { DukaanStoreData, Sale, SaleItem, PaymentMode, PaymentVerificationStatus, Customer } from '../types';
export const roundPrecision = (value: number, decimals = 3) => Math.round((value + Number.EPSILON) * 10 ** decimals) / 10 ** decimals;
export function requiresWholeQuantity(unit: string) {
  return ['packet','piece','box','bottle','strip','tablet','pair','set','crate','bag','bori','can','tube','bunch'].includes(unit);
}

export type SaleInput = {
  operationId?: string;
  shopId?: string;
  items: SaleItem[];
  paymentMode: PaymentMode;
  customerId?: string;
  notes?: string;
  upiId?: string;
  paymentStatus?: 'completed' | 'manually_confirmed';
  subtotal?: number;
  discountAmount?: number;
  discountType?: 'flat' | 'percentage';
  discountValue?: number;
  cashReceived?: number;
  changeDue?: number;
  paymentVerificationStatus?: PaymentVerificationStatus;
  transactionRef?: string;
  invoiceNo?: string;
};
export function applySale(current: DukaanStoreData, saleInput: SaleInput): { success: boolean; sale?: Sale; error?: string; data?: DukaanStoreData } {

  if (!saleInput.items || saleInput.items.length === 0) {
    return { success: false, error: 'At least 1 item is required in the bill.' };
  }

  if (saleInput.shopId && saleInput.shopId !== current.profile.id) return { success: false, error: 'Shop changed. Review this bill again.' };
  if (!['cash', 'online', 'udhaar'].includes(saleInput.paymentMode)) return { success: false, error: 'Invalid payment mode.' };
  const operationId = saleInput.operationId || saleInput.transactionRef;
  if (typeof operationId !== 'string' || !operationId.trim() || operationId.length > 200) return { success: false, error: 'A persistent operation ID is required.' };
  const operationPayload = JSON.stringify(saleInput);
  const prior = operationId && current.sales.find(s => s.operationId === operationId);
  if (prior) return prior.operationPayload === operationPayload
    ? { success: true, sale: prior }
    : { success: false, error: 'Operation ID already used for a different bill.' };
  for (const value of [saleInput.subtotal, saleInput.discountAmount, saleInput.discountValue, saleInput.cashReceived, saleInput.changeDue]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-6)) return { success: false, error: 'Invalid bill amount.' };
  }
  if (saleInput.paymentMode === 'online' && saleInput.paymentVerificationStatus === 'paid') return { success: false, error: 'Automatic verification is unavailable. Use manual confirmation.' };
  // 1. Validate each line item
  for (const item of saleInput.items) {
    if (typeof item.quantity !== 'number' || isNaN(item.quantity) || !isFinite(item.quantity) || item.quantity <= 0) {
      return { success: false, error: `Invalid quantity for product "${item.productName}".` };
    }
    if (typeof item.unitPrice !== 'number' || isNaN(item.unitPrice) || !isFinite(item.unitPrice) || item.unitPrice < 0) {
      return { success: false, error: `Invalid price for product "${item.productName}".` };
    }
    const prod = current.products.find((p) => p.id === item.productId);
    if (!prod) {
      return { success: false, error: `Product not found: ${item.productName}` };
    }
  }

  for (const item of saleInput.items) {
    const product = current.products.find(p => p.id === item.productId)!;
    if (requiresWholeQuantity(product.unit) && !Number.isInteger(item.quantity)) return { success: false, error: 'This unit requires a whole quantity.' };
    if (item.unit !== product.unit || item.quantity !== roundPrecision(item.quantity, 3)) return { success: false, error: 'Invalid unit or quantity precision. Review the bill.' };
    if (product.sellingPrice === null || item.unitPrice !== product.sellingPrice) return { success: false, error: 'Price changed. Refresh the bill using current inventory prices.' };
    if (!Number.isFinite(item.totalPrice) || item.totalPrice !== roundPrecision(item.quantity * product.sellingPrice, 2)) return { success: false, error: 'Inconsistent line total.' };
  }
  // 2. Aggregate requested quantities by productId to ensure multi-line sales are validated and deducted correctly
  const requestedQtyByProduct = new Map<string, number>();
  for (const item of saleInput.items) {
    const existingQty = requestedQtyByProduct.get(item.productId) || 0;
    requestedQtyByProduct.set(item.productId, roundPrecision(existingQty + item.quantity, 3));
  }

  // 3. Validate Stock for all tracked items using aggregated quantity
  for (const [productId, totalRequested] of requestedQtyByProduct.entries()) {
    const prod = current.products.find((p) => p.id === productId);
    if (prod && prod.currentStock !== null && prod.currentStock < totalRequested) {
      return {
        success: false,
        error: `Insufficient stock! Only ${prod.currentStock} ${prod.unit} of ${prod.name} available, but requested sale quantity is ${totalRequested} ${prod.unit}.`,
      };
    }
  }

  // 4. Calculate Subtotal, Discount & Total Amount
  const subtotal = roundPrecision(saleInput.items.reduce((sum, item) => sum + roundPrecision(item.quantity * item.unitPrice, 2), 0), 2);
  if (!Number.isSafeInteger(Math.round(subtotal * 100)) || (saleInput.subtotal !== undefined && saleInput.subtotal !== subtotal)) return { success: false, error: 'Inconsistent subtotal.' };
  const discountAmount = saleInput.discountAmount ?? 0;
  if (discountAmount > subtotal) return { success: false, error: 'Discount exceeds subtotal.' };
  const totalAmount = roundPrecision(subtotal - discountAmount, 2);
  if (saleInput.cashReceived !== undefined && (saleInput.paymentMode !== 'cash' || saleInput.cashReceived < totalAmount)) return { success: false, error: 'Cash received is less than payable amount.' };
  const changeDue = saleInput.cashReceived === undefined ? undefined : roundPrecision(saleInput.cashReceived - totalAmount, 2);
  if (saleInput.changeDue !== undefined && saleInput.changeDue !== changeDue) return { success: false, error: 'Incorrect change amount.' };

  // 5. Deduct Stock & Record Stock Movements per product
  const newStockMovements = [...current.stockMovements];
  const newProducts = current.products.map((prod) => {
    const totalDeduction = requestedQtyByProduct.get(prod.id);
    if (totalDeduction === undefined) return prod;

    const prevStock = prod.currentStock;
    const nextStock =
      prevStock !== null
        ? Math.max(0, roundPrecision(prevStock - totalDeduction, 3))
        : null;

    if (prevStock !== null) {
      newStockMovements.unshift({
        id: `mov-${crypto.randomUUID()}`,
        productId: prod.id,
        productName: prod.name,
        type: 'sale',
        quantity: -totalDeduction,
        previousStock: prevStock,
        newStock: nextStock,
        reason: `Sale (${totalDeduction} ${prod.unit})`,
        createdAt: new Date().toISOString(),
      });
    }

    return {
      ...prod,
      currentStock: nextStock,
      updatedAt: new Date().toISOString(),
    };
  });

  // 6. Handle Customer Udhaar if paymentMode is 'udhaar'
  let customerName: string | undefined;
  const newCustomers = [...current.customers];
  const newUdhaarTx = [...current.udhaarTransactions];

  if (saleInput.paymentMode === 'udhaar') {
    if (!saleInput.customerId) {
      return { success: false, error: 'Customer selection is required for credit / udhaar sales.' };
    }
    const custIndex = newCustomers.findIndex((c) => c.id === saleInput.customerId);
    if (custIndex === -1) {
      return { success: false, error: 'Selected customer not found.' };
    }
    const existingCust = newCustomers[custIndex];
    const currentAdv = existingCust.advanceBalance ?? 0;
    let newBalance = existingCust.currentBalance;
    let newAdvance = currentAdv;
    let txNote = `Bill Sale: ${saleInput.items.map((i) => `${i.productName} (${i.quantity} ${i.unit})`).join(', ')}`;

    if (currentAdv >= totalAmount) {
      // Covered entirely by advance deposit
      newAdvance = roundPrecision(currentAdv - totalAmount, 2);
      txNote += ` (Deducted from advance: ₹${totalAmount}, Remaining advance: ₹${newAdvance})`;
    } else if (currentAdv > 0) {
      // Partial advance deposit
      const remainingDue = roundPrecision(totalAmount - currentAdv, 2);
      newAdvance = 0;
      newBalance = roundPrecision(existingCust.currentBalance + remainingDue, 2);
      txNote += ` (₹${currentAdv} deducted from advance, ₹${remainingDue} added to udhaar)`;
    } else {
      // No advance deposit
      newAdvance = 0;
      newBalance = roundPrecision(existingCust.currentBalance + totalAmount, 2);
    }

    const updatedCust: Customer = {
      ...existingCust,
      currentBalance: newBalance,
      advanceBalance: newAdvance,
      lastTransactionAt: new Date().toISOString(),
    };
    newCustomers[custIndex] = updatedCust;
    customerName = updatedCust.name;

    newUdhaarTx.unshift({
      id: `udh-${crypto.randomUUID()}`,
      customerId: updatedCust.id,
      type: 'credit_given',
      amount: roundPrecision(totalAmount, 2),
      notes: txNote,
      createdAt: new Date().toISOString(),
    });
  }

  // 7. Create Sale
  const invoiceNo = saleInput.invoiceNo || `DS-${1000 + current.sales.length + 1}`;
  const paymentStatus =
    saleInput.paymentStatus ||
    (saleInput.paymentMode === 'online' ? undefined : 'completed');

  const defaultVerificationStatus: PaymentVerificationStatus =
    saleInput.paymentMode === 'online'
      ? 'pending_verification'
      : 'paid';

  const newSale: Sale = {
    id: `sale-${crypto.randomUUID()}`,
    invoiceNo,
    operationId,
    operationPayload: operationId ? operationPayload : undefined,
    items: saleInput.items.map(item => ({ ...item, productName: current.products.find(p => p.id === item.productId)!.name, totalPrice: roundPrecision(item.quantity * item.unitPrice, 2) })),
    totalAmount,
    subtotal,
    discountAmount: discountAmount > 0 ? discountAmount : undefined,
    discountType: saleInput.discountType,
    discountValue: saleInput.discountValue,
    cashReceived: saleInput.cashReceived,
    changeDue,
    paymentMode: saleInput.paymentMode,
    customerId: saleInput.customerId,
    customerName,
    createdAt: new Date().toISOString(),
    notes: saleInput.notes,
    upiId: saleInput.paymentMode === 'online' ? saleInput.upiId : undefined,
    paymentStatus,
    paymentVerificationStatus: saleInput.paymentVerificationStatus || defaultVerificationStatus,
    transactionRef: saleInput.transactionRef,
  };

  const modeText =
    saleInput.paymentMode === 'cash'
      ? 'Cash'
      : saleInput.paymentMode === 'online'
      ? `UPI / Online (${newSale.paymentVerificationStatus === 'paid' ? 'Verified' : 'Pending Verification'}${saleInput.upiId ? ` • ${saleInput.upiId}` : ''})`
      : `Credit / Udhaar (${customerName})`;

  const updatedData: DukaanStoreData = {
    ...current,
    products: newProducts,
    customers: newCustomers,
    sales: [newSale, ...current.sales],
    udhaarTransactions: newUdhaarTx,
    stockMovements: newStockMovements,
    activities: [
      {
        id: `act-${crypto.randomUUID()}`,
        type: 'sale',
        title: `Sale Recorded (${invoiceNo})`,
        description: `₹${totalAmount} • ${modeText} • ${saleInput.items.length} items`,
        amount: totalAmount,
        timestamp: new Date().toISOString(),
      },
      ...current.activities,
    ],
  };

  return { success: true, sale: newSale, data: updatedData };
}
