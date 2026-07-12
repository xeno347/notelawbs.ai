import { create } from 'zustand';
import { ApiError, login, me, BackendUser } from './backendApi';
import { getAppSetting, removeAppSetting, setAppSetting } from './appSettingsStorage';

const AUTH_KEY = 'auth.session';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface StoredSession {
  token: string;
}

interface AuthState {
  status: AuthStatus;
  user: BackendUser | null;
  token: string | null;
  error: string | null;
  bootstrap: (backendUrl: string) => Promise<void>;
  signIn: (backendUrl: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const saveSession = async (session: StoredSession | null) => {
  if (!session) {
    await removeAppSetting(AUTH_KEY);
    return;
  }

  await setAppSetting(AUTH_KEY, JSON.stringify(session));
};

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  token: null,
  error: null,
  bootstrap: async (backendUrl: string) => {
    set({ status: 'loading', error: null });

    try {
      const stored = await getAppSetting(AUTH_KEY);
      if (!stored) {
        set({ status: 'signedOut', user: null, token: null });
        return;
      }

      const session = JSON.parse(stored) as StoredSession;
      if (!session?.token) {
        await saveSession(null);
        set({ status: 'signedOut', user: null, token: null });
        return;
      }

      const response = await me(backendUrl, session.token);
      set({
        status: 'signedIn',
        user: response.user,
        token: session.token,
        error: null,
      });
    } catch (error: any) {
      if (error instanceof ApiError && error.status === 401) {
        await saveSession(null);
        set({
          status: 'signedOut',
          user: null,
          token: null,
          error: error.message || 'Unable to restore session.',
        });
        return;
      }

      set({
        status: 'signedOut',
        user: null,
        token: null,
        error: error?.message || 'Unable to restore session.',
      });
    }
  },
  signIn: async (backendUrl: string, email: string, password: string) => {
    set({ status: 'loading', error: null });

    try {
      const response = await login(backendUrl, email, password);
      await saveSession({ token: response.token });
      set({
        status: 'signedIn',
        user: response.user,
        token: response.token,
        error: null,
      });
    } catch (error: any) {
      set({
        status: 'signedOut',
        user: null,
        token: null,
        error: error?.message || 'Unable to sign in.',
      });
      throw error;
    }
  },
  signOut: async () => {
    await saveSession(null);
    set({ status: 'signedOut', user: null, token: null, error: null });
  },
}));
