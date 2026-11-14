import type {
  AIParseResult,
  Customer,
  Product,
  RestockItem,
  UnitType,
  DailySalesSummary,
  ParsedProductItem,
} from '../types';
import { getStockClassification } from './storage.ts';

// Hindi and Devanagari number word mapping
const NUMBER_WORDS: Record<string, number> = {
  ek: 1,
  do: 2,
  teen: 3,
  char: 4,
  paanch: 5,
  panch: 5,
  chhe: 6,
  che: 6,
  saat: 7,
  aath: 8,
  nau: 9,
  das: 10,
  gyarah: 11,
  barah: 12,
  terah: 13,
  chaudah: 14,
  pandrah: 15,
  solah: 16,
  satrah: 17,
  atharah: 18,
  unnees: 19,
  bees: 20,
  pachees: 25,
  pachas: 50,
  'ek sau': 100,
  sau: 100,
  derh: 1.5,
  dhai: 2.5,
  aadha: 0.5,
  // Devanagari numbers
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  पाँच: 5,
  छह: 6,
  सात: 7,
  आठ: 8,
  नौ: 9,
  दस: 10,
  ग्यारह: 11,
  बारह: 12,
  पंद्रह: 15,
  बीस: 20,
  पच्चीस: 25,
  पचास: 50,
  सौ: 100,
  डेढ़: 1.5,
  ढाई: 2.5,
  आधा: 0.5,
};

const UNIT_SYNONYMS: Record<string, UnitType> = {
  kilo: 'kg',
  kg: 'kg',
  kgs: 'kg',
  kilogram: 'kg',
  gram: 'gm',
  gm: 'gm',
  gms: 'gm',
  litre: 'litre',
  liter: 'litre',
  ltr: 'litre',
  l: 'litre',
  packet: 'packet',
  pkt: 'packet',
  packets: 'packet',
  piece: 'piece',
  pcs: 'piece',
  pc: 'piece',
  bori: 'bori',
  bora: 'bori',
  dozen: 'dozen',
  darjan: 'dozen',
  box: 'box',
  dabba: 'box',
  // Devanagari units
  किलो: 'kg',
  किलोग्राम: 'kg',
  ग्राम: 'gm',
  लीटर: 'litre',
  पैकेट: 'packet',
  पीस: 'piece',
  बोरी: 'bori',
  दर्जन: 'dozen',
  डिब्बा: 'box',
  बॉक्स: 'box',
};

/**
 * Normalizes input text for typo-tolerant, punctuation-agnostic Hindi & Hinglish processing.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[.,?!।॥;:""''“”‘’\-_()[\]{}/\\#*`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Checks whether the input query is asking about low stock or restock suggestions.
 */
export function isRestockSuggestionQuery(text: string): boolean {
  const norm = normalizeText(text);

  if (
    norm.includes('स्टॉक की कमी') ||
    norm.includes('स्टॉक कम') ||
    norm.includes('कम स्टॉक') ||
    norm.includes('क्या क्या कम') ||
    norm.includes('क्या कम') ||
    norm.includes('खत्म होने वाला') ||
    norm.includes('खत्म होने') ||
    norm.includes('खत्म हो रहा') ||
    norm.includes('माल मंगवाना') ||
    norm.includes('सामान मंगवाना') ||
    norm.includes('माल मंगाना') ||
    norm.includes('सामान मंगाना') ||
    norm.includes('मंगवाना चाहिए') ||
    norm.includes('मंगाना चाहिए') ||
    norm.includes('मंगवाना है') ||
    norm.includes('मंगाना है') ||
    norm.includes('क्या मंगवाना') ||
    norm.includes('क्या मंगाना') ||
    norm.includes('रीस्टॉक') ||
    norm.includes('रिस्टॉक') ||
    (norm.includes('कमी है') && (norm.includes('दुकान') || norm.includes('स्टॉक') || norm.includes('माल') || norm.includes('सामान'))) ||
    (norm.includes('सामान') && norm.includes('मंगवा')) ||
    (norm.includes('माल') && norm.includes('मंगवा')) ||
    (norm.includes('सामान') && norm.includes('मंगा')) ||
    (norm.includes('माल') && norm.includes('मंगा')) ||
    (norm.includes('दुकान') && norm.includes('कम है'))
  ) {
    return true;
  }

  const t = norm
    .replace(/\bdukan\b/g, 'dukaan')
    .replace(/\bsaman\b/g, 'samaan')
    .replace(/\bmal\b/g, 'maal')
    .replace(/\bchiz\b/g, 'cheez')
    .replace(/\bkhatm\b/g, 'khatam')
    .replace(/\bmangana\b/g, 'mangwana')
    .replace(/\bmangao\b/g, 'mangwana')
    .replace(/\bmangwaye\b/g, 'mangwana')
    .replace(/\bchaahiye\b/g, 'chahiye');

  if (
    t.includes('stock ki kami') ||
    t.includes('kya kya kam') ||
    t.includes('khatam hone wala') ||
    t.includes('khatam hone') ||
    t.includes('khatam ho raha') ||
    t.includes('stock kam') ||
    t.includes('kam stock') ||
    t.includes('maal kam') ||
    t.includes('samaan kam') ||
    t.includes('maal mangwana') ||
    t.includes('samaan mangwana') ||
    t.includes('mangwana chahiye') ||
    t.includes('mangwana hai') ||
    t.includes('kya mangwana') ||
    t.includes('restock') ||
    t.includes('low stock') ||
    (t.includes('kami hai') && (t.includes('dukaan') || t.includes('stock') || t.includes('maal') || t.includes('samaan'))) ||
    (t.includes('kya kam') && (t.includes('dukaan') || t.includes('stock') || t.includes('maal') || t.includes('samaan'))) ||
    (t.includes('kis cheez ka') && t.includes('kam')) ||
    (t.includes('kaun sa') && t.includes('mangw')) ||
    (t.includes('kaunsa') && t.includes('mangw')) ||
    (t.includes('kaun sa stock') && t.includes('mangw'))
  ) {
    return true;
  }

  return false;
}

