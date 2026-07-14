import { create } from 'zustand';
import {
  loadWorkspace,
  saveWorkspaceDebounced,
  clearWorkspace,
  persistPdf,
  getSetting,
  setSetting,
  type Persisted,
} from './storage';
import type { CategoryKey } from './theme';
import type { ResearchResult } from './research/researchCore';

export type Rect = { x: number; y: number; w: number; h: number };

export type Highlight = {
  id: string;
  page: number;
  rect: Rect;
  text: string;
  category: CategoryKey;
  note: string;
};

export type ExcerptData = {
  text: string;
  page: number;
  category: CategoryKey;
  note: string;
  highlightId: string;
  docName: string;
};

export type AiData = { heading: string; body: string; citations: string[] };

export type FlowNode = {
  id: string;
  type: 'excerpt' | 'ai';
  x: number;
  y: number;
  data: ExcerptData | AiData;
};

export type Edge = { id: string; source: string; target: string };

export type Stroke = {
  id: string;
  color: number;
  width: number;
  points: Array<{ x: number; y: number }>;
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

export type OcrState = {
  pages: Record<number, string>;
  processingPage: number | null;
  scanning: boolean;
  scanProgress: { done: number; total: number } | null;
};

export type BookmarkSectionKey = 'index' | 'dates' | 'synopsis' | 'issues' | 'annexures';

export type Bookmark = {
  id: string;
  section: BookmarkSectionKey;
  title: string;
  note: string;
  page: number | null;
  date: string;
  order: number;
};

type ResearchState = {
  status: 'idle' | 'loading' | 'done';
  query: string;
  result: ResearchResult | null;
  error: string | null;
  mode: 'offline' | 'live';
};

let dropCounter = 0;

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type StoreState = {
  hydrated: boolean;
  autoOcr: boolean;
  setAutoOcr: (v: boolean) => void;
  clearInMemory: () => void;
  docName: string;
  docUri: string;
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

  // absolute window geometry for cross-pane threads
  pdfFrame: { left: number; top: number; w: number; h: number } | null;
  canvasOrigin: { x: number; y: number };
  canvasTf: { s: number; tx: number; ty: number };
  canvasViewport: { w: number; h: number } | null;
  focusNodeId: string | null;
  setPdfFrame: (f: { left: number; top: number; w: number; h: number } | null) => void;
  setCanvasOrigin: (o: { x: number; y: number }) => void;
  setCanvasTf: (t: { s: number; tx: number; ty: number }) => void;
  setCanvasViewport: (v: { w: number; h: number } | null) => void;
  requestFocusNode: (id: string) => void;
  clearFocusNode: () => void;

  hydrate: () => Promise<void>;
  openPdf: (uri: string, name: string) => Promise<void>;
  setDocMeta: (numPages: number) => void;
  setCurrentPage: (page: number) => void;

  addHighlight: (h: Omit<Highlight, 'id'>) => Highlight;
  removeHighlight: (id: string) => void;

  nextDropPos: () => { x: number; y: number };
  addExcerptNode: (data: ExcerptData) => FlowNode;
  addAiNode: (data: AiData) => FlowNode;
  moveNode: (id: string, x: number, y: number) => void;
  removeNode: (id: string) => void;
  addEdge: (source: string, target: string) => void;
  removeEdge: (id: string) => void;

  addStroke: (stroke: Stroke) => void;
  undoStroke: () => void;
  eraseAt: (x: number, y: number, radius: number) => void;

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
  setOcrProcessingPage: (page: number | null) => void;
  setOcrScanning: (scanning: boolean, progress?: { done: number; total: number } | null) => void;

  addBookmark: (b: Omit<Bookmark, 'id' | 'order'>) => Bookmark;
  updateBookmark: (id: string, patch: Partial<Omit<Bookmark, 'id'>>) => void;
  removeBookmark: (id: string) => void;
  reorderBookmarks: (section: BookmarkSectionKey, orderedIds: string[]) => void;

  resetWorkspace: () => Promise<void>;

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

function snapshot(s: StoreState): Persisted {
  return {
    docName: s.docName,
    docUri: s.docUri,
    numPages: s.numPages,
    highlights: s.highlights,
    nodes: s.nodes,
    edges: s.edges,
    ink: s.ink,
    ocrPages: s.ocr.pages,
    bookmarks: s.bookmarks,
  };
}

export const useStore = create<StoreState>((set, get) => ({
  hydrated: false,
  autoOcr: true,
  docName: '',
  docUri: '',
  numPages: 0,
  currentPage: 1,
  highlights: [],
  nodes: [],
  edges: [],
  ink: { strokes: [], links: [] },
  threadsOn: true,
  hoverNodeId: null,
  flashTarget: null,
  linking: { active: false, step: null, inkPoint: null },
  research: { status: 'idle', query: '', result: null, error: null, mode: 'offline' },
  ocr: { pages: {}, processingPage: null, scanning: false, scanProgress: null },
  bookmarks: [],
  pdfFrame: null,
  canvasOrigin: { x: 0, y: 0 },
  canvasTf: { s: 1, tx: 20, ty: 20 },
  canvasViewport: null,
  focusNodeId: null,

  setPdfFrame: (f) => set({ pdfFrame: f }),
  setCanvasOrigin: (o) => set({ canvasOrigin: o }),
  setCanvasTf: (t) => set({ canvasTf: t }),
  setCanvasViewport: (v) => set({ canvasViewport: v }),
  requestFocusNode: (id) => set({ focusNodeId: id }),
  clearFocusNode: () => set({ focusNodeId: null }),

  hydrate: async () => {
    const autoOcrRaw = await getSetting('autoOcr');
    const data = await loadWorkspace();
    if (data) {
      set({
        docName: data.docName || '',
        docUri: data.docUri || '',
        numPages: data.numPages || 0,
        currentPage: 1,
        highlights: data.highlights || [],
        nodes: (data.nodes || []).filter((n: FlowNode) => n.type !== ('ink' as any)),
        edges: data.edges || [],
        ink: data.ink || { strokes: [], links: [] },
        ocr: { pages: data.ocrPages || {}, processingPage: null, scanning: false, scanProgress: null },
        bookmarks: data.bookmarks || [],
      });
    } else {
      // No saved workspace for this user — start clean so nothing leaks across accounts.
      dropCounter = 0;
      set({
        docName: '',
        docUri: '',
        numPages: 0,
        currentPage: 1,
        highlights: [],
        nodes: [],
        edges: [],
        ink: { strokes: [], links: [] },
        ocr: { pages: {}, processingPage: null, scanning: false, scanProgress: null },
        bookmarks: [],
      });
    }
    set({ autoOcr: autoOcrRaw !== '0', hydrated: true });
  },

  setAutoOcr: (v) => {
    set({ autoOcr: v });
    setSetting('autoOcr', v ? '1' : '0').catch(() => {});
  },

  clearInMemory: () => {
    dropCounter = 0;
    set({
      hydrated: false,
      docName: '',
      docUri: '',
      numPages: 0,
      currentPage: 1,
      highlights: [],
      nodes: [],
      edges: [],
      ink: { strokes: [], links: [] },
      flashTarget: null,
      linking: { active: false, step: null, inkPoint: null },
      research: { status: 'idle', query: '', result: null, error: null, mode: 'offline' },
      ocr: { pages: {}, processingPage: null, scanning: false, scanProgress: null },
      bookmarks: [],
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
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  openPdf: async (uri, name) => {
    const stored = await persistPdf(uri, name);
    set({
      docName: name,
      docUri: stored,
      currentPage: 1,
      ocr: { pages: {}, processingPage: null, scanning: false, scanProgress: null },
      bookmarks: [],
    });
    saveWorkspaceDebounced(snapshot(get()));
  },

  setDocMeta: (numPages) => {
    set({ numPages });
    saveWorkspaceDebounced(snapshot(get()));
  },

  setCurrentPage: (page) => set({ currentPage: page }),

  addHighlight: (h) => {
    const highlight: Highlight = { id: uid(), ...h };
    set((s) => ({ highlights: [...s.highlights, highlight] }));
    saveWorkspaceDebounced(snapshot(get()));
    return highlight;
  },

  removeHighlight: (id) => {
    set((s) => ({ highlights: s.highlights.filter((h) => h.id !== id) }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  nextDropPos: () => {
    const col = dropCounter % 3;
    const row = Math.floor(dropCounter / 3);
    dropCounter += 1;
    return { x: 40 + col * 250, y: 60 + row * 190 };
  },

  addExcerptNode: (data) => {
    const pos = get().nextDropPos();
    const node: FlowNode = { id: uid(), type: 'excerpt', x: pos.x, y: pos.y, data };
    set((s) => ({ nodes: [...s.nodes, node] }));
    saveWorkspaceDebounced(snapshot(get()));
    return node;
  },

  addAiNode: (data) => {
    const pos = get().nextDropPos();
    const node: FlowNode = { id: uid(), type: 'ai', x: pos.x, y: pos.y, data };
    set((s) => ({ nodes: [...s.nodes, node] }));
    saveWorkspaceDebounced(snapshot(get()));
    return node;
  },

  moveNode: (id, x, y) => {
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  removeNode: (id) => {
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
    }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  addEdge: (source, target) => {
    if (source === target) return;
    const exists = get().edges.some((e) => e.source === source && e.target === target);
    if (exists) return;
    set((s) => ({ edges: [...s.edges, { id: uid(), source, target }] }));
    saveWorkspaceDebounced(snapshot(get()));
  },

  removeEdge: (id) => {
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id) }));
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
        strokes: s.ink.strokes.filter((st) => !st.points.some((p) => near(p.x, p.y))),
        links: s.ink.links.filter((l) => !near(l.canvasPoint.x, l.canvasPoint.y)),
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
    if (h) set({ flashTarget: { type: 'highlight', id, page: h.page }, currentPage: h.page });
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

  setOcrProcessingPage: (page) => set((s) => ({ ocr: { ...s.ocr, processingPage: page } })),

  setOcrScanning: (scanning, progress = null) =>
    set((s) => ({ ocr: { ...s.ocr, scanning, scanProgress: scanning ? progress : null } })),

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
    set((s) => ({ bookmarks: s.bookmarks.filter((b) => b.id !== id) }));
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
      docName: '',
      docUri: '',
      numPages: 0,
      currentPage: 1,
      highlights: [],
      nodes: [],
      edges: [],
      ink: { strokes: [], links: [] },
      flashTarget: null,
      linking: { active: false, step: null, inkPoint: null },
      research: { status: 'idle', query: '', result: null, error: null, mode: 'offline' },
      ocr: { pages: {}, processingPage: null, scanning: false, scanProgress: null },
      bookmarks: [],
    });
  },
}));
