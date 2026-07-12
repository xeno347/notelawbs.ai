import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  LayoutRectangle,
} from 'react-native';
import { Canvas, Path, Circle, Skia, Points, vec } from '@shopify/react-native-skia';
import { useStore, type Stroke } from '../store';
import { getPalette, SERIF } from '../theme';
import ExcerptCard, { CARD_WIDTH } from './ExcerptCard';
import AiCard, { AI_CARD_WIDTH } from './AiCard';

const BOARD = 6000;

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
  const p = getPalette();
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const ink = useStore((s) => s.ink);
  const linking = useStore((s) => s.linking);
  const addStroke = useStore((s) => s.addStroke);
  const undoStroke = useStore((s) => s.undoStroke);
  const eraseAt = useStore((s) => s.eraseAt);
  const startInkLink = useStore((s) => s.startInkLink);
  const setInkLinkPoint = useStore((s) => s.setInkLinkPoint);
  const cancelLink = useStore((s) => s.cancelLink);
  const addEdge = useStore((s) => s.addEdge);
  const setCanvasOrigin = useStore((s) => s.setCanvasOrigin);
  const setCanvasTf = useStore((s) => s.setCanvasTf);
  const boardRef = useRef<View>(null);

  const [container, setContainer] = useState<LayoutRectangle | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [eraseMode, setEraseMode] = useState(false);
  const [inkColor, setInkColor] = useState(0);
  const [connectSource, setConnectSource] = useState<string | null>(null);
  const [tf, setTf] = useState({ s: 1, tx: 20, ty: 20 });
  const [liveStroke, setLiveStroke] = useState<Stroke | null>(null);

  const tfRef = useRef(tf);
  tfRef.current = tf;

  useEffect(() => {
    setCanvasTf(tf);
  }, [tf, setCanvasTf]);

  const publishOrigin = () => {
    boardRef.current?.measureInWindow((x, y) => setCanvasOrigin({ x, y }));
  };
  const gestureStart = useRef({ s: 1, tx: 0, ty: 0, dist: 0, focal: { x: 0, y: 0 } });
  const strokeRef = useRef<Stroke | null>(null);

  const toBoard = (x: number, y: number) => {
    const t = tfRef.current;
    return { x: (x - t.tx) / t.s, y: (y - t.ty) / t.s };
  };

  const drawing = drawMode || eraseMode || (linking.active && linking.step === 'canvas');

  // Board pan + pinch (empty space); cards claim first for drag.
  const boardPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          !drawing && (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3 || g.numberActiveTouches === 2),
        onPanResponderGrant: (evt) => {
          const t = tfRef.current;
          const touches = evt.nativeEvent.touches;
          gestureStart.current = {
            s: t.s,
            tx: t.tx,
            ty: t.ty,
            dist: touches.length === 2 ? dist(touches) : 0,
            focal:
              touches.length === 2
                ? {
                    x: (touches[0].locationX + touches[1].locationX) / 2,
                    y: (touches[0].locationY + touches[1].locationY) / 2,
                  }
                : { x: 0, y: 0 },
          };
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
            setTf({ s, tx: f.x - boardFx * s, ty: f.y - boardFy * s });
          } else {
            setTf({ s: start.s, tx: start.tx + g.dx, ty: start.ty + g.dy });
          }
        },
      }),
    [drawing],
  );

  // Draw / erase / link overlay (on top when active)
  const drawPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY, force } = evt.nativeEvent as any;
          const bp = toBoard(locationX, locationY);
          if (linking.active && linking.step === 'canvas') {
            setInkLinkPoint(bp);
            return;
          }
          if (eraseMode) {
            eraseAt(bp.x, bp.y, 16 / tfRef.current.s);
            return;
          }
          const st: Stroke = {
            id: `${Date.now()}`,
            color: inkColor,
            width: Math.max(1.5, (force || 0.5) * 3.5),
            points: [bp],
          };
          strokeRef.current = st;
          setLiveStroke(st);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const bp = toBoard(locationX, locationY);
          if (eraseMode) {
            eraseAt(bp.x, bp.y, 16 / tfRef.current.s);
            return;
          }
          if (!strokeRef.current) return;
          strokeRef.current.points.push(bp);
          setLiveStroke({ ...strokeRef.current, points: [...strokeRef.current.points] });
        },
        onPanResponderRelease: () => {
          if (strokeRef.current && strokeRef.current.points.length > 1) {
            addStroke(strokeRef.current);
          }
          strokeRef.current = null;
          setLiveStroke(null);
        },
      }),
    [drawMode, eraseMode, inkColor, linking, setInkLinkPoint, eraseAt, addStroke],
  );

  const inkColors = useMemo(() => [p.ink1, p.ink2], [p.ink1, p.ink2]);

  const handleConnectTo = useCallback(
    (id: string) => {
      if (connectSource) addEdge(connectSource, id);
      setConnectSource(null);
    },
    [connectSource, addEdge],
  );

  const s = styles(p);

  return (
    <View style={s.root} onLayout={(e) => { setContainer(e.nativeEvent.layout); publishOrigin(); }}>
      {container && <DotGrid width={container.width} height={container.height} tf={tf} color={p.dotGrid} />}
      <View ref={boardRef} style={s.board} onLayout={publishOrigin} {...boardPan.panHandlers}>
        <View
          style={{
            position: 'absolute',
            width: BOARD,
            height: BOARD,
            transform: [{ translateX: tf.tx }, { translateY: tf.ty }, { scale: tf.s }],
            // @ts-ignore RN 0.74+ supports transformOrigin
            transformOrigin: '0 0',
          }}>
          {/* edges (memoized — unaffected by pan/zoom) */}
          <EdgesLayer edges={edges} nodes={nodes} color={p.accent} />

          {/* persisted ink + links (memoized) */}
          <InkLayer ink={ink} inkColors={inkColors} accent={p.accent} />

          {/* live stroke only — cheap, re-renders while drawing */}
          {liveStroke && (
            <Canvas
              style={{ width: BOARD, height: BOARD, position: 'absolute' }}
              pointerEvents="none">
              <Path
                path={pointsToSvg(liveStroke.points)}
                color={inkColors[liveStroke.color] || inkColors[0]}
                style="stroke"
                strokeWidth={liveStroke.width}
                strokeCap="round"
                strokeJoin="round"
              />
            </Canvas>
          )}

          {/* cards */}
          {nodes.map((n) =>
            n.type === 'ai' ? (
              <AiCard
                key={n.id}
                node={n}
                scale={tf.s}
                connectSource={connectSource}
                onConnectStart={setConnectSource}
                onConnectTo={handleConnectTo}
              />
            ) : (
              <ExcerptCard
                key={n.id}
                node={n}
                scale={tf.s}
                connectSource={connectSource}
                onConnectStart={setConnectSource}
                onConnectTo={handleConnectTo}
              />
            ),
          )}
        </View>
      </View>

      {drawing && <View style={StyleSheet.absoluteFill} {...drawPan.panHandlers} />}

      {nodes.length === 0 && ink.strokes.length === 0 && (
        <View style={s.emptyHint} pointerEvents="none">
          <Text style={s.emptyText}>
            Send excerpts here from the reader, draw with ✎, and link notes back to the PDF.
          </Text>
        </View>
      )}

      {/* toolbar */}
      <View style={s.toolbar}>
        <ToolBtn label="✎" active={drawMode} onPress={() => { setDrawMode((d) => !d); setEraseMode(false); }} p={p} />
        <ToolBtn label="◌" active={eraseMode} onPress={() => { setEraseMode((e) => !e); setDrawMode(false); }} p={p} />
        <ToolBtn label="↩" onPress={undoStroke} p={p} />
        <TouchableOpacity
          style={[s.dot, { backgroundColor: p.ink1 }, inkColor === 0 && s.dotActive]}
          onPress={() => setInkColor(0)}
        />
        <TouchableOpacity
          style={[s.dot, { backgroundColor: p.ink2 }, inkColor === 1 && s.dotActive]}
          onPress={() => setInkColor(1)}
        />
        <ToolBtn
          label="⚯"
          active={linking.active}
          onPress={() => (linking.active ? cancelLink() : startInkLink())}
          p={p}
        />
        <ToolBtn label="⤢" onPress={() => setTf({ s: 1, tx: 20, ty: 20 })} p={p} />
      </View>

      {linking.active && (
        <View style={s.linkBanner}>
          <Text style={s.linkBannerText}>
            {linking.step === 'canvas'
              ? 'Tap a point on your handwriting'
              : 'Switch to Reader tab, then tap a highlight / paragraph'}
          </Text>
          <TouchableOpacity onPress={cancelLink}>
            <Text style={s.linkCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function ToolBtn({
  label,
  active,
  onPress,
  p,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  p: ReturnType<typeof getPalette>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? p.accent : 'transparent',
      }}>
      <Text style={{ fontSize: 17, color: active ? '#fff' : p.text }}>{label}</Text>
    </TouchableOpacity>
  );
}

const EdgesLayer = React.memo(function EdgesLayer({
  edges,
  nodes,
  color,
}: {
  edges: Array<{ id: string; source: string; target: string }>;
  nodes: Array<{ id: string; type?: string; x: number; y: number }>;
  color: string;
}) {
  const center = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return null;
    const w = n.type === 'ai' ? AI_CARD_WIDTH : CARD_WIDTH;
    return { x: n.x + w / 2, y: n.y + 50 };
  };
  return (
    <Canvas style={{ width: BOARD, height: BOARD, position: 'absolute' }} pointerEvents="none">
      {edges.map((e) => {
        const a = center(e.source);
        const b = center(e.target);
        if (!a || !b) return null;
        const path = Skia.Path.MakeFromSVGString(`M ${a.x} ${a.y} L ${b.x} ${b.y}`);
        if (!path) return null;
        return <Path key={e.id} path={path} color={color} style="stroke" strokeWidth={2} />;
      })}
    </Canvas>
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
      {ink.strokes.map((st) => (
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
    root: { flex: 1, backgroundColor: p.bg, overflow: 'hidden' },
    board: { flex: 1, overflow: 'hidden' },
    emptyHint: {
      position: 'absolute',
      top: 90,
      left: 32,
      right: 32,
      padding: 18,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: p.border,
      borderStyle: 'dashed',
      backgroundColor: p.surface,
    },
    emptyText: { color: p.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20, fontFamily: SERIF },
    toolbar: {
      position: 'absolute',
      top: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 24,
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: p.border, alignSelf: 'center', marginHorizontal: 4 },
    dotActive: { borderColor: p.text },
    linkBanner: {
      position: 'absolute',
      bottom: 16,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 22,
      backgroundColor: p.topbar,
    },
    linkBannerText: { color: p.topbarText, fontSize: 12, maxWidth: 240 },
    linkCancel: { color: p.accent, fontSize: 12, fontWeight: '700' },
  });
