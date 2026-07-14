import type { OcrElement, OcrLine, OcrPageData, OcrRect } from './ocrService';
import type { Rect } from '../store';

export type SelectionHit = {
  text: string;
  rect: OcrRect;
  rects: OcrRect[];
  kind: 'word' | 'line' | 'paragraph';
};

export type WordToken = {
  index: number;
  text: string;
  rect: OcrRect;
  lineIndex: number;
};

/** Flatten OCR words reading-order (top→bottom, left→right) for native-style selection. */
export function flattenWords(page: OcrPageData): WordToken[] {
  const lines = refinedLines(page);
  const words: WordToken[] = [];
  lines.forEach((line, lineIndex) => {
    const elements =
      line.elements?.filter((element) => element.text && element.rect.w > 0) || [];
    if (elements.length) {
      elements
        .slice()
        .sort((a, b) => a.rect.x - b.rect.x)
        .forEach((element) => {
          words.push({
            index: words.length,
            text: element.text,
            rect: padRect(element.rect, 0.0015),
            lineIndex,
          });
        });
      return;
    }
    // Fallback when ML Kit returns lines without word elements.
    const pieces = line.text.split(/\s+/).filter(Boolean);
    if (!pieces.length) return;
    const gap = 0.004;
    const avail = Math.max(0.001, line.rect.w - gap * Math.max(0, pieces.length - 1));
    const pieceW = avail / pieces.length;
    pieces.forEach((text, i) => {
      words.push({
        index: words.length,
        text,
        rect: {
          x: line.rect.x + i * (pieceW + gap),
          y: line.rect.y,
          w: pieceW,
          h: line.rect.h,
        },
        lineIndex,
      });
    });
  });
  return words;
}

export function nearestWordIndex(words: WordToken[], x: number, y: number): number {
  if (!words.length) return -1;
  let best = -1;
  let bestDist = Infinity;
  words.forEach((word) => {
    if (pointInRect(x, y, padRect(word.rect, 0.008))) {
      const d = distanceToRect(x, y, word.rect);
      if (d < bestDist) {
        bestDist = d;
        best = word.index;
      }
    }
  });
  if (best >= 0) return best;
  words.forEach((word) => {
    const d = distanceToRect(x, y, word.rect);
    if (d < bestDist) {
      bestDist = d;
      best = word.index;
    }
  });
  return bestDist < 0.06 ? best : -1;
}

export function selectionFromRange(
  words: WordToken[],
  startIndex: number,
  endIndex: number,
): SelectionHit | null {
  if (!words.length) return null;
  const a = Math.max(0, Math.min(startIndex, endIndex));
  const b = Math.min(words.length - 1, Math.max(startIndex, endIndex));
  const slice = words.slice(a, b + 1);
  if (!slice.length) return null;

  // Build per-line highlight rects (feels like OS text selection, not one fat box).
  const byLine = new Map<number, WordToken[]>();
  slice.forEach((word) => {
    const list = byLine.get(word.lineIndex) || [];
    list.push(word);
    byLine.set(word.lineIndex, list);
  });
  const rects = [...byLine.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, lineWords]) => unionRects(lineWords.map((word) => word.rect)));

  return {
    text: slice.map((word) => word.text).join(' '),
    rect: unionRects(rects),
    rects,
    kind: a === b ? 'word' : slice.every((w) => w.lineIndex === slice[0].lineIndex) ? 'line' : 'paragraph',
  };
}

export function handleAnchors(
  words: WordToken[],
  startIndex: number,
  endIndex: number,
): { start: { x: number; y: number; h: number }; end: { x: number; y: number; h: number } } | null {
  if (!words.length) return null;
  const a = Math.max(0, Math.min(startIndex, endIndex));
  const b = Math.min(words.length - 1, Math.max(startIndex, endIndex));
  const start = words[a];
  const end = words[b];
  if (!start || !end) return null;
  return {
    start: { x: start.rect.x, y: start.rect.y, h: start.rect.h },
    end: { x: end.rect.x + end.rect.w, y: end.rect.y, h: end.rect.h },
  };
}

/** Flatten OCR into tight, splittable lines (tables often arrive as one tall ML Kit line). */
export function refinedLines(page: OcrPageData): OcrLine[] {
  const lines: OcrLine[] = [];
  page.blocks.forEach((block) => {
    block.lines.forEach((line) => {
      const split = splitFatLine(line);
      lines.push(...split);
    });
  });
  return lines;
}

function splitFatLine(line: OcrLine): OcrLine[] {
  const elements = line.elements.filter((element) => element.text && element.rect.w > 0);
  if (elements.length < 2) return [line];

  const medianH = median(elements.map((element) => element.rect.h));
  const tall = line.rect.h > Math.max(0.018, medianH * 1.85);
  if (!tall) return [line];

  const clusters = clusterByY(elements, Math.max(medianH * 0.65, 0.008));
  return clusters
    .map((cluster) => ({
      text: cluster.map((element) => element.text).join(' ').trim(),
      rect: unionRects(cluster.map((element) => element.rect)),
      elements: cluster,
    }))
    .filter((candidate) => candidate.text && candidate.rect.w > 0 && candidate.rect.h > 0);
}

