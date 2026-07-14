import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  LayoutRectangle,
  Alert,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Canvas, Path, Circle, Skia, Points, vec } from '@shopify/react-native-skia';
import Svg, { Polyline } from 'react-native-svg';
import { useStore, type Stroke, type Edge } from '../store';
import { useCollab, useViewerLocked } from '../collab/collabStore';
import { useAnnotation, INK_SWATCHES } from '../annotationStore';
import {
  shouldAcceptDraw,
  pencilStrokeWidth,
  createPencilDoubleTap,
  readForce,
} from '../services/pencilGestures';
import { getPalette, useTheme, RADIUS, ELEVATION } from '../theme';
import ExcerptCard, { CARD_WIDTH } from './ExcerptCard';
import AiCard, { AI_CARD_WIDTH } from './AiCard';
import NoteCard, { NOTE_CARD_WIDTH } from './NoteCard';
import GroupCard, { GROUP_CARD_WIDTH } from './GroupCard';
import CollabCursors from './CollabCursors';

const BOARD = 6000;

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
  const sendCursor = useCollab((s) => s.sendCursor);
  const viewerLocked = useViewerLocked();
  const boardRef = useRef<View>(null);
  const layoutEpoch = useStore((s) => s.layoutEpoch);

  const [container, setContainer] = useState<LayoutRectangle | null>(null);
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
  const [tf, setTf] = useState({ s: 1, tx: 20, ty: 20 });
  const [gridTf, setGridTf] = useState(tf);
  const [liveStroke, setLiveStroke] = useState<Stroke | null>(null);
  const [livePointsSvg, setLivePointsSvg] = useState('');

  const sScale = useSharedValue(1);
  const sX = useSharedValue(20);
  const sY = useSharedValue(20);

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
    // Threads + card drag read canvasTf from the store — keep it live every frame.
    useStore.getState().setCanvasTf(next);
    const now = Date.now();
    if (now - commitTs.current > 32) {
      commitTs.current = now;
      setTf(next);
    }
  }, []);

  useEffect(() => {
    if (fitSerial > 0) applyTf({ s: 1, tx: 20, ty: 20 }, true);
  }, [fitSerial, applyTf]);

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

  // Board pan + pinch. Notes-style: finger pans even in Pen mode; Apple Pencil draws.
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
          // Prefer page coords mapped through canvasOrigin — more stable than locationX on iPad.
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
          const next = tfRef.current;
          setTf(next);
          useStore.getState().setCanvasTf(next);
          publishOrigin();
        },
        onPanResponderTerminate: () => {
          const next = tfRef.current;
          setTf(next);
          useStore.getState().setCanvasTf(next);
          publishOrigin();
        },
      }),
    [drawing, fingerDraw, sendCursor, sScale, sX, sY, commitDuringGesture, publishOrigin],
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
      addEdge(connectSource, id);
      const edge = useStore.getState().edges.find((e) => e.source === connectSource && e.target === id);
      setConnectSource(null);
      if (edge && Platform.OS === 'ios' && typeof Alert.prompt === 'function') {
        Alert.prompt(
          'Connection label',
          'Optional label for this link (e.g. supports, contradicts)',
          [
            { text: 'Skip', style: 'cancel' },
            {
              text: 'Save',
              onPress: (label?: string) => {
                if (label?.trim()) updateEdge(edge.id, { label: label.trim() });
              },
            },
          ],
          'plain-text',
        );
      }
    },
    [connectSource, addEdge, updateEdge],
  );

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
            {/* Ink under cards so Pencil draws on empty canvas; cards go transparent while inking */}
            {drawing && (
              <View style={[StyleSheet.absoluteFill, { zIndex: 1 }]} {...drawPan.panHandlers} />
            )}

            <EdgesLayer edges={edges} nodes={nodes} color={p.danger} labelColor={p.textMid} />
            <InkLayer ink={ink} inkColors={inkColors} accent={p.accent} />

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
              pointerEvents={viewerLocked ? 'none' : 'box-none'}>
              {nodes.map((n) => (
                <View
                  key={n.id}
                  pointerEvents="auto"
                  style={{ zIndex: (n.z || 1) + 10 }}>
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

            <CollabCursors scale={tf.s} />
          </Animated.View>
        </Animated.View>
      </View>

      {nodes.length === 0 && ink.strokes.filter((st) => st.pdfPage == null).length === 0 && (
        <View style={s.emptyHint} pointerEvents="none">
          <View style={s.emptyIcon}>
            <Text style={s.emptyIconGlyph}>◎</Text>
          </View>
          <Text style={s.emptyTitle}>Canvas</Text>
          <Text style={s.emptyText}>
            Highlight passages in the reader — they land here as freeform cards. Pinch to zoom the
            desk, drag cards with your finger, and draw with Apple Pencil.
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
    </View>
  );
}

const EdgesLayer = React.memo(function EdgesLayer({
  edges,
  nodes,
  color,
  labelColor,
}: {
  edges: Edge[];
  nodes: Array<{ id: string; type?: string; x: number; y: number }>;
  color: string;
  labelColor: string;
}) {
  const center = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return null;
    const w = nodeWidth(n.type);
    return { x: n.x + w / 2, y: n.y + 50 };
  };
  return (
    <View style={{ width: BOARD, height: BOARD, position: 'absolute' }} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {edges.map((e) => {
          const a = center(e.source);
          const b = center(e.target);
          if (!a || !b) return null;
          const path = Skia.Path.MakeFromSVGString(`M ${a.x} ${a.y} L ${b.x} ${b.y}`);
          if (!path) return null;
          return <Path key={e.id} path={path} color={color} style="stroke" strokeWidth={2} />;
        })}
      </Canvas>
      {edges.map((e) => {
        if (!e.label) return null;
        const a = center(e.source);
        const b = center(e.target);
        if (!a || !b) return null;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        return (
          <Text
            key={`lbl-${e.id}`}
            style={{
              position: 'absolute',
              left: mx - 50,
              top: my - 14,
              width: 100,
              textAlign: 'center',
              fontSize: 11,
              fontWeight: '700',
              color: labelColor,
              backgroundColor: 'rgba(255,255,255,0.75)',
              overflow: 'hidden',
            }}
            numberOfLines={1}>
            {e.label}
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
}: {
  ink: { strokes: Stroke[]; links: Array<{ id: string; canvasPoint: { x: number; y: number } }> };
  inkColors: string[];
  accent: string;
}) {
  return (
    <Canvas style={{ width: BOARD, height: BOARD, position: 'absolute' }} pointerEvents="none">
      {ink.strokes.filter((st) => st.pdfPage == null).map((st) => (
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
      {ink.links.map((l) => (
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
    linkCancel: { color: p.tint, fontSize: 15, fontWeight: '600' },
  });
