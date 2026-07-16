import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  LayoutRectangle,
  Animated,
  Easing,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import Pdf from 'react-native-pdf';
import DocumentPicker from 'react-native-document-picker';
import { FolderOpen, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react-native';
import { useStore, type Rect } from '../store';
import { useViewerLocked } from '../collab/collabStore';
import { useAnnotation, INK_SWATCHES, isInkTool } from '../annotationStore';
import type { Stroke } from '../store';
import Svg, { Polyline } from 'react-native-svg';
import {
  shouldAcceptDraw,
  pencilStrokeWidth,
  createPencilDoubleTap,
  readForce,
} from '../services/pencilGestures';
import { catStyle, getPalette, useTheme, SERIF, RADIUS, ELEVATION } from '../theme';
import SelectionPopover, { type PopoverSubmit } from './SelectionPopover';
import TextSelectOverlay from './TextSelectOverlay';
import {
  recognizePage,
  type OcrPageData,
} from '../services/ocrService';
import { analyzeImportantPassages } from '../services/importantPassagesService';
import {
  textInside,
  pointInRect,
  rectOverlap,
} from '../services/textSelection';

function ScanSweep({ color }: { color: string }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(y, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [y]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 48,
          backgroundColor: color,
          opacity: 0.5,
          transform: [
            {
              translateY: y.interpolate({ inputRange: [0, 1], outputRange: [-48, 900] }),
            },
          ],
        }}
      />
    </View>
  );
}

