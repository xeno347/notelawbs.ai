import { create } from 'zustand';
import type { MarkStyle } from './store';

/** Shared annotation tools for Reader + Canvas (LiquidText-style bottom bar). */
export type ToolMode =
  | 'navigate'
  | 'select'
  | 'box'
  | 'pen'
  | 'highlighter'
  | 'underline'
  | 'strikethrough'
  | 'eraser';

/** Ink pens — Notion accent family (pastels are for highlight fills via CATEGORIES.soft). */
export const INK_SWATCHES = [
  '#CB912F',
  '#E03E3E',
  '#2383E2',
  '#0F7B6C',
  '#9065B0',
] as const;

type AnnotationState = {
  tool: ToolMode;
  inkColor: number;
  fingerDraw: boolean;
  fitSerial: number;
  /** Drag offset for floating annotation bar (pixels from default bottom-center). */
  barOffset: { x: number; y: number };
  /** Collapsed to a compact “Tools” pill. */
  barCollapsed: boolean;
  /** Preferred mark style for text → canvas. */
  markStyle: MarkStyle;
  setTool: (t: ToolMode) => void;
  setInkColor: (i: number) => void;
  toggleFingerDraw: () => void;
  setFingerDraw: (on: boolean) => void;
  setBarOffset: (x: number, y: number) => void;
  resetBarOffset: () => void;
  setBarCollapsed: (v: boolean) => void;
  toggleBarCollapsed: () => void;
  requestFit: () => void;
  setMarkStyle: (m: MarkStyle) => void;
  cyclePencilTool: () => void;
};

function markStyleForTool(tool: ToolMode, prev: MarkStyle): MarkStyle {
  if (tool === 'underline') return 'underline';
  if (tool === 'strikethrough') return 'strikethrough';
  if (tool === 'highlighter' || tool === 'box') return 'highlight';
  return prev;
}

export const useAnnotation = create<AnnotationState>((set) => ({
  tool: 'navigate',
  inkColor: 0,
  /** Default on so Pen/Mark/Erase work with finger (simulator / no Pencil). */
  fingerDraw: true,
  fitSerial: 0,
  barOffset: { x: 0, y: 0 },
  barCollapsed: false,
  markStyle: 'highlight',
  setTool: (tool) => set((s) => ({ tool, markStyle: markStyleForTool(tool, s.markStyle) })),
  setInkColor: (inkColor) => set({ inkColor }),
  toggleFingerDraw: () => set((s) => ({ fingerDraw: !s.fingerDraw })),
  setFingerDraw: (fingerDraw) => set({ fingerDraw }),
  setBarOffset: (x, y) => set({ barOffset: { x, y } }),
  resetBarOffset: () => set({ barOffset: { x: 0, y: 0 } }),
  setBarCollapsed: (barCollapsed) => set({ barCollapsed }),
  toggleBarCollapsed: () => set((s) => ({ barCollapsed: !s.barCollapsed })),
  requestFit: () => set((s) => ({ fitSerial: s.fitSerial + 1 })),
  setMarkStyle: (markStyle) => set({ markStyle }),
  cyclePencilTool: () =>
    set((s) => ({
      tool:
        s.tool === 'eraser'
          ? 'pen'
          : s.tool === 'pen' || s.tool === 'highlighter'
            ? 'eraser'
            : 'pen',
    })),
}));

/** True when user is in an ink/draw mode (canvas or PDF). */
export function isInkTool(tool: ToolMode): boolean {
  return tool === 'pen' || tool === 'highlighter' || tool === 'eraser';
}

export function isMarkTool(tool: ToolMode): boolean {
  return tool === 'underline' || tool === 'strikethrough' || tool === 'highlighter' || tool === 'box';
}
