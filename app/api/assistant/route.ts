import { pilotDatabase, requireSameOrigin, sessionToken, boundedJson } from '../../../lib/server/http';
import { PilotError } from '../../../lib/server/database';
import { calculateDailySales } from '../../../lib/storage';
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import {
  AIParseResult,
  AssistantApiRequest,
  AssistantApiResponse,
  Product,
  Customer,
  UnitType,
  RestockItem,
  ParsedProductItem,
} from '../../../types';

// Validation constraints
const MAX_MESSAGE_LENGTH = 500;

interface GeminiStructuredPayload {
  intent:
    | 'sale'
    | 'stock_add'
    | 'udhaar_given'
    | 'udhaar_received'
    | 'restock_suggestion'
    | 'general_query'
    | 'inventory_add'
    | 'unknown';
  intentLabelHindi?: string;
  confidence?: number;
  matchedProductId?: string;
  matchedCustomerId?: string;
  quantity?: number;
  unit?: string;
  amount?: number;
  notes?: string;
  message?: string;
  spokenResponse?: string;
  isAmbiguous?: boolean;
  clarificationQuestion?: string;
  restockRecommendations?: Array<{
    productId: string;
    suggestedAdd: number;
    reason: string;
  }>;
  parsedProducts?: Array<{
    name: string;
    brandOrVariant?: string;
    unit?: string;
    openingStock?: number;
    sellingPrice?: number;
    category?: string;
  }>;
}

