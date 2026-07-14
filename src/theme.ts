import { Appearance, Platform } from 'react-native';
import { create } from 'zustand';
import { getSetting, setSetting } from './storage';

export type CategoryKey = 'key_fact' | 'adverse' | 'favorable' | 'procedural' | 'ratio';

export type Category = { label: string; color: string; soft: string };

export const CATEGORIES: Record<CategoryKey, Category> = {
  key_fact: { label: 'Key fact', color: '#D4A73B', soft: 'rgba(226,188,84,0.42)' },
  adverse: { label: 'Adverse', color: '#D1594A', soft: 'rgba(209,89,74,0.30)' },
  favorable: { label: 'Favorable', color: '#4CA671', soft: 'rgba(76,166,113,0.32)' },
  procedural: { label: 'Procedural', color: '#5090C9', soft: 'rgba(80,144,201,0.30)' },
  ratio: { label: 'Ratio', color: '#9270CC', soft: 'rgba(146,112,204,0.30)' },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

export function catStyle(key: string): Category {
  return (CATEGORIES as Record<string, Category>)[key] || CATEGORIES.key_fact;
}

/** Document body — Georgia on iOS. UI chrome uses SF Pro (System). */
export const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
export const SANS = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

/* ------------------------------------------------------------------ */
/* iOS / iPadOS 26 — Liquid Glass + system semantic colors             */
/* Brand brass/teal reserved for legal highlights & AI, not chrome.  */
/* ------------------------------------------------------------------ */

const light = {
  bg: '#F2F2F7',
  bg2: '#E5E5EA',
  grouped: '#FFFFFF',
  surface: '#FFFFFF',
  surface2: '#F2F2F7',
  sidebar: '#F2F2F7',
  sidebarActive: '#FFFFFF',
  paperDesk: '#EBEBF0',
  surfaceGlass: 'rgba(255,255,255,0.72)',
  glassTint: 'rgba(255,255,255,0.55)',
  glassBorder: 'rgba(255,255,255,0.65)',
  overlay: 'rgba(0,0,0,0.4)',
  border: 'rgba(60,60,67,0.18)',
  borderStrong: 'rgba(60,60,67,0.29)',
  separator: 'rgba(60,60,67,0.29)',
  fill: 'rgba(120,120,128,0.16)',
  fillSecondary: 'rgba(120,120,128,0.12)',
  text: '#000000',
  textMid: 'rgba(60,60,67,0.6)',
  textMuted: 'rgba(60,60,67,0.3)',
  tint: '#007AFF',
  tintSoft: 'rgba(0,122,255,0.12)',
  accent: '#B8791E',
  accentAlt: '#D69A2E',
  accentSoft: 'rgba(184,121,30,0.14)',
  accentGlow: 'rgba(0,122,255,0.35)',
  ai: '#0E9F8B',
  aiSoft: 'rgba(14,159,139,0.12)',
  aiGlow: 'rgba(14,159,139,0.28)',
  iris: '#5B67E0',
  irisSoft: 'rgba(91,103,224,0.12)',
  success: '#34C759',
  successSoft: 'rgba(52,199,89,0.14)',
  warning: '#FF9500',
  warningSoft: 'rgba(255,149,0,0.14)',
  danger: '#FF3B30',
  topbar: 'transparent',
  topbarText: '#000000',
  topbarMuted: 'rgba(60,60,67,0.6)',
  dotGrid: 'rgba(60,60,67,0.08)',
  ink1: '#000000',
  ink2: '#B8791E',
  pdfPage: '#FFFFFF',
  pdfText: '#1D2733',
  scanline: 'rgba(14,159,139,0.34)',
  gradA: '#F2F2F7',
  gradB: '#E5E5EA',
  heroFrom: '#007AFF',
  heroTo: '#5856D6',
  blurType: 'light' as 'light' | 'dark',
};

const dark: typeof light = {
  ...light,
  bg: '#000000',
  bg2: '#1C1C1E',
  grouped: '#1C1C1E',
  surface: '#1C1C1E',
  surface2: '#2C2C2E',
  sidebar: '#000000',
  sidebarActive: '#1C1C1E',
  paperDesk: '#0C0C0E',
  surfaceGlass: 'rgba(28,28,30,0.72)',
  glassTint: 'rgba(28,28,30,0.55)',
  glassBorder: 'rgba(255,255,255,0.12)',
  overlay: 'rgba(0,0,0,0.55)',
  border: 'rgba(84,84,88,0.36)',
  borderStrong: 'rgba(84,84,88,0.65)',
  separator: 'rgba(84,84,88,0.65)',
  fill: 'rgba(120,120,128,0.32)',
  fillSecondary: 'rgba(120,120,128,0.24)',
  text: '#FFFFFF',
  textMid: 'rgba(235,235,245,0.6)',
  textMuted: 'rgba(235,235,245,0.3)',
  tint: '#0A84FF',
  tintSoft: 'rgba(10,132,255,0.18)',
  accent: '#E8A13C',
  accentSoft: 'rgba(232,161,60,0.16)',
  accentGlow: 'rgba(10,132,255,0.4)',
  ai: '#38E0C8',
  aiSoft: 'rgba(56,224,200,0.14)',
  aiGlow: 'rgba(56,224,200,0.35)',
  iris: '#7C8CF8',
  irisSoft: 'rgba(124,140,248,0.16)',
  success: '#30D158',
  successSoft: 'rgba(48,209,88,0.14)',
  warning: '#FF9F0A',
  warningSoft: 'rgba(255,159,10,0.14)',
  danger: '#FF453A',
  topbar: 'transparent',
  topbarText: '#FFFFFF',
  topbarMuted: 'rgba(235,235,245,0.55)',
  dotGrid: 'rgba(255,255,255,0.06)',
  ink1: '#FFFFFF',
  ink2: '#E8A13C',
  pdfPage: '#FFFFFF',
  gradA: '#000000',
  gradB: '#1C1C1E',
  heroFrom: '#0A84FF',
  heroTo: '#5E5CE6',
  blurType: 'dark' as 'light' | 'dark',
};

export type Palette = typeof light;
export type ThemeMode = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

function computeScheme(mode: ThemeMode): Scheme {
  if (mode === 'system') return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  return mode;
}

function paletteFor(scheme: Scheme): Palette {
  return scheme === 'dark' ? dark : light;
}

type ThemeStore = {
  mode: ThemeMode;
  scheme: Scheme;
  palette: Palette;
  setMode: (mode: ThemeMode) => void;
  syncSystem: () => void;
  initTheme: () => Promise<void>;
};

const initialMode: ThemeMode = 'system';
const initialScheme = computeScheme(initialMode);

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: initialMode,
  scheme: initialScheme,
  palette: paletteFor(initialScheme),

  setMode: (mode) => {
    const scheme = computeScheme(mode);
    set({ mode, scheme, palette: paletteFor(scheme) });
    setSetting('themeMode', mode).catch(() => {});
  },

  syncSystem: () => {
    const scheme = computeScheme(get().mode);
    if (scheme !== get().scheme) set({ scheme, palette: paletteFor(scheme) });
  },

  initTheme: async () => {
    const saved = (await getSetting('themeMode')) as ThemeMode | null;
    const mode = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
    const scheme = computeScheme(mode);
    set({ mode, scheme, palette: paletteFor(scheme) });
  },
}));

