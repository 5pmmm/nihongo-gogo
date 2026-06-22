import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  ArrowLeft, 
  Send, 
  Compass, 
  MapPin, 
  Clock, 
  ShoppingBag, 
  Globe, 
  History, 
  BadgeHelp,
  Bus,
  Footprints,
  Train,
  Car,
  CookingPot,
  Coins,
  CheckCircle2,
  Trash2,
  Bookmark,
  Share2,
  ChevronRight,
  Calculator,
  Search,
  BookOpen,
  Info
} from 'lucide-react';
import { Button } from './Button';
import { Loader } from './Loader';
import { analyzeAssistantQuery, AssistantResponse, RouteMapData, CurrencyData, RecipeData, TransitStep } from '../services/geminiService';

interface AIAssistantProps {
  onBack: () => void;
  onXpUpdate?: (xp: number) => void;
}

const PRESET_QUERIES = [
  {
    icon: <Compass className="w-4 h-4 text-emerald-600" />,
    text: "台北車站搭捷運到台北101怎麼走？花費與時間？",
    category: "路線導航",
    tag: "ROUTE"
  },
  {
    icon: <CookingPot className="w-4 h-4 text-orange-600" />,
    text: "經典日式馬鈴薯燉肉詳細食譜，材料和步驟？",
    category: "料理开发",
    tag: "RECIPE"
  },
  {
    icon: <Coins className="w-4 h-4 text-amber-600" />,
    text: "1500美金換算成台幣是多少？近期的匯率大約落在哪？",
    category: "外匯換算",
    tag: "EXCHANGE_RATE"
  },
  {
    icon: <Globe className="w-4 h-4 text-blue-600" />,
    text: "為什麼日本的計程車車門都是自動開啟的？",
    category: "日常知識",
    tag: "GENERAL_KNOWLEDGE"
  },
  {
    icon: <BadgeHelp className="w-4 h-4 text-indigo-600" />,
    text: "如何從東京成田機場搭車到新宿最划算方便？",
    category: "交通指南",
    tag: "ROUTE"
  }
];

