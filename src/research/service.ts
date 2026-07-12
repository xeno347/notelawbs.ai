import { JUDGMENTS } from './judgments';
import {
  offlineResearch,
  retrieve,
  terms,
  type ResearchResult,
} from './researchCore';
import { getSetting, setSetting } from '../storage';

const KEY_SETTING = 'anthropic_key';
const MODEL_SETTING = 'anthropic_model';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const TIMEOUT_MS = 30000;

export async function getStoredKey(): Promise<string | null> {
  return getSetting(KEY_SETTING);
}

export async function saveKey(key: string): Promise<void> {
  await setSetting(KEY_SETTING, key.trim());
}

export async function clearKey(): Promise<void> {
  await setSetting(KEY_SETTING, '');
}

export function offline(query: string, notice = ''): ResearchResult {
  return offlineResearch(JUDGMENTS, query, notice);
}

async function anthropic(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}`);
  }
  const data = await res.json();
  return data?.content?.[0]?.text ?? '';
}

export async function runResearch(query: string): Promise<ResearchResult> {
  const q = query.trim();
  if (!q) return offline(q);

  const apiKey = await getStoredKey();
  if (!apiKey) return offline(q);

  const model = (await getSetting(MODEL_SETTING)) || DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let searchTerms: string[];
    try {
      const raw = await anthropic(
        apiKey,
        'Output valid JSON only.',
        `You are a legal research assistant for Indian litigation. Given this query, output ONLY a JSON array of 5-8 lowercase search terms to find relevant Indian case law. No explanation.\n\nQuery: ${q}`,
        model,
        controller.signal,
      );
      const m = raw.match(/\[[\s\S]*\]/);
      searchTerms = m ? JSON.parse(m[0]) : terms(q);
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

    const memoRaw = await anthropic(
      apiKey,
      'You are a senior Indian litigation counsel. Output valid JSON only.',
      `Draft a legal research memo for Indian litigation.\n\nQuery: ${q}\n\nAuthorities:\n${authorityBlock}\n\nReturn JSON exactly:\n{"sections":[{"heading":"Summary","body":"...","citations":[]},{"heading":"Legal Framework","body":"...","citations":[]},{"heading":"Settled Position","body":"...","citations":[]},{"heading":"Adverse Authorities","body":"...","citations":[]},{"heading":"Conclusion","body":"...","citations":[]}]}\nUse only the authorities provided. Output valid JSON only.`,
      model,
      controller.signal,
    );

    const m = memoRaw.match(/\{[\s\S]*\}/);
    const memo = m ? JSON.parse(m[0]) : null;
    if (!memo?.sections) {
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
      memo,
    };
  } catch {
    return offline(q, 'Live AI unreachable; showing on-device memo.');
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyKey(key: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key.trim(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    return res.ok || res.status === 400;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
