import { Appearance, Platform } from 'react-native';
import { create } from 'zustand';
import { getSetting, setSetting } from './storage';

/** Built-in taxonomy keys. Custom matter categories use free-form string keys. */
export type BuiltinCategoryKey = 'key_fact' | 'adverse' | 'favorable' | 'procedural' | 'ratio';
export type CategoryKey = BuiltinCategoryKey | (string & {});

export type Category = { label: string; color: string; soft: string };

export type CustomCategory = Category & { key: string };

/**
 * Colorblind-safe legal categories mapped onto Notion's muted pastel highlight set.
 * Labels are always shown with color so hue is never the only signal.
 */
export const CATEGORIES: Record<BuiltinCategoryKey, Category> = {
  key_fact: { label: 'Key fact', color: '#CB912F', soft: '#FDECC8' },
  adverse: { label: 'Adverse', color: '#E03E3E', soft: '#FFE2DD' },
  favorable: { label: 'Favorable', color: '#0F7B6C', soft: '#DBEDDB' },
  procedural: { label: 'Procedural', color: '#2383E2', soft: '#D3E5EF' },
  ratio: { label: 'Ratio', color: '#9065B0', soft: '#E8DEEE' },
};

/** Notion-style annotation / tag highlight pastels */
export const HIGHLIGHTS = {
  yellow: '#FDECC8',
  red: '#FFE2DD',
  blue: '#D3E5EF',
  green: '#DBEDDB',
  purple: '#E8DEEE',
} as const;

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as BuiltinCategoryKey[];

/** Soft palette for user-defined categories (cycles). */
export const CUSTOM_CATEGORY_PALETTE: Category[] = [
  { label: '', color: '#CB912F', soft: '#FDECC8' },
  { label: '', color: '#E03E3E', soft: '#FFE2DD' },
  { label: '', color: '#2383E2', soft: '#D3E5EF' },
  { label: '', color: '#0F7B6C', soft: '#DBEDDB' },
  { label: '', color: '#9065B0', soft: '#E8DEEE' },
  { label: '', color: '#787774', soft: '#F1F1EF' },
];

/** Project/matter custom categories — synced from the workspace store. */
let extraCategories: Record<string, Category> = {};

export function setExtraCategories(list: CustomCategory[]) {
  const next: Record<string, Category> = {};
  for (const c of list) {
    if (!c?.key) continue;
    next[c.key] = { label: c.label || c.key, color: c.color, soft: c.soft };
  }
  extraCategories = next;
}

export function catStyle(key: string): Category {
  if ((CATEGORIES as Record<string, Category>)[key]) {
    return (CATEGORIES as Record<string, Category>)[key];
  }
  if (extraCategories[key]) return extraCategories[key];
  return CATEGORIES.key_fact;
}

/** Built-ins + custom keys currently registered for this matter. */
export function allCategoryKeys(): string[] {
  return [...CATEGORY_KEYS, ...Object.keys(extraCategories)];
}

export function allCategories(): Array<{ key: string } & Category> {
  return [
    ...CATEGORY_KEYS.map((key) => ({ key, ...CATEGORIES[key] })),
    ...Object.entries(extraCategories).map(([key, c]) => ({ key, ...c })),
  ];
}

/** Document body — Georgia on iOS. UI chrome uses SF Pro (System). */
export const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
export const SANS = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

/* ------------------------------------------------------------------ */
/* Notion-style visual system — monochrome-first, content-forward      */
/* ------------------------------------------------------------------ */

const light = {
  bg: '#FFFFFF',
  bg2: '#F7F6F5',
  grouped: '#FFFFFF',
  surface: '#FFFFFF',
  surface2: '#F7F6F5',
  sidebar: '#F7F6F5',
  sidebarActive: 'rgba(0,0,0,0.03)',
  paperDesk: '#F7F6F5',
  surfaceGlass: '#FFFFFF',
  glassTint: 'transparent',
  glassBorder: '#EDECEC',
  overlay: 'rgba(15,15,15,0.4)',
  border: '#EDECEC',
  borderStrong: '#E3E2E0',
  separator: '#EDECEC',
  fill: 'rgba(0,0,0,0.03)',
  fillSecondary: 'rgba(0,0,0,0.04)',
  hover: 'rgba(0,0,0,0.03)',
  press: 'rgba(0,0,0,0.06)',
  text: '#37352F',
  textMid: '#787774',
  textMuted: '#9B9A97',
  tint: '#2383E2',
  tintSoft: 'rgba(35,131,226,0.12)',
  accent: '#2383E2',
  accentAlt: '#2383E2',
  accentSoft: 'rgba(35,131,226,0.12)',
  accentGlow: 'transparent',
  ai: '#9065B0',
  aiSoft: '#E8DEEE',
  aiGlow: 'transparent',
  iris: '#9065B0',
  irisSoft: '#E8DEEE',
  success: '#0F7B6C',
  successSoft: '#DBEDDB',
  warning: '#CB912F',
  warningSoft: '#FDECC8',
  danger: '#E03E3E',
  topbar: '#FFFFFF',
  topbarText: '#37352F',
  topbarMuted: '#787774',
  dotGrid: 'rgba(55,53,47,0.06)',
  ink1: '#37352F',
  ink2: '#2383E2',
  pdfPage: '#FFFFFF',
  pdfText: '#37352F',
  scanline: 'rgba(35,131,226,0.2)',
  gradA: '#FFFFFF',
  gradB: '#F7F6F5',
  heroFrom: '#2383E2',
  heroTo: '#2383E2',
  blurType: 'light' as 'light' | 'dark',
};

