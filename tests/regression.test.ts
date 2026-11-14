import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Setup Mock Browser Storage Environment for Node runtime
class LocalStorageMock {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

const mockLocalStorage = new LocalStorageMock();

interface MockWindow {
  localStorage: LocalStorageMock;
  dispatchEvent: () => boolean;
  addEventListener: () => void;
  removeEventListener: () => void;
}

interface CustomEventMock {
  type: string;
  detail: unknown;
}

const g = globalThis as unknown as {
  window: MockWindow;
  localStorage: LocalStorageMock;
  CustomEvent: new (type: string, detail?: unknown) => CustomEventMock;
};

g.window = {
  localStorage: mockLocalStorage,
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};
g.localStorage = mockLocalStorage;
g.CustomEvent = class CustomEvent implements CustomEventMock {
  type: string;
  detail: unknown;
  constructor(type: string, detail?: unknown) {
    this.type = type;
    this.detail = detail;
  }
};

import {
  saveStoreData,
  resetCurrentShopToEmpty,
  loadDemoShop,
  resetToDemoData,
  __resetStorageForTesting,
  getStoreData,
  addProduct,
  updateProduct,
  deleteProduct,
  quickAddStock,
  saveProductsBatch,
  recordSale,
  addCustomer,
  recordUdhaarTransaction,
  calculateDailySales,
  createShopProfile,
  updateShopProfile,
  switchProfile,
  roundPrecision,
  findProductByBarcodeOrSku,
  generateInternalSku,
  updateSalePaymentStatus,
  STORAGE_FAILURE_ERROR_MESSAGE,
} from '../lib/storage.ts';

import {
  createShopBackup,
  validateShopBackup,
  restoreBackupToStore,
} from '../lib/backup.ts';

import { parseHinglishCommand } from '../lib/ai-parser.ts';
import {
  isProductOnboardingTrigger,
  startProductConversation,
  processProductConversationTurn,
  convertDraftToProducts,
} from '../lib/product-conversation.ts';
import { POST as paymentWebhookPost } from '../app/api/payment/webhook/route.ts';

describe('Dukaan Sathi AI - Comprehensive Reliability & Regression Suite', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    __resetStorageForTesting();
  });

  // -------------------------------------------------------------
  // Scenario 1: Product CRUD and Validation
  // -------------------------------------------------------------
  it('Scenario 1: Validates product creation, editing, negative price/stock rejection, and duplicate names', () => {
    // 1. Successful product creation
    const res1 = addProduct({
      name: 'Basmati Rice',
      sellingPrice: 120,
      purchasePrice: 95,
      currentStock: 50,
      unit: 'kg',
      category: 'Grains',
      minStockAlert: 10,
    });
    assert.equal(res1.success, true, 'Product should be created successfully');
    assert.ok(res1.product?.id, 'Product should have an assigned ID');
    assert.equal(res1.product?.name, 'Basmati Rice');
    assert.equal(res1.product?.currentStock, 50);

    // 2. Reject empty or whitespace-only name
    const emptyNameRes = addProduct({
      name: '   ',
      sellingPrice: 50,
      currentStock: 10,
      unit: 'piece',
      category: 'General',
      minStockAlert: 2,
    });
    assert.equal(emptyNameRes.success, false);
    assert.match(emptyNameRes.error || '', /required/i);

    // 3. Reject negative selling price
    const negPriceRes = addProduct({
      name: 'Mustard Oil',
      sellingPrice: -150,
      currentStock: 20,
      unit: 'litre',
      category: 'Oils',
      minStockAlert: 5,
    });
    assert.equal(negPriceRes.success, false);
    assert.match(negPriceRes.error || '', /greater than zero/i);

    // 4. Reject negative stock
    const negStockRes = addProduct({
      name: 'Tata Salt',
      sellingPrice: 28,
      currentStock: -5,
      unit: 'packet',
      category: 'Grocery',
      minStockAlert: 5,
    });
    assert.equal(negStockRes.success, false);
    assert.match(negStockRes.error || '', /cannot be negative/i);

    // 5. Reject duplicate name (case-insensitive)
    const duplicateRes = addProduct({
      name: 'basmati rice',
      sellingPrice: 130,
      currentStock: 20,
      unit: 'kg',
      category: 'Grains',
      minStockAlert: 5,
    });
    assert.equal(duplicateRes.success, false);
    assert.match(duplicateRes.error || '', /already in inventory/i);

    // 6. Update product: reject negative selling price and duplicate rename
    const prodId = res1.product!.id;
    const invalidUpdatePrice = updateProduct(prodId, { sellingPrice: -10 });
    assert.equal(invalidUpdatePrice.success, false);

    // Add a second product to test collision during edit
    addProduct({
      name: 'Wheat Flour',
      sellingPrice: 45,
      currentStock: 100,
      unit: 'kg',
      category: 'Flour',
      minStockAlert: 15,
    });

    const collisionUpdate = updateProduct(prodId, { name: 'Wheat Flour' });
    assert.equal(collisionUpdate.success, false);
    assert.match(collisionUpdate.error || '', /already in inventory/i);

    // Valid update
    const validUpdate = updateProduct(prodId, { sellingPrice: 125, currentStock: 60 });
    assert.equal(validUpdate.success, true);
    assert.equal(validUpdate.product?.sellingPrice, 125);
    assert.equal(validUpdate.product?.currentStock, 60);

    // Valid deletion
    const delRes = deleteProduct(prodId);
    assert.equal(delRes.success, true);
    assert.equal(getStoreData().products.some((p) => p.id === prodId), false);
  });

  // -------------------------------------------------------------
  // Scenario 2: Fractional Quantities and Clean Arithmetic
  // -------------------------------------------------------------
  it('Scenario 2: Handles fractional quantities (0.125 kg, 0.250 kg) without float precision artifacts', () => {
    const addRes = addProduct({
      name: 'Desi Ghee',
      sellingPrice: 600, // Rs 600 per kg
      currentStock: 10.0,
      unit: 'kg',
      category: 'Dairy',
      minStockAlert: 2,
    });
    assert.equal(addRes.success, true);
    const prodId = addRes.product!.id;

    // Sale of 0.125 kg (125 grams)
    const saleRes1 = recordSale({ operationId: crypto.randomUUID(),
      items: [
        {
          productId: prodId,
          productName: 'Desi Ghee',
          unit: 'kg',
          quantity: 0.125,
          unitPrice: 600,
          totalPrice: roundPrecision(0.125 * 600, 2), // 75.00
        },
      ],
      paymentMode: 'cash',
    });
    assert.equal(saleRes1.success, true);
    assert.equal(saleRes1.sale?.totalAmount, 75.0);

    const storeAfterSale1 = getStoreData();
    const updatedProd1 = storeAfterSale1.products.find((p) => p.id === prodId);
    // 10.0 - 0.125 = 9.875 exactly
    assert.equal(updatedProd1?.currentStock, 9.875);

    // Second sale of 0.250 kg (250 grams)
    const saleRes2 = recordSale({ operationId: crypto.randomUUID(),
      items: [
        {
          productId: prodId,
          productName: 'Desi Ghee',
          unit: 'kg',
          quantity: 0.25,
          unitPrice: 600,
          totalPrice: roundPrecision(0.25 * 600, 2), // 150.00
        },
      ],
      paymentMode: 'cash',
    });
    assert.equal(saleRes2.success, true);

    const storeAfterSale2 = getStoreData();
    const updatedProd2 = storeAfterSale2.products.find((p) => p.id === prodId);
    // 9.875 - 0.250 = 9.625 exactly
    assert.equal(updatedProd2?.currentStock, 9.625);
  });

  // -------------------------------------------------------------
  // Scenario 3: Multi-line Sales with Same Product Aggregation
  // -------------------------------------------------------------
  it('Scenario 3: Correctly aggregates multi-line sales containing duplicate product IDs', () => {
    const prodRes = addProduct({
      name: 'Parle-G Biscuit',
      sellingPrice: 10,
      currentStock: 10,
      unit: 'packet',
      category: 'Biscuits',
      minStockAlert: 2,
    });
    const prodId = prodRes.product!.id;

    // Bill with two line items for the same product: 3 packets + 4 packets = 7 packets total
    const saleRes = recordSale({ operationId: crypto.randomUUID(),
      items: [
        {
          productId: prodId,
          productName: 'Parle-G Biscuit',
          unit: 'packet',
          quantity: 3,
          unitPrice: 10,
          totalPrice: 30,
        },
        {
          productId: prodId,
          productName: 'Parle-G Biscuit',
          unit: 'packet',
          quantity: 4,
          unitPrice: 10,
          totalPrice: 40,
        },
      ],
      paymentMode: 'cash',
    });

    assert.equal(saleRes.success, true);
    assert.equal(saleRes.sale?.totalAmount, 70);

    const store = getStoreData();
    const prod = store.products.find((p) => p.id === prodId);
    // 10 - (3 + 4) = 3
    assert.equal(prod?.currentStock, 3);
  });

  // -------------------------------------------------------------
  // Scenario 4: Overselling Rejection
  // -------------------------------------------------------------
  it('Scenario 4: Rejects sales that exceed available stock and leaves inventory untouched', () => {
    const prodRes = addProduct({
      name: 'Amul Butter 500g',
      sellingPrice: 275,
      currentStock: 3,
      unit: 'piece',
      category: 'Dairy',
      minStockAlert: 1,
    });
    const prodId = prodRes.product!.id;

    // Attempt to buy 4 pieces when only 3 are in stock
    const failSale = recordSale({ operationId: crypto.randomUUID(),
      items: [
        {
          productId: prodId,
          productName: 'Amul Butter 500g',
          unit: 'piece',
          quantity: 4,
          unitPrice: 275,
          totalPrice: 1100,
        },
      ],
      paymentMode: 'cash',
    });

    assert.equal(failSale.success, false);
    assert.match(failSale.error || '', /insufficient stock/i);

    const store = getStoreData();
    const prod = store.products.find((p) => p.id === prodId);
    // Stock remains untouched at 3
    assert.equal(prod?.currentStock, 3);
    assert.equal(store.sales.length, 0);
  });

  // -------------------------------------------------------------
  // Scenario 5: Single Stock Deduction Atomicity
  // -------------------------------------------------------------
  it('Scenario 5: Confirmed sale deducts stock exactly once and logs stock movements accurately', () => {
    const prodRes = addProduct({
      name: 'Colgate Toothpaste 100g',
      sellingPrice: 65,
      currentStock: 20,
      unit: 'piece',
      category: 'Personal Care',
      minStockAlert: 5,
    });
    const prodId = prodRes.product!.id;

    const saleRes = recordSale({ operationId: crypto.randomUUID(),
      items: [
        {
          productId: prodId,
          productName: 'Colgate Toothpaste 100g',
          unit: 'piece',
          quantity: 5,
          unitPrice: 65,
          totalPrice: 325,
        },
      ],
      paymentMode: 'online',
    });

    assert.equal(saleRes.success, true);

    const store = getStoreData();
    const prod = store.products.find((p) => p.id === prodId);
    assert.equal(prod?.currentStock, 15);

    // Verify stock movement entry
    const movements = store.stockMovements.filter((m) => m.productId === prodId);
    // 1 opening stock movement + 1 sale movement = 2
    assert.equal(movements.length, 2);
    const saleMovement = movements.find((m) => m.type === 'sale');
    assert.ok(saleMovement);
    assert.equal(saleMovement.quantity, -5);
    assert.equal(saleMovement.previousStock, 20);
    assert.equal(saleMovement.newStock, 15);
  });

  // -------------------------------------------------------------
  // Scenario 6: Cash, UPI, and Udhaar Daily Accounting
  // -------------------------------------------------------------
  it('Scenario 6: Correctly segregates cash, UPI, udhaar sales, repayments, and cash-in-drawer', () => {
    const p1 = addProduct({ name: 'Item A', sellingPrice: 100, currentStock: 50, unit: 'piece', category: 'General', minStockAlert: 2 }).product!;
    const p2 = addProduct({ name: 'Item B', sellingPrice: 250, currentStock: 50, unit: 'piece', category: 'General', minStockAlert: 2 }).product!;
    const p3 = addProduct({ name: 'Item C', sellingPrice: 150, currentStock: 50, unit: 'piece', category: 'General', minStockAlert: 2 }).product!;

    const cust = addCustomer({ name: 'Sunil Kumar', phone: '9811122233' }).customer!;

    // Sale 1: Cash sale of ₹100
    recordSale({ operationId: crypto.randomUUID(),
      items: [{ productId: p1.id, productName: p1.name, unit: 'piece', quantity: 1, unitPrice: 100, totalPrice: 100 }],
      paymentMode: 'cash',
    });

    // Sale 2: Online / UPI sale of ₹250
    recordSale({ operationId: crypto.randomUUID(),
      items: [{ productId: p2.id, productName: p2.name, unit: 'piece', quantity: 1, unitPrice: 250, totalPrice: 250 }],
      paymentMode: 'online',
    });

    // Sale 3: Udhaar sale of ₹150
    recordSale({ operationId: crypto.randomUUID(),
      items: [{ productId: p3.id, productName: p3.name, unit: 'piece', quantity: 1, unitPrice: 150, totalPrice: 150 }],
      paymentMode: 'udhaar',
      customerId: cust.id,
    });

    // Customer repays ₹50 in cash against udhaar
    recordUdhaarTransaction({
      customerId: cust.id,
      type: 'payment_received',
      amount: 50,
      notes: 'Cash partial payment',
    });

    const store = getStoreData();
    const summary = calculateDailySales(store.sales, store.udhaarTransactions);

    assert.equal(summary.grossSales, 500, 'Gross sales should be 100 + 250 + 150 = 500');
    assert.equal(summary.completedSalesCount, 3, 'Completed sales count should be 3');
    assert.equal(summary.cashSales, 100, 'Direct cash sales should be 100');
    assert.equal(summary.onlineSales, 250, 'Online/UPI sales should be 250');
    assert.equal(summary.udhaarSales, 150, 'Udhaar sales should be 150');
    assert.equal(summary.udhaarCollected, 50, 'Cash collected from udhaar repayment should be 50');
    // Cash in drawer = cash sales (100) + udhaar repayment received (50) = 150
    assert.equal(summary.totalCashInHandToday, 150);
    assert.equal(summary.cashInDrawer, 150);
  });

  // -------------------------------------------------------------
  // Scenario 7: Udhaar Ledger and Partial Repayments
  // -------------------------------------------------------------
  it('Scenario 7: Manages udhaar credit, partial repayments, and ensures balance does not turn negative', () => {
    const custRes = addCustomer({
      name: 'Ramesh Verma',
      phone: '9988776655',
      initialBalance: 0,
    });
    assert.equal(custRes.success, true);
    const custId = custRes.customer!.id;

    // 1. Credit given: ₹500
    const tx1 = recordUdhaarTransaction({
      customerId: custId,
      type: 'credit_given',
      amount: 500,
      notes: 'Groceries credit',
    });
    assert.equal(tx1.success, true);
    let store = getStoreData();
    let cust = store.customers.find((c) => c.id === custId);
    assert.equal(cust?.currentBalance, 500);

    // 2. Partial repayment: ₹200
    const tx2 = recordUdhaarTransaction({
      customerId: custId,
      type: 'payment_received',
      amount: 200,
      notes: 'Part payment',
    });
    assert.equal(tx2.success, true);
    store = getStoreData();
    cust = store.customers.find((c) => c.id === custId);
    assert.equal(cust?.currentBalance, 300);

    // 3. Final settlement: ₹300
    const tx3 = recordUdhaarTransaction({
      customerId: custId,
      type: 'payment_received',
      amount: 300,
      notes: 'Full clearance',
    });
    assert.equal(tx3.success, true);
    store = getStoreData();
    cust = store.customers.find((c) => c.id === custId);
    assert.equal(cust?.currentBalance, 0);

    // 4. Excess payment attempt: should clamp balance to 0, never negative
    const tx4 = recordUdhaarTransaction({
      customerId: custId,
      type: 'payment_received',
      amount: 50,
      notes: 'Extra payment',
    });
    assert.equal(tx4.success, true);
    store = getStoreData();
    cust = store.customers.find((c) => c.id === custId);
    assert.equal(cust?.currentBalance, 0);
  });

  // -------------------------------------------------------------
  // Scenario 8: Shop Profile Isolation
  // -------------------------------------------------------------
  it('Scenario 8: Completely isolates inventory, sales, and customers across different shop profiles', () => {
    // Current profile: Shop A (default)
    const pA = addProduct({
      name: 'Shop A Special Item',
      sellingPrice: 199,
      currentStock: 25,
      unit: 'piece',
      category: 'General',
      minStockAlert: 2,
    }).product!;

    addCustomer({
      name: 'Customer of Shop A',
      phone: '9000000001',
    });

    recordSale({ operationId: crypto.randomUUID(),
      items: [{ productId: pA.id, productName: pA.name, unit: 'piece', quantity: 1, unitPrice: 199, totalPrice: 199 }],
      paymentMode: 'cash',
    });

    const storeA = getStoreData();
    assert.equal(storeA.products.length, 1);
    assert.equal(storeA.customers.length, 1);
    assert.equal(storeA.sales.length, 1);

    // Create & switch to Shop B
    const createB = createShopProfile({
      shopName: 'Apollo Medical Pharmacy',
      ownerName: 'Dr. Mehta',
      category: 'Medical / Pharmacy',
      businessType: 'pharmacy',
      isOnboarded: true,
    });
    assert.equal(createB.success, true);
    const shopBId = createB.profile!.id;

    // Verify Shop B is clean and has NO data from Shop A
    const storeB = getStoreData();
    assert.equal(storeB.profile.id, shopBId);
    assert.equal(storeB.products.length, 0, 'Shop B products must be isolated and empty');
    assert.equal(storeB.customers.length, 0, 'Shop B customers must be empty');
    assert.equal(storeB.sales.length, 0, 'Shop B sales must be empty');

    // Add unique product in Shop B
    addProduct({
      name: 'Paracetamol 650mg',
      sellingPrice: 30,
      currentStock: 100,
      unit: 'packet',
      category: 'Medicines',
      minStockAlert: 10,
    });

    // Switch back to Shop A
    switchProfile(storeA.profile.id);
    const storeARevisited = getStoreData();
    assert.equal(storeARevisited.products.length, 1);
    assert.equal(storeARevisited.products[0].name, 'Shop A Special Item');
    assert.equal(storeARevisited.customers.length, 1);
    assert.equal(storeARevisited.sales.length, 1);
    // Paracetamol must NOT exist in Shop A
    assert.equal(storeARevisited.products.some((p) => p.name === 'Paracetamol 650mg'), false);
  });

  // -------------------------------------------------------------
  // Scenario 9: Backup Export & Restore Preserving Business Attributes
  // -------------------------------------------------------------
  it('Scenario 9: Exports and restores complete shop backups while preserving business-specific fields', () => {
    // Add product with specialized business-type attributes (Garments / Pharmacy)
    const prodRes = addProduct({
      name: 'Denim Jeans Regular Fit',
      sellingPrice: 999,
      purchasePrice: 650,
      currentStock: 12,
      unit: 'piece',
      category: 'Clothing',
      minStockAlert: 3,
      size: '32',
      color: 'Dark Indigo',
      batchNumber: 'BATCH-2026-X',
      expiryDate: '2030-01-01',
    });
    assert.equal(prodRes.success, true);

    const custRes = addCustomer({
      name: 'Vikas Sharma',
      phone: '9876501234',
      initialBalance: 450,
    });
    assert.equal(custRes.success, true);

    const currentStore = getStoreData();
    const backup = createShopBackup(currentStore);

    assert.equal(backup.app, 'Dukaan Sathi AI');
    assert.equal(backup.schemaVersion, '1.0');
    assert.equal(backup.data.products.length, 1);
    assert.equal(backup.data.products[0].size, '32');
    assert.equal(backup.data.products[0].color, 'Dark Indigo');
    assert.equal(backup.data.products[0].batchNumber, 'BATCH-2026-X');
    assert.equal(backup.data.customers[0].currentBalance, 450);

    // Clear local state
    mockLocalStorage.clear();
    __resetStorageForTesting();

    // Verify empty state before restore
    assert.equal(getStoreData().products.length, 0);

    // Restore backup
    const restoreRes = restoreBackupToStore(backup);
    assert.equal(restoreRes.success, true);

    // Verify all restored data and business attributes
    const restoredStore = getStoreData();
    assert.equal(restoredStore.products.length, 1);
    const restoredProd = restoredStore.products[0];
    assert.equal(restoredProd.name, 'Denim Jeans Regular Fit');
    assert.equal(restoredProd.size, '32');
    assert.equal(restoredProd.color, 'Dark Indigo');
    assert.equal(restoredProd.batchNumber, 'BATCH-2026-X');
    assert.equal(restoredProd.currentStock, 12);

    assert.equal(restoredStore.customers.length, 1);
    assert.equal(restoredStore.customers[0].name, 'Vikas Sharma');
    assert.equal(restoredStore.customers[0].currentBalance, 450);
  });

  // -------------------------------------------------------------
  // Scenario 10: Rejecting Malformed / Corrupted Backups
  // -------------------------------------------------------------
  it('Scenario 10: Rejects malformed or corrupted backup payloads without modifying existing data', () => {
    // Setup existing shop data
    addProduct({
      name: 'Existing Safe Item',
      sellingPrice: 50,
      currentStock: 10,
      unit: 'piece',
      category: 'General',
      minStockAlert: 2,
    });
    const beforeCount = getStoreData().products.length;
    assert.equal(beforeCount, 1);

    // 1. Invalid JSON / null
    const resNull = validateShopBackup(null);
    assert.equal(resNull.isValid, false);

    // 2. Wrong application identifier
    const resWrongApp = validateShopBackup({
      app: 'Another App',
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      shopProfile: { shopName: 'Shop' },
      data: { products: [] },
    });
    assert.equal(resWrongApp.isValid, false);
    assert.match(resWrongApp.error || '', /Not a recognized Dukaan Sathi AI backup/i);

    // 3. Unsupported schema version
    const resVersion = validateShopBackup({
      app: 'Dukaan Sathi AI',
      schemaVersion: '99.0',
      exportedAt: new Date().toISOString(),
      shopProfile: { shopName: 'Shop' },
      data: { products: [] },
    });
    assert.equal(resVersion.isValid, false);
    assert.match(resVersion.error || '', /unsupported schema version/i);

    // 4. Negative product price in backup
    const resNegPrice = validateShopBackup({
      app: 'Dukaan Sathi AI',
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      shopProfile: { shopName: 'Shop' },
      data: {
        products: [
          {
            id: 'p-1',
            name: 'Bad Item',
            unit: 'piece',
            sellingPrice: -100,
            currentStock: 5,
          },
        ],
        customers: [],
        sales: [],
        udhaarTransactions: [],
      },
    });
    assert.equal(resNegPrice.isValid, false);
    assert.match(resNegPrice.error || '', /invalid negative or non-numeric selling price/i);

    // 5. Duplicate product IDs in backup
    const resDuplicateIds = validateShopBackup({
      app: 'Dukaan Sathi AI',
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      shopProfile: { shopName: 'Shop' },
      data: {
        products: [
          { id: 'dup-1', name: 'Item 1', unit: 'piece', sellingPrice: 10, currentStock: 5 },
          { id: 'dup-1', name: 'Item 2', unit: 'piece', sellingPrice: 20, currentStock: 8 },
        ],
        customers: [],
        sales: [],
        udhaarTransactions: [],
      },
    });
    assert.equal(resDuplicateIds.isValid, false);
    assert.match(resDuplicateIds.error || '', /duplicate product id/i);

    // Attempting to restore any invalid backup must fail and NEVER alter existing store data
    const failRestore = restoreBackupToStore({ bad: 'data' } as unknown as Parameters<typeof restoreBackupToStore>[0]);
    assert.equal(failRestore.success, false);

    // Verify existing data remains completely intact
    const afterStore = getStoreData();
    assert.equal(afterStore.products.length, 1);
    assert.equal(afterStore.products[0].name, 'Existing Safe Item');
  });

  // -------------------------------------------------------------
  // Scenario 11 (P1): Storage failure must never report false success
  // -------------------------------------------------------------
  it('Scenario 11: Storage write failures return failure and never report false success', () => {
    // Seed initial product and customer while storage is working
    const seedProd = addProduct({
      name: 'Storage Test Item',
      unit: 'piece',
      category: 'General',
      minStockAlert: 5,
      sellingPrice: 100,
      currentStock: 10,
    });
    assert.equal(seedProd.success, true);
    assert.ok(seedProd.product);

    const seedCust = addCustomer({
      name: 'Storage Test Cust',
      phone: '9999999999',
      initialBalance: 50,
    });
    assert.equal(seedCust.success, true);
    assert.ok(seedCust.customer);

    // Simulate quota exceeded / storage failure on setItem
    const originalSetItem = mockLocalStorage.setItem.bind(mockLocalStorage);
    mockLocalStorage.setItem = () => {
      const err = new Error('QuotaExceededError: DOMException');
      err.name = 'QuotaExceededError';
      throw err;
    };

    try {
      // 1. addProduct under storage failure
      const addRes = addProduct({
        name: 'Failed Add Item',
        unit: 'piece',
        category: 'General',
        minStockAlert: 5,
        sellingPrice: 50,
        currentStock: 5,
      });
      assert.equal(addRes.success, false);
      assert.equal(addRes.error, STORAGE_FAILURE_ERROR_MESSAGE);

      // 2. updateProduct under storage failure
      const updateRes = updateProduct(seedProd.product!.id, {
        sellingPrice: 120,
      });
      assert.equal(updateRes.success, false);
      assert.equal(updateRes.error, STORAGE_FAILURE_ERROR_MESSAGE);

      // 3. quickAddStock under storage failure
      const stockRes = quickAddStock(seedProd.product!.id, 5);
      assert.equal(stockRes.success, false);
      assert.equal(stockRes.error, STORAGE_FAILURE_ERROR_MESSAGE);

      // 4. saveProductsBatch under storage failure
      const batchRes = saveProductsBatch([
        { name: 'Batch Prod', unit: 'piece', sellingPrice: 20 },
      ]);
      assert.equal(batchRes.success, false);
      assert.equal(batchRes.error, STORAGE_FAILURE_ERROR_MESSAGE);

      // 5. recordSale under storage failure
      const saleRes = recordSale({ operationId: crypto.randomUUID(),
        items: [
          {
            productId: seedProd.product!.id,
            productName: seedProd.product!.name,
            unit: seedProd.product!.unit,
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          },
        ],
        paymentMode: 'cash',
      });
      assert.equal(saleRes.success, false);
      assert.equal(saleRes.error, STORAGE_FAILURE_ERROR_MESSAGE);

      // 6. addCustomer under storage failure
      const custRes = addCustomer({
        name: 'Failed Customer',
        phone: '8888888888',
      });
      assert.equal(custRes.success, false);
      assert.equal(custRes.error, STORAGE_FAILURE_ERROR_MESSAGE);

      // 7. recordUdhaarTransaction under storage failure
      const udhaarRes = recordUdhaarTransaction({
        customerId: seedCust.customer!.id,
        type: 'credit_given',
        amount: 20,
      });
      assert.equal(udhaarRes.success, false);
      assert.equal(udhaarRes.error, STORAGE_FAILURE_ERROR_MESSAGE);

      // 8. updateShopProfile under storage failure
      const profileRes = updateShopProfile({
        shopName: 'New Failed Shop Name',
      });
      assert.equal(profileRes.success, false);
      assert.equal(profileRes.error, STORAGE_FAILURE_ERROR_MESSAGE);

      // 9. deleteProduct under storage failure
      const delRes = deleteProduct(seedProd.product!.id);
      assert.equal(delRes.success, false);
      assert.equal(delRes.error, STORAGE_FAILURE_ERROR_MESSAGE);
    } finally {
      // Restore normal storage
      mockLocalStorage.setItem = originalSetItem;
    }
  });

  // -------------------------------------------------------------
  // Scenario 12 (P2): Customer advance balance, overpayment, and credit offset
  // -------------------------------------------------------------
  it('Scenario 12: Handles customer overpayment, advance balance tracking, and credit offsets accurately', () => {
    // 1. Add customer with ₹300 initial debt
    const custRes = addCustomer({
      name: 'Ramesh Advance Test',
      phone: '9876543210',
      initialBalance: 300,
    });
    assert.equal(custRes.success, true);
    const customerId = custRes.customer!.id;

    // Verify initial balance
    let store = getStoreData();
    let cust = store.customers.find((c) => c.id === customerId);
    assert.ok(cust);
    assert.equal(cust.currentBalance, 300);
    assert.equal(cust.advanceBalance ?? 0, 0);

    // 2. Customer pays ₹500 (overpayment: owes 300, gives 500)
    const payRes = recordUdhaarTransaction({
      customerId,
      type: 'payment_received',
      amount: 500,
      notes: 'Customer paid 500 cash',
    });
    assert.equal(payRes.success, true);

    store = getStoreData();
    cust = store.customers.find((c) => c.id === customerId);
    assert.ok(cust);
    assert.equal(cust.currentBalance, 0); // Debt cleared
    assert.equal(cust.advanceBalance, 200); // 200 excess stored safely as advance!

    // 3. Customer deposits another ₹100 as pure advance
    const depRes = recordUdhaarTransaction({
      customerId,
      type: 'payment_received',
      amount: 100,
      notes: 'Additional advance deposit',
    });
    assert.equal(depRes.success, true);

    store = getStoreData();
    cust = store.customers.find((c) => c.id === customerId);
    assert.equal(cust!.currentBalance, 0);
    assert.equal(cust!.advanceBalance, 300); // 200 + 100 = 300

    // Seed a product for POS sale
    const prodRes = addProduct({
      name: 'Basmati Rice',
      unit: 'kg',
      category: 'Grains',
      minStockAlert: 10,
      sellingPrice: 60,
      currentStock: 50,
    });
    assert.equal(prodRes.success, true);

    // 4. Customer makes udhaar sale of ₹120 (less than advance ₹300)
    // Advance should drop to ₹180, debt stays ₹0!
    const sale1 = recordSale({ operationId: crypto.randomUUID(),
      items: [
        {
          productId: prodRes.product!.id,
          productName: prodRes.product!.name,
          unit: prodRes.product!.unit,
          quantity: 2,
          unitPrice: 60,
          totalPrice: 120,
        },
      ],
      paymentMode: 'udhaar',
      customerId,
    });
    assert.equal(sale1.success, true);

    store = getStoreData();
    cust = store.customers.find((c) => c.id === customerId);
    assert.equal(cust!.currentBalance, 0); // Still 0 debt!
    assert.equal(cust!.advanceBalance, 180); // 300 - 120 = 180 remaining advance

    // 5. Customer makes another udhaar sale of ₹250 (exceeds advance ₹180)
    // Advance ₹180 is exhausted to ₹0, remaining ₹70 becomes debt!
    const sale2 = recordSale({ operationId: crypto.randomUUID(),
      items: [
        {
          productId: prodRes.product!.id,
          productName: prodRes.product!.name,
          unit: prodRes.product!.unit,
          quantity: 4.167,
          unitPrice: 60,
          totalPrice: 250.02,
        },
      ],
      paymentMode: 'udhaar',
      customerId,
    });
    assert.equal(sale2.success, true);

    store = getStoreData();
    cust = store.customers.find((c) => c.id === customerId);
    assert.equal(cust!.advanceBalance, 0); // Advance fully consumed
    assert.equal(cust!.currentBalance, 70.02); // 250 - 180 = 70 new debt!

    // 6. Test backup & restore preservation of advance balance
    // Give customer ₹100 payment so they have ₹30 advance
    recordUdhaarTransaction({
      customerId,
      type: 'payment_received',
      amount: 100,
    });
    store = getStoreData();
    cust = store.customers.find((c) => c.id === customerId);
    assert.equal(cust!.currentBalance, 0);
    assert.equal(cust!.advanceBalance, 29.98);

    const backup = createShopBackup(store);
    assert.ok(backup);
    const backupCust = backup.data.customers.find((c) => c.id === customerId);
    assert.ok(backupCust);
    assert.equal(backupCust.advanceBalance, 29.98);

    // Validate backup passes
    const val = validateShopBackup(backup);
    assert.equal(val.isValid, true, val.error);

    // Verify negative advance in corrupted backup is rejected
    const corruptBackup = JSON.parse(JSON.stringify(backup));
    corruptBackup.data.customers[0].advanceBalance = -50;
    const corruptVal = validateShopBackup(corruptBackup);
    assert.equal(corruptVal.isValid, false);
    assert.match(corruptVal.error || '', /invalid advance balance/i);
  });

  // -------------------------------------------------------------
  // Scenario 13 (P4): AI Hinglish inventory command returns preview and does NOT auto-save without confirmation
  // -------------------------------------------------------------
  it('Scenario 13: Voice/text command parse returns preview only and never mutates inventory before explicit confirmation', () => {
    // Start with empty products
    const initialStore = getStoreData();
    const initialProductCount = initialStore.products.length;

    // Run natural voice inventory command
    const voiceText = 'Meri dukaan mein Aata 25 kilo opening stock aur 40 rupaye selling price save kar lo';
    const parseResult = parseHinglishCommand(
      voiceText,
      initialStore.products,
      initialStore.customers,
      calculateDailySales(initialStore.sales)
    );

    // Verify intent and parsed item
    assert.equal(parseResult.intent, 'inventory_add');
    assert.ok(parseResult.parsedProducts);
    assert.equal(parseResult.parsedProducts.length, 1);
    assert.equal(
      parseResult.parsedProducts[0].name.includes('आटा') ||
        parseResult.parsedProducts[0].name.toLowerCase().includes('atta'),
      true
    );
    assert.equal(parseResult.parsedProducts[0].openingStock, 25);
    assert.equal(parseResult.parsedProducts[0].sellingPrice, 40);

    // Critical check: Storage MUST NOT have changed during parsing!
    const storeAfterParse = getStoreData();
    assert.equal(
      storeAfterParse.products.length,
      initialProductCount,
      'Inventory must NOT be modified by parser before confirmation!'
    );

    // Now simulate explicit user confirmation
    const confirmResult = saveProductsBatch(parseResult.parsedProducts);
    assert.equal(confirmResult.success, true);
    assert.equal(confirmResult.addedCount, 1);

    // Now storage MUST reflect the product
    const storeAfterConfirm = getStoreData();
    assert.equal(storeAfterConfirm.products.length, initialProductCount + 1);
    const added = storeAfterConfirm.products.find(
      (p) => p.name.includes('आटा') || p.name.toLowerCase().includes('atta')
    );
    assert.ok(added);
    assert.equal(added.currentStock, 25);
    assert.equal(added.sellingPrice, 40);
  });

  // -------------------------------------------------------------
  // Scenario 14: Conversational AI onboarding: preview, required follow-ups, answer persistence
  // -------------------------------------------------------------
  it('Scenario 14: Conversational AI onboarding generates preview only and persists answers across multi-turn steps', () => {
    const initialProducts = getStoreData().products;
    assert.equal(isProductOnboardingTrigger('Naya product add karo'), true);

    // Turn 1: User starts conversation without name
    const turn1 = startProductConversation('Naya product add karo', initialProducts);
    assert.equal(turn1.state.step, 'ask_name');
    assert.equal(getStoreData().products.length, 0, 'No products added on turn 1');

    // Turn 2: User provides product name
    const turn2 = processProductConversationTurn(turn1.state, 'Basmati Rice', initialProducts);
    assert.equal(turn2.nextState.step, 'ask_price');
    assert.equal(turn2.nextState.draft.name, 'Basmati Rice');
    assert.equal(getStoreData().products.length, 0, 'No products added on turn 2');

    // Turn 3: User provides selling price
    const turn3 = processProductConversationTurn(turn2.nextState, '85 rupaye', initialProducts);
    assert.equal(turn3.nextState.step, 'ask_stock');
    assert.equal(turn3.nextState.draft.sellingPrice, 85);

    // Turn 4: User provides stock and unit
    const turn4 = processProductConversationTurn(turn3.nextState, '25 kg', initialProducts);
    assert.equal(turn4.nextState.draft.openingStock, 25);
    assert.equal(turn4.nextState.draft.unit, 'kg');

    // Turn 5: User skips purchase price
    const turn5 = processProductConversationTurn(turn4.nextState, 'Skip', initialProducts);
    assert.equal(turn5.nextState.step, 'ask_barcode_sku');

    // Turn 6: User selects Auto Generate SKU
    const turn6 = processProductConversationTurn(turn5.nextState, 'Auto Generate SKU', initialProducts);
    assert.equal(turn6.nextState.step, 'ready_for_confirmation');
    assert.ok(turn6.nextState.draft.sku);

    // Verify storage has STILL not been mutated before explicit confirmation!
    assert.equal(getStoreData().products.length, 0, 'No write before explicit confirmation');

    // Convert draft to products
    const items = convertDraftToProducts(turn6.nextState.draft);
    assert.equal(items.length, 1);
    assert.equal(items[0].name, 'Basmati Rice');
    assert.equal(items[0].sellingPrice, 85);
    assert.equal(items[0].openingStock, 25);
    assert.equal(items[0].unit, 'kg');

    // Confirm and Save
    const saveRes = saveProductsBatch(items);
    assert.equal(saveRes.success, true);
    assert.equal(getStoreData().products.length, 1);
  });

  // -------------------------------------------------------------
  // Scenario 15: Clothing variants create separate stock items and track stock per variant
  // -------------------------------------------------------------
  it('Scenario 15: Clothing variants create separate stock items and track stock per variant', () => {
    const turn1 = startProductConversation('Ek T-shirt inventory mein add karo', []);
    assert.equal(turn1.state.step, 'ask_variants');

    // User provides sizes and colors
    const turn2 = processProductConversationTurn(turn1.state, 'Size M, L, XL color Black', []);
    assert.equal(turn2.nextState.step, 'ask_price');

    // Price
    const turn3 = processProductConversationTurn(turn2.nextState, 'Price 350', []);
    // Stock per variant
    const turn4 = processProductConversationTurn(turn3.nextState, '10 piece each', []);

    // Convert draft
    const variantItems = convertDraftToProducts(turn4.nextState.draft);
    assert.equal(variantItems.length, 3);
    assert.equal(variantItems[0].size, 'M');
    assert.equal(variantItems[1].size, 'L');
    assert.equal(variantItems[2].size, 'XL');
    assert.equal(variantItems[0].openingStock, 10);
    assert.equal(variantItems[1].openingStock, 10);
    assert.equal(variantItems[2].openingStock, 10);

    // Save variants to inventory
    const saveRes = saveProductsBatch(variantItems);
    assert.equal(saveRes.success, true);
    assert.equal(saveRes.addedCount, 3);

    const store = getStoreData();
    const sizeM = store.products.find((p) => p.size === 'M')!;
    const sizeL = store.products.find((p) => p.size === 'L')!;
    const sizeXL = store.products.find((p) => p.size === 'XL')!;
    assert.ok(sizeM);
    assert.ok(sizeL);
    assert.ok(sizeXL);

    // Record sale of 2 units of Size M
    const saleRes = recordSale({ operationId: crypto.randomUUID(),
      items: [
        {
          productId: sizeM.id,
          productName: sizeM.name,
          unit: sizeM.unit,
          quantity: 2,
          unitPrice: sizeM.sellingPrice!,
          totalPrice: sizeM.sellingPrice! * 2,
        },
      ],
      paymentMode: 'cash',
    });
    assert.equal(saleRes.success, true);

    // Check variant stock isolation: only Size M was deducted!
    const updatedStore = getStoreData();
    assert.equal(updatedStore.products.find((p) => p.id === sizeM.id)!.currentStock, 8);
    assert.equal(updatedStore.products.find((p) => p.id === sizeL.id)!.currentStock, 10);
    assert.equal(updatedStore.products.find((p) => p.id === sizeXL.id)!.currentStock, 10);
  });

  // -------------------------------------------------------------
  // Scenario 16: Invalid price and quantity rejection in conversation
  // -------------------------------------------------------------
  it('Scenario 16: Rejects negative or zero prices and negative quantities in conversational flow', () => {
    const turn1 = startProductConversation('Naya product add karo', []);
    const turn2 = processProductConversationTurn(turn1.state, 'Fortune Oil', []);
    assert.equal(turn2.nextState.step, 'ask_price');

    // Attempt zero price
    const turnPriceZero = processProductConversationTurn(turn2.nextState, '0', []);
    assert.equal(turnPriceZero.nextState.step, 'ask_price', 'Must remain in ask_price');
    assert.match(turnPriceZero.aiReply, /मूल्य 0 से अधिक/i);

    // Valid price
    const turnPriceValid = processProductConversationTurn(turn2.nextState, '180', []);
    assert.equal(turnPriceValid.nextState.step, 'ask_stock');

    // Attempt negative stock
    const turnStockNegative = processProductConversationTurn(turnPriceValid.nextState, '-15', []);
    assert.equal(turnStockNegative.nextState.step, 'ask_stock', 'Must remain in ask_stock');
    assert.match(turnStockNegative.aiReply, /सही स्टॉक मात्रा/i);
  });

  // -------------------------------------------------------------
  // Scenario 17: Duplicate confirmation prevention
  // -------------------------------------------------------------
  it('Scenario 17: Prevents duplicate product creation when confirmation is triggered repeatedly', () => {
    const items = [
      {
        name: 'Tata Salt 1kg',
        unit: 'packet' as const,
        openingStock: 50,
        sellingPrice: 28,
        minStockAlert: 5,
      },
    ];

    // First save
    const firstSave = saveProductsBatch(items);
    assert.equal(firstSave.success, true);
    assert.equal(firstSave.addedCount, 1);
    assert.equal(getStoreData().products.length, 1);

    // Repeated second save of the same item updates rather than duplicating
    const secondSave = saveProductsBatch(items);
    assert.equal(secondSave.success, true);
    assert.equal(secondSave.addedCount, 0);
    assert.equal(secondSave.updatedCount, 1);
    assert.equal(getStoreData().products.length, 1, 'Product must not be duplicated!');
  });

  // -------------------------------------------------------------
  // Scenario 18: Storage failure during onboarding save returns failure and leaves state clean
  // -------------------------------------------------------------
  it('Scenario 18: Simulated storage failure during onboarding save returns error and leaves inventory clean', () => {
    const origSetItem = mockLocalStorage.setItem;
    mockLocalStorage.setItem = () => {
      const err = new Error('QuotaExceededError: DOMException');
      err.name = 'QuotaExceededError';
      throw err;
    };

    try {
      const items = [
        {
          name: 'Colgate Toothpaste 100g',
          unit: 'piece' as const,
          openingStock: 20,
          sellingPrice: 55,
        },
      ];
      const res = saveProductsBatch(items);
      assert.equal(res.success, false);
      assert.equal(res.error, STORAGE_FAILURE_ERROR_MESSAGE);
    } finally {
      mockLocalStorage.setItem = origSetItem;
    }

    assert.equal(getStoreData().products.length, 0);
  });

  // -------------------------------------------------------------
  // Scenario 19: Barcode lookup & unknown barcode handling
  // -------------------------------------------------------------
  it('Scenario 19: Barcode lookup finds exact product; unknown barcode returns undefined safely', () => {
    const addRes = addProduct({
      name: 'Maggi Noodles 2-Minute 70g',
      category: 'Instant Food',
      unit: 'packet',
      currentStock: 40,
      sellingPrice: 14,
      minStockAlert: 5,
      barcode: '8901058852377',
      sku: 'MAGGI-70G-1001',
    });
    assert.equal(addRes.success, true);

    // Exact barcode lookup
    const foundByBarcode = findProductByBarcodeOrSku('8901058852377');
    assert.ok(foundByBarcode);
    assert.equal(foundByBarcode.name, 'Maggi Noodles 2-Minute 70g');
    assert.equal(foundByBarcode.sellingPrice, 14);

    // Exact SKU lookup
    const foundBySku = findProductByBarcodeOrSku('MAGGI-70G-1001');
    assert.ok(foundBySku);
    assert.equal(foundBySku.id, addRes.product!.id);

    // Auto-generated internal SKU
    const genSku = generateInternalSku('Maggi', '70g');
    assert.ok(genSku.startsWith('MAGG-70G-'));

    // Unknown barcode lookup returns undefined without throwing
    const unknown = findProductByBarcodeOrSku('0000000000000');
    assert.equal(unknown, undefined);
  });

  // -------------------------------------------------------------
  // Scenario 20: Cart calculations (subtotal, flat/percentage discount, change due)
  // -------------------------------------------------------------
  it('Scenario 20: Cart calculations handle subtotal, flat and percentage discounts, and cash change accurately', () => {
    const p1 = addProduct({
      name: 'Item A',
      category: 'General',
      unit: 'piece',
      currentStock: 10,
      sellingPrice: 300,
      minStockAlert: 1,
    }).product!;

    const p2 = addProduct({
      name: 'Item B',
      category: 'General',
      unit: 'piece',
      currentStock: 10,
      sellingPrice: 200,
      minStockAlert: 1,
    }).product!;

    // Sale with subtotal ₹500 and flat ₹50 discount -> total ₹450
    const sale1 = recordSale({ operationId: crypto.randomUUID(),
      items: [
        { productId: p1.id, productName: p1.name, unit: p1.unit, quantity: 1, unitPrice: 300, totalPrice: 300 },
        { productId: p2.id, productName: p2.name, unit: p2.unit, quantity: 1, unitPrice: 200, totalPrice: 200 },
      ],
      paymentMode: 'cash',
      subtotal: 500,
      discountAmount: 50,
      discountType: 'flat',
      discountValue: 50,
      cashReceived: 500,
      changeDue: 50,
    });

    assert.equal(sale1.success, true);
    assert.equal(sale1.sale!.subtotal, 500);
    assert.equal(sale1.sale!.discountAmount, 50);
    assert.equal(sale1.sale!.totalAmount, 450);
    assert.equal(sale1.sale!.cashReceived, 500);
    assert.equal(sale1.sale!.changeDue, 50);
  });

  // -------------------------------------------------------------
  // Scenario 21: Single stock deduction and oversell prevention
  // -------------------------------------------------------------
  it('Scenario 21: Confirmed sale deducts stock exactly once; oversell is prevented', () => {
    const prod = addProduct({
      name: 'Parle-G Biscuit 100g',
      category: 'Packaged Food',
      unit: 'packet',
      currentStock: 5,
      sellingPrice: 10,
      minStockAlert: 2,
    }).product!;

    // Attempt to sell 6 packets when only 5 exist
    const oversell = recordSale({ operationId: crypto.randomUUID(),
      items: [
        { productId: prod.id, productName: prod.name, unit: prod.unit, quantity: 6, unitPrice: 10, totalPrice: 60 },
      ],
      paymentMode: 'cash',
    });
    assert.equal(oversell.success, false);
    assert.match(oversell.error || '', /insufficient stock/i);
    assert.equal(getStoreData().products.find((p) => p.id === prod.id)!.currentStock, 5);

    // Legitimate sale of 2 packets
    const validSale = recordSale({ operationId: crypto.randomUUID(),
      items: [
        { productId: prod.id, productName: prod.name, unit: prod.unit, quantity: 2, unitPrice: 10, totalPrice: 20 },
      ],
      paymentMode: 'cash',
    });
    assert.equal(validSale.success, true);
    assert.equal(getStoreData().products.find((p) => p.id === prod.id)!.currentStock, 3);
  });

  // -------------------------------------------------------------
  // Scenario 22: Failed sale rollback on storage failure
  // -------------------------------------------------------------
  it('Scenario 22: Simulated storage failure during sale recording rolls back cart and leaves inventory unchanged', () => {
    const prod = addProduct({
      name: 'Dettol Soap 75g',
      category: 'Personal Care',
      unit: 'piece',
      currentStock: 15,
      sellingPrice: 40,
      minStockAlert: 3,
    }).product!;

    const origSetItem = mockLocalStorage.setItem;
    mockLocalStorage.setItem = () => {
      const err = new Error('QuotaExceededError: DOMException');
      err.name = 'QuotaExceededError';
      throw err;
    };

    try {
      const saleRes = recordSale({ operationId: crypto.randomUUID(),
        items: [
          { productId: prod.id, productName: prod.name, unit: prod.unit, quantity: 3, unitPrice: 40, totalPrice: 120 },
        ],
        paymentMode: 'cash',
      });
      assert.equal(saleRes.success, false);
      assert.equal(saleRes.error, STORAGE_FAILURE_ERROR_MESSAGE);
    } finally {
      mockLocalStorage.setItem = origSetItem;
    }

    // Stock MUST remain unchanged (15)
    assert.equal(getStoreData().products.find((p) => p.id === prod.id)!.currentStock, 15);
  });

  // -------------------------------------------------------------
  // Scenario 23: UPI pending verification & payment status update
  // -------------------------------------------------------------
  it('Scenario 23: UPI remains pending and local edits cannot fabricate provider verification', () => {
    const prod = addProduct({
      name: 'Notebook 120 Pages',
      category: 'Stationery',
      unit: 'piece',
      currentStock: 30,
      sellingPrice: 45,
      minStockAlert: 5,
    }).product!;

    const txnRef = 'DS-TR-UPI-TEST-001';
    const saleRes = recordSale({ operationId: crypto.randomUUID(),
      items: [
        { productId: prod.id, productName: prod.name, unit: prod.unit, quantity: 2, unitPrice: 45, totalPrice: 90 },
      ],
      paymentMode: 'online',
      upiId: 'merchant@upi',
      transactionRef: txnRef,
      paymentVerificationStatus: 'pending_verification',
    });

    assert.equal(saleRes.success, true);
    assert.equal(saleRes.sale!.paymentVerificationStatus, 'pending_verification');

    // Verification update
    const updateRes = updateSalePaymentStatus(txnRef, 'paid');
    assert.equal(updateRes.success, false);
    assert.match(updateRes.error!, /not configured/);
    assert.equal(getStoreData().sales[0].paymentVerificationStatus, 'pending_verification');
  });

  // -------------------------------------------------------------
  // Scenario 24: Webhook idempotency prevents duplicate processing
  // -------------------------------------------------------------
  it('Scenario 24: Unconfigured webhook refuses original and replayed events', async () => {
    const payload = JSON.stringify({
      eventId: 'evt-test-unique-101',
      transactionRef: 'DS-TR-WEBHOOK-999',
      status: 'SUCCESS',
      amount: 450,
      invoiceNo: 'DS-1005',
    });

    // First webhook call
    new Request('http://localhost/api/payment/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    const res1 = await paymentWebhookPost();
    const data1 = await res1.json();
    assert.equal(res1.status, 503);
    assert.equal(data1.success, false);
    assert.equal(data1.error, 'PAYMENT_INTEGRATION_DISABLED');
    assert.equal(data1.processed, undefined);

    // Duplicate webhook call with identical eventId / transactionRef
    new Request('http://localhost/api/payment/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    const res2 = await paymentWebhookPost();
    const data2 = await res2.json();
    assert.equal(res2.status, 503);
    assert.equal(data2.success, false);
    assert.equal(data2.error, 'PAYMENT_INTEGRATION_DISABLED');
    assert.equal(data2.processed, undefined);
  });

  // -------------------------------------------------------------
  // Scenario 25: Backup and restore of new fields (barcodes, SKUs, variants, payment statuses)
  // -------------------------------------------------------------
  it('Scenario 25: Exports and restores complete shop backup preserving barcodes, SKUs, and payment statuses', () => {
    addProduct({
      name: 'Cotton Shirt Blue',
      category: 'Clothing / Garments',
      unit: 'piece',
      currentStock: 12,
      sellingPrice: 499,
      minStockAlert: 2,
      barcode: '8901234567890',
      sku: 'SHIRT-BLU-499',
      size: 'L',
      color: 'Blue',
    });

    const store = getStoreData();
    const backup = createShopBackup(store);
    assert.ok(backup);
    assert.equal(backup.data.products[0].barcode, '8901234567890');
    assert.equal(backup.data.products[0].sku, 'SHIRT-BLU-499');
    assert.equal(backup.data.products[0].size, 'L');
    assert.equal(backup.data.products[0].color, 'Blue');

    // Validate backup passes
    const val = validateShopBackup(backup);
    assert.equal(val.isValid, true);

    // Clear and restore
    __resetStorageForTesting();
    mockLocalStorage.clear();
    assert.equal(getStoreData().products.length, 0);

    const restoreRes = restoreBackupToStore(backup);
    assert.equal(restoreRes.success, true);

    const restoredStore = getStoreData();
    const prod = restoredStore.products[0];
    assert.ok(prod);
    assert.equal(prod.barcode, '8901234567890');
    assert.equal(prod.sku, 'SHIRT-BLU-499');
    assert.equal(prod.size, 'L');
    assert.equal(prod.color, 'Blue');
  });
});

