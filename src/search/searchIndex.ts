export type SearchHitKind = 'highlight' | 'excerpt' | 'ai' | 'ocr';

export type SearchHit = {
  id: string;
  kind: SearchHitKind;
  title: string;
  text: string;
  page: number | null;
  highlightId?: string;
  nodeId?: string;
  category?: string;
};

export type SearchResult = SearchHit & { snippet: string };

export function buildSearchIndex(params: {
  highlights: Array<{ id: string; page: number; text: string; note: string; category: string }>;
  nodes: Array<{ id: string; type: string; data: any }>;
  ocrPages: Record<number, string>;
}): SearchHit[] {
  const hits: SearchHit[] = [];

  for (const h of params.highlights) {
    hits.push({
      id: `hl-${h.id}`,
      kind: 'highlight',
      title: `Highlight · p.${h.page}`,
      text: [h.text, h.note].filter(Boolean).join(' — '),
      page: h.page,
      highlightId: h.id,
      category: h.category,
    });
  }

  for (const n of params.nodes) {
    if (n.type === 'excerpt') {
      const d = n.data;
      hits.push({
        id: `ex-${n.id}`,
        kind: 'excerpt',
        title: `Canvas excerpt · p.${d.page}`,
        text: [d.text, d.note].filter(Boolean).join(' — '),
        page: d.page,
        highlightId: d.highlightId,
        nodeId: n.id,
        category: d.category,
      });
    } else if (n.type === 'ai') {
      const d = n.data;
      hits.push({
        id: `ai-${n.id}`,
        kind: 'ai',
        title: d.heading || 'AI memo',
        text: [d.body, ...(d.citations || [])].filter(Boolean).join(' — '),
        page: null,
        nodeId: n.id,
      });
    }
  }

  for (const [pageStr, text] of Object.entries(params.ocrPages)) {
    if (!text) continue;
    hits.push({
      id: `ocr-${pageStr}`,
      kind: 'ocr',
      title: `Page ${pageStr} · scanned text`,
      text,
      page: Number(pageStr),
    });
  }

  return hits;
}

export function searchIndex(hits: SearchHit[], query: string, limit = 40): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);

  const scored: Array<{ hit: SearchHit; pos: number }> = [];
  for (const hit of hits) {
    const hay = `${hit.title} ${hit.text}`.toLowerCase();
    if (!terms.every((t) => hay.includes(t))) continue;
    scored.push({ hit, pos: hay.indexOf(terms[0]) });
  }
  scored.sort((a, b) => a.pos - b.pos);

  return scored.slice(0, limit).map(({ hit }) => ({
    ...hit,
    snippet: excerptAround(hit.text, terms[0], 70),
  }));
}

export function excerptAround(text: string, term: string, radius = 70): string {
  if (!text) return '';
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return text.length > radius * 2 ? `${text.slice(0, radius * 2)}…` : text;
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + term.length + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}
