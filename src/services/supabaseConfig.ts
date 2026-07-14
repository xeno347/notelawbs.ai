// ─────────────────────────────────────────────────────────────────────────────
// Supabase / Google configuration
//
// Fill secrets in `supabaseConfig.local.ts` (gitignored).
// Or paste at runtime: Settings → Collaboration (no rebuild).
//
// Dashboard API keys: Project Settings → API
// ─────────────────────────────────────────────────────────────────────────────

import {
  SUPABASE_URL as LOCAL_URL,
  SUPABASE_ANON_KEY as LOCAL_ANON,
  GOOGLE_WEB_CLIENT_ID as LOCAL_GOOGLE_WEB,
  GOOGLE_IOS_CLIENT_ID as LOCAL_GOOGLE_IOS,
} from './supabaseConfig.local';

function pick(localValue: string | undefined, fallback: string): string {
  const v = (localValue || '').trim();
  if (!v || v.includes('YOUR_') || v.includes('eyJhbGciOi…')) return fallback;
  return v;
}

export const SUPABASE_URL = pick(LOCAL_URL, 'YOUR_SUPABASE_URL');
export const SUPABASE_ANON_KEY = pick(LOCAL_ANON, 'YOUR_SUPABASE_ANON_KEY');

export const GOOGLE_WEB_CLIENT_ID = pick(LOCAL_GOOGLE_WEB, 'YOUR_GOOGLE_WEB_CLIENT_ID');
export const GOOGLE_IOS_CLIENT_ID = pick(LOCAL_GOOGLE_IOS, 'YOUR_GOOGLE_IOS_CLIENT_ID');

export function isPlaceholder(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0 || value.includes('YOUR_');
}
