import { create } from 'zustand';
import { AppSettings } from '../models/types';
import { Platform } from 'react-native';

interface SettingsState {
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;
}

const DEFAULT_BACKEND_URL = Platform.select({
  ios: 'http://127.0.0.1:8000',
  android: 'http://10.0.2.2:8000',
  default: 'http://localhost:8000',
});

export const useSettings = create<SettingsState>((set) => ({
  settings: {
    themeMode: 'system',
    defaultSplitRatio: 0.6,
    defaultHighlightColor: 0,
    sideRailExpanded: true,
    rightPaneCollapsed: false,
    backendUrl: DEFAULT_BACKEND_URL,
  },
  setSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),
}));
