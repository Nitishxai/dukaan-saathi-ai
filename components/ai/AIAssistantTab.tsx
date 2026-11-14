'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  Send,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  X,
  Info,
  Package,
  User,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  Bot,
  HelpCircle,
  Zap,
  Globe,
  Edit3,
} from 'lucide-react';
import { Customer, Product, Sale, UdhaarTransaction, AIParseResult, AssistantApiResponse, RestockItem, ProductConversationState } from '../../types';
import {
  isProductOnboardingTrigger,
  startProductConversation,
  processProductConversationTurn,
  convertDraftToProducts,
} from '../../lib/product-conversation';
import { prepareAIDraft, draftSpeech } from '../../lib/ai-draft';
import { normalizeQuantity } from '../../lib/units';
import { parseHinglishCommand } from '../../lib/ai-parser';
import { formatCurrency } from '../../lib/formatters';
import {
  getStoreData,
  recordSale,
  recordUdhaarTransaction,
  quickAddStock,
  calculateDailySales,
  saveProductsBatch,
} from '../../lib/storage';
import {
  extractTranscripts,
  getSpeechErrorMessage,
  SUPPORTED_VOICE_LANGUAGES,
  VoiceLanguageCode,
  SpeechEventLike,
} from '../../lib/speech-utils';

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface WindowWithSpeech {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
}

type VoiceAssistantStatus = 'idle' | 'listening' | 'thinking' | 'speaking' | 'ready';

interface AIAssistantTabProps {
  products: Product[];
  customers: Customer[];
  sales?: Sale[];
  udhaarTransactions?: UdhaarTransaction[];
  onRefresh: () => void;
  onNavigateToTab?: (tab: 'dashboard' | 'inventory' | 'sales' | 'udhaar') => void;
  shopName?: string;
  ownerName?: string;
}

