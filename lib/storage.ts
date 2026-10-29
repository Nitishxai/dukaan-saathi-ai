import type {
  DukaanStoreData,
  ShopProfile,
  Product,
  Sale,
  SaleItem,
  Customer,
  UdhaarTransaction,
  PaymentMode,
  UdhaarType,
  UnitType,
  StockStatusClassification,
  DailySalesSummary,
  ParsedProductItem,
} from '../types';

// Storage keys
const ACTIVE_PROFILE_KEY = 'dukaan_active_profile_id_v2';
const PROFILES_INDEX_KEY = 'dukaan_profiles_index_v2';
const PROFILE_DATA_KEY_PREFIX = 'dukaan_store_data_';
const LEGACY_STORAGE_KEY = 'dukaan_sathi_store_v1';

export const STORAGE_UPDATE_EVENT = 'dukaan_sathi_store_updated_v2';

// Standard demo profile ID
export const DEMO_PROFILE_ID = 'profile-demo-kirana';

/**
 * Creates a clean, empty store data object for a real shop.
 * NO sample or hardcoded products, sales, or customers.
 */
export function createEmptyShopData(profile: ShopProfile): DukaanStoreData {
  return {
    profile,
    shopName: profile.shopName,
    shopkeeperName: profile.ownerName,
    phone: profile.phone || '',
    products: [],
    sales: [],
    customers: [],
    udhaarTransactions: [],
    stockMovements: [],
    activities: [
      {
        id: `act-${Date.now()}`,
        type: 'profile_update',
        title: 'Shop Account Initialized',
        description: `${profile.shopName}'s digital ledger is ready. Add your first products.`,
        timestamp: new Date().toISOString(),
      },
    ],
    lastResetAt: new Date().toISOString(),
  };
}

/**
 * Isolated Sample Kirana Store Data (Demo mode only).
 * Loaded ONLY when the shop owner explicitly clicks "Load Demo Store".
 * Strictly stored under DEMO_PROFILE_ID and never contaminates real shop profiles.
 */
export const SAMPLE_DEMO_STORE_DATA: DukaanStoreData = {
  profile: {
    id: DEMO_PROFILE_ID,
    shopName: 'Shri Ganesh Kirana (Demo Store)',
    ownerName: 'Ram Lal Gupta',
    category: 'Kirana Store',
    businessType: 'kirana',
    description: 'Sample Kirana & General Store inventory for quick testing.',
    phone: '98765 43210',
    address: 'Shop No. 4, Main Market',
    createdAt: '2026-10-12T10:00:00.000Z',
    isOnboarded: true,
    isDemo: true,
  },
  shopName: 'Shri Ganesh Kirana (Demo Store)',
  shopkeeperName: 'Ram Lal Gupta',
  phone: '98765 43210',
  lastResetAt: '2026-10-12T10:00:00.000Z',
  products: [
    {
      id: 'demo-prod-1',
      name: 'चीनी (Sugar M-30)',
      hindiName: 'चीनी',
      brandOrVariant: 'M-30 ग्रेड',
      category: 'राशन / अनाज',
      unit: 'kg',
      currentStock: 28,
      sellingPrice: 44,
      purchasePrice: 39,
      minStockAlert: 10,
      updatedAt: '2026-10-12T10:00:00.000Z',
    },
    {
      id: 'demo-prod-2',
      name: 'आशीर्वाद आटा (Aashirvaad Atta 5kg)',
      hindiName: 'आटा 5 किलो',
      brandOrVariant: '5kg पैकेट',
      category: 'राशन / अनाज',
      unit: 'packet',
      currentStock: 14,
      sellingPrice: 235,
      purchasePrice: 215,
      minStockAlert: 5,
      updatedAt: '2026-10-12T10:00:00.000Z',
    },
    {
      id: 'demo-prod-3',
      name: 'फॉर्च्यून सरसों तेल (Fortune Mustard Oil 1L)',
      hindiName: 'सरसों तेल 1L',
      brandOrVariant: '1 Litre Pouch',
      category: 'तेल और घी',
      unit: 'litre',
      currentStock: 3, // LOW STOCK
      sellingPrice: 155,
      purchasePrice: 140,
      minStockAlert: 6,
      updatedAt: '2026-10-12T10:00:00.000Z',
    },
    {
      id: 'demo-prod-4',
      name: 'टाटा नमक (Tata Salt 1kg)',
      hindiName: 'टाटा नमक 1kg',
      brandOrVariant: '1kg पैकेट',
      category: 'राशन / मसाले',
      unit: 'packet',
      currentStock: 0, // OUT OF STOCK
      sellingPrice: 28,
      purchasePrice: 23,
      minStockAlert: 10,
      updatedAt: '2026-10-12T10:00:00.000Z',
    },
    {
      id: 'demo-prod-5',
      name: 'मैगी नूडल्स (Maggi 2-Min)',
      hindiName: 'मैगी 70g',
      brandOrVariant: '70g पैकेट',
      category: 'स्नैक्स / पैकेट',
      unit: 'packet',
      currentStock: 48,
      sellingPrice: 14,
      purchasePrice: 11.5,
      minStockAlert: 12,
      updatedAt: '2026-10-12T10:00:00.000Z',
    },
    {
      id: 'demo-prod-6',
      name: 'बासमती चावल (Rozana Rice)',
      hindiName: 'चावल बासमती',
      brandOrVariant: 'रोजाना टुकड़ा',
      category: 'राशन / अनाज',
      unit: 'kg',
      currentStock: null, // UNRECORDED STOCK
      sellingPrice: 85,
      purchasePrice: 72,
      minStockAlert: 15,
      updatedAt: '2026-10-12T10:00:00.000Z',
    },
  ],
  customers: [
    {
      id: 'demo-cust-1',
      name: 'रमेश कुमार (Ramesh Kumar)',
      phone: '98765 43210',
      address: 'मकान नं. 14, गली नं. 2',
      currentBalance: 1250,
      lastTransactionAt: '2026-10-12T11:00:00.000Z',
      createdAt: '2026-10-10T10:00:00.000Z',
    },
    {
      id: 'demo-cust-2',
      name: 'शर्मा जी (Sharma Ji)',
      phone: '98112 23344',
      address: 'सामने वाली कोठी',
      currentBalance: 480,
      lastTransactionAt: '2026-10-12T09:00:00.000Z',
      createdAt: '2026-10-10T10:00:00.000Z',
    },
  ],
  sales: [
    {
      id: 'demo-sale-1',
      invoiceNo: 'DS-1001',
      items: [
        {
          productId: 'demo-prod-1',
          productName: 'चीनी (Sugar M-30)',
          unit: 'kg',
          quantity: 2,
          unitPrice: 44,
          totalPrice: 88,
        },
      ],
      totalAmount: 88,
      paymentMode: 'cash',
      createdAt: '2026-10-12T11:00:00.000Z',
      notes: 'नकद बिक्री (Cash)',
    },
    {
      id: 'demo-sale-2',
      invoiceNo: 'DS-1002',
      items: [
        {
          productId: 'demo-prod-2',
          productName: 'आशीर्वाद आटा (Aashirvaad Atta 5kg)',
          unit: 'packet',
          quantity: 1,
          unitPrice: 235,
          totalPrice: 235,
        },
      ],
      totalAmount: 235,
      paymentMode: 'online',
      createdAt: '2026-10-12T11:30:00.000Z',
      notes: 'UPI भुगतान',
    },
  ],
  udhaarTransactions: [
    {
      id: 'demo-udh-1',
      customerId: 'demo-cust-1',
      type: 'credit_given',
      amount: 500,
      notes: 'राशन उधार',
      createdAt: '2026-10-12T11:00:00.000Z',
    },
  ],
  stockMovements: [
    {
      id: 'demo-mov-1',
      productId: 'demo-prod-1',
      productName: 'चीनी (Sugar M-30)',
      type: 'opening',
      quantity: 30,
      previousStock: null,
      newStock: 30,
      reason: 'ओपनिंग स्टॉक दर्ज',
      createdAt: '2026-10-12T10:00:00.000Z',
    },
    {
      id: 'demo-mov-2',
      productId: 'demo-prod-1',
      productName: 'चीनी (Sugar M-30)',
      type: 'sale',
      quantity: -2,
      previousStock: 30,
      newStock: 28,
      reason: 'बिक्री DS-1001',
      createdAt: '2026-10-12T11:00:00.000Z',
    },
  ],
  activities: [
    {
      id: 'demo-act-1',
      type: 'sale',
      title: 'नई बिक्री (DS-1001)',
      description: '₹88 नकद बिक्री (चीनी 2kg)',
      amount: 88,
      timestamp: '2026-10-12T11:00:00.000Z',
    },
  ],
};

