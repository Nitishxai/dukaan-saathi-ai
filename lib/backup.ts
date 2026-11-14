import { validateBackupRecords } from './validation.ts';
import type {
  DukaanStoreData,
  DukaanShopBackup,
  BackupValidationResult,
  Product,
  Customer,
  Sale,
  UdhaarTransaction,
  StockMovement,
  ActivityLog,
  ShopProfile,
} from '../types';
import { getActiveProfile, saveStoreData, roundPrecision, preserveRecoverySnapshot, getStoreData } from './storage.ts';

/**
 * Creates a clean, serialized JSON backup of the provided shop store data.
 * Guarantees no API keys, secrets, or unrelated shop profiles are included.
 */
export function createShopBackup(storeData: DukaanStoreData): DukaanShopBackup {
  const profile = storeData.profile || getActiveProfile();

  // Clean profile object with only expected shop metadata
  const cleanProfile: ShopProfile = {
    id: profile.id,
    shopName: (profile.shopName || storeData.shopName || 'My Dukaan').trim(),
    ownerName: (profile.ownerName || storeData.shopkeeperName || 'Shopkeeper').trim(),
    category: (profile.category || 'General Store').trim(),
    businessType: profile.businessType || 'kirana',
    customBusinessType: profile.customBusinessType?.trim() || undefined,
    description: profile.description?.trim() || undefined,
    phone: (profile.phone || storeData.phone || '').trim() || undefined,
    address: profile.address?.trim() || undefined,
    upiId: profile.upiId?.trim() || undefined,
    createdAt: profile.createdAt || new Date().toISOString(),
    isOnboarded: true,
    isDemo: false,
  };

  // Clean products array, preserving all business-specific attributes
  const cleanProducts: Product[] = (storeData.products || []).map((p) => ({
    id: p.id,
    name: p.name.trim(),
    hindiName: p.hindiName?.trim() || undefined,
    brandOrVariant: p.brandOrVariant?.trim() || undefined,
    category: p.category?.trim() || 'General',
    unit: p.unit,
    currentStock: p.currentStock !== null && p.currentStock !== undefined ? Number(p.currentStock) : null,
    sellingPrice: p.sellingPrice !== null && p.sellingPrice !== undefined ? Number(p.sellingPrice) : null,
    purchasePrice: p.purchasePrice !== null && p.purchasePrice !== undefined ? Number(p.purchasePrice) : undefined,
    minStockAlert: typeof p.minStockAlert === 'number' ? Math.max(0, p.minStockAlert) : 5,
    supplier: p.supplier?.trim() || undefined,
    updatedAt: p.updatedAt || new Date().toISOString(),
    // Dynamic business attributes
    size: p.size?.trim() || undefined,
    color: p.color?.trim() || undefined,
    modelNumber: p.modelNumber?.trim() || undefined,
    warranty: p.warranty?.trim() || undefined,
    batchNumber: p.batchNumber?.trim() || undefined,
    expiryDate: p.expiryDate?.trim() || undefined,
    barcode: p.barcode?.trim() || undefined,
    sku: p.sku?.trim() || undefined,
    description: p.description?.trim() || undefined,
    parentProductId: p.parentProductId?.trim() || undefined,
  }));

  // Clean customers array
  const cleanCustomers: Customer[] = (storeData.customers || []).map((c) => ({
    id: c.id,
    name: c.name.trim(),
    phone: c.phone?.trim() || '—',
    address: c.address?.trim() || undefined,
    currentBalance: roundPrecision(Number(c.currentBalance || 0), 2),
    advanceBalance: c.advanceBalance !== undefined ? roundPrecision(Math.max(0, Number(c.advanceBalance || 0)), 2) : 0,
    lastTransactionAt: c.lastTransactionAt || undefined,
    createdAt: c.createdAt || new Date().toISOString(),
  }));

  // Clean sales array
  const cleanSales: Sale[] = (storeData.sales || []).map((s) => ({
    id: s.id,
    invoiceNo: s.invoiceNo,
    reversedAt: s.reversedAt,
    reversalReason: s.reversalReason,
    refundRecordedAt: s.refundRecordedAt,
    operationId: s.operationId,
    operationPayload: s.operationPayload,
    items: (s.items || []).map((item) => ({
      productId: item.productId,
      productName: item.productName,
      unit: item.unit,
      quantity: roundPrecision(Number(item.quantity), 3),
      unitPrice: roundPrecision(Number(item.unitPrice), 2),
      totalPrice: roundPrecision(Number(item.totalPrice), 2),
      barcode: item.barcode?.trim() || undefined,
      sku: item.sku?.trim() || undefined,
      size: item.size?.trim() || undefined,
      color: item.color?.trim() || undefined,
      brandOrVariant: item.brandOrVariant?.trim() || undefined,
    })),
    totalAmount: roundPrecision(Number(s.totalAmount), 2),
    subtotal: s.subtotal !== undefined ? roundPrecision(Number(s.subtotal), 2) : undefined,
    discountAmount: s.discountAmount !== undefined ? roundPrecision(Number(s.discountAmount), 2) : undefined,
    discountType: s.discountType,
    discountValue: s.discountValue !== undefined ? Number(s.discountValue) : undefined,
    cashReceived: s.cashReceived !== undefined ? roundPrecision(Number(s.cashReceived), 2) : undefined,
    changeDue: s.changeDue !== undefined ? roundPrecision(Number(s.changeDue), 2) : undefined,
    paymentMode: s.paymentMode,
    customerId: s.customerId || undefined,
    customerName: s.customerName || undefined,
    createdAt: s.createdAt || new Date().toISOString(),
    notes: s.notes?.trim() || undefined,
    upiId: s.upiId?.trim() || undefined,
    paymentStatus: s.paymentStatus || 'completed',
    paymentVerificationStatus: s.paymentVerificationStatus,
    transactionRef: s.transactionRef?.trim() || undefined,
  }));

  // Clean udhaar transactions
  const cleanUdhaarTransactions: UdhaarTransaction[] = (storeData.udhaarTransactions || []).map((tx) => ({
    id: tx.id,
    customerId: tx.customerId,
    type: tx.type,
    amount: roundPrecision(Number(tx.amount), 2),
    notes: tx.notes?.trim() || '',
    createdAt: tx.createdAt || new Date().toISOString(),
    saleId: tx.saleId || undefined,
  }));

  // Clean stock movements
  const cleanStockMovements: StockMovement[] = (storeData.stockMovements || []).map((m) => ({
    id: m.id,
    productId: m.productId,
    productName: m.productName,
    type: m.type,
    quantity: roundPrecision(Number(m.quantity), 3),
    previousStock: m.previousStock !== null && m.previousStock !== undefined ? Number(m.previousStock) : null,
    newStock: m.newStock !== null && m.newStock !== undefined ? Number(m.newStock) : null,
    reason: m.reason,
    createdAt: m.createdAt || new Date().toISOString(),
    referenceId: m.referenceId || undefined,
  }));

  // Clean activity logs
  const cleanActivities: ActivityLog[] = (storeData.activities || []).map((a) => ({
    id: a.id,
    type: a.type,
    title: a.title,
    description: a.description,
    amount: a.amount !== undefined ? roundPrecision(Number(a.amount), 2) : undefined,
    timestamp: a.timestamp || new Date().toISOString(),
    referenceId: a.referenceId || undefined,
  }));

  return {
    schemaVersion: '1.0',
    app: 'Dukaan Sathi AI',
    exportedAt: new Date().toISOString(),
    shopProfile: cleanProfile,
    data: {
      products: cleanProducts,
      sales: cleanSales,
      customers: cleanCustomers,
      udhaarTransactions: cleanUdhaarTransactions,
      stockMovements: cleanStockMovements,
      activities: cleanActivities,
      lastResetAt: storeData.lastResetAt || new Date().toISOString(),
    },
    meta: {
      totalProducts: cleanProducts.length,
      totalSales: cleanSales.length,
      totalCustomers: cleanCustomers.length,
      totalUdhaarTransactions: cleanUdhaarTransactions.length,
    },
  };
}

