import { create } from 'zustand';
import {
  loadWorkspace,
  saveWorkspaceDebounced,
  clearWorkspace,
  persistPdf,
  getSetting,
  setSetting,
  migrateLegacyWorkspaceIfNeeded,
  loadProjectIndex,
  setActiveProject,
  createProjectWorkspace,
  deleteProjectWorkspace,
  renameProjectMeta,
  type Persisted,
  type ProjectMeta,
} from './storage';
import {
  CATEGORIES,
  type CategoryKey,
  type CustomCategory,
  CUSTOM_CATEGORY_PALETTE,
  setExtraCategories,
} from './theme';
import type { ResearchResult } from './research/researchCore';
import type { OcrPageData } from './services/ocrService';
import { setCloudOcrEnabled } from './services/cloudOcrService';
import { reanchorText } from './services/reanchor';
import { unionRects } from './services/textSelection';
import { hashFileSha256, fileByteSize } from './services/contentHash';

/** Default footprint used when a group node hasn't been resized yet (matches GroupCard's defaults). */
const GROUP_DEFAULT_W = 280;
const GROUP_DEFAULT_H = 180;
/** Board units per grid cell — matches CanvasBoard's DotGrid spacing. */
const GRID_STEP = 26;

export type Rect = { x: number; y: number; w: number; h: number };

export type MarkStyle = 'highlight' | 'underline' | 'strikethrough';

export type Highlight = {
  id: string;
  page: number;
  /** Union bounds used for navigation and compatibility with older workspaces. */
  rect: Rect;
  /** Per-line OCR bounds so multi-line passages highlight text, not whitespace. */
  rects?: Rect[];
  text: string;
  /** Source language text before translation (when translate was used). */
  originalText?: string;
  category: CategoryKey;
  note: string;
  docId?: string;
  /** Visual mark on the PDF (default highlight fill). */
  markStyle?: MarkStyle;
  /** Freeform tags for filtering / export. */
  tags?: string[];
  /**
   * 'exact' = rects came directly from the OCR pass that was live when the
   * highlight was created. 'approximate' = rects were recovered by fuzzy
   * text-matching after a later OCR retry moved things around (see
   * reanchorHighlightsForPage) — shown to the user as a trust indicator.
   */
  anchorStatus?: 'exact' | 'approximate';
};

export type ExcerptData = {
  text: string;
  /** Pre-translation text kept for fidelity / search. */
  originalText?: string;
  page: number;
  category: CategoryKey;
  note: string;
  highlightId: string;
  docName: string;
  docId?: string;
  tags?: string[];
};

export type AiData = { heading: string; body: string; citations: string[] };

/** Freeform synthesis note — optionally cites a highlight/page for evidence. */
export type NoteData = {
  text: string;
  page?: number | null;
  highlightId?: string;
  docName?: string;
  docId?: string;
};

export type GroupData = {
  title: string;
  /** Accent color for the section chrome (hex). */
  color?: string;
  /** When true, member cards are hidden and the box collapses to the title bar. */
  collapsed?: boolean;
};

export type FlowNode = {
  id: string;
  type: 'excerpt' | 'ai' | 'note' | 'group';
  x: number;
  y: number;
  /** Freeform size — optional for legacy workspaces. */
  w?: number;
  h?: number;
  /** Paint / stack order — higher draws on top. */
  z?: number;
  /** Containing group node id, when this card sits inside a group box. */
  groupId?: string;
  data: ExcerptData | AiData | NoteData | GroupData;
};

/** Typed mind-map / argument relations (PRD 4.9). */
export type EdgeRelation =
  | 'supports'
  | 'contradicts'
  | 'relies_on'
  | 'distinguishes'
  | 'related';

export const EDGE_RELATIONS: Array<{ key: EdgeRelation; label: string; color: string }> = [
  { key: 'supports', label: 'Supports', color: '#27AE60' },
  { key: 'contradicts', label: 'Contradicts', color: '#C0392B' },
  { key: 'relies_on', label: 'Relies on', color: '#2980B9' },
  { key: 'distinguishes', label: 'Distinguishes', color: '#8E44AD' },
  { key: 'related', label: 'Related', color: '#7F8C8D' },
];

export type Edge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  relation?: EdgeRelation;
};

export type LinearNoteBlock = {
  id: string;
  /** Markdown body (bold/italic/headings/lists). */
  text: string;
  page?: number | null;
  createdAt: number;
};

export type Stroke = {
  id: string;
  color: number;
  width: number;
  points: Array<{ x: number; y: number }>;
  /** When set, points are normalized 0–1 on this PDF page (not canvas board). */
  pdfPage?: number;
};

export type InkLink = {
  id: string;
  canvasPoint: { x: number; y: number };
  highlightId?: string;
  page?: number;
  x?: number;
  y?: number;
};

export type FlashTarget =
  | { type: 'highlight'; id: string; page: number }
  | { type: 'page'; page: number }
  | null;

export type Linking = {
  active: boolean;
  step: 'canvas' | 'pdf' | null;
  inkPoint: { x: number; y: number } | null;
};

export type OcrSource = 'none' | 'raster' | 'text-layer' | 'cache';

export type OcrDocCache = {
  pages: Record<number, string>;
  layouts: Record<number, OcrPageData>;
  failedPages: number[];
  source?: OcrSource;
};

export type OcrState = {
  pages: Record<number, string>;
  layouts: Record<number, OcrPageData>;
  processingPage: number | null;
  /** Full-doc OCR running in the background (user can keep reading). */
  scanning: boolean;
  scanPaused: boolean;
  /** Pages completed vs total; `current` is the page being captured offscreen. */
  scanProgress: { done: number; total: number; current: number | null; engine?: 'cloud' | 'device' | null } | null;
  /**
   * Pages where capture/recognition failed after retries — distinct from a
   * page that was genuinely blank. Kept separate from `layouts` so a scan
   * never silently reports 100% while some pages have no text.
   */
  failedPages: number[];
  /**
   * How the active document's text was obtained — used to skip re-OCR for
   * searchable PDFs and to show the right reader chrome.
   */
  source: OcrSource;
};

export type BookmarkSectionKey = 'index' | 'dates' | 'synopsis' | 'issues' | 'annexures';

export type Bookmark = {
  id: string;
  section: BookmarkSectionKey;
  title: string;
  note: string;
  page: number | null;
  /** Optional end of a page range (e.g. an annexure spanning pp. 201–215). */
  endPage?: number | null;
  date: string;
  order: number;
  /** Nested court-index parent (same section). */
  parentId?: string | null;
};

type ResearchState = {
  status: 'idle' | 'loading' | 'done';
  query: string;
  result: ResearchResult | null;
  error: string | null;
  mode: 'offline' | 'live';
};

/** One undo/redo checkpoint — the structural canvas state (not ink, which has its own undo). */
type CanvasSnapshot = { nodes: FlowNode[]; edges: Edge[] };
type HistoryState = { past: CanvasSnapshot[]; future: CanvasSnapshot[] };
const emptyHistory: HistoryState = { past: [], future: [] };

let dropCounter = 0;

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Debounce window that batches a typing pause into one undo checkpoint. */
const TEXT_EDIT_HISTORY_MS = 700;
let textEditHistoryArmed = false;
let textEditHistoryTimer: ReturnType<typeof setTimeout> | null = null;

function armTextEditHistory(commit: () => void) {
  if (!textEditHistoryArmed) {
    commit();
    textEditHistoryArmed = true;
  }
  if (textEditHistoryTimer) clearTimeout(textEditHistoryTimer);
  textEditHistoryTimer = setTimeout(() => {
    textEditHistoryArmed = false;
    textEditHistoryTimer = null;
  }, TEXT_EDIT_HISTORY_MS);
}

function resetTextEditHistoryGate() {
  textEditHistoryArmed = false;
  if (textEditHistoryTimer) {
    clearTimeout(textEditHistoryTimer);
    textEditHistoryTimer = null;
  }
}

function slugKey(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32);
  return base || `custom_${Date.now().toString(36)}`;
}

