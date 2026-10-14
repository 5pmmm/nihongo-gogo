import { WordDefinition, GrammarDefinition } from '../types';

export interface BookmarkItem {
  id: string;
  type: 'WORD' | 'GRAMMAR';
  title: string;
  data: WordDefinition | GrammarDefinition;
  savedAt: number;
}

const STORAGE_KEY = 'nihongo_gogo_bookmarks_v1';

export const getBookmarks = (): BookmarkItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to read bookmarks:', e);
    return [];
  }
};

export const saveBookmarks = (items: BookmarkItem[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to write bookmarks:', e);
  }
};

export const toggleBookmark = (item: {
  type: 'WORD' | 'GRAMMAR';
  title: string;
  data: WordDefinition | GrammarDefinition;
}): boolean => {
  const current = getBookmarks();
  const existingIndex = current.findIndex(b => b.title === item.title && b.type === item.type);
  if (existingIndex >= 0) {
    current.splice(existingIndex, 1);
    saveBookmarks(current);
    return false; // Removed
  } else {
    const newItem: BookmarkItem = {
      id: `${item.type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: item.type,
      title: item.title,
      data: item.data,
      savedAt: Date.now()
    };
    current.unshift(newItem);
    saveBookmarks(current);
    return true; // Added
  }
};

export const isItemBookmarked = (title: string, type: 'WORD' | 'GRAMMAR'): boolean => {
  const current = getBookmarks();
  return current.some(b => b.title === title && b.type === type);
};
