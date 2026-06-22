import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GrammarDefinition } from '../types';

interface GrammarCardProps {
  data: GrammarDefinition;
  layoutId: string;
  onClick?: () => void;
  isExpanded?: boolean;
  onClose?: () => void;
}

// Helper to parse grammatical connections and represent parts-of-speech as colorful tag badges
const parseConnection = (text: string) => {
  if (!text) return null;
  
  // Split by core delimiters but keep them around for rendering separators
  const tokens = text.split(/(\s*\+\s*|\s*\/\s*|\s*或\s*)/g);
  
  return tokens.map((token, index) => {
    const trimmed = token.trim();
    if (trimmed === '+' || trimmed === '/' || trimmed === '或') {
      return (
        <span key={index} className="text-zinc-400 font-extrabold px-1 text-xs sm:text-sm select-none">
          {trimmed === '+' ? '＋' : trimmed === '/' ? '／' : ' 或 '}
        </span>
      );
    }
    
    if (!trimmed) return null;
    
    // Assign specific visual styles based on key Japanese linguistic terms
    let bgClass = 'bg-zinc-100 text-zinc-900 border-zinc-200/90';
    
    if (trimmed.includes('動詞') || trimmed.includes('動')) {
      bgClass = 'bg-rose-50 text-rose-700 border-rose-200 font-black';
    } else if (trimmed.includes('名詞') || trimmed.includes('名')) {
      bgClass = 'bg-emerald-50 text-emerald-800 border-emerald-200 font-black';
    } else if (trimmed.includes('形容詞') || trimmed.includes('い形') || trimmed.includes('な形') || trimmed.includes('形')) {
      bgClass = 'bg-amber-50 text-amber-850 border-amber-200 font-black';
    } else if (trimmed.includes('普通形')) {
      bgClass = 'bg-sky-50 text-sky-700 border-sky-200 font-black';
    } else if (trimmed.includes('意向形') || trimmed.includes('意志形') || trimmed.includes('辞書形') || trimmed.includes('辭書形') || trimmed.includes('ない形') || trimmed.includes('た形') || trimmed.includes('て形') || trimmed.includes('型')) {
      bgClass = 'bg-indigo-50 text-indigo-700 border-indigo-200 font-black';
    }
    
    return (
      <span 
        key={index} 
        className={`inline-flex items-center px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-[13px] border ${bgClass} transition-all shadow-xs`}
      >
        {trimmed}
      </span>
    );
  });
};

