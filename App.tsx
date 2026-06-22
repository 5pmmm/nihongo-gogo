
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WordDefinition, DailyRecord, AppMode, QuizConfig, InputMode, GrammarDefinition, PetStats, Achievement, TimerState, ReadingMaterial, LearningMethod, JLPTLevel } from './types';
import { fetchWordDefinitions, fetchGrammarDetails, fetchRecommendedWords, fetchRecommendedGrammar, analyzeReadingText, generateRecommendedReading } from './services/geminiService';
import { WordCard } from './components/WordCard';
import { GrammarCard } from './components/GrammarCard';
import { ReadingView } from './components/ReadingView';
import { ChatInterface } from './components/ChatInterface';
import { Quiz } from './components/Quiz';
import { Button } from './components/Button';
import { PetCompanion } from './components/PetCompanion';
import { PomodoroTimer } from './components/PomodoroTimer';
import { AIAssistant } from './components/AIAssistant';
import { MiniTimer } from './components/MiniTimer';
import { DiaryInterface } from './components/DiaryInterface';

// Icons
const BookIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>;
const ClockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const FocusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>;
const ChatIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>;
const SparklesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.187L15 15l-5.187.904zM18.007 7.007l-.507 2.493-2.493-.507L15 7l.507-2.493 2.493.507L18 7l-.007.007z" /></svg>;
const DiaryIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>;

const LogoIcon = () => (
  <div className="w-10 h-10 sm:w-11 sm:h-11 bg-black rounded-xl flex items-center justify-center p-2">
    <svg
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
    <rect width="512" height="512" rx="50" fill="black"/>
    <path d="M63 192.5C126 192.5 187 165 237.5 77" stroke="white" strokeWidth="38"/>
    <path d="M126.5 51L176 84.5M65.5 91L118.5 128.5" stroke="white" strokeWidth="38"/>
    <path d="M309 51L348 120.5M458.5 51C447.167 81.1667 406.9 172 340.5 208" stroke="white" strokeWidth="38"/>
    <path d="M48 310.5L80.5 362.5M120.5 298L154 354M218.5 304C217 344.5 190.7 432.4 97.5 460" stroke="white" strokeWidth="38"/>
    <path d="M302.5 327L345.5 373M279 446C314.5 443.833 408 436.5 463.5 327" stroke="white" strokeWidth="38"/>
   </svg>
  </div>
);
function SplashIntro({ onComplete }: any) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 6500); 
    return () => clearTimeout(timer);
  }, [onComplete]);
  const strokeVariants = (delayTime: number) => ({
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: { delay: delayTime, duration: 0.8, ease: "easeInOut" },
        opacity: { delay: delayTime, duration: 0.1 }
      }
    }
  });


  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      onAnimationComplete={onComplete}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black"
    >
      <div className="w-64 h-64 sm:w-80 sm:h-80 relative flex items-center justify-center">
        <svg
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* 1. 【第一順位】左上角：シ (し) — 0.2秒 ~ 0.8秒 */}
          <motion.path d="M126.5 51L176 84.5" stroke="white" strokeWidth="34" strokeLinecap="round" variants={strokeVariants(0.2)} initial="hidden" animate="visible" />
          <motion.path d="M65.5 91L118.5 128.5" stroke="white" strokeWidth="34" strokeLinecap="round" variants={strokeVariants(0.5)} initial="hidden" animate="visible" />
          <motion.path d="M63 192.5C126 192.5 187 165 237.5 77" stroke="white" strokeWidth="34" strokeLinecap="round" variants={strokeVariants(0.8)} initial="hidden" animate="visible" />

          {/* 2. 【第二順位】右上角：ソ (そ) — 1.2秒 ~ 1.5秒 */}
          <motion.path d="M309 51L348 120.5" stroke="white" strokeWidth="34" strokeLinecap="round" variants={strokeVariants(1.2)} initial="hidden" animate="visible" />
          <motion.path d="M458.5 51C447.167 81.1667 406.9 172 340.5 208" stroke="white" strokeWidth="34" strokeLinecap="round" variants={strokeVariants(1.5)} initial="hidden" animate="visible" />

          {/* 3. 【第三順位】左下角：ツ (つ) — 1.9秒 ~ 2.5秒 */}
          <motion.path d="M48 310.5L80.5 362.5" stroke="white" strokeWidth="34" strokeLinecap="round" variants={strokeVariants(1.9)} initial="hidden" animate="visible" />
          <motion.path d="M120.5 298L154 354" stroke="white" strokeWidth="34" strokeLinecap="round" variants={strokeVariants(2.2)} initial="hidden" animate="visible" />
          <motion.path d="M218.5 304C217 344.5 190.7 432.4 97.5 460" stroke="white" strokeWidth="34" strokeLinecap="round" variants={strokeVariants(2.5)} initial="hidden" animate="visible" />

          {/* 4. 【第四順位】右下角：ン (ん) — 2.9秒 ~ 3.2秒 */}
          <motion.path d="M302.5 327L345.5 373" stroke="white" strokeWidth="34" strokeLinecap="round" variants={strokeVariants(2.9)} initial="hidden" animate="visible" />
          <motion.path d="M279 446C314.5 443.833 408 436.5 463.5 327" stroke="white" strokeWidth="34" strokeLinecap="round" variants={strokeVariants(3.2)} initial="hidden" animate="visible" />
        </svg>
      </div>

      {/* 逐字蹦出打字效果的主標題與副標 */}
      <div className="flex flex-col items-center gap-3 mt-6">
        
        {/* 打字機容器：3.3 秒筆畫完全結束前，這裡維持完全隱形 (opacity: 0) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 4.3, duration: 0.1 }}
          className="flex items-center justify-center relative"
        >
          {/* 精準打字機效果的「日本語ごご!」 */}
          <motion.h1
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ 
              delay: 4.3, 
              duration: 0.8, 
              ease: (v: number) => Math.floor(v * 7) / 7
            }}
            className="overflow-hidden whitespace-nowrap text-xl sm:text-2xl text-white font-medium tracking-wide relative pr-4"
          >
            日本語ごご!
            
            {/* 游標線：用絕對定位死死扣在文字右側，並自帶打字完不閃爍或持續閃爍效果 */}
            <span 
              className="absolute right-0 top-0 bottom-0 w-[2px] bg-white"
              style={{
                animation: "blink 0.75s step-end infinite"
              }}
            />
          </motion.h1>
        </motion.div>

        {/* Loading 提示，等打字完才溫柔浮現 */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 4.6, duration: 0.6 }}
          className="text-zinc-500 text-[10px] tracking-widest uppercase font-light"
        >
          Loading project...
        </motion.p>

        {/* 閃爍游標純 CSS 樣式 */}
        <style>{`
          @keyframes blink {
            from, to { opacity: 0 }
            50% { opacity: 1 }
          }
        `}</style>
      </div>
    </motion.div>
  );
}

