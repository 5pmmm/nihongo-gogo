import { QuizQuestion } from '../types';
import { jlptQuestionsBank } from '../data/jlptQuestionsBank';

const CACHE_KEY = 'nihongo_gogo_jlpt_350_questions_v5';

// Helper predicate functions supporting both category ('VOCAB' | 'GRAMMAR_READING' | 'LISTENING') and subType
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

/**
 * Initializes and retrieves the 350 JLPT question bank from LocalStorage.
 * If not yet cached, saves the static 350-question pool into LocalStorage.
 */
export const initJlptQuestionsCache = (): QuizQuestion[] => {
  if (typeof window === 'undefined') return jlptQuestionsBank;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(jlptQuestionsBank));
      return jlptQuestionsBank;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length >= 350 && parsed[0]?.year) {
      return parsed as QuizQuestion[];
    }
    // Update cache if incomplete or version upgraded
    localStorage.setItem(CACHE_KEY, JSON.stringify(jlptQuestionsBank));
    return jlptQuestionsBank;
  } catch (e) {
    console.error('Failed to access localStorage for quiz cache:', e);
    return jlptQuestionsBank;
  }
};

export interface QuizFilterOptions {
  level?: string;
  type?: string;
  section?: string; // 'ALL' | 'LANGUAGE_KNOWLEDGE' | 'VOCAB' | 'GRAMMAR_READING' | 'LISTENING'
  count?: number;
}

/**
 * Retrieves questions with structure-aware and cross-year randomized sampling.
 * 各等級上限題數與結構規範：
 * - N1: 言語知識 50 題 / 聽解 20 題（總上限 70 題）
 * - N2: 言語知識 50 題 / 聽解 20 題（總上限 70 題）
 * - N3: 言語知識（文字語彙）30 題 / 言語知識（文法讀解）20 題 / 聽解 20 題（總上限 70 題）
 * - N4: 言語知識（文字語彙）30 題 / 言語知識（文法讀解）20 題 / 聽解 20 題（總上限 70 題）
 * - N5: 言語知識（文字語彙）30 題 / 言語知識（文法讀解）20 題 / 聽解 20 題（總上限 70 題）
 */
