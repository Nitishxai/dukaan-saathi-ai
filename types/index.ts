export type StandardUnitType =
  | 'kg'
  | 'gm'
  | 'g'
  | 'litre'
  | 'ml'
  | 'packet'
  | 'piece'
  | 'strip'
  | 'tablet'
  | 'bottle'
  | 'box'
  | 'pack'
  | 'pair'
  | 'set'
  | 'crate'
  | 'bori'
  | 'bag'
  | 'dozen'
  | 'metre'
  | 'can'
  | 'tube'
  | 'bunch';

export type UnitType = StandardUnitType | (string & {});

export interface ShopProfile {
  id: string; // e.g. "profile-default", "profile-172...", "profile-demo"
  shopName: string;
  ownerName: string;
  category: string; // e.g. "Kirana / Grocery Store", "Medical / Pharmacy"
  businessType?: string; // Standard key: "kirana", "pharmacy", "clothing", "electronics", "mobile_accessories", "cosmetics", "hardware", "stationery", "dairy", "fruits_vegetables", "other"
  customBusinessType?: string; // Set when businessType === "other"
  description?: string; // Optional business description
  phone?: string;
  address?: string;
  upiId?: string; // e.g. "shopname@upi", configured merchant UPI ID
  createdAt: string;
  isOnboarded: boolean;
  isDemo?: boolean;
}

export interface Product {
  id: string;
  name: string; // e.g. "चीनी (Sugar M-30)", "Paracetamol 500mg", "Denim Jeans"
  hindiName?: string;
  brandOrVariant?: string; // e.g. "Tata", "Aashirvaad", "5kg", "1L", "Cipla"
  category: string; // e.g. "Grains & Flour", "Medicines", "Men's Wear"
  unit: UnitType;
  currentStock: number | null; // null if stock not yet recorded/known
  sellingPrice: number | null; // in INR (₹), null if not yet configured
  purchasePrice?: number | null; // in INR (₹)
  minStockAlert: number; // Low stock threshold (default 5)
  supplier?: string;
  updatedAt: string;
  // Dynamic business fields (all optional for cross-industry flexibility)
  size?: string; // Clothing: M, L, XL, 32, 40
  color?: string; // Clothing: Blue, Black, White
  modelNumber?: string; // Electronics / Mobile: Model M34, Pro-100
  warranty?: string; // Electronics / Mobile: 1 Year, 6 Months
  batchNumber?: string; // Pharmacy: B-1049
  expiryDate?: string; // Pharmacy / Grocery: 2026-12
}

export type StockStatusClassification = 'out_of_stock' | 'low_stock' | 'adequate' | 'unrecorded';

export interface SaleItem {
  productId: string;
  productName: string;
  unit: UnitType;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export type PaymentMode = 'cash' | 'online' | 'udhaar';

export interface Sale {
  id: string;
  invoiceNo: string;
  items: SaleItem[];
  totalAmount: number;
  paymentMode: PaymentMode;
  customerId?: string; // if paymentMode is 'udhaar'
  customerName?: string;
  createdAt: string; // ISO date string
  notes?: string;
  upiId?: string; // Configured UPI ID if paid via UPI
  paymentStatus?: 'completed' | 'manually_confirmed'; // Explicitly tracks unverified manual confirmations
}

export type UdhaarType = 'credit_given' | 'payment_received'; // उधार दिया या जमा मिला

export interface UdhaarTransaction {
  id: string;
  customerId: string;
  type: UdhaarType;
  amount: number;
  notes: string;
  createdAt: string;
  saleId?: string; // linked sale if created via credit sale
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  currentBalance: number; // positive means customer owes shopkeeper (उधार बाकी)
  lastTransactionAt?: string;
  createdAt: string;
}

export type StockMovementType = 'opening' | 'purchase' | 'sale' | 'adjustment' | 'return';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: number;
  previousStock: number | null;
  newStock: number | null;
  reason: string;
  createdAt: string;
  referenceId?: string;
}

export type ActivityType =
  | 'sale'
  | 'stock_add'
  | 'stock_update'
  | 'udhaar_given'
  | 'udhaar_received'
  | 'product_add'
  | 'product_delete'
  | 'profile_update';

