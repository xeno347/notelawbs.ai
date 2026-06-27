import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  filePath: text('file_path').notNull(),
  title: text('title').notNull(),
  pageCount: integer('page_count').notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  lastOpened: text('last_opened').notNull(),
  type: text('type').notNull(), // DocumentType
  ocrStatus: text('ocr_status').notNull(), // OcrStatus
  ocrConfidence: real('ocr_confidence').notNull(),
  detectedLanguage: text('detected_language'), // Language
  tags: text('tags').notNull(), // JSON array of strings
  indexStatus: text('index_status').notNull(), // IndexStatus
});

export const ocrPages = sqliteTable('ocr_pages', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  pageIndex: integer('page_index').notNull(),
  content: text('content').notNull(), // JSON of OcrPageResult
  isTranslation: integer('is_translation', { mode: 'boolean' }).default(false),
});

export const bookmarks = sqliteTable('bookmarks', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  subtitle: text('subtitle'),
  type: text('type').notNull(), // BookmarkType
  startPage: integer('start_page').notNull(),
  endPage: integer('end_page'),
  parentId: text('parent_id'),
  sortOrder: integer('sort_order').notNull(),
  isAutoIndexed: integer('is_auto_indexed', { mode: 'boolean' }).notNull(),
});

export const annotations = sqliteTable('annotations', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  pageIndex: integer('page_index').notNull(),
  textRangeStart: integer('text_range_start').notNull(),
  textRangeEnd: integer('text_range_end').notNull(),
  boundingRect: text('bounding_rect').notNull(), // JSON of rect
  color: text('color').notNull(), // HighlightColor
  comment: text('comment'),
  linkedCanvasCardId: text('linked_canvas_card_id'),
  createdAt: text('created_at').notNull(),
  underline: integer('underline', { mode: 'boolean' }).notNull(),
  bold: integer('bold', { mode: 'boolean' }).notNull(),
});

export const canvasCards = sqliteTable('canvas_cards', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(), // documentId
  type: text('type').notNull(), // CanvasCardType
  positionX: real('position_x').notNull(),
  positionY: real('position_y').notNull(),
  width: real('width').notNull(),
  height: real('height').notNull(),
  content: text('content').notNull(),
  sourceDocumentId: text('source_document_id'),
  sourcePageIndex: integer('source_page_index'),
  sourceTextRangeStart: integer('source_text_range_start'),
  sourceTextRangeEnd: integer('source_text_range_end'),
  accentColor: integer('accent_color').notNull(),
  isPinned: integer('is_pinned', { mode: 'boolean' }).notNull(),
  isBold: integer('is_bold', { mode: 'boolean' }).notNull(),
  isUnderline: integer('is_underline', { mode: 'boolean' }).notNull(),
  textHighlight: text('text_highlight'), // HighlightColor
  createdAt: text('created_at').notNull(),
});

export const connectors = sqliteTable('connectors', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  fromCardId: text('from_card_id').notNull(),
  toCardId: text('to_card_id').notNull(),
  type: text('type').notNull(), // ConnectorType
  label: text('label'),
});

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON
});