function clusterByY(elements: OcrElement[], threshold: number): OcrElement[][] {
  const sorted = [...elements].sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  const clusters: OcrElement[][] = [];
  let current: OcrElement[] = [];
  let bandBottom = -1;
  sorted.forEach((element) => {
    const top = element.rect.y;
    const bottom = element.rect.y + element.rect.h;
    if (!current.length || top - bandBottom <= threshold) {
      current.push(element);
      bandBottom = Math.max(bandBottom, bottom);
      return;
    }
    clusters.push(current);
    current = [element];
    bandBottom = bottom;
  });
  if (current.length) clusters.push(current);
  return clusters;
}

/** Double-tap: single word when OCR elements exist, otherwise the tightest line. */
export function wordSelection(page: OcrPageData, x: number, y: number): SelectionHit | null {
  const words = page.blocks.flatMap((block) => block.lines.flatMap((line) => line.elements));
  const direct = words.filter((word) => pointInRect(x, y, padRect(word.rect, 0.004)));
  const word =
    direct.sort((a, b) => area(a.rect) - area(b.rect))[0] ||
    words
      .map((candidate) => ({ candidate, distance: distanceToRect(x, y, candidate.rect) }))
      .sort((a, b) => a.distance - b.distance)[0]?.candidate;
  if (word && (direct.length || distanceToRect(x, y, word.rect) < 0.022)) {
    const rect = padRect(word.rect, 0.002);
    return { text: word.text, rect, rects: [rect], kind: 'word' };
  }
  return lineSelection(page, x, y);
}

/** Long-press: one OCR line (after fat-line splitting). */
export function lineSelection(page: OcrPageData, x: number, y: number): SelectionHit | null {
  const lines = refinedLines(page);
  const direct = lines.filter((line) => pointInRect(x, y, padRect(line.rect, 0.006)));
  const line =
    direct.sort((a, b) => area(a.rect) - area(b.rect))[0] ||
    lines
      .map((candidate) => ({ candidate, distance: distanceToRect(x, y, candidate.rect) }))
      .sort((a, b) => a.distance - b.distance)[0]?.candidate;
  if (!line || (!direct.length && distanceToRect(x, y, line.rect) > 0.03)) return null;
  const rect = padRect(line.rect, 0.002);
  return { text: line.text, rect, rects: [rect], kind: 'line' };
}

/** Triple-tap or explicit expand: a short paragraph (adjacent lines), never a whole table block. */
export function paragraphSelection(page: OcrPageData, x: number, y: number): SelectionHit | null {
  const anchor = lineSelection(page, x, y);
  if (!anchor) return null;

  const block = page.blocks.find((candidate) =>
    candidate.lines.some((line) => rectOverlap(line.rect, anchor.rect) > 0.35),
  );
  if (!block) return { ...anchor, kind: 'paragraph' };

  const lines = refinedLines({ text: block.text, blocks: [block] });
  const anchorIndex = lines.findIndex((line) => rectOverlap(line.rect, anchor.rect) > 0.35);
  if (anchorIndex < 0) return { ...anchor, kind: 'paragraph' };

  let start = anchorIndex;
  let end = anchorIndex;
  let chars = lines[anchorIndex].text.length;

  while (start > 0 && chars + lines[start - 1].text.length < 520) {
    const previous = lines[start - 1];
    const gap = lines[start].rect.y - (previous.rect.y + previous.rect.h);
    if (gap > Math.max(previous.rect.h, lines[start].rect.h) * 1.25) break;
    start -= 1;
    chars += previous.text.length + 1;
  }
  while (end < lines.length - 1 && chars + lines[end + 1].text.length < 520) {
    const next = lines[end + 1];
    const gap = next.rect.y - (lines[end].rect.y + lines[end].rect.h);
    if (gap > Math.max(next.rect.h, lines[end].rect.h) * 1.25) break;
    end += 1;
    chars += next.text.length + 1;
  }

  const slice = lines.slice(start, end + 1);
  const rects = slice.map((line) => padRect(line.rect, 0.002));
  return {
    text: slice.map((line) => line.text).join(' '),
    rect: unionRects(rects),
    rects,
    kind: 'paragraph',
  };
}

export function textInside(page: OcrPageData | undefined, rect: Rect): string {
  if (!page) return '';
  return refinedLines(page)
    .filter((line) => rectOverlap(line.rect, rect) > 0.25)
    .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)
    .map((line) => line.text)
    .join(' ')
    .trim();
}

export function unionRects(rects: OcrRect[]): OcrRect {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.w));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function padRect(rect: OcrRect, padding: number): OcrRect {
  const x = Math.max(0, rect.x - padding);
  const y = Math.max(0, rect.y - padding);
  return {
    x,
    y,
    w: Math.min(1 - x, rect.w + padding * 2),
    h: Math.min(1 - y, rect.h + padding * 2),
  };
}

export function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function rectOverlap(a: Rect, b: Rect): number {
  const width = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const intersection = width * height;
  return intersection / Math.max(0.000001, Math.min(area(a), area(b)));
}

function distanceToRect(x: number, y: number, rect: Rect): number {
  const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.w));
  const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.h));
  return Math.sqrt(dx * dx + dy * dy);
}

function area(rect: Rect): number {
  return rect.w * rect.h;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
