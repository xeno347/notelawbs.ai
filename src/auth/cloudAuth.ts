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
  try {
    const { data } = await sb.auth.getSession();
    return data.session?.user ? mapCloudUser(data.session.user) : null;
  } catch {
    return null;
  }
}

export function onCloudAuthChange(cb: (user: AuthUser | null) => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ? mapCloudUser(session.user) : null);
  });
  return () => data.subscription.unsubscribe();
}

function friendlyAuthError(message: string): string {
  const m = (message || '').toLowerCase();
  if (m.includes('network') || m.includes('fetch')) {
    return 'Network error — check Wi‑Fi and that your Supabase URL is correct.';
  }
  if (m.includes('invalid login') || m.includes('invalid credentials')) {
    return 'Incorrect email or password.';
  }
  if (m.includes('already registered') || m.includes('user already')) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (m.includes('email not confirmed')) {
    return 'Confirm your email first (or turn off “Confirm email” in Supabase Auth settings).';
  }
  return message || 'Something went wrong. Try again.';
}

export async function cloudSignInWithEmail(email: string, password: string): Promise<CloudResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Cloud sign-in is not configured.' };
  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.user) {
      return { ok: false, error: friendlyAuthError(error?.message || 'Sign-in failed.') };
    }
    return { ok: true, user: mapCloudUser(data.user) };
  } catch (e: any) {
    return { ok: false, error: friendlyAuthError(e?.message || 'Sign-in failed.') };
  }
}

export async function cloudSignUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<CloudResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Cloud sign-up is not configured.' };
  try {
    const { data, error } = await sb.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: displayName.trim() || email.trim().split('@')[0] } },
    });
    if (error) return { ok: false, error: friendlyAuthError(error.message) };
    if (!data.user) {
      return { ok: false, error: 'Sign-up failed. Try again.' };
    }
    // Email confirmation enabled → user exists but no session yet.
    if (!data.session) {
      // Some projects create the user but leave session null; try immediate sign-in.
      const login = await sb.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (login.data.session?.user) {
        return { ok: true, user: mapCloudUser(login.data.session.user) };
      }
      return {
        ok: false,
        error:
          'Account created. Confirm your email, then sign in — or disable “Confirm email” in Supabase → Authentication → Providers → Email.',
      };
    }
    return { ok: true, user: mapCloudUser(data.user) };
  } catch (e: any) {
    return { ok: false, error: friendlyAuthError(e?.message || 'Sign-up failed.') };
  }
}

let googleConfigured = false;
let googleConfiguredKey = '';

function ensureGoogleConfigured() {
  const ids = googleClientIds();
  const key = `${ids.web}|${ids.ios}`;
  if (googleConfigured && googleConfiguredKey === key) return;
  GoogleSignin.configure({
    webClientId: ids.web,
    iosClientId: ids.ios || undefined,
    offlineAccess: false,
    forceCodeForRefreshToken: false,
  });
  googleConfigured = true;
  googleConfiguredKey = key;
}