/**
 * Checks whether the command is an explicit instruction to add or save inventory items.
 * e.g. "Meri dukaan mein aata, chawal, sarson tel aur biscuit bikte hain. Inko meri inventory mein save kar lo."
 * e.g. "Meri dukaan mein Maggi bhi add kar do."
 * e.g. "Aata ka opening stock 25 kilo hai aur selling price 40 rupaye kilo hai. Save kar lo."
 */
export function isInventorySaveCommand(text: string): boolean {
  const norm = normalizeText(text);

  const hasInventoryKeywords =
    norm.includes('inventory') ||
    norm.includes('इन्वेंटरी') ||
    norm.includes('इन्वेंट्री') ||
    norm.includes('bikte hain') ||
    norm.includes('bikta hai') ||
    norm.includes('बिकते हैं') ||
    norm.includes('बिकता है') ||
    norm.includes('dukaan mein') ||
    norm.includes('दुकान में') ||
    norm.includes('dukan me') ||
    norm.includes('item add') ||
    norm.includes('items add') ||
    norm.includes('samaan add') ||
    norm.includes('सामान जोड़ो');

  const hasSaveAction =
    norm.includes('save kar') ||
    norm.includes('save karo') ||
    norm.includes('save kar lo') ||
    norm.includes('सेव कर लो') ||
    norm.includes('सेव करो') ||
    norm.includes('add kar do') ||
    norm.includes('add karo') ||
    norm.includes('add kar lo') ||
    norm.includes('ऐड कर दो') ||
    norm.includes('ऐड करो') ||
    norm.includes('जोड़ दो') ||
    norm.includes('जोड़ लो') ||
    norm.includes('जोड़ो') ||
    norm.includes('दर्ज कर लो') ||
    norm.includes('दर्ज करो');

  // Direct phrases:
  if (
    norm.includes('inventory mein save') ||
    norm.includes('इन्वेंटरी में सेव') ||
    norm.includes('inventory me save') ||
    norm.includes('inventory mein add') ||
    norm.includes('इन्वेंटरी में ऐड') ||
    norm.includes('opening stock') ||
    norm.includes('ओपनिंग स्टॉक')
  ) {
    return true;
  }

  return hasInventoryKeywords && hasSaveAction;
}

/**
 * Parses products and attributes from natural voice inventory commands.
 */