export default function PdfReader({ embedded = false }: { embedded?: boolean }) {
  const p = useTheme();
  const docUri = useStore((s) => s.docUri);
  const docName = useStore((s) => s.docName);
  const numPages = useStore((s) => s.numPages);
  const currentPage = useStore((s) => s.currentPage);
  const highlights = useStore((s) => s.highlights);
  const flashTarget = useStore((s) => s.flashTarget);
  const linking = useStore((s) => s.linking);
  const ocr = useStore((s) => s.ocr);
  const autoOcr = useStore((s) => s.autoOcr);

  const openPdf = useStore((s) => s.openPdf);
  const setDocMeta = useStore((s) => s.setDocMeta);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const createLinkedExcerpt = useStore((s) => s.createLinkedExcerpt);
  const clearFlash = useStore((s) => s.clearFlash);
  const completeLink = useStore((s) => s.completeLink);
  const setOcrPageText = useStore((s) => s.setOcrPageText);
  const setOcrPageData = useStore((s) => s.setOcrPageData);
  const setOcrProcessingPage = useStore((s) => s.setOcrProcessingPage);
  const setOcrScanning = useStore((s) => s.setOcrScanning);
  const ink = useStore((s) => s.ink);
  const addStroke = useStore((s) => s.addStroke);
  const eraseAtPdf = useStore((s) => s.eraseAtPdf);

  const [container, setContainer] = useState<LayoutRectangle | null>(null);
  const [aspect, setAspect] = useState(0.72);
  const tool = useAnnotation((s) => s.tool);
  const inkColor = useAnnotation((s) => s.inkColor);
  const fingerDraw = useAnnotation((s) => s.fingerDraw);
  const setTool = useAnnotation((s) => s.setTool);
  const pdfInkMode = isInkTool(tool);
  const highlightMode = tool === 'box';
  const viewerLocked = useViewerLocked();
  const textSelectMode = !pdfInkMode && !viewerLocked && !linking.active && !highlightMode;
  const [draft, setDraft] = useState<Rect | null>(null);
  const [popover, setPopover] = useState<{
    rect: Rect;
    rects: Rect[];
    page: number;
    text: string;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [passwordPrompt, setPasswordPrompt] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState('');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const pdfCaptureRef = useRef<View>(null);
  const pageWaiters = useRef<Map<number, () => void>>(new Map());
  const scanCancelRef = useRef(false);
  const ocrTried = useRef<Set<number>>(new Set());
  const pdfStrokeRef = useRef<Stroke | null>(null);
  const [livePdfPoints, setLivePdfPoints] = useState('');

  const waitForPageRender = (page: number, timeoutMs = 2500) =>
    new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        pageWaiters.current.delete(page);
        resolve();
      };
      pageWaiters.current.set(page, finish);
      setTimeout(finish, timeoutMs);
    });

  // Reset unlock state when the document changes
  useEffect(() => {
    setPdfPassword('');
    setPasswordDraft('');
    setPasswordPrompt(false);
    setPdfError(null);
  }, [docUri]);

  // Auto-OCR once per page (optional). Never retries forever — mark attempted on any outcome.
  useEffect(() => {
    if (!docUri || ocr.scanning || !autoOcr) return;
    if (ocr.layouts[currentPage] != null || ocr.processingPage === currentPage) return;
    if (ocrTried.current.has(currentPage)) return;
    const page = currentPage;
    const t = setTimeout(async () => {
      ocrTried.current.add(page);
      setOcrProcessingPage(page);
      try {
        const data = await recognizePage(pdfCaptureRef, aspect);
        setOcrPageData(page, data);
      } catch {
        setOcrPageText(page, '');
      }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docUri, currentPage, ocr.scanning, autoOcr]);

  const applyAiPassages = (
    passages: Awaited<ReturnType<typeof analyzeImportantPassages>>['passages'],
    _mode: 'live' | 'on-device',
  ) => {
    const docId = useStore.getState().activeDocId || undefined;
    let added = 0;
    passages.forEach((passage) => {
      const highlights = useStore.getState().highlights;
      const duplicate = highlights.some(
        (highlight) =>
          highlight.docId === docId &&
          highlight.page === passage.page &&
          rectOverlap(highlight.rect, passage.rect) > 0.55,
      );
      if (duplicate) return;
      createLinkedExcerpt({
        page: passage.page,
        rect: passage.rect,
        rects: passage.rects,
        text: passage.text,
        category: passage.category,
        note: `AI · ${passage.reason}`,
        docName,
        docId,
      });
      added += 1;
    });
    return added;
  };

  const analyzeCurrentPage = async () => {
    if (!docUri) return;
    setAnalyzing(true);
    try {
      const pageData = await ensureCurrentPageOcr();
      if (!pageData?.blocks.length) {
        Alert.alert('OCR needed', 'Could not read text on this page. Try again after the page finishes rendering.');
        return;
      }
      const result = await analyzeImportantPassages({ [currentPage]: pageData });
      const added = applyAiPassages(result.passages, result.mode);
      Alert.alert(
        'AI highlights ready',
        added
          ? `${added} key passages on page ${currentPage} were highlighted and sent to the canvas (${result.mode === 'live' ? 'live AI' : 'on-device analysis'}).`
          : 'No new passages found on this page — existing highlights were kept.',
      );
    } catch {
      Alert.alert('AI review unavailable', 'Could not analyze this page for important passages.');
    } finally {
      setAnalyzing(false);
    }
  };

  const scanDocument = async () => {
    const total = useStore.getState().numPages;
    if (!total) return;
    const originalPage = useStore.getState().currentPage;
    scanCancelRef.current = false;
    setOcrScanning(true, { done: 0, total });
    for (let pg = 1; pg <= total; pg++) {
      if (scanCancelRef.current) break;
      if (useStore.getState().ocr.layouts[pg] == null) {
        setCurrentPage(pg);
        await waitForPageRender(pg);
        await new Promise((r) => setTimeout(r, 400));
        ocrTried.current.add(pg);
        try {
          const data = await recognizePage(pdfCaptureRef, aspect);
          setOcrPageData(pg, data);
        } catch {
          setOcrPageText(pg, '');
        }
      }
      setOcrScanning(true, { done: pg, total });
    }
    setOcrScanning(false);
    if (scanCancelRef.current) {
      setCurrentPage(originalPage);
      return;
    }

    setAnalyzing(true);
    try {
      const state = useStore.getState();
      const result = await analyzeImportantPassages(state.ocr.layouts);
      const added = applyAiPassages(result.passages, result.mode);
      Alert.alert(
        'AI review complete',
        added
          ? `${added} important passages were highlighted and added to the canvas using ${result.mode === 'live' ? 'live AI' : 'on-device legal analysis'}.`
          : 'No new important passages were found. Existing AI highlights were kept.',
      );
    } catch {
      Alert.alert('AI review unavailable', 'OCR finished, but the important-passage review could not complete.');
    } finally {
      setAnalyzing(false);
      setCurrentPage(originalPage);
    }
  };

  const cancelScan = () => {
    scanCancelRef.current = true;
    setOcrScanning(false);
  };

  const [retryingOcr, setRetryingOcr] = useState(false);
  const retryPageOcr = async () => {
    const page = currentPage;
    setRetryingOcr(true);
    setOcrProcessingPage(page);
    try {
      const data = await recognizePage(pdfCaptureRef, aspect);
      setOcrPageData(page, data);
      useStore.getState().reanchorHighlightsForPage(page, useStore.getState().activeDocId || undefined, data);
    } catch {
      setOcrPageText(page, '');
    } finally {
      setRetryingOcr(false);
    }
  };

  // Recomputed only when highlights/numPages actually change, not on every
  // page turn or unrelated re-render (this used to recompute unconditionally).
  const marginTicks = useMemo(
    () =>
      highlights.map((h) => ({
        id: h.id,
        color: catStyle(h.category).color,
        top: Math.min(96, Math.max(2, ((h.page - 0.5) / Math.max(numPages, 1)) * 100)),
      })),
    [highlights, numPages],
  );

  const frame = useMemo(() => {
    if (!container) return null;
    const cw = container.width;
    const ch = container.height;
    // Prefer filling the pane (tablet-first) while keeping page aspect.
    let fh = ch;
    let fw = fh * aspect;
    if (fw > cw) {
      fw = cw;
      fh = fw / aspect;
    }
    return { w: fw, h: fh, left: (cw - fw) / 2, top: (ch - fh) / 2 };
  }, [container, aspect]);

  const setPdfFrame = useStore((s) => s.setPdfFrame);
  const layoutEpoch = useStore((s) => s.layoutEpoch);
  const stageRef = useRef<View>(null);
  const pencilDoubleTap = useRef(
    createPencilDoubleTap(() => useAnnotation.getState().cyclePencilTool()),
  );

  const openSelection = (rect: Rect, text = '', rects: Rect[] = [rect]) => {
    if (viewerLocked) return;
    setPopover({ rect, rects, page: currentPage, text });
    setTool('navigate');
  };

  const ensureCurrentPageOcr = async (): Promise<OcrPageData | null> => {
    const existing = useStore.getState().ocr.layouts[currentPage];
    if (existing?.blocks.length) return existing;
    setOcrProcessingPage(currentPage);
    const data = await recognizePage(pdfCaptureRef, aspect);
    setOcrPageData(currentPage, data);
    return data.blocks.length ? data : null;
  };

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
    // Fixed PDF pane: republish on layout / page / pane resize — not on canvas pan/zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, currentPage, layoutEpoch]);

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
                (h.rects?.length ? h.rects : [h.rect]).some((rect) =>
                  pointInRect(nx, ny, rect),
                ),
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
            setPopover({
              rect: norm,
              rects: [norm],
              page: currentPage,
              text: textInside(useStore.getState().ocr.layouts[currentPage], norm),
            });
          }
          setDraft(null);
          startRef.current = null;
        },
      }),
    [highlightMode, linking, frame, draft, highlights, currentPage, completeLink],
  );

  const pdfInkPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (evt) => {
          if (!pdfInkMode) return false;
          return shouldAcceptDraw(evt, fingerDraw);
        },
        onMoveShouldSetPanResponder: (evt) => pdfInkMode && shouldAcceptDraw(evt, fingerDraw),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          if (!frame) return;
          if (pencilDoubleTap.current(evt)) return;
          const { locationX, locationY } = evt.nativeEvent;
          const force = readForce(evt);
          const nx = locationX / frame.w;
          const ny = locationY / frame.h;
          if (tool === 'eraser') {
            eraseAtPdf(currentPage, nx, ny, 0.028);
            return;
          }
          const width =
            tool === 'highlighter' || tool === 'pen'
              ? pencilStrokeWidth(tool === 'highlighter' ? 'highlighter' : 'pen', force)
              : 2.8;
          const st: Stroke = {
            id: `${Date.now()}`,
            color: inkColor,
            width,
            pdfPage: currentPage,
            points: [{ x: nx, y: ny }],
          };
          pdfStrokeRef.current = st;
          setLivePdfPoints(`${locationX},${locationY}`);
        },
        onPanResponderMove: (evt) => {
          if (!frame) return;
          const { locationX, locationY } = evt.nativeEvent;
          const force = readForce(evt);
          const nx = locationX / frame.w;
          const ny = locationY / frame.h;
          if (tool === 'eraser') {
            eraseAtPdf(currentPage, nx, ny, 0.028);
            return;
          }
          if (!pdfStrokeRef.current) return;
          pdfStrokeRef.current.points.push({ x: nx, y: ny });
          if (tool === 'pen' && force > 0) {
            pdfStrokeRef.current.width = pencilStrokeWidth('pen', force);
          }
          setLivePdfPoints(
            pdfStrokeRef.current.points
              .map((pt) => `${pt.x * frame.w},${pt.y * frame.h}`)
              .join(' '),
          );
        },
        onPanResponderRelease: () => {
          if (pdfStrokeRef.current && pdfStrokeRef.current.points.length > 1) {
            addStroke(pdfStrokeRef.current);
          }
          pdfStrokeRef.current = null;
          setLivePdfPoints('');
        },
      }),
    [pdfInkMode, fingerDraw, frame, tool, inkColor, currentPage, addStroke, eraseAtPdf],
  );

  const pagePdfStrokes = ink.strokes.filter((st) => st.pdfPage === currentPage);
  const inkColors = INK_SWATCHES as unknown as string[];

  const onHighlightSubmit = (v: PopoverSubmit) => {
    if (!popover) return;
    createLinkedExcerpt({
      page: popover.page,
      rect: popover.rect,
      rects: popover.rects,
      text: v.text,
      category: v.category,
      note: v.note,
      tags: v.tags,
      markStyle: v.markStyle,
      docName,
      docId: useStore.getState().activeDocId || undefined,
    });
    setPopover(null);
    setTool('navigate');
  };

  const activeDocId = useStore.getState().activeDocId;
  const pageHighlights = highlights.filter(
    (highlight) =>
      highlight.page === currentPage && (!highlight.docId || highlight.docId === activeDocId),
  );
  const s = styles(p);

  return (
    <View style={s.root}>
      {(!!docUri || ocr.scanning) && (
        <View style={[s.readerChrome, embedded && s.readerChromeEmbed]}>
          {!embedded && (
            <Text style={s.docTitle} numberOfLines={1}>
              {docName ? docName.replace(/\.pdf$/i, '') : 'Document'}
            </Text>
          )}
          {!!docUri && !ocr.scanning && !analyzing && (
            <>
              <TouchableOpacity style={s.scanChip} onPress={analyzeCurrentPage}>
                <Sparkles size={13} color={p.ai} strokeWidth={2.1} />
                <Text style={s.scanChipText}>AI · this page</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.scanChip, s.scanChipDoc]} onPress={scanDocument}>
                <Sparkles size={13} color={p.accent} strokeWidth={2.1} />
                <Text style={s.scanChipText}>AI · full doc</Text>
              </TouchableOpacity>
            </>
          )}
          {analyzing && (
            <View style={[s.scanChip, s.scanChipActive]}>
              <Sparkles size={13} color={p.ai} strokeWidth={2.1} />
              <Text style={[s.scanChipText, { color: p.ai }]}>Finding key passages…</Text>
            </View>
          )}
          {ocr.scanning && ocr.scanProgress && (
            <TouchableOpacity style={[s.scanChip, s.scanChipActive]} onPress={cancelScan}>
              <Text style={[s.scanChipText, { color: p.accent }]}>
                {ocr.scanProgress.done}/{ocr.scanProgress.total} · cancel
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {!!docUri &&
        !ocr.scanning &&
        !analyzing &&
        ocr.layouts[currentPage]?.quality?.label === 'low' && (
          <View style={s.qualityBanner}>
            <Text style={s.qualityText}>
              Text quality may be unreliable on this page — recognition looks weak.
            </Text>
            <TouchableOpacity onPress={retryPageOcr} disabled={retryingOcr}>
              <Text style={s.qualityRetry}>{retryingOcr ? 'Retrying…' : 'Retry OCR'}</Text>
            </TouchableOpacity>
          </View>
        )}

      <View
        ref={stageRef}
        style={s.stage}
        onLayout={(e) => {
          setContainer(e.nativeEvent.layout);
          publishFrame();
        }}>
        {/* Margin highlight ticks (LiquidText-style) */}
        {docUri && frame && marginTicks.length > 0 && (
          <View style={s.marginRail} pointerEvents="box-none">
            {marginTicks.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[s.marginTick, { top: `${t.top}%` as any, backgroundColor: t.color }]}
                onPress={() => useStore.getState().jumpToHighlight(t.id)}
              />
            ))}
          </View>
        )}

        {docUri ? (
          <>
            {frame && (
              <View
                style={[
                  s.frame,
                  { width: frame.w, height: frame.h, left: frame.left, top: frame.top },
                ]}>
                <View ref={pdfCaptureRef} collapsable={false} style={StyleSheet.absoluteFill}>
                  <Pdf
                    key={`pdf-${docUri}-${pdfPassword}`}
                    source={{ uri: docUri }}
                    page={currentPage}
                    singlePage
                    fitPolicy={0}
                    scale={1}
                    minScale={1}
                    maxScale={1}
                    spacing={0}
                    enablePaging
                    password={pdfPassword || undefined}
                    style={s.pdf}
                    onLoadComplete={(pages, _fp, dims) => {
                      setPdfError(null);
                      setPasswordPrompt(false);
                      setDocMeta(pages);
                      if (dims?.width && dims?.height) {
                        setAspect(dims.width / dims.height);
                      }
                    }}
                    onPageChanged={(page) => {
                      setCurrentPage(page);
                      pageWaiters.current.get(page)?.();
                    }}
                    onError={(err: any) => {
                      const msg = String(err?.message || err || 'Could not open PDF');
                      const needsPass =
                        /password|encrypted|protect/i.test(msg) || !pdfPassword;
                      if (needsPass && /password|encrypted|protect/i.test(msg)) {
                        setPasswordPrompt(true);
                        setPdfError('This PDF is password-protected.');
                      } else {
                        setPdfError(msg);
                      }
                    }}
                  />
                </View>

                {(ocr.scanning && ocr.scanProgress && ocr.scanProgress.done + 1 === currentPage) && (
                  <ScanSweep color={p.scanline} />
                )}

                {/* highlight / underline / strikethrough for current page */}
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  {pageHighlights.map((h) => {
                    const cs = catStyle(h.category);
                    const isFlash =
                      flashTarget?.type === 'highlight' && flashTarget.id === h.id;
                    const style = h.markStyle || 'highlight';
                    return (
                      <React.Fragment key={h.id}>
                        {(h.rects?.length ? h.rects : [h.rect]).map((rect, index) => {
                          const left = rect.x * frame.w;
                          const top = rect.y * frame.h;
                          const width = rect.w * frame.w;
                          const height = rect.h * frame.h;
                          if (style === 'underline') {
                            return (
                              <View
                                key={`${h.id}-${index}`}
                                style={{
                                  position: 'absolute',
                                  left,
                                  top: top + height - 2,
                                  width,
                                  height: isFlash ? 3 : 2,
                                  backgroundColor: cs.color,
                                  borderRadius: 1,
                                }}
                              />
                            );
                          }
                          if (style === 'strikethrough') {
                            return (
                              <View
                                key={`${h.id}-${index}`}
                                style={{
                                  position: 'absolute',
                                  left,
                                  top: top + height * 0.45,
                                  width,
                                  height: isFlash ? 3 : 2,
                                  backgroundColor: cs.color,
                                  borderRadius: 1,
                                }}
                              />
                            );
                          }
                          return (
                            <View
                              key={`${h.id}-${index}`}
                              style={{
                                position: 'absolute',
                                left,
                                top,
                                width,
                                height,
                                backgroundColor: cs.soft,
                                borderRadius: 3,
                                borderWidth: isFlash ? 1.5 : 0.5,
                                borderColor: cs.color,
                              }}
                            />
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                  {popover &&
                    popover.rects.map((rect, index) => (
                      <View
                        key={`sel-${index}`}
                        style={{
                          position: 'absolute',
                          left: rect.x * frame.w,
                          top: rect.y * frame.h,
                          width: rect.w * frame.w,
                          height: rect.h * frame.h,
                          backgroundColor: p.accentSoft,
                          borderRadius: 3,
                          borderWidth: 1.5,
                          borderColor: p.accent,
                        }}
                      />
                    ))}
                </View>

                {/* PDF ink (pen / highlighter / eraser) */}
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Svg width={frame.w} height={frame.h}>
                    {pagePdfStrokes.map((st) => (
                      <Polyline
                        key={st.id}
                        points={st.points.map((pt) => `${pt.x * frame.w},${pt.y * frame.h}`).join(' ')}
                        stroke={inkColors[st.color] || inkColors[0]}
                        strokeWidth={st.width}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={st.width >= 10 ? 0.45 : 1}
                      />
                    ))}
                    {livePdfPoints ? (
                      <Polyline
                        points={livePdfPoints}
                        stroke={inkColors[inkColor] || inkColors[0]}
                        strokeWidth={tool === 'highlighter' ? 14 : 2.8}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={tool === 'highlighter' ? 0.45 : 1}
                      />
                    ) : null}
                  </Svg>
                </View>

                {selecting && (
                  <View style={s.selectingOverlay} pointerEvents="none">
                    <View style={s.selectingPill}>
                      <ActivityIndicator size="small" color={p.accent} />
                      <Text style={s.selectingText}>Reading text…</Text>
                    </View>
                  </View>
                )}

                {/* Native text selection — long-press word, drag to extend */}
                {frame && textSelectMode && (
                  <TextSelectOverlay
                    key={`sel-${currentPage}-${popover ? 'sheet' : 'live'}`}
                    enabled={textSelectMode && !popover}
                    frame={frame}
                    pageData={ocr.layouts[currentPage]}
                    ensuringOcr={selecting || ocr.processingPage === currentPage}
                    onEnsureOcr={ensureCurrentPageOcr}
                    onBusyChange={setSelecting}
                    onConfirm={(sel) => openSelection(sel.rect, sel.text, sel.rects)}
                    tint={p.tint}
                    tintSoft={p.tintSoft}
                    textColor={p.text}
                    mutedColor={p.textMid}
                    surface={p.grouped}
                  />
                )}

                {/* box / link capture overlay (optional Lasso still available) */}
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
                          backgroundColor: p.tintSoft,
                          borderWidth: 1.5,
                          borderColor: p.tint,
                        }}
                      />
                    )}
                  </View>
                )}

                {pdfInkMode && !linking.active && !viewerLocked && (
                  <View style={[StyleSheet.absoluteFill, { zIndex: 20 }]} {...pdfInkPan.panHandlers} />
                )}
              </View>
            )}
          </>
        ) : (
          <View style={s.empty}>
            <View style={s.emptyCard}>
              <View style={s.emptyIcon}>
                <FolderOpen size={28} color={p.tint} strokeWidth={1.8} />
              </View>
              <Text style={s.emptyHeading}>No Document</Text>
              <Text style={s.emptyText}>
                Add a judgment PDF from the sidebar, or open one here. Long-press a word, then drag
                to select text like on iPhone or iPad. Tap Highlight to send it to the canvas.
              </Text>
              <TouchableOpacity style={s.emptyBtn} onPress={openDoc} activeOpacity={0.85}>
                <FolderOpen size={16} color="#fff" strokeWidth={2.2} />
                <Text style={s.emptyBtnText}>Open PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {!!docUri && (
        <View style={s.pagerWrap} pointerEvents="box-none">
          <View style={s.pager}>
            <TouchableOpacity
              accessibilityLabel="Previous page"
              style={s.pageBtn}
              onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}>
              <ChevronLeft size={18} color={p.text} strokeWidth={2.2} />
            </TouchableOpacity>
            <Text style={s.pageLabel}>
              p. {currentPage} / {numPages || '—'}
            </Text>
            <TouchableOpacity
              accessibilityLabel="Next page"
              style={s.pageBtn}
              onPress={() => setCurrentPage(Math.min(numPages || currentPage + 1, currentPage + 1))}>
              <ChevronRight size={18} color={p.text} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
          {numPages > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.thumbStrip}
              contentContainerStyle={s.thumbStripContent}>
              {Array.from({ length: Math.min(numPages, 80) }, (_, i) => i + 1).map((pg) => {
                const active = pg === currentPage;
                const hasMark = highlights.some((h) => h.page === pg);
                return (
                  <TouchableOpacity
                    key={pg}
                    style={[s.thumb, active && s.thumbActive]}
                    onPress={() => setCurrentPage(pg)}>
                    <Text style={[s.thumbText, active && s.thumbTextActive]}>{pg}</Text>
                    {hasMark ? <View style={[s.thumbDot, { backgroundColor: p.accent }]} /> : null}
                  </TouchableOpacity>
                );
              })}
              {numPages > 80 ? (
                <Text style={s.thumbMore}>+{numPages - 80}</Text>
              ) : null}
            </ScrollView>
          )}
        </View>
      )}

      {!!pdfError && !passwordPrompt && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>{pdfError}</Text>
          <TouchableOpacity
            onPress={() => {
              setPdfError(null);
              setPasswordPrompt(true);
            }}>
            <Text style={s.errorAction}>Retry / password</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={passwordPrompt} transparent animationType="fade" onRequestClose={() => setPasswordPrompt(false)}>
        <View style={s.passOverlay}>
          <View style={s.passCard}>
            <Text style={s.passTitle}>Password required</Text>
            <Text style={s.passHint}>Enter the password for this PDF to unlock it.</Text>
            <TextInput
              style={s.passInput}
              value={passwordDraft}
              onChangeText={setPasswordDraft}
              placeholder="PDF password"
              placeholderTextColor={p.textMuted}
              secureTextEntry
              autoFocus
            />
            <View style={s.passActions}>
              <TouchableOpacity style={s.passCancel} onPress={() => setPasswordPrompt(false)}>
                <Text style={s.passCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.passSubmit}
                onPress={() => {
                  setPdfPassword(passwordDraft);
                  setPasswordPrompt(false);
                  setPdfError(null);
                }}>
                <Text style={s.passSubmitText}>Unlock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SelectionPopover
        visible={!!popover}
        page={popover?.page || currentPage}
        initialText={popover?.text || ''}
        onSubmit={onHighlightSubmit}
        onCancel={() => setPopover(null)}
      />
    </View>
  );
}

