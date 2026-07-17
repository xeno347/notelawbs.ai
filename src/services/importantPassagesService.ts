import type { CategoryKey } from '../theme';
import type { OcrBlock, OcrLine, OcrPageData, OcrRect } from './ocrService';
import { refinedLines, unionRects } from './textSelection';
import { aiComplete, getAiCredentials, parseJsonFromAi } from './aiClient';

export type ImportantPassage = {
  page: number;
  text: string;
  rect: OcrRect;
  rects: OcrRect[];
  category: CategoryKey;
  reason: string;
};

type Candidate = ImportantPassage & { id: string; score: number };

const MAX_PASSAGES = 12;

const CUES: Array<[RegExp, number]> = [
  [/\b(we hold|we conclude|held that|it is held|find that|accordingly)\b/i, 8],
  [/\b(ratio decidendi|settled law|legal position|principle of law)\b/i, 8],
  [/\b(therefore|thus|hence|in view of|for these reasons)\b/i, 5],
  [/\b(court|tribunal|appellant|respondent|petitioner|defendant|plaintiff)\b/i, 3],
  [/\b(section|article|rule|act|statute|constitution|jurisdiction)\b/i, 4],
  [/\b(evidence|admitted|proved|facts? of the case|contention|submission)\b/i, 3],
  [/\b(allowed|dismissed|set aside|quashed|remanded|injunction|relief)\b/i, 6],
  [/\b(supreme court|high court|citation|precedent|authority)\b/i, 4],
];

/**
 * Ranks OCR paragraphs locally, then lets the configured Anthropic model refine
 * the shortlist. The local ranking is always available and is used on timeout,
 * missing API key, or malformed network output.
 */
export async function analyzeImportantPassages(
  pages: Record<number, OcrPageData>,
): Promise<{ passages: ImportantPassage[]; mode: 'live' | 'on-device' }> {
  const candidates = buildCandidates(pages);
  const fallback = selectLocal(candidates);
  if (!candidates.length) return { passages: [], mode: 'on-device' };

  const apiKey = await getAiCredentials();
  if (!apiKey) return { passages: fallback, mode: 'on-device' };

  try {
    const selected = await selectWithAi(candidates.slice(0, 36));
    if (!selected.length) return { passages: fallback, mode: 'on-device' };
    return { passages: selected.slice(0, MAX_PASSAGES), mode: 'live' };
  } catch {
    return { passages: fallback, mode: 'on-device' };
  }
}

function buildCandidates(pages: Record<number, OcrPageData>): Candidate[] {
  const candidates: Candidate[] = [];
  Object.entries(pages).forEach(([pageKey, pageData]) => {
    const page = Number(pageKey);
    pageData.blocks.forEach((block, blockIndex) => {
      const chunks =
        block.text.length > 900
          ? chunkLongBlock(block)
          : (() => {
              const lines = refinedLines({ blocks: [block] });
              const rects = lines.map((line) => line.rect);
              return [
                {
                  text: block.text,
                  rect: rects.length ? unionRects(rects) : block.rect,
                  rects: rects.length ? rects : [block.rect],
                },
              ];
            })();
      chunks.forEach((chunk, chunkIndex) => {
        const text = normalize(chunk.text);
        if (text.length < 35 || text.length > 1200 || chunk.rect.w < 0.06 || chunk.rect.h < 0.006) return;
        const score = importanceScore(text, chunk.rect);
        candidates.push({
          id: `p${page}b${blockIndex}c${chunkIndex}`,
          page,
          text,
          rect: chunk.rect,
          rects: chunk.rects.length ? chunk.rects : [chunk.rect],
          category: classify(text),
          reason: localReason(text),
          score,
        });
      });
    });
  });
  return candidates.sort((a, b) => b.score - a.score);
}

function chunkLongBlock(
  block: OcrBlock,
): Array<{ text: string; rect: OcrRect; rects: OcrRect[] }> {
  const lines = refinedLines({ blocks: [block] });
  if (lines.length < 3) {
    const rects = lines.map((line) => line.rect);
    return [{ text: block.text, rect: rects.length ? unionRects(rects) : block.rect, rects: rects.length ? rects : [block.rect] }];
  }
  const chunks: Array<{ text: string; rect: OcrRect; rects: OcrRect[] }> = [];
  let current: OcrLine[] = [];
  let chars = 0;
  const flush = () => {
    if (!current.length) return;
    const rects = current.map((line) => line.rect);
    chunks.push({
      text: current.map((line) => line.text).join(' '),
      rect: unionRects(rects),
      rects,
    });
    current = [];
    chars = 0;
  };
  lines.forEach((line, index) => {
    const previous = lines[index - 1];
    const gap = previous ? line.rect.y - (previous.rect.y + previous.rect.h) : 0;
    if (current.length && (chars + line.text.length > 650 || gap > Math.max(line.rect.h, 0.018) * 1.25)) {
      flush();
    }
    current.push(line);
    chars += line.text.length + 1;
  });
  flush();
  return chunks;
}

