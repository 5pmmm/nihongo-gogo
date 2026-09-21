
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateQuizFromContent } from '../services/geminiService';
import { WordDefinition, GrammarDefinition, QuizQuestion } from '../types';
import { Loader } from './Loader';
import { Button } from './Button';

const cleanTranscriptText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '') // Strip any residual HTML/XML/SSML tags
    .replace(/🎧\s*\[.*?\]/g, '') // Strip headers like 🎧 [聽力播放模擬]
    .trim();
};

const cleanOptionText = (text: string): string => {
  if (!text) return '';
  let cleaned = text.trim();
  
  // Clean alphabet prefixes like "A. ", "A、", "A ", "a. "
  cleaned = cleaned.replace(/^[A-Da-d](?:\s*[\.\:\,）\)\、\s．：，])\s*/, '');
  
  // Clean numeric prefixes like "1. ", "1、", "1) " but NOT followed by an arrow like "→" or "->"
  if (!cleaned.includes('→') && !cleaned.includes('->')) {
    cleaned = cleaned.replace(/^[1-4](?:\s*[\.\:\,）\)\、．：，])\s*/, '');
    // Clean trailing sentence periods or commas on single option tokens
    cleaned = cleaned.replace(/[。\.\,\，]+$/, '');
  }
  
  return cleaned.trim();
};

const renderOptionText = (text: string, isResultView = false) => {
  if (!text) return null;
  
  const hasArrow = text.includes('→') || text.includes('->');
  if (hasArrow) {
    const parts = text.split(/\s*\((.*?)\)/);
    if (parts.length >= 2) {
      const sequenceStr = parts[0];
      const sentenceStr = parts[1];
      const steps = sequenceStr.split(/\s*(?:→|->)\s*/).map(s => s.trim()).filter(Boolean);
      
      return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-1">
                {idx > 0 && (
                  <span className="text-zinc-400 font-bold text-xs sm:text-sm">→</span>
                )}
                <span className="inline-flex items-center justify-center w-5 h-5 sm:w-7 sm:h-7 rounded-lg bg-zinc-100 text-zinc-800 font-mono font-black text-xs sm:text-sm border border-zinc-200 shadow-sm">
                  {step}
                </span>
              </div>
            ))}
          </div>
          {sentenceStr && (
            <span className="text-zinc-600 font-sans text-xs sm:text-base bg-zinc-50 border border-zinc-200/60 rounded-xl px-2.5 py-1 font-medium tracking-wide">
              {sentenceStr}
            </span>
          )}
        </div>
      );
    }
  }

  return (
    <span className={isResultView ? "break-words leading-tight" : "text-xs sm:text-xl tracking-tight leading-snug pr-2 break-words text-left"}>
      {text}
    </span>
  );
};

const typeLabels: Record<string, string> = {
  vocab: '🏷️ 單字字彙',
  grammar: '📝 系統文法',
  ordering: '🔗 句子重組',
  listening: '🎧 聽力模擬',
  reading: '📖 閱讀理解',
};

const typeColors: Record<string, string> = {
  vocab: 'bg-teal-50 text-teal-700 border-teal-200/50',
  grammar: 'bg-indigo-50 text-indigo-700 border-indigo-200/50',
  ordering: 'bg-amber-50 text-amber-700 border-amber-200/50',
  listening: 'bg-rose-50 text-rose-700 border-rose-200/50',
  reading: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
};

interface QuizProps {
  sourceWords: WordDefinition[];
  sourceGrammar: GrammarDefinition[];
  specificPrompt?: string; // New prop for user-defined quiz content
  questionCount?: number; // Chosen number of questions (e.g., 5, 10, 15, 20)
  jlptLevel?: string; // Optional target JLPT Level
  onExit: () => void;
  title?: string;
  sourceArticle?: string; // User-provided article text
}

