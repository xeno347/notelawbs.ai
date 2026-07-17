import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  LayoutRectangle,
  PixelRatio,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Canvas, Path, Circle, Skia, Points, vec } from '@shopify/react-native-skia';
import Svg, { Polyline } from 'react-native-svg';
import { Undo2, Redo2, LayoutGrid, SquareDashedMousePointer, Trash2 } from 'lucide-react-native';
import {
  useStore,
  type Stroke,
  type Edge,
  EDGE_RELATIONS,
  type EdgeRelation,
  type GroupData,
} from '../store';
import { useCollab, useViewerLocked } from '../collab/collabStore';
import { useAnnotation, INK_SWATCHES } from '../annotationStore';
import {
  shouldAcceptDraw,
  pencilStrokeWidth,
  createPencilDoubleTap,
  readForce,
} from '../services/pencilGestures';
import { allCategories, getPalette, useTheme, RADIUS, ELEVATION } from '../theme';
import ExcerptCard, { CARD_WIDTH } from './ExcerptCard';
import AiCard, { AI_CARD_WIDTH } from './AiCard';
import NoteCard, { NOTE_CARD_WIDTH } from './NoteCard';
import GroupCard, { GROUP_CARD_WIDTH } from './GroupCard';
import CollabCursors from './CollabCursors';

/**
 * Logical board size in points. Skia allocates BOARD × PixelRatio GPU textures;
 * Metal rejects anything above 8192 — 6000@2x (=12000) was crashing every paint.
 * Keep well under the limit so PDFium + Skia can coexist on 2–3GB iPads.
 */
const MAX_METAL_TEX = 8192;
const BOARD = Math.min(
  2400,
  Math.floor(MAX_METAL_TEX / Math.max(PixelRatio.get(), 1)) - 64,
);

function nodeWidth(type?: string) {
  if (type === 'ai') return AI_CARD_WIDTH;
  if (type === 'note') return NOTE_CARD_WIDTH;
  if (type === 'group') return GROUP_CARD_WIDTH;
  return CARD_WIDTH;
}

function pointsToSvg(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
  return d;
}

function dist(t: any[]) {
  const dx = t[0].pageX - t[1].pageX;
  const dy = t[0].pageY - t[1].pageY;
  return Math.hypot(dx, dy);
}

