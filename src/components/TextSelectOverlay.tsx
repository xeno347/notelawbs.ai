import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import type { OcrPageData } from '../services/ocrService';
import type { Rect } from '../store';
import {
  flattenWords,
  nearestWordIndex,
  selectionFromRange,
  handleAnchors,
  type WordToken,
} from '../services/textSelection';
import { RADIUS } from '../theme';

export type LiveSelection = {
  start: number;
  end: number;
  text: string;
  rect: Rect;
  rects: Rect[];
};

type Props = {
  enabled: boolean;
  frame: { w: number; h: number };
  pageData: OcrPageData | null | undefined;
  ensuringOcr: boolean;
  onEnsureOcr: () => Promise<OcrPageData | null>;
  /** Apply mark as soon as the finger lifts — no second tap. */
  onConfirm: (sel: LiveSelection) => void;
  onBusyChange?: (busy: boolean) => void;
  mutedColor: string;
};

/**
 * Direct text selection (native feel):
 * press a word → drag to extend → lift → highlighted.
 * No tool mode, no Scan step, no confirm button.
 */
export default function TextSelectOverlay({
  enabled,
  frame,
  pageData,
  ensuringOcr,
  onEnsureOcr,
  onConfirm,
  onBusyChange,
  mutedColor,
}: Props) {
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | 'extend' | null>(null);
  const wordsRef = useRef<WordToken[]>([]);
  const anchorRef = useRef(-1);
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const started = useRef(false);
  const fingerDown = useRef(false);
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  const words = useMemo(() => (pageData ? flattenWords(pageData) : []), [pageData]);
  wordsRef.current = words;

  useEffect(() => {
    setRange(null);
    setDragging(null);
  }, [pageData]);

  useEffect(() => {
    if (!enabled) {
      setRange(null);
      setDragging(null);
    }
  }, [enabled]);

  const live = useMemo(() => {
    if (!range || !words.length) return null;
    const hit = selectionFromRange(words, range.start, range.end);
    if (!hit) return null;
    const handles = handleAnchors(words, range.start, range.end);
    return { hit, handles, start: range.start, end: range.end };
  }, [range, words]);

  const clearLong = () => {
    if (longTimer.current) {
      clearTimeout(longTimer.current);
      longTimer.current = null;
    }
  };

  const commitSelection = (start: number, end: number, list: WordToken[]) => {
    const hit = selectionFromRange(list, start, end);
    if (!hit || !hit.text.trim()) return;
    onConfirmRef.current({
      start,
      end,
      text: hit.text,
      rect: hit.rect,
      rects: hit.rects,
    });
    setRange(null);
    setDragging(null);
    started.current = false;
    anchorRef.current = -1;
  };

  const beginWordAt = (px: number, py: number, list: WordToken[]) => {
    const idx = nearestWordIndex(list, px / frame.w, py / frame.h);
    if (idx < 0) return false;
    anchorRef.current = idx;
    started.current = true;
    setRange({ start: idx, end: idx });
    setDragging('extend');
    return true;
  };

  const beginAt = async (px: number, py: number) => {
    if (wordsRef.current.length) {
      beginWordAt(px, py, wordsRef.current);
      return;
    }
    onBusyChange?.(true);
    try {
      const data = await onEnsureOcr();
      const list = data ? flattenWords(data) : [];
      wordsRef.current = list;
      if (!list.length) return;
      const idx = nearestWordIndex(list, px / frame.w, py / frame.h);
      if (idx < 0) return;
      if (!fingerDown.current) {
        commitSelection(idx, idx, list);
        return;
      }
      beginWordAt(px, py, list);
    } finally {
      onBusyChange?.(false);
    }
  };

  const extendTo = (px: number, py: number) => {
    const list = wordsRef.current;
    if (!list.length || anchorRef.current < 0) return;
    const idx = nearestWordIndex(list, px / frame.w, py / frame.h);
    if (idx < 0) return;
    setRange({ start: Math.min(anchorRef.current, idx), end: Math.max(anchorRef.current, idx) });
  };

  const selectPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => enabled,
        onMoveShouldSetPanResponder: (_e, g) => enabled && (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4),
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderTerminationRequest: () => !started.current,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          fingerDown.current = true;
          pressOrigin.current = { x: locationX, y: locationY };
          started.current = false;
          clearLong();
          const hasWords = wordsRef.current.length > 0;
          longTimer.current = setTimeout(() => {
            beginAt(locationX, locationY);
          }, hasWords ? 160 : 280);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const origin = pressOrigin.current;
          if (!started.current && origin) {
            const dist = Math.hypot(locationX - origin.x, locationY - origin.y);
            if (dist > 12) {
              clearLong();
              if (wordsRef.current.length) {
                beginWordAt(origin.x, origin.y, wordsRef.current);
                extendTo(locationX, locationY);
              }
            }
            return;
          }
          if (started.current) extendTo(locationX, locationY);
        },
        onPanResponderRelease: () => {
          clearLong();
          fingerDown.current = false;
          pressOrigin.current = null;
          const cur = rangeRef.current;
          const list = wordsRef.current;
          if (started.current && cur && list.length) {
            commitSelection(cur.start, cur.end, list);
          } else {
            setDragging(null);
            started.current = false;
          }
        },
        onPanResponderTerminate: () => {
          clearLong();
          fingerDown.current = false;
          pressOrigin.current = null;
          setDragging(null);
          started.current = false;
          setRange(null);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, frame.w, frame.h, pageData],
  );

  const makeHandlePan = (which: 'start' | 'end') =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const cur = rangeRef.current;
        if (!cur) return;
        fingerDown.current = true;
        setDragging(which);
        anchorRef.current = which === 'start' ? cur.end : cur.start;
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const list = wordsRef.current;
        const idx = nearestWordIndex(list, locationX / frame.w, locationY / frame.h);
        if (idx < 0 || anchorRef.current < 0) return;
        setRange({
          start: Math.min(anchorRef.current, idx),
          end: Math.max(anchorRef.current, idx),
        });
      },
      onPanResponderRelease: () => {
        fingerDown.current = false;
        setDragging(null);
        const cur = rangeRef.current;
        const list = wordsRef.current;
        if (cur && list.length) commitSelection(cur.start, cur.end, list);
      },
      onPanResponderTerminate: () => {
        fingerDown.current = false;
        setDragging(null);
      },
    });

  const startHandlePan = useMemo(() => makeHandlePan('start'), [frame.w, frame.h]);
  const endHandlePan = useMemo(() => makeHandlePan('end'), [frame.w, frame.h]);

  if (!enabled) return null;

  const selectionFill = 'rgba(52, 120, 246, 0.38)';
  const handleColor = '#6B7280';

  const renderHandle = (
    which: 'start' | 'end',
    anchor: { x: number; y: number; h: number },
  ) => {
    const lineH = Math.max(anchor.h * frame.h, 14);
    const left = anchor.x * frame.w - 11;
    const top = anchor.y * frame.h;
    const pan = which === 'start' ? startHandlePan : endHandlePan;
    return (
      <View
        key={`handle-${which}`}
        style={[styles.handleHit, { left, top: top + lineH - 2 }]}
        {...pan.panHandlers}>
        <View
          style={[styles.handleStem, { backgroundColor: handleColor, height: lineH + 4, bottom: 18 }]}
        />
        <View style={[styles.handleHouse, { borderBottomColor: handleColor }]} />
        <View style={[styles.handleHouseBody, { backgroundColor: handleColor }]} />
      </View>
    );
  };

  return (
    <View style={StyleSheet.absoluteFill} {...selectPan.panHandlers}>
      {ensuringOcr ? (
        <View style={styles.prepHint} pointerEvents="none">
          <Text style={[styles.prepHintText, { color: mutedColor }]}>Reading text…</Text>
        </View>
      ) : null}

      {live &&
        live.hit.rects.map((rect, i) => (
          <View
            key={`sel-${i}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: rect.x * frame.w,
              top: rect.y * frame.h,
              width: Math.max(rect.w * frame.w, 4),
              height: Math.max(rect.h * frame.h, 12),
              backgroundColor: selectionFill,
              borderRadius: 1,
            }}
          />
        ))}

      {live?.handles ? renderHandle('start', live.handles.start) : null}
      {live?.handles ? renderHandle('end', live.handles.end) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  prepHint: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    alignItems: 'center',
  },
  prepHintText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  handleHit: {
    position: 'absolute',
    width: 44,
    height: 44,
    marginLeft: -11,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 6,
  },
  handleStem: {
    position: 'absolute',
    width: 2,
    borderRadius: 1,
  },
  handleHouse: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: -1,
  },
  handleHouseBody: {
    width: 16,
    height: 12,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
});
