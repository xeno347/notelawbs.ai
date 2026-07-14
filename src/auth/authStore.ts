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

let cloudListenerBound = false;

export const useAuth = create<AuthStore>((set, get) => ({
  status: 'loading',
  user: null,
  cloud: false,
  error: null,
  submitting: false,
  permissionsHandled: false,

  init: async () => {
    await loadSupabaseOverrides();

    if (isSupabaseConfigured()) {
      // React to cloud sign-in/out (token refresh, sign-out from another device).
      if (!cloudListenerBound) {
        cloudListenerBound = true;
        onCloudAuthChange((user) => {
          if (user) {
            setWorkspaceScope(user.id);
            const already = get().status === 'authenticated' && get().user?.id === user.id;
            set({ status: 'authenticated', user, cloud: true, permissionsHandled: already ? get().permissionsHandled : true });
          } else if (get().cloud) {
            setWorkspaceScope(null);
            set({ status: 'unauthenticated', user: null, cloud: false, permissionsHandled: false });
          }
        });
      }
      const cloudUser = await getCloudUser();
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
    if (isSupabaseConfigured()) {
      const res = await cloudSignUpWithEmail(email, password, displayName);
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
  },

  login: async (email, password) => {
    set({ submitting: true, error: null });
    if (isSupabaseConfigured()) {
      const res = await cloudSignInWithEmail(email, password);
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
  },

  loginWithGoogle: async () => {
    set({ submitting: true, error: null });
    if (!isSupabaseConfigured()) {
      set({ submitting: false, error: 'Connect Supabase in Settings to use Google sign-in.' });
      return false;
    }
    const res = await cloudSignInWithGoogle();
    if (!res.ok) {
      set({ submitting: false, error: res.error });
      return false;
    }
    setWorkspaceScope(res.user.id);
    set({ submitting: false, status: 'authenticated', user: res.user, cloud: true, permissionsHandled: false });
    return true;
  },

  loginWithApple: async () => {
    set({ submitting: true, error: null });
    if (!isSupabaseConfigured()) {
      set({ submitting: false, error: 'Connect Supabase in Settings to use Apple sign-in.' });
      return false;
    }
    const res = await cloudSignInWithApple();
    if (!res.ok) {
      set({ submitting: false, error: res.error });
      return false;
    }
    setWorkspaceScope(res.user.id);
    set({ submitting: false, status: 'authenticated', user: res.user, cloud: true, permissionsHandled: false });
    return true;
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
