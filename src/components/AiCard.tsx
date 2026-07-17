import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X, Link2 } from 'lucide-react-native';
import { useStore, type FlowNode, type AiData } from '../store';
import { getPalette, useTheme, SERIF, RADIUS, ELEVATION } from '../theme';
import { useFreeformDrag } from '../hooks/useFreeformDrag';

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
  const removeNode = useStore((s) => s.removeNode);
  const data = node.data as AiData;
  const isSource = connectSource === node.id;
  const connecting = !!connectSource;
  const isFocused = useStore((s) => s.hoverNodeId === node.id);
  const width = node.w || AI_CARD_WIDTH;
  const drag = useFreeformDrag({ nodeId: node.id });

  const s = styles(p);

  return (
    <View
      style={[
        s.card,
        {
          left: drag.x,
          top: drag.y,
          width,
          zIndex: node.z || 1,
          opacity: drag.dragging ? 0.92 : 1,
        },
        isSource && s.cardSource,
        isFocused && s.cardFocus,
      ]}
      {...drag.panHandlers}>
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
          <Link2 size={14} color={isSource || connecting ? p.tint : p.textMuted} strokeWidth={1.5} />
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
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      borderLeftWidth: 2,
      borderLeftColor: p.ai,
      borderRadius: RADIUS.lg,
      overflow: 'hidden',
      ...ELEVATION.card,
    },
    cardSource: { borderColor: p.tint, borderLeftColor: p.tint },
    cardFocus: {
      backgroundColor: p.hover,
    },
    topRule: { height: 0 },
    inner: { padding: 16 },
    del: { position: 'absolute', top: 10, right: 10, zIndex: 2 },
    delText: { fontSize: 17, color: p.textMuted, lineHeight: 18 },
    tagRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
    tagDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: p.ai },
    tag: { fontSize: 11, fontWeight: '500', letterSpacing: 0.3, color: p.ai },
    heading: { fontSize: 16, fontWeight: '600', color: p.text, marginBottom: 6 },
    body: { fontSize: 14, lineHeight: 21, color: p.textMid, marginBottom: 8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
    chip: {
      maxWidth: '100%',
      backgroundColor: p.aiSoft,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    chipText: { fontSize: 11, color: p.textMid, fontFamily: SERIF },
    linkBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 },
    link: { fontSize: 12, color: p.textMuted },
    linkActive: { color: p.tint, fontWeight: '600' },
  });
