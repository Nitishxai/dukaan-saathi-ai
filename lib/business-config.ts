import { ShopProfile } from '../types';

export interface BusinessTypeDefinition {
  id: string;
  title: string;
  hindiTitle: string;
  shortLabel: string;
  description: string;
  iconName: string;
  categories: string[];
  units: string[];
  defaultUnit: string;
  placeholders: {
    name: string;
    brandOrVariant: string;
  };
  extraFields?: {
    showBatchExpiry?: boolean;
    showSizeColor?: boolean;
    showModelWarranty?: boolean;
    complianceDisclaimer?: string;
  };
  starterItems: Array<{ name: string; unit: string; category: string }>;
}

export const BUSINESS_TYPES: BusinessTypeDefinition[] = [
  {
    id: 'kirana',
    title: 'Kirana / Grocery Store',
    hindiTitle: 'किराना / राशन स्टोर',
    shortLabel: 'Kirana',
    description: 'Food grains, pulses, spices, oils, packaged snacks, and daily household groceries.',
    iconName: 'ShoppingBag',
    categories: [
      'Grains & Flour',
      'Pulses',
      'Rice',
      'Oil & Ghee',
      'Spices',
      'Snacks',
      'Beverages',
      'Dairy',
      'Household Items',
    ],
    units: ['kg', 'g', 'litre', 'ml', 'piece', 'packet', 'bag'],
    defaultUnit: 'kg',
    placeholders: {
      name: 'e.g. Sugar M-30, Aashirvaad Atta, Tata Salt',
      brandOrVariant: 'e.g. 5kg Packet, 1L Pouch, Regular',
    },
    starterItems: [
      { name: 'Sugar', unit: 'kg', category: 'Grains & Flour' },
      { name: 'Atta / Wheat Flour', unit: 'kg', category: 'Grains & Flour' },
      { name: 'Basmati Rice', unit: 'kg', category: 'Rice' },
      { name: 'Mustard Oil', unit: 'litre', category: 'Oil & Ghee' },
      { name: 'Tata Salt', unit: 'packet', category: 'Spices' },
      { name: 'Toor Dal', unit: 'kg', category: 'Pulses' },
      { name: 'Maggi Noodles', unit: 'packet', category: 'Snacks' },
      { name: 'Tea Leaves', unit: 'packet', category: 'Beverages' },
    ],
  },
  {
    id: 'pharmacy',
    title: 'Medical / Pharmacy',
    hindiTitle: 'दवा दुकान / मेडिकल स्टोर',
    shortLabel: 'Medical / Pharmacy',
    description: 'Prescription medicines, OTC drugs, healthcare supplements, and first aid supplies.',
    iconName: 'Activity',
    categories: [
      'Medicines',
      'First Aid',
      'Personal Care',
      'Medical Devices',
      'Supplements',
    ],
    units: ['piece', 'strip', 'tablet', 'bottle', 'box', 'pack'],
    defaultUnit: 'strip',
    placeholders: {
      name: 'e.g. Paracetamol 500mg, Dettol Antiseptic, Vicks VapoRub',
      brandOrVariant: 'e.g. Cipla, 10 Tablets, 100ml Bottle',
    },
    extraFields: {
      showBatchExpiry: true,
      complianceDisclaimer:
        'Notice: Dukaan Sathi AI assists with retail inventory and sales. It is not a substitute for statutory pharmacy compliance, drug inspection mandates, or prescription registers.',
    },
    starterItems: [
      { name: 'Paracetamol 500mg Tablets', unit: 'strip', category: 'Medicines' },
      { name: 'Antiseptic Liquid (100ml)', unit: 'bottle', category: 'First Aid' },
      { name: 'Adhesive Bandages (Band-Aid)', unit: 'box', category: 'First Aid' },
      { name: 'Cough Syrup (100ml)', unit: 'bottle', category: 'Medicines' },
      { name: 'Vitamin C 500mg Chewable', unit: 'strip', category: 'Supplements' },
      { name: 'ORS Energy Sachets', unit: 'pack', category: 'Supplements' },
      { name: 'Digital Thermometer', unit: 'piece', category: 'Medical Devices' },
      { name: 'Cotton Roll (100g)', unit: 'pack', category: 'First Aid' },
    ],
  },
  {
    id: 'clothing',
    title: 'Clothing / Garments',
    hindiTitle: 'कपड़े और गारमेंट्स स्टोर',
    shortLabel: 'Clothing',
    description: 'Men’s, women’s, and children’s apparel, ethnic wear, footwear, and fashion accessories.',
    iconName: 'Shirt',
    categories: [
      "Men's Wear",
      "Women's Wear",
      "Kids' Wear",
      'Footwear',
      'Accessories',
    ],
    units: ['piece', 'pair', 'set'],
    defaultUnit: 'piece',
    placeholders: {
      name: 'e.g. Cotton Casual Shirt, Denim Jeans, Cotton Saree',
      brandOrVariant: 'e.g. Slim Fit, Regular, Embroidered',
    },
    extraFields: {
      showSizeColor: true,
    },
    starterItems: [
      { name: 'Men Cotton Casual Shirt', unit: 'piece', category: "Men's Wear" },
      { name: 'Denim Jeans (Regular Fit)', unit: 'piece', category: "Men's Wear" },
      { name: 'Women Cotton Kurti', unit: 'piece', category: "Women's Wear" },
      { name: 'Printed Silk Saree', unit: 'piece', category: "Women's Wear" },
      { name: 'Kids T-Shirt & Shorts Set', unit: 'set', category: "Kids' Wear" },
      { name: 'Casual Sports Shoes', unit: 'pair', category: 'Footwear' },
      { name: 'Leather Belt', unit: 'piece', category: 'Accessories' },
      { name: 'Cotton Ankle Socks', unit: 'pair', category: 'Accessories' },
    ],
  },
  {
    id: 'electronics',
    title: 'Electronics',
    hindiTitle: 'इलेक्ट्रॉनिक्स स्टोर',
    shortLabel: 'Electronics',
    description: 'Home appliances, lighting, consumer electronics, computer peripherals, and power accessories.',
    iconName: 'Tv',
    categories: [
      'Appliances',
      'Audio',
      'Cables & Adapters',
      'Computer & TV',
      'Accessories',
      'Components',
    ],
    units: ['piece', 'box', 'set'],
    defaultUnit: 'piece',
    placeholders: {
      name: 'e.g. LED Bulb 9W, Wireless Mouse, Power Strip 4-Way',
      brandOrVariant: 'e.g. Philips B22, Logitech, Havells',
    },
    extraFields: {
      showModelWarranty: true,
    },
    starterItems: [
      { name: 'LED Bulb 9W Cool Day White', unit: 'piece', category: 'Appliances' },
      { name: 'Surge Protector 4-Socket Board', unit: 'piece', category: 'Cables & Adapters' },
      { name: 'Wireless Optical Mouse', unit: 'piece', category: 'Computer & TV' },
      { name: 'HDMI Cable 1.5m High Speed', unit: 'piece', category: 'Cables & Adapters' },
      { name: 'Portable Bluetooth Speaker', unit: 'piece', category: 'Audio' },
      { name: 'AAA Alkaline Batteries (Pack of 4)', unit: 'box', category: 'Accessories' },
    ],
  },
  {
    id: 'mobile_accessories',
    title: 'Mobile Accessories',
    hindiTitle: 'मोबाइल और एक्सेसरीज शॉप',
    shortLabel: 'Mobile & Acc.',
    description: 'Smartphones, fast chargers, tempered glass, back covers, TWS earbuds, and cables.',
    iconName: 'Smartphone',
    categories: [
      'Mobiles',
      'Chargers',
      'Cables',
      'Audio',
      'Accessories',
      'Components',
    ],
    units: ['piece', 'box', 'set'],
    defaultUnit: 'piece',
    placeholders: {
      name: 'e.g. 33W Fast Charger, Type-C Braided Cable, Earbuds',
      brandOrVariant: 'e.g. Boat Airdopes, 65W Dart, 9H Hardness',
    },
    extraFields: {
      showModelWarranty: true,
    },
    starterItems: [
      { name: 'Type-C to Type-C 65W Fast Cable', unit: 'piece', category: 'Cables' },
      { name: '33W Super Fast USB-C Wall Adapter', unit: 'piece', category: 'Chargers' },
      { name: 'Edge-to-Edge 9D Tempered Glass', unit: 'piece', category: 'Accessories' },
      { name: 'Transparent Anti-Shock Phone Cover', unit: 'piece', category: 'Accessories' },
      { name: 'True Wireless Stereo (TWS) Earbuds', unit: 'piece', category: 'Audio' },
      { name: '10,000 mAh Slim Power Bank', unit: 'piece', category: 'Accessories' },
      { name: 'Metallic OTG Adapter (Type-C to USB)', unit: 'piece', category: 'Components' },
    ],
  },
  {
    id: 'cosmetics',
    title: 'Cosmetics / Beauty Store',
    hindiTitle: 'कॉस्मेटिक्स और ब्यूटी स्टोर',
    shortLabel: 'Cosmetics',
    description: 'Skincare, hair care, personal grooming, perfumes, and decorative cosmetics.',
    iconName: 'Sparkles',
    categories: [
      'Skincare',
      'Haircare',
      'Makeup',
      'Fragrances',
      'Personal Hygiene',
    ],
    units: ['piece', 'bottle', 'tube', 'pack', 'box'],
    defaultUnit: 'piece',
    placeholders: {
      name: 'e.g. Daily Moisturizing Cream, Matte Liquid Lipstick, Sunscreen',
      brandOrVariant: 'e.g. 50ml, Shade 04, SPF 50',
    },
    starterItems: [
      { name: 'Daily Nourishing Face Cream (50g)', unit: 'piece', category: 'Skincare' },
      { name: 'UV Protection Sunscreen SPF 50 (100ml)', unit: 'tube', category: 'Skincare' },
      { name: 'Herbal Anti-Dandruff Shampoo (200ml)', unit: 'bottle', category: 'Haircare' },
      { name: 'Matte Finish Waterproof Lipstick', unit: 'piece', category: 'Makeup' },
      { name: 'Long Lasting Pocket Perfume (20ml)', unit: 'bottle', category: 'Fragrances' },
      { name: 'Gentle Foaming Face Wash (100ml)', unit: 'tube', category: 'Personal Hygiene' },
    ],
  },
  {
    id: 'hardware',
    title: 'Hardware / Building Materials',
    hindiTitle: 'हार्डवेयर और सैनिटरी स्टोर',
    shortLabel: 'Hardware',
    description: 'Tools, plumbing fittings, electrical switches, paints, fasteners, and construction materials.',
    iconName: 'Wrench',
    categories: [
      'Tools',
      'Fasteners',
      'Paints',
      'Plumbing',
      'Electrical',
      'Building Supplies',
    ],
    units: ['piece', 'kg', 'metre', 'packet', 'box', 'can'],
    defaultUnit: 'piece',
    placeholders: {
      name: 'e.g. Stainless Steel Screws 2-inch, Enamel Gloss Paint, PVC Ball Valve',
      brandOrVariant: 'e.g. Asian Paints 1L, Supreme 1-inch, Heavy Duty',
    },
    starterItems: [
      { name: 'Drywall Screws 1.5-inch (Box of 100)', unit: 'box', category: 'Fasteners' },
      { name: 'White Enamel Gloss Paint (1 Litre)', unit: 'can', category: 'Paints' },
      { name: 'CPVC Ball Valve 1-inch', unit: 'piece', category: 'Plumbing' },
      { name: 'Heavy Duty Claw Hammer', unit: 'piece', category: 'Tools' },
      { name: 'Modular 6A Light Switch', unit: 'piece', category: 'Electrical' },
      { name: 'Teflon Sealing Tape 12mm', unit: 'piece', category: 'Plumbing' },
      { name: 'Measuring Tape 5 Metre', unit: 'piece', category: 'Tools' },
    ],
  },
  {
    id: 'stationery',
    title: 'Stationery / Book Shop',
    hindiTitle: 'स्टेशनरी और किताबों की दुकान',
    shortLabel: 'Stationery',
    description: 'School notebooks, pens, exam boards, art supplies, and general office paper products.',
    iconName: 'BookOpen',
    categories: [
      'Books',
      'Notebooks',
      'Pens',
      'Art Supplies',
      'Office Supplies',
    ],
    units: ['piece', 'pack', 'box', 'set'],
    defaultUnit: 'piece',
    placeholders: {
      name: 'e.g. A4 Long Register 200 Pages, Blue Gel Pens, Acrylic Colours',
      brandOrVariant: 'e.g. Classmate, Reynolds Pack of 5, Fevicol 100g',
    },
    starterItems: [
      { name: 'A4 Ruled Register 200 Pages', unit: 'piece', category: 'Notebooks' },
      { name: 'Blue Gel Pens (Pack of 5)', unit: 'pack', category: 'Pens' },
      { name: 'Complete Mathematical Geometry Box', unit: 'set', category: 'Art Supplies' },
      { name: 'A4 Multipurpose Copy Paper (500 Sheets)', unit: 'pack', category: 'Office Supplies' },
      { name: 'Waterproof Neon Sticky Notes', unit: 'pack', category: 'Office Supplies' },
      { name: 'Synthetic Craft Glue (100ml)', unit: 'piece', category: 'Art Supplies' },
    ],
  },
  {
    id: 'dairy',
    title: 'Dairy / Milk Products',
    hindiTitle: 'डेयरी और दूध उत्पाद',
    shortLabel: 'Dairy',
    description: 'Fresh milk pouches, curd, paneer, butter, ghee, sweets, and chilled dairy beverages.',
    iconName: 'Coffee',
    categories: [
      'Milk',
      'Curd / Yogurt',
      'Paneer',
      'Butter & Ghee',
      'Sweets',
      'Ice Cream',
    ],
    units: ['litre', 'ml', 'kg', 'g', 'packet', 'piece'],
    defaultUnit: 'packet',
    placeholders: {
      name: 'e.g. Fresh Toned Milk 500ml, Malai Paneer, Salted Butter',
      brandOrVariant: 'e.g. Amul, Mother Dairy, 200g Vacuum Pack',
    },
    starterItems: [
      { name: 'Toned Milk (500ml Pouch)', unit: 'packet', category: 'Milk' },
      { name: 'Full Cream Milk (500ml Pouch)', unit: 'packet', category: 'Milk' },
      { name: 'Fresh Plain Curd / Dahi (400g)', unit: 'packet', category: 'Curd / Yogurt' },
      { name: 'Fresh Malai Paneer (200g)', unit: 'packet', category: 'Paneer' },
      { name: 'Table Salted Butter (100g)', unit: 'piece', category: 'Butter & Ghee' },
      { name: 'Pure Cow Ghee (500ml Jar)', unit: 'piece', category: 'Butter & Ghee' },
      { name: 'Sweet Mango Lassi (200ml)', unit: 'packet', category: 'Milk' },
    ],
  },
  {
    id: 'fruits_vegetables',
    title: 'Fruits & Vegetables',
    hindiTitle: 'फल और सब्जी मंडी स्टोर',
    shortLabel: 'Fruits & Veg.',
    description: 'Fresh local farm vegetables, seasonal fruits, leafy herbs, and root crops.',
    iconName: 'Apple',
    categories: [
      'Fruits',
      'Vegetables',
      'Leafy Greens',
      'Seasonal Produce',
    ],
    units: ['kg', 'g', 'piece', 'crate'],
    defaultUnit: 'kg',
    placeholders: {
      name: 'e.g. Desi Tomato, Kashmiri Apple, Fresh Spinach, Potato',
      brandOrVariant: 'e.g. Fresh Crop, Grade A, Bundle',
    },
    starterItems: [
      { name: 'Fresh Potatoes (आलू)', unit: 'kg', category: 'Vegetables' },
      { name: 'Red Onions (प्याज)', unit: 'kg', category: 'Vegetables' },
      { name: 'Desi Hybrid Tomatoes (टमाटर)', unit: 'kg', category: 'Vegetables' },
      { name: 'Fresh Green Chillies (हरी मिर्च)', unit: 'g', category: 'Vegetables' },
      { name: 'Coriander / Dhaniya Bunch (धनिया)', unit: 'piece', category: 'Leafy Greens' },
      { name: 'Fresh Kashmiri Apples (सेब)', unit: 'kg', category: 'Fruits' },
      { name: 'Ripe Bananas (केला)', unit: 'piece', category: 'Fruits' },
    ],
  },
  {
    id: 'other',
    title: 'Other / General Store',
    hindiTitle: 'अन्य / जनरल मर्चेंडाइज स्टोर',
    shortLabel: 'General Store',
    description: 'Retail products, gift shops, tailoring supplies, and assorted merchant retail items.',
    iconName: 'Store',
    categories: [
      'General Merchandise',
      'Household Items',
      'Packaged Goods',
      'Personal Care',
      'Gifts & Toys',
      'Other',
    ],
    units: ['piece', 'packet', 'box', 'kg', 'set'],
    defaultUnit: 'piece',
    placeholders: {
      name: 'e.g. Item Name, Product Description',
      brandOrVariant: 'e.g. Standard, Variant, Model',
    },
    starterItems: [
      { name: 'General Retail Item 1', unit: 'piece', category: 'General Merchandise' },
      { name: 'Packaged Household Product', unit: 'packet', category: 'Household Items' },
      { name: 'Gift Wrap Box Set', unit: 'set', category: 'Gifts & Toys' },
    ],
  },
];

