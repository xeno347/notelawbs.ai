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

export const INK_SWATCHES = [
  '#C0392B',
  '#E67E22',
  '#F1C40F',
  '#27AE60',
  '#2980B9',
  '#8E44AD',
  '#2C3E50',
] as const;

type AnnotationState = {
  tool: ToolMode;
  inkColor: number;
  fingerDraw: boolean;
  fitSerial: number;
  /** Drag offset for floating annotation bar (pixels from default bottom-center). */
  barOffset: { x: number; y: number };
  /** Preferred mark style for text → canvas. */
  markStyle: MarkStyle;
  setTool: (t: ToolMode) => void;
  setInkColor: (i: number) => void;
  toggleFingerDraw: () => void;
  setFingerDraw: (on: boolean) => void;
  setBarOffset: (x: number, y: number) => void;
  resetBarOffset: () => void;
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
  fingerDraw: false,
  fitSerial: 0,
  barOffset: { x: 0, y: 0 },
  markStyle: 'highlight',
  setTool: (tool) => set((s) => ({ tool, markStyle: markStyleForTool(tool, s.markStyle) })),
  setInkColor: (inkColor) => set({ inkColor }),
  toggleFingerDraw: () => set((s) => ({ fingerDraw: !s.fingerDraw })),
  setFingerDraw: (fingerDraw) => set({ fingerDraw }),
  setBarOffset: (x, y) => set({ barOffset: { x, y } }),
  resetBarOffset: () => set({ barOffset: { x: 0, y: 0 } }),
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