/**
 * Validates a parsed JSON backup payload strictly.
 * Ensures schema version, required structure, numeric boundaries, and ID uniqueness.
 */
export function validateShopBackup(raw: unknown): BackupValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      isValid: false,
      error: 'Invalid backup file: Payload must be a valid JSON object.',
    };
  }

  const candidate = raw as Record<string, unknown>;

  // 1. App Identifier & Schema Version
  if (candidate.app !== 'Dukaan Sathi AI') {
    return {
      isValid: false,
      error: 'Invalid backup file: Not a recognized Dukaan Sathi AI backup.',
    };
  }

  if (candidate.schemaVersion !== '1.0') {
    return {
      isValid: false,
      error: `Unsupported schema version "${String(candidate.schemaVersion)}". Only version 1.0 is supported.`,
    };
  }

  // 2. Export Timestamp
  if (typeof candidate.exportedAt !== 'string' || isNaN(new Date(candidate.exportedAt).getTime())) {
    return {
      isValid: false,
      error: 'Invalid backup file: Missing or invalid export timestamp.',
    };
  }

  // 3. Shop Profile
  if (!candidate.shopProfile || typeof candidate.shopProfile !== 'object' || Array.isArray(candidate.shopProfile)) {
    return {
      isValid: false,
      error: 'Invalid backup file: Missing shopProfile configuration.',
    };
  }

  const profile = candidate.shopProfile as Record<string, unknown>;
  if (typeof profile.shopName !== 'string' || !profile.shopName.trim()) {
    return {
      isValid: false,
      error: 'Invalid backup file: Shop profile must include a valid shop name.',
    };
  }

  // 4. Data Object
  if (!candidate.data || typeof candidate.data !== 'object' || Array.isArray(candidate.data)) {
    return {
      isValid: false,
      error: 'Invalid backup file: Missing data records container.',
    };
  }

  const data = candidate.data as Record<string, unknown>;

  // Products Validation
  if (!Array.isArray(data.products)) {
    return {
      isValid: false,
      error: 'Invalid backup file: "data.products" must be an array.',
    };
  }

  const productIdSet = new Set<string>();
  for (let i = 0; i < data.products.length; i++) {
    const p = data.products[i];
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      return {
        isValid: false,
        error: `Product at position ${i + 1} is invalid.`,
      };
    }
    const prod = p as Record<string, unknown>;
    if (typeof prod.id !== 'string' || !prod.id.trim()) {
      return {
        isValid: false,
        error: `Product at position ${i + 1} has an empty or missing ID.`,
      };
    }
    if (productIdSet.has(prod.id)) {
      return {
        isValid: false,
        error: `Duplicate product ID "${prod.id}" found in backup file.`,
      };
    }
    productIdSet.add(prod.id);

    if (typeof prod.name !== 'string' || !prod.name.trim()) {
      return {
        isValid: false,
        error: `Product at position ${i + 1} has an empty or missing name.`,
      };
    }
    if (typeof prod.unit !== 'string' || !prod.unit.trim()) {
      return {
        isValid: false,
        error: `Product "${prod.name}" has an invalid or missing unit.`,
      };
    }
    if (prod.currentStock !== null && prod.currentStock !== undefined) {
      if (typeof prod.currentStock !== 'number' || isNaN(prod.currentStock) || prod.currentStock < 0) {
        return {
          isValid: false,
          error: `Product "${prod.name}" has an invalid negative or non-numeric stock (${String(prod.currentStock)}).`,
        };
      }
    }
    if (prod.sellingPrice !== null && prod.sellingPrice !== undefined) {
      if (typeof prod.sellingPrice !== 'number' || isNaN(prod.sellingPrice) || prod.sellingPrice < 0) {
        return {
          isValid: false,
          error: `Product "${prod.name}" has an invalid negative or non-numeric selling price (${String(prod.sellingPrice)}).`,
        };
      }
    }
    if (prod.purchasePrice !== null && prod.purchasePrice !== undefined) {
      if (typeof prod.purchasePrice !== 'number' || isNaN(prod.purchasePrice) || prod.purchasePrice < 0) {
        return {
          isValid: false,
          error: `Product "${prod.name}" has an invalid negative purchase price (${String(prod.purchasePrice)}).`,
        };
      }
    }
    if (prod.barcode !== undefined && prod.barcode !== null && typeof prod.barcode !== 'string') {
      return {
        isValid: false,
        error: `Product "${prod.name}" has an invalid non-string barcode.`,
      };
    }
    if (prod.sku !== undefined && prod.sku !== null && typeof prod.sku !== 'string') {
      return {
        isValid: false,
        error: `Product "${prod.name}" has an invalid non-string SKU.`,
      };
    }
  }

  // Customers Validation
  if (!Array.isArray(data.customers)) {
    return {
      isValid: false,
      error: 'Invalid backup file: "data.customers" must be an array.',
    };
  }

  const customerIdSet = new Set<string>();
  for (let i = 0; i < data.customers.length; i++) {
    const c = data.customers[i];
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      return {
        isValid: false,
        error: `Customer at position ${i + 1} is invalid.`,
      };
    }
    const cust = c as Record<string, unknown>;
    if (typeof cust.id !== 'string' || !cust.id.trim()) {
      return {
        isValid: false,
        error: `Customer at position ${i + 1} has an empty or missing ID.`,
      };
    }
    if (customerIdSet.has(cust.id)) {
      return {
        isValid: false,
        error: `Duplicate customer ID "${cust.id}" found in backup file.`,
      };
    }
    customerIdSet.add(cust.id);

    if (typeof cust.name !== 'string' || !cust.name.trim()) {
      return {
        isValid: false,
        error: `Customer at position ${i + 1} has an empty or missing name.`,
      };
    }
    if (typeof cust.currentBalance !== 'number' || isNaN(cust.currentBalance)) {
      return {
        isValid: false,
        error: `Customer "${cust.name}" has an invalid non-numeric balance.`,
      };
    }
    if (cust.advanceBalance !== undefined) {
      if (typeof cust.advanceBalance !== 'number' || isNaN(cust.advanceBalance) || cust.advanceBalance < 0) {
        return {
          isValid: false,
          error: `Customer "${cust.name}" has an invalid advance balance.`,
        };
      }
    }
  }

  // Sales Validation
  if (!Array.isArray(data.sales)) {
    return {
      isValid: false,
      error: 'Invalid backup file: "data.sales" must be an array.',
    };
  }

  const saleIdSet = new Set<string>();
  for (let i = 0; i < data.sales.length; i++) {
    const s = data.sales[i];
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      return {
        isValid: false,
        error: `Sale at position ${i + 1} is invalid.`,
      };
    }
    const sale = s as Record<string, unknown>;
    if (typeof sale.id !== 'string' || !sale.id.trim()) {
      return {
        isValid: false,
        error: `Sale at position ${i + 1} has an empty or missing ID.`,
      };
    }
    if (saleIdSet.has(sale.id)) {
      return {
        isValid: false,
        error: `Duplicate sale ID "${sale.id}" found in backup file.`,
      };
    }
    saleIdSet.add(sale.id);

    if (typeof sale.totalAmount !== 'number' || isNaN(sale.totalAmount) || sale.totalAmount < 0) {
      return {
        isValid: false,
        error: `Sale "${String(sale.invoiceNo || sale.id)}" has an invalid total amount.`,
      };
    }

    if (!['cash', 'online', 'udhaar'].includes(String(sale.paymentMode))) {
      return {
        isValid: false,
        error: `Sale "${String(sale.invoiceNo || sale.id)}" has an unsupported payment mode "${String(sale.paymentMode)}".`,
      };
    }

    if (!Array.isArray(sale.items) || sale.items.length === 0) {
      return {
        isValid: false,
        error: `Sale "${String(sale.invoiceNo || sale.id)}" contains no billed items.`,
      };
    }

    if (
      sale.subtotal !== undefined &&
      sale.subtotal !== null &&
      (typeof sale.subtotal !== 'number' || isNaN(sale.subtotal) || sale.subtotal < 0)
    ) {
      return {
        isValid: false,
        error: `Sale "${String(sale.invoiceNo || sale.id)}" has an invalid subtotal.`,
      };
    }

    if (
      sale.discountAmount !== undefined &&
      sale.discountAmount !== null &&
      (typeof sale.discountAmount !== 'number' || isNaN(sale.discountAmount) || sale.discountAmount < 0)
    ) {
      return {
        isValid: false,
        error: `Sale "${String(sale.invoiceNo || sale.id)}" has an invalid discount amount.`,
      };
    }
  }

  // Udhaar Transactions Validation
  if (!Array.isArray(data.udhaarTransactions)) {
    return {
      isValid: false,
      error: 'Invalid backup file: "data.udhaarTransactions" must be an array.',
    };
  }

  const txIdSet = new Set<string>();
  for (let i = 0; i < data.udhaarTransactions.length; i++) {
    const tx = data.udhaarTransactions[i];
    if (!tx || typeof tx !== 'object' || Array.isArray(tx)) {
      return {
        isValid: false,
        error: `Udhaar transaction at position ${i + 1} is invalid.`,
      };
    }
    const t = tx as Record<string, unknown>;
    if (typeof t.id !== 'string' || !t.id.trim()) {
      return {
        isValid: false,
        error: `Udhaar transaction at position ${i + 1} has an empty ID.`,
      };
    }
    if (txIdSet.has(t.id)) {
      return {
        isValid: false,
        error: `Duplicate transaction ID "${t.id}" found in backup file.`,
      };
    }
    txIdSet.add(t.id);

    if (!['credit_given', 'payment_received', 'credit_reversal'].includes(String(t.type))) {
      return {
        isValid: false,
        error: `Udhaar transaction "${t.id}" has an invalid type "${String(t.type)}".`,
      };
    }

    if (typeof t.amount !== 'number' || isNaN(t.amount) || t.amount <= 0) {
      return {
        isValid: false,
        error: `Udhaar transaction "${t.id}" has an invalid amount (${String(t.amount)}).`,
      };
    }
  }

  const nestedError = validateBackupRecords(candidate);
  if (nestedError) return { isValid: false, error: nestedError };
  // Sanitized cast
  const validatedBackup = candidate as unknown as DukaanShopBackup;

  // Compute total outstanding credit across customers
  const totalOutstandingCredit = (validatedBackup.data.customers || []).reduce(
    (sum, c) => sum + (c.currentBalance > 0 ? c.currentBalance : 0),
    0
  );

  return {
    isValid: true,
    backup: validatedBackup,
    summary: {
      shopName: validatedBackup.shopProfile.shopName,
      ownerName: validatedBackup.shopProfile.ownerName || 'Shopkeeper',
      businessType: validatedBackup.shopProfile.businessType || 'kirana',
      exportedAt: validatedBackup.exportedAt,
      productCount: validatedBackup.data.products.length,
      salesCount: validatedBackup.data.sales.length,
      customerCount: validatedBackup.data.customers.length,
      udhaarCount: validatedBackup.data.udhaarTransactions.length,
      totalOutstandingCredit: roundPrecision(totalOutstandingCredit, 2),
    },
  };
}