// Default Real Shop Profile template
export const DEFAULT_INITIAL_PROFILE: ShopProfile = {
  id: 'profile-main',
  shopName: 'My Kirana Store',
  ownerName: 'Shopkeeper',
  category: 'Kirana / Grocery Store',
  businessType: 'kirana',
  phone: '',
  address: '',
  createdAt: new Date().toISOString(),
  isOnboarded: false,
};

export const INITIAL_EMPTY_DATA: DukaanStoreData = createEmptyShopData(DEFAULT_INITIAL_PROFILE);
export const INITIAL_DEMO_DATA: DukaanStoreData = INITIAL_EMPTY_DATA;

// ---------------- IN-MEMORY SNAPSHOT & SUBSCRIBERS ----------------
let cachedSnapshot: DukaanStoreData = INITIAL_EMPTY_DATA;
let isInitialized = false;

const subscribers = new Set<() => void>();

function notifySubscribers(): void {
  subscribers.forEach((callback) => {
    try {
      callback();
    } catch (err) {
      console.error('Error notifying store subscriber:', err);
    }
  });
}

function getProfileStorageKey(profileId: string): string {
  return `${PROFILE_DATA_KEY_PREFIX}${profileId}_v2`;
}

// ---------------- PROFILE INITIALIZATION & MIGRATION ----------------
function initClientSnapshot(): void {
  if (typeof window === 'undefined' || isInitialized) return;
  isInitialized = true;

  try {
    // 1. Check active profile ID
    let activeProfileId = localStorage.getItem(ACTIVE_PROFILE_KEY);
    const profilesIndexRaw = localStorage.getItem(PROFILES_INDEX_KEY);
    let profilesList: ShopProfile[] = [];

    if (profilesIndexRaw) {
      try {
        profilesList = JSON.parse(profilesIndexRaw);
      } catch {
        profilesList = [];
      }
    }

    // 2. Migration Check from legacy v1 storage
    if (profilesList.length === 0) {
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        try {
          const legacy = JSON.parse(legacyRaw);
          // If legacy data had items, migrate it into a preserved profile
          if (legacy && Array.isArray(legacy.products) && legacy.products.length > 0) {
            const isUntouchedDemo =
              legacy.shopName === 'श्री गणेश किराना एवं जनरल स्टोर' &&
              legacy.products.length === 12;

            if (isUntouchedDemo) {
              // Untouched demo: start with clean un-onboarded profile
              const mainProfile: ShopProfile = { ...DEFAULT_INITIAL_PROFILE, isOnboarded: false };
              profilesList = [mainProfile];
              activeProfileId = mainProfile.id;
              cachedSnapshot = createEmptyShopData(mainProfile);
              saveProfileDataDirect(mainProfile.id, cachedSnapshot);
            } else {
              // User had customized their store: preserve their data!
              const migratedProfile: ShopProfile = {
                id: 'profile-migrated-1',
                shopName: legacy.shopName || 'मेरी दुकान',
                ownerName: legacy.shopkeeperName || 'दुकानदार',
                category: 'किराना स्टोर (Kirana Store)',
                phone: legacy.phone || '',
                createdAt: new Date().toISOString(),
                isOnboarded: true,
              };
              profilesList = [migratedProfile];
              activeProfileId = migratedProfile.id;
              cachedSnapshot = {
                profile: migratedProfile,
                shopName: migratedProfile.shopName,
                shopkeeperName: migratedProfile.ownerName,
                phone: migratedProfile.phone || '',
                products: legacy.products.map((p: Product) => ({
                  ...p,
                  currentStock: typeof p.currentStock === 'number' ? p.currentStock : null,
                  sellingPrice: typeof p.sellingPrice === 'number' ? p.sellingPrice : null,
                  minStockAlert: p.minStockAlert || 5,
                })),
                sales: legacy.sales || [],
                customers: legacy.customers || [],
                udhaarTransactions: legacy.udhaarTransactions || [],
                stockMovements: [],
                activities: legacy.activities || [],
                lastResetAt: legacy.lastResetAt || new Date().toISOString(),
              };
              saveProfileDataDirect(migratedProfile.id, cachedSnapshot);
            }
          }
        } catch (e) {
          console.warn('Could not parse legacy data for migration:', e);
        }
      }
    }

    // 3. If still empty, create default un-onboarded profile
    if (profilesList.length === 0) {
      const initialProfile = { ...DEFAULT_INITIAL_PROFILE };
      profilesList = [initialProfile];
      activeProfileId = initialProfile.id;
      cachedSnapshot = createEmptyShopData(initialProfile);
      saveProfileDataDirect(initialProfile.id, cachedSnapshot);
    }

    if (!activeProfileId || !profilesList.some((p) => p.id === activeProfileId)) {
      activeProfileId = profilesList[0].id;
    }

    localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileId);
    localStorage.setItem(PROFILES_INDEX_KEY, JSON.stringify(profilesList));

    // 4. Load Active Profile Data
    let rawActiveData = localStorage.getItem(getProfileStorageKey(activeProfileId));
    if (!rawActiveData) {
      // Fallback: check unversioned storage key if data was saved in an earlier session
      rawActiveData = localStorage.getItem(`${PROFILE_DATA_KEY_PREFIX}${activeProfileId}`);
    }
    if (rawActiveData) {
      try {
        const parsedData = JSON.parse(rawActiveData);
        if (parsedData && Array.isArray(parsedData.products)) {
          cachedSnapshot = {
            ...parsedData,
            profile: parsedData.profile || profilesList.find((p) => p.id === activeProfileId),
            stockMovements: Array.isArray(parsedData.stockMovements) ? parsedData.stockMovements : [],
            shopName: parsedData.profile?.shopName || parsedData.shopName || 'मेरी दुकान',
            shopkeeperName: parsedData.profile?.ownerName || parsedData.shopkeeperName || 'दुकानदार',
            phone: parsedData.profile?.phone || parsedData.phone || '',
          };
          return;
        }
      } catch (err) {
        console.error('Error parsing active profile store data:', err);
      }
    }

    // Fallback if active data file was missing
    const activeProf = profilesList.find((p) => p.id === activeProfileId) || profilesList[0];
    cachedSnapshot = createEmptyShopData(activeProf);
    saveProfileDataDirect(activeProf.id, cachedSnapshot);
  } catch (err) {
    console.error('Failed to init storage snapshot:', err);
    cachedSnapshot = INITIAL_EMPTY_DATA;
  }
}

