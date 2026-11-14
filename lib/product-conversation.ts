import type {
  Product,
  UnitType,
  ProductConversationState,
  ProductConversationStep,
  ParsedProductItem,
} from '../types';
import { generateInternalSku } from './storage.ts';

// Trigger phrases for starting conversational product onboarding
const ONBOARDING_TRIGGERS = [
  'naya product',
  'naya saman',
  'naya maal',
  'new product',
  'add product',
  'product add',
  'saman add',
  'item add',
  'shirt ka stock',
  't-shirt',
  'tshirt',
  'inventory mein add',
  'nayi item',
  'product banana',
  'naya item',
  'maal add',
  'stock add karna',
];

export function isProductOnboardingTrigger(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  return ONBOARDING_TRIGGERS.some((trig) => lower.includes(trig));
}

// Helper to extract a number from string (including negative numbers)
function extractNumber(text: string): number | null {
  const match = text.match(/(?:₹|rs\.?|inr)?\s*(-?[0-9]+(?:\.[0-9]+)?)/i);
  if (!match) return null;
  const val = parseFloat(match[1]);
  return isNaN(val) ? null : val;
}

// Helper to extract sizes from string (S, M, L, XL, XXL, 28, 30, 32, 34, 36, etc.) preserving order of appearance
function extractSizes(text: string): string[] {
  const upper = text.toUpperCase();
  const candidates = ['XXL', 'XL', 'XS', 'S', 'M', 'L'];
  const matches: Array<{ size: string; index: number }> = [];

  for (const s of candidates) {
    const regex = new RegExp(`\\b${s}\\b`, 'g');
    let m;
    while ((m = regex.exec(upper)) !== null) {
      matches.push({ size: s, index: m.index });
    }
  }

  const numberRegex = /\b(2[89]|3[02468]|4[024])\b/g;
  let numMatch;
  while ((numMatch = numberRegex.exec(text)) !== null) {
    matches.push({ size: numMatch[1], index: numMatch.index });
  }

  matches.sort((a, b) => a.index - b.index);

  const result: string[] = [];
  for (const item of matches) {
    if (!result.includes(item.size)) {
      result.push(item.size);
    }
  }
  return result;
}

// Helper to extract colors from string
function extractColors(text: string): string[] {
  const colorMap: Record<string, string> = {
    red: 'Red',
    lal: 'Red',
    blue: 'Blue',
    neela: 'Blue',
    black: 'Black',
    kala: 'Black',
    white: 'White',
    safed: 'White',
    green: 'Green',
    hara: 'Green',
    yellow: 'Yellow',
    peela: 'Yellow',
    navy: 'Navy Blue',
    grey: 'Grey',
    gray: 'Grey',
    brown: 'Brown',
  };

  const lower = text.toLowerCase();
  const colors: string[] = [];
  for (const [key, val] of Object.entries(colorMap)) {
    if (new RegExp(`\\b${key}\\b`).test(lower) && !colors.includes(val)) {
      colors.push(val);
    }
  }
  return colors;
}

// Helper to extract unit
function extractUnit(text: string): UnitType {
  const lower = text.toLowerCase();
  if (/\b(kg|kilo|kilos|kilogram)\b/.test(lower)) return 'kg';
  if (/\b(gm|g|gram|grams)\b/.test(lower)) return 'gm';
  if (/\b(litre|ltr|liter|litres)\b/.test(lower)) return 'litre';
  if (/\b(ml|milli)\b/.test(lower)) return 'ml';
  if (/\b(packet|pkt|pack|packets)\b/.test(lower)) return 'packet';
  if (/\b(piece|pc|pcs|peice|nag)\b/.test(lower)) return 'piece';
  if (/\b(bottle|bottles)\b/.test(lower)) return 'bottle';
  if (/\b(box|boxes)\b/.test(lower)) return 'box';
  if (/\b(strip|strips)\b/.test(lower)) return 'strip';
  if (/\b(tablet|tablets)\b/.test(lower)) return 'tablet';
  if (/\b(pair|pairs|jodi)\b/.test(lower)) return 'pair';
  return 'piece';
}

/**
 * Initializes a new conversational product onboarding state.
 */
