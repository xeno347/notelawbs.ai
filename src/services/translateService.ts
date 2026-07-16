import { aiComplete, getAiCredentials } from './aiClient';

export type DetectedScript =
  | 'latin'
  | 'devanagari'
  | 'gurmukhi'
  | 'bengali'
  | 'tamil'
  | 'telugu'
  | 'gujarati'
  | 'kannada'
  | 'malayalam'
  | 'urdu'
  | 'mixed'
  | 'unknown';

export type TranslateResult = {
  original: string;
  english: string;
  detected: DetectedScript;
  alreadyEnglish: boolean;
};

const SCRIPT_RANGES: Array<{ key: DetectedScript; re: RegExp }> = [
  { key: 'devanagari', re: /[\u0900-\u097F]/ },
  { key: 'gurmukhi', re: /[\u0A00-\u0A7F]/ },
  { key: 'bengali', re: /[\u0980-\u09FF]/ },
  { key: 'tamil', re: /[\u0B80-\u0BFF]/ },
  { key: 'telugu', re: /[\u0C00-\u0C7F]/ },
  { key: 'gujarati', re: /[\u0A80-\u0AFF]/ },
  { key: 'kannada', re: /[\u0C80-\u0CFF]/ },
  { key: 'malayalam', re: /[\u0D00-\u0D7F]/ },
  { key: 'urdu', re: /[\u0600-\u06FF]/ },
];

/** Heuristic script detection for Indian regional + Latin text. */
export function detectScript(text: string): DetectedScript {
  const trimmed = text.trim();
  if (!trimmed) return 'unknown';
  const hits = SCRIPT_RANGES.filter((s) => s.re.test(trimmed)).map((s) => s.key);
  if (hits.length > 1) return 'mixed';
  if (hits.length === 1) return hits[0];
  if (/[A-Za-z]/.test(trimmed)) return 'latin';
  return 'unknown';
}

const SYSTEM = `You are a professional legal translator for Indian court and commercial documents.
Translate the user's passage into clear professional English.
Preserve citations, party names, statute numbers, case citations, section symbols, and dates exactly.
If the text is already English, lightly clean OCR noise but do not rewrite meaning.
Output ONLY the English translation — no preface, labels, or quotation marks.`;

/**
 * End-to-end regional / OCR passage → English.
 * Always returns the original string so callers can store both sides.
 */
export async function translatePassage(text: string): Promise<TranslateResult> {
  const original = text.trim();
  if (!original) {
    return { original: '', english: '', detected: 'unknown', alreadyEnglish: true };
  }

  const detected = detectScript(original);
  const creds = await getAiCredentials();
  if (!creds) {
    throw new Error('Add an AI key in Settings → Advanced to translate regional languages.');
  }

  // Short pure-Latin passages: skip the network round-trip.
  if (detected === 'latin' && original.length < 40 && !/[^\x00-\x7F]/.test(original)) {
    return { original, english: original, detected, alreadyEnglish: true };
  }

  const english = (
    await aiComplete(SYSTEM, original, { maxTokens: 1600, timeoutMs: 60000 })
  ).trim();

  if (!english) {
    throw new Error('Translation returned empty text. Try again.');
  }

  return {
    original,
    english,
    detected,
    alreadyEnglish: detected === 'latin' && english === original,
  };
}

/** Back-compat wrapper used by older call sites. */
export async function translateToEnglish(text: string): Promise<string> {
  const result = await translatePassage(text);
  return result.english;
}
