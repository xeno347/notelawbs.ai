import { create } from 'zustand';
import { CanvasCard, Connector } from '../models/types';
import { db } from '../db';
import { canvasCards } from '../db/schema';
import { eq } from 'drizzle-orm';

interface CanvasState {
  cards: CanvasCard[];
  connectors: Connector[];
  fetchCanvasData: (workspaceId: string) => Promise<void>;
  addCard: (card: CanvasCard) => Promise<void>;
  updateCard: (id: string, updates: Partial<CanvasCard>) => Promise<void>;
}

export const useCanvas = create<CanvasState>((set, get) => ({
  cards: [],
  connectors: [],
  fetchCanvasData: async (workspaceId) => {
    try {
      const results = await db.query.canvasCards.findMany({
        where: eq(canvasCards.workspaceId, workspaceId),
      });
      // Convert flat schema back to nested models
      const parsedCards: CanvasCard[] = results.map(r => ({
        id: r.id,
        workspaceId: r.workspaceId,
        type: r.type as any,
        position: { x: r.positionX, y: r.positionY },
        size: { width: r.width, height: r.height },
        content: r.content,
        sourceDocumentId: r.sourceDocumentId || undefined,
        sourcePageIndex: r.sourcePageIndex || undefined,
        sourceTextRange: (r.sourceTextRangeStart !== null && r.sourceTextRangeEnd !== null) ? {
          start: r.sourceTextRangeStart,
          end: r.sourceTextRangeEnd
        } : undefined,
        accentColor: r.accentColor,
        isPinned: r.isPinned,
        isBold: r.isBold,
        isUnderline: r.isUnderline,
        textHighlight: r.textHighlight as any,
        createdAt: r.createdAt,
      }));
      set({ cards: parsedCards });
    } catch (error) {
      console.error('Failed to fetch canvas cards:', error);
    }
  },
  addCard: async (card) => {
    try {
      await db.insert(canvasCards).values({
        id: card.id,
        workspaceId: card.workspaceId,
        type: card.type,
        positionX: card.position.x,
        positionY: card.position.y,
        width: card.size.width,
        height: card.size.height,
        content: card.content,
        sourceDocumentId: card.sourceDocumentId,
        sourcePageIndex: card.sourcePageIndex,
        sourceTextRangeStart: card.sourceTextRange?.start,
        sourceTextRangeEnd: card.sourceTextRange?.end,
        accentColor: card.accentColor,
        isPinned: card.isPinned,
        isBold: card.isBold,
        isUnderline: card.isUnderline,
        textHighlight: card.textHighlight,
        createdAt: card.createdAt,
      });
      set({ cards: [...get().cards, card] });
    } catch (error) {
      console.error('Failed to add card:', error);
    }
  },
  updateCard: async (id, updates) => {
    // Implementation for updating card position/size/etc.
    set({
      cards: get().cards.map(c => c.id === id ? { ...c, ...updates } : c)
    });
  }
}));
