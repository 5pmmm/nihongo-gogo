import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WordDefinition } from '../types';

interface WordCardProps {
  data: WordDefinition;
  layoutId: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export const WordCard: React.FC<WordCardProps> = ({ 
  data, 
  layoutId, 
  isExpanded, 
  onToggle 
}) => {
  return (
    <div className="relative">
      {/* Grid Placeholder: Ensures the space in the grid is occupied even when card is expanded */}
      <div className="pointer-events-none invisible" aria-hidden="true">
        <div className="bg-white border border-gray-100 rounded-[1.5rem] sm:rounded-[2rem] p-4 xs:p-5 sm:p-8 shadow-sm">
           <div className="h-28 xs:h-32 sm:h-40"></div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xl z-[60]"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExpanded ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
            <motion.div
              layoutId={layoutId}
              className="pointer-events-auto bg-white border border-gray-100 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-lg p-5 sm:p-10 cursor-default max-h-[85vh] overflow-y-auto no-scrollbar ring-1 ring-black/5 relative"
            >
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 p-1.5 sm:p-2 bg-gray-50/50 hover:bg-gray-100 rounded-full text-gray-400 transition-colors z-[80] backdrop-blur-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <motion.div className="flex flex-col mb-3 sm:mb-6" layout="position">
                  <motion.div layout="position" className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-3">
                      <span className="bg-zinc-950 text-white text-[8px] sm:text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Vocabulary</span>
                      <span className="text-zinc-400 text-[8px] sm:text-[9px] font-medium uppercase tracking-[0.2em] ml-2">Details</span>
                  </motion.div>
                  <motion.h3 layout="position" className="text-xl xs:text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-tight mb-1">
                    {data.word}
                  </motion.h3>
                  <motion.p layout="position" className="text-sm sm:text-lg text-zinc-500 font-bold tracking-normal sm:tracking-[0.1em] mt-0.5 sm:mt-1">
                    {data.reading}
                  </motion.p>
              </motion.div>
              
              <motion.div layout="position" className="space-y-5 sm:space-y-8">
                <motion.div layout="position" className="pt-2 sm:pt-4 border-t border-zinc-50">
                   <h4 className="text-[9px] sm:text-[10px] font-bold text-zinc-300 uppercase tracking-widest mb-2 sm:mb-3">Meaning</h4>
                   <p className="text-base sm:text-l md:text-xl text-gray-900 font-bold tracking-tight leading-snug">
                     {data.meaning}
                   </p>
                </motion.div>
                
                <motion.div layout="position" className="bg-zinc-50/50 rounded-2xl p-4 xs:p-5 sm:p-8 relative overflow-hidden group border border-zinc-100/50">
                   <h4 className="text-[9px] sm:text-[10px] font-bold text-zinc-300 uppercase tracking-widest mb-3 sm:mb-4">Example</h4>
                   <div className="space-y-2.5 sm:space-y-4">
                      <p className="text-[15px] sm:text-lg text-gray-900 font-bold leading-relaxed tracking-tight">
                        {data.exampleSentence}
                      </p>
                      {data.exampleReading && (
                         <p className="text-xs sm:text-base text-zinc-500 font-semibold leading-relaxed mt-0.5">
                           {data.exampleReading}
                         </p>
                      )}
                      <p className="text-[11px] sm:text-sm text-zinc-500 font-medium border-l border-zinc-200 pl-3 italic">
                        {data.exampleTranslation}
                      </p>
                   </div>
                </motion.div>

                {data.sentenceBreakdown && data.sentenceBreakdown.length > 0 && (
                   <motion.div 
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     className="space-y-4 sm:space-y-6"
                   >
                      <div className="flex items-center gap-3">
                         <h4 className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">Structure</h4>
                         <div className="h-px flex-1 bg-zinc-50" />
                      </div>
                      <div className="grid gap-2.5 sm:gap-4">
                         {data.sentenceBreakdown.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 sm:p-5 bg-white border border-zinc-100/80 rounded-xl sm:rounded-2xl hover:border-zinc-200 transition-all duration-300">
                               <div>
                                  <p className="text-xs sm:text-base font-bold text-zinc-900 tracking-tight">{item.word}</p>
                                  <p className="text-[10px] sm:text-xs text-zinc-500 font-semibold mt-0.5">{item.reading}</p>
                               </div>
                               <div className="text-[10px] sm:text-xs font-bold text-zinc-500 bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-100/50">
                                  {item.meaning}
                               </div>
                            </div>
                         ))}
                      </div>
                   </motion.div>
                )}
              </motion.div>
            </motion.div>
          </div>
        ) : (
          <motion.div
            layoutId={layoutId}
            onClick={onToggle}
            className="absolute inset-0 bg-white border border-gray-100 rounded-[1.5rem] sm:rounded-[2rem] p-4 xs:p-5 sm:p-8 hover:shadow-xl hover:border-gray-200 cursor-pointer shadow-sm overflow-hidden flex flex-col justify-between"
          >
            <motion.div className="flex flex-col mb-1.5 sm:mb-4" layout="position">
                <motion.div layout="position" className="flex items-center gap-2 mb-1.5 sm:mb-3">
                    <span className="bg-zinc-950 text-white text-[8px] sm:text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Vocabulary</span>
                </motion.div>
                <motion.h3 layout="position" className="text-lg xs:text-xl sm:text-3xl font-black text-gray-900 tracking-tight leading-tight mb-0.5 truncate">
                  {data.word}
                </motion.h3>
                <motion.p layout="position" className="text-xs sm:text-base text-zinc-500 font-bold tracking-normal sm:tracking-[0.1em] mt-0.5 sm:mt-1 truncate">
                  {data.reading}
                </motion.p>
            </motion.div>
            
            <motion.div layout="position" className="space-y-4">
              <motion.div layout="position" className="pt-1.5 sm:pt-4 border-t border-zinc-50">
                 <h4 className="text-[8px] sm:text-[10px] font-bold text-zinc-300 uppercase tracking-widest mb-1 sm:mb-3">Meaning</h4>
                 <p className="text-sm xs:text-base sm:text-xl text-gray-900 font-bold tracking-tight leading-snug line-clamp-2">
                   {data.meaning}
                 </p>
              </motion.div>
              
              <div className="flex justify-center pt-1">
                <span className="text-[8px] font-bold text-zinc-200 uppercase tracking-[0.4em] scale-95 sm:scale-90">View Details</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