function saveProfileDataDirect(profileId: string, data: DukaanStoreData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getProfileStorageKey(profileId), JSON.stringify(data));
}

// ---------------- PUBLIC ACCESSORS & STORE METHODS ----------------

export function __resetStorageForTesting(): void {
  isInitialized = false;
  cachedSnapshot = INITIAL_EMPTY_DATA;
  subscribers.clear();
}

export function getStoreData(): DukaanStoreData {
  if (typeof window === 'undefined') {
    return INITIAL_EMPTY_DATA;
  }
  if (!isInitialized) {
    initClientSnapshot();
  }
  return cachedSnapshot;
}

export function saveStoreData(data: DukaanStoreData): boolean {
  const nextSnapshot: DukaanStoreData = {
    ...data,
    shopName: data.profile?.shopName || data.shopName,
    shopkeeperName: data.profile?.ownerName || data.shopkeeperName,
    phone: data.profile?.phone || data.phone || '',
  };

  if (typeof window !== 'undefined') {
    try {
      const activeProfileId = data.profile?.id || localStorage.getItem(ACTIVE_PROFILE_KEY) || 'profile-main';
      // Atomic write: serialize & save to disk before updating in-memory cache
      saveProfileDataDirect(activeProfileId, nextSnapshot);

      // Keep profile index in sync
      const rawIndex = localStorage.getItem(PROFILES_INDEX_KEY);
      if (rawIndex && data.profile) {
        try {
          const list: ShopProfile[] = JSON.parse(rawIndex);
          const idx = list.findIndex((p) => p.id === data.profile.id);
          if (idx !== -1) {
            list[idx] = data.profile;
            localStorage.setItem(PROFILES_INDEX_KEY, JSON.stringify(list));
          }
        } catch {
          // ignore index parsing errors
        }
      }

      // Memory cache is only updated after successful disk persistence
      cachedSnapshot = nextSnapshot;
      window.dispatchEvent(new CustomEvent(STORAGE_UPDATE_EVENT, { detail: cachedSnapshot }));
    } catch (err) {
      console.error('Failed to atomically save store data to localStorage:', err);
      return false;
    }
  } else {
    cachedSnapshot = nextSnapshot;
  }

  notifySubscribers();
  return true;
}

export function subscribeStoreData(onStoreChange: () => void): () => void {
  subscribers.add(onStoreChange);

  const handleCustomEvent = () => {
    onStoreChange();
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (typeof window === 'undefined') return;
    const currentActiveId = localStorage.getItem(ACTIVE_PROFILE_KEY);
    if (!currentActiveId) return;

    if (event.key === getProfileStorageKey(currentActiveId) && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        if (parsed && Array.isArray(parsed.products)) {
          cachedSnapshot = parsed;
          onStoreChange();
        }
      } catch (e) {
        console.error('Error handling storage event:', e);
      }
    } else if (event.key === ACTIVE_PROFILE_KEY && event.newValue) {
      // Switched profiles in another tab
      const raw = localStorage.getItem(getProfileStorageKey(event.newValue));
      if (raw) {
        try {
          cachedSnapshot = JSON.parse(raw);
          onStoreChange();
        } catch {
          // ignore
        }
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(STORAGE_UPDATE_EVENT, handleCustomEvent);
    window.addEventListener('storage', handleStorageEvent);
  }

  return () => {
    subscribers.delete(onStoreChange);
    if (typeof window !== 'undefined') {
      window.removeEventListener(STORAGE_UPDATE_EVENT, handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
    }
  };
}

// ---------------- PROFILE MANAGEMENT ----------------

export function getProfilesList(): ShopProfile[] {
  if (typeof window === 'undefined') {
    return [DEFAULT_INITIAL_PROFILE];
  }
  try {
    const raw = localStorage.getItem(PROFILES_INDEX_KEY);
    if (!raw) return [DEFAULT_INITIAL_PROFILE];
    const list: ShopProfile[] = JSON.parse(raw);
    return Array.isArray(list) && list.length > 0 ? list : [DEFAULT_INITIAL_PROFILE];
  } catch {
    return [DEFAULT_INITIAL_PROFILE];
  }
}

export function getActiveProfile(): ShopProfile {
  const current = getStoreData();
  return current.profile || DEFAULT_INITIAL_PROFILE;
}

export function switchProfile(profileId: string): DukaanStoreData {
  if (typeof window === 'undefined') return cachedSnapshot;

  const profiles = getProfilesList();
  const targetProfile = profiles.find((p) => p.id === profileId);
  if (!targetProfile) {
    console.warn(`Profile ${profileId} not found`);
    return cachedSnapshot;
  }

  localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);

  let raw = localStorage.getItem(getProfileStorageKey(profileId));
  if (!raw) {
    raw = localStorage.getItem(`${PROFILE_DATA_KEY_PREFIX}${profileId}`);
  }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      cachedSnapshot = {
        ...parsed,
        profile: targetProfile,
        shopName: targetProfile.shopName,
        shopkeeperName: targetProfile.ownerName,
        phone: targetProfile.phone || '',
      };
    } catch {
      cachedSnapshot = createEmptyShopData(targetProfile);
      saveProfileDataDirect(profileId, cachedSnapshot);
    }
  } else {
    cachedSnapshot = createEmptyShopData(targetProfile);
    saveProfileDataDirect(profileId, cachedSnapshot);
  }

  notifySubscribers();
  window.dispatchEvent(new CustomEvent(STORAGE_UPDATE_EVENT, { detail: cachedSnapshot }));
  return cachedSnapshot;
}