function importanceScore(text: string, rect: OcrRect): number {
  let score = Math.min(6, text.length / 100);
  CUES.forEach(([pattern, weight]) => {
    if (pattern.test(text)) score += weight;
  });
  if (/^\s*(\d+[\.\)]|[IVXLCDM]+[\.\)])\s+/i.test(text)) score += 2;
  if (/[“"].{30,}[”"]/.test(text)) score += 2;
  if (text.length >= 120 && text.length <= 700) score += 3;
  if (rect.y < 0.12 && text.length < 180) score -= 5;
  if ((text.match(/\|/g) || []).length > 3) score -= 5;
  if (text.toUpperCase() === text && text.length < 140) score -= 3;
  return score;
}

function selectLocal(candidates: Candidate[]): ImportantPassage[] {
  const selected: Candidate[] = [];
  const perPage = new Map<number, number>();
  // Prefer high-scoring cues, but still surface readable OCR when cues are sparse.
  const ranked = [...candidates].sort((a, b) => b.score - a.score || a.page - b.page);
  for (const candidate of ranked) {
    if (selected.length >= MAX_PASSAGES) break;
    if ((perPage.get(candidate.page) || 0) >= 2) continue;
    if (selected.some((item) => similarity(item.text, candidate.text) > 0.72)) continue;
    // Skip near-empty / header noise unless we have almost nothing else.
    if (candidate.score < 2 && selected.length >= 4) continue;
    selected.push(candidate);
    perPage.set(candidate.page, (perPage.get(candidate.page) || 0) + 1);
  }
  // Guarantee at least a few cards when OCR produced text but cue scores were flat.
  if (!selected.length && ranked.length) {
    for (const candidate of ranked) {
      if (selected.length >= Math.min(6, MAX_PASSAGES)) break;
      if (selected.some((item) => similarity(item.text, candidate.text) > 0.72)) continue;
      selected.push(candidate);
    }
  }
  return selected
    .sort((a, b) => a.page - b.page || a.rect.y - b.rect.y)
    .map(stripCandidate);
}

async function selectWithAi(candidates: Candidate[]): Promise<ImportantPassage[]> {
  try {
    const source = candidates
      .map((candidate) => `[${candidate.id}] page ${candidate.page}: ${candidate.text}`)
      .join('\n\n');
    const raw = await aiComplete(
      'You are senior litigation counsel reviewing an OCR copy of a legal judgment. Select only outcome-determinative passages. Output valid JSON only.',
      `Choose at most ${MAX_PASSAGES} passages covering material facts, issues, ratio, adverse/favourable findings, procedure, and final relief. Avoid headers, duplicate propositions, party lists, and boilerplate. Return exactly {"selections":[{"id":"...","category":"key_fact|adverse|favorable|procedural|ratio","reason":"short reason"}]}.\n\n${source}`,
      { maxTokens: 1600, timeoutMs: 35000 },
    );
    const parsed = parseJsonFromAi(raw) as {
      selections?: Array<{ id?: string; category?: string; reason?: string }>;
    };
    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    return (parsed.selections || [])
      .map((selection) => {
        const candidate = selection.id ? byId.get(selection.id) : undefined;
        if (!candidate) return null;
        return {
          ...stripCandidate(candidate),
          category: validCategory(selection.category) ? selection.category : candidate.category,
          reason: normalize(selection.reason || candidate.reason).slice(0, 180),
        };
      })
      .filter(Boolean) as ImportantPassage[];
  } catch {
    return [];
  }
}

function classify(text: string): CategoryKey {
  if (/\b(ratio|principle|settled law|we hold|held that|legal position)\b/i.test(text)) return 'ratio';
  if (/\b(dismissed|rejected|failed|against the|adverse|not entitled)\b/i.test(text)) return 'adverse';
  if (/\b(allowed|granted|in favour|entitled|succeeds|set aside)\b/i.test(text)) return 'favorable';
  if (/\b(procedure|appeal|petition|application|remand|jurisdiction|limitation)\b/i.test(text)) return 'procedural';
  return 'key_fact';
}

function validCategory(value: string | undefined): value is CategoryKey {
  // Accept built-ins and any non-empty custom matter key the model (or user) returns.
  return typeof value === 'string' && value.trim().length > 0 && value.length < 64;
}

function localReason(text: string): string {
  if (classify(text) === 'ratio') return 'Likely statement of the governing rule or holding';
  if (classify(text) === 'procedural') return 'Material procedural or jurisdictional passage';
  if (classify(text) === 'favorable') return 'Potentially favorable finding or relief';
  if (classify(text) === 'adverse') return 'Potentially adverse finding or disposition';
  return 'Material fact or reasoning identified from the judgment';
}

function similarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter((word) => word.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter((word) => word.length > 3));
  if (!wordsA.size || !wordsB.size) return 0;
  let overlap = 0;
  wordsA.forEach((word) => {
    if (wordsB.has(word)) overlap += 1;
  });
  return overlap / Math.min(wordsA.size, wordsB.size);
}

function stripCandidate(candidate: Candidate): ImportantPassage {
  return {
    page: candidate.page,
    text: candidate.text,
    rect: candidate.rect,
    rects: candidate.rects,
    category: candidate.category,
    reason: candidate.reason,
  };
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