describe('Critical accounting boundaries', () => {
  beforeEach(() => { mockLocalStorage.clear(); __resetStorageForTesting(); getStoreData(); });
  const bill = () => {
    const p = addProduct({ name: 'Rice', category: 'Grain', unit: 'kg', currentStock: 10, sellingPrice: 50, minStockAlert: 1 }).product!;
    return { operationId: crypto.randomUUID(), items: [{ productId: p.id, productName: p.name, quantity: 1, unit: 'kg', unitPrice: 50, totalPrice: 50 }], paymentMode: 'cash' as const };
  };
  it('rejects forged totals, prices, units and non-finite money without stock changes', () => {
    const b = bill();
    for (const patch of [{ totalPrice: 1 }, { totalPrice: NaN }, { totalPrice: Infinity }, { unitPrice: 1, totalPrice: 1 }, { unit: 'ml' }]) {
      assert.equal(recordSale({ ...b, items: [{ ...b.items[0], ...patch }] }).success, false);
    }
    assert.equal(recordSale({ ...b, subtotal: 1 }).success, false);
    assert.equal(recordSale({ ...b, discountAmount: Infinity }).success, false);
    assert.equal(getStoreData().products[0].currentStock, 10);
  });
  it('rejects malformed nested backup items', () => {
    recordSale(bill());
    const backup = createShopBackup(getStoreData());
    backup.data.sales[0].items[0].quantity = -1;
    assert.equal(validateShopBackup(backup).isValid, false);
  });
  it('preserves corrupted saved bytes on initialization', () => {
    const key = 'dukaan_store_data_profile-main_v2';
    mockLocalStorage.setItem(key, '{broken');
    __resetStorageForTesting(); getStoreData();
    assert.equal(mockLocalStorage.getItem(key), '{broken');
  });
  it('returns failure when creating a profile cannot persist', () => {
    const original = mockLocalStorage.setItem;
    mockLocalStorage.setItem = () => { throw new Error('disk full'); };
    try { assert.equal(createShopProfile({ shopName: 'Other', ownerName: 'Owner', category: 'General', isOnboarded: true }).success, false); }
    finally { mockLocalStorage.setItem = original; }
  });
});