function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/[`_#•]/g, ' ')
    .replace(/₹/g, ' रुपये ')
    .replace(/\bkg\b/gi, ' किलो ')
    .replace(/\bpacket\b/gi, ' पैकेट ')
    .replace(/\bpiece\b/gi, ' पीस ')
    .replace(/\blitre\b/gi, ' लीटर ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(req: NextRequest): Promise<NextResponse<AssistantApiResponse>> {
  try {
    if (process.env.AI_ENABLED !== 'true') return NextResponse.json({ success:false, error:'AI_DISABLED', message:'Online AI disabled. Local draft assistant remains available.' }, {status:503});
    const db=pilotDatabase();requireSameOrigin(req);const user=db.authenticate(sessionToken(req));
    const budget=Number(process.env.AI_DAILY_REQUEST_LIMIT||0);
    if(!Number.isSafeInteger(budget)||budget<1||budget>1000)throw new PilotError('AI usage budget is not configured',503);
    db.limit('ai-user:'+user,10);db.limit('ai-global-day',budget,86_400_000);
    // 1. Check Server-Side Environment Variables
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'GEMINI_API_KEY_NOT_CONFIGURED',
          message:
            'Google Gemini API Key सर्वर पर सेट नहीं है। कृपया .env.local में GEMINI_API_KEY कॉन्फ़िगर करें।',
          source: 'gemini',
        },
        { status: 503 }
      );
    }

    // 2. Validate Request Body
    let body: AssistantApiRequest;
    try {
      body = await boundedJson(req) as unknown as AssistantApiRequest;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_JSON',
          message: 'अमान्य अनुरोध (Invalid JSON body)',
        },
        { status: 400 }
      );
    }

    if(typeof body.shopId!=='string')throw new PilotError('Select an authenticated server shop',403);
    const shop=db.read(user,body.shopId);
    const summary=calculateDailySales(shop.sales,shop.udhaarTransactions);
    body={message:body.message,inventory:shop.products.slice(0,500),customers:shop.customers.slice(0,500),shopName:shop.shopName,ownerName:shop.shopkeeperName,todaySalesTotal:summary.grossSales,todaySalesCount:summary.completedSalesCount,todaySalesSummary:summary};
    const {
      message,
      inventory = [],
      customers = [],
      shopName = 'दुकान',
      ownerName = 'दुकानदार',
      todaySalesTotal = 0,
      todaySalesCount = 0,
      todaySalesSummary,
    } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_MESSAGE',
          message: 'कृपया कोई संदेश या कमांड भेजें (Message is required)',
        },
        { status: 400 }
      );
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0 || trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: 'MESSAGE_LENGTH_EXCEEDED',
          message: `संदेश 1 से ${MAX_MESSAGE_LENGTH} अक्षरों के बीच होना चाहिए।`,
        },
        { status: 400 }
      );
    }

    // 3. Prepare Minimized, Real-Shop Context
    const inventoryContext = inventory.map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      currentStock: p.currentStock, // can be null!
      sellingPrice: p.sellingPrice,
      minStockAlert: p.minStockAlert,
      isLowStock:
        typeof p.currentStock === 'number' && p.currentStock > 0 && p.currentStock <= p.minStockAlert,
      isOutOfStock: typeof p.currentStock === 'number' && p.currentStock === 0,
      isUnrecordedStock: p.currentStock === null || p.currentStock === undefined,
    }));

    const customersContext = customers.map((c) => ({
      id: c.id,
      name: c.name,
      currentBalance: c.currentBalance,
    }));

    // 4. Initialize Google GenAI Client
    const ai = new GoogleGenAI({ apiKey });

    // 5. System Prompt & Strict Rules
    const systemInstruction = `
आप "दुकान साथी AI" (Dukaan Sathi AI) हैं — भारतीय छोटे किराना दुकानदारों के लिए स्मार्ट, विश्वसनीय डिजिटल मुनीम और वॉइस असिस्टेंट।
दुकानदार हिंदी, देवनागरी, या रोमन हिंग्लिश (जैसे: "3 kilo chini biki", "Meri dukaan mein aata aur chawal bikte hain, save kar lo", "aaj kitne rupaye ki sale hui", "chini ka stock kitna bacha hai") में बोलते हैं।

दुकान का नाम: "${shopName}"
दुकानदार का नाम: "${ownerName}"
आज की बिक्री आंकड़े:
- कुल बिक्री (Gross Sales): ₹${todaySalesSummary?.grossSales || todaySalesTotal} (${todaySalesSummary?.completedSalesCount || todaySalesCount} बिल)
- नकद बिक्री (Cash Sales): ₹${todaySalesSummary?.cashSales || 0}
- ऑनलाइन बिक्री (UPI Sales): ₹${todaySalesSummary?.onlineSales || 0}
- उधार बिक्री (Credit Sales): ₹${todaySalesSummary?.udhaarSales || 0}
- पुराना उधार जमा मिला: ₹${todaySalesSummary?.udhaarCollected || 0}
- गल्ले में कुल नकद: ₹${todaySalesSummary?.totalCashInHandToday || 0}
- आज बिका सामान: ${JSON.stringify(todaySalesSummary?.productQuantitiesSold || [])}

दुकान की वास्तविक इन्वेंटरी:
${JSON.stringify(inventoryContext, null, 2)}

दुकान के वास्तविक ग्राहक:
${JSON.stringify(customersContext, null, 2)}

कड़े नियम (STRICT BUSINESS RULES):
1. कभी भी मनगढ़ंत (hallucinated) सामान, ग्राहक या आंकड़े न बनाएं। केवल ऊपर दी गई वास्तविक इन्वेंटरी, ग्राहक और बिक्री जानकारी का उपयोग करें।
2. Intent वर्गीकरण:
   - "inventory_add": जब दुकानदार इन्वेंटरी में नया सामान जोड़ने या सेव करने की बात कहे।
     उदा. "Meri dukaan mein aata, chawal, sarson tel aur biscuit bikte hain. Inko meri inventory mein save kar lo."
     उदा. "Meri dukaan mein Maggi bhi add kar do."
     उदा. "Aata ka opening stock 25 kilo hai aur selling price 40 rupaye kilo hai. Save kar lo."
     *नियम:* parsedProducts में हर सामान का नाम भरें। यदि मात्रा या कीमत नहीं बोली गई है, तो openingStock और sellingPrice को शून्य या मनगढ़ंत न बनाएं — उन्हें छोड़ दें या न भरें।
     *spokenResponse:* साफ और संक्षिप्त बोलें, जैसे "आपकी दुकान में 4 सामान सेव हो गए हैं: आटा, चावल, सरसों तेल, बिस्कुट। इनका ओपनिंग स्टॉक और रेट बाद में भी जोड़ सकते हैं।"
   - "sale": जब कोई सामान बिका हो (उदा. "3 किलो चीनी बिकी", "मैगी 2 पैकेट बिका")।
   - "stock_add": जब नया माल या स्टॉक दुकान में आया हो।
   - "udhaar_given": जब किसी ग्राहक ने उधार लिया हो / दुकानदार ने उधार दिया हो।
   - "udhaar_received": जब ग्राहक ने पुराना उधार चुकाया या जमा किया हो।
   - "restock_suggestion": जब दुकानदार कम स्टॉक या नया माल मंगाने की सलाह मांगे।
     *नियम:* केवल वही सामान सुझाएं जिनका currentStock > 0 और currentStock <= minStockAlert है, या currentStock === 0 है। जिनका स्टॉक unrecorded (null) है, उन्हें कम स्टॉक न कहें।
   - "general_query": दुकान के आंकड़े पूछना:
     * "Mere paas kitna chawal bacha hai?": यदि stock unrecorded (null) है, तो कहें कि इसका स्टॉक अभी दर्ज नहीं किया गया है। यदि 0 है तो खत्म बताएं। यदि उपलब्ध है तो मात्रा बताएं।
     * "Kaun-kaun sa samaan khatam ho gaya hai?": केवल वही सामान बताएं जिनका currentStock === 0 है।
     * "Aaj kitne rupaye ki sale hui?" / "Aaj kitna samaan bika?" / "Aaj ki cash sale aur udhaar sale alag-alag batao": ऊपर दिए गए सटीक बिक्री आंकड़ों से स्पष्ट बताएं।
     * "Ramesh par kitna udhaar hai?": ग्राहक सूची में से उसका सटीक बकाया बताएं।
   - "unknown": जब बात अधूरी या समझ से परे हो।
3. वित्तीय सुरक्षा (Financial Safety):
   - कभी भी किसी सामान्य प्रश्न या अधूरी बात से वित्तीय बिक्री या उधार लेन-देन न बनाएं।
   - केवल स्पष्ट बिक्री/उधार पर ही transaction intent दें।
`.trim();

    // 6. Define Strict Structured Output Schema
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        intent: {
          type: Type.STRING,
          enum: [
            'sale',
            'stock_add',
            'udhaar_given',
            'udhaar_received',
            'restock_suggestion',
            'general_query',
            'inventory_add',
            'unknown',
          ],
          description: 'The classified user intent',
        },
        intentLabelHindi: {
          type: Type.STRING,
          description: 'Short Hindi label of the action, e.g. बिक्री दर्ज करें, सामान सेव करें, आदि',
        },
        confidence: {
          type: Type.NUMBER,
          description: 'Confidence score from 0.0 to 1.0',
        },
        matchedProductId: {
          type: Type.STRING,
          description: 'Exact ID of the matched product from the inventory list, or empty string',
        },
        matchedCustomerId: {
          type: Type.STRING,
          description: 'Exact ID of the matched customer from the customer list, or empty string',
        },
        quantity: {
          type: Type.NUMBER,
          description: 'Item quantity number, 0 if not applicable',
        },
        unit: {
          type: Type.STRING,
          description: 'Item unit e.g. kg, litre, packet, piece, gm',
        },
        amount: {
          type: Type.NUMBER,
          description: 'Total transaction amount in INR (₹)',
        },
        notes: {
          type: Type.STRING,
          description: 'Brief summary note in Hindi/Hinglish',
        },
        message: {
          type: Type.STRING,
          description: 'Helpful explanation or response message in Hindi for the shopkeeper',
        },
        spokenResponse: {
          type: Type.STRING,
          description: 'Clean Hindi sentence for Text-to-Speech (TTS) voice playback, without Markdown formatting or asterisks.',
        },
        isAmbiguous: {
          type: Type.BOOLEAN,
          description: 'True if details are missing, ambiguous, or unclear',
        },
        clarificationQuestion: {
          type: Type.STRING,
          description: 'Polite clarification question in Hindi if isAmbiguous is true',
        },
        parsedProducts: {
          type: Type.ARRAY,
          description: 'Parsed product list when intent is inventory_add',
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              brandOrVariant: { type: Type.STRING },
              unit: { type: Type.STRING },
              openingStock: { type: Type.NUMBER },
              sellingPrice: { type: Type.NUMBER },
              category: { type: Type.STRING },
            },
            required: ['name'],
          },
        },
        restockRecommendations: {
          type: Type.ARRAY,
          description: 'List of product restock recommendations if intent is restock_suggestion',
          items: {
            type: Type.OBJECT,
            properties: {
              productId: { type: Type.STRING },
              suggestedAdd: { type: Type.NUMBER },
              reason: { type: Type.STRING },
            },
            required: ['productId', 'suggestedAdd', 'reason'],
          },
        },
      },
      required: [
        'intent',
        'intentLabelHindi',
        'confidence',
        'notes',
        'message',
        'isAmbiguous',
      ],
    };

    // 7. Call Gemini Models API with automatic model resiliency
    const configuredModel = process.env.GEMINI_MODEL;
    if(!configuredModel)throw new PilotError('Set an explicitly supported Gemini model',503);
    const candidateModels = [configuredModel];

    let response;
    let lastError: unknown;

    for (const modelToTry of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelToTry,
          contents: [
            {
              role: 'user',
              parts: [{ text: trimmedMessage }],
            },
          ],
          config: {
            abortSignal: AbortSignal.timeout(10000),
            maxOutputTokens: 1500,
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.1,
            systemInstruction,
          },
        });
        if (response?.text) {
          break;
        }
      } catch (err: unknown) {
        lastError = err;
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('Gemini API returned no response');
    }

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Gemini API returned empty response');
    }

    // 8. Parse and Validate Output
    let parsed: GeminiStructuredPayload;
    try {
      parsed = JSON.parse(responseText) as GeminiStructuredPayload;
    } catch {
      throw new Error('Failed to parse Gemini JSON output');
    }

    // 9. Hydrate and Validate Entities with Real Application Data
    const rawProd = parsed.matchedProductId
      ? inventory.find((p) => p.id === parsed.matchedProductId)
      : parsed.intent === 'sale' || parsed.intent === 'stock_add'
      ? inventory.find(
          (p) =>
            trimmedMessage.toLowerCase().includes(p.name.toLowerCase()) ||
            p.name.toLowerCase().includes(trimmedMessage.toLowerCase())
        )
      : undefined;

    const matchedProduct: Product | undefined = rawProd
      ? {
          id: rawProd.id,
          name: rawProd.name,
          unit: rawProd.unit,
          currentStock: rawProd.currentStock !== undefined ? rawProd.currentStock : null,
          sellingPrice: rawProd.sellingPrice !== undefined ? rawProd.sellingPrice : null,
          minStockAlert: rawProd.minStockAlert,
          category: rawProd.category || 'किराना / राशन',
          updatedAt: rawProd.updatedAt || new Date().toISOString(),
        }
      : undefined;

    const rawCust = parsed.matchedCustomerId
      ? customers.find((c) => c.id === parsed.matchedCustomerId)
      : parsed.intent === 'udhaar_given' || parsed.intent === 'udhaar_received'
      ? customers.find(
          (c) =>
            trimmedMessage.toLowerCase().includes(c.name.toLowerCase()) ||
            c.name.toLowerCase().includes(trimmedMessage.toLowerCase())
        )
      : undefined;

    const matchedCustomer: Customer | undefined = rawCust
      ? {
          id: rawCust.id,
          name: rawCust.name,
          phone: rawCust.phone || '',
          currentBalance: rawCust.currentBalance,
          createdAt: rawCust.createdAt || new Date().toISOString(),
        }
      : undefined;

    // Calculate/Verify Sale Amount
    let finalAmount = parsed.amount;
    const finalQuantity = parsed.quantity && parsed.quantity > 0 ? parsed.quantity : 1;

    if (parsed.intent === 'sale' && matchedProduct && matchedProduct.sellingPrice) {
      if (!finalAmount || finalAmount <= 0) {
        finalAmount = Number((matchedProduct.sellingPrice * finalQuantity).toFixed(2));
      }
    }

    // Build Restock Items List
    const restockItems: RestockItem[] = [];
    if (parsed.intent === 'restock_suggestion' || Array.isArray(parsed.restockRecommendations)) {
      if (Array.isArray(parsed.restockRecommendations)) {
        for (const rec of parsed.restockRecommendations) {
          const prod = inventory.find((p) => p.id === rec.productId);
          if (prod) {
            restockItems.push({
              productId: prod.id,
              productName: prod.name,
              currentStock: prod.currentStock ?? 0,
              minStockAlert: prod.minStockAlert,
              suggestedAdd: rec.suggestedAdd || Math.max(5, prod.minStockAlert * 2),
              unit: prod.unit,
              reason: rec.reason || `स्टॉक कम है (${prod.currentStock ?? 0} ${prod.unit} बचा है)`,
            });
          }
        }
      }

      if (restockItems.length === 0) {
        const lowStock = inventory.filter(
          (p) => typeof p.currentStock === 'number' && p.currentStock <= p.minStockAlert
        );
        for (const prod of lowStock) {
          restockItems.push({
            productId: prod.id,
            productName: prod.name,
            currentStock: prod.currentStock ?? 0,
            minStockAlert: prod.minStockAlert,
            suggestedAdd: prod.unit === 'kg' ? 10 : 5,
            unit: prod.unit,
            reason: `मौजूदा स्टॉक (${prod.currentStock ?? 0} ${prod.unit}) चेतावनी सीमा (${prod.minStockAlert}) से कम है`,
          });
        }
      }
    }

    // Map parsed products if intent is inventory_add
    const parsedProducts: ParsedProductItem[] = [];
    if (parsed.intent === 'inventory_add' && Array.isArray(parsed.parsedProducts)) {
      for (const p of parsed.parsedProducts) {
        const existing = inventory.find(
          (inv) => inv.name.toLowerCase() === p.name.toLowerCase()
        );
        parsedProducts.push({
          name: p.name,
          brandOrVariant: p.brandOrVariant,
          unit: (p.unit as UnitType) || 'kg',
          category: p.category || 'किराना / राशन',
          openingStock: typeof p.openingStock === 'number' ? p.openingStock : null,
          sellingPrice: typeof p.sellingPrice === 'number' ? p.sellingPrice : null,
          isExisting: Boolean(existing),
          matchedProductId: existing?.id,
        });
      }
    }

    // Check if critical entity is missing for actionable transactions
    let isAmbiguous = Boolean(parsed.isAmbiguous);
    let clarificationQuestion = parsed.clarificationQuestion;
    let finalIntent = parsed.intent;

    if (parsed.intent === 'sale' && !matchedProduct) {
      isAmbiguous = true;
      finalIntent = 'unknown';
      clarificationQuestion =
        clarificationQuestion ||
        'सामान का नाम पहचान में नहीं आया। कृपया दुकान में मौजूद सामान का नाम बताएं।';
    } else if (
      (parsed.intent === 'udhaar_given' || parsed.intent === 'udhaar_received') &&
      !matchedCustomer
    ) {
      isAmbiguous = true;
      finalIntent = 'unknown';
      clarificationQuestion =
        clarificationQuestion ||
        'ग्राहक का नाम नहीं मिला। कृपया खाता में मौजूद ग्राहक का नाम बताएं।';
    } else if (
      (parsed.intent === 'udhaar_given' || parsed.intent === 'udhaar_received') &&
      (!finalAmount || finalAmount <= 0)
    ) {
      isAmbiguous = true;
      finalIntent = 'unknown';
      clarificationQuestion =
        clarificationQuestion || 'कृपया उधार या जमा की सही रकम (₹) बताएं।';
    }

    let spokenResponse = parsed.spokenResponse ? cleanTextForSpeech(parsed.spokenResponse) : '';
    if (!spokenResponse) {
      if (isAmbiguous) {
        spokenResponse = clarificationQuestion || 'कृपया थोड़ी और जानकारी स्पष्ट बताएं।';
      } else if (finalIntent === 'sale' && matchedProduct) {
        spokenResponse = `${finalQuantity} ${parsed.unit || matchedProduct.unit} ${matchedProduct.name} की बिक्री का पूर्वावलोकन तैयार है। क्या आप इसे सेव करना चाहते हैं?`;
      } else if (finalIntent === 'inventory_add' && parsedProducts.length > 0) {
        spokenResponse = `आपकी दुकान में ${parsedProducts.length} सामान सेव हो गए हैं।`;
      } else if (finalIntent === 'udhaar_given' && matchedCustomer) {
        spokenResponse = `${matchedCustomer.name} के खाते में ${finalAmount} रुपये उधार दर्ज करने का पूर्वावलोकन तैयार है। क्या आप इसे सेव करना चाहते हैं?`;
      } else if (finalIntent === 'udhaar_received' && matchedCustomer) {
        spokenResponse = `${matchedCustomer.name} से ${finalAmount} रुपये जमा दर्ज करने का पूर्वावलोकन तैयार है। क्या आप इसे सेव करना चाहते हैं?`;
      } else if (finalIntent === 'stock_add' && matchedProduct) {
        spokenResponse = `${matchedProduct.name} में ${finalQuantity} ${parsed.unit || matchedProduct.unit} नया स्टॉक जोड़ने का पूर्वावलोकन तैयार है। क्या आप इसे सेव करना चाहते हैं?`;
      } else if (finalIntent === 'restock_suggestion') {
        spokenResponse =
          restockItems.length > 0
            ? `दुकान में स्टॉक सुझाव तैयार है। ${restockItems.map((r) => r.productName).join(', ')} का स्टॉक कम है।`
            : 'दुकान में सभी रिकॉर्डेड सामान पर्याप्त मात्रा में उपलब्ध हैं।';
      } else if (parsed.message) {
        spokenResponse = cleanTextForSpeech(parsed.message);
      } else {
        spokenResponse = 'आपका अनुरोध समझ लिया गया है।';
      }
    }

    const result: AIParseResult = {
      rawText: trimmedMessage,
      intent: finalIntent,
      intentLabelHindi: parsed.intentLabelHindi || 'स्मार्ट सहायक',
      confidence: Number(parsed.confidence) || 0.9,
      matchedProduct,
      matchedCustomer,
      quantity: finalQuantity,
      unit: (parsed.unit as UnitType) || matchedProduct?.unit,
      amount: finalAmount,
      notes: parsed.notes,
      message: parsed.message,
      spokenResponse,
      restockItems: restockItems.length > 0 ? restockItems : undefined,
      parsedProducts: parsedProducts.length > 0 ? parsedProducts : undefined,
      autoSavedCount: parsedProducts.length,
      isAmbiguous,
      clarificationQuestion,
      source: 'gemini',
    };

    return NextResponse.json({
      success: true,
      result,
      source: 'gemini',
    });
  } catch (err: unknown) {
    const errorObj = err as { message?: string; status?: number } | undefined;
    const errorMessage = errorObj?.message || 'Unknown error';

    if(err instanceof PilotError)return NextResponse.json({success:false,error:err.message},{status:err.status});
    console.error('AI request failed; provider details withheld.');

    const isQuotaOrRateLimit =
      errorMessage.includes('429') ||
      errorMessage.includes('RESOURCE_EXHAUSTED') ||
      errorObj?.status === 429;

    const friendlyMessage = isQuotaOrRateLimit
      ? 'Gemini API की सीमा (Rate limit) पार हो गई है। कृपया कुछ देर बाद प्रयास करें या लोकल पार्सर चुनें।'
      : 'Gemini AI सेवा से संपर्क नहीं हो सका। कृपया पुनः प्रयास करें या ऑफलाइन लोकल पार्सर चुनें।';

    return NextResponse.json(
      {
        success: false,
        error: isQuotaOrRateLimit ? 'RATE_LIMIT_EXCEEDED' : 'GEMINI_REQUEST_FAILED',
        message: friendlyMessage,
        source: 'gemini',
      },
      { status: isQuotaOrRateLimit ? 429 : 502 }
    );
  }
}
