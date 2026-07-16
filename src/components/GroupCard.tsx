import React, { useMemo, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';
import { X, GripHorizontal } from 'lucide-react-native';
import { useStore, type FlowNode, type GroupData } from '../store';
import { getPalette, useTheme, RADIUS, ELEVATION } from '../theme';

export const GROUP_CARD_WIDTH = 280;
export const GROUP_CARD_HEIGHT = 180;

/**
 * A real container: dragging the title bar moves every card whose `groupId`
 * points at this node along with it. Membership itself is assigned by each
 * card on drop (see assignNodeGroupByPosition) — this component only owns
 * the box and the "carry my children" behaviour.
 */
function GroupCard({ node }: { node: FlowNode }) {
  const p = useTheme();
  const moveNode = useStore((s) => s.moveNode);
  const resizeNode = useStore((s) => s.resizeNode);
  const bringNodeToFront = useStore((s) => s.bringNodeToFront);
  const removeNode = useStore((s) => s.removeNode);
  const updateNodeData = useStore((s) => s.updateNodeData);
  const setHoverNodeId = useStore((s) => s.setHoverNodeId);
  const commitHistory = useStore((s) => s.commitHistory);
  const data = node.data as GroupData;
  const origin = useRef({ x: node.x, y: node.y });
  const childrenStart = useRef<Array<{ id: string; x: number; y: number }>>([]);
  const startSize = useRef({ w: node.w || GROUP_CARD_WIDTH, h: node.h || GROUP_CARD_HEIGHT });
  const width = node.w || GROUP_CARD_WIDTH;
  const height = node.h || GROUP_CARD_HEIGHT;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const all = useStore.getState().nodes;
          const n = all.find((x) => x.id === node.id);
          origin.current = { x: n?.x ?? node.x, y: n?.y ?? node.y };
          childrenStart.current = all
            .filter((c) => c.groupId === node.id)
            .map((c) => ({ id: c.id, x: c.x, y: c.y }));
          commitHistory();
          bringNodeToFront(node.id);
          setHoverNodeId(node.id);
        },
        onPanResponderMove: (_e, g) => {
          const s = Math.max(0.05, useStore.getState().canvasTf.s);
          const dx = g.dx / s;
          const dy = g.dy / s;
          moveNode(node.id, origin.current.x + dx, origin.current.y + dy);
          for (const c of childrenStart.current) {
            moveNode(c.id, c.x + dx, c.y + dy);
          }
        },
        onPanResponderRelease: () => setHoverNodeId(null),
        onPanResponderTerminate: () => setHoverNodeId(null),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.id, moveNode, bringNodeToFront, setHoverNodeId, commitHistory],
  );

  const resizePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const n = useStore.getState().nodes.find((x) => x.id === node.id);
          startSize.current = { w: n?.w || GROUP_CARD_WIDTH, h: n?.h || GROUP_CARD_HEIGHT };
          commitHistory();
          bringNodeToFront(node.id);
          setHoverNodeId(node.id);
        },
        onPanResponderMove: (_e, g) => {
          const s = Math.max(0.05, useStore.getState().canvasTf.s);
          resizeNode(node.id, startSize.current.w + g.dx / s, startSize.current.h + g.dy / s);
        },
        onPanResponderRelease: () => setHoverNodeId(null),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.id, resizeNode, bringNodeToFront, setHoverNodeId, commitHistory],
  );

  const s = styles(p);

  return (
    <View style={[s.card, { left: node.x, top: node.y, width, height, zIndex: node.z || 1 }]}>
      <View style={s.body} pointerEvents="none" />
      <View style={s.titleBar}>
        <View style={s.dragGrip} {...pan.panHandlers} accessibilityLabel="Move section">
          <GripHorizontal size={16} color={p.textMuted} strokeWidth={2.2} />
        </View>
        <TextInput
          value={data.title}
          onChangeText={(title) => updateNodeData(node.id, { title })}
          placeholder="Section title"
          placeholderTextColor={p.textMuted}
          style={s.input}
        />
        <TouchableOpacity style={s.del} onPress={() => removeNode(node.id)} hitSlop={8}>
          <X size={14} color={p.textMuted} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>
      <View style={s.resizeHit} {...resizePan.panHandlers}>
        <View style={[s.resizeGrip, { borderColor: p.iris }]} />
      </View>
    </View>
  );
}

export default React.memo(GroupCard);

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    card: { position: 'absolute' },
    body: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: p.surface,
      opacity: 0.32,
      borderRadius: RADIUS.md,
      borderWidth: 1.5,
      borderColor: p.iris,
      borderStyle: 'dashed',
    },
    titleBar: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      maxWidth: '100%',
      backgroundColor: p.surface,
      borderRadius: RADIUS.sm,
      borderLeftWidth: 5,
      borderLeftColor: p.iris,
      borderWidth: 1,
      borderColor: p.border,
      paddingVertical: 8,
      paddingLeft: 6,
      paddingRight: 28,
      gap: 6,
      ...ELEVATION.float,
    },
    dragGrip: {
      width: 28,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    del: { position: 'absolute', top: 8, right: 8 },
    input: {
      fontSize: 16,
      fontWeight: '800',
      color: p.text,
      padding: 0,
      minWidth: 120,
      flexShrink: 1,
    },
    resizeHit: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 32,
      height: 32,
      alignItems: 'flex-end',
      justifyContent: 'flex-end',
      padding: 6,
    },
    resizeGrip: {
      width: 12,
      height: 12,
      borderRightWidth: 2.5,
      borderBottomWidth: 2.5,
      borderBottomRightRadius: 2,
    },
  });
