import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Path, Circle, Skia, DashPathEffect } from '@shopify/react-native-skia';
import { useStore } from '../store';
import { catStyle, getPalette } from '../theme';
import { CARD_WIDTH } from './ExcerptCard';
import { AI_CARD_WIDTH } from './AiCard';

function curvePath(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

export default function ThreadLayer() {
  const p = getPalette();
  const threadsOn = useStore((s) => s.threadsOn);
  const nodes = useStore((s) => s.nodes);
  const highlights = useStore((s) => s.highlights);
  const ink = useStore((s) => s.ink);
  const pdfFrame = useStore((s) => s.pdfFrame);
  const canvasOrigin = useStore((s) => s.canvasOrigin);
  const canvasTf = useStore((s) => s.canvasTf);
  const currentPage = useStore((s) => s.currentPage);
  const hoverNodeId = useStore((s) => s.hoverNodeId);

  const wrapRef = useRef<View>(null);
  const [layerOrigin, setLayerOrigin] = useState({ x: 0, y: 0 });

  const measure = () =>
    wrapRef.current?.measureInWindow((x, y) => {
      setLayerOrigin((prev) => (prev.x === x && prev.y === y ? prev : { x, y }));
    });

  // Re-measure only when geometry that can shift the layer changes — not on a timer.
  useEffect(() => {
    if (threadsOn) measure();
  }, [threadsOn, pdfFrame, canvasOrigin]);

  if (!threadsOn) return null;

  const paths: Array<{
    d: string;
    color: string;
    opacity: number;
    dashed: boolean;
    pin?: { x: number; y: number };
  }> = [];

  // Convert window coords into layer-local coords (layer is offset below the top bar).
  const lx = (x: number) => x - layerOrigin.x;
  const ly = (y: number) => y - layerOrigin.y;

  const nodeScreen = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return null;
    const w = n.type === 'ai' ? AI_CARD_WIDTH : CARD_WIDTH;
    return {
      x: lx(canvasOrigin.x + canvasTf.tx + (n.x + w / 2) * canvasTf.s),
      y: ly(canvasOrigin.y + canvasTf.ty + (n.y + 44) * canvasTf.s),
    };
  };

  for (const node of nodes) {
    if (node.type !== 'excerpt') continue;
    const data = node.data as { highlightId?: string; category: string };
    if (!data.highlightId || !pdfFrame) continue;
    const h = highlights.find((x) => x.id === data.highlightId);
    if (!h) continue;

    const tgt = nodeScreen(node.id);
    if (!tgt) continue;

    const sx = lx(pdfFrame.left + (h.rect.x + h.rect.w / 2) * pdfFrame.w);
    const sy = ly(pdfFrame.top + (h.rect.y + h.rect.h / 2) * pdfFrame.h);
    const cs = catStyle(data.category);
    const offScreen = h.page !== currentPage;
    paths.push({
      d: curvePath(sx, sy, tgt.x, tgt.y),
      color: cs.color,
      opacity: hoverNodeId && hoverNodeId !== node.id ? 0.22 : 0.8,
      dashed: offScreen,
    });
  }

  for (const link of ink.links) {
    const from = {
      x: lx(canvasOrigin.x + canvasTf.tx + link.canvasPoint.x * canvasTf.s),
      y: ly(canvasOrigin.y + canvasTf.ty + link.canvasPoint.y * canvasTf.s),
    };
    let to: { x: number; y: number } | null = null;
    let dashed = false;

    if (link.highlightId && pdfFrame) {
      const h = highlights.find((x) => x.id === link.highlightId);
      if (h) {
        to = {
          x: lx(pdfFrame.left + (h.rect.x + h.rect.w / 2) * pdfFrame.w),
          y: ly(pdfFrame.top + (h.rect.y + h.rect.h / 2) * pdfFrame.h),
        };
        dashed = h.page !== currentPage;
      }
    } else if (link.page != null && pdfFrame) {
      to = {
        x: lx(pdfFrame.left + (link.x || 0) * pdfFrame.w),
        y: ly(pdfFrame.top + (link.y || 0) * pdfFrame.h),
      };
      dashed = link.page !== currentPage;
    }

    if (!to) continue;
    paths.push({
      d: curvePath(from.x, from.y, to.x, to.y),
      color: p.accent,
      opacity: 0.8,
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
                strokeWidth={2}
                opacity={pth.opacity}
                strokeCap="round">
                {pth.dashed && <DashPathEffect intervals={[6, 4]} />}
              </Path>
              {pth.pin && (
                <Circle cx={pth.pin.x} cy={pth.pin.y} r={4.5} color={p.accent} />
              )}
            </React.Fragment>
          );
        })}
      </Canvas>
    </View>
  );
}
