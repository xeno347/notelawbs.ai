import { Appearance, Platform } from 'react-native';

export type CategoryKey = 'key_fact' | 'adverse' | 'favorable' | 'procedural' | 'ratio';

export type Category = { label: string; color: string; soft: string };

// Five editorial highlight tones — legible under multiply-style translucent fills.
export const CATEGORIES: Record<CategoryKey, Category> = {
  key_fact: { label: 'Key fact', color: '#C79A28', soft: 'rgba(226,188,84,0.42)' },
  adverse: { label: 'Adverse', color: '#B3382C', soft: 'rgba(179,56,44,0.28)' },
  favorable: { label: 'Favorable', color: '#3F7A54', soft: 'rgba(78,146,101,0.30)' },
  procedural: { label: 'Procedural', color: '#3B6B99', soft: 'rgba(76,124,178,0.28)' },
  ratio: { label: 'Ratio', color: '#6F4E9C', soft: 'rgba(132,101,180,0.28)' },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

export function catStyle(key: string): Category {
  return (CATEGORIES as Record<string, Category>)[key] || CATEGORIES.key_fact;
}

// Serif for anything that reads like a document; system sans for UI chrome.
export const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });

const light = {
  bg: '#F4F5F2',
  bg2: '#E9EBE6',
  surface: '#FFFFFF',
  surface2: '#E9EBE6',
  text: '#1D2733',
  textMid: '#33414F',
  textMuted: '#5A6B7C',
  border: '#D6DAD2',
  accent: '#B3382C',
  accentSoft: 'rgba(179,56,44,0.12)',
  danger: '#B3382C',
  topbar: '#1D2733',
  topbarText: '#F2F4F1',
  topbarMuted: 'rgba(242,244,241,0.55)',
  dotGrid: 'rgba(29,39,51,0.10)',
  ink1: '#1D2733',
  ink2: '#B3382C',
  pdfPage: '#FFFFFF',
  pdfText: '#1D2733',
};

const dark: typeof light = {
  ...light,
  bg: '#141A21',
  bg2: '#1B222B',
  surface: '#1E2731',
  surface2: '#28323D',
  text: '#E6EAEF',
  textMid: '#C2CAD3',
  textMuted: '#8A97A5',
  border: '#2E3946',
  accent: '#D9584B',
  accentSoft: 'rgba(217,88,75,0.18)',
  danger: '#D9584B',
  topbar: '#0F141A',
  topbarText: '#F2F4F1',
  topbarMuted: 'rgba(242,244,241,0.5)',
  dotGrid: 'rgba(230,234,239,0.10)',
  ink1: '#E6EAEF',
  ink2: '#D9584B',
  // PDF pages stay white — they're a document, not UI.
  pdfPage: '#FFFFFF',
  pdfText: '#1D2733',
};

export type Palette = typeof light;

export function getPalette(): Palette {
  return Appearance.getColorScheme() === 'dark' ? dark : light;
}
