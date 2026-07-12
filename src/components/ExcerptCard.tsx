import React, { useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';
import { useStore, type FlowNode, type ExcerptData } from '../store';
import { catStyle, getPalette, SERIF } from '../theme';

export const CARD_WIDTH = 264;

function ExcerptCard({
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
  const jumpToHighlight = useStore((s) => s.jumpToHighlight);
  const setHoverNodeId = useStore((s) => s.setHoverNodeId);
  const data = node.data as ExcerptData;
  const cs = catStyle(data.category);
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
      <View style={[s.spine, { backgroundColor: cs.color }]} />
      <View style={s.inner}>
        <TouchableOpacity
          style={s.del}
          onPress={() => removeNode(node.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.delText}>×</Text>
        </TouchableOpacity>

        <Text style={s.quote} numberOfLines={7}>
          {data.text}
        </Text>

        {!!data.note && (
          <View style={s.noteWrap}>
            <Text style={s.note}>{data.note}</Text>
          </View>
        )}

        <View style={s.footer}>
          <Text style={[s.cat, { color: cs.color }]}>{cs.label.toUpperCase()}</Text>
          <View style={s.footerRight}>
            <TouchableOpacity
              onPress={() =>
                connecting && !isSource ? onConnectTo(node.id) : onConnectStart(node.id)
              }>
              <Text style={[s.link, isSource && s.linkActive]}>
                {isSource ? 'target…' : connecting ? '⇢' : '⚭'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.pin}
              onPress={() => data.highlightId && jumpToHighlight(data.highlightId)}>
              <Text style={s.pinText}>p. {data.page}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

export default React.memo(ExcerptCard);

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    card: {
      position: 'absolute',
      width: CARD_WIDTH,
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 10,
      flexDirection: 'row',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    cardSource: { borderColor: p.accent, borderWidth: 1.5 },
    spine: { width: 6 },
    inner: { flex: 1, padding: 12 },
    del: { position: 'absolute', top: 4, right: 8, zIndex: 2 },
    delText: { fontSize: 17, color: p.textMuted, lineHeight: 18 },
    quote: {
      fontFamily: SERIF,
      fontSize: 14,
      lineHeight: 21,
      color: p.text,
      marginRight: 12,
      marginBottom: 8,
    },
    noteWrap: {
      borderTopWidth: 1,
      borderTopColor: p.border,
      borderStyle: 'dashed',
      paddingTop: 6,
      marginBottom: 8,
    },
    note: { fontSize: 12, fontStyle: 'italic', color: p.textMuted, fontFamily: SERIF },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cat: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
    footerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    link: { fontSize: 14, color: p.textMuted },
    linkActive: { color: p.accent, fontWeight: '700' },
    pin: {
      borderWidth: 1,
      borderColor: p.accent,
      borderRadius: 11,
      paddingHorizontal: 9,
      paddingVertical: 2,
    },
    pinText: { fontSize: 11, color: p.accent, fontWeight: '600' },
  });