export const AIAssistantTab: React.FC<AIAssistantTabProps> = ({
  products,
  customers,
  sales = [],
  udhaarTransactions = [],
  onRefresh,
  onNavigateToTab,
  shopName = 'Dukaan Sathi',
  ownerName = 'Shopkeeper',
}) => {
  const [inputText, setInputText] = useState('');
  const [aiEngineMode, setAiEngineMode] = useState<'gemini' | 'local'>('local');
  const [voiceStatus, setVoiceStatus] = useState<VoiceAssistantStatus>('idle');
  const [voiceLang, setVoiceLang] = useState<VoiceLanguageCode>('hi-IN');
  const [isMuted, setIsMuted] = useState(false);
  const [lastSpokenText, setLastSpokenText] = useState<string | null>(null);

  // Advanced speech recognition transcript states
  const [interimTranscript, setInterimTranscript] = useState('');
  const [editableTranscript, setEditableTranscript] = useState('');
  const [rawDebugTranscript, setRawDebugTranscript] = useState('');
  const [speechConfidence, setSpeechConfidence] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);
  const isSubmittingTransactionRef = useRef(false);
  const [previewResult, setPreviewResultState] = useState<AIParseResult | null>(null);
  const setPreviewResult = (result: AIParseResult | null) => setPreviewResultState(result ? prepareAIDraft(result, getStoreData()) : null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [speechErrorNotice, setSpeechErrorNotice] = useState<string | null>(null);
  const [productConversation, setProductConversation] = useState<ProductConversationState | null>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);

  // References for unmount cleanup and instance management
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isComponentMounted = useRef(true);
  const requestController = useRef<AbortController | null>(null);

  // Calculate accurate today's sales summary
  const dailySales = useMemo(() => {
    return calculateDailySales(sales, udhaarTransactions);
  }, [sales, udhaarTransactions]);

  // Suggested Prompts (Natural Hindi/Hinglish Voice Commands)
  const suggestions = [
    'मेरी दुकान में आटा, चावल, सरसों तेल और बिस्कुट बिकते हैं। इनको मेरी इन्वेंटरी में सेव कर लो।',
    'मेरी दुकान में मैगी भी ऐड कर दो।',
    'आटा का ओपनिंग स्टॉक 25 किलो है और सेलिंग प्राइस 40 रुपये किलो है। सेव कर लो।',
    'मेरे पास कितना चावल बचा है?',
    'आज कितने रुपये की सेल हुई?',
    'आज कितना सामान बिका?',
    'कौन-कौन सा सामान खत्म हो गया है?',
    'कौनसा स्टॉक मंगवाना चाहिए?',
    'आज की total cash sale और udhaar sale अलग-अलग बताओ।',
    'आज 3 किलो चीनी बिकी',
    'रमेश ने 500 रुपये उधार लिए',
    'शर्मा जी ने 300 रुपये जमा किए',
  ];

  // Clean raw markdown, bold symbols, and currency for crisp Speech Synthesis
  const cleanSpeechText = (text: string): string => {
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
  };

  // Text-To-Speech (TTS) using window.speechSynthesis
  const speakText = useCallback(
    (textToSpeak: string) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;

      // Always cancel any prior speech to prevent overlapping voices
      window.speechSynthesis.cancel();

      if (isMuted) return;

      const cleanText = cleanSpeechText(textToSpeak);
      if (!cleanText) return;

      setLastSpokenText(cleanText);

      try {
        const utterance = new SpeechSynthesisUtterance(cleanText);

        // Select Hindi or Indian voice if available
        const voices = window.speechSynthesis.getVoices();
        const hindiVoice = voices.find(
          (v) =>
            v.lang.toLowerCase().startsWith('hi') ||
            v.name.toLowerCase().includes('hindi') ||
            v.name.toLowerCase().includes('hemant') ||
            v.name.toLowerCase().includes('kalpana')
        );
        const indianVoice = voices.find(
          (v) =>
            v.lang.toLowerCase().includes('en-in') ||
            v.name.toLowerCase().includes('india') ||
            v.name.toLowerCase().includes('neerja') ||
            v.name.toLowerCase().includes('prabhat')
        );

        if (hindiVoice) {
          utterance.voice = hindiVoice;
          utterance.lang = 'hi-IN';
        } else if (indianVoice) {
          utterance.voice = indianVoice;
          utterance.lang = 'en-IN';
        } else {
          utterance.lang = voiceLang;
        }

        utterance.rate = 0.95; // Clear and easy to comprehend
        utterance.pitch = 1.0;

        utterance.onstart = () => {
          if (isComponentMounted.current) {
            setVoiceStatus('speaking');
          }
        };

        utterance.onend = () => {
          if (isComponentMounted.current) {
            setVoiceStatus('ready');
          }
        };

        utterance.onerror = () => {
          if (isComponentMounted.current) {
            setVoiceStatus('ready');
          }
        };

        window.speechSynthesis.speak(utterance);
      } catch {
        setVoiceStatus('ready');
      }
    },
    [isMuted, voiceLang]
  );

  // Stop any ongoing speech playback
  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setVoiceStatus('ready');
    }
  };

  // Repeat the last spoken assistant response
  const handleRepeatResponse = () => {
    if (lastSpokenText) {
      speakText(lastSpokenText);
    }
  };

  // Process command using active or selected engine
  const handleProcess = async (
    textToProcess?: string,
    overrideMode?: 'gemini' | 'local'
  ) => {
    const text = (textToProcess !== undefined ? textToProcess : inputText).trim();
    if (!text) return;

    const mode = overrideMode || aiEngineMode;
    setSuccessMessage(null);
    setExecutionError(null);
    setApiError(null);
    setSpeechErrorNotice(null);
    stopSpeaking();

    setVoiceStatus('thinking');

    // 0. Active Guided Product Onboarding Conversation Turn
    if (productConversation && productConversation.isActive) {
      const turn = processProductConversationTurn(productConversation, text, products);
      if (turn.isCancelled) {
        setProductConversation(null);
        setQuickReplies([]);
        setPreviewResult(null);
        setVoiceStatus('ready');
        speakText(turn.aiReply);
        return;
      }
      setProductConversation(turn.nextState);
      setQuickReplies(turn.quickReplies || []);
      setVoiceStatus('ready');
      speakText(turn.aiReply);

      if (turn.nextState.step === 'ready_for_confirmation') {
        const parsedProducts = convertDraftToProducts(turn.nextState.draft);
        setPreviewResult({
          rawText: text,
          intent: 'inventory_add',
          intentLabelHindi: 'नया सामान इन्वेंटरी में जोड़ें',
          confidence: 0.95,
          parsedProducts,
          message: turn.aiReply,
          spokenResponse: turn.aiReply,
          source: 'local_rules',
        });
      }
      return;
    }

    // Check if new conversational product onboarding should be triggered
    if (isProductOnboardingTrigger(text)) {
      const started = startProductConversation(text, products);
      setProductConversation(started.state);
      setQuickReplies(started.quickReplies || []);
      setVoiceStatus('ready');
      speakText(started.aiReply);

      if (started.state.step === 'ready_for_confirmation') {
        const parsedProducts = convertDraftToProducts(started.state.draft);
        setPreviewResult({
          rawText: text,
          intent: 'inventory_add',
          intentLabelHindi: 'नया सामान इन्वेंटरी में जोड़ें',
          confidence: 0.95,
          parsedProducts,
          message: started.aiReply,
          spokenResponse: started.aiReply,
          source: 'local_rules',
        });
      }
      return;
    }

    // Offline / Local Rules Engine
    if (mode === 'local') {
      const result = parseHinglishCommand(text, products, customers, dailySales);
      setPreviewResult(result);
      setVoiceStatus('ready');

      // Speak response if available
      if (result.spokenResponse) {
        speakText(draftSpeech(result));
      } else if (result.message) {
        speakText(draftSpeech(result));
      }
      return;
    }

    // Google Gemini API Engine
    setIsLoading(true);
    try {
      const requestedShopId = getStoreData().profile.id;
      requestController.current?.abort();
      requestController.current = new AbortController();
      const response = await fetch('/api/assistant', {
        signal: AbortSignal.any([requestController.current.signal, AbortSignal.timeout(15000)]),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          inventory: products,
          customers,
          shopName,
          ownerName,
          todaySalesTotal: dailySales.grossSales,
          todaySalesCount: dailySales.completedSalesCount,
          todaySalesSummary: dailySales,
        }),
      });

      const data: AssistantApiResponse = await response.json();
      if (!isComponentMounted.current || requestedShopId !== getStoreData().profile.id) return;

      if (!response.ok || !data.success || !data.result) {
        const errorMsg =
          data.message || 'Gemini AI से संपर्क नहीं हो सका। ऑफलाइन लोकल पार्सर द्वारा उत्तर दिया जा रहा है।';
        setApiError(errorMsg);

        // Fall back gracefully to local rules parser so shopkeeper always gets answers
        const fallbackResult = parseHinglishCommand(text, products, customers, dailySales);
        setPreviewResult(fallbackResult);
        setVoiceStatus('ready');

        if (fallbackResult.spokenResponse) {
          speakText(draftSpeech(fallbackResult));
        } else if (fallbackResult.message) {
          speakText(draftSpeech(fallbackResult));
        }
        return;
      }

      setPreviewResult(data.result);
      setVoiceStatus('ready');

      // Speak response
      if (data.result.spokenResponse) {
        speakText(draftSpeech(data.result));
      } else if (data.result.message) {
        speakText(draftSpeech(data.result));
      }
    } catch {
      if (!isComponentMounted.current) return;
      const netMsg =
        'नेटवर्क से संपर्क नहीं हो सका। ऑफलाइन लोकल पार्सर द्वारा उत्तर दिया जा रहा है।';
      setApiError(netMsg);

      // Fall back gracefully to local rules parser
      const fallbackResult = parseHinglishCommand(text, products, customers, dailySales);
      setPreviewResult(fallbackResult);
      setVoiceStatus('ready');

      if (fallbackResult.spokenResponse) {
        speakText(draftSpeech(fallbackResult));
      } else if (fallbackResult.message) {
        speakText(draftSpeech(fallbackResult));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Send speech transcript to AI engine (Gemini or Local Parser)
  const handleSendSpeechToAI = (textToSendOverride?: string) => {
    const textToSend = (textToSendOverride !== undefined ? textToSendOverride : editableTranscript).trim();
    if (!textToSend || isLoading) return;

    handleProcess(textToSend, aiEngineMode);
  };

  // Start or Stop Speech Recognition
  const handleToggleVoice = () => {
    if (typeof window === 'undefined') return;

    const win = window as unknown as WindowWithSpeech;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setSpeechErrorNotice(getSpeechErrorMessage('unsupported-browser'));
      return;
    }

    // If currently listening, stop it cleanly
    if (voiceStatus === 'listening') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore error
        }
      }
      setVoiceStatus('idle');
      setInterimTranscript('');
      return;
    }

    // Stop speaking if assistant is currently talking
    stopSpeaking();
    setSpeechErrorNotice(null);
    setInterimTranscript('');

    try {
      const recognition = new SpeechRecognitionClass();
      recognitionRef.current = recognition;
      recognition.lang = voiceLang; // 'hi-IN' or 'en-IN'
      recognition.interimResults = true; // Show live interim text while speaking
      recognition.continuous = false; // Only record single turn after explicit user click
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        if (isComponentMounted.current) {
          setVoiceStatus('listening');
          setInterimTranscript('');
        }
      };

      recognition.onresult = (event: SpeechEventLike) => {
        if (!isComponentMounted.current) return;
        const extracted = extractTranscripts(event);

        if (extracted.interim) {
          setInterimTranscript(extracted.interim);
        }

        if (extracted.final) {
          setInterimTranscript('');
          setRawDebugTranscript(extracted.final);
          setEditableTranscript(extracted.final);
          setInputText(extracted.final);
          if (typeof extracted.confidence === 'number') {
            setSpeechConfidence(extracted.confidence);
          }
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        if (!isComponentMounted.current) return;
        setVoiceStatus('idle');
        setInterimTranscript('');

        if (event.error !== 'aborted') {
          setSpeechErrorNotice(getSpeechErrorMessage(event.error));
        }
      };

      recognition.onend = () => {
        if (isComponentMounted.current) {
          setVoiceStatus((prev) => (prev === 'listening' ? 'ready' : prev));
          setInterimTranscript('');
        }
      };

      recognition.start();
    } catch {
      setVoiceStatus('idle');
      setInterimTranscript('');
      setSpeechErrorNotice(getSpeechErrorMessage('audio-capture'));
    }
  };

  // Pre-load voices on component mount and clean up on unmount
  useEffect(() => {
    isComponentMounted.current = true;

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.getVoices();
        };
      }
    }

    return () => {
      isComponentMounted.current = false;
      requestController.current?.abort();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore abort error on unmount
        }
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 1-Click Quick Restock from Suggestions
  const handleQuickRestockItem = (item: RestockItem) => {
    const qty = item.suggestedAdd || 10;
    const res = quickAddStock(item.productId, qty);
    if (res.success) {
      const msg = `नया स्टॉक जोड़ा गया! ${item.productName} में +${qty} ${item.unit}। नया स्टॉक: ${
        getStoreData().products.find(p => p.id === item.productId)?.currentStock
      } ${item.unit}`;
      setSuccessMessage(msg);
      speakText(`${item.productName} में ${qty} ${item.unit} नया स्टॉक जोड़ दिया गया है।`);
      onRefresh();
    } else {
      setExecutionError(res.error || 'स्टॉक जोड़ा नहीं जा सका');
    }
  };

  // Safe Transaction Execution (Requires explicit user confirmation button click)
  const handleConfirmAction = () => {
    if (!previewResult || isSubmittingTransactionRef.current || isSubmittingTransaction) return;
    isSubmittingTransactionRef.current = true;
    setExecutionError(null);
    setIsSubmittingTransaction(true);

    try {
      const { intent, amount, notes } = previewResult;
      const current = getStoreData();
      if (previewResult.shopId !== current.profile.id) { setExecutionError('Shop changed. Create a new preview.'); return; }
      const matchedProduct = current.products.find(p => p.id === previewResult.matchedProduct?.id);
      const matchedCustomer = current.customers.find(c => c.id === previewResult.matchedCustomer?.id);
      const quantity = matchedProduct && previewResult.quantity
        ? normalizeQuantity(previewResult.quantity, previewResult.unit || matchedProduct.unit, matchedProduct.unit)
        : previewResult.quantity;
      if (previewResult.matchedProduct && (!matchedProduct || matchedProduct.sellingPrice !== previewResult.matchedProduct.sellingPrice)) {
        setExecutionError('Product or price changed. Please create a fresh preview.'); return;
      }

      if (intent === 'sale') {
        if (!matchedProduct || !quantity) {
          setExecutionError('सामान या मात्रा अधूरी है');
          setIsSubmittingTransaction(false);
          return;
        }

        if (matchedProduct.currentStock === null) {
          const err = `${matchedProduct.name} का ओपनिंग स्टॉक दर्ज नहीं है। कृपया पहले इन्वेंटरी में स्टॉक दर्ज करें।`;
          setExecutionError(err);
          speakText(err);
          setIsSubmittingTransaction(false);
          return;
        }

        if (matchedProduct.sellingPrice === null) {
          const err = `${matchedProduct.name} का बिक्री मूल्य दर्ज नहीं है। कृपया पहले मूल्य जोड़ें।`;
          setExecutionError(err);
          speakText(err);
          setIsSubmittingTransaction(false);
          return;
        }

        if (matchedProduct.currentStock < quantity) {
          const err = `स्टॉक पर्याप्त नहीं है! ${matchedProduct.name} का सिर्फ ${matchedProduct.currentStock} ${matchedProduct.unit} उपलब्ध है।`;
          setExecutionError(err);
          speakText(err);
          setIsSubmittingTransaction(false);
          return;
        }

        const price = matchedProduct.sellingPrice;
        const res = recordSale({
          operationId: previewResult.operationId,
          shopId: previewResult.shopId,
          items: [
            {
              productId: matchedProduct.id,
              productName: matchedProduct.name,
              unit: matchedProduct.unit,
              quantity,
              unitPrice: price,
              totalPrice: Number((price * quantity).toFixed(2)),
            },
          ],
          paymentMode: 'cash',
          notes: notes || 'साथी AI द्वारा दर्ज बिक्री',
        });

        if (!res.success) {
          setExecutionError(res.error || 'बिक्री दर्ज नहीं हो सकी');
          setIsSubmittingTransaction(false);
          return;
        }

        const newRemainingStock = getStoreData().products.find(p => p.id === matchedProduct.id)?.currentStock;
        const successText = `बिक्री सफल! ${matchedProduct.name} (${quantity} ${matchedProduct.unit}) दर्ज कर दिया गया। नया स्टॉक: ${newRemainingStock} ${matchedProduct.unit}`;
        setSuccessMessage(successText);
        speakText(`बिक्री सेव हो गई! ${matchedProduct.name} की सेल दर्ज कर दी गई है।`);
      } else if (intent === 'udhaar_given') {
        if (!matchedCustomer || !amount) {
          setExecutionError('ग्राहक या रकम अधूरी है');
          setIsSubmittingTransaction(false);
          return;
        }

        const res = recordUdhaarTransaction({
          customerId: matchedCustomer.id,
          type: 'credit_given',
          amount,
          notes: notes || 'साथी AI द्वारा उधार दर्ज',
        });

        if (!res.success) {
          setExecutionError(res.error || 'उधार दर्ज नहीं हो सका');
          setIsSubmittingTransaction(false);
          return;
        }

        const newBal = getStoreData().customers.find(c => c.id === matchedCustomer.id)?.currentBalance;
        const successText = `उधार दर्ज! ${matchedCustomer.name} के खाते में ₹${amount} जोड़ा गया। नया बकाया: ₹${newBal}`;
        setSuccessMessage(successText);
        speakText(`उधार सेव हो गया! ${matchedCustomer.name} के खाते में ${amount} रुपये जोड़ दिए गए हैं।`);
      } else if (intent === 'udhaar_received') {
        if (!matchedCustomer || !amount) {
          setExecutionError('ग्राहक या रकम अधूरी है');
          setIsSubmittingTransaction(false);
          return;
        }

        const res = recordUdhaarTransaction({
          customerId: matchedCustomer.id,
          type: 'payment_received',
          amount,
          notes: notes || 'साथी AI द्वारा जमा दर्ज',
        });

        if (!res.success) {
          setExecutionError(res.error || 'जमा दर्ज नहीं हो सका');
          setIsSubmittingTransaction(false);
          return;
        }

        const newBal = getStoreData().customers.find(c => c.id === matchedCustomer.id)?.currentBalance;
        const successText = `जमा दर्ज! ${matchedCustomer.name} से ₹${amount} प्राप्त हुए। नया बकाया: ₹${newBal}`;
        setSuccessMessage(successText);
        speakText(`जमा सेव हो गया! ${matchedCustomer.name} से ${amount} रुपये जमा दर्ज हो गए हैं।`);
      } else if (intent === 'stock_add') {
        if (!matchedProduct || !quantity) {
          setExecutionError('सामान या मात्रा अधूरी है');
          setIsSubmittingTransaction(false);
          return;
        }

        const res = quickAddStock(matchedProduct.id, quantity);
        if (!res.success) {
          setExecutionError(res.error || 'स्टॉक जोड़ा नहीं जा सका');
          setIsSubmittingTransaction(false);
          return;
        }

        const newTotalStock = getStoreData().products.find(p => p.id === matchedProduct.id)?.currentStock;
        const successText = `नया स्टॉक जोड़ा गया! ${matchedProduct.name} में +${quantity} ${matchedProduct.unit}। नया स्टॉक: ${newTotalStock} ${matchedProduct.unit}`;
        setSuccessMessage(successText);
        speakText(`नया स्टॉक सेव हो गया! ${matchedProduct.name} में स्टॉक जोड़ दिया गया है।`);
      } else if (intent === 'inventory_add') {
        if (!previewResult.parsedProducts || previewResult.parsedProducts.length === 0) {
          setExecutionError('सेव करने के लिए कोई सामान नहीं मिला');
          setIsSubmittingTransaction(false);
          return;
        }

        const res = saveProductsBatch(previewResult.parsedProducts);
        if (!res.success) {
          setExecutionError(res.error || 'इन्वेंटरी में सामान सेव नहीं हो सका');
          setIsSubmittingTransaction(false);
          return;
        }

        const savedCount = res.savedProducts.length;
        const successText = `इन्वेंटरी सेव सफल! ${savedCount} सामान दुकान में सुरक्षित हो गए हैं (${res.addedCount} नया, ${res.updatedCount} अपडेट)।`;
        setSuccessMessage(successText);
        speakText(`इन्वेंटरी सेव हो गई! ${savedCount} सामान आपकी दुकान में जोड़ दिए गए हैं।`);
      }

      setPreviewResult(null);
      setProductConversation(null);
      setQuickReplies([]);
      setInputText('');
      onRefresh();
    } finally {
      setIsSubmittingTransaction(false);
      isSubmittingTransactionRef.current = false;
    }
  };

  // Quick Reply Click Handler for Conversational Onboarding
  const handleQuickReplyClick = (reply: string) => {
    if (reply === 'Confirm & Save' || reply === 'कन्फर्म और सेव') {
      handleConfirmAction();
      return;
    }
    if (reply === 'रद्द करें' || reply === 'Cancel') {
      setProductConversation(null);
      setQuickReplies([]);
      setPreviewResult(null);
      speakText('सामान जोड़ने की प्रक्रिया रद्द कर दी गई है।');
      return;
    }
    setInputText(reply);
    handleProcess(reply);
  };

  const isTransactional =
    previewResult &&
    !previewResult.isAmbiguous &&
    !previewResult.errorMessage &&
    ['sale', 'stock_add', 'udhaar_given', 'udhaar_received', 'inventory_add'].includes(previewResult.intent);

  // Status message translation
  const getStatusBadge = () => {
    switch (voiceStatus) {
      case 'listening':
        return {
          text: 'Listening... (Boliye, main sun raha hoon)',
          color: 'bg-red-500 text-white animate-pulse',
          subtext: 'Microphone active, speak your store command',
        };
      case 'thinking':
        return {
          text: 'Thinking... (Samajh raha hoon…)',
          color: 'bg-amber-500 text-white animate-pulse',
          subtext: 'AI Assistant is analyzing your query...',
        };
      case 'speaking':
        return {
          text: 'Speaking... (Bol raha hoon…)',
          color: 'bg-indigo-600 text-white animate-pulse',
          subtext: 'Playing voice response',
        };
      case 'ready':
        return {
          text: 'Response Ready (Jawab taiyar hai)',
          color: 'bg-emerald-600 text-white',
          subtext: 'Review answer and transaction preview below',
        };
      default:
        return {
          text: 'Speak or Type Command',
          color: 'bg-slate-700 text-slate-200',
          subtext: 'Tap the mic to speak or enter your query below',
        };
    }
  };

  const statusInfo = getStatusBadge();

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-4xl mx-auto">
      {/* 1. Header & Engine Controls */}
      <div className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 rounded-2xl p-5 sm:p-6 text-white shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
              <Sparkles className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                Dukaan Sathi AI Voice Assistant
              </h2>
              <p className="text-emerald-100 text-xs sm:text-sm">
                Manage sales, stock, and credit via voice or text in Hindi & Hinglish
              </p>
            </div>
          </div>

          {/* Engine Selector Segmented Control */}
          <div className="flex items-center bg-black/30 p-1 rounded-xl border border-white/10 self-start sm:self-auto text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setAiEngineMode('gemini');
                setApiError(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                aiEngineMode === 'gemini'
                  ? 'bg-emerald-500 text-white shadow-xs font-bold'
                  : 'text-emerald-100 hover:text-white hover:bg-white/10'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Google Gemini AI</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse" />
            </button>
            <button
              type="button"
              onClick={() => {
                setAiEngineMode('local');
                setApiError(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                aiEngineMode === 'local'
                  ? 'bg-emerald-500 text-white shadow-xs font-bold'
                  : 'text-emerald-100 hover:text-white hover:bg-white/10'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Local Parser</span>
            </button>
          </div>
        </div>

        {/* Engine Status / Info Bar */}
        <div className="p-3 bg-black/20 rounded-xl border border-white/10 text-xs text-emerald-100 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
          <div className="flex-1">
            {aiEngineMode === 'gemini' ? (
              <span>
                <strong className="text-white">Google Gemini AI Online: </strong>
                Conversational model that understands natural Hindi and Hinglish based on your store&apos;s real inventory, customer ledgers, and today&apos;s sales.
              </span>
            ) : (
              <span>
                <strong className="text-white">Local Rule Parser (Offline Mode): </strong>
                In-browser deterministic rule engine that works securely without external internet APIs or quota limits.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. PROMINENT ANIMATED VOICE ASSISTANT HERO CARD */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 sm:p-8 text-center relative overflow-hidden space-y-6">
        {/* Subtle Decorative Background Glow */}
        <div
          className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${
            voiceStatus === 'listening'
              ? 'bg-red-50/50 opacity-100'
              : voiceStatus === 'speaking'
              ? 'bg-indigo-50/50 opacity-100'
              : 'opacity-0'
          }`}
        />

        {/* Status Badge */}
        <div className="relative inline-flex flex-col items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold tracking-wide uppercase transition-all shadow-xs ${statusInfo.color}`}
          >
            {voiceStatus === 'listening' && (
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            )}
            {voiceStatus === 'speaking' && (
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            )}
            {voiceStatus === 'thinking' && (
              <RefreshCw className="w-3 h-3 text-white animate-spin" />
            )}
            <span>{statusInfo.text}</span>
          </span>
          <p className="text-[11px] text-slate-500 font-medium">{statusInfo.subtext}</p>
        </div>

        {/* Central Animated Microphone Button */}
        <div className="relative flex items-center justify-center py-2">
          {/* Animated Ripples when Listening */}
          {voiceStatus === 'listening' && (
            <>
              <div className="absolute w-28 h-28 rounded-full bg-red-400/25 animate-ping pointer-events-none" />
              <div className="absolute w-36 h-36 rounded-full bg-red-500/15 animate-pulse pointer-events-none" />
            </>
          )}

          {/* Animated Ripples when Speaking */}
          {voiceStatus === 'speaking' && (
            <>
              <div className="absolute w-28 h-28 rounded-full bg-indigo-400/25 animate-ping pointer-events-none" />
              <div className="absolute w-36 h-36 rounded-full bg-indigo-500/15 animate-pulse pointer-events-none" />
            </>
          )}

          {/* Main Large Mic Button */}
          <button
            type="button"
            onClick={handleToggleVoice}
            disabled={isLoading}
            className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-xl focus:outline-none focus:ring-4 cursor-pointer ${
              voiceStatus === 'listening'
                ? 'bg-red-600 hover:bg-red-700 text-white ring-8 ring-red-100 scale-105'
                : voiceStatus === 'speaking'
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-8 ring-indigo-100'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white ring-8 ring-emerald-50 hover:scale-105 active:scale-95'
            }`}
            title={voiceStatus === 'listening' ? 'Stop Listening' : 'Start Listening'}
          >
            {voiceStatus === 'listening' ? (
              <>
                <MicOff className="w-9 h-9" />
                <span className="text-[10px] font-bold mt-1 uppercase">Stop</span>
              </>
            ) : voiceStatus === 'speaking' ? (
              <>
                <Volume2 className="w-9 h-9" />
                <span className="text-[10px] font-bold mt-1 uppercase">Speaking</span>
              </>
            ) : (
              <>
                <Mic className="w-9 h-9" />
                <span className="text-[10px] font-bold mt-1 uppercase">Speak</span>
              </>
            )}
          </button>
        </div>

        {/* Language & Audio Controls Bar */}
        <div className="relative flex flex-wrap items-center justify-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Visible Language Selector (Requirement 2) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            {SUPPORTED_VOICE_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setVoiceLang(lang.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  voiceLang === lang.code
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
                title={`Language: ${lang.label}`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{lang.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Mute / Unmute Toggle */}
            <button
              type="button"
              onClick={() => {
                if (!isMuted) stopSpeaking();
                setIsMuted(!isMuted);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold transition-colors cursor-pointer ${
                isMuted
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
              }`}
              title={isMuted ? 'Unmute voice' : 'Mute voice'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-amber-600" /> : <Volume2 className="w-3.5 h-3.5 text-slate-500" />}
              <span>{isMuted ? 'Muted' : 'Sound On'}</span>
            </button>

            {/* Repeat Response Button */}
            <button
              type="button"
              onClick={handleRepeatResponse}
              disabled={!lastSpokenText}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold transition-colors cursor-pointer"
              title="Repeat last spoken response"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Repeat Voice</span>
            </button>
          </div>
        </div>

        {/* Live Interim Speech Bubble (Requirement 4) */}
        {voiceStatus === 'listening' && interimTranscript && (
          <div className="p-3.5 bg-red-50/90 border-2 border-red-300 rounded-2xl text-left space-y-1 animate-in fade-in shadow-xs">
            <div className="flex items-center gap-1.5 text-red-700 font-bold text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span>Listening (Live):</span>
            </div>
            <p className="text-slate-900 text-sm font-semibold italic">
              &ldquo;{interimTranscript}&rdquo;
            </p>
          </div>
        )}

        {/* Editable Transcript Field with Send to AI Button (Requirement 6, 8, 9) */}
        {editableTranscript && (
          <div className="p-4 bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl text-left space-y-3 shadow-xs animate-in zoom-in-95">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Recognized Transcript:</span>
              </span>
              <div className="flex items-center gap-1.5">
                {speechConfidence !== null && (
                  <span className="text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold">
                    Confidence: {Math.round(speechConfidence * 100)}%
                  </span>
                )}
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {voiceLang}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                <span>If any word was misheard, edit below and click &ldquo;Send to AI&rdquo;:</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={editableTranscript}
                  onChange={(e) => {
                    setEditableTranscript(e.target.value);
                    setInputText(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isLoading) {
                      handleSendSpeechToAI();
                    }
                  }}
                  placeholder="Recognized sentence (edit if needed)..."
                  className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                />
              </div>
            </div>

            {rawDebugTranscript && rawDebugTranscript !== editableTranscript && (
              <div className="text-[11px] text-slate-500 italic bg-white/70 p-2 rounded-lg border border-emerald-200">
                Original transcript (debug): &ldquo;{rawDebugTranscript}&rdquo;
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSendSpeechToAI()}
                  disabled={!editableTranscript.trim() || isLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Send to AI</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleVoice}
                  disabled={isLoading}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5 text-slate-500" />
                  <span>Retry Voice</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditableTranscript('');
                  setRawDebugTranscript('');
                  setInterimTranscript('');
                }}
                className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1 cursor-pointer font-medium"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Speech Error Notice */}
        {speechErrorNotice && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs font-medium flex items-start gap-2.5 text-left animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">Microphone Notice: </span>
              <span>{speechErrorNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setSpeechErrorNotice(null)}
              className="text-amber-500 hover:text-amber-700 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 3. Text Input & Quick Suggestions Fallback */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Or type command (Hindi / Hinglish text input)
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputText}
              disabled={isLoading}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isLoading) handleProcess(inputText, aiEngineMode);
              }}
              placeholder="e.g. 'Aaj 3 kg cheeni biki', 'Aaj kitni sale hui?', 'Ramesh par kitna udhaar hai?'..."
              className="w-full pl-4 pr-14 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 placeholder-slate-400 font-medium disabled:opacity-60"
            />

            <div className="absolute right-2 flex items-center">
              <button
                type="button"
                onClick={() => handleProcess(inputText, aiEngineMode)}
                disabled={!inputText.trim() || isLoading}
                className="p-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg transition-colors flex items-center justify-center min-w-8 cursor-pointer"
                title="Send"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Active Conversational Onboarding Thread */}
        {productConversation && productConversation.isActive && (
          <div className="bg-emerald-50/70 border-2 border-emerald-500 rounded-2xl p-4 text-left space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-emerald-700" />
                <span className="font-bold text-xs text-emerald-900">
                  Guided Product Onboarding (नया सामान जोड़ें)
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleQuickReplyClick('Cancel')}
                className="text-[11px] font-semibold text-red-600 hover:text-red-800"
              >
                रद्द करें (Cancel)
              </button>
            </div>

            {/* Conversation History */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {productConversation.history.map((h, i) => (
                <div
                  key={i}
                  className={`flex ${h.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-1.5 text-xs ${
                      h.role === 'user'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'bg-white border border-emerald-200 text-slate-800 shadow-2xs'
                    }`}
                  >
                    {h.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Reply Pills */}
            {quickReplies.length > 0 && (
              <div className="pt-2 border-t border-emerald-200/80">
                <div className="text-[11px] font-semibold text-emerald-800 mb-1.5">
                  त्वरित विकल्प (टैप करें):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {quickReplies.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickReplyClick(q)}
                      className="px-3 py-1 rounded-lg bg-white hover:bg-emerald-100 border border-emerald-300 text-xs font-bold text-emerald-800 shadow-2xs transition active:scale-95 cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Suggestion Chips */}
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-2">
            Suggested Voice Commands (Click any example to test):
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setInputText(s);
                  handleProcess(s, aiEngineMode);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 border border-slate-200 text-xs font-medium text-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                💡 {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. API Error Banner with 1-Click Local Fallback */}
      {apiError && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-sm font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-950">Gemini AI Notice</h4>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">{apiError}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleProcess(inputText, 'local')}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Try Local Parser</span>
            </button>
            <button
              type="button"
              onClick={() => setApiError(null)}
              className="p-1 text-amber-500 hover:text-amber-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 5. Success Notification */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-sm font-medium flex items-start gap-3 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-emerald-950">Action Recorded Successfully!</h4>
            <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-700 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 6. Execution Error Banner */}
      {executionError && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-2xl text-red-900 text-sm font-medium flex items-start gap-3 shadow-2xs">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-red-950">Execution Error</h4>
            <p className="text-xs text-red-800 mt-0.5">{executionError}</p>
          </div>
          <button
            onClick={() => setExecutionError(null)}
            className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 7. RESTOCK SUGGESTIONS DISPLAY */}
      {previewResult && previewResult.intent === 'restock_suggestion' && (
        <div className="bg-white rounded-2xl border-2 border-teal-500 p-5 shadow-lg space-y-4 animate-in zoom-in-95">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-teal-100 text-teal-800 rounded-lg">
                <Package className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Restock Recommendations
                </h3>
                <p className="text-xs text-slate-500">
                  {previewResult.source === 'gemini'
                    ? '✨ Inventory analysis by Gemini AI'
                    : '⚡ Inventory analysis by Local Rules'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setPreviewResult(null)}
              className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {previewResult.message && (
            <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
              {previewResult.message}
            </p>
          )}

          {previewResult.restockItems && previewResult.restockItems.length > 0 ? (
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-700">Recommended Products (Low Stock):</div>
              <div className="grid gap-2.5">
                {previewResult.restockItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-teal-50/60 border border-teal-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <span>{item.productName}</span>
                        <span className="text-[11px] font-normal px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                          Stock: {item.currentStock} {item.unit}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1">{item.reason}</p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => handleQuickRestockItem(item)}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>+ Add {item.suggestedAdd} {item.unit}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs">
              Great! All products currently have sufficient stock.
            </div>
          )}

          {onNavigateToTab && (
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => onNavigateToTab('inventory')}
                className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
              >
                <span>View Full Inventory</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 8. CONVERSATIONAL STORE QUERY DISPLAY */}
      {previewResult && previewResult.intent === 'general_query' && (
        <div className="bg-white rounded-2xl border-2 border-blue-400 p-5 shadow-lg space-y-3 animate-in zoom-in-95">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                <Bot className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Assistant Voice & AI Response
                </h3>
                <span className="text-xs text-slate-400 italic">
                  &ldquo;{previewResult.rawText}&rdquo;
                </span>
              </div>
            </div>
            <button
              onClick={() => setPreviewResult(null)}
              className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-sm text-slate-800 leading-relaxed font-medium space-y-2">
            <p>{previewResult.message || previewResult.notes}</p>
            {voiceStatus === 'speaking' && (
              <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold pt-1">
                <Volume2 className="w-4 h-4 animate-pulse" />
                <span>Playing voice response...</span>
              </div>
            )}
          </div>
        </div>
      )}



      {/* 9. AMBIGUOUS OR CLARIFICATION NEEDED DISPLAY */}
      {previewResult &&
        (previewResult.isAmbiguous ||
          previewResult.intent === 'unknown' ||
          previewResult.errorMessage) &&
        previewResult.intent !== 'restock_suggestion' &&
        previewResult.intent !== 'general_query' &&
        previewResult.intent !== 'inventory_add' && (
          <div className="bg-white rounded-2xl border-2 border-amber-400 p-5 shadow-lg space-y-3 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                  <HelpCircle className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Clarification Needed
                  </h3>
                  <span className="text-xs text-slate-400 italic">
                    &ldquo;{previewResult.rawText}&rdquo;
                  </span>
                </div>
              </div>
              <button
                onClick={() => setPreviewResult(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <span>Please clarify:</span>
              </div>
              <p className="mt-1 leading-relaxed">
                {previewResult.clarificationQuestion ||
                  previewResult.message ||
                  previewResult.errorMessage ||
                  'Command was not fully understood. Please clearly state product name, customer name, or quantity.'}
              </p>
            </div>

            {!previewResult.clarificationQuestion && (
              <div className="text-[11px] text-slate-500 pt-1">
                💡 <strong>Example:</strong> <em>&quot;Aaj 3 kg cheeni biki&quot;</em> or <em>&quot;Meri dukaan mein stock ki kami hai&quot;</em>
              </div>
            )}
          </div>
        )}

      {/* 10. CONFIRMATION PREVIEW CARD FOR VALID TRANSACTIONS */}
      {isTransactional && (
        <div className="bg-white rounded-2xl border-2 border-emerald-500 p-5 shadow-lg space-y-4 animate-in zoom-in-95">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Confirmation Preview
                </h3>
                <p className="text-xs text-slate-500">
                  Please confirm if these transaction details are correct:
                </p>
              </div>
            </div>

            <button
              onClick={() => setPreviewResult(null)}
              className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            {/* Intent Badge & Source */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {previewResult.intentLabelHindi}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                  {previewResult.source === 'gemini' ? '✨ Gemini AI' : '⚡ Local Parser'}
                </span>
              </div>
              <span className="text-xs text-slate-400 italic">
                &ldquo;{previewResult.rawText}&rdquo;
              </span>
            </div>

            {/* Parsed Details Table */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-2">
              {previewResult.intent === 'inventory_add' && previewResult.parsedProducts && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between pb-1 border-b border-slate-200">
                    <span>सामान जिन्हें इन्वेंटरी में जोड़ा/अपडेट किया जाएगा:</span>
                    <span className="text-emerald-700 font-extrabold">{previewResult.parsedProducts.length} सामान</span>
                  </div>
                  <div className="grid gap-2 max-h-60 overflow-y-auto">
                    {previewResult.parsedProducts.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-white border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{item.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold">
                              {item.unit}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-600">
                            <span>
                              Opening Stock:{' '}
                              <strong className="text-slate-800">
                                {item.openingStock !== null && item.openingStock !== undefined
                                  ? `${item.openingStock} ${item.unit}`
                                  : 'दर्ज नहीं'}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Selling Price:{' '}
                              <strong className="text-slate-800">
                                {item.sellingPrice !== null && item.sellingPrice !== undefined
                                  ? `₹${item.sellingPrice}`
                                  : 'दर्ज नहीं'}
                              </strong>
                            </span>
                            {item.size && (
                              <>
                                <span>•</span>
                                <span>Size: <strong className="text-slate-800">{item.size}</strong></span>
                              </>
                            )}
                            {item.color && (
                              <>
                                <span>•</span>
                                <span>Color: <strong className="text-slate-800">{item.color}</strong></span>
                              </>
                            )}
                            {item.sku && (
                              <>
                                <span>•</span>
                                <span>SKU: <strong className="font-mono text-slate-800">{item.sku}</strong></span>
                              </>
                            )}
                            {item.barcode && (
                              <>
                                <span>•</span>
                                <span>Barcode: <strong className="font-mono text-slate-800">{item.barcode}</strong></span>
                              </>
                            )}
                            {item.purchasePrice !== null && item.purchasePrice !== undefined && (
                              <>
                                <span>•</span>
                                <span>Purchase: <strong className="text-slate-800">₹{item.purchasePrice}</strong></span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewResult.matchedProduct && (
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-slate-400" />
                    Product:
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {previewResult.matchedProduct.name}
                  </span>
                </div>
              )}

              {previewResult.matchedCustomer && (
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Customer:
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {previewResult.matchedCustomer.name}
                  </span>
                </div>
              )}

              {previewResult.quantity !== undefined && (
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Quantity:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {previewResult.quantity} {previewResult.unit || previewResult.matchedProduct?.unit}
                  </span>
                </div>
              )}

              {previewResult.amount !== undefined && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-700 font-bold">Amount:</span>
                  <span className="font-extrabold text-base text-emerald-700">
                    {formatCurrency(previewResult.amount)}
                  </span>
                </div>
              )}

              {/* Stock or Balance Impact Preview */}
              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600">
                {previewResult.intent === 'sale' && previewResult.matchedProduct && (
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                    <span>
                      Stock Impact:{' '}
                      {previewResult.matchedProduct.currentStock !== null
                        ? `${previewResult.matchedProduct.currentStock} ${previewResult.matchedProduct.unit}`
                        : 'Unrecorded'}{' '}
                      ➔{' '}
                      <strong className="text-slate-900">
                        {previewResult.matchedProduct.currentStock !== null
                          ? previewResult.matchedProduct.currentStock - (previewResult.quantity || 1)
                          : 0}{' '}
                        {previewResult.matchedProduct.unit}
                      </strong>{' '}
                      remaining.
                    </span>
                  </div>
                )}

                {previewResult.intent === 'udhaar_given' && previewResult.matchedCustomer && (
                  <div className="flex items-center gap-1.5 text-red-700">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>
                      Credit Balance Impact: {formatCurrency(previewResult.matchedCustomer.currentBalance)} ➔{' '}
                      <strong>
                        {formatCurrency(
                          previewResult.matchedCustomer.currentBalance + (previewResult.amount || 0)
                        )}
                      </strong>{' '}
                      new balance.
                    </span>
                  </div>
                )}

                {previewResult.intent === 'udhaar_received' && previewResult.matchedCustomer && (
                  <div className="flex items-center gap-1.5 text-emerald-700">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>
                      Credit Balance Impact: {formatCurrency(previewResult.matchedCustomer.currentBalance)} ➔{' '}
                      <strong>
                        {formatCurrency(
                          Math.max(
                            0,
                            previewResult.matchedCustomer.currentBalance - (previewResult.amount || 0)
                          )
                        )}
                      </strong>{' '}
                      new balance.
                    </span>
                  </div>
                )}

                {previewResult.intent === 'stock_add' && previewResult.matchedProduct && (
                  <div className="flex items-center gap-1.5 text-blue-700">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>
                      New Stock:{' '}
                      {previewResult.matchedProduct.currentStock !== null
                        ? `${previewResult.matchedProduct.currentStock} ${previewResult.matchedProduct.unit}`
                        : '0'}{' '}
                      ➔{' '}
                      <strong>
                        {(previewResult.matchedProduct.currentStock ?? 0) + (previewResult.quantity || 1)}{' '}
                        {previewResult.matchedProduct.unit}
                      </strong>{' '}
                      new total.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPreviewResult(null)}
                disabled={isSubmittingTransaction}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={isSubmittingTransaction}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingTransaction ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Confirm & Save</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