describe('Persistent commits and recovery', () => {
  beforeEach(() => { mockLocalStorage.clear(); __resetStorageForTesting(); getStoreData(); });
  const bill = () => {
    const p=addProduct({name:'Last packet',category:'General',unit:'packet',currentStock:1,sellingPrice:25,minStockAlert:1}).product!;
    return {operationId:'sale-intent-1',shopId:getStoreData().profile.id,items:[{productId:p.id,productName:p.name,unit:p.unit,quantity:1,unitPrice:25,totalPrice:25}],paymentMode:'cash' as const};
  };
  it('retries the same persisted sale after reload exactly once and rejects changed payload',()=>{
    const input=bill();const first=recordSale(input);assert.equal(first.success,true);
    __resetStorageForTesting();const replay=recordSale(input);
    assert.equal(replay.sale?.id,first.sale?.id);assert.equal(getStoreData().sales.length,1);
    assert.equal(getStoreData().products[0].currentStock,0);
    assert.equal(recordSale({ ...input,notes:'changed'}).success,false);
  });
  it('rejects a stale snapshot instead of overwriting the last-stock sale',()=>{
    const input=bill();const stale=structuredClone(getStoreData());
    assert.equal(recordSale(input).success,true);
    assert.equal(saveStoreData({...stale,shopName:'stale writer'}),false);
    assert.equal(recordSale({ ...input,operationId:'other-intent'}).success,false);
    assert.equal(getStoreData().sales.length,1);
  });
  it('rejects a draft from another shop',()=>{
    const input=bill();createShopProfile({shopName:'Other',ownerName:'Owner',category:'General',isOnboarded:true});
    assert.equal(recordSale(input).success,false);assert.equal(getStoreData().sales.length,0);
  });
  it('reset preserves a recoverable snapshot and explicitly fails on quota errors',()=>{
    bill();const before=JSON.stringify(getStoreData());const original=mockLocalStorage.setItem;
    mockLocalStorage.setItem=()=>{throw Error('quota');};
    try {assert.equal(resetCurrentShopToEmpty().success,false);assert.equal(JSON.stringify(getStoreData()),before);}finally{mockLocalStorage.setItem=original;}
    assert.equal(resetCurrentShopToEmpty().success,true);
    const keys=Array.from({length:mockLocalStorage.length},(_,i)=>mockLocalStorage.key(i));
    assert.ok(keys.some(k=>k?.startsWith('dukaan_recovery_')));
  });
  it('restore fails without replacing data when snapshot persistence fails',()=>{
    bill();const backup=createShopBackup(getStoreData()),before=JSON.stringify(getStoreData());const original=mockLocalStorage.setItem;
    mockLocalStorage.setItem=(key,value)=>{if(key.startsWith('dukaan_recovery_'))throw Error('quota');original.call(mockLocalStorage,key,value);};
    try {assert.equal(restoreBackupToStore(backup).success,false);assert.equal(JSON.stringify(getStoreData()),before);}finally{mockLocalStorage.setItem=original;}
  });
  it('validates malformed dates, balances, references, status and movement data',()=>{
    recordSale(bill());const base=createShopBackup(getStoreData());
    const mutations=[
      (b:typeof base)=>{b.data.sales[0].createdAt='invalid';},
      (b:typeof base)=>{b.data.sales[0].totalAmount=Infinity;},
      (b:typeof base)=>{b.data.sales[0].customerId='missing';},
      (b:typeof base)=>{b.data.stockMovements[0].quantity=NaN;},
      (b:typeof base)=>{b.data.sales[0].items[0].totalPrice=12;},
    ];
    for(const change of mutations){const backup=structuredClone(base);change(backup);assert.equal(validateShopBackup(backup).isValid,false);}
  });
  it('separates booked sales from pending, manual, failed and cancelled payments',()=>{
    const date=new Date().toISOString();const statuses=['paid','pending_verification','failed','cancelled'] as const;
    const sales=statuses.map((status,i)=>({id:String(i),invoiceNo:String(i),items:[],createdAt:date,totalAmount:100,paymentMode:'online' as const,paymentVerificationStatus:status,paymentStatus:'completed' as const}));
    const summary=calculateDailySales([...sales,{...sales[1],id:'manual',paymentStatus:'manually_confirmed'}]);
    assert.equal(summary.grossSales,500);assert.equal(summary.confirmedCollections,100);assert.equal(summary.manuallyConfirmedOnline,100);assert.equal(summary.pendingOnline,100);assert.equal(summary.failedOnline,100);assert.equal(summary.cancelledOnline,100);
  });
});