export function parseInventoryItemsFromText(
  rawText: string,
  existingProducts: Product[]
): ParsedProductItem[] {
  const norm = normalizeText(rawText);

  // Check which catalog products or existing products are mentioned
  const detectedItems: ParsedProductItem[] = [];

  // Matcher keywords
  const keywordMap: Record<string, { name: string; unit: UnitType; category: string }> = {
    aata: { name: 'आटा (Atta)', unit: 'kg', category: 'राशन / अनाज' },
    atta: { name: 'आटा (Atta)', unit: 'kg', category: 'राशन / अनाज' },
    आटा: { name: 'आटा (Atta)', unit: 'kg', category: 'राशन / अनाज' },
    chawal: { name: 'चावल (Rice)', unit: 'kg', category: 'राशन / अनाज' },
    rice: { name: 'चावल (Rice)', unit: 'kg', category: 'राशन / अनाज' },
    चावल: { name: 'चावल (Rice)', unit: 'kg', category: 'राशन / अनाज' },
    sarson: { name: 'सरसों तेल (Mustard Oil)', unit: 'litre', category: 'तेल और घी' },
    'sarson tel': { name: 'सरसों तेल (Mustard Oil)', unit: 'litre', category: 'तेल और घी' },
    'mustard oil': { name: 'सरसों तेल (Mustard Oil)', unit: 'litre', category: 'तेल और घी' },
    सरसों: { name: 'सरसों तेल (Mustard Oil)', unit: 'litre', category: 'तेल और घी' },
    'सरसों तेल': { name: 'सरसों तेल (Mustard Oil)', unit: 'litre', category: 'तेल और घी' },
    biscuit: { name: 'बिस्कुट (Biscuits)', unit: 'packet', category: 'स्नैक्स / पैकेट' },
    biscuits: { name: 'बिस्कुट (Biscuits)', unit: 'packet', category: 'स्नैक्स / पैकेट' },
    बिस्कुट: { name: 'बिस्कुट (Biscuits)', unit: 'packet', category: 'स्नैक्स / पैकेट' },
    बिस्किट: { name: 'बिस्कुट (Biscuits)', unit: 'packet', category: 'स्नैक्स / पैकेट' },
    chini: { name: 'चीनी (Sugar)', unit: 'kg', category: 'राशन / अनाज' },
    cheeni: { name: 'चीनी (Sugar)', unit: 'kg', category: 'राशन / अनाज' },
    sugar: { name: 'चीनी (Sugar)', unit: 'kg', category: 'राशन / अनाज' },
    चीनी: { name: 'चीनी (Sugar)', unit: 'kg', category: 'राशन / अनाज' },
    maggi: { name: 'मैगी (Maggi)', unit: 'packet', category: 'स्नैक्स / पैकेट' },
    maggie: { name: 'मैगी (Maggi)', unit: 'packet', category: 'स्नैक्स / पैकेट' },
    मैगी: { name: 'मैगी (Maggi)', unit: 'packet', category: 'स्नैक्स / पैकेट' },
    chai: { name: 'चाय पत्ती (Tea)', unit: 'packet', category: 'चाय / कॉफी' },
    tea: { name: 'चाय पत्ती (Tea)', unit: 'packet', category: 'चाय / कॉफी' },
    चाय: { name: 'चाय पत्ती (Tea)', unit: 'packet', category: 'चाय / कॉफी' },
    'चाय पत्ती': { name: 'चाय पत्ती (Tea)', unit: 'packet', category: 'चाय / कॉफी' },
    namak: { name: 'नमक (Salt)', unit: 'packet', category: 'राशन / मसाले' },
    salt: { name: 'नमक (Salt)', unit: 'packet', category: 'राशन / मसाले' },
    नमक: { name: 'नमक (Salt)', unit: 'packet', category: 'राशन / मसाले' },
    doodh: { name: 'दूध (Milk)', unit: 'packet', category: 'डेयरी उत्पाद' },
    milk: { name: 'दूध (Milk)', unit: 'packet', category: 'डेयरी उत्पाद' },
    दूध: { name: 'दूध (Milk)', unit: 'packet', category: 'डेयरी उत्पाद' },
    dal: { name: 'दाल (Dal)', unit: 'kg', category: 'दालें / राशन' },
    daal: { name: 'दाल (Dal)', unit: 'kg', category: 'दालें / राशन' },
    दाल: { name: 'दाल (Dal)', unit: 'kg', category: 'दालें / राशन' },
  };

  // Check matching against keywordMap with word boundaries to avoid substring false positives (e.g. "price" matching "rice")
  const normWords = norm.split(/\s+/);
  for (const [key, itemInfo] of Object.entries(keywordMap)) {
    const keyLower = key.toLowerCase();
    const keyWords = keyLower.split(/\s+/);
    const matches =
      keyWords.length === 1
        ? normWords.includes(keyWords[0])
        : norm.includes(keyLower);

    if (matches) {
      if (!detectedItems.some((d) => d.name === itemInfo.name)) {
        detectedItems.push({
          name: itemInfo.name,
          category: itemInfo.category,
          unit: itemInfo.unit,
          openingStock: null,
          sellingPrice: null,
          purchasePrice: null,
          minStockAlert: 5,
        });
      }
    }
  }

  // Also check existing products in store
  for (const ep of existingProducts) {
    const epNorm = normalizeText(ep.name);
    if (norm.includes(epNorm) || (ep.hindiName && norm.includes(normalizeText(ep.hindiName)))) {
      const already = detectedItems.find((d) => d.name === ep.name);
      if (!already) {
        detectedItems.push({
          name: ep.name,
          category: ep.category,
          unit: ep.unit,
          openingStock: ep.currentStock,
          sellingPrice: ep.sellingPrice,
          purchasePrice: ep.purchasePrice,
          minStockAlert: ep.minStockAlert,
          isExisting: true,
          matchedProductId: ep.id,
        });
      }
    }
  }

  // If single product with opening stock / selling price mentioned:
  // e.g. "Aata ka opening stock 25 kilo hai aur selling price 40 rupaye kilo hai. Save kar lo."
  if (detectedItems.length === 1) {
    const target = detectedItems[0];
    const missing: string[] = [];
    const updated: string[] = ['name'];

    // Check opening stock in command (supports "opening stock 25 kg" or "25 kg opening stock")
    const stockMatch =
      norm.match(/(?:opening stock|stock|ओपनिंग स्टॉक|स्टॉक)\s*(?:hai|ka|ki)?\s*(\d+(?:\.\d+)?)\s*(kilo|kg|packet|litre|piece|gm|किलो|पैकेट|लीटर|पीस)?/i) ||
      norm.match(/(\d+(?:\.\d+)?)\s*(kilo|kg|packet|litre|piece|gm|किलो|पैकेट|लीटर|पीस)?\s*(?:ka|ki)?\s*(?:opening stock|stock|ओपनिंग स्टॉक|स्टॉक)/i);

    if (stockMatch && stockMatch[1]) {
      const parsedStock = parseFloat(stockMatch[1]);
      if (!isNaN(parsedStock)) {
        target.openingStock = parsedStock;
        updated.push('openingStock');
      }
    } else {
      missing.push('openingStock');
    }

    // Check selling price in command (supports "selling price 40 rupaye" or "40 rupaye selling price")
    const priceMatch =
      norm.match(/(?:selling price|price|rate|कीमत|मूल्य|भाव)\s*(?:hai|ka|ki)?\s*(\d+(?:\.\d+)?)\s*(?:rupaye|rs|रुपये)?/i) ||
      norm.match(/(\d+(?:\.\d+)?)\s*(?:rupaye|rs|रुपये)?\s*(?:selling price|price|rate|कीमत|मूल्य|भाव)/i);

    if (priceMatch && priceMatch[1]) {
      const parsedPrice = parseFloat(priceMatch[1]);
      if (!isNaN(parsedPrice)) {
        target.sellingPrice = parsedPrice;
        updated.push('sellingPrice');
      }
    } else {
      missing.push('sellingPrice');
    }

    target.updatedFields = updated;
    target.missingFields = missing;
  } else {
    // Multiple products: mark missing fields if unmentioned
    for (const item of detectedItems) {
      const missing: string[] = [];
      if (item.openingStock === null || item.openingStock === undefined) missing.push('openingStock');
      if (item.sellingPrice === null || item.sellingPrice === undefined) missing.push('sellingPrice');
      item.missingFields = missing;
      item.updatedFields = ['name'];
    }
  }

  return detectedItems;
}

/**
 * Intelligent In-Browser Hinglish/Hindi Rule Parser.
 * Uses real shop inventory, completed sales, and customer ledger data.
 */