export function startProductConversation(
  initialText: string,
  existingProducts: Product[],
  businessType?: string
): {
  state: ProductConversationState;
  aiReply: string;
  quickReplies?: string[];
} {
  const lower = initialText.toLowerCase().trim();

  // Try to pre-extract details if provided in initial command
  let detectedName: string | undefined;
  let detectedQty: number | undefined;
  let detectedUnit: UnitType | undefined;
  let detectedPrice: number | undefined;

  // Pattern like: "Add 20 kg rice" or "20 kg chawal add karo"
  const qtyUnitMatch = lower.match(/(\d+(?:\.\d+)?)\s*(kg|kilo|litre|ltr|packet|piece|gm|gram)\s+([a-zA-Z0-9\s]+)/i);
  if (qtyUnitMatch) {
    detectedQty = parseFloat(qtyUnitMatch[1]);
    detectedUnit = extractUnit(qtyUnitMatch[2]);
    const rawProd = qtyUnitMatch[3].replace(/(add|karo|bhav|price|mein|inventory).*/i, '').trim();
    if (rawProd) detectedName = rawProd.charAt(0).toUpperCase() + rawProd.slice(1);
  }

  // Look for specific mentions like "shirt", "t-shirt", "jeans"
  if (!detectedName) {
    if (lower.includes('t-shirt') || lower.includes('tshirt')) {
      detectedName = 'T-Shirt';
    } else if (lower.includes('shirt')) {
      detectedName = 'Shirt';
    } else if (lower.includes('jeans')) {
      detectedName = 'Denim Jeans';
    } else if (lower.includes('rice') || lower.includes('chawal')) {
      detectedName = 'Rice (चावल)';
    }
  }

  // Check if there is an existing product with this name
  let existingMatch: Product | undefined;
  if (detectedName) {
    existingMatch = existingProducts.find(
      (p) =>
        p.name.toLowerCase().includes(detectedName!.toLowerCase()) ||
        (p.hindiName && p.hindiName.toLowerCase().includes(detectedName!.toLowerCase()))
    );
  }

  // Determine initial step
  let initialStep: ProductConversationStep = 'ask_name';
  let initialReply = 'नमस्ते! कौन सा नया सामान जोड़ना है? सामान का नाम बताइए (जैसे: T-Shirt, बासमती चावल, Paracetamol आदि)।';
  let quickReplies: string[] = ['T-Shirt', 'बासमती चावल', 'जींस', 'फॉर्च्यून तेल', 'रद्द करें'];

  if (existingMatch) {
    initialStep = 'ask_stock';
    initialReply = `दुकान में '${existingMatch.name}' पहले से मौजूद है (उपलब्ध स्टॉक: ${existingMatch.currentStock ?? 0} ${existingMatch.unit})। क्या आप इसका स्टॉक बढ़ाना चाहते हैं या नया सामान/वेरिएंट बनाना चाहते हैं?`;
    quickReplies = ['स्टॉक बढ़ाएं', 'नया सामान बनाएं', 'रद्द करें'];
  } else if (detectedName) {
    // If name is already detected, check category / variants
    const isClothing =
      businessType === 'clothing' ||
      /\b(shirt|t-shirt|tshirt|jeans|pant|kurti|saree|jacket|suit|shoes|chappal)\b/i.test(detectedName);

    if (isClothing) {
      initialStep = 'ask_variants';
      initialReply = `'${detectedName}' के लिए साइज (Size) और रंग (Color) बताइए (जैसे: M, L, XL या Blue, Black)। अलग-अलग साइज का अलग स्टॉक भी रख सकते हैं।`;
      quickReplies = ['M', 'L', 'XL', 'Free Size', 'Skip'];
    } else {
      initialStep = 'ask_price';
      initialReply = `'${detectedName}' का बेचने का भाव (Selling Price) क्या होगा? (₹ प्रति ${detectedUnit || 'यूनिट'})`;
      quickReplies = ['₹50', '₹100', '₹200', '₹500'];
    }
  }

  const state: ProductConversationState = {
    isActive: true,
    step: initialStep,
    draft: {
      name: detectedName,
      unit: detectedUnit || 'piece',
      openingStock: detectedQty,
      sellingPrice: detectedPrice,
      isVariantProduct: businessType === 'clothing' || detectedName?.toLowerCase().includes('shirt'),
      minStockAlert: 5,
    },
    history: [
      { role: 'user', text: initialText, timestamp: new Date().toISOString() },
      { role: 'ai', text: initialReply, timestamp: new Date().toISOString() },
    ],
    existingProductMatch: existingMatch,
  };

  return { state, aiReply: initialReply, quickReplies };
}

