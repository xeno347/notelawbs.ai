import { Appearance, Platform } from 'react-native';
import { create } from 'zustand';
import { getSetting, setSetting } from './storage';

export type CategoryKey = 'key_fact' | 'adverse' | 'favorable' | 'procedural' | 'ratio';

export type Category = { label: string; color: string; soft: string };

// Five editorial highlight tones — legible under multiply-style translucent fills.
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

// Serif for anything that reads like a document; system sans for UI chrome.
export const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
export const SANS = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

/* ------------------------------------------------------------------ */
/* Premium "Obsidian Chamber" palette — light is the default companion */
/* and dark is the graphite/brass futuristic mode. Both share keys.    */
/* ------------------------------------------------------------------ */

const light = {
  bg: '#F5F4F0',
  bg2: '#EAE8E1',
  surface: '#FFFFFF',
  surface2: '#F0EEE8',
  surfaceGlass: 'rgba(255,255,255,0.70)',
  glassTint: 'rgba(255,255,255,0.42)',
  glassBorder: 'rgba(255,255,255,0.65)',
  overlay: 'rgba(20,22,28,0.34)',
  border: 'rgba(24,26,32,0.11)',
  borderStrong: 'rgba(24,26,32,0.18)',
  text: '#181A20',
  textMid: 'rgba(24,26,32,0.72)',
  textMuted: 'rgba(24,26,32,0.46)',
  accent: '#B8791E',
  accentAlt: '#D8A23A',
  accentSoft: 'rgba(184,121,30,0.12)',
  accentGlow: 'rgba(184,121,30,0.30)',
  ai: '#0E9B8B',
  aiSoft: 'rgba(14,155,139,0.12)',
  aiGlow: 'rgba(14,155,139,0.28)',
  iris: '#5A67D8',
  irisSoft: 'rgba(90,103,216,0.12)',
  success: '#2F9E63',
  successSoft: 'rgba(47,158,99,0.14)',
  warning: '#B07A16',
  warningSoft: 'rgba(176,122,22,0.14)',
  danger: '#C0392B',
  topbar: 'rgba(20,22,28,0.96)',
  topbarText: '#F3F2EE',
  topbarMuted: 'rgba(243,242,238,0.55)',
  dotGrid: 'rgba(24,26,32,0.08)',
  ink1: '#181A20',
  ink2: '#B8791E',
  pdfPage: '#FFFFFF',
  pdfText: '#1D2733',
  scanline: 'rgba(14,155,139,0.36)',
  blurType: 'light' as 'light' | 'dark',
};

const dark: typeof light = {
  ...light,
  bg: '#0A0C12',
  bg2: '#0E1119',
  surface: '#141822',
  surface2: '#1A1F2B',
  surfaceGlass: 'rgba(20,25,36,0.55)',
  glassTint: 'rgba(12,15,22,0.40)',
  glassBorder: 'rgba(255,255,255,0.10)',
  overlay: 'rgba(3,5,10,0.62)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#F0F2F7',
  textMid: 'rgba(240,242,247,0.72)',
  textMuted: 'rgba(240,242,247,0.46)',
  accent: '#E8A13C',
  accentAlt: '#F2C14E',
  accentSoft: 'rgba(232,161,60,0.16)',
  accentGlow: 'rgba(232,161,60,0.45)',
  ai: '#38E0C8',
  aiSoft: 'rgba(56,224,200,0.14)',
  aiGlow: 'rgba(56,224,200,0.40)',
  iris: '#7C8CF8',
  irisSoft: 'rgba(124,140,248,0.16)',
  success: '#34D399',
  successSoft: 'rgba(52,211,153,0.14)',
  warning: '#F5B143',
  warningSoft: 'rgba(245,177,67,0.14)',
  danger: '#F2685C',
  topbar: 'rgba(10,12,18,0.86)',
  topbarText: '#F3F4F6',
  topbarMuted: 'rgba(243,244,246,0.55)',
  dotGrid: 'rgba(255,255,255,0.05)',
  ink1: '#F0F2F7',
  ink2: '#E8A13C',
  // PDF pages stay white — they're a document, not UI.
  pdfPage: '#FFFFFF',
  pdfText: '#1D2733',
  scanline: 'rgba(56,224,200,0.42)',
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

// Default mode is `system` so the app follows the device; when the device has
// no explicit preference this resolves to the light (default) palette.
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

// Keep the resolved palette in sync with OS light/dark changes.
Appearance.addChangeListener(() => {
  useThemeStore.getState().syncSystem();
});

/** Non-reactive palette read — safe outside React (services, one-off calls). */
export function getPalette(): Palette {
  return useThemeStore.getState().palette;
}

/** Reactive palette hook — components re-render when the theme changes. */
export function useTheme(): Palette {
  return useThemeStore((s) => s.palette);
}

export function useThemeMode(): ThemeMode {
  return useThemeStore((s) => s.mode);
}

// Type scale — sans for UI chrome, serif reserved for anything that reads like a document.
export const TYPE = {
  display: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.3 },
  h1: { fontSize: 20, fontWeight: '700' as const, letterSpacing: 0.1 },
  h2: { fontSize: 15, fontWeight: '700' as const },
  body: { fontSize: 14.5, lineHeight: 21, fontWeight: '400' as const },
  bodySerif: { fontSize: 15, lineHeight: 22.5, fontFamily: SERIF },
  meta: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 0.7 },
  caption: { fontSize: 11, fontWeight: '500' as const },
};

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

// Elevation presets — Android needs a near-opaque background under `elevation` to render
// correctly, so these are reserved for solid (not glass) surfaces like resting cards.
export const ELEVATION = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  cardActive: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 9,
  },
  panel: {
    shadowColor: '#000',
    shadowOpacity: 0.34,
    shadowRadius: 34,
    shadowOffset: { width: -8, height: 0 },
    elevation: 16,
  },
  popover: {
    shadowColor: '#000',
    shadowOpacity: 0.38,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  float: {
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
};

// Soft colored glow for primary / active affordances — layer on top of a solid surface.
export function glow(color: string, opacity = 0.4) {
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  };
}
