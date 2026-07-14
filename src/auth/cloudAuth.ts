import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { appleAuth } from '@invertase/react-native-apple-authentication';
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
    return {
      ok: false,
      error:
        'Add GOOGLE_WEB_CLIENT_ID (and GOOGLE_IOS_CLIENT_ID on iOS) in src/services/supabaseConfig.local.ts, then rebuild the app.',
    };
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

export function isAppleSignInAvailable(): boolean {
  if (Platform.OS === 'ios') return appleAuth.isSupported;
  // Android needs Apple Services ID + web flow; treat as unavailable unless explicitly supported.
  try {
    return !!(appleAuth as any).isSupported;
  } catch {
    return false;
  }
}

export async function cloudSignInWithApple(): Promise<CloudResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Cloud sign-in is not configured.' };
  if (Platform.OS !== 'ios') {
    return { ok: false, error: 'Sign in with Apple is available on iOS in this build.' };
  }
  if (!appleAuth.isSupported) {
    return { ok: false, error: 'Sign in with Apple is not supported on this device.' };
  }
  try {
    const response = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
    });
    if (!response.identityToken) {
      return { ok: false, error: 'Apple did not return an identity token.' };
    }
    const { data, error } = await sb.auth.signInWithIdToken({
      provider: 'apple',
      token: response.identityToken,
      nonce: response.nonce,
    });
    if (error || !data.user) {
      return { ok: false, error: error?.message || 'Apple sign-in failed.' };
    }
    // Apple only sends the full name on the first successful sign-in — stash it in metadata when present.
    const given = response.fullName?.givenName;
    const family = response.fullName?.familyName;
    const fullName = [given, family].filter(Boolean).join(' ').trim();
    if (fullName) {
      await sb.auth.updateUser({ data: { full_name: fullName } }).catch(() => {});
      const refreshed = await getCloudUser();
      if (refreshed) return { ok: true, user: { ...refreshed, displayName: fullName } };
    }
    return { ok: true, user: mapCloudUser(data.user) };
  } catch (e: any) {
    if (e?.code === appleAuth.Error.CANCELED) {
      return { ok: false, error: 'Apple sign-in was cancelled.' };
    }
    return { ok: false, error: e?.message || 'Apple sign-in failed.' };
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
