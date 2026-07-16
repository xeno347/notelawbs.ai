import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, TouchableOpacity } from 'react-native';
import type { OcrPageData } from '../services/ocrService';
import type { Rect } from '../store';
import {
  flattenWords,
  nearestWordIndex,
  selectionFromRange,
  handleAnchors,
  type WordToken,
} from '../services/textSelection';
import { RADIUS, ELEVATION } from '../theme';

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
  onConfirm: (sel: LiveSelection) => void;
  onBusyChange?: (busy: boolean) => void;
  tint: string;
  tintSoft: string;
  textColor: string;
  mutedColor: string;
  surface: string;
};

/**
 * Text selection over the PDF page:
 * - With OCR/text-layer words: long-press a word, drag to extend (native style).
 * - Without words yet: drag a marquee rectangle so highlighting still works
 *   before OCR finishes (or when Auto OCR is off).
 */
export default function TextSelectOverlay({
  enabled,
  frame,
  pageData,
  ensuringOcr: _ensuringOcr,
  onEnsureOcr,
  onConfirm,
  onBusyChange,
  tint,
  tintSoft,
  mutedColor,
  surface,
}: Props) {
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | 'extend' | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const wordsRef = useRef<WordToken[]>([]);
  const anchorRef = useRef(-1);
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const started = useRef(false);
  const marqueeMode = useRef(false);
  const marqueeRef = useRef<Rect | null>(null);
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const words = useMemo(() => (pageData ? flattenWords(pageData) : []), [pageData]);
  wordsRef.current = words;

  useEffect(() => {
    setRange(null);
    setDragging(null);
    setMarquee(null);
    marqueeRef.current = null;
  }, [pageData]);

  useEffect(() => {
    if (!enabled) {
      setRange(null);
      setDragging(null);
      setMarquee(null);
      marqueeRef.current = null;
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

  const beginAt = async (px: number, py: number) => {
    onBusyChange?.(true);
    try {
      let data = pageData;
      if (!data?.blocks?.length) {
        data = await onEnsureOcr();
      }
      const list = data ? flattenWords(data) : [];
      wordsRef.current = list;
      if (!list.length) {
        // No OCR words — fall back to marquee from the press origin.
        marqueeMode.current = true;
        started.current = true;
        const origin = pressOrigin.current || { x: px, y: py };
        const box = {
          x: Math.min(origin.x, px),
          y: Math.min(origin.y, py),
          w: Math.max(8, Math.abs(px - origin.x)),
          h: Math.max(8, Math.abs(py - origin.y)),
        };
        marqueeRef.current = box;
        setMarquee(box);
        return;
      }
      const idx = nearestWordIndex(list, px / frame.w, py / frame.h);
      if (idx < 0) return;
      marqueeMode.current = false;
      anchorRef.current = idx;
      started.current = true;
      setRange({ start: idx, end: idx });
      setDragging('extend');
    } finally {
      onBusyChange?.(false);
    }
  };

  const extendTo = (px: number, py: number) => {
    if (marqueeMode.current) {
      const origin = pressOrigin.current;
      if (!origin) return;
      const box = {
        x: Math.min(origin.x, px),
        y: Math.min(origin.y, py),
        w: Math.abs(px - origin.x),
        h: Math.abs(py - origin.y),
      };
      marqueeRef.current = box;
      setMarquee(box);
      return;
    }
    const list = wordsRef.current;
    if (!list.length || anchorRef.current < 0) return;
    const idx = nearestWordIndex(list, px / frame.w, py / frame.h);
    if (idx < 0) return;
    setRange({ start: Math.min(anchorRef.current, idx), end: Math.max(anchorRef.current, idx) });
  };

  const confirmMarquee = () => {
    const box = marqueeRef.current;
    if (!box || box.w < 8 || box.h < 8 || !frame.w || !frame.h) return;
    const rect: Rect = {
      x: box.x / frame.w,
      y: box.y / frame.h,
      w: box.w / frame.w,
      h: box.h / frame.h,
    };
    onConfirm({
      start: 0,
      end: 0,
      text: '',
      rect,
      rects: [rect],
    });
    setMarquee(null);
    marqueeRef.current = null;
    marqueeMode.current = false;
  };

  const selectPan = useMemo(
    () =>
      PanResponder.create({
        // Do not gate on ensuringOcr — flipping that flag recreates this
        // responder mid-gesture and drops the selection.
        onStartShouldSetPanResponder: () => enabled,
        onMoveShouldSetPanResponder: () => enabled && started.current,
        onPanResponderTerminationRequest: () => !started.current,
        onPanResponderGrant: (evt) => {
          if (!enabled) return;
          const { locationX, locationY } = evt.nativeEvent;
          pressOrigin.current = { x: locationX, y: locationY };
          started.current = false;
          marqueeMode.current = false;
          setMarquee(null);
          marqueeRef.current = null;
          clearLong();
          // If words already exist, long-press to select. Otherwise start a
          // quick marquee after a short hold (or immediately on drag).
          const hasWords = wordsRef.current.length > 0;
          longTimer.current = setTimeout(() => {
            beginAt(locationX, locationY);
          }, hasWords ? 320 : 180);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const origin = pressOrigin.current;
          if (!started.current && origin) {
            const dist = Math.hypot(locationX - origin.x, locationY - origin.y);
            if (dist > 14) {
              clearLong();
              // Drag without waiting for long-press → marquee when no words yet.
              if (!wordsRef.current.length) {
                marqueeMode.current = true;
                started.current = true;
                extendTo(locationX, locationY);
              }
            }
            return;
          }
          if (started.current) extendTo(locationX, locationY);
        },
        onPanResponderRelease: () => {
          clearLong();
          pressOrigin.current = null;
          if (started.current && marqueeMode.current) {
            const box = marqueeRef.current;
            if (box && box.w > 8 && box.h > 8) {
              // Keep marquee painted until user confirms via toolbar.
              setDragging(null);
              started.current = false;
              return;
            }
          }
          if (started.current) {
            setDragging(null);
          }
          started.current = false;
          marqueeMode.current = false;
        },
        onPanResponderTerminate: () => {
          clearLong();
          pressOrigin.current = null;
          setDragging(null);
          started.current = false;
          marqueeMode.current = false;
          setMarquee(null);
          marqueeRef.current = null;
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
      onPanResponderRelease: () => setDragging(null),
      onPanResponderTerminate: () => setDragging(null),
    });

  const startHandlePan = useMemo(() => makeHandlePan('start'), [frame.w, frame.h]);
  const endHandlePan = useMemo(() => makeHandlePan('end'), [frame.w, frame.h]);

  if (!enabled) return null;

  const marqueeReady = !!(marquee && marquee.w > 8 && marquee.h > 8 && !started.current);

  return (
    <View style={StyleSheet.absoluteFill} {...selectPan.panHandlers}>
      {live &&
        live.hit.rects.map((rect, i) => (
          <View
            key={`sel-${i}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: rect.x * frame.w,
              top: rect.y * frame.h,
              width: rect.w * frame.w,
              height: Math.max(rect.h * frame.h, 14),
              backgroundColor: tintSoft,
              borderRadius: 3,
            }}
          />
        ))}

      {marquee && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: marquee.x,
            top: marquee.y,
            width: marquee.w,
            height: marquee.h,
            backgroundColor: tintSoft,
            borderWidth: 1.5,
            borderColor: tint,
          }}
        />
      )}

      {live?.handles && !dragging && (
        <>
          <View
            style={[
              styles.handle,
              {
                left: live.handles.start.x * frame.w - 10,
                top: live.handles.start.y * frame.h - 6,
                height: live.handles.start.h * frame.h + 12,
                borderColor: tint,
              },
            ]}
            {...startHandlePan.panHandlers}>
            <View style={[styles.handleKnob, { backgroundColor: tint, top: -4 }]} />
          </View>
          <View
            style={[
              styles.handle,
              {
                left: live.handles.end.x * frame.w - 10,
                top: live.handles.end.y * frame.h - 6,
                height: live.handles.end.h * frame.h + 12,
                borderColor: tint,
              },
            ]}
            {...endHandlePan.panHandlers}>
            <View style={[styles.handleKnob, { backgroundColor: tint, bottom: -4 }]} />
          </View>
        </>
      )}

      {live?.handles && dragging && (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.handle,
              {
                left: live.handles.start.x * frame.w - 10,
                top: live.handles.start.y * frame.h - 6,
                height: live.handles.start.h * frame.h + 12,
                borderColor: tint,
              },
            ]}>
            <View style={[styles.handleKnob, { backgroundColor: tint, top: -4 }]} />
          </View>
          <View
            pointerEvents="none"
            style={[
              styles.handle,
              {
                left: live.handles.end.x * frame.w - 10,
                top: live.handles.end.y * frame.h - 6,
                height: live.handles.end.h * frame.h + 12,
                borderColor: tint,
              },
            ]}>
            <View style={[styles.handleKnob, { backgroundColor: tint, bottom: -4 }]} />
          </View>
        </>
      )}

      {live && !dragging && (
        <View
          style={[
            styles.toolbar,
            {
              top: Math.max(8, live.hit.rect.y * frame.h - 52),
              left: Math.min(
                frame.w - 210,
                Math.max(8, live.hit.rect.x * frame.w + (live.hit.rect.w * frame.w) / 2 - 100),
              ),
              backgroundColor: surface,
            },
          ]}>
          <TouchableOpacity
            onPress={() =>
              onConfirm({
                start: live.start,
                end: live.end,
                text: live.hit.text,
                rect: live.hit.rect,
                rects: live.hit.rects,
              })
            }
            style={[styles.toolBtn, { backgroundColor: tint }]}>
            <Text style={styles.toolBtnText}>Highlight</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setRange(null)} style={styles.toolGhost}>
            <Text style={[styles.toolGhostText, { color: mutedColor }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {marqueeReady && (
        <View
          style={[
            styles.toolbar,
            {
              top: Math.max(8, marquee!.y - 52),
              left: Math.min(frame.w - 210, Math.max(8, marquee!.x + marquee!.w / 2 - 100)),
              backgroundColor: surface,
            },
          ]}>
          <TouchableOpacity onPress={confirmMarquee} style={[styles.toolBtn, { backgroundColor: tint }]}>
            <Text style={styles.toolBtnText}>Highlight</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setMarquee(null);
              marqueeRef.current = null;
            }}
            style={styles.toolGhost}>
            <Text style={[styles.toolGhostText, { color: mutedColor }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  handle: {
    position: 'absolute',
    width: 20,
    borderLeftWidth: 2,
    zIndex: 5,
  },
  handleKnob: {
    position: 'absolute',
    left: -5,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  toolbar: {
    position: 'absolute',
    zIndex: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    ...ELEVATION.float,
  },
  toolBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
  },
  toolBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  toolGhost: { paddingHorizontal: 10, paddingVertical: 8 },
  toolGhostText: { fontWeight: '500', fontSize: 14 },
});
