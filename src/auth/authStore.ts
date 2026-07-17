import { create } from 'zustand';
import {
  type AuthUser,
  signIn,
  signUp,
  saveSession,
  loadSession,
  clearSession,
  getUserById,
  setWorkspaceScope,
} from '../storage';
import { isSupabaseConfigured, loadSupabaseOverrides } from '../services/supabase';
import {
  cloudSignInWithEmail,
  cloudSignUpWithEmail,
  cloudSignInWithGoogle,
  cloudSignInWithApple,
  cloudSignOut,
  getCloudUser,
  onCloudAuthChange,
} from './cloudAuth';
import { useSessionLock } from './sessionLockStore';

/**
 * Temporary: skip AuthScreen / permissions and open the workspace as a local guest.
 * Set to `false` when Google/cloud auth is stable again.
 */
export const AUTH_DISABLED = true;

type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

type AuthStore = {
  status: AuthStatus;
  user: AuthUser | null;
  /** Whether the active session is a cloud (Supabase) account vs a local one. */
  cloud: boolean;
  error: string | null;
  submitting: boolean;
  /** True once the post-login permission step has been shown/handled. */
  permissionsHandled: boolean;

  init: () => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  loginWithApple: () => Promise<boolean>;
  logout: () => Promise<void>;
  setPermissionsHandled: (v: boolean) => void;
  clearError: () => void;
};

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

let cloudListenerBound = false;