export function createShopProfile(
  profileInput: Omit<ShopProfile, 'id' | 'createdAt'>
): { success: boolean; profile?: ShopProfile; error?: string } {
  if (!profileInput.shopName.trim()) {
    return { success: false, error: 'दुकान का नाम अनिवार्य है।' };
  }
  if (!profileInput.ownerName.trim()) {
    return { success: false, error: 'दुकानदार का नाम अनिवार्य है।' };
  }

  const id = `profile-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const newProfile: ShopProfile = {
    ...profileInput,
    id,
    shopName: profileInput.shopName.trim(),
    ownerName: profileInput.ownerName.trim(),
    category: profileInput.category || 'किराना स्टोर (Kirana Store)',
    createdAt: new Date().toISOString(),
    isOnboarded: profileInput.isOnboarded !== undefined ? profileInput.isOnboarded : true,
  };

  const currentProfiles = getProfilesList();
  const updatedProfiles = [...currentProfiles, newProfile];

  if (typeof window !== 'undefined') {
    localStorage.setItem(PROFILES_INDEX_KEY, JSON.stringify(updatedProfiles));
  }

  const newStoreData = createEmptyShopData(newProfile);
  saveProfileDataDirect(id, newStoreData);

  // Switch to newly created profile
  switchProfile(id);
  return { success: true, profile: newProfile };
}

export function updateShopProfile(
  updates: Partial<Omit<ShopProfile, 'id' | 'createdAt'>>
): { success: boolean; profile?: ShopProfile; error?: string } {
  const current = getStoreData();
  const updatedProfile: ShopProfile = {
    ...current.profile,
    ...updates,
    shopName: updates.shopName?.trim() || current.profile.shopName,
    ownerName: updates.ownerName?.trim() || current.profile.ownerName,
  };

  const updatedData: DukaanStoreData = {
    ...current,
    profile: updatedProfile,
    shopName: updatedProfile.shopName,
    shopkeeperName: updatedProfile.ownerName,
    phone: updatedProfile.phone || '',
    activities: [
      {
        id: `act-${Date.now()}`,
        type: 'profile_update',
        title: 'प्रोफाइल अपडेट (Profile Updated)',
        description: `${updatedProfile.shopName} • ${updatedProfile.ownerName}`,
        timestamp: new Date().toISOString(),
      },
      ...current.activities,
    ],
  };

  saveStoreData(updatedData);
  return { success: true, profile: updatedProfile };
}

/**
 * Loads the isolated Demo Shop into DEMO_PROFILE_ID and switches to it.
 * This guarantees sample products never contaminate real shops.
 */
export function loadDemoShop(): DukaanStoreData {
  const profiles = getProfilesList();
  let demoProfile = profiles.find((p) => p.id === DEMO_PROFILE_ID);

  if (!demoProfile) {
    demoProfile = { ...SAMPLE_DEMO_STORE_DATA.profile };
    const updatedProfiles = [...profiles, demoProfile];
    if (typeof window !== 'undefined') {
      localStorage.setItem(PROFILES_INDEX_KEY, JSON.stringify(updatedProfiles));
    }
  }

  saveProfileDataDirect(DEMO_PROFILE_ID, SAMPLE_DEMO_STORE_DATA);
  return switchProfile(DEMO_PROFILE_ID);
}

/**
 * Resets the current shop's data to a clean empty state.
 */
export function resetCurrentShopToEmpty(): DukaanStoreData {
  const current = getStoreData();
  const empty = createEmptyShopData({
    ...current.profile,
    isOnboarded: current.profile.isOnboarded,
  });
  saveStoreData(empty);
  return empty;
}

/**
 * Backward compatibility alias for resetting to demo shop
 */
export function resetToDemoData(): DukaanStoreData {
  return loadDemoShop();
}

// ---------------- STOCK CLASSIFICATION HELPER ----------------

export function getStockClassification(product: Product): StockStatusClassification {
  if (product.currentStock === null || product.currentStock === undefined) {
    return 'unrecorded';
  }
  if (product.currentStock <= 0) {
    return 'out_of_stock';
  }
  if (product.currentStock <= product.minStockAlert) {
    return 'low_stock';
  }
  return 'adequate';
}

/**
 * Clean floating point precision helper for inventory quantities and currency.
 * Defaults to 3 decimal places (e.g. 0.125 kg / 125g, 0.005 kg / 5g) without
 * IEEE-754 precision artifacts.
 */
export function roundPrecision(val: number, decimals: number = 3): number {
  if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

// ---------------- PRODUCTS / INVENTORY CRUD ----------------

export function addProduct(
  productInput: Omit<Product, 'id' | 'updatedAt'>
): { success: boolean; product?: Product; error?: string } {
  const current = getStoreData();
  const trimmedName = productInput.name?.trim();

  if (!trimmedName) {
    return { success: false, error: 'Product name is required.' };
  }

  // Prevent duplicate product names in the same shop
  const existing = current.products.find(
    (p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (existing) {
    return {
      success: false,
      error: `"${trimmedName}" is already in inventory. Please edit it or use a different name.`,
    };
  }

  // Validate prices & quantities
  if (productInput.sellingPrice !== undefined && productInput.sellingPrice !== null) {
    if (typeof productInput.sellingPrice !== 'number' || isNaN(productInput.sellingPrice) || productInput.sellingPrice <= 0) {
      return { success: false, error: 'Selling price must be greater than zero.' };
    }
  }

  if (productInput.currentStock !== undefined && productInput.currentStock !== null) {
    if (typeof productInput.currentStock !== 'number' || isNaN(productInput.currentStock) || productInput.currentStock < 0) {
      return { success: false, error: 'Stock quantity cannot be negative.' };
    }
  }

  if (productInput.purchasePrice !== undefined && productInput.purchasePrice !== null) {
    if (typeof productInput.purchasePrice !== 'number' || isNaN(productInput.purchasePrice) || productInput.purchasePrice < 0) {
      return { success: false, error: 'Purchase price cannot be negative.' };
    }
  }

  const minStockAlert =
    typeof productInput.minStockAlert === 'number' && !isNaN(productInput.minStockAlert) && productInput.minStockAlert >= 0
      ? productInput.minStockAlert
      : 5;

  const finalStock =
    productInput.currentStock !== undefined && productInput.currentStock !== null
      ? roundPrecision(productInput.currentStock, 3)
      : null;

  const finalSellingPrice =
    productInput.sellingPrice !== undefined && productInput.sellingPrice !== null
      ? Number(productInput.sellingPrice.toFixed(2))
      : null;

  const finalPurchasePrice =
    productInput.purchasePrice !== undefined && productInput.purchasePrice !== null
      ? Number(productInput.purchasePrice.toFixed(2))
      : null;

  const id = `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const newProduct: Product = {
    ...productInput,
    id,
    name: trimmedName,
    unit: (productInput.unit && productInput.unit.trim()) || 'piece',
    currentStock: finalStock,
    sellingPrice: finalSellingPrice,
    purchasePrice: finalPurchasePrice,
    minStockAlert,
    updatedAt: new Date().toISOString(),
  };

  const newStockMovements = [...current.stockMovements];
  if (typeof newProduct.currentStock === 'number') {
    newStockMovements.unshift({
      id: `mov-${Date.now()}`,
      productId: newProduct.id,
      productName: newProduct.name,
      type: 'opening',
      quantity: newProduct.currentStock,
      previousStock: null,
      newStock: newProduct.currentStock,
      reason: 'Opening stock recorded',
      createdAt: new Date().toISOString(),
    });
  }

  const stockDesc =
    newProduct.currentStock !== null
      ? `Stock: ${newProduct.currentStock} ${newProduct.unit}`
      : 'Stock: Unrecorded';

  const updatedData: DukaanStoreData = {
    ...current,
    products: [newProduct, ...current.products],
    stockMovements: newStockMovements,
    activities: [
      {
        id: `act-${Date.now()}`,
        type: 'product_add',
        title: 'Product Added',
        description: `${newProduct.name} - ${stockDesc}`,
        timestamp: new Date().toISOString(),
      },
      ...current.activities,
    ],
  };

  saveStoreData(updatedData);
  return { success: true, product: newProduct };
}