export const getCachedQuestions = (filters?: QuizFilterOptions): QuizQuestion[] => {
  const bank = initJlptQuestionsCache();
  const targetLevel = (filters?.level && filters.level !== 'ALL' && filters.level !== '隨機' && filters.level !== '不限')
    ? filters.level.toUpperCase()
    : 'N3';

  // Level pool
  let levelPool = bank.filter(q => q.level?.toUpperCase() === targetLevel);
  if (levelPool.length === 0) {
    levelPool = bank;
  }

  const section = filters?.section || 'ALL';
  const specificType = filters?.type;

  // Function to perform cross-year stratified sampling on a subset of questions
  const sampleFromPool = (subset: QuizQuestion[], count: number): QuizQuestion[] => {
    if (subset.length <= count) {
      // Shuffle and return all
      const arr = [...subset];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    // Group by year
    const yearGroups: { [year: string]: QuizQuestion[] } = {};
    for (const q of subset) {
      const y = q.year || '標準真題';
      if (!yearGroups[y]) yearGroups[y] = [];
      yearGroups[y].push(q);
    }

    // Shuffle within each year group
    for (const y in yearGroups) {
      const arr = yearGroups[y];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }

    const selected: QuizQuestion[] = [];
    const yearsList = Object.keys(yearGroups);
    // Shuffle years
    for (let i = yearsList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [yearsList[i], yearsList[j]] = [yearsList[j], yearsList[i]];
    }

    let yearIdx = 0;
    while (selected.length < count) {
      const availableYears = yearsList.filter(y => yearGroups[y] && yearGroups[y].length > 0);
      if (availableYears.length === 0) break;
      const currentYear = availableYears[yearIdx % availableYears.length];
      const picked = yearGroups[currentYear].pop();
      if (picked) selected.push(picked);
      yearIdx++;
    }

    return selected;
  };

  // If specific individual type requested (e.g. only 'ordering' or 'vocab')
  if (specificType && specificType !== 'ALL') {
    const typePool = levelPool.filter(q =>
      q.subType === specificType ||
      q.type === specificType ||
      (specificType === 'VOCAB' && isVocabQuestion(q)) ||
      (specificType === 'GRAMMAR_READING' && isGrammarReadingQuestion(q)) ||
      (specificType === 'LISTENING' && isListeningQuestion(q))
    );
    const targetCount = Math.min(filters?.count || 15, typePool.length);
    return sampleFromPool(typePool, targetCount);
  }

  // Section-based sampling
  const isN1orN2 = targetLevel === 'N1' || targetLevel === 'N2';
  const reqCount = filters?.count;

  if (section === 'LISTENING') {
    // 聽解 (上限 20 題)
    const listeningPool = levelPool.filter(isListeningQuestion);
    const targetCount = reqCount ? Math.min(reqCount, 20) : 20;
    return sampleFromPool(listeningPool, targetCount);
  }

  if (section === 'VOCAB') {
    // 文字・語彙 (N3-N5 上限 30 題, N1-N2 上限 20 題)
    const vocabPool = levelPool.filter(isVocabQuestion);
    const cap = isN1orN2 ? 20 : 30;
    const targetCount = reqCount ? Math.min(reqCount, cap) : cap;
    return sampleFromPool(vocabPool, targetCount);
  }

  if (section === 'GRAMMAR_READING') {
    // 文法・讀解 (N3-N5 上限 20 題：文法 + 重組 + 讀解)
    const grPool = levelPool.filter(isGrammarReadingQuestion);
    const targetCount = reqCount ? Math.min(reqCount, 20) : 20;
    return sampleFromPool(grPool, targetCount);
  }

  if (section === 'LANGUAGE_KNOWLEDGE') {
    // 言語知識 (N1/N2: 50 題; N3-N5: 文字語彙 30 題 + 文法讀解 20 題 = 50 題)
    const lkPool = levelPool.filter(q => !isListeningQuestion(q));
    const targetCount = reqCount ? Math.min(reqCount, 50) : 50;

    if (isN1orN2) {
      return sampleFromPool(lkPool, targetCount);
    } else {
      // Balanced for N3-N5: 30 vocab + 20 grammar/reading
      const vocabPool = levelPool.filter(isVocabQuestion);
      const grPool = levelPool.filter(isGrammarReadingQuestion);
      const ratio = targetCount / 50;
      const vCount = Math.round(30 * ratio);
      const grCount = targetCount - vCount;
      const vSelected = sampleFromPool(vocabPool, vCount);
      const grSelected = sampleFromPool(grPool, grCount);
      const combined = [...vSelected, ...grSelected];
      // Keep section order: vocab first, then grammar/reading
      return combined;
    }
  }

  // section === 'ALL' (全卷全真模考，總上限 70 題)
  if (!reqCount || reqCount >= 70) {
    if (isN1orN2) {
      // N1/N2: 言語知識 50 題 + 聽解 20 題
      const lkPool = levelPool.filter(q => !isListeningQuestion(q));
      const lisPool = levelPool.filter(isListeningQuestion);
      const lkSelected = sampleFromPool(lkPool, 50);
      const lisSelected = sampleFromPool(lisPool, 20);
      return [...lkSelected, ...lisSelected];
    } else {
      // N3/N4/N5: 言語知識（文字語彙）30 題 + 言語知識（文法讀解）20 題 + 聽解 20 題
      const vocabPool = levelPool.filter(isVocabQuestion);
      const grPool = levelPool.filter(isGrammarReadingQuestion);
      const lisPool = levelPool.filter(isListeningQuestion);

      const vSelected = sampleFromPool(vocabPool, 30);
      const grSelected = sampleFromPool(grPool, 20);
      const lisSelected = sampleFromPool(lisPool, 20);
      return [...vSelected, ...grSelected, ...lisSelected];
    }
  }

  // Custom lower count (e.g. 10, 15, 20, 30) for ALL mode: proportional representation
  const lkPool = levelPool.filter(q => !isListeningQuestion(q));
  const lisPool = levelPool.filter(isListeningQuestion);
  const lisRatio = 20 / 70;
  const lisCount = Math.max(1, Math.round(reqCount * lisRatio));
  const lkCount = reqCount - lisCount;

  const lkSelected = sampleFromPool(lkPool, lkCount);
  const lisSelected = sampleFromPool(lisPool, lisCount);
  return [...lkSelected, ...lisSelected];
};

/**
 * Resets the LocalStorage cache back to the pristine 350-question static bank.
 */
export const resetQuestionsCache = (): void => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(jlptQuestionsBank));
    } catch (e) {
      console.error('Failed to reset quiz cache:', e);
    }
  }
};
