import { create } from 'zustand';
import { Annotation } from '../../models/types';
import { useAuth } from '../auth/useAuth';
import { useSettings } from '../settings/useSettings';
import { createAnnotation, deleteAnnotation, listAnnotations } from '../auth/backendApi';

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
      const { settings } = useSettings.getState();
      const { token } = useAuth.getState();
      if (!token) return;
      const results = await listAnnotations(settings.backendUrl, token, documentId);
      set({ annotations: results.annotations });
    } catch (error) {
      console.error('Failed to fetch annotations:', error);
    }
  },
  addAnnotation: async (annotation) => {
    try {
      const { settings } = useSettings.getState();
      const { token } = useAuth.getState();
      if (!token) return;
      await createAnnotation(settings.backendUrl, token, annotation.documentId, annotation);
      set({ annotations: [...get().annotations, annotation] });
    } catch (error) {
      console.error('Failed to add annotation:', error);
    }
  },
  removeAnnotation: async (id) => {
    try {
      const { settings } = useSettings.getState();
      const { token } = useAuth.getState();
      if (!token) return;
      await deleteAnnotation(settings.backendUrl, token, id);
      set({ annotations: get().annotations.filter((a) => a.id !== id) });
    } catch (error) {
      console.error('Failed to remove annotation:', error);
    }
  },
}));
