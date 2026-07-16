import React, { useMemo, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';
import { X } from 'lucide-react-native';
import { useStore, type FlowNode, type NoteData } from '../store';
import { getPalette, useTheme, SERIF, RADIUS, ELEVATION } from '../theme';

export const NOTE_CARD_WIDTH = 240;

function NoteCard({ node }: { node: FlowNode }) {
  const p = useTheme();
  const moveNode = useStore((s) => s.moveNode);
  const bringNodeToFront = useStore((s) => s.bringNodeToFront);
  const removeNode = useStore((s) => s.removeNode);
  const updateNodeData = useStore((s) => s.updateNodeData);
  const setHoverNodeId = useStore((s) => s.setHoverNodeId);
  const commitHistory = useStore((s) => s.commitHistory);
  const assignNodeGroupByPosition = useStore((s) => s.assignNodeGroupByPosition);
  const data = node.data as NoteData;
  const origin = useRef({ x: node.x, y: node.y });
  const width = node.w || NOTE_CARD_WIDTH;

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
          commitHistory();
          bringNodeToFront(node.id);
          setHoverNodeId(node.id);
        },
        onPanResponderMove: (_e, g) => {
          const s = Math.max(0.05, useStore.getState().canvasTf.s);
          moveNode(node.id, origin.current.x + g.dx / s, origin.current.y + g.dy / s);
        },
        onPanResponderRelease: () => {
          setHoverNodeId(null);
          assignNodeGroupByPosition(node.id);
        },
        onPanResponderTerminate: () => setHoverNodeId(null),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.id, moveNode, bringNodeToFront, setHoverNodeId, commitHistory, assignNodeGroupByPosition],
  );

  const s = styles(p);

  return (
    <View style={[s.card, { left: node.x, top: node.y, width, zIndex: node.z || 1 }]} {...pan.panHandlers}>
      <TouchableOpacity style={s.del} onPress={() => removeNode(node.id)} hitSlop={8}>
        <X size={14} color={p.textMuted} strokeWidth={2.2} />
      </TouchableOpacity>
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
      borderWidth: 1,
      borderColor: 'rgba(180,140,40,0.25)',
      padding: 12,
      paddingTop: 28,
      ...ELEVATION.card,
    },
    del: { position: 'absolute', top: 6, right: 8, zIndex: 2 },
    input: {
      fontFamily: SERIF,
      fontSize: 14,
      lineHeight: 20,
      color: p.text,
      minHeight: 80,
      textAlignVertical: 'top',
      padding: 0,
    },
  });
