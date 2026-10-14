import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReadingMaterial, AnalyzedToken, WordDefinition, GrammarDefinition } from '../types';
import { isItemBookmarked, toggleBookmark } from '../services/bookmarkStorage';

interface ReadingViewProps {
  material: ReadingMaterial;
  onClose?: () => void;
}

export const ReadingView: React.FC<ReadingViewProps> = ({ material, onClose }) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const [bookmarkedTokens, setBookmarkedTokens] = useState<{ [key: string]: boolean }>({});

  const handleBookmarkToken = (token: AnalyzedToken) => {
    const isWord = token.type === 'VOCAB';
    const key = token.text;
    if (isWord) {
      const wordObj: WordDefinition = {
        word: token.text,
        reading: token.reading,
        meaning: token.meaning,
        partOfSpeech: token.partOfSpeech || (token.type === 'VOCAB' ? '單字' : '文法'),
        exampleSentence: token.exampleSentence || token.text,
        exampleReading: token.exampleReading || token.reading,
        exampleTranslation: token.exampleTranslation || token.meaning
      };
      const added = toggleBookmark({ type: 'WORD', title: token.text, data: wordObj });
      setBookmarkedTokens(prev => ({ ...prev, [key]: added }));
    } else {
      const grammarObj: GrammarDefinition = {
        id: `g-tok-${Date.now()}`,
        grammarPoint: token.text,
        connection: '請參閱文章上下文接續',
        meaning: token.meaning,
        explanation: '萃取自文章中的重點文法句型。',
        examples: token.exampleSentence ? [{
          sentence: token.exampleSentence,
          reading: token.exampleReading || '',
          translation: token.exampleTranslation || ''
        }] : []
      };
      const added = toggleBookmark({ type: 'GRAMMAR', title: token.text, data: grammarObj });
      setBookmarkedTokens(prev => ({ ...prev, [key]: added }));
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-white border border-[#E9ECEF] rounded-2xl overflow-hidden shadow-xs"
    >
      {/* Article Header */}
      <div className="p-6 bg-[#F8F9FA] border-b border-[#E9ECEF] flex justify-between items-start">
        <div>
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#4F6375]/10 text-[#3D4F5F] mb-2 inline-block">
            文章解析
          </span>
          <h2 className="text-[20px] font-bold text-[#2B303A] tracking-tight">
            {material.title}
          </h2>
        </div>
        {onClose && (
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-lg text-[#6C757D] hover:text-[#2B303A] hover:bg-[#E9ECEF] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        {/* Full Japanese Article */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[#6C757D]">
            日文原文
          </h3>
          <p className="text-[16px] text-[#2B303A] leading-relaxed whitespace-pre-wrap font-jp">
            {material.content}
          </p>
        </div>

        {/* Translation Toggle & Block */}
        <div className="pt-4 border-t border-[#F1F3F5]">
          <button 
            type="button"
            onClick={() => setShowTranslation(!showTranslation)}
            className="text-sm font-medium text-[#4F6375] hover:text-[#3D4F5F] inline-flex items-center gap-1.5"
          >
            <span>{showTranslation ? '隱藏中文翻譯' : '查看完整中文翻譯'}</span>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={2} 
              stroke="currentColor" 
              className={`w-3.5 h-3.5 transition-transform duration-150 ${showTranslation ? 'rotate-180' : ''}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          <AnimatePresence>
            {showTranslation && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-3"
              >
                <div className="p-4 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl text-sm sm:text-base text-[#495057] leading-relaxed whitespace-pre-wrap">
                  {material.translation}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Extracted Tokens (Vocabulary & Grammar) */}
        {material.tokens && material.tokens.length > 0 && (
          <div className="pt-6 border-t border-[#F1F3F5] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#2B303A]">
                文章重點單字與文法 ({material.tokens.length})
              </h3>
              <span className="text-xs text-[#6C757D]">
                點擊星號可直接加入收藏
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {material.tokens.map((token, idx) => {
                const isBookmarked = bookmarkedTokens[token.text] ?? isItemBookmarked(token.text, token.type === 'VOCAB' ? 'WORD' : 'GRAMMAR');
                return (
                  <div 
                    key={idx}
                    className="p-3.5 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl flex items-start justify-between gap-3 hover:border-[#CED4DA] transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          token.type === 'VOCAB' 
                            ? 'bg-[#4F6375]/10 text-[#3D4F5F]' 
                            : 'bg-[#5A6959]/10 text-[#435242]'
                        }`}>
                          {token.type === 'VOCAB' ? '單字' : '文法'}
                        </span>
                        {token.jlpt && token.jlpt !== 'Unknown' && (
                          <span className="text-[10px] font-medium text-[#7A6856] bg-[#7A6856]/10 px-1.5 py-0.5 rounded">
                            {token.jlpt}
                          </span>
                        )}
                        <span className="text-xs text-[#6C757D] font-jp">
                          {token.reading}
                        </span>
                      </div>
                      <p className="text-[15px] font-bold text-[#2B303A] font-jp">
                        {token.text}
                      </p>
                      <p className="text-xs text-[#495057]">
                        {token.meaning}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleBookmarkToken(token)}
                      title={isBookmarked ? "已收藏" : "收藏"}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isBookmarked 
                          ? 'text-[#E69D45] hover:text-[#C8822B]' 
                          : 'text-[#CED4DA] hover:text-[#6C757D]'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isBookmarked ? "0" : "1.75"} className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