export type LibraryDoc = {
  id: string;
  name: string;
  uri: string;
  /** SHA-256 of file bytes for de-duplication (PRD 4.1). */
  contentHash?: string;
  byteSize?: number;
  pageCount?: number;
  lastOpenedAt?: number;
  /** Library tags (PRD 4.12). */
  tags?: string[];
};

export type ReadingMode = 'page' | 'scroll';
export type PageRotation = 0 | 90 | 180 | 270;

export type PageTranslation = {
  page: number;
  original: string;
  english: string;
  script: string;
  quality: 'high' | 'medium' | 'low';
};

export type DocBoard = { x: number; y: number; w: number; h: number };

export const DEFAULT_DOC_BOARD: DocBoard = { x: 36, y: 36, w: 460, h: 640 };

type StoreState = {
  hydrated: boolean;
  view: 'library' | 'workspace';
  projects: ProjectMeta[];
  projectId: string | null;
  projectTitle: string;
  autoOcr: boolean;
  setAutoOcr: (v: boolean) => void;
  /** Prefer OCR.space cloud recognition when a key is configured. */
  preferCloudOcr: boolean;
  setPreferCloudOcr: (v: boolean) => void;
  clearInMemory: () => void;
  docName: string;
  docUri: string;
  activeDocId: string;
  library: LibraryDoc[];
  /** Per-document OCR so reopening / switching docs does not wipe progress. */
  ocrByDocId: Record<string, OcrDocCache>;
  numPages: number;
  currentPage: number;
  highlights: Highlight[];
  nodes: FlowNode[];
  edges: Edge[];
  ink: { strokes: Stroke[]; links: InkLink[] };
  threadsOn: boolean;
  hoverNodeId: string | null;
  flashTarget: FlashTarget;
  linking: Linking;
  research: ResearchState;
  ocr: OcrState;
  bookmarks: Bookmark[];
  docBoard: DocBoard;
  setDocBoard: (b: Partial<DocBoard>) => void;
  /** Linear notes (PRD 4.2) — preserved when switching to Canvas mode. */
  linearNotes: LinearNoteBlock[];
  rightPaneMode: 'canvas' | 'notes';
  setRightPaneMode: (mode: 'canvas' | 'notes') => void;
  addLinearNote: (text?: string, page?: number | null) => LinearNoteBlock;
  updateLinearNote: (id: string, patch: Partial<Pick<LinearNoteBlock, 'text' | 'page'>>) => void;
  removeLinearNote: (id: string) => void;
  /** Drop a linear note onto the canvas as a Note card (keeps page cite). */
  sendLinearNoteToCanvas: (id: string) => FlowNode | null;
  /** Pull a canvas note/excerpt into the linear outline. */
  pullNodeToLinear: (nodeId: string) => LinearNoteBlock | null;

  /** Matter-specific categories beyond the built-in judgment taxonomy. */
  customCategories: CustomCategory[];
  addCustomCategory: (label: string, color?: string, soft?: string) => CustomCategory;
  removeCustomCategory: (key: string) => void;
  updateCustomCategory: (key: string, patch: Partial<Pick<CustomCategory, 'label' | 'color' | 'soft'>>) => void;

  /** Multi-select on the freeform canvas. */
  selectedNodeIds: string[];
  setSelectedNodeIds: (ids: string[]) => void;
  toggleNodeSelected: (id: string, additive?: boolean) => void;
  clearSelection: () => void;
  selectNodesInRect: (rect: { x: number; y: number; w: number; h: number }) => void;
  removeSelectedNodes: () => void;
  moveNodesBy: (ids: string[], dx: number, dy: number) => void;
  setSelectedCategory: (category: CategoryKey) => void;
  setSelectedGroupColor: (color: string) => void;
  /** PDF reader zoom multiplier (1 = baseline fit-in-pane). */
  pdfZoom: number;
  setPdfZoom: (z: number) => void;
  readingMode: ReadingMode;
  setReadingMode: (m: ReadingMode) => void;
  pageRotation: PageRotation;
  rotatePage: (delta: 90 | -90) => void;
  setPageRotation: (r: PageRotation) => void;
  /** Per-page English translations (PRD 4.8). */
  translations: Record<number, PageTranslation>;
  setTranslations: (t: Record<number, PageTranslation>) => void;
  translationView: 'original' | 'english' | 'side';
  setTranslationView: (v: 'original' | 'english' | 'side') => void;
  updateLibraryDoc: (id: string, patch: Partial<LibraryDoc>) => void;

  // absolute window geometry for cross-pane threads
  pdfFrame: { left: number; top: number; w: number; h: number } | null;
  canvasOrigin: { x: number; y: number };
  canvasTf: { s: number; tx: number; ty: number };
  canvasViewport: { w: number; h: number } | null;
  nodeSizes: Record<string, { w: number; h: number }>;
  /** Window-space anchor for excerpt citation badge (thread endpoint). */
  nodeAnchors: Record<string, { x: number; y: number }>;
  layoutEpoch: number;
  focusNodeId: string | null;
  setPdfFrame: (f: { left: number; top: number; w: number; h: number } | null) => void;
  setCanvasOrigin: (o: { x: number; y: number }) => void;
  setCanvasTf: (t: { s: number; tx: number; ty: number }) => void;
  setCanvasViewport: (v: { w: number; h: number } | null) => void;
  setNodeSize: (id: string, size: { w: number; h: number }) => void;
  setNodeAnchor: (id: string, anchor: { x: number; y: number }) => void;
  bumpLayoutEpoch: () => void;
  requestFocusNode: (id: string) => void;
  clearFocusNode: () => void;

  hydrate: () => Promise<void>;
  goToLibrary: () => Promise<void>;
  createProject: (title: string) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  renameProject: (id: string, title: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  openPdf: (
    uri: string,
    name: string,
    opts?: { forceNew?: boolean },
  ) => Promise<{ deduped?: boolean; id: string }>;
  selectLibraryDoc: (id: string) => void;
  setDocMeta: (numPages: number) => void;
  setCurrentPage: (page: number) => void;

  addHighlight: (h: Omit<Highlight, 'id'>) => Highlight;
  removeHighlight: (id: string) => void;
  /** Highlight + linked excerpt card; turns thread lines on when requested. */
  createLinkedExcerpt: (
    data: Omit<ExcerptData, 'highlightId'> & {
      rect: Rect;
      rects?: Rect[];
      enableThreads?: boolean;
      markStyle?: MarkStyle;
      tags?: string[];
      skipHistory?: boolean;
    },
  ) => { highlight: Highlight; node: FlowNode };

  nextDropPos: () => { x: number; y: number };
  addExcerptNode: (data: ExcerptData, opts?: { skipHistory?: boolean }) => FlowNode;
  addAiNode: (data: AiData) => FlowNode;
  addNoteNode: (text?: string, cite?: Partial<Omit<NoteData, 'text'>>) => FlowNode;
  addGroupNode: (title?: string) => FlowNode;
  updateNodeData: (id: string, data: Partial<ExcerptData | AiData | NoteData | GroupData>) => void;
  toggleGroupCollapsed: (id: string) => void;
  moveNode: (id: string, x: number, y: number) => void;
  resizeNode: (id: string, w: number, h: number) => void;
  bringNodeToFront: (id: string) => void;
  sendNodeToBack: (id: string) => void;
  removeNode: (id: string) => void;
  addEdge: (source: string, target: string, label?: string, relation?: EdgeRelation) => void;
  updateEdge: (id: string, patch: Partial<Pick<Edge, 'label' | 'relation'>>) => void;
  removeEdge: (id: string) => void;

  /** Assign / clear a card's containing group by testing its center against group bounds. */
  setNodeGroup: (id: string, groupId: string | null | undefined) => void;
  assignNodeGroupByPosition: (id: string) => void;

  snapToGrid: boolean;
  toggleSnapToGrid: () => void;

  /** Structural (nodes/edges) undo — separate from ink's own undoStroke. */
  history: HistoryState;
  commitHistory: () => void;
  undoCanvas: () => void;
  redoCanvas: () => void;

  /** Re-match a page's highlights against a freshly re-OCR'd layout (e.g. after a manual retry). */
  reanchorHighlightsForPage: (page: number, docId: string | undefined, pageData: OcrPageData) => void;

  addStroke: (stroke: Stroke) => void;
  undoStroke: () => void;
  eraseAt: (x: number, y: number, radius: number) => void;
  eraseAtPdf: (page: number, nx: number, ny: number, radius: number) => void;

  startInkLink: () => void;
  setInkLinkPoint: (p: { x: number; y: number }) => void;
  completeLink: (target: Partial<InkLink>) => void;
  cancelLink: () => void;

  jumpToHighlight: (id: string) => void;
  jumpToPage: (page: number) => void;
  clearFlash: () => void;

  toggleThreads: () => void;
  setHoverNodeId: (id: string | null) => void;
  setResearch: (patch: Partial<ResearchState>) => void;

  setOcrPageText: (page: number, text: string) => void;
  setOcrPageData: (page: number, data: OcrPageData) => void;
  /** Bulk-import layouts (e.g. embedded PDF text layer) and mark the source. */
  setOcrLayoutsBulk: (
    layouts: Record<number, OcrPageData>,
    source: 'raster' | 'text-layer' | 'cache',
  ) => void;
  setOcrPageFailed: (page: number) => void;
  resetOcrFailedPages: () => void;
  setOcrProcessingPage: (page: number | null) => void;
  setOcrScanning: (
    scanning: boolean,
    progress?: { done: number; total: number; current?: number | null; engine?: 'cloud' | 'device' | null } | null,
  ) => void;
  setOcrScanPaused: (paused: boolean) => void;

  addBookmark: (b: Omit<Bookmark, 'id' | 'order'>) => Bookmark;
  updateBookmark: (id: string, patch: Partial<Omit<Bookmark, 'id'>>) => void;
  removeBookmark: (id: string) => void;
  reorderBookmarks: (section: BookmarkSectionKey, orderedIds: string[]) => void;

  resetWorkspace: () => Promise<void>;
  /** Replace canvas layer from a shared project JSON (multi-device sync). */
  importCanvasBundle: (bundle: {
    highlights: Highlight[];
    nodes: FlowNode[];
    edges: Edge[];
    ink: { strokes: Stroke[]; links: InkLink[] };
    ocrPages?: Record<number, string>;
    bookmarks: Bookmark[];
    docName?: string;
    numPages?: number;
  }) => void;

  // Live collaboration: canvas state that syncs between peers (excludes the
  // device-local PDF file path + current page so each viewer keeps their reader).
  getSyncState: () => CanvasSync;
  applyRemoteSnapshot: (sync: CanvasSync) => void;
};

export type CanvasSync = {
  docName: string;
  numPages: number;
  highlights: Highlight[];
  nodes: FlowNode[];
  edges: Edge[];
  ink: { strokes: Stroke[]; links: InkLink[] };
  ocrPages: Record<number, string>;
  bookmarks: Bookmark[];
};

const emptyOcrState = (): OcrState => ({
  pages: {},
  layouts: {},
  processingPage: null,
  scanning: false,
  scanPaused: false,
  scanProgress: null,
  failedPages: [],
  source: 'none',
});

function cacheFromOcr(ocr: OcrState): OcrDocCache {
  return {
    pages: { ...ocr.pages },
    layouts: { ...ocr.layouts },
    failedPages: [...ocr.failedPages],
    source: ocr.source,
  };
}

function ocrFromCache(cache: OcrDocCache | undefined): OcrState {
  if (!cache) return emptyOcrState();
  const layoutCount = Object.keys(cache.layouts || {}).length;
  const cachedSource = cache.source && cache.source !== 'none' ? cache.source : 'cache';
  return {
    pages: { ...(cache.pages || {}) },
    layouts: { ...(cache.layouts || {}) },
    processingPage: null,
    scanning: false,
    scanPaused: false,
    scanProgress: null,
    failedPages: [...(cache.failedPages || [])],
    source: layoutCount ? cachedSource : 'none',
  };
}

function snapshot(s: StoreState): Persisted {
  const ocrByDocId = { ...s.ocrByDocId };
  if (s.activeDocId) {
    ocrByDocId[s.activeDocId] = cacheFromOcr(s.ocr);
  }
  return {
    docName: s.docName,
    docUri: s.docUri,
    activeDocId: s.activeDocId,
    numPages: s.numPages,
    currentPage: s.currentPage,
    library: s.library,
    highlights: s.highlights,
    nodes: s.nodes,
    edges: s.edges,
    ink: s.ink,
    ocrPages: s.ocr.pages,
    ocrLayouts: s.ocr.layouts,
    ocrByDocId,
    bookmarks: s.bookmarks,
    docBoard: s.docBoard,
    canvasTf: s.canvasTf,
    linearNotes: s.linearNotes,
    rightPaneMode: s.rightPaneMode,
    pdfZoom: s.pdfZoom,
    translations: s.translations,
    customCategories: s.customCategories,
  };
}

const emptyWorkspace = {
  docName: '',
  docUri: '',
  activeDocId: '',
  library: [] as LibraryDoc[],
  ocrByDocId: {} as Record<string, OcrDocCache>,
  numPages: 0,
  currentPage: 1,
  highlights: [] as Highlight[],
  nodes: [] as FlowNode[],
  edges: [] as Edge[],
  ink: { strokes: [] as Stroke[], links: [] as InkLink[] },
  ocr: emptyOcrState(),
  bookmarks: [] as Bookmark[],
  docBoard: { ...DEFAULT_DOC_BOARD },
  linearNotes: [] as LinearNoteBlock[],
  customCategories: [] as CustomCategory[],
  selectedNodeIds: [] as string[],
  rightPaneMode: 'canvas' as const,
  pdfZoom: 1,
  readingMode: 'page' as ReadingMode,
  pageRotation: 0 as PageRotation,
  translations: {} as Record<number, PageTranslation>,
  translationView: 'original' as const,
  canvasTf: { s: 1, tx: 20, ty: 20 },
  history: { ...emptyHistory },
};

function applyPersisted(data: Persisted) {
  const lib =
    data.library?.length
      ? data.library
      : data.docUri
        ? [{ id: data.activeDocId || 'legacy', name: data.docName || 'Document', uri: data.docUri }]
        : [];
  const active = lib.find((d) => d.id === data.activeDocId) || lib.find((d) => d.uri === data.docUri) || lib[0];
  const ocrByDocId: Record<string, OcrDocCache> = {};
  Object.entries(data.ocrByDocId || {}).forEach(([docId, cache]) => {
    ocrByDocId[docId] = {
      pages: cache.pages || {},
      layouts: cache.layouts || {},
      failedPages: cache.failedPages || [],
      source: cache.source,
    };
  });
  // Migrate legacy flat OCR into the active doc's cache.
  if (active?.id && !ocrByDocId[active.id] && (data.ocrLayouts || data.ocrPages)) {
    ocrByDocId[active.id] = {
      pages: data.ocrPages || {},
      layouts: data.ocrLayouts || {},
      failedPages: [],
    };
  }
  const activeCache = active?.id ? ocrByDocId[active.id] : undefined;
  return {
    docName: data.docName || '',
    docUri: data.docUri || '',
    activeDocId: active?.id || '',
    library: lib,
    ocrByDocId,
    numPages: data.numPages || 0,
    currentPage: data.currentPage && data.currentPage > 0 ? data.currentPage : 1,
    highlights: data.highlights || [],
    nodes: (data.nodes || []).filter((n: FlowNode) => n.type !== ('ink' as any)),
    edges: data.edges || [],
    ink: data.ink || { strokes: [], links: [] },
    ocr: ocrFromCache(activeCache),
    bookmarks: data.bookmarks || [],
    docBoard: data.docBoard && data.docBoard.w > 100 ? data.docBoard : { ...DEFAULT_DOC_BOARD },
    linearNotes: Array.isArray(data.linearNotes) ? data.linearNotes : [],
    customCategories: Array.isArray(data.customCategories) ? data.customCategories : [],
    selectedNodeIds: [] as string[],
    rightPaneMode: (data.rightPaneMode === 'notes' ? 'notes' : 'canvas') as 'canvas' | 'notes',
    pdfZoom:
      typeof data.pdfZoom === 'number' && data.pdfZoom >= 0.5 && data.pdfZoom <= 4
        ? data.pdfZoom
        : 1,
    translations: (data.translations || {}) as Record<number, PageTranslation>,
    translationView: 'original' as const,
    readingMode: 'page' as ReadingMode,
    pageRotation: 0 as PageRotation,
    canvasTf:
      data.canvasTf &&
      typeof data.canvasTf.s === 'number' &&
      data.canvasTf.s > 0.05 &&
      data.canvasTf.s <= 4
        ? data.canvasTf
        : { s: 1, tx: 20, ty: 20 },
    history: { ...emptyHistory },
  };
}

export const useStore = create<StoreState>((set, get) => ({
  hydrated: false,
  view: 'library',
  projects: [],
  projectId: null,
  projectTitle: '',
  autoOcr: true,
  preferCloudOcr: true,
  ...emptyWorkspace,
  threadsOn: true,
  snapToGrid: false,
  hoverNodeId: null,
  flashTarget: null,
  linking: { active: false, step: null, inkPoint: null },
  research: { status: 'idle', query: '', result: null, error: null, mode: 'offline' },
  pdfFrame: null,
  canvasOrigin: { x: 0, y: 0 },
  canvasTf: { s: 1, tx: 20, ty: 20 },
  canvasViewport: null,
  nodeSizes: {},
  nodeAnchors: {},
  layoutEpoch: 0,
  focusNodeId: null,

  setPdfFrame: (f) => set({ pdfFrame: f }),
  setDocBoard: (patch) => {
    set((s) => ({ docBoard: { ...s.docBoard, ...patch } }));
    saveWorkspaceDebounced(snapshot(get()));
  },
  setRightPaneMode: (mode) => {
    set({ rightPaneMode: mode });
    saveWorkspaceDebounced(snapshot(get()));
  },
  addLinearNote: (text = '', page = null) => {
    const block: LinearNoteBlock = {
      id: uid(),
      text,
      page: page ?? get().currentPage ?? null,
      createdAt: Date.now(),
    };
    set((s) => ({ linearNotes: [block, ...s.linearNotes] }));
    saveWorkspaceDebounced(snapshot(get()));
    return block;
  },
  updateLinearNote: (id, patch) => {
    set((s) => ({
      linearNotes: s.linearNotes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },
  removeLinearNote: (id) => {
    set((s) => ({ linearNotes: s.linearNotes.filter((n) => n.id !== id) }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  sendLinearNoteToCanvas: (id) => {
    const note = get().linearNotes.find((n) => n.id === id);
    if (!note) return null;
    return get().addNoteNode(note.text, {
      page: note.page ?? null,
      docName: get().docName || undefined,
      docId: get().activeDocId || undefined,
    });
  },

  pullNodeToLinear: (nodeId) => {
    const n = get().nodes.find((x) => x.id === nodeId);
    if (!n) return null;
    let text = '';
    let page: number | null = null;
    if (n.type === 'note') {
      const d = n.data as NoteData;
      text = d.text || '';
      page = d.page ?? null;
    } else if (n.type === 'excerpt') {
      const d = n.data as ExcerptData;
      text = d.note?.trim() ? `${d.text}\n\n_${d.note}_` : d.text;
      page = d.page;
    } else if (n.type === 'ai') {
      const d = n.data as AiData;
      text = `## ${d.heading}\n\n${d.body}`;
    } else if (n.type === 'group') {
      const d = n.data as GroupData;
      text = `# ${d.title || 'Section'}`;
    } else {
      return null;
    }
    if (!text.trim()) return null;
    return get().addLinearNote(text.trim(), page);
  },

  addCustomCategory: (label, color, soft) => {
    const trimmed = label.trim();
    if (!trimmed) {
      return { key: '', label: '', color: '#787774', soft: '#F1F1EF' };
    }
    let key = slugKey(trimmed);
    const existing = new Set([
      ...Object.keys(CATEGORIES),
      ...get().customCategories.map((c) => c.key),
    ]);
    if (existing.has(key)) key = `${key}_${Date.now().toString(36).slice(-4)}`;
    const tone = CUSTOM_CATEGORY_PALETTE[get().customCategories.length % CUSTOM_CATEGORY_PALETTE.length];
    const cat: CustomCategory = {
      key,
      label: trimmed,
      color: color || tone.color,
      soft: soft || tone.soft,
    };
    const next = [...get().customCategories, cat];
    set({ customCategories: next });
    setExtraCategories(next);
    saveWorkspaceDebounced(snapshot(get()));
    return cat;
  },

  removeCustomCategory: (key) => {
    const next = get().customCategories.filter((c) => c.key !== key);
    set({ customCategories: next });
    setExtraCategories(next);
    saveWorkspaceDebounced(snapshot(get()));
  },

  updateCustomCategory: (key, patch) => {
    const next = get().customCategories.map((c) => (c.key === key ? { ...c, ...patch } : c));
    set({ customCategories: next });
    setExtraCategories(next);
    saveWorkspaceDebounced(snapshot(get()));
  },

  setSelectedNodeIds: (ids) => set({ selectedNodeIds: [...new Set(ids)] }),
  toggleNodeSelected: (id, additive = false) => {
    set((s) => {
      if (!additive) {
        return { selectedNodeIds: s.selectedNodeIds.includes(id) && s.selectedNodeIds.length === 1 ? [] : [id] };
      }
      const has = s.selectedNodeIds.includes(id);
      return {
        selectedNodeIds: has
          ? s.selectedNodeIds.filter((x) => x !== id)
          : [...s.selectedNodeIds, id],
      };
    });
  },
  clearSelection: () => set({ selectedNodeIds: [] }),

  selectNodesInRect: (rect) => {
    const { nodes } = get();
    const x1 = Math.min(rect.x, rect.x + rect.w);
    const y1 = Math.min(rect.y, rect.y + rect.h);
    const x2 = Math.max(rect.x, rect.x + rect.w);
    const y2 = Math.max(rect.y, rect.y + rect.h);
    const ids = nodes
      .filter((n) => {
        if (n.type === 'group') {
          const g = n.data as GroupData;
          // Always allow selecting the group chrome itself.
          void g;
        }
        const w = n.w || (n.type === 'ai' ? 288 : n.type === 'group' ? GROUP_DEFAULT_W : 240);
        const h = n.h || (n.type === 'group' ? GROUP_DEFAULT_H : 140);
        const cx = n.x + w / 2;
        const cy = n.y + h / 2;
        return cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2;
      })
      .map((n) => n.id);
    set({ selectedNodeIds: ids });
  },

  removeSelectedNodes: () => {
    const ids = get().selectedNodeIds;
    if (!ids.length) return;
    get().commitHistory();
    resetTextEditHistoryGate();
    // Remove in one pass to avoid N history commits.
    const idSet = new Set(ids);
    const removed = get().nodes.filter((n) => idSet.has(n.id));
    const orphanHighlightIds = new Set(
      removed
        .filter((n) => n.type === 'excerpt')
        .map((n) => (n.data as ExcerptData).highlightId)
        .filter(Boolean),
    );
    set((s) => {
      let nodes = s.nodes.filter((n) => !idSet.has(n.id));
      // Detach children of deleted groups.
      for (const r of removed) {
        if (r.type === 'group') {
          nodes = nodes.map((n) => (n.groupId === r.id ? { ...n, groupId: undefined } : n));
        }
      }
      const highlights = s.highlights.filter((h) => {
        if (!orphanHighlightIds.has(h.id)) return true;
        return nodes.some(
          (n) => n.type === 'excerpt' && (n.data as ExcerptData).highlightId === h.id,
        );
      });
      return {
        nodes,
        highlights,
        edges: s.edges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)),
        selectedNodeIds: [],
        nodeSizes: Object.fromEntries(Object.entries(s.nodeSizes).filter(([id]) => !idSet.has(id))),
        nodeAnchors: Object.fromEntries(Object.entries(s.nodeAnchors).filter(([id]) => !idSet.has(id))),
      };
    });
    saveWorkspaceDebounced(snapshot(get()));
  },

  moveNodesBy: (ids, dx, dy) => {
    if (!ids.length || (!dx && !dy)) return;
    const idSet = new Set(ids);
    const snap = get().snapToGrid;
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (!idSet.has(n.id)) return n;
        let x = n.x + dx;
        let y = n.y + dy;
        if (snap) {
          x = Math.round(x / GRID_STEP) * GRID_STEP;
          y = Math.round(y / GRID_STEP) * GRID_STEP;
        }
        return { ...n, x, y };
      }),
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  setSelectedCategory: (category) => {
    const ids = get().selectedNodeIds;
    if (!ids.length) return;
    get().commitHistory();
    const idSet = new Set(ids);
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (!idSet.has(n.id) || n.type !== 'excerpt') return n;
        return { ...n, data: { ...(n.data as ExcerptData), category } };
      }),
      highlights: s.highlights.map((h) => {
        const linked = s.nodes.some(
          (n) =>
            idSet.has(n.id) &&
            n.type === 'excerpt' &&
            (n.data as ExcerptData).highlightId === h.id,
        );
        return linked ? { ...h, category } : h;
      }),
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  setSelectedGroupColor: (color) => {
    const ids = get().selectedNodeIds;
    if (!ids.length) return;
    get().commitHistory();
    const idSet = new Set(ids);
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (!idSet.has(n.id) || n.type !== 'group') return n;
        return { ...n, data: { ...(n.data as GroupData), color } };
      }),
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },
  setPdfZoom: (z) => {
    const zoom = Math.min(4, Math.max(0.5, Number.isFinite(z) ? z : 1));
    set({ pdfZoom: zoom });
    saveWorkspaceDebounced(snapshot(get()));
  },
  setReadingMode: (m) => set({ readingMode: m }),
  setPageRotation: (r) => set({ pageRotation: r }),
  rotatePage: (delta) => {
    const cur = get().pageRotation;
    const next = ((((cur + delta) % 360) + 360) % 360) as PageRotation;
    set({ pageRotation: next });
  },
  setTranslations: (t) => {
    set({ translations: t });
    saveWorkspaceDebounced(snapshot(get()));
  },
  setTranslationView: (v) => set({ translationView: v }),
  updateLibraryDoc: (id, patch) => {
    set((s) => ({
      library: s.library.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },
  setCanvasOrigin: (o) => set({ canvasOrigin: o }),
  setCanvasTf: (t) => {
    const prev = get().canvasTf;
    if (prev.s === t.s && prev.tx === t.tx && prev.ty === t.ty) return;
    set({ canvasTf: t });
    saveWorkspaceDebounced(snapshot(get()));
  },
  setCanvasViewport: (v) => set({ canvasViewport: v }),
  setNodeSize: (id, size) =>
    set((s) => {
      const prev = s.nodeSizes[id];
      if (prev?.w === size.w && prev?.h === size.h) return s;
      return { nodeSizes: { ...s.nodeSizes, [id]: size } };
    }),
  setNodeAnchor: (id, anchor) =>
    set((s) => {
      const prev = s.nodeAnchors[id];
      if (prev && prev.x === anchor.x && prev.y === anchor.y) return s;
      return { nodeAnchors: { ...s.nodeAnchors, [id]: anchor } };
    }),
  bumpLayoutEpoch: () => set((s) => ({ layoutEpoch: s.layoutEpoch + 1 })),
  requestFocusNode: (id) => set({ focusNodeId: id }),
  clearFocusNode: () => set({ focusNodeId: null }),

  hydrate: async () => {
    const autoOcrRaw = await getSetting('autoOcr');
    const preferCloudRaw = await getSetting('preferCloudOcr');
    // Default ON for scanned PDFs (PRD OCR pipeline) unless user turned it off.
    const index = await migrateLegacyWorkspaceIfNeeded();
    set({
      projects: index.projects,
      projectId: null,
      projectTitle: '',
      view: 'library',
      ...emptyWorkspace,
      autoOcr: autoOcrRaw !== '0',
      preferCloudOcr: preferCloudRaw !== '0',
      hydrated: true,
    });
  },

  goToLibrary: async () => {
    dropCounter = 0;
    await setActiveProject(null);
    const index = await loadProjectIndex();
    setExtraCategories([]);
    set({
      view: 'library',
      projects: index.projects,
      projectId: null,
      projectTitle: '',
      ...emptyWorkspace,
      flashTarget: null,
      linking: { active: false, step: null, inkPoint: null },
    });
  },

  createProject: async (title) => {
    const { meta, data } = await createProjectWorkspace(title);
    await setActiveProject(meta.id);
    const index = await loadProjectIndex();
    dropCounter = 0;
    const applied = applyPersisted(data);
    setExtraCategories(applied.customCategories || []);
    set({
      view: 'workspace',
      projects: index.projects,
      projectId: meta.id,
      projectTitle: meta.title,
      ...applied,
      flashTarget: null,
      linking: { active: false, step: null, inkPoint: null },
    });
  },

  openProject: async (id) => {
    await setActiveProject(id);
    const index = await loadProjectIndex();
    const meta = index.projects.find((p) => p.id === id);
    const data = await loadWorkspace();
    const nodes = data ? (data.nodes || []).filter((n: any) => n.type !== 'ink') : [];
    dropCounter = nodes.length;
    const applied = data ? applyPersisted(data) : emptyWorkspace;
    setExtraCategories(applied.customCategories || []);
    set({
      view: 'workspace',
      projects: index.projects,
      projectId: id,
      projectTitle: meta?.title || 'Project',
      ...applied,
      flashTarget: null,
      linking: { active: false, step: null, inkPoint: null },
    });
  },

  renameProject: async (id, title) => {
    await renameProjectMeta(id, title);
    const index = await loadProjectIndex();
    set({
      projects: index.projects,
      projectTitle: get().projectId === id ? title.trim() || get().projectTitle : get().projectTitle,
    });
  },

  deleteProject: async (id) => {
    await deleteProjectWorkspace(id);
    const index = await loadProjectIndex();
    if (get().projectId === id) {
      dropCounter = 0;
      set({
        view: 'library',
        projects: index.projects,
        projectId: null,
        projectTitle: '',
        ...emptyWorkspace,
      });
    } else {
      set({ projects: index.projects });
    }
  },

  setAutoOcr: (v) => {
    set({ autoOcr: v });
    setSetting('autoOcr', v ? '1' : '0').catch(() => {});
  },

  setPreferCloudOcr: (v) => {
    set({ preferCloudOcr: v });
    setSetting('preferCloudOcr', v ? '1' : '0').catch(() => {});
    void setCloudOcrEnabled(v);
  },

  clearInMemory: () => {
    dropCounter = 0;
    set({
      hydrated: false,
      view: 'library',
      projects: [],
      projectId: null,
      projectTitle: '',
      ...emptyWorkspace,
      flashTarget: null,
      linking: { active: false, step: null, inkPoint: null },
      research: { status: 'idle', query: '', result: null, error: null, mode: 'offline' },
    });
  },

  getSyncState: () => {
    const s = get();
    return {
      docName: s.docName,
      numPages: s.numPages,
      highlights: s.highlights,
      nodes: s.nodes,
      edges: s.edges,
      ink: s.ink,
      ocrPages: s.ocr.pages,
      bookmarks: s.bookmarks,
    };
  },

  applyRemoteSnapshot: (sync) => {
    set((s) => ({
      docName: sync.docName || s.docName,
      numPages: sync.numPages || s.numPages,
      highlights: sync.highlights || [],
      nodes: (sync.nodes || []).filter((n: FlowNode) => n.type !== ('ink' as any)),
      edges: sync.edges || [],
      ink: sync.ink || { strokes: [], links: [] },
      ocr: { ...s.ocr, pages: sync.ocrPages || {} },
      bookmarks: sync.bookmarks || [],
      history: { ...emptyHistory },
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  openPdf: async (uri, name, opts) => {
    let contentHash = '';
    let byteSize = 0;
    try {
      contentHash = await hashFileSha256(uri);
      byteSize = await fileByteSize(uri);
    } catch {
      /* hash optional on pick failures */
    }

    // De-dupe by content hash (PRD 4.1) unless caller forces a new copy.
    if (contentHash && !opts?.forceNew) {
      const byHash = get().library.find((d) => d.contentHash && d.contentHash === contentHash);
      if (byHash) {
        get().selectLibraryDoc(byHash.id);
        get().updateLibraryDoc(byHash.id, { lastOpenedAt: Date.now(), byteSize: byteSize || byHash.byteSize });
        return { deduped: true, id: byHash.id };
      }
    }

    const existing = get().library.find((d) => d.name === name);
    const id = existing?.id || uid();
    const stored = await persistPdf(uri, name, id);
    set((s) => {
      const ocrByDocId = { ...s.ocrByDocId };
      if (s.activeDocId && s.activeDocId !== id) {
        ocrByDocId[s.activeDocId] = cacheFromOcr(s.ocr);
      }
      const restored = ocrFromCache(ocrByDocId[id]);
      const meta = {
        contentHash: contentHash || existing?.contentHash,
        byteSize: byteSize || existing?.byteSize,
        lastOpenedAt: Date.now(),
        tags: existing?.tags || [],
      };
      if (existing) {
        return {
          library: s.library.map((d) => (d.id === existing.id ? { ...d, uri: stored, ...meta } : d)),
          activeDocId: existing.id,
          docName: name,
          docUri: stored,
          currentPage: 1,
          pageRotation: 0 as PageRotation,
          ocrByDocId,
          ocr: restored,
        };
      }
      const entry: LibraryDoc = { id, name, uri: stored, ...meta };
      return {
        library: [...s.library, entry],
        activeDocId: id,
        docName: name,
        docUri: stored,
        currentPage: 1,
        pageRotation: 0 as PageRotation,
        ocrByDocId,
        ocr: restored,
      };
    });
    saveWorkspaceDebounced(snapshot(get()));
    return { deduped: false, id };
  },

  selectLibraryDoc: (id) => {
    const doc = get().library.find((d) => d.id === id);
    if (!doc) return;
    set((s) => {
      const ocrByDocId = { ...s.ocrByDocId };
      if (s.activeDocId) {
        ocrByDocId[s.activeDocId] = cacheFromOcr(s.ocr);
      }
      return {
        activeDocId: doc.id,
        docName: doc.name,
        docUri: doc.uri,
        currentPage: 1,
        pageRotation: 0 as PageRotation,
        ocrByDocId,
        ocr: ocrFromCache(ocrByDocId[doc.id]),
        library: s.library.map((d) =>
          d.id === doc.id ? { ...d, lastOpenedAt: Date.now() } : d,
        ),
      };
    });
    saveWorkspaceDebounced(snapshot(get()));
  },

  setDocMeta: (numPages) => {
    const id = get().activeDocId;
    set((s) => ({
      numPages,
      library: id
        ? s.library.map((d) => (d.id === id ? { ...d, pageCount: numPages } : d))
        : s.library,
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  setCurrentPage: (page) => {
    set({ currentPage: page });
    saveWorkspaceDebounced(snapshot(get()));
  },

  addHighlight: (h) => {
    const highlight: Highlight = {
      id: uid(),
      ...h,
      docId: h.docId || get().activeDocId || undefined,
      anchorStatus: 'exact',
    };
    set((s) => ({ highlights: [...s.highlights, highlight] }));
    saveWorkspaceDebounced(snapshot(get()));
    return highlight;
  },

  removeHighlight: (id) => {
    set((s) => ({ highlights: s.highlights.filter((h) => h.id !== id) }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  createLinkedExcerpt: (data) => {
    const docId = data.docId || get().activeDocId || undefined;
    const tags = data.tags?.map((t) => t.trim()).filter(Boolean);
    const highlight = get().addHighlight({
      page: data.page,
      rect: data.rect,
      rects: data.rects,
      text: data.text,
      originalText: data.originalText,
      category: data.category,
      note: data.note,
      docId,
      markStyle: data.markStyle || 'highlight',
      tags,
    });
    const node = get().addExcerptNode(
      {
        text: data.text,
        originalText: data.originalText,
        page: data.page,
        category: data.category,
        note: data.note,
        highlightId: highlight.id,
        docName: data.docName,
        docId,
        tags,
      },
      { skipHistory: data.skipHistory },
    );
    if (data.enableThreads !== false && !get().threadsOn) get().toggleThreads();
    return { highlight, node };
  },

  nextDropPos: () => {
    const { nodes, canvasTf, canvasViewport } = get();
    const CARD_W = 248;
    const CARD_H = 160;
    // Place into the *visible* board area so new OCR cards feel freeform, not grid-locked.
    const vpW = canvasViewport?.w || 600;
    const vpH = canvasViewport?.h || 700;
    const s = Math.max(0.05, canvasTf.s);
    const viewLeft = -canvasTf.tx / s;
    const viewTop = -canvasTf.ty / s;
    const viewW = vpW / s;
    const viewH = vpH / s;
    const margin = 36;
    const baseX = viewLeft + margin + 24;
    const baseY = viewTop + margin + 40;

    const nodeW = (n: FlowNode) => n.w || CARD_W;
    const nodeH = (n: FlowNode) => n.h || CARD_H;
    const overlaps = (x: number, y: number, w = CARD_W, h = CARD_H) =>
      nodes.some((n) => {
        const ow = nodeW(n);
        const oh = nodeH(n);
        return !(x + w < n.x || n.x + ow < x || y + h < n.y || n.y + oh < y);
      });

    // Spiral / stagger from center of view — Freeform-style placement.
    const cx = viewLeft + viewW * 0.55;
    const cy = viewTop + viewH * 0.35;
    const candidates: Array<{ x: number; y: number }> = [{ x: cx - CARD_W / 2, y: cy }];
    for (let ring = 1; ring <= 8; ring++) {
      const step = 28 + ring * 18;
      candidates.push(
        { x: cx - CARD_W / 2 + step, y: cy + step * 0.4 },
        { x: cx - CARD_W / 2 - step, y: cy + step * 0.55 },
        { x: cx - CARD_W / 2 + step * 0.3, y: cy + step },
        { x: cx - CARD_W / 2 - step * 0.5, y: cy - step * 0.3 },
        { x: baseX + (ring % 3) * (CARD_W + 20), y: baseY + Math.floor(ring / 3) * (CARD_H + 18) },
      );
    }
    for (const c of candidates) {
      const x = Math.max(16, c.x);
      const y = Math.max(16, c.y);
      if (!overlaps(x, y)) return { x, y };
    }
    dropCounter += 1;
    return {
      x: Math.max(16, baseX + (dropCounter % 5) * 32),
      y: Math.max(16, baseY + dropCounter * 28),
    };
  },

  addExcerptNode: (data, opts) => {
    if (!opts?.skipHistory) get().commitHistory();
    const pos = get().nextDropPos();
    const maxZ = get().nodes.reduce((m, n) => Math.max(m, n.z || 0), 0);
    const node: FlowNode = {
      id: uid(),
      type: 'excerpt',
      x: pos.x,
      y: pos.y,
      w: 248,
      z: maxZ + 1,
      data: { ...data, docId: data.docId || get().activeDocId || undefined },
    };
    set((s) => ({ nodes: [...s.nodes, node] }));
    saveWorkspaceDebounced(snapshot(get()));
    return node;
  },

  addAiNode: (data) => {
    get().commitHistory();
    const pos = get().nextDropPos();
    const maxZ = get().nodes.reduce((m, n) => Math.max(m, n.z || 0), 0);
    const node: FlowNode = { id: uid(), type: 'ai', x: pos.x, y: pos.y, w: 288, z: maxZ + 1, data };
    set((s) => ({ nodes: [...s.nodes, node] }));
    saveWorkspaceDebounced(snapshot(get()));
    return node;
  },

  addNoteNode: (text = '', cite) => {
    get().commitHistory();
    resetTextEditHistoryGate();
    const pos = get().nextDropPos();
    const maxZ = get().nodes.reduce((m, n) => Math.max(m, n.z || 0), 0);
    const node: FlowNode = {
      id: uid(),
      type: 'note',
      x: pos.x,
      y: pos.y,
      w: 240,
      z: maxZ + 1,
      data: {
        text,
        page: cite?.page ?? null,
        highlightId: cite?.highlightId,
        docName: cite?.docName || get().docName || undefined,
        docId: cite?.docId || get().activeDocId || undefined,
      },
    };
    set((s) => ({ nodes: [...s.nodes, node] }));
    saveWorkspaceDebounced(snapshot(get()));
    return node;
  },

  addGroupNode: (title = 'Untitled section') => {
    get().commitHistory();
    resetTextEditHistoryGate();
    const pos = get().nextDropPos();
    const maxZ = get().nodes.reduce((m, n) => Math.max(m, n.z || 0), 0);
    const node: FlowNode = {
      id: uid(),
      type: 'group',
      x: pos.x,
      y: pos.y,
      w: GROUP_DEFAULT_W,
      h: GROUP_DEFAULT_H,
      z: maxZ + 1,
      data: { title, collapsed: false },
    };
    set((s) => ({ nodes: [...s.nodes, node] }));
    saveWorkspaceDebounced(snapshot(get()));
    return node;
  },

  updateNodeData: (id, data) => {
    armTextEditHistory(() => get().commitHistory());
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...(n.data as object), ...data } as FlowNode['data'] } : n,
      ),
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  toggleGroupCollapsed: (id) => {
    const n = get().nodes.find((x) => x.id === id);
    if (!n || n.type !== 'group') return;
    get().commitHistory();
    const data = n.data as GroupData;
    set((s) => ({
      nodes: s.nodes.map((x) =>
        x.id === id ? { ...x, data: { ...data, collapsed: !data.collapsed } } : x,
      ),
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  moveNode: (id, x, y) => {
    const snap = get().snapToGrid;
    const nx = snap ? Math.round(x / GRID_STEP) * GRID_STEP : x;
    const ny = snap ? Math.round(y / GRID_STEP) * GRID_STEP : y;
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, x: nx, y: ny } : n)) }));
    // Persist is debounced; avoid forcing a snapshot every pointer frame.
    saveWorkspaceDebounced(snapshot(get()));
  },

  resizeNode: (id, w, h) => {
    const snap = get().snapToGrid;
    let nextW = Math.max(180, Math.min(520, w));
    let nextH = Math.max(100, Math.min(720, h));
    if (snap) {
      nextW = Math.round(nextW / GRID_STEP) * GRID_STEP;
      nextH = Math.round(nextH / GRID_STEP) * GRID_STEP;
    }
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, w: nextW, h: nextH } : n)),
      nodeSizes: { ...s.nodeSizes, [id]: { w: nextW, h: nextH } },
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  bringNodeToFront: (id) => {
    set((s) => {
      const maxZ = s.nodes.reduce((m, n) => Math.max(m, n.z || 0), 0);
      const cur = s.nodes.find((n) => n.id === id);
      if (!cur || (cur.z || 0) >= maxZ) return s;
      return { nodes: s.nodes.map((n) => (n.id === id ? { ...n, z: maxZ + 1 } : n)) };
    });
  },

  sendNodeToBack: (id) => {
    set((s) => {
      const minZ = s.nodes.reduce((m, n) => Math.min(m, n.z || 0), 0);
      const cur = s.nodes.find((n) => n.id === id);
      if (!cur || (cur.z || 0) <= minZ) return s;
      return { nodes: s.nodes.map((n) => (n.id === id ? { ...n, z: minZ - 1 } : n)) };
    });
    saveWorkspaceDebounced(snapshot(get()));
  },

  setNodeGroup: (id, groupId) => {
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, groupId: groupId || undefined } : n)),
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  assignNodeGroupByPosition: (id) => {
    const { nodes } = get();
    const n = nodes.find((x) => x.id === id);
    if (!n || n.type === 'group') return;
    const cx = n.x + (n.w || 240) / 2;
    const cy = n.y + (n.h || 140) / 2;
    const group = nodes.find((g) => {
      if (g.type !== 'group') return false;
      if ((g.data as GroupData).collapsed) return false;
      return (
        cx >= g.x &&
        cx <= g.x + (g.w || GROUP_DEFAULT_W) &&
        cy >= g.y &&
        cy <= g.y + (g.h || GROUP_DEFAULT_H)
      );
    });
    const groupId = group?.id;
    if (n.groupId !== groupId) {
      set((s) => ({ nodes: s.nodes.map((x) => (x.id === id ? { ...x, groupId } : x)) }));
      saveWorkspaceDebounced(snapshot(get()));
    }
  },

  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),

  commitHistory: () => {
    resetTextEditHistoryGate();
    set((s) => {
      const top = s.history.past[s.history.past.length - 1];
      if (top && top.nodes === s.nodes && top.edges === s.edges) return s;
      const past = [...s.history.past, { nodes: s.nodes, edges: s.edges }];
      return { history: { past: past.slice(-50), future: [] } };
    });
  },

  undoCanvas: () => {
    resetTextEditHistoryGate();
    const { history, nodes, edges } = get();
    const prev = history.past[history.past.length - 1];
    if (!prev) return;
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      selectedNodeIds: [],
      history: {
        past: history.past.slice(0, -1),
        future: [...history.future, { nodes, edges }].slice(-50),
      },
    });
    saveWorkspaceDebounced(snapshot(get()));
  },

  redoCanvas: () => {
    resetTextEditHistoryGate();
    const { history, nodes, edges } = get();
    const next = history.future[history.future.length - 1];
    if (!next) return;
    set({
      nodes: next.nodes,
      edges: next.edges,
      selectedNodeIds: [],
      history: {
        past: [...history.past, { nodes, edges }],
        future: history.future.slice(0, -1),
      },
    });
    saveWorkspaceDebounced(snapshot(get()));
  },

  removeNode: (id) => {
    get().commitHistory();
    const removed = get().nodes.find((n) => n.id === id);
    const orphanHighlightId =
      removed?.type === 'excerpt' ? (removed.data as ExcerptData).highlightId : undefined;
    set((s) => {
      const nodes = s.nodes
        .filter((n) => n.id !== id)
        .map((n) => (removed?.type === 'group' && n.groupId === id ? { ...n, groupId: undefined } : n));
      const stillLinked =
        orphanHighlightId &&
        nodes.some(
          (n) => n.type === 'excerpt' && (n.data as ExcerptData).highlightId === orphanHighlightId,
        );
      return {
        nodes,
        highlights:
          orphanHighlightId && !stillLinked
            ? s.highlights.filter((h) => h.id !== orphanHighlightId)
            : s.highlights,
        edges: s.edges.filter((e) => e.source !== id && e.target !== id),
        nodeSizes: Object.fromEntries(Object.entries(s.nodeSizes).filter(([nodeId]) => nodeId !== id)),
        nodeAnchors: Object.fromEntries(Object.entries(s.nodeAnchors).filter(([nodeId]) => nodeId !== id)),
      };
    });
    saveWorkspaceDebounced(snapshot(get()));
  },

  addEdge: (source, target, label, relation) => {
    if (source === target) return;
    const exists = get().edges.some((e) => e.source === source && e.target === target);
    if (exists) return;
    get().commitHistory();
    const rel = relation || 'related';
    const meta = EDGE_RELATIONS.find((r) => r.key === rel);
    set((s) => ({
      edges: [
        ...s.edges,
        {
          id: uid(),
          source,
          target,
          relation: rel,
          label: label?.trim() || meta?.label,
        },
      ],
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  updateEdge: (id, patch) => {
    set((s) => ({
      edges: s.edges.map((e) => {
        if (e.id !== id) return e;
        const relation = patch.relation !== undefined ? patch.relation : e.relation;
        const meta = relation ? EDGE_RELATIONS.find((r) => r.key === relation) : undefined;
        const label =
          patch.label !== undefined
            ? patch.label?.trim() || undefined
            : patch.relation
              ? meta?.label || e.label
              : e.label;
        return { ...e, relation, label };
      }),
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  removeEdge: (id) => {
    get().commitHistory();
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id) }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  reanchorHighlightsForPage: (page, docId, pageData) => {
    set((s) => ({
      highlights: s.highlights.map((h) => {
        if (h.page !== page) return h;
        if ((h.docId || undefined) !== (docId || undefined)) return h;
        const rects = reanchorText(h.text, pageData);
        if (rects && rects.length) {
          return { ...h, rects, rect: unionRects(rects), anchorStatus: 'approximate' as const };
        }
        return { ...h, anchorStatus: 'approximate' as const };
      }),
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  addStroke: (stroke) => {
    set((s) => ({ ink: { ...s.ink, strokes: [...s.ink.strokes, stroke] } }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  undoStroke: () => {
    set((s) => ({ ink: { ...s.ink, strokes: s.ink.strokes.slice(0, -1) } }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  eraseAt: (x, y, radius) => {
    const r2 = radius * radius;
    const near = (px: number, py: number) => {
      const dx = px - x;
      const dy = py - y;
      return dx * dx + dy * dy <= r2;
    };
    set((s) => ({
      ink: {
        strokes: s.ink.strokes.filter(
          (st) => st.pdfPage != null || !st.points.some((p) => near(p.x, p.y)),
        ),
        links: s.ink.links.filter((l) => !near(l.canvasPoint.x, l.canvasPoint.y)),
      },
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  eraseAtPdf: (page, nx, ny, radius) => {
    const r2 = radius * radius;
    const near = (px: number, py: number) => {
      const dx = px - nx;
      const dy = py - ny;
      return dx * dx + dy * dy <= r2;
    };
    set((s) => ({
      ink: {
        ...s.ink,
        strokes: s.ink.strokes.filter(
          (st) =>
            st.pdfPage !== page || !st.points.some((p) => near(p.x, p.y)),
        ),
      },
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  startInkLink: () => set({ linking: { active: true, step: 'canvas', inkPoint: null } }),

  setInkLinkPoint: (p) =>
    set((s) => ({ linking: { ...s.linking, step: 'pdf', inkPoint: p } })),

  completeLink: (target) => {
    const { linking } = get();
    if (!linking.inkPoint) return;
    const link: InkLink = { id: uid(), canvasPoint: linking.inkPoint, ...target };
    set((s) => ({
      ink: { ...s.ink, links: [...s.ink.links, link] },
      linking: { active: false, step: null, inkPoint: null },
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  cancelLink: () => set({ linking: { active: false, step: null, inkPoint: null } }),

  jumpToHighlight: (id) => {
    const h = get().highlights.find((x) => x.id === id);
    if (!h) return;
    if (h.docId && h.docId !== get().activeDocId) {
      get().selectLibraryDoc(h.docId);
    }
    set({ flashTarget: { type: 'highlight', id, page: h.page }, currentPage: h.page });
  },

  jumpToPage: (page) => set({ flashTarget: { type: 'page', page }, currentPage: page }),

  clearFlash: () => set({ flashTarget: null }),

  toggleThreads: () => set((s) => ({ threadsOn: !s.threadsOn })),

  setHoverNodeId: (id) => set({ hoverNodeId: id }),

  setResearch: (patch) => set((s) => ({ research: { ...s.research, ...patch } })),

  setOcrPageText: (page, text) => {
    set((s) => ({ ocr: { ...s.ocr, pages: { ...s.ocr.pages, [page]: text }, processingPage: null } }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  setOcrPageData: (page, data) => {
    set((s) => {
      const ocr: OcrState = {
        ...s.ocr,
        pages: { ...s.ocr.pages, [page]: data.text },
        layouts: { ...s.ocr.layouts, [page]: data },
        processingPage: null,
        failedPages: s.ocr.failedPages.length
          ? s.ocr.failedPages.filter((pg) => pg !== page)
          : s.ocr.failedPages,
        source: s.ocr.source === 'text-layer' ? 'text-layer' : s.ocr.source === 'none' ? 'raster' : s.ocr.source,
      };
      const ocrByDocId = s.activeDocId
        ? { ...s.ocrByDocId, [s.activeDocId]: cacheFromOcr(ocr) }
        : s.ocrByDocId;
      return { ocr, ocrByDocId };
    });
    saveWorkspaceDebounced(snapshot(get()));
  },

  setOcrLayoutsBulk: (layouts, source) => {
    const pages: Record<number, string> = {};
    Object.entries(layouts).forEach(([k, data]) => {
      pages[Number(k)] = data.text;
    });
    set((s) => {
      const ocr: OcrState = {
        ...s.ocr,
        pages,
        layouts: { ...layouts },
        processingPage: null,
        scanning: false,
        scanPaused: false,
        scanProgress: null,
        failedPages: [],
        source,
      };
      const ocrByDocId = s.activeDocId
        ? { ...s.ocrByDocId, [s.activeDocId]: cacheFromOcr(ocr) }
        : s.ocrByDocId;
      return { ocr, ocrByDocId };
    });
    saveWorkspaceDebounced(snapshot(get()));
  },

  setOcrPageFailed: (page) =>
    set((s) => ({
      ocr: {
        ...s.ocr,
        processingPage: null,
        failedPages: s.ocr.failedPages.includes(page) ? s.ocr.failedPages : [...s.ocr.failedPages, page],
      },
    })),

  resetOcrFailedPages: () => set((s) => ({ ocr: { ...s.ocr, failedPages: [] } })),

  setOcrProcessingPage: (page) => set((s) => ({ ocr: { ...s.ocr, processingPage: page } })),

  setOcrScanning: (scanning, progress = null) =>
    set((s) => ({
      ocr: {
        ...s.ocr,
        scanning,
        scanPaused: scanning ? s.ocr.scanPaused : false,
        scanProgress: scanning
          ? {
              done: progress?.done ?? s.ocr.scanProgress?.done ?? 0,
              total: progress?.total ?? s.ocr.scanProgress?.total ?? 0,
              current: progress?.current !== undefined ? progress.current : s.ocr.scanProgress?.current ?? null,
              engine:
                progress?.engine !== undefined
                  ? progress.engine
                  : s.ocr.scanProgress?.engine ?? null,
            }
          : null,
      },
    })),

  setOcrScanPaused: (paused) => set((s) => ({ ocr: { ...s.ocr, scanPaused: paused } })),

  addBookmark: (b) => {
    const section = get().bookmarks.filter((x) => x.section === b.section);
    const bookmark: Bookmark = { id: uid(), order: section.length, ...b };
    set((s) => ({ bookmarks: [...s.bookmarks, bookmark] }));
    saveWorkspaceDebounced(snapshot(get()));
    return bookmark;
  },

  updateBookmark: (id, patch) => {
    set((s) => ({ bookmarks: s.bookmarks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  removeBookmark: (id) => {
    const drop = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const b of get().bookmarks) {
        if (b.parentId && drop.has(b.parentId) && !drop.has(b.id)) {
          drop.add(b.id);
          grew = true;
        }
      }
    }
    set((s) => ({ bookmarks: s.bookmarks.filter((b) => !drop.has(b.id)) }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  reorderBookmarks: (section, orderedIds) => {
    set((s) => ({
      bookmarks: s.bookmarks.map((b) => {
        if (b.section !== section) return b;
        const idx = orderedIds.indexOf(b.id);
        return idx === -1 ? b : { ...b, order: idx };
      }),
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  resetWorkspace: async () => {
    dropCounter = 0;
    await clearWorkspace();
    set({
      ...emptyWorkspace,
      flashTarget: null,
      linking: { active: false, step: null, inkPoint: null },
      research: { status: 'idle', query: '', result: null, error: null, mode: 'offline' },
    });
  },

  importCanvasBundle: (bundle) => {
    set((s) => ({
      highlights: bundle.highlights || [],
      nodes: bundle.nodes || [],
      edges: bundle.edges || [],
      ink: bundle.ink || { strokes: [], links: [] },
      bookmarks: bundle.bookmarks || [],
      ocr: {
        ...s.ocr,
        pages: bundle.ocrPages || s.ocr.pages,
      },
      docName: bundle.docName || s.docName,
      numPages: bundle.numPages || s.numPages,
      history: { ...emptyHistory },
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },
}));
