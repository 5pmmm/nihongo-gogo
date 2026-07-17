
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PetStats } from '../types';

interface PetCompanionProps {
  stats: PetStats;
  onClick: () => void;
  compact?: boolean;
  hideDetails?: boolean;
}

const PHRASES = [
  "一緒に頑張ろう！ (一起加油吧！)",
  "今日もえらいね！ (今天也很棒喔！)",
  "継続は力なり。 (持之以恆就是力量。)",
  "ちょっと休憩する？ (要稍微休息一下嗎？)",
  "日本語、上手になったね！ (日文變好了呢！)",
  "焦らなくていいよ。 (不用著急喔。)",
  "一歩ずつ進もう。 (一步一步前進吧。)",
];

export const PetCompanion: React.FC<PetCompanionProps> = ({ stats, onClick, compact = false, hideDetails = false }) => {
  const [message, setMessage] = useState<string | null>(null);

  const handleInteraction = () => {
    if (message) {
      setMessage(null);
    } else {
      const randomMsg = PHRASES[Math.floor(Math.random() * PHRASES.length)];
      setMessage(randomMsg);
      setTimeout(() => setMessage(null), 4000);
    }
    onClick();
  };

  // Pet Visuals (Simple SVG "Ink Spirit")
  const renderPetBody = () => {
    const isFocus = stats.mood === 'focus';
    const costume = stats.activeCostume || 'normal';
    
    return (
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
        {/* Body - blob shape */}
        <motion.path
          d="M50 20 C20 20 10 50 10 70 C10 90 30 95 50 95 C70 95 90 90 90 70 C90 50 80 20 50 20 Z"
          fill="#374151" // gray-700
          animate={{
            d: isFocus 
             ? "M50 25 C25 25 15 50 15 70 C15 90 30 95 50 95 C70 95 85 90 85 70 C85 50 75 25 50 25 Z" // Slightly tighter when focused
             : [
                "M50 20 C20 20 10 50 10 70 C10 90 30 95 50 95 C70 95 90 90 90 70 C90 50 80 20 50 20 Z",
                "M50 22 C18 22 12 52 12 72 C12 88 32 93 50 93 C68 93 88 88 88 72 C88 52 82 22 50 22 Z",
                "M50 20 C20 20 10 50 10 70 C10 90 30 95 50 95 C70 95 90 90 90 70 C90 50 80 20 50 20 Z",
               ]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Headband (Hachimaki) for Focus Mode */}
        {isFocus && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <rect x="20" y="35" width="60" height="10" fill="white" rx="2" />
            <circle cx="50" cy="40" r="3" fill="#EF4444" /> {/* Red sun symbol */}
            <path d="M80 40 L95 35 L95 45 Z" fill="white" /> {/* Knot tie */}
          </motion.g>
        )}

        {/* Dynamic Costumes/Accessory Overlay */}
        {costume === 'samurai' && (
          <g>
            <path d="M22 45 C 22 23, 78 23, 78 45 Z" fill="#1F2937" stroke="#111827" strokeWidth="1.5" />
            <path d="M50 32 Q35 12 50 2 Q42 16 50 32" fill="#F59E0B" stroke="#D97706" strokeWidth="1" />
            <path d="M24 40 L12 52 L26 50 Z" fill="#B91C1C" stroke="#991B1B" strokeWidth="1" />
            <path d="M76 40 L88 52 L74 50 Z" fill="#B91C1C" stroke="#991B1B" strokeWidth="1" />
            <circle cx="50" cy="36" r="3" fill="#EF4444" />
          </g>
        )}
        
        {costume === 'ninja' && (
          <g>
            <path d="M16 40 C 22 18, 78 18, 84 40 C 85 54, 82 66, 50 66 C 18 66, 15 54, 16 40 Z" fill="#111827" stroke="#1F2937" strokeWidth="1.5" opacity="0.95" />
            <rect x="36" y="32" width="28" height="8" fill="#9CA3AF" rx="1.5" stroke="#4B5563" strokeWidth="1" />
            <circle cx="50" cy="36" r="1.5" fill="#374151" />
            <path d="M22 62 C30 76, 70 76, 78 62 Z" fill="#111827" />
          </g>
        )}

        {costume === 'kitsune' && (
          <g transform="translate(48, 12) scale(0.48) rotate(15)">
            <path d="M50 15 C70 15 85 30 80 50 C75 68 50 85 50 85 C50 85 25 68 20 50 C15 30 30 15 50 15 Z" fill="#F9FAFB" stroke="#D1D5DB" strokeWidth="2" />
            <path d="M30 20 L15 2 L38 12 Z" fill="#EF4444" />
            <path d="M70 20 L85 2 L62 12 Z" fill="#EF4444" />
            <path d="M32 38 Q42 46 34 52" stroke="#EF4444" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M68 38 Q58 46 66 52" stroke="#EF4444" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M28 58 Q36 62 30 68" stroke="#EF4444" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M72 58 Q64 62 70 68" stroke="#EF4444" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M30 48 Q38 52 42 48" stroke="#111827" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M70 48 Q62 52 58 48" stroke="#111827" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <polygon points="48,65 52,65 50,68" fill="#EF4444" />
          </g>
        )}

        {costume === 'emperor' && (
          <g>
            <path d="M30 38 L34 18 L50 30 L66 18 L70 38 Z" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5" />
            <circle cx="34" cy="18" r="3.5" fill="#EF4444" />
            <circle cx="50" cy="30" r="4" fill="#3B82F6" />
            <circle cx="66" cy="18" r="3.5" fill="#EF4444" />
            <circle cx="50" cy="38" r="2.5" fill="#10B981" />
            <path d="M34 38 C34 26, 66 26, 66 38 Z" fill="#DC2626" opacity="0.3" />
          </g>
        )}

        {/* Eyes */}
        <motion.circle cx="35" cy="55" r="3" fill="white" animate={{ scaleY: [1, 0.1, 1] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 3 }} />
        <motion.circle cx="65" cy="55" r="3" fill="white" animate={{ scaleY: [1, 0.1, 1] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 3 }} />

        {/* Mouth */}
        {stats.mood === 'happy' && (
          <path d="M40 65 Q50 75 60 65" stroke="white" strokeWidth="2" fill="none" />
        )}
        {stats.mood === 'focus' && (
          <path d="M42 68 L58 68" stroke="white" strokeWidth="2" fill="none" />
        )}
         {stats.mood === 'neutral' && (
          <circle cx="50" cy="68" r="1.5" fill="white" />
        )}
      </svg>
    );
  };

  if (compact) {
    return (
      <motion.div 
        className="fixed bottom-6 right-6 z-50 flex items-end flex-col space-y-2"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
      >
        <AnimatePresence>
          {message && (
             <motion.div 
               initial={{ opacity: 0, y: 10, scale: 0.8 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               exit={{ opacity: 0, scale: 0.8 }}
               className="bg-white border border-gray-200 p-3 rounded-2xl rounded-br-none shadow-lg mb-2 max-w-[200px]"
             >
               <p className="text-xs text-gray-700 font-medium">{message}</p>
             </motion.div>
          )}
        </AnimatePresence>

        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleInteraction}
          className="w-16 h-16 relative"
        >
          {renderPetBody()}
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white">
            Lv.{stats.level}
          </div>
        </motion.button>
      </motion.div>
    );
  }

  // Full View (Used in Focus Mode or Dashboard)
  return (
    <div className="flex flex-col items-center justify-center">
      <AnimatePresence>
          {message && (
             <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0 }}
               className="bg-white border border-gray-200 px-6 py-4 rounded-full shadow-sm mb-6"
             >
               <p className="text-gray-700 font-medium text-lg text-center">{message}</p>
             </motion.div>
          )}
      </AnimatePresence>

      <motion.div 
        className="w-48 h-48 cursor-pointer"
        onClick={handleInteraction}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {renderPetBody()}
      </motion.div>

      {!hideDetails && (
        <div className="mt-6 w-64">
          <div className="flex justify-between text-sm font-bold text-gray-600 mb-1">
            <span>Lv. {stats.level}</span>
            <span>{stats.currentXp} / {stats.nextLevelXp} XP</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <motion.div 
              className="bg-gray-800 h-2.5 rounded-full" 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((stats.currentXp / stats.nextLevelXp) * 100, 100)}%` }}
            />
          </div>
          <p className="text-center text-[10px] text-gray-400 mt-3 font-black uppercase tracking-widest">學習統計</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
             <div className="bg-zinc-50 p-2 rounded-xl border border-zinc-100 text-center">
                <p className="text-[10px] text-zinc-400 font-bold">專注</p>
                <p className="text-sm font-black text-zinc-800">{Math.floor(stats.totalFocusMinutes / 60)}h {stats.totalFocusMinutes % 60}m</p>
             </div>
             <div className="bg-zinc-50 p-2 rounded-xl border border-zinc-100 text-center">
                <p className="text-[10px] text-zinc-400 font-bold">單字</p>
                <p className="text-sm font-black text-zinc-800">{stats.totalWordsAnalyzed}</p>
             </div>
             <div className="bg-zinc-50 p-2 rounded-xl border border-zinc-100 text-center">
                <p className="text-[10px] text-zinc-400 font-bold">文法</p>
                <p className="text-sm font-black text-zinc-800">{stats.totalGrammarAnalyzed}</p>
             </div>
             <div className="bg-zinc-50 p-2 rounded-xl border border-zinc-100 text-center">
                <p className="text-[10px] text-zinc-400 font-bold">測驗</p>
                <p className="text-sm font-black text-zinc-800">{stats.totalQuizzesFinished}</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
