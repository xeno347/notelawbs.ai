import React, { useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Alert,
  Share,
} from 'react-native';
import { X, GripHorizontal, ChevronDown, ChevronRight, Download } from 'lucide-react-native';
import { useStore, type FlowNode, type GroupData, type ExcerptData, type NoteData, type AiData } from '../store';
import { getPalette, useTheme, RADIUS, ELEVATION, HIGHLIGHTS } from '../theme';

export const GROUP_CARD_WIDTH = 280;
export const GROUP_CARD_HEIGHT = 180;

const GROUP_COLORS = [
  HIGHLIGHTS.yellow,
  HIGHLIGHTS.red,
  HIGHLIGHTS.blue,
  HIGHLIGHTS.green,
  HIGHLIGHTS.purple,
  '#F1F1EF',
];

function GroupCard({ node }: { node: FlowNode }) {
  const p = useTheme();
  const moveNode = useStore((s) => s.moveNode);
  const resizeNode = useStore((s) => s.resizeNode);
  const bringNodeToFront = useStore((s) => s.bringNodeToFront);
  const removeNode = useStore((s) => s.removeNode);
  const updateNodeData = useStore((s) => s.updateNodeData);
  const toggleGroupCollapsed = useStore((s) => s.toggleGroupCollapsed);
  const setHoverNodeId = useStore((s) => s.setHoverNodeId);
  const commitHistory = useStore((s) => s.commitHistory);
  const selected = useStore((s) => s.selectedNodeIds.includes(node.id));
  const toggleNodeSelected = useStore((s) => s.toggleNodeSelected);
  const data = node.data as GroupData;
  const origin = useRef({ x: node.x, y: node.y });
  const childrenStart = useRef<Array<{ id: string; x: number; y: number }>>([]);
  const startSize = useRef({ w: node.w || GROUP_CARD_WIDTH, h: node.h || GROUP_CARD_HEIGHT });
  const width = node.w || GROUP_CARD_WIDTH;
  const height = data.collapsed ? 44 : node.h || GROUP_CARD_HEIGHT;
  const accent = data.color || p.border;

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
          if (!useStore.getState().selectedNodeIds.includes(node.id)) {
            useStore.getState().setSelectedNodeIds([node.id]);
          }
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

  const pickColor = () => {
    Alert.alert(
      'Section color',
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        ...GROUP_COLORS.map((c, i) => ({
          text: ['Yellow', 'Red', 'Blue', 'Green', 'Purple', 'Gray'][i],
          onPress: () => updateNodeData(node.id, { color: c }),
        })),
      ],
    );
  };

  const exportGroup = async () => {
    const state = useStore.getState();
    const members = state.nodes.filter((n) => n.groupId === node.id || n.id === node.id);
    const lines: string[] = [`# ${data.title || 'Untitled section'}`, ''];
    for (const n of members.sort((a, b) => a.y - b.y || a.x - b.x)) {
      if (n.type === 'group') continue;
      if (n.type === 'note') {
        const d = n.data as NoteData;
        if (d.text?.trim()) lines.push(`- **Note:** ${d.text.trim()}`, '');
      } else if (n.type === 'excerpt') {
        const d = n.data as ExcerptData;
        lines.push(`- "${d.text}" (p.${d.page})`);
        if (d.note) lines.push(`  _${d.note}_`);
        lines.push('');
      } else if (n.type === 'ai') {
        const d = n.data as AiData;
        lines.push(`## ${d.heading}`, '', d.body, '');
      }
    }
    try {
      await Share.share({ message: lines.join('\n'), title: data.title || 'Section' });
    } catch {
      /* ignore */
    }
  };

  const s = styles(p);

  return (
    <View
      style={[
        s.card,
        {
          left: node.x,
          top: node.y,
          width,
          height,
          zIndex: node.z || 1,
        },
      ]}>
      <View
        style={[
          s.body,
          {
            backgroundColor: data.color || p.fill,
            borderColor: selected ? p.tint : accent,
            opacity: data.collapsed ? 0 : 0.55,
          },
        ]}
        pointerEvents="none"
      />
      <View style={[s.titleBar, { borderLeftColor: selected ? p.tint : accent }]}>
        <TouchableOpacity
          onPress={() => toggleGroupCollapsed(node.id)}
          hitSlop={8}
          style={s.chevron}
          accessibilityLabel={data.collapsed ? 'Expand section' : 'Collapse section'}>
          {data.collapsed ? (
            <ChevronRight size={16} color={p.textMuted} strokeWidth={1.5} />
          ) : (
            <ChevronDown size={16} color={p.textMuted} strokeWidth={1.5} />
          )}
        </TouchableOpacity>
        <View style={s.dragGrip} {...pan.panHandlers} accessibilityLabel="Move section">
          <GripHorizontal size={16} color={p.textMuted} strokeWidth={1.5} />
        </View>
        <TextInput
          value={data.title}
          onChangeText={(title) => updateNodeData(node.id, { title })}
          placeholder="Section title"
          placeholderTextColor={p.textMuted}
          style={s.input}
          onFocus={() => toggleNodeSelected(node.id, false)}
        />
        <TouchableOpacity onPress={pickColor} hitSlop={8} style={s.toolBtn}>
          <View style={[s.colorDot, { backgroundColor: accent }]} />
        </TouchableOpacity>
        <TouchableOpacity onPress={exportGroup} hitSlop={8} style={s.toolBtn}>
          <Download size={14} color={p.textMuted} strokeWidth={1.5} />
        </TouchableOpacity>
        <TouchableOpacity style={s.del} onPress={() => removeNode(node.id)} hitSlop={8}>
          <X size={14} color={p.textMuted} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>
      {!data.collapsed ? (
        <View style={s.resizeHit} {...resizePan.panHandlers}>
          <View style={[s.resizeGrip, { borderColor: p.textMuted }]} />
        </View>
      ) : null}
    </View>
  );
}

export default React.memo(GroupCard);

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    card: { position: 'absolute' },
    body: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderStyle: 'dashed',
    },
    titleBar: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      maxWidth: '100%',
      backgroundColor: p.surface,
      borderRadius: RADIUS.md,
      borderLeftWidth: 3,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      paddingVertical: 4,
      paddingLeft: 2,
      paddingRight: 8,
      gap: 2,
      ...ELEVATION.card,
    },
    chevron: { width: 28, height: 32, alignItems: 'center', justifyContent: 'center' },
    dragGrip: {
      width: 28,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toolBtn: { padding: 4 },
    colorDot: { width: 12, height: 12, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border },
    del: { padding: 4 },
    input: {
      fontSize: 14,
      fontWeight: '600',
      color: p.text,
      padding: 0,
      minWidth: 80,
      flex: 1,
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
      borderRightWidth: 1.5,
      borderBottomWidth: 1.5,
      borderBottomRightRadius: 2,
    },
  });