export async function cloudSignInWithGoogle(): Promise<CloudResult> {
  const sb = getSupabase();
  if (!sb) {
    return {
      ok: false,
      error: 'Add your Supabase URL and anon key in Settings → Advanced → Backend first.',
    };
  }
  if (!isGoogleConfigured()) {
    return {
      ok: false,
      error:
        'Add a Google Web Client ID in Settings → Advanced → Google sign-in (or supabaseConfig.local.ts), then try again.',
    };
  }
  try {
    ensureGoogleConfigured();
    // Play Services is Android-only — calling it on iOS can hang or throw.
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const result = await GoogleSignin.signIn();
    if ((result as any)?.type === 'cancelled' || (result as any)?.data == null && !(result as any)?.idToken) {
      // Newer API returns { type, data }; older returns user info directly.
      if ((result as any)?.type === 'cancelled') {
        return { ok: false, error: 'Google sign-in was cancelled.' };
      }
    }
    let idToken: string | null | undefined =
      (result as any)?.data?.idToken || (result as any)?.idToken;
    if (!idToken) {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens.idToken;
    }
    if (!idToken) return { ok: false, error: 'Google did not return an ID token. Check your Web Client ID.' };
    const { data, error } = await sb.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error || !data.user) {
      return {
        ok: false,
        error: friendlyAuthError(
          error?.message ||
            'Google sign-in failed. Enable Google under Supabase → Authentication → Providers.',
        ),
      };
    }
    return { ok: true, user: mapCloudUser(data.user) };
  } catch (e: any) {
    const code = e?.code || '';
    if (code === 'SIGN_IN_CANCELLED' || code === '12501') {
      return { ok: false, error: 'Google sign-in was cancelled.' };
    }
    if (code === 'DEVELOPER_ERROR' || String(e?.message || '').includes('DEVELOPER_ERROR')) {
      return {
        ok: false,
        error:
          'Google is misconfigured. Use the Web client ID in Settings, and match the iOS client to Info.plist.',
      };
    }
    return { ok: false, error: friendlyAuthError(e?.message || 'Google sign-in failed.') };
  }
}

export function isAppleSignInAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return !!appleAuth.isSupported;
  } catch {
    return false;
  }
}

function randomNonce(): string {
  const out = new Uint8Array(16);
  try {
    const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
    if (g.crypto?.getRandomValues) g.crypto.getRandomValues(out);
    else for (let i = 0; i < out.length; i++) out[i] = Math.floor(Math.random() * 256);
  } catch {
    for (let i = 0; i < out.length; i++) out[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(out, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function cloudSignInWithApple(): Promise<CloudResult> {
  const sb = getSupabase();
  if (!sb) {
    return {
      ok: false,
      error: 'Add your Supabase URL and anon key in Settings → Advanced → Backend first.',
    };
  }
  if (Platform.OS !== 'ios') {
    return { ok: false, error: 'Sign in with Apple is available on iOS.' };
  }
  if (!appleAuth.isSupported) {
    return { ok: false, error: 'Sign in with Apple is not supported on this device.' };
  }
  try {
    // Library SHA-256-hashes `nonce` before sending to Apple; Supabase needs the raw value.
    const rawNonce = randomNonce();

    const response = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      nonce: rawNonce,
    });
    if (!response.identityToken) {
      return { ok: false, error: 'Apple did not return an identity token.' };
    }

    const state = await appleAuth.getCredentialStateForUser(response.user);
    if (state !== appleAuth.State.AUTHORIZED) {
      return { ok: false, error: 'Apple did not authorize this sign-in.' };
    }

    const { data, error } = await sb.auth.signInWithIdToken({
      provider: 'apple',
      token: response.identityToken,
      nonce: rawNonce,
    });
    if (error || !data.user) {
      return {
        ok: false,
        error: friendlyAuthError(
          error?.message ||
            'Apple sign-in failed. Enable Apple under Supabase → Authentication → Providers.',
        ),
      };
    }
    const given = response.fullName?.givenName;
    const family = response.fullName?.familyName;
    const fullName = [given, family].filter(Boolean).join(' ').trim();
    if (fullName) {
      await sb.auth.updateUser({ data: { full_name: fullName } }).catch(() => {});
      return { ok: true, user: { ...mapCloudUser(data.user), displayName: fullName } };
    }
    return { ok: true, user: mapCloudUser(data.user) };
  } catch (e: any) {
    if (e?.code === appleAuth.Error.CANCELED || e?.code === '1001') {
      return { ok: false, error: 'Apple sign-in was cancelled.' };
    }
    // Missing entitlement / capability often surfaces as this.
    if (String(e?.message || '').includes('authorization attempt failed')) {
      return {
        ok: false,
        error:
          'Apple Sign In is not enabled on this App ID. Enable it in Apple Developer → Identifiers, then rebuild.',
      };
    }
    return { ok: false, error: friendlyAuthError(e?.message || 'Apple sign-in failed.') };
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
