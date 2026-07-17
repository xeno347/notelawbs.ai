import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  PanResponder,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';
import {
  MousePointer2,
  TextCursor,
  Pen,
  Highlighter,
  Underline,
  Strikethrough,
  Eraser,
  Undo2,
  Hand,
  Maximize2,
  Link2,
  StickyNote,
  LayoutList,
  GripHorizontal,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  ArrowRightToLine,
  LassoSelect,
} from 'lucide-react-native';
import { useAnnotation, INK_SWATCHES, type ToolMode, isInkTool } from '../annotationStore';
import { useStore } from '../store';
import { useViewerLocked } from '../collab/collabStore';
import { getPalette, useTheme, RADIUS, ELEVATION, CATEGORIES, type BuiltinCategoryKey } from '../theme';
import { GlassView } from './ui';

const LEGAL_SWATCHES: Array<{ i: number; key?: BuiltinCategoryKey; label: string }> = [
  { i: 0, key: 'key_fact', label: 'Key fact' },
  { i: 1, key: 'adverse', label: 'Adverse' },
  { i: 2, key: 'procedural', label: 'Procedural' },
  { i: 3, key: 'favorable', label: 'Favorable' },
  { i: 4, key: 'ratio', label: 'Ratio' },
];

export default function AnnotationBar({ onFitCanvas }: { onFitCanvas?: () => void }) {
  const p = useTheme();
  const tool = useAnnotation((s) => s.tool);
  const inkColor = useAnnotation((s) => s.inkColor);
  const fingerDraw = useAnnotation((s) => s.fingerDraw);
  const barOffset = useAnnotation((s) => s.barOffset);
  const barCollapsed = useAnnotation((s) => s.barCollapsed);
  const setTool = useAnnotation((s) => s.setTool);
  const setInkColor = useAnnotation((s) => s.setInkColor);
  const toggleFingerDraw = useAnnotation((s) => s.toggleFingerDraw);
  const setBarOffset = useAnnotation((s) => s.setBarOffset);
  const resetBarOffset = useAnnotation((s) => s.resetBarOffset);
  const toggleBarCollapsed = useAnnotation((s) => s.toggleBarCollapsed);
  const undoStroke = useStore((s) => s.undoStroke);
  const addNoteNode = useStore((s) => s.addNoteNode);
  const addGroupNode = useStore((s) => s.addGroupNode);
  const addExcerptNode = useStore((s) => s.addExcerptNode);
  const setRightPaneMode = useStore((s) => s.setRightPaneMode);
  const linking = useStore((s) => s.linking);
  const startInkLink = useStore((s) => s.startInkLink);
  const cancelLink = useStore((s) => s.cancelLink);
  const viewerLocked = useViewerLocked();
  const [moreOpen, setMoreOpen] = useState(false);
  const s = styles(p);
  const showInkChrome = isInkTool(tool) || tool === 'underline' || tool === 'strikethrough';

  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const dragPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
        onPanResponderGrant: () => {
          dragStart.current = { x: 0, y: 0, ox: barOffset.x, oy: barOffset.y };
        },
        onPanResponderMove: (_e, g) => {
          setBarOffset(dragStart.current.ox + g.dx, dragStart.current.oy + g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          const nx = dragStart.current.ox + g.dx;
          const ny = dragStart.current.oy + g.dy;
          // Snap back to bottom dock when near default.
          if (Math.abs(nx) < 72 && Math.abs(ny) < 56) resetBarOffset();
          else setBarOffset(nx, Math.min(40, ny));
        },
      }),
    [barOffset.x, barOffset.y, setBarOffset, resetBarOffset],
  );

  if (viewerLocked) return null;

  const pick = (t: ToolMode) => {
    if (tool === t) {
      setTool('navigate');
      return;
    }
    setTool(t);
    setMoreOpen(false);
  };

  const sendMarkToCanvas = () => {
    const st = useStore.getState();
    const page = st.currentPage;
    const linked = new Set(
      st.nodes
        .filter((n) => n.type === 'excerpt')
        .map((n) => (n.data as { highlightId?: string }).highlightId)
        .filter(Boolean) as string[],
    );
    const h =
      [...st.highlights].reverse().find((x) => x.page === page && !linked.has(x.id)) ||
      [...st.highlights].reverse().find((x) => !linked.has(x.id));
    if (!h) {
      setTool('select');
      Alert.alert('Select a passage', 'Highlight or select text in the judgment, then tap → Canvas.');
      return;
    }
    addExcerptNode({
      text: h.text,
      originalText: h.originalText,
      page: h.page,
      category: h.category,
      note: h.note,
      highlightId: h.id,
      docName: st.docName || undefined,
      docId: h.docId || st.activeDocId || undefined,
      tags: h.tags,
    });
    setRightPaneMode('canvas');
  };

  const addCitedNote = () => {
    setTool('navigate');
    const page = useStore.getState().currentPage;
    const docName = useStore.getState().docName;
    const docId = useStore.getState().activeDocId;
    addNoteNode('', { page, docName: docName || undefined, docId: docId || undefined });
    setRightPaneMode('canvas');
  };

  if (barCollapsed) {
    return (
      <View
        style={[s.wrap, { transform: [{ translateX: barOffset.x }, { translateY: barOffset.y }] }]}
        pointerEvents="box-none">
        <Pressable
          accessibilityLabel="Expand tools"
          onPress={toggleBarCollapsed}
          style={[s.collapsedPill, { backgroundColor: p.surface, borderColor: p.border }]}>
          <Pen size={16} color={p.text} strokeWidth={1.5} />
          <Text style={[s.collapsedText, { color: p.text }]}>Tools</Text>
          <ChevronUp size={16} color={p.textMuted} strokeWidth={1.5} />
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[s.wrap, { transform: [{ translateX: barOffset.x }, { translateY: barOffset.y }] }]}
      pointerEvents="box-none">
      <GlassView style={s.glassBar}>
        <Animated.View style={s.barInner} entering={FadeInDown.duration(160)}>
          <View style={s.dragHandle} {...dragPan.panHandlers} accessibilityLabel="Move toolbar">
            <GripHorizontal size={16} color={p.textMuted} strokeWidth={2.2} />
          </View>

          <Tool icon={MousePointer2} label="Read" active={tool === 'navigate'} onPress={() => setTool('navigate')} p={p} />
          <Tool icon={TextCursor} label="Select" active={tool === 'select'} onPress={() => pick('select')} p={p} />
          <Tool icon={Pen} label="Pen" active={tool === 'pen'} onPress={() => pick('pen')} p={p} />
          <Tool
            icon={Highlighter}
            label="Mark"
            active={tool === 'highlighter'}
            onPress={() => pick('highlighter')}
            p={p}
          />
          <Tool icon={Undo2} label="Undo" onPress={undoStroke} p={p} />

          <View style={s.sep} />

          <Tool icon={ArrowRightToLine} label="→ Canvas" onPress={sendMarkToCanvas} p={p} />
          <Tool icon={StickyNote} label="Note" onPress={addCitedNote} p={p} />

          <View style={s.sep} />

          <TouchableOpacity
            style={[s.modeChip, !fingerDraw && s.modeChipOff]}
            onPress={toggleFingerDraw}
            accessibilityLabel={fingerDraw ? 'Draw with finger' : 'Pan with finger'}>
            <Hand size={14} color={fingerDraw ? '#fff' : p.textMid} strokeWidth={1.5} />
            <Text style={[s.modeText, !fingerDraw && { color: p.textMid }]}>
              {fingerDraw ? 'Draw' : 'Pan'}
            </Text>
          </TouchableOpacity>

          <Tool
            icon={MoreHorizontal}
            label="More"
            active={moreOpen}
            onPress={() => setMoreOpen((v) => !v)}
            p={p}
          />
          <Tool
            icon={ChevronDown}
            label="Collapse"
            onPress={toggleBarCollapsed}
            p={p}
          />
        </Animated.View>

        {showInkChrome ? (
          <View style={[s.inkRow, { borderTopColor: p.separator }]}>
            {LEGAL_SWATCHES.map((sw) => {
              const active = inkColor === sw.i;
              const color = sw.key ? CATEGORIES[sw.key].color : INK_SWATCHES[sw.i];
              return (
                <TouchableOpacity
                  key={sw.i}
                  accessibilityLabel={sw.label}
                  onPress={() => {
                    setInkColor(sw.i);
                    if (!isInkTool(tool) && tool !== 'underline' && tool !== 'strikethrough') {
                      setTool('highlighter');
                    }
                  }}
                  style={[s.swatchRing, active && { borderColor: p.text }]}>
                  <View style={[s.swatchDot, { backgroundColor: color }]} />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {moreOpen ? (
          <View style={[s.moreRow, { borderTopColor: p.separator }]}>
            <Tool icon={LassoSelect} label="Box" active={tool === 'box'} onPress={() => pick('box')} p={p} />
            <Tool icon={Underline} label="Under" active={tool === 'underline'} onPress={() => pick('underline')} p={p} />
            <Tool
              icon={Strikethrough}
              label="Strike"
              active={tool === 'strikethrough'}
              onPress={() => pick('strikethrough')}
              p={p}
            />
            <Tool icon={Eraser} label="Erase" active={tool === 'eraser'} onPress={() => pick('eraser')} p={p} />
            <Tool
              icon={LayoutList}
              label="Section"
              onPress={() => {
                setTool('navigate');
                addGroupNode('Untitled section');
                setMoreOpen(false);
              }}
              p={p}
            />
            <Tool
              icon={Link2}
              label="Link"
              active={linking.active}
              onPress={() => {
                linking.active ? cancelLink() : startInkLink();
                setMoreOpen(false);
              }}
              p={p}
            />
            {onFitCanvas ? <Tool icon={Maximize2} label="Fit" onPress={onFitCanvas} p={p} /> : null}
          </View>
        ) : null}
      </GlassView>
    </View>
  );
}

function Tool({
  icon: Icon,
  label,
  active,
  onPress,
  p,
}: {
  icon: React.ComponentType<any>;
  label: string;
  active?: boolean;
  onPress: () => void;
  p: ReturnType<typeof getPalette>;
}) {
  const press = useSharedValue(0);
  const btnStyle = useAnimatedStyle(() => ({
    opacity: withTiming(press.value ? 0.7 : 1, { duration: 120 }),
  }));
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => (press.value = 1)}
      onPressOut={() => (press.value = 0)}
      hitSlop={4}>
      <Animated.View style={[sTool.btn, btnStyle, active && { backgroundColor: p.hover }]}>
        <Icon size={18} color={active ? p.text : p.textMuted} strokeWidth={1.5} />
      </Animated.View>
    </Pressable>
  );
}

const sTool = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 16,
      alignItems: 'center',
      zIndex: 90,
    },
    collapsedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth,
      ...ELEVATION.card,
    },
    collapsedText: { fontSize: 13, fontWeight: '600' },
    glassBar: {
      borderRadius: RADIUS.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      backgroundColor: p.surface,
      ...ELEVATION.card,
      maxWidth: 560,
      width: '100%',
      overflow: 'hidden',
    },
    barInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0,
      paddingHorizontal: 8,
      paddingVertical: 4,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    dragHandle: {
      width: 24,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 2,
    },
    sep: {
      width: StyleSheet.hairlineWidth,
      height: 18,
      backgroundColor: p.separator,
      marginHorizontal: 4,
    },
    inkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    moreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    swatchRing: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'transparent',
    },
    swatchDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
    },
    modeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: RADIUS.pill,
      backgroundColor: p.text,
      marginHorizontal: 2,
    },
    modeChipOff: {
      backgroundColor: 'transparent',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
    },
    modeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  });
