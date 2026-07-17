import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { X, GripHorizontal, BookOpen, ListTree } from 'lucide-react-native';
import { useStore, type FlowNode, type NoteData } from '../store';
import { getPalette, useTheme, SERIF, RADIUS, ELEVATION, ICON_SIZE } from '../theme';
import { useFreeformDrag } from '../hooks/useFreeformDrag';

export const NOTE_CARD_WIDTH = 240;

function NoteCard({ node }: { node: FlowNode }) {
  const p = useTheme();
  const removeNode = useStore((s) => s.removeNode);
  const updateNodeData = useStore((s) => s.updateNodeData);
  const jumpToHighlight = useStore((s) => s.jumpToHighlight);
  const jumpToPage = useStore((s) => s.jumpToPage);
  const pullNodeToLinear = useStore((s) => s.pullNodeToLinear);
  const selected = useStore((s) => s.selectedNodeIds.includes(node.id));
  const toggleNodeSelected = useStore((s) => s.toggleNodeSelected);
  const data = node.data as NoteData;
  const width = node.w || NOTE_CARD_WIDTH;
  const drag = useFreeformDrag({ nodeId: node.id });
  const s = styles(p);

  const citeLabel = data.page
    ? `p. ${data.page}${data.docName ? ` · ${data.docName.replace(/\.pdf$/i, '')}` : ''}`
    : null;

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
          borderColor: selected ? p.tint : p.border,
          backgroundColor: selected ? p.tintSoft : p.surface,
        },
      ]}>
      <View style={s.handle} {...drag.panHandlers}>
        <GripHorizontal size={14} color={p.textMuted} strokeWidth={1.5} />
        <Pressable style={{ flex: 1 }} onPress={() => toggleNodeSelected(node.id, true)}>
          <Text style={s.handleLabel}>Note</Text>
        </Pressable>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => pullNodeToLinear(node.id)}
          hitSlop={8}
          accessibilityLabel="Pull into outline">
          <ListTree size={14} color={p.textMuted} strokeWidth={1.5} />
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={() => removeNode(node.id)} hitSlop={8}>
          <X size={14} color={p.textMuted} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>
      <TextInput
        value={data.text}
        onChangeText={(text) => updateNodeData(node.id, { text })}
        placeholder="Synthesis note…"
        placeholderTextColor={p.textMuted}
        multiline
        style={s.input}
      />
      {citeLabel ? (
        <TouchableOpacity
          style={s.cite}
          onPress={() => {
            if (data.highlightId) jumpToHighlight(data.highlightId);
            else if (data.page) jumpToPage(data.page);
          }}>
          <BookOpen size={ICON_SIZE - 4} color={p.tint} strokeWidth={1.5} />
          <Text style={s.citeText} numberOfLines={1}>
            {citeLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default React.memo(NoteCard);

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    card: {
      position: 'absolute',
      width: NOTE_CARD_WIDTH,
      minHeight: 120,
      backgroundColor: p.surface,
      borderRadius: RADIUS.lg,
      padding: 16,
      paddingTop: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      ...ELEVATION.card,
    },
    handle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      marginBottom: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.separator,
    },
    handleLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: p.textMuted,
    },
    iconBtn: { padding: 2 },
    input: {
      fontFamily: SERIF,
      fontSize: 16,
      lineHeight: 24,
      color: p.text,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    cite: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: p.separator,
    },
    citeText: { flex: 1, fontSize: 12, color: p.tint, fontWeight: '500' },
  });
