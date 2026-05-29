
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { TimerState } from '../types';

interface PomodoroTimerProps {
  state: TimerState;
  onToggle: () => void;
  onReset: () => void;
  onSwitchMode: () => void;
  onUpdateSettings: (focus: number, breakTime: number) => void;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ 
  state, 
  onToggle, 
  onReset, 
  onSwitchMode, 
  onUpdateSettings 
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [localFocus, setLocalFocus] = useState(state.focusDuration);
  const [localBreak, setLocalBreak] = useState(state.breakDuration);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentTotalTime = state.mode === 'FOCUS' ? state.focusDuration * 60 : state.breakDuration * 60;
  const progress = 1 - (state.timeLeft / (currentTotalTime || 1));

  const handleSaveSettings = () => {
    onUpdateSettings(localFocus, localBreak);
    setIsSettingsOpen(false);
  };

  const presets = [15, 25, 45, 60];

  return (
    <div className="bg-white p-5 sm:p-8 rounded-[2rem] sm:rounded-[3rem] shadow-xl sm:shadow-2xl border border-gray-100 text-center max-w-sm sm:max-w-md mx-auto relative overflow-hidden">
       {/* Settings Overlay */}
       <AnimatePresence>
         {isSettingsOpen && (
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0, scale: 0.95 }}
             className="absolute inset-0 bg-white/95 backdrop-blur-xl z-20 p-6 sm:p-10 flex flex-col justify-between items-center"
           >
             <div className="w-full space-y-8 sm:space-y-10">
               <div className="flex justify-between items-center">
                 <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase">計時器設定</h3>
                 <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-gray-900">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                 </button>
               </div>
               
               <div className="w-full space-y-6">
                 <div>
                    <div className="flex justify-between items-end mb-4">
                      <label className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">專注時長</label>
                      <span className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tighter">{localFocus}<span className="text-xs sm:text-sm ml-1 text-gray-400">min</span></span>
                    </div>
                    <input 
                      type="range" 
                      min="1" max="120" 
                      value={localFocus} 
                      onChange={(e) => setLocalFocus(Number(e.target.value))}
                      className="w-full h-1.5 sm:h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-gray-900"
                    />
                    <div className="flex justify-between mt-4 gap-2">
                       {presets.map(p => (
                         <button 
                           key={p} 
                           onClick={() => setLocalFocus(p)}
                           className={`flex-1 py-2 text-xs font-black rounded-xl border transition-all ${localFocus === p ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'}`}
                         >
                           {p}m
                         </button>
                       ))}
                    </div>
                 </div>

                 <div className="pt-4">
                    <div className="flex justify-between items-end mb-4">
                      <label className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">休息時長</label>
                      <span className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tighter">{localBreak}<span className="text-xs sm:text-sm ml-1 text-gray-400">min</span></span>
                    </div>
                    <input 
                      type="range" 
                      min="1" max="30" 
                      value={localBreak} 
                      onChange={(e) => setLocalBreak(Number(e.target.value))}
                      className="w-full h-1.5 sm:h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-gray-400"
                    />
                 </div>
               </div>
             </div>

             <Button onClick={handleSaveSettings} variant="liquid" className="w-full py-5 text-lg">
               確認修改
             </Button>
           </motion.div>
         )}
       </AnimatePresence>

       {/* Header with Settings Button */}
       <div className="flex justify-between items-center mb-8">
         <div className="flex bg-gray-100 p-1 rounded-2xl shadow-inner border border-black/5 relative">
            <button 
              onClick={() => state.mode === 'BREAK' && onSwitchMode()}
              className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black transition-all relative z-10 ${state.mode === 'FOCUS' ? 'text-white' : 'text-gray-400'}`}
            >
              專注
              {state.mode === 'FOCUS' && (
                <motion.div layoutId="timer-mode" className="absolute inset-0 bg-gray-900 rounded-lg sm:rounded-xl -z-10 shadow-lg" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
              )}
            </button>
            <button 
              onClick={() => state.mode === 'FOCUS' && onSwitchMode()}
              className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black transition-all relative z-10 ${state.mode === 'BREAK' ? 'text-white' : 'text-gray-400'}`}
            >
              休息
              {state.mode === 'BREAK' && (
                <motion.div layoutId="timer-mode" className="absolute inset-0 bg-gray-900 rounded-lg sm:rounded-xl -z-10 shadow-lg" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
              )}
            </button>
         </div>
         <motion.button 
           whileHover={{ rotate: 90 }}
           transition={{ type: "spring", stiffness: 200 }}
           onClick={() => setIsSettingsOpen(true)} 
           className="text-gray-400 hover:text-gray-900 p-3 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm"
         >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
         </motion.button>
       </div>

       {/* Visual Timer */}
        <div className="relative w-64 h-64 sm:w-80 sm:h-80 mx-auto mb-6 sm:mb-10 flex items-center justify-center group">
          <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 288 288">
             <circle 
               cx="144" cy="144" r="132" 
               stroke="#F9FAFB" strokeWidth="6" fill="none" 
             />
             <motion.circle 
               cx="144" cy="144" r="132" 
               stroke={state.mode === 'FOCUS' ? "#111827" : "#10B981"} 
               strokeWidth="8" fill="none" 
               strokeDasharray={2 * Math.PI * 132}
               strokeDashoffset={2 * Math.PI * 132 * (1 - progress)}
               strokeLinecap="round"
               transition={{ duration: 1, ease: "linear" }}
             />
          </svg>
          
          <div className="relative z-10 flex flex-col items-center justify-center">
            <motion.span 
              key={state.timeLeft}
              initial={{ scale: 1 }}
              animate={state.isActive ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-6xl sm:text-8xl font-mono font-black text-gray-900 tracking-tighter mb-1 sm:mb-2"
            >
              {formatTime(state.timeLeft)}
            </motion.span>
            <div className="flex flex-col items-center">
               <span className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">
                {state.isActive ? (state.mode === 'FOCUS' ? 'FOCUSING' : 'RELAXING') : 'READY'}
               </span>
               <div className="h-0.5 sm:h-1 w-6 sm:w-8 bg-gray-200 rounded-full mt-2 sm:mt-3 group-hover:w-12 sm:group-hover:w-16 transition-all duration-500" />
            </div>
          </div>
       </div>

       {/* Controls */}
       <div className="flex space-x-4 sm:space-x-6 justify-center items-center">
         <Button 
           onClick={onToggle} 
           variant={state.isActive ? "secondary" : "liquid"} 
           size="lg"
           className="px-10 sm:px-14 py-4 sm:py-5 text-base sm:text-lg shadow-xl sm:shadow-2xl rounded-xl sm:rounded-2xl"
         >
           {state.isActive ? '暫停' : '開始專注'}
         </Button>
         <motion.button 
           whileHover={{ scale: 1.1, rotate: -15 }}
           whileTap={{ scale: 0.9 }}
           onClick={onReset} 
           className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center rounded-xl sm:rounded-2xl bg-gray-50 border border-gray-100 text-gray-400 hover:text-gray-900 hover:bg-white hover:shadow-lg transition-all"
         >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
         </motion.button>
       </div>
    </div>
  );
};
