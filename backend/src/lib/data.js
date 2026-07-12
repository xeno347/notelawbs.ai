const { ensureDatabase, all, run } = require('./sqlite');
const { normalizeDocument, normalizeBookmark, normalizeAnnotation, normalizeCanvasCard, normalizeConnector, nowIso } = require('./domain');

function sqlValue(value) {
  if (value == null) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function createTables() {
  ensureDatabase().exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY NOT NULL,
      filePath TEXT NOT NULL,
      title TEXT NOT NULL,
      pageCount INTEGER NOT NULL,
      fileSizeBytes INTEGER NOT NULL,
      lastOpened TEXT NOT NULL,
      type TEXT NOT NULL,
      ocrStatus TEXT NOT NULL,
      ocrConfidence REAL NOT NULL,
      detectedLanguage TEXT,
      tags TEXT NOT NULL,
      indexStatus TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY NOT NULL,
      documentId TEXT NOT NULL,
      label TEXT NOT NULL,
      subtitle TEXT,
      type TEXT NOT NULL,
      startPage INTEGER NOT NULL,
      endPage INTEGER,
      parentId TEXT,
      sortOrder INTEGER NOT NULL,
      isAutoIndexed INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY NOT NULL,
      documentId TEXT NOT NULL,
      pageIndex INTEGER NOT NULL,
      textRangeStart INTEGER NOT NULL,
      textRangeEnd INTEGER NOT NULL,
      boundingRect TEXT NOT NULL,
      color TEXT NOT NULL,
      comment TEXT,
      linkedCanvasCardId TEXT,
      createdAt TEXT NOT NULL,
      underline INTEGER NOT NULL,
      bold INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS canvasCards (
      id TEXT PRIMARY KEY NOT NULL,
      workspaceId TEXT NOT NULL,
      type TEXT NOT NULL,
      positionX REAL NOT NULL,
      positionY REAL NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      content TEXT NOT NULL,
      sourceDocumentId TEXT,
      sourcePageIndex INTEGER,
      sourceTextRangeStart INTEGER,
      sourceTextRangeEnd INTEGER,
      accentColor INTEGER NOT NULL,
      isPinned INTEGER NOT NULL,
      isBold INTEGER NOT NULL,
      isUnderline INTEGER NOT NULL,
      textHighlight TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS connectors (
      id TEXT PRIMARY KEY NOT NULL,
      documentId TEXT NOT NULL,
      fromCardId TEXT NOT NULL,
      toCardId TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ocrPages (
      id TEXT PRIMARY KEY NOT NULL,
      documentId TEXT NOT NULL,
      pageIndex INTEGER NOT NULL,
      content TEXT NOT NULL,
      isTranslation INTEGER NOT NULL DEFAULT 0
    );
  `);
}

const seedDocuments = [
  normalizeDocument({
    id: 'demo-doc-001',
    title: 'Sharma v. State of Rajasthan.pdf',
    filePath: '/demo/sharma-v-state.pdf',
    pageCount: 12,
    fileSizeBytes: 1024 * 3000,
    lastOpened: nowIso(),
    type: 'pdf',
    ocrStatus: 'complete',
    ocrConfidence: 0.98,
    detectedLanguage: 'english',
    tags: ['demo', 'petition'],
    indexStatus: 'complete',
  }),
  normalizeDocument({
    id: 'demo-doc-002',
    title: 'Counter Affidavit.pdf',
    filePath: '/demo/counter-affidavit.pdf',
    pageCount: 8,
    fileSizeBytes: 1024 * 1800,
    lastOpened: nowIso(),
    type: 'pdf',
    ocrStatus: 'processing',
    ocrConfidence: 0.71,
    detectedLanguage: 'english',
    tags: ['demo', 'affidavit'],
    indexStatus: 'processing',
  }),
];

const seedBookmarks = [
  normalizeBookmark({ documentId: 'demo-doc-001', label: 'INDEX', subtitle: 'Auto-detected', type: 'section', startPage: 1, sortOrder: 0, isAutoIndexed: true }),
  normalizeBookmark({ documentId: 'demo-doc-001', label: 'SYNOPSIS', subtitle: 'Auto-detected', type: 'section', startPage: 2, sortOrder: 1, isAutoIndexed: true }),
  normalizeBookmark({ documentId: 'demo-doc-001', label: 'FACTS OF THE CASE', subtitle: 'Manual', type: 'section', startPage: 4, sortOrder: 2, isAutoIndexed: false }),
];

const seedPages = [
  {
    id: 'ocr_demo_001',
    documentId: 'demo-doc-001',
    pageIndex: 0,
    content: JSON.stringify({
      pageIndex: 0,
      pageWidth: 595,
      pageHeight: 842,
      blocks: [
        { text: 'SUPREME COURT OF INDIA', left: 50, top: 40, width: 300, height: 24, confidence: 0.99 },
        { text: 'INDEX', left: 50, top: 90, width: 120, height: 20, confidence: 0.96 },
      ],
    }),
    isTranslation: 0,
  },
];

const seedSettings = [
  { key: 'themeMode', value: JSON.stringify('system') },
  { key: 'defaultSplitRatio', value: JSON.stringify(0.6) },
  { key: 'defaultHighlightColor', value: JSON.stringify(0) },
];

function isEmpty(table) {
  return all(`SELECT 1 FROM ${table} LIMIT 1`).length === 0;
}

function insertMany(table, rows) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  for (const row of rows) {
    ensureDatabase().exec(
      `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((key) => sqlValue(row[key])).join(', ')})`,
    );
  }
}

async function ensureSeeds() {
  createTables();

  if (isEmpty('documents')) insertMany('documents', seedDocuments.map((doc) => ({ ...doc, tags: JSON.stringify(doc.tags) })));
  if (isEmpty('bookmarks')) insertMany('bookmarks', seedBookmarks);
  if (isEmpty('annotations')) insertMany('annotations', []);
  if (isEmpty('canvasCards')) insertMany('canvasCards', []);
  if (isEmpty('connectors')) insertMany('connectors', []);
  if (isEmpty('settings')) insertMany('settings', seedSettings);
  if (isEmpty('ocrPages')) insertMany('ocrPages', seedPages);
}

function parseSettingValue(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
}

function loadDocuments() {
  return all('SELECT * FROM documents ORDER BY lastOpened DESC').map((row) => ({
    ...row,
    tags: JSON.parse(row.tags || '[]'),
  }));
}

function loadBookmarks() {
  return all('SELECT * FROM bookmarks ORDER BY sortOrder ASC');
}

function loadAnnotations() {
  return all('SELECT * FROM annotations ORDER BY createdAt DESC');
}

function loadCanvasCards() {
  return all('SELECT * FROM canvasCards ORDER BY createdAt DESC');
}

function loadConnectors() {
  return all('SELECT * FROM connectors');
}

function loadSettings() {
  return all('SELECT * FROM settings');
}

function loadOcrPages() {
  return all('SELECT * FROM ocrPages ORDER BY documentId ASC, pageIndex ASC, isTranslation ASC');
}

async function loadData() {
  await ensureSeeds();
  return {
    documents: loadDocuments(),
    bookmarks: loadBookmarks(),
    annotations: loadAnnotations(),
    canvasCards: loadCanvasCards(),
    connectors: loadConnectors(),
    settings: loadSettings(),
    ocrPages: loadOcrPages(),
  };
}

async function saveData(collection, value) {
  createTables();
  const database = ensureDatabase();
  database.exec(`DELETE FROM ${collection};`);

  if (!Array.isArray(value) || value.length === 0) {
    return;
  }

  insertMany(collection, value);
}

module.exports = {
  ensureSeeds,
  loadData,
  saveData,
  parseSettingValue,
  normalizeDocument,
  normalizeBookmark,
  normalizeAnnotation,
  normalizeCanvasCard,
  normalizeConnector,
  nowIso,
};