export const AIAssistant: React.FC<AIAssistantProps> = ({ onBack, onXpUpdate }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [historyList, setHistoryList] = useState<{ query: string; response: AssistantResponse; timestamp: number }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // Custom interactive state for Recipe Ingredients checklist
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  
  // Custom interactive state for Currency Realtime Calculator
  const [calcAmount, setCalcAmount] = useState<number>(100);

  // Auto scroll to response when loaded
  useEffect(() => {
    if (response) {
      // Clear ingredient checklist when loading new recipe
      setCheckedIngredients({});
      // Initialize converter calculation amount from incoming data
      if (response.currencyConverter) {
        setCalcAmount(response.currencyConverter.amount || 100);
      }
      setTimeout(() => {
        document.getElementById('analysis-result-box')?.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    }
  }, [response]);

  const handleSearch = async (textToSearch: string) => {
    if (!textToSearch.trim() || loading) return;
    setLoading(true);
    setQuery(textToSearch);
    try {
      const data = await analyzeAssistantQuery(textToSearch);
      setResponse(data);
      
      // Save to local in-memory history list
      setHistoryList(prev => [
        { query: textToSearch, response: data, timestamp: Date.now() },
        ...prev.filter(item => item.query !== textToSearch) // Deduplicate
      ]);

      // Fire XP reward callback! Giving user a nice 20XP bonus for interacting with their AI teacher
      if (onXpUpdate) {
        onXpUpdate(30); 
      }
    } catch (err) {
      console.error(err);
      alert('分析與搜尋失敗，請稍後再試！');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetClick = (presetText: string) => {
    handleSearch(presetText);
  };

  const toggleCheckIngredient = (ing: string) => {
    setCheckedIngredients(prev => ({
      ...prev,
      [ing]: !prev[ing]
    }));
  };

  const getTransitIcon = (mode: TransitStep['mode']) => {
    switch (mode) {
      case 'SUBWAY':
        return <Train className="w-5 h-5 text-emerald-600" />;
      case 'BUS':
        return <Bus className="w-5 h-5 text-sky-600" />;
      case 'TRAIN':
        return <Train className="w-5 h-5 text-indigo-600" />;
      case 'DRIVE':
        return <Car className="w-5 h-5 text-slate-700" />;
      case 'BICYCLE':
        return <span className="text-lg">🚲</span>;
      case 'FLIGHT':
        return <span className="text-lg">✈️</span>;
      default:
        return <Footprints className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTransitBadgeClass = (mode: TransitStep['mode']) => {
    switch (mode) {
      case 'SUBWAY': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'BUS': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'TRAIN': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'DRIVE': return 'bg-slate-50 text-slate-700 border-slate-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  // Custom formatted renderer instead of react-markdown for robustness and styling perfection
  const renderMarkdown = (text: string) => {
    if (!text) return null;

    const rawLines = text.split('\n');
    const nodes: React.ReactNode[] = [];
    
    let currentListType: 'ul' | 'ol' | null = null;
    let listItems: string[] = [];
    let listStartNum: number = 1;

    const flushList = (keyPrefix: string | number) => {
      if (!currentListType || listItems.length === 0) return;
      if (currentListType === 'ul') {
        nodes.push(
          <ul key={`ul-${keyPrefix}`} className="list-disc pl-5 my-1 text-gray-650 space-y-1">
            {listItems.map((item, idx) => (
              <li key={idx} className="leading-relaxed">{parseBold(item)}</li>
            ))}
          </ul>
        );
      } else if (currentListType === 'ol') {
        nodes.push(
          <ol key={`ol-${keyPrefix}`} start={listStartNum} className="list-decimal pl-5 my-1 text-gray-650 space-y-1">
            {listItems.map((item, idx) => (
              <li key={idx} className="leading-relaxed">{parseBold(item)}</li>
            ))}
          </ol>
        );
      }
      listItems = [];
      currentListType = null;
    };

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const trimmed = line.trim();

      // Check if bullet point
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = trimmed.substring(2).trim();
        if (currentListType !== 'ul') {
          flushList(i);
          currentListType = 'ul';
        }
        if (content) {
          listItems.push(content);
        }
        continue;
      }

      // Check if numbered point
      const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        const content = numMatch[2].trim();
        if (currentListType !== 'ol') {
          flushList(i);
          currentListType = 'ol';
          listStartNum = num;
        }
        if (content) {
          listItems.push(content);
        }
        continue;
      }

      // Not in a list, flush any active list buffer
      if (currentListType) {
        flushList(i);
      }

      // Check headers
      if (trimmed.startsWith('### ')) {
        const content = trimmed.substring(4).trim();
        if (content) {
          nodes.push(
            <h4 key={`h4-${i}`} className="text-base font-bold text-indigo-950 mt-4 mb-2 flex items-center gap-1.5 border-l-3 border-indigo-500 pl-2">
              {content}
            </h4>
          );
        }
        continue;
      }

      if (trimmed.startsWith('## ')) {
        const content = trimmed.substring(3).trim();
        if (content) {
          nodes.push(
            <h3 key={`h3-${i}`} className="text-lg font-black text-indigo-900 mt-5 mb-2.5 border-b pb-1.5 border-gray-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
              {content}
            </h3>
          );
        }
        continue;
      }

      if (trimmed.startsWith('# ')) {
        const content = trimmed.substring(2).trim();
        if (content) {
          nodes.push(
            <h2 key={`h2-${i}`} className="text-xl font-extrabold text-indigo-950 mt-6 mb-3">
              {content}
            </h2>
          );
        }
        continue;
      }

      // Skip empty line spacing entirely to comply with user's demand to avoid unnecessary spacing and \n\n
      if (trimmed === '') {
        continue;
      }

      // Regular paragraph line
      nodes.push(
        <p key={`p-${i}`} className="text-gray-650 font-normal leading-relaxed">
          {parseBold(line)}
        </p>
      );
    }

    if (currentListType) {
      flushList('end');
    }

    return (
      <div className="space-y-3.5 text-gray-700 leading-relaxed text-sm xs:text-base">
        {nodes}
      </div>
    );
  };

  const parseBold = (raw: string) => {
    const parts = raw.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="font-bold text-indigo-950 bg-indigo-50/50 px-1 rounded">{part}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 space-y-6">
        
        {/* Minimalist History Header Row */}
        {historyList.length > 0 && (
          <div className="flex justify-between items-center bg-gray-50/50 p-2 rounded-2xl border border-gray-100 mb-2">
            <span className="text-xs font-bold text-gray-500 pl-2">
              歷史解答紀錄 ({historyList.length})
            </span>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                showHistory ? 'bg-indigo-50 text-indigo-700' : 'bg-white hover:bg-gray-100 text-gray-600 shadow-xs border border-gray-150'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{showHistory ? '隱藏紀錄' : '查看紀錄'}</span>
            </button>
          </div>
        )}

        {/* Toggleable history drawer */}
        <AnimatePresence>
          {showHistory && historyList.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-white border-2 border-indigo-100/55 rounded-2xl p-4 overflow-hidden shadow-inner"
            >
              <h3 className="text-xs font-black text-indigo-900 mb-3 uppercase tracking-wider flex items-center gap-1">
                <History className="w-3.5 h-3.5" /> 本次對話解答紀錄
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto no-scrollbar">
                {historyList.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setResponse(item.response);
                      setQuery(item.query);
                      setShowHistory(false);
                    }}
                    className="p-2.5 rounded-xl border border-gray-100 hover:border-indigo-200 bg-gray-50/50 hover:bg-white text-left transition-all flex items-center gap-2.5 group cursor-pointer"
                  >
                    <span className="p-1 rounded bg-indigo-50 text-indigo-600 text-xs shrink-0 font-bold group-hover:scale-105 transition-transform">
                      {index + 1}
                    </span>
                    <span className="text-xs font-medium text-gray-700 truncate flex-1 group-hover:text-indigo-900 transition-colors">
                      {item.query}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Query Input Section */}
        <div className="bg-white rounded-3xl border border-gray-150 p-4 sm:p-5 shadow-xs relative overflow-hidden">
          <div className="flex flex-col gap-3">
            <textarea
              className="w-full min-h-[190px] sm:min-h-[220px] bg-slate-50/70 border border-slate-100 rounded-2xl pt-6 pb-4 px-5 text-gray-800 text-sm xs:text-base outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white focus:border-indigo-200 transition-all placeholder:text-gray-400/85 resize-none leading-relaxed"
              placeholder="輸入任何內容，AI 為您完整解析、問常識、問怎麼去、問食譜作作法、日幣多少或任何大小事..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleSearch(query);
                }
              }}
            />
            
            <div className="flex flex-col sm:flex-row items-center sm:justify-between px-1 gap-2.5 sm:gap-0 mt-1 sm:mt-0">
              <span className="text-[10px] text-gray-400 select-none hidden sm:inline-block">
                按住 <kbd className="font-mono bg-gray-150 px-1 py-0.5 rounded text-[9px]">Ctrl + Enter</kbd> 也可以快速送出
              </span>
              <div className="flex items-center justify-center sm:justify-end gap-3 w-full sm:w-auto">
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="px-3.5 py-1.5 text-xs text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl font-bold transition-all border border-rose-100 cursor-pointer shrink-0"
                  >
                    一鍵刪除
                  </button>
                )}
                 <Button
                  onClick={() => handleSearch(query)}
                  disabled={loading || !query.trim()}
                  className="shadow-md h-9 px-4 sm:px-6 text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 cursor-pointer rounded-xl w-24 sm:w-auto shrink-0"
                >
                  {loading ? '思考中...' : '送出'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Analysis result box */}
        <div id="analysis-result-box" className="pt-2">
          {loading ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-xs flex flex-col items-center justify-center space-y-6">
              <Loader />
              <div>
                <h3 className="text-base font-black text-gray-800">正在透過 AI 精密解析您所查詢的內容...</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  大師系統正在匯集全世界的常識、最新價格匯率、路線班表與實用知識，並整合 Traditional Chinese 的完美答案。
                </p>
              </div>
            </div>
          ) : response ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Stacked Full-Width Rectangular Layout */}
              <div className="flex flex-col gap-6">
                
                {/* Main Text Answers Card with Integrated Query Header */}
                <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6">
                  <div className="border-b border-gray-100 pb-4 mb-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="px-2 py-0.5 text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200/50 rounded uppercase tracking-wider">
                        {response.detectedType === 'ROUTE' ? '路線規劃' : response.detectedType === 'RECIPE' ? '料理食譜' : response.detectedType === 'EXCHANGE_RATE' ? '匯率換算' : '日常解答'}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold">• 剛剛已更新</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                      「{query}」的精確解析報告
                    </h3>
                  </div>

                  <div>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-3">
                      <Sparkles className="w-3 h-3 fill-indigo-100" /> AI 知識解答
                    </span>
                    
                    {renderMarkdown(response.textAnswer)}
                  </div>

                  {/* Sources Grounding List */}
                  {response.sources && response.sources.length > 0 && (
                    <div className="border-t border-slate-100 pt-5">
                      <h4 className="text-xs font-black text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-1">
                        <Globe className="w-4 h-4 text-sky-500" /> 資料與背景來源 (文獻索引)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {response.sources.map((src, i) => (
                          <a
                            key={i}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-sky-200 hover:bg-sky-50/20 transition-all flex items-center gap-3 group"
                          >
                            <span className="w-6 h-6 rounded-lg bg-white border border-slate-200/60 shadow-xs flex items-center justify-center text-xs shrink-0 text-gray-400 group-hover:bg-sky-50 group-hover:text-sky-600 font-extrabold transition-colors">
                              {i + 1}
                            </span>
                            <div className="truncate flex-1">
                              <span className="text-xs font-bold text-gray-800 block truncate group-hover:text-indigo-900">{src.title}</span>
                              <span className="text-[9px] text-gray-400 truncate block font-mono">{src.url}</span>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-600 transition-colors" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ROUTE WIDGET: 完整路線圖 */}
                {response.detectedType === 'ROUTE' && response.routeMap && (
                  <motion.div
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs overflow-hidden relative"
                  >
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-slate-900 pointer-events-none">
                      <Compass className="w-40 h-40" />
                    </div>

                    <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-gray-900">AI 精密路線圖</h3>
                          <p className="text-[10px] text-gray-400">Transit Schematic Representation</p>
                        </div>
                      </div>
                    </div>

                    {/* Header Summary */}
                    <div className="bg-slate-50 border border-slate-100/50 rounded-2xl p-3.5 mb-4 grid grid-cols-2 gap-4 text-center">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">預估總歷時</span>
                        <span className="text-sm sm:text-base font-black text-gray-800">{response.routeMap.totalDuration}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">預估耗花費</span>
                        <span className="text-sm sm:text-base font-black text-indigo-600">{response.routeMap.totalCost || '計算中'}</span>
                      </div>
                    </div>

                    {/* Interactive Route Track */}
                    <div className="relative pl-1">
                      {/* Vertical line connector */}
                      <div className="absolute left-[19px] top-4 bottom-4 w-0.5 border-l-2 border-dashed border-gray-200" />

                      {/* Start point */}
                      <div className="flex gap-4.5 items-start mb-4.5 relative z-10">
                        <div className="w-10 h-10 rounded-full bg-emerald-600 text-white shadow-sm flex items-center justify-center font-bold text-xs shrink-0 ring-4 ring-emerald-50">
                          起
                        </div>
                        <div className="pt-1.5">
                          <p className="text-xs text-gray-400 font-bold block">出發點</p>
                          <h4 className="text-sm font-black text-slate-800">{response.routeMap.startPoint}</h4>
                        </div>
                      </div>

                      {/* Middle steps loop */}
                      {response.routeMap.steps.map((step, idx) => (
                        <div key={idx} className="flex gap-4.5 items-start mb-4.5 relative z-10">
                          {/* Transit icon badge */}
                          <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 shadow-xs flex items-center justify-center shrink-0 ring-4 ring-slate-50 transition-transform hover:scale-105">
                            {getTransitIcon(step.mode)}
                          </div>
                          <div className="bg-slate-50/50 hover:bg-slate-50 rounded-2xl p-3.5 border border-gray-100 flex-1 transition-all">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${getTransitBadgeClass(step.mode)}`}>
                                {step.mode}
                              </span>
                              <span className="text-xs text-gray-400 font-mono font-black">{step.duration}</span>
                              {step.cost && <span className="text-xs text-indigo-600 font-black">({step.cost})</span>}
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-gray-700 leading-relaxed">{step.instruction}</p>

                            {/* Intermediary stops drawer */}
                            {step.stops && step.stops.length > 0 && (
                              <div className="mt-2 pl-3 border-l-2 border-slate-250 py-0.5 space-y-1">
                                <p className="text-[10px] font-bold text-gray-450 uppercase tracking-wider flex items-center gap-1">
                                  <span className="w-1 h-1 bg-indigo-400 rounded-full" />
                                  行經 {step.stops.length} 個站點:
                                </p>
                                <p className="text-xs text-gray-500 font-semibold leading-relaxed">
                                  {step.stops.join(' → ')}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* End point */}
                      <div className="flex gap-4.5 items-start relative z-10">
                        <div className="w-10 h-10 rounded-full bg-indigo-950 text-indigo-50 shadow-sm flex items-center justify-center font-bold text-xs shrink-0 ring-4 ring-indigo-50">
                          終
                        </div>
                        <div className="pt-1.5">
                          <p className="text-xs text-gray-400 font-bold block">目的地</p>
                          <h4 className="text-sm font-black text-slate-800">{response.routeMap.endPoint}</h4>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}

                {/* RECIPE WIDGET: 互動食譜卡 */}
                {response.detectedType === 'RECIPE' && response.recipeDetail && (
                  <motion.div
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs overflow-hidden"
                  >
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
                          <CookingPot className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-gray-900">大師烹飪食譜助手</h3>
                          <p className="text-[10px] text-gray-400">Interactive Recipe Assistant</p>
                        </div>
                      </div>
                    </div>

                    {/* Summary Row */}
                    <div className="grid grid-cols-3 gap-2 text-center bg-orange-50/30 rounded-2xl p-3 border border-orange-50 mb-5">
                      <div className="border-r border-orange-150/40">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">經典名菜</span>
                        <span className="text-xs font-black text-slate-850 truncate block mt-0.5">{response.recipeDetail.dishName}</span>
                      </div>
                      <div className="border-r border-orange-150/40">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">預估時間</span>
                        <span className="text-xs font-black text-slate-850 block mt-0.5">{response.recipeDetail.prepTime}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">料理難度</span>
                        <span className="text-xs font-black text-orange-600 block mt-0.5">{response.recipeDetail.difficulty}</span>
                      </div>
                    </div>

                    {/* Ingredients list with user checklist functionality! */}
                    <div className="mb-5">
                      <h4 className="text-xs font-black text-gray-400 mb-2.5 uppercase tracking-wider flex items-center justify-between">
                        <span>食材準備清單 (點擊可打勾標記備料)</span>
                        <span className="text-[9px] font-mono text-orange-600 bg-white border border-orange-100 px-1.5 py-0.5 rounded">
                          {Object.values(checkedIngredients).filter(Boolean).length} / {response.recipeDetail.ingredients.length} 已備
                        </span>
                      </h4>
                      <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {response.recipeDetail.ingredients.map((ing, i) => {
                          const isChecked = !!checkedIngredients[ing];
                          return (
                            <div
                              key={i}
                              onClick={() => toggleCheckIngredient(ing)}
                              className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-between select-none ${
                                isChecked 
                                  ? 'bg-orange-50/50 border-orange-150 text-orange-850 line-through' 
                                  : 'bg-white border-gray-150 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span className="truncate pr-1">{ing}</span>
                              {isChecked ? (
                                <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-1.5 border-gray-300 bg-white shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Numbered instruction steps */}
                    <div>
                      <h4 className="text-xs font-black text-gray-400 mb-3.5 uppercase tracking-wider">料理製作步驟：</h4>
                      <div className="space-y-3.5">
                        {response.recipeDetail.instructions.map((stepStr, idx) => (
                          <div key={idx} className="flex gap-3 items-start">
                            <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 border border-orange-200">
                              {idx + 1}
                            </span>
                            <p className="text-xs sm:text-sm text-gray-700 font-semibold leading-relaxed">
                              {stepStr}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                  </motion.div>
                )}

                {/* EXCHANGE_RATE WIDGET: 匯率與價格轉換器 */}
                {response.detectedType === 'EXCHANGE_RATE' && response.currencyConverter && (
                  <motion.div
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs overflow-hidden"
                  >
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                          <Calculator className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-gray-900">即時匯率極速換算器</h3>
                          <p className="text-[10px] text-gray-400">Dynamic Currency Rate Converter</p>
                        </div>
                      </div>
                    </div>

                    {/* Header rate metrics */}
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center mb-5">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">基準換算匯率</span>
                      <div className="flex items-center justify-center gap-2 mt-1.5">
                        <span className="text-sm font-black text-slate-800">1 {response.currencyConverter.fromUnit}</span>
                        <span className="text-xs text-gray-400">≈</span>
                        <span className="text-base font-black text-amber-600">{response.currencyConverter.rate} {response.currencyConverter.toUnit}</span>
                      </div>
                      <p className="text-[9px] text-slate-450 mt-1">※ 此匯率為 AI 網路即時偵測之估值，請以金融機構實質匯率為準</p>
                    </div>

                    {/* Interactive Custom calculation box */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">輸入您想換算的金額：</h4>
                      
                      {/* Direct Amount input */}
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-black text-gray-500 block mb-1">
                            原始幣別 ({response.currencyConverter.fromUnit})
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={calcAmount}
                              onChange={(e) => setCalcAmount(parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-150 rounded-2xl py-3 px-4 outline-none font-mono font-black text-base transition-all focus:ring-2 focus:ring-amber-250 text-slate-850"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-xs text-gray-400">
                              {response.currencyConverter.fromUnit}
                            </span>
                          </div>
                        </div>

                        {/* Quick slider adjustments */}
                        <div className="px-1">
                          <input
                            type="range"
                            min="1"
                            max={response.currencyConverter.amount * 5 || 2000}
                            value={calcAmount}
                            onChange={(e) => setCalcAmount(parseInt(e.target.value, 10) || 1)}
                            className="w-full accent-amber-500 cursor-pointer h-1 bg-gray-200 rounded-lg appearance-none"
                          />
                          <div className="flex justify-between text-[9px] font-mono text-gray-400 mt-1">
                            <span>1</span>
                            <span>{Math.round(response.currencyConverter.amount * 2.5)}</span>
                            <span>{Math.round(response.currencyConverter.amount * 5 || 2000)}</span>
                          </div>
                        </div>

                        {/* Result card */}
                        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 text-center mt-4">
                          <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest block">目標額度換算結果</span>
                          <p className="text-2xl font-black text-amber-950 font-mono mt-1 mb-0.5">
                            {(calcAmount * response.currencyConverter.rate).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </p>
                          <p className="text-[10px] text-amber-700/80 font-bold uppercase tracking-wider">
                            {response.currencyConverter.toUnit} (幣)
                          </p>
                        </div>
                      </div>
                    </div>

                  </motion.div>
                )}

                {/* Universal AI Summary / Tips banner at the very bottom */}
                <motion.div
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-indigo-50/40 rounded-3xl border border-indigo-100 p-5 shadow-xs space-y-3"
                >
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-indigo-600" /> AI 貼心提醒 / 小貼士
                  </h4>
                  <div className="p-3.5 text-xs text-gray-600 font-medium leading-relaxed bg-white/60 border border-gray-100 rounded-2xl">
                    <strong>小貼士：</strong>您可直接利用滑鼠選取或手指觸控選取上方任何文字進行手工複製。若有任何進一步的疑問，歡迎直接在最上方的提問框中輸入後續問題（例如「這道菜可以做成不辣的嗎？」或「附近有什麼地鐵站出口更近？」），AI 萬能助理將隨時順應對話歷史，立即提供連貫的貼心解答！
                  </div>
                </motion.div>

              </div>
            </motion.div>
          ) : (
            /* Idle landing view */
            <div className="bg-white rounded-3xl border border-gray-100 p-8 sm:p-10 text-center shadow-xs space-y-4 mt-8 sm:mt-14">
              <Compass className="w-12 h-12 text-indigo-400 mx-auto stroke-1" />
              <div>
                <h3 className="text-base font-black text-gray-800">隨時問我任何日常大小事！</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto leading-relaxed">
                  本助理旨在解答您生活中大大小小的瑣碎問題，可以自由輸入您感興趣的事情，一鍵送出即可獲取精準解析。
                </p>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
};
