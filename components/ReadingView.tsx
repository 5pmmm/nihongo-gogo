import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReadingMaterial, AnalyzedToken, WordDefinition, GrammarDefinition, WordExample } from '../types';
import { isItemBookmarked, toggleBookmark } from '../services/bookmarkStorage';

interface ReadingViewProps {
  material: ReadingMaterial;
  onClose?: () => void;
}

export const ReadingView: React.FC<ReadingViewProps> = ({ material, onClose }) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const [selectedToken, setSelectedToken] = useState<AnalyzedToken | null>(null);
  const [bookmarkedTokens, setBookmarkedTokens] = useState<{ [key: string]: boolean }>({});
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  // Keyboard escape listener to close popup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedToken(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleBookmarkToken = (token: AnalyzedToken) => {
    const isWord = token.type === 'VOCAB';
    const key = token.text;

    const tokenExamples = getTokenExamples(token);

    if (isWord) {
      const wordObj: WordDefinition = {
        word: token.text,
        reading: token.reading,
        pitchAccent: token.pitchAccent,
        meaning: token.meaning,
        partOfSpeech: token.partOfSpeech || '單字',
        examples: tokenExamples,
        exampleSentence: tokenExamples[0]?.sentence || token.exampleSentence || token.text,
        exampleReading: tokenExamples[0]?.reading || token.exampleReading || token.reading,
        exampleTranslation: tokenExamples[0]?.translation || token.exampleTranslation || token.meaning
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
        examples: tokenExamples.map(ex => ({
          sentence: ex.sentence,
          reading: ex.reading || '',
          translation: ex.translation || ''
        }))
      };
      const added = toggleBookmark({ type: 'GRAMMAR', title: token.text, data: grammarObj });
      setBookmarkedTokens(prev => ({ ...prev, [key]: added }));
    }
  };

  // Extract 1 to 2 natural examples
  const getTokenExamples = (token: AnalyzedToken): WordExample[] => {
    const list: WordExample[] = [];
    if (token.examples && Array.isArray(token.examples) && token.examples.length > 0) {
      list.push(...token.examples.slice(0, 2));
    } else if (token.exampleSentence) {
      list.push({
        sentence: token.exampleSentence,
        reading: token.exampleReading || '',
        translation: token.exampleTranslation || ''
      });
    }
    return list;
  };

  // Text-to-speech for word and sentences
  const playSpeech = (text: string, key: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.9;
      setPlayingKey(key);
      utterance.onend = () => setPlayingKey(null);
      utterance.onerror = () => setPlayingKey(null);
      window.speechSynthesis.speak(utterance);
    } catch {
      setPlayingKey(null);
    }
  };

  return (
    <>
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
              className="p-1.5 rounded-lg text-[#6C757D] hover:text-[#2B303A] hover:bg-[#E9ECEF] transition-colors cursor-pointer"
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
              className="text-sm font-medium text-[#4F6375] hover:text-[#3D4F5F] inline-flex items-center gap-1.5 cursor-pointer"
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#2B303A]">
                    文章重點單字與文法 ({material.tokens.length})
                  </h3>
                  <span className="text-[11px] font-medium text-[#4F6375] bg-[#4F6375]/10 px-2 py-0.5 rounded-full">
                    點擊單字可開啟字卡
                  </span>
                </div>
                <span className="text-xs text-[#6C757D]">
                  支援拼音、中文、1~2個例句與星號收藏
                </span>
              </div>

              {/* Tokens Grid */}
              <div className="grid gap-3 sm:grid-cols-2">
                {material.tokens.map((token, idx) => {
                  const isBookmarked = bookmarkedTokens[token.text] ?? isItemBookmarked(token.text, token.type === 'VOCAB' ? 'WORD' : 'GRAMMAR');
                  return (
                    <div 
                      key={idx}
                      onClick={() => setSelectedToken(token)}
                      className="p-3.5 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl flex items-start justify-between gap-3 hover:border-[#4F6375] hover:bg-white hover:shadow-xs transition-all cursor-pointer group active:scale-[0.99]"
                      role="button"
                      tabIndex={0}
                      title="點擊展開小方框字卡"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
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
                          <span className="text-xs text-[#6C757D] font-jp font-medium">
                            {token.reading}
                          </span>
                        </div>
                        <p className="text-[15px] font-bold text-[#2B303A] font-jp group-hover:text-[#4F6375] transition-colors flex items-center gap-1.5">
                          <span>{token.text}</span>
                          <span className="text-[11px] font-normal text-[#6C757D] opacity-0 group-hover:opacity-100 transition-opacity">
                            字卡
                          </span>
                        </p>
                        <p className="text-xs text-[#495057] line-clamp-1">
                          {token.meaning}
                        </p>
                      </div>

                      {/* Bookmark Icon Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBookmarkToken(token);
                        }}
                        title={isBookmarked ? "已收藏（點擊取消）" : "加入收藏"}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
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

      {/* Pop-up Flashcard Modal / 小方框字卡跳出視窗 */}
      <AnimatePresence>
        {selectedToken && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedToken(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
            />

            {/* Modal Dialog Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg bg-white rounded-2xl border border-[#E9ECEF] shadow-xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
            >
              {/* Modal Top Header */}
              <div className="p-5 bg-[#F8F9FA] border-b border-[#E9ECEF] flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    selectedToken.type === 'VOCAB' 
                      ? 'bg-[#4F6375]/10 text-[#3D4F5F]' 
                      : 'bg-[#5A6959]/10 text-[#435242]'
                  }`}>
                    {selectedToken.type === 'VOCAB' ? '單字字卡' : '文法字卡'}
                  </span>
                  {selectedToken.jlpt && selectedToken.jlpt !== 'Unknown' && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#7A6856]/10 text-[#635343]">
                      {selectedToken.jlpt}
                    </span>
                  )}
                  {selectedToken.partOfSpeech && (
                    <span className="text-xs text-[#6C757D] font-medium">
                      {selectedToken.partOfSpeech}
                    </span>
                  )}
                  {selectedToken.pitchAccent && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#E9ECEF] text-[#495057]">
                      {selectedToken.pitchAccent}
                    </span>
                  )}
                </div>

                {/* Top Action Buttons: Pronounce, Bookmark, Close */}
                <div className="flex items-center gap-1.5">
                  {/* Pronounce Button */}
                  <button
                    type="button"
                    onClick={() => playSpeech(selectedToken.reading || selectedToken.text, 'word-head')}
                    title="朗讀發音"
                    className="p-1.5 rounded-lg text-[#4F6375] hover:text-[#3D4F5F] hover:bg-[#E9ECEF] transition-colors cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className={`w-4 h-4 ${playingKey === 'word-head' ? 'animate-pulse text-[#4F6375]' : ''}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                    </svg>
                  </button>

                  {/* Bookmark Button */}
                  <button
                    type="button"
                    onClick={() => handleBookmarkToken(selectedToken)}
                    title={bookmarkedTokens[selectedToken.text] ?? isItemBookmarked(selectedToken.text, selectedToken.type === 'VOCAB' ? 'WORD' : 'GRAMMAR') ? "已收藏" : "加入收藏"}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      (bookmarkedTokens[selectedToken.text] ?? isItemBookmarked(selectedToken.text, selectedToken.type === 'VOCAB' ? 'WORD' : 'GRAMMAR'))
                        ? 'text-[#E69D45] hover:text-[#C8822B]' 
                        : 'text-[#CED4DA] hover:text-[#6C757D]'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={(bookmarkedTokens[selectedToken.text] ?? isItemBookmarked(selectedToken.text, selectedToken.type === 'VOCAB' ? 'WORD' : 'GRAMMAR')) ? "currentColor" : "none"} stroke="currentColor" strokeWidth={(bookmarkedTokens[selectedToken.text] ?? isItemBookmarked(selectedToken.text, selectedToken.type === 'VOCAB' ? 'WORD' : 'GRAMMAR')) ? "0" : "1.75"} className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                    </svg>
                  </button>

                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedToken(null)}
                    className="p-1.5 rounded-lg text-[#6C757D] hover:text-[#2B303A] hover:bg-[#E9ECEF] transition-colors cursor-pointer"
                    title="關閉字卡"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 overflow-y-auto">
                {/* Word & Phonetic Reading */}
                <div>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <h3 className="text-[20px] font-bold text-[#2B303A] font-jp tracking-tight">
                      {selectedToken.text}
                    </h3>
                    <span className="text-base font-semibold text-[#4F6375] font-jp">
                      【{selectedToken.reading}】
                    </span>
                    {selectedToken.dictionaryForm && selectedToken.dictionaryForm !== selectedToken.text && (
                      <span className="text-xs text-[#6C757D] font-jp">
                        原形: {selectedToken.dictionaryForm}
                      </span>
                    )}
                  </div>

                  {/* Meaning */}
                  <div className="mt-2.5 p-3.5 bg-[#F8F9FA] rounded-xl border border-[#E9ECEF]">
                    <span className="text-xs font-semibold text-[#6C757D] block mb-1">
                      中文釋義
                    </span>
                    <p className="text-sm sm:text-base text-[#2B303A] font-medium leading-relaxed">
                      {selectedToken.meaning}
                    </p>
                  </div>
                </div>

                {/* 1~2 Example Sentences */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-bold text-[#6C757D] tracking-wide">
                      實用例句 ({getTokenExamples(selectedToken).length} 句)
                    </span>
                    <span className="text-[11px] text-[#ADB5BD]">
                      點擊語音圖示可朗讀
                    </span>
                  </div>

                  {getTokenExamples(selectedToken).length > 0 ? (
                    <div className="space-y-3">
                      {getTokenExamples(selectedToken).map((ex, exIdx) => (
                        <div 
                          key={exIdx} 
                          className="p-3.5 bg-[#F8F9FA] rounded-xl border border-[#E9ECEF] text-xs space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-bold text-[#2B303A] font-jp leading-relaxed text-sm">
                              {ex.sentence}
                            </p>
                            <button
                              type="button"
                              onClick={() => playSpeech(ex.sentence, `ex-${exIdx}`)}
                              title="朗讀此例句"
                              className="p-1 rounded text-[#6C757D] hover:text-[#4F6375] hover:bg-[#E9ECEF] transition-colors shrink-0 cursor-pointer"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className={`w-3.5 h-3.5 ${playingKey === `ex-${exIdx}` ? 'animate-pulse text-[#4F6375]' : ''}`}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                              </svg>
                            </button>
                          </div>
                          {ex.reading && (
                            <p className="text-[#6C757D] font-jp">
                              {ex.reading}
                            </p>
                          )}
                          <p className="text-[#495057] font-medium pt-1 border-t border-[#E9ECEF]">
                            {ex.translation}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E9ECEF] text-xs text-[#6C757D] text-center">
                      暫無獨立例句
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-[#F8F9FA] border-t border-[#E9ECEF] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleBookmarkToken(selectedToken)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    (bookmarkedTokens[selectedToken.text] ?? isItemBookmarked(selectedToken.text, selectedToken.type === 'VOCAB' ? 'WORD' : 'GRAMMAR'))
                      ? 'bg-[#E69D45]/15 text-[#C8822B] border border-[#E69D45]/30'
                      : 'bg-white text-[#2B303A] border border-[#CED4DA] hover:bg-[#F1F3F5]'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={(bookmarkedTokens[selectedToken.text] ?? isItemBookmarked(selectedToken.text, selectedToken.type === 'VOCAB' ? 'WORD' : 'GRAMMAR')) ? "currentColor" : "none"} stroke="currentColor" strokeWidth={(bookmarkedTokens[selectedToken.text] ?? isItemBookmarked(selectedToken.text, selectedToken.type === 'VOCAB' ? 'WORD' : 'GRAMMAR')) ? "0" : "1.75"} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                  </svg>
                  <span>
                    {(bookmarkedTokens[selectedToken.text] ?? isItemBookmarked(selectedToken.text, selectedToken.type === 'VOCAB' ? 'WORD' : 'GRAMMAR'))
                      ? '已加入收藏庫'
                      : '加入收藏庫'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedToken(null)}
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-medium bg-[#2B303A] text-white hover:bg-[#1E2229] transition-all cursor-pointer active:scale-[0.98]"
                >
                  關閉
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
