import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', compact = false }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center ${
        compact ? 'w-8 h-8' : 'w-8 h-8 sm:w-9 sm:h-9'
      } rounded-lg sm:rounded-xl border border-[#E7E9EE] dark:border-[#242936] bg-white dark:bg-[#141820] text-slate-600 dark:text-[#A3E635] hover:text-slate-900 dark:hover:text-[#84CC16] hover:bg-slate-50 dark:hover:bg-[#1C222D] shadow-xs transition-all duration-200 cursor-pointer shrink-0 ${className}`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <span className="sr-only">{isDark ? 'Light mode' : 'Dark mode'}</span>
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 animate-in spin-in-90 duration-300" />
      ) : (
        <Moon className="w-4 h-4 text-slate-600 group-hover:text-slate-900 transition-colors" />
      )}
    </button>
  );
};

export default ThemeToggle;
