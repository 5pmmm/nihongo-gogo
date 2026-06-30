
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateQuizFromContent } from '../services/geminiService';
import { WordDefinition, GrammarDefinition, QuizQuestion } from '../types';
import { Loader } from './Loader';
import { Button } from './Button';

const cleanOptionText = (text: string): string => {
  if (!text) return '';
  let cleaned = text.trim();
  
  // Clean alphabet prefixes like "A. ", "A、", "A ", "a. "
  cleaned = cleaned.replace(/^[A-Da-d](?:\s*[\.\:\,）\)\、\s．：，])\s*/, '');
  
  // Clean numeric prefixes like "1. ", "1、", "1) " but NOT followed by an arrow like "→" or "->"
  cleaned = cleaned.replace(/^[1-4](?:\s*[\.\:\,）\)\、．：，])\s*/, '');
  
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

interface QuizProps {
  sourceWords: WordDefinition[];
  sourceGrammar: GrammarDefinition[];
  specificPrompt?: string; // New prop for user-defined quiz content
  onExit: () => void;
  title?: string;
}

export const Quiz: React.FC<QuizProps> = ({ sourceWords, sourceGrammar, specificPrompt, onExit, title }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [selectedReviewIndex, setSelectedReviewIndex] = useState<number | null>(null);

  useEffect(() => {
    const loadQuiz = async () => {
      try {
        setLoading(true);
        const qs = await generateQuizFromContent(sourceWords, sourceGrammar, specificPrompt);
        
        // Shuffle the options of each question to make sure options/correct index are distributed randomly
        const shuffledQuestions = qs.map(q => {
          if (!q.options || q.options.length <= 1) return q;

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
  }, [sourceWords, sourceGrammar, specificPrompt]);

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
                whileHover={{ y: -3, scale: 1.01, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.98 }}
                className={`p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border transition-all cursor-pointer ${
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
                     <div className="flex items-center gap-4">
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {isCorrect ? '正確' : '錯誤'}
                        </span>
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
              onClick={() => setSelectedReviewIndex(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 15, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 15, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="w-full max-w-lg bg-white rounded-[1.5rem] sm:rounded-[3rem] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col mx-4"
                onClick={e => e.stopPropagation()}
              >
                 <div className="p-4 sm:p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">題目詳解 • 第 {selectedReviewIndex + 1} 題</h3>
                    <button onClick={() => setSelectedReviewIndex(null)} className="p-3 bg-white rounded-full text-gray-400 hover:text-gray-900 transition-all shadow-sm">
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

                    {questions[selectedReviewIndex].context && <div className="p-4 sm:p-8 bg-gray-50 border-l-4 sm:border-l-8 border-gray-900 rounded-r-2xl sm:rounded-r-3xl text-gray-900 text-sm sm:text-xl font-bold leading-relaxed shadow-inner">{questions[selectedReviewIndex].context}</div>}
                    
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
                                {['A', 'B', 'C', 'D'][i]}
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
        <span className="text-[11px] sm:text-sm font-black text-white bg-gray-900 px-3 sm:px-6 py-1 sm:py-2.5 rounded-lg sm:rounded-2xl shadow-xl flex-shrink-0">
          {currentIndex + 1} / {questions.length}
        </span>
      </div>
      <div className="relative min-h-[300px] sm:min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div key={currentQ.id} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="bg-white rounded-xl sm:rounded-[3rem] shadow-xl p-4 sm:p-12 border border-gray-100 relative">
            {currentQ.context && <div className="mb-3 sm:mb-10 p-3.5 sm:p-8 bg-gray-50 border-l-2 sm:border-l-8 border-gray-900 text-gray-900 leading-relaxed rounded-r-lg sm:rounded-r-[2rem] text-[13px] sm:text-xl font-medium sm:font-bold shadow-inner">{currentQ.context}</div>}
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
                  <motion.button key={idx} onClick={() => handleAnswer(idx)} className={`w-full text-left p-2.5 sm:p-5 rounded-lg sm:rounded-2xl font-medium sm:font-black transition-all duration-300 relative overflow-hidden border ${btnClass}`} disabled={hasAnswered} whileHover={!hasAnswered ? { y: -3 } : {}} whileTap={!hasAnswered ? { scale: 0.98 } : {}}>
                    <div className="flex justify-between items-center relative z-10 w-full">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center font-bold sm:font-black text-xs sm:text-sm flex-shrink-0 transition-colors ${badgeClass}`}>
                            {['A', 'B', 'C', 'D'][idx]}
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
    </div>
  );
};
