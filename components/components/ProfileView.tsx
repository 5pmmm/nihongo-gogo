import React from 'react';
import { motion } from 'framer-motion';
import { PetStats } from '../types';
import { PetCompanion } from './PetCompanion';

interface ProfileViewProps {
  stats: PetStats;
  onSelectCostume: (costumeId: string) => void;
  onPetClick: () => void;
}

interface CostumeItem {
  id: string;
  name: string;
  description: string;
  minLevel: number;
  emoji: string;
}

const COSTUMES: CostumeItem[] = [
  { id: 'normal', name: '標準墨精', description: '最經典、最溫和的原生墨水精靈狀態。', minLevel: 1, emoji: '🔮' },
  { id: 'samurai', name: '威風武士', description: '頭戴傳統日本黃金新月武士兜帽，威風堂堂！', minLevel: 3, emoji: '⚔️' },
  { id: 'ninja', name: '隱密忍者', description: '蒙上神祕的影之面罩，專注在暗處精進日語！', minLevel: 5, emoji: '🥷' },
  { id: 'kitsune', name: '神狐面具', description: '側面斜戴著精緻的朱砂白狐面具，充滿古老神話感。', minLevel: 8, emoji: '🦊' },
  { id: 'emperor', name: '至尊冠冕', description: '鑲嵌著紅藍綠寶石的天皇黃金皇冠，登頂日語之王！', minLevel: 10, emoji: '👑' }
];

interface TriviaItem {
  id: number;
  level: number;
  title: string;
  content: string;
}

const TRIVIA_LIST: TriviaItem[] = [
  { id: 1, level: 1, title: '一生懸命 (いっしょうけんめい)', content: '起源自武士用生命拼死守護自家的「一所」領地，後來隨著時代演變，成了如今「非常拼命努力、持之以恆」的意思。' },
  { id: 2, level: 2, title: '便利商店的萬能生態', content: '日本的便利商店（如 7-Eleven, Lawson, FamilyMart）功能強大無比！不僅能列印、購買各類演唱會與遊樂園門票，還能收發快遞、甚至進行稅金繳納。' },
  { id: 3, level: 3, title: '日語的 SOV 顛倒結構', content: '日語與中文「主-謂-賓」結構不同，是「主-賓-謂」（Subject-Object-Verb）結構。意思是動詞始終放在句子最後，所以聽日本人說話一定要有耐心地聽到最後一句喔！' },
  { id: 4, level: 4, title: '招財貓的左右手祕密', content: '在日本隨處可見的招財貓（まねきねこ），如果舉的是「右手」代表招財、財源廣進；如果舉的是「左手」則代表招人、客似雲來、結善緣。' },
  { id: 5, level: 5, title: '吃拉麵「簌簌聲」的讚賞', content: '在日本吃拉麵發出響亮的「簌簌（すする）」吸麵聲，不但不是失禮行為，反而代表麵條十分美味、溫度剛好，也是給予拉麵師傅最直接的讚賞！' },
  { id: 6, level: 6, title: '社交禮儀「相槌 (あいづち)」', content: '相槌是指在傾聽對方說話時頻繁點頭並發出「はい」、「ええ」等聲音。這在日語中並不一定代表「同意對方觀點」，而是表達「我有在專心傾聽」的一種重要禮貌。' },
  { id: 7, level: 7, title: '櫻花之國的「花見 (はなみ)」', content: '櫻花盛開的春季，日本人會跟親友或同事一起在櫻花樹下鋪上藍色塑膠墊、一邊野餐喝酒一邊賞花。這項源遠流長的習俗，最早是由奈良時代的貴族賞梅所啟發的。' },
  { id: 8, level: 8, title: '一字雙音：音讀與訓讀', content: '日語漢字一般分為「音讀」（模仿古代傳入日本的漢語讀音）與「訓讀」（日語原汁原味的固有詞意讀音）。例如「山」，音讀是「さん」，訓讀是「やま」。' },
  { id: 9, level: 9, title: '富士山頂其實是「私人土地」', content: '象徵日本精神的富士山，其海拔 3360 公尺以上的「八合目至山頂」部分並非國有土地，而是屬於古老神社「富士山本宮淺間大社」的私有財產！' },
  { id: 10, level: 10, title: '絕美單字「木漏れ日」', content: '日語中有許多極具禪意、難以直接翻譯的唯美單字。「木漏れ日（こもれび）」指的就是「從樹葉縫隙間輕輕灑落下來的溫暖陽光」，光是想像畫面就極為療癒。' }
];