const dark: typeof light = {
  ...light,
  bg: '#191919',
  bg2: '#202020',
  grouped: '#202020',
  surface: '#202020',
  surface2: '#252525',
  sidebar: '#202020',
  sidebarActive: 'rgba(255,255,255,0.055)',
  paperDesk: '#191919',
  surfaceGlass: '#202020',
  glassTint: 'transparent',
  glassBorder: '#2F2F2F',
  overlay: 'rgba(0,0,0,0.55)',
  border: '#2F2F2F',
  borderStrong: '#3A3A3A',
  separator: '#2F2F2F',
  fill: 'rgba(255,255,255,0.055)',
  fillSecondary: 'rgba(255,255,255,0.08)',
  hover: 'rgba(255,255,255,0.055)',
  press: 'rgba(255,255,255,0.08)',
  text: '#E3E2E0',
  textMid: '#9B9A97',
  textMuted: '#6F6E69',
  tint: '#529CCA',
  tintSoft: 'rgba(82,156,202,0.18)',
  accent: '#529CCA',
  accentAlt: '#529CCA',
  accentSoft: 'rgba(82,156,202,0.18)',
  accentGlow: 'transparent',
  ai: '#9A6DD7',
  aiSoft: 'rgba(154,109,215,0.18)',
  aiGlow: 'transparent',
  iris: '#9A6DD7',
  irisSoft: 'rgba(154,109,215,0.18)',
  success: '#4DAB9A',
  successSoft: 'rgba(77,171,154,0.18)',
  warning: '#FFDC49',
  warningSoft: 'rgba(255,220,73,0.16)',
  danger: '#FF7369',
  topbar: '#191919',
  topbarText: '#E3E2E0',
  topbarMuted: '#9B9A97',
  dotGrid: 'rgba(255,255,255,0.05)',
  ink1: '#E3E2E0',
  ink2: '#529CCA',
  pdfPage: '#FFFFFF',
  pdfText: '#37352F',
  gradA: '#191919',
  gradB: '#202020',
  heroFrom: '#529CCA',
  heroTo: '#529CCA',
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

/** Notion scale — body 16/1.5, headings via size + weight. */
export const TYPE = {
  largeTitle: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5, fontFamily: SANS },
  title1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.4, fontFamily: SANS },
  title2: { fontSize: 22, fontWeight: '600' as const, letterSpacing: -0.3, fontFamily: SANS },
  title3: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.2, fontFamily: SANS },
  headline: { fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.1, fontFamily: SANS },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const, letterSpacing: -0.1, fontFamily: SANS },
  callout: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const, letterSpacing: -0.08, fontFamily: SANS },
  subhead: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: -0.06, fontFamily: SANS },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const, letterSpacing: 0, fontFamily: SANS },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const, letterSpacing: 0, fontFamily: SANS },
  caption2: { fontSize: 11, lineHeight: 14, fontWeight: '400' as const, letterSpacing: 0, fontFamily: SANS },
  bodySerif: { fontSize: 16, lineHeight: 24, fontFamily: SERIF },
  meta: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0, fontFamily: SANS },
};

/** Notion radii — 4–6 row hover, 6–8 cards, pill for toolbars */
export const RADIUS = { sm: 4, md: 6, lg: 8, xl: 12, pill: 999 };

/** Flat chrome — no drop shadows. Kept as empty/minimal so existing spreads compile. */
export const ELEVATION = {
  card: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  cardActive: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  panel: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  popover: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  float: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  /** Soft page-edge only — for PDF page mimic */
  page: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
};

/** No-op for Notion flat chrome (kept for call-site compatibility). */
export function glow(_color: string, _opacity = 0.35) {
  return {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  };
}

/** Sidebar widths — Notion / HIG */
export const SIDEBAR_W = 260;
export const SIDEBAR_COMPACT_W = 56;
export const ICON_SIZE = 18;
export const ROW_H = 30;
export const MOTION_MS = 160;
