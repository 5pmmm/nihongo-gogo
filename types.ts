
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
  type?: 'vocab' | 'grammar' | 'ordering' | 'listening' | 'reading'; // Categorized question type
}

export enum AppMode {
  LEARN = 'LEARN',
  HISTORY = 'HISTORY',
  QUIZ = 'QUIZ',
  PROFILE = 'PROFILE',
  CHAT = 'CHAT',
  LISTENING = 'LISTENING',
  DIARY = 'DIARY',
}

export interface QuizConfig {
  sourceWords: WordDefinition[];
  sourceGrammar: GrammarDefinition[];
  dateLabel?: string;
  specificPrompt?: string; // New field
  questionCount?: number; // Chosen number of questions (e.g., 5, 10, 15, 20)
  jlptLevel?: string; // Optional target JLPT Level
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
  activeCostume?: string; // Currently active costume
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

export const ACHIEVEMENTS: Achievement[] = [
  { 
    id: 'first_step', 
    title: '初出茅廬', 
    description: '完成第一次專注練習', 
    icon: '', 
    condition: (stats) => stats.totalFocusMinutes >= 1,
    trivia: '你知道嗎？在古日本，人們是用香燃燒的時間來計時的。'
  },
  { 
    id: 'focus_master_bronze', 
    title: '專注新手', 
    description: '累積專注時間達到 60 分鐘', 
    icon: '', 
    condition: (stats) => stats.totalFocusMinutes >= 60,
    trivia: '「一生懸命」（いっしょうけんめい）原意是拼命守護領地，現在則是用來表示非常努力。'
  },
  { 
    id: 'vocab_hunter', 
    title: '單字獵人', 
    description: '累積解析超過 20 個單字', 
    icon: '', 
    condition: (stats) => stats.totalWordsAnalyzed >= 20,
    trivia: '日語單字中，約有 50% 是漢語詞彙（來自中文），35% 是和語（固有詞），10% 是外來語。'
  },
  { 
    id: 'grammar_sage', 
    title: '文法賢者', 
    description: '累積解析超過 10 個文法點', 
    icon: '', 
    condition: (stats) => stats.totalGrammarAnalyzed >= 10,
    trivia: '日語是「主賓謂」結構（SOV），與中文的「主謂賓」（SVO）截然不同。'
  },
  { 
    id: 'chat_enthusiast', 
    title: '對話熱衷', 
    description: '與 AI 聊天次數超過 20 次', 
    icon: '', 
    condition: (stats) => stats.totalChatMessages >= 20,
    trivia: '日語的對話中有大量的「相槌」（あいづち），表示這在聽對方說話，是日本社交禮儀的重要部分。'
  },
  { 
    id: 'quiz_master', 
    title: '測驗達人', 
    description: '完成 5 次練習測驗', 
    icon: '', 
    condition: (stats) => stats.totalQuizzesFinished >= 5,
    trivia: 'JLPT（日本語能力試驗）全世界每年有超過 100 萬人報考喔！'
  },
  { 
    id: 'listening_lover', 
    title: '順風耳', 
    description: '完成 3 次聽力練習', 
    icon: '', 
    condition: (stats) => stats.totalListeningPractices >= 3,
    trivia: '江戶時代的日本有一種職業叫「十手」，他們會通過聽腳步聲來辨別嫌疑人。'
  }
];


