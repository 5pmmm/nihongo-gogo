import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuizQuestion, WordDefinition, GrammarDefinition } from '../types';
import { getCachedQuestions } from '../services/quizStorage';
import { generateQuizFromContent, generateTargetedQuiz } from '../services/geminiService';
import { Loader } from './Loader';

// Helper to remove any numeric or alphabetic prefix and clean up option text
const cleanOptionText = (text: string) => {
  if (!text) return '';
  return text
    .replace(/^[A-Da-d1-4][\.\、\s\)\:\-]\s*/, '')
    .replace(/[。\.\s]+$/, '')
    .trim();
};

const cleanTranscriptText = (text: string) => {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\[.*?\]/g, '')
    .trim();
};

const parseOrderingQuestion = (q: QuizQuestion) => {
  const isOrdering = q.subType === 'ordering' || q.type === 'ordering' || (q.scrambleItems && q.scrambleItems.length > 0);
  if (!isOrdering) return null;

  if (q.sentence && q.scrambleItems && q.scrambleItems.length > 0) {
    return {
      sentence: q.sentence.replace(/\\n/g, '\n').trim(),
      scrambleItems: q.scrambleItems.map(cleanOptionText),
      instruction: (q.instruction || "★ に入る最もよいものを、1・2・3・4 から一つ選びなさい。").replace(/\\n/g, ' ').trim()
    };
  }

  const raw = q.question || '';
  const bracketMatch = raw.match(/【(.*?)】/) || raw.match(/\[(.*?)\]/);
  let items: string[] = [];

  if (bracketMatch) {
    const bracketContent = bracketMatch[1];
    items = bracketContent
      .split(/(?:[1-4][\.\、\s]\s*|[\s　]+)/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !/^[1-4]$/.test(s));
  }

  let sentence = raw;
  if (bracketMatch && bracketMatch.index !== undefined) {
    sentence = raw.substring(0, bracketMatch.index).trim();
  } else {
    const cutIdx = raw.search(/(?:【|\[|請重組|★\s*に入)/);
    if (cutIdx > 0) {
      sentence = raw.substring(0, cutIdx).trim();
    }
  }

  let instruction = q.instruction || "★ に入る最もよいものを、1・2・3・4 から一つ選びなさい。";
  const instMatch = raw.match(/(?:★\s*に入[^\r\n]*|請重組[^：:\r\n]*[：:]?)/);
  if (!q.instruction && instMatch) {
    instruction = instMatch[0].trim();
  }

  return {
    sentence: (sentence || raw).replace(/\\n/g, '\n').trim(),
    scrambleItems: items.length > 0 ? items : q.options.map(cleanOptionText),
    instruction: instruction.replace(/\\n/g, ' ').trim()
  };
};

interface QuizProps {
  sourceWords: WordDefinition[];
  sourceGrammar: GrammarDefinition[];
  specificPrompt?: string;
  questionCount?: number;
  jlptLevel?: string;
  onExit: () => void;
  title?: string;
  sourceArticle?: string;
  mode?: 'TARGETED_STUDY' | 'JLPT_EXAM';
  targetItem?: string;
}

export const Quiz: React.FC<QuizProps> = ({ 
  sourceWords, 
  sourceGrammar, 
  specificPrompt, 
  questionCount, 
  jlptLevel, 
  onExit, 
  title,
  sourceArticle,
  mode = 'JLPT_EXAM',
  targetItem
}) => {
  const isTargetedMode = mode === 'TARGETED_STUDY' || Boolean(targetItem) || Boolean(sourceArticle);
  
  // Track B Exam Lobby States
  const [examStarted, setExamStarted] = useState<boolean>(isTargetedMode);
  const [selectedExamLevel, setSelectedExamLevel] = useState<string>(jlptLevel || 'N3');
  const [selectedExamCount, setSelectedExamCount] = useState<number>(questionCount || 15);
  const [selectedExamType, setSelectedExamType] = useState<string>('ALL');

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("載入題目中...");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [selectedReviewIndex, setSelectedReviewIndex] = useState<number | null>(null);
  const [showArticleModal, setShowArticleModal] = useState(false);

  // Audio Playback States for Listening Questions
  const [isPlaying, setIsPlaying] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [speed, setSpeed] = useState(0.9);

  const playSessionRef = useRef<number>(0);

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

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    playSessionRef.current++;
    setIsPlaying(false);
    setShowScript(false);
  }, [currentIndex, selectedReviewIndex]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      playSessionRef.current++;
    };
  }, []);

  const getJaVoices = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return { male: null, female: null, defaultVoice: null };
    const voices = window.speechSynthesis.getVoices();
    const jaVoices = voices.filter(v => v.lang.startsWith('ja'));
    
    if (jaVoices.length === 0) {
      return { male: null, female: null, defaultVoice: null };
    }

    const femaleKeywords = ['neural2-a', 'neural2-b', 'wavenet-a', 'wavenet-b', 'nanami', 'kyoko', 'haruka', 'shiori', 'mayu', 'female', 'siri', 'ichona'];
    const maleKeywords = ['neural2-c', 'neural2-d', 'wavenet-c', 'wavenet-d', 'keita', 'otoya', 'ichiro', 'naofumi', 'kazuya', 'yuto', 'takumi', 'male', 'koutarou'];

    const findBestVoice = (keywords: string[], preferredGender?: 'male' | 'female') => {
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

      const googleVoice = jaVoices.find(v => v.name.toLowerCase().includes('google'));
      if (googleVoice && preferredGender !== 'male') return googleVoice;

      for (const voice of jaVoices) {
        if (keywords.some(kw => voice.name.toLowerCase().includes(kw))) {
          return voice;
        }
      }

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

    const neural2c = jaVoices.find(v => v.name.toLowerCase().includes('neural2-c') || v.name.toLowerCase().includes('neural2-d'));
    let maleVoice = neural2c || findBestVoice(maleKeywords, 'male');
    if (!maleVoice || maleVoice.name === jaVoices[0]?.name) {
      maleVoice = jaVoices.find(v => v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('keita') || v.name.toLowerCase().includes('otoya')) || jaVoices[0];
    }
    const femaleVoice = findBestVoice(femaleKeywords, 'female') || jaVoices.find(v => v !== maleVoice) || jaVoices[0];

    const defaultVoice = jaVoices.find(v => 
      v.name.toLowerCase().includes('nanami') || 
      v.name.toLowerCase().includes('kyoko')
    ) || jaVoices[0];

    return { male: maleVoice, female: femaleVoice, defaultVoice };
  };

  const parseDialogue = (text: string) => {
    const cleanText = text.replace(/\[.*?\]/g, '').trim();
    const lines = cleanText.split('\n');
    const result: { speaker: 'male' | 'female' | 'default'; text: string }[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const maleMatch = trimmed.match(/^(?:男|男性|男A|男B|佐藤|鈴木|田中|山田|先生|男の子)(?:：|:| :)/);
      const femaleMatch = trimmed.match(/^(?:女|女性|女A|女B|美咲|さくら|花子|お母さん|女の子)(?:：|:| :)/);

      if (maleMatch) {
        const dialogueText = trimmed.substring(maleMatch[0].length).trim();
        result.push({ speaker: 'male', text: dialogueText });
      } else if (femaleMatch) {
        const dialogueText = trimmed.substring(femaleMatch[0].length).trim();
        result.push({ speaker: 'female', text: dialogueText });
      } else {
        const generalMatch = trimmed.match(/^([^：:\s]{1,10})(?:：|:)\s*(.*)/);
        if (generalMatch) {
          const name = generalMatch[1].trim();
          const dialogueText = generalMatch[2].trim();
          const isMale = /男|佐藤|鈴木|先生|お父さん|課長|部長/.test(name);
          const isFemale = /女|美咲|さくら|花子|お母さん|女性/.test(name);
          result.push({ 
            speaker: isMale ? 'male' : (isFemale ? 'female' : 'default'), 
            text: dialogueText 
          });
        } else {
          result.push({ speaker: 'default', text: trimmed });
        }
      }
    }

    if (result.length === 0) {
      result.push({ speaker: 'default', text: cleanText });
    }

    return result;
  };

  const playListeningAudio = (target: QuizQuestion | string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    const sessionID = ++playSessionRef.current;
    
    let lines: { speaker: string; text: string; gender: 'male' | 'female' }[] = [];
    if (typeof target === 'object' && target?.dialogueLines && target.dialogueLines.length > 0) {
      lines = target.dialogueLines.map(l => ({
        speaker: l.speaker,
        text: cleanTranscriptText(l.text),
        gender: l.gender
      }));
    } else {
      const rawText = typeof target === 'string' ? target : (target?.transcript || target?.context || '');
      const parsed = parseDialogue(cleanTranscriptText(rawText));
      lines = parsed.map(p => ({
        speaker: p.speaker,
        text: p.text,
        gender: p.speaker === 'female' ? 'female' : 'male'
      }));
    }

    const { male, female, defaultVoice } = getJaVoices();
    let currentLineIndex = 0;
    setIsPlaying(true);

    const speakNextLine = () => {
      if (sessionID !== playSessionRef.current) return;
      if (currentLineIndex >= lines.length) {
        setIsPlaying(false);
        return;
      }

      const line = lines[currentLineIndex];
      const speechText = line.text.replace(/<[^>]*>/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = 'ja-JP';
      utterance.volume = 1.0;
      utterance.rate = speed || 0.9;

      if (line.gender === 'male' && male) {
        utterance.voice = male;
        utterance.pitch = 1.05;
        utterance.volume = 1.0;
        utterance.rate = speed || 0.9;
      } else if (line.gender === 'female' && female) {
        utterance.voice = female;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.rate = speed || 0.9;
      } else {
        if (defaultVoice) utterance.voice = defaultVoice;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.rate = speed || 0.9;
      }

      utterance.onend = () => {
        if (sessionID === playSessionRef.current) {
          currentLineIndex++;
          setTimeout(speakNextLine, 650);
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
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      playSessionRef.current++;
      setIsPlaying(false);
    } else if (currentQ && (currentQ.dialogueLines || currentQ.transcript || currentQ.context)) {
      playListeningAudio(currentQ);
    }
  };

  const handleCloseReview = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    playSessionRef.current++;
    setIsPlaying(false);
    setSelectedReviewIndex(null);
  };

  const prepareQuestions = (qs: QuizQuestion[]) => {
    return qs.map(q => {
      let cleanedContext = q.context ? cleanTranscriptText(q.context) : q.context;
      const isOrdering = q.subType === 'ordering' || q.type === 'ordering' || (q.scrambleItems && q.scrambleItems.length > 0);
      const isVocab = q.subType === 'vocab' || q.type === 'vocab' || q.type === 'VOCAB';
      const isGrammar = q.subType === 'grammar' || q.type === 'grammar';
      
      if (isVocab || isGrammar || isOrdering) {
        cleanedContext = '';
      }

      // Do NOT shuffle options for ordering questions, preserving 1:1 with scrambleItems
      if (isOrdering || !q.options || q.options.length <= 1) {
        return { ...q, context: cleanedContext, options: (q.options || []).map(cleanOptionText) };
      }

      const indexedOptions = q.options.map((opt, index) => ({ opt: cleanOptionText(opt), index }));
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
  };

  const loadQuiz = async (lvlOverride?: string, countOverride?: number, typeOverride?: string) => {
    try {
      setLoading(true);
      setLoadError(null);
      let qs: QuizQuestion[] = [];
      
      if (isTargetedMode) {
        if (sourceArticle && sourceArticle.trim()) {
          setLoadingMessage("深度解析文章並生成專屬練習...");
          qs = await generateQuizFromContent(
            sourceWords, 
            sourceGrammar, 
            specificPrompt, 
            questionCount || 5, 
            jlptLevel,
            sourceArticle
          );
        } else {
          const cleanTarget = (targetItem || specificPrompt || '').replace(/^[^\s「『]*[「『]([^」』]+)[」』].*$/, '$1').trim() || targetItem || 'はずです';
          setLoadingMessage(`正在針對「${cleanTarget}」生成專屬練習...`);
          qs = await generateTargetedQuiz(
            cleanTarget, 
            questionCount || 4, 
            jlptLevel
          );
        }
      } else {
        // JLPT Exam Bank: 100% static, 0 API calls
        const targetLvl = lvlOverride || selectedExamLevel;
        const targetCnt = countOverride || selectedExamCount;
        const targetTp = typeOverride || selectedExamType;
        qs = getCachedQuestions({ level: targetLvl, count: targetCnt, type: targetTp });
      }

      if (!qs || qs.length === 0) {
        setLoadError("未能取得符合條件的題目，請重試或變更等級篩選。");
        setQuestions([]);
        return;
      }
      
      const shuffledQuestions = prepareQuestions(qs);
      setQuestions(shuffledQuestions);
      setUserAnswers(new Array(shuffledQuestions.length).fill(null));
      setCurrentIndex(0);
      setShowResult(false);
      setSelectedReviewIndex(null);
    } catch (e: any) {
      console.error(e);
      setLoadError("出題暫時遇到狀況，請點擊重試。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isTargetedMode || examStarted) {
      loadQuiz();
    }
  }, [sourceWords, sourceGrammar, specificPrompt, questionCount, jlptLevel, sourceArticle, mode, targetItem]);

  const handleStartExam = () => {
    setExamStarted(true);
    loadQuiz(selectedExamLevel, selectedExamCount, selectedExamType);
  };

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
    }, 1100);
  };

  const calculateScore = () => userAnswers.reduce((acc, ans, idx) => acc + (ans === questions[idx].correctAnswerIndex ? 1 : 0), 0);

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-[360px] flex flex-col items-center justify-center p-8 text-center bg-white border border-[#E9ECEF] rounded-2xl">
        <Loader text={loadingMessage} />
      </div>
    );
  }

  // 2. Error State
  if (loadError) {
    return (
      <div className="min-h-[340px] flex flex-col items-center justify-center p-8 text-center bg-white border border-[#E9ECEF] rounded-2xl space-y-4">
        <p className="text-sm font-medium text-[#8B4848]">{loadError}</p>
        <button
          type="button"
          onClick={() => loadQuiz()}
          className="px-5 py-2.5 bg-[#4F6375] hover:bg-[#3D4F5F] text-white rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
        >
          重新嘗試
        </button>
      </div>
    );
  }

  // 3. Track B Exam Lobby
  if (!examStarted && !isTargetedMode) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        <div className="bg-white border border-[#E9ECEF] rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#4F6375]/10 text-[#3D4F5F] mb-2 inline-block">
              歷年真題庫
            </span>
            <h2 className="text-[20px] font-bold text-[#2B303A] tracking-tight">
              JLPT 歷年模擬考
            </h2>
            <p className="text-sm text-[#6C757D] mt-1">
              收錄 N5 至 N1 歷年考題，跨年份混搭隨機出題，完全離線零 API 消耗
            </p>
          </div>

          {/* Level Selector */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-[#2B303A]">
              1. 選擇檢定等級
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {['N5', 'N4', 'N3', 'N2', 'N1', 'ALL'].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSelectedExamLevel(lvl)}
                  className={`py-2 rounded-xl text-sm font-bold border transition-all ${
                    selectedExamLevel === lvl
                      ? 'bg-[#2B303A] text-white border-[#2B303A]'
                      : 'bg-[#F8F9FA] text-[#6C757D] border-[#E9ECEF] hover:border-[#CED4DA]'
                  }`}
                >
                  {lvl === 'ALL' ? '全級別' : lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Question Count */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-[#2B303A]">
              2. 選擇測驗題數
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 20].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setSelectedExamCount(cnt)}
                  className={`py-2 rounded-xl text-sm font-bold border transition-all ${
                    selectedExamCount === cnt
                      ? 'bg-[#2B303A] text-white border-[#2B303A]'
                      : 'bg-[#F8F9FA] text-[#6C757D] border-[#E9ECEF] hover:border-[#CED4DA]'
                  }`}
                >
                  {cnt} 題
                </button>
              ))}
            </div>
          </div>

          {/* Question Type */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-[#2B303A]">
              3. 題型範圍
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'ALL', label: '全部題型' },
                { id: 'vocab', label: '文字・語彙' },
                { id: 'grammar', label: '文法' },
                { id: 'ordering', label: '句子重組' },
                { id: 'listening', label: '聽力測驗' },
              ].map((tp) => (
                <button
                  key={tp.id}
                  type="button"
                  onClick={() => setSelectedExamType(tp.id)}
                  className={`py-2 px-2 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
                    selectedExamType === tp.id
                      ? 'bg-[#4F6375] text-white border-[#4F6375]'
                      : 'bg-[#F8F9FA] text-[#6C757D] border-[#E9ECEF] hover:border-[#CED4DA]'
                  }`}
                >
                  {tp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleStartExam}
              className="w-full py-3.5 bg-[#2B303A] hover:bg-[#1E222A] text-white rounded-xl text-base font-bold transition-all active:scale-[0.99] shadow-xs"
            >
              開始模擬測驗
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Result Screen
  if (showResult) {
    const score = calculateScore();
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        <div className="bg-white border border-[#E9ECEF] rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#4F6375]/10 text-[#3D4F5F]">
            測驗完成
          </span>
          <h2 className="text-[20px] font-bold text-[#2B303A] tracking-tight">
            測驗得分：{score} / {questions.length}
          </h2>
          <p className="text-sm text-[#6C757D]">
            點擊下方題目即可查看完整解答與詳細解析
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {!isTargetedMode ? (
              <>
                <button
                  type="button"
                  onClick={() => loadQuiz(selectedExamLevel, selectedExamCount, selectedExamType)}
                  className="px-5 py-2.5 bg-[#4F6375] hover:bg-[#3D4F5F] text-white rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
                >
                  重新測驗
                </button>
                <button
                  type="button"
                  onClick={() => { setExamStarted(false); setShowResult(false); }}
                  className="px-5 py-2.5 bg-[#F8F9FA] hover:bg-[#E9ECEF] text-[#2B303A] border border-[#CED4DA] rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
                >
                  變更測驗設定
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => loadQuiz()}
                className="px-5 py-2.5 bg-[#4F6375] hover:bg-[#3D4F5F] text-white rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
              >
                再次練習
              </button>
            )}
            <button
              type="button"
              onClick={onExit}
              className="px-5 py-2.5 bg-white hover:bg-[#F8F9FA] text-[#6C757D] border border-[#CED4DA] rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
            >
              返回主頁
            </button>
          </div>
        </div>

        {/* Review List */}
        <div className="grid gap-3">
          {questions.map((q, idx) => {
            const isCorrect = userAnswers[idx] === q.correctAnswerIndex;
            return (
              <div
                key={q.id || idx}
                onClick={() => setSelectedReviewIndex(idx)}
                className={`p-4 bg-white border rounded-xl cursor-pointer hover:border-[#CED4DA] transition-all flex items-center justify-between gap-4 ${
                  isCorrect ? 'border-[#E9ECEF]' : 'border-[#A35C5C]/30 bg-[#A35C5C]/5'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                    isCorrect ? 'bg-[#5A6959]/15 text-[#435242]' : 'bg-[#A35C5C]/15 text-[#8B4848]'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#2B303A] truncate font-jp">
                      {q.question}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${
                        isCorrect ? 'text-[#435242]' : 'text-[#8B4848]'
                      }`}>
                        {isCorrect ? '正確' : '錯誤'}
                      </span>
                      {!isCorrect && (
                        <span className="text-xs text-[#6C757D]">
                          正解：{q.options[q.correctAnswerIndex]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-[#4F6375] font-medium shrink-0">
                  查看解析
                </span>
              </div>
            );
          })}
        </div>

        {/* Review Modal */}
        <AnimatePresence>
          {selectedReviewIndex !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
              onClick={handleCloseReview}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white border border-[#E9ECEF] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-xl"
              >
                <div className="flex items-center justify-between pb-3 border-b border-[#E9ECEF]">
                  <h3 className="text-[18px] font-bold text-[#2B303A]">
                    第 {selectedReviewIndex + 1} 題解析
                  </h3>
                  <button
                    type="button"
                    onClick={handleCloseReview}
                    className="p-1 rounded-lg text-[#6C757D] hover:bg-[#F8F9FA]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 bg-[#F8F9FA] rounded-xl text-sm font-bold text-[#2B303A] font-jp leading-relaxed whitespace-pre-line">
                    {questions[selectedReviewIndex].question}
                  </div>

                  {questions[selectedReviewIndex].questionTranslation && (
                    <p className="text-xs text-[#6C757D] italic">
                      翻譯：{questions[selectedReviewIndex].questionTranslation}
                    </p>
                  )}

                  <div className="p-3 bg-[#5A6959]/10 rounded-xl text-xs sm:text-sm text-[#435242]">
                    <span className="font-bold mr-1">正確答案：</span>
                    {questions[selectedReviewIndex].options[questions[selectedReviewIndex].correctAnswerIndex]}
                  </div>

                  <div className="space-y-1 pt-2">
                    <h4 className="text-xs font-bold text-[#6C757D]">詳細解析</h4>
                    <p className="text-xs sm:text-sm text-[#2B303A] leading-relaxed whitespace-pre-line">
                      {questions[selectedReviewIndex].explanation}
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 5. Active Quiz Question View
  const currentQ = questions[currentIndex];
  const currentSelected = userAnswers[currentIndex];
  const parsedOrdering = parseOrderingQuestion(currentQ);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Quiz Top Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E9ECEF]">
        <div>
          <h2 className="text-[20px] font-bold text-[#2B303A] tracking-tight">
            {isTargetedMode ? `針對「${targetItem || '學習內容'}」針對性練習` : (title || "JLPT 歷年真題模擬考")}
          </h2>
          <p className="text-xs text-[#6C757D] mt-0.5">
            {isTargetedMode ? '專屬題目練習' : '跨年份混搭抽題，零 API 消耗'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sourceArticle && (
            <button
              type="button"
              onClick={() => setShowArticleModal(true)}
              className="text-xs font-medium text-[#4F6375] hover:text-[#3D4F5F] px-2.5 py-1.5 rounded-lg border border-[#E9ECEF] hover:bg-[#F8F9FA]"
            >
              檢視全文
            </button>
          )}
          <span className="text-sm font-bold text-[#2B303A] bg-[#F8F9FA] border border-[#E9ECEF] px-3 py-1 rounded-lg">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>
      </div>

      {/* Main Question Card */}
      <div className="bg-white border border-[#E9ECEF] rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Type / Year / Level Badges (Pure Text, No Emoji) */}
        <div className="flex items-center gap-2 text-xs">
          {currentQ.level && (
            <span className="px-2 py-0.5 rounded font-medium bg-[#4F6375]/10 text-[#3D4F5F]">
              {currentQ.level}
            </span>
          )}
          {currentQ.year && (
            <span className="px-2 py-0.5 rounded font-medium bg-[#7A6856]/10 text-[#635343]">
              {currentQ.year}
            </span>
          )}
          {(() => {
            const displayType = currentQ.subType || (currentQ.type === 'VOCAB' ? 'vocab' : currentQ.type === 'LISTENING' ? 'listening' : currentQ.scrambleItems?.length ? 'ordering' : currentQ.context ? 'reading' : 'grammar');
            return (
              <span className="px-2 py-0.5 rounded font-medium bg-[#E9ECEF] text-[#495057]">
                {displayType === 'vocab' ? '單字' : displayType === 'grammar' ? '文法' : displayType === 'ordering' ? '重組' : displayType === 'listening' ? '聽力' : '閱讀'}
              </span>
            );
          })()}
        </div>

        {/* Listening Practice Audio Section */}
        {(currentQ.subType === 'listening' || currentQ.type === 'listening' || currentQ.type === 'LISTENING' || !!currentQ.transcript) && (
          <div className="p-4 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#495057]">
                聽力播放
              </span>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[#6C757D] mr-1">語速</span>
                {[0.8, 0.9, 1.0].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      speed === s ? 'bg-[#2B303A] text-white' : 'bg-white text-[#6C757D] border border-[#E9ECEF]'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="px-4 py-2 bg-[#2B303A] hover:bg-[#1E222A] text-white text-xs font-bold rounded-lg transition-all active:scale-[0.98] inline-flex items-center gap-1.5"
              >
                <span>{isPlaying ? '停止播放' : '播放對話'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowScript(!showScript)}
                className="px-3 py-2 bg-white text-[#6C757D] hover:text-[#2B303A] border border-[#E9ECEF] text-xs font-medium rounded-lg"
              >
                {showScript ? '隱藏原文' : '查看對話原文'}
              </button>
            </div>

            {showScript && (
              <div className="mt-2 p-3 bg-white border border-[#E9ECEF] rounded-lg text-xs leading-relaxed font-jp whitespace-pre-line text-[#495057]">
                {currentQ.transcript || currentQ.context}
              </div>
            )}
          </div>
        )}

        {/* Reading Passage */}
        {(currentQ.subType === 'reading' || currentQ.type === 'reading' || (!currentQ.scrambleItems && !currentQ.transcript && currentQ.context)) && currentQ.context && (
          <div className="p-4 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl text-sm leading-relaxed font-jp whitespace-pre-line text-[#2B303A]">
            {currentQ.context}
          </div>
        )}

        {/* Question Text / Ordering Question Layout */}
        {parsedOrdering ? (
          <div className="space-y-4">
            {/* Top: Sentence stem */}
            <div className="p-4 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl">
              <span className="text-xs font-bold text-[#6C757D] block mb-1">
                句子重組題幹
              </span>
              <p className="text-[17px] font-bold text-[#2B303A] font-jp leading-relaxed whitespace-pre-line">
                {parsedOrdering.sentence}
              </p>
            </div>

            {/* Middle: Scramble items 1~4 */}
            <div className="space-y-1.5">
              <span className="text-xs text-[#6C757D] font-medium block">
                重組單字清單 (1~4)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {parsedOrdering.scrambleItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F8F9FA] border border-[#E9ECEF] rounded-lg text-sm font-bold text-[#2B303A] font-jp"
                  >
                    <span className="w-4 h-4 rounded-full bg-white text-[#2B303A] text-[10px] font-bold flex items-center justify-center border border-[#CED4DA]">
                      {idx + 1}
                    </span>
                    <span>{cleanOptionText(item)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Instruction */}
            <p className="text-xs text-[#6C757D]">
              {parsedOrdering.instruction}
            </p>
          </div>
        ) : (
          <h3 className="text-[18px] sm:text-[20px] font-bold text-[#2B303A] leading-relaxed font-jp whitespace-pre-line">
            {currentQ.question}
          </h3>
        )}

        {/* Option Click Buttons A, B, C, D */}
        <div className="grid gap-2.5">
          {currentQ.options.map((option, idx) => {
            const isSelected = currentSelected === idx;
            const isCorrect = idx === currentQ.correctAnswerIndex;
            const hasAnswered = currentSelected !== null;

            let btnStyle = "bg-[#F8F9FA] border-[#E9ECEF] text-[#2B303A] hover:bg-white hover:border-[#CED4DA]";
            if (hasAnswered) {
              if (isCorrect) {
                btnStyle = "bg-[#5A6959]/15 border-[#5A6959]/40 text-[#435242] font-bold";
              } else if (isSelected) {
                btnStyle = "bg-[#A35C5C]/15 border-[#A35C5C]/40 text-[#8B4848] font-bold";
              } else {
                btnStyle = "opacity-40 bg-[#F8F9FA] border-transparent text-[#ADB5BD]";
              }
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={hasAnswered}
                onClick={() => handleAnswer(idx)}
                className={`w-full text-left p-3.5 rounded-xl border text-sm sm:text-base font-medium transition-all flex items-center justify-between ${btnStyle} active:scale-[0.99]`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-md bg-white border border-[#E9ECEF] text-xs font-bold flex items-center justify-center shrink-0 text-[#6C757D]">
                    {['A', 'B', 'C', 'D'][idx]}
                  </span>
                  <span className="font-jp">{cleanOptionText(option)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
