import React, { useMemo, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';
import { X } from 'lucide-react-native';
import { useStore, type FlowNode, type GroupData } from '../store';
import { getPalette, useTheme, RADIUS, ELEVATION } from '../theme';

export const GROUP_CARD_WIDTH = 280;

function GroupCard({ node }: { node: FlowNode }) {
  const p = useTheme();
  const moveNode = useStore((s) => s.moveNode);
  const bringNodeToFront = useStore((s) => s.bringNodeToFront);
  const removeNode = useStore((s) => s.removeNode);
  const updateNodeData = useStore((s) => s.updateNodeData);
  const setHoverNodeId = useStore((s) => s.setHoverNodeId);
  const data = node.data as GroupData;
  const origin = useRef({ x: node.x, y: node.y });
  const width = node.w || GROUP_CARD_WIDTH;

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
    <View style={[s.card, { left: node.x, top: node.y, width, zIndex: node.z || 1 }]} {...pan.panHandlers}>
      <TouchableOpacity style={s.del} onPress={() => removeNode(node.id)} hitSlop={8}>
        <X size={14} color={p.textMuted} strokeWidth={2.2} />
      </TouchableOpacity>
      <TextInput
        value={data.title}
        onChangeText={(title) => updateNodeData(node.id, { title })}
        placeholder="Section title"
        placeholderTextColor={p.textMuted}
        style={s.input}
      />
    </View>
  );
}

export default React.memo(GroupCard);

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    card: {
      position: 'absolute',
      width: GROUP_CARD_WIDTH,
      backgroundColor: p.surface,
      borderRadius: RADIUS.sm,
      borderLeftWidth: 5,
      borderLeftColor: p.iris,
      borderWidth: 1,
      borderColor: p.border,
      paddingVertical: 10,
      paddingHorizontal: 14,
      paddingRight: 28,
      ...ELEVATION.float,
    },
    del: { position: 'absolute', top: 8, right: 8, zIndex: 2 },
    input: {
      fontSize: 16,
      fontWeight: '800',
      color: p.text,
      padding: 0,
    },
  });
