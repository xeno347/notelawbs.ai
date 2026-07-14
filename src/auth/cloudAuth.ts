import { GoogleSignin } from '@react-native-google-signin/google-signin';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { getSupabase, googleClientIds, isGoogleConfigured } from '../services/supabase';
import type { AuthUser } from '../storage';

export type CloudResult = { ok: true; user: AuthUser } | { ok: false; error: string };

function displayNameFor(u: SupabaseUser): string {
  const meta = (u.user_metadata || {}) as Record<string, any>;
  return (
    meta.full_name ||
    meta.name ||
    meta.user_name ||
    (u.email ? u.email.split('@')[0] : 'Member')
  );
}

export function mapCloudUser(u: SupabaseUser): AuthUser {
  return {
    id: u.id,
    email: u.email || '',
    displayName: displayNameFor(u),
    createdAt: u.created_at ? new Date(u.created_at).getTime() : Date.now(),
  };
}

export async function getCloudUser(): Promise<AuthUser | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user ? mapCloudUser(data.session.user) : null;
}

export function onCloudAuthChange(cb: (user: AuthUser | null) => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ? mapCloudUser(session.user) : null);
  });
  return () => data.subscription.unsubscribe();
}

export async function cloudSignInWithEmail(email: string, password: string): Promise<CloudResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Cloud sign-in is not configured.' };
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) return { ok: false, error: error?.message || 'Sign-in failed.' };
  return { ok: true, user: mapCloudUser(data.user) };
}

export async function cloudSignUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<CloudResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Cloud sign-up is not configured.' };
  const { data, error } = await sb.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: displayName.trim() } },
  });
  if (error) return { ok: false, error: error.message };
  if (!data.user) {
    return { ok: false, error: 'Check your email to confirm your account, then sign in.' };
  }
  return { ok: true, user: mapCloudUser(data.user) };
}

let googleConfigured = false;
function ensureGoogleConfigured() {
  if (googleConfigured) return;
  const ids = googleClientIds();
  GoogleSignin.configure({
    webClientId: ids.web,
    iosClientId: ids.ios || undefined,
    offlineAccess: true,
  });
  googleConfigured = true;
}

export async function cloudSignInWithGoogle(): Promise<CloudResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Cloud sign-in is not configured.' };
  if (!isGoogleConfigured()) {
    return { ok: false, error: 'Add a Google client ID in supabaseConfig.ts to enable Google sign-in.' };
  }
  try {
    ensureGoogleConfigured();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    await GoogleSignin.signIn();
    const { idToken } = await GoogleSignin.getTokens();
    if (!idToken) return { ok: false, error: 'Google did not return an ID token.' };
    const { data, error } = await sb.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error || !data.user) return { ok: false, error: error?.message || 'Google sign-in failed.' };
    return { ok: true, user: mapCloudUser(data.user) };
  } catch (e: any) {
    const msg = e?.message || 'Google sign-in was cancelled.';
    return { ok: false, error: msg };
  }
}

export async function cloudSignOut(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut().catch(() => {});
  try {
    await GoogleSignin.signOut();
  } catch {
    /* not signed in with Google */
  }
}