/**
 * Resolves the canonical business type ID from a shop profile.
 * Falls back to keyword matching on `profile.category` for legacy profiles.
 */
export function resolveShopBusinessType(profile?: ShopProfile | null): string {
  if (!profile) return 'kirana';
  if (profile.businessType && BUSINESS_TYPES.some((b) => b.id === profile.businessType)) {
    return profile.businessType;
  }

  const cat = (profile.category || '').toLowerCase();
  if (cat.includes('pharmacy') || cat.includes('medical') || cat.includes('दवा')) return 'pharmacy';
  if (cat.includes('cloth') || cat.includes('garment') || cat.includes('कपड़े')) return 'clothing';
  if (cat.includes('mobile') || cat.includes('phone')) return 'mobile_accessories';
  if (cat.includes('electr')) return 'electronics';
  if (cat.includes('cosmetic') || cat.includes('beauty')) return 'cosmetics';
  if (cat.includes('hardware') || cat.includes('building') || cat.includes('सैनिटरी')) return 'hardware';
  if (cat.includes('stationery') || cat.includes('book') || cat.includes('किताब')) return 'stationery';
  if (cat.includes('dairy') || cat.includes('milk') || cat.includes('दूध')) return 'dairy';
  if (cat.includes('fruit') || cat.includes('veg') || cat.includes('सब्जी') || cat.includes('फल')) return 'fruits_vegetables';
  if (cat.includes('other') || cat.includes('general')) return 'other';

  return 'kirana';
}

