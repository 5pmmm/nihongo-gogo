import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuizQuestion, WordDefinition, GrammarDefinition } from '../types';
import { generateDailyStudyQuiz, DailyStudyQuizItem } from '../services/geminiService';
import { getTodayRecords, DailySearchItem } from '../services/dailyRecordStorage';
import { getBookmarks } from '../services/bookmarkStorage';
import { saveQuizResult } from '../services/quizStorage';
import { Loader } from './Loader';

import {
  formatQuestionDisplay,
  stripCodeArtifacts,
  removeEmojis,
  parseListeningDialogue,
  cleanSpeakerDialogue,
  CleanDialogueLine,
  renderQuestionSentence,
} from '../utils/quizFormatter';

interface QuizProps {
  onExit?: () => void;
  sourceWords?: WordDefinition[];
  sourceGrammar?: GrammarDefinition[];
}

export const Quiz: React.FC<QuizProps> = ({ onExit }) => {
  // Lobby States
  const [dailyItems, setDailyItems] = useState<DailySearchItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customInput, setCustomInput] = useState<string>('');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Quiz States
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [selectedReviewIndex, setSelectedReviewIndex] = useState<number | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong'>('all');

  // Audio Playback for Listening & Reading
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [showScript, setShowScript] = useState<boolean>(false);
  const playSessionRef = useRef<number>(0);
  const articlePassagesRef = useRef<{ [key: string]: string }>({});

  // Load today's records on mount
  useEffect(() => {
    loadStudyRecords();
  }, []);

  const loadStudyRecords = () => {
    const today = getTodayRecords();
    setDailyItems(today);
    // By default, select all today's items
    setSelectedIds(new Set(today.map(item => item.id)));
  };

  const handleLoadBookmarks = () => {
    const bms = getBookmarks();
    if (bms.length === 0) {
      alert('收藏庫目前暫無項目。');
      return;
    }
    const converted: DailySearchItem[] = bms.map((bm) => ({
      id: `bm-${bm.id}`,
      date: '收藏庫',
      type: bm.type,
      term: bm.title,
      summary: (bm.data as any).meaning || '',
      timestamp: bm.savedAt,
      data: [bm.data as any]
    }));
    setDailyItems(converted);
    setSelectedIds(new Set(converted.map(c => c.id)));
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === dailyItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(dailyItems.map(item => item.id)));
    }
  };

  // Helper to clean option text
  const cleanOptionText = (text: string) => {
    if (!text) return '';
    return stripCodeArtifacts(text)
      .replace(/^[A-Da-d1-4][\.\、\s\)\:\-]\s*/, '')
      .replace(/[。\.\s]+$/, '')
      .trim();
  };

  // 閱讀題兜底短文生成器：若模型未返回文章或當日無文章紀錄，智能產生符合情境之 3~5 句日文短文
  const synthesizeReadingPassageFallback = (q: QuizQuestion): string => {
    const correctOpt = q.options && q.options[q.correctAnswerIndex] ? cleanOptionText(q.options[q.correctAnswerIndex]) : '';
    const questionText = q.question || '';

    if (questionText.includes('本') || questionText.includes('購入') || questionText.includes('買')) {
      return `先週、駅前の書店に立ち寄ったときのことだ。普段はあまり本を衝動買いすることはないのだが、棚に並んでいた一冊の本の表紙イラストに強く惹かれて、気がつけばレジでその本を購入していた。家に帰ってから読み始めると、中身も想像以上に面白く、本当に買ってよかったと満足している。`;
    }
    if (questionText.includes('アパート') || questionText.includes('部屋') || questionText.includes('家賃')) {
      return `最近、新しく引っ越したアパートがとても気に入っています。駅から近くて毎日の通勤が楽になっただけでなく、家賃も以前よりずっと安くなりました。周囲は緑が多くて静かな住宅街で、日当たりも良く快適に暮らしています。`;
    }
    if (questionText.includes('メール') || questionText.includes('連絡') || questionText.includes('会議')) {
      return `社内関係者の皆様へ：明日の午前10時より第2会議室にて定例ミーティングを行います。本日の打ち合わせで検討した資料の修正版を添付いたしましたので、各自ご確認の上ご参加くださいますようお願いいたします。`;
    }
    return `先日の出来事について述べます。ある日の午後、新しい体験をするために近くの施設を訪れました。そこで得られた最も印象的な結果は「${correctOpt || '予想以上の充実した成果'}」でした。周囲の人々もその点に共感しており、今後もこのような機会を大切にしていきたいと感じています。`;
  };

  // Generate Quiz
  const handleStartDailyQuiz = async () => {
    const chosenItems = dailyItems.filter(item => selectedIds.has(item.id));
    const trimmedCustom = customInput.trim();

    if (chosenItems.length === 0 && !trimmedCustom) {
      setErrorMessage('請至少勾選一個學習項目，或於自訂輸入框輸入單字、文法或日文文章。');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    // Save article passages for rescue
    const passages: { [key: string]: string } = {};
    chosenItems.forEach(item => {
      if (item.type === 'READING') {
        const c = (item.data as any)?.content || (typeof item.data === 'string' ? item.data : '');
        if (c) {
          passages[item.term] = c;
          passages['default'] = c;
        }
      }
    });

    try {
      const requestItems: DailyStudyQuizItem[] = chosenItems.map(item => {
        let content = '';
        if (item.type === 'READING') {
          content = (item.data as any)?.content || (typeof item.data === 'string' ? item.data : '');
        }
        return {
          type: item.type,
          term: item.term,
          summary: item.summary,
          content: content || undefined,
          detail: typeof item.data === 'object' ? JSON.stringify(item.data).slice(0, 400) : ''
        };
      });

      // 解析自訂輸入內容（單字、文法、日文文章）
      if (trimmedCustom) {
        // 若字數較長（大於 60 字）或包含多句日文句號，視為文章閱讀題材料
        if (trimmedCustom.length >= 60 || (trimmedCustom.includes('。') && trimmedCustom.split('。').length >= 3)) {
          passages['custom'] = trimmedCustom;
          passages['default'] = trimmedCustom;
          requestItems.push({
            type: 'READING',
            term: '自訂日文文章',
            summary: trimmedCustom.slice(0, 30) + '...',
            content: trimmedCustom
          });
        } else {
          // 拆分單字與文法（支援換行、頓號、逗號、分號）
          const tokens = trimmedCustom.split(/[\n,，、;；]+/).map(t => t.trim()).filter(Boolean);
          tokens.forEach(tok => {
            const isGrammar =
              tok.startsWith('〜') ||
              tok.startsWith('~') ||
              tok.includes('はず') ||
              tok.includes('わけ') ||
              tok.includes('てたまらない') ||
              tok.includes('ように') ||
              tok.includes('ている') ||
              tok.includes('なければ');
            requestItems.push({
              type: isGrammar ? 'GRAMMAR' : 'WORD',
              term: tok,
              summary: isGrammar ? '自訂文法句型' : '自訂學習單字'
            });
          });
        }
      }

      articlePassagesRef.current = passages;

      const generated = await generateDailyStudyQuiz(requestItems, questionCount);
      if (!generated || generated.length === 0) {
        throw new Error('未取得有效題目');
      }

      // 核心防護：修復文章題無文章之錯誤，若題幹缺失 context，自動以文章或智能情境短文救援
      const patched = generated.map(q => {
        const isReading =
          q.type === 'reading' ||
          q.subType === 'reading' ||
          Boolean(q.instruction && q.instruction.includes('文章を読んで')) ||
          Boolean(q.question && (q.question.includes('筆者') || q.question.includes('文章') || q.question.includes('本文')));

        if (isReading) {
          let ctx = q.context?.trim() || '';
          if (!ctx || ctx.length < 20) {
            ctx = passages['default'] || passages['custom'] || synthesizeReadingPassageFallback(q);
          }
          return { ...q, type: 'reading', subType: 'reading', context: ctx };
        }
        return q;
      });

      setQuestions(patched);
      setUserAnswers(new Array(patched.length).fill(null));
      setCurrentIndex(0);
      setIsFinished(false);
      setIsStarted(true);
    } catch (err: any) {
      console.error('Quiz generation failed:', err);
      setErrorMessage('測驗題目生成失敗，請確認網路連線或稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  const autoAdvanceTimerRef = useRef<any>(null);

  // Speech Synthesis for Listening Questions (嚴格男女聲純化，不念出「男」「女」標籤)
  const getJaVoices = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return { male: null, female: null };
    const voices = window.speechSynthesis.getVoices();
    const jaVoices = voices.filter(v => v.lang.startsWith('ja'));

    if (jaVoices.length === 0) return { male: null, female: null };

    const maleKeywords = ['neural2-c', 'neural2-d', 'wavenet-c', 'wavenet-d', 'keita', 'otoya', 'ichiro', 'male'];
    const femaleKeywords = ['neural2-a', 'neural2-b', 'wavenet-a', 'wavenet-b', 'nanami', 'kyoko', 'female', 'google'];

    let maleVoice = jaVoices.find(v => maleKeywords.some(k => v.name.toLowerCase().includes(k))) || jaVoices[0];
    let femaleVoice = jaVoices.find(v => femaleKeywords.some(k => v.name.toLowerCase().includes(k))) || jaVoices[0];

    return { male: maleVoice, female: femaleVoice };
  };

  const playListeningAudio = (currentQ: QuizQuestion) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    playSessionRef.current++;
    const currentSession = playSessionRef.current;

    setIsPlayingAudio(true);

    const { male, female } = getJaVoices();
    const dialogueTurns = parseListeningDialogue(currentQ);

    if (dialogueTurns.length === 0) {
      setIsPlayingAudio(false);
      return;
    }

    let turnIndex = 0;

    const speakNextTurn = () => {
      if (currentSession !== playSessionRef.current || turnIndex >= dialogueTurns.length) {
        setIsPlayingAudio(false);
        return;
      }

      const turn = dialogueTurns[turnIndex];
      const utterance = new SpeechSynthesisUtterance(turn.text);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.9;

      if (turn.gender === 'male') {
        if (male) utterance.voice = male;
        utterance.pitch = 0.82; // 男聲深沉音色
        utterance.volume = 1.0;
      } else {
        if (female) utterance.voice = female;
        utterance.pitch = 1.14; // 女聲自然音色
        utterance.volume = 0.95;
      }

      utterance.onend = () => {
        turnIndex++;
        setTimeout(speakNextTurn, 320);
      };

      utterance.onerror = () => {
        setIsPlayingAudio(false);
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNextTurn();
  };

  const stopListeningAudio = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    playSessionRef.current++;
    setIsPlayingAudio(false);
  };

  const playArticleSpeech = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    playSessionRef.current++;
    setIsPlayingAudio(true);
    const { female, male } = getJaVoices();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.9;
    if (female) utterance.voice = female;
    else if (male) utterance.voice = male;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    window.speechSynthesis.speak(utterance);
  };

  // Answer selection (直接記錄作答，加快順暢度，不在每題中途揭露答案或解析)
  const handleSelectOption = (optionIndex: number) => {
    stopListeningAudio();
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
    }

    const updated = [...userAnswers];
    updated[currentIndex] = optionIndex;
    setUserAnswers(updated);

    // 輕量微動態延遲 (~300ms) 自動平滑翻至下一題，維持極致流暢節奏
    autoAdvanceTimerRef.current = setTimeout(() => {
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex(prev => prev + 1);
        setShowScript(false);
      } else {
        finishQuiz(updated);
      }
    }, 300);
  };

  const handleNextQuestion = () => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    stopListeningAudio();
    setShowScript(false);
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      finishQuiz(userAnswers);
    }
  };

  const handlePrevQuestion = () => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    stopListeningAudio();
    setShowScript(false);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const finishQuiz = (finalAnswers: (number | null)[]) => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    stopListeningAudio();
    setIsFinished(true);
    const correctCount = finalAnswers.filter(
      (ans, idx) => ans === (questions[idx].correctAnswerIndex ?? questions[idx].answer ?? 0)
    ).length;
    saveQuizResult({
      date: new Date().toISOString().slice(0, 10),
      totalQuestions: questions.length,
      correctCount,
      scorePercentage: Math.round((correctCount / questions.length) * 100),
      testedTerms: dailyItems.filter(i => selectedIds.has(i.id)).map(i => i.term)
    });
  };

  const handleRestartLobby = () => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    stopListeningAudio();
    setIsStarted(false);
    setIsFinished(false);
    setQuestions([]);
    setCurrentIndex(0);
    setUserAnswers([]);
    setSelectedReviewIndex(null);
    loadStudyRecords();
  };

  // Current Question
  const currentQ = questions[currentIndex];
  const isOrdering = currentQ?.type === 'ordering' || currentQ?.subType === 'ordering' || Boolean(currentQ?.scrambleItems?.length);
  const isListening = currentQ?.type === 'listening' || currentQ?.subType === 'listening';
  const isReading = currentQ?.type === 'reading' || currentQ?.subType === 'reading';

  // ==========================================
  // VIEW 1: LOBBY (當日學習測驗設定與項目選擇)
  // ==========================================
  if (!isStarted) {
    return (
      <div className="w-full max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white border border-[#E9ECEF] rounded-2xl p-6 sm:p-7 space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#4F6375]/10 text-[#3D4F5F] text-xs font-medium mb-1.5">
                <span>AI 即時針對性出題</span>
              </div>
              <h2 className="text-[20px] font-bold text-[#2B303A] tracking-tight">
                當日學習測驗
              </h2>
            </div>
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="text-xs text-[#6C757D] hover:text-[#2B303A] px-3 py-1.5 rounded-lg border border-[#E9ECEF] hover:bg-[#F8F9FA] transition-all cursor-pointer active:scale-[0.98]"
              >
                返回解析
              </button>
            )}
          </div>
          <p className="text-sm text-[#6C757D] leading-relaxed">
            系統已自動讀取您今日查詢的單字、文法與文章。勾選欲測驗的項目，Gemini 將即時為您量身打造專屬測驗（含單字拆解題、拼音題、星號重組題與閱讀理解題）。
          </p>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="bg-white border border-[#E9ECEF] rounded-2xl p-10 text-center space-y-4 shadow-xs">
            <Loader message="AI 正在根據您選擇的學習項目生成針對性測驗..." />
            <p className="text-xs text-[#6C757D]">
              嚴格約束重組題唯一正解，正在建構題意接續...
            </p>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-4 bg-[#8B4848]/10 border border-[#8B4848]/20 rounded-xl text-sm text-[#8B4848]">
            {errorMessage}
          </div>
        )}

        {!loading && (
          <>
            {/* 自行輸入測驗內容方框 (玩家可自由輸入單字、文法或日文文章) */}
            <div className="bg-white border border-[#E9ECEF] rounded-2xl p-5 sm:p-6 space-y-3.5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E9ECEF]">
                <div>
                  <h3 className="text-base font-bold text-[#2B303A]">
                    自行輸入測驗內容
                  </h3>
                  <p className="text-xs text-[#6C757D] mt-0.5">
                    除選擇下方當日紀錄外，亦可直接輸入想測驗的單字、文法句型或貼上整篇日文文章
                  </p>
                </div>
                {customInput && (
                  <button
                    type="button"
                    onClick={() => setCustomInput('')}
                    className="text-xs text-[#6C757D] hover:text-[#2B303A] underline cursor-pointer"
                  >
                    清空輸入
                  </button>
                )}
              </div>

              <textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="在此貼上或輸入想測驗的內容：&#10;・單字（以頓號、逗號或換行分隔）：約束, 才能, 複雑, 表紙&#10;・文法句型：〜はずです, 〜わけにはいかない&#10;・或直接貼上一整段日文短文/新聞..."
                rows={4}
                className="w-full p-3.5 rounded-xl border border-[#CED4DA] focus:border-[#4F6375] focus:ring-1 focus:ring-[#4F6375] text-sm text-[#2B303A] font-jp bg-[#F8F9FA]/40 focus:bg-white transition-colors outline-hidden resize-y leading-relaxed"
              />

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="text-[11px] text-[#868E96]">快速填入範例：</span>
                <button
                  type="button"
                  onClick={() => setCustomInput('約束, 才能, 複雑, 表紙')}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-[#F1F3F5] text-[#495057] hover:bg-[#E9ECEF] transition-colors cursor-pointer"
                >
                  單字組
                </button>
                <button
                  type="button"
                  onClick={() => setCustomInput('〜はずです, 〜わけにはいかない')}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-[#F1F3F5] text-[#495057] hover:bg-[#E9ECEF] transition-colors cursor-pointer"
                >
                  文法句型
                </button>
                <button
                  type="button"
                  onClick={() => setCustomInput('先週、駅前の書店で本を購入しました。普段はあまり本を衝動買いすることはないのですが、表紙のイラストに強く惹かれて購入しました。家に帰って読んでみると、内容も非常に面白く満足しています。')}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-[#F1F3F5] text-[#495057] hover:bg-[#E9ECEF] transition-colors cursor-pointer"
                >
                  日文短文
                </button>
              </div>
            </div>

            {/* Items selection card */}
            <div className="bg-white border border-[#E9ECEF] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#E9ECEF]">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#2B303A]">
                    選擇學習項目
                  </h3>
                  <span className="text-xs text-[#6C757D] font-medium">
                    (已選 {selectedIds.size} / {dailyItems.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {dailyItems.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-xs text-[#4F6375] hover:text-[#3D4F5F] font-medium px-2.5 py-1 rounded hover:bg-[#F1F3F5] transition-colors cursor-pointer"
                    >
                      {selectedIds.size === dailyItems.length ? '全部取消' : '全選'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleLoadBookmarks}
                    className="text-xs text-[#6C757D] hover:text-[#2B303A] font-medium px-2.5 py-1 rounded hover:bg-[#F1F3F5] transition-colors cursor-pointer"
                  >
                    載入收藏
                  </button>
                </div>
              </div>

              {dailyItems.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-[#F1F3F5] text-[#6C757D] mx-auto flex items-center justify-center font-bold text-sm">
                    記
                  </div>
                  <p className="text-sm text-[#2B303A] font-medium">
                    今天尚未有查詢紀錄
                  </p>
                  <p className="text-xs text-[#6C757D] max-w-sm mx-auto leading-relaxed">
                    請先在【解析】分頁中查詢單字、文法或文章，系統會自動儲存到當日紀錄，也可以點擊上方「載入收藏」使用收藏庫題目進行測驗。
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {dailyItems.map(item => {
                    const isChecked = selectedIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleSelectId(item.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isChecked
                            ? 'bg-[#F8F9FA] border-[#4F6375]/50'
                            : 'bg-white border-[#E9ECEF] hover:border-[#CED4DA]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Checkbox */}
                          <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors shrink-0 ${
                            isChecked ? 'bg-[#4F6375] text-white' : 'border border-[#CED4DA] bg-white'
                          }`}>
                            {isChecked && (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>

                          {/* Term & Info */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                                item.type === 'WORD'
                                  ? 'bg-[#4F6375]/10 text-[#3D4F5F]'
                                  : item.type === 'GRAMMAR'
                                  ? 'bg-[#7A6856]/10 text-[#635343]'
                                  : 'bg-[#5A6959]/10 text-[#354334]'
                              }`}>
                                {item.type === 'WORD' ? '單字' : item.type === 'GRAMMAR' ? '文法' : '文章'}
                              </span>
                              <span className="text-sm font-bold text-[#2B303A] truncate font-jp">
                                {item.term}
                              </span>
                            </div>
                            {item.summary && (
                              <p className="text-xs text-[#6C757D] truncate mt-0.5">
                                {item.summary}
                              </p>
                            )}
                          </div>
                        </div>

                        <span className="text-[11px] text-[#ADB5BD] shrink-0">
                          {item.date}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quiz Configuration */}
            <div className="bg-white border border-[#E9ECEF] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <h3 className="text-base font-bold text-[#2B303A]">
                出題數量設定
              </h3>
              <div className="flex items-center gap-3">
                {[3, 5, 10, 15].map(count => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setQuestionCount(count)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer active:scale-[0.98] ${
                      questionCount === count
                        ? 'bg-[#2B303A] text-white shadow-xs'
                        : 'bg-[#F8F9FA] text-[#6C757D] border border-[#E9ECEF] hover:text-[#2B303A]'
                    }`}
                  >
                    {count} 題
                  </button>
                ))}
              </div>
            </div>

            {/* Start Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleStartDailyQuiz}
                disabled={selectedIds.size === 0 && !customInput.trim()}
                className={`w-full py-3.5 rounded-xl text-[17px] font-bold text-white transition-all cursor-pointer shadow-xs active:scale-[0.99] ${
                  selectedIds.size === 0 && !customInput.trim()
                    ? 'bg-[#CED4DA] cursor-not-allowed'
                    : 'bg-[#4F6375] hover:bg-[#3D4F5F]'
                }`}
              >
                {selectedIds.size > 0 && customInput.trim()
                  ? `生成針對性測驗 (結合當日紀錄與自訂內容 • 共 ${questionCount} 題)`
                  : customInput.trim()
                  ? `生成針對性測驗 (依自訂內容出題 • 共 ${questionCount} 題)`
                  : `生成針對性測驗 (共 ${questionCount} 題)`}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: QUIZ COMPLETED / RESULTS REVIEW
  // ==========================================
  if (isFinished) {
    const correctCount = userAnswers.filter((ans, idx) => ans === (questions[idx].correctAnswerIndex ?? questions[idx].answer ?? 0)).length;
    const scorePercent = Math.round((correctCount / questions.length) * 100);
    const wrongCount = questions.length - correctCount;

    const displayedQuestions = questions.map((q, idx) => ({ q, idx })).filter(({ q, idx }) => {
      if (reviewFilter === 'wrong') {
        const correctAns = q.correctAnswerIndex ?? q.answer ?? 0;
        return userAnswers[idx] !== correctAns;
      }
      return true;
    });

    return (
      <div className="w-full max-w-5xl mx-auto space-y-6">
        {/* Result Summary Card */}
        <div className="bg-white border border-[#E9ECEF] rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xs">
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#4F6375]/10 text-[#3D4F5F] text-xs font-bold">
            測驗完成
          </div>
          <h2 className="text-[20px] font-bold text-[#2B303A]">
            當日學習測驗成果
          </h2>
          <div className="flex items-center justify-center gap-6 py-2">
            <div>
              <div className="text-[20px] font-bold text-[#2B303A]">
                {correctCount} / {questions.length}
              </div>
              <div className="text-xs text-[#6C757D] mt-0.5">答對題數</div>
            </div>
            <div className="w-px h-8 bg-[#E9ECEF]" />
            <div>
              <div className="text-[20px] font-bold text-[#4F6375]">
                {scorePercent}%
              </div>
              <div className="text-xs text-[#6C757D] mt-0.5">正確率</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleRestartLobby}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#2B303A] text-white hover:bg-[#1E222A] transition-all cursor-pointer active:scale-[0.98] shadow-xs"
            >
              重新測驗或換題
            </button>
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border border-[#E9ECEF] text-[#6C757D] hover:text-[#2B303A] hover:bg-[#F8F9FA] transition-all cursor-pointer active:scale-[0.98]"
              >
                返回解析
              </button>
            )}
          </div>
        </div>

        {/* Review Filter Bar */}
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-bold text-[#2B303A]">
            測驗詳解與答案查閱
          </h3>
          <div className="flex items-center gap-1.5 p-1 bg-[#F1F3F5] rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setReviewFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                reviewFilter === 'all'
                  ? 'bg-white text-[#2B303A] shadow-2xs font-bold'
                  : 'text-[#6C757D] hover:text-[#2B303A]'
              }`}
            >
              全部題目 ({questions.length})
            </button>
            <button
              type="button"
              onClick={() => setReviewFilter('wrong')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                reviewFilter === 'wrong'
                  ? 'bg-white text-[#8B4848] shadow-2xs font-bold'
                  : 'text-[#6C757D] hover:text-[#8B4848]'
              }`}
            >
              僅看錯題 ({wrongCount})
            </button>
          </div>
        </div>

        {/* Questions Review List */}
        <div className="space-y-4">
          {displayedQuestions.map(({ q, idx }) => {
            const userAns = userAnswers[idx];
            const correctAns = q.correctAnswerIndex ?? q.answer ?? 0;
            const isCorrect = userAns === correctAns;
            const fq = formatQuestionDisplay({
              ...q,
              explanation: q.explanation,
              options: q.options,
            });
            const isReviewOrdering = fq.isOrdering;
            const isReviewListening = q.type === 'listening' || q.subType === 'listening';
            const isReviewReading = q.type === 'reading' || fq.subTypeLabel === '文章理解題';

            return (
              <div
                key={q.id || idx}
                className={`bg-white border rounded-2xl p-5 sm:p-7 transition-all space-y-4 shadow-xs ${
                  isCorrect ? 'border-[#E9ECEF]' : 'border-[#8B4848]/30 bg-[#8B4848]/2'
                }`}
              >
                {/* Header row: badge, subtype & instruction */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F3F5] pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                        isCorrect
                          ? 'bg-[#5A6959]/15 text-[#354334]'
                          : 'bg-[#8B4848]/15 text-[#8B4848]'
                      }`}
                    >
                      第 {idx + 1} 題 {isCorrect ? '✓ 答對' : '✗ 答錯'}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#4F6375]/10 text-[#3D4F5F]">
                      {fq.subTypeLabel}
                    </span>
                  </div>

                  {fq.instruction && (
                    <span className="text-xs text-[#6C757D]">
                      {fq.instruction}
                    </span>
                  )}
                </div>

                {/* Preceding context if present */}
                {fq.precedingContext && (
                  <div className="text-xs sm:text-sm text-[#495057] bg-[#F8F9FA] px-3.5 py-2 rounded-xl border border-[#E9ECEF] inline-block font-jp">
                    {fq.precedingContext}
                  </div>
                )}

                {/* Reading passage in review view */}
                {isReviewReading && q.context && (
                  <div className="p-4 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#4F6375]">文章閱讀本文：</span>
                      <button
                        type="button"
                        onClick={() => isPlayingAudio ? stopListeningAudio() : playArticleSpeech(q.context || '')}
                        className="text-xs text-[#4F6375] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        {isPlayingAudio ? '停止朗讀' : '朗讀短文'}
                      </button>
                    </div>
                    <p className="text-sm font-jp text-[#2B303A] leading-relaxed whitespace-pre-wrap select-text">
                      {stripCodeArtifacts(q.context)}
                    </p>
                  </div>
                )}

                {/* Question body */}
                {isReviewOrdering ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl text-[17px] font-bold text-[#2B303A] font-jp leading-relaxed">
                      {renderQuestionSentence(fq.mainQuestion)}
                    </div>

                    {fq.scrambleItems && fq.scrambleItems.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs text-[#6C757D] font-medium">排序單字碎片：</div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {fq.scrambleItems.map((item, sIdx) => (
                            <div
                              key={sIdx}
                              className="p-2.5 rounded-lg bg-white border border-[#CED4DA] text-center text-sm font-bold text-[#2B303A] font-jp"
                            >
                              <span className="text-xs text-[#6C757D] mr-1">{sIdx + 1}.</span>
                              <span>{cleanOptionText(item)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <h4 className="text-[17px] sm:text-[18px] font-bold text-[#2B303A] font-jp leading-relaxed">
                      {renderQuestionSentence(fq.mainQuestion)}
                    </h4>
                    {fq.translation && (
                      <p className="text-xs sm:text-sm text-[#6C757D]">{fq.translation}</p>
                    )}
                  </div>
                )}

                {/* Listening dialogue script in review view */}
                {isReviewListening && (
                  <div className="p-3.5 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl space-y-2 text-xs sm:text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#4F6375]">對話原文錄音逐字稿：</span>
                      <button
                        type="button"
                        onClick={() => isPlayingAudio ? stopListeningAudio() : playListeningAudio(q)}
                        className="text-xs text-[#4F6375] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        {isPlayingAudio ? '暫停播放' : '聆聽錄音'}
                      </button>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {parseListeningDialogue(q).map((turn, tIdx) => (
                        <div key={tIdx} className="flex items-start gap-2 font-jp">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0 mt-0.5 ${
                              turn.gender === 'male'
                                ? 'bg-[#4F6375]/15 text-[#3D4F5F]'
                                : 'bg-[#C28C7E]/20 text-[#8C5042]'
                            }`}
                          >
                            {turn.gender === 'male' ? '男' : '女'}
                          </span>
                          <span className="text-[#2B303A]">{turn.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4 Options Grid with user selection and correct answer */}
                <div className="space-y-2 pt-1">
                  {q.options.map((opt, optIdx) => {
                    const isChosen = userAns === optIdx;
                    const isCorrectOpt = optIdx === correctAns;

                    let optStyle = 'bg-white border-[#E9ECEF] text-[#6C757D]';
                    if (isCorrectOpt) {
                      optStyle = 'bg-[#5A6959]/15 border-[#5A6959] text-[#354334] font-bold';
                    } else if (isChosen && !isCorrectOpt) {
                      optStyle = 'bg-[#8B4848]/15 border-[#8B4848] text-[#8B4848] line-through';
                    }

                    return (
                      <div
                        key={optIdx}
                        className={`w-full p-3 rounded-xl border text-left text-xs sm:text-sm flex items-center justify-between font-jp transition-all ${optStyle}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-md bg-[#F1F3F5] text-[#495057] text-xs font-bold flex items-center justify-center shrink-0">
                            {optIdx + 1}
                          </span>
                          <span>{cleanOptionText(opt)}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isChosen && !isCorrectOpt && (
                            <span className="text-[11px] font-bold text-[#8B4848] px-2 py-0.5 rounded bg-white/80">
                              您的選擇
                            </span>
                          )}
                          {isCorrectOpt && (
                            <span className="text-[11px] font-bold text-[#354334] px-2 py-0.5 rounded bg-white/80">
                              正確答案
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Explanation Box */}
                <div className="p-4 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl space-y-1.5 text-xs sm:text-sm text-[#495057] leading-relaxed whitespace-pre-wrap">
                  <div className="font-bold text-[#2B303A] flex items-center gap-1.5">
                    <span>解析說明：</span>
                  </div>
                  <div>{stripCodeArtifacts(q.explanation)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: ACTIVE QUIZ RUNNER (答題流暢度與寬度版面優化)
  // ==========================================
  const userSelectedOption = userAnswers[currentIndex];
  const formattedQ = formatQuestionDisplay({
    ...currentQ,
    explanation: currentQ?.explanation,
    options: currentQ?.options,
  });

  // 判斷是否為閱讀理解題（文章題）
  const isReadingQuestion =
    formattedQ.subTypeLabel === '文章理解題' ||
    currentQ?.type === 'reading' ||
    currentQ?.subType === 'reading' ||
    Boolean(currentQ?.instruction && currentQ.instruction.includes('文章を読んで')) ||
    Boolean(currentQ?.question && (currentQ.question.includes('筆者') || currentQ.question.includes('文章') || currentQ.question.includes('本文')));

  // 取得閱讀文章本文（若題幹 context 為空，則自動以當日學習文章或智能情境短文救援，100% 保證有文章可讀）
  let readingPassage =
    currentQ?.context?.trim() || articlePassagesRef.current['default'] || articlePassagesRef.current['custom'] || '';
  if (isReadingQuestion && (!readingPassage || readingPassage.length < 20)) {
    readingPassage = synthesizeReadingPassageFallback(currentQ);
  }

  // 渲染標準題目作答卡片本體
  const renderQuestionCardBody = () => (
    <div className="bg-white border border-[#E9ECEF] rounded-2xl p-6 sm:p-8 space-y-5 shadow-xs">
      {/* ========================================================
          第一行：題目主體字句 (題目文字在第一行，字級清晰醒目，無多餘引導詞)
          ======================================================== */}
      {formattedQ.isOrdering ? (
        <div className="space-y-3">
          {formattedQ.precedingContext && (
            <div className="text-xs sm:text-sm text-[#495057] bg-[#F8F9FA] px-3.5 py-1.5 rounded-xl border border-[#E9ECEF] inline-block font-jp">
              {formattedQ.precedingContext}
            </div>
          )}
          <div className="p-4 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl text-[18px] sm:text-[20px] font-bold text-[#2B303A] font-jp tracking-wide leading-relaxed">
            {renderQuestionSentence(formattedQ.mainQuestion)}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {formattedQ.precedingContext && (
            <div className="text-xs sm:text-sm text-[#495057] bg-[#F8F9FA] px-3.5 py-1.5 rounded-xl border border-[#E9ECEF] inline-block font-jp">
              {formattedQ.precedingContext}
            </div>
          )}
          <h3 className="text-[18px] sm:text-[20px] font-bold text-[#2B303A] font-jp leading-relaxed">
            {renderQuestionSentence(formattedQ.mainQuestion)}
          </h3>
          {formattedQ.translation && (
            <p className="text-xs sm:text-sm text-[#6C757D]">
              {formattedQ.translation}
            </p>
          )}
        </div>
      )}

      {/* ========================================================
          第二行：題目類型描述 (第二行呈現，字級小一些，與題目主體徹底分開)
          ======================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F1F3F5]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] sm:text-xs font-semibold px-2.5 py-1 rounded-md bg-[#4F6375]/10 text-[#3D4F5F]">
            {formattedQ.subTypeLabel}
          </span>

          {formattedQ.instruction && (
            <div className="text-xs text-[#6C757D] font-normal flex items-center gap-1.5 pl-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#CED4DA] shrink-0" />
              <span>{formattedQ.instruction}</span>
            </div>
          )}
        </div>

        {formattedQ.readingGuide && (
          <span className="text-[11px] text-[#868E96] font-jp hidden sm:inline">
            {formattedQ.readingGuide}
          </span>
        )}
      </div>

      {/* 閱讀文章本文卡片（若為閱讀題且當前未進入左右雙欄時之全面兜底保障） */}
      {isReadingQuestion && readingPassage && (
        <div className="lg:hidden p-4 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-[#E9ECEF]">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#5A6959]/15 text-[#354334]">
              閱讀文章本文
            </span>
            <button
              type="button"
              onClick={() => isPlayingAudio ? stopListeningAudio() : playArticleSpeech(readingPassage)}
              className="text-xs text-[#4F6375] hover:text-[#3D4F5F] font-medium flex items-center gap-1 cursor-pointer"
            >
              朗讀文章
            </button>
          </div>
          <div className="text-sm font-jp text-[#2B303A] leading-relaxed whitespace-pre-wrap select-text">
            {stripCodeArtifacts(readingPassage)}
          </div>
        </div>
      )}

      {/* LISTENING QUESTION SECTION (純淨男女聲對話，不念「男」「女」標籤) */}
      {isListening && (
        <div className="p-4 bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#4F6375]">
              對話語音聆聽
            </span>
            <button
              type="button"
              onClick={() => setShowScript(!showScript)}
              className="text-xs text-[#6C757D] hover:text-[#2B303A] underline cursor-pointer"
            >
              {showScript ? '隱藏原文' : '查看對話原文'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => isPlayingAudio ? stopListeningAudio() : playListeningAudio(currentQ)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white transition-all cursor-pointer flex items-center gap-2 active:scale-[0.98] ${
                isPlayingAudio ? 'bg-[#8B4848]' : 'bg-[#4F6375] hover:bg-[#3D4F5F]'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                {isPlayingAudio ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                )}
              </svg>
              <span>{isPlayingAudio ? '停止播放' : '播放對話語音 (男女聲純淨對話)'}</span>
            </button>
          </div>

          {showScript && (
            <div className="p-3 bg-white border border-[#E9ECEF] rounded-lg text-xs sm:text-sm text-[#2B303A] whitespace-pre-wrap font-jp leading-relaxed">
              {parseListeningDialogue(currentQ).map((turn, tIdx) => (
                <div key={tIdx} className="py-0.5">
                  <span className="font-bold text-[#6C757D] mr-2">
                    {turn.gender === 'male' ? '男' : '女'}：
                  </span>
                  <span>{turn.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ORDERING (星號重組題) SECTION */}
      {formattedQ.isOrdering && formattedQ.scrambleItems && formattedQ.scrambleItems.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-xs text-[#6C757D] font-medium">
            待排序單字：
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {formattedQ.scrambleItems.map((item, sIdx) => (
              <div
                key={sIdx}
                className="p-2.5 rounded-lg bg-white border border-[#CED4DA] text-center text-sm font-bold text-[#2B303A] font-jp shadow-2xs"
              >
                <span className="text-xs text-[#6C757D] mr-1.5">{sIdx + 1}.</span>
                <span>{cleanOptionText(item)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 Options Grid (作答階段不洩漏正解與解析，加快流暢節奏) */}
      <div className="space-y-2.5 pt-2">
        {currentQ.options.map((opt, optIdx) => {
          const isChosen = userSelectedOption === optIdx;

          const btnStyle = isChosen
            ? 'bg-[#2B303A] border-[#2B303A] text-white font-bold shadow-xs'
            : 'bg-white border-[#E9ECEF] text-[#2B303A] hover:border-[#CED4DA] hover:bg-[#F8F9FA]';

          return (
            <button
              key={optIdx}
              type="button"
              onClick={() => handleSelectOption(optIdx)}
              className={`w-full p-3.5 sm:p-4 rounded-xl border text-left text-sm sm:text-base transition-all flex items-center justify-between cursor-pointer font-jp active:scale-[0.99] ${btnStyle}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center shrink-0 ${
                    isChosen ? 'bg-white/20 text-white' : 'bg-[#F1F3F5] text-[#495057]'
                  }`}
                >
                  {optIdx + 1}
                </span>
                <span>{cleanOptionText(opt)}</span>
              </div>

              {isChosen && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/20 text-white">
                  已選取
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Navigation & Controls Bar (作答流暢性：上一題、題號導航、下一題/交卷) */}
      <div className="flex items-center justify-between pt-4 border-t border-[#F1F3F5] gap-3">
        <button
          type="button"
          onClick={handlePrevQuestion}
          disabled={currentIndex === 0}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium border transition-all cursor-pointer shrink-0 ${
            currentIndex === 0
              ? 'opacity-40 cursor-not-allowed border-[#E9ECEF] text-[#ADB5BD]'
              : 'border-[#E9ECEF] text-[#495057] hover:bg-[#F8F9FA] active:scale-[0.98]'
          }`}
        >
          上一題
        </button>

        {/* Question Navigator Dots (寬裕間距，支援水平滾動，避免擠壓) */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-2 px-1 max-w-[280px] sm:max-w-md md:max-w-xl scrollbar-none">
          {questions.map((_, qIdx) => {
            const isCurrent = qIdx === currentIndex;
            const isAnswered = userAnswers[qIdx] !== null;
            return (
              <button
                key={qIdx}
                type="button"
                onClick={() => {
                  stopListeningAudio();
                  setShowScript(false);
                  setCurrentIndex(qIdx);
                }}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                  isCurrent
                    ? 'bg-[#2B303A] text-white ring-2 ring-[#2B303A]/20 scale-105 shadow-xs'
                    : isAnswered
                    ? 'bg-[#4F6375]/15 text-[#3D4F5F] font-semibold hover:bg-[#4F6375]/25'
                    : 'bg-[#F1F3F5] text-[#868E96] hover:bg-[#E9ECEF]'
                }`}
              >
                {qIdx + 1}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleNextQuestion}
          className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#2B303A] text-white hover:bg-[#1E222A] transition-all cursor-pointer active:scale-[0.98] shadow-xs flex items-center gap-1.5 shrink-0"
        >
          <span>{currentIndex + 1 < questions.length ? '下一題' : '交卷查看解析'}</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
    </div>
  );

  // 若為文章理解題，呈現左右分欄 (Desktop Side-by-Side Split View)，避免未出現文章的錯誤
  if (isReadingQuestion && readingPassage) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-6">
        {/* Top Header / Progress */}
        <div className="bg-white border border-[#E9ECEF] rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRestartLobby}
              className="text-xs text-[#6C757D] hover:text-[#2B303A] px-2.5 py-1 rounded border border-[#E9ECEF] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
            >
              結束測驗
            </button>
            <div className="text-sm font-bold text-[#2B303A]">
              題目 {currentIndex + 1} / {questions.length} (文章閱讀理解)
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-32 sm:w-48 bg-[#F1F3F5] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#4F6375] h-full transition-all duration-300 rounded-full"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* 雙欄響應式佈局：左側（或上方）為閱讀短文專區，右側為題目作答區 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* 左欄：專屬文章閱讀卡片 */}
          <div className="lg:col-span-6 bg-white border border-[#E9ECEF] rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs lg:sticky lg:top-20 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F3F5]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#5A6959]/15 text-[#354334]">
                  閱讀文章 (本文)
                </span>
                <span className="text-xs text-[#6C757D] hidden sm:inline">
                  請先詳讀本文後再於右側作答
                </span>
              </div>

              <button
                type="button"
                onClick={() => isPlayingAudio ? stopListeningAudio() : playArticleSpeech(readingPassage)}
                className="text-xs text-[#4F6375] hover:text-[#3D4F5F] font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-[#F1F3F5] transition-colors cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
                <span>{isPlayingAudio ? '停止朗讀' : '朗讀文章'}</span>
              </button>
            </div>

            {/* 日文文章全文 */}
            <div className="text-[16px] sm:text-[17px] font-jp text-[#2B303A] leading-[2.1] whitespace-pre-wrap select-text selection:bg-[#4F6375]/20">
              {stripCodeArtifacts(readingPassage)}
            </div>
          </div>

          {/* 右欄：題目與選項卡片 */}
          <div className="lg:col-span-6 space-y-6">
            {renderQuestionCardBody()}
          </div>
        </div>
      </div>
    );
  }

  // 標準題目（單字、拼音、文法、聽力、重組）寬幅佈局
  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Top Header / Progress */}
      <div className="bg-white border border-[#E9ECEF] rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRestartLobby}
            className="text-xs text-[#6C757D] hover:text-[#2B303A] px-2.5 py-1 rounded border border-[#E9ECEF] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
          >
            結束測驗
          </button>
          <div className="text-sm font-bold text-[#2B303A]">
            題目 {currentIndex + 1} / {questions.length}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-32 sm:w-48 bg-[#F1F3F5] h-2 rounded-full overflow-hidden">
          <div
            className="bg-[#4F6375] h-full transition-all duration-300 rounded-full"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Question Card */}
      {renderQuestionCardBody()}
    </div>
  );
};
