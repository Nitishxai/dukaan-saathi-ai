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
  __resetStorageForTesting,
  getStoreData,
  addProduct,
  updateProduct,
  deleteProduct,
  recordSale,
  addCustomer,
  recordUdhaarTransaction,
  calculateDailySales,
  createShopProfile,
  switchProfile,
  roundPrecision,
} from '../lib/storage.ts';

import {
  createShopBackup,
  validateShopBackup,
  restoreBackupToStore,
} from '../lib/backup.ts';

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
    const saleRes1 = recordSale({
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
    const saleRes2 = recordSale({
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
    const saleRes = recordSale({
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
    const failSale = recordSale({
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

    const saleRes = recordSale({
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
    recordSale({
      items: [{ productId: p1.id, productName: p1.name, unit: 'piece', quantity: 1, unitPrice: 100, totalPrice: 100 }],
      paymentMode: 'cash',
    });

    // Sale 2: Online / UPI sale of ₹250
    recordSale({
      items: [{ productId: p2.id, productName: p2.name, unit: 'piece', quantity: 1, unitPrice: 250, totalPrice: 250 }],
      paymentMode: 'online',
    });

    // Sale 3: Udhaar sale of ₹150
    recordSale({
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

    recordSale({
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
});