export function parseHinglishCommand(
  rawText: string,
  products: Product[],
  customers: Customer[],
  todaySalesSummary?: DailySalesSummary
): AIParseResult {
  const normalized = normalizeText(rawText);

  if (!normalized) {
    return {
      rawText,
      intent: 'unknown',
      intentLabelHindi: 'अस्पष्ट बात',
      confidence: 0,
      isAmbiguous: true,
      errorMessage: 'कृपया कोई वाक्य बोलें या लिखें (जैसे: "आज 3 किलो चीनी बिकी" या "मेरी दुकान में आटा और चावल सेव कर लो")',
      clarificationQuestion: 'कृपया बताएं — क्या आपको बिक्री दर्ज करनी है, नया सामान सेव करना है, या दुकान का हिसाब जानना है?',
      spokenResponse: 'कृपया कोई वाक्य बोलें या लिखें।',
      source: 'local_rules',
    };
  }

  // 1. INVENTORY SAVE / ADD COMMANDS (Explicit product saving via voice)
  // e.g. "Meri dukaan mein aata, chawal, sarson tel aur biscuit bikte hain. Inko meri inventory mein save kar lo."
  // e.g. "Meri dukaan mein Maggi bhi add kar do."
  // e.g. "Aata ka opening stock 25 kilo hai aur selling price 40 rupaye kilo hai. Save kar lo."
  if (isInventorySaveCommand(rawText)) {
    const parsedItems = parseInventoryItemsFromText(rawText, products);

    if (parsedItems.length > 0) {
      // Return parsed product items for explicit user confirmation preview — do not auto-save!
      const namesList = parsedItems.map((p) => p.name.split(' ')[0]).join(', ');

      const hasMissingStockOrPrice = parsedItems.some(
        (p) => p.openingStock === null || p.sellingPrice === null
      );

      const msg = `इन्वेंटरी में ${parsedItems.length} सामान जोड़ने का प्रस्ताव: ${namesList}। ${
        hasMissingStockOrPrice
          ? 'कृपया नीचे विवरण जांचें और सेव करने के लिए कन्फर्म करें।'
          : 'कृपया नीचे विवरण जांचें और सेव करने के लिए कन्फर्म करें।'
      }`;

      const spoken = `इन्वेंटरी में ${parsedItems.length} सामान जोड़ने के लिए तैयार है: ${namesList}। कृपया कन्फर्म करें।`;

      return {
        rawText,
        intent: 'inventory_add',
        intentLabelHindi: 'इन्वेंटरी में सामान जोड़ें (Preview)',
        confidence: 0.96,
        parsedProducts: parsedItems,
        message: msg,
        spokenResponse: spoken,
        notes: `${parsedItems.length} सामान का प्रस्ताव — कृपया पुष्टि करें`,
        source: 'local_rules',
      };
    } else {
      return {
        rawText,
        intent: 'inventory_add',
        intentLabelHindi: 'इन्वेंटरी सामान जोड़ें',
        confidence: 0.6,
        isAmbiguous: true,
        clarificationQuestion: 'कृपया बताएं आप कौन सा सामान दुकान की इन्वेंटरी में जोड़ना चाहते हैं? (जैसे: "आटा और चीनी सेव कर लो")',
        message: 'सामान का नाम पहचान में नहीं आया। कृपया दुकान में बिकने वाले सामान का नाम स्पष्ट बताएं।',
        spokenResponse: 'सामान का नाम समझ में नहीं आया। आप कौन सा सामान जोड़ना चाहते हैं?',
        source: 'local_rules',
      };
    }
  }

  // 2. RESTOCK SUGGESTIONS & LOW-STOCK INQUIRIES
  // e.g. "Meri dukaan mein stock ki kami hai", "Kaunsa stock mangwana chahiye?"
  if (isRestockSuggestionQuery(rawText)) {
    // Only include products with RECORDED low stock (currentStock !== null && currentStock > 0 && currentStock <= minStockAlert)
    const lowStock = products.filter((p) => {
      const cls = getStockClassification(p);
      return cls === 'low_stock' || cls === 'out_of_stock';
    });

    const restockItems: RestockItem[] = lowStock.map((p) => {
      const current = p.currentStock ?? 0;
      const suggested = Math.max(p.minStockAlert * 2, p.unit === 'kg' ? 10 : 5);
      return {
        productId: p.id,
        productName: p.name,
        currentStock: current,
        minStockAlert: p.minStockAlert,
        suggestedAdd: suggested,
        unit: p.unit,
        reason:
          current === 0
            ? 'सामान पूरी तरह खत्म (Out of stock) हो चुका है'
            : `स्टॉक (${current} ${p.unit}) न्यूनतम सीमा (${p.minStockAlert} ${p.unit}) से कम है`,
      };
    });

    if (restockItems.length > 0) {
      const itemNames = restockItems.map((r) => r.productName).join(', ');
      const msg = `आपकी दुकान में ${restockItems.length} सामान का स्टॉक कम या खत्म है: ${itemNames}। रेस्टॉक सुझाव तैयार है।`;
      const spoken = `दुकान में ${itemNames} का स्टॉक कम है। नया माल मंगाने की सलाह तैयार है।`;

      return {
        rawText,
        intent: 'restock_suggestion',
        intentLabelHindi: 'रीस्टॉक सुझाव (Low Stock Alert)',
        confidence: 0.98,
        restockItems,
        message: msg,
        spokenResponse: spoken,
        notes: `${restockItems.length} सामान कम स्टॉक पर`,
        source: 'local_rules',
      };
    } else {
      const unrecordedCount = products.filter((p) => p.currentStock === null).length;
      const msg = `दुकान में सभी रिकॉर्डेड सामान पर्याप्त स्टॉक में हैं! ${
        unrecordedCount > 0
          ? `(नोट: ${unrecordedCount} सामान का स्टॉक अभी दर्ज नहीं किया गया है)`
          : ''
      }`;
      const spoken = 'आपकी दुकान में सभी सामान पर्याप्त मात्रा में उपलब्ध हैं। अभी कोई भी सामान कम नहीं है।';

      return {
        rawText,
        intent: 'restock_suggestion',
        intentLabelHindi: 'स्टॉक स्थिति (Stock Status)',
        confidence: 0.95,
        restockItems: [],
        message: msg,
        spokenResponse: spoken,
        notes: 'सभी सामान पर्याप्त स्टॉक में हैं',
        source: 'local_rules',
      };
    }
  }

  // 3. OUT OF STOCK QUERY
  // "Kaun-kaun sa samaan khatam ho gaya hai?", "kaun sa maal khatam hai"
  const isOutOfStockQuery =
    normalized.includes('khatam ho gaya') ||
    normalized.includes('khatam hai') ||
    normalized.includes('out of stock') ||
    normalized.includes('खत्म हो गया') ||
    normalized.includes('खत्म है');

  if (isOutOfStockQuery && !normalized.includes('bik')) {
    const outOfStockItems = products.filter((p) => p.currentStock !== null && p.currentStock === 0);
    if (outOfStockItems.length > 0) {
      const names = outOfStockItems.map((p) => p.name).join(', ');
      return {
        rawText,
        intent: 'general_query',
        intentLabelHindi: 'खत्म सामान (Out of Stock)',
        confidence: 0.96,
        message: `दुकान में ये सामान पूरी तरह खत्म (Out of stock) हो चुके हैं: ${names}।`,
        spokenResponse: `दुकान में ${names} पूरी तरह खत्म हो चुके हैं।`,
        source: 'local_rules',
      };
    } else {
      return {
        rawText,
        intent: 'general_query',
        intentLabelHindi: 'खत्म सामान (Out of Stock)',
        confidence: 0.95,
        message: 'दुकान में कोई भी सामान खत्म (0 स्टॉक) नहीं है। सभी रिकॉर्डेड सामान स्टॉक में हैं।',
        spokenResponse: 'दुकान में कोई भी सामान खत्म नहीं हुआ है।',
        source: 'local_rules',
      };
    }
  }

  // 4. CONVERSATIONAL STORE INQUIRIES
  // A. Today's Sales Query ("aaj kitne rupaye ki sale hui", "aaj kitna samaan bika", "aaj ki total cash sale aur udhaar sale alag-alag batao")
  const isSalesBreakdownQuery =
    normalized.includes('cash sale aur udhaar') ||
    normalized.includes('alag alag batao') ||
    normalized.includes('alag-alag') ||
    normalized.includes('कैश सेल और उधार') ||
    normalized.includes('अलग-अलग');

  const isQuantitySoldQuery =
    normalized.includes('kitna samaan bika') ||
    normalized.includes('kitna maal bika') ||
    normalized.includes('कितना सामान बिका') ||
    normalized.includes('कितना माल बिका');

  const isTodaySalesQuery =
    normalized.includes('aaj ki sale') ||
    normalized.includes('aaj kitni sale') ||
    normalized.includes('aaj kitne rupaye') ||
    normalized.includes('kitni sale hui') ||
    normalized.includes('aaj kitna bika') ||
    normalized.includes('aaj ki bikri') ||
    normalized.includes('आज की बिक्री') ||
    normalized.includes('आज की सेल') ||
    normalized.includes('आज कितने रुपये') ||
    normalized.includes('आज कितनी सेल') ||
    isSalesBreakdownQuery ||
    isQuantitySoldQuery;

  if (isTodaySalesQuery) {
    const gross = todaySalesSummary?.grossSales || 0;
    const count = todaySalesSummary?.completedSalesCount || 0;
    const cash = todaySalesSummary?.cashSales || 0;
    const online = todaySalesSummary?.onlineSales || 0;
    const udhaar = todaySalesSummary?.udhaarSales || 0;
    const collected = todaySalesSummary?.udhaarCollected || 0;
    const cashInHand = todaySalesSummary?.totalCashInHandToday || cash + collected;

    if (isSalesBreakdownQuery) {
      const msg = `आज की कुल बिक्री ₹${gross} (${count} बिल):\n• नकद (Cash): ₹${cash}\n• UPI/ऑनलाइन: ₹${online}\n• उधार (Credit): ₹${udhaar}\n• पुराना उधार जमा मिला: ₹${collected}\n➔ आज गल्ले में कुल नकद: ₹${cashInHand}`;
      const spoken = `आज नकद सेल ${cash} रुपये, ऑनलाइन सेल ${online} रुपये, और उधार सेल ${udhaar} रुपये हुई है। गल्ले में कुल नकद ${cashInHand} रुपये आए हैं।`;
      return {
        rawText,
        intent: 'general_query',
        intentLabelHindi: 'बिक्री विवरण (Sales Breakdown)',
        confidence: 0.98,
        message: msg,
        spokenResponse: spoken,
        notes: `Cash: ₹${cash}, UPI: ₹${online}, Udhaar: ₹${udhaar}`,
        source: 'local_rules',
      };
    }

    if (isQuantitySoldQuery) {
      const items = todaySalesSummary?.productQuantitiesSold || [];
      if (items.length > 0) {
        const itemStr = items.map((i) => `${i.productName}: ${i.quantity} ${i.unit}`).join(', ');
        return {
          rawText,
          intent: 'general_query',
          intentLabelHindi: 'बिका सामान (Items Sold)',
          confidence: 0.96,
          message: `आज कुल ${count} बिलों में ये सामान बिका: ${itemStr} (कुल बिक्री ₹${gross})।`,
          spokenResponse: `आज कुल ${count} बिलों में सामान बिका: ${itemStr}।`,
          source: 'local_rules',
        };
      } else {
        return {
          rawText,
          intent: 'general_query',
          intentLabelHindi: 'बिका सामान',
          confidence: 0.95,
          message: 'आज अभी तक कोई सामान नहीं बिका है (0 बिल दर्ज हैं)।',
          spokenResponse: 'आज अभी तक कोई सामान नहीं बिका है।',
          source: 'local_rules',
        };
      }
    }

    const msg = `आज आपकी दुकान में कुल ₹${gross} की बिक्री हुई है (कुल ${count} बिल कटे हैं)। इसमें नकद ₹${cash}, UPI ₹${online}, और उधार ₹${udhaar} शामिल हैं।`;
    return {
      rawText,
      intent: 'general_query',
      intentLabelHindi: 'आज की बिक्री (Today Sales)',
      confidence: 0.98,
      message: msg,
      spokenResponse: `आज आपकी दुकान में कुल ${gross} रुपये की बिक्री हुई है।`,
      notes: `आज की बिक्री: ₹${gross}`,
      source: 'local_rules',
    };
  }

  // B. Customer Credit Inquiry ("Ramesh par kitna udhaar hai", "रमेश पर कितना उधार है")
  const isCustomerCreditInquiry =
    normalized.includes('kitna udhaar') ||
    normalized.includes('kitna udhar') ||
    normalized.includes('kitna baaki') ||
    normalized.includes('hisaab kitna') ||
    normalized.includes('udhaar kitna') ||
    normalized.includes('कितना उधार') ||
    normalized.includes('कितना बाकी') ||
    normalized.includes('हिसाब कितना');

  if (isCustomerCreditInquiry) {
    const matchedCustomer = findCustomer(normalized, customers);
    if (matchedCustomer) {
      const msg = `${matchedCustomer.name} के खाते में वर्तमान में ₹${matchedCustomer.currentBalance} का बकाया उधार है।`;
      return {
        rawText,
        intent: 'general_query',
        intentLabelHindi: 'ग्राहक उधार विवरण (Balance Check)',
        confidence: 0.98,
        matchedCustomer,
        message: msg,
        spokenResponse: `${matchedCustomer.name} के खाते में वर्तमान में ${matchedCustomer.currentBalance} रुपये उधार बाकी है।`,
        notes: `${matchedCustomer.name} बकाया: ₹${matchedCustomer.currentBalance}`,
        source: 'local_rules',
      };
    } else {
      return {
        rawText,
        intent: 'general_query',
        intentLabelHindi: 'ग्राहक उधार विवरण',
        confidence: 0.6,
        isAmbiguous: true,
        clarificationQuestion: 'ग्राहक का नाम पहचान में नहीं आया। आप किस ग्राहक का बकाया उधार जानना चाहते हैं?',
        message: 'ग्राहक का नाम समझ में नहीं आया। कृपया बताएं किस ग्राहक का बकाया उधार देखना है।',
        spokenResponse: 'ग्राहक का नाम समझ में नहीं आया। आप किस ग्राहक का हिसाब देखना चाहते हैं?',
        source: 'local_rules',
      };
    }
  }

  // C. Product Stock Inquiry ("Mere paas kitna chawal bacha hai?", "chini kitni bachi hai", "चीनी का स्टॉक कितना बचा है")
  const isProductStockInquiry =
    normalized.includes('stock kitna') ||
    normalized.includes('kitna stock') ||
    normalized.includes('kitna bacha') ||
    normalized.includes('kitni bachi') ||
    normalized.includes('paas kitna') ||
    normalized.includes('स्टॉक कितना') ||
    normalized.includes('कितना स्टॉक') ||
    normalized.includes('कितना बचा') ||
    normalized.includes('कितनी बची');

  if (isProductStockInquiry) {
    const matchedProduct = findProduct(normalized, products);
    if (matchedProduct) {
      if (matchedProduct.currentStock === null) {
        return {
          rawText,
          intent: 'general_query',
          intentLabelHindi: 'स्टॉक स्थिति (Stock Unrecorded)',
          confidence: 0.95,
          matchedProduct,
          message: `${matchedProduct.name} का स्टॉक अभी दुकान में दर्ज नहीं किया गया है। आप इन्वेंटरी में ओपनिंग स्टॉक दर्ज कर सकते हैं।`,
          spokenResponse: `${matchedProduct.name} का स्टॉक अभी दर्ज नहीं है।`,
          notes: `${matchedProduct.name}: स्टॉक दर्ज नहीं`,
          source: 'local_rules',
        };
      } else if (matchedProduct.currentStock === 0) {
        return {
          rawText,
          intent: 'general_query',
          intentLabelHindi: 'स्टॉक स्थिति (Out of Stock)',
          confidence: 0.98,
          matchedProduct,
          message: `${matchedProduct.name} का स्टॉक पूरी तरह खत्म हो चुका है (0 ${matchedProduct.unit} बचा है)।`,
          spokenResponse: `${matchedProduct.name} पूरी तरह खत्म हो चुका है।`,
          notes: `${matchedProduct.name}: 0 ${matchedProduct.unit}`,
          source: 'local_rules',
        };
      } else {
        const msg = `${matchedProduct.name} का मौजूदा स्टॉक ${matchedProduct.currentStock} ${matchedProduct.unit} है।`;
        return {
          rawText,
          intent: 'general_query',
          intentLabelHindi: 'स्टॉक स्थिति (Stock Status)',
          confidence: 0.98,
          matchedProduct,
          message: msg,
          spokenResponse: `दुकान में ${matchedProduct.name} का स्टॉक ${matchedProduct.currentStock} ${matchedProduct.unit} बचा है।`,
          notes: `${matchedProduct.name} स्टॉक: ${matchedProduct.currentStock} ${matchedProduct.unit}`,
          source: 'local_rules',
        };
      }
    } else {
      return {
        rawText,
        intent: 'general_query',
        intentLabelHindi: 'स्टॉक स्थिति',
        confidence: 0.6,
        isAmbiguous: true,
        clarificationQuestion: 'सामान का नाम पहचान में नहीं आया। आप किस सामान का स्टॉक जानना चाहते हैं?',
        message: 'सामान का नाम पहचान में नहीं आया। कृपया दुकान में मौजूद सामान का नाम बताएं।',
        spokenResponse: 'सामान का नाम पहचान में नहीं आया। आप किस सामान का स्टॉक जानना चाहते हैं?',
        source: 'local_rules',
      };
    }
  }

  // 5. TRANSACTION INTENTS
  const isUdhaarReceived =
    normalized.includes('jama kiye') ||
    normalized.includes('jama kiya') ||
    normalized.includes('jama mila') ||
    normalized.includes('payment mila') ||
    normalized.includes('जमा किए') ||
    normalized.includes('जमा किया') ||
    normalized.includes('जमा मिला') ||
    (normalized.includes('jama') && !normalized.includes('udhaar liye'));

  const isUdhaarGiven =
    normalized.includes('udhaar liye') ||
    normalized.includes('udhar liye') ||
    normalized.includes('udhaar diya') ||
    normalized.includes('baaki likho') ||
    normalized.includes('khate me') ||
    normalized.includes('उधार लिया') ||
    normalized.includes('उधार लिए') ||
    normalized.includes('उधार दिया') ||
    normalized.includes('बाकी लिखो') ||
    (normalized.includes('udhaar') && !normalized.includes('jama')) ||
    (normalized.includes('उधार') && !normalized.includes('जमा'));

  const isStockAdd =
    normalized.includes('stock aaya') ||
    normalized.includes('maal aaya') ||
    normalized.includes('stock joda') ||
    normalized.includes('naya maal') ||
    normalized.includes('naya stock') ||
    normalized.includes('स्टॉक आया') ||
    normalized.includes('माल आया') ||
    normalized.includes('नया माल आया');

  const isSale =
    normalized.includes('biki') ||
    normalized.includes('bika') ||
    normalized.includes('becha') ||
    normalized.includes('sale hua') ||
    normalized.includes('sale hui') ||
    normalized.includes('bikri') ||
    normalized.includes('बिकी') ||
    normalized.includes('बिका') ||
    normalized.includes('बेचा') ||
    normalized.includes('बिक्री');

  // A. UDHAAR RECEIVED
  if (isUdhaarReceived && !isStockAdd) {
    const matchedCustomer = findCustomer(normalized, customers);
    const amount = extractAmount(normalized);

    if (!matchedCustomer) {
      return {
        rawText,
        intent: 'udhaar_received',
        intentLabelHindi: 'उधार जमा मिला',
        confidence: 0.5,
        amount,
        isAmbiguous: true,
        clarificationQuestion: 'ग्राहक का नाम स्पष्ट नहीं हुआ। यह जमा किस ग्राहक के खाते में दर्ज करना है?',
        errorMessage: 'ग्राहक का नाम पहचान में नहीं आया। कृपया बताएं किस ग्राहक ने पैसे जमा किए हैं।',
        spokenResponse: 'ग्राहक का नाम समझ में नहीं आया। कृपया बताएं किस ग्राहक से जमा मिला है।',
        source: 'local_rules',
      };
    }

    if (!amount || amount <= 0) {
      return {
        rawText,
        intent: 'udhaar_received',
        intentLabelHindi: 'उधार जमा मिला',
        confidence: 0.6,
        matchedCustomer,
        isAmbiguous: true,
        clarificationQuestion: `कृपया बताएं ${matchedCustomer.name} से कितने रुपये जमा प्राप्त हुए हैं?`,
        errorMessage: `जमा की रकम (Amount) स्पष्ट नहीं हुई। कृपया बताएं कितने रुपये जमा हुए हैं।`,
        spokenResponse: 'जमा की रकम समझ में नहीं आई। कृपया बताएं कितने रुपये जमा हुए हैं।',
        source: 'local_rules',
      };
    }

    return {
      rawText,
      intent: 'udhaar_received',
      intentLabelHindi: 'उधार जमा मिला (Payment Received)',
      confidence: 0.95,
      matchedCustomer,
      amount,
      notes: `${matchedCustomer.name} से नकद जमा प्राप्त`,
      spokenResponse: `${matchedCustomer.name} से ${amount} रुपये जमा दर्ज करने का पूर्वावलोकन तैयार है। क्या आप इसे सेव करना चाहते हैं?`,
      source: 'local_rules',
    };
  }

  // B. UDHAAR GIVEN
  if (isUdhaarGiven) {
    const matchedCustomer = findCustomer(normalized, customers);
    const amount = extractAmount(normalized);

    if (!matchedCustomer) {
      return {
        rawText,
        intent: 'udhaar_given',
        intentLabelHindi: 'उधार दिया',
        confidence: 0.5,
        amount,
        isAmbiguous: true,
        clarificationQuestion: 'ग्राहक का नाम स्पष्ट नहीं हुआ। यह उधार किसके खाते में दर्ज करना है?',
        errorMessage: 'ग्राहक का नाम नहीं मिला। कृपया ग्राहक का नाम बताएं।',
        spokenResponse: 'ग्राहक का नाम समझ में नहीं आया। यह उधार किसके खाते में लिखना है?',
        source: 'local_rules',
      };
    }

    if (!amount || amount <= 0) {
      return {
        rawText,
        intent: 'udhaar_given',
        intentLabelHindi: 'उधार दिया',
        confidence: 0.6,
        matchedCustomer,
        isAmbiguous: true,
        clarificationQuestion: `कृपया बताएं ${matchedCustomer.name} को कितने रुपये का उधार दिया गया है?`,
        errorMessage: `उधार की रकम (Amount) स्पष्ट नहीं हुई।`,
        spokenResponse: 'उधार की रकम समझ में नहीं आई। कृपया रकम बताएं।',
        source: 'local_rules',
      };
    }

    return {
      rawText,
      intent: 'udhaar_given',
      intentLabelHindi: 'उधार दिया (Credit Given)',
      confidence: 0.95,
      matchedCustomer,
      amount,
      notes: `${matchedCustomer.name} के खाते में नया उधार`,
      spokenResponse: `${matchedCustomer.name} के खाते में ${amount} रुपये उधार दर्ज करने का पूर्वावलोकन तैयार है। क्या आप इसे सेव करना चाहते हैं?`,
      source: 'local_rules',
    };
  }

  // C. STOCK ADD
  if (isStockAdd) {
    const matchedProduct = findProduct(normalized, products);
    const qtyInfo = extractQuantityAndUnit(normalized, matchedProduct?.unit);

    if (!matchedProduct) {
      return {
        rawText,
        intent: 'stock_add',
        intentLabelHindi: 'नया स्टॉक जोड़ें',
        confidence: 0.5,
        quantity: qtyInfo.quantity,
        isAmbiguous: true,
        clarificationQuestion: 'सामान का नाम स्पष्ट नहीं हुआ। कृपया बताएं कौन सा नया माल दुकान में आया है?',
        errorMessage: 'सामान का नाम पहचान में नहीं आया।',
        spokenResponse: 'सामान का नाम समझ में नहीं आया। कृपया बताएं कौन सा माल आया है।',
        source: 'local_rules',
      };
    }

    const quantity = qtyInfo.quantity || 1;
    const unit = qtyInfo.unit || matchedProduct.unit;
    return {
      rawText,
      intent: 'stock_add',
      intentLabelHindi: 'नया स्टॉक जोड़ें (Add Stock)',
      confidence: 0.92,
      matchedProduct,
      quantity,
      unit,
      notes: `${matchedProduct.name} में +${quantity} ${unit} स्टॉक वृद्धि`,
      spokenResponse: `${matchedProduct.name} में ${quantity} ${unit} नया स्टॉक जोड़ने का पूर्वावलोकन तैयार है। क्या आप इसे सेव करना चाहते हैं?`,
      source: 'local_rules',
    };
  }

  // D. SALE
  if (isSale || hasProductMatch(normalized, products)) {
    const matchedProduct = findProduct(normalized, products);
    const qtyInfo = extractQuantityAndUnit(normalized, matchedProduct?.unit);
    const quantity = qtyInfo.quantity || 1;

    if (!matchedProduct) {
      return {
        rawText,
        intent: 'sale',
        intentLabelHindi: 'बिक्री दर्ज करें',
        confidence: 0.5,
        isAmbiguous: true,
        clarificationQuestion: 'सामान का नाम स्पष्ट नहीं हुआ। आप कौन सा सामान बेचना चाहते हैं?',
        errorMessage: 'सामान का नाम पहचान में नहीं आया।',
        spokenResponse: 'सामान का नाम समझ में नहीं आया। कृपया सामान का नाम बताएं।',
        source: 'local_rules',
      };
    }

    const unit = qtyInfo.unit || matchedProduct.unit;
    const price = matchedProduct.sellingPrice || 0;
    const calculatedTotal = Number((price * quantity).toFixed(2));

    return {
      rawText,
      intent: 'sale',
      intentLabelHindi: 'बिक्री दर्ज करें (New Sale)',
      confidence: 0.92,
      matchedProduct,
      quantity,
      unit,
      amount: calculatedTotal,
      notes: `${matchedProduct.name} (${quantity} ${unit}) बिक्री`,
      spokenResponse: `${quantity} ${unit} ${matchedProduct.name} की बिक्री का पूर्वावलोकन तैयार है। क्या आप इसे सेव करना चाहते हैं?`,
      source: 'local_rules',
    };
  }

  // 6. DEFAULT AMBIGUOUS FALLBACK
  return {
    rawText,
    intent: 'unknown',
    intentLabelHindi: 'स्पष्टीकरण चाहिए',
    confidence: 0.2,
    isAmbiguous: true,
    errorMessage: 'माफ़ कीजिए, यह बात पूरी तरह समझ नहीं आई। क्या आप बिक्री दर्ज करना चाहते हैं, नया सामान सेव करना चाहते हैं, या दुकान का हिसाब जानना चाहते हैं?',
    clarificationQuestion: 'कृपया बताएं — क्या आपको बिक्री दर्ज करनी है, नया सामान जोड़ना है, या दुकान का हिसाब जानना है?',
    spokenResponse: 'आपकी बात समझ नहीं आई। क्या आप बिक्री, सामान या स्टॉक की जानकारी चाहते हैं?',
    source: 'local_rules',
  };
}

