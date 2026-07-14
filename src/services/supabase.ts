import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  isPlaceholder,
} from './supabaseConfig';

const OVERRIDE_URL_KEY = 'litnotes.supabase.url';
const OVERRIDE_ANON_KEY = 'litnotes.supabase.anon';

let overrideUrl: string | null = null;
let overrideKey: string | null = null;
let client: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

/** Load any runtime URL/key overrides saved from the Settings screen. */
export async function loadSupabaseOverrides(): Promise<void> {
  try {
    overrideUrl = await AsyncStorage.getItem(OVERRIDE_URL_KEY);
    overrideKey = await AsyncStorage.getItem(OVERRIDE_ANON_KEY);
  } catch {
    overrideUrl = null;
    overrideKey = null;
  }
}

export async function saveSupabaseOverrides(url: string, anonKey: string): Promise<void> {
  overrideUrl = url.trim() || null;
  overrideKey = anonKey.trim() || null;
  try {
    if (overrideUrl) await AsyncStorage.setItem(OVERRIDE_URL_KEY, overrideUrl);
    else await AsyncStorage.removeItem(OVERRIDE_URL_KEY);
    if (overrideKey) await AsyncStorage.setItem(OVERRIDE_ANON_KEY, overrideKey);
    else await AsyncStorage.removeItem(OVERRIDE_ANON_KEY);
  } catch {
    /* noop */
  }
  client = null; // force re-create with the new credentials
}

export function getSupabaseOverrides(): { url: string; anonKey: string } {
  return { url: overrideUrl || '', anonKey: overrideKey || '' };
}

function resolvedUrl(): string {
  const v = overrideUrl && !isPlaceholder(overrideUrl) ? overrideUrl : SUPABASE_URL;
  return (v || '').trim();
}

function resolvedKey(): string {
  const v = overrideKey && !isPlaceholder(overrideKey) ? overrideKey : SUPABASE_ANON_KEY;
  return (v || '').trim();
}

/** True when a usable Supabase URL + anon key are present (env or runtime). */
export function isSupabaseConfigured(): boolean {
  return !isPlaceholder(resolvedUrl()) && !isPlaceholder(resolvedKey());
}

/** Lazily build (and cache) the Supabase client. Returns null when unconfigured. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  const url = resolvedUrl();
  const key = resolvedKey();
  if (!client || cachedUrl !== url || cachedKey !== key) {
    cachedUrl = url;
    cachedKey = key;
    client = createClient(url, key, {
      auth: {
        storage: AsyncStorage as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}

export function googleClientIds(): { web: string; ios: string } {
  return {
    web: isPlaceholder(GOOGLE_WEB_CLIENT_ID) ? '' : GOOGLE_WEB_CLIENT_ID,
    ios: isPlaceholder(GOOGLE_IOS_CLIENT_ID) ? '' : GOOGLE_IOS_CLIENT_ID,
  };
}

export function isGoogleConfigured(): boolean {
  return !isPlaceholder(GOOGLE_WEB_CLIENT_ID);
}