export const Quiz: React.FC<QuizProps> = ({ 
  sourceWords, 
  sourceGrammar, 
  specificPrompt, 
  questionCount, 
  jlptLevel, 
  onExit, 
  title,
  sourceArticle
}) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [selectedReviewIndex, setSelectedReviewIndex] = useState<number | null>(null);
  const [showArticleModal, setShowArticleModal] = useState(false);

  // Audio Playback States for Listening Questions
  const [isPlaying, setIsPlaying] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [speed, setSpeed] = useState(0.95);

  // Keep track of current playing session to avoid race conditions with cancels/skips
  const playSessionRef = useRef<number>(0);

  // Trigger dummy voice fetch to pre-load voices on load
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      const handleVoicesChanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      };
    }
  }, []);

  // Stop speech synthesis when question changes or review index changes
  useEffect(() => {
    window.speechSynthesis.cancel();
    playSessionRef.current++;
    setIsPlaying(false);
    setShowScript(false);
  }, [currentIndex, selectedReviewIndex]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const getJaVoices = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return { male: null, female: null, defaultVoice: null };
    const voices = window.speechSynthesis.getVoices();
    const jaVoices = voices.filter(v => v.lang.startsWith('ja'));
    
    if (jaVoices.length === 0) {
      return { male: null, female: null, defaultVoice: null };
    }

    // High quality Microsoft online voices: Nanami (female), Keita (male)
    // macOS high quality voices: Kyoko (female), Otoya (male)
    // Google voices: "Google 日本語"
    const femaleKeywords = ['neural2-a', 'neural2-b', 'wavenet-a', 'wavenet-b', 'nanami', 'kyoko', 'haruka', 'shiori', 'mayu', 'female', 'siri', 'ichona'];
    const maleKeywords = ['neural2-c', 'neural2-d', 'wavenet-c', 'wavenet-d', 'keita', 'otoya', 'ichiro', 'naofumi', 'kazuya', 'yuto', 'takumi', 'male', 'koutarou'];

    const findBestVoice = (keywords: string[], preferredGender?: 'male' | 'female') => {
      // 1. Natural / Online voices
      const naturalVoices = jaVoices.filter(v => 
        v.name.toLowerCase().includes('natural') || 
        v.name.toLowerCase().includes('online') || 
        v.name.toLowerCase().includes('neural')
      );
      for (const voice of naturalVoices) {
        if (keywords.some(kw => voice.name.toLowerCase().includes(kw))) {
          return voice;
        }
      }

      // 2. Google Japanese / Standard high-qual voices
      const googleVoice = jaVoices.find(v => v.name.toLowerCase().includes('google'));
      if (googleVoice && preferredGender !== 'male') return googleVoice;

      // 3. Any match
      for (const voice of jaVoices) {
        if (keywords.some(kw => voice.name.toLowerCase().includes(kw))) {
          return voice;
        }
      }

      // 4. Default gender-based
      if (preferredGender === 'male') {
        const maleVoice = jaVoices.find(v => 
          v.name.toLowerCase().includes('male') || 
          v.name.toLowerCase().includes('otoya') || 
          v.name.toLowerCase().includes('keita')
        );
        if (maleVoice) return maleVoice;
      } else {
        const femaleVoice = jaVoices.find(v => 
          v.name.toLowerCase().includes('female') || 
          v.name.toLowerCase().includes('kyoko') || 
          v.name.toLowerCase().includes('nanami')
        );
        if (femaleVoice) return femaleVoice;
      }

      return null;
    };

    const femaleVoice = findBestVoice(femaleKeywords, 'female') || jaVoices[0];
    let maleVoice = findBestVoice(maleKeywords, 'male');
    if (!maleVoice || maleVoice.name === femaleVoice.name) {
      maleVoice = jaVoices.find(v => v.name !== femaleVoice.name) || femaleVoice;
    }

    const defaultVoice = jaVoices.find(v => 
      v.name.toLowerCase().includes('nanami') || 
      v.name.toLowerCase().includes('kyoko')
    ) || jaVoices[0];

    return { male: maleVoice, female: femaleVoice, defaultVoice };
  };

  const parseDialogue = (text: string) => {
    // Clean headers like 🎧 [聽力對話模擬]
    const cleanText = text.replace(/🎧\s*\[.*?\]/g, '').trim();
    const lines = cleanText.split('\n');
    const result: { speaker: 'male' | 'female' | 'default'; text: string }[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const hasSsmlMale = trimmed.includes('<prosody') || trimmed.includes('volume="+4dB"');
      // Match common speaker patterns (e.g. "男：", "男性：", "女：", "女性：", "佐藤：", "鈴木：", "A：", "B：")
      const maleMatch = trimmed.match(/^(?:男|男性|男A|男B|佐藤|鈴木|田中|山田|先生|男の子)(?:：|:| :)/);
      const femaleMatch = trimmed.match(/^(?:女|女性|女A|女B|美咲|さくら|花子|お母さん|女の子)(?:：|:| :)/);

      if (maleMatch || hasSsmlMale) {
        const dialogueText = maleMatch ? trimmed.substring(maleMatch[0].length).trim() : trimmed;
        result.push({ speaker: 'male', text: dialogueText });
      } else if (femaleMatch) {
        const dialogueText = trimmed.substring(femaleMatch[0].length).trim();
        result.push({ speaker: 'female', text: dialogueText });
      } else {
        // Fallback or generic speaker parsing
        const generalMatch = trimmed.match(/^([^：:\s]{1,10})(?:：|:)\s*(.*)/);
        if (generalMatch) {
          const name = generalMatch[1].trim();
          const dialogueText = generalMatch[2].trim();
          const isMale = /男|佐藤|鈴木|先生|お父さん|課長|部長/.test(name) || hasSsmlMale;
          const isFemale = /女|美咲|さくら|花子|お母さん|女性/.test(name);
          result.push({ 
            speaker: isMale ? 'male' : (isFemale ? 'female' : 'default'), 
            text: dialogueText 
          });
        } else {
          result.push({ speaker: hasSsmlMale ? 'male' : 'default', text: trimmed });
        }
      }
    }

    if (result.length === 0) {
      result.push({ speaker: 'default', text: cleanText });
    }

    return result;
  };

  const playListeningAudio = (text: string) => {
    window.speechSynthesis.cancel();
    
    // Start a new playing session
    const sessionID = ++playSessionRef.current;
    
    const lines = parseDialogue(text);
    const { male, female, defaultVoice } = getJaVoices();
    
    let currentLineIndex = 0;
    setIsPlaying(true);

    const speakNextLine = () => {
      // Check if this session was cancelled
      if (sessionID !== playSessionRef.current) {
        return;
      }

      if (currentLineIndex >= lines.length) {
        setIsPlaying(false);
        return;
      }

      const line = lines[currentLineIndex];
      // Clean SSML / XML tags for Web SpeechSynthesis so browser utters clean text
      const speechText = line.text.replace(/<[^>]*>/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = 'ja-JP';
      utterance.volume = 1.0;

      // Assign voice and enforce character speech parameters:
      // Male: rate = 0.9, volume = 1.0, pitch = 1.05
      // Female: rate = 0.95, volume = 0.9, pitch = 1.0
      if (line.speaker === 'male' && male) {
        utterance.voice = male;
        utterance.rate = speed * 0.9;
        utterance.volume = 1.0;
        utterance.pitch = 1.05;
      } else if (line.speaker === 'female' && female) {
        utterance.voice = female;
        utterance.rate = speed * 0.95;
        utterance.volume = 0.9;
        utterance.pitch = 1.0;
      } else {
        if (defaultVoice) utterance.voice = defaultVoice;
        utterance.rate = speed * 0.95;
        utterance.volume = 0.95;
        utterance.pitch = 1.0;
      }

      utterance.onend = () => {
        if (sessionID === playSessionRef.current) {
          currentLineIndex++;
          // Simulated pause between turns in exam context: N1-N3 is slightly faster, let's do a realistic 700ms pause
          setTimeout(speakNextLine, 750);
        }
      };

      utterance.onerror = () => {
        if (sessionID === playSessionRef.current) {
          currentLineIndex++;
          speakNextLine();
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNextLine();
  };

  const togglePlay = () => {
    const currentQ = questions[currentIndex];
    if (isPlaying) {
      window.speechSynthesis.cancel();
      playSessionRef.current++;
      setIsPlaying(false);
    } else if (currentQ && currentQ.context) {
      playListeningAudio(currentQ.context);
    }
  };

  const handleCloseReview = () => {
    window.speechSynthesis.cancel();
    playSessionRef.current++;
    setIsPlaying(false);
    setSelectedReviewIndex(null);
  };

  useEffect(() => {
    const loadQuiz = async () => {
      try {
        setLoading(true);
        const qs = await generateQuizFromContent(
          sourceWords, 
          sourceGrammar, 
          specificPrompt, 
          questionCount || 10, 
          jlptLevel,
          sourceArticle
        );
        
        // Clean context and shuffle options of each question
        const shuffledQuestions = qs.map(q => {
          let cleanedContext = q.context ? cleanTranscriptText(q.context) : q.context;
          // CRITICAL ANTI-SPOILER: For vocab, grammar, and ordering questions, NEVER retain or show
          // the completed sentence/source text in context, as it reveals the answer right above the question.
          if (q.type === 'vocab' || q.type === 'grammar' || q.type === 'ordering') {
            cleanedContext = '';
          }

          if (!q.options || q.options.length <= 1) {
            return { ...q, context: cleanedContext };
          }

          // Track original position of each option
          const indexedOptions = q.options.map((opt, index) => ({ opt: cleanOptionText(opt), index }));

          // Fisher-Yates shuffle
          for (let i = indexedOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indexedOptions[i], indexedOptions[j]] = [indexedOptions[j], indexedOptions[i]];
          }

          const shuffledOptions = indexedOptions.map(item => item.opt);
          const newCorrectIndex = indexedOptions.findIndex(item => item.index === q.correctAnswerIndex);

          return {
            ...q,
            context: cleanedContext,
            options: shuffledOptions,
            correctAnswerIndex: newCorrectIndex !== -1 ? newCorrectIndex : q.correctAnswerIndex
          };
        });

        setQuestions(shuffledQuestions);
        setUserAnswers(new Array(shuffledQuestions.length).fill(null));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadQuiz();
  }, [sourceWords, sourceGrammar, specificPrompt, questionCount, jlptLevel, sourceArticle]);

  const handleAnswer = (optionIndex: number) => {
    if (userAnswers[currentIndex] !== null) return;
    const newAnswers = [...userAnswers];
    newAnswers[currentIndex] = optionIndex;
    setUserAnswers(newAnswers);

    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setShowResult(true);
      }
    }, 1200);
  };

  const calculateScore = () => userAnswers.reduce((acc, ans, idx) => acc + (ans === questions[idx].correctAnswerIndex ? 1 : 0), 0);

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader text={specificPrompt ? "正在解析內容並生成專屬題目..." : "出題中..."} /></div>;

  if (questions.length === 0) return (
    <div className="text-center p-8 bg-white/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/60 ring-1 ring-black/5">
      <p className="text-gray-500 mb-6 font-bold">目前暫時無法生成測驗，請稍後再試。</p>
      <Button onClick={onExit} variant="liquid">返回首頁</Button>
    </div>
  );

  if (showResult) {
    const score = calculateScore();
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto pb-10 sm:pb-20 px-2">
        <div className="text-center mb-6 sm:mb-10 bg-white p-6 sm:p-12 rounded-[1.5rem] sm:rounded-[3rem] border border-gray-100 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-32 bg-gray-50 rounded-full -translate-y-1/2 translate-x-1/2 -z-10" />
          <h2 className="text-lg sm:text-2xl font-black text-gray-500 mb-1 sm:mb-2 uppercase tracking-tighter">測驗結束</h2>
          <div className="text-4xl sm:text-7xl font-black text-gray-900 mb-4 sm:mb-6 tracking-tighter">
            {score} <span className="text-2xl text-gray-300 font-bold">/ {questions.length}</span>
          </div>
          <p className="text-gray-400 font-bold mb-6 sm:mb-10 text-sm sm:text-lg">表現得很棒！點擊下方題目查看詳細解析與翻譯對比。</p>
          <Button onClick={onExit} variant="liquid" className="px-6 sm:px-12 py-3 sm:py-5 text-sm sm:text-base">回到首頁</Button>
        </div>

        <div className="grid gap-3 sm:gap-6">
          {questions.map((q, idx) => {
            const isCorrect = userAnswers[idx] === q.correctAnswerIndex;
            return (
              <motion.div
                key={q.id}
                onClick={() => setSelectedReviewIndex(idx)}
                whileHover={{ y: -2, scale: 1.005 }}
                whileTap={{ scale: 0.995 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={`p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border cursor-pointer ${
                  isCorrect ? 'bg-white border-gray-100 hover:border-gray-300 shadow-sm' : 'bg-red-50/10 border-red-100 hover:bg-red-50/20 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-6">
                  <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center font-bold sm:font-black text-sm sm:text-lg shadow-md flex-shrink-0 ${
                    isCorrect ? 'bg-gray-900 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                     <h4 className="text-gray-900 font-bold sm:font-black text-sm sm:text-lg mb-1 sm:mb-2 line-clamp-1">{q.question}</h4>
                     <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                           {isCorrect ? '正確' : '錯誤'}
                        </span>
                        {q.type && (
                          <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${typeColors[q.type] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                            {typeLabels[q.type] || '綜合測驗'}
                          </span>
                        )}
                        {!isCorrect && <span className="text-gray-400 text-xs sm:text-sm font-bold tracking-tight">正解: {q.options[q.correctAnswerIndex]}</span>}
                     </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <AnimatePresence>
          {selectedReviewIndex !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/45 backdrop-blur-md"
              onClick={handleCloseReview}
            >
              <motion.div
                initial={{ scale: 0.94, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.94, opacity: 0, y: 15 }}
                transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
                className="w-full max-w-lg bg-white rounded-[1.5rem] sm:rounded-[3rem] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col mx-4"
                onClick={e => e.stopPropagation()}
              >
                 <div className="p-4 sm:p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">題目詳解 • 第 {selectedReviewIndex + 1} 題</h3>
                    <button onClick={handleCloseReview} className="p-3 bg-white rounded-full text-gray-400 hover:text-gray-900 transition-all shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                 </div>
                 <div className="p-5 sm:p-10 overflow-y-auto no-scrollbar space-y-6 sm:space-y-10">
                    {/* Language Review Helper Section */}
                    <div className="bg-zinc-50 border-2 border-zinc-200 rounded-[1.2rem] sm:rounded-[2rem] p-4 sm:p-8 space-y-4 sm:space-y-6 shadow-inner">
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">日文原文</h4>
                        <p className="text-lg sm:text-2xl font-black text-zinc-900 leading-top tracking-tighter whitespace-pre-line">
                          {questions[selectedReviewIndex].question}
                        </p>
                      </div>
                      
                      {questions[selectedReviewIndex].questionReading && (
                        <div className="space-y-1 pt-2 border-t border-zinc-100">
                          <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">平假名/讀音標示</h4>
                          <p className="text-sm sm:text-lg font-bold text-zinc-500 tracking-tight">
                            {questions[selectedReviewIndex].questionReading}
                          </p>
                        </div>
                      )}

                      {questions[selectedReviewIndex].questionTranslation && (
                        <div className="space-y-1 pt-2 border-t border-zinc-100">
                          <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">中文翻譯</h4>
                          <p className="text-sm sm:text-lg font-bold sm:font-black text-indigo-600/80 tracking-tight">
                            {questions[selectedReviewIndex].questionTranslation}
                          </p>
                        </div>
                      )}
                    </div>

                    {questions[selectedReviewIndex].context && (
                      questions[selectedReviewIndex].type === 'listening' ? (
                        <div className="bg-zinc-50 border border-zinc-200/80 rounded-[1.2rem] sm:rounded-[2rem] p-4 sm:p-6 space-y-4 shadow-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">聽力播放與文字回顧</span>
                            <div className="flex gap-1.5 items-center">
                              <span className="text-[9px] text-zinc-400 font-bold">語速</span>
                              {[0.8, 0.95, 1.15].map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => setSpeed(s)}
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded transition-all ${speed === s ? 'bg-zinc-900 text-white shadow-xs' : 'bg-white text-zinc-500 border border-zinc-150'}`}
                                >
                                  {s === 0.95 ? '標準' : s === 0.8 ? '慢速' : '快速'}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-zinc-150">
                            <button
                              type="button"
                              onClick={() => {
                                if (isPlaying) {
                                  window.speechSynthesis.cancel();
                                  setIsPlaying(false);
                                } else {
                                  playListeningAudio(questions[selectedReviewIndex].context || '');
                                }
                              }}
                              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95 ${isPlaying ? 'bg-rose-500 text-white animate-pulse' : 'bg-zinc-900 hover:bg-zinc-850 text-white'}`}
                            >
                              {isPlaying ? (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5 ml-0.5"><path d="M8 5v14l11-7z" /></svg>
                              )}
                            </button>
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-xs font-bold text-zinc-800 truncate">
                                {isPlaying ? '正在播放中...' : '點擊按鈕重聽語音'}
                              </p>
                              <p className="text-[10px] text-zinc-400 font-medium">日本語 AI 老師語音朗讀</p>
                            </div>
                          </div>
                          <div className="p-3.5 bg-white border border-zinc-150 rounded-xl text-zinc-800 text-xs sm:text-sm leading-relaxed whitespace-pre-line font-jp shadow-inner text-left">
                            {questions[selectedReviewIndex].context}
                          </div>
                        </div>
                      ) : questions[selectedReviewIndex].type === 'reading' && questions[selectedReviewIndex].context ? (
                        <div className="p-4 sm:p-6 bg-zinc-50 border border-zinc-200/80 rounded-2xl sm:rounded-3xl text-zinc-900 text-sm sm:text-base font-medium leading-relaxed shadow-xs text-left">
                          <p className="text-xs font-black text-zinc-500 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                            <span>📄</span> 閱讀文章段落
                          </p>
                          <div className="whitespace-pre-line font-jp text-zinc-800">
                            {questions[selectedReviewIndex].context}
                          </div>
                        </div>
                      ) : null
                    )}
                    
                    <div className="space-y-4">
                      <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">選項分析</h5>
                      {questions[selectedReviewIndex].options.map((opt, i) => {
                        const isSelected = userAnswers[selectedReviewIndex] === i;
                        const isCorrect = questions[selectedReviewIndex].correctAnswerIndex === i;
                        let style = "border-gray-100 text-gray-400 bg-gray-50/30";
                        let badgeStyle = "bg-zinc-100 text-zinc-500";
                        if (isCorrect) {
                          style = "border-green-500/30 bg-green-50 text-green-700 font-bold ring-4 ring-green-100/50";
                          badgeStyle = "bg-green-600 text-white";
                        } else if (isSelected && !isCorrect) {
                          style = "border-red-500/30 bg-red-50 text-red-600 ring-4 ring-red-100/50";
                          badgeStyle = "bg-red-500 text-white";
                        }
                        return (
                          <div key={i} className={`p-3 sm:p-5 border rounded-xl sm:rounded-2xl flex items-center justify-between gap-3 transition-all text-sm sm:text-lg ${style}`}>
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center font-bold sm:font-black text-xs sm:text-sm flex-shrink-0 ${badgeStyle}`}>
                                {['A.', 'B.', 'C.', 'D.'][i]}
                              </div>
                              {renderOptionText(opt, true)}
                            </div>
                            {isCorrect && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor" className="w-4 h-4 sm:w-6 sm:h-6 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-gray-900 p-5 sm:p-10 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500" />
                      <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mb-3 sm:mb-6">AI 老師的詳細解析</h5>
                      <p className="text-white leading-relaxed font-bold text-sm sm:text-lg tracking-tight">{questions[selectedReviewIndex].explanation}</p>
                    </div>
                 </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  const currentQ = questions[currentIndex];
  const currentSelected = userAnswers[currentIndex];
  return (
    <div className="max-w-3xl mx-auto px-1 sm:px-4">
      <div className="mb-3 sm:mb-10 flex items-center justify-between px-2 sm:px-6">
        <div>
           <h2 className="text-base sm:text-2xl font-black text-gray-900 tracking-tighter uppercase">{title || "測驗進行中"}</h2>
           {specificPrompt && <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">基於您的輸入內容生成</p>}
        </div>
        <div className="flex items-center gap-2">
          {sourceArticle && (
            <button
              type="button"
              onClick={() => setShowArticleModal(true)}
              className="text-[11px] sm:text-xs font-bold text-zinc-750 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 px-2.5 sm:px-3 py-1 sm:py-2 rounded-lg sm:rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
            >
              <span>📰</span> <span className="hidden xs:inline">查看</span>文章全文
            </button>
          )}
          <span className="text-[11px] sm:text-sm font-black text-white bg-gray-900 px-3 sm:px-6 py-1 sm:py-2.5 rounded-lg sm:rounded-2xl shadow-xl flex-shrink-0">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>
      </div>
      <div className="relative min-h-[300px] sm:min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div key={currentQ.id} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="bg-white rounded-xl sm:rounded-[3rem] shadow-xl p-4 sm:p-12 border border-gray-100 relative">
            {currentQ.type && (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider mb-4 ${typeColors[currentQ.type] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                {typeLabels[currentQ.type] || '綜合測驗'}
              </div>
            )}
            {currentQ.context && (
              currentQ.type === 'listening' ? (
                <div className="mb-4 sm:mb-8 bg-zinc-50 border border-zinc-200/80 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 space-y-4 shadow-sm">
                  {/* Listening Header & Badge */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 relative">
                        {isPlaying && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        )}
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPlaying ? 'bg-rose-500' : 'bg-zinc-400'}`}></span>
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-zinc-650">
                        {isPlaying ? '正在播音中...' : '已準備好，請點擊播放'}
                      </p>
                    </div>
                    {/* Speed Selector */}
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase mr-1">語速</span>
                      {[0.8, 0.95, 1.15].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setSpeed(s);
                            if (isPlaying) {
                              playListeningAudio(currentQ.context || '');
                            }
                          }}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                            speed === s
                              ? 'bg-zinc-900 text-white shadow-xs'
                              : 'bg-white text-zinc-550 border border-zinc-150 hover:bg-zinc-50'
                          }`}
                        >
                          {s === 0.95 ? '標準' : s === 0.8 ? '慢速' : '快速'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Main Interaction Area */}
                  <div className="flex flex-col items-center justify-center py-3 sm:py-6 space-y-3 sm:space-y-4">
                    {/* Audio wave / Headphone animation */}
                    <div className="flex items-end justify-center gap-1 h-6 mb-1">
                      {[1, 2, 3, 4, 5, 4, 3, 2, 1].map((val, idx) => (
                        <motion.div
                          key={idx}
                          animate={isPlaying ? {
                            height: [10, val * 6, 10]
                          } : {
                            height: 10
                          }}
                          transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: idx * 0.08,
                            ease: "easeInOut"
                          }}
                          className={`w-0.75 rounded-full ${isPlaying ? 'bg-rose-500' : 'bg-zinc-300'}`}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={togglePlay}
                      className={`group relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full text-white shadow-md transition-all ${
                        isPlaying 
                          ? 'bg-rose-500 hover:bg-rose-600 scale-95 ring-4 ring-rose-100' 
                          : 'bg-zinc-900 hover:bg-zinc-800 hover:scale-105 active:scale-95 ring-4 ring-zinc-100'
                      }`}
                    >
                      {isPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6">
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                    <p className="text-[11px] sm:text-xs text-zinc-400 font-bold max-w-xs text-center leading-relaxed">
                      {isPlaying ? '再次點擊可停止播音。請仔細聆聽音檔並回答問題。' : '點擊播放鈕播放日語對話/短文（不含文字原文，更考驗聽力）。'}
                    </p>
                  </div>

                  {/* Toggle Script Button */}
                  <div className="flex flex-col items-stretch pt-2 border-t border-zinc-200/60">
                    <button
                      type="button"
                      onClick={() => setShowScript(!showScript)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 ${
                        showScript 
                          ? 'bg-zinc-150 text-zinc-700 border-zinc-200' 
                          : 'bg-white text-zinc-500 border-zinc-150 hover:bg-zinc-50'
                      }`}
                    >
                      <span>{showScript ? '👀 隱藏對話原文' : '📖 顯示對話原文 (輔助學習)'}</span>
                    </button>
                    
                    <AnimatePresence>
                      {showScript && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2.5 p-3 sm:p-4 bg-white border border-zinc-150 rounded-xl text-zinc-800 text-xs sm:text-sm leading-relaxed whitespace-pre-line font-jp shadow-inner text-left">
                            {currentQ.context}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ) : currentQ.type === 'reading' && currentQ.context ? (
                <div className="mb-4 sm:mb-8 bg-zinc-50 border border-zinc-200/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs text-left">
                  <div className="flex items-center gap-2 mb-2 text-xs font-black text-zinc-500 uppercase tracking-wider">
                    <span className="text-sm">📄</span> 閱讀測驗段落
                  </div>
                  <div className="text-zinc-900 leading-relaxed text-sm sm:text-base font-medium whitespace-pre-line font-jp">
                    {currentQ.context}
                  </div>
                </div>
              ) : null
            )}
            <h3 className="text-[14px] sm:text-2xl font-extrabold sm:font-black text-gray-900 mb-4 sm:mb-12 leading-snug sm:leading-tight tracking-tight whitespace-pre-line">{currentQ.question}</h3>
            <div className="grid gap-2 sm:gap-5">
              {currentQ.options.map((option, idx) => {
                const isSelected = currentSelected === idx;
                const isCorrect = idx === currentQ.correctAnswerIndex;
                const hasAnswered = currentSelected !== null;
                let btnClass = "bg-gray-50 border-gray-100 text-gray-700";
                if (hasAnswered) {
                  if (isCorrect) btnClass = "bg-green-50 border-green-200 text-green-700 font-bold shadow-md ring-2 ring-green-100";
                  else if (isSelected) btnClass = "bg-red-50 border-red-200 text-red-600 ring-2 ring-red-100";
                  else btnClass = "opacity-30 border-transparent bg-gray-50/20 grayscale";
                } else btnClass += " hover:bg-white hover:border-gray-900 hover:shadow-xl hover:scale-[1.01]";
                
                let badgeClass = "bg-zinc-100 text-zinc-500";
                if (hasAnswered) {
                  if (isCorrect) badgeClass = "bg-green-600 text-white";
                  else if (isSelected) badgeClass = "bg-red-500 text-white";
                  else badgeClass = "bg-zinc-100 text-zinc-300 opacity-50";
                }
                
                return (
                  <motion.button key={idx} onClick={() => handleAnswer(idx)} className={`w-full text-left p-2.5 sm:p-5 rounded-lg sm:rounded-2xl font-medium sm:font-black relative overflow-hidden border ${btnClass}`} disabled={hasAnswered} whileHover={!hasAnswered ? { y: -3 } : {}} whileTap={!hasAnswered ? { scale: 0.98 } : {}}>
                    <div className="flex justify-between items-center relative z-10 w-full">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center font-bold sm:font-black text-xs sm:text-sm flex-shrink-0 ${badgeClass}`}>
                            {['A.', 'B.', 'C.', 'D.'][idx]}
                          </div>
                          {renderOptionText(option, false)}
                        </div>
                        {hasAnswered && isCorrect && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-green-600 bg-white/80 rounded-full p-0.5 sm:p-2 shadow-md flex-shrink-0"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor" className="w-3.5 h-3.5 sm:w-6 sm:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg></motion.span>}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Article Reference Modal */}
      {showArticleModal && sourceArticle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-7 max-h-[85vh] flex flex-col shadow-2xl border border-zinc-200"
          >
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-zinc-100">
              <h3 className="text-sm sm:text-base font-black text-zinc-900 flex items-center gap-2">
                <span>📰</span> 測驗參考文章原文
              </h3>
              <button
                type="button"
                onClick={() => setShowArticleModal(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-xl hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 font-bold mb-2">
              提示：您可以隨時對照此文章內容。請於閱讀後關閉視窗作答。
            </p>
            <div className="overflow-y-auto flex-1 text-xs sm:text-sm leading-relaxed text-zinc-800 whitespace-pre-line font-jp p-3.5 sm:p-4 bg-zinc-50 rounded-2xl border border-zinc-150">
              {sourceArticle}
            </div>
            <div className="mt-4 pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowArticleModal(false)}
                className="px-5 py-2 bg-zinc-900 text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                關閉返回測驗
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
