import type { OcrPageData } from './ocrService';
import { refinedLines } from './textSelection';
import type { Rect } from '../store';

function tokenize(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Best-effort re-anchoring of a highlight's quoted text against a fresh OCR
 * pass (e.g. after a manual "Retry OCR"). This is a token-overlap heuristic
 * over OCR lines, not a real text-layer diff — good enough to recover a
 * highlight's position after small drift without pretending to be exact.
 * Returns null when nothing matches with reasonable confidence.
 */
export function reanchorText(quotedText: string, pageData: OcrPageData): Rect[] | null {
  const target = tokenize(quotedText);
  if (!target.size) return null;
  const lines = refinedLines(pageData).map((line) => ({
    rect: line.rect,
    tokens: tokenize(line.text),
  }));
  if (!lines.length) return null;

  let best: { rects: Rect[]; score: number } | null = null;
  for (let win = 1; win <= 4; win++) {
    for (let i = 0; i + win <= lines.length; i++) {
      const seq = lines.slice(i, i + win);
      const merged = new Set<string>();
      seq.forEach((l) => l.tokens.forEach((t) => merged.add(t)));
      const score = jaccard(merged, target);
      if (score > 0.55 && (!best || score > best.score)) {
        best = { rects: seq.map((l) => l.rect), score };
      }
    }
  }
  return best ? best.rects : null;
}