export function updateProduct(
  id: string,
  updates: Partial<Omit<Product, 'id' | 'updatedAt'>>
): { success: boolean; product?: Product; error?: string } {
  const current = getStoreData();
  const index = current.products.findIndex((p) => p.id === id);
  if (index === -1) {
    return { success: false, error: 'Product not found' };
  }

  const existing = current.products[index];

  // Validate name if updated
  let finalName = existing.name;
  if (updates.name !== undefined) {
    const trimmed = updates.name.trim();
    if (!trimmed) {
      return { success: false, error: 'Product name cannot be empty.' };
    }
    // Prevent collision with another product in the same shop
    const duplicate = current.products.find(
      (p) => p.id !== id && p.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      return {
        success: false,
        error: `"${trimmed}" is already in inventory. Please use a different name.`,
      };
    }
    finalName = trimmed;
  }

  // Validate sellingPrice
  let finalSellingPrice = existing.sellingPrice;
  if (updates.sellingPrice !== undefined) {
    if (updates.sellingPrice !== null) {
      if (typeof updates.sellingPrice !== 'number' || isNaN(updates.sellingPrice) || updates.sellingPrice <= 0) {
        return { success: false, error: 'Selling price must be greater than zero.' };
      }
      finalSellingPrice = Number(updates.sellingPrice.toFixed(2));
    } else {
      finalSellingPrice = null;
    }
  }

  // Validate currentStock
  let finalStock = existing.currentStock;
  if (updates.currentStock !== undefined) {
    if (updates.currentStock !== null) {
      if (typeof updates.currentStock !== 'number' || isNaN(updates.currentStock) || updates.currentStock < 0) {
        return { success: false, error: 'Stock quantity cannot be negative.' };
      }
      finalStock = roundPrecision(updates.currentStock, 3);
    } else {
      finalStock = null;
    }
  }

  // Validate purchasePrice
  let finalPurchasePrice = existing.purchasePrice;
  if (updates.purchasePrice !== undefined) {
    if (updates.purchasePrice !== null) {
      if (typeof updates.purchasePrice !== 'number' || isNaN(updates.purchasePrice) || updates.purchasePrice < 0) {
        return { success: false, error: 'Purchase price cannot be negative.' };
      }
      finalPurchasePrice = Number(updates.purchasePrice.toFixed(2));
    } else {
      finalPurchasePrice = null;
    }
  }

  // Validate minStockAlert
  let finalMinStock = existing.minStockAlert;
  if (updates.minStockAlert !== undefined) {
    if (typeof updates.minStockAlert !== 'number' || isNaN(updates.minStockAlert) || updates.minStockAlert < 0) {
      return { success: false, error: 'Min stock alert must be zero or positive.' };
    }
    finalMinStock = updates.minStockAlert;
  }

  const updatedProduct: Product = {
    ...existing,
    ...updates,
    name: finalName,
    unit: (updates.unit && updates.unit.trim()) || existing.unit,
    currentStock: finalStock,
    sellingPrice: finalSellingPrice,
    purchasePrice: finalPurchasePrice,
    minStockAlert: finalMinStock,
    updatedAt: new Date().toISOString(),
  };

  const newProducts = [...current.products];
  newProducts[index] = updatedProduct;

  const newStockMovements = [...current.stockMovements];
  const newActivities = [...current.activities];

  // If currentStock changed, record stock movement and activity with clean precision
  if (finalStock !== existing.currentStock) {
    const prev = existing.currentStock;
    const next = finalStock;
    const diff = roundPrecision((next ?? 0) - (prev ?? 0), 3);

    newStockMovements.unshift({
      id: `mov-${Date.now()}`,
      productId: updatedProduct.id,
      productName: updatedProduct.name,
      type: 'adjustment',
      quantity: diff,
      previousStock: prev,
      newStock: next,
      reason: 'Stock adjustment',
      createdAt: new Date().toISOString(),
    });

    newActivities.unshift({
      id: `act-${Date.now()}`,
      type: 'stock_update',
      title: 'Stock Adjusted',
      description: `${updatedProduct.name}: ${prev ?? '—'} ➔ ${next ?? '—'} (${diff > 0 ? `+${diff}` : diff})`,
      timestamp: new Date().toISOString(),
    });
  }

  const updatedData: DukaanStoreData = {
    ...current,
    products: newProducts,
    stockMovements: newStockMovements,
    activities: newActivities,
  };

  saveStoreData(updatedData);
  return { success: true, product: updatedProduct };
}

