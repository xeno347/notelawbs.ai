/**
 * Unified AI client — Groq (preferred when configured) or Anthropic.
 * Keys: Settings → AI, or copy aiConfig.local.example.ts → aiConfig.local.ts
 */
import { getSetting, setSetting } from '../storage';

export type AiProvider = 'groq' | 'anthropic';

export type AiCredentials = {
  provider: AiProvider;
  key: string;
  model: string;
};

const GROQ_KEY_SETTING = 'groq_key';
const GROQ_MODEL_SETTING = 'groq_model';
const ANTHROPIC_KEY_SETTING = 'anthropic_key';
const ANTHROPIC_MODEL_SETTING = 'anthropic_model';

const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';

let localGroqKey = '';
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const local = require('./aiConfig.local') as { GROQ_API_KEY?: string };
  localGroqKey = local.GROQ_API_KEY?.trim() || '';
} catch {
  /* optional dev file */
}

export async function getGroqKey(): Promise<string | null> {
  const stored = await getSetting(GROQ_KEY_SETTING);
  if (stored?.trim()) return stored.trim();
  return localGroqKey || null;
}

export async function saveGroqKey(key: string): Promise<void> {
  await setSetting(GROQ_KEY_SETTING, key.trim());
}

export async function clearGroqKey(): Promise<void> {
  await setSetting(GROQ_KEY_SETTING, '');
}

export async function getAiCredentials(): Promise<AiCredentials | null> {
  const groq = await getGroqKey();
  if (groq) {
    const model = (await getSetting(GROQ_MODEL_SETTING)) || DEFAULT_GROQ_MODEL;
    return { provider: 'groq', key: groq, model };
  }
  const anthropic = await getSetting(ANTHROPIC_KEY_SETTING);
  if (anthropic?.trim()) {
    const model = (await getSetting(ANTHROPIC_MODEL_SETTING)) || DEFAULT_ANTHROPIC_MODEL;
    return { provider: 'anthropic', key: anthropic.trim(), model };
  }
  return null;
}

/** Returns plain text completion (JSON prompts should ask for JSON-only output). */
export async function aiComplete(
  system: string,
  user: string,
  opts?: { maxTokens?: number; timeoutMs?: number },
): Promise<string> {
  const creds = await getAiCredentials();
  if (!creds) throw new Error('No AI key configured');

  const controller = new AbortController();
  const timeoutMs = opts?.timeoutMs ?? 35000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (creds.provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${creds.key}`,
        },
        body: JSON.stringify({
          model: creds.model,
          max_tokens: opts?.maxTokens ?? 1600,
          temperature: 0.2,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Groq ${res.status}`);
      const data = await res.json();
      return data?.choices?.[0]?.message?.content ?? '';
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': creds.key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: creds.model,
        max_tokens: opts?.maxTokens ?? 1600,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const data = await res.json();
    return data?.content?.[0]?.text ?? '';
  } finally {
    clearTimeout(timer);
  }
}

export function parseJsonFromAi(raw: string): unknown {
  const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON in AI response');
  return JSON.parse(match[0]);
}

/** Back-compat for research panel. */
export async function getStoredKey(): Promise<string | null> {
  const creds = await getAiCredentials();
  return creds?.key ?? null;
}

export async function saveKey(key: string): Promise<void> {
  await setSetting(ANTHROPIC_KEY_SETTING, key.trim());
}

export async function clearKey(): Promise<void> {
  await setSetting(ANTHROPIC_KEY_SETTING, '');
}