const styles = (p: ReturnType<typeof getPalette>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: p.bg, position: 'relative' },
    readerChrome: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: p.grouped,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.separator,
      gap: 8,
    },
    readerChromeEmbed: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: p.surface2,
    },
    docTitle: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: p.text,
      fontFamily: SERIF,
    },
    scanChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: RADIUS.pill,
      backgroundColor: p.fillSecondary,
    },
    scanChipActive: { backgroundColor: p.aiSoft },
    scanChipDoc: { backgroundColor: p.tintSoft },
    scanChipText: { fontSize: 12, color: p.textMid, fontWeight: '600' },
    qualityBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 9,
      backgroundColor: p.surface2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.separator,
    },
    qualityText: { flex: 1, fontSize: 12, color: p.textMid },
    qualityRetry: { fontSize: 12, fontWeight: '800', color: p.tint },
    stage: { flex: 1, position: 'relative' },
    marginRail: {
      position: 'absolute',
      left: 5,
      top: 14,
      bottom: 14,
      width: 8,
      zIndex: 4,
    },
    marginTick: {
      position: 'absolute',
      left: 0,
      width: 6,
      height: 15,
      borderRadius: 3,
    },
    frame: {
      position: 'absolute',
      backgroundColor: p.pdfPage,
      overflow: 'hidden',
      borderRadius: 6,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.08)',
      ...ELEVATION.cardActive,
    },
    pdf: { flex: 1, backgroundColor: p.pdfPage },
    selectingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 30,
    },
    selectingPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: RADIUS.pill,
      backgroundColor: p.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      ...ELEVATION.float,
    },
    selectingText: { color: p.textMid, fontSize: 12, fontWeight: '600' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
    emptyCard: {
      backgroundColor: p.grouped,
      borderRadius: RADIUS.lg,
      padding: 28,
      alignItems: 'center',
      maxWidth: 360,
      width: '100%',
      ...ELEVATION.card,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 14,
      backgroundColor: p.tintSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyHeading: { fontSize: 22, fontWeight: '700', color: p.text, marginBottom: 8, letterSpacing: 0.35 },
    emptyText: { color: p.textMid, fontSize: 15, textAlign: 'center', lineHeight: 21, marginBottom: 20, maxWidth: 300 },
    emptyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: p.tint,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 22,
      paddingVertical: 13,
    },
    emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 17 },
    pagerWrap: {
      position: 'absolute',
      bottom: 82,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 12,
    },
    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 6,
      paddingVertical: 5,
      backgroundColor: p.surface,
      borderRadius: RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      ...ELEVATION.float,
    },
    pageBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.surface2,
      borderRadius: RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
    },
    pageLabel: { fontSize: 12, color: p.text, minWidth: 84, textAlign: 'center', fontWeight: '700', fontFamily: SERIF },
    thumbStrip: { maxHeight: 44, marginTop: 8, maxWidth: '92%' },
    thumbStripContent: { paddingHorizontal: 12, gap: 6, alignItems: 'center' },
    thumb: {
      minWidth: 34,
      height: 34,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      backgroundColor: p.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    thumbActive: { backgroundColor: p.tintSoft, borderColor: p.tint },
    thumbText: { fontSize: 11, fontWeight: '700', color: p.textMid },
    thumbTextActive: { color: p.tint },
    thumbDot: { position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: 2.5 },
    thumbMore: { fontSize: 11, color: p.textMuted, paddingHorizontal: 6 },
    errorBanner: {
      position: 'absolute',
      top: 56,
      left: 16,
      right: 16,
      padding: 12,
      borderRadius: RADIUS.sm,
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.danger,
      zIndex: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    errorText: { flex: 1, color: p.danger, fontSize: 12, fontWeight: '600' },
    errorAction: { color: p.tint, fontSize: 12, fontWeight: '800' },
    passOverlay: {
      flex: 1,
      backgroundColor: p.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    passCard: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: p.surface,
      borderRadius: RADIUS.lg,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      ...ELEVATION.popover,
    },
    passTitle: { fontSize: 17, fontWeight: '800', color: p.text, fontFamily: SERIF },
    passHint: { fontSize: 13, color: p.textMuted, marginTop: 6, marginBottom: 14 },
    passInput: {
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: RADIUS.sm,
      padding: 12,
      color: p.text,
      backgroundColor: p.bg,
      marginBottom: 14,
    },
    passActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
    passCancel: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.sm, backgroundColor: p.surface2 },
    passCancelText: { color: p.text, fontWeight: '600' },
    passSubmit: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.sm, backgroundColor: p.tint },
    passSubmitText: { color: '#fff', fontWeight: '800' },
  });