export function deleteProduct(id: string): { success: boolean; error?: string } {
  const current = getStoreData();
  const prod = current.products.find((p) => p.id === id);
  if (!prod) return { success: false, error: 'Product not found' };

  const updatedData: DukaanStoreData = {
    ...current,
    products: current.products.filter((p) => p.id !== id),
    activities: [
      {
        id: `act-${Date.now()}`,
        type: 'product_delete',
        title: 'Product Deleted',
        description: `${prod.name} removed from inventory`,
        timestamp: new Date().toISOString(),
      },
      ...current.activities,
    ],
  };

  saveStoreData(updatedData);
  return { success: true };
}

/**
 * Batch Saves products from natural voice commands.
 * Matches existing products by name:
 * - If exists: updates ONLY explicitly provided fields; preserves existing stock & prices.
 * - If new: creates new product. If stock is given, records opening stock. If not given, stores null.
 * Prevents duplicates!
 */
export function saveProductsBatch(items: ParsedProductItem[]): {
  success: boolean;
  addedCount: number;
  updatedCount: number;
  savedProducts: Product[];
  error?: string;
} {
  if (!items || items.length === 0) {
    return { success: false, addedCount: 0, updatedCount: 0, savedProducts: [], error: 'No items found' };
  }

  const current = getStoreData();
  const newProductsList = [...current.products];
  const newStockMovements = [...current.stockMovements];
  const newActivities = [...current.activities];
  const savedProducts: Product[] = [];
  let addedCount = 0;
  let updatedCount = 0;

  for (const item of items) {
    const rawName = item.name.trim();
    if (!rawName) continue;

    const existingIndex = newProductsList.findIndex(
      (p) =>
        p.name.trim().toLowerCase() === rawName.toLowerCase() ||
        (p.hindiName && p.hindiName.trim().toLowerCase() === rawName.toLowerCase())
    );

    if (existingIndex !== -1) {
      // Update existing product without wiping unmentioned fields
      const existing = newProductsList[existingIndex];
      const validStock =
        typeof item.openingStock === 'number' && !isNaN(item.openingStock) && item.openingStock >= 0
          ? roundPrecision(item.openingStock, 3)
          : existing.currentStock;
      const validSellingPrice =
        typeof item.sellingPrice === 'number' && !isNaN(item.sellingPrice) && item.sellingPrice > 0
          ? Number(item.sellingPrice.toFixed(2))
          : existing.sellingPrice;
      const validPurchasePrice =
        typeof item.purchasePrice === 'number' && !isNaN(item.purchasePrice) && item.purchasePrice >= 0
          ? Number(item.purchasePrice.toFixed(2))
          : existing.purchasePrice;
      const validMinStock =
        typeof item.minStockAlert === 'number' && !isNaN(item.minStockAlert) && item.minStockAlert >= 0
          ? item.minStockAlert
          : existing.minStockAlert;

      const updated: Product = {
        ...existing,
        brandOrVariant: item.brandOrVariant || existing.brandOrVariant,
        category: item.category || existing.category,
        unit: item.unit || existing.unit,
        currentStock: validStock,
        sellingPrice: validSellingPrice,
        purchasePrice: validPurchasePrice,
        minStockAlert: validMinStock,
        updatedAt: new Date().toISOString(),
      };

      if (
        item.openingStock !== undefined &&
        item.openingStock !== null &&
        validStock !== existing.currentStock
      ) {
        const diff = roundPrecision((validStock ?? 0) - (existing.currentStock ?? 0), 3);
        newStockMovements.unshift({
          id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          productId: existing.id,
          productName: existing.name,
          type: 'adjustment',
          quantity: diff,
          previousStock: existing.currentStock,
          newStock: validStock,
          reason: 'Stock updated via voice command',
          createdAt: new Date().toISOString(),
        });
      }

      newProductsList[existingIndex] = updated;
      savedProducts.push(updated);
      updatedCount++;
    } else {
      // Create new product
      const validStock =
        typeof item.openingStock === 'number' && !isNaN(item.openingStock) && item.openingStock >= 0
          ? roundPrecision(item.openingStock, 3)
          : null;
      const validSellingPrice =
        typeof item.sellingPrice === 'number' && !isNaN(item.sellingPrice) && item.sellingPrice > 0
          ? Number(item.sellingPrice.toFixed(2))
          : null;
      const validPurchasePrice =
        typeof item.purchasePrice === 'number' && !isNaN(item.purchasePrice) && item.purchasePrice >= 0
          ? Number(item.purchasePrice.toFixed(2))
          : null;
      const validMinStock =
        typeof item.minStockAlert === 'number' && !isNaN(item.minStockAlert) && item.minStockAlert >= 0
          ? item.minStockAlert
          : 5;

      const newProd: Product = {
        id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: rawName,
        brandOrVariant: item.brandOrVariant,
        category: item.category || 'General',
        unit: item.unit || 'piece',
        currentStock: validStock,
        sellingPrice: validSellingPrice,
        purchasePrice: validPurchasePrice,
        minStockAlert: validMinStock,
        updatedAt: new Date().toISOString(),
      };

      if (typeof newProd.currentStock === 'number') {
        newStockMovements.unshift({
          id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          productId: newProd.id,
          productName: newProd.name,
          type: 'opening',
          quantity: newProd.currentStock,
          previousStock: null,
          newStock: newProd.currentStock,
          reason: 'Opening stock recorded',
          createdAt: new Date().toISOString(),
        });
      }

      newProductsList.unshift(newProd);
      savedProducts.push(newProd);
      addedCount++;
    }
  }

  if (savedProducts.length > 0) {
    newActivities.unshift({
      id: `act-${Date.now()}`,
      type: 'product_add',
      title: 'Inventory Saved',
      description: `${addedCount} new ${addedCount === 1 ? 'product' : 'products'}, ${updatedCount} updated`,
      timestamp: new Date().toISOString(),
    });
  }

  const updatedData: DukaanStoreData = {
    ...current,
    products: newProductsList,
    stockMovements: newStockMovements,
    activities: newActivities,
  };

  saveStoreData(updatedData);
  return { success: true, addedCount, updatedCount, savedProducts };
}

