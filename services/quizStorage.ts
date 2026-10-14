import { QuizQuestion } from '../types';

export interface SavedQuizResult {
  id: string;
  timestamp: number;
  date: string;
  totalQuestions: number;
  correctCount: number;
  scorePercentage: number;
  testedTerms: string[];
}

const QUIZ_HISTORY_KEY = 'nihongo_gogo_quiz_history_v1';

// Helper predicate functions supporting both category and subType
export const isListeningQuestion = (q: QuizQuestion): boolean =>
  q.type === 'LISTENING' || q.type === 'listening' || q.subType === 'listening';

export const isVocabQuestion = (q: QuizQuestion): boolean =>
  q.type === 'VOCAB' || q.type === 'vocab' || q.subType === 'vocab';

export const isGrammarReadingQuestion = (q: QuizQuestion): boolean =>
  q.type === 'GRAMMAR_READING' ||
  q.type === 'grammar' ||
  q.type === 'ordering' ||
  q.type === 'reading' ||
  q.subType === 'grammar' ||
  q.subType === 'ordering' ||
  q.subType === 'reading';

export const saveQuizResult = (result: Omit<SavedQuizResult, 'id' | 'timestamp'>): SavedQuizResult => {
  const all = getQuizHistory();
  const newEntry: SavedQuizResult = {
    ...result,
    id: `quiz-res-${Date.now()}`,
    timestamp: Date.now()
  };
  all.unshift(newEntry);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(all.slice(0, 50)));
    } catch (e) {
      console.error('Failed to save quiz result:', e);
    }
  }
  return newEntry;
};

export const getQuizHistory = (): SavedQuizResult[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUIZ_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to read quiz history:', e);
    return [];
  }
};
