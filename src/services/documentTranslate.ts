/**
 * Document-level regional → English conversion (PRD 4.8).
 * Translates OCR/text-layer pages and stores both layers for side-by-side reading.
 */
import { translatePassage, detectScript, type DetectedScript } from './translateService';

export type PageTranslation = {
  page: number;
  original: string;
  english: string;
  script: DetectedScript;
  quality: 'high' | 'medium' | 'low';
};

export type DocTranslationProgress = {
  done: number;
  total: number;
  currentPage: number | null;
};

function qualityFor(script: DetectedScript, english: string, original: string): PageTranslation['quality'] {
  if (!english.trim()) return 'low';
  if (script === 'latin' && english === original) return 'high';
  if (english.length < original.length * 0.35) return 'low';
  if (script === 'mixed') return 'medium';
  return 'high';
}

/**
 * Translate up to `maxPages` pages from OCR layouts/pages.
 * Yields progress via callback. Skips blank pages.
 */
export async function translateDocumentPages(
  pages: Record<number, string>,
  opts?: {
    maxPages?: number;
    onProgress?: (p: DocTranslationProgress) => void;
    signal?: { cancelled: boolean };
  },
): Promise<Record<number, PageTranslation>> {
  const keys = Object.keys(pages)
    .map(Number)
    .filter((n) => (pages[n] || '').trim().length > 20)
    .sort((a, b) => a - b);
  const limit = opts?.maxPages ?? keys.length;
  const queue = keys.slice(0, limit);
  const out: Record<number, PageTranslation> = {};
  let done = 0;
  for (const page of queue) {
    if (opts?.signal?.cancelled) break;
    opts?.onProgress?.({ done, total: queue.length, currentPage: page });
    const original = pages[page] || '';
    try {
      const result = await translatePassage(original.slice(0, 6000));
      out[page] = {
        page,
        original: result.original,
        english: result.english,
        script: result.detected,
        quality: qualityFor(result.detected, result.english, result.original),
      };
    } catch {
      out[page] = {
        page,
        original,
        english: '',
        script: detectScript(original),
        quality: 'low',
      };
    }
    done += 1;
    opts?.onProgress?.({ done, total: queue.length, currentPage: null });
  }
  return out;
}
