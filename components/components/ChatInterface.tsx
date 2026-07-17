import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileImage, 
  X, 
  Trash2, 
  Send, 
  Volume2, 
  CornerDownRight, 
  ArrowLeft, 
  Sparkles, 
  Calendar, 
  Speech,
  Camera,
  Layers,
  HelpCircle,
  Clock,
  Globe,
  Tag,
  AlertTriangle,
  Lightbulb,
  History,
  Menu as MenuIcon
} from 'lucide-react';
import { ChatMessage } from '../types';
import { getChatResponse, translateTravelPhoto } from '../services/geminiService';

interface ChatInterfaceProps {
  onBack: () => void;
  onXpUpdate: (amount: number) => void;
}

type ChatMode = 'TEXT' | 'VOICE' | 'SCAN';
type ScanType = 'MENU' | 'LABEL' | 'SIGN' | 'GENERAL';

const STORAGE_KEY = 'mk-nihongo-chat-history';

interface NormalizedCorrection {
  correctedJapanese: string;
  explanationChinese: string;
  explanationEnglish: string;
}

const getNormalizedCorrection = (correction: any): NormalizedCorrection | null => {
  if (!correction) return null;
  
  if (typeof correction === 'object') {
    return {
      correctedJapanese: correction.correctedJapanese || correction.correctedText || correction.japanese || '',
      explanationChinese: correction.explanationChinese || correction.explanation || correction.chinese || '',
      explanationEnglish: correction.explanationEnglish || correction.explanationEn || correction.english || ''
    };
  }
  
  if (typeof correction === 'string') {
    const trimmed = correction.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          return {
            correctedJapanese: parsed.correctedJapanese || parsed.correctedText || parsed.japanese || '',
            explanationChinese: parsed.explanationChinese || parsed.explanation || parsed.chinese || '',
            explanationEnglish: parsed.explanationEnglish || parsed.explanationEn || parsed.english || ''
          };
        }
      } catch (e) {
        // Plain string fallback
      }
    }
    
    // Fallback: If it's a plain string, use it as Chinese explanation and try to extract any Japanese
    return {
      correctedJapanese: '',
      explanationChinese: correction,
      explanationEnglish: ''
    };
  }
  
  return null;
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onBack, onXpUpdate }) => {
  // Initialize messages from localStorage or use default welcome message
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const savedMessages = localStorage.getItem(STORAGE_KEY);
      if (savedMessages) {
        return JSON.parse(savedMessages);
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
    
    return [{
      id: 'welcome',
      role: 'model',
      text: 'こんにちは！お元気ですか？何かおもしろい写真があれば、アップロードして一緒に日本語で話しましょう！輸入中文或英文也完全沒問題喔！',
      translation: '你好！你好嗎？如果有什麼有趣的照片，歡迎上傳上來，我們一起用日文聊聊吧！輸入中文或英文也完全沒問題喔！',
      translationEn: "Hello! How are you? If you have any interesting photos, feel free to upload them, and let's chat in Japanese together! Typing in Chinese or English is totally fine too!",
      timestamp: Date.now()
    }];
  });

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('TEXT');
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null); // For showing options menu
  const [replyMessage, setReplyMessage] = useState<ChatMessage | null>(null); // For context replying
  const [expandedCorrectionId, setExpandedCorrectionId] = useState<string | null>(null); // For showing the polishing suggestions dropdown
  
  // Image Upload States
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Travel Scan Mode States
  const [scanType, setScanType] = useState<ScanType>('MENU');
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [travelLogs, setTravelLogs] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('mk-nihongo-travel-logs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load travel logs from localStorage', e);
      return [];
    }
  });

  // Save travel logs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('mk-nihongo-travel-logs', JSON.stringify(travelLogs));
  }, [travelLogs]);

  const [historyFilter, setHistoryFilter] = useState<'ALL' | ScanType>('ALL');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const scanResultRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanFileInputRef = useRef<HTMLInputElement>(null);
  
  // Refs for speech logic to avoid stale closures
  const transcriptRef = useRef('');
  const isManualStop = useRef(false);
  const handleSendRef = useRef<any>(null);
  const trueIsListeningRef = useRef(false);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // Scroll to bottom whenever messages or states change
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (chatMode === 'TEXT') {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isListening, chatMode, replyMessage, isLoading]);

  useEffect(() => {
    if (scanResult && scanResultRef.current) {
      setTimeout(() => {
        scanResultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [scanResult]);

  // Run scroll to bottom once fully loaded
  useEffect(() => {
    setTimeout(scrollToBottom, 300);
  }, []);

  const handleSend = async (textOverride?: string, sourceMode: ChatMode = chatMode) => {
    let textToSend = textOverride !== undefined ? textOverride : inputText;
    const hasImage = !!selectedImage;

    // If there's an image but no text, supply a friendly Japanese prompt automatically
    if (!textToSend.trim() && hasImage) {
      textToSend = "この圖片について教えてください！";
    }

    if (!textToSend.trim() && !hasImage) return;

    // Stop listening safely if sending manually
    if (trueIsListeningRef.current) {
      try {
        recognitionRef.current?.stop();
      } catch (e) {}
      trueIsListeningRef.current = false;
      setIsListening(false);
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      image: selectedImage || undefined,
      timestamp: Date.now()
    };

    // Stash selected image
    const imagePayload = selectedImage;
    
    // Clear editing state instantly for snappy UI
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setSelectedImage(null);
    setReplyMessage(null);
    setIsLoading(true);

    try {
      // Pass reply context if available
      const replyContext = replyMessage ? replyMessage.text : undefined;
      const response = await getChatResponse(messages, textToSend, replyContext, imagePayload || undefined);
      
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.reply,
        translation: response.translation,
        translationEn: response.translationEn || undefined,
        correction: response.correction || undefined,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, aiMsg]);
      
      // Reward extra XP if they learned using an image!
      onXpUpdate(hasImage ? 15 : 8);
      
      // Auto play audio ONLY if in VOICE mode
      if (sourceMode === 'VOICE') {
        playAudio(response.reply);
      }

    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Keep ref updated
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  // Initialize Speech Recognition
  useEffect(() => {
    let recognition: any = null;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      try {
        recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        
        recognition.continuous = false; // Short-phrase responsive speech mode (transcribes & triggers submit on stop talking)
        recognition.lang = 'ja-JP'; 
        recognition.interimResults = true;

        recognition.onstart = () => {
          trueIsListeningRef.current = true;
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; ++i) {
            fullTranscript += event.results[i][0].transcript;
          }
          transcriptRef.current = fullTranscript;
          setInputText(fullTranscript);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech error occurred:", event);
          trueIsListeningRef.current = false;
          setIsListening(false);
          isManualStop.current = false;
        };

        recognition.onend = () => {
          trueIsListeningRef.current = false;
          setIsListening(false);
          const finalSpokenText = transcriptRef.current.trim();
          if (finalSpokenText) {
            handleSendRef.current(finalSpokenText, 'VOICE');
            transcriptRef.current = ''; // Clear out stream storage to prevent duplicate sends
          }
          isManualStop.current = false;
        };
      } catch (err) {
        console.error("Failed to construct SpeechRecognition:", err);
      }
    }
    
    return () => {
        if (recognition) {
          try {
            recognition.stop();
          } catch(e) {}
        }
        trueIsListeningRef.current = false;
        synthRef.current.cancel();
    }
  }, [chatMode]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("您的瀏覽器限制了麥克風，或當前 Preview Iframe 環境不支援語音辨識。請點選最右上角「用新分頁開啟」在獨立頁面中啟用麥克風，即可暢快進行對話！若暫時不便錄音，您可點選最上方「對話」文字分頁直接輸入！");
      return;
    }
    if (trueIsListeningRef.current) {
      isManualStop.current = true;
      try {
        recognitionRef.current.stop();
        trueIsListeningRef.current = false;
        setIsListening(false);
      } catch (e) {
        console.error("Error stopping recognition:", e);
        trueIsListeningRef.current = false;
        setIsListening(false);
      }
    } else {
      isManualStop.current = false;
      transcriptRef.current = '';
      setInputText('');
      try {
        recognitionRef.current.start();
        trueIsListeningRef.current = true;
        setIsListening(true);
      } catch (e) {
        console.error("Error starting recognition:", e);
        trueIsListeningRef.current = false;
        setIsListening(false);
        alert("無法開啟錄音。請前往瀏覽器網址列旁檢查並「允許麥克風權限」。若是安全框架限制，請按右上角「用新分頁開啟」以獲得完整的系統音訊權限！");
      }
    }
  };

  const playAudio = (text: string) => {
    synthRef.current.cancel(); // Stop historical voice
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.85; // Friendly rate for learner comprehension
    synthRef.current.speak(utterance);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setActiveMessageId(null);
  };

  const handleReply = (msg: ChatMessage) => {
    setReplyMessage(msg);
    setActiveMessageId(null);
    setChatMode('TEXT'); // Fallback to text for exact threading
  };

  const handleRegenerateUser = (text: string) => {
    setInputText(text);
    setActiveMessageId(null);
    setChatMode('TEXT');
  };

  const handleImageSelectClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      alert('圖片檔案大小需在 4MB 以內，以確保連線速度與辨識效能！');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setSelectedImage(result);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Let them select the same again if wanted
  };

  // Travel scanning handers
  const handleScanSelectClick = () => {
    scanFileInputRef.current?.click();
  };

  const handleScanFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      alert('圖片檔案大小需在 4MB 以內！');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64String = event.target?.result as string;
      setScanImage(base64String);
      setScanResult(null); // Reset previous scan result
      
      // Trigger API instantly for snappy user experience
      setIsLoading(true);
      try {
        const result = await translateTravelPhoto(base64String, scanType);
        setScanResult(result);
        
        // Save scan log to history list
        const newLog = {
          id: `travel-${Date.now()}`,
          timestamp: Date.now(),
          scanType,
          image: base64String,
          result
        };
        setTravelLogs(prev => [newLog, ...prev]);

        onXpUpdate(25); // Large XP rewards for practicing real-life photo translation!
      } catch (err) {
        console.error(err);
        alert('照片翻譯失敗，請確認該照片包含清晰的日文字體，並重新上傳。');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearChatHistory = () => {
    if (confirm('確定要清空所有的對話歷史紀錄嗎？清空後將無法復原。')) {
      const resetMsg: ChatMessage = {
        id: 'welcome',
        role: 'model',
        text: 'こんにちは！お元気ですか？何かおもしろい写真があれば、アップロードして一緒に日本語で話しましょう！輸入中文或英文也完全沒問題喔！',
        translation: '你好！你好嗎？如果有什麼有趣的照片，歡迎上傳上來，我們一起用日文聊聊吧！輸入中文或英文也完全沒問題喔！',
        translationEn: "Hello! How are you? If you have any interesting photos, feel free to upload them, and let's chat in Japanese together! Typing in Chinese or English is totally fine too!",
        timestamp: Date.now()
      };
      setMessages([resetMsg]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([resetMsg]));
    }
  };

  // Human date group organizer
  const formatDateGroup = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return '今天';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return '昨天';
    } else {
      return date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  };

  // Get last model message for Voice mode UI context
  const lastAiMessage = [...messages].reverse().find(m => m.role === 'model');

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-transparent overflow-hidden relative">
      {/* Hidden file uploaders */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      <input 
        type="file" 
        ref={scanFileInputRef}
        onChange={handleScanFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Header Panel */}
      <div className="bg-white border-b border-zinc-200 px-2.5 pt-3.5 pb-2.5 xs:pt-4 sm:p-3 flex items-center justify-between gap-2.5 sm:gap-4 z-10 sticky top-0 shadow-3xs">
        <div className="flex items-center shrink-0">
          <button 
            onClick={onBack} 
            className="p-2 sm:p-2.5 hover:bg-zinc-100 rounded-xl text-zinc-650 transition-colors shrink-0 flex items-center justify-center border border-zinc-150 shadow-4xs cursor-pointer active:scale-95"
            title="返回主頁"
          >
            <ArrowLeft size={18} className="stroke-[2.5]" />
          </button>
        </div>
        
        {/* Navigation Switch Tabs - Flexible container protecting from mobile text wrapping/overflow */}
        <div className="flex-1 flex items-center justify-end gap-1.5 sm:gap-3 max-w-[460px] min-w-0">
          <div className="flex bg-zinc-100/90 p-1 rounded-2xl border border-zinc-200/80 w-full min-w-0">
               <button 
                 onClick={() => {
                   setChatMode('TEXT');
                   synthRef.current.cancel();
                 }}
                 className={`flex-1 text-center py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all duration-200 cursor-pointer min-w-0 truncate select-none ${chatMode === 'TEXT' ? 'bg-white shadow-sm text-indigo-650' : 'text-zinc-500 hover:text-zinc-700'}`}
               >
                  對話聊天
               </button>
               <button 
                 onClick={() => {
                   setChatMode('VOICE');
                   setInputText('');
                 }}
                 className={`flex-1 text-center py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer min-w-0 select-none ${chatMode === 'VOICE' ? 'bg-white shadow-sm text-pink-650' : 'text-zinc-500 hover:text-zinc-700'}`}
               >
                  <Speech size={13} className="stroke-[2.5] shrink-0 hidden xs:block" /> 
                  <span className="truncate">語音發音</span>
               </button>
               <button 
                 onClick={() => {
                   setChatMode('SCAN');
                   synthRef.current.cancel();
                 }}
                 className={`flex-1 text-center py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer min-w-0 select-none ${chatMode === 'SCAN' ? 'bg-white shadow-sm text-amber-650' : 'text-zinc-500 hover:text-zinc-700'}`}
               >
                  <Camera size={13} className="stroke-[2.5] shrink-0 hidden xs:block" /> 
                  <span className="truncate">旅遊拍譯</span>
               </button>
          </div>

          {/* Clean Up Button (only in dialogue logs) */}
          {chatMode === 'TEXT' && messages.length > 1 && (
            <button
              onClick={clearChatHistory}
              className="p-2 sm:p-2.5 hover:bg-zinc-100 text-zinc-400 hover:text-red-500 rounded-xl transition-all border border-zinc-150 shrink-0 flex items-center justify-center cursor-pointer active:scale-95"
              title="清空歷史對話紀錄"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {chatMode === 'TEXT' ? (
        <>
          {/* Scrollable Chat Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 bg-zinc-50/60 transition-all duration-300 no-scrollbar"
            onClick={() => setActiveMessageId(null)}
          >
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const isActive = activeMessageId === msg.id;
              
              // Show Calendar divider if previous message is on a different day
              const showDateDivider = index === 0 || formatDateGroup(messages[index - 1].timestamp) !== formatDateGroup(msg.timestamp);

              return (
                <div key={msg.id} className="w-full">
                  {/* Calendar day partition */}
                  {showDateDivider && (
                    <div className="flex items-center justify-center my-5">
                      <div className="h-[1px] bg-zinc-200 flex-1" />
                      <span className="mx-3 text-[10px] font-black text-zinc-450 tracking-wider bg-zinc-200/80 rounded-lg px-2.5 py-1 flex items-center gap-1 shadow-3xs border border-zinc-200/50">
                        <Calendar size={11} />
                        {formatDateGroup(msg.timestamp)}
                      </span>
                      <div className="h-[1px] bg-zinc-200 flex-1" />
                    </div>
                  )}

                  <div className={`flex flex-col w-full ${isUser ? 'items-end' : 'items-start'}`}>
                    <div 
                      className={`flex max-w-[95%] sm:max-w-[85%] gap-2 sm:gap-2.5 items-start ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                      onClick={(e) => {
                          e.stopPropagation();
                          setActiveMessageId(isActive ? null : msg.id);
                      }}
                    >
                      {/* Humanized Avatar */}
                      <div className={`w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl flex-shrink-0 flex items-center justify-center text-[10px] sm:text-[11px] font-black shadow-3xs transition-transform hover:scale-105 select-none self-start ${
                        isUser 
                          ? 'bg-zinc-900 border border-zinc-800 text-white font-serif' 
                          : 'bg-white border border-zinc-200 text-zinc-805 font-sans'
                      }`}>
                        {isUser ? '我' : 'AI'}
                      </div>

                      <div className="flex flex-col gap-1 max-w-[calc(100%-2.25rem)]">
                        {/* Message Bubble Container */}
                        <div className={`p-3 sm:p-4 rounded-2xl text-[14px] sm:text-[15px] leading-relaxed relative group shadow-3xs select-text transition-all ${
                          isUser 
                            ? 'bg-zinc-900 border border-zinc-800 text-zinc-50 rounded-tr-none' 
                            : 'bg-white text-zinc-800 rounded-tl-none border border-zinc-150 shadow-3xs'
                        } ${isActive ? 'ring-2 ring-indigo-500/10 border-indigo-500/35 scale-[1.01]' : ''}`}>
                          
                          {/* Image render if visual model prompt includes image */}
                          {msg.image && (
                            <div className="relative rounded-xl overflow-hidden mb-2 max-w-xs border border-zinc-250/20">
                              <img 
                                src={msg.image} 
                                className="max-w-full max-h-52 object-cover rounded-xl"
                                alt="使用者上傳的照片" 
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}

                          <div className="flex items-start justify-between gap-2.5">
                            <span className="whitespace-pre-wrap block font-medium tracking-wide flex-1 break-words">
                              {msg.text}
                            </span>
                            
                            {/* Actions area inside bubble */}
                            {!isUser && (
                              <div className="flex flex-col gap-1.5 shrink-0 select-none">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    playAudio(msg.text);
                                  }}
                                  className="p-1 px-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-650 hover:text-indigo-600 rounded-lg shadow-4xs cursor-pointer active:scale-95 transition-all shrink-0 flex items-center gap-1 border border-zinc-200/50"
                                  title="播讀此句日音"
                                >
                                  <Volume2 size={12} className="stroke-[2.5]" />
                                  <span className="text-[10px] font-extrabold select-none">朗讀</span>
                                </button>

                                {msg.correction && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedCorrectionId(prev => prev === msg.id ? null : msg.id);
                                    }}
                                    className={`p-1 px-1.5 rounded-lg shadow-4xs cursor-pointer active:scale-95 transition-all shrink-0 flex items-center gap-1 border text-[10px] font-bold ${
                                      expandedCorrectionId === msg.id
                                        ? 'bg-amber-100 border-amber-300 text-amber-700'
                                        : 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-105'
                                    }`}
                                    title="查看日文潤色修飾建議"
                                  >
                                    <Lightbulb size={12} className={expandedCorrectionId === msg.id ? "fill-amber-400 stroke-amber-600" : "stroke-amber-500"} />
                                    <span className="select-none">潤飾</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Additional model meta explanations (Trilingual Cards!) */}
                        {!isUser && (
                          <div className="pl-1 space-y-1.5 mt-1 max-w-md">
                            {/* Grammar suggestion block */}
                            {msg.correction && (
                              <AnimatePresence>
                                {expandedCorrectionId === msg.id && (
                                  <motion.div 
                                    initial={{ opacity: 0, height: 0, margin: 0 }} 
                                    animate={{ opacity: 1, height: 'auto', margin: '4px 0' }}
                                    exit={{ opacity: 0, height: 0, margin: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="text-xs bg-amber-50/70 text-amber-900 p-3 rounded-xl border border-amber-200 shadow-4xs">
                                      <div className="flex items-center gap-1.5 mb-2 border-b border-amber-100 pb-1.5">
                                        <Lightbulb size={12} className="fill-amber-400 stroke-amber-600 animate-pulse shrink-0" />
                                        <span className="font-extrabold text-[10px] text-amber-650 tracking-wider uppercase">推薦正確日文 & 潤色建議 :</span>
                                      </div>
                                      
                                      {/* Only display Japanese (primary), plus Chinese and English explanations */}
                                      {(() => {
                                        const norm = getNormalizedCorrection(msg.correction);
                                        if (!norm) return null;
                                        return (
                                          <div className="space-y-2">
                                            {/* Corrected Japanese as primary */}
                                            {norm.correctedJapanese && (
                                              <div className="font-sans font-black text-[13px] sm:text-[14px] text-zinc-800 leading-normal pl-0.5 flex flex-wrap gap-1 items-start">
                                                <span className="text-amber-700 bg-amber-100 border border-amber-200 text-[9px] px-1.5 py-0.2 rounded font-black select-none tracking-tight mr-1 shrink-0 mt-0.5">日文主要</span>
                                                <span className="flex-1 select-text break-words tracking-wide">{norm.correctedJapanese}</span>
                                              </div>
                                            )}
                                            
                                            {/* Chinese & English Explanations */}
                                            <div className="space-y-1 pl-1">
                                              {norm.explanationChinese && (
                                                <div className="text-xs text-zinc-650 font-medium flex items-start gap-1.5">
                                                  <span className="text-amber-600 font-extrabold select-none text-[9px] shrink-0 mt-0.5">繁中：</span>
                                                  <p className="leading-relaxed flex-1 text-zinc-700 font-semibold">{norm.explanationChinese}</p>
                                                </div>
                                              )}
                                              {norm.explanationEnglish && (
                                                <div className="text-[11px] text-zinc-400 font-medium flex items-start gap-1.5">
                                                  <span className="text-zinc-400 font-extrabold select-none text-[9px] shrink-0 mt-0.5">EN：</span>
                                                  <p className="leading-relaxed italic flex-1 text-zinc-500">{norm.explanationEnglish}</p>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            )}

                            {/* Translations container */}
                            <div className="space-y-1">
                              {/* Chinese */}
                              {msg.translation && (
                                <div className="text-xs text-zinc-650 font-bold ml-1 flex items-start gap-1">
                                   <span className="bg-zinc-200 border border-zinc-300 text-zinc-600 text-[8px] px-1 py-0.2 rounded-xs select-none shrink-0 mt-0.5">繁中</span>
                                   <span className="leading-relaxed flex-1">{msg.translation}</span>
                                </div>
                              )}
                              
                              {/* English */}
                              {msg.translationEn && (
                                <div className="text-[11px] text-zinc-400 font-medium ml-1 flex items-start gap-1">
                                   <span className="bg-zinc-150 border border-zinc-200 text-zinc-500 text-[8px] px-1 py-0.2 rounded-xs select-none shrink-0 mt-0.5">EN</span>
                                   <span className="leading-relaxed italic flex-1">{msg.translationEn}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Minute indicator */}
                        <span className="text-[9px] text-zinc-400 font-mono mt-0.5 ml-1.5">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Expand option options menu */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div 
                          initial={{ opacity: 0, y: -4, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.96 }}
                          className={`mt-1.5 bg-white border border-zinc-200 rounded-xl shadow-md p-0.5 flex gap-0.5 z-20 ${isUser ? 'mr-10' : 'ml-10'}`}
                        >
                          <button 
                            onClick={() => handleReply(msg)}
                            className="px-2.5 py-1 text-[11px] font-black text-zinc-600 hover:bg-zinc-50 rounded-lg flex items-center gap-1"
                          >
                            <CornerDownRight size={11} />
                            回覆引言
                          </button>
                          
                          {isUser && (
                              <button 
                                  onClick={() => handleRegenerateUser(msg.text)}
                                  className="px-2.5 py-1 text-[11px] font-black text-zinc-600 hover:bg-zinc-50 rounded-lg flex items-center gap-1"
                              >
                                  修改再傳
                              </button>
                          )}

                          <button 
                            onClick={() => handleCopy(msg.text)}
                            className="px-2.5 py-1 text-[11px] font-black text-zinc-600 hover:bg-zinc-50 rounded-lg flex items-center gap-1"
                          >
                            複製內文
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}

            {/* AI thinking state indicator */}
            {isLoading && (
              <div className="flex justify-start pl-10">
                <div className="bg-white border border-zinc-250/50 rounded-2xl px-4 py-2.5 flex items-center space-x-1.5 shadow-3xs">
                  <span className="text-[11px] text-zinc-500 font-black flex items-center gap-1">
                    <Sparkles size={11} className="text-indigo-500 animate-spin" />
                    AI 老師正在思考與翻譯中
                  </span>
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          {/* Input & Upload Box */}
          <div className="bg-white border-t border-zinc-200 p-4 pb-28 sm:pb-28 md:pb-4 transition-all duration-350 shadow-sm relative shrink-0">
             
             {/* Dynamic selected image preview strip */}
             <AnimatePresence>
                {selectedImage && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: 10, height: 0 }}
                    className="relative inline-block mb-3 bg-zinc-100 rounded-2xl p-1.5 border border-zinc-200 group overflow-hidden"
                  >
                    <img 
                      src={selectedImage} 
                      className="w-24 h-24 object-cover rounded-xl border border-zinc-200" 
                      alt="準備發送之照片"
                      referrerPolicy="no-referrer"
                    />
                    <button 
                      onClick={() => setSelectedImage(null)}
                      className="absolute top-2.5 right-2.5 p-1 bg-black/65 hover:bg-black/85 text-white rounded-full transition-colors shadow-sm"
                      title="移除此圖片"
                    >
                      <X size={12} className="stroke-[2.5]" />
                    </button>
                    <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/55 backdrop-blur-xs text-center py-0.5 rounded-lg">
                      <span className="text-[8px] text-white font-sans font-black tracking-wider uppercase">已載入</span>
                    </div>
                  </motion.div>
                )}
             </AnimatePresence>

             {/* Threadded reply preview strip */}
             <AnimatePresence>
                {replyMessage && (
                   <motion.div 
                     initial={{ opacity: 0, height: 0 }}
                     animate={{ opacity: 1, height: 'auto' }}
                     exit={{ opacity: 0, height: 0 }}
                     className="flex justify-between items-center bg-zinc-50 border-l-3 border-indigo-600 rounded-lg p-2.5 mb-3 text-xs"
                   >
                      <div className="flex flex-col">
                         <span className="text-[9px] font-black text-indigo-600 uppercase">
                            正在回覆 {replyMessage.role === 'user' ? '自己' : 'AI 助教'} 的話語：
                         </span>
                         <span className="text-zinc-500 font-semibold truncate max-w-xs">{replyMessage.text}</span>
                      </div>
                      <button 
                         onClick={() => setReplyMessage(null)}
                         className="text-zinc-400 hover:text-zinc-650 p-1"
                      >
                         <X size={14} className="stroke-[2.5]" />
                      </button>
                   </motion.div>
                )}
             </AnimatePresence>

             {/* Input Row */}
             <div className="flex items-end gap-2 bg-zinc-50 rounded-2xl border border-zinc-200 p-1.5 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-500/60 transition-all">
                {/* Photo upload trigger */}
                <button
                  onClick={handleImageSelectClick}
                  className={`p-3 rounded-xl transition-all ${selectedImage ? 'bg-indigo-50 text-indigo-600' : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'}`}
                  title="上傳圖片或照片進行圖片式對話"
                >
                  <FileImage size={20} className="stroke-[2.2]" />
                </button>

                {/* Input textarea */}
                <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder={selectedImage ? "可以輸入對照片的日英語提問，或直接點發送！" : "輸入中文、日文、英文進行聊天..."}
                    className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-sm text-zinc-800 py-2.5 px-2 max-h-24 resize-none placeholder-zinc-400 leading-relaxed font-semibold outline-hidden focus:outline-hidden"
                    rows={1}
                    style={{ minHeight: '40px' }}
                />

                {/* Send trigger */}
                <button 
                    onClick={() => handleSend()}
                    disabled={(!inputText.trim() && !selectedImage) || isLoading}
                    className={`p-3 rounded-xl transition-all ${
                      (inputText.trim() || selectedImage) && !isLoading
                        ? 'bg-zinc-900 border border-zinc-800 text-white shadow-sm hover:bg-zinc-800 active:scale-95' 
                        : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                    }`}
                >
                  <Send size={16} className="stroke-[2.5]" />
                </button>
             </div>
          </div>
        </>
                 ) : chatMode === 'VOICE' ? (
        /* VOICE MODAL INTERFACES */
        <div className="flex-1 flex flex-col bg-zinc-50/60 overflow-hidden relative">
          
          {/* Scrollable voice chat history list so users see past dialogue immediately */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col justify-end no-scrollbar max-w-lg mx-auto w-full">
            {messages.length === 0 ? (
              <div className="text-center py-10 my-auto flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shadow-xs">
                  <Speech size={22} className="animate-pulse" />
                </div>
                <p className="text-zinc-500 font-extrabold text-sm font-sans tracking-wide">
                  雙向語音對話已開啟！
                </p>
                <p className="text-zinc-400 font-bold text-xs max-w-xs text-center leading-relaxed">
                  點擊下方麥克風，說出日語（亦可中英夾雜），AI 老師會辨識您的說話並用語音和您交流。
                </p>
              </div>
            ) : (
              <div className="space-y-4 w-full">
                {messages.slice(-4).map((msg, index) => {
                  const isUser = msg.role === 'user';
                  return (
                    <motion.div 
                      key={msg.id || index}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[9px] font-black leading-none text-zinc-400 uppercase tracking-widest">
                          {isUser ? '您說的內容' : 'AI 老師回覆'}
                        </span>
                      </div>
                      <div className={`p-4 rounded-2xl max-w-[88%] text-sm font-bold leading-relaxed shadow-xs border ${
                        isUser 
                          ? 'bg-zinc-900 border-zinc-800 text-white font-jp' 
                          : 'bg-white border-zinc-200 text-zinc-800 font-jp'
                      }`}>
                        <p>{msg.text}</p>
                        {!isUser && msg.translation && (
                          <p className="text-xs text-zinc-500 mt-2 pb-1.5 border-t border-zinc-100 pt-1.5 font-sans font-medium leading-normal">
                            {msg.translation}
                          </p>
                        )}
                        {!isUser && (
                          <button 
                            onClick={() => playAudio(msg.text)}
                            className="mt-2 flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors border border-indigo-100 active:scale-95 cursor-pointer select-none"
                          >
                            <Volume2 size={11} className="stroke-[2.5]" /> 再次語音撥放
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Real-time status transcription area (always stick above controller) */}
          <div className="px-4 py-1.5 border-t border-zinc-100 bg-white/40 backdrop-blur-xs flex flex-col items-center justify-center min-h-[76px] sm:min-h-[90px] relative z-10">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div 
                  key="loading-ai" 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-2"
                >
                  <span className="text-xs text-indigo-600 font-extrabold animate-pulse tracking-wider">AI 老師批改分析、生成下一句中...</span>
                  <div className="flex space-x-1.5 items-center">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </motion.div>
              ) : isListening ? (
                <motion.div 
                  key="capturing-voice" 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-2.5 w-full max-w-sm"
                >
                  <p className="text-indigo-600 font-extrabold text-sm sm:text-base text-center font-jp leading-relaxed max-w-xs truncate-2-lines px-4">
                    {inputText ? `「 ${inputText} 」` : '正在聽您說話中... 請說日文或中文'}
                  </p>
                  
                  {/* Dynamic clean sound wave bars */}
                  <div className="flex items-center gap-1 h-6">
                    <span className="w-1 bg-pink-500 rounded-full animate-bounce h-2" style={{ animationDelay: '0ms', animationDuration: '0.6s' }} />
                    <span className="w-1 bg-pink-500 rounded-full animate-bounce h-5" style={{ animationDelay: '100ms', animationDuration: '0.6s' }} />
                    <span className="w-1 bg-indigo-500 rounded-full animate-bounce h-6" style={{ animationDelay: '200ms', animationDuration: '0.6s' }} />
                    <span className="w-1 bg-indigo-500 rounded-full animate-bounce h-4" style={{ animationDelay: '300ms', animationDuration: '0.6s' }} />
                    <span className="w-1 bg-pink-500 rounded-full animate-bounce h-2" style={{ animationDelay: '400ms', animationDuration: '0.6s' }} />
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="idle-state" 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center p-2 text-center"
                >
                  <p className="text-zinc-400 font-bold text-xs max-w-xs leading-relaxed">
                    語音模式已準備就緒，您可以點選圓形按鈕開始
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Large bottom tap controls */}
          <div className="bg-white border-t border-zinc-150 p-4 sm:p-5 flex flex-col items-center justify-center space-y-2.5 sm:space-y-3.5 relative z-20 pb-28 sm:pb-28 md:pb-5 shrink-0">
            <div className="flex items-center justify-center gap-6">
              
              {/* Optional Reset / Clear spoken draft button if they want to cancel */}
              {inputText && !isLoading && !isListening && (
                <button
                  onClick={() => setInputText('')}
                  className="w-10 h-10 bg-zinc-100 hover:bg-zinc-200 text-zinc-500 rounded-full flex items-center justify-center transition-all shadow-xs border border-zinc-200 active:scale-90"
                  title="清除當前錄音內容"
                >
                  <X size={16} className="stroke-[2.5]" />
                </button>
              )}

              {/* Big central responsive microphone button */}
              <button 
                onClick={toggleListening}
                disabled={isLoading}
                className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
                    isLoading 
                        ? 'bg-zinc-100 cursor-wait scale-90 text-zinc-300 border border-zinc-250'
                        : isListening 
                        ? 'bg-red-500 text-white shadow-red-200 scale-105' 
                        : 'bg-zinc-600 text-white hover:bg-zinc-700 hover:shadow-xl hover:scale-105 active:scale-95'
                }`}
              >
                {isListening && (
                    <>
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-20 animate-ping" />
                        <span className="absolute inline-flex h-[125%] w-[125%] rounded-full bg-red-400 opacity-10 animate-pulse" />
                    </>
                )}

                {isLoading ? (
                    <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                        <div className="w-1.5 h-1.5 bg-zinc-405 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                ) : isListening ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 sm:w-7 sm:h-7">
                        <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 sm:w-7 sm:h-7">
                        <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                        <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                    </svg>
                )}
              </button>

              {/* Optional Manual Send if it didn't trigger automatically */}
              {inputText && !isLoading && !isListening && (
                <button
                  onClick={() => {
                    if (inputText.trim()) {
                      handleSendRef.current(inputText, 'VOICE');
                      setInputText('');
                    }
                  }}
                  className="w-10 h-10 bg-indigo-50 text-indigo-650 hover:bg-indigo-100 rounded-full flex items-center justify-center transition-all shadow-xs border border-indigo-100 active:scale-90"
                  title="立即發送目前錄音內容"
                >
                  <Send size={15} className="stroke-[2.5]" />
                </button>
              )}
            </div>
            
            <p className="text-zinc-400 font-extrabold tracking-widest text-[10px] sm:text-xs uppercase select-none">
                {isLoading ? 'AI 分析回答中...' : isListening ? '再次點擊可手動結束並發送' : '點擊麥克風說完話後，會自動辨識發送'}
            </p>
          </div>
        </div>
      ) : (
        /* TRAVEL CAMERA/PHOTO SCAN INTERFACES */
        <div className="flex-1 overflow-y-auto bg-zinc-50/60 p-4 sm:p-6 pb-28 md:pb-6 space-y-6 no-scrollbar">
            {/* Scan Type Selector Tabs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
               {[
                 { id: 'MENU', text: '菜單翻譯' },
                 { id: 'LABEL', text: '藥妝與包裝標籤' },
                 { id: 'SIGN', text: '路標與指路牌' },
                 { id: 'GENERAL', text: '拍照直譯' }
               ].map(tab => (
                 <button
                   key={tab.id}
                   onClick={() => setScanType(tab.id as ScanType)}
                   className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all outline-hidden cursor-pointer ${
                     scanType === tab.id 
                       ? 'bg-zinc-900 border-zinc-900 text-white font-extrabold shadow-sm' 
                       : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-500 font-bold'
                   }`}
                 >
                   <span className="text-xs tracking-tight">{tab.text}</span>
                 </button>
               ))}
            </div>

            {/* Upload Area */}
            {!scanImage && !isLoading && (
               <div 
                 onClick={handleScanSelectClick}
                 className="border-2 border-dashed border-zinc-300 hover:border-amber-500 bg-white rounded-2xl py-12 px-6 text-center cursor-pointer transition-all hover:scale-[1.005] shadow-xs active:scale-[0.99]"
               >
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100">
                     <Camera size={22} className="stroke-[2.2]" />
                  </div>
                  <h5 className="font-extrabold text-zinc-800 text-sm sm:text-base">上傳或拍攝照片</h5>
                  <p className="text-xs text-zinc-450 mt-1 leading-relaxed max-w-sm mx-auto">
                     支援 JPG、PNG、HEIC 等格式。AI 將自動辨識日文標牌、藥妝品名、菜單單價、成份警告，並為你翻譯與產出拼音！
                  </p>
                  <button className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors">
                     選取 / 拍攝相片
                  </button>
               </div>
            )}

            {/* Travel Scan History Logs Panel */}
            {!scanImage && !isLoading && travelLogs.length > 0 && (
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-3xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-zinc-100 font-sans">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-50 border border-amber-100 rounded-xl text-amber-600 shrink-0">
                      <History size={16} className="stroke-[2.2]" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-zinc-900 flex items-center gap-1.5">
                        歷史辨識與翻譯紀錄 (History)
                      </h4>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      if (confirm('確定要清空所有旅遊拍譯之歷史紀錄嗎？')) {
                        setTravelLogs([]);
                      }
                    }}
                    className="text-[10px] sm:text-xs font-black text-rose-500 bg-rose-50 hover:bg-rose-100 border border-rose-100 px-2.5 py-1 rounded-xl transition-all select-none cursor-pointer"
                  >
                    全部清空
                  </button>
                </div>

                {/* Filter list for different categories */}
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 pb-1">
                  {[
                    { id: 'ALL', text: '全部顯示' },
                    { id: 'MENU', text: '菜單' },
                    { id: 'LABEL', text: '商品標籤' },
                    { id: 'SIGN', text: '路標指路' },
                    { id: 'GENERAL', text: '拍照直譯' }
                  ].map(filterBtn => (
                    <button
                      key={filterBtn.id}
                      onClick={() => setHistoryFilter(filterBtn.id as any)}
                      className={`px-3 py-1.5 text-[10px] sm:text-xs font-extrabold rounded-lg border transition-all shrink-0 cursor-pointer ${
                        historyFilter === filterBtn.id
                          ? 'bg-amber-500 border-amber-500 text-white font-black shadow-sm'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
                      }`}
                    >
                      {filterBtn.text}
                      {filterBtn.id === 'ALL' ? (
                        <span className="ml-1 px-1.5 py-0.5 bg-white/20 text-white rounded-md text-[9px]">
                          {travelLogs.length}
                        </span>
                      ) : (
                        <span className="ml-1 px-1.5 py-0.5 bg-zinc-200 text-zinc-650 rounded-md text-[9px] font-sans">
                          {travelLogs.filter(log => log.scanType === filterBtn.id).length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Grid for past records list */}
                {(() => {
                  const filteredLogs = historyFilter === 'ALL' 
                    ? travelLogs 
                    : travelLogs.filter(log => log.scanType === historyFilter);

                  if (filteredLogs.length === 0) {
                    return (
                      <div className="py-8 text-center text-xs text-zinc-400 font-extrabold">
                        尚無此類型的翻譯歷史紀錄
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1 no-scrollbar">
                      {filteredLogs.map((log: any) => {
                        const scanTypeLabels: Record<string, string> = {
                          MENU: '菜單',
                          LABEL: '標籤',
                          SIGN: '路標',
                          GENERAL: '直譯'
                        };

                        const badgeColors: Record<string, string> = {
                          MENU: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                          LABEL: 'bg-sky-50 text-sky-700 border-sky-100',
                          SIGN: 'bg-purple-50 text-purple-700 border-purple-100',
                          GENERAL: 'bg-amber-50 text-amber-700 border-amber-100'
                        };

                        const formattedDate = new Date(log.timestamp).toLocaleString('zh-TW', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <div
                            key={log.id}
                            onClick={() => {
                              // Retrieve and show this log item instantly
                              setScanType(log.scanType);
                              setScanImage(log.image);
                              setScanResult(log.result);
                            }}
                            className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-amber-400 hover:bg-amber-50/10 cursor-pointer shadow-3xs transition-all duration-200 group relative"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Left image thumb */}
                              <div className="w-12 h-12 rounded-lg border border-zinc-200 overflow-hidden flex-shrink-0 relative bg-zinc-100">
                                <img
                                  src={log.image}
                                  className="w-full h-full object-cover"
                                  alt="辨識縮圖"
                                  referrerPolicy="no-referrer"
                                />
                              </div>

                              {/* Text details */}
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[8.5px] px-1.5 py-0.5 rounded border font-sans font-black leading-none ${badgeColors[log.scanType] || 'bg-zinc-100 text-zinc-650'}`}>
                                    {scanTypeLabels[log.scanType] || '語彙'}
                                  </span>
                                  <span className="text-[9px] text-zinc-400 font-mono font-bold">
                                    {formattedDate}
                                  </span>
                                </div>
                                <h5 className="font-extrabold text-[12px] sm:text-[13px] text-zinc-800 truncate leading-tight group-hover:text-amber-600 transition-colors">
                                  {log.result?.title || '未命名翻譯'}
                                </h5>
                                <p className="text-[10px] text-zinc-450 truncate font-semibold">
                                  {log.result?.translatedTextZh || '點擊載入查看詳細翻譯'}
                                </p>
                              </div>
                            </div>

                            {/* Delete single log button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('確定要刪除這筆歷史翻譯紀錄嗎？')) {
                                  setTravelLogs(prev => prev.filter(item => item.id !== log.id));
                                }
                              }}
                              className="p-1 px-1.5 hover:bg-rose-50 hover:text-rose-500 text-zinc-400 border border-transparent hover:border-rose-100 rounded-lg transition-all flex items-center justify-center cursor-pointer select-none"
                              title="刪除紀錄"
                            >
                              <Trash2 size={13} className="stroke-[2.2]" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Scanner Loading State */}
            {isLoading && (
              <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center shadow-xs">
                <div className="relative mx-auto w-16 h-16 mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-amber-50" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-amber-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-amber-500">
                    <Sparkles size={18} className="animate-pulse" />
                  </div>
                </div>
                <h5 className="font-extrabold text-zinc-800 text-sm sm:text-base">正在進行深度日語辨識與翻譯...</h5>
                <div className="mt-2 space-y-1.5 max-w-md mx-auto">
                  <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider animate-pulse">
                     [進行流程] 提取日文字體中 ➔ 生成拼音 ➔ 匹配中英備忘
                  </span>
                  <p className="text-xs text-zinc-450 leading-relaxed font-semibold">
                     這需要大約 3-7 秒，我們正在自動辨識成分（如豬肉、大豆、牛奶）、標價、日文片假名音讀，讓你在日本能流暢對答與採購！
                  </p>
                </div>
              </div>
            )}

            {/* Complete Scanner Result Screen */}
            {scanImage && (scanResult || isLoading) && (
              <div ref={scanResultRef} className="space-y-6">
                
                {/* Image overview card layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left uploaded image thumbnail */}
                  <div className="bg-white border border-zinc-200 rounded-2xl p-3 flex flex-col shadow-3xs">
                    <span className="text-[9px] font-black text-zinc-450 uppercase tracking-wider mb-2 select-none">上傳的照片來源 :</span>
                    <div className="relative rounded-xl overflow-hidden aspect-square border border-zinc-150">
                      <img src={scanImage} className="w-full h-full object-cover rounded-xl" alt="旅遊掃描圖" referrerPolicy="no-referrer" />
                      {isLoading && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center text-white">
                           <span className="text-xs font-black animate-pulse">正在掃描辨識中...</span>
                        </div>
                      )}
                    </div>
                    {!isLoading && (
                      <button 
                        onClick={() => {
                          setScanImage(null);
                          setScanResult(null);
                        }}
                        className="mt-3 w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <X size={12} className="stroke-[2.5]" /> 返回上傳頁 / 歷史紀錄
                      </button>
                    )}
                  </div>

                  {/* Right: AI Translated summaries */}
                  {scanResult && (
                    <div className="md:col-span-2 bg-white border border-zinc-200 rounded-2xl p-5 shadow-3xs space-y-4">
                      <div className="flex justify-between items-start flex-wrap gap-2 border-b border-zinc-100 pb-3">
                         <div>
                            <span className="bg-amber-100 text-amber-700 border border-amber-200 text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-md font-sans font-black uppercase">
                               辨識成功 • {scanType === 'MENU' ? '菜單' : scanType === 'LABEL' ? '標籤包裝' : scanType === 'SIGN' ? '路標指路' : '拍照翻譯'}
                            </span>
                            <h4 className="font-black text-zinc-900 text-base sm:text-lg mt-1">{scanResult.title}</h4>
                         </div>
                        <span className="text-[10px] text-zinc-400 font-mono font-bold">偵測語系: {scanResult.originalLanguage || '日語'}</span>
                      </div>

                      {scanResult.pronunciation && (
                        <div className="bg-zinc-50 rounded-xl px-3.5 py-2.5 border border-zinc-200/50 flex items-center justify-between">
                           <div>
                              <span className="text-[8px] font-black text-zinc-400 block uppercase">標題讀音 Pronunciation :</span>
                              <span className="text-sm font-black text-indigo-700 font-serif tracking-wide">{scanResult.pronunciation}</span>
                           </div>
                           <button 
                             onClick={() => playAudio(scanResult.title)}
                             className="p-2 hover:bg-indigo-50 hover:text-indigo-650 rounded-lg text-zinc-500 cursor-pointer transition-colors"
                             title="朗讀標題"
                           >
                             <Volume2 size={16} />
                           </button>
                        </div>
                      )}

                      <div className="space-y-2">
                        <div>
                          <span className="text-[9px] font-black text-zinc-400 block uppercase">中文翻譯大意 :</span>
                          <p className="text-xs text-zinc-700 font-bold leading-relaxed">{scanResult.translatedTextZh}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sub: Detailed Extracted Table Items Breakdown */}
                {scanResult && scanResult.detectedItems && (
                  <div className="bg-white border border-zinc-200 rounded-2xl shadow-3xs overflow-hidden">
                     <div className="bg-zinc-900 p-4 border-b border-zinc-800 text-white flex justify-between items-center flex-row gap-2">
                        <div>
                           <h5 className="font-extrabold text-sm flex items-center gap-1.5">逐項成分與句義拆解</h5>
                           <p className="text-[10px] text-zinc-400 mt-0.5 font-bold">可以點擊發音按鈕，撥放語音給日本店員聽喔！</p>
                        </div>
                        <span className="bg-white/10 text-white/90 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-sm shrink-0">偵測出 {scanResult.detectedItems.length} 件</span>
                     </div>

                     <div className="divide-y divide-zinc-100">
                        {scanResult.detectedItems.map((item: any, idx: number) => (
                           <div key={idx} className="p-4 hover:bg-zinc-50/30 transition-colors flex items-start gap-3.5 text-xs">
                              {/* Left Element: Counter & pronounce action */}
                              <div className="flex flex-col items-center gap-2 pt-0.5 shrink-0">
                                 <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-650 text-[10px] font-black flex items-center justify-center border border-zinc-200 select-none">
                                    {idx + 1}
                                 </span>
                                 <button
                                    onClick={() => playAudio(item.original)}
                                    className="p-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all shadow-3xs flex items-center justify-center cursor-pointer"
                                    title="讀出日語"
                                 >
                                    <Volume2 size={13} className="stroke-[2.5]" />
                                 </button>
                              </div>

                              {/* Right Content: Japanese word, translation, description */}
                              <div className="flex-1 min-w-0 space-y-1.5">
                                 <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                    <span className="font-black text-sm text-zinc-900 tracking-wide font-serif">
                                       {item.original}
                                    </span>
                                    <span className="text-indigo-600 font-extrabold text-[11px] bg-indigo-50 px-1.5 py-0.5 rounded select-none">
                                       {item.kana}
                                    </span>
                                    <span className="text-zinc-400 text-xs font-bold select-none mx-0.5">➔</span>
                                    <span className="text-zinc-905 font-extrabold text-sm text-zinc-800">
                                       {item.translationZh}
                                    </span>
                                 </div>

                                 {item.description && (
                                    <p className="text-zinc-500 font-medium text-[11px] leading-relaxed bg-zinc-50/50 p-2.5 rounded-xl border border-zinc-100/80">
                                       {item.description}
                                    </p>
                                 )}
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
                )}

                {/* Bottom: Useful travel tips and cultural hacks from photo */}
                {scanResult && scanResult.travelTips && (
                  <div className="bg-amber-50/70 rounded-2xl border border-amber-200/80 p-4 sm:p-5 shadow-3xs flex gap-3">
                     <div className="bg-amber-500 text-white rounded-xl p-2 h-max shrink-0 shadow-sm border border-amber-400">
                        <Lightbulb size={18} className="stroke-[2.2]" />
                     </div>
                     <div className="min-w-0 flex-1">
                        <h6 className="font-extrabold text-amber-900 text-xs sm:text-sm">貼心提醒 (Warm Advisories) :</h6>
                        {(() => {
                          const lines = scanResult.travelTips
                            .split('\n')
                            .map((line: string) => line.trim())
                            .filter(Boolean);

                          const hasListPrefix = lines.some((line: string) => 
                            line.startsWith('-') || 
                            line.startsWith('*') || 
                            line.startsWith('•') || 
                            /^\d+\./.test(line)
                          );

                          if (lines.length <= 1 && !hasListPrefix) {
                            return (
                              <p className="text-xs text-amber-800 mt-1.5 leading-relaxed font-semibold whitespace-pre-wrap">
                                {scanResult.travelTips}
                              </p>
                            );
                          }

                          return (
                            <ul className="mt-2.5 space-y-2">
                              {lines.map((line: string, idx: number) => {
                                let cleanLine = line;
                                let isNumbered = false;
                                let numberStr = '';

                                // Clean standard markers
                                if (line.startsWith('-') || line.startsWith('*') || line.startsWith('•')) {
                                  cleanLine = line.substring(1).trim();
                                } else {
                                  const match = line.match(/^(\d+)\.\s*(.*)/);
                                  if (match) {
                                    isNumbered = true;
                                    numberStr = match[1];
                                    cleanLine = match[2];
                                  }
                                }

                                return (
                                  <li key={idx} className="flex items-start gap-2 text-xs text-amber-800 font-semibold leading-relaxed">
                                    {isNumbered ? (
                                      <span className="text-[9px] bg-amber-200 text-amber-900 border border-amber-300 rounded-full w-4 h-4 flex items-center justify-center font-black shrink-0 mt-0.5">
                                        {numberStr}
                                      </span>
                                    ) : (
                                      <span className="text-amber-500 shrink-0 mt-1 select-none">
                                        •
                                      </span>
                                    )}
                                    <span className="flex-1 min-w-0 break-words">{cleanLine}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          );
                        })()}
                     </div>
                  </div>
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );
};
