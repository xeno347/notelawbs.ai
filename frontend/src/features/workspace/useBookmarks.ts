import { create } from 'zustand';
import { Bookmark, BookmarkFilter } from '../../models/types';
import { useAuth } from '../auth/useAuth';
import { useSettings } from '../settings/useSettings';
import { createBookmark, deleteBookmark, listBookmarks, updateBookmark as updateBookmarkApi } from '../auth/backendApi';

interface BookmarksState {
  bookmarks: Bookmark[];
  filter: BookmarkFilter;
  setFilter: (filter: BookmarkFilter) => void;
  fetchBookmarks: (documentId: string) => Promise<void>;
  addBookmark: (bookmark: Bookmark) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
  updateBookmark: (id: string, updates: Partial<Bookmark>) => Promise<void>;
}

export const useBookmarks = create<BookmarksState>((set, get) => ({
  bookmarks: [],
  filter: BookmarkFilter.all,
  setFilter: (filter) => set({ filter }),
  fetchBookmarks: async (documentId) => {
    try {
      const { settings } = useSettings.getState();
      const { token } = useAuth.getState();
      if (!token) return;
      const results = await listBookmarks(settings.backendUrl, token, documentId);
      set({ bookmarks: results.bookmarks });
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
    }
  },
  addBookmark: async (bookmark) => {
    try {
      const { settings } = useSettings.getState();
      const { token } = useAuth.getState();
      if (!token) return;
      await createBookmark(settings.backendUrl, token, bookmark.documentId, bookmark);
      set({ bookmarks: [...get().bookmarks, bookmark].sort((a, b) => a.sortOrder - b.sortOrder) });
    } catch (error) {
      console.error('Failed to add bookmark:', error);
    }
  },
  removeBookmark: async (id) => {
    try {
      const { settings } = useSettings.getState();
      const { token } = useAuth.getState();
      if (!token) return;
      await deleteBookmark(settings.backendUrl, token, id);
      set({ bookmarks: get().bookmarks.filter((b) => b.id !== id) });
    } catch (error) {
      console.error('Failed to remove bookmark:', error);
    }
  },
  updateBookmark: async (id, updates) => {
    try {
      const { settings } = useSettings.getState();
      const { token } = useAuth.getState();
      if (!token) return;
      await updateBookmarkApi(settings.backendUrl, token, id, updates);
      set({
        bookmarks: get().bookmarks.map((b) => (b.id === id ? { ...b, ...updates } : b)).sort((a, b) => a.sortOrder - b.sortOrder),
      });
    } catch (error) {
      console.error('Failed to update bookmark:', error);
    }
  },
}));