export const useAuth = create<AuthStore>((set, get) => ({
  status: 'loading',
  user: null,
  cloud: false,
  error: null,
  submitting: false,
  permissionsHandled: false,

  init: async () => {
    if (AUTH_DISABLED) {
      const guest: AuthUser = {
        id: 'local-guest',
        email: 'guest@local',
        displayName: 'Guest',
        createdAt: Date.now(),
      };
      setWorkspaceScope(guest.id);
      useSessionLock.getState().unlock();
      void useSessionLock.getState().setEnabled(false);
      set({
        status: 'authenticated',
        user: guest,
        cloud: false,
        permissionsHandled: true,
        submitting: false,
        error: null,
      });
      return;
    }

    await loadSupabaseOverrides();

    if (isSupabaseConfigured()) {
      // React to cloud sign-in/out (token refresh, sign-out from another device).
      if (!cloudListenerBound) {
        cloudListenerBound = true;
        onCloudAuthChange((user) => {
          if (user) {
            setWorkspaceScope(user.id);
            // Keep an in-flight email/password sign-in's permissions flag; SSO / cold start → home.
            const keepPerms =
              get().status === 'authenticated' && get().user?.id === user.id
                ? get().permissionsHandled
                : true;
            useSessionLock.getState().unlock();
            set({
              status: 'authenticated',
              user,
              cloud: true,
              permissionsHandled: keepPerms,
              submitting: false,
              error: null,
            });
          } else if (get().cloud) {
            setWorkspaceScope(null);
            set({ status: 'unauthenticated', user: null, cloud: false, permissionsHandled: false });
          }
        });
      }
      const cloudUser = await withTimeout(getCloudUser(), 3000, null);
      if (cloudUser) {
        setWorkspaceScope(cloudUser.id);
        set({ status: 'authenticated', user: cloudUser, cloud: true, permissionsHandled: true });
        return;
      }
    }

    // Offline / local account fallback.
    const session = await loadSession();
    if (session) {
      const user = await getUserById(session.userId);
      if (user) {
        setWorkspaceScope(user.id);
        set({ status: 'authenticated', user, cloud: false, permissionsHandled: true });
        return;
      }
      await clearSession();
    }
    setWorkspaceScope(null);
    set({ status: 'unauthenticated', user: null, cloud: false, permissionsHandled: false });
  },

  register: async (email, password, displayName) => {
    set({ submitting: true, error: null });
    try {
      if (isSupabaseConfigured()) {
        const res = await withTimeout(
          cloudSignUpWithEmail(email, password, displayName),
          20000,
          { ok: false as const, error: 'Sign-up timed out. Check your network and Supabase URL.' },
        );
        if (!res.ok) {
          set({ submitting: false, error: res.error });
          return false;
        }
        setWorkspaceScope(res.user.id);
        set({ submitting: false, status: 'authenticated', user: res.user, cloud: true, permissionsHandled: false });
        return true;
      }
      const res = await signUp(email, password, displayName);
      if (!res.ok) {
        set({ submitting: false, error: res.error });
        return false;
      }
      setWorkspaceScope(res.user.id);
      await saveSession({ userId: res.user.id, email: res.user.email, issuedAt: Date.now() });
      set({ submitting: false, status: 'authenticated', user: res.user, cloud: false, permissionsHandled: false });
      return true;
    } catch (e: any) {
      set({ submitting: false, error: e?.message || 'Sign-up failed.' });
      return false;
    }
  },

  login: async (email, password) => {
    set({ submitting: true, error: null });
    try {
      if (isSupabaseConfigured()) {
        const res = await withTimeout(
          cloudSignInWithEmail(email, password),
          20000,
          { ok: false as const, error: 'Sign-in timed out. Check your network and Supabase URL.' },
        );
        if (!res.ok) {
          set({ submitting: false, error: res.error });
          return false;
        }
        setWorkspaceScope(res.user.id);
        set({ submitting: false, status: 'authenticated', user: res.user, cloud: true, permissionsHandled: false });
        return true;
      }
      const res = await signIn(email, password);
      if (!res.ok) {
        set({ submitting: false, error: res.error });
        return false;
      }
      setWorkspaceScope(res.user.id);
      await saveSession({ userId: res.user.id, email: res.user.email, issuedAt: Date.now() });
      set({ submitting: false, status: 'authenticated', user: res.user, cloud: false, permissionsHandled: false });
      return true;
    } catch (e: any) {
      set({ submitting: false, error: e?.message || 'Sign-in failed.' });
      return false;
    }
  },

  loginWithGoogle: async () => {
    set({ submitting: true, error: null });
    try {
      await loadSupabaseOverrides();
      if (!isSupabaseConfigured()) {
        set({
          submitting: false,
          error: 'Add Supabase URL + anon key in Settings → Advanced → Backend, then try Google again.',
        });
        return false;
      }
      const res = await withTimeout(
        cloudSignInWithGoogle(),
        130000,
        { ok: false as const, error: 'Google sign-in timed out.' },
      );
      if (!res.ok) {
        set({ submitting: false, error: res.error });
        return false;
      }
      setWorkspaceScope(res.user.id);
      // SSO returns from a system sheet that backgrounds the app — clear any lock and
      // skip the one-time permissions gate so the workspace opens immediately.
      useSessionLock.getState().unlock();
      set({
        submitting: false,
        status: 'authenticated',
        user: res.user,
        cloud: true,
        permissionsHandled: true,
        error: null,
      });
      return true;
    } catch (e: any) {
      set({ submitting: false, error: e?.message || 'Google sign-in failed.' });
      return false;
    }
  },

  loginWithApple: async () => {
    set({ submitting: true, error: null });
    try {
      await loadSupabaseOverrides();
      if (!isSupabaseConfigured()) {
        set({
          submitting: false,
          error: 'Add Supabase URL + anon key in Settings → Advanced → Backend, then try Apple again.',
        });
        return false;
      }
      const res = await withTimeout(
        cloudSignInWithApple(),
        60000,
        { ok: false as const, error: 'Apple sign-in timed out.' },
      );
      if (!res.ok) {
        set({ submitting: false, error: res.error });
        return false;
      }
      setWorkspaceScope(res.user.id);
      useSessionLock.getState().unlock();
      set({
        submitting: false,
        status: 'authenticated',
        user: res.user,
        cloud: true,
        permissionsHandled: true,
        error: null,
      });
      return true;
    } catch (e: any) {
      set({ submitting: false, error: e?.message || 'Apple sign-in failed.' });
      return false;
    }
  },

  logout: async () => {
    if (get().cloud) await cloudSignOut();
    await clearSession();
    setWorkspaceScope(null);
    set({ status: 'unauthenticated', user: null, cloud: false, permissionsHandled: false, error: null });
  },

  setPermissionsHandled: (v) => set({ permissionsHandled: v }),
  clearError: () => set({ error: null }),
}));
