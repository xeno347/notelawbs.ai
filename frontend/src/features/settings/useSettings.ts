import { create } from 'zustand';
import { AppSettings } from '../../models/types';
import { Platform } from 'react-native';
import { getAppSetting, setAppSetting } from '../auth/appSettingsStorage';
import { getSettings as getBackendSettings, updateSettings as updateBackendSettings } from '../auth/backendApi';
import { useAuth } from '../auth/useAuth';

interface SettingsState {
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;
  bootstrap: () => Promise<void>;
}

const DEFAULT_BACKEND_URL = Platform.select({
  ios: 'http://127.0.0.1:4000',
  android: 'http://10.0.2.2:4000',
  default: 'http://localhost:4000',
});

const SETTINGS_STORAGE_KEYS: (keyof AppSettings)[] = [
  'themeMode',
  'defaultSplitRatio',
  'defaultHighlightColor',
  'sideRailExpanded',
  'rightPaneCollapsed',
  'backendUrl',
];

const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'system',
  defaultSplitRatio: 0.6,
  defaultHighlightColor: 0,
  sideRailExpanded: true,
  rightPaneCollapsed: false,
  backendUrl: DEFAULT_BACKEND_URL,
};

async function loadPersistedSettings() {
  const entries = await Promise.all(
    SETTINGS_STORAGE_KEYS.map(async (key) => {
      const raw = await getAppSetting(`settings.${key}`);
      if (raw == null) {
        return null;
      }

      try {
        return [key, JSON.parse(raw)] as const;
      } catch (error) {
        return [key, raw] as const;
      }
    }),
  );

  return entries.reduce<Partial<AppSettings>>((acc, entry) => {
    if (!entry) return acc;
    const [key, value] = entry;
    acc[key] = value;
    return acc;
  }, {});
}

async function persistSettings(settings: AppSettings) {
  await Promise.all(
    SETTINGS_STORAGE_KEYS.map((key) => setAppSetting(`settings.${key}`, JSON.stringify(settings[key]))),
  );
}

export const useSettings = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  bootstrap: async () => {
    try {
      const persisted = await loadPersistedSettings();
      const next = { ...DEFAULT_SETTINGS, ...persisted };
      const { token } = useAuth.getState();
      if (token) {
        try {
          const backend = await getBackendSettings(next.backendUrl, token);
          set({ settings: { ...next, ...backend.settings } });
          return;
        } catch (error) {
          // fall back to local settings if backend settings are unavailable
        }
      }
      set({ settings: next });
    } catch (error) {
      set({ settings: DEFAULT_SETTINGS });
    }
  },
  setSettings: (newSettings) =>
    set((state) => {
      const next = { ...state.settings, ...newSettings };
      persistSettings(next).catch((error) => {
        console.error('Failed to persist settings:', error);
      });
      const { token } = useAuth.getState();
      if (token) {
        updateBackendSettings(next.backendUrl, token, next).catch((error) => {
          console.error('Failed to persist backend settings:', error);
        });
      }
      return { settings: next };
    }),
}));