import { normalizeQuantity } from '../lib/units.ts';
import { prepareAIDraft } from '../lib/ai-draft.ts';
describe('AI draft boundaries',()=>{
  beforeEach(()=>{mockLocalStorage.clear();__resetStorageForTesting();getStoreData();});
  it('converts grams to kg and ml to litres, rejecting incompatible or excessive precision',()=>{
    assert.equal(normalizeQuantity(500,'gm','kg'),0.5);
    assert.equal(normalizeQuantity(250,'ml','litre'),0.25);
    assert.equal(normalizeQuantity(5,'ml','kg'),null);
    assert.equal(normalizeQuantity(Infinity,'kg','kg'),null);
    assert.equal(normalizeQuantity(0.1,'gm','kg'),null);
  });
  it('previews normalized amount with shop and operation identity without saving',()=>{
    const p=addProduct({name:'Rice',category:'Grain',unit:'kg',currentStock:10,sellingPrice:60,minStockAlert:1}).product!;
    const before=JSON.stringify(getStoreData());
    const draft=prepareAIDraft({rawText:'500gm rice',intent:'sale',intentLabelHindi:'Sale',confidence:1,quantity:500,unit:'gm',matchedProduct:p},getStoreData());
    assert.equal(draft.quantity,0.5);assert.equal(draft.amount,30);assert.equal(draft.shopId,getStoreData().profile.id);assert.ok(draft.operationId);
    assert.equal(JSON.stringify(getStoreData()),before);
  });
});