/**
 * Returns the full business configuration for a given business type key.
 */
export function getBusinessTypeConfig(
  typeKey?: string,
  customName?: string
): BusinessTypeDefinition {
  const found = BUSINESS_TYPES.find((b) => b.id === typeKey) || BUSINESS_TYPES[0];

  if (typeKey === 'other' && customName && customName.trim()) {
    return {
      ...found,
      title: customName.trim(),
      shortLabel: customName.trim(),
    };
  }

  return found;
}

/**
 * Returns a human-friendly display label for a profile's business type.
 */
export function getEffectiveBusinessLabel(profile?: ShopProfile | null): string {
  if (!profile) return 'Kirana / Grocery Store';
  if (profile.businessType === 'other' && profile.customBusinessType?.trim()) {
    return profile.customBusinessType.trim();
  }
  const config = getBusinessTypeConfig(resolveShopBusinessType(profile));
  return config.title;
}

export function getAllBusinessTypes(): BusinessTypeDefinition[] {
  return BUSINESS_TYPES;
}

/**
 * Returns contextual stock restock adjustment deltas and buttons tailored to the unit.
 */
export function getQuickAdjustDeltas(unit?: string): {
  deltaSmall: number;
  labelSmall: string;
  deltaLarge: number;
  labelLarge: string;
} {
  const u = (unit || 'piece').toLowerCase().trim();
  if (u === 'kg') {
    return { deltaSmall: 5, labelSmall: '+5 kg', deltaLarge: 10, labelLarge: '+10 kg' };
  }
  if (u === 'g' || u === 'gm') {
    return { deltaSmall: 250, labelSmall: '+250 g', deltaLarge: 1000, labelLarge: '+1 kg' };
  }
  if (u === 'litre') {
    return { deltaSmall: 2, labelSmall: '+2 L', deltaLarge: 5, labelLarge: '+5 L' };
  }
  if (u === 'ml') {
    return { deltaSmall: 250, labelSmall: '+250 ml', deltaLarge: 500, labelLarge: '+500 ml' };
  }
  if (u === 'strip') {
    return { deltaSmall: 5, labelSmall: '+5 strips', deltaLarge: 10, labelLarge: '+10 strips' };
  }
  if (u === 'tablet') {
    return { deltaSmall: 10, labelSmall: '+10 tabs', deltaLarge: 50, labelLarge: '+50 tabs' };
  }
  if (u === 'crate') {
    return { deltaSmall: 1, labelSmall: '+1 crate', deltaLarge: 3, labelLarge: '+3 crates' };
  }
  if (u === 'bag' || u === 'bori') {
    return { deltaSmall: 1, labelSmall: '+1 bag', deltaLarge: 5, labelLarge: '+5 bags' };
  }
  if (u === 'pair') {
    return { deltaSmall: 2, labelSmall: '+2 pairs', deltaLarge: 5, labelLarge: '+5 pairs' };
  }
  if (u === 'set') {
    return { deltaSmall: 1, labelSmall: '+1 set', deltaLarge: 3, labelLarge: '+3 sets' };
  }
  if (u === 'bottle' || u === 'can' || u === 'box' || u === 'pack' || u === 'packet') {
    return { deltaSmall: 2, labelSmall: `+2 ${u}`, deltaLarge: 5, labelLarge: `+5 ${u}` };
  }
  return { deltaSmall: 2, labelSmall: `+2 ${u}`, deltaLarge: 5, labelLarge: `+5 ${u}` };
}