// ---------------- Helper Matching Logic ----------------

export function findCustomer(text: string, customers: Customer[]): Customer | undefined {
  const norm = normalizeText(text);
  const words = norm.split(/\s+/);

  for (const cust of customers) {
    const custNorm = normalizeText(cust.name);
    const parts = custNorm.split(/\s+/);
    for (const part of parts) {
      if (part.length >= 3) {
        if (words.some((w) => w === part || w.startsWith(part) || part.startsWith(w))) {
          return cust;
        }
      }
    }
  }

  return undefined;
}

export function hasProductMatch(text: string, products: Product[]): boolean {
  return !!findProduct(text, products);
}

const PRODUCT_SYNONYMS: Record<string, string[]> = {
  चावल: ['chawal', 'chaawal', 'rice', 'चावल'],
  आटा: ['aata', 'atta', 'gehun', 'flour', 'आटा'],
  चीनी: ['chini', 'cheeni', 'sugar', 'चीनी'],
  तेल: ['tel', 'tail', 'sarson', 'oil', 'mustard', 'तेल'],
  सरसों: ['sarson', 'mustard', 'सरसों'],
  दाल: ['dal', 'daal', 'toor', 'chana', 'moong', 'दाल'],
  मैगी: ['maggi', 'maggie', 'noodles', 'मैगी'],
  नमक: ['namak', 'salt', 'tata salt', 'नमक'],
  दूध: ['doodh', 'dudh', 'milk', 'दूध'],
  चाय: ['chai', 'tea', 'चाय'],
  बिस्कुट: ['biscuit', 'biscuits', 'parle', 'बिस्कुट', 'बिस्किट'],
  साबुन: ['sabun', 'soap', 'साबुन'],
  मसाला: ['masala', 'masale', 'spices', 'मसाला', 'मसाले'],
};

