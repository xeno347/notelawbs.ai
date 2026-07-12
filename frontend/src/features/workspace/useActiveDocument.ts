import { create } from 'zustand';
import { Document, DocumentTextMode } from '../../models/types';

interface ActiveDocumentState {
  activeDocument: Document | null;
  setActiveDocument: (doc: Document | null) => void;
  textMode: DocumentTextMode;
  setTextMode: (mode: DocumentTextMode) => void;
}

export const useActiveDocument = create<ActiveDocumentState>((set) => ({
  activeDocument: null,
  setActiveDocument: (doc) => set({ activeDocument: doc }),
  textMode: DocumentTextMode.original,
  setTextMode: (mode) => set({ textMode: mode }),
}));
