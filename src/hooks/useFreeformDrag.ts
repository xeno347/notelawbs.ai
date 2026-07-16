import { useMemo, useRef, useState } from 'react';
import { PanResponder, type GestureResponderHandlers } from 'react-native';
import { useStore } from '../store';

type DragOpts = {
  nodeId: string;
  /** When true, also drag every child with matching groupId (groups). */
  moveChildren?: boolean;
  onGrant?: () => void;
  onRelease?: () => void;
};

/**
 * Local-offset drag for freeform canvas cards.
 * Updates React local state during the gesture (no store thrash);
 * commits a single `moveNode` on release so sibling cards do not re-render
 * on every touch-move.
 */
export function useFreeformDrag(opts: DragOpts): {
  panHandlers: GestureResponderHandlers;
  x: number;
  y: number;
  dragging: boolean;
} {
  const baseX = useStore((s) => s.nodes.find((n) => n.id === opts.nodeId)?.x ?? 0);
  const baseY = useStore((s) => s.nodes.find((n) => n.id === opts.nodeId)?.y ?? 0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, y: 0 });
  const childStarts = useRef<Array<{ id: string; x: number; y: number }>>([]);
  const offsetRef = useRef({ x: 0, y: 0 });

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Don't claim on touch-down — TextInputs / buttons inside cards need taps.
        // Drag starts only after a clear move threshold.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) =>
          g.numberActiveTouches === 1 && (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8),
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          g.numberActiveTouches === 1 && (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          const state = useStore.getState();
          const n = state.nodes.find((x) => x.id === opts.nodeId);
          startRef.current = { x: n?.x ?? 0, y: n?.y ?? 0 };
          if (opts.moveChildren && n) {
            childStarts.current = state.nodes
              .filter((c) => c.groupId === opts.nodeId)
              .map((c) => ({ id: c.id, x: c.x, y: c.y }));
          } else {
            childStarts.current = [];
          }
          offsetRef.current = { x: 0, y: 0 };
          setOffset({ x: 0, y: 0 });
          setDragging(true);
          state.commitHistory();
          state.bringNodeToFront(opts.nodeId);
          state.setHoverNodeId(opts.nodeId);
          opts.onGrant?.();
        },
        onPanResponderMove: (_e, g) => {
          const s = Math.max(0.05, useStore.getState().canvasTf.s);
          const next = { x: g.dx / s, y: g.dy / s };
          offsetRef.current = next;
          setOffset(next);
        },
        onPanResponderRelease: () => {
          const state = useStore.getState();
          const last = offsetRef.current;
          state.moveNode(opts.nodeId, startRef.current.x + last.x, startRef.current.y + last.y);
          for (const c of childStarts.current) {
            state.moveNode(c.id, c.x + last.x, c.y + last.y);
          }
          offsetRef.current = { x: 0, y: 0 };
          setOffset({ x: 0, y: 0 });
          setDragging(false);
          state.setHoverNodeId(null);
          state.assignNodeGroupByPosition(opts.nodeId);
          opts.onRelease?.();
        },
        onPanResponderTerminate: () => {
          offsetRef.current = { x: 0, y: 0 };
          setOffset({ x: 0, y: 0 });
          setDragging(false);
          useStore.getState().setHoverNodeId(null);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opts.nodeId, opts.moveChildren],
  );

  return {
    panHandlers: pan.panHandlers,
    x: baseX + offset.x,
    y: baseY + offset.y,
    dragging,
  };
}
