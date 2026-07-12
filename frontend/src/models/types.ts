export enum DocumentType {
  pdf = 'pdf',
  word = 'word',
}

export enum OcrStatus {
  none = 'none',
  processing = 'processing',
  complete = 'complete',
  failed = 'failed',
  scanned = 'scanned',
}

export enum IndexStatus {
  none = 'none',
  processing = 'processing',
  complete = 'complete',
  failed = 'failed',
}

export enum Language {
  hindi = 'hindi',
  punjabi = 'punjabi',
  marathi = 'marathi',
  english = 'english',
  unknown = 'unknown',
}

export enum CanvasCardType {
  excerpt = 'excerpt',
  note = 'note',
  concept = 'concept',
  group = 'group',
}

export enum BookmarkType {
  section = 'section',
  issue = 'issue',
  page = 'page',
  annexure = 'annexure',
}

export enum HighlightColor {
  yellow = 'yellow',
  pink = 'pink',
  teal = 'teal',
}

export enum ConnectorType {
  defaultType = 'defaultType',
  supports = 'supports',
  contradicts = 'contradicts',
  related = 'related',
}

export enum DocumentTextMode {
  original = 'original',
  english = 'english',
  sideBySide = 'sideBySide',
}

export enum BookmarkFilter {
  all = 'all',
  autoIndexed = 'autoIndexed',
  manual = 'manual',
}

export interface Document {
  id: string;
  filePath: string;
  title: string;
  pageCount: number;
  fileSizeBytes: number;
  lastOpened: string; // ISO
  type: DocumentType;
  ocrStatus: OcrStatus;
  ocrConfidence: number;
  detectedLanguage?: Language;
  tags: string[];
  indexStatus: IndexStatus;
}

export interface OcrTextBlock {
  text: string;
  rect: { left: number; top: number; width: number; height: number };
  confidence: number;
}

export interface OcrPageResult {
  pageIndex: number; // 0-based
  blocks: OcrTextBlock[];
  pageWidth: number;
  pageHeight: number;
  isTranslation?: boolean;
}

export interface Annotation {
  id: string;
  documentId: string;
  pageIndex: number; // 0-based
  textRange: { start: number; end: number };
  boundingRect: { left: number; top: number; width: number; height: number };
  color: HighlightColor;
  comment?: string;
  linkedCanvasCardId?: string;
  createdAt: string;
  underline: boolean;
  bold: boolean;
}

export interface CanvasCard {
  id: string;
  workspaceId: string; // = documentId
  type: CanvasCardType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  content: string;
  sourceDocumentId?: string;
  sourcePageIndex?: number; // 1-based when stored from sendToCanvas
  sourceTextRange?: { start: number; end: number };
  accentColor: number; // ARGB
  isPinned: boolean;
  isBold: boolean;
  isUnderline: boolean;
  textHighlight?: HighlightColor;
  createdAt: string;
}

export interface Connector {
  id: string;
  documentId: string;
  fromCardId: string;
  toCardId: string;
  type: ConnectorType;
  label?: string;
}

export interface Bookmark {
  id: string;
  documentId: string;
  label: string;
  subtitle?: string;
  type: BookmarkType;
  startPage: number; // 1-based
  endPage?: number;
  parentId?: string;
  sortOrder: number;
  isAutoIndexed: boolean;
}

export interface AppSettings {
  themeMode: 'system' | 'light' | 'dark';
  defaultSplitRatio: number; // default 0.6
  defaultHighlightColor: number; // 0=yellow, 1=pink, 2=teal
  sideRailExpanded: boolean;
  rightPaneCollapsed: boolean;
  backendUrl: string;
}