export function quickAddStock(
  productId: string,
  addQuantity: number
): { success: boolean; product?: Product; error?: string } {
  const current = getStoreData();
  const prod = current.products.find((p) => p.id === productId);
  if (!prod) return { success: false, error: 'Product not found' };
  if (typeof addQuantity !== 'number' || isNaN(addQuantity) || !isFinite(addQuantity) || addQuantity <= 0) {
    return { success: false, error: 'Quantity must be greater than 0' };
  }

  const prevStock = prod.currentStock;
  const newStock = roundPrecision((prevStock ?? 0) + addQuantity, 3);

  const updatedProduct: Product = {
    ...prod,
    currentStock: newStock,
    updatedAt: new Date().toISOString(),
  };

  const newProducts = current.products.map((p) => (p.id === productId ? updatedProduct : p));

  const newStockMovements = [
    {
      id: `mov-${Date.now()}`,
      productId: prod.id,
      productName: prod.name,
      type: 'purchase' as const,
      quantity: addQuantity,
      previousStock: prevStock,
      newStock,
      reason: 'Stock received',
      createdAt: new Date().toISOString(),
    },
    ...current.stockMovements,
  ];

  const updatedData: DukaanStoreData = {
    ...current,
    products: newProducts,
    stockMovements: newStockMovements,
    activities: [
      {
        id: `act-${Date.now()}`,
        type: 'stock_add',
        title: 'Stock Received',
        description: `+${addQuantity} ${prod.unit} added to ${prod.name} (New stock: ${newStock} ${prod.unit})`,
        timestamp: new Date().toISOString(),
      },
      ...current.activities,
    ],
  };

  saveStoreData(updatedData);
  return { success: true, product: updatedProduct };
}

// ---------------- SALES & BILLING ----------------

export function recordSale(saleInput: {
  items: SaleItem[];
  paymentMode: PaymentMode;
  customerId?: string;
  notes?: string;
  upiId?: string;
  paymentStatus?: 'completed' | 'manually_confirmed';
}): { success: boolean; sale?: Sale; error?: string } {
  const current = getStoreData();

  if (!saleInput.items || saleInput.items.length === 0) {
    return { success: false, error: 'At least 1 item is required in the bill.' };
  }

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

  // 4. Calculate Total Amount
  const totalAmount = roundPrecision(
    saleInput.items.reduce((sum, item) => sum + item.totalPrice, 0),
    2
  );

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
        id: `mov-${Date.now()}-${prod.id}`,
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

  // 4. Handle Customer Udhaar if paymentMode is 'udhaar'
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
    const updatedCust: Customer = {
      ...existingCust,
      currentBalance: roundPrecision(existingCust.currentBalance + totalAmount, 2),
      lastTransactionAt: new Date().toISOString(),
    };
    newCustomers[custIndex] = updatedCust;
    customerName = updatedCust.name;

    newUdhaarTx.unshift({
      id: `udh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerId: updatedCust.id,
      type: 'credit_given',
      amount: roundPrecision(totalAmount, 2),
      notes: `Bill Sale: ${saleInput.items.map((i) => `${i.productName} (${i.quantity} ${i.unit})`).join(', ')}`,
      createdAt: new Date().toISOString(),
    });
  }

  // 5. Create Sale
  const invoiceNo = `DS-${1000 + current.sales.length + 1}`;
  const paymentStatus =
    saleInput.paymentStatus ||
    (saleInput.paymentMode === 'online' ? 'manually_confirmed' : 'completed');

  const newSale: Sale = {
    id: `sale-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    invoiceNo,
    items: saleInput.items,
    totalAmount,
    paymentMode: saleInput.paymentMode,
    customerId: saleInput.customerId,
    customerName,
    createdAt: new Date().toISOString(),
    notes: saleInput.notes,
    upiId: saleInput.paymentMode === 'online' ? saleInput.upiId : undefined,
    paymentStatus,
  };

  const modeText =
    saleInput.paymentMode === 'cash'
      ? 'Cash'
      : saleInput.paymentMode === 'online'
      ? `UPI / Online (Manual Confirmation - Unverified${saleInput.upiId ? ` • ${saleInput.upiId}` : ''})`
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
        id: `act-${Date.now()}`,
        type: 'sale',
        title: `Sale Recorded (${invoiceNo})`,
        description: `₹${totalAmount} • ${modeText} • ${saleInput.items.length} items`,
        amount: totalAmount,
        timestamp: new Date().toISOString(),
      },
      ...current.activities,
    ],
  };

  saveStoreData(updatedData);
  return { success: true, sale: newSale };
}

// ---------------- UDHAAR REGISTER CRUD ----------------

