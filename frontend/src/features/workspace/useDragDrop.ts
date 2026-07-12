import { create } from 'zustand';

interface DragDropState {
  draggedText: string | null;
  draggedSource: any | null;
  setDragged: (text: string | null, source?: any) => void;
}

export const useDragDrop = create<DragDropState>((set) => ({
  draggedText: null,
  draggedSource: null,
  setDragged: (text, source) => set({ draggedText: text, draggedSource: source || null }),
}));
