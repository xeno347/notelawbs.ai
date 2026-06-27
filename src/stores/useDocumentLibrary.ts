import { create } from 'zustand';
import { Document } from '../models/types';
import { db } from '../db';
import { documents } from '../db/schema';
import { eq } from 'drizzle-orm';

interface DocumentLibraryState {
  documents: Document[];
  isLoading: boolean;
  fetchDocuments: () => Promise<void>;
  addDocument: (doc: Document) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  updateDocument: (id: string, updates: Partial<Document>) => Promise<void>;
}

export const useDocumentLibrary = create<DocumentLibraryState>((set, get) => ({
  documents: [],
  isLoading: false,
  fetchDocuments: async () => {
    set({ isLoading: true });
    try {
      const docs = await db.query.documents.findMany();
      // Need to parse tags JSON if it's stored as string
      const parsedDocs: Document[] = docs.map(d =\u003e ({
        ...d,
        tags: JSON.parse(d.tags),
      })) as any;
      set({ documents: parsedDocs, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      set({ isLoading: false });
    }
  },
  addDocument: async (doc) => {
    try {
      await db.insert(documents).values({
        ...doc,
        tags: JSON.stringify(doc.tags),
      });
      set({ documents: [...get().documents, doc] });
    } catch (error) {
      console.error('Failed to add document:', error);
    }
  },
  removeDocument: async (id) => {
    try {
      await db.delete(documents).where(eq(documents.id, id));
      set({ documents: get().documents.filter((d) => d.id !== id) });
    } catch (error) {
      console.error('Failed to remove document:', error);
    }
  },
  updateDocument: async (id, updates) => {
    try {
      const valuesToUpdate = { ...updates } as any;
      if (updates.tags) {
        valuesToUpdate.tags = JSON.stringify(updates.tags);
      }
      await db.update(documents).set(valuesToUpdate).where(eq(documents.id, id));
      set({
        documents: get().documents.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      });
    } catch (error) {
      console.error('Failed to update document:', error);
    }
  },
}));