export function addCustomer(customerInput: {
  name: string;
  phone: string;
  address?: string;
  initialBalance?: number;
}): { success: boolean; customer?: Customer; error?: string } {
  const current = getStoreData();

  const trimmedName = customerInput.name.trim();
  if (!trimmedName) {
    return { success: false, error: 'Customer name is required.' };
  }

  // Prevent duplicate customer names within current shop profile
  const isDuplicate = current.customers.some(
    (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (isDuplicate) {
    return { success: false, error: `Customer "${trimmedName}" already exists in this shop.` };
  }

  const rawInitBal = customerInput.initialBalance !== undefined ? Number(customerInput.initialBalance) : 0;
  if (isNaN(rawInitBal) || !isFinite(rawInitBal) || rawInitBal < 0) {
    return { success: false, error: 'Initial balance cannot be negative.' };
  }
  const cleanInitBal = roundPrecision(rawInitBal, 2);

  const newCust: Customer = {
    id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: trimmedName,
    phone: customerInput.phone.trim() || '—',
    address: customerInput.address?.trim(),
    currentBalance: cleanInitBal,
    lastTransactionAt: cleanInitBal > 0 ? new Date().toISOString() : undefined,
    createdAt: new Date().toISOString(),
  };

  const newUdhaarTx = [...current.udhaarTransactions];
  if (newCust.currentBalance > 0) {
    newUdhaarTx.unshift({
      id: `udh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerId: newCust.id,
      type: 'credit_given',
      amount: newCust.currentBalance,
      notes: 'Opening Balance',
      createdAt: new Date().toISOString(),
    });
  }

  const updatedData: DukaanStoreData = {
    ...current,
    customers: [newCust, ...current.customers],
    udhaarTransactions: newUdhaarTx,
    activities: [
      {
        id: `act-${Date.now()}`,
        type: 'product_add',
        title: 'Customer Added',
        description: `${newCust.name} (Balance: ₹${newCust.currentBalance})`,
        timestamp: new Date().toISOString(),
      },
      ...current.activities,
    ],
  };

  saveStoreData(updatedData);
  return { success: true, customer: newCust };
}

export function recordUdhaarTransaction(input: {
  customerId: string;
  type: UdhaarType;
  amount: number;
  notes?: string;
}): { success: boolean; transaction?: UdhaarTransaction; error?: string } {
  const current = getStoreData();
  const custIndex = current.customers.findIndex((c) => c.id === input.customerId);

  if (custIndex === -1) return { success: false, error: 'Customer not found.' };
  if (typeof input.amount !== 'number' || isNaN(input.amount) || !isFinite(input.amount) || input.amount <= 0) {
    return { success: false, error: 'Valid amount greater than zero is required.' };
  }

  const cleanAmount = roundPrecision(input.amount, 2);
  const existingCust = current.customers[custIndex];
  const newBalance =
    input.type === 'credit_given'
      ? roundPrecision(existingCust.currentBalance + cleanAmount, 2)
      : Math.max(0, roundPrecision(existingCust.currentBalance - cleanAmount, 2));

  const updatedCust: Customer = {
    ...existingCust,
    currentBalance: newBalance,
    lastTransactionAt: new Date().toISOString(),
  };

  const newCustomers = [...current.customers];
  newCustomers[custIndex] = updatedCust;

  const newTx: UdhaarTransaction = {
    id: `udh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    customerId: updatedCust.id,
    type: input.type,
    amount: cleanAmount,
    notes: input.notes || (input.type === 'credit_given' ? 'Credit items' : 'Cash received'),
    createdAt: new Date().toISOString(),
  };

  const isCredit = input.type === 'credit_given';
  const updatedData: DukaanStoreData = {
    ...current,
    customers: newCustomers,
    udhaarTransactions: [newTx, ...current.udhaarTransactions],
    activities: [
      {
        id: `act-${Date.now()}`,
        type: isCredit ? 'udhaar_given' : 'udhaar_received',
        title: isCredit ? 'Credit Given' : 'Payment Received',
        description: `${updatedCust.name}: ₹${cleanAmount} ${isCredit ? 'credit' : 'payment'} • Balance: ₹${updatedCust.currentBalance}`,
        amount: cleanAmount,
        timestamp: new Date().toISOString(),
      },
      ...current.activities,
    ],
  };

  saveStoreData(updatedData);
  return { success: true, transaction: newTx };
}

// ---------------- ACCURATE DAILY SALES SUMMARY CALCULATION ----------------

export function calculateDailySales(
  sales: Sale[],
  udhaarTx: UdhaarTransaction[] = [],
  targetDate: Date = new Date()
): DailySalesSummary {
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const startMs = startOfDay.getTime();

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  const endMs = endOfDay.getTime();

  const todaySales = sales.filter((s) => {
    const t = new Date(s.createdAt).getTime();
    return !isNaN(t) && t >= startMs && t <= endMs;
  });

  const grossSales = roundPrecision(todaySales.reduce((acc, s) => acc + s.totalAmount, 0), 2);
  const cashSales = roundPrecision(
    todaySales
      .filter((s) => s.paymentMode === 'cash')
      .reduce((acc, s) => acc + s.totalAmount, 0),
    2
  );
  const onlineSales = roundPrecision(
    todaySales
      .filter((s) => s.paymentMode === 'online' || (s.paymentMode as string) === 'upi')
      .reduce((acc, s) => acc + s.totalAmount, 0),
    2
  );
  const udhaarSales = roundPrecision(
    todaySales
      .filter((s) => s.paymentMode === 'udhaar')
      .reduce((acc, s) => acc + s.totalAmount, 0),
    2
  );

  // Udhaar payments received today (debt paid off by customers)
  const udhaarCollected = roundPrecision(
    udhaarTx
      .filter((tx) => {
        const t = new Date(tx.createdAt).getTime();
        return !isNaN(t) && tx.type === 'payment_received' && t >= startMs && t <= endMs;
      })
      .reduce((acc, tx) => acc + tx.amount, 0),
    2
  );

  // Actual cash in drawer today
  const totalCashInHandToday = roundPrecision(cashSales + udhaarCollected, 2);

  // Product-wise quantities sold
  const quantityMap = new Map<string, { productName: string; unit: UnitType; quantity: number; totalAmount: number }>();

  todaySales.forEach((sale) => {
    sale.items.forEach((item) => {
      const key = `${item.productId}_${item.unit}`;
      const existing = quantityMap.get(key);
      if (existing) {
        existing.quantity = roundPrecision(existing.quantity + item.quantity, 3);
        existing.totalAmount = roundPrecision(existing.totalAmount + item.totalPrice, 2);
      } else {
        quantityMap.set(key, {
          productName: item.productName,
          unit: item.unit,
          quantity: roundPrecision(item.quantity, 3),
          totalAmount: roundPrecision(item.totalPrice, 2),
        });
      }
    });
  });

  return {
    grossSales,
    completedSalesCount: todaySales.length,
    cashSales,
    onlineSales,
    upiSales: onlineSales,
    udhaarSales,
    udhaarCollected,
    totalCashInHandToday,
    cashInDrawer: totalCashInHandToday,
    productQuantitiesSold: Array.from(quantityMap.values()),
  };
}
