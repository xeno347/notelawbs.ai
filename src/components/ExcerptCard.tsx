import React, { useMemo, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';
import { X, ChevronLeft } from 'lucide-react-native';
import { useStore, type FlowNode, type ExcerptData } from '../store';
import { catStyle, getPalette, useTheme, SERIF, RADIUS, ELEVATION } from '../theme';

export const CARD_WIDTH = 248;

/**
 * Freeform OCR excerpt card — touch claims the gesture so the canvas
 * cannot steal the drag; z-order uses style zIndex (no list reorder mid-drag).
 */
function ExcerptCard({
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
  const resizeNode = useStore((s) => s.resizeNode);
  const bringNodeToFront = useStore((s) => s.bringNodeToFront);
  const removeNode = useStore((s) => s.removeNode);
  const jumpToHighlight = useStore((s) => s.jumpToHighlight);
  const setHoverNodeId = useStore((s) => s.setHoverNodeId);
  const setNodeSize = useStore((s) => s.setNodeSize);
  const setNodeAnchor = useStore((s) => s.setNodeAnchor);
  const commitHistory = useStore((s) => s.commitHistory);
  const assignNodeGroupByPosition = useStore((s) => s.assignNodeGroupByPosition);
  const data = node.data as ExcerptData;
  const highlight = useStore((s) => (data.highlightId ? s.highlights.find((h) => h.id === data.highlightId) : undefined));
  const isApprox = highlight?.anchorStatus === 'approximate';
  const anchorRef = useRef<View>(null);
  const cs = catStyle(data.category);
  const startRef = useRef({ x: 0, y: 0, w: CARD_WIDTH, h: 140 });
  const isSource = connectSource === node.id;
  const connecting = !!connectSource;
  const isFocused = useStore((s) => s.hoverNodeId === node.id);
  const width = node.w || CARD_WIDTH;

  const liveScale = () => Math.max(0.05, useStore.getState().canvasTf.s);

  const publishAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, w, h) => {
      setNodeAnchor(node.id, { x: x + w / 2, y: y + h / 2 });
    });
  }, [node.id, setNodeAnchor]);

  // Capture start position from the store on grant so mid-drag store updates
  // (moveNode) never rebuild this responder with a new origin.
  const pan = useMemo(
    () =>
      PanResponder.create({
        // Claim immediately so the parent board pan cannot win the touch.
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_e, g) =>
          g.numberActiveTouches === 1 && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          g.numberActiveTouches === 1 && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          const n = useStore.getState().nodes.find((x) => x.id === node.id);
          startRef.current = {
            x: n?.x ?? node.x,
            y: n?.y ?? node.y,
            w: n?.w || CARD_WIDTH,
            h: n?.h || useStore.getState().nodeSizes[node.id]?.h || 140,
          };
          commitHistory();
          bringNodeToFront(node.id);
          setHoverNodeId(node.id);
        },
        onPanResponderMove: (_e, g) => {
          const s = liveScale();
          moveNode(node.id, startRef.current.x + g.dx / s, startRef.current.y + g.dy / s);
        },
        onPanResponderRelease: () => {
          setHoverNodeId(null);
          publishAnchor();
          assignNodeGroupByPosition(node.id);
        },
        onPanResponderTerminate: () => {
          setHoverNodeId(null);
        },
      }),
    // Intentionally omit node.x/y — grant reads live position from the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.id, moveNode, bringNodeToFront, setHoverNodeId, publishAnchor, commitHistory, assignNodeGroupByPosition],
  );

  const resizePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const n = useStore.getState().nodes.find((x) => x.id === node.id);
          startRef.current = {
            x: n?.x ?? node.x,
            y: n?.y ?? node.y,
            w: n?.w || CARD_WIDTH,
            h: n?.h || useStore.getState().nodeSizes[node.id]?.h || 140,
          };
          commitHistory();
          bringNodeToFront(node.id);
          setHoverNodeId(node.id);
        },
        onPanResponderMove: (_e, g) => {
          const s = liveScale();
          resizeNode(node.id, startRef.current.w + g.dx / s, startRef.current.h + g.dy / s);
        },
        onPanResponderRelease: () => {
          setHoverNodeId(null);
          publishAnchor();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.id, resizeNode, bringNodeToFront, setHoverNodeId, publishAnchor, commitHistory],
  );

  const s = styles(p);
  const cite = `—${(data.docName || 'Document').replace(/\.pdf$/i, '')}, p.${data.page}${isApprox ? ' ≈' : ''}`;
  const heightStyle = node.h ? { height: node.h } : null;

  return (
    <View
      style={[
        s.card,
        {
          left: node.x,
          top: node.y,
          width,
          zIndex: node.z || 1,
        },
        heightStyle,
        isSource && s.cardSource,
        isFocused && s.cardFocus,
      ]}
      onLayout={(event) => {
        const { width: lw, height: lh } = event.nativeEvent.layout;
        setNodeSize(node.id, { w: lw, h: lh });
        publishAnchor();
      }}
      {...pan.panHandlers}>
      <View style={[s.tint, { backgroundColor: cs.soft }]} pointerEvents="none" />
      <View style={s.inner} pointerEvents="box-none">
        <View style={s.topRow} pointerEvents="box-none">
          <View style={[s.catBadge, { backgroundColor: cs.color }]}>
            <Text style={s.catBadgeText}>{cs.label}</Text>
          </View>
          <TouchableOpacity
            style={s.del}
            onPress={() => removeNode(node.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={14} color={p.textMuted} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <Text style={[s.quote, node.h ? { flex: 1 } : null]} numberOfLines={node.h ? undefined : 8}>
          {data.text}
        </Text>

        {!!data.note && (
          <Text style={s.note} numberOfLines={3}>
            {data.note}
          </Text>
        )}

        <TouchableOpacity
          style={s.sourceRow}
          onPress={() =>
            connecting && !isSource
              ? onConnectTo(node.id)
              : data.highlightId
                ? jumpToHighlight(data.highlightId)
                : onConnectStart(node.id)
          }
          onLongPress={() => onConnectStart(node.id)}>
          <View
            ref={anchorRef}
            style={[s.sourceBadge, { backgroundColor: cs.color }]}
            onLayout={publishAnchor}>
            <ChevronLeft size={12} color="#fff" strokeWidth={2.4} />
          </View>
          <Text style={s.sourceText} numberOfLines={1}>
            {cite}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={s.resizeHit} {...resizePan.panHandlers}>
        <View style={[s.resizeGrip, { borderColor: p.tint }]} />
      </View>
    </View>
  );
}

export default React.memo(ExcerptCard);

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    card: {
      position: 'absolute',
      backgroundColor: p.grouped,
      borderRadius: RADIUS.md,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.separator,
      ...ELEVATION.card,
      minHeight: 108,
    },
    cardSource: { borderColor: p.tint, borderWidth: 2 },
    cardFocus: {
      borderColor: p.iris,
      borderWidth: 2,
      shadowColor: p.iris,
      shadowOpacity: 0.35,
      shadowRadius: 14,
    },
    tint: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.55,
    },
    inner: { flex: 1, padding: 12, paddingBottom: 10 },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    catBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: RADIUS.pill,
    },
    catBadgeText: { color: '#fff', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4 },
    del: { padding: 2 },
    quote: {
      fontFamily: SERIF,
      fontSize: 13.5,
      lineHeight: 20,
      color: p.text,
      marginBottom: 8,
    },
    note: {
      fontSize: 11.5,
      fontStyle: 'italic',
      color: p.textMuted,
      marginBottom: 8,
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    sourceBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sourceText: {
      flex: 1,
      fontSize: 11,
      color: p.iris,
      fontWeight: '600',
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
      zIndex: 5,
    },
    resizeGrip: {
      width: 12,
      height: 12,
      borderRightWidth: 2.5,
      borderBottomWidth: 2.5,
      borderBottomRightRadius: 2,
    },
  });
