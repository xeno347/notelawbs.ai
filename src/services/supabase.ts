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
import { getSecret, setSecret } from './secureStore';
import { reportError } from './errorReporting';

const OVERRIDE_URL_KEY = 'litnotes.supabase.url';
const OVERRIDE_ANON_KEY = 'litnotes.supabase.anon';
const OVERRIDE_GOOGLE_WEB = 'litnotes.google.webClientId';
const OVERRIDE_GOOGLE_IOS = 'litnotes.google.iosClientId';

/** Matches the reversed iOS client ID already registered in Info.plist. */
const PLIST_IOS_CLIENT_ID =
  '576870734165-q31qv9o2mo9c12c25lt9lh9o3ktjcevj.apps.googleusercontent.com';

let overrideUrl: string | null = null;
let overrideKey: string | null = null;
let overrideGoogleWeb: string | null = null;
let overrideGoogleIos: string | null = null;
let client: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

/** Load any runtime URL/key overrides saved from the Settings screen. */
export async function loadSupabaseOverrides(): Promise<void> {
  try {
    overrideUrl = await AsyncStorage.getItem(OVERRIDE_URL_KEY);
    overrideKey = await getSecret(OVERRIDE_ANON_KEY);
    if (!overrideKey) {
      // Migrate plaintext anon key → Keychain.
      const plain = await AsyncStorage.getItem(OVERRIDE_ANON_KEY);
      if (plain?.trim()) {
        await setSecret(OVERRIDE_ANON_KEY, plain.trim());
        await AsyncStorage.removeItem(OVERRIDE_ANON_KEY);
        overrideKey = plain.trim();
      }
    }
    overrideGoogleWeb = await AsyncStorage.getItem(OVERRIDE_GOOGLE_WEB);
    overrideGoogleIos = await AsyncStorage.getItem(OVERRIDE_GOOGLE_IOS);
  } catch (e) {
    reportError(e, { where: 'loadSupabaseOverrides' }, 'warning');
    overrideUrl = null;
    overrideKey = null;
    overrideGoogleWeb = null;
    overrideGoogleIos = null;
  }
}

export async function saveSupabaseOverrides(url: string, anonKey: string): Promise<void> {
  overrideUrl = url.trim() || null;
  overrideKey = anonKey.trim() || null;
  try {
    if (overrideUrl) await AsyncStorage.setItem(OVERRIDE_URL_KEY, overrideUrl);
    else await AsyncStorage.removeItem(OVERRIDE_URL_KEY);
    if (overrideKey) await setSecret(OVERRIDE_ANON_KEY, overrideKey);
    else await setSecret(OVERRIDE_ANON_KEY, '');
    await AsyncStorage.removeItem(OVERRIDE_ANON_KEY);
  } catch (e) {
    reportError(e, { where: 'saveSupabaseOverrides' }, 'warning');
  }
  client = null;
}

export async function saveGoogleClientOverrides(web: string, ios: string): Promise<void> {
  overrideGoogleWeb = web.trim() || null;
  overrideGoogleIos = ios.trim() || null;
  try {
    if (overrideGoogleWeb) await AsyncStorage.setItem(OVERRIDE_GOOGLE_WEB, overrideGoogleWeb);
    else await AsyncStorage.removeItem(OVERRIDE_GOOGLE_WEB);
    if (overrideGoogleIos) await AsyncStorage.setItem(OVERRIDE_GOOGLE_IOS, overrideGoogleIos);
    else await AsyncStorage.removeItem(OVERRIDE_GOOGLE_IOS);
  } catch {
    /* noop */
  }
}

export function getSupabaseOverrides(): { url: string; anonKey: string } {
  return { url: overrideUrl || '', anonKey: overrideKey || '' };
}

export function getGoogleClientOverrides(): { web: string; ios: string } {
  return { web: overrideGoogleWeb || '', ios: overrideGoogleIos || '' };
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
  const url = resolvedUrl();
  const key = resolvedKey();
  return (
    !isPlaceholder(url) &&
    !isPlaceholder(key) &&
    url.startsWith('http') &&
    key.length > 40
  );
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
  const web =
    (overrideGoogleWeb && !isPlaceholder(overrideGoogleWeb) && overrideGoogleWeb) ||
    (!isPlaceholder(GOOGLE_WEB_CLIENT_ID) && GOOGLE_WEB_CLIENT_ID) ||
    '';
  const ios =
    (overrideGoogleIos && !isPlaceholder(overrideGoogleIos) && overrideGoogleIos) ||
    (!isPlaceholder(GOOGLE_IOS_CLIENT_ID) && GOOGLE_IOS_CLIENT_ID) ||
    PLIST_IOS_CLIENT_ID;
  return { web: web.trim(), ios: ios.trim() };
}

export function isGoogleConfigured(): boolean {
  return !!googleClientIds().web;
}
