
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListeningMaterial, JLPTLevel } from '../types';
import { fetchListeningMaterial, checkListeningAnswer } from '../services/geminiService';
import { Button } from './Button';
import { Loader } from './Loader';

interface ListeningPracticeProps {
  onBack: () => void;
  onComplete?: () => void;
}

type Step = 'SETTINGS' | 'LOADING' | 'PRACTICE' | 'RESULT';

export const ListeningPractice: React.FC<ListeningPracticeProps> = ({ onBack, onComplete }) => {
  const [step, setStep] = useState<Step>('SETTINGS');
  const [level, setLevel] = useState<JLPTLevel>('N3');
  const [loading, setLoading] = useState(false);
  const [material, setMaterial] = useState<ListeningMaterial | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackMode, setPlaybackMode] = useState<'FULL' | 'SEGMENT'>('SEGMENT');
  const [speed, setSpeed] = useState(1.0);
  const [userInput, setUserInput] = useState('');
  const [timer, setTimer] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [showFurigana, setShowFurigana] = useState(true);
  const [results, setResults] = useState<{ similarity: number; feedback: string; correct: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const [firstPlayDone, setFirstPlayDone] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);

  const timerRef = useRef<number | null>(null);

  const startPractice = async () => {
    setLoading(true);
    setStep('LOADING');
    try {
      const data = await fetchListeningMaterial(level);
      setMaterial(data);
      setStep('PRACTICE');
      setCurrentIndex(0);
      setFirstPlayDone(false);
      setShowResultsModal(false);
    } catch (error) {
      console.error(error);
      alert('載入失敗');
      setStep('SETTINGS');
    } finally {
      setLoading(false);
    }
  };

  const playSegment = (index: number) => {
    if (!material) return;
    const segment = material.segments[index];
    
    // Check if this is the first play of this segment
    const isFirst = !firstPlayDone;
    if (isFirst) {
      setFirstPlayDone(true);
    }

    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.lang = 'ja-JP';
    utterance.rate = speed;
    utterance.onend = () => {
      if (playbackMode === 'SEGMENT' && isFirst) {
        startThinkingTimer();
      }
    };
    window.speechSynthesis.speak(utterance);
  };

  const playFull = () => {
    if (!material) return;
    const utterance = new SpeechSynthesisUtterance(material.fullContent);
    utterance.lang = 'ja-JP';
    utterance.rate = speed;
    window.speechSynthesis.speak(utterance);
  };

  const startThinkingTimer = () => {
    setIsThinking(true);
    setTimer(5); // 5s to 10s thinking time (5s chosen for responsiveness)
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsThinking(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const calculateLocalSimilarity = (s1: string, s2: string): number => {
    const clean = (str: string) => str.replace(/[\s\p{P}]/gu, '');
    const a = clean(s1);
    const b = clean(s2);
    if (!a && !b) return 100;
    if (!a || !b) return 0;
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
        else dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
      }
    }
    const dist = dp[a.length][b.length];
    const maxLen = Math.max(a.length, b.length);
    return Math.round(((maxLen - dist) / maxLen) * 100);
  };

  const handleCheck = async () => {
    if (!material) return;
    setChecking(true);
    try {
      const res = await checkListeningAnswer(material.segments[currentIndex].text, userInput || " ");
      setResults(res);
      setShowResultsModal(true);
    } catch (error) {
      console.error(error);
      const sim = calculateLocalSimilarity(material.segments[currentIndex].text, userInput || "");
      setResults({
        correct: sim >= 80,
        similarity: sim,
        feedback: sim === 100 ? "非常完美！完全正確。" : sim >= 75 ? "聽對了大部分！繼續加油。" : (userInput.trim() ? "再多聽幾次，試著捕捉更多單字吧！" : "尚未輸入內容，請試著寫出聽到的字詞喔！")
      });
      setShowResultsModal(true);
    } finally {
      setChecking(false);
    }
  };

  const nextSegment = () => {
    if (!material) return;
    if (currentIndex < material.segments.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setResults(null);
      setUserInput('');
      setFirstPlayDone(false);
      setShowResultsModal(false);
    } else {
      setStep('RESULT');
      onComplete?.();
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.speechSynthesis.cancel();
    };
  }, []);

  if (step === 'SETTINGS') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-6 sm:space-y-8 py-5 sm:py-10 px-4 sm:px-0">
        <div className="flex items-center gap-3 sm:gap-4 mb-2 sm:mb-4">
          <button onClick={onBack} className="p-1.5 sm:p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tighter uppercase">聴解練習</h2>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] shadow-xl border border-zinc-100 space-y-6 sm:space-y-8">
          <div>
            <h3 className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-widest mb-3 sm:mb-4">選擇難度</h3>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {(['N5', 'N4', 'N3', 'N2', 'N1'] as JLPTLevel[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`py-2 sm:py-3 rounded-xl sm:rounded-2xl font-black text-base sm:text-lg transition-all ${level === l ? 'bg-zinc-900 text-white shadow-lg' : 'bg-zinc-50 text-zinc-400 hover:bg-zinc-100'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-widest mb-3 sm:mb-4">播放模式</h3>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <button 
                onClick={() => setPlaybackMode('SEGMENT')}
                className={`p-3 sm:p-4 rounded-xl sm:rounded-[1.5rem] border-2 transition-all text-left ${playbackMode === 'SEGMENT' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-100 bg-zinc-50 text-zinc-500'}`}
              >
                <p className="font-black text-sm sm:text-base">逐句練習</p>
                <p className="text-[10px] sm:text-xs opacity-70">聽後聽寫</p>
              </button>
              <button 
                onClick={() => setPlaybackMode('FULL')}
                className={`p-3 sm:p-4 rounded-xl sm:rounded-[1.5rem] border-2 transition-all text-left ${playbackMode === 'FULL' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-100 bg-zinc-50 text-zinc-500'}`}
              >
                <p className="font-black text-sm sm:text-base">全文練習</p>
                <p className="text-[10px] sm:text-xs opacity-70">聽後回顧</p>
              </button>
            </div>
          </div>

          <div className="pt-2">
             <Button onClick={startPractice} className="w-full py-4 sm:py-6 text-lg sm:text-xl font-bold">開始練習</Button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (step === 'LOADING') return <div className="flex justify-center py-40"><Loader /></div>;

  if (step === 'PRACTICE' && material) {
    const currentSegment = material.segments[currentIndex];
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-4 sm:space-y-8 py-5 sm:py-10 px-4">
        <div className="flex justify-between items-center bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border border-zinc-100">
          <div>
            <h2 className="text-base sm:text-xl font-black text-zinc-900">{material.title}</h2>
            <p className="text-[10px] sm:text-sm text-zinc-400 font-bold uppercase tracking-widest">{level} LEVEL</p>
          </div>
          <button onClick={onBack} className="text-zinc-400 hover:text-zinc-900 p-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
          <div className="md:col-span-2 space-y-4 sm:space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] shadow-xl border border-zinc-100 relative min-h-[200px] sm:min-h-[300px] flex flex-col items-center justify-center text-center overflow-hidden">
               {isThinking ? (
                 <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="space-y-2 sm:space-y-4">
                    <p className="text-5xl sm:text-7xl font-black text-zinc-950 font-mono">{timer}</p>
                    <p className="text-base sm:text-xl font-bold text-zinc-400 tracking-widest uppercase">思考準備中...</p>
                 </motion.div>
               ) : (
                 <div className="space-y-4 sm:space-y-6 flex flex-col items-center select-none">
                    <button 
                      onClick={() => playSegment(currentIndex)}
                      className="group relative focus:outline-none"
                    >
                      <div className="w-24 h-24 sm:w-28 sm:h-28 bg-zinc-900 rounded-full flex items-center justify-center text-white shadow-xl transition-transform group-hover:scale-105 group-active:scale-95">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 sm:w-12 sm:h-12 ml-1">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z" />
                        </svg>
                      </div>
                    </button>
                    <p className="text-xs sm:text-sm text-zinc-400 font-bold max-w-xs leading-relaxed">
                      點擊撥放日語句子，聽完後即可在下方輸入您的聽寫內容。
                    </p>
                 </div>
               )}
            </div>

            <div className="space-y-3 sm:space-y-4">
               <textarea 
                className="w-full p-4 sm:p-6 bg-white border-2 border-zinc-100 rounded-[1.5rem] sm:rounded-[2rem] outline-none text-base sm:text-lg font-bold min-h-[100px] sm:min-h-[120px] focus:border-zinc-900 transition-colors shadow-inner font-jp"
                placeholder="輸入你聽到的日語內容..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={isThinking || checking}
               />
               <div className="flex gap-3 sm:gap-4">
                  <Button 
                    variant="outline" 
                    size="md"
                    className="flex-1 py-3 sm:py-4 font-bold"
                    onClick={() => playSegment(currentIndex)}
                    disabled={isThinking || checking}
                  >
                    重聽
                  </Button>
                  <Button 
                    size="md"
                    className="flex-1 py-3 sm:py-4 bg-zinc-900 border-zinc-900 font-bold"
                    onClick={handleCheck}
                    disabled={isThinking || checking}
                  >
                    {checking ? '批改分析中...' : '檢查答案'}
                  </Button>
               </div>
            </div>
          </div>

          <div className="space-y-6">
             <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 space-y-4">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">控制選項</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-sm font-bold text-zinc-600">語速 ({speed}x)</span>
                    <input 
                      type="range" min="0.5" max="2" step="0.1" value={speed} 
                      onChange={(e) => setSpeed(parseFloat(e.target.value))}
                      className="w-24 h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
                    />
                  </div>
                  <button 
                    onClick={() => setShowFurigana(!showFurigana)}
                    className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${showFurigana ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-400 border-zinc-100'}`}
                  >
                    讀音標註: {showFurigana ? 'ON' : 'OFF'}
                  </button>
                  <button 
                    onClick={playFull}
                    className="w-full py-3 bg-zinc-50 text-zinc-900 rounded-xl text-xs font-black uppercase tracking-widest border border-zinc-100 hover:bg-zinc-100"
                  >
                    播放全文內容
                  </button>
                </div>
             </div>

             <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 space-y-4">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">練習進度</h3>
                <div className="space-y-2">
                   <div className="flex justify-between text-[10px] font-black text-zinc-400 uppercase tracking-tighter">
                      <span>Progress</span>
                      <span>{currentIndex + 1} / {material.segments.length}</span>
                   </div>
                   <div className="w-full h-2 bg-zinc-50 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentIndex + 1) / material.segments.length) * 100}%` }}
                        className="h-full bg-zinc-900"
                      />
                   </div>
                </div>
                <div className="grid grid-cols-5 gap-1 pt-2">
                   {material.segments.map((_, i) => (
                     <div key={i} className={`h-1.5 rounded-full ${i === currentIndex ? 'bg-zinc-900' : i < currentIndex ? 'bg-zinc-300' : 'bg-zinc-100'}`} />
                   ))}
                </div>
             </div>
          </div>
        </div>

        {/* 聽寫比對結果 彈出小視窗 (Pop-up Modal) */}
        <AnimatePresence>
          {showResultsModal && results && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-md">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-zinc-150 relative max-h-[85vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100">
                  <h3 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
                    🎯 聽寫比對結果
                  </h3>
                  <button 
                    onClick={() => setShowResultsModal(false)}
                    className="text-zinc-400 hover:text-zinc-600 font-bold text-lg p-1 transition-colors focus:outline-none"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4">
                   {/* Correct text */}
                   <div className="space-y-1 text-left bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                      <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">正確句子 (Correct Japanese)</p>
                      <p className="text-lg sm:text-xl font-black text-zinc-950 font-jp leading-relaxed">
                         {currentSegment.text}
                      </p>
                      {showFurigana && (
                        <p className="text-xs sm:text-sm text-zinc-500 font-bold font-jp">{currentSegment.reading}</p>
                      )}
                      <p className="text-xs sm:text-sm text-zinc-600 mt-2 font-bold leading-normal">{currentSegment.translation}</p>
                   </div>

                   {/* User's input text */}
                   <div className="space-y-1 text-left bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                      <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">您的回答 (Your Answer)</p>
                      <p className="text-base sm:text-lg font-bold text-zinc-900 leading-relaxed font-jp">
                         {userInput.trim() ? userInput : <span className="text-zinc-400 italic font-normal">（您尚未輸入任何內容）</span>}
                      </p>
                   </div>

                   {/* Similarity / Feedback badge */}
                   <div className={`p-4 rounded-2xl border ${results.similarity >= 85 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                      <div className="flex items-center justify-between mb-1">
                         <span className="text-xs font-black uppercase tracking-widest text-zinc-400">比對狀態</span>
                         <span className={`text-xs font-black px-2 py-0.5 rounded-full ${results.similarity >= 85 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {results.similarity >= 85 ? '聽寫正確 ✨' : '有些不一致 💡'}
                         </span>
                      </div>
                      <p className="font-bold text-sm leading-relaxed">{results.feedback}</p>
                      <p className="text-xs font-mono mt-1 opacity-75 font-bold">精確度相似比: {results.similarity}%</p>
                   </div>

                   {/* Sentence breakdown */}
                   {currentSegment.tokens && currentSegment.tokens.length > 0 && (
                     <div className="space-y-2 pt-2">
                        <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-left font-sans">詞彙片語拆解</h4>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                           {currentSegment.tokens.map((token, i) => (
                              <div key={i} className="bg-zinc-50 border border-zinc-100 rounded-xl p-2.5 text-left space-y-0.5 animate-fadeIn">
                                 <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-black text-xs sm:text-sm text-zinc-900 font-jp">{token.text}</span>
                                    <span className="text-[8px] font-bold bg-zinc-200 px-1 rounded text-zinc-650">{token.partOfSpeech}</span>
                                 </div>
                                 <p className="text-[9px] text-zinc-400 font-bold font-jp">{token.reading}</p>
                                 <p className="text-[10px] text-zinc-650 font-bold leading-tight">{token.meaning}</p>
                              </div>
                           ))}
                        </div>
                     </div>
                   )}

                   {/* Buttons */}
                   <div className="flex gap-3 pt-4 border-t border-zinc-100">
                      <Button 
                        variant="outline" 
                        size="md"
                        className="flex-1 py-3 text-sm font-bold"
                        onClick={() => setShowResultsModal(false)}
                      >
                        關閉並再次修改
                      </Button>
                      <Button 
                        size="md"
                        className="flex-1 py-3 bg-zinc-900 text-white text-sm font-bold border-zinc-900"
                        onClick={() => {
                          setShowResultsModal(false);
                          nextSegment();
                        }}
                      >
                        {currentIndex === material.segments.length - 1 ? '完成總結' : '下一段句子'}
                      </Button>
                   </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  if (step === 'RESULT' && material) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl mx-auto py-10 sm:py-20 text-center space-y-6 sm:space-y-8 px-4 sm:px-0">
        <div className="bg-white p-8 sm:p-12 rounded-[2.5rem] sm:rounded-[4rem] shadow-2xl border border-zinc-100 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-2 sm:h-3 bg-zinc-900" />
           <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tighter">練習完成！</h2>
           <p className="text-sm sm:text-base text-zinc-400 font-bold mt-2 sm:mt-4 px-4 sm:px-10">你已經完成了本次的聽力練習。持續練習是掌握日文聽力的不二法門！</p>
           <div className="pt-6 sm:pt-10 flex gap-3 sm:gap-4">
              <Button onClick={() => setStep('SETTINGS')} variant="outline" size="md" className="flex-1 py-3 sm:py-5">重試</Button>
              <Button onClick={onBack} size="md" className="flex-1 py-3 sm:py-5">返回</Button>
           </div>
        </div>
      </motion.div>
    );
  }

  return null;
};
