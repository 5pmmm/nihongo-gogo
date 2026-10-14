import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WordDefinition, GrammarDefinition, ReadingMaterial, AppMode, InputMode } from './types';
import { fetchWordDefinitions, fetchGrammarDetails, analyzeReadingText } from './services/geminiService';
import { saveDailySearchRecord, getTodayRecords } from './services/dailyRecordStorage';
import { WordCard } from './components/WordCard';
import { GrammarCard } from './components/GrammarCard';
import { ReadingView } from './components/ReadingView';
import { Quiz } from './components/Quiz';
import { BookmarkView } from './components/BookmarkView';

// Clean SVG Icons without any emojis
const ParseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);

const QuizIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const BookmarkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
  </svg>
);

export const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.PARSE);
  const [inputMode, setInputMode] = useState<InputMode>('WORD');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parsed results
  const [definitions, setDefinitions] = useState<WordDefinition[]>([]);
  const [grammarList, setGrammarList] = useState<GrammarDefinition[]>([]);
  const [readingResult, setReadingResult] = useState<ReadingMaterial | null>(null);

  const handleParse = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      if (inputMode === 'WORD') {
        const words = await fetchWordDefinitions(trimmed);
        setDefinitions(words);
        setGrammarList([]);
        setReadingResult(null);

        // Store into LocalStorage daily search records
        const summary = words.map(w => `${w.word} (${w.meaning})`).join(', ');
        saveDailySearchRecord('WORD', trimmed, summary, words);
      } else if (inputMode === 'GRAMMAR') {
        const grammar = await fetchGrammarDetails(trimmed);
        setGrammarList(grammar);
        setDefinitions([]);
        setReadingResult(null);

        // Store into LocalStorage daily search records
        const summary = grammar.map(g => `${g.grammarPoint}: ${g.meaning}`).join(', ');
        saveDailySearchRecord('GRAMMAR', trimmed, summary, grammar);
      } else if (inputMode === 'READING') {
        const reading = await analyzeReadingText(trimmed);
        setReadingResult(reading);
        setDefinitions([]);
        setGrammarList([]);

        // Store into LocalStorage daily search records
        const summary = reading.title || trimmed.slice(0, 30);
        saveDailySearchRecord('READING', reading.title || '文章解析', summary, reading);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage('解析失敗，請確認網路連線或稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setInput('');
    setErrorMessage(null);
  };

  const todayCount = getTodayRecords().length;

  const placeholderText = inputMode === 'WORD'
    ? '輸入欲解析的日文單字（多個字請以換行或空格分隔，例如：約束 準備 複雑）...'
    : inputMode === 'GRAMMAR'
    ? '輸入欲解析的日文文法句型（例如：はずです、わけにはいかない、てたまらない）...'
    : '在此貼上日文文章、新聞或故事短文，系統將提供中文全文翻譯並萃取重點單字與文法...';

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#2B303A] font-sans antialiased selection:bg-[#4F6375]/20 flex flex-col justify-between">
      {/* Top Navbar: 3 Tabs Only (解析, 測驗, 收藏) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#E9ECEF]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <div 
            onClick={() => setMode(AppMode.PARSE)}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className="w-8 h-8 rounded-lg bg-[#2B303A] text-white flex items-center justify-center font-bold text-sm tracking-tighter">
              語
            </div>
            <h1 className="text-[17px] font-bold text-[#2B303A] tracking-tight">
              日本語ごご！
            </h1>
          </div>

          {/* Navigation Items (3 Tabs Only: 解析, 測驗, 收藏) */}
          <nav className="flex items-center gap-1">
            {[
              { id: AppMode.PARSE, label: '解析', icon: <ParseIcon /> },
              { id: AppMode.QUIZ, label: '測驗', icon: <QuizIcon /> },
              { id: AppMode.BOOKMARKS, label: '收藏', icon: <BookmarkIcon /> }
            ].map(tab => {
              const isActive = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMode(tab.id)}
                  className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98] ${
                    isActive
                      ? 'bg-[#2B303A] text-white shadow-xs'
                      : 'text-[#6C757D] hover:text-[#2B303A] hover:bg-[#F1F3F5]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full flex-1">
        <AnimatePresence mode="wait">
          {/* TAB 1: PARSE (字典三合一解析) */}
          {mode === AppMode.PARSE && (
            <motion.div
              key="parse"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="space-y-6"
            >
              {/* Input Card Container */}
              <div className="bg-white border border-[#E9ECEF] rounded-2xl p-5 sm:p-7 space-y-4 shadow-xs">
                {/* Mode Selector Segmented Control */}
                <div className="flex items-center justify-between gap-4">
                  <div className="inline-flex items-center p-1 bg-[#F1F3F5] rounded-xl">
                    {[
                      { id: 'WORD', label: '單字' },
                      { id: 'GRAMMAR', label: '文法' },
                      { id: 'READING', label: '文章' }
                    ].map(sub => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          setInputMode(sub.id as InputMode);
                          setErrorMessage(null);
                        }}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                          inputMode === sub.id
                            ? 'bg-white text-[#2B303A] shadow-xs'
                            : 'text-[#6C757D] hover:text-[#2B303A]'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>

                  <span className="text-xs text-[#6C757D] hidden xs:inline">
                    {inputMode === 'WORD' ? '假名標音、重音與對照例句' : inputMode === 'GRAMMAR' ? '接續變化規則與核心語意' : '全文翻譯與重點抽取'}
                  </span>
                </div>

                {/* Textarea */}
                <div className="relative">
                  <textarea
                    rows={inputMode === 'READING' ? 6 : 3}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={placeholderText}
                    className="w-full p-4 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl text-sm sm:text-base text-[#2B303A] placeholder-[#ADB5BD] outline-none focus:border-[#4F6375] focus:bg-white transition-all font-jp resize-none leading-relaxed"
                  />
                </div>

                {/* Error Notice */}
                {errorMessage && (
                  <p className="text-xs text-[#8B4848] font-medium">
                    {errorMessage}
                  </p>
                )}

                {/* Actions Bar */}
                <div className="flex items-center justify-between pt-1">
                  <div className="text-xs text-[#6C757D]">
                    {todayCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setMode(AppMode.QUIZ)}
                        className="hover:text-[#4F6375] hover:underline cursor-pointer"
                      >
                        今日已累計 {todayCount} 筆學習紀錄，前往測驗
                      </button>
                    ) : (
                      <span>解析成功將自動存入當日紀錄</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {input.trim() && (
                      <button
                        type="button"
                        onClick={handleClear}
                        disabled={loading}
                        className="px-4 py-2 rounded-xl text-sm text-[#6C757D] hover:text-[#2B303A] border border-[#E9ECEF] hover:bg-[#F8F9FA] transition-all cursor-pointer active:scale-[0.98]"
                      >
                        清除
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleParse}
                      disabled={loading || !input.trim()}
                      className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all cursor-pointer active:scale-[0.98] ${
                        loading || !input.trim()
                          ? 'bg-[#CED4DA] cursor-not-allowed'
                          : 'bg-[#4F6375] hover:bg-[#3D4F5F] hover:scale-[1.01] shadow-xs'
                      }`}
                    >
                      {loading ? '解析中...' : '開始解析'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Parsing Results Area */}
              {(definitions.length > 0 || grammarList.length > 0 || readingResult) && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E9ECEF]">
                    <h3 className="text-[17px] font-bold text-[#2B303A]">
                      解析結果
                    </h3>
                    <span className="text-xs text-[#6C757D]">
                      點擊星號可收藏；已同步存入當日紀錄
                    </span>
                  </div>

                  {/* Word Definitions Grid */}
                  {definitions.length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {definitions.map((item, idx) => (
                        <WordCard key={item.id || idx} data={item} />
                      ))}
                    </div>
                  )}

                  {/* Grammar Definitions Grid */}
                  {grammarList.length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {grammarList.map((item, idx) => (
                        <GrammarCard key={item.id || idx} data={item} />
                      ))}
                    </div>
                  )}

                  {/* Reading Article Result */}
                  {readingResult && (
                    <ReadingView material={readingResult} />
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 2: QUIZ (當日學習測驗專區，AI 即時針對性出題，零相依外部題庫) */}
          {mode === AppMode.QUIZ && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <Quiz onExit={() => setMode(AppMode.PARSE)} />
            </motion.div>
          )}

          {/* TAB 3: BOOKMARKS (單字與文法收藏庫) */}
          {mode === AppMode.BOOKMARKS && (
            <motion.div
              key="bookmarks"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <BookmarkView onStartQuizWithBookmarks={() => setMode(AppMode.QUIZ)} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E9ECEF] py-4 px-4 sm:px-6 bg-white/50 text-center text-xs text-[#6C757D]">
        <span>日本語ごご！ 極簡日文字典與當日學習測驗工具</span>
      </footer>
    </div>
  );
};

export default App;
