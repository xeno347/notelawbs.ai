import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Path, Circle, Skia, DashPathEffect, BlurMask } from '@shopify/react-native-skia';
import { useStore, type Highlight } from '../store';
import { catStyle, useTheme } from '../theme';
import { CARD_WIDTH } from './ExcerptCard';
import { AI_CARD_WIDTH } from './AiCard';
import { highlightScreenAnchor } from '../services/threadAnchors';

function curvePath(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const bend = Math.min(120, Math.max(36, Math.abs(dx) * 0.38));
  const c1x = x1 + bend;
  const c2x = x2 - bend;
  return `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
}

function marginAnchorY(page: number, numPages: number, pdfFrame: { top: number; h: number }) {
  const ratio = (page - 0.5) / Math.max(numPages, 1);
  return pdfFrame.top + Math.min(pdfFrame.h * 0.96, Math.max(pdfFrame.h * 0.04, ratio * pdfFrame.h));
}

/**
 * Threads in window space:
 * - PDF end: measured pdfFrame (fixed pane — stable under canvas zoom)
 * - Card end: canvasOrigin + canvasTf.tx/ty + board(xy) * canvasTf.s
 *   (matches nested translate → scale(0,0) on the board)
 */
export default function ThreadLayer() {
  const p = useTheme();
  const threadsOn = useStore((s) => s.threadsOn);
  const nodes = useStore((s) => s.nodes);
  const highlights = useStore((s) => s.highlights);
  const ink = useStore((s) => s.ink);
  const pdfFrame = useStore((s) => s.pdfFrame);
  const canvasOrigin = useStore((s) => s.canvasOrigin);
  const canvasTf = useStore((s) => s.canvasTf);
  const nodeSizes = useStore((s) => s.nodeSizes);
  const layoutEpoch = useStore((s) => s.layoutEpoch);
  const currentPage = useStore((s) => s.currentPage);
  const numPages = useStore((s) => s.numPages);
  const activeDocId = useStore((s) => s.activeDocId);
  const hoverNodeId = useStore((s) => s.hoverNodeId);

  const wrapRef = useRef<View>(null);
  const [layerOrigin, setLayerOrigin] = useState({ x: 0, y: 0 });

  // O(1) lookups instead of `highlights.find()` per node — matters here since
  // this runs on every pan/zoom commit (~30fps while gesturing).
  const highlightById = useMemo(() => {
    const m = new Map<string, Highlight>();
    for (const h of highlights) m.set(h.id, h);
    return m;
  }, [highlights]);

  const measure = () =>
    wrapRef.current?.measureInWindow((x, y) => {
      setLayerOrigin((prev) => (prev.x === x && prev.y === y ? prev : { x, y }));
    });

  useEffect(() => {
    if (!threadsOn) return;
    measure();
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [threadsOn, pdfFrame, canvasOrigin, canvasTf, nodes, nodeSizes, layoutEpoch, currentPage, highlights.length]);

  if (!threadsOn) return null;

  const paths: Array<{
    d: string;
    color: string;
    opacity: number;
    dashed: boolean;
    pin?: { x: number; y: number };
  }> = [];

  const lx = (x: number) => x - layerOrigin.x;
  const ly = (y: number) => y - layerOrigin.y;

  const nodeScreen = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return null;
    const size = nodeSizes[id];
    const w = size?.w || n.w || (n.type === 'ai' ? AI_CARD_WIDTH : CARD_WIDTH);
    const h = size?.h || n.h || 108;
    const isExcerpt = n.type === 'excerpt';
    // Citation badge sits bottom-left on ExcerptCard.
    const localX = isExcerpt ? 14 : w / 2;
    const localY = isExcerpt ? Math.max(28, h - 16) : h / 2;
    const winX = canvasOrigin.x + canvasTf.tx + (n.x + localX) * canvasTf.s;
    const winY = canvasOrigin.y + canvasTf.ty + (n.y + localY) * canvasTf.s;
    return { x: lx(winX), y: ly(winY), winY };
  };

  for (const node of nodes) {
    if (node.type !== 'excerpt') continue;
    const data = node.data as { highlightId?: string; category: string };
    if (!data.highlightId || !pdfFrame) continue;
    const h = highlightById.get(data.highlightId);
    if (!h) continue;
    if (h.docId && h.docId !== activeDocId) continue;

    const tgt = nodeScreen(node.id);
    if (!tgt) continue;

    const offPage = h.page !== currentPage;
    const anchor = offPage
      ? {
          x: pdfFrame.left + pdfFrame.w * 0.98,
          y: marginAnchorY(h.page, numPages, pdfFrame),
        }
      : highlightScreenAnchor(h, pdfFrame, tgt.winY);

    const sx = lx(anchor.x);
    const sy = ly(anchor.y);
    const cs = catStyle(data.category);
    paths.push({
      d: curvePath(sx, sy, tgt.x, tgt.y),
      color: cs.color,
      opacity: hoverNodeId && hoverNodeId !== node.id ? 0.22 : offPage ? 0.45 : 0.88,
      dashed: offPage,
      pin: { x: sx, y: sy },
    });
  }

  for (const link of ink.links) {
    const fromWinX = canvasOrigin.x + canvasTf.tx + link.canvasPoint.x * canvasTf.s;
    const fromWinY = canvasOrigin.y + canvasTf.ty + link.canvasPoint.y * canvasTf.s;
    const from = { x: lx(fromWinX), y: ly(fromWinY), winY: fromWinY };
    let to: { x: number; y: number } | null = null;
    let dashed = false;

    if (link.highlightId && pdfFrame) {
      const h = highlightById.get(link.highlightId);
      if (h && (!h.docId || h.docId === activeDocId)) {
        const offPage = h.page !== currentPage;
        const anchor = offPage
          ? {
              x: pdfFrame.left + pdfFrame.w * 0.98,
              y: marginAnchorY(h.page, numPages, pdfFrame),
            }
          : highlightScreenAnchor(h, pdfFrame, from.winY);
        to = { x: lx(anchor.x), y: ly(anchor.y) };
        dashed = offPage;
      }
    } else if (link.page != null && pdfFrame) {
      if (link.page !== currentPage) continue;
      to = {
        x: lx(pdfFrame.left + (link.x || 0) * pdfFrame.w),
        y: ly(pdfFrame.top + (link.y || 0) * pdfFrame.h),
      };
    }

    if (!to) continue;
    paths.push({
      d: curvePath(from.x, from.y, to.x, to.y),
      color: p.accent,
      opacity: dashed ? 0.45 : 0.8,
      dashed,
      pin: to,
    });
  }

  return (
    <View ref={wrapRef} style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={measure}>
      <Canvas style={StyleSheet.absoluteFill}>
        {paths.map((pth, i) => {
          const path = Skia.Path.MakeFromSVGString(pth.d);
          if (!path) return null;
          return (
            <React.Fragment key={i}>
              <Path
                path={path}
                color={pth.color}
                style="stroke"
                strokeWidth={6}
                opacity={pth.opacity * 0.28}
                strokeCap="round">
                <BlurMask blur={6} style="normal" />
                {pth.dashed && <DashPathEffect intervals={[6, 4]} />}
              </Path>
              <Path
                path={path}
                color={pth.color}
                style="stroke"
                strokeWidth={2}
                opacity={pth.opacity}
                strokeCap="round">
                {pth.dashed && <DashPathEffect intervals={[6, 4]} />}
              </Path>
              {pth.pin && (
                <Circle cx={pth.pin.x} cy={pth.pin.y} r={4.5} color={pth.color}>
                  <BlurMask blur={3} style="solid" />
                </Circle>
              )}
            </React.Fragment>
          );
        })}
      </Canvas>
    </View>
  );
}
