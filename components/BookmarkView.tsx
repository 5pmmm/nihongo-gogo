import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookmarkItem, getBookmarks, toggleBookmark } from '../services/bookmarkStorage';
import { WordDefinition, GrammarDefinition } from '../types';

interface BookmarkViewProps {
  onStartQuizWithBookmarks?: (words: WordDefinition[], grammar: GrammarDefinition[]) => void;
}

export const BookmarkView: React.FC<BookmarkViewProps> = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'WORD' | 'GRAMMAR'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadBookmarks = () => {
    setBookmarks(getBookmarks());
  };

  useEffect(() => {
    loadBookmarks();
  }, []);

  const handleToggle = (item: BookmarkItem) => {
    toggleBookmark({
      type: item.type,
      title: item.title,
      data: item.data
    });
    loadBookmarks();
  };

  const handleClearAll = () => {
    if (window.confirm('確定要清空所有收藏嗎？')) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('nihongo_gogo_bookmarks_v1');
      }
      setBookmarks([]);
    }
  };

  const filtered = bookmarks.filter(b => {
    if (filterType !== 'ALL' && b.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = b.title.toLowerCase().includes(q);
      const matchMeaning = (b.data as any).meaning?.toLowerCase().includes(q);
      const matchReading = (b.data as any).reading?.toLowerCase().includes(q);
      return matchTitle || matchMeaning || matchReading;
    }
    return true;
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E9ECEF]">
        <div>
          <h2 className="text-[20px] font-bold text-[#2B303A] tracking-tight">
            單字與文法收藏
          </h2>
          <p className="text-sm text-[#6C757D] mt-1">
            已儲存 {bookmarks.length} 個複習項目，隨時離線檢視
          </p>
        </div>
        {bookmarks.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-sm text-[#8B4848] hover:text-[#6F3232] font-medium transition-colors px-3 py-1.5 rounded-lg border border-[#E9ECEF] hover:bg-[#F1F3F5] active:scale-[0.98]"
          >
            清空收藏
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="inline-flex items-center p-1 bg-[#E9ECEF]/70 rounded-xl">
          {[
            { id: 'ALL', label: '全部' },
            { id: 'WORD', label: '單字' },
            { id: 'GRAMMAR', label: '文法' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id as any)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filterType === tab.id
                  ? 'bg-white text-[#2B303A] shadow-xs'
                  : 'text-[#6C757D] hover:text-[#2B303A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜尋收藏內容..."
            className="w-full px-3.5 py-2 bg-white border border-[#CED4DA] rounded-xl text-sm text-[#2B303A] placeholder-[#ADB5BD] outline-none focus:border-[#4F6375] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#ADB5BD] hover:text-[#6C757D]"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* Bookmark Cards List */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E9ECEF] rounded-2xl">
          <p className="text-base font-medium text-[#6C757D]">
            {bookmarks.length === 0
              ? '尚無收藏項目。在解析結果卡片右上角點擊星號即可收藏。'
              : '沒有符合搜尋條件的收藏項目。'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <AnimatePresence>
            {filtered.map(item => {
              const isWord = item.type === 'WORD';
              const wordData = isWord ? (item.data as WordDefinition) : null;
              const grammarData = !isWord ? (item.data as GrammarDefinition) : null;
              const isExpanded = expandedId === item.id;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.18 }}
                  className="bg-white border border-[#E9ECEF] rounded-2xl p-5 hover:border-[#CED4DA] hover:shadow-xs transition-all flex flex-col justify-between relative group"
                >
                  {/* Top Bar: Type label & Star button */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        isWord 
                          ? 'bg-[#4F6375]/10 text-[#3D4F5F]' 
                          : 'bg-[#5A6959]/10 text-[#435242]'
                      }`}>
                        {isWord ? '單字' : '文法'}
                      </span>
                      {isWord && wordData?.pitchAccent && (
                        <span className="text-xs text-[#7A6856] bg-[#7A6856]/10 px-2 py-0.5 rounded font-medium">
                          {wordData.pitchAccent}
                        </span>
                      )}
                      {isWord && wordData?.partOfSpeech && (
                        <span className="text-xs text-[#6C757D]">
                          {wordData.partOfSpeech}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggle(item)}
                      title="取消收藏"
                      className="p-1.5 text-[#E69D45] hover:text-[#C8822B] hover:scale-110 active:scale-90 transition-all rounded-lg"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  {/* Main Headings */}
                  <div className="mb-3">
                    <h3 className="text-[19px] font-bold text-[#2B303A] tracking-tight">
                      {item.title}
                    </h3>
                    {isWord && wordData?.reading && (
                      <p className="text-sm text-[#6C757D] font-medium mt-0.5 font-jp">
                        {wordData.reading}
                      </p>
                    )}
                  </div>

                  {/* Connection rule for grammar */}
                  {!isWord && grammarData?.connection && (
                    <div className="mb-3 p-2.5 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl text-xs text-[#435242] font-jp font-medium">
                      <span className="text-[#6C757D] mr-1">接續：</span>
                      {grammarData.connection}
                    </div>
                  )}

                  {/* Meaning */}
                  <div className="mb-4">
                    <p className="text-sm sm:text-base text-[#2B303A] font-medium leading-relaxed">
                      {isWord ? wordData?.meaning : grammarData?.meaning}
                    </p>
                    {!isWord && grammarData?.explanation && (
                      <p className="text-xs text-[#6C757D] mt-1 leading-relaxed">
                        {grammarData.explanation}
                      </p>
                    )}
                  </div>

                  {/* Examples Toggle / Display */}
                  <div className="pt-3 border-t border-[#F1F3F5]">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="text-xs font-medium text-[#4F6375] hover:text-[#3D4F5F] flex items-center justify-between w-full"
                    >
                      <span>{isExpanded ? '收起例句' : '查看例句'}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden mt-3 space-y-3"
                        >
                          {isWord && wordData?.examples && wordData.examples.length > 0 ? (
                            wordData.examples.map((ex, idx) => (
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
                            ))
                          ) : isWord && wordData?.exampleSentence ? (
                            <div className="p-3 bg-[#F8F9FA] rounded-xl text-xs space-y-1">
                              <p className="font-bold text-[#2B303A] font-jp leading-relaxed">
                                {wordData.exampleSentence}
                              </p>
                              {wordData.exampleReading && (
                                <p className="text-[#6C757D] font-jp">
                                  {wordData.exampleReading}
                                </p>
                              )}
                              <p className="text-[#495057] italic">
                                {wordData.exampleTranslation}
                              </p>
                            </div>
                          ) : !isWord && grammarData?.examples && grammarData.examples.length > 0 ? (
                            grammarData.examples.map((ex, idx) => (
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
                            ))
                          ) : (
                            <p className="text-xs text-[#ADB5BD]">暫無詳細例句</p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