export default function CanvasBoard() {
  const p = useTheme();
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const ink = useStore((s) => s.ink);
  const linking = useStore((s) => s.linking);
  const addStroke = useStore((s) => s.addStroke);
  const eraseAt = useStore((s) => s.eraseAt);
  const setInkLinkPoint = useStore((s) => s.setInkLinkPoint);
  const cancelLink = useStore((s) => s.cancelLink);
  const addEdge = useStore((s) => s.addEdge);
  const updateEdge = useStore((s) => s.updateEdge);
  const setCanvasOrigin = useStore((s) => s.setCanvasOrigin);
  const setCanvasTf = useStore((s) => s.setCanvasTf);
  const setCanvasViewport = useStore((s) => s.setCanvasViewport);
  const focusNodeId = useStore((s) => s.focusNodeId);
  const clearFocusNode = useStore((s) => s.clearFocusNode);
  const setHoverNodeIdGlobal = useStore((s) => s.setHoverNodeId);
  const history = useStore((s) => s.history);
  const undoCanvas = useStore((s) => s.undoCanvas);
  const redoCanvas = useStore((s) => s.redoCanvas);
  const snapToGrid = useStore((s) => s.snapToGrid);
  const toggleSnapToGrid = useStore((s) => s.toggleSnapToGrid);
  const selectedNodeIds = useStore((s) => s.selectedNodeIds);
  const selectNodesInRect = useStore((s) => s.selectNodesInRect);
  const clearSelection = useStore((s) => s.clearSelection);
  const removeSelectedNodes = useStore((s) => s.removeSelectedNodes);
  const setSelectedCategory = useStore((s) => s.setSelectedCategory);
  const customCategories = useStore((s) => s.customCategories);
  void customCategories;
  const sendCursor = useCollab((s) => s.sendCursor);
  const viewerLocked = useViewerLocked();
  const boardRef = useRef<View>(null);
  const layoutEpoch = useStore((s) => s.layoutEpoch);

  const [container, setContainer] = useState<LayoutRectangle | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);
  const marqueeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const tool = useAnnotation((s) => s.tool);
  const inkColor = useAnnotation((s) => s.inkColor);
  const fingerDraw = useAnnotation((s) => s.fingerDraw);
  const fitSerial = useAnnotation((s) => s.fitSerial);
  const drawMode = tool === 'pen' || tool === 'highlighter';
  const eraseMode = tool === 'eraser';
  const [connectSource, setConnectSource] = useState<string | null>(null);
  // `tf` is the *committed* transform used by React-rendered layers (cards,
  // grid, thread overlay). The live pan/zoom runs on the UI thread through the
  // shared values below so gestures never wait on a React re-render — that is
  // what previously made panning tear.
  const storedTf = useStore((s) => s.canvasTf);
  const [tf, setTf] = useState(storedTf);
  const [gridTf, setGridTf] = useState(storedTf);
  const [liveStroke, setLiveStroke] = useState<Stroke | null>(null);
  const [livePointsSvg, setLivePointsSvg] = useState('');
  const [pendingRelation, setPendingRelation] = useState<{
    source: string;
    target: string;
  } | null>(null);

  const sScale = useSharedValue(storedTf.s);
  const sX = useSharedValue(storedTf.tx);
  const sY = useSharedValue(storedTf.ty);

  const tfRef = useRef(tf);
  const commitTs = useRef(0);
  const liveStrokeRaf = useRef<number | null>(null);
  const inkColors = useMemo(() => [...INK_SWATCHES], []);

  // Nested translate → scale(about 0,0) so screen = board * s + t
  // (matches ThreadLayer / drag math). A single translate+scale list scales the
  // translation too and makes zoom + threads drift.
  const translateStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sX.value }, { translateY: sY.value }],
  }));
  const scaleStyle = useAnimatedStyle(() => {
    const s = sScale.value;
    // Scale about top-left without transformOrigin (string/array both crash or warn
    // in Reanimated on iOS). Compensate default center-origin scale.
    const c = BOARD / 2;
    return {
      transform: [
        { scale: s },
        { translateX: -c * (1 - s) },
        { translateY: -c * (1 - s) },
      ],
    };
  });

  // Push a transform to every layer at once: UI thread (shared values) + the
  // committed React state used by cards/grid/overlays. `animate` springs the
  // shared values for programmatic jumps (Fit / focus); gestures set them live.
  const applyTf = useCallback(
    (next: { s: number; tx: number; ty: number }, animate = false) => {
      tfRef.current = next;
      useStore.getState().setCanvasTf(next);
      if (animate) {
        // Instant shared values when threads need accuracy; spring only the grid feel.
        sScale.value = next.s;
        sX.value = next.tx;
        sY.value = next.ty;
      } else {
        sScale.value = next.s;
        sX.value = next.tx;
        sY.value = next.ty;
      }
      setTf(next);
    },
    [sScale, sX, sY],
  );

  // During a live gesture we only mirror the transform into React state on a
  // throttle (grid + card scale), while the shared values drive motion at 60fps.
  const commitDuringGesture = useCallback((next: { s: number; tx: number; ty: number }) => {
    tfRef.current = next;
    // Card *dragging* reads the live position straight off the shared values,
    // so it stays 60fps regardless. Threads only need to track pan/zoom at a
    // human-perceptible rate — writing to the store on every raw touch-move
    // event (not just every 32ms) forced ThreadLayer to re-render and rescan
    // nodes×highlights at touch-event frequency instead of ~30fps.
    const now = Date.now();
    if (now - commitTs.current > 32) {
      commitTs.current = now;
      setTf(next);
      useStore.getState().setCanvasTf(next);
    }
  }, []);

  useEffect(() => {
    if (fitSerial <= 0) return;
    // PRD 4.3 “Frame all” — zoom to the bounding box of every card.
    const state = useStore.getState();
    const list = state.nodes;
    if (!list.length || !container) {
      applyTf({ s: 1, tx: 20, ty: 20 }, true);
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of list) {
      const w = n.w || nodeWidth(n.type);
      const h = n.h || state.nodeSizes[n.id]?.h || 140;
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + w);
      maxY = Math.max(maxY, n.y + h);
    }
    const pad = 48;
    const contentW = Math.max(80, maxX - minX + pad * 2);
    const contentH = Math.max(80, maxY - minY + pad * 2);
    const scale = Math.min(2.5, Math.max(0.2, Math.min(container.width / contentW, container.height / contentH)));
    const tx = container.width / 2 - (minX + (maxX - minX) / 2) * scale;
    const ty = container.height / 2 - (minY + (maxY - minY) / 2) * scale;
    applyTf({ s: scale, tx, ty }, true);
  }, [fitSerial, applyTf, container]);

  useEffect(() => {
    setCanvasTf(tf);
  }, [tf, setCanvasTf]);

  // Debounce grid updates so pan/zoom stays fluid
  useEffect(() => {
    const t = setTimeout(() => setGridTf(tf), 80);
    return () => clearTimeout(t);
  }, [tf]);

  // Search / thread jumps land here: center the target node and flash it briefly.
  useEffect(() => {
    if (!focusNodeId || !container) return;
    const n = nodes.find((x) => x.id === focusNodeId);
    if (!n) {
      clearFocusNode();
      return;
    }
    const w = nodeWidth(n.type);
    const boardX = n.x + w / 2;
    const boardY = n.y + 60;
    applyTf({ s: 1, tx: container.width / 2 - boardX, ty: container.height / 2 - boardY }, true);
    setHoverNodeIdGlobal(focusNodeId);
    const t = setTimeout(() => {
      setHoverNodeIdGlobal(null);
      clearFocusNode();
    }, 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNodeId, container]);

  const publishOrigin = useCallback(() => {
    boardRef.current?.measureInWindow((x, y) => setCanvasOrigin({ x, y }));
  }, [setCanvasOrigin]);

  useEffect(() => {
    publishOrigin();
  }, [layoutEpoch, publishOrigin]);
  const gestureStart = useRef({ s: 1, tx: 0, ty: 0, dist: 0, focal: { x: 0, y: 0 } });
  const strokeRef = useRef<Stroke | null>(null);
  const pencilDoubleTap = useRef(
    createPencilDoubleTap(() => useAnnotation.getState().cyclePencilTool()),
  );

  // Draw coords are local to the transformed board (draw layer sits inside the transform).
  const toBoard = (x: number, y: number) => ({ x, y });

  const drawing = drawMode || eraseMode || (linking.active && linking.step === 'canvas');

  // Board pan + pinch. In select mode, one-finger drag draws a marquee instead of panning.
  const boardPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (e) => (e.nativeEvent.touches?.length || 0) >= 2,
        onMoveShouldSetPanResponderCapture: (_e, g) => g.numberActiveTouches >= 2,
        onMoveShouldSetPanResponder: (e, g) => {
          if (g.numberActiveTouches === 2) return true;
          if (drawing && shouldAcceptDraw(e, fingerDraw)) return false;
          // Leave room for cards to claim 1-finger drags first (they use dx>3).
          return Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10;
        },
        onPanResponderGrant: (evt) => {
          const t = tfRef.current;
          const touches = evt.nativeEvent.touches;
          const origin = useStore.getState().canvasOrigin;
          const focal =
            touches.length === 2
              ? {
                  x: (touches[0].pageX + touches[1].pageX) / 2 - origin.x,
                  y: (touches[0].pageY + touches[1].pageY) / 2 - origin.y,
                }
              : { x: 0, y: 0 };
          gestureStart.current = {
            s: t.s,
            tx: t.tx,
            ty: t.ty,
            dist: touches.length === 2 ? dist(touches) : 0,
            focal,
          };
          strokeRef.current = null;
          setLiveStroke(null);
          setLivePointsSvg('');

          if (selectMode && touches.length === 1) {
            const locX = (touches[0] as any).locationX ?? 0;
            const locY = (touches[0] as any).locationY ?? 0;
            const boardX = (locX - t.tx) / t.s;
            const boardY = (locY - t.ty) / t.s;
            marqueeStart.current = { x: boardX, y: boardY };
            const zero = { x: boardX, y: boardY, w: 0, h: 0 };
            marqueeRef.current = zero;
            setMarquee(zero);
          } else {
            marqueeStart.current = null;
            marqueeRef.current = null;
            setMarquee(null);
          }
        },
        onPanResponderMove: (evt, g) => {
          const touches = evt.nativeEvent.touches;
          const start = gestureStart.current;
          if (touches.length === 2 && start.dist > 0) {
            const newDist = dist(touches);
            const ratio = newDist / start.dist;
            const s = Math.min(3, Math.max(0.3, start.s * ratio));
            const f = start.focal;
            const boardFx = (f.x - start.tx) / start.s;
            const boardFy = (f.y - start.ty) / start.s;
            const next = { s, tx: f.x - boardFx * s, ty: f.y - boardFy * s };
            sScale.value = next.s;
            sX.value = next.tx;
            sY.value = next.ty;
            commitDuringGesture(next);
          } else if (selectMode && marqueeStart.current && touches.length === 1) {
            const t = start;
            const locX = (touches[0] as any).locationX ?? 0;
            const locY = (touches[0] as any).locationY ?? 0;
            const boardX = (locX - t.tx) / t.s;
            const boardY = (locY - t.ty) / t.s;
            const ox = marqueeStart.current.x;
            const oy = marqueeStart.current.y;
            const rect = { x: ox, y: oy, w: boardX - ox, h: boardY - oy };
            marqueeRef.current = rect;
            setMarquee(rect);
          } else {
            const next = { s: start.s, tx: start.tx + g.dx, ty: start.ty + g.dy };
            sX.value = next.tx;
            sY.value = next.ty;
            commitDuringGesture(next);
            const t0 = touches[0];
            if (t0) sendCursor((t0.locationX - start.tx) / start.s, (t0.locationY - start.ty) / start.s);
          }
        },
        onPanResponderRelease: () => {
          if (selectMode && marqueeRef.current) {
            selectNodesInRect(marqueeRef.current);
            marqueeRef.current = null;
            setMarquee(null);
            marqueeStart.current = null;
          } else {
            const next = tfRef.current;
            setTf(next);
            useStore.getState().setCanvasTf(next);
            publishOrigin();
          }
        },
        onPanResponderTerminate: () => {
          marqueeRef.current = null;
          setMarquee(null);
          marqueeStart.current = null;
          const next = tfRef.current;
          setTf(next);
          useStore.getState().setCanvasTf(next);
          publishOrigin();
        },
      }),
    [
      drawing,
      fingerDraw,
      sendCursor,
      sScale,
      sX,
      sY,
      commitDuringGesture,
      publishOrigin,
      selectMode,
      selectNodesInRect,
    ],
  );

  // Ink under cards — Pencil draws board ink; excerpt cards ignore pointers while inking.
  const drawPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (evt) => {
          if ((evt.nativeEvent.touches?.length || 1) !== 1) return false;
          if (linking.active && linking.step === 'canvas') return true;
          if (!drawMode && !eraseMode) return false;
          return shouldAcceptDraw(evt, fingerDraw);
        },
        onMoveShouldSetPanResponder: (evt) => shouldAcceptDraw(evt, fingerDraw) || eraseMode,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          if (pencilDoubleTap.current(evt)) return;
          const { locationX, locationY } = evt.nativeEvent as any;
          const force = readForce(evt);
          const bp = toBoard(locationX, locationY);
          if (linking.active && linking.step === 'canvas') {
            setInkLinkPoint(bp);
            return;
          }
          if (eraseMode) {
            eraseAt(bp.x, bp.y, 22 / Math.max(0.3, tfRef.current.s));
            return;
          }
          const width =
            tool === 'highlighter' || tool === 'pen'
              ? pencilStrokeWidth(tool, force)
              : pencilStrokeWidth('pen', force);
          const st: Stroke = {
            id: `${Date.now()}`,
            color: inkColor,
            width,
            points: [bp],
          };
          strokeRef.current = st;
          setLiveStroke(st);
          setLivePointsSvg(`${bp.x},${bp.y}`);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent as any;
          const force = readForce(evt);
          const bp = toBoard(locationX, locationY);
          sendCursor(bp.x, bp.y);
          if (eraseMode) {
            eraseAt(bp.x, bp.y, 22 / Math.max(0.3, tfRef.current.s));
            return;
          }
          if (!strokeRef.current) return;
          strokeRef.current.points.push(bp);
          if (tool === 'pen' && force > 0) {
            strokeRef.current.width = pencilStrokeWidth('pen', force);
          }
          if (liveStrokeRaf.current != null) return;
          liveStrokeRaf.current = requestAnimationFrame(() => {
            liveStrokeRaf.current = null;
            const pts = strokeRef.current?.points;
            if (!pts?.length) return;
            setLivePointsSvg(pts.map((pt) => `${pt.x},${pt.y}`).join(' '));
            setLiveStroke(strokeRef.current ? { ...strokeRef.current } : null);
          });
        },
        onPanResponderRelease: () => {
          if (liveStrokeRaf.current != null) {
            cancelAnimationFrame(liveStrokeRaf.current);
            liveStrokeRaf.current = null;
          }
          if (strokeRef.current && strokeRef.current.points.length > 1) {
            addStroke(strokeRef.current);
          }
          strokeRef.current = null;
          setLiveStroke(null);
          setLivePointsSvg('');
        },
      }),
    [
      eraseMode,
      inkColor,
      linking,
      setInkLinkPoint,
      eraseAt,
      addStroke,
      sendCursor,
      drawMode,
      fingerDraw,
      tool,
    ],
  );
  const handleConnectTo = useCallback(
    (id: string) => {
      if (!connectSource) return;
      setPendingRelation({ source: connectSource, target: id });
      setConnectSource(null);
    },
    [connectSource],
  );

  const confirmRelation = (relation: EdgeRelation) => {
    if (!pendingRelation) return;
    addEdge(pendingRelation.source, pendingRelation.target, undefined, relation);
    setPendingRelation(null);
  };

  // Cull off-screen cards from mounting — edges/threads still use the full
  // `nodes` list (cheap Skia draws), only the heavy per-card Views are culled.
  const collapsedGroupIds = useMemo(() => {
    const ids = new Set<string>();
    for (const n of nodes) {
      if (n.type === 'group' && (n.data as GroupData).collapsed) ids.add(n.id);
    }
    return ids;
  }, [nodes]);

  const visibleNodes = useMemo(() => {
    if (!container) return nodes;
    const margin = 420;
    const scl = Math.max(0.05, tf.s);
    const viewLeft = -tf.tx / scl - margin;
    const viewTop = -tf.ty / scl - margin;
    const viewRight = viewLeft + container.width / scl + margin * 2;
    const viewBottom = viewTop + container.height / scl + margin * 2;
    return nodes.filter((n) => {
      if (n.groupId && collapsedGroupIds.has(n.groupId)) return false;
      const w = n.w || nodeWidth(n.type);
      const h = n.h || 160;
      return n.x + w >= viewLeft && n.x <= viewRight && n.y + h >= viewTop && n.y <= viewBottom;
    });
  }, [nodes, container, tf, collapsedGroupIds]);

  const inkViewBox = useMemo(() => {
    if (!container) return null;
    const margin = 500;
    const scl = Math.max(0.05, tf.s);
    const left = -tf.tx / scl - margin;
    const top = -tf.ty / scl - margin;
    return {
      left,
      top,
      right: left + container.width / scl + margin * 2,
      bottom: top + container.height / scl + margin * 2,
    };
  }, [container, tf]);

  const s = styles(p);

  return (
    <View
      style={s.root}
      onLayout={(e) => {
        setContainer(e.nativeEvent.layout);
        setCanvasViewport({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
        publishOrigin();
      }}>
      {container && <DotGrid width={container.width} height={container.height} tf={gridTf} color={p.dotGrid} />}
      <View ref={boardRef} style={s.board} onLayout={publishOrigin} {...boardPan.panHandlers}>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, translateStyle]}>
          <Animated.View style={[{ width: BOARD, height: BOARD }, scaleStyle]}>
            <EdgesLayer edges={edges} nodes={nodes} labelColor={p.textMid} />
            <InkLayer ink={ink} inkColors={inkColors} accent={p.accent} viewBox={inkViewBox} />

            {liveStroke && livePointsSvg.length > 0 && (
              <Svg
                width={BOARD}
                height={BOARD}
                style={{ position: 'absolute', left: 0, top: 0, zIndex: 2 }}
                pointerEvents="none">
                <Polyline
                  points={livePointsSvg}
                  fill="none"
                  stroke={inkColors[liveStroke.color] || inkColors[0]}
                  strokeWidth={liveStroke.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}

            <View
              style={[StyleSheet.absoluteFill, { zIndex: 8 }]}
              pointerEvents={viewerLocked || drawing ? 'none' : 'box-none'}>
              {visibleNodes.map((n) => (
                <View
                  key={n.id}
                  pointerEvents="auto"
                  // Groups always paint behind other card types so they read as
                  // containers, regardless of their own z history.
                  style={{ zIndex: n.type === 'group' ? (n.z || 1) : (n.z || 1) + 1000 }}>
                  {n.type === 'ai' ? (
                    <AiCard
                      node={n}
                      connectSource={connectSource}
                      onConnectStart={setConnectSource}
                      onConnectTo={handleConnectTo}
                    />
                  ) : n.type === 'note' ? (
                    <NoteCard node={n} />
                  ) : n.type === 'group' ? (
                    <GroupCard node={n} />
                  ) : (
                    <ExcerptCard
                      node={n}
                      connectSource={connectSource}
                      onConnectStart={setConnectSource}
                      onConnectTo={handleConnectTo}
                    />
                  )}
                </View>
              ))}
            </View>

            {/* Draw / link capture sits above cards so strokes are never stolen. */}
            {drawing && (
              <View style={[StyleSheet.absoluteFill, { zIndex: 40 }]} {...drawPan.panHandlers} />
            )}

            {marquee ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: Math.min(marquee.x, marquee.x + marquee.w),
                  top: Math.min(marquee.y, marquee.y + marquee.h),
                  width: Math.abs(marquee.w),
                  height: Math.abs(marquee.h),
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: p.tint,
                  backgroundColor: p.tintSoft,
                  zIndex: 50,
                }}
              />
            ) : null}

            <CollabCursors scale={tf.s} />
          </Animated.View>
        </Animated.View>
      </View>

      <View style={s.historyCluster} pointerEvents="box-none">
        <TouchableOpacity
          accessibilityLabel="Undo"
          disabled={!history.past.length}
          style={[s.historyBtn, !history.past.length && s.historyBtnDisabled]}
          onPress={undoCanvas}>
          <Undo2 size={16} color={history.past.length ? p.text : p.textMuted} strokeWidth={1.5} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Redo"
          disabled={!history.future.length}
          style={[s.historyBtn, !history.future.length && s.historyBtnDisabled]}
          onPress={redoCanvas}>
          <Redo2 size={16} color={history.future.length ? p.text : p.textMuted} strokeWidth={1.5} />
        </TouchableOpacity>
        <View style={s.historySep} />
        <TouchableOpacity
          accessibilityLabel="Marquee select"
          style={[s.historyBtn, selectMode && s.historyBtnActive]}
          onPress={() => {
            setSelectMode((v) => !v);
            if (selectMode) clearSelection();
          }}>
          <SquareDashedMousePointer size={16} color={selectMode ? '#fff' : p.text} strokeWidth={1.5} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Snap to grid"
          style={[s.historyBtn, snapToGrid && s.historyBtnActive]}
          onPress={toggleSnapToGrid}>
          <LayoutGrid size={16} color={snapToGrid ? '#fff' : p.text} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>

      {selectedNodeIds.length > 0 ? (
        <View style={s.selectionBar} pointerEvents="box-none">
          <Text style={s.selectionCount}>{selectedNodeIds.length} selected</Text>
          <View style={s.selectionCats}>
            {allCategories()
              .slice(0, 6)
              .map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[s.catDot, { backgroundColor: c.color }]}
                  onPress={() => setSelectedCategory(c.key)}
                  accessibilityLabel={`Tag ${c.label}`}
                />
              ))}
          </View>
          <TouchableOpacity
            style={s.selectionBtn}
            onPress={removeSelectedNodes}
            accessibilityLabel="Delete selected">
            <Trash2 size={16} color={p.danger} strokeWidth={1.5} />
          </TouchableOpacity>
          <TouchableOpacity style={s.selectionBtn} onPress={clearSelection}>
            <Text style={{ color: p.textMid, fontSize: 12, fontWeight: '500' }}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {nodes.length === 0 && ink.strokes.filter((st) => st.pdfPage == null).length === 0 && (
        <View style={s.emptyHint} pointerEvents="none">
          <View style={s.emptyIcon}>
            <Text style={s.emptyIconGlyph}>◎</Text>
          </View>
          <Text style={s.emptyTitle}>Canvas</Text>
          <Text style={s.emptyText}>
            Use Text or Box in the reader, then Highlight to drop excerpt cards here. Tap Note for a
            sticky note, Pen to draw (Finger is on by default), and Link to wire ink to a PDF spot.
          </Text>
        </View>
      )}

      {linking.active && (
        <View style={s.linkBanner}>
          <Text style={s.linkBannerText}>
            {linking.step === 'canvas'
              ? 'Tap a point on your handwriting'
              : 'Tap a highlight or paragraph in the reader'}
          </Text>
          <TouchableOpacity onPress={cancelLink}>
            <Text style={s.linkCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {pendingRelation && (
        <View style={s.relationSheet}>
          <Text style={s.relationTitle}>Edge type</Text>
          <Text style={s.relationHint}>PRD mind-map relation — colour encodes the argument link.</Text>
          <View style={s.relationRow}>
            {EDGE_RELATIONS.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[s.relationChip, { borderColor: r.color, backgroundColor: `${r.color}22` }]}
                onPress={() => confirmRelation(r.key)}>
                <Text style={[s.relationChipText, { color: r.color }]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => setPendingRelation(null)}>
            <Text style={s.linkCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const EdgesLayer = React.memo(function EdgesLayer({
  edges,
  nodes,
  labelColor,
}: {
  edges: Edge[];
  nodes: Array<{ id: string; type?: string; x: number; y: number }>;
  labelColor: string;
}) {
  const center = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return null;
    const w = nodeWidth(n.type);
    return { x: n.x + w / 2, y: n.y + 50 };
  };
  const colorFor = (e: Edge) =>
    EDGE_RELATIONS.find((r) => r.key === (e.relation || 'related'))?.color || '#C0392B';
  return (
    <View style={{ width: BOARD, height: BOARD, position: 'absolute' }} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {edges.map((e) => {
          const a = center(e.source);
          const b = center(e.target);
          if (!a || !b) return null;
          const path = Skia.Path.MakeFromSVGString(`M ${a.x} ${a.y} L ${b.x} ${b.y}`);
          if (!path) return null;
          const stroke = colorFor(e);
          return <Path key={e.id} path={path} color={stroke} style="stroke" strokeWidth={2.4} />;
        })}
      </Canvas>
      {edges.map((e) => {
        const a = center(e.source);
        const b = center(e.target);
        if (!a || !b) return null;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const stroke = colorFor(e);
        const text = e.label || EDGE_RELATIONS.find((r) => r.key === e.relation)?.label || '';
        if (!text) return null;
        return (
          <Text
            key={`lbl-${e.id}`}
            style={{
              position: 'absolute',
              left: mx - 54,
              top: my - 14,
              width: 108,
              textAlign: 'center',
              fontSize: 11,
              fontWeight: '700',
              color: stroke || labelColor,
              backgroundColor: 'rgba(255,255,255,0.82)',
              overflow: 'hidden',
              borderRadius: 4,
              paddingVertical: 2,
            }}
            numberOfLines={1}>
            {text}
          </Text>
        );
      })}
    </View>
  );
});

const InkLayer = React.memo(function InkLayer({
  ink,
  inkColors,
  accent,
  viewBox,
}: {
  ink: { strokes: Stroke[]; links: Array<{ id: string; canvasPoint: { x: number; y: number } }> };
  inkColors: string[];
  accent: string;
  viewBox: { left: number; top: number; right: number; bottom: number } | null;
}) {
  const strokes = ink.strokes.filter((st) => {
    if (st.pdfPage != null) return false;
    if (!viewBox || !st.points.length) return true;
    // Cheap AABB cull — skip strokes fully outside the padded viewport.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const pt of st.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
    return maxX >= viewBox.left && minX <= viewBox.right && maxY >= viewBox.top && minY <= viewBox.bottom;
  });
  const links = viewBox
    ? ink.links.filter(
        (l) =>
          l.canvasPoint.x >= viewBox.left &&
          l.canvasPoint.x <= viewBox.right &&
          l.canvasPoint.y >= viewBox.top &&
          l.canvasPoint.y <= viewBox.bottom,
      )
    : ink.links;

  return (
    <Canvas style={{ width: BOARD, height: BOARD, position: 'absolute' }} pointerEvents="none">
      {strokes.map((st) => (
        <Path
          key={st.id}
          path={pointsToSvg(st.points)}
          color={inkColors[st.color] || inkColors[0]}
          style="stroke"
          strokeWidth={st.width}
          strokeCap="round"
          strokeJoin="round"
        />
      ))}
      {links.map((l) => (
        <Circle key={l.id} cx={l.canvasPoint.x} cy={l.canvasPoint.y} r={6} color={accent} />
      ))}
    </Canvas>
  );
});

const DotGrid = React.memo(function DotGrid({
  width,
  height,
  tf,
  color,
}: {
  width: number;
  height: number;
  tf: { s: number; tx: number; ty: number };
  color: string;
}) {
  const spacing = 26 * tf.s;
  const points = useMemo(() => {
    if (spacing < 8) return [];
    const startX = ((tf.tx % spacing) + spacing) % spacing;
    const startY = ((tf.ty % spacing) + spacing) % spacing;
    const pts: { x: number; y: number }[] = [];
    for (let x = startX; x < width; x += spacing) {
      for (let y = startY; y < height; y += spacing) {
        pts.push(vec(x, y));
      }
    }
    return pts;
  }, [width, height, spacing, tf.tx, tf.ty]);

  if (!points.length) return null;
  return (
    <Canvas style={{ position: 'absolute', width, height }} pointerEvents="none">
      <Points points={points} mode="points" color={color} strokeWidth={2} strokeCap="round" />
    </Canvas>
  );
});

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: p.bg },
    board: { flex: 1, overflow: 'hidden' },
    historyCluster: {
      position: 'absolute',
      top: 12,
      left: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 4,
      paddingVertical: 4,
      borderRadius: RADIUS.pill,
      backgroundColor: p.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      zIndex: 50,
      ...ELEVATION.float,
    },
    historyBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: RADIUS.pill,
    },
    historyBtnDisabled: { opacity: 0.4 },
    historyBtnActive: { backgroundColor: p.tint },
    historySep: { width: 1, height: 20, backgroundColor: p.border, marginHorizontal: 2 },
    selectionBar: {
      position: 'absolute',
      bottom: 72,
      left: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: RADIUS.pill,
      backgroundColor: p.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      zIndex: 55,
      ...ELEVATION.card,
    },
    selectionCount: { fontSize: 12, fontWeight: '600', color: p.text },
    selectionCats: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    catDot: { width: 18, height: 18, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border },
    selectionBtn: { paddingHorizontal: 6, paddingVertical: 4 },
    emptyHint: {
      position: 'absolute',
      top: '28%',
      left: 48,
      right: 48,
      padding: 28,
      borderRadius: RADIUS.lg,
      backgroundColor: p.grouped,
      alignItems: 'center',
      alignSelf: 'center',
      maxWidth: 380,
      ...ELEVATION.card,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 14,
      backgroundColor: p.tintSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    emptyIconGlyph: { fontSize: 24, color: p.tint },
    emptyTitle: {
      color: p.text,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: 0.35,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyText: {
      color: p.textMid,
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 21,
      maxWidth: 320,
    },
    linkBanner: {
      position: 'absolute',
      bottom: 88,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: RADIUS.pill,
      backgroundColor: p.grouped,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.separator,
      ...ELEVATION.float,
    },
    linkBannerText: { color: p.text, fontSize: 14, maxWidth: 260 },
    linkCancel: { color: p.tint, fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 8 },
    relationSheet: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 88,
      padding: 16,
      borderRadius: RADIUS.lg,
      backgroundColor: p.grouped,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.separator,
      ...ELEVATION.float,
      gap: 8,
    },
    relationTitle: { fontSize: 16, fontWeight: '800', color: p.text },
    relationHint: { fontSize: 12, color: p.textMuted, marginBottom: 4 },
    relationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    relationChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: RADIUS.pill,
      borderWidth: 1.5,
    },
    relationChipText: { fontSize: 12, fontWeight: '700' },
  });
