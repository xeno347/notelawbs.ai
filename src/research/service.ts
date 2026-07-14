import { JUDGMENTS } from './judgments';
import {
  offlineResearch,
  retrieve,
  terms,
  type ResearchResult,
  type MemoSection,
} from './researchCore';
import {
  aiComplete,
  getAiCredentials,
  parseJsonFromAi,
  saveKey as saveAnthropicKey,
  clearKey as clearAnthropicKey,
  getStoredKey as getAnyAiKey,
  saveGroqKey,
} from '../services/aiClient';

export { getAnyAiKey as getStoredKey, saveAnthropicKey as saveKey, clearAnthropicKey as clearKey, saveGroqKey };

export function offline(query: string, notice = ''): ResearchResult {
  return offlineResearch(JUDGMENTS, query, notice);
}

/** Legal research that answers the user's question directly when live AI is available. */
export async function runResearch(query: string): Promise<ResearchResult> {
  const q = query.trim();
  if (!q) return offline(q);

  const creds = await getAiCredentials();
  if (!creds) return offline(q);

  try {
    let searchTerms: string[];
    try {
      const raw = await aiComplete(
        'You are a legal research assistant for Indian litigation. Output valid JSON only.',
        `Given this research question, output ONLY a JSON array of 5-8 lowercase search terms to find relevant Indian case law. No explanation.\n\nQuestion: ${q}`,
        { maxTokens: 256, timeoutMs: 30000 },
      );
      const parsed = parseJsonFromAi(raw);
      searchTerms = Array.isArray(parsed) ? (parsed as string[]) : terms(q);
    } catch {
      searchTerms = terms(q);
    }

    const retrieved = retrieve(JUDGMENTS, searchTerms, 6);
    const authorityBlock = retrieved
      .map(
        (j) =>
          `[${j.id}] ${j.title} — ${j.citation} (${j.court}, ${j.year})\nTopics: ${j.topics.join(
            ', ',
          )}\nHeadnote: ${j.headnote}`,
      )
      .join('\n\n');

    const memoRaw = await aiComplete(
      'You are a senior Indian litigation counsel. Answer the user accurately. Output valid JSON only.',
      `Answer this legal research question for Indian law.

Question: ${q}

On-device authorities (use when relevant; you may also rely on settled Indian law):
${authorityBlock || '(none matched — answer from settled Indian law and clearly note limited local authorities)'}

Return JSON exactly:
{
  "sections": [
    {"heading":"Direct Answer","body":"Clear 2-4 sentence answer to the question.","citations":[]},
    {"heading":"Legal Framework","body":"...","citations":[]},
    {"heading":"Key Authorities","body":"...","citations":[]},
    {"heading":"Counterarguments","body":"...","citations":[]},
    {"heading":"Practical Next Steps","body":"...","citations":[]}
  ]
}

Rules:
- The Direct Answer must address the question first — do not dodge with vague process talk.
- Prefer specific holdings, statutes, and standards over filler.
- If uncertain, say what is settled vs unsettled.
- Output valid JSON only.`,
      { maxTokens: 4096, timeoutMs: 45000 },
    );

    const memo = parseJsonFromAi(memoRaw) as { sections?: MemoSection[] };
    if (!memo?.sections?.length) {
      return offline(q, 'Live AI draft failed; showing on-device memo.');
    }

    return {
      mode: 'live',
      enhanced: searchTerms,
      judgments: retrieved.map((j) => ({
        id: j.id,
        title: j.title,
        citation: j.citation,
        court: j.court,
        year: j.year,
      })),
      memo: { sections: memo.sections },
    };
  } catch {
    return offline(q, 'Live AI unreachable; showing on-device memo.');
  }
}

export async function verifyKey(key: string): Promise<boolean> {
  const trimmed = key.trim();
  if (trimmed.length < 8) return false;
  try {
    // Persist temporarily so getAiCredentials / aiComplete can use it for the probe.
    if (trimmed.startsWith('gsk_')) {
      await saveGroqKey(trimmed);
    } else {
      await saveAnthropicKey(trimmed);
    }
    await aiComplete('Reply with the single word ok.', 'ping', { maxTokens: 8, timeoutMs: 10000 });
    return true;
  } catch {
    return false;
  }
}
