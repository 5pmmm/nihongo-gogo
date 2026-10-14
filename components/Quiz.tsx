import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuizQuestion, WordDefinition, GrammarDefinition } from '../types';
import { generateDailyStudyQuiz, DailyStudyQuizItem } from '../services/geminiService';
import { getTodayRecords, DailySearchItem } from '../services/dailyRecordStorage';
import { getBookmarks } from '../services/bookmarkStorage';
import { saveQuizResult } from '../services/quizStorage';
import { Loader } from './Loader';

// Helper to clean option text
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

interface QuizProps {
  onExit?: () => void;
  sourceWords?: WordDefinition[];
  sourceGrammar?: GrammarDefinition[];
}

export const Quiz: React.FC<QuizProps> = ({ onExit }) => {
  // Lobby States
  const [dailyItems, setDailyItems] = useState<DailySearchItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Quiz States
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [selectedReviewIndex, setSelectedReviewIndex] = useState<number | null>(null);

  // Audio Playback for Listening
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [showScript, setShowScript] = useState<boolean>(false);
  const playSessionRef = useRef<number>(0);

  // Load today's records on mount
  useEffect(() => {
    loadStudyRecords();
  }, []);

  const loadStudyRecords = () => {
    const today = getTodayRecords();
    setDailyItems(today);
    // By default, select all today's items
    setSelectedIds(new Set(today.map(item => item.id)));
  };

  const handleLoadBookmarks = () => {
    const bms = getBookmarks();
    if (bms.length === 0) {
      alert('收藏庫目前暫無項目。');
      return;
    }
    const converted: DailySearchItem[] = bms.map((bm) => ({
      id: `bm-${bm.id}`,
      date: '收藏庫',
      type: bm.type,
      term: bm.title,
      summary: (bm.data as any).meaning || '',
      timestamp: bm.savedAt,
      data: [bm.data as any]
    }));
    setDailyItems(converted);
    setSelectedIds(new Set(converted.map(c => c.id)));
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === dailyItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(dailyItems.map(item => item.id)));
    }
  };

  // Generate Quiz
  const handleStartDailyQuiz = async () => {
    const chosenItems = dailyItems.filter(item => selectedIds.has(item.id));
    if (chosenItems.length === 0) {
      setErrorMessage('請至少勾選一個欲測驗的學習項目。');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const requestItems: DailyStudyQuizItem[] = chosenItems.map(item => ({
        type: item.type,
        term: item.term,
        summary: item.summary,
        detail: typeof item.data === 'object' ? JSON.stringify(item.data).slice(0, 200) : ''
      }));

      const generated = await generateDailyStudyQuiz(requestItems, questionCount);
      if (!generated || generated.length === 0) {
        throw new Error('未取得有效題目');
      }

      setQuestions(generated);
      setUserAnswers(new Array(generated.length).fill(null));
      setCurrentIndex(0);
      setShowExplanation(false);
      setIsFinished(false);
      setIsStarted(true);
    } catch (err: any) {
      console.error('Quiz generation failed:', err);
      setErrorMessage('測驗題目生成失敗，請確認網路連線或稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  // Speech Synthesis for Listening Questions
  const getJaVoices = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return { male: null, female: null };
    const voices = window.speechSynthesis.getVoices();
    const jaVoices = voices.filter(v => v.lang.startsWith('ja'));

    if (jaVoices.length === 0) return { male: null, female: null };

    const maleKeywords = ['neural2-c', 'neural2-d', 'wavenet-c', 'wavenet-d', 'keita', 'otoya', 'ichiro', 'male'];
    const femaleKeywords = ['neural2-a', 'neural2-b', 'wavenet-a', 'wavenet-b', 'nanami', 'kyoko', 'female', 'google'];

    let maleVoice = jaVoices.find(v => maleKeywords.some(k => v.name.toLowerCase().includes(k))) || jaVoices[0];
    let femaleVoice = jaVoices.find(v => femaleKeywords.some(k => v.name.toLowerCase().includes(k))) || jaVoices[0];

    return { male: maleVoice, female: femaleVoice };
  };

  const playListeningAudio = (currentQ: QuizQuestion) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    playSessionRef.current++;
    const currentSession = playSessionRef.current;

    setIsPlayingAudio(true);

    const { male, female } = getJaVoices();

    if (currentQ.dialogueLines && currentQ.dialogueLines.length > 0) {
      const lines = currentQ.dialogueLines;
      let lineIndex = 0;

      const speakNext = () => {
        if (currentSession !== playSessionRef.current || lineIndex >= lines.length) {
          setIsPlayingAudio(false);
          return;
        }

        const line = lines[lineIndex];
        const cleanText = cleanTranscriptText(line.text);
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'ja-JP';
        utterance.rate = 0.9;

        if (line.gender === 'male' && male) {
          utterance.voice = male;
          utterance.volume = 1.0;
        } else if (female) {
          utterance.voice = female;
          utterance.volume = 0.95;
        }

        utterance.onend = () => {
          lineIndex++;
          setTimeout(speakNext, 350);
        };

        utterance.onerror = () => {
          setIsPlayingAudio(false);
        };

        window.speechSynthesis.speak(utterance);
      };

      speakNext();
    } else {
      const rawText = cleanTranscriptText(currentQ.transcript || currentQ.context || currentQ.question);
      const utterance = new SpeechSynthesisUtterance(rawText);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.9;
      if (female) utterance.voice = female;

      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  const stopListeningAudio = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    playSessionRef.current++;
    setIsPlayingAudio(false);
  };

  // Answer selection
  const handleSelectOption = (optionIndex: number) => {
    if (showExplanation) return; // Already answered

    const updated = [...userAnswers];
    updated[currentIndex] = optionIndex;
    setUserAnswers(updated);
    setShowExplanation(true);
    stopListeningAudio();
  };

  const handleNextQuestion = () => {
    stopListeningAudio();
    setShowScript(false);
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setShowExplanation(userAnswers[currentIndex + 1] !== null);
    } else {
      // Calculate score & finish
      setIsFinished(true);
      const correctCount = userAnswers.filter((ans, idx) => ans === (questions[idx].correctAnswerIndex ?? questions[idx].answer ?? 0)).length;
      saveQuizResult({
        date: new Date().toISOString().slice(0, 10),
        totalQuestions: questions.length,
        correctCount,
        scorePercentage: Math.round((correctCount / questions.length) * 100),
        testedTerms: dailyItems.filter(i => selectedIds.has(i.id)).map(i => i.term)
      });
    }
  };

  const handleRestartLobby = () => {
    stopListeningAudio();
    setIsStarted(false);
    setIsFinished(false);
    setQuestions([]);
    setCurrentIndex(0);
    setUserAnswers([]);
    setShowExplanation(false);
    setSelectedReviewIndex(null);
    loadStudyRecords();
  };

  // Current Question
  const currentQ = questions[currentIndex];
  const isOrdering = currentQ?.type === 'ordering' || currentQ?.subType === 'ordering' || Boolean(currentQ?.scrambleItems?.length);
  const isListening = currentQ?.type === 'listening' || currentQ?.subType === 'listening';
  const isReading = currentQ?.type === 'reading' || currentQ?.subType === 'reading';

  // ==========================================
  // VIEW 1: LOBBY (當日學習測驗設定與項目選擇)
  // ==========================================
  if (!isStarted) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white border border-[#E9ECEF] rounded-2xl p-6 sm:p-7 space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#4F6375]/10 text-[#3D4F5F] text-xs font-medium mb-1.5">
                <span>AI 即時針對性出題</span>
              </div>
              <h2 className="text-[20px] font-bold text-[#2B303A] tracking-tight">
                當日學習測驗
              </h2>
            </div>
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="text-xs text-[#6C757D] hover:text-[#2B303A] px-3 py-1.5 rounded-lg border border-[#E9ECEF] hover:bg-[#F8F9FA] transition-all cursor-pointer active:scale-[0.98]"
              >
                返回解析
              </button>
            )}
          </div>
          <p className="text-sm text-[#6C757D] leading-relaxed">
            系統已自動讀取您今日查詢的單字、文法與文章。勾選欲測驗的項目，Gemini 將即時為您量身打造專屬測驗（含單字拆解題、拼音題、星號重組題與閱讀理解題）。
          </p>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="bg-white border border-[#E9ECEF] rounded-2xl p-10 text-center space-y-4 shadow-xs">
            <Loader message="AI 正在根據您選擇的學習項目生成針對性測驗..." />
            <p className="text-xs text-[#6C757D]">
              嚴格約束重組題唯一正解，正在建構題意接續...
            </p>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-4 bg-[#8B4848]/10 border border-[#8B4848]/20 rounded-xl text-sm text-[#8B4848]">
            {errorMessage}
          </div>
        )}

        {!loading && (
          <>
            {/* Items selection card */}
            <div className="bg-white border border-[#E9ECEF] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#E9ECEF]">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#2B303A]">
                    選擇學習項目
                  </h3>
                  <span className="text-xs text-[#6C757D] font-medium">
                    (已選 {selectedIds.size} / {dailyItems.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {dailyItems.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-xs text-[#4F6375] hover:text-[#3D4F5F] font-medium px-2.5 py-1 rounded hover:bg-[#F1F3F5] transition-colors cursor-pointer"
                    >
                      {selectedIds.size === dailyItems.length ? '全部取消' : '全選'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleLoadBookmarks}
                    className="text-xs text-[#6C757D] hover:text-[#2B303A] font-medium px-2.5 py-1 rounded hover:bg-[#F1F3F5] transition-colors cursor-pointer"
                  >
                    載入收藏
                  </button>
                </div>
              </div>

              {dailyItems.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-[#F1F3F5] text-[#6C757D] mx-auto flex items-center justify-center font-bold text-sm">
                    記
                  </div>
                  <p className="text-sm text-[#2B303A] font-medium">
                    今天尚未有查詢紀錄
                  </p>
                  <p className="text-xs text-[#6C757D] max-w-sm mx-auto leading-relaxed">
                    請先在【解析】分頁中查詢單字、文法或文章，系統會自動儲存到當日紀錄，也可以點擊上方「載入收藏」使用收藏庫題目進行測驗。
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {dailyItems.map(item => {
                    const isChecked = selectedIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleSelectId(item.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isChecked
                            ? 'bg-[#F8F9FA] border-[#4F6375]/50'
                            : 'bg-white border-[#E9ECEF] hover:border-[#CED4DA]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Checkbox */}
                          <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors shrink-0 ${
                            isChecked ? 'bg-[#4F6375] text-white' : 'border border-[#CED4DA] bg-white'
                          }`}>
                            {isChecked && (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>

                          {/* Term & Info */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                                item.type === 'WORD'
                                  ? 'bg-[#4F6375]/10 text-[#3D4F5F]'
                                  : item.type === 'GRAMMAR'
                                  ? 'bg-[#7A6856]/10 text-[#635343]'
                                  : 'bg-[#5A6959]/10 text-[#354334]'
                              }`}>
                                {item.type === 'WORD' ? '單字' : item.type === 'GRAMMAR' ? '文法' : '文章'}
                              </span>
                              <span className="text-sm font-bold text-[#2B303A] truncate font-jp">
                                {item.term}
                              </span>
                            </div>
                            {item.summary && (
                              <p className="text-xs text-[#6C757D] truncate mt-0.5">
                                {item.summary}
                              </p>
                            )}
                          </div>
                        </div>

                        <span className="text-[11px] text-[#ADB5BD] shrink-0">
                          {item.date}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quiz Configuration */}
            <div className="bg-white border border-[#E9ECEF] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <h3 className="text-base font-bold text-[#2B303A]">
                出題數量設定
              </h3>
              <div className="flex items-center gap-3">
                {[3, 5, 10, 15].map(count => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setQuestionCount(count)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer active:scale-[0.98] ${
                      questionCount === count
                        ? 'bg-[#2B303A] text-white shadow-xs'
                        : 'bg-[#F8F9FA] text-[#6C757D] border border-[#E9ECEF] hover:text-[#2B303A]'
                    }`}
                  >
                    {count} 題
                  </button>
                ))}
              </div>
            </div>

            {/* Start Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleStartDailyQuiz}
                disabled={selectedIds.size === 0}
                className={`w-full py-3.5 rounded-xl text-[17px] font-bold text-white transition-all cursor-pointer shadow-xs active:scale-[0.99] ${
                  selectedIds.size === 0
                    ? 'bg-[#CED4DA] cursor-not-allowed'
                    : 'bg-[#4F6375] hover:bg-[#3D4F5F]'
                }`}
              >
                生成針對性測驗 (共 {questionCount} 題)
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: QUIZ COMPLETED / RESULTS REVIEW
  // ==========================================
  if (isFinished) {
    const correctCount = userAnswers.filter((ans, idx) => ans === (questions[idx].correctAnswerIndex ?? questions[idx].answer ?? 0)).length;
    const scorePercent = Math.round((correctCount / questions.length) * 100);

    return (
      <div className="w-full max-w-3xl mx-auto space-y-6">
        {/* Result Summary Card */}
        <div className="bg-white border border-[#E9ECEF] rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xs">
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#4F6375]/10 text-[#3D4F5F] text-xs font-bold">
            測驗完成
          </div>
          <h2 className="text-[20px] font-bold text-[#2B303A]">
            當日學習測驗成果
          </h2>
          <div className="flex items-center justify-center gap-6 py-2">
            <div>
              <div className="text-[20px] font-bold text-[#2B303A]">
                {correctCount} / {questions.length}
              </div>
              <div className="text-xs text-[#6C757D] mt-0.5">答對題數</div>
            </div>
            <div className="w-px h-8 bg-[#E9ECEF]" />
            <div>
              <div className="text-[20px] font-bold text-[#4F6375]">
                {scorePercent}%
              </div>
              <div className="text-xs text-[#6C757D] mt-0.5">正確率</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleRestartLobby}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#2B303A] text-white hover:bg-[#1E222A] transition-all cursor-pointer active:scale-[0.98] shadow-xs"
            >
              重新選擇題目
            </button>
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border border-[#E9ECEF] text-[#6C757D] hover:text-[#2B303A] hover:bg-[#F8F9FA] transition-all cursor-pointer active:scale-[0.98]"
              >
                返回解析
              </button>
            )}
          </div>
        </div>

        {/* Questions Review List */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-[#2B303A] px-1">
            題目檢討與詳細解析
          </h3>

          {questions.map((q, idx) => {
            const userAns = userAnswers[idx];
            const correctAns = q.correctAnswerIndex ?? q.answer ?? 0;
            const isCorrect = userAns === correctAns;
            const isExpanded = selectedReviewIndex === idx;

            return (
              <div
                key={q.id || idx}
                className={`bg-white border rounded-2xl p-5 transition-all ${
                  isCorrect ? 'border-[#E9ECEF]' : 'border-[#8B4848]/30 bg-[#8B4848]/5'
                }`}
              >
                <div 
                  className="flex items-start justify-between gap-3 cursor-pointer"
                  onClick={() => setSelectedReviewIndex(isExpanded ? null : idx)}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        isCorrect ? 'bg-[#5A6959]/15 text-[#354334]' : 'bg-[#8B4848]/15 text-[#8B4848]'
                      }`}>
                        第 {idx + 1} 題 {isCorrect ? '答對' : '答錯'}
                      </span>
                      <span className="text-xs text-[#6C757D]">
                        {q.subType === 'vocab' ? '單字/拼音' : q.subType === 'grammar' ? '文法' : q.subType === 'ordering' ? '重組題' : q.subType === 'reading' ? '閱讀' : '聽力'}
                      </span>
                    </div>
                    <p className="text-sm sm:text-base font-bold text-[#2B303A] font-jp pt-1">
                      {q.sentence || q.question}
                    </p>
                  </div>
                  <span className="text-xs text-[#4F6375] font-medium shrink-0 pt-1">
                    {isExpanded ? '收起解析' : '查看解析'}
                  </span>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-[#E9ECEF] space-y-3">
                    {/* User Answer vs Correct Answer */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-[#F8F9FA] border border-[#E9ECEF]">
                        <span className="text-[#6C757D]">您的回答：</span>
                        <div className={`font-bold mt-0.5 ${isCorrect ? 'text-[#354334]' : 'text-[#8B4848]'}`}>
                          {userAns !== null ? q.options[userAns] : '未作答'}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#F8F9FA] border border-[#E9ECEF]">
                        <span className="text-[#6C757D]">正確答案：</span>
                        <div className="font-bold text-[#354334] mt-0.5">
                          {q.options[correctAns]}
                        </div>
                      </div>
                    </div>

                    {/* Explanation */}
                    <div className="p-3.5 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl text-xs sm:text-sm text-[#495057] leading-relaxed whitespace-pre-wrap">
                      <div className="font-bold text-[#2B303A] mb-1">詳細解說：</div>
                      {q.explanation}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: ACTIVE QUIZ RUNNER
  // ==========================================
  const userSelectedOption = userAnswers[currentIndex];
  const correctOptionIndex = currentQ.correctAnswerIndex ?? currentQ.answer ?? 0;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Top Header / Progress */}
      <div className="bg-white border border-[#E9ECEF] rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRestartLobby}
            className="text-xs text-[#6C757D] hover:text-[#2B303A] px-2.5 py-1 rounded border border-[#E9ECEF] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
          >
            結束測驗
          </button>
          <div className="text-sm font-bold text-[#2B303A]">
            題目 {currentIndex + 1} / {questions.length}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-32 sm:w-48 bg-[#F1F3F5] h-2 rounded-full overflow-hidden">
          <div
            className="bg-[#4F6375] h-full transition-all duration-300 rounded-full"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Question Card */}
      <div className="bg-white border border-[#E9ECEF] rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        {/* Type Badge & Instruction */}
        <div className="flex items-center justify-between gap-2 border-b border-[#F1F3F5] pb-3">
          <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-[#4F6375]/10 text-[#3D4F5F]">
            {currentQ.subType === 'vocab' ? '單字 / 拼音' : currentQ.subType === 'grammar' ? '文法接續' : isOrdering ? '星號重組題' : isReading ? '文章閱讀' : '情境聽力'}
          </span>
          {currentQ.questionReading && (
            <span className="text-xs text-[#6C757D] font-jp hidden sm:inline">
              {currentQ.questionReading}
            </span>
          )}
        </div>

        {/* LISTENING QUESTION SECTION */}
        {isListening && (
          <div className="p-4 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#4F6375]">
                對話語音聆聽
              </span>
              <button
                type="button"
                onClick={() => setShowScript(!showScript)}
                className="text-xs text-[#6C757D] hover:text-[#2B303A] underline cursor-pointer"
              >
                {showScript ? '隱藏原文' : '查看對話原文'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => isPlayingAudio ? stopListeningAudio() : playListeningAudio(currentQ)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white transition-all cursor-pointer flex items-center gap-2 active:scale-[0.98] ${
                  isPlayingAudio ? 'bg-[#8B4848]' : 'bg-[#4F6375] hover:bg-[#3D4F5F]'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  {isPlayingAudio ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                  )}
                </svg>
                <span>{isPlayingAudio ? '停止播放' : '播放對話語音 (0.9x 語速)'}</span>
              </button>
            </div>

            {showScript && (
              <div className="p-3 bg-white border border-[#E9ECEF] rounded-lg text-xs sm:text-sm text-[#2B303A] whitespace-pre-wrap font-jp leading-relaxed">
                {cleanTranscriptText(currentQ.transcript || currentQ.context || '')}
              </div>
            )}
          </div>
        )}

        {/* READING QUESTION SECTION */}
        {isReading && currentQ.context && (
          <div className="p-4 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl text-sm sm:text-base text-[#2B303A] font-jp leading-relaxed whitespace-pre-wrap">
            {currentQ.context}
          </div>
        )}

        {/* ORDERING (星號重組題) SECTION */}
        {isOrdering ? (
          <div className="space-y-4">
            {/* Instruction */}
            <p className="text-xs text-[#6C757D] font-medium">
              {currentQ.instruction || '★ に入る最もよいものを、1・2・3・4 から一つ選びなさい。'}
            </p>

            {/* Template Sentence */}
            <div className="p-4 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl text-[17px] font-bold text-[#2B303A] font-jp tracking-wide leading-loose">
              {(currentQ.sentence || currentQ.question).replace(/\\n/g, '\n')}
            </div>

            {/* 4 Candidate Word Blocks */}
            {currentQ.scrambleItems && currentQ.scrambleItems.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {currentQ.scrambleItems.map((item, sIdx) => (
                  <div
                    key={sIdx}
                    className="p-2.5 rounded-lg bg-white border border-[#CED4DA] text-center text-sm font-bold text-[#2B303A] font-jp shadow-2xs"
                  >
                    <span className="text-xs text-[#6C757D] mr-1.5">{sIdx + 1}.</span>
                    <span>{cleanOptionText(item)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* STANDARD QUESTION TEXT */
          <div className="space-y-2">
            <h3 className="text-[18px] sm:text-[20px] font-bold text-[#2B303A] font-jp leading-relaxed">
              {currentQ.question}
            </h3>
            {currentQ.questionTranslation && (
              <p className="text-xs sm:text-sm text-[#6C757D]">
                {currentQ.questionTranslation}
              </p>
            )}
          </div>
        )}

        {/* 4 Options Grid */}
        <div className="space-y-2.5 pt-2">
          {currentQ.options.map((opt, optIdx) => {
            const isChosen = userSelectedOption === optIdx;
            const isCorrect = optIdx === correctOptionIndex;

            let btnStyle = "bg-white border-[#E9ECEF] text-[#2B303A] hover:border-[#4F6375] hover:bg-[#F8F9FA]";

            if (showExplanation) {
              if (isCorrect) {
                btnStyle = "bg-[#5A6959]/15 border-[#5A6959] text-[#354334] font-bold";
              } else if (isChosen && !isCorrect) {
                btnStyle = "bg-[#8B4848]/15 border-[#8B4848] text-[#8B4848]";
              } else {
                btnStyle = "bg-white border-[#E9ECEF] text-[#ADB5BD] opacity-60";
              }
            }

            return (
              <button
                key={optIdx}
                type="button"
                onClick={() => handleSelectOption(optIdx)}
                disabled={showExplanation}
                className={`w-full p-3.5 sm:p-4 rounded-xl border text-left text-sm sm:text-base transition-all flex items-center justify-between cursor-pointer font-jp active:scale-[0.99] ${btnStyle}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-md bg-[#F1F3F5] text-[#495057] text-xs font-bold flex items-center justify-center shrink-0">
                    {optIdx + 1}
                  </span>
                  <span>{cleanOptionText(opt)}</span>
                </div>
                {showExplanation && isCorrect && (
                  <span className="text-xs font-bold text-[#354334] px-2 py-0.5 rounded bg-white/80">
                    正解
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation & Next Step */}
        <AnimatePresence>
          {showExplanation && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0 }}
              className="space-y-4 pt-4 border-t border-[#E9ECEF]"
            >
              <div className="p-4 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl space-y-2 text-xs sm:text-sm text-[#495057] leading-relaxed whitespace-pre-wrap">
                <div className="font-bold text-[#2B303A]">
                  解析說明：
                </div>
                <div>{currentQ.explanation}</div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-[#2B303A] text-white hover:bg-[#1E222A] transition-all cursor-pointer active:scale-[0.98] shadow-xs"
                >
                  {currentIndex + 1 < questions.length ? '下一題' : '查看測驗結果'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