/**
 * Returns sensible quick quantity presets for Sales POS based on unit.
 * Discrete units use integers [1, 2, 5, 10]; continuous units use [0.5, 1, 2, 5].
 */
export function getQuickQuantityPresets(unit?: string): number[] {
  const u = (unit || 'piece').toLowerCase().trim();
  const continuous = ['kg', 'litre', 'gm', 'g', 'ml', 'metre'];
  if (continuous.includes(u)) {
    return [0.5, 1, 2, 5];
  }
  return [1, 2, 5, 10];
}

/**
 * Returns contextual variant label for product cards according to shop type.
 */
export function getVariantLabel(businessType?: string): string {
  switch (businessType) {
    case 'pharmacy':
      return 'Mfr / Form';
    case 'clothing':
      return 'Brand / Fit';
    case 'electronics':
    case 'mobile_accessories':
      return 'Brand';
    case 'fruits_vegetables':
      return 'Grade / Variety';
    case 'kirana':
      return 'Pack / Size';
    case 'cosmetics':
      return 'Brand / Volume';
    case 'hardware':
      return 'Brand / Spec';
    case 'stationery':
      return 'Brand / Type';
    case 'dairy':
      return 'Fat / Pack';
    default:
      return 'Variant';
  }
}

/**
 * Returns visual color styling based on shop type.
 */