export function findProduct(text: string, products: Product[]): Product | undefined {
  const norm = normalizeText(text);

  // 1. Exact substring check on all products
  for (const prod of products) {
    const prodNorm = normalizeText(prod.name);
    if (norm.includes(prodNorm)) return prod;
    if (prod.hindiName && norm.includes(normalizeText(prod.hindiName))) return prod;
  }

  // 2. Word token check
  for (const prod of products) {
    const parts = normalizeText(prod.name).split(/\s+/);
    for (const part of parts) {
      if (part.length >= 3 && norm.includes(part)) {
        return prod;
      }
    }
  }

  // 3. Multilingual synonym & transliteration check
  for (const prod of products) {
    const prodNorm = normalizeText(`${prod.name} ${prod.hindiName || ''}`);
    for (const group of Object.values(PRODUCT_SYNONYMS)) {
      const prodInGroup = group.some((term) => prodNorm.includes(term));
      if (prodInGroup) {
        const queryInGroup = group.some((term) => norm.includes(term));
        if (queryInGroup) {
          return prod;
        }
      }
    }
  }

  return undefined;
}

export function extractAmount(text: string): number | undefined {
  const norm = normalizeText(text);
  const rupeePattern = /(?:₹|\brs\.?|\brupaye|\brupee|\bरुपये|\bरु)?\s*(\d+(?:\.\d+)?)\s*(?:₹|\brs\.?|\brupaye|\brupee|\bरुपये|\bरु|\bka\b|\bका\b)?/i;
  const match = norm.match(rupeePattern);

  if (match && match[1]) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val > 0) return val;
  }

  for (const [word, val] of Object.entries(NUMBER_WORDS)) {
    if (norm.includes(word)) {
      if ((norm.includes('sau') || norm.includes('सौ')) && val < 100) {
        return val * 100;
      }
      return val;
    }
  }

  return undefined;
}

