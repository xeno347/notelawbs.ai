import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  LayoutRectangle,
} from 'react-native';
import Pdf from 'react-native-pdf';
import DocumentPicker from 'react-native-document-picker';
import { useStore, type Rect } from '../store';
import { catStyle, getPalette, SERIF } from '../theme';
import SelectionPopover, { type PopoverSubmit } from './SelectionPopover';

export default function PdfReader() {
  const p = getPalette();
  const docUri = useStore((s) => s.docUri);
  const docName = useStore((s) => s.docName);
  const numPages = useStore((s) => s.numPages);
  const currentPage = useStore((s) => s.currentPage);
  const highlights = useStore((s) => s.highlights);
  const flashTarget = useStore((s) => s.flashTarget);
  const linking = useStore((s) => s.linking);

  const openPdf = useStore((s) => s.openPdf);
  const setDocMeta = useStore((s) => s.setDocMeta);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const addHighlight = useStore((s) => s.addHighlight);
  const addExcerptNode = useStore((s) => s.addExcerptNode);
  const clearFlash = useStore((s) => s.clearFlash);
  const completeLink = useStore((s) => s.completeLink);

  const [container, setContainer] = useState<LayoutRectangle | null>(null);
  const [aspect, setAspect] = useState(0.72);
  const [highlightMode, setHighlightMode] = useState(false);
  const [draft, setDraft] = useState<Rect | null>(null);
  const [popover, setPopover] = useState<{ rect: Rect; page: number } | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const frame = useMemo(() => {
    if (!container) return null;
    const cw = container.width;
    const ch = container.height;
    let fw = cw;
    let fh = fw / aspect;
    if (fh > ch) {
      fh = ch;
      fw = fh * aspect;
    }
    return { w: fw, h: fh, left: (cw - fw) / 2, top: (ch - fh) / 2 };
  }, [container, aspect]);

  const setPdfFrame = useStore((s) => s.setPdfFrame);
  const stageRef = useRef<View>(null);

  useEffect(() => {
    if (flashTarget) {
      const t = setTimeout(clearFlash, 2200);
      return () => clearTimeout(t);
    }
  }, [flashTarget, clearFlash]);

  const publishFrame = () => {
    if (!frame || !stageRef.current) {
      setPdfFrame(null);
      return;
    }
    stageRef.current.measureInWindow((wx, wy) => {
      setPdfFrame({
        left: wx + frame.left,
        top: wy + frame.top,
        w: frame.w,
        h: frame.h,
      });
    });
  };

  useEffect(() => {
    publishFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, currentPage]);

  const openDoc = async () => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf],
        copyTo: 'cachesDirectory',
      });
      const uri = res.fileCopyUri || res.uri;
      await openPdf(uri, res.name || 'document.pdf');
    } catch (e: any) {
      if (!DocumentPicker.isCancel(e)) {
        // swallow — keep app usable offline
      }
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => highlightMode || linking.active,
        onMoveShouldSetPanResponder: () => highlightMode,
        onPanResponderGrant: (evt) => {
          if (!frame) return;
          const x = evt.nativeEvent.locationX;
          const y = evt.nativeEvent.locationY;
          if (linking.active && linking.step === 'pdf') {
            const nx = x / frame.w;
            const ny = y / frame.h;
            const hit = highlights.find(
              (h) =>
                h.page === currentPage &&
                nx >= h.rect.x &&
                nx <= h.rect.x + h.rect.w &&
                ny >= h.rect.y &&
                ny <= h.rect.y + h.rect.h,
            );
            if (hit) completeLink({ highlightId: hit.id, page: currentPage });
            else completeLink({ page: currentPage, x: nx, y: ny });
            return;
          }
          startRef.current = { x, y };
          setDraft({ x, y, w: 0, h: 0 });
        },
        onPanResponderMove: (evt) => {
          if (!startRef.current || !highlightMode) return;
          const x = evt.nativeEvent.locationX;
          const y = evt.nativeEvent.locationY;
          const sx = startRef.current.x;
          const sy = startRef.current.y;
          setDraft({
            x: Math.min(sx, x),
            y: Math.min(sy, y),
            w: Math.abs(x - sx),
            h: Math.abs(y - sy),
          });
        },
        onPanResponderRelease: () => {
          if (!highlightMode || !frame || !draft) {
            startRef.current = null;
            return;
          }
          if (draft.w > 8 && draft.h > 8) {
            const norm: Rect = {
              x: draft.x / frame.w,
              y: draft.y / frame.h,
              w: draft.w / frame.w,
              h: draft.h / frame.h,
            };
            setPopover({ rect: norm, page: currentPage });
          }
          setDraft(null);
          startRef.current = null;
        },
      }),
    [highlightMode, linking, frame, draft, highlights, currentPage, completeLink],
  );

  const onHighlightSubmit = (v: PopoverSubmit) => {
    if (!popover) return;
    const h = addHighlight({
      page: popover.page,
      rect: popover.rect,
      text: v.text,
      category: v.category,
      note: v.note,
    });
    addExcerptNode({
      text: v.text,
      page: popover.page,
      category: v.category,
      note: v.note,
      highlightId: h.id,
      docName,
    });
    setPopover(null);
    setHighlightMode(false);
  };

  const pageHighlights = highlights.filter((h) => h.page === currentPage);
  const s = styles(p);

  return (
    <View style={s.root}>
      <View style={s.toolbar}>
        <TouchableOpacity style={s.openBtn} onPress={openDoc}>
          <Text style={s.openText}>Open PDF</Text>
        </TouchableOpacity>
        {!!docName && (
          <Text style={s.docInfo} numberOfLines={1}>
            {docName} · {highlights.length} hl
          </Text>
        )}
        <TouchableOpacity
          style={[s.hlBtn, highlightMode && s.hlBtnActive]}
          onPress={() => setHighlightMode((m) => !m)}
          disabled={!docUri}>
          <Text style={[s.hlText, highlightMode && s.hlTextActive]}>
            {highlightMode ? 'Drawing…' : '＋ Highlight'}
          </Text>
        </TouchableOpacity>
      </View>

      <View
        ref={stageRef}
        style={s.stage}
        onLayout={(e) => {
          setContainer(e.nativeEvent.layout);
          publishFrame();
        }}>
        {docUri ? (
          <>
            {frame && (
              <View
                style={[
                  s.frame,
                  { width: frame.w, height: frame.h, left: frame.left, top: frame.top },
                ]}>
                <Pdf
                  source={{ uri: docUri }}
                  page={currentPage}
                  singlePage
                  fitPolicy={0}
                  scale={1}
                  minScale={1}
                  maxScale={3}
                  spacing={0}
                  enablePaging
                  style={s.pdf}
                  onLoadComplete={(pages, _fp, dims) => {
                    setDocMeta(pages);
                    if (dims?.width && dims?.height) {
                      setAspect(dims.width / dims.height);
                    }
                  }}
                  onPageChanged={(page) => setCurrentPage(page)}
                  onError={() => {}}
                />

                {/* highlight rects for current page */}
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  {pageHighlights.map((h) => {
                    const cs = catStyle(h.category);
                    const isFlash =
                      flashTarget?.type === 'highlight' && flashTarget.id === h.id;
                    return (
                      <View
                        key={h.id}
                        style={{
                          position: 'absolute',
                          left: h.rect.x * frame.w,
                          top: h.rect.y * frame.h,
                          width: h.rect.w * frame.w,
                          height: h.rect.h * frame.h,
                          backgroundColor: cs.soft,
                          borderRadius: 2,
                          borderWidth: isFlash ? 2.5 : 0,
                          borderColor: cs.color,
                        }}
                      />
                    );
                  })}
                </View>

                {/* draw / link capture overlay */}
                {(highlightMode || (linking.active && linking.step === 'pdf')) && (
                  <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
                    {draft && (
                      <View
                        style={{
                          position: 'absolute',
                          left: draft.x,
                          top: draft.y,
                          width: draft.w,
                          height: draft.h,
                          backgroundColor: p.accentSoft,
                          borderWidth: 1.5,
                          borderColor: p.accent,
                        }}
                      />
                    )}
                  </View>
                )}
              </View>
            )}
          </>
        ) : (
          <View style={s.empty}>
            <View style={s.emptyCard}>
              <View style={[s.spineMark]} />
              <Text style={s.emptyHeading}>Open a judgment</Text>
              <Text style={s.emptyText}>
                Load a court judgment PDF, then draw highlights over key passages and send
                excerpts to the canvas.
              </Text>
              <TouchableOpacity style={s.emptyBtn} onPress={openDoc}>
                <Text style={s.emptyBtnText}>Open PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {!!docUri && (
        <View style={s.pager}>
          <TouchableOpacity
            style={s.pageBtn}
            onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}>
            <Text style={s.pageBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.pageLabel}>
            p. {currentPage} / {numPages || '—'}
          </Text>
          <TouchableOpacity
            style={s.pageBtn}
            onPress={() => setCurrentPage(Math.min(numPages || currentPage + 1, currentPage + 1))}>
            <Text style={s.pageBtnText}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {highlights.length > 0 && (
        <View style={s.index}>
          {highlights.map((h, i) => {
            const cs = catStyle(h.category);
            return (
              <TouchableOpacity
                key={h.id}
                style={[s.chip, { backgroundColor: cs.soft }]}
                onPress={() => useStore.getState().jumpToHighlight(h.id)}>
                <Text style={s.chipText}>
                  {i + 1} · p.{h.page}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <SelectionPopover
        visible={!!popover}
        page={popover?.page || currentPage}
        onSubmit={onHighlightSubmit}
        onCancel={() => setPopover(null)}
      />
    </View>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: p.surface2 },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: p.surface,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
    },
    openBtn: { backgroundColor: p.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    openText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    docInfo: { flex: 1, fontSize: 12.5, color: p.textMid, fontWeight: '600' },
    hlBtn: {
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    hlBtnActive: { backgroundColor: p.accentSoft, borderColor: p.accent },
    hlText: { fontSize: 13, color: p.text },
    hlTextActive: { color: p.accent, fontWeight: '600' },
    stage: { flex: 1, position: 'relative' },
    frame: {
      position: 'absolute',
      backgroundColor: p.pdfPage,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.14,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    pdf: { flex: 1, backgroundColor: p.pdfPage },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
    emptyCard: {
      backgroundColor: p.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: p.border,
      padding: 24,
      alignItems: 'center',
      maxWidth: 340,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    spineMark: { width: 6, height: 30, borderRadius: 2, backgroundColor: p.accent, marginBottom: 14 },
    emptyHeading: { fontSize: 20, fontWeight: '700', color: p.text, fontFamily: SERIF, marginBottom: 8 },
    emptyText: { color: p.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 21, fontFamily: SERIF, marginBottom: 16 },
    emptyBtn: { backgroundColor: p.accent, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
    emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      paddingVertical: 6,
      backgroundColor: p.surface,
      borderTopWidth: 1,
      borderTopColor: p.border,
    },
    pageBtn: {
      width: 36,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.surface2,
      borderRadius: 6,
    },
    pageBtnText: { fontSize: 20, color: p.text, lineHeight: 22 },
    pageLabel: { fontSize: 13, color: p.textMuted, minWidth: 90, textAlign: 'center' },
    index: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      padding: 8,
      maxHeight: 96,
      backgroundColor: p.surface,
      borderTopWidth: 1,
      borderTopColor: p.border,
    },
    chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: p.border },
    chipText: { fontSize: 11, color: p.text, fontWeight: '600' },
  });
