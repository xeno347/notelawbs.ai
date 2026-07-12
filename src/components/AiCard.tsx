import React, { useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';
import { useStore, type FlowNode, type AiData } from '../store';
import { getPalette, SERIF } from '../theme';

export const AI_CARD_WIDTH = 288;

function AiCard({
  node,
  scale,
  connectSource,
  onConnectStart,
  onConnectTo,
}: {
  node: FlowNode;
  scale: number;
  connectSource: string | null;
  onConnectStart: (id: string) => void;
  onConnectTo: (id: string) => void;
}) {
  const p = getPalette();
  const moveNode = useStore((s) => s.moveNode);
  const removeNode = useStore((s) => s.removeNode);
  const setHoverNodeId = useStore((s) => s.setHoverNodeId);
  const data = node.data as AiData;
  const origin = useRef({ x: node.x, y: node.y });
  const isSource = connectSource === node.id;
  const connecting = !!connectSource;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
        onPanResponderGrant: () => {
          origin.current = { x: node.x, y: node.y };
          setHoverNodeId(node.id);
        },
        onPanResponderMove: (_e, g) => {
          moveNode(node.id, origin.current.x + g.dx / scale, origin.current.y + g.dy / scale);
        },
        onPanResponderRelease: () => setHoverNodeId(null),
      }),
    [node.id, node.x, node.y, scale, moveNode, setHoverNodeId],
  );

  const s = styles(p);

  return (
    <View
      style={[s.card, { left: node.x, top: node.y }, isSource && s.cardSource]}
      {...pan.panHandlers}>
      <View style={s.topRule} />
      <View style={s.inner}>
        <TouchableOpacity
          style={s.del}
          onPress={() => removeNode(node.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.delText}>×</Text>
        </TouchableOpacity>

        <Text style={s.tag}>AI MEMO</Text>
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
          <Text style={[s.link, isSource && s.linkActive]}>
            {isSource ? 'pick target…' : connecting ? '⇢ connect' : '⚭ link'}
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
      width: AI_CARD_WIDTH,
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 10,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    cardSource: { borderColor: p.accent, borderWidth: 1.5 },
    topRule: { height: 4, backgroundColor: p.text },
    inner: { padding: 12 },
    del: { position: 'absolute', top: 6, right: 8, zIndex: 2 },
    delText: { fontSize: 17, color: p.textMuted, lineHeight: 18 },
    tag: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: p.accent, marginBottom: 4 },
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
    linkBtn: { alignSelf: 'flex-start' },
    link: { fontSize: 12, color: p.textMuted },
    linkActive: { color: p.accent, fontWeight: '700' },
  });
