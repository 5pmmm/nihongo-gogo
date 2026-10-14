import { WordDefinition, GrammarDefinition, ReadingMaterial } from '../types';

export interface DailySearchItem {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'WORD' | 'GRAMMAR' | 'READING';
  term: string;
  summary: string;
  timestamp: number;
  data: WordDefinition[] | GrammarDefinition[] | ReadingMaterial;
}

const STORAGE_KEY = 'nihongo_gogo_daily_records_v2';

export const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getDailyRecords = (): DailySearchItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to read daily records:', e);
    return [];
  }
};

export const getTodayRecords = (): DailySearchItem[] => {
  const today = getTodayDateString();
  const all = getDailyRecords();
  return all.filter(item => item.date === today);
};

export const saveDailySearchRecord = (
  type: 'WORD' | 'GRAMMAR' | 'READING',
  term: string,
  summary: string,
  data: WordDefinition[] | GrammarDefinition[] | ReadingMaterial
): DailySearchItem => {
  const all = getDailyRecords();
  const today = getTodayDateString();

  // If already exists for today with same term and type, update it
  const existingIdx = all.findIndex(item => item.date === today && item.type === type && item.term === term);
  
  const newItem: DailySearchItem = {
    id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: today,
    type,
    term,
    summary,
    timestamp: Date.now(),
    data
  };

  if (existingIdx >= 0) {
    all[existingIdx] = newItem;
  } else {
    all.unshift(newItem);
  }

  // Keep latest 200 records
  const trimmed = all.slice(0, 200);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.error('Failed to write daily records:', e);
    }
  }

  return newItem;
};

export const deleteDailyRecord = (id: string): void => {
  const all = getDailyRecords();
  const filtered = all.filter(item => item.id !== id);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to delete daily record:', e);
    }
  }
};

export const clearTodayRecords = (): void => {
  const today = getTodayDateString();
  const all = getDailyRecords();
  const filtered = all.filter(item => item.date !== today);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to clear today records:', e);
    }
  }
};
