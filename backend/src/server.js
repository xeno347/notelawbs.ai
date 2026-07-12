const http = require('http');
const { URL } = require('url');
const { port, jwtSecret, tokenTtlSeconds, usersFile, corsOrigin, maxBodyBytes } = require('./config');
const { readUsers, saveUsers } = require('./lib/jsonStore');
const { verifyPassword } = require('./lib/passwords');
const { signToken, verifyToken } = require('./lib/jwt');
const {
  loadData,
  saveData,
  parseSettingValue,
  normalizeDocument,
  normalizeBookmark,
  normalizeAnnotation,
  normalizeCanvasCard,
  normalizeConnector,
  nowIso,
  ensureSeeds,
} = require('./lib/data');
const { nextId } = require('./lib/collectionStore');

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function errorResponse(code, message) {
  return { error: { code, message } };
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > maxBodyBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

function withSearchParams(urlString) {
  const url = new URL(urlString, 'http://localhost');
  return {
    pathname: url.pathname,
    searchParams: url.searchParams,
  };
}

function matchRoute(pathname, pattern) {
  const names = [];
  const regex = new RegExp(
    '^' +
      pattern
        .split('/')
        .map((part) => {
          if (part.startsWith(':')) {
            names.push(part.slice(1));
            return '([^/]+)';
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('/') +
      '$',
  );

  const match = pathname.match(regex);
  if (!match) return null;

  return names.reduce((params, name, index) => {
    params[name] = decodeURIComponent(match[index + 1]);
    return params;
  }, {});
}

async function loadUsers() {
  return readUsers(usersFile);
}

async function authUser(req) {
  const token = getBearerToken(req);
  if (!token) {
    throw new Error('Missing bearer token.');
  }

  const payload = verifyToken(token, jwtSecret);
  const users = await loadUsers();
  const user = users.find((entry) => entry.id === payload.sub);
  if (!user) {
    throw new Error('User not found.');
  }

  return { payload, user };
}

function removeById(collection, id) {
  return collection.filter((entry) => entry.id !== id);
}

function replaceById(collection, id, next) {
  return collection.map((entry) => (entry.id === id ? next : entry));
}

function sortByDateDesc(collection, key) {
  return [...collection].sort((a, b) => new Date(b[key]).getTime() - new Date(a[key]).getTime());
}

function validateDocumentPayload(body) {
  const title = String(body.title || '').trim();
  const filePath = String(body.filePath || body.file_path || '').trim();
  if (!title) {
    throw new Error('Document title is required.');
  }
  if (!filePath) {
    throw new Error('Document file path is required.');
  }
  return { title, filePath };
}

function validateBookmarkPayload(body) {
  const label = String(body.label || '').trim();
  const startPage = Math.max(1, Number(body.startPage ?? body.start_page ?? 1) || 1);
  if (!label) {
    throw new Error('Bookmark label is required.');
  }
  return { label, startPage };
}

async function listDocumentBookmarks(documentId) {
  const data = await loadData();
  return data.bookmarks.filter((bookmark) => bookmark.documentId === documentId);
}

async function listDocumentAnnotations(documentId) {
  const data = await loadData();
  return data.annotations.filter((annotation) => annotation.documentId === documentId);
}

async function listDocumentCards(documentId) {
  const data = await loadData();
  return data.canvasCards.filter((card) => card.workspaceId === documentId);
}

async function seedDocumentPipeline(documentId) {
  const data = await loadData();
  const document = data.documents.find((item) => item.id === documentId);
  if (!document) {
    throw new Error('Document not found.');
  }

  const pages = [];
  const pageCount = document.pageCount > 0 ? document.pageCount : 5;

  for (let i = 0; i < pageCount; i += 1) {
    pages.push({
      id: nextId('ocr'),
      documentId,
      pageIndex: i,
      content: JSON.stringify({
        pageIndex: i,
        pageWidth: 595,
        pageHeight: 842,
        blocks: [
          {
            text: i === 0 ? 'INDEX OF DOCUMENTS' : i === 1 ? 'SYNOPSIS' : `Extracted content for page ${i + 1}`,
            left: 50,
            top: 90,
            width: 420,
            height: 24,
            confidence: 0.98,
          },
        ],
      }),
      isTranslation: false,
    });
  }

  const bookmarks = [
    normalizeBookmark({
      documentId,
      label: 'INDEX',
      subtitle: 'Auto-detected',
      type: 'section',
      startPage: 1,
      sortOrder: 0,
      isAutoIndexed: true,
    }),
    normalizeBookmark({
      documentId,
      label: 'SYNOPSIS',
      subtitle: 'Auto-detected',
      type: 'section',
      startPage: 2,
      sortOrder: 1,
      isAutoIndexed: true,
    }),
  ];

  const nextDocuments = replaceById(
    data.documents,
    documentId,
    normalizeDocument({
      ...document,
      ocrStatus: 'complete',
      ocrConfidence: 0.97,
      indexStatus: 'complete',
      lastOpened: nowIso(),
      tags: document.tags || [],
    }),
  );

  await saveData('ocrPages', [...data.ocrPages.filter((page) => page.documentId !== documentId), ...pages]);
  await saveData('bookmarks', [...data.bookmarks.filter((bookmark) => bookmark.documentId !== documentId), ...bookmarks]);
  await saveData('documents', nextDocuments);

  return {
    document: nextDocuments.find((entry) => entry.id === documentId),
    bookmarks,
    pages,
  };
}

const server = http.createServer(async (req, res) => {
  const { pathname, searchParams } = withSearchParams(req.url || '/');
  const documentMatch = matchRoute(pathname, '/api/documents/:id');
  const documentBookmarksMatch = matchRoute(pathname, '/api/documents/:id/bookmarks');
  const documentAnnotationsMatch = matchRoute(pathname, '/api/documents/:id/annotations');
  const documentCanvasCardsMatch = matchRoute(pathname, '/api/documents/:id/canvas-cards');
  const documentOcrMatch = matchRoute(pathname, '/api/documents/:id/pipeline/ocr');
  const documentIndexMatch = matchRoute(pathname, '/api/documents/:id/pipeline/index');
  const documentTranslateMatch = matchRoute(pathname, '/api/documents/:id/pipeline/translate');

  if (req.method === 'OPTIONS') {
    send(res, 204, {});
    return;
  }

  if (pathname === '/health' && req.method === 'GET') {
    send(res, 200, { ok: true, service: 'notelawbs-backend' });
    return;
  }

  if (pathname === '/auth/login' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (!email || !password) {
        send(res, 400, errorResponse('AUTH_INVALID_INPUT', 'Email and password are required.'));
        return;
      }

      const users = await loadUsers();
      const user = users.find((entry) => entry.email === email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        send(res, 401, errorResponse('AUTH_INVALID_CREDENTIALS', 'Invalid email or password.'));
        return;
      }

      const token = signToken(
        { sub: user.id, email: user.email, role: user.role, name: user.name },
        jwtSecret,
        tokenTtlSeconds,
      );

      send(res, 200, { token, user: publicUser(user) });
    } catch (error) {
      send(res, 400, errorResponse('AUTH_LOGIN_FAILED', error.message || 'Unable to log in.'));
    }
    return;
  }

  if (pathname === '/auth/me' && req.method === 'GET') {
    try {
      const { user } = await authUser(req);
      send(res, 200, { user: publicUser(user) });
    } catch (error) {
      send(res, 401, errorResponse('AUTH_SESSION_INVALID', error.message || 'Invalid session.'));
    }
    return;
  }

  if (pathname === '/api/bootstrap' && req.method === 'GET') {
    try {
      const { user } = await authUser(req);
      const data = await loadData();
      send(res, 200, {
        user: publicUser(user),
        documents: sortByDateDesc(data.documents, 'lastOpened'),
        bookmarks: data.bookmarks,
        annotations: data.annotations,
        canvasCards: data.canvasCards,
        connectors: data.connectors,
        settings: Object.fromEntries(data.settings.map((item) => [item.key, parseSettingValue(item.value)])),
        ocrPages: data.ocrPages,
      });
    } catch (error) {
      send(res, 401, errorResponse('AUTH_SESSION_INVALID', error.message || 'Invalid session.'));
    }
    return;
  }

  if (pathname === '/api/search' && req.method === 'GET') {
    try {
      await authUser(req);
      const data = await loadData();
      const query = String(searchParams.get('q') || '').trim().toLowerCase();
      if (!query) {
        send(res, 200, { results: [] });
        return;
      }

      const results = [];
      for (const document of data.documents) {
        if (document.title.toLowerCase().includes(query)) {
          results.push({
            document_id: document.id,
            page_index: 0,
            source: 'document',
            content: document.title,
            snippet: document.title,
          });
        }
      }

      for (const bookmark of data.bookmarks) {
        if (String(bookmark.label || '').toLowerCase().includes(query) || String(bookmark.subtitle || '').toLowerCase().includes(query)) {
          results.push({
            document_id: bookmark.documentId,
            page_index: Math.max(0, Number(bookmark.startPage || 1) - 1),
            source: 'bookmark',
            content: bookmark.label,
            snippet: `${bookmark.label}${bookmark.subtitle ? ` • ${bookmark.subtitle}` : ''}`,
          });
        }
      }

      for (const page of data.ocrPages) {
        const content = String(page.content || '');
        if (content.toLowerCase().includes(query)) {
          const json = JSON.parse(content);
          const firstBlock = json.blocks && json.blocks[0] ? json.blocks[0].text : '';
          results.push({
            document_id: page.documentId,
            page_index: Number(page.pageIndex || 0),
            source: page.isTranslation ? 'translation' : 'ocr',
            content: firstBlock,
            snippet: firstBlock || content.slice(0, 160),
          });
        }
      }

      send(res, 200, { results: results.slice(0, 80) });
    } catch (error) {
      send(res, 401, { error: error.message || 'Invalid session.' });
    }
    return;
  }

  if (pathname === '/api/settings' && req.method === 'GET') {
    try {
      await authUser(req);
      const data = await loadData();
      send(res, 200, {
        settings: Object.fromEntries(data.settings.map((item) => [item.key, parseSettingValue(item.value)])),
      });
    } catch (error) {
      send(res, 401, { error: error.message || 'Invalid session.' });
    }
    return;
  }

  const documentOcrPagesMatch = matchRoute(pathname, '/api/documents/:id/ocr-pages');
  if (documentOcrPagesMatch && req.method === 'GET') {
    try {
      await authUser(req);
      const data = await loadData();
      send(res, 200, {
        ocrPages: data.ocrPages.filter((page) => page.documentId === documentOcrPagesMatch.id),
      });
    } catch (error) {
      send(res, 401, { error: error.message || 'Invalid session.' });
    }
    return;
  }

  if (pathname === '/api/settings' && req.method === 'PUT') {
    try {
      await authUser(req);
      const body = await readBody(req);
      const data = await loadData();
      const merged = { ...Object.fromEntries(data.settings.map((item) => [item.key, parseSettingValue(item.value)])), ...body };
      const nextSettings = Object.entries(merged).map(([key, value]) => ({
        key,
        value: JSON.stringify(value),
      }));
      await saveData('settings', nextSettings);
      send(res, 200, { settings: merged });
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to update settings.' });
    }
    return;
  }

  if (pathname === '/api/documents' && req.method === 'GET') {
    try {
      await authUser(req);
      const data = await loadData();
      send(res, 200, { documents: sortByDateDesc(data.documents, 'lastOpened') });
    } catch (error) {
      send(res, 401, { error: error.message || 'Invalid session.' });
    }
    return;
  }

  if (pathname === '/api/documents' && req.method === 'POST') {
    try {
      await authUser(req);
      const body = await readBody(req);
      const data = await loadData();
      const validated = validateDocumentPayload(body);
      const nextDocument = normalizeDocument({ ...body, ...validated });
      const nextDocuments = [nextDocument, ...data.documents];
      await saveData('documents', nextDocuments);
      send(res, 201, { document: nextDocument });
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to create document.' });
    }
    return;
  }

  if (documentMatch && req.method === 'GET') {
    try {
      await authUser(req);
      const data = await loadData();
      const document = data.documents.find((item) => item.id === documentMatch.id);
      if (!document) {
        send(res, 404, { error: 'Document not found.' });
        return;
      }
      send(res, 200, { document });
    } catch (error) {
      send(res, 401, { error: error.message || 'Invalid session.' });
    }
    return;
  }

  if (documentMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
    try {
      await authUser(req);
      const body = await readBody(req);
      const data = await loadData();
      const existing = data.documents.find((item) => item.id === documentMatch.id);
      if (!existing) {
        send(res, 404, { error: 'Document not found.' });
        return;
      }
      const validated = body.title || body.filePath || body.file_path ? validateDocumentPayload({ ...existing, ...body }) : {};
      const updated = normalizeDocument({ ...existing, ...body, ...validated, id: existing.id, tags: body.tags || existing.tags });
      const nextDocuments = replaceById(data.documents, existing.id, updated);
      await saveData('documents', nextDocuments);
      send(res, 200, { document: updated });
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to update document.' });
    }
    return;
  }

  if (documentMatch && req.method === 'DELETE') {
    try {
      await authUser(req);
      const data = await loadData();
      const exists = data.documents.some((item) => item.id === documentMatch.id);
      if (!exists) {
        send(res, 404, { error: 'Document not found.' });
        return;
      }
      await saveData('documents', removeById(data.documents, documentMatch.id));
      await saveData('bookmarks', data.bookmarks.filter((item) => item.documentId !== documentMatch.id));
      await saveData('annotations', data.annotations.filter((item) => item.documentId !== documentMatch.id));
      await saveData('canvasCards', data.canvasCards.filter((item) => item.workspaceId !== documentMatch.id));
      await saveData('connectors', data.connectors.filter((item) => item.documentId !== documentMatch.id));
      await saveData('ocrPages', data.ocrPages.filter((item) => item.documentId !== documentMatch.id));
      send(res, 200, { ok: true });
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to delete document.' });
    }
    return;
  }

  if (documentBookmarksMatch && req.method === 'GET') {
    try {
      await authUser(req);
      send(res, 200, { bookmarks: await listDocumentBookmarks(documentBookmarksMatch.id) });
    } catch (error) {
      send(res, 401, { error: error.message || 'Invalid session.' });
    }
    return;
  }

  if (documentBookmarksMatch && req.method === 'POST') {
    try {
      await authUser(req);
      const body = await readBody(req);
      const data = await loadData();
      const validated = validateBookmarkPayload(body);
      const nextBookmark = normalizeBookmark({ ...body, ...validated, documentId: documentBookmarksMatch.id });
      const nextBookmarks = [...data.bookmarks, nextBookmark].sort((a, b) => a.sortOrder - b.sortOrder);
      await saveData('bookmarks', nextBookmarks);
      send(res, 201, { bookmark: nextBookmark });
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to create bookmark.' });
    }
    return;
  }

  const bookmarkMatch = matchRoute(pathname, '/api/bookmarks/:id');
  if (bookmarkMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
    try {
      await authUser(req);
      const body = await readBody(req);
      const data = await loadData();
      const existing = data.bookmarks.find((item) => item.id === bookmarkMatch.id);
      if (!existing) {
        send(res, 404, { error: 'Bookmark not found.' });
        return;
      }
      const validated = body.label || body.startPage || body.start_page ? validateBookmarkPayload({ ...existing, ...body }) : {};
      const updated = normalizeBookmark({ ...existing, ...body, ...validated, id: existing.id });
      await saveData('bookmarks', replaceById(data.bookmarks, existing.id, updated));
      send(res, 200, { bookmark: updated });
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to update bookmark.' });
    }
    return;
  }

  if (bookmarkMatch && req.method === 'DELETE') {
    try {
      await authUser(req);
      const data = await loadData();
      await saveData('bookmarks', removeById(data.bookmarks, bookmarkMatch.id));
      send(res, 200, { ok: true });
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to delete bookmark.' });
    }
    return;
  }

  if (documentAnnotationsMatch && req.method === 'GET') {
    try {
      await authUser(req);
      send(res, 200, { annotations: await listDocumentAnnotations(documentAnnotationsMatch.id) });
    } catch (error) {
      send(res, 401, { error: error.message || 'Invalid session.' });
    }
    return;
  }

  if (documentAnnotationsMatch && req.method === 'POST') {
    try {
      await authUser(req);
      const body = await readBody(req);
      const data = await loadData();
      const nextAnnotation = normalizeAnnotation({ ...body, documentId: documentAnnotationsMatch.id });
      await saveData('annotations', [...data.annotations, nextAnnotation]);
      send(res, 201, { annotation: nextAnnotation });
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to create annotation.' });
    }
    return;
  }

  const annotationMatch = matchRoute(pathname, '/api/annotations/:id');
  if (annotationMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
    try {
      await authUser(req);
      const body = await readBody(req);
      const data = await loadData();
      const existing = data.annotations.find((item) => item.id === annotationMatch.id);
      if (!existing) {
        send(res, 404, { error: 'Annotation not found.' });
        return;
      }
      const updated = normalizeAnnotation({ ...existing, ...body, id: existing.id });
      await saveData('annotations', replaceById(data.annotations, existing.id, updated));
      send(res, 200, { annotation: updated });
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to update annotation.' });
    }
    return;
  }

  if (annotationMatch && req.method === 'DELETE') {
    try {
      await authUser(req);
      const data = await loadData();
      await saveData('annotations', removeById(data.annotations, annotationMatch.id));
      send(res, 200, { ok: true });
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to delete annotation.' });
    }
    return;
  }

  if (documentCanvasCardsMatch && req.method === 'GET') {
    try {
      await authUser(req);
      send(res, 200, { canvasCards: await listDocumentCards(documentCanvasCardsMatch.id) });
    } catch (error) {
      send(res, 401, { error: error.message || 'Invalid session.' });
    }
    return;
  }

  if (documentCanvasCardsMatch && req.method === 'POST') {
    try {
      await authUser(req);
      const body = await readBody(req);
      const data = await loadData();
      const nextCard = normalizeCanvasCard({ ...body, workspaceId: documentCanvasCardsMatch.id });
      await saveData('canvasCards', [...data.canvasCards, nextCard]);
      send(res, 201, { canvasCard: nextCard });
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to create canvas card.' });
    }
    return;
  }

  const cardMatch = matchRoute(pathname, '/api/canvas-cards/:id');
  if (cardMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
    try {
      await authUser(req);
      const body = await readBody(req);
      const data = await loadData();
      const existing = data.canvasCards.find((item) => item.id === cardMatch.id);
      if (!existing) {
        send(res, 404, { error: 'Canvas card not found.' });
        return;
      }
      const updated = normalizeCanvasCard({ ...existing, ...body, id: existing.id });
      await saveData('canvasCards', replaceById(data.canvasCards, existing.id, updated));
      send(res, 200, { canvasCard: updated });
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to update canvas card.' });
    }
    return;
  }

  if (cardMatch && req.method === 'DELETE') {
    try {
      await authUser(req);
      const data = await loadData();
      await saveData('canvasCards', removeById(data.canvasCards, cardMatch.id));
      send(res, 200, { ok: true });
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to delete canvas card.' });
    }
    return;
  }

  if (documentOcrMatch && req.method === 'POST') {
    try {
      await authUser(req);
      const result = await seedDocumentPipeline(documentOcrMatch.id);
      send(res, 200, result);
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to run OCR pipeline.' });
    }
    return;
  }

  if (documentIndexMatch && req.method === 'POST') {
    try {
      await authUser(req);
      const result = await seedDocumentPipeline(documentIndexMatch.id);
      send(res, 200, result);
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to run indexing pipeline.' });
    }
    return;
  }

  if (documentTranslateMatch && req.method === 'POST') {
    try {
      await authUser(req);
      const data = await loadData();
      const pageIndex = Number(searchParams.get('pageIndex') || 0);
      const sourceLang = searchParams.get('sourceLang') || 'english';
      const existing = data.ocrPages.find(
        (page) => page.documentId === documentTranslateMatch.id && Number(page.pageIndex) === pageIndex && page.isTranslation,
      );
      if (existing) {
        send(res, 200, { page: JSON.parse(existing.content) });
        return;
      }
      const original = data.ocrPages.find(
        (page) => page.documentId === documentTranslateMatch.id && Number(page.pageIndex) === pageIndex && !page.isTranslation,
      );
      if (!original) {
        send(res, 404, { error: 'Source page not found.' });
        return;
      }
      const translatedPage = JSON.parse(original.content);
      translatedPage.blocks = translatedPage.blocks.map((block) => ({
        ...block,
        text: `[${sourceLang.toUpperCase()}→EN] ${block.text}`,
      }));
      const nextTranslation = {
        id: nextId('ocr'),
        documentId: documentTranslateMatch.id,
        pageIndex,
        content: JSON.stringify(translatedPage),
        isTranslation: true,
      };
      await saveData('ocrPages', [...data.ocrPages, nextTranslation]);
      send(res, 200, { page: translatedPage });
    } catch (error) {
      send(res, 400, { error: error.message || 'Unable to translate page.' });
    }
    return;
  }

  if (pathname === '/api/users' && req.method === 'GET') {
    try {
      const { user } = await authUser(req);
      if (user.role !== 'admin') {
        send(res, 403, { error: 'Admin access required.' });
        return;
      }
      const users = await loadUsers();
      send(res, 200, { users: users.map(publicUser) });
    } catch (error) {
      send(res, 401, { error: error.message || 'Invalid session.' });
    }
    return;
  }

  send(res, 404, { error: 'Not found.' });
});

async function start() {
  await ensureSeeds();
  server.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Failed to bootstrap backend:', error);
    process.exit(1);
  });
}

module.exports = {
  server,
  start,
};
