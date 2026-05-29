import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trash2, Copy, BookOpen, PenTool, CheckCircle, Volume2, Plus, Calendar, ChevronRight, Award, HelpCircle } from 'lucide-react';
import { DiaryEntry, DiaryAnalysisResult } from '../types';
import { fetchDiaryCorrection } from '../services/geminiService';

interface DiaryInterfaceProps {
  onBack: () => void;
  onXpUpdate: (amount: number) => void;
}

const STORAGE_KEY = 'mk-nihongo-diary-entries';

export const DiaryInterface: React.FC<DiaryInterfaceProps> = ({ onBack, onXpUpdate }) => {
  const [diaries, setDiaries] = useState<DiaryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load diaries from localStorage', e);
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState<'write' | 'history'>('write');
  const [diaryContent, setDiaryContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<DiaryAnalysisResult | null>(null);
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<DiaryEntry | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isPlayingText, setIsPlayingText] = useState(false);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(diaries));
  }, [diaries]);

  const handleCorrectDiary = async () => {
    if (!diaryContent.trim()) return;
    setIsLoading(true);
    try {
      const result = await fetchDiaryCorrection(diaryContent);
      const newEntry: DiaryEntry = {
        id: `diary-${Date.now()}`,
        date: new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }),
        content: diaryContent,
        analysis: result,
        createdAt: Date.now(),
      };
      
      setDiaries(prev => [newEntry, ...prev]);
      setCurrentAnalysis(result);
      setSelectedHistoryEntry(newEntry);
      
      // Award XP for diary learning!
      onXpUpdate(35); // Rewards 35 XP for writing and correcting a diary
      
      // Focus on the result
      setActiveTab('history');
    } catch (err) {
      console.error(err);
      alert('AI 修正日記中發生錯誤，請稍後再試。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDiary = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('確定要刪除這篇日記紀錄嗎？')) {
      const filtered = diaries.filter(d => d.id !== id);
      setDiaries(filtered);
      if (selectedHistoryEntry?.id === id) {
        setSelectedHistoryEntry(null);
        setCurrentAnalysis(null);
      }
    }
  };

  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSpeakText = (text: string) => {
    if ('speechSynthesis' in window) {
      if (isPlayingText) {
        window.speechSynthesis.cancel();
        setIsPlayingText(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.9; // Slightly slower for clear comprehension
      utterance.onend = () => setIsPlayingText(false);
      utterance.onerror = () => setIsPlayingText(false);
      setIsPlayingText(true);
      window.speechSynthesis.speak(utterance);
    } else {
      alert('您的瀏覽器不支援語音合成播放功能。');
    }
  };

  // Clean speech synthesis on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const displayEntry = selectedHistoryEntry || (diaries.length > 0 ? diaries[0] : null);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 頂部標題說明 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-100 pb-5">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 inline-block font-mono">日記</span>
            日文日記 AI 訂正助手
          </h2>
          <p className="text-zinc-500 font-medium text-xs sm:text-sm mt-1">
            平常練習寫的日文，就交給 AI 老師幫您進行文法修飾、語彙加強、並解析單字與修正句型。
          </p>
        </div>
        <button
          onClick={onBack}
          className="self-start sm:self-auto px-4 py-2 text-xs sm:text-sm font-black text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-all rounded-xl"
        >
          返回首頁
        </button>
      </div>

      {/* 模組切換：寫日記 / 歷程紀錄 */}
      <div className="flex bg-zinc-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('write')}
          className={`flex-1 py-3 text-xs sm:text-sm font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'write' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <PenTool size={16} /> 撰寫日文日記
        </button>
        <button
          onClick={() => {
            setActiveTab('history');
            if (diaries.length > 0 && !selectedHistoryEntry) {
              setSelectedHistoryEntry(diaries[0]);
            }
          }}
          className={`flex-1 py-3 text-xs sm:text-sm font-black rounded-lg transition-all flex items-center justify-center gap-1.5 relative ${
            activeTab === 'history' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <BookOpen size={16} /> 歷程與訂正紀錄
          {diaries.length > 0 && (
            <span className="absolute right-4 bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-sans font-black">
              {diaries.length}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'write' ? (
          <motion.div
            key="write-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Diaries writing input box */}
            <div className="bg-white border border-zinc-200 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-500 to-indigo-500" />
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                  <span className="text-xs font-black text-zinc-400 uppercase tracking-widest whitespace-nowrap">撰寫區 (請使用日文撰寫，長度不限)</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 font-bold bg-zinc-50 border border-zinc-150 rounded px-1.5">
                  {diaryContent.length} 字
                </span>
              </div>

              <textarea
                value={diaryContent}
                onChange={(e) => setDiaryContent(e.target.value)}
                placeholder="在這裡隨心所欲地撰寫您的日文日記吧...
例如：
今日は朝から天気が良かったです。午前中に近くの公園を散歩しました。公園にはたくさんの桜が咲いていました..."
                className="w-full h-56 resize-none border-0 p-1 bg-transparent text-zinc-800 text-sm sm:text-base font-medium focus:ring-0 placeholder:text-zinc-300 placeholder:font-normal leading-relaxed overflow-y-auto outline-none focus:outline-none"
                disabled={isLoading}
              />

              <div className="border-t border-zinc-100 pt-4 mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-zinc-400 text-[11px] font-medium leading-normal flex items-start sm:items-center gap-1.5">
                  <span className="bg-yellow-50 text-yellow-700 font-black rounded px-1 text-[9px] inline-block border border-yellow-100">提示</span>
                  寫作時就算有錯也沒關係！AI 老師會為您整篇文章修正成道地的日文。
                </span>

                <button
                  onClick={handleCorrectDiary}
                  disabled={isLoading || !diaryContent.trim()}
                  className={`px-6 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 select-none shadow-sm transition-all text-white border border-indigo-650 ${
                    isLoading || !diaryContent.trim()
                      ? 'bg-zinc-300 border-zinc-300 cursor-not-allowed opacity-75 shadow-none'
                      : 'bg-indigo-600 hover:bg-indigo-700 active:scale-98'
                  }`}
                >
                  <Sparkles size={16} />
                  {isLoading ? 'AI 訂正老師批改中...' : '提交給 AI 訂正分析 (+35 XP)'}
                </button>
              </div>
            </div>

            {/* Waiting/Loading State */}
            {isLoading && (
              <div className="bg-zinc-50/50 border border-zinc-200/60 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden select-none">
                <div className="inline-flex items-center justify-center p-4 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl animate-spin mb-4">
                  <Sparkles size={24} />
                </div>
                <h4 className="text-base font-black text-zinc-900">AI 老師正在用心閱卷與批改中...</h4>
                <p className="text-xs text-zinc-400 font-medium max-w-sm mx-auto mt-2 leading-relaxed">
                  這需要花費大約 3 至 5 秒鐘。老師正在檢查您的助詞、動詞時態、句子串接，並準備文法建議！
                </p>
                <div className="mt-4 flex justify-center gap-1">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="history-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Left Column: Historical List */}
            <div className="lg:col-span-4 bg-white border border-zinc-200 rounded-3xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <h3 className="text-xs sm:text-sm font-black text-zinc-900 tracking-tight flex items-center gap-1.5">
                  <Calendar size={14} className="text-zinc-400" />
                  歷程列表
                </h3>
                <button
                  onClick={() => setActiveTab('write')}
                  className="p-1 px-2 text-[10px] sm:text-xs font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-all rounded-lg flex items-center gap-1"
                >
                  <Plus size={10} /> 寫新日記
                </button>
              </div>

              {diaries.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-xs text-zinc-400 font-medium">還沒有訂正紀錄喔！</p>
                  <p className="text-[10px] text-zinc-300 mt-1">請切換到「撰寫」頁面開始寫第一篇日記吧。</p>
                </div>
              ) : (
                <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-2 no-scrollbar">
                  {diaries.map((entry) => {
                    const isSelected = displayEntry?.id === entry.id;
                    return (
                      <div
                        key={entry.id}
                        onClick={() => setSelectedHistoryEntry(entry)}
                        className={`p-3.5.5 rounded-2xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-zinc-900 border-zinc-900 text-white shadow-md'
                            : 'bg-zinc-50/50 border-zinc-150 hover:bg-zinc-50 text-zinc-800'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-1 mb-1.5">
                          <span
                            className={`text-[9px] font-sans font-black tracking-wide rounded-md px-1.5 py-0.5 ${
                              isSelected
                                ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100/30'
                            }`}
                          >
                            {entry.analysis?.jlptEstimatedLevel || 'N5'}
                          </span>
                          <span className={`text-[10px] font-medium font-mono ${isSelected ? 'text-zinc-400' : 'text-zinc-400'}`}>
                            {entry.date}
                          </span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold truncate leading-tight mb-2">
                          {entry.analysis?.title || '未命名日記'}
                        </h4>
                        <p className={`text-[11px] truncate leading-normal ${isSelected ? 'text-zinc-350' : 'text-zinc-450'}`}>
                          {entry.content}
                        </p>
                        <div className="flex justify-end gap-1.5 mt-2 border-t border-dashed border-zinc-200/10 pt-1.5">
                          <button
                            onClick={(e) => handleDeleteDiary(entry.id, e)}
                            className="p-1 rounded-md text-red-400 hover:text-red-500 hover:bg-red-50/5 transition-all text-[10px]"
                            title="刪除"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Active Correction Report Details */}
            <div className="lg:col-span-8 space-y-6">
              {displayEntry ? (
                <div className="space-y-6">
                  {/* Summary Card */}
                  <div className="bg-white border border-zinc-200 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
                    <span className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-black tracking-wider px-3.5 py-1 rounded-bl-2xl">
                      REPORT
                    </span>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded-md">
                        {displayEntry.analysis.jlptEstimatedLevel} 水平
                      </span>
                      <span className="text-xs font-bold text-zinc-400 font-mono flex items-center gap-1">
                        <Calendar size={12} /> {displayEntry.date}
                      </span>
                    </div>

                    <h3 className="text-lg sm:text-xl font-black text-zinc-900 mb-4 tracking-tight leading-snug flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-indigo-600 rounded-full" />
                      {displayEntry.analysis.title}
                    </h3>

                    {/* Overall Feedback */}
                    <div className="bg-zinc-50 border border-zinc-150/50 rounded-2xl p-4 mb-5">
                      <div className="flex items-center gap-1.5 mb-2 sm:mb-2.5">
                        <Award size={14} className="text-amber-500 animate-pulse" />
                        <span className="text-[10px] font-black text-zinc-400 tracking-wider uppercase">AI 老師整體講評與打分</span>
                      </div>
                      <p className="text-zinc-700 text-xs sm:text-sm leading-relaxed font-semibold">
                        {displayEntry.analysis.overallFeedback}
                      </p>
                    </div>

                    {/* Full corrected version */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-zinc-400 tracking-wider">Polished Full Text / 道地完整全文</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSpeakText(displayEntry.analysis.correctedFullText)}
                            className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all ${
                              isPlayingText 
                                ? 'bg-red-50 text-red-600 border border-red-100' 
                                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                            }`}
                          >
                            <Volume2 size={12} />
                            {isPlayingText ? '停止播放' : '慢速日語朗讀'}
                          </button>
                          <button
                            onClick={() => handleCopyText(displayEntry.analysis.correctedFullText, 999)}
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-650 rounded-lg transition-all"
                          >
                            <Copy size={12} />
                            {copiedIndex === 999 ? '已複製' : '複製全文'}
                          </button>
                        </div>
                      </div>
                      <p className="bg-indigo-50/20 border border-indigo-100/30 rounded-2xl p-4 sm:p-5 text-sm sm:text-base text-zinc-800 font-extrabold leading-relaxed whitespace-pre-line tracking-wide shadow-3xs">
                        {displayEntry.analysis.correctedFullText}
                      </p>
                    </div>
                  </div>

                  {/* Vocabulary/Grammar Highlights from Diary */}
                  {displayEntry.analysis.vocabGrammarList && displayEntry.analysis.vocabGrammarList.length > 0 && (
                    <div className="bg-white border border-zinc-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-150 pb-2">
                        <span className="text-xs font-black text-zinc-900 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                          精選高頻學習語彙 & 文法點
                        </span>
                        <span className="text-[10px] font-bold text-zinc-400">從這篇日記自動提取</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {displayEntry.analysis.vocabGrammarList.map((item, idx) => (
                          <div key={idx} className="bg-zinc-50/55 rounded-2xl border border-zinc-100 p-3 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-extrabold text-sm sm:text-base text-zinc-900 tracking-tight">{item.expression}</span>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${
                                  item.type === 'VOCAB' 
                                    ? 'bg-rose-50 text-rose-600 border border-rose-100/40' 
                                    : 'bg-indigo-50 text-indigo-600 border border-indigo-100/40'
                                }`}>
                                  {item.type === 'VOCAB' ? '單字' : '文法'}
                                </span>
                              </div>
                              <span className="text-xs sm:text-sm font-mono text-zinc-500 font-extrabold block mb-1">〔 {item.reading} 〕</span>
                            </div>
                            <p className="text-zinc-600 text-xs font-semibold leading-relaxed border-t border-dashed border-zinc-200/80 pt-1.5 mt-1.5">
                              {item.meaning}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detailed comparisons sentence-by-sentence */}
                  <div className="space-y-4">
                    <h3 className="text-xs sm:text-sm font-black text-zinc-400 uppercase tracking-widest pl-1">
                      句子逐句詳細對比與解析說明
                    </h3>
                    <div className="space-y-4">
                      {displayEntry.analysis.corrections.map((corr, idx) => {
                        const hasCorrection = corr.originalText !== corr.correctedText;
                        return (
                          <div
                            key={idx}
                            className="bg-white border border-zinc-150 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3 hover:border-zinc-300 transition-all"
                          >
                            <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-1">
                              <span className="text-[9px] font-sans font-black bg-zinc-100 text-zinc-500 border px-1.5 py-0.5 rounded-md">句子 0{idx + 1}</span>
                              <span className={`text-[10px] font-bold ${hasCorrection ? 'text-indigo-600' : 'text-emerald-600'}`}>
                                {hasCorrection ? '● 句型已修正/優化' : '● 原創極佳，不需修改'}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">我的原文 (Original)</span>
                                <p className="text-xs sm:text-sm text-zinc-500 font-medium line-through bg-red-50/10 border border-red-100/10 p-3 rounded-2xl">
                                  {corr.originalText}
                                </p>
                              </div>

                              <div className="space-y-1.5">
                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-wider block">道地改良 (Corrected)</span>
                                <p className="text-xs sm:text-sm text-zinc-800 font-extrabold bg-emerald-50/10 border border-emerald-100/10 p-3 rounded-2xl leading-relaxed">
                                  {corr.correctedText}
                                </p>
                              </div>
                            </div>

                            {/* Analysis note */}
                            <div className="border-t border-dashed border-zinc-100 pt-3 flex items-start gap-1.5">
                              <span className="bg-indigo-50 text-indigo-700 text-[9px] font-black px-1 rounded-md mt-0.5">解析</span>
                              <div className="space-y-1">
                                <p className="text-zinc-650 text-xs sm:text-[13px] font-medium leading-relaxed">
                                  {corr.explanation}
                                </p>
                                {corr.grammarPoints && corr.grammarPoints.length > 0 && (
                                  <div className="flex flex-wrap gap-1 items-center mt-2">
                                    {corr.grammarPoints.map((gp, gIdx) => (
                                      <span key={gIdx} className="bg-zinc-100 border border-zinc-200/50 text-zinc-600 text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                                        {gp}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-zinc-200 rounded-3xl p-12 text-center shadow-xs">
                  <p className="text-xs text-zinc-400 font-medium">請選擇左側的日記歷史來查閱訂正報告！</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
