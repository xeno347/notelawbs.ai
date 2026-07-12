import { create } from 'zustand';
import { Document } from '../../models/types';
import { listDocuments, createDocument, updateDocument as updateDocumentApi, deleteDocument } from '../auth/backendApi';
import { useAuth } from '../auth/useAuth';
import { useSettings } from '../settings/useSettings';

interface DocumentLibraryState {
  documents: Document[];
  isLoading: boolean;
  fetchDocuments: () => Promise<void>;
  addDocument: (doc: Document) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  updateDocument: (id: string, updates: Partial<Document>) => Promise<void>;
}

const normalize = (doc: any): Document => ({
  ...doc,
  pageCount: Number(doc.pageCount ?? doc.page_count ?? 0),
  fileSizeBytes: Number(doc.fileSizeBytes ?? doc.file_size_bytes ?? 0),
  ocrConfidence: Number(doc.ocrConfidence ?? doc.ocr_confidence ?? 0),
  tags: Array.isArray(doc.tags) ? doc.tags : JSON.parse(doc.tags || '[]'),
});

export const useDocumentLibrary = create<DocumentLibraryState>((set, get) => ({
  documents: [],
  isLoading: false,
  fetchDocuments: async () => {
    set({ isLoading: true });
    try {
      const { settings } = useSettings.getState();
      const { token } = useAuth.getState();
      if (!token) {
        set({ documents: [], isLoading: false });
        return;
      }

      const res = await listDocuments(settings.backendUrl, token);
      set({ documents: res.documents.map(normalize), isLoading: false });
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      set({ isLoading: false });
    }
  },
  addDocument: async (doc) => {
    try {
      const { settings } = useSettings.getState();
      const { token } = useAuth.getState();
      if (!token) return;
      const response = await createDocument(settings.backendUrl, token, doc);
      set({ documents: [normalize(response.document), ...get().documents] });
    } catch (error) {
      console.error('Failed to add document:', error);
    }
  },
  removeDocument: async (id) => {
    try {
      const { settings } = useSettings.getState();
      const { token } = useAuth.getState();
      if (!token) return;
      await deleteDocument(settings.backendUrl, token, id);
      set({ documents: get().documents.filter((d) => d.id !== id) });
    } catch (error) {
      console.error('Failed to remove document:', error);
    }
  },
  updateDocument: async (id, updates) => {
    try {
      const { settings } = useSettings.getState();
      const { token } = useAuth.getState();
      if (!token) return;
      const response = await updateDocumentApi(settings.backendUrl, token, id, updates);
      set({ documents: get().documents.map((d) => (d.id === id ? normalize(response.document) : d)) });
    } catch (error) {
      console.error('Failed to update document:', error);
    }
  },
}));