export const ProfileView: React.FC<ProfileViewProps> = ({ stats, onSelectCostume, onPetClick }) => {
  const activeCostume = stats.activeCostume || 'normal';

  return (
    <div className="w-full max-w-7xl mx-auto space-y-10 pb-24 px-4 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-8 border-zinc-900 pl-5">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight uppercase sm:text-3xl">個人檔案</h2>
          <p className="text-zinc-500 font-medium text-xs sm:text-sm mt-1.5">
            在這裡可以與你的吉祥物「墨精」互動、解鎖專屬扮相與探索日本文化小知識
          </p>
        </div>
      </div>

      {/* Main Grid: Left Mascot & Wardrobe (4/12 width), Right Stats (8/12 width) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Mascot Interaction and Costumes Selection */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-zinc-150/80 shadow-sm flex flex-col items-center relative overflow-hidden">
            {/* Ambient Background decoration */}
            <div className="absolute inset-0 bg-radial-gradient from-zinc-50/50 via-transparent to-transparent pointer-events-none" />
            
            <h3 className="text-xs font-bold text-zinc-400 tracking-wider uppercase mb-4 z-10">你的日本語守護靈</h3>
            
            <div className="scale-110 py-2">
              <PetCompanion stats={stats} onClick={onPetClick} hideDetails={true} />
            </div>

            <div className="mt-6 text-center z-10">
              <span className="text-xs bg-zinc-100 text-zinc-600 font-bold px-3.5 py-1.5 rounded-full border border-zinc-200">
                點擊「墨精」聽他對你說話
              </span>
            </div>
          </div>

          {/* Costumes Selector */}
          <div className="bg-white p-6 rounded-[2rem] border border-zinc-150/80 shadow-sm space-y-5">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5">
                <span>🎒</span> 墨精更衣室 (解鎖裝扮)
              </h3>
              <span className="text-xs text-zinc-450 font-medium">目前等級: Lv.{stats.level}</span>
            </div>

            <div className="space-y-3">
              {COSTUMES.map((cos) => {
                const isUnlocked = stats.level >= cos.minLevel;
                const isSelected = activeCostume === cos.id;

                return (
                  <button
                    key={cos.id}
                    disabled={!isUnlocked}
                    onClick={() => onSelectCostume(cos.id)}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-center gap-4 cursor-pointer relative ${
                      !isUnlocked 
                        ? 'bg-zinc-50/50 border-zinc-100 opacity-60 cursor-not-allowed'
                        : isSelected
                          ? 'bg-zinc-950 border-zinc-950 text-white shadow-md'
                          : 'bg-white border-zinc-150 hover:border-zinc-300 text-zinc-800'
                    }`}
                  >
                    <div className="text-2xl bg-zinc-100 p-2 rounded-lg shrink-0">
                      {isUnlocked ? cos.emoji : '🔒'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-zinc-900'}`}>{cos.name}</p>
                        {!isUnlocked && (
                          <span className="text-[10px] font-semibold bg-rose-50 border border-rose-100 text-rose-500 px-1.5 py-0.2 rounded-md">
                            Lv.{cos.minLevel} 解鎖
                          </span>
                        )}
                        {isUnlocked && isSelected && (
                          <span className="text-[10px] font-semibold bg-white/20 text-white px-1.5 py-0.2 rounded-md">
                            已穿戴
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] font-medium line-clamp-1 mt-0.5 ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {isUnlocked ? cos.description : `當前等級尚未達到 Lv.${cos.minLevel}，繼續學習累積 XP 吧！`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Stats and Trivia Unlocks */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Detailed Stats Block */}
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-zinc-150/80 shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-zinc-800 border-b border-zinc-100 pb-3 flex items-center gap-1.5">
              <span>📈</span> 學習詳細統計紀錄
            </h3>

            {/* Level progress bar */}
            <div className="bg-zinc-50 p-5 rounded-[1.5rem] border border-zinc-100/80 space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-zinc-500">
                <span className="text-zinc-900 font-bold">學力等級 Lv.{stats.level}</span>
                <span className="font-medium">{stats.currentXp} / {stats.nextLevelXp} XP</span>
              </div>
              <div className="w-full bg-zinc-200 rounded-full h-3 overflow-hidden">
                <motion.div 
                  className="bg-zinc-950 h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((stats.currentXp / stats.nextLevelXp) * 100, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <p className="text-[11px] text-zinc-400 font-medium">
                還差 {stats.nextLevelXp - stats.currentXp} XP 即可升到下一級！每次解析、測驗與對話皆能累積學力。
              </p>
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: '累積學習單字', value: stats.totalWordsAnalyzed, unit: '個', color: 'border-zinc-200' },
                { label: '累積重點文法', value: stats.totalGrammarAnalyzed, unit: '個', color: 'border-indigo-100' },
                { label: '已完成智慧測驗', value: stats.totalQuizzesFinished, unit: '次', color: 'border-rose-100' },
                { label: 'AI 日語對話聊天', value: stats.totalChatMessages, unit: '句', color: 'border-teal-100' },
                { label: '聽力口說練習', value: stats.totalListeningPractices, unit: '次', color: 'border-emerald-100' },
                { label: '專注學習分量', value: stats.totalFocusMinutes, unit: '分', color: 'border-amber-100' }
              ].map((item, idx) => (
                <div key={idx} className={`p-5 bg-zinc-50/50 border ${item.color} rounded-2xl text-center space-y-1 hover:bg-zinc-50 hover:shadow-xs transition-all`}>
                  <p className="text-[11px] text-zinc-400 font-bold">{item.label}</p>
                  <p className="text-xl sm:text-2xl font-black text-zinc-900">
                    {item.value} <span className="text-xs text-zinc-500 font-medium">{item.unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Small Trivia Board based on levels */}
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-zinc-150/80 shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-zinc-800 border-b border-zinc-100 pb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>🏮</span> 日本文化與語言小知識庫
              </span>
              <span className="text-xs text-zinc-400 font-medium">
                已解鎖: {TRIVIA_LIST.filter(t => stats.level >= t.level).length} / {TRIVIA_LIST.length}
              </span>
            </h3>

            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-200">
              {TRIVIA_LIST.map((tri) => {
                const isUnlocked = stats.level >= tri.level;

                return (
                  <div
                    key={tri.id}
                    className={`p-5 rounded-[1.5rem] border transition-all ${
                      isUnlocked 
                        ? 'bg-zinc-50/50 border-zinc-200/80' 
                        : 'bg-zinc-50/10 border-zinc-100/50 select-none'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-md ${
                        isUnlocked ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-400'
                      }`}>
                        Lv.{tri.level} 解鎖
                      </span>
                      {!isUnlocked && (
                        <span className="text-xs text-zinc-400 font-semibold flex items-center gap-1">🔒 等級不足</span>
                      )}
                    </div>
                    
                    {isUnlocked ? (
                      <div className="space-y-1">
                        <h4 className="text-sm sm:text-base font-bold text-zinc-800 tracking-tight">{tri.title}</h4>
                        <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed font-medium mt-1">{tri.content}</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <h4 className="text-sm sm:text-base font-bold text-zinc-350 blur-[1.5px] tracking-tight">{tri.title}</h4>
                        <p className="text-xs sm:text-sm text-zinc-350 select-none font-medium mt-1">
                          當前等級尚未達到 Lv.{tri.level}，解鎖後即可觀看此日本文化與語言小常識喔！
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