export function extractQuantityAndUnit(
  text: string,
  defaultUnit?: UnitType
): { quantity: number; unit?: UnitType } {
  const norm = normalizeText(text);
  const qtyPattern = /(\d+(?:\.\d+)?)\s*(kilo|kg|kgs|kilogram|gram|gm|litre|liter|ltr|l|packet|pkt|packets|piece|pcs|pc|bori|dozen|box|किलो|किलोग्राम|ग्राम|लीटर|पैकेट|पीस|बोरी|दर्जन|डिब्बा)?/i;
  const match = norm.match(qtyPattern);

  if (match) {
    const qty = parseFloat(match[1]);
    const unitMatch = match[2]?.toLowerCase();
    const resolvedUnit = unitMatch ? UNIT_SYNONYMS[unitMatch] : defaultUnit;
    return { quantity: isNaN(qty) ? 1 : qty, unit: resolvedUnit };
  }

  for (const [word, val] of Object.entries(NUMBER_WORDS)) {
    if (norm.includes(word)) {
      for (const [unitStr, unitType] of Object.entries(UNIT_SYNONYMS)) {
        if (norm.includes(unitStr)) {
          return { quantity: val, unit: unitType };
        }
      }
      return { quantity: val, unit: defaultUnit };
    }
  }

  return { quantity: 1, unit: defaultUnit };
}
