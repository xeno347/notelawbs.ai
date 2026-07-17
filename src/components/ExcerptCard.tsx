import React, { useMemo, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';
import { X, ChevronLeft, ListTree } from 'lucide-react-native';
import { useStore, type FlowNode, type ExcerptData } from '../store';
import { catStyle, getPalette, useTheme, SERIF, RADIUS, ELEVATION } from '../theme';
import { useFreeformDrag } from '../hooks/useFreeformDrag';

export const CARD_WIDTH = 248;

/**
 * Freeform OCR excerpt card — touch claims the gesture so the canvas
 * cannot steal the drag; z-order uses style zIndex (no list reorder mid-drag).
 * Drag uses local offsets so sibling cards stay idle during the gesture.
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
  const resizeNode = useStore((s) => s.resizeNode);
  const bringNodeToFront = useStore((s) => s.bringNodeToFront);
  const removeNode = useStore((s) => s.removeNode);
  const jumpToHighlight = useStore((s) => s.jumpToHighlight);
  const setHoverNodeId = useStore((s) => s.setHoverNodeId);
  const setNodeSize = useStore((s) => s.setNodeSize);
  const setNodeAnchor = useStore((s) => s.setNodeAnchor);
  const commitHistory = useStore((s) => s.commitHistory);
  const data = node.data as ExcerptData;
  const highlight = useStore((s) => (data.highlightId ? s.highlights.find((h) => h.id === data.highlightId) : undefined));
  const library = useStore((s) => s.library);
  const isApprox = highlight?.anchorStatus === 'approximate';
  const sourceMissing =
    !data.highlightId ||
    !highlight ||
    (!!data.docId && !library.some((d) => d.id === data.docId));
  const trustLabel = sourceMissing ? 'unavailable' : isApprox ? 'approximate' : 'exact';
  const trustColor = sourceMissing ? '#C0392B' : isApprox ? '#E67E22' : '#27AE60';
  const anchorRef = useRef<View>(null);
  const cs = catStyle(data.category);
  const startRef = useRef({ x: 0, y: 0, w: CARD_WIDTH, h: 140 });
  const isSource = connectSource === node.id;
  const connecting = !!connectSource;
  const isFocused = useStore((s) => s.hoverNodeId === node.id);
  const selected = useStore((s) => s.selectedNodeIds.includes(node.id));
  const pullNodeToLinear = useStore((s) => s.pullNodeToLinear);
  const setRightPaneMode = useStore((s) => s.setRightPaneMode);
  const width = node.w || CARD_WIDTH;

  const liveScale = () => Math.max(0.05, useStore.getState().canvasTf.s);

  const publishAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, w, h) => {
      setNodeAnchor(node.id, { x: x + w / 2, y: y + h / 2 });
    });
  }, [node.id, setNodeAnchor]);

  const drag = useFreeformDrag({
    nodeId: node.id,
    onRelease: publishAnchor,
  });

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
  const cite = `—${(data.docName || 'Document').replace(/\.pdf$/i, '')}, p.${data.page}`;
  const heightStyle = node.h ? { height: node.h } : null;

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
        heightStyle,
        isSource && s.cardSource,
        isFocused && s.cardFocus,
        selected && s.cardSelected,
      ]}
      onLayout={(event) => {
        const { width: lw, height: lh } = event.nativeEvent.layout;
        setNodeSize(node.id, { w: lw, h: lh });
        publishAnchor();
      }}
      {...drag.panHandlers}>
      <View style={[s.tint, { backgroundColor: cs.soft }]} pointerEvents="none" />
      <View style={s.inner} pointerEvents="box-none">
        <View style={s.topRow} pointerEvents="box-none">
          <View style={[s.catBadge, { backgroundColor: cs.soft }]}>
            <Text style={[s.catBadgeText, { color: cs.color }]}>{cs.label}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <TouchableOpacity
              onPress={() => {
                pullNodeToLinear(node.id);
                setRightPaneMode('notes');
              }}
              hitSlop={8}
              accessibilityLabel="Pull into outline">
              <ListTree size={14} color={p.textMuted} strokeWidth={1.5} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.del}
              onPress={() => removeNode(node.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color={p.textMuted} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[s.quote, node.h ? { flex: 1 } : null]} numberOfLines={node.h ? undefined : 8}>
          {data.text}
        </Text>
        {!!data.originalText && data.originalText !== data.text && (
          <Text style={s.original} numberOfLines={3}>
            {data.originalText}
          </Text>
        )}

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
              : data.highlightId && !sourceMissing
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
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.sourceText} numberOfLines={1}>
              {cite}
            </Text>
            <Text style={[s.trustBadge, { color: trustColor }]}>{trustLabel}</Text>
          </View>
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
      backgroundColor: p.surface,
      borderRadius: RADIUS.lg,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      ...ELEVATION.card,
      minHeight: 108,
    },
    cardSource: { borderColor: p.tint, borderWidth: StyleSheet.hairlineWidth },
    cardFocus: {
      backgroundColor: p.hover,
    },
    cardSelected: {
      borderColor: p.tint,
      borderWidth: 1.5,
    },
    tint: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.85,
    },
    inner: { flex: 1, padding: 16, paddingBottom: 12 },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    catBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: RADIUS.sm,
    },
    catBadgeText: { fontSize: 11, fontWeight: '500' },
    del: { padding: 2 },
    quote: {
      fontFamily: SERIF,
      fontSize: 15,
      lineHeight: 22,
      color: p.text,
      marginBottom: 8,
    },
    original: {
      fontSize: 12,
      lineHeight: 16,
      color: p.textMuted,
      marginBottom: 8,
      fontStyle: 'italic',
    },
    note: {
      fontSize: 13,
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
      borderRadius: RADIUS.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trustBadge: {
      fontSize: 10,
      fontWeight: '500',
      letterSpacing: 0.2,
      textTransform: 'uppercase',
    },
    sourceText: {
      flex: 1,
      fontSize: 12,
      color: p.textMid,
      fontWeight: '500',
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
      borderRightWidth: 1.5,
      borderBottomWidth: 1.5,
      borderBottomRightRadius: 2,
    },
  });
