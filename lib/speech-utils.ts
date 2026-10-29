/**
 * Speech Recognition and Audio Utilities for Dukaan Sathi AI.
 * Handles Web Speech API result extraction, language configurations,
 * and user-friendly Hindi error notifications.
 */

export type VoiceLanguageCode = 'hi-IN' | 'en-IN';

export interface VoiceLanguageOption {
  code: VoiceLanguageCode;
  label: string;
  hindiLabel: string;
  shortLabel: string;
}

export const SUPPORTED_VOICE_LANGUAGES: VoiceLanguageOption[] = [
  {
    code: 'hi-IN',
    label: 'हिन्दी (hi-IN)',
    hindiLabel: 'हिन्दी आवाज',
    shortLabel: 'हिन्दी',
  },
  {
    code: 'en-IN',
    label: 'Hinglish / English (en-IN)',
    hindiLabel: 'हिंग्लिश / इंग्लिश आवाज',
    shortLabel: 'Hinglish',
  },
];

export interface SpeechItemLike {
  transcript: string;
  confidence?: number;
}

export interface SpeechResultLike {
  [index: number]: SpeechItemLike;
  isFinal: boolean;
  length: number;
}

export interface SpeechEventLike {
  resultIndex?: number;
  results: {
    [index: number]: SpeechResultLike;
    length: number;
  };
}

export interface ExtractedTranscript {
  interim: string;
  final: string;
  confidence?: number;
}

/**
 * Parses SpeechRecognition event results into interim and final transcripts.
 * Ensures interim speech is separated from finalized transcript and confidence is captured.
 */
export function extractTranscripts(event: SpeechEventLike): ExtractedTranscript {
  let interim = '';
  let final = '';
  let finalConfidence: number | undefined;

  const resultsLength = event.results?.length || 0;

  for (let i = 0; i < resultsLength; i++) {
    const resultItem = event.results[i];
    if (!resultItem) continue;

    const transcriptText = resultItem[0]?.transcript || '';
    if (resultItem.isFinal) {
      final += (final ? ' ' : '') + transcriptText.trim();
      if (typeof resultItem[0]?.confidence === 'number') {
        finalConfidence = resultItem[0].confidence;
      }
    } else {
      interim += (interim ? ' ' : '') + transcriptText.trim();
    }
  }

  return {
    interim: interim.trim(),
    final: final.trim(),
    confidence: finalConfidence,
  };
}

/**
 * Returns understandable Hindi error notifications for Web Speech API error events.
 */
export function getSpeechErrorMessage(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'permission-denied':
      return 'माइक्रोफ़ोन की अनुमति (Permission) नहीं मिली। कृपया ब्राउज़र सेटिंग्स या एड्रेस बार में माइक को Allow करें।';
    case 'no-speech':
      return 'कोई आवाज़ सुनाई नहीं दी। कृपया माइक के पास आकर थोड़ा तेज़ बोलें।';
    case 'network':
      return 'स्पीच रिकग्निशन के लिए नेटवर्क कनेक्शन में समस्या आई। कृपया इंटरनेट कनेक्शन जांचें या नीचे लिखकर हिसाब दर्ज करें।';
    case 'aborted':
      return 'आवाज़ रिकॉर्डिंग रोक दी गई (Aborted)। आप दोबारा माइक दबाकर बोल सकते हैं।';
    case 'audio-capture':
      return 'माइक्रोफ़ोन हार्डवेयर उपलब्ध नहीं है या बंद है। कृपया ऑडियो इनपुट डिवाइस जांचें।';
    case 'language-not-supported':
      return 'चुनी गई भाषा इस ब्राउज़र में समर्थित नहीं है। कृपया दूसरी भाषा चुनें या टाइप करें।';
    case 'unsupported-browser':
      return 'आपके ब्राउज़र में Web Speech API समर्थित नहीं है। कृपया Google Chrome या Microsoft Edge का उपयोग करें। आप नीचे लिखकर हिसाब दर्ज कर सकते हैं।';
    default:
      return `माइक में समस्या आई (${error})। कृपया पुनः प्रयास करें या नीचे लिखकर हिसाब दर्ज करें।`;
  }
}
