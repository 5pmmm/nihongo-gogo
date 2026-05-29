
export interface SentenceWord {
  word: string;
  reading: string;
  meaning: string;
}

export interface WordDefinition {
  word: string;
  reading: string;
  meaning: string;
  exampleSentence: string;
  exampleReading?: string; // Hiragana reading of the example sentence
  exampleTranslation: string;
  sentenceBreakdown?: SentenceWord[]; // Detailed breakdown of words in the sentence
}

export interface GrammarExample {
  sentence: string;
  reading: string;
  translation: string;
}

export interface GrammarDefinition {
  id: string; // unique internal id
  grammarPoint: string; // e.g., ～てはいけない
  connection: string; // e.g., Verb Te-form
  meaning: string;
  explanation: string;
  examples: GrammarExample[];
}

export interface AnalyzedToken {
  text: string; // The word as it appears
  dictionaryForm: string;
  reading: string;
  meaning: string;
  jlpt: 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'Unknown';
  type: 'VOCAB' | 'GRAMMAR';
  partOfSpeech?: string; // New field for listening analysis
  // New fields for the Word Card feature
  exampleSentence?: string;
  exampleReading?: string;
  exampleTranslation?: string;
}

export interface ReadingMaterial {
  id: string;
  title: string;
  content: string; // Japanese text
  translation: string; // Chinese translation
  tokens: AnalyzedToken[]; // List of extracted vocab/grammar
}

export type LearningMethod = 'MANUAL' | 'RECOMMEND' | 'QUIZ';
export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export interface DailyRecord {
  id: string;
  date: string; // ISO Date string YYYY-MM-DD
  words: WordDefinition[];
  grammar?: GrammarDefinition[];
  readings?: ReadingMaterial[];
  userInput?: string; // Original input text
  inputMode?: InputMode; // Mode used for the input
  learningMethod?: LearningMethod; // Method used (MANUAL, RECOMMEND, QUIZ)
}

export interface ListeningMaterial {
  title: string;
  fullContent: string;
  translation: string;
  segments: {
    text: string;
    reading: string;
    translation: string;
    tokens: AnalyzedToken[];
  }[];
  level: JLPTLevel;
}

export interface ListeningExerciseState {
  currentSegmentIndex: number;
  isFinished: boolean;
  userInputs: string[];
  results: {
    correct: boolean;
    similarity: number;
    feedback: string;
  }[];
}

export interface QuizQuestion {
  id: string;
  context?: string; // For reading passages or additional context
  question: string; // The question text
  questionReading?: string; // Hiragana/Reading for the whole question
  questionTranslation?: string; // Chinese translation for the whole question
  options: string[]; // 4 options
  correctAnswerIndex: number;
  explanation: string;
}

export enum AppMode {
  LEARN = 'LEARN',
  HISTORY = 'HISTORY',
  QUIZ = 'QUIZ',
  FOCUS = 'FOCUS',
  CHAT = 'CHAT',
  LISTENING = 'LISTENING',
  DIARY = 'DIARY',
}

export interface QuizConfig {
  sourceWords: WordDefinition[];
  sourceGrammar: GrammarDefinition[];
  dateLabel?: string;
  specificPrompt?: string; // New field
}

export type InputMode = 'WORD' | 'GRAMMAR' | 'READING';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition: (stats: PetStats) => boolean;
  trivia?: string; // New: Fun fact shown upon unlock
}

export interface PetStats {
  level: number;
  currentXp: number;
  nextLevelXp: number;
  totalFocusMinutes: number;
  totalWordsAnalyzed: number;
  totalGrammarAnalyzed: number;
  totalQuizzesFinished: number;
  totalChatMessages: number;
  totalListeningPractices: number;
  mood: 'neutral' | 'happy' | 'focus' | 'sleep';
  unlockedAchievements: string[]; // List of Achievement IDs
}

export interface TimerState {
  isActive: boolean;
  mode: 'FOCUS' | 'BREAK';
  timeLeft: number;
  focusDuration: number;
  breakDuration: number;
  endTime?: number; // Timestamp for when the timer should end (for background persistence)
}

export interface ChatCorrection {
  correctedJapanese: string;
  explanationChinese: string;
  explanationEnglish: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  translation?: string; // Chinese translation for model response
  translationEn?: string; // English translation for model response
  correction?: string | ChatCorrection; // Correction of user's grammar if applicable
  image?: string; // Optional Base64 image data URL
  timestamp: number;
}

export interface DiaryCorrection {
  originalText: string;
  correctedText: string;
  explanation: string;
  grammarPoints?: string[];
}

export interface DiaryAnalysisResult {
  title: string;
  correctedFullText: string;
  overallFeedback: string;
  jlptEstimatedLevel: string;
  corrections: DiaryCorrection[];
  vocabGrammarList?: {
    expression: string;
    reading: string;
    meaning: string;
    type: 'VOCAB' | 'GRAMMAR';
  }[];
}

export interface DiaryEntry {
  id: string;
  date: string; // Formatting localized date string (e.g., 2026-05-20)
  content: string; // Raw diary writing in Japanese
  analysis: DiaryAnalysisResult;
  createdAt: number;
}