const ACHIEVEMENTS: Achievement[] = [
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

const INITIAL_PET_STATS: PetStats = { 
  level: 1, 
  currentXp: 0, 
  nextLevelXp: 100, 
  totalFocusMinutes: 0, 
  totalWordsAnalyzed: 0,
  totalGrammarAnalyzed: 0,
  totalQuizzesFinished: 0,
  totalChatMessages: 0,
  totalListeningPractices: 0,
  mood: 'neutral', 
  unlockedAchievements: [] 
};

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [mode, setMode] = useState<AppMode>(AppMode.LEARN);
  const [isBottomBarVisible, setIsBottomBarVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Always show when close to top
      if (currentScrollY <= 15) {
        setIsBottomBarVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }
      
      const diff = currentScrollY - lastScrollY.current;
      
      // 5px threshold to avoid jittering
      if (Math.abs(diff) > 5) {
        if (diff > 0) {
          setIsBottomBarVisible(false); // scrolling down -> hide
        } else {
          setIsBottomBarVisible(true);  // scrolling up -> show
        }
        lastScrollY.current = currentScrollY;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (mode === AppMode.CHAT) {
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
      setIsBottomBarVisible(true);
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.height = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.height = 'unset';
    };
  }, [mode]);

  const [inputMode, setInputMode] = useState<InputMode>('WORD');
  const [history, setHistory] = useState<DailyRecord[]>(() => {
    const saved = localStorage.getItem('mk-nihongo-history');
    return saved ? JSON.parse(saved) : [];
  });
  const [petStats, setPetStats] = useState<PetStats>(() => {
    const saved = localStorage.getItem('mk-nihongo-pet');
    return saved ? JSON.parse(saved) : INITIAL_PET_STATS;
  });

  const [activeAchievement, setActiveAchievement] = useState<Achievement | null>(null);

  // Expanded addXp function that handles all learning stats
  const addXp = (options: { 
    xp: number; 
    minutes?: number; 
    words?: number; 
    grammar?: number; 
    quiz?: number; 
    chat?: number;
    listening?: number;
  }) => {
    const { xp, minutes = 0, words = 0, grammar = 0, quiz = 0, chat = 0, listening = 0 } = options;
    
    if (xp > 0) {
      setXpToast({ amount: xp, id: Date.now() });
      setTimeout(() => setXpToast(null), 3000);
    }

    setPetStats(prev => {
      let newXp = prev.currentXp + xp;
      let newLevel = prev.level;
      let nextXp = prev.nextLevelXp;
      
      while (newXp >= nextXp) {
        newXp -= nextXp;
        newLevel += 1;
        nextXp = Math.floor(nextXp * 1.2);
      }

      const updatedStats: PetStats = { 
        ...prev, 
        level: newLevel, 
        currentXp: newXp, 
        nextLevelXp: nextXp, 
        totalFocusMinutes: prev.totalFocusMinutes + minutes,
        totalWordsAnalyzed: prev.totalWordsAnalyzed + words,
        totalGrammarAnalyzed: prev.totalGrammarAnalyzed + grammar,
        totalQuizzesFinished: prev.totalQuizzesFinished + quiz,
        totalChatMessages: prev.totalChatMessages + chat,
        totalListeningPractices: prev.totalListeningPractices + listening,
        mood: 'happy' 
      };

      // Check for new achievements
      const newlyUnlocked = ACHIEVEMENTS.filter(a => 
        !prev.unlockedAchievements.includes(a.id) && a.condition(updatedStats)
      );

      if (newlyUnlocked.length > 0) {
        setActiveAchievement(newlyUnlocked[0]);
        updatedStats.unlockedAchievements = [
          ...prev.unlockedAchievements, 
          ...newlyUnlocked.map(a => a.id)
        ];
      }

      return updatedStats;
    });
  };

  const [learningMethod, setLearningMethod] = useState<LearningMethod>('MANUAL');
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel>('N5');
  const [recommendCount, setRecommendCount] = useState<number>(5);
  const [recommendWordCategory, setRecommendWordCategory] = useState<string>("日常用語");
  const [showRecommendModal, setShowRecommendModal] = useState<boolean>(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentDefinitions, setCurrentDefinitions] = useState<WordDefinition[]>(() => {
    const saved = localStorage.getItem('mk-nihongo-current-words');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentGrammar, setCurrentGrammar] = useState<GrammarDefinition[]>(() => {
    const saved = localStorage.getItem('mk-nihongo-current-grammar');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentReading, setCurrentReading] = useState<ReadingMaterial | null>(() => {
    const saved = localStorage.getItem('mk-nihongo-current-reading');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(() => {
    return localStorage.getItem('mk-nihongo-active-history-id') || null;
  });
  const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null);
  const [viewingInputRecord, setViewingInputRecord] = useState<DailyRecord | null>(null);
  
  // Grouped inputs history states
  const [viewingInputGroup, setViewingInputGroup] = useState<any | null>(null);
  const [quizSelectionGroup, setQuizSelectionGroup] = useState<any | null>(null);
  const [quizIncludeWords, setQuizIncludeWords] = useState<boolean>(true);
  const [quizIncludeGrammar, setQuizIncludeGrammar] = useState<boolean>(true);
  
  // Track expanded cards
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);
  const [expandedGrammarId, setExpandedGrammarId] = useState<string | null>(null);

  const [xpToast, setXpToast] = useState<{ amount: number; id: number } | null>(null);

  const [timerState, setTimerState] = useState<TimerState>(() => {
    const saved = localStorage.getItem('mk-nihongo-timer');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...parsed, isActive: false, timeLeft: parsed.focusDuration * 60 };
    }
    return {
      isActive: false,
      mode: 'FOCUS',
      focusDuration: 25,
      breakDuration: 5,
      timeLeft: 25 * 60,
    };
  });

  useEffect(() => {
    localStorage.setItem('mk-nihongo-history', JSON.stringify(history));
    localStorage.setItem('mk-nihongo-pet', JSON.stringify(petStats));
    localStorage.setItem('mk-nihongo-current-words', JSON.stringify(currentDefinitions));
    localStorage.setItem('mk-nihongo-current-grammar', JSON.stringify(currentGrammar));
    localStorage.setItem('mk-nihongo-current-reading', JSON.stringify(currentReading));
    localStorage.setItem('mk-nihongo-active-history-id', activeHistoryId || '');
    localStorage.setItem('mk-nihongo-timer', JSON.stringify({
      focusDuration: timerState.focusDuration,
      breakDuration: timerState.breakDuration,
      mode: timerState.mode
    }));
  }, [history, petStats, currentDefinitions, currentGrammar, currentReading, activeHistoryId, timerState.focusDuration, timerState.breakDuration, timerState.mode]);

  // Group learning logs by date
  const groupedHistory = React.useMemo(() => {
    const groups: { [date: string]: DailyRecord[] } = {};
    history.forEach(r => {
      const dateKey = r.date || new Date().toISOString().split('T')[0];
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(r);
    });

    return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(date => {
      const records = groups[date];
      
      // Pool and deduplicate words
      const allWordsMap = new Map<string, WordDefinition>();
      records.forEach(r => {
        if (r.words) {
          r.words.forEach(w => {
            allWordsMap.set(w.word, w);
          });
        }
      });
      const allWords = Array.from(allWordsMap.values());

      // Pool and deduplicate grammar
      const allGrammarMap = new Map<string, GrammarDefinition>();
      records.forEach(r => {
        if (r.grammar) {
          r.grammar.forEach(g => {
            allGrammarMap.set(g.grammarPoint, g);
          });
        }
      });
      const allGrammar = Array.from(allGrammarMap.values());

      // Pool readings
      const allReadings: ReadingMaterial[] = [];
      records.forEach(r => {
        if (r.readings) {
          r.readings.forEach(read => {
            if (!allReadings.some(exist => exist.title === read.title)) {
              allReadings.push(read);
            }
          });
        }
      });

      // User inputs collected
      const userInputs = records.map(r => ({
        id: r.id,
        text: r.userInput || '',
        inputMode: r.inputMode,
        learningMethod: r.learningMethod,
        wordsCount: r.words?.length || 0,
        grammarCount: r.grammar?.length || 0
      })).filter(inp => inp.text.trim() !== '');

      return {
        date,
        allWords,
        allGrammar,
        allReadings,
        userInputs,
        originalRecords: records
      };
    });
  }, [history]);

  useEffect(() => {
    let interval: number | null = null;
    if (timerState.isActive) {
      interval = window.setInterval(() => {
        setTimerState(prev => {
          if (prev.timeLeft <= 1) {
            handleTimerComplete(prev);
            return prev;
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [timerState.isActive]);

  const handleTimerComplete = (prev: TimerState) => {
    if (prev.mode === 'FOCUS') {
      addXp({ xp: 50, minutes: prev.focusDuration });
      setTimerState({ 
        ...prev, 
        isActive: false, 
        mode: 'BREAK', 
        timeLeft: prev.breakDuration * 60 
      });
    } else {
      setTimerState({ 
        ...prev, 
        isActive: false, 
        mode: 'FOCUS', 
        timeLeft: prev.focusDuration * 60 
      });
    }
    if (Notification.permission === "granted") {
        new Notification(prev.mode === 'FOCUS' ? "專注完成！" : "休息結束！", {
            body: prev.mode === 'FOCUS' ? "休息一下吧！" : "準備好開始下一輪了嗎？"
        });
    }
  };

  const toggleTimer = () => setTimerState(prev => ({ ...prev, isActive: !prev.isActive }));
  const resetTimer = () => setTimerState(prev => ({ ...prev, isActive: false, timeLeft: (prev.mode === 'FOCUS' ? prev.focusDuration : prev.breakDuration) * 60 }));
  const switchTimerMode = () => setTimerState(prev => {
    const nextMode = prev.mode === 'FOCUS' ? 'BREAK' : 'FOCUS';
    return { ...prev, mode: nextMode, isActive: false, timeLeft: (nextMode === 'FOCUS' ? prev.focusDuration : prev.breakDuration) * 60 };
  });

  const handleLearn = async () => {
    if ((learningMethod === 'MANUAL' || learningMethod === 'QUIZ') && !input.trim()) return;
    setLoading(true);
    
    try {
      if (learningMethod === 'QUIZ') {
         setQuizConfig({ 
            sourceWords: [], 
            sourceGrammar: [], 
            dateLabel: "AI 定製練習",
            specificPrompt: input 
         });
         
         const today = new Date().toISOString().split('T')[0];
         setHistory(prev => [{ 
           id: Date.now().toString(), 
           date: today, 
           words: [], 
           grammar: [], 
           readings: [],
           userInput: input,
           inputMode: inputMode,
           learningMethod: 'QUIZ'
         }, ...prev]);

         setMode(AppMode.QUIZ);
         setLoading(false);
         return;
      }

      let newWords: WordDefinition[] = [];
      let newGrammar: GrammarDefinition[] = [];
      let newReading: ReadingMaterial | null = null;

      if (learningMethod === 'MANUAL') {
        if (inputMode === 'WORD') newWords = await fetchWordDefinitions(input);
        else if (inputMode === 'GRAMMAR') newGrammar = await fetchGrammarDetails(input);
        else if (inputMode === 'READING') newReading = await analyzeReadingText(input);
      } else {
        if (inputMode === 'WORD') newWords = await fetchRecommendedWords(selectedLevel, recommendCount, [], recommendWordCategory);
        else if (inputMode === 'GRAMMAR') newGrammar = await fetchRecommendedGrammar(selectedLevel, recommendCount, []);
        else if (inputMode === 'READING') newReading = await generateRecommendedReading(selectedLevel);
      }

      const newId = Date.now().toString();
      setCurrentDefinitions(newWords);
      setCurrentGrammar(newGrammar);
      setCurrentReading(newReading);
      setActiveHistoryId(newId);
      
      const today = new Date().toISOString().split('T')[0];
      const customHistoryInputText = learningMethod === 'MANUAL' 
        ? input 
        : inputMode === 'WORD' 
          ? `[AI雙語詞彙] ${selectedLevel} • ${recommendWordCategory}` 
          : inputMode === 'GRAMMAR' 
            ? `[AI精緻文法] ${selectedLevel} 文法推薦` 
            : `[AI情境文章] ${selectedLevel} 隨機主題文章`;

      setHistory(prev => [{ 
        id: newId, 
        date: today, 
        words: newWords, 
        grammar: newGrammar, 
        readings: newReading ? [newReading] : [],
        userInput: customHistoryInputText,
        inputMode: inputMode,
        learningMethod: learningMethod
      }, ...prev]);
      
      if (learningMethod === 'MANUAL') setInput('');
      
      // AI Calculate Dynamic XP Pulse
      const wordCount = newWords.length;
      const grammarCount = newGrammar.length;
      const charCount = input.length;
      
      // Complexity based on input mode and results
      const baseGain = 10;
      const wordBonus = wordCount * 12;
      const grammarBonus = grammarCount * 25;
      const readingBonus = newReading ? (Math.min(charCount / 10, 50)) : 0;
      
      const totalGain = Math.floor(baseGain + wordBonus + grammarBonus + readingBonus);
      
      addXp({ 
        xp: totalGain, 
        words: wordCount, 
        grammar: grammarCount,
        listening: 0
      });
    } catch (error) { 
      console.error(error);
      alert("生成失敗，請檢查網路或 API KEY。"); 
    } finally { 
      setLoading(false); 
    }
  };

  const renderContent = () => {
    switch (mode) {
      case AppMode.LEARN:
        return (
          <motion.div key="learn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-10">
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-5 sm:p-10 rounded-[2rem] sm:rounded-[3rem] shadow-xl border border-gray-100">
              <div className="flex flex-col gap-6 sm:gap-8 w-full">
                <h2 className="text-lg sm:text-xl font-black text-zinc-400 tracking-tighter uppercase">想學點什麼？</h2>
                
                <div className="flex bg-zinc-100/80 p-0.5 sm:p-1 rounded-xl sm:rounded-2xl border border-zinc-200 relative">
                  <div className="grid grid-cols-3 w-full relative z-10 text-center">
                    {['WORD', 'GRAMMAR', 'READING'].map((m) => (
                      <button key={m} onClick={() => setInputMode(m as InputMode)} className={`py-2 sm:py-3 text-sm sm:text-base font-bold transition-all ${inputMode === m ? 'text-black' : 'text-zinc-400'}`}>
                        {m === 'WORD' ? '單字' : m === 'GRAMMAR' ? '文法' : '文章'}
                      </button>
                    ))}
                  </div>
                  <motion.div className="absolute inset-y-0.5 sm:inset-y-1 bg-white shadow-sm rounded-lg sm:rounded-xl border border-zinc-200" animate={{ x: inputMode === 'WORD' ? '0%' : inputMode === 'GRAMMAR' ? '100%' : '200%', width: '33.33%' }} />
                </div>

                <div className="flex bg-zinc-100/80 p-0.5 sm:p-1 rounded-xl sm:rounded-2xl border border-zinc-200 relative">
                  <div className="grid grid-cols-3 w-full relative z-10 text-center">
                    {['MANUAL', 'RECOMMEND', 'QUIZ'].map((m) => (
                      <button 
                        key={m} 
                        onClick={() => {
                          setLearningMethod(m as LearningMethod);
                          if (m === 'RECOMMEND') {
                            setShowRecommendModal(true);
                          }
                        }} 
                        className={`py-2 sm:py-3 text-sm sm:text-base font-bold transition-all ${learningMethod === m ? 'text-black' : 'text-zinc-400'}`}
                      >
                        {m === 'MANUAL' ? '輸入' : m === 'RECOMMEND' ? '推薦' : '測驗'}
                      </button>
                    ))}
                  </div>
                  <motion.div className="absolute inset-y-0.5 sm:inset-y-1 bg-white shadow-sm rounded-lg sm:rounded-xl border border-zinc-200" animate={{ x: learningMethod === 'MANUAL' ? '0%' : learningMethod === 'RECOMMEND' ? '100%' : '200%', width: '33.33%' }} />
                </div>

                {learningMethod === 'RECOMMEND' ? (
                  <div className="w-full p-6 sm:p-10 bg-zinc-50/70 border border-zinc-200/80 rounded-2xl sm:rounded-[2rem] flex flex-col items-center justify-center text-center space-y-6 shadow-inner min-h-[12rem] sm:min-h-[16rem]">
                    <div className="p-3 sm:p-4 bg-zinc-900 text-white rounded-full shadow-md animate-bounce">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-300">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.187L15 15l-5.187.904zM18.007 7.007l-.507 2.493-2.493-.507L15 7l.507-2.493 2.493.507L18 7l-.007.007z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-2xl font-black text-zinc-900">
                        {inputMode === 'WORD' ? 'AI 雙語單字推薦' : inputMode === 'GRAMMAR' ? 'AI 系統文法推薦' : 'AI 隨機主題情境文章撰寫'}
                      </h3>
                      <p className="text-xs sm:text-base text-zinc-500 font-bold mt-2">
                        {inputMode === 'WORD' ? (
                          <span>
                            目前設定：JLPT <span className="text-zinc-900 border-b border-zinc-900 pb-0.5 font-black">{selectedLevel}</span> 級 • 學習系列：<span className="text-zinc-900 border-b border-zinc-900 pb-0.5 font-black">{recommendWordCategory}</span>
                          </span>
                        ) : inputMode === 'GRAMMAR' ? (
                          <span>
                            目前設定：JLPT <span className="text-zinc-900 border-b border-zinc-900 pb-0.5 font-black">{selectedLevel}</span> 級文法
                          </span>
                        ) : (
                          <span>
                            目前設定：JLPT <span className="text-zinc-950 border-b border-zinc-900 pb-0.5 font-black">{selectedLevel}</span> 級隨機主題故事
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button 
                        type="button"
                        onClick={() => setShowRecommendModal(true)} 
                        className="px-4.5 py-2 text-xs sm:text-sm font-bold bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 rounded-xl transition shadow-sm flex items-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-zinc-500">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                        </svg>
                        變更偏好設定
                      </button>
                    </div>
                  </div>
                ) : (
                  <textarea
                    className="w-full p-4 sm:p-8 bg-zinc-50/50 border border-zinc-200 rounded-2xl sm:rounded-[2rem] outline-none text-base sm:text-xl text-zinc-900 font-bold h-48 sm:h-64 shadow-inner resize-none"
                    placeholder={learningMethod === 'QUIZ' ? "輸入想測驗的內容，AI 會為你出題..." : "請輸入內容..."} 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)}
                  />
                )}
                <div className="flex justify-center gap-3 xs:gap-4 pb-5 sm:pb-0">
                  <Button 
                    onClick={handleLearn} 
                    disabled={loading} 
                    variant="gray"
                    size={loading ? 'sm' : 'md'} 
                    className="px-6 sm:px-12 py-2 sm:py-4.5 text-xs xs:text-sm sm:text-lg border-zinc-200"
                  >
                    {loading ? 'AI 思考中...' : learningMethod === 'RECOMMEND' ? '開始推薦' : '開始解析'}
                  </Button>
                  {learningMethod !== 'RECOMMEND' && (
                    <Button 
                      onClick={() => setInput('')} 
                      disabled={loading || !input} 
                      variant="secondary"
                      size={loading ? 'sm' : 'md'} 
                      className="px-6 sm:px-12 py-2 sm:py-4.5 text-xs xs:text-sm sm:text-lg border-rose-100 text-rose-500 hover:text-rose-700 hover:bg-rose-50/50"
                    >
                      一鍵刪除
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>

            {(currentDefinitions.length > 0 || currentGrammar.length > 0) && (
              <div className="space-y-10 px-2 sm:px-4">
                <h3 className="text-xl font-black text-zinc-900 border-l-8 border-zinc-900 pl-4 uppercase">解析結果</h3>
                <div className="grid gap-4 xs:gap-6 md:gap-8 md:grid-cols-2">
                  {currentDefinitions.map((w, i) => (
                    <WordCard 
                      key={i} 
                      layoutId={`w-${i}`} 
                      data={w} 
                      isExpanded={expandedWordId === `w-${i}`}
                      onToggle={() => setExpandedWordId(expandedWordId === `w-${i}` ? null : `w-${i}`)}
                    />
                  ))}
                  {currentGrammar.map((g, i) => (
                    <GrammarCard 
                      key={i} 
                      layoutId={`g-${i}`} 
                      data={g} 
                      isExpanded={expandedGrammarId === `g-${i}`}
                      onClose={() => setExpandedGrammarId(null)}
                      onClick={() => setExpandedGrammarId(`g-${i}`)}
                    />
                  ))}
                </div>
              </div>
            )}
            {currentReading && <ReadingView material={currentReading} />}

            {/* 歷史輸入紀錄 */}
            <div className="mt-12 px-4 space-y-6 pt-10 border-t border-zinc-100 max-w-7xl mx-auto w-full">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-3 bg-zinc-100 rounded-2xl flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-zinc-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-zinc-900 tracking-tight uppercase">歷史輸入紀錄</h3>
                    <p className="text-xs sm:text-sm text-zinc-400 font-bold">點擊即可快速重載卡片畫面，剛剛搜尋的文法或單字不會不見</p>
                  </div>
                </div>
                {history.length > 0 && (
                  <button 
                    onClick={() => {
                      if (confirm("確定要清除所有歷史紀錄嗎？")) {
                        setHistory([]);
                        setCurrentDefinitions([]);
                        setCurrentGrammar([]);
                        setCurrentReading(null);
                        setActiveHistoryId(null);
                      }
                    }}
                    className="text-xs text-zinc-400 hover:text-rose-600 font-black transition-colors px-4 py-2 bg-zinc-50 hover:bg-rose-50 border border-zinc-200/50 rounded-xl"
                  >
                    清除全部紀錄
                  </button>
                )}
              </div>

              {history.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {history.slice(0, 9).map((record) => {
                    const isActive = record.id === activeHistoryId;
                    const modeLabel = record.inputMode === 'WORD' ? '單字' : record.inputMode === 'GRAMMAR' ? '文法' : '文章';
                    const modeBg = record.inputMode === 'WORD' 
                      ? 'bg-zinc-900 text-white' 
                      : record.inputMode === 'GRAMMAR' 
                        ? 'bg-indigo-900 text-white' 
                        : 'bg-emerald-950 text-white';
                    
                    return (
                      <div 
                        key={record.id}
                        onClick={() => {
                          setCurrentDefinitions(record.words || []);
                          setCurrentGrammar(record.grammar || []);
                          setCurrentReading(record.readings?.[0] || null);
                          setActiveHistoryId(record.id);
                          if (record.userInput && record.learningMethod === 'MANUAL') {
                            setInput(record.userInput);
                          }
                          if (record.inputMode) {
                            setInputMode(record.inputMode);
                          }
                        }}
                        className={`group relative p-5 bg-white rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
                          isActive 
                            ? 'border-zinc-950 shadow-md ring-2 ring-zinc-950/10 bg-zinc-50/10' 
                            : 'border-zinc-100 hover:border-zinc-300 shadow-sm hover:shadow-md hover:bg-zinc-50/20'
                        }`}
                      >
                        <div className="flex flex-col gap-4 justify-between h-full relative">
                          <div className="flex items-center justify-between gap-2 border-b border-zinc-50 pb-2">
                            <span className={`text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${modeBg}`}>
                              {modeLabel}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-bold">{record.date}</span>
                          </div>

                          <div className="space-y-1.5 flex-1 min-w-0">
                            <p className="font-black text-zinc-900 group-hover:text-black text-base sm:text-lg line-clamp-1 break-all pr-4" title={record.userInput}>
                              {record.userInput || "選取內容"}
                            </p>
                            <p className="text-xs text-zinc-400 font-bold line-clamp-1">
                              {record.words.length > 0 && `${record.words.map(w => w.word).join('、')}`}
                              {(record.grammar?.length || 0) > 0 && `${record.grammar?.map(g => g.grammarPoint).join('、')}`}
                              {(record.readings?.length || 0) > 0 && `${record.readings?.map(r => r.title).join('、')}`}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-zinc-100/60 text-[10px] font-bold text-zinc-400">
                            <span>
                              {record.words.length > 0 ? `${record.words.length} 個單字` : ''} 
                              {(record.grammar?.length || 0) > 0 ? `${record.grammar?.length} 個文法` : ''} 
                              {(record.readings?.length || 0) > 0 ? `文章解析` : ''}
                            </span>
                            <span className={`transition-all duration-300 flex items-center gap-1 ${isActive ? 'text-zinc-950 font-black' : 'opacity-0 group-hover:opacity-100 text-zinc-500'}`}>
                              {isActive ? '目前展示中' : '載入檢視'} <span className="text-xs font-black">→</span>
                            </span>
                          </div>
                        </div>

                        {/* Delete single search log */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("是否刪除這筆輸入紀錄？")) {
                              setHistory(prev => prev.filter(h => h.id !== record.id));
                              if (isActive) {
                                setCurrentDefinitions([]);
                                setCurrentGrammar([]);
                                setCurrentReading(null);
                                setActiveHistoryId(null);
                              }
                            }
                          }}
                          className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-transparent hover:bg-rose-50 text-zinc-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
                          title="刪除此紀錄"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-10 text-center bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200/85">
                  <p className="text-sm font-black text-zinc-400">尚無歷史輸入紀錄</p>
                  <p className="text-xs text-zinc-400/80 mt-1">開始在上方輸入內容進行解析，搜尋紀錄就會自動收集在這裡喔！</p>
                </div>
              )}
            </div>
          </motion.div>
        );
      case AppMode.CHAT: return (
        <motion.div 
          key="chat" 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="flex-grow flex flex-col h-full min-h-0 w-full"
        >
          <ChatInterface onBack={() => setMode(AppMode.LEARN)} onXpUpdate={(xp) => addXp({ xp, chat: 1 })} />
        </motion.div>
      );
      case AppMode.LISTENING: return <motion.div key="listen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><AIAssistant onBack={() => setMode(AppMode.LEARN)} onXpUpdate={(xp) => addXp({ xp, listening: 1 })} /></motion.div>;
      case AppMode.DIARY: return <motion.div key="diary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><DiaryInterface onBack={() => setMode(AppMode.LEARN)} onXpUpdate={(xp) => addXp({ xp, grammar: 1 })} /></motion.div>;
      case AppMode.QUIZ: return quizConfig ? <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Quiz {...quizConfig} onExit={() => {
        addXp({ xp: 100, quiz: 1 });
        setMode(AppMode.LEARN);
      }} /></motion.div> : null;
      case AppMode.FOCUS: 
        return (
          <motion.div key="focus" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto flex flex-col items-center gap-16 py-10">
            <PomodoroTimer 
              state={timerState} 
              onToggle={toggleTimer} 
              onReset={resetTimer} 
              onSwitchMode={switchTimerMode}
              onUpdateSettings={(f, b) => setTimerState(prev => ({ 
                ...prev, 
                focusDuration: f, 
                breakDuration: b, 
                timeLeft: (prev.mode === 'FOCUS' ? f : b) * 60,
                isActive: false 
              }))}
            />
            <PetCompanion stats={petStats} onClick={() => addXp({ xp: 1 })} />
          </motion.div>
        );
      case AppMode.HISTORY: {
        const handleGroupQuiz = (group: any) => {
          setQuizSelectionGroup(group);
          const hasFormalWords = group.allWords.length > 0;
          const hasFormalGrammar = group.allGrammar.length > 0;
          
          if (hasFormalWords || hasFormalGrammar) {
            setQuizIncludeWords(hasFormalWords);
            setQuizIncludeGrammar(hasFormalGrammar);
          } else {
            // Default both to true if there is no pre-extracted vocab/grammar, so it fallbacks to raw user input text
            setQuizIncludeWords(true);
            setQuizIncludeGrammar(true);
          }
        };

        const loadGroupToHome = (group: any) => {
          setCurrentDefinitions(group.allWords);
          setCurrentGrammar(group.allGrammar);
          setCurrentReading(group.allReadings[0] || null);
          setActiveHistoryId(group.originalRecords[0]?.id || null);
          setMode(AppMode.LEARN);
          setViewingInputGroup(null);
        };

        return (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto space-y-8 pb-24 px-5">
            <h2 className="text-3xl font-black text-zinc-900 tracking-tighter uppercase border-l-8 border-zinc-900 pl-4 animate-fade-in">學習歷史</h2>
            
            {groupedHistory.length > 0 ? (
              <div className="grid gap-4">
                {groupedHistory.map((group) => {
                  const hasQuiz = group.originalRecords.some(r => r.learningMethod === 'QUIZ');
                  return (
                    <div key={group.date} className="p-5 sm:p-6 bg-white rounded-2xl border border-zinc-150/60 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md hover:border-zinc-350 transition-all duration-300">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-zinc-900 font-extrabold text-lg sm:text-xl tracking-tight">{group.date}</p>
                          {hasQuiz && (
                            <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-[9px] font-black tracking-wider uppercase">含定製練習</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 font-bold">
                          {group.allWords.length > 0 && (
                            <span className="bg-zinc-50 border border-zinc-100 px-2 py-0.5 rounded-lg text-zinc-650">{group.allWords.length} 個單字</span>
                          )}
                          {group.allGrammar.length > 0 && (
                            <span className="bg-indigo-50/40 border border-indigo-100/50 px-2 py-0.5 rounded-lg text-indigo-700">{group.allGrammar.length} 個文法</span>
                          )}
                          {group.allReadings.length > 0 && (
                            <span className="bg-emerald-50/40 border border-emerald-100/50 px-2 py-0.5 rounded-lg text-emerald-800">{group.allReadings.length} 篇閱讀</span>
                          )}
                          {group.allWords.length === 0 && group.allGrammar.length === 0 && group.allReadings.length === 0 && (
                            <span className="text-zinc-400 text-xs">僅測驗主題或指令紀錄</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2.5 w-full md:w-auto items-center justify-center">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 md:flex-none tracking-normal font-black justify-center items-center text-center py-2 min-h-[38px] min-w-[100px]" 
                          onClick={() => setViewingInputGroup(group)}
                        >回顧輸入</Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 md:flex-none text-zinc-900 border-zinc-900 hover:bg-zinc-900 hover:text-white tracking-normal font-black justify-center items-center text-center py-2 min-h-[38px] min-w-[100px]" 
                          onClick={() => handleGroupQuiz(group)}
                        >複習測驗</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 text-zinc-300 font-bold">目前還沒有記錄喔</div>
            )}

            {/* Combined Group Contents Modal */}
            <AnimatePresence>
              {viewingInputGroup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    onClick={() => setViewingInputGroup(null)}
                    className="absolute inset-0 bg-black/45 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.93, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.93, y: 15 }}
                    className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-zinc-100 flex flex-col max-h-[90vh]"
                  >
                    <div className="p-8 sm:p-10 flex flex-col h-full overflow-hidden">
                      <div className="flex justify-between items-start mb-6 shrink-0">
                        <div>
                          <h3 className="text-2xl font-black text-zinc-900 tracking-tight">每日學習回顧</h3>
                          <p className="text-zinc-400 text-sm font-extrabold uppercase tracking-wider mt-0.5">{viewingInputGroup.date} 的學習精華一覽</p>
                        </div>
                        <button onClick={() => setViewingInputGroup(null)} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 transition-colors cursor-pointer">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto pr-1 space-y-6 scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent">
                        {/* Part 1: raw input queries */}
                        {viewingInputGroup.userInputs.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-black text-zinc-400 tracking-wider uppercase border-l-4 border-zinc-400 pl-2">1. 📥 當日解析指令與歷程</h4>
                            <div className="grid gap-2">
                              {viewingInputGroup.userInputs.map((u: any, idx: number) => (
                                <div key={u.id || idx} className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-100 shadow-4xs">
                                  <div className="flex justify-between items-center text-[9px] text-zinc-400 font-extrabold mb-1 select-none">
                                    <span>輸入來源 #{idx + 1}</span>
                                    <span className="px-1.5 py-0.2 bg-zinc-200/50 text-zinc-600 rounded uppercase font-black">
                                      {u.inputMode === 'WORD' ? '單字解析' : u.inputMode === 'GRAMMAR' ? '文法分析' : '閱讀分析'}
                                    </span>
                                  </div>
                                  <p className="text-xs sm:text-sm font-semibold text-zinc-800 break-words leading-relaxed whitespace-pre-wrap">
                                    {u.text || `自動推薦內容`}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Part 2: Accumulative Word tag list */}
                        {viewingInputGroup.allWords.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-black text-zinc-400 tracking-wider uppercase border-l-4 border-zinc-900 pl-2">2. 單字儲存庫 ({viewingInputGroup.allWords.length} 個)</h4>
                            <div className="flex flex-wrap gap-2">
                              {viewingInputGroup.allWords.map((w: any, idx: number) => (
                                <div key={idx} className="px-3 py-2 bg-zinc-50 rounded-xl text-xs font-bold text-zinc-900 border border-zinc-200/40 hover:bg-zinc-100 transition-colors flex items-center gap-1.5 shadow-5xs">
                                  <span className="font-sans font-black text-zinc-950">{w.word}</span>
                                  <span className="text-[10px] text-zinc-500 font-bold">({w.reading})</span>
                                  <span className="text-[10px] text-zinc-400 font-semibold">— {w.meaning}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Part 3: Accumulative Grammar list */}
                        {viewingInputGroup.allGrammar.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-black text-zinc-400 tracking-wider uppercase border-l-4 border-indigo-700 pl-2">3. 重點文法集 ({viewingInputGroup.allGrammar.length} 個)</h4>
                            <div className="flex flex-wrap gap-2">
                              {viewingInputGroup.allGrammar.map((g: any, idx: number) => (
                                <div key={idx} className="px-3 py-2 bg-indigo-50/20 rounded-xl text-xs font-semibold text-indigo-900 border border-indigo-100/30 hover:bg-indigo-50/50 transition-colors flex items-center gap-1.5 shadow-5xs">
                                  <span className="font-sans font-black text-indigo-950">{g.grammarPoint}</span>
                                  <span className="text-[10px] text-indigo-500 font-bold">— {g.meaning}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Part 4: Readings */}
                        {viewingInputGroup.allReadings.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-black text-zinc-400 tracking-wider uppercase border-l-4 border-emerald-700 pl-2">4. 閱讀與解析文章 ({viewingInputGroup.allReadings.length} 篇)</h4>
                            <div className="space-y-2">
                              {viewingInputGroup.allReadings.map((r: any, idx: number) => (
                                <div key={idx} className="p-3.5 bg-emerald-50/10 rounded-xl border border-emerald-100/30 text-xs font-bold text-emerald-950 flex flex-col gap-1.5 shadow-5xs">
                                  <span className="font-sans font-black text-emerald-900">【{r.title}】</span>
                                  <p className="text-zinc-600 font-semibold line-clamp-3 leading-relaxed">{r.content}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-8 pt-4 border-t border-zinc-100 flex flex-col sm:flex-row gap-3 justify-center shrink-0">
                        <Button 
                          className="w-full sm:w-auto px-8 tracking-normal font-black h-12" 
                          onClick={() => loadGroupToHome(viewingInputGroup)}
                        >載入整日學習至首頁</Button>
                        <Button 
                          variant="secondary"
                          className="w-full sm:w-auto px-8 tracking-normal font-black h-12 border-zinc-200" 
                          onClick={() => setViewingInputGroup(null)}
                        >關閉視窗</Button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Quiz Customizable Selection Modal */}
            <AnimatePresence>
              {quizSelectionGroup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    onClick={() => setQuizSelectionGroup(null)}
                    className="absolute inset-0 bg-black/45 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.94, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 15 }}
                    className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-zinc-100"
                  >
                    <div className="p-8 sm:p-10">
                      <div className="text-center mb-6">
                        <h3 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center justify-center gap-2">
                          智慧測驗範圍選擇
                        </h3>
                        <p className="text-zinc-400 text-xs font-extrabold uppercase tracking-wide mt-1">
                          客製化 {quizSelectionGroup.date} 的學習題目
                        </p>
                      </div>

                      <div className="space-y-3 my-6">
                        {/* Words option card */}
                        <label className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer select-none transition-all ${
                          quizIncludeWords 
                            ? 'bg-zinc-900/5 border-zinc-900/20 ring-2 ring-zinc-900/5 shadow-2xs' 
                            : 'bg-white border-zinc-150 hover:border-zinc-300'
                        }`}>
                          <input 
                            type="checkbox" 
                            checked={quizIncludeWords} 
                            onChange={(e) => setQuizIncludeWords(e.target.checked)}
                            className="w-5 h-5 rounded text-zinc-900 focus:ring-zinc-900 border-zinc-300 cursor-pointer accent-zinc-900"
                          />
                          <div className="flex-1">
                            <p className="font-extrabold text-zinc-800 text-sm">複習基礎單字</p>
                            <p className="text-zinc-400 text-[10.5px] font-bold">
                              {quizSelectionGroup.allWords.length > 0 
                                ? `包含今日記下的 ${quizSelectionGroup.allWords.length} 個生詞與詞義` 
                                : quizSelectionGroup.userInputs.length > 0
                                  ? "包含今日對話輸入語句、單字以出題解析"
                                  : "包含今日記下的生字與詞義"}
                            </p>
                          </div>
                        </label>

                        {/* Grammar option card */}
                        <label className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer select-none transition-all ${
                          quizIncludeGrammar 
                            ? 'bg-indigo-50/50 border-indigo-250 ring-2 ring-indigo-500/5 shadow-2xs' 
                            : 'bg-white border-zinc-150 hover:border-zinc-300'
                        }`}>
                          <input 
                            type="checkbox" 
                            checked={quizIncludeGrammar} 
                            onChange={(e) => setQuizIncludeGrammar(e.target.checked)}
                            className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 cursor-pointer accent-indigo-600"
                          />
                          <div className="flex-1">
                            <p className="font-extrabold text-indigo-900 text-sm">複習深度文法</p>
                            <p className="text-zinc-400 text-[10.5px] font-bold">
                              {quizSelectionGroup.allGrammar.length > 0 
                                ? `涵蓋今日存載的 ${quizSelectionGroup.allGrammar.length} 個文法概念與接續` 
                                : quizSelectionGroup.userInputs.length > 0
                                  ? "包含今日對話輸入語句、文法以出題解析"
                                  : "涵蓋今日記下的文法概念"}
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Error State check */}
                      {!quizIncludeWords && !quizIncludeGrammar && (
                        <p className="text-[11px] text-rose-500 font-extrabold text-center mb-4 transition-all animate-pulse">
                          ⚠️ 請至少勾選一種複習範圍以出題喔！
                        </p>
                      )}

                      <div className="flex gap-3 pt-2">
                        <button 
                          disabled={!quizIncludeWords && !quizIncludeGrammar}
                          className={`flex-1 h-12 rounded-2xl font-black text-sm tracking-normal transition-all duration-300 cursor-pointer ${
                            (!quizIncludeWords && !quizIncludeGrammar)
                              ? 'bg-zinc-100 text-zinc-300 border border-zinc-200 cursor-not-allowed'
                              : 'bg-zinc-900 hover:bg-black text-white shadow-lg active:scale-95'
                          }`}
                          onClick={() => {
                            const finalWords = quizIncludeWords ? quizSelectionGroup.allWords : [];
                            const finalGrammar = quizIncludeGrammar ? quizSelectionGroup.allGrammar : [];
                            
                            // Gather user raw inputs to build specificPrompt fallback for Gemini
                            let specificPrompt: string | undefined = undefined;
                            if (quizSelectionGroup.userInputs && quizSelectionGroup.userInputs.length > 0) {
                              const inputList = quizSelectionGroup.userInputs.map((ui: any) => ui.text).filter(Boolean);
                              if (inputList.length > 0) {
                                specificPrompt = `請特別針對以下當天使用者在對話框中輸入/搜尋/學習過的日文生字或文法進行客製化出題：\n${inputList.join('、 ')}`;
                              }
                            }

                            setQuizConfig({
                              sourceWords: finalWords,
                              sourceGrammar: finalGrammar,
                              dateLabel: quizSelectionGroup.date,
                              specificPrompt: specificPrompt
                            });
                            setMode(AppMode.QUIZ);
                            setQuizSelectionGroup(null);
                          }}
                        >
                          開始複習測驗
                        </button>
                        <button 
                          className="px-5 h-12 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-2xl font-black text-sm text-zinc-500 hover:text-zinc-800 transition-all cursor-pointer"
                          onClick={() => setQuizSelectionGroup(null)}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      }
      default: return null;
    }
  };

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashIntro onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>
      <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      {/* Achievement Unlock Popup */}
      <AnimatePresence>
        {activeAchievement && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[3rem] p-8 sm:p-12 max-w-md w-full shadow-2xl relative border border-zinc-100 overflow-hidden"
            >
               <div className="absolute top-0 inset-x-0 h-3 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500" />
               <div className="text-center">
                  {activeAchievement.icon && <div className="text-8xl mb-6">{activeAchievement.icon}</div>}
                  <h2 className="text-3xl font-black tracking-tighter mb-2">成就達成！</h2>
                  <h3 className="text-xl font-bold text-zinc-600 mb-6">{activeAchievement.title}</h3>
                  <p className="text-zinc-500 mb-8 font-medium">{activeAchievement.description}</p>
                  
                  {activeAchievement.trivia && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100 text-left mb-8 relative overflow-hidden"
                    >
                       <div className="absolute top-0 right-0 p-2 opacity-5 text-zinc-900">
                          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                       </div>
                       <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">小知識探險</h4>
                       <p className="text-sm text-zinc-800 leading-relaxed font-bold">{activeAchievement.trivia}</p>
                    </motion.div>
                  )}

                  <Button size="lg" className="w-full text-lg py-4 rounded-2xl shadow-xl" onClick={() => setActiveAchievement(null)}>
                    繼續努力
                  </Button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {mode !== AppMode.CHAT && (
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-200">
          <div className={`max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between transition-all duration-300 ${mode === AppMode.CHAT ? 'h-13 sm:h-15' : 'h-16 sm:h-20'}`}>
            <div className="flex items-center gap-2 sm:gap-3 cursor-pointer" onClick={() => setMode(AppMode.LEARN)}>
              <LogoIcon />
              <h1 className="text-lg sm:text-xl font-black tracking-tighter uppercase hidden sm:block">日本語ごご!</h1>
            </div>
            {/* 電腦端頂部導航 (Desktop Navigation) */}
            <nav className="hidden md:flex gap-1 sm:gap-2">
              {[
                { m: AppMode.LEARN, i: <BookIcon />, l: '學習' },
                { m: AppMode.LISTENING, i: <SparklesIcon />, l: 'AI助理' },
                { m: AppMode.DIARY, i: <DiaryIcon />, l: '日記' },
                { m: AppMode.CHAT, i: <ChatIcon />, l: '對話' },
                { m: AppMode.HISTORY, i: <ClockIcon />, l: '紀錄' },
                { m: AppMode.FOCUS, i: <FocusIcon />, l: '專注' }
              ].map(nav => (
                <button 
                  key={nav.m} 
                  onClick={() => setMode(nav.m)}
                  className={`p-2 sm:p-3 rounded-lg sm:rounded-xl flex items-center gap-1.5 sm:gap-2 transition-all ${mode === nav.m ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-400 hover:bg-zinc-100'}`}
                >
                  {nav.i} <span className="text-xs sm:text-sm font-bold hidden md:block">{nav.l}</span>
                </button>
              ))}
            </nav>
          </div>
        </header>
      )}

      <main className={`mx-auto transition-all duration-300 ${
        mode === AppMode.CHAT 
          ? 'max-w-7xl pt-0 pb-0 px-0 sm:px-2 h-screen overflow-hidden flex flex-col' 
          : 'max-w-5xl py-10 px-6 pb-28 md:pb-20'
      }`}>
        <AnimatePresence mode="wait">
           {renderContent()}
        </AnimatePresence>
      </main>

      {/* 行動端底部導航 (Mobile Bottom Navigation) */}
      <motion.nav 
        initial={{ y: 0 }}
        animate={{ y: isBottomBarVisible ? '0%' : '110%' }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="fixed bottom-0 left-0 right-0 w-full z-50 bg-white/95 backdrop-blur-md border-t border-zinc-200 px-0.5 pt-2 pb-9 xs:pb-10 md:hidden flex justify-around items-center rounded-t-[1.75rem] shadow-[0_-10px_30px_-5px_rgba(0,0,0,0.1)] pb-safe-extra"
      >
        {[
          { m: AppMode.LEARN, i: <BookIcon />, l: '學習' },
          { m: AppMode.LISTENING, i: <SparklesIcon />, l: 'AI助理' },
          { m: AppMode.DIARY, i: <DiaryIcon />, l: '日記' },
          { m: AppMode.CHAT, i: <ChatIcon />, l: '對話' },
          { m: AppMode.HISTORY, i: <ClockIcon />, l: '紀錄' },
          { m: AppMode.FOCUS, i: <FocusIcon />, l: '專注' }
        ].map(nav => {
          const isActive = mode === nav.m;
          return (
            <button
              key={nav.m}
              onClick={() => setMode(nav.m)}
              className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all ${
                isActive ? 'text-zinc-900 font-extrabold' : 'text-zinc-400 font-medium'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-zinc-100 text-zinc-900 scale-105' : 'text-zinc-400 hover:text-zinc-600'}`}>
                {nav.i}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tighter block font-bold leading-none">{nav.l}</span>
            </button>
          );
        })}
      </motion.nav>

      <AnimatePresence>
        {mode !== AppMode.FOCUS && (timerState.isActive || timerState.timeLeft < (timerState.mode === 'FOCUS' ? timerState.focusDuration : timerState.breakDuration) * 60) && (
          <MiniTimer state={timerState} onClick={() => setMode(AppMode.FOCUS)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRecommendModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-xl rounded-[2rem] border border-zinc-150 shadow-2xl overflow-hidden flex flex-col relative"
            >
              <div className="p-6 sm:p-8 bg-zinc-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 p-2.5 rounded-xl text-yellow-300">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.187L15 15l-5.187.904zM18.007 7.007l-.507 2.493-2.493-.507L15 7l.507-2.493 2.493.507L18 7l-.007.007z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black">AI 智慧學習推薦</h3>
                    <p className="text-xs text-zinc-400 font-bold mt-0.5">自訂你想要 AI 產出的日語內容與等級</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowRecommendModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 sm:p-8 space-y-8 text-left max-h-[75vh] overflow-y-auto">
                {inputMode === 'WORD' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-black text-zinc-900 border-l-4 border-zinc-950 pl-2">
                        1. 選擇單字系列分類
                      </label>
                      <span className="text-xs text-zinc-500 font-bold">當前選擇：{recommendWordCategory}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: '日常用語', icon: '💬 日常用語' },
                        { key: '食物美食', icon: '🍣 食物美食' },
                        { key: '交通工具', icon: '🚄 交通工具' },
                        { key: '旅遊生活', icon: '✈️ 旅遊生活' },
                        { key: '購物娛樂', icon: '🛍️ 購物娛樂' },
                        { key: '動漫流行', icon: '🎬 動漫流行語' },
                      ].map((cat) => (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => setRecommendWordCategory(cat.key)}
                          className={`p-3.5 rounded-xl border text-sm font-bold text-left transition flex items-center gap-2 ${recommendWordCategory === cat.key ? 'border-zinc-900 bg-zinc-950 text-white shadow-md' : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'}`}
                        >
                          <span className="truncate">{cat.icon}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-black text-zinc-900 border-l-4 border-zinc-950 pl-2">
                      {inputMode === 'WORD' ? '2. 選擇日語合格等級 (JLPT)' : inputMode === 'GRAMMAR' ? '1. 選擇文法合格等級 (JLPT)' : '1. 選擇文章難易度 (JLPT等級)'}
                    </label>
                    <span className="text-xs text-zinc-500 font-bold">當前選擇：{selectedLevel}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {(['N5', 'N4', 'N3', 'N2', 'N1'] as JLPTLevel[]).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setSelectedLevel(level)}
                        className={`py-3 rounded-xl border text-base font-black text-center transition ${selectedLevel === level ? 'border-zinc-900 bg-zinc-950 text-white shadow-md' : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'}`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-400 font-bold">
                    {selectedLevel === 'N5' && '💡 N5：基礎日語，適合初學者學習日常基礎單字與基本助詞句型。'}
                    {selectedLevel === 'N4' && '💡 N4：初級日語，可理解基本生活話題與一般會話語法搭配。'}
                    {selectedLevel === 'N3' && '💡 N3：中級日語，逐步連接日常與一般報章雜誌的中等難度表達。'}
                    {selectedLevel === 'N2' && '💡 N2：中高級日語，可順暢讀懂社會、日常周遭甚至中等難度文章。'}
                    {selectedLevel === 'N1' && '💡 N1：高級日語，適合高階精進、理解深度的各樣論述與書面語。'}
                  </p>
                </div>

                {inputMode === 'READING' && (
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-150 space-y-1.5 text-left">
                    <div className="text-xs font-black text-zinc-800 flex items-center gap-1.5">
                      📖 文章主題隨機生成
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed font-bold">
                      AI 秘書將會隨機擬定生活、旅遊或文化小故事，並完全依據選定的 <span className="text-zinc-950 underline">{selectedLevel} 難度標準</span> 進行智慧語彙遣詞與段落剪接。
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowRecommendModal(false)}
                    className="flex-1 py-3 text-sm font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition"
                  >
                    關閉
                  </button>
                  <button
                    onClick={() => {
                      setShowRecommendModal(false);
                      handleLearn();
                    }}
                    className="flex-1 py-3 text-sm font-bold bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl transition shadow-md flex items-center justify-center gap-2"
                  >
                    🚀 確定並開始推薦
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}

export default App;