/**
 * Handles a single conversation turn in the multi-turn product onboarding state machine.
 */
export function processProductConversationTurn(
  currentState: ProductConversationState,
  userMessage: string,
  existingProducts: Product[],
  businessType?: string
): {
  nextState: ProductConversationState;
  aiReply: string;
  quickReplies?: string[];
  isCancelled?: boolean;
} {
  const msg = userMessage.trim();
  const lower = msg.toLowerCase();

  // 1. Cancellation check
  if (
    lower === 'cancel' ||
    lower === 'roko' ||
    lower === 'band karo' ||
    lower === 'chhodo' ||
    lower === 'nahi chahiye' ||
    lower === 'hatao' ||
    lower === 'रद्द करें'
  ) {
    return {
      nextState: { ...currentState, isActive: false, step: 'idle' },
      aiReply: 'सामान जोड़ने की प्रक्रिया रद्द कर दी गई है। इन्वेंटरी में कोई बदलाव नहीं किया गया।',
      isCancelled: true,
    };
  }

  const draft = { ...currentState.draft };
  let step = currentState.step;
  let reply = '';
  let quickReplies: string[] | undefined;

  // 2. Direct corrections at any step (e.g. "Price 350 kar do", "Stock 20")
  if (lower.includes('price') || lower.includes('bhav') || lower.includes('rate') || lower.includes('मूल्य')) {
    const num = extractNumber(msg);
    if (num !== null && num > 0) {
      draft.sellingPrice = num;
      reply += `बिक्री मूल्य ₹${num} सेट कर दिया गया है। `;
    }
  }

  if (lower.includes('stock') || lower.includes('quantity') || lower.includes('मात्रा')) {
    const num = extractNumber(msg);
    if (num !== null && num >= 0) {
      draft.openingStock = num;
      reply += `स्टॉक ${num} ${draft.unit || 'piece'} सेट कर दिया गया है। `;
    }
  }

  // 3. Step-by-step state machine transitions
  if (step === 'ask_name') {
    draft.name = msg.replace(/(add|karo|karna hai|naya|product)/gi, '').trim();
    if (!draft.name) draft.name = msg;

    // Check existing match
    const existing = existingProducts.find(
      (p) =>
        p.name.toLowerCase() === draft.name!.toLowerCase() ||
        (p.hindiName && p.hindiName.toLowerCase() === draft.name!.toLowerCase())
    );

    if (existing) {
      step = 'ask_stock';
      reply = `'${existing.name}' दुकान में पहले से है (स्टॉक: ${existing.currentStock ?? 0} ${existing.unit})। क्या आप स्टॉक बढ़ाना चाहते हैं या नया सामान बनाना चाहते हैं?`;
      quickReplies = ['स्टॉक बढ़ाएं', 'नया सामान बनाएं', 'रद्द करें'];
      currentState.existingProductMatch = existing;
    } else {
      const isClothing =
        businessType === 'clothing' ||
        /\b(shirt|t-shirt|tshirt|jeans|pant|kurti|saree|jacket|suit|shoes|chappal)\b/i.test(draft.name);

      draft.category = isClothing ? 'Clothing / Garments' : draft.category || 'General';

      if (isClothing) {
        step = 'ask_variants';
        reply = `'${draft.name}' के लिए साइज (Size) और रंग (Color) बताइए (जैसे: M, L, XL या 32, 34)। अलग-अलग साइज का अलग स्टॉक रख सकते हैं।`;
        quickReplies = ['M, L, XL', 'S, M, L', '32, 34, 36', 'Free Size', 'Skip'];
      } else {
        step = 'ask_price';
        reply = `'${draft.name}' का बेचने का भाव (Selling Price) क्या होगा? (₹ में)`;
        quickReplies = ['₹50', '₹100', '₹200', '₹500'];
      }
    }
  } else if (step === 'ask_variants') {
    if (lower === 'skip' || lower === 'chhodo' || lower === 'बाद में') {
      step = 'ask_price';
      reply = `'${draft.name}' का बेचने का भाव (Selling Price) क्या होगा? (₹ में)`;
      quickReplies = ['₹150', '₹350', '₹500', '₹999'];
    } else {
      const sizes = extractSizes(msg);
      const colors = extractColors(msg);
      draft.sizes = sizes.length > 0 ? sizes : [msg.trim()];
      draft.colors = colors;

      // Create draft variants if multiple sizes found
      if (sizes.length > 1) {
        draft.variantDrafts = sizes.map((s) => ({
          size: s,
          color: colors[0],
          stock: 5, // default stock per variant
          sku: generateInternalSku(draft.name || 'PROD', s),
        }));
      }

      step = 'ask_price';
      reply = `साइज (${draft.sizes.join(', ')})${colors.length > 0 ? ` और रंग (${colors.join(', ')})` : ''} दर्ज किया गया। अब इसका बेचने का भाव (Selling Price) बताइए (₹ में):`;
      quickReplies = ['₹250', '₹350', '₹500', '₹800'];
    }
  } else if (step === 'ask_price') {
    const num = extractNumber(msg);
    if (num === null || num <= 0) {
      reply = 'कृपया सही भाव दर्ज करें (जैसे ₹350 या सिर्फ 350)। मूल्य 0 से अधिक होना चाहिए:';
      quickReplies = ['₹100', '₹250', '₹500'];
    } else {
      draft.sellingPrice = num;
      // If variant drafts exist, assign price
      if (draft.variantDrafts) {
        draft.variantDrafts.forEach((v) => (v.sellingPrice = num));
      }

      if (draft.openingStock === undefined || draft.openingStock === null) {
        step = 'ask_stock';
        reply = `बेचने का भाव ₹${num} सेट हो गया। दुकान में अभी कितना स्टॉक उपलब्ध है? (जैसे: 20 piece, 10 kg):`;
        quickReplies = ['10 piece', '20 piece', '50 piece', '10 kg', '25 kg'];
      } else {
        step = 'ask_purchase_price';
        reply = `बिक्री मूल्य ₹${num} सेट हो गया। क्या आप खरीद रेट (Purchase Price) भी जोड़ना चाहते हैं? (ऑप्शनल है, छोड़ सकते हैं):`;
        quickReplies = ['Skip', '₹200', '₹300', '₹400'];
      }
    }
  } else if (step === 'ask_stock') {
    // If user clicked "स्टॉक बढ़ाएं" for existing product
    if (lower === 'स्टॉक बढ़ाएं' || lower.includes('stock badhao') || lower.includes('badhana')) {
      currentState.isUpdatingStock = true;
      reply = `कितना स्टॉक जोड़ना है? (जैसे: 10 ${currentState.existingProductMatch?.unit || 'piece'}):`;
      quickReplies = ['5', '10', '20', '50'];
    } else {
      const num = extractNumber(msg);
      if (num === null || num < 0) {
        reply = 'कृपया सही स्टॉक मात्रा दर्ज करें (जैसे 10 या 25):';
        quickReplies = ['10', '20', '50'];
      } else {
        draft.openingStock = num;
        draft.unit = extractUnit(msg);

        // If multiple variants exist, distribute evenly or set per variant
        if (draft.variantDrafts && draft.variantDrafts.length > 0) {
          draft.variantDrafts.forEach((v) => {
            v.stock = num;
          });
        }

        if (draft.sellingPrice === undefined || draft.sellingPrice === null) {
          step = 'ask_price';
          reply = `स्टॉक ${num} ${draft.unit} दर्ज हो गया। अब बेचने का भाव (Selling Price) बताइए (₹ में):`;
          quickReplies = ['₹50', '₹100', '₹200', '₹500'];
        } else {
          step = 'ask_purchase_price';
          reply = `स्टॉक ${num} ${draft.unit} दर्ज हो गया। क्या आप खरीद रेट (Purchase Price) जोड़ना चाहते हैं? (ऑप्शनल है):`;
          quickReplies = ['Skip', '₹200', '₹300'];
        }
      }
    }
  } else if (step === 'ask_purchase_price') {
    if (lower === 'skip' || lower === 'chhodo' || lower === 'बाद में') {
      draft.purchasePrice = undefined;
    } else {
      const num = extractNumber(msg);
      if (num !== null && num >= 0) {
        draft.purchasePrice = num;
      }
    }
    step = 'ask_barcode_sku';
    reply = 'क्या सामान का बारकोड या SKU जोड़ना है? (आप "Auto Generate" चुन सकते हैं या बारकोड नंबर टाइप कर सकते हैं):';
    quickReplies = ['Auto Generate SKU', 'Skip', 'बारकोड स्कैन करें'];
  } else if (step === 'ask_barcode_sku') {
    if (lower.includes('auto') || lower.includes('generate')) {
      draft.sku = generateInternalSku(draft.name || 'PROD');
      reply = `SKU ऑटो-जेनरेट हो गया: ${draft.sku}। `;
    } else if (lower !== 'skip' && lower !== 'chhodo' && lower !== 'बाद में') {
      // User entered barcode / SKU
      draft.barcode = msg.replace(/\s+/g, '');
      reply = `बारकोड ${draft.barcode} दर्ज हो गया। `;
    }

    step = 'ready_for_confirmation';
    reply += 'नए सामान की पूरी जानकारी तैयार है! कृपया नीचे प्रीव्यू कार्ड में विवरण जांचकर "Confirm & Save" बटन दबाएं।';
    quickReplies = ['Confirm & Save', 'Price बदलें', 'Stock बदलें', 'रद्द करें'];
  }

  // Explicit confirmation intent shortcut
  if (
    lower.includes('confirm') ||
    lower.includes('save karo') ||
    lower.includes('ho gaya') ||
    lower.includes('ready')
  ) {
    if (
      draft.name &&
      draft.sellingPrice !== undefined &&
      draft.sellingPrice > 0 &&
      draft.openingStock !== undefined &&
      draft.openingStock >= 0
    ) {
      step = 'ready_for_confirmation';
      reply = `शानदार! '${draft.name}' की पूरी जानकारी तैयार है। कृपया नीचे प्रीव्यू देखकर 'Confirm & Save' दबाएं।`;
      quickReplies = ['Confirm & Save', 'Price बदलें', 'Stock बदलें', 'रद्द करें'];
    }
  }

  const nextState: ProductConversationState = {
    ...currentState,
    step,
    draft,
    history: [
      ...currentState.history,
      { role: 'user', text: userMessage, timestamp: new Date().toISOString() },
      { role: 'ai', text: reply, timestamp: new Date().toISOString() },
    ],
  };

  return { nextState, aiReply: reply, quickReplies };
}

