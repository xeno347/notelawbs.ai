import React, { useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';
import { X, Link2 } from 'lucide-react-native';
import { useStore, type FlowNode, type AiData } from '../store';
import { getPalette, useTheme, SERIF, RADIUS, ELEVATION } from '../theme';

export const AI_CARD_WIDTH = 288;

function AiCard({
  node,
  connectSource,
  onConnectStart,
  onConnectTo,
}: {
  node: FlowNode;
  connectSource: string | null;
  onConnectStart: (id: string) => void;
  onConnectTo: (id: string) => void;
}) {
  const p = useTheme();
  const moveNode = useStore((s) => s.moveNode);
  const bringNodeToFront = useStore((s) => s.bringNodeToFront);
  const removeNode = useStore((s) => s.removeNode);
  const setHoverNodeId = useStore((s) => s.setHoverNodeId);
  const data = node.data as AiData;
  const origin = useRef({ x: node.x, y: node.y });
  const isSource = connectSource === node.id;
  const connecting = !!connectSource;
  const isFocused = useStore((s) => s.hoverNodeId === node.id);
  const width = node.w || AI_CARD_WIDTH;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) =>
          g.numberActiveTouches === 1 && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          g.numberActiveTouches === 1 && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const n = useStore.getState().nodes.find((x) => x.id === node.id);
          origin.current = { x: n?.x ?? node.x, y: n?.y ?? node.y };
          bringNodeToFront(node.id);
          setHoverNodeId(node.id);
        },
        onPanResponderMove: (_e, g) => {
          const s = Math.max(0.05, useStore.getState().canvasTf.s);
          moveNode(node.id, origin.current.x + g.dx / s, origin.current.y + g.dy / s);
        },
        onPanResponderRelease: () => setHoverNodeId(null),
        onPanResponderTerminate: () => setHoverNodeId(null),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.id, moveNode, bringNodeToFront, setHoverNodeId],
  );

  const s = styles(p);

  return (
    <View
      style={[
        s.card,
        { left: node.x, top: node.y, width, zIndex: node.z || 1 },
        isSource && s.cardSource,
        isFocused && s.cardFocus,
      ]}
      {...pan.panHandlers}>
      <View style={s.topRule} />
      <View style={s.inner}>
        <TouchableOpacity
          style={s.del}
          onPress={() => removeNode(node.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={15} color={p.textMuted} strokeWidth={2.2} />
        </TouchableOpacity>

        <View style={s.tagRow}>
          <View style={s.tagDot} />
          <Text style={s.tag}>AI MEMO</Text>
        </View>
        <Text style={s.heading}>{data.heading}</Text>
        <Text style={s.body} numberOfLines={10}>
          {data.body}
        </Text>

        {data.citations?.length > 0 && (
          <View style={s.chips}>
            {data.citations.slice(0, 4).map((c, i) => (
              <View key={i} style={s.chip}>
                <Text style={s.chipText} numberOfLines={1}>
                  {c}
                </Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={s.linkBtn}
          onPress={() =>
            connecting && !isSource ? onConnectTo(node.id) : onConnectStart(node.id)
          }>
          <Link2 size={14} color={isSource || connecting ? p.accent : p.textMuted} strokeWidth={2.1} />
          <Text style={[s.link, isSource && s.linkActive]}>
            {isSource ? 'Pick target' : connecting ? 'Connect' : 'Link'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default React.memo(AiCard);

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    card: {
      position: 'absolute',
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: RADIUS.lg,
      overflow: 'hidden',
      ...ELEVATION.card,
    },
    cardSource: { borderColor: p.accent, borderWidth: 1.5 },
    cardFocus: {
      borderColor: p.ai,
      borderWidth: 2,
      shadowColor: p.ai,
      shadowOpacity: 0.5,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 0 },
    },
    topRule: { height: 3, backgroundColor: p.ai },
    inner: { padding: 12 },
    del: { position: 'absolute', top: 6, right: 8, zIndex: 2 },
    delText: { fontSize: 17, color: p.textMuted, lineHeight: 18 },
    tagRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
    tagDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: p.ai },
    tag: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: p.ai },
    heading: { fontSize: 15, fontWeight: '700', color: p.text, marginBottom: 6, fontFamily: SERIF },
    body: { fontSize: 12.5, lineHeight: 18, color: p.textMid, marginBottom: 8, fontFamily: SERIF },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
    chip: {
      maxWidth: '100%',
      backgroundColor: p.bg2,
      borderRadius: 4,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    chipText: { fontSize: 10.5, color: p.textMuted, fontFamily: SERIF },
    linkBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 },
    link: { fontSize: 12, color: p.textMuted },
    linkActive: { color: p.accent, fontWeight: '700' },
  });
