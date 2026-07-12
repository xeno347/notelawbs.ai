export interface BackendUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  user: BackendUser;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const joinUrl = (baseUrl: string, path: string) => `${baseUrl.replace(/\/$/, '')}${path}`;

export async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(joinUrl(baseUrl, path), {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(payload.error || 'Request failed.', response.status);
    }

    return payload as T;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new ApiError('Request timed out. Please try again.', 408);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const login = (baseUrl: string, email: string, password: string) =>
  request<LoginResponse>(baseUrl, '/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const me = (baseUrl: string, token: string) =>
  request<{ user: BackendUser }>(baseUrl, '/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export interface BootstrapResponse {
  user: BackendUser;
  documents: any[];
  bookmarks: any[];
  annotations: any[];
  canvasCards: any[];
  connectors: any[];
  settings: Record<string, any>;
  ocrPages: any[];
}

export const bootstrap = (baseUrl: string, token: string) =>
  request<BootstrapResponse>(baseUrl, '/api/bootstrap', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

export const listDocuments = (baseUrl: string, token: string) =>
  request<{ documents: any[] }>(baseUrl, '/api/documents', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

export const createDocument = (baseUrl: string, token: string, document: any) =>
  request<{ document: any }>(baseUrl, '/api/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(document),
  });

export const updateDocument = (baseUrl: string, token: string, id: string, document: any) =>
  request<{ document: any }>(baseUrl, `/api/documents/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(document),
  });

export const deleteDocument = (baseUrl: string, token: string, id: string) =>
  request<{ ok: boolean }>(baseUrl, `/api/documents/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

export const listBookmarks = (baseUrl: string, token: string, documentId: string) =>
  request<{ bookmarks: any[] }>(baseUrl, `/api/documents/${documentId}/bookmarks`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

export const createBookmark = (baseUrl: string, token: string, documentId: string, bookmark: any) =>
  request<{ bookmark: any }>(baseUrl, `/api/documents/${documentId}/bookmarks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(bookmark),
  });

export const updateBookmark = (baseUrl: string, token: string, id: string, bookmark: any) =>
  request<{ bookmark: any }>(baseUrl, `/api/bookmarks/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(bookmark),
  });

export const deleteBookmark = (baseUrl: string, token: string, id: string) =>
  request<{ ok: boolean }>(baseUrl, `/api/bookmarks/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

export const listAnnotations = (baseUrl: string, token: string, documentId: string) =>
  request<{ annotations: any[] }>(baseUrl, `/api/documents/${documentId}/annotations`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

export const createAnnotation = (baseUrl: string, token: string, documentId: string, annotation: any) =>
  request<{ annotation: any }>(baseUrl, `/api/documents/${documentId}/annotations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(annotation),
  });

export const deleteAnnotation = (baseUrl: string, token: string, id: string) =>
  request<{ ok: boolean }>(baseUrl, `/api/annotations/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

export const listCanvasCards = (baseUrl: string, token: string, workspaceId: string) =>
  request<{ canvasCards: any[] }>(baseUrl, `/api/documents/${workspaceId}/canvas-cards`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

export const listOcrPages = (baseUrl: string, token: string, documentId: string) =>
  request<{ ocrPages: any[] }>(baseUrl, `/api/documents/${documentId}/ocr-pages`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

export const createCanvasCard = (baseUrl: string, token: string, workspaceId: string, card: any) =>
  request<{ canvasCard: any }>(baseUrl, `/api/documents/${workspaceId}/canvas-cards`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(card),
  });

export const updateCanvasCard = (baseUrl: string, token: string, id: string, card: any) =>
  request<{ canvasCard: any }>(baseUrl, `/api/canvas-cards/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(card),
  });

export const deleteCanvasCard = (baseUrl: string, token: string, id: string) =>
  request<{ ok: boolean }>(baseUrl, `/api/canvas-cards/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

export const getSettings = (baseUrl: string, token: string) =>
  request<{ settings: Record<string, any> }>(baseUrl, '/api/settings', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

export const search = (baseUrl: string, token: string, query: string) =>
  request<{ results: any[] }>(baseUrl, `/api/search?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

export const updateSettings = (baseUrl: string, token: string, settings: Record<string, any>) =>
  request<{ settings: Record<string, any> }>(baseUrl, '/api/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(settings),
  });

export const runOcrPipeline = (baseUrl: string, token: string, documentId: string) =>
  request<any>(baseUrl, `/api/documents/${documentId}/pipeline/ocr`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

export const runIndexPipeline = (baseUrl: string, token: string, documentId: string) =>
  request<any>(baseUrl, `/api/documents/${documentId}/pipeline/index`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