/**
 * Converts a finalized product draft into concrete ParsedProductItem records.
 * Generates separate inventory records for clothing/footwear size/color variants.
 */
export function convertDraftToProducts(draft: ProductConversationState['draft']): ParsedProductItem[] {
  if (!draft.name) return [];

  // If multi-variant drafts exist (e.g. Size M, Size L), create separate inventory items
  if (draft.variantDrafts && draft.variantDrafts.length > 0) {
    return draft.variantDrafts.map((variant) => {
      const variantSuffix = [variant.size, variant.color].filter(Boolean).join(' ');
      const fullName = variantSuffix ? `${draft.name} (${variantSuffix})` : draft.name!;
      const sku = variant.sku || generateInternalSku(draft.name!, variant.size);

      return {
        name: fullName,
        brandOrVariant: variantSuffix || draft.brand,
        category: draft.category || 'Clothing / Garments',
        unit: draft.unit || 'piece',
        openingStock: variant.stock,
        sellingPrice: variant.sellingPrice ?? draft.sellingPrice,
        purchasePrice: variant.purchasePrice ?? draft.purchasePrice,
        minStockAlert: draft.minStockAlert || 5,
        sku,
        barcode: variant.barcode || draft.barcode,
        size: variant.size,
        color: variant.color,
      };
    });
  }

  // Single product item
  const sku = draft.sku || generateInternalSku(draft.name);
  return [
    {
      name: draft.name,
      brandOrVariant: draft.brand,
      category: draft.category || 'General',
      unit: draft.unit || 'piece',
      openingStock: draft.openingStock ?? null,
      sellingPrice: draft.sellingPrice ?? null,
      purchasePrice: draft.purchasePrice ?? null,
      minStockAlert: draft.minStockAlert || 5,
      sku,
      barcode: draft.barcode,
      size: draft.sizes?.[0],
      color: draft.colors?.[0],
    },
  ];
}