Appearance.addChangeListener(() => {
  useThemeStore.getState().syncSystem();
});

export function getPalette(): Palette {
  return useThemeStore.getState().palette;
}

export function useTheme(): Palette {
  return useThemeStore((s) => s.palette);
}

export function useThemeMode(): ThemeMode {
  return useThemeStore((s) => s.mode);
}

export function useScheme(): Scheme {
  return useThemeStore((s) => s.scheme);
}

export const TYPE = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.37, fontFamily: SANS },
  title1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0.36, fontFamily: SANS },
  title2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.35, fontFamily: SANS },
  title3: { fontSize: 20, fontWeight: '600' as const, letterSpacing: 0.38, fontFamily: SANS },
  headline: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.41, fontFamily: SANS },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' as const, letterSpacing: -0.41, fontFamily: SANS },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' as const, letterSpacing: -0.32, fontFamily: SANS },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' as const, letterSpacing: -0.24, fontFamily: SANS },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const, letterSpacing: -0.08, fontFamily: SANS },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const, letterSpacing: 0, fontFamily: SANS },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400' as const, letterSpacing: 0.06, fontFamily: SANS },
  bodySerif: { fontSize: 15, lineHeight: 22.5, fontFamily: SERIF },
  meta: { fontSize: 13, fontWeight: '600' as const, letterSpacing: -0.08, fontFamily: SANS },
};

/** iOS continuous corner radii — 10 grouped inset, 13 card, 20 sheet */
export const RADIUS = { sm: 10, md: 13, lg: 16, xl: 20, pill: 999 };

export const ELEVATION = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardActive: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  panel: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  popover: {
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  float: {
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
};

export function glow(color: string, opacity = 0.35) {
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  };
}
