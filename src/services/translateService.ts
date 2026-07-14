import { aiComplete, getAiCredentials } from './aiClient';

/** Translate regional / legal text into clear English via configured AI. */
export async function translateToEnglish(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const creds = await getAiCredentials();
  if (!creds) {
    throw new Error('Add an AI key in Settings to translate.');
  }
  const out = await aiComplete(
    'You translate legal and regional-language passages into clear professional English. Preserve citations, party names, statute numbers, and case citations exactly. Output only the English translation — no preface.',
    trimmed,
    { maxTokens: 1200, timeoutMs: 45000 },
  );
  return out.trim();
}
