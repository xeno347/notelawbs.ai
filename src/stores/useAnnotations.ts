import { create } from 'zustand';
import { Annotation } from '../models/types';
import { db } from '../db';
import { annotations } from '../db/schema';
import { eq } from 'drizzle-orm';

interface AnnotationsState {
  annotations: Annotation[];
  fetchAnnotations: (documentId: string) => Promise<void>;
  addAnnotation: (annotation: Annotation) => Promise<void>;
  removeAnnotation: (id: string) => Promise<void>;
}

export const useAnnotations = create<AnnotationsState>((set, get) => ({
  annotations: [],
  fetchAnnotations: async (documentId) => {
    try {
      const results = await db.query.annotations.findMany({
        where: eq(annotations.documentId, documentId),
      });
      const parsed: Annotation[] = results.map(r => ({
        ...r,
        boundingRect: JSON.parse(r.boundingRect),
        color: r.color as any,
        createdAt: r.createdAt,
        textRange: { start: r.textRangeStart, end: r.textRangeEnd }
      }));
      set({ annotations: parsed });
    } catch (error) {
      console.error('Failed to fetch annotations:', error);
    }
  },
  addAnnotation: async (annotation) => {
    try {
      await db.insert(annotations).values({
        id: annotation.id,
        documentId: annotation.documentId,
        pageIndex: annotation.pageIndex,
        textRangeStart: annotation.textRange.start,
        textRangeEnd: annotation.textRange.end,
        boundingRect: JSON.stringify(annotation.boundingRect),
        color: annotation.color,
        comment: annotation.comment,
        linkedCanvasCardId: annotation.linkedCanvasCardId,
        createdAt: annotation.createdAt,
        underline: annotation.underline,
        bold: annotation.bold,
      });
      set({ annotations: [...get().annotations, annotation] });
    } catch (error) {
      console.error('Failed to add annotation:', error);
    }
  },
  removeAnnotation: async (id) => {
    try {
      await db.delete(annotations).where(eq(annotations.id, id));
      set({ annotations: get().annotations.filter(a => a.id !== id) });
    } catch (error) {
      console.error('Failed to remove annotation:', error);
    }
  }
}));
