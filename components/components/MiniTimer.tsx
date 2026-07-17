
import React from 'react';
import { motion } from 'framer-motion';
import { TimerState } from '../types';

interface MiniTimerProps {
  state: TimerState;
  onClick: () => void;
}

export const MiniTimer: React.FC<MiniTimerProps> = ({ state, onClick }) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentTotalTime = state.mode === 'FOCUS' ? state.focusDuration * 60 : state.breakDuration * 60;
  // Prevent division by zero and ensure progress is between 0 and 1
  const safeTotal = currentTotalTime > 0 ? currentTotalTime : 1;
  const progress = Math.max(0, Math.min(1, 1 - (state.timeLeft / safeTotal)));
  
  // SVG Configuration to prevent clipping
  const viewBoxSize = 100;
  const strokeWidth = 8;
  const center = viewBoxSize / 2;
  // Radius calculation: (Size - Stroke) / 2 - Padding (to accommodate round line caps)
  const radius = (viewBoxSize - strokeWidth) / 2 - 4; 
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <motion.button
      layout
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-28 right-6 z-40 bg-white rounded-full shadow-xl flex items-center justify-center w-16 h-16 border border-gray-100 overflow-hidden"
    >
      <div className="relative w-full h-full p-1">
        <svg 
          className="w-full h-full transform -rotate-90" 
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        >
          {/* Background Track */}
          <circle
            cx={center} cy={center} r={radius}
            stroke="#F3F4F6" 
            strokeWidth={strokeWidth} 
            fill="none"
          />
          {/* Progress Indicator */}
          <circle
            cx={center} cy={center} r={radius}
            stroke={state.mode === 'FOCUS' ? "#374151" : "#34D399"}
            strokeWidth={strokeWidth} 
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>
        
        {/* Timer Text Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs font-bold font-mono text-gray-800 tracking-tight">
            {formatTime(state.timeLeft)}
            </span>
        </div>
      </div>
    </motion.button>
  );
};