export function getBusinessTypeTheme(businessType?: string): {
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  accentColorName: string;
} {
  switch (businessType) {
    case 'pharmacy':
      return {
        badgeBg: 'bg-purple-100',
        badgeText: 'text-purple-800',
        badgeBorder: 'border-purple-200',
        accentBg: 'bg-purple-50/70',
        accentText: 'text-purple-900',
        accentBorder: 'border-purple-100',
        accentColorName: 'purple',
      };
    case 'clothing':
      return {
        badgeBg: 'bg-indigo-100',
        badgeText: 'text-indigo-800',
        badgeBorder: 'border-indigo-200',
        accentBg: 'bg-indigo-50/70',
        accentText: 'text-indigo-900',
        accentBorder: 'border-indigo-100',
        accentColorName: 'indigo',
      };
    case 'electronics':
    case 'mobile_accessories':
      return {
        badgeBg: 'bg-sky-100',
        badgeText: 'text-sky-800',
        badgeBorder: 'border-sky-200',
        accentBg: 'bg-sky-50/70',
        accentText: 'text-sky-950',
        accentBorder: 'border-sky-100',
        accentColorName: 'sky',
      };
    case 'fruits_vegetables':
      return {
        badgeBg: 'bg-emerald-100',
        badgeText: 'text-emerald-800',
        badgeBorder: 'border-emerald-200',
        accentBg: 'bg-emerald-50/70',
        accentText: 'text-emerald-950',
        accentBorder: 'border-emerald-100',
        accentColorName: 'emerald',
      };
    case 'kirana':
      return {
        badgeBg: 'bg-amber-100',
        badgeText: 'text-amber-900',
        badgeBorder: 'border-amber-200',
        accentBg: 'bg-amber-50/70',
        accentText: 'text-amber-950',
        accentBorder: 'border-amber-100',
        accentColorName: 'amber',
      };
    default:
      return {
        badgeBg: 'bg-slate-100',
        badgeText: 'text-slate-800',
        badgeBorder: 'border-slate-200',
        accentBg: 'bg-slate-50/70',
        accentText: 'text-slate-900',
        accentBorder: 'border-slate-100',
        accentColorName: 'slate',
      };
  }
}
