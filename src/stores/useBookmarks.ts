import { create } from 'zustand';
import { Bookmark, BookmarkFilter } from '../models/types';
import { db } from '../db';
import { bookmarks } from '../db/schema';
import { eq, and } from 'drizzle-orm';

interface BookmarksState {
  bookmarks: Bookmark[];
  filter: BookmarkFilter;
  setFilter: (filter: BookmarkFilter) => void;
  fetchBookmarks: (documentId: string) => Promise<void>;
  addBookmark: (bookmark: Bookmark) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
}

export const useBookmarks = create<BookmarksState>((set, get) => ({
  bookmarks: [],
  filter: BookmarkFilter.all,
  setFilter: (filter) => set({ filter }),
  fetchBookmarks: async (documentId) => {
    try {
      const results = await db.query.bookmarks.findMany({
        where: eq(bookmarks.documentId, documentId),
        orderBy: (bookmarks, { asc }) => [asc(bookmarks.sortOrder)],
      });
      set({ bookmarks: results as any });
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
    }
  },
  addBookmark: async (bookmark) => {
    try {
      await db.insert(bookmarks).values(bookmark);
      set({ bookmarks: [...get().bookmarks, bookmark].sort((a, b) => a.sortOrder - b.sortOrder) });
    } catch (error) {
      console.error('Failed to add bookmark:', error);
    }
  },
  removeBookmark: async (id) => {
    try {
      await db.delete(bookmarks).where(eq(bookmarks.id, id));
      set({ bookmarks: get().bookmarks.filter((b) => b.id !== id) });
    } catch (error) {
      console.error('Failed to remove bookmark:', error);
    }
  },
}));