/**
 * Triggers a browser file download of the backup JSON payload.
 */
export function downloadBackupFile(backup: DukaanShopBackup): void {
  if (typeof window === 'undefined') return;

  const rawJson = JSON.stringify(backup, null, 2);
  const blob = new Blob([rawJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // Clean slug for filename
  const rawShopName = backup.shopProfile.shopName || 'dukaan';
  const slug = rawShopName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'shop';

  const exportDate = new Date(backup.exportedAt || Date.now());
  const year = exportDate.getFullYear();
  const month = String(exportDate.getMonth() + 1).padStart(2, '0');
  const day = String(exportDate.getDate()).padStart(2, '0');
  const hours = String(exportDate.getHours()).padStart(2, '0');
  const minutes = String(exportDate.getMinutes()).padStart(2, '0');

  const filename = `dukaan-sathi-${slug}-backup-${year}${month}${day}-${hours}${minutes}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Safely restores a validated backup into the target shop profile slot.
 * Ensures transactional safety: fails immediately without modifying existing data if validation fails.
 */
export function restoreBackupToStore(
  backup: DukaanShopBackup,
  targetProfileId?: string
): { success: boolean; error?: string } {
  // Validate first before touching storage
  const validation = validateShopBackup(backup);
  if (!validation.isValid || !validation.backup) {
    return {
      success: false,
      error: validation.error || 'Backup validation failed. Existing data was left untouched.',
    };
  }

  const activeProfile = getActiveProfile();
  const profileId = targetProfileId || activeProfile.id;
  if (profileId !== activeProfile.id) return { success: false, error: 'Switch to the target shop before restoring.' };

  // Preserve the slot ID so other shop profile pointers stay intact
  const restoredProfile: ShopProfile = {
    ...validation.backup.shopProfile,
    id: profileId,
    isOnboarded: true,
    isDemo: false,
  };

  const restoredStoreData: DukaanStoreData = {
    revision: getStoreData().revision,
    profile: restoredProfile,
    shopName: restoredProfile.shopName,
    shopkeeperName: restoredProfile.ownerName,
    phone: restoredProfile.phone || '',
    products: validation.backup.data.products,
    sales: validation.backup.data.sales,
    customers: validation.backup.data.customers,
    udhaarTransactions: validation.backup.data.udhaarTransactions,
    stockMovements: validation.backup.data.stockMovements || [],
    activities: [
      {
        id: `act-${Date.now()}`,
        type: 'profile_update',
        title: 'Shop Data Restored from Backup',
        description: `Restored ${validation.backup.data.products.length} products, ${validation.backup.data.sales.length} sales, and ${validation.backup.data.customers.length} customers from backup file (${new Date(validation.backup.exportedAt).toLocaleDateString()}).`,
        timestamp: new Date().toISOString(),
      },
      ...(validation.backup.data.activities || []),
    ],
    lastResetAt: new Date().toISOString(),
  };

  if (!preserveRecoverySnapshot()) return { success: false, error: 'Cannot preserve pre-restore snapshot. Restore cancelled.' };
  // Atomically save using storage architecture
  if (!saveStoreData(restoredStoreData)) {
    return {
      success: false,
      error: 'बैकअप डेटा डिवाइस स्टोरेज में सुरक्षित नहीं हो सका (मेमोरी फुल या परमिशन एरर)।',
    };
  }

  return { success: true };
}
