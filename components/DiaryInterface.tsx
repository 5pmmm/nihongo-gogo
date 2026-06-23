import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trash2, Copy, BookOpen, PenTool, Calendar, Plus, Volume2, Award } from 'lucide-react';
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
  const [isMobileDetailSelected, setIsMobileDetailSelected] = useState(false);

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
      setIsMobileDetailSelected(true);
      
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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 頂部標題說明 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-100 pb-5">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
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
            setIsMobileDetailSelected(false);
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
            <span className="absolute right-4 bg-zinc-650 text-white text-[9px] px-1.5 py-0.5 rounded-full font-sans font-black">
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
            <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
                  <span className="text-xs font-black text-zinc-500 uppercase tracking-widest whitespace-nowrap">撰寫區 (請使用日文撰寫，長度不限)</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 font-bold bg-white border border-zinc-200 rounded px-1.5">
                  {diaryContent.length} 字
                </span>
              </div>

              <textarea
                value={diaryContent}
                onChange={(e) => setDiaryContent(e.target.value)}
                placeholder="在這裡隨心所欲地撰寫您的日文日記吧...
例如：
今日は朝から天気が良かったです。午前中に近くの公園を散步しました。公園にはたくさんの桜が咲いていました..."
                className="w-full h-56 resize-none border-0 p-1 bg-transparent text-zinc-800 text-sm sm:text-base font-bold focus:ring-0 placeholder:text-zinc-350 placeholder:font-normal leading-relaxed overflow-y-auto outline-none focus:outline-none"
                disabled={isLoading}
              />

              <div className="border-t border-zinc-200/60 pt-4 mt-2 flex justify-end">
                <button
                  onClick={handleCorrectDiary}
                  disabled={isLoading || !diaryContent.trim()}
                  className={`px-6 py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 select-none shadow-sm transition-all text-white border border-zinc-950 ${
                    isLoading || !diaryContent.trim()
                      ? 'bg-zinc-300 border-zinc-300 cursor-not-allowed opacity-75 shadow-none'
                      : 'bg-zinc-800 hover:bg-zinc-900 active:scale-98'
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
                <div className="inline-flex items-center justify-center p-4 bg-zinc-100 border border-zinc-250/60 text-zinc-700 rounded-2xl animate-spin mb-4">
                  <Sparkles size={24} />
                </div>
                <h4 className="text-base font-black text-zinc-900">AI 老師正在用心閱卷與批改中...</h4>
                <p className="text-xs text-zinc-400 font-medium max-w-sm mx-auto mt-2 leading-relaxed">
                  這需要花費大約 3 至 5 秒鐘。老師正在檢查您的助詞、動詞時態、句子串接，並準備文法解析說明的分析喔！請稍候...
                </p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="history-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Compact Dates Sidebar Grid */}
              <div className="lg:col-span-3 bg-white border border-zinc-200 rounded-3xl p-4 sm:p-5 space-y-4 shadow-3xs">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-zinc-100 border border-zinc-200 rounded-xl text-zinc-700">
                      <Calendar size={15} />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-zinc-950 flex items-center gap-1.5 font-sans">
                        歷史紀錄
                      </h3>
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-zinc-400 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-lg">
                    {diaries.length} 篇
                  </span>
                </div>

                {/* Grid for sidebar date boxes */}
                <div className="flex flex-row lg:flex-col gap-2.5 pb-2 lg:pb-0 overflow-x-auto lg:overflow-y-auto lg:max-h-[500px] no-scrollbar scroll-smooth items-center lg:items-stretch">
                  {/* Write new shortcut card inside the sidebar */}
                  <button
                    onClick={() => setActiveTab('write')}
                    className="flex flex-col items-center justify-center p-2 rounded-2xl w-18 h-18 sm:w-20 sm:h-20 lg:w-full lg:h-16 bg-zinc-50 border border-dashed border-zinc-350 text-zinc-500 hover:text-zinc-800 hover:border-zinc-500 hover:bg-white transition-all group shrink-0 cursor-pointer text-center"
                  >
                    <Plus size={18} className="group-hover:scale-110 group-hover:rotate-90 transition-transform mb-0.5 text-zinc-400 group-hover:text-zinc-700" />
                    <span className="text-[9.5px] font-black">寫新日記</span>
                  </button>

                  {diaries.length === 0 ? (
                    <div className="py-6 text-xs text-zinc-400 font-bold text-center w-full">
                      無紀錄
                    </div>
                  ) : (
                    diaries.map((entry) => {
                      const isSelected = displayEntry?.id === entry.id;
                      const parts = entry.date.match(/\d+/g);
                      const displayYearStr = parts && parts.length >= 1 ? parts[0] : new Date().getFullYear().toString();
                      const displayMonthStr = parts && parts.length >= 2 ? parts[1].padStart(2, '0') : '01';
                      const displayDayStr = parts && parts.length >= 3 ? parts[2].padStart(2, '0') : '01';
                      return (
                        <button
                          key={entry.id}
                          onClick={() => {
                            setSelectedHistoryEntry(entry);
                          }}
                          className={`relative flex flex-col lg:flex-row items-center justify-between p-1.5 sm:p-2 rounded-2xl w-18 h-18 sm:w-20 sm:h-20 lg:w-full lg:h-14 transition-all duration-200 group cursor-pointer border shrink-0 ${
                            isSelected
                              ? 'bg-zinc-50 border-zinc-800 shadow-xs ring-2 ring-zinc-200/50'
                              : 'bg-white border-zinc-200 hover:border-zinc-350 hover:bg-zinc-50/50'
                          }`}
                        >
                          <div className="flex flex-col lg:flex-row items-center lg:items-center lg:gap-2.5 text-center lg:text-left min-w-0">
                            {/* Mobile/Tablet stacked layout */}
                            <div className="lg:hidden flex flex-col items-center">
                              <span className={`text-[8px] sm:text-[9px] font-sans font-extrabold leading-none tracking-tight ${isSelected ? 'text-zinc-900 font-black' : 'text-zinc-400'}`}>
                                {displayYearStr}
                              </span>
                              <span className={`text-[11px] sm:text-xs font-black font-mono leading-none mt-1 ${isSelected ? 'text-zinc-950 font-black' : 'text-zinc-805'}`}>
                                {displayMonthStr}/{displayDayStr}
                              </span>
                            </div>
                            {/* Desktop inline layout */}
                            <div className="hidden lg:block overflow-hidden">
                              <span className={`text-[12px] sm:text-[13px] font-black font-mono tracking-tight ${isSelected ? 'text-zinc-950 font-black' : 'text-zinc-800'}`}>
                                {displayYearStr}/{displayMonthStr}/{displayDayStr}
                              </span>
                            </div>
                          </div>
                          <span className={`text-[7.5px] sm:text-[8.5px] font-sans font-black px-1.5 py-0.5 rounded ${
                            isSelected
                              ? 'bg-zinc-800 text-white'
                              : 'bg-zinc-100 text-zinc-650 group-hover:bg-zinc-200'
                          }`}>
                            {entry.analysis?.jlptEstimatedLevel || 'N5'}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Expansive Analysis Details & Report Content */}
              <div className="lg:col-span-9 space-y-6 w-full">
                {displayEntry ? (
                  <div className="space-y-6">
                    {/* Summary Card */}
                    <div className="bg-white border border-zinc-200 rounded-3xl p-5 sm:p-7 shadow-xs relative overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-zinc-700 bg-zinc-100 border border-zinc-200/50 px-2.5 py-1 rounded-md">
                            {displayEntry.analysis.jlptEstimatedLevel} 水平
                          </span>
                          <span className="text-xs font-extrabold text-zinc-400 font-mono flex items-center gap-1 bg-zinc-50 border border-zinc-100 px-2 py-1 rounded-md">
                            <Calendar size={12} /> {displayEntry.date}
                          </span>
                        </div>
                        
                        <button
                          onClick={(e) => handleDeleteDiary(displayEntry.id, e)}
                          className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100/80 active:bg-rose-200/50 text-rose-600 border border-rose-150/50 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
                          title="刪除本篇日記"
                        >
                          <Trash2 size={13} />
                          <span>刪除本篇紀錄</span>
                        </button>
                      </div>

                      <h3 className="text-xl sm:text-2xl font-black text-zinc-900 mb-5 tracking-tight leading-snug flex items-center gap-2">
                        <span className="w-1.5 h-5 bg-zinc-700 rounded-full" />
                        {displayEntry.analysis.title}
                      </h3>

                      {/* Overall Feedback */}
                      <div className="bg-zinc-50 border border-zinc-150/50 rounded-2xl p-4 sm:p-5 mb-6">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <Award size={15} className="text-amber-500 animate-pulse" />
                          <span className="text-[10px] font-black text-zinc-400 tracking-wider uppercase">AI 老師整體評語與寫作建議</span>
                        </div>
                        <p className="text-zinc-700 text-xs sm:text-sm leading-relaxed font-semibold">
                          {displayEntry.analysis.overallFeedback}
                        </p>
                      </div>

                      {/* Parallel original and polished full text comparison */}
                      <div className="space-y-4 pt-5 border-t border-zinc-150">
                        <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                          <span className="text-xs font-black text-zinc-400 tracking-wider uppercase">完整比對 (Full Comparative Reading)</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSpeakText(displayEntry.analysis.correctedFullText)}
                              className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer select-none ${
                                isPlayingText 
                                  ? 'bg-red-50 text-red-600 border border-red-100' 
                                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-650'
                              }`}
                            >
                              <Volume2 size={12} />
                              {isPlayingText ? '停止播放' : '日文發音朗讀'}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Original Text Column */}
                          <div className="bg-zinc-50/80 border border-zinc-200/60 rounded-2xl p-5 relative">
                            <div className="flex items-center justify-between pb-3 border-b border-zinc-150/50 mb-3">
                              <span className="px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-550 text-[10px] font-bold font-sans">
                                我的原文
                              </span>
                              <button
                                onClick={() => handleCopyText(displayEntry.content, 998)}
                                className={`flex items-center gap-1 text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-xl transition-all cursor-pointer border select-none shadow-3xs ${
                                  copiedIndex === 998
                                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500'
                                    : 'bg-white hover:bg-zinc-100 text-zinc-650 border-zinc-200'
                                }`}
                              >
                                <Copy size={11} className="stroke-[2.5]" />
                                {copiedIndex === 998 ? '已複製' : '複製原文'}
                              </button>
                            </div>
                            <p className="text-zinc-600 text-xs sm:text-sm font-semibold leading-relaxed whitespace-pre-line">
                              {displayEntry.content}
                            </p>
                          </div>

                          {/* Polished Text Column */}
                          <div className="bg-zinc-50/50 border border-zinc-200 rounded-2xl p-5 relative">
                            <div className="flex items-center justify-between pb-3 border-b border-zinc-200/50 mb-3">
                              <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 text-[10px] font-bold font-sans">
                                極致精修全文
                              </span>
                              <button
                                onClick={() => handleCopyText(displayEntry.analysis.correctedFullText, 999)}
                                className={`flex items-center gap-1 text-[10px] sm:text-xs font-black px-2.5 py-1.5 rounded-xl transition-all cursor-pointer border select-none shadow-sm ${
                                  copiedIndex === 999
                                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500'
                                    : 'bg-zinc-800 hover:bg-zinc-900 text-white border-zinc-800'
                                }`}
                              >
                                <Copy size={11} className="stroke-[2.5]" />
                                {copiedIndex === 999 ? '已複製全文' : '一鍵複製全文'}
                              </button>
                            </div>
                            <p className="text-zinc-900 text-sm sm:text-base font-black leading-relaxed whitespace-pre-line tracking-wide text-pretty">
                              {displayEntry.analysis.correctedFullText}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Vocabulary/Grammar Highlights from Diary */}
                    {displayEntry.analysis.vocabGrammarList && displayEntry.analysis.vocabGrammarList.length > 0 && (
                      <div className="bg-white border border-zinc-200 rounded-3xl p-5 sm:p-7 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-150 pb-2 flex-wrap gap-2">
                          <span className="text-xs font-black text-zinc-900 flex items-center gap-1.5 font-sans">
                            <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full" />
                            精選高頻學習語彙 & 文法點
                          </span>
                          <span className="text-[10px] font-bold text-zinc-400">從這篇日記自動提取</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {displayEntry.analysis.vocabGrammarList.map((item, idx) => (
                            <div key={idx} className="bg-zinc-50/55 rounded-2xl border border-zinc-100 p-4 flex flex-col justify-between hover:border-zinc-350 transition-all">
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${
                                    item.type === 'VOCAB' 
                                      ? 'bg-rose-50 text-rose-600 border border-rose-100/40' 
                                      : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                                  }`}>
                                    {item.type === 'VOCAB' ? '單字' : '文法'}
                                  </span>
                                </div>
                                <span className="font-extrabold text-sm sm:text-base text-zinc-950 tracking-tight block mb-1">{item.expression}</span>
                                <span className="text-xs font-mono text-zinc-450 font-extrabold block mb-2">〔 {item.reading} 〕</span>
                              </div>
                              <p className="text-zinc-650 text-xs font-semibold leading-relaxed border-t border-dashed border-zinc-200 pt-2 mt-2">
                                {item.meaning}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Detailed comparisons sentence-by-sentence */}
                    <div className="space-y-4">
                      <h3 className="text-xs sm:text-sm font-black text-zinc-400 uppercase tracking-widest pl-1 font-sans">
                        重點大錯誤 & 用詞錯誤修正 (此處不顯示微調)
                      </h3>
                      
                      {(() => {
                        const substantiveCorrections = (displayEntry.analysis.corrections || []).filter(
                          (corr) => corr.originalText.trim() !== corr.correctedText.trim()
                        );

                        if (substantiveCorrections.length > 0) {
                          return (
                            <div className="space-y-4">
                              {substantiveCorrections.map((corr, idx) => {
                                return (
                                  <div
                                    key={idx}
                                    className="bg-white border border-zinc-150 rounded-3xl p-5 shadow-xs space-y-4 hover:border-zinc-350 transition-all"
                                  >
                                    <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-1">
                                      <span className="text-[9px] font-sans font-black bg-zinc-100 text-zinc-550 border px-1.5 py-0.5 rounded-md">
                                        修正點 0{idx + 1}
                                      </span>
                                      <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md font-sans">
                                        ● 需修正語句
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">我的原文 (Original)</span>
                                        <p className="text-xs sm:text-sm text-zinc-500 font-medium line-through bg-zinc-50 border border-zinc-150 p-3 rounded-2xl">
                                          {corr.originalText}
                                        </p>
                                      </div>

                                      <div className="space-y-2">
                                        <span className="text-[9px] font-black text-zinc-650 uppercase tracking-wider block">道地修正 (Corrected)</span>
                                        <p className="text-xs sm:text-sm text-zinc-900 font-extrabold bg-zinc-50/50 border border-zinc-200/60 p-3 rounded-2xl leading-relaxed">
                                          {corr.correctedText}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Analysis note */}
                                    <div className="border-t border-dashed border-zinc-150 pt-3.5 flex items-start gap-2">
                                      <span className="bg-zinc-100 text-zinc-750 text-[10px] font-black px-2 py-0.5 rounded mt-0.5 shrink-0">解析說明</span>
                                      <div className="space-y-1">
                                        <p className="text-zinc-700 text-xs sm:text-[13px] font-bold leading-relaxed">
                                          {corr.explanation}
                                        </p>
                                        {corr.grammarPoints && corr.grammarPoints.length > 0 && (
                                          <div className="flex flex-wrap gap-1 items-center mt-2.5">
                                            {corr.grammarPoints.map((gp, gIdx) => (
                                              <span key={gIdx} className="bg-zinc-100 border border-zinc-200/50 text-zinc-650 text-[10px] px-1.5 py-0.5 rounded-md font-bold">
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
                          );
                        } else {
                          return (
                            <div className="bg-emerald-50/15 border border-emerald-150/40 text-emerald-800 rounded-3xl p-6 text-center space-y-1 block">
                              <p className="text-xs sm:text-sm font-black text-emerald-700">🎉 太棒了！本篇完全正確，無須重大文法修正</p>
                              <p className="text-[11px] text-zinc-500 font-medium">
                                這篇日記寫得很棒、文法相當通順，沒有發現重大或需要修正的結構與用詞錯誤！細部的部分語句流暢度美化已默默融在最上方的「極致精修全文」中，請一鍵複製精修全文作保存練習喔！非常出色，請繼續保持！
                              </p>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-zinc-200 rounded-3xl p-12 text-center shadow-xs">
                    <p className="text-xs text-zinc-400 font-medium">請選擇左側的日記歷史紀錄來查閱 AI 批改分析！</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
