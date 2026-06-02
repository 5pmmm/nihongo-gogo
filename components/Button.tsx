
import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

// Use HTMLMotionProps instead of React.ButtonHTMLAttributes to avoid conflicts with Framer Motion's internal prop types like onAnimationStart
interface ButtonProps extends Omit<HTMLMotionProps<"button">, 'children'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'glass' | 'liquid' | 'gray';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  // Fix: Explicitly type children as React.ReactNode to avoid conflict with MotionValue in standard React elements
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'liquid', 
  size = 'md',
  fullWidth = false,
  className = '',
  ...props 
}) => {
  const baseStyles = "rounded-[1rem] sm:rounded-[1.5rem] font-black transition-all duration-700 flex items-center justify-center gap-2 sm:gap-3 focus:outline-none overflow-hidden relative group tracking-tight sm:tracking-wide";
  
  const sizeStyles = {
    sm: "px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs",
    md: "px-5 sm:px-8 py-2.5 sm:py-4 text-xs sm:text-[15px]",
    lg: "px-8 sm:px-12 py-4 sm:py-6 text-base sm:text-xl"
  };

  const variants = {
    primary: "bg-gray-900 text-white hover:bg-black shadow-2xl shadow-gray-400/20 ring-1 ring-white/10",
    secondary: "bg-white text-gray-900 hover:bg-gray-50 border border-gray-200 shadow-md",
    outline: "bg-transparent border-2 border-gray-800 text-gray-800 hover:bg-gray-800 hover:text-white",
    glass: "bg-white/40 backdrop-blur-2xl border border-white/20 text-gray-900 shadow-sm",
    liquid: "bg-gray-800 text-white border border-gray-700 ring-1 ring-white/20 shadow-[0_12px_40px_0_rgba(0,0,0,0.2)] hover:bg-black hover:shadow-gray-300 hover:scale-[1.02]",
    gray: "bg-zinc-100/90 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-800 border border-zinc-200 shadow-4xs hover:scale-[1.01]"
  };

  return (
    <motion.button
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`${baseStyles} ${sizeStyles[size]} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {/* Liquid Shimmer Effect - Shifting Light */}
      <motion.div 
        className="absolute -inset-[100%] bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.2)_0%,_transparent_60%)] opacity-0 group-hover:opacity-40 pointer-events-none"
        animate={{
          x: ['-20%', '20%', '-20%'],
          y: ['-10%', '10%', '-10%'],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "linear"
        }}
      />

      {/* Moving Highlight Beam */}
      <motion.div 
        className="absolute inset-0 w-1/3 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-45deg] -translate-x-full pointer-events-none"
        variants={{
          hover: { x: '400%' }
        }}
        initial={false}
        // Removed redundant animate={undefined} which could trigger type check errors on line 62
        whileHover="hover"
        transition={{ duration: 1.5, ease: "circOut" }}
      />
      
      <span className="relative z-10 font-black">{children}</span>
    </motion.button>
  );
};
