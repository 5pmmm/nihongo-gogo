import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WordDefinition } from '../types';
import { isItemBookmarked, toggleBookmark } from '../services/bookmarkStorage';

interface WordCardProps {
  data: WordDefinition;
  layoutId?: string;
  isExpanded?: boolean;
  onToggle?: () => void;
  onBookmarkChange?: () => void;
}

export const WordCard: React.FC<WordCardProps> = ({ 
  data, 
  onBookmarkChange
}) => {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setIsBookmarked(isItemBookmarked(data.word, 'WORD'));
  }, [data.word]);

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = toggleBookmark({
      type: 'WORD',
      title: data.word,
      data: data
    });
    setIsBookmarked(newState);
    if (onBookmarkChange) onBookmarkChange();
  };

  // Build example list (support both data.examples and fallback exampleSentence)
  const examples = (data.examples && data.examples.length > 0)
    ? data.examples
    : (data.exampleSentence ? [{
        sentence: data.exampleSentence,
        reading: data.exampleReading || '',
        translation: data.exampleTranslation || ''
      }] : []);

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-white border border-[#E9ECEF] rounded-2xl p-5 hover:border-[#CED4DA] hover:shadow-xs transition-all flex flex-col justify-between relative group"
      >
        {/* Top Header: Tag, Pitch Accent, Part of Speech, Enlarge Button, Bookmark button */}
        <div>
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#4F6375]/10 text-[#3D4F5F]">
                單字
              </span>
              {data.pitchAccent && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#7A6856]/10 text-[#635343]">
                  {data.pitchAccent}
                </span>
              )}
              {data.partOfSpeech && (
                <span className="text-xs text-[#6C757D] font-medium">
                  {data.partOfSpeech}
                </span>
              )}
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
              title={isBookmarked ? "已收藏（點擊取消）" : "收藏單字"}
              aria-label="收藏"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isBookmarked ? "0" : "1.75"} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
            </motion.button>
          </div>

          {/* Word Title & Hiragana Reading (Clickable to enlarge) */}
          <div className="mb-3 cursor-pointer" onClick={() => setIsModalOpen(true)}>
            <h3 className="text-[20px] font-bold text-[#2B303A] tracking-tight hover:text-[#4F6375] transition-colors font-jp">
              {data.word}
            </h3>
            <p className="text-sm text-[#6C757D] font-medium mt-0.5 font-jp">
              {data.reading}
            </p>
          </div>

          {/* Meaning */}
          <div className="mb-4">
            <p className="text-sm sm:text-base text-[#2B303A] font-medium leading-relaxed">
              {data.meaning}
            </p>
          </div>
        </div>

        {/* Examples Section */}
        {examples.length > 0 && (
          <div className="pt-3 border-t border-[#F1F3F5]">
            <button
              type="button"
              onClick={() => setShowExamples(!showExamples)}
              className="text-xs font-medium text-[#4F6375] hover:text-[#3D4F5F] flex items-center justify-between w-full py-0.5 cursor-pointer"
            >
              <span>{showExamples ? '收起例句' : `查看例句 (${examples.length} 句)`}</span>
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
                  className="overflow-hidden mt-2.5 space-y-2.5"
                >
                  {examples.map((ex, idx) => (
                    <div key={idx} className="p-3 bg-[#F8F9FA] rounded-xl text-xs space-y-1">
                      <p className="font-bold text-[#2B303A] font-jp leading-relaxed">
                        {ex.sentence}
                      </p>
                      {ex.reading && (
                        <p className="text-[#6C757D] font-jp">
                          {ex.reading}
                        </p>
                      )}
                      <p className="text-[#495057] italic">
                        {ex.translation}
                      </p>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Enlarged Modal View (放大版單字卡彈窗) */}
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
              className="bg-white border border-[#E9ECEF] rounded-2xl sm:rounded-3xl w-full max-w-lg max-h-[88vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative"
            >
              {/* Modal Top Bar */}
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#E9ECEF]">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#4F6375]/10 text-[#3D4F5F]">
                      單字詳解
                    </span>
                    {data.pitchAccent && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#7A6856]/10 text-[#635343]">
                        {data.pitchAccent}
                      </span>
                    )}
                    {data.partOfSpeech && (
                      <span className="text-xs text-[#6C757D] font-medium">
                        {data.partOfSpeech}
                      </span>
                    )}
                  </div>
                  <h3 className="text-[20px] font-bold text-[#2B303A] tracking-tight font-jp">
                    {data.word}
                  </h3>
                  <p className="text-sm text-[#6C757D] font-medium font-jp mt-0.5">
                    {data.reading}
                  </p>
                </div>

                <div className="flex items-center gap-2">
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

              {/* Meaning */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-[#6C757D]">中文釋義</h4>
                <p className="text-[17px] font-bold text-[#2B303A] leading-relaxed">
                  {data.meaning}
                </p>
              </div>

              {/* Examples */}
              {examples.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-[#E9ECEF]">
                  <h4 className="text-xs font-bold text-[#6C757D]">
                    實用例句 ({examples.length})
                  </h4>
                  <div className="space-y-2.5">
                    {examples.map((ex, idx) => (
                      <div key={idx} className="p-3.5 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl space-y-1 text-xs sm:text-sm">
                        <p className="font-bold text-[#2B303A] font-jp leading-relaxed">
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
                      </div>
                    ))}
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
