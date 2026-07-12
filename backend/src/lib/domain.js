const { nextId } = require('./collectionStore');

function nowIso() {
  return new Date().toISOString();
}

function normalizeDocument(input = {}) {
  return {
    id: input.id || nextId('doc'),
    filePath: input.filePath || input.file_path || '',
    title: input.title || 'Untitled Document',
    pageCount: Number(input.pageCount ?? input.page_count ?? 0),
    fileSizeBytes: Number(input.fileSizeBytes ?? input.file_size_bytes ?? 0),
    lastOpened: input.lastOpened || input.last_opened || nowIso(),
    type: input.type || 'pdf',
    ocrStatus: input.ocrStatus || input.ocr_status || 'none',
    ocrConfidence: Number(input.ocrConfidence ?? input.ocr_confidence ?? 0),
    detectedLanguage: input.detectedLanguage || input.detected_language || 'unknown',
    tags: Array.isArray(input.tags) ? input.tags : JSON.parse(input.tags || '[]'),
    indexStatus: input.indexStatus || input.index_status || 'none',
  };
}

function normalizeBookmark(input = {}) {
  return {
    id: input.id || nextId('bookmark'),
    documentId: input.documentId || input.document_id,
    label: input.label || 'Untitled Bookmark',
    subtitle: input.subtitle || null,
    type: input.type || 'section',
    startPage: Number(input.startPage ?? input.start_page ?? 1),
    endPage: input.endPage ?? input.end_page ?? null,
    parentId: input.parentId ?? input.parent_id ?? null,
    sortOrder: Number(input.sortOrder ?? input.sort_order ?? 0),
    isAutoIndexed: Boolean(input.isAutoIndexed ?? input.is_auto_indexed ?? false),
  };
}

function normalizeAnnotation(input = {}) {
  return {
    id: input.id || nextId('annotation'),
    documentId: input.documentId || input.document_id,
    pageIndex: Number(input.pageIndex ?? input.page_index ?? 0),
    textRangeStart: Number(input.textRangeStart ?? input.text_range_start ?? 0),
    textRangeEnd: Number(input.textRangeEnd ?? input.text_range_end ?? 0),
    boundingRect: input.boundingRect || input.bounding_rect || { left: 0, top: 0, width: 0, height: 0 },
    color: input.color || 'yellow',
    comment: input.comment || null,
    linkedCanvasCardId: input.linkedCanvasCardId || input.linked_canvas_card_id || null,
    createdAt: input.createdAt || input.created_at || nowIso(),
    underline: Boolean(input.underline ?? false),
    bold: Boolean(input.bold ?? false),
  };
}

function normalizeCanvasCard(input = {}) {
  return {
    id: input.id || nextId('card'),
    workspaceId: input.workspaceId || input.workspace_id,
    type: input.type || 'excerpt',
    position: input.position || {
      x: Number(input.positionX ?? input.position_x ?? 0),
      y: Number(input.positionY ?? input.position_y ?? 0),
    },
    size: input.size || {
      width: Number(input.width ?? 0),
      height: Number(input.height ?? 0),
    },
    content: input.content || '',
    sourceDocumentId: input.sourceDocumentId || input.source_document_id || null,
    sourcePageIndex: input.sourcePageIndex ?? input.source_page_index ?? null,
    sourceTextRange: input.sourceTextRange || (input.source_text_range_start != null || input.source_text_range_end != null
      ? { start: Number(input.source_text_range_start ?? 0), end: Number(input.source_text_range_end ?? 0) }
      : null),
    accentColor: Number(input.accentColor ?? input.accent_color ?? 0),
    isPinned: Boolean(input.isPinned ?? input.is_pinned ?? false),
    isBold: Boolean(input.isBold ?? input.is_bold ?? false),
    isUnderline: Boolean(input.isUnderline ?? input.is_underline ?? false),
    textHighlight: input.textHighlight || input.text_highlight || null,
    createdAt: input.createdAt || input.created_at || nowIso(),
  };
}

function normalizeConnector(input = {}) {
  return {
    id: input.id || nextId('connector'),
    documentId: input.documentId || input.document_id,
    fromCardId: input.fromCardId || input.from_card_id,
    toCardId: input.toCardId || input.to_card_id,
    type: input.type || 'defaultType',
    label: input.label || null,
  };
}

module.exports = {
  nowIso,
  normalizeDocument,
  normalizeBookmark,
  normalizeAnnotation,
  normalizeCanvasCard,
  normalizeConnector,
};