export interface ActivityLog {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  amount?: number;
  timestamp: string;
  referenceId?: string;
}

export interface DukaanStoreData {
  profile: ShopProfile;
  // Backward compatibility convenience fields mirroring profile
  shopName: string;
  shopkeeperName: string;
  phone: string;
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  udhaarTransactions: UdhaarTransaction[];
  stockMovements: StockMovement[];
  activities: ActivityLog[];
  lastResetAt: string;
}

export type AIIntent =
  | 'sale'
  | 'stock_add'
  | 'udhaar_given'
  | 'udhaar_received'
  | 'restock_suggestion'
  | 'general_query'
  | 'inventory_add'
  | 'inventory_update'
  | 'unknown';

export interface RestockItem {
  productId: string;
  productName: string;
  currentStock: number;
  minStockAlert: number;
  suggestedAdd: number;
  unit: UnitType;
  reason: string;
}

export interface ParsedProductItem {
  name: string;
  brandOrVariant?: string;
  category?: string;
  unit?: UnitType;
  openingStock?: number | null;
  sellingPrice?: number | null;
  purchasePrice?: number | null;
  minStockAlert?: number;
  isExisting?: boolean;
  matchedProductId?: string;
  updatedFields?: string[];
  missingFields?: string[];
}

export interface AIParseResult {
  rawText: string;
  intent: AIIntent;
  intentLabelHindi: string;
  confidence: number;
  matchedProduct?: Product;
  matchedCustomer?: Customer;
  quantity?: number;
  unit?: UnitType;
  amount?: number;
  notes?: string;
  message?: string;
  restockItems?: RestockItem[];
  parsedProducts?: ParsedProductItem[];
  autoSavedCount?: number;
  isAmbiguous?: boolean;
  clarificationQuestion?: string;
  errorMessage?: string;
  spokenResponse?: string;
  source?: 'gemini' | 'local_rules';
}

export interface DailySalesSummary {
  grossSales: number;
  completedSalesCount: number;
  cashSales: number;
  onlineSales: number;
  upiSales?: number;
  udhaarSales: number;
  udhaarCollected: number;
  totalCashInHandToday: number;
  cashInDrawer?: number;
  productQuantitiesSold: Array<{
    productName: string;
    unit: UnitType;
    quantity: number;
    totalAmount: number;
  }>;
}

export interface AssistantApiRequest {
  message: string;
  inventory?: Array<
    Pick<Product, 'id' | 'name' | 'unit' | 'currentStock' | 'sellingPrice' | 'minStockAlert'> &
      Partial<Product>
  >;
  customers?: Array<
    Pick<Customer, 'id' | 'name' | 'currentBalance'> &
      Partial<Customer>
  >;
  shopName?: string;
  ownerName?: string;
  todaySalesTotal?: number;
  todaySalesCount?: number;
  todaySalesSummary?: Partial<DailySalesSummary>;
}

export interface AssistantApiResponse {
  success: boolean;
  result?: AIParseResult;
  source?: 'gemini' | 'local_rules';
  error?: string;
  message?: string;
}

export interface DukaanShopBackup {
  schemaVersion: '1.0';
  app: 'Dukaan Sathi AI';
  exportedAt: string;
  shopProfile: ShopProfile;
  data: {
    products: Product[];
    sales: Sale[];
    customers: Customer[];
    udhaarTransactions: UdhaarTransaction[];
    stockMovements: StockMovement[];
    activities: ActivityLog[];
    lastResetAt: string;
  };
  meta: {
    totalProducts: number;
    totalSales: number;
    totalCustomers: number;
    totalUdhaarTransactions: number;
  };
}

export interface BackupValidationResult {
  isValid: boolean;
  error?: string;
  backup?: DukaanShopBackup;
  summary?: {
    shopName: string;
    ownerName: string;
    businessType?: string;
    exportedAt: string;
    productCount: number;
    salesCount: number;
    customerCount: number;
    udhaarCount: number;
    totalOutstandingCredit: number;
  };
}
