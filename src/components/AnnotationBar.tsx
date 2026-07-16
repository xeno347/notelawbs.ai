import React, { useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable, PanResponder } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';
import {
  MousePointer2,
  TextCursor,
  LassoSelect,
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
} from 'lucide-react-native';
import { useAnnotation, INK_SWATCHES, type ToolMode, isInkTool } from '../annotationStore';
import { useStore } from '../store';
import { useViewerLocked } from '../collab/collabStore';
import { getPalette, useTheme, RADIUS, ELEVATION } from '../theme';
import { GlassView } from './ui';

export default function AnnotationBar({ onFitCanvas }: { onFitCanvas?: () => void }) {
  const p = useTheme();
  const tool = useAnnotation((s) => s.tool);
  const inkColor = useAnnotation((s) => s.inkColor);
  const fingerDraw = useAnnotation((s) => s.fingerDraw);
  const barOffset = useAnnotation((s) => s.barOffset);
  const setTool = useAnnotation((s) => s.setTool);
  const setInkColor = useAnnotation((s) => s.setInkColor);
  const toggleFingerDraw = useAnnotation((s) => s.toggleFingerDraw);
  const setBarOffset = useAnnotation((s) => s.setBarOffset);
  const undoStroke = useStore((s) => s.undoStroke);
  const addNoteNode = useStore((s) => s.addNoteNode);
  const addGroupNode = useStore((s) => s.addGroupNode);
  const linking = useStore((s) => s.linking);
  const startInkLink = useStore((s) => s.startInkLink);
  const cancelLink = useStore((s) => s.cancelLink);
  const viewerLocked = useViewerLocked();
  const s = styles(p);

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
      }),
    [barOffset.x, barOffset.y, setBarOffset],
  );

  if (viewerLocked) return null;

  const pick = (t: ToolMode) => {
    if (tool === t) {
      setTool('navigate');
      return;
    }
    setTool(t);
    // Notes-like: Pen/Mark/Erase do not force finger draw — Pencil inks; finger pans (toggle Draw).
  };

  return (
    <View
      style={[
        s.wrap,
        { transform: [{ translateX: barOffset.x }, { translateY: barOffset.y }] },
      ]}
      pointerEvents="box-none">
      <GlassView style={s.glassBar}>
        <Animated.View
          style={s.barInner}
          entering={FadeInDown.springify().damping(20).stiffness(180).mass(0.7)}>
        <View style={s.dragHandle} {...dragPan.panHandlers} accessibilityLabel="Move toolbar">
          <GripHorizontal size={16} color={p.textMuted} strokeWidth={2.2} />
        </View>

        <Tool
          icon={MousePointer2}
          label="Read"
          active={tool === 'navigate'}
          onPress={() => setTool('navigate')}
          p={p}
        />
        <Tool
          icon={TextCursor}
          label="Text"
          active={tool === 'select'}
          onPress={() => pick('select')}
          p={p}
        />
        <Tool icon={LassoSelect} label="Box" active={tool === 'box'} onPress={() => pick('box')} p={p} />
        <View style={s.sep} />
        <Tool
          icon={Pen}
          label="Pen"
          active={tool === 'pen'}
          onPress={() => {
            pick('pen');
          }}
          p={p}
        />
        <Tool
          icon={Highlighter}
          label="Mark"
          active={tool === 'highlighter'}
          onPress={() => pick('highlighter')}
          p={p}
        />
        {/* Under / Strike set the mark style, then enter text-select mode. */}
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
        <Tool icon={Undo2} label="Undo" onPress={undoStroke} p={p} />

        <View style={s.sep} />
        <View style={s.swatchRow}>
          {INK_SWATCHES.map((c, i) => {
            const active = inkColor === i;
            return (
              <TouchableOpacity
                key={c}
                accessibilityLabel={`Color ${i + 1}`}
                onPress={() => {
                  setInkColor(i);
                  if (!isInkTool(tool)) setTool('pen');
                }}
                activeOpacity={0.85}
                style={[s.swatchRing, active && s.swatchRingActive]}>
                <View style={[s.swatchDot, { backgroundColor: c }]} />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.sep} />
        <Tool
          icon={StickyNote}
          label="Note"
          onPress={() => {
            setTool('navigate');
            addNoteNode('');
          }}
          p={p}
        />
        <Tool
          icon={LayoutList}
          label="Section"
          onPress={() => {
            setTool('navigate');
            addGroupNode('Untitled section');
          }}
          p={p}
        />
        <Tool
          icon={Link2}
          label="Link"
          active={linking.active}
          onPress={() => (linking.active ? cancelLink() : startInkLink())}
          p={p}
        />
        <TouchableOpacity
          style={[s.finger, !fingerDraw && s.fingerOff]}
          onPress={toggleFingerDraw}
          accessibilityLabel="Finger draw">
          <Hand size={16} color={fingerDraw ? '#fff' : p.textMid} strokeWidth={2.1} />
          <Text style={[s.fingerText, !fingerDraw && { color: p.textMid }]}>
            {fingerDraw ? 'Finger' : 'Pencil'}
          </Text>
        </TouchableOpacity>
        {onFitCanvas && <Tool icon={Maximize2} label="Fit" onPress={onFitCanvas} p={p} />}
        </Animated.View>
      </GlassView>
    </View>
  );
}

const PRESS_SPRING = { damping: 15, stiffness: 320, mass: 0.5 };

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
    transform: [{ scale: withSpring(press.value ? 0.9 : 1, PRESS_SPRING) }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    opacity: withTiming(active ? 1 : 0, { duration: 160 }),
  }));
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => (press.value = 1)}
      onPressOut={() => (press.value = 0)}
      hitSlop={4}>
      <Animated.View style={[sTool.btn, btnStyle]}>
        {active && (
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              { borderRadius: 10, backgroundColor: p.tintSoft },
              fillStyle,
            ]}
          />
        )}
        <Icon size={17} color={active ? p.tint : p.textMid} strokeWidth={2.1} />
      </Animated.View>
    </Pressable>
  );
}

const sTool = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 10,
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
    glassBar: {
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassBorder,
      ...ELEVATION.float,
      maxWidth: 720,
      width: '100%',
    },
    barInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 1,
      paddingHorizontal: 8,
      paddingVertical: 6,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    dragHandle: {
      width: 24,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 2,
    },
    sep: {
      width: StyleSheet.hairlineWidth,
      height: 20,
      backgroundColor: p.separator,
      marginHorizontal: 5,
    },
    swatchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 2,
    },
    swatchRing: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    swatchRingActive: {
      borderColor: p.text,
    },
    swatchDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
    },
    finger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: RADIUS.pill,
      backgroundColor: p.tint,
      marginLeft: 2,
    },
    fingerOff: {
      backgroundColor: p.fillSecondary,
    },
    fingerText: { color: '#fff', fontSize: 11, fontWeight: '600', letterSpacing: 0.1 },
  });
