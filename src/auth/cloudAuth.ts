import { Linking, Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { getSupabase, googleClientIds, isGoogleConfigured } from '../services/supabase';
import { randomBytes } from '../services/secureRandom';
import type { AuthUser } from '../storage';

export type CloudResult = { ok: true; user: AuthUser } | { ok: false; error: string };

/** Must be listed under Supabase → Authentication → URL Configuration → Redirect URLs. */
const GOOGLE_OAUTH_REDIRECT = 'litnotes://auth/callback';

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
  if (m.includes('nonce')) {
    return 'Google nonce mismatch. Add litnotes://auth/callback to Supabase Redirect URLs, or enable “Skip nonce check” under Authentication → Providers → Google.';
  }
  return message || 'Something went wrong. Try again.';
}

function parseAuthCallbackUrl(url: string): {
  code?: string;
  access_token?: string;
  refresh_token?: string;
} {
  try {
    const normalized = url.replace(/^litnotes:/i, 'https://litnotes.local');
    const u = new URL(normalized);
    const hash = u.hash.startsWith('#') ? u.hash.slice(1) : u.hash;
    const hashParams = new URLSearchParams(hash);
    return {
      code: u.searchParams.get('code') || undefined,
      access_token:
        hashParams.get('access_token') || u.searchParams.get('access_token') || undefined,
      refresh_token:
        hashParams.get('refresh_token') || u.searchParams.get('refresh_token') || undefined,
    };
  } catch {
    return {};
  }
}

function isGoogleAuthCallback(url: string): boolean {
  return /^litnotes:\/\/auth\/callback/i.test(url);
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

/**
 * Google via Supabase OAuth + deep link.
 *
 * Native GoogleSignIn id_token flow fails on iOS with
 * "Passed nonce and nonce in id_token should either both exist or not"
 * because the free Google SDK embeds a nonce we cannot forward to Supabase.
 */
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
        'Add a Google Web Client ID in supabaseConfig.local.ts, then try again.',
    };
  }

  // Keep native SDK configured for sign-out / Android fallbacks.
  ensureGoogleConfigured();

  try {
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: GOOGLE_OAUTH_REDIRECT,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error || !data.url) {
      return {
        ok: false,
        error: friendlyAuthError(
          error?.message ||
            'Could not start Google sign-in. Enable Google under Supabase → Authentication → Providers.',
        ),
      };
    }

    return await new Promise<CloudResult>((resolve) => {
      let settled = false;
      const finish = (result: CloudResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        sub.remove();
        resolve(result);
      };

      const handleUrl = async (url: string) => {
        if (!isGoogleAuthCallback(url)) return;
        const parts = parseAuthCallbackUrl(url);
        try {
          if (parts.code) {
            const { data: sess, error: exErr } = await sb.auth.exchangeCodeForSession(parts.code);
            if (exErr || !sess.user) {
              finish({
                ok: false,
                error: friendlyAuthError(exErr?.message || 'Google sign-in failed after redirect.'),
              });
              return;
            }
            finish({ ok: true, user: mapCloudUser(sess.user) });
            return;
          }
          if (parts.access_token && parts.refresh_token) {
            const { data: sess, error: setErr } = await sb.auth.setSession({
              access_token: parts.access_token,
              refresh_token: parts.refresh_token,
            });
            if (setErr || !sess.user) {
              finish({
                ok: false,
                error: friendlyAuthError(setErr?.message || 'Google sign-in failed after redirect.'),
              });
              return;
            }
            finish({ ok: true, user: mapCloudUser(sess.user) });
            return;
          }
          finish({
            ok: false,
            error:
              'Google redirect was missing tokens. Add litnotes://auth/callback under Supabase → Authentication → URL Configuration → Redirect URLs.',
          });
        } catch (e: any) {
          finish({ ok: false, error: friendlyAuthError(e?.message || 'Google sign-in failed.') });
        }
      };

      const sub = Linking.addEventListener('url', (e) => {
        void handleUrl(e.url);
      });

      const timer = setTimeout(() => {
        finish({ ok: false, error: 'Google sign-in timed out. Try again.' });
      }, 120000);

      void (async () => {
        try {
          const initial = await Linking.getInitialURL();
          if (initial && isGoogleAuthCallback(initial)) void handleUrl(initial);
          const supported = await Linking.canOpenURL(data.url!);
          if (!supported) {
            finish({ ok: false, error: 'Cannot open the Google sign-in page on this device.' });
            return;
          }
          await Linking.openURL(data.url!);
        } catch (e: any) {
          finish({ ok: false, error: friendlyAuthError(e?.message || 'Could not open Google sign-in.') });
        }
      })();
    });
  } catch (e: any) {
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
  const out = randomBytes(16);
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