// Helper to highlight active grammar points or roots inside example sentences
const highlightGrammarInSentence = (sentence: string, grammarPattern: string) => {
  if (!sentence) return '';
  
  // Clean elements and fetch pattern terms
  const patterns = grammarPattern
    .replace(/～|…/g, '')
    .split(/\s*[\/或]\s*/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
    
  if (patterns.length === 0) return <span>{sentence}</span>;
  
  // Longer elements should map first
  patterns.sort((a, b) => b.length - a.length);
  
  // Convert standard ending 'u' elements to stem triggers (e.g., 決める -> 決め)
  const stems = patterns.map(pat => {
    if (pat.endsWith('る') && pat.length > 2) {
      return pat.slice(0, -1);
    }
    return pat;
  });
  
  try {
    const escaped = stems.map(s => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'g');
    const pieces = sentence.split(regex);
    
    return (
      <>
        {pieces.map((part, idx) => {
          const isMatch = stems.some(stem => part.includes(stem) || stem.includes(part));
          return isMatch ? (
            <span key={idx} className="relative font-bold text-zinc-950 inline-block px-0.5">
              <span className="absolute bottom-0.5 left-0 right-0 h-[0.45em] bg-indigo-100 -z-10 rounded-xs" />
              {part}
            </span>
          ) : (
            <span key={idx}>{part}</span>
          );
        })}
      </>
    );
  } catch (err) {
    return <span>{sentence}</span>;
  }
};

export const GrammarCard: React.FC<GrammarCardProps> = ({ 
  data, 
  layoutId, 
  onClick, 
  isExpanded = false,
  onClose 
}) => {
  return (
    <div className="relative">
      {/* Grid Placeholder */}
      <div className="pointer-events-none invisible" aria-hidden="true">
        <div className="bg-white border border-gray-100 rounded-[1.5rem] sm:rounded-[2rem] p-4 xs:p-5 sm:p-8 shadow-sm">
           <div className="h-40 sm:h-48"></div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && onClose && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xl z-[60]"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExpanded && onClose ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
            <motion.div
              layoutId={layoutId}
              className="pointer-events-auto bg-white border border-gray-100 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-lg p-5 sm:p-10 cursor-default max-h-[85vh] overflow-y-auto no-scrollbar ring-1 ring-black/5 relative"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ 
                layout: { type: "spring", stiffness: 350, damping: 30 },
                opacity: { duration: 0.2 }
              }}
            >
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 p-1.5 sm:p-2 bg-gray-50/50 hover:bg-gray-100 rounded-full text-gray-400 transition-colors z-[80] backdrop-blur-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <motion.div className="mb-4 sm:mb-6" layout="position">
                <motion.div layout="position" className="flex items-center space-x-2 mb-2">
                   <span className="bg-indigo-900 text-white text-[8px] sm:text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest shadow-sm">Grammar</span>
                </motion.div>
                
                <motion.h3 layout="position" className="text-lg xs:text-xl sm:text-2xl font-black text-gray-900 tracking-tight mb-1 leading-snug">
                  {data.grammarPoint}
                </motion.h3>
              </motion.div>

              {/* 句型組成另外以方塊展示，並附上不同詞性的色彩樣式 */}
              <motion.div layout="position" className="bg-indigo-50/20 border border-indigo-100/50 rounded-2xl p-4 sm:p-5 mb-5 sm:mb-6 shadow-sm overflow-hidden relative">
                <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-3">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-indigo-600 rounded-full animate-pulse inline-block" />
                    <span className="text-[11px] sm:text-sm font-black text-indigo-950 uppercase tracking-wider select-none">
                      接續結構組成 (句型公式)
                    </span>
                  </div>
                  <span className="text-[8px] sm:text-[9px] font-black text-indigo-500 bg-indigo-50 border border-indigo-100/50 px-1.5 py-0.5 rounded-md">Structure</span>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center bg-white border border-indigo-100/25 p-3 sm:p-4 rounded-xl shadow-xs">
                  {parseConnection(data.connection)}
                </div>
              </motion.div>
              
              <motion.div 
                layout="position" 
                className="border-t border-gray-50 pt-5 space-y-6"
              >
                {/* 用法解析、中文意思與詳細解釋 */}
                <div className="space-y-3">
                  <div>
                    <h4 className="text-[8px] sm:text-[10px] font-bold text-zinc-300 uppercase tracking-widest mb-1.5">用法中文意思</h4>
                    <motion.p layout="position" className="text-base sm:text-lg md:text-xl text-gray-900 font-extrabold tracking-tight leading-snug">
                      {data.meaning}
                    </motion.p>
                  </div>

                  <div>
                     <h4 className="text-[8px] sm:text-[10px] font-bold text-zinc-300 uppercase tracking-widest mb-1.5">用法解析說明</h4>
                     <motion.p layout="position" className="text-zinc-650 font-medium text-[11px] sm:text-sm leading-relaxed whitespace-pre-line">
                        {data.explanation}
                     </motion.p>
                  </div>
                </div>
                
                {/* 情境例句 & 動態單字文法點塗色與標示 */}
                <div className="space-y-3.5 sm:space-y-4 pt-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h4 className="text-[9px] sm:text-[10px] font-black text-zinc-300 uppercase tracking-widest">情境應用例句</h4>
                      <div className="h-px flex-1 bg-zinc-50" />
                    </div>
                    {data.examples.map((ex, i) => (
                        <motion.div 
                            layout="position" 
                            key={i} 
                            className="bg-zinc-50/30 rounded-2xl border border-zinc-100 hover:border-zinc-200/50 transition-all shadow-xs p-3.5 sm:p-5"
                        >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[8px] sm:text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100/30 px-1.5 py-0.5 rounded-md">例句 0{i+1}</span>
                              <span className="text-[8px] sm:text-[9px] font-bold text-zinc-300 uppercase tracking-widest">Context</span>
                            </div>

                            <motion.p layout="position" className="text-zinc-900 font-extrabold text-[15px] sm:text-[1.05rem] leading-relaxed">
                                {highlightGrammarInSentence(ex.sentence, data.grammarPoint)}
                            </motion.p>
                            <motion.p layout="position" className="text-zinc-400 font-semibold text-[10px] sm:text-xs my-0.5 font-mono tracking-wide">
                                {ex.reading}
                            </motion.p>
                            <motion.p layout="position" className="text-zinc-600 font-medium text-xs sm:text-sm border-l-2 border-indigo-200/65 pl-3 mt-1.5 leading-relaxed">
                                {ex.translation}
                            </motion.p>
                        </motion.div>
                    ))}
                </div>
              </motion.div>
            </motion.div>
          </div>
        ) : (
          <motion.div
            layoutId={layoutId}
            onClick={onClick}
            className="absolute inset-0 bg-white border border-gray-100 rounded-[1.5rem] sm:rounded-[2rem] p-4.5 xs:p-5 sm:p-8 hover:shadow-xl hover:border-gray-200 cursor-pointer shadow-sm overflow-hidden flex flex-col justify-between"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.div className="mb-2 sm:mb-4 flex flex-col" layout="position">
              <motion.div layout="position" className="flex items-center space-x-2 mb-1.5 sm:mb-2.5">
                 <span className="bg-indigo-900 text-white text-[8px] sm:text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest shadow-sm">Grammar</span>
              </motion.div>
              
              <motion.h3 layout="position" className="text-base sm:text-lg font-black text-gray-900 tracking-tight mb-1 truncate">
                {data.grammarPoint}
              </motion.h3>

              <div className="flex flex-wrap gap-1 items-center mt-1 sm:mt-2">
                {parseConnection(data.connection)}
              </div>
            </motion.div>
            
            <motion.div 
              layout="position" 
              className="border-t border-gray-50 pt-2.5 sm:pt-4"
            >
              <motion.p layout="position" className="text-xs sm:text-base mb-1.5 sm:mb-2 text-gray-800 font-bold tracking-tight line-clamp-1">
                {data.meaning}
              </motion.p>

              <motion.p layout="position" className="text-[9px] sm:text-xs mb-2 sm:mb-3 text-gray-500 font-medium line-clamp-2">
                  {data.explanation}
              </motion.p>
              
              <div className="space-y-1.5 sm:space-y-2">
                  {data.examples.slice(0, 1).map((ex, i) => (
                      <motion.div 
                          layout="position" 
                          key={i} 
                          className="bg-zinc-50/50 rounded-xl border border-zinc-100 shadow-sm p-1.5 sm:p-3"
                      >
                          <motion.p layout="position" className="text-gray-900 font-bold text-[10px] sm:text-sm truncate">
                              {ex.sentence}
                          </motion.p>
                          <motion.p layout="position" className="text-gray-500 font-medium text-[9px] sm:text-xs border-l border-indigo-100 pl-2 mt-0.5 truncate">
                              {ex.translation}
                          </motion.p>
                      </motion.div>
                  ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
