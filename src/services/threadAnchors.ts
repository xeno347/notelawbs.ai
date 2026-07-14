import type { Highlight, Rect } from '../store';

type Frame = { left: number; top: number; w: number; h: number };

/** Right-edge midpoint of the highlight sub-rect closest to the canvas target (window Y). */
export function highlightScreenAnchor(
  highlight: Highlight,
  pdfFrame: Frame,
  targetWindowY?: number,
): { x: number; y: number; normY: number } {
  const rects = highlight.rects?.length ? highlight.rects : [highlight.rect];
  const preferNormY =
    targetWindowY != null
      ? (targetWindowY - pdfFrame.top) / Math.max(1, pdfFrame.h)
      : highlight.rect.y + highlight.rect.h / 2;

  const pick = rects.reduce((best, rect) => {
    const bestCy = best.y + best.h / 2;
    const cy = rect.y + rect.h / 2;
    return Math.abs(cy - preferNormY) < Math.abs(bestCy - preferNormY) ? rect : best;
  }, rects[0]);

  const normY = pick.y + pick.h / 2;
  return {
    x: pdfFrame.left + (pick.x + pick.w) * pdfFrame.w,
    y: pdfFrame.top + normY * pdfFrame.h,
    normY,
  };
}

export function rectsFromHighlight(highlight: Highlight): Rect[] {
  return highlight.rects?.length ? highlight.rects : [highlight.rect];
}
