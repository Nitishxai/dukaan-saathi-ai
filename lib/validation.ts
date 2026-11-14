import type { DukaanShopBackup } from '../types';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const date = (v: unknown) => {
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))return false;
  const [year,month,day]=v.slice(0,10).split('-').map(Number);
  const check=new Date(Date.UTC(year,month-1,day));
  return check.getUTCFullYear()===year&&check.getUTCMonth()===month-1&&check.getUTCDate()===day;
};
const amount = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && Number.isSafeInteger(Math.round(v * 100));
const strings=(row:Record<string,unknown>,keys:string[])=>keys.every(key=>row[key]===undefined||typeof row[key]==='string');
const currency=(v:unknown)=>amount(v)&&Math.abs((v as number)*100-Math.round((v as number)*100))<1e-6;
const cents = (v: number) => Math.round(v * 100);

/** Validate nested records before casting or writing. Historical product IDs may be deleted;
 * their immutable invoice line names/units remain required. Customer references must exist. */
export function validateBackupRecords(value: unknown): string | null {
  if (!object(value) || !object(value.shopProfile) || !object(value.data)) return 'Missing backup objects.';
  const p = value.shopProfile, d = value.data;
  if (![p.id, p.shopName, p.ownerName, p.category].every(text) || !date(p.createdAt) || typeof p.isOnboarded !== 'boolean') return 'Invalid shop profile.';
  if(!strings(p,['businessType','customBusinessType','description','phone','address','upiId']) || (p.isDemo!==undefined&&typeof p.isDemo!=='boolean'))return 'Invalid profile fields.';
  if (!date(value.exportedAt) || !date(d.lastResetAt)) return 'Invalid backup dates.';
  const optionalText:Record<string,string[]>={
    products:['hindiName','brandOrVariant','supplier','size','color','modelNumber','warranty','batchNumber','expiryDate','barcode','sku','description','parentProductId'],
    customers:['address','lastTransactionAt'],sales:['customerId','customerName','notes','upiId','transactionRef','operationId','operationPayload','reversedAt','reversalReason','refundRecordedAt'],
    udhaarTransactions:['saleId'],stockMovements:['referenceId'],activities:['referenceId']
  };
  const names = ['products','customers','sales','udhaarTransactions','stockMovements','activities'] as const;
  for (const name of names) {
    const rows = d[name];
    if (!Array.isArray(rows)) return `Missing ${name} records.`;
    const ids = new Set();
    for (const row of rows) {
      if (!object(row) || !text(row.id) || ids.has(row.id)) return `Invalid or duplicate ${name} ID.`;
      ids.add(row.id);
      if(!strings(row,optionalText[name]))return `Invalid text field in ${name}.`;
      for (const [key, val] of Object.entries(row)) {
        if (typeof val === 'number' && !Number.isFinite(val)) return `Non-finite ${name}.${key}.`;
        if ((key.endsWith('At') || key === 'timestamp') && val !== undefined && !date(val)) return `Invalid ${name}.${key}.`;
      }
    }
  }
  const backup = value as unknown as DukaanShopBackup;
  if(value.meta!==undefined){
    if(!object(value.meta)||value.meta.totalProducts!==backup.data.products.length||value.meta.totalSales!==backup.data.sales.length||value.meta.totalCustomers!==backup.data.customers.length||value.meta.totalUdhaarTransactions!==backup.data.udhaarTransactions.length)return 'Invalid backup record counts.';
  }
  const customers = new Set(backup.data.customers.map(c => c.id));
  const sales = new Set(backup.data.sales.map(s => s.id));
  for (const product of backup.data.products) {
    if((product.sellingPrice!==null&&!currency(product.sellingPrice))||(product.purchasePrice!=null&&!currency(product.purchasePrice)))return 'Invalid product currency precision.';
    if (![product.name,product.category,product.unit].every(text) || !date(product.updatedAt) || !amount(product.minStockAlert) || (product.currentStock !== null && !amount(product.currentStock)) || (product.sellingPrice !== null && !amount(product.sellingPrice)) || (product.purchasePrice != null && !amount(product.purchasePrice))) return 'Invalid product record.';
  }
  for (const customer of backup.data.customers) {
    if(!currency(customer.currentBalance)||(customer.advanceBalance!==undefined&&!currency(customer.advanceBalance)))return 'Invalid customer currency precision.';
    if (!text(customer.name) || typeof customer.phone !== 'string' || !date(customer.createdAt) || !amount(customer.currentBalance) || (customer.advanceBalance !== undefined && !amount(customer.advanceBalance))) return 'Invalid customer record.';
  }
  const operations = new Set<string>();
  const invoices = new Set<string>();
  for (const sale of backup.data.sales) {
    if (!date(sale.createdAt) || !text(sale.invoiceNo) || invoices.has(sale.invoiceNo) || !Array.isArray(sale.items) || !sale.items.length || !amount(sale.totalAmount) || !['cash','online','udhaar'].includes(sale.paymentMode)) return 'Invalid invoice.';
    invoices.add(sale.invoiceNo);
    for(const value of [sale.totalAmount,sale.subtotal,sale.discountAmount,sale.discountValue,sale.cashReceived,sale.changeDue]){if(value!==undefined&&!currency(value))return 'Invalid invoice amount precision.';}
    if(sale.discountType!==undefined&&!['flat','percentage'].includes(sale.discountType))return 'Invalid discount type.';
    if(sale.refundRecordedAt&&!sale.reversedAt)return 'Refund requires a reversal.';
    if(sale.reversedAt&&!text(sale.reversalReason))return 'Reversal reason required.';
    if (sale.operationId) { if (!text(sale.operationId) || operations.has(sale.operationId) || !text(sale.operationPayload)) return 'Invalid operation ID.'; operations.add(sale.operationId); }
    if (sale.paymentVerificationStatus !== undefined && !['paid','pending_verification','failed','cancelled','partially_paid'].includes(sale.paymentVerificationStatus)) return 'Invalid payment status.';
    if (sale.paymentStatus !== undefined && !['completed','manually_confirmed'].includes(sale.paymentStatus)) return 'Invalid confirmation status.';
    if ((sale.paymentMode === 'udhaar' && !sale.customerId) || (sale.customerId && !customers.has(sale.customerId))) return 'Unknown invoice customer.';
    let sum = 0;
    for (const item of sale.items) {
      if (!object(item) || ![item.productId,item.productName,item.unit].every(text) || !amount(item.quantity) || item.quantity <= 0 || !amount(item.unitPrice) || !amount(item.totalPrice) || cents(item.totalPrice) !== cents(item.quantity * item.unitPrice)) return 'Invalid invoice line.';
      if(!strings(item,['barcode','sku','size','color','brandOrVariant'])||!currency(item.unitPrice)||!currency(item.totalPrice))return 'Invalid invoice line fields.';
      sum += cents(item.totalPrice);
    }
    if (sale.subtotal !== undefined && (!amount(sale.subtotal) || cents(sale.subtotal) !== sum)) return 'Inconsistent subtotal.';
    if (!amount(sale.discountAmount ?? 0) || sum - cents(sale.discountAmount ?? 0) !== cents(sale.totalAmount)) return 'Inconsistent invoice amount.';
    if (sale.cashReceived !== undefined && (!amount(sale.cashReceived) || sale.cashReceived < sale.totalAmount || cents(sale.changeDue ?? 0) !== cents(sale.cashReceived - sale.totalAmount))) return 'Invalid cash tender.';
  }
  for (const tx of backup.data.udhaarTransactions) {
    if (!customers.has(tx.customerId) || (tx.saleId && !sales.has(tx.saleId)) || !date(tx.createdAt) || !['credit_given','payment_received','credit_reversal'].includes(tx.type) || !currency(tx.amount) || tx.amount <= 0 || typeof tx.notes !== 'string') return 'Invalid ledger entry.';
  }
  for (const m of backup.data.stockMovements) {
    if (!text(m.productId) || !text(m.productName) || !date(m.createdAt) || !['opening','purchase','sale','adjustment','return'].includes(m.type) || !Number.isFinite(m.quantity) || (m.previousStock !== null && !amount(m.previousStock)) || (m.newStock !== null && !amount(m.newStock)) || typeof m.reason !== 'string') return 'Invalid stock movement.';
  }
  for (const a of backup.data.activities) {
    if (!text(a.title) || typeof a.description !== 'string' || !date(a.timestamp) || !['sale','stock_add','stock_update','udhaar_given','udhaar_received','product_add','product_delete','profile_update'].includes(a.type) || (a.amount !== undefined && !amount(a.amount))) return 'Invalid activity record.';
  }
  return null;
}
