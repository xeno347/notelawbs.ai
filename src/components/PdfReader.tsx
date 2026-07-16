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
  AppState,
  type AppStateStatus,
} from 'react-native';
import Pdf from 'react-native-pdf';
import DocumentPicker from 'react-native-document-picker';
import {
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Rows3,
  Square,
  MoreHorizontal,
} from 'lucide-react-native';
import { useStore, type Rect } from '../store';
import PdfThumbStrip from './PdfThumbStrip';
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
  capturePageImage,
  recognizeCapturedAuto,
  type OcrPageData,
} from '../services/ocrService';
import { canUseCloudOcr } from '../services/cloudOcrService';
import { probePdfTextLayer, importPdfTextLayer } from '../services/pdfTextLayer';
import {
  textInside,
  pointInRect,
  selectionFromMarquee,
} from '../services/textSelection';
import { BlurView } from '@react-native-community/blur';
import { Cloud, Cpu, Pause, Play, X as XIcon, AlertTriangle } from 'lucide-react-native';

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
  const preferCloudOcr = useStore((s) => s.preferCloudOcr);
  const pdfZoom = useStore((s) => s.pdfZoom);
  const setPdfZoom = useStore((s) => s.setPdfZoom);
  const readingMode = useStore((s) => s.readingMode);
  const setReadingMode = useStore((s) => s.setReadingMode);
  const pageRotation = useStore((s) => s.pageRotation);
  const rotatePage = useStore((s) => s.rotatePage);
  const translationView = useStore((s) => s.translationView);
  const translations = useStore((s) => s.translations);
  const setTranslationView = useStore((s) => s.setTranslationView);

  const openPdf = useStore((s) => s.openPdf);
  const setDocMeta = useStore((s) => s.setDocMeta);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const createLinkedExcerpt = useStore((s) => s.createLinkedExcerpt);
  const clearFlash = useStore((s) => s.clearFlash);
  const completeLink = useStore((s) => s.completeLink);
  const setAutoOcr = useStore((s) => s.setAutoOcr);
  const setOcrPageData = useStore((s) => s.setOcrPageData);
  const setOcrLayoutsBulk = useStore((s) => s.setOcrLayoutsBulk);
  const setOcrPageFailed = useStore((s) => s.setOcrPageFailed);
  const setOcrProcessingPage = useStore((s) => s.setOcrProcessingPage);
  const setOcrScanning = useStore((s) => s.setOcrScanning);
  const setOcrScanPaused = useStore((s) => s.setOcrScanPaused);
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
  // Text / Under / Strike enable selection overlay. Read mode stays pass-through
  // so page turns and PDF gestures are not stolen. Box uses its own marquee.
  const textSelectMode =
    !viewerLocked &&
    !linking.active &&
    !pdfInkMode &&
    !highlightMode &&
    (tool === 'select' || tool === 'underline' || tool === 'strikethrough');
  const [draft, setDraft] = useState<Rect | null>(null);
  const draftRef = useRef<Rect | null>(null);
  const [popover, setPopover] = useState<{
    rect: Rect;
    rects: Rect[];
    page: number;
    text: string;
  } | null>(null);
  const [retryingOcr, setRetryingOcr] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [passwordPrompt, setPasswordPrompt] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState('');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [importingTextLayer, setImportingTextLayer] = useState(false);
  const [gotoDraft, setGotoDraft] = useState('');
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const pdfCaptureRef = useRef<View>(null);
  const scanCancelRef = useRef(false);
  const scanRunningRef = useRef(false);
  const ocrTried = useRef<Set<number>>(new Set());
  const pdfStrokeRef = useRef<Stroke | null>(null);
  const [livePdfPoints, setLivePdfPoints] = useState('');

  /**
   * Background full-doc scanner: a small pool of offscreen PDF renderers
   * ("lanes") each independently seek to a page, screenshot it, and hand the
   * image off to the recognition pool. Page rendering — not the OCR network
   * call — is the real bottleneck on a 500+ page document, so parallelizing
   * it across lanes (rather than one page at a time) is what makes a large
   * scan fast.
   */
  const MAX_SCAN_LANES = 3;
  const laneRefsRef = useRef<Array<React.RefObject<View>>>();
  if (!laneRefsRef.current) {
    laneRefsRef.current = Array.from({ length: MAX_SCAN_LANES }, () => React.createRef<View>());
  }
  const laneRefs = laneRefsRef.current;
  const [laneRenderPages, setLaneRenderPages] = useState<number[]>(() => Array(MAX_SCAN_LANES).fill(1));
  const laneWaiters = useRef<Map<number, { page: number; resolve: (confirmed: boolean) => void }>>(new Map());

  const setLaneRenderPage = (lane: number, page: number) => {
    setLaneRenderPages((prev) => {
      if (prev[lane] === page) return prev;
      const next = prev.slice();
      next[lane] = page;
      return next;
    });
  };

  /** Resolves true once the lane confirms it rendered `page`, false on timeout (triggers a retry). */
  const waitForLaneRender = (lane: number, page: number, timeoutMs = 4000) =>
    new Promise<boolean>((resolve) => {
      let done = false;
      const finish = (confirmed: boolean) => {
        if (done) return;
        done = true;
        laneWaiters.current.delete(lane);
        resolve(confirmed);
      };
      laneWaiters.current.set(lane, { page, resolve: finish });
      setTimeout(() => finish(false), timeoutMs);
    });

  const waitWhilePaused = async () => {
    while (useStore.getState().ocr.scanPaused && !scanCancelRef.current) {
      await new Promise((r) => setTimeout(r, 250));
    }
  };

  // iOS suspends JS timers/work in the background, so a long scan would
  // otherwise stall mid-page with no visible reason. Auto-pause on background
  // and resume on foreground — but only if this listener (not the user) was
  // the one that paused it, so a manual pause survives backgrounding.
  const autoPausedForBackgroundRef = useRef(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const st = useStore.getState();
      if (!st.ocr.scanning) return;
      if (next === 'background' || next === 'inactive') {
        if (!st.ocr.scanPaused) {
          autoPausedForBackgroundRef.current = true;
          setOcrScanPaused(true);
        }
      } else if (next === 'active' && autoPausedForBackgroundRef.current) {
        autoPausedForBackgroundRef.current = false;
        setOcrScanPaused(false);
      }
    });
    return () => sub.remove();
  }, [setOcrScanPaused]);

  // Reset unlock state when the document changes
  useEffect(() => {
    setPdfPassword('');
    setPasswordDraft('');
    setPasswordPrompt(false);
    setPdfError(null);
  }, [docUri, setOcrScanPaused, setOcrScanning]);

  // Auto-OCR once per page (optional). Runs on the visible page even while a
  // background full-doc scan is using a separate offscreen capture.
  useEffect(() => {
    if (!docUri || !autoOcr) return;
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
        setOcrPageFailed(page);
      }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docUri, currentPage, autoOcr]);

  // Cancel background scan only when switching documents (not on initial mount).
  const prevDocUriRef = useRef(docUri);
  const autoStartedForUriRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevDocUriRef.current === docUri) return;
    prevDocUriRef.current = docUri;
    autoStartedForUriRef.current = null;
    scanCancelRef.current = true;
    scanRunningRef.current = false;
    setOcrScanning(false);
    setOcrScanPaused(false);
  }, [docUri, setOcrScanPaused, setOcrScanning]);

  /** Import embedded PDF text when the file is already searchable — skips raster OCR. */
  const tryImportTextLayer = async (): Promise<boolean> => {
    if (!docUri) return false;
    const existing = useStore.getState().ocr;
    if (existing.source === 'text-layer' && Object.keys(existing.layouts).length > 0) {
      return true;
    }
    setImportingTextLayer(true);
    try {
      const probe = await probePdfTextLayer(docUri, { samplePages: 3 });
      if (!probe.searchable) return false;
      const imported = await importPdfTextLayer(docUri);
      setOcrLayoutsBulk(imported.pages, 'text-layer');
      Object.keys(imported.pages).forEach((k) => ocrTried.current.add(Number(k)));
      return true;
    } catch {
      return false;
    } finally {
      setImportingTextLayer(false);
    }
  };

  const scanDocument = async (opts?: { silent?: boolean }) => {
    const total = useStore.getState().numPages;
    if (!total || scanRunningRef.current) return;

    // Already have a full cache / text layer for this document — do not re-OCR.
    const existingLayouts = useStore.getState().ocr.layouts;
    const alreadyDone = Object.keys(existingLayouts).filter((k) => existingLayouts[Number(k)] != null).length;
    if (alreadyDone >= total) {
      return;
    }

    // Searchable / already-OCR’d PDFs: pull the text layer instead of raster OCR.
    const imported = await tryImportTextLayer();
    if (imported) {
      if (!opts?.silent) {
        Alert.alert('Text layer found', 'This PDF already has selectable text — OCR was skipped.');
      }
      return;
    }

    const cloud = preferCloudOcr && (await canUseCloudOcr());
    if (preferCloudOcr && !cloud && !opts?.silent) {
      Alert.alert(
        'Cloud OCR key needed',
        'Add an OCR.space API key in Settings → Advanced to scan faster in the cloud, or turn off Cloud OCR to use on-device recognition.',
      );
      return;
    }

    scanCancelRef.current = false;
    scanRunningRef.current = true;
    setOcrScanPaused(false);
    useStore.getState().resetOcrFailedPages();

    // Render lanes are the real speed lever on a large document — network
    // recognition concurrency is sized to match so it never becomes the
    // bottleneck once cloud OCR is in play.
    const lanes = cloud ? 3 : 2;
    const recognizeConcurrency = cloud ? 3 : 2;
    const captureWidth = cloud ? 900 : 1200;
    const settleMs = cloud ? 200 : 300;
    const MAX_ATTEMPTS = 3;

    setOcrScanning(true, { done: 0, total, current: null, engine: cloud ? 'cloud' : 'device' });

    const layoutsAtStart = useStore.getState().ocr.layouts;
    const queue: number[] = [];
    for (let pg = 1; pg <= total; pg++) {
      if (layoutsAtStart[pg] == null) queue.push(pg);
    }
    let completed = total - queue.length;
    const attemptCounts = new Map<number, number>();

    const bumpProgress = (current: number | null) => {
      setOcrScanning(true, { done: completed, total, current, engine: cloud ? 'cloud' : 'device' });
    };
    bumpProgress(null);

    const inflight: Promise<void>[] = [];
    const runRecognizePool = async (job: () => Promise<void>) => {
      const tracked = job().finally(() => {
        const i = inflight.indexOf(tracked);
        if (i >= 0) inflight.splice(i, 1);
      });
      inflight.push(tracked);
      if (inflight.length >= recognizeConcurrency) {
        await Promise.race(inflight);
      }
    };

    /** Marks a page as no longer pending — `failed` is tracked separately from "done with no text" so a scan never silently reports 100% while pages are unreadable. */
    const finishPage = (page: number, failed: boolean) => {
      completed += 1;
      ocrTried.current.add(page);
      if (failed) setOcrPageFailed(page);
      bumpProgress(null);
    };

    const laneWorker = async (lane: number) => {
      while (true) {
        if (scanCancelRef.current) return;
        await waitWhilePaused();
        if (scanCancelRef.current) return;
        const page = queue.shift();
        if (page == null) return;

        bumpProgress(page);
        setLaneRenderPage(lane, page);
        const confirmed = await waitForLaneRender(lane, page);
        if (scanCancelRef.current) return;
        await new Promise((r) => setTimeout(r, settleMs));
        if (scanCancelRef.current) return;

        const attempts = (attemptCounts.get(page) || 0) + 1;
        attemptCounts.set(page, attempts);

        // The renderer never confirmed it reached this page in time — likely
        // a slow native seek on a large document. Retry rather than risk
        // screenshotting a stale/wrong page.
        if (!confirmed && attempts < MAX_ATTEMPTS) {
          queue.push(page);
          continue;
        }

        const captured = await capturePageImage(laneRefs[lane], aspect, { width: captureWidth });
        if (!captured) {
          if (attempts < MAX_ATTEMPTS) {
            queue.push(page);
            continue;
          }
          finishPage(page, true);
          continue;
        }

        await runRecognizePool(async () => {
          try {
            const { data } = await recognizeCapturedAuto(captured, { preferCloud: cloud });
            if (scanCancelRef.current) return;
            if (!data.text.trim() && !data.blocks.length && attempts < MAX_ATTEMPTS) {
              queue.push(page);
              return;
            }
            setOcrPageData(page, data);
            finishPage(page, false);
          } catch {
            if (scanCancelRef.current) return;
            if (attempts < MAX_ATTEMPTS) {
              queue.push(page);
            } else {
              finishPage(page, true);
            }
          }
        });
      }
    };

    try {
      await Promise.all(Array.from({ length: lanes }, (_, lane) => laneWorker(lane)));
      if (inflight.length) await Promise.all(inflight);
    } finally {
      scanRunningRef.current = false;
      const cancelled = scanCancelRef.current;
      setOcrScanning(false);
      setOcrScanPaused(false);
      scanCancelRef.current = false;

      if (!cancelled) {
        const failedCount = useStore.getState().ocr.failedPages.length;
        // OCR text is for selection/search only — nothing is pushed to the canvas.
        if (!opts?.silent && failedCount) {
          Alert.alert(
            'Scan finished with some gaps',
            `${failedCount} page${failedCount === 1 ? '' : 's'} could not be read after retries. Use "Retry unreadable pages" to try again.`,
          );
        }
      }
    }
  };

  const cancelScan = () => {
    scanCancelRef.current = true;
    setOcrScanPaused(false);
    setOcrScanning(false);
  };

  const toggleScanPause = () => {
    if (!ocr.scanning) return;
    setOcrScanPaused(!ocr.scanPaused);
  };

  const retryFailedPages = () => {
    if (ocr.scanning || !ocr.failedPages.length) return;
    void scanDocument({ silent: false });
  };

  // Auto-OCR when a document finishes loading — gated by Settings / reader toggle.
  useEffect(() => {
    if (!docUri || !numPages || passwordPrompt || pdfError) return;
    if (!autoOcr) return;
    if (scanRunningRef.current || ocr.scanning || importingTextLayer) return;
    if (autoStartedForUriRef.current === docUri) return;

    const state = useStore.getState();
    const layouts = state.ocr.layouts;
    const alreadyDone = Object.keys(layouts).filter((k) => layouts[Number(k)] != null).length;
    if (alreadyDone >= numPages) {
      autoStartedForUriRef.current = docUri;
      return;
    }

    autoStartedForUriRef.current = docUri;
    const t = setTimeout(() => {
      void scanDocument({ silent: true });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docUri, numPages, passwordPrompt, pdfError, preferCloudOcr, autoOcr]);

  const disableAutoOcr = () => {
    setAutoOcr(false);
    if (ocr.scanning) {
      scanCancelRef.current = true;
      setOcrScanPaused(false);
      setOcrScanning(false);
    }
  };

  const enableAutoOcr = () => {
    setAutoOcr(true);
    // Allow the auto-start effect (or an immediate scan) to run again.
    autoStartedForUriRef.current = null;
    if (docUri && numPages && !scanRunningRef.current) {
      autoStartedForUriRef.current = docUri;
      void scanDocument({ silent: true });
    }
  };

  const retryPageOcr = async () => {
    const page = currentPage;
    setRetryingOcr(true);
    setOcrProcessingPage(page);
    try {
      const data = await recognizePage(pdfCaptureRef, aspect);
      setOcrPageData(page, data);
      useStore.getState().reanchorHighlightsForPage(page, useStore.getState().activeDocId || undefined, data);
    } catch {
      setOcrPageFailed(page);
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

  const effectiveAspect = pageRotation === 90 || pageRotation === 270 ? 1 / aspect : aspect;

  const frame = useMemo(() => {
    if (!container) return null;
    const cw = container.width;
    const ch = container.height;
    // Prefer filling the pane (tablet-first) while keeping page aspect, then apply zoom.
    let fh = ch;
    let fw = fh * effectiveAspect;
    if (fw > cw) {
      fw = cw;
      fh = fw / effectiveAspect;
    }
    const z = Math.min(4, Math.max(0.5, pdfZoom || 1));
    fw *= z;
    fh *= z;
    return { w: fw, h: fh, left: (cw - fw) / 2, top: (ch - fh) / 2 };
  }, [container, effectiveAspect, pdfZoom]);

  const markedPages = useMemo(() => {
    const set = new Set<number>();
    highlights.forEach((h) => set.add(h.page));
    return set;
  }, [highlights]);

  const pageTranslation = translations[currentPage];
  const showEnglishPane =
    translationView !== 'original' && !!pageTranslation?.english?.trim();

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
    // Skip a slow raster pass when Auto OCR is off — Text tool falls back to marquee.
    if (!useStore.getState().autoOcr && useStore.getState().ocr.source !== 'text-layer') {
      return null;
    }
    setOcrProcessingPage(currentPage);
    try {
      const data = await recognizePage(pdfCaptureRef, aspect);
      setOcrPageData(currentPage, data);
      return data.blocks.length ? data : null;
    } catch {
      setOcrPageFailed(currentPage);
      return null;
    }
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
      const result = await openPdf(uri, res.name || 'document.pdf');
      if (result?.deduped) {
        Alert.alert(
          'Already in library',
          'This file matches a document you already added (same content). Opening the existing copy.',
        );
      }
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
          const next = { x, y, w: 0, h: 0 };
          draftRef.current = next;
          setDraft(next);
        },
        onPanResponderMove: (evt) => {
          if (!startRef.current || !highlightMode) return;
          const x = evt.nativeEvent.locationX;
          const y = evt.nativeEvent.locationY;
          const sx = startRef.current.x;
          const sy = startRef.current.y;
          const next = {
            x: Math.min(sx, x),
            y: Math.min(sy, y),
            w: Math.abs(x - sx),
            h: Math.abs(y - sy),
          };
          draftRef.current = next;
          setDraft(next);
        },
        onPanResponderRelease: () => {
          const box = draftRef.current;
          if (!highlightMode || !frame || !box) {
            startRef.current = null;
            draftRef.current = null;
            setDraft(null);
            return;
          }
          if (box.w > 8 && box.h > 8) {
            const norm: Rect = {
              x: box.x / frame.w,
              y: box.y / frame.h,
              w: box.w / frame.w,
              h: box.h / frame.h,
            };
            const pageData = useStore.getState().ocr.layouts[currentPage];
            const hit = selectionFromMarquee(pageData, norm);
            const text = hit?.text?.trim() || textInside(pageData, norm) || '';
            setPopover({
              rect: hit?.rect || norm,
              rects: hit?.rects?.length ? hit.rects : [norm],
              page: currentPage,
              text,
            });
          }
          draftRef.current = null;
          setDraft(null);
          startRef.current = null;
        },
      }),
    // draft is read via draftRef so it must NOT be a dependency (stale closure bug).
    [highlightMode, linking, frame, highlights, currentPage, completeLink],
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
      originalText: v.originalText,
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

  const openReaderMore = () => {
    const buttons: Array<{
      text: string;
      style?: 'cancel' | 'destructive';
      onPress?: () => void;
    }> = [
      { text: 'Cancel', style: 'cancel' },
      {
        text: readingMode === 'scroll' ? 'Switch to page mode' : 'Continuous scroll',
        onPress: () => setReadingMode(readingMode === 'scroll' ? 'page' : 'scroll'),
      },
      { text: 'Rotate 90°', onPress: () => rotatePage(90) },
    ];
    if (pageTranslation?.english) {
      buttons.push({
        text:
          translationView === 'original'
            ? 'Show English (side)'
            : translationView === 'side'
              ? 'English only'
              : 'Original only',
        onPress: () =>
          setTranslationView(
            translationView === 'original'
              ? 'side'
              : translationView === 'side'
                ? 'english'
                : 'original',
          ),
      });
    }
    buttons.push({
      text: autoOcr ? 'Disable auto OCR' : 'Enable auto OCR',
      onPress: () => (autoOcr ? disableAutoOcr() : enableAutoOcr()),
    });
    if (ocr.failedPages.length) {
      buttons.push({
        text: `Retry ${ocr.failedPages.length} unreadable page(s)`,
        onPress: () => retryFailedPages(),
      });
    }
    Alert.alert('Reader options', undefined, buttons);
  };

  return (
    <View style={s.root}>
      {(ocr.scanning || importingTextLayer || (!!ocr.failedPages.length && !!docUri)) && (
        <View style={s.chromeWrap}>
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType={p.blurType}
            blurAmount={18}
            reducedTransparencyFallbackColor={p.surfaceGlass}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: p.glassTint }]} pointerEvents="none" />
          <View style={[s.readerChrome, embedded && s.readerChromeEmbed]}>
            {ocr.scanning && ocr.scanProgress ? (
              <View style={s.scanLive}>
                <View style={s.scanLiveMeta}>
                  <View
                    style={[
                      s.enginePill,
                      ocr.scanProgress.engine === 'cloud' ? s.engineCloud : s.engineDevice,
                    ]}>
                    {ocr.scanProgress.engine === 'cloud' ? (
                      <Cloud size={12} color={p.ai} strokeWidth={2.2} />
                    ) : (
                      <Cpu size={12} color={p.textMid} strokeWidth={2.2} />
                    )}
                    <Text
                      style={[
                        s.enginePillText,
                        { color: ocr.scanProgress.engine === 'cloud' ? p.ai : p.textMid },
                      ]}>
                      {ocr.scanPaused
                        ? 'Paused'
                        : ocr.scanProgress.engine === 'cloud'
                          ? 'Scanning'
                          : 'Scanning'}
                    </Text>
                  </View>
                  <Text style={s.scanCount}>
                    {ocr.scanProgress.done}/{ocr.scanProgress.total}
                  </Text>
                </View>
                <View style={s.scanActions}>
                  <TouchableOpacity style={s.iconBtn} onPress={toggleScanPause}>
                    {ocr.scanPaused ? (
                      <Play size={16} color={p.tint} strokeWidth={2.2} />
                    ) : (
                      <Pause size={16} color={p.tint} strokeWidth={2.2} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconBtn} onPress={cancelScan}>
                    <XIcon size={16} color={p.danger} strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {importingTextLayer ? (
              <View style={s.scanLive}>
                <ActivityIndicator size="small" color={p.tint} />
                <Text style={s.scanCount}>Reading text layer…</Text>
              </View>
            ) : null}

            {!ocr.scanning && !importingTextLayer && !!ocr.failedPages.length ? (
              <TouchableOpacity style={s.failedPill} onPress={retryFailedPages}>
                <AlertTriangle size={13} color={p.danger} strokeWidth={2.2} />
                <Text style={s.failedPillText}>{ocr.failedPages.length} unreadable · Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {ocr.scanning && ocr.scanProgress && ocr.scanProgress.total > 0 ? (
            <View style={s.progressTrack}>
              <View
                style={[
                  s.progressFill,
                  {
                    width: `${Math.min(100, (ocr.scanProgress.done / ocr.scanProgress.total) * 100)}%` as any,
                    backgroundColor: ocr.scanProgress.engine === 'cloud' ? p.ai : p.tint,
                  },
                ]}
              />
            </View>
          ) : null}
        </View>
      )}

      {!!docUri &&
        ocr.source !== 'text-layer' &&
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
            {readingMode === 'scroll' && container ? (
              <View style={{ flex: 1, width: '100%' }}>
                <Pdf
                  key={`pdf-scroll-${docUri}-${pdfPassword}`}
                  source={{ uri: docUri }}
                  fitPolicy={0}
                  scale={Math.min(4, Math.max(0.5, pdfZoom || 1))}
                  minScale={0.5}
                  maxScale={4}
                  spacing={10}
                  enablePaging={false}
                  horizontal={false}
                  password={pdfPassword || undefined}
                  style={{ flex: 1, width: container.width, backgroundColor: p.bg }}
                  onLoadComplete={(pages, _fp, dims) => {
                    setPdfError(null);
                    setPasswordPrompt(false);
                    setDocMeta(pages);
                    if (dims?.width && dims?.height) setAspect(dims.width / dims.height);
                  }}
                  onPageChanged={(page) => setCurrentPage(page)}
                  onError={(err: any) => {
                    const msg = String(err?.message || err || 'Could not open PDF');
                    if (/password|encrypted|protect/i.test(msg)) {
                      setPasswordPrompt(true);
                      setPdfError('This PDF is password-protected.');
                    } else {
                      setPdfError(msg);
                    }
                  }}
                />
                <View style={s.scrollHint} pointerEvents="none">
                  <Text style={s.scrollHintText}>Continuous scroll · switch to Page mode to annotate</Text>
                </View>
              </View>
            ) : null}

            {readingMode === 'page' && frame && (
              <View
                style={[
                  s.frame,
                  { width: frame.w, height: frame.h, left: frame.left, top: frame.top, zIndex: 1 },
                ]}>
                {/* Background scanner lanes sit under the visible page (same size) so
                    view-shot can capture pixels while the user keeps reading. Each
                    lane independently seeks pages so several render in parallel. */}
                {ocr.scanning && (
                  <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 0 }]}>
                    {Array.from({ length: ocr.scanProgress?.engine === 'cloud' ? 3 : 2 }).map((_, lane) => (
                      <View
                        key={`lane-${lane}`}
                        ref={laneRefs[lane]}
                        collapsable={false}
                        style={StyleSheet.absoluteFill}>
                        <Pdf
                          key={`scan-pdf-${lane}-${docUri}-${pdfPassword}`}
                          source={{ uri: docUri }}
                          page={laneRenderPages[lane]}
                          singlePage
                          fitPolicy={0}
                          scale={1}
                          minScale={1}
                          maxScale={1}
                          spacing={0}
                          enablePaging
                          password={pdfPassword || undefined}
                          style={s.pdf}
                          onPageChanged={(page) => {
                            const w = laneWaiters.current.get(lane);
                            if (w && w.page === page) w.resolve(true);
                          }}
                          onError={() => {
                            /* ignore — visible reader has its own error handling */
                          }}
                        />
                      </View>
                    ))}
                  </View>
                )}
                <View
                  ref={pdfCaptureRef}
                  collapsable={false}
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      zIndex: 1,
                      backgroundColor: p.pdfPage,
                      overflow: 'hidden',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  ]}>
                  <View
                    style={{
                      width: pageRotation === 90 || pageRotation === 270 ? frame.h : frame.w,
                      height: pageRotation === 90 || pageRotation === 270 ? frame.w : frame.h,
                      transform: [{ rotate: `${pageRotation}deg` }],
                    }}>
                    <Pdf
                      key={`pdf-${docUri}-${pdfPassword}-${pageRotation}`}
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
                </View>

                {(ocr.scanning &&
                  !ocr.scanPaused &&
                  ocr.scanProgress?.current != null &&
                  ocr.scanProgress.current === currentPage) && (
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
                                top: top - height * 0.08,
                                width,
                                height: height * 1.16,
                                backgroundColor: cs.soft,
                                borderRadius: 1,
                                borderWidth: isFlash ? 1.5 : 0,
                                borderColor: isFlash ? cs.color : 'transparent',
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
                {frame && textSelectMode && pageRotation === 0 && (
                  <TextSelectOverlay
                    key={`sel-${currentPage}-${popover ? 'sheet' : 'live'}`}
                    enabled={textSelectMode && !popover}
                    frame={frame}
                    pageData={ocr.layouts[currentPage]}
                    ensuringOcr={selecting}
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

                {showEnglishPane && (
                  <ScrollView
                    style={[
                      s.englishPane,
                      translationView === 'english' ? StyleSheet.absoluteFillObject : s.englishPaneHalf,
                    ]}
                    contentContainerStyle={s.englishPaneContent}>
                    <Text style={s.englishLabel}>
                      English · {pageTranslation?.quality || '—'}
                      {pageTranslation?.script ? ` · ${pageTranslation.script}` : ''}
                    </Text>
                    <Text style={s.englishBody}>{pageTranslation?.english}</Text>
                  </ScrollView>
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
                Add a judgment PDF from the sidebar, or open one here. Use Text or Box on the
                toolbar to select a passage, then Highlight to send it to the canvas. Pen draws with
                Finger mode on by default.
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
        <View style={s.dock}>
          <View style={s.pager}>
            <TouchableOpacity
              accessibilityLabel="Previous page"
              style={s.pageBtn}
              onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}>
              <ChevronLeft size={20} color={p.text} strokeWidth={2} />
            </TouchableOpacity>
            <View style={s.pageMeta}>
              <TextInput
                style={s.pageLabel}
                value={gotoDraft || String(currentPage)}
                onFocus={() => setGotoDraft(String(currentPage))}
                onChangeText={setGotoDraft}
                onBlur={() => setGotoDraft('')}
                keyboardType="number-pad"
                returnKeyType="go"
                selectTextOnFocus
                onSubmitEditing={() => {
                  const n = Math.max(1, Math.min(numPages || 1, parseInt(gotoDraft, 10) || 0));
                  if (n) setCurrentPage(n);
                  setGotoDraft('');
                }}
              />
              <Text style={s.pageOf}>/ {numPages || '—'}</Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Next page"
              style={s.pageBtn}
              onPress={() => setCurrentPage(Math.min(numPages || currentPage + 1, currentPage + 1))}>
              <ChevronRight size={20} color={p.text} strokeWidth={2} />
            </TouchableOpacity>

            <View style={s.dockSep} />

            <TouchableOpacity
              style={s.quietBtn}
              onPress={() => setPdfZoom(Math.max(0.5, +(pdfZoom - 0.25).toFixed(2)))}
              accessibilityLabel="Zoom out">
              <Text style={s.quietBtnText}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.quietBtn} onPress={() => setPdfZoom(1)} accessibilityLabel="Fit page">
              <Text style={s.quietBtnText}>{Math.round(pdfZoom * 100)}%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.quietBtn}
              onPress={() => setPdfZoom(Math.min(4, +(pdfZoom + 0.25).toFixed(2)))}
              accessibilityLabel="Zoom in">
              <Text style={s.quietBtnText}>+</Text>
            </TouchableOpacity>

            <View style={s.dockSep} />

            <TouchableOpacity
              style={[s.quietBtn, readingMode === 'scroll' && s.modeOn]}
              onPress={() => setReadingMode(readingMode === 'scroll' ? 'page' : 'scroll')}
              accessibilityLabel="Toggle scroll mode">
              {readingMode === 'scroll' ? (
                <Rows3 size={16} color={p.tint} strokeWidth={2.1} />
              ) : (
                <Square size={15} color={p.textMid} strokeWidth={2.1} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.quietBtn} onPress={() => rotatePage(90)} accessibilityLabel="Rotate">
              <RotateCw size={15} color={p.textMid} strokeWidth={2.1} />
            </TouchableOpacity>
            <TouchableOpacity style={s.quietBtn} onPress={openReaderMore} accessibilityLabel="Reader options">
              <MoreHorizontal size={18} color={p.textMid} strokeWidth={2.1} />
            </TouchableOpacity>
          </View>
          {numPages > 1 ? (
            <PdfThumbStrip
              docUri={docUri}
              numPages={numPages}
              currentPage={currentPage}
              password={pdfPassword}
              markedPages={markedPages}
              onSelectPage={(pg) => {
                setCurrentPage(pg);
                if (readingMode === 'scroll') setReadingMode('page');
              }}
            />
          ) : null}
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
    root: { flex: 1, backgroundColor: p.paperDesk, position: 'relative' },
    chromeWrap: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.separator,
      overflow: 'hidden',
    },
    readerChrome: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
      gap: 10,
      minHeight: 40,
    },
    readerChromeEmbed: {
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    failedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: RADIUS.pill,
      backgroundColor: 'rgba(255,59,48,0.12)',
    },
    failedPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: p.danger,
    },
    scanLive: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    scanLiveMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    enginePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: RADIUS.pill,
    },
    engineCloud: { backgroundColor: p.aiSoft },
    engineDevice: { backgroundColor: p.fillSecondary },
    enginePillText: { fontSize: 12, fontWeight: '700' },
    scanCount: {
      fontSize: 13,
      fontWeight: '600',
      color: p.text,
      fontVariant: ['tabular-nums'],
    },
    scanActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.fillSecondary,
    },
    progressTrack: {
      height: 3,
      backgroundColor: p.fillSecondary,
    },
    progressFill: {
      height: 3,
      borderRadius: 2,
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
    stage: { flex: 1, position: 'relative', backgroundColor: p.paperDesk },
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
      borderRadius: 4,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
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
    dock: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: p.separator,
      backgroundColor: p.grouped,
      paddingTop: 6,
      paddingBottom: 8,
      gap: 4,
    },
    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingHorizontal: 10,
      minHeight: 40,
    },
    pageBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
    },
    pageMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minWidth: 72,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    pageLabel: {
      fontSize: 15,
      color: p.text,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
      minWidth: 28,
      padding: 0,
    },
    pageOf: {
      fontSize: 13,
      color: p.textMuted,
      fontWeight: '500',
      fontVariant: ['tabular-nums'],
    },
    dockSep: {
      width: StyleSheet.hairlineWidth,
      height: 18,
      backgroundColor: p.separator,
      marginHorizontal: 6,
    },
    quietBtn: {
      minWidth: 32,
      height: 32,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
    },
    quietBtnText: { fontSize: 13, fontWeight: '600', color: p.textMid, fontVariant: ['tabular-nums'] },
    modeOn: { backgroundColor: p.tintSoft },
    scrollHint: {
      position: 'absolute',
      bottom: 12,
      alignSelf: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: RADIUS.pill,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    scrollHintText: { color: '#fff', fontSize: 11, fontWeight: '500' },
    englishPane: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: '46%',
      backgroundColor: p.grouped,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: p.separator,
      zIndex: 30,
      opacity: 0.97,
    },
    englishPaneHalf: {},
    englishPaneContent: { padding: 12, paddingBottom: 40 },
    englishLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: p.tint,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    englishBody: { fontSize: 14, lineHeight: 21, color: p.text, fontFamily: SERIF },
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
