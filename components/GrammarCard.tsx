import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GrammarDefinition, SentenceWord, WordDefinition } from '../types';
import { isItemBookmarked, toggleBookmark } from '../services/bookmarkStorage';
import { fetchSentenceVocabulary } from '../services/geminiService';

interface GrammarCardProps {
  data: GrammarDefinition;
  layoutId?: string;
  isExpanded?: boolean;
  onClose?: () => void;
  onClick?: () => void;
  onBookmarkChange?: () => void;
}

// Color-coded connection rule renderer
const renderConnectionClause = (clause: string, clauseIdx: number) => {
  const parts = clause.split(/(\s*[+＋]\s*)/g);
  
  return (
    <div key={clauseIdx} className="flex flex-wrap items-center gap-1.5 py-0.5">
      {parts.map((part, pIdx) => {
        const trimmed = part.trim();
        if (!trimmed) return null;
        if (trimmed === '+' || trimmed === '＋') {
          return (
            <span key={pIdx} className="text-[#ADB5BD] font-bold text-xs select-none px-0.5">
              ＋
            </span>
          );
        }

        let badgeStyle = "bg-[#F1F3F5] text-[#495057] border border-[#CED4DA]";
        const t = trimmed;

        if (t.includes('動詞') || t.includes('動') || /^V/i.test(t) || t.includes('普通形') || t.includes('連用形') || t.includes('て形') || t.includes('た形') || t.includes('ない形') || t.includes('辞書形') || t.includes('辭書形')) {
          // 動詞 (Verb) -> Morandi Blue
          badgeStyle = "bg-[#4F6375]/15 text-[#2E4255] border border-[#4F6375]/35 font-bold";
        } else if (t.includes('い形容詞') || t.includes('い形') || /^A-i/i.test(t)) {
          // い形容詞 -> Soft Warm Amber
          badgeStyle = "bg-[#A07A48]/15 text-[#6D4E25] border border-[#A07A48]/35 font-bold";
        } else if (t.includes('な形容詞') || t.includes('な形') || /^A-na/i.test(t)) {
          // な形容詞 -> Soft Muted Violet
          badgeStyle = "bg-[#7A628C]/15 text-[#513B63] border border-[#7A628C]/35 font-bold";
        } else if (t.includes('名詞') || /^N/i.test(t)) {
          // 名詞 (Noun) -> Soft Sage Green
          badgeStyle = "bg-[#5A6959]/15 text-[#354334] border border-[#5A6959]/35 font-bold";
        } else if (t.includes('な・である') || t.includes('の・である') || t.includes('である') || t.includes('な') || t.includes('の') || t.includes('去ます')) {
          // Inflection / particle -> Neutral slate badge
          badgeStyle = "bg-[#8C7864]/15 text-[#5C4D3E] border border-[#8C7864]/30 font-medium";
        } else {
          // Target suffix pattern
          badgeStyle = "bg-[#2B303A]/10 text-[#2B303A] border border-[#2B303A]/20 font-bold font-jp";
        }

        return (
          <span
            key={pIdx}
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs sm:text-[13px] tracking-tight ${badgeStyle}`}
          >
            {t}
          </span>
        );
      })}
    </div>
  );
};

const renderColorCodedConnection = (connectionText: string) => {
  if (!connectionText) return null;

  const clauses = connectionText.split(/\s*[\/／\n]\s*/).filter(c => c.trim().length > 0);

  if (clauses.length <= 1) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {renderConnectionClause(connectionText, 0)}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 w-full">
      {clauses.map((clause, idx) => (
        <div key={idx} className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-[#ADB5BD] font-mono select-none">
            {idx + 1}.
          </span>
          {renderConnectionClause(clause, idx)}
        </div>
      ))}
    </div>
  );
};

export const GrammarCard: React.FC<GrammarCardProps> = ({ 
  data, 
  onBookmarkChange
}) => {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Example vocabulary breakdown states
  const [activeBreakdownIdx, setActiveBreakdownIdx] = useState<number | null>(null);
  const [breakdownMap, setBreakdownMap] = useState<{ [exIdx: number]: SentenceWord[] }>({});
  const [loadingBreakdownIdx, setLoadingBreakdownIdx] = useState<number | null>(null);
  const [bookmarkedWords, setBookmarkedWords] = useState<{ [word: string]: boolean }>({});

  useEffect(() => {
    setIsBookmarked(isItemBookmarked(data.grammarPoint, 'GRAMMAR'));
  }, [data.grammarPoint]);

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = toggleBookmark({
      type: 'GRAMMAR',
      title: data.grammarPoint,
      data: data
    });
    setIsBookmarked(newState);
    if (onBookmarkChange) onBookmarkChange();
  };

  const handleToggleBreakdown = async (idx: number, sentence: string, initialBreakdown?: SentenceWord[]) => {
    if (activeBreakdownIdx === idx) {
      setActiveBreakdownIdx(null);
      return;
    }

    setActiveBreakdownIdx(idx);

    if (initialBreakdown && initialBreakdown.length > 0) {
      setBreakdownMap(prev => ({ ...prev, [idx]: initialBreakdown }));
      return;
    }

    if (breakdownMap[idx] && breakdownMap[idx].length > 0) {
      return;
    }

    try {
      setLoadingBreakdownIdx(idx);
      const words = await fetchSentenceVocabulary(sentence);
      setBreakdownMap(prev => ({ ...prev, [idx]: words }));
    } catch (e) {
      console.error('Failed to extract sentence vocabulary:', e);
    } finally {
      setLoadingBreakdownIdx(null);
    }
  };

  const handleBookmarkWordItem = (wordItem: SentenceWord) => {
    const wordObj: WordDefinition = {
      word: wordItem.word,
      reading: wordItem.reading,
      meaning: wordItem.meaning,
      exampleSentence: wordItem.word,
      exampleTranslation: wordItem.meaning
    };
    const newState = toggleBookmark({
      type: 'WORD',
      title: wordItem.word,
      data: wordObj
    });
    setBookmarkedWords(prev => ({ ...prev, [wordItem.word]: newState }));
    if (onBookmarkChange) onBookmarkChange();
  };

  return (
    <>
      {/* Standard Grid Card */}
      <motion.div 
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-white border border-[#E9ECEF] rounded-2xl p-5 hover:border-[#CED4DA] hover:shadow-xs transition-all flex flex-col justify-between relative group"
      >
        <div>
          {/* Top Header: Tag, Enlarge Button, Bookmark Button */}
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#5A6959]/10 text-[#435242]">
                文法
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="text-xs text-[#6C757D] hover:text-[#2B303A] font-medium px-2 py-0.5 rounded hover:bg-[#F1F3F5] transition-colors inline-flex items-center gap-1 cursor-pointer"
                title="點擊放大字卡"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
                <span>放大</span>
              </button>
            </div>

            {/* Bookmark Button */}
            <motion.button
              type="button"
              onClick={handleBookmarkClick}
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 450, damping: 20 }}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isBookmarked 
                  ? 'text-[#E69D45] hover:text-[#C8822B]' 
                  : 'text-[#CED4DA] hover:text-[#6C757D]'
              }`}
              title={isBookmarked ? "已收藏（點擊取消）" : "收藏文法"}
              aria-label="收藏"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isBookmarked ? "0" : "1.75"} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
            </motion.button>
          </div>

          {/* Grammar Point Title (Clickable to open modal) */}
          <div className="mb-3 cursor-pointer" onClick={() => setIsModalOpen(true)}>
            <h3 className="text-[20px] font-bold text-[#2B303A] tracking-tight font-jp hover:text-[#4F6375] transition-colors">
              {data.grammarPoint}
            </h3>
          </div>

          {/* Connection Rules (辭類接續變化規則 - 動詞、い/な形容詞、名詞分顏色標註) */}
          {data.connection && (
            <div className="mb-3 p-3 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl text-xs sm:text-sm">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-[#2B303A] text-xs">接續規則</span>
                <span className="text-[10px] text-[#6C757D]">動詞・形容詞・名詞分類</span>
              </div>
              <div className="pt-0.5">
                {renderColorCodedConnection(data.connection)}
              </div>
            </div>
          )}

          {/* Meaning & Explanation */}
          <div className="mb-4 space-y-1.5">
            <p className="text-sm sm:text-base text-[#2B303A] font-medium leading-relaxed">
              {data.meaning}
            </p>
            {data.explanation && (
              <p className="text-xs sm:text-sm text-[#6C757D] leading-relaxed">
                {data.explanation}
              </p>
            )}
          </div>
        </div>

        {/* Examples Section */}
        {data.examples && data.examples.length > 0 && (
          <div className="pt-3 border-t border-[#F1F3F5]">
            <button
              type="button"
              onClick={() => setShowExamples(!showExamples)}
              className="text-xs font-medium text-[#4F6375] hover:text-[#3D4F5F] flex items-center justify-between w-full py-0.5 cursor-pointer"
            >
              <span>{showExamples ? '收起例句' : `查看例句 (${data.examples.length} 句)`}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className={`w-3.5 h-3.5 transition-transform duration-150 ${showExamples ? 'rotate-180' : ''}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            <AnimatePresence>
              {showExamples && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden mt-2.5 space-y-3"
                >
                  {data.examples.map((ex, idx) => {
                    const isBreakdownOpen = activeBreakdownIdx === idx;
                    const words = breakdownMap[idx] || ex.breakdown || [];
                    const isLoadingWords = loadingBreakdownIdx === idx;

                    return (
                      <div key={idx} className="p-3 bg-[#F8F9FA] border border-[#E9ECEF]/80 rounded-xl text-xs space-y-1.5">
                        <p className="font-bold text-[#2B303A] font-jp leading-relaxed text-sm">
                          {ex.sentence}
                        </p>
                        {ex.reading && (
                          <p className="text-[#6C757D] font-jp text-xs">
                            {ex.reading}
                          </p>
                        )}
                        <p className="text-[#495057] italic text-xs">
                          {ex.translation}
                        </p>

                        {/* Button to generate/view extra word cards for this sentence */}
                        <div className="pt-1 flex items-center justify-between border-t border-[#E9ECEF]/50">
                          <button
                            type="button"
                            onClick={() => handleToggleBreakdown(idx, ex.sentence, ex.breakdown)}
                            className="text-[11px] font-medium text-[#4F6375] hover:text-[#2E4255] inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-3 h-3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                            </svg>
                            <span>{isBreakdownOpen ? '收起例句單字' : '查看例句單字卡'}</span>
                          </button>
                        </div>

                        {/* Breakdown Word Cards Area */}
                        {isBreakdownOpen && (
                          <div className="pt-2 space-y-1.5">
                            {isLoadingWords ? (
                              <p className="text-[11px] text-[#6C757D] animate-pulse">
                                正在分析例句中的新單字...
                              </p>
                            ) : words.length > 0 ? (
                              <div className="grid gap-1.5 sm:grid-cols-2">
                                {words.map((w, wIdx) => {
                                  const isWordSaved = bookmarkedWords[w.word] ?? isItemBookmarked(w.word, 'WORD');
                                  return (
                                    <div
                                      key={wIdx}
                                      className="p-2 bg-white border border-[#E9ECEF] rounded-lg flex items-start justify-between gap-2 shadow-2xs"
                                    >
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-[#2B303A] font-jp text-xs">
                                            {w.word}
                                          </span>
                                          <span className="text-[10px] text-[#6C757D] font-jp">
                                            {w.reading}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-[#495057] mt-0.5 truncate">
                                          {w.meaning}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleBookmarkWordItem(w)}
                                        title={isWordSaved ? "已收藏" : "收藏此單字"}
                                        className={`p-1 rounded transition-colors shrink-0 ${
                                          isWordSaved ? 'text-[#E69D45]' : 'text-[#CED4DA] hover:text-[#6C757D]'
                                        }`}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isWordSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isWordSaved ? "0" : "1.75"} className="w-3.5 h-3.5">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                        </svg>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[11px] text-[#ADB5BD]">此例句無額外單字清單</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Enlarged Modal View (放大版字卡彈窗) */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-xs"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-[#E9ECEF] rounded-2xl sm:rounded-3xl w-full max-w-xl max-h-[88vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative"
            >
              {/* Modal Top Bar */}
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#E9ECEF]">
                <div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#5A6959]/10 text-[#435242] mb-1.5 inline-block">
                    文法詳解
                  </span>
                  <h3 className="text-[20px] font-bold text-[#2B303A] tracking-tight font-jp">
                    {data.grammarPoint}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {/* Star Bookmark */}
                  <button
                    type="button"
                    onClick={handleBookmarkClick}
                    title={isBookmarked ? "已收藏" : "收藏"}
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      isBookmarked ? 'text-[#E69D45] hover:text-[#C8822B]' : 'text-[#CED4DA] hover:text-[#6C757D]'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isBookmarked ? "0" : "1.75"} className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                    </svg>
                  </button>

                  {/* Close Modal Button */}
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 rounded-xl text-[#6C757D] hover:text-[#2B303A] hover:bg-[#F1F3F5] transition-colors cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Color-Coded Connection Rules (放大版接續規則) */}
              {data.connection && (
                <div className="p-4 bg-[#F8F9FA] border border-[#E9ECEF] rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#2B303A] text-xs sm:text-sm">
                      接續規則分解
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#6C757D]">
                      <span className="w-2 h-2 rounded-full bg-[#4F6375]/50 inline-block" /> 動詞
                      <span className="w-2 h-2 rounded-full bg-[#A07A48]/50 inline-block ml-1" /> い形
                      <span className="w-2 h-2 rounded-full bg-[#7A628C]/50 inline-block ml-1" /> な形
                      <span className="w-2 h-2 rounded-full bg-[#5A6959]/50 inline-block ml-1" /> 名詞
                    </div>
                  </div>
                  <div className="pt-1">
                    {renderColorCodedConnection(data.connection)}
                  </div>
                </div>
              )}

              {/* Meaning & Detailed Explanation */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#6C757D]">核心語意</h4>
                <p className="text-[17px] font-bold text-[#2B303A] leading-relaxed">
                  {data.meaning}
                </p>
                {data.explanation && (
                  <p className="text-sm text-[#495057] leading-relaxed pt-1 whitespace-pre-line">
                    {data.explanation}
                  </p>
                )}
              </div>

              {/* All Example Sentences with Vocabulary Breakdown */}
              {data.examples && data.examples.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-[#E9ECEF]">
                  <h4 className="text-xs font-bold text-[#6C757D]">
                    應用例句與單字拆解 ({data.examples.length})
                  </h4>

                  <div className="space-y-3">
                    {data.examples.map((ex, idx) => {
                      const isBreakdownOpen = activeBreakdownIdx === idx;
                      const words = breakdownMap[idx] || ex.breakdown || [];
                      const isLoadingWords = loadingBreakdownIdx === idx;

                      return (
                        <div key={idx} className="p-4 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl space-y-2">
                          <p className="font-bold text-[#2B303A] font-jp text-[15px] leading-relaxed">
                            {ex.sentence}
                          </p>
                          {ex.reading && (
                            <p className="text-xs text-[#6C757D] font-jp">
                              {ex.reading}
                            </p>
                          )}
                          <p className="text-xs text-[#495057] italic">
                            {ex.translation}
                          </p>

                          <div className="pt-2 border-t border-[#E9ECEF]/60 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => handleToggleBreakdown(idx, ex.sentence, ex.breakdown)}
                              className="text-xs font-medium text-[#4F6375] hover:text-[#2E4255] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                              </svg>
                              <span>{isBreakdownOpen ? '收起單字清單' : '查看例句單字卡'}</span>
                            </button>
                          </div>

                          {/* Breakdown Word Cards Area */}
                          {isBreakdownOpen && (
                            <div className="pt-2 space-y-2">
                              {isLoadingWords ? (
                                <p className="text-xs text-[#6C757D] animate-pulse">
                                  正在分析例句中的新單字...
                                </p>
                              ) : words.length > 0 ? (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {words.map((w, wIdx) => {
                                    const isWordSaved = bookmarkedWords[w.word] ?? isItemBookmarked(w.word, 'WORD');
                                    return (
                                      <div
                                        key={wIdx}
                                        className="p-2.5 bg-white border border-[#E9ECEF] rounded-xl flex items-start justify-between gap-2 shadow-2xs"
                                      >
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-[#2B303A] font-jp text-xs sm:text-[13px]">
                                              {w.word}
                                            </span>
                                            <span className="text-[10px] text-[#6C757D] font-jp">
                                              {w.reading}
                                            </span>
                                          </div>
                                          <p className="text-xs text-[#495057] mt-0.5 truncate">
                                            {w.meaning}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleBookmarkWordItem(w)}
                                          title={isWordSaved ? "已收藏" : "收藏此單字"}
                                          className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                                            isWordSaved ? 'text-[#E69D45]' : 'text-[#CED4DA] hover:text-[#6C757D]'
                                          }`}
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isWordSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isWordSaved ? "0" : "1.75"} className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                          </svg>
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-[#ADB5BD]">此例句無額外單字清單</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
