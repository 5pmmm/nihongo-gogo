
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReadingMaterial, AnalyzedToken } from '../types';

interface ReadingViewProps {
  material: ReadingMaterial;
  onClose?: () => void;
}

const JLPT_COLORS = {
  N5: 'bg-sky-50 text-sky-700 border-sky-200',
  N4: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  N3: 'bg-amber-50 text-amber-700 border-amber-200',
  N2: 'bg-orange-50 text-orange-700 border-orange-200',
  N1: 'bg-rose-50 text-rose-700 border-rose-200',
  Unknown: 'bg-slate-50 text-slate-500 border-slate-200'
};

const JLPT_LABELS = {
  N5: 'N5',
  N4: 'N4',
  N3: 'N3',
  N2: 'N2',
  N1: 'N1',
  Unknown: '?'
};

export const ReadingView: React.FC<ReadingViewProps> = ({ material, onClose }) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const [selectedToken, setSelectedToken] = useState<AnalyzedToken | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');

  const filteredTokens = material.tokens.filter(t => 
    filterLevel === 'ALL' || t.jlpt === filterLevel
  );

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 md:p-8 bg-gray-50 border-b border-gray-100 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                READING
              </span>
              <span className="text-xs text-gray-500 font-mono">
                {material.tokens.length} KEYWORDS
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
              {material.title}
            </h2>
          </div>
          {onClose && (
              <button onClick={onClose} className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-600 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
              </button>
          )}
        </div>

        <div className="p-6 md:p-8 grid md:grid-cols-12 gap-8">
          {/* Article Section */}
          <div className="md:col-span-7 space-y-6">
              <div className="prose prose-lg max-w-none text-gray-800 leading-loose whitespace-pre-wrap font-jp">
                {material.content}
              </div>
              
              <div className="pt-4 border-t border-gray-100">
                <button 
                  onClick={() => setShowTranslation(!showTranslation)}
                  className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 transform transition-transform ${showTranslation ? 'rotate-180' : ''}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                  {showTranslation ? '隱藏翻譯' : '查看翻譯'}
                </button>
                
                <AnimatePresence>
                  {showTranslation && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="text-gray-600 bg-gray-50 p-4 rounded-lg leading-relaxed">
                        {material.translation}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
          </div>

          {/* Vocabulary Analysis Section */}
          <div className="md:col-span-5 flex flex-col h-full md:max-h-[600px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-700">解析列表</h3>
                <select 
                  className="text-sm border-gray-200 rounded-md bg-gray-50 text-gray-600 py-1 px-2 focus:ring-2 focus:ring-indigo-200 outline-none"
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                >
                  <option value="ALL">全部等級</option>
                  <option value="N5">N5 (入門)</option>
                  <option value="N4">N4 (初級)</option>
                  <option value="N3">N3 (中級)</option>
                  <option value="N2">N2 (中高級)</option>
                  <option value="N1">N1 (高級)</option>
                </select>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-2 no-scrollbar">
                {filteredTokens.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">此等級沒有解析項目。</p>
                ) : (
                  filteredTokens.map((token, idx) => (
                    <motion.div
                      key={idx}
                      layout
                      onClick={() => setSelectedToken(token)}
                      className="p-3 rounded-xl border-2 border-transparent bg-gray-50 hover:bg-white hover:border-indigo-100 hover:shadow-sm transition-all cursor-pointer group"
                    >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border-2 shadow-sm ${JLPT_COLORS[token.jlpt] || JLPT_COLORS.Unknown}`}>
                                {JLPT_LABELS[token.jlpt] || '?'}
                              </span>
                              <div>
                                <p className="font-bold text-gray-800 group-hover:text-indigo-700 transition-colors">{token.text}</p>
                                {token.text !== token.dictionaryForm && (
                                    <p className="text-xs text-gray-400">({token.dictionaryForm})</p>
                                )}
                              </div>
                          </div>
                          <div className="text-xs text-gray-400 font-mono">
                            {token.reading}
                          </div>
                        </div>
                    </motion.div>
                  ))
                )}
              </div>
          </div>
        </div>
      </motion.div>

      {/* Word Card Modal */}
      <AnimatePresence>
        {selectedToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm"
            onClick={() => setSelectedToken(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedToken(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="p-8">
                {/* Header Info */}
                <div className="flex gap-2 mb-4">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded border-2 uppercase tracking-wider ${JLPT_COLORS[selectedToken.jlpt] || JLPT_COLORS.Unknown}`}>
                    {JLPT_LABELS[selectedToken.jlpt] || '?'}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                    selectedToken.type === 'GRAMMAR' ? 'bg-pink-100 text-pink-700 border-pink-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                  }`}>
                    {selectedToken.type}
                  </span>
                </div>

                {/* Main Word */}
                <div className="mb-6">
                  <h2 className="text-4xl font-bold text-gray-900 mb-1">{selectedToken.text}</h2>
                  <p className="text-lg text-gray-500 font-medium">{selectedToken.reading}</p>
                  {selectedToken.text !== selectedToken.dictionaryForm && (
                     <p className="text-xs text-gray-400 mt-1">原形: {selectedToken.dictionaryForm}</p>
                  )}
                </div>

                {/* Meaning */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Meaning</h3>
                  <p className="text-xl font-medium text-gray-800">{selectedToken.meaning}</p>
                </div>

                {/* Example Sentence */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Example</h3>
                  {selectedToken.exampleSentence ? (
                    <>
                      <p className="text-gray-800 font-medium mb-1">{selectedToken.exampleSentence}</p>
                      <p className="text-xs text-gray-400 mb-2">{selectedToken.exampleReading}</p>
                      <p className="text-sm text-gray-600">{selectedToken.exampleTranslation}</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 italic">尚無例句</p>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
