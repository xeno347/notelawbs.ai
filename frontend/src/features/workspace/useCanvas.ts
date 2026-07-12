import { create } from 'zustand';
import { CanvasCard, Connector } from '../../models/types';
import { useAuth } from '../auth/useAuth';
import { useSettings } from '../settings/useSettings';
import { createCanvasCard, createDocument, deleteCanvasCard, listCanvasCards, updateCanvasCard } from '../auth/backendApi';
import { createId } from '../../utils/id';

interface CanvasState {
  cards: CanvasCard[];
  connectors: Connector[];
  fetchCanvasData: (workspaceId: string) => Promise<void>;
  addCard: (card: CanvasCard) => Promise<void>;
  updateCard: (id: string, updates: Partial<CanvasCard>) => Promise<void>;
  addConnector: (connector: Omit<Connector, 'id'>) => Promise<void>;
  removeConnector: (id: string) => Promise<void>;
}

export const useCanvas = create<CanvasState>((set, get) => ({
  cards: [],
  connectors: [],
  fetchCanvasData: async (workspaceId) => {
    try {
      const { settings } = useSettings.getState();
      const { token } = useAuth.getState();
      if (!token) return;
      const results = await listCanvasCards(settings.backendUrl, token, workspaceId);
      set({
        cards: results.canvasCards,
        connectors: [],
      });
    } catch (error) {
      console.error('Failed to fetch canvas cards:', error);
    }
  },
  addCard: async (card) => {
    try {
      const { settings } = useSettings.getState();
      const { token } = useAuth.getState();
      if (!token) return;
      await createCanvasCard(settings.backendUrl, token, card.workspaceId, card);
      set({ cards: [...get().cards, card] });
    } catch (error) {
      console.error('Failed to add card:', error);
    }
  },
  updateCard: async (id, updates) => {
    try {
      const { settings } = useSettings.getState();
      const { token } = useAuth.getState();
      if (!token) return;
      await updateCanvasCard(settings.backendUrl, token, id, updates);
      set({
        cards: get().cards.map((card) => (card.id === id ? { ...card, ...updates } : card)),
      });
    } catch (error) {
      console.error('Failed to update card:', error);
    }
  },
  addConnector: async (connector) => {
    set({ connectors: [...get().connectors, { ...connector, id: createId('conn') }] as any });
  },
  removeConnector: async (id) => {
    set({ connectors: get().connectors.filter((c: any) => c.id !== id) as any });
  },
}));
