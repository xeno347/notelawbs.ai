import type { Judgment } from './judgments';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have',
  'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
  'might', 'shall', 'can', 'need', 'must', 'that', 'this', 'these', 'those',
  'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your', 'he', 'she',
  'his', 'her', 'not', 'no', 'nor', 'so', 'if', 'then', 'than', 'when', 'where',
  'which', 'who', 'whom', 'what', 'how', 'why', 'all', 'any', 'both', 'each',
  'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'into',
  'over', 'after', 'before', 'between', 'under', 'again', 'further', 'once',
  'here', 'there', 'about', 'against', 'during', 'through', 'above', 'below',
  'up', 'down', 'out', 'off', 'also', 'just', 'very', 'too', 'per', 'via',
]);

export function terms(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export function retrieve(
  judgments: Judgment[],
  searchTerms: string[],
  topN = 6,
): Judgment[] {
  if (!judgments?.length) return [];
  const termSet = new Set(searchTerms);
  if (termSet.size === 0) return judgments.slice(0, Math.min(4, judgments.length));

  const scored = judgments.map((j) => {
    let score = 0;
    const topicText = (j.topics || []).join(' ').toLowerCase();
    const titleHeadnote = `${j.title || ''} ${j.headnote || ''}`.toLowerCase();
    termSet.forEach((term) => {
      if (topicText.includes(term)) score += 3;
      if (titleHeadnote.includes(term)) score += 1;
    });
    return { judgment: j, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score > 0).slice(0, topN).map((s) => s.judgment);
  return top.length ? top : judgments.slice(0, Math.min(4, judgments.length));
}

export type MemoSection = { heading: string; body: string; citations: string[] };
export type ResearchResult = {
  mode: 'offline' | 'live';
  enhanced: string[] | null;
  judgments: Array<Pick<Judgment, 'id' | 'title' | 'citation' | 'court' | 'year'>>;
  memo: { sections: MemoSection[] };
};

export function offlineResearch(
  judgments: Judgment[],
  query: string,
  notice = '',
): ResearchResult {
  const searchTerms = terms(query);
  const retrieved = retrieve(judgments, searchTerms, 6);
  const primary = retrieved[0];
  const rest = retrieved.slice(1);
  const cite = (j: Judgment) => `${j.title} — ${j.citation} (${j.court}, ${j.year})`;

  const sections: MemoSection[] = [
    {
      heading: 'Summary',
      body: notice
        ? `${notice}\n\nBased on your query about "${query}", the following authorities from the on-device pack are most relevant.`
        : `Research query: "${query}". The following analysis draws on ${retrieved.length} leading authorities from the curated Indian litigation pack.`,
      citations: retrieved.map(cite),
    },
    {
      heading: 'Legal Framework',
      body: primary
        ? `${primary.headnote}\n\nThis authority establishes the foundational framework. Key topics: ${(primary.topics || []).join(', ')}.`
        : 'No matching authority found in the pack.',
      citations: primary ? [cite(primary)] : [],
    },
    {
      heading: 'Settled Position',
      body: rest.length
        ? rest
            .map((j) => `• ${j.title}: ${j.headnote.slice(0, 200)}${j.headnote.length > 200 ? '…' : ''}`)
            .join('\n\n')
        : 'No further authorities matched the query terms.',
      citations: rest.map(cite),
    },
    {
      heading: 'Conclusion',
      body: `For the issue of "${query}", counsel should rely primarily on ${primary?.citation || 'the leading authorities above'}, supplemented by the settled line of cases identified. This memo was generated on-device from the bundled judgment pack.`,
      citations: retrieved.slice(0, 3).map(cite),
    },
  ];

  return {
    mode: 'offline',
    enhanced: null,
    judgments: retrieved.map((j) => ({
      id: j.id,
      title: j.title,
      citation: j.citation,
      court: j.court,
      year: j.year,
    })),
    memo: { sections },
  };
}
