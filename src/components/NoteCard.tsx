import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { X, GripHorizontal } from 'lucide-react-native';
import { useStore, type FlowNode, type NoteData } from '../store';
import { getPalette, useTheme, SERIF, RADIUS, ELEVATION } from '../theme';
import { useFreeformDrag } from '../hooks/useFreeformDrag';

export const NOTE_CARD_WIDTH = 240;

function NoteCard({ node }: { node: FlowNode }) {
  const p = useTheme();
  const removeNode = useStore((s) => s.removeNode);
  const updateNodeData = useStore((s) => s.updateNodeData);
  const data = node.data as NoteData;
  const width = node.w || NOTE_CARD_WIDTH;
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
      ]}>
      {/* Drag only from the handle so the TextInput can take focus for typing. */}
      <View style={s.handle} {...drag.panHandlers}>
        <GripHorizontal size={14} color={p.textMuted} strokeWidth={2.2} />
        <Text style={s.handleLabel}>Note</Text>
        <TouchableOpacity style={s.del} onPress={() => removeNode(node.id)} hitSlop={8}>
          <X size={14} color={p.textMuted} strokeWidth={2.2} />
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
      backgroundColor: '#FFF9E8',
      borderRadius: RADIUS.md,
      padding: 12,
      paddingTop: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.separator,
      ...ELEVATION.card,
    },
    handle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 2,
      marginBottom: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.separator,
    },
    handleLabel: {
      flex: 1,
      fontSize: 11,
      fontWeight: '700',
      color: p.textMuted,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    del: { padding: 2 },
    input: {
      fontFamily: SERIF,
      fontSize: 14,
      lineHeight: 20,
      color: p.text,
      minHeight: 80,
      textAlignVertical: 'top',
    },
  });