it('daily summaries use Indian business-day boundaries independent of host timezone',()=>{
  const base={id:'a',invoiceNo:'a',items:[],paymentMode:'cash' as const,totalAmount:10};
  const summary=calculateDailySales([{...base,createdAt:'2026-11-12T18:29:59.000Z'},{...base,id:'b',createdAt:'2026-11-12T18:30:00.000Z'},{...base,id:'c',createdAt:'2026-11-13T18:29:59.000Z'},{...base,id:'d',createdAt:'2026-11-13T18:30:00.000Z'}],[],new Date('2026-11-13T12:00:00Z'));
  assert.equal(summary.grossSales,20);assert.equal(summary.completedSalesCount,2);
});

it('reopening the demo preserves practice entries and reset only affects the demo', () => {
  mockLocalStorage.clear();
  __resetStorageForTesting();
  const shop = getStoreData();
  const demo = loadDemoShop();
  assert.equal(demo.profile.isDemo, true);
  const item = addProduct({ name: 'Practice item', category: 'General', unit: 'piece', currentStock: 2, sellingPrice: 5, minStockAlert: 1 });
  assert.equal(item.success, true);
  assert.deepEqual(switchProfile(shop.profile.id).products, shop.products);
  assert.ok(loadDemoShop().products.some(p => p.id === item.product!.id));
  assert.deepEqual(resetToDemoData().products, demo.products);
});
