import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  PanResponder,
  Alert,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';
import {
  MousePointer2,
  Highlighter,
  Pen,
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
  ArrowRightToLine,
  LassoSelect,
  HelpCircle,
  ScanText,
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

const ANNOTATE_TOOLS: ToolMode[] = [
  'select',
  'box',
  'pen',
  'highlighter',
  'underline',
  'strikethrough',
  'eraser',
];

const HELP_BODY =
  'Reading & marking\n\n' +
  '• Select text directly on the page — press a word, drag, lift. It highlights.\n' +
  '• → Map — send a highlight to the canvas (only when you want a card)\n' +
  '• Draw — freehand ink on the PDF\n' +
  '• Note / Section — add cards on the Map\n\n' +
  'More\n' +
  '• Scan — only if a scanned page won’t select (rare)\n' +
  '• Box / Under / Strike / Erase / Link / Fit\n';

function hintForTool(
  tool: ToolMode,
  opts: { linking: boolean; fingerDraw: boolean; markStyle: string },
): string {
  if (opts.linking) return 'Link mode: tap a Map card, then tap a spot on the PDF.';
  switch (tool) {
    case 'navigate':
      return 'Press a word and drag to highlight. → Map sends to canvas. Draw for ink.';
    case 'select':
      return 'Press a word and drag — lifts to highlight. No extra taps.';
    case 'box':
      return 'Drag a region to mark on the PDF only.';
    case 'pen':
      return 'Draw freehand ink on the PDF page.';
    case 'highlighter':
      return 'Draw a thick ink mark on the PDF page.';
    case 'underline':
      return 'Select words — they underline when you lift.';
    case 'strikethrough':
      return 'Select words — they strike through when you lift.';
    case 'eraser':
      return 'Scrub over pen strokes on the PDF to erase them.';
    default:
      return 'Press text to highlight. Draw for ink. → Map for canvas.';
  }
}

type Props = {
  onFitCanvas?: () => void;
  onScanPage?: () => void;
};

export default function AnnotationBar({ onFitCanvas, onScanPage }: Props) {
  const p = useTheme();
  const { width: winW, height: winH } = useWindowDimensions();
  const tool = useAnnotation((s) => s.tool);
  const inkColor = useAnnotation((s) => s.inkColor);
  const fingerDraw = useAnnotation((s) => s.fingerDraw);
  const barOffset = useAnnotation((s) => s.barOffset);
  const barCollapsed = useAnnotation((s) => s.barCollapsed);
  const markStyle = useAnnotation((s) => s.markStyle);
  const setTool = useAnnotation((s) => s.setTool);
  const setInkColor = useAnnotation((s) => s.setInkColor);
  const setMarkStyle = useAnnotation((s) => s.setMarkStyle);
  const toggleFingerDraw = useAnnotation((s) => s.toggleFingerDraw);
  const setBarOffset = useAnnotation((s) => s.setBarOffset);
  const toggleBarCollapsed = useAnnotation((s) => s.toggleBarCollapsed);
  const undoStroke = useStore((s) => s.undoStroke);
  const addNoteNode = useStore((s) => s.addNoteNode);
  const addGroupNode = useStore((s) => s.addGroupNode);
  const addExcerptNode = useStore((s) => s.addExcerptNode);
  const setRightPaneMode = useStore((s) => s.setRightPaneMode);
  const setReadingMode = useStore((s) => s.setReadingMode);
  const linking = useStore((s) => s.linking);
  const startInkLink = useStore((s) => s.startInkLink);
  const cancelLink = useStore((s) => s.cancelLink);
  const hasDoc = !!useStore((s) => s.docUri);
  const viewerLocked = useViewerLocked();
  const [moreOpen, setMoreOpen] = useState(false);
  const s = styles(p);
  const showInkChrome = isInkTool(tool) || tool === 'underline' || tool === 'strikethrough';
  const highlightActive =
    !isInkTool(tool) && tool !== 'box' && (markStyle === 'highlight' || tool === 'select');

  const hint = hintForTool(tool, {
    linking: linking.active,
    fingerDraw,
    markStyle,
  });

  const clampOffset = (x: number, y: number) => {
    const maxX = Math.max(40, winW * 0.45);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-(winH * 0.7), Math.min(winH * 0.15, y)),
    };
  };

  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const dragPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
        onPanResponderGrant: () => {
          dragStart.current = { x: 0, y: 0, ox: barOffset.x, oy: barOffset.y };
        },
        onPanResponderMove: (_e, g) => {
          const next = clampOffset(dragStart.current.ox + g.dx, dragStart.current.oy + g.dy);
          setBarOffset(next.x, next.y);
        },
        onPanResponderRelease: (_e, g) => {
          const next = clampOffset(dragStart.current.ox + g.dx, dragStart.current.oy + g.dy);
          setBarOffset(next.x, next.y);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [barOffset.x, barOffset.y, setBarOffset, winW, winH],
  );

  if (viewerLocked) return null;

  const pick = (t: ToolMode) => {
    if (tool === t) {
      setTool('navigate');
      return;
    }
    if (ANNOTATE_TOOLS.includes(t)) setReadingMode('page');
    setTool(t);
    // Draw / ink on the PDF must always accept finger — Pan is a canvas concern.
    if (t === 'pen' || t === 'highlighter' || t === 'eraser') {
      useAnnotation.getState().setFingerDraw(true);
    }
    setMoreOpen(false);
  };

  const startHighlight = () => {
    setReadingMode('page');
    setMarkStyle('highlight');
    // Selection works in Browse too — Highlight just sets the mark style.
    if (tool === 'select' || tool === 'navigate') setTool('navigate');
    else setTool('navigate');
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
      setReadingMode('page');
      setMarkStyle('highlight');
      setTool('select');
      Alert.alert(
        'Highlight text first',
        'Press a word on the PDF and drag, then lift — it highlights. Then tap → Map.',
      );
      return;
    }
    addExcerptNode({
      text: h.text,
      originalText: h.originalText,
      page: h.page,
      category: h.category,
      note: h.note || '',
      highlightId: h.id,
      docName: st.docName || '',
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

  const fitCanvas = () => {
    if (onFitCanvas) onFitCanvas();
    else useAnnotation.getState().requestFit();
    setRightPaneMode('canvas');
    setMoreOpen(false);
  };

  const showHelp = () => {
    Alert.alert('Tools guide', HELP_BODY, [{ text: 'Got it' }]);
  };

  if (barCollapsed) {
    return (
      <View
        style={[s.wrap, { transform: [{ translateX: barOffset.x }, { translateY: barOffset.y }] }]}
        pointerEvents="box-none">
        <View style={[s.collapsedRow, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={s.dragHandle} {...dragPan.panHandlers} accessibilityLabel="Move toolbar">
            <GripHorizontal size={16} color={p.textMuted} strokeWidth={2.2} />
          </View>
          <Pressable
            accessibilityLabel="Expand tools"
            onPress={toggleBarCollapsed}
            style={s.collapsedPill}>
            <Pen size={16} color={p.text} strokeWidth={1.5} />
            <Text style={[s.collapsedText, { color: p.text }]}>Tools</Text>
            <ChevronUp size={16} color={p.textMuted} strokeWidth={1.5} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[s.wrap, { transform: [{ translateX: barOffset.x }, { translateY: barOffset.y }] }]}
      pointerEvents="box-none">
      <GlassView style={s.glassBar}>
        <View style={[s.hintRow, { borderBottomColor: p.separator, backgroundColor: p.fillSecondary }]}>
          <Text style={[s.hintText, { color: p.textMid }]} numberOfLines={2}>
            {hint}
          </Text>
          <TouchableOpacity onPress={showHelp} hitSlop={8} accessibilityLabel="Tools help">
            <HelpCircle size={18} color={p.tint} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        <Animated.View entering={FadeInDown.duration(160)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.barInner}
            keyboardShouldPersistTaps="handled">
            <View style={s.dragHandleWide} {...dragPan.panHandlers} accessibilityLabel="Move toolbar">
              <GripHorizontal size={16} color={p.textMuted} strokeWidth={2.2} />
            </View>

            <Tool
              icon={MousePointer2}
              label="Browse"
              active={tool === 'navigate'}
              onPress={() => setTool('navigate')}
              p={p}
            />
            {onScanPage && hasDoc ? (
              <Tool icon={ScanText} label="Scan" onPress={onScanPage} p={p} accent />
            ) : null}
            <Tool
              icon={Highlighter}
              label="Highlight"
              active={highlightActive}
              onPress={startHighlight}
              p={p}
            />
            <Tool icon={Pen} label="Draw" active={tool === 'pen'} onPress={() => pick('pen')} p={p} />
            <Tool icon={Undo2} label="Undo" onPress={undoStroke} p={p} />

            <View style={s.sep} />

            <Tool icon={ArrowRightToLine} label="→ Map" onPress={sendMarkToCanvas} p={p} />
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
              icon={moreOpen ? ChevronDown : ChevronUp}
              label="More"
              active={moreOpen}
              onPress={() => setMoreOpen((v) => !v)}
              p={p}
            />
            <Tool icon={ChevronDown} label="Hide" onPress={toggleBarCollapsed} p={p} />
          </ScrollView>
        </Animated.View>

        {showInkChrome ? (
          <View style={[s.inkRow, { borderTopColor: p.separator }]}>
            <Text style={[s.inkLabel, { color: p.textMuted }]}>Color</Text>
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
                      setReadingMode('page');
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
          <View style={[s.moreWrap, { borderTopColor: p.separator }]}>
            <Text style={[s.moreTitle, { color: p.textMuted }]}>More tools</Text>
            <View style={s.moreRow}>
              <Tool icon={LassoSelect} label="Box" active={tool === 'box'} onPress={() => pick('box')} p={p} />
              <Tool
                icon={Highlighter}
                label="Ink Hi"
                active={tool === 'highlighter'}
                onPress={() => pick('highlighter')}
                p={p}
              />
              <Tool
                icon={Underline}
                label="Under"
                active={tool === 'underline'}
                onPress={() => pick('underline')}
                p={p}
              />
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
                  setRightPaneMode('canvas');
                  setMoreOpen(false);
                }}
                p={p}
              />
              <Tool
                icon={Link2}
                label="Link"
                active={linking.active}
                onPress={() => {
                  setReadingMode('page');
                  linking.active ? cancelLink() : startInkLink();
                  setMoreOpen(false);
                }}
                p={p}
              />
              <Tool icon={Maximize2} label="Fit" onPress={fitCanvas} p={p} />
            </View>
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
  accent,
}: {
  icon: React.ComponentType<any>;
  label: string;
  active?: boolean;
  onPress: () => void;
  p: ReturnType<typeof getPalette>;
  accent?: boolean;
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
      <Animated.View
        style={[
          sTool.btn,
          btnStyle,
          active && { backgroundColor: p.hover },
          accent && !active && { backgroundColor: p.accentSoft },
        ]}>
        <Icon size={17} color={active || accent ? p.tint : p.textMuted} strokeWidth={1.6} />
        <Text
          style={[
            sTool.caption,
            { color: active || accent ? p.tint : p.textMuted },
            (active || accent) && { fontWeight: '700' },
          ]}
          numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const sTool = StyleSheet.create({
  btn: {
    minWidth: 52,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  caption: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
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
    collapsedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth,
      paddingLeft: 4,
      ...ELEVATION.card,
    },
    collapsedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    collapsedText: { fontSize: 13, fontWeight: '600' },
    glassBar: {
      borderRadius: RADIUS.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      backgroundColor: p.surface,
      ...ELEVATION.card,
      maxWidth: 640,
      width: '100%',
      overflow: 'hidden',
    },
    hintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    hintText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
    },
    barInner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 4,
      gap: 2,
    },
    dragHandle: {
      width: 28,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dragHandleWide: {
      width: 28,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 2,
    },
    sep: {
      width: StyleSheet.hairlineWidth,
      height: 28,
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
    inkLabel: { fontSize: 11, fontWeight: '600', marginRight: 4 },
    moreWrap: {
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: 6,
      paddingBottom: 4,
    },
    moreTitle: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      paddingHorizontal: 14,
      marginBottom: 2,
    },
    moreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      paddingVertical: 4,
      paddingHorizontal: 8,
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
      paddingVertical: 8,
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
