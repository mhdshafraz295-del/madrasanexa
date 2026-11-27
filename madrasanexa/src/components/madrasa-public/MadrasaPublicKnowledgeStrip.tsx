import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { formatHijriDate } from '../../utils/hijriDate';
import type { MadrasaThemeTokens } from '../../services/api';

export interface SacredQuote {
  arabic: string;
  english: string;
  source: string;
}

export const SACRED_KNOWLEDGE_QUOTES: SacredQuote[] = [
  {
    arabic: 'طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ',
    english: '"Seeking sacred knowledge is an obligation upon every Muslim."',
    source: 'Sunan Ibn Majah',
  },
  {
    arabic: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ',
    english: '"Whoever treads a path in search of knowledge, Allah will make easy for him a path to Paradise."',
    source: 'Sahih Muslim',
  },
  {
    arabic: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ',
    english: '"The best among you are those who learn the Qur\'an and teach it."',
    source: 'Sahih al-Bukhari',
  },
  {
    arabic: 'مَنْ يُرِدِ اللَّهُ بِهِ خَيْرًا يُفَقِّهْهُ فِي الدِّينِ',
    english: '"When Allah wishes good for a person, He grants him deep understanding of the religion."',
    source: 'Sahih al-Bukhari & Muslim',
  },
  {
    arabic: 'إِنَّمَا بُعِثْتُ مُعَلِّمًا',
    english: '"Indeed, I have only been sent as a teacher."',
    source: 'Sunan Ibn Majah',
  },
  {
    arabic: 'الْعِلْمُ نُورٌ يَقْذِفُهُ اللَّهُ فِي الْقَلْبِ',
    english: '"Sacred knowledge is a light that Allah casts into the heart."',
    source: 'Imam Malik ibn Anas',
  },
  {
    arabic: 'مَنْ أَرَادَ الدُّنْيَا فَعَلَيْهِ بِالْعِلْمِ، وَمَنْ أَرَادَ الْآخِرَةَ فَعَلَيْهِ بِالْعِلْمِ',
    english: '"Whoever desires this world must seek knowledge, and whoever desires the Hereafter must seek knowledge."',
    source: 'Imam al-Shafi\'i',
  },
  {
    arabic: 'الْأَدَبُ قَبْلَ الْعِلْمِ',
    english: '"Noble character and etiquette precede the acquisition of knowledge."',
    source: 'Imam Malik & Classical Scholars',
  },
];

interface MadrasaPublicKnowledgeStripProps {
  theme?: MadrasaThemeTokens;
  className?: string;
}

export const MadrasaPublicKnowledgeStrip: React.FC<MadrasaPublicKnowledgeStripProps> = ({
  className = '',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const hijriDate = useMemo(() => formatHijriDate(), []);

  // Handle transition to a given index with smooth cross-fade
  const changeQuote = useCallback((newIndex: number) => {
    setIsFading(true);
    const timeout = setTimeout(() => {
      setCurrentIndex((newIndex + SACRED_KNOWLEDGE_QUOTES.length) % SACRED_KNOWLEDGE_QUOTES.length);
      setIsFading(false);
    }, 280);
    return () => clearTimeout(timeout);
  }, []);

  const handleNext = useCallback(() => {
    changeQuote(currentIndex + 1);
  }, [changeQuote, currentIndex]);

  const handlePrev = useCallback(() => {
    changeQuote(currentIndex - 1);
  }, [changeQuote, currentIndex]);

  // Automatic 8-second rotation with hover-pause and reduced-motion respect
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    if (isPaused) return;

    const timer = setInterval(() => {
      handleNext();
    }, 8000);

    return () => clearInterval(timer);
  }, [isPaused, handleNext]);

  const activeQuote = SACRED_KNOWLEDGE_QUOTES[currentIndex];

  return (
    <section
      aria-label="Daily Islamic Wisdom and Hijri Date"
      className={`w-full border-y border-[#C5A059]/30 bg-white/75 backdrop-blur-md py-2.5 sm:py-3 px-4 sm:px-6 lg:px-8 transition-colors select-none shadow-[0_2px_12px_rgba(197,160,89,0.08)] ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5 sm:gap-4">

        {/* 1. Live Hijri Date Pill & Mobile Controls Header */}
        <div className="w-full md:w-auto flex items-center justify-between md:justify-start gap-3 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/85 backdrop-blur-sm border border-[#C5A059]/35 text-[#2C2B1C] text-xs font-semibold shadow-[0_0_10px_rgba(197,160,89,0.12)]">
            <Calendar className="w-3.5 h-3.5 text-[#504F34] shrink-0" />
            <span className="tracking-tight">{hijriDate}</span>
          </div>

          {/* Mobile-only compact chevron controls */}
          <div className="flex md:hidden items-center gap-1">
            <span className="text-[11px] font-mono text-[#504F34] dark:text-[#9CA3AF] font-semibold pr-1">
              {currentIndex + 1}/8
            </span>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous quote"
              className="w-7 h-7 rounded-lg bg-white dark:bg-[#1C222D] border border-[#D6D4C2] dark:border-[#242936] flex items-center justify-center text-[#2C2B1C] dark:text-[#F9FAFB] hover:bg-[#F4F3EC] dark:hover:bg-[#242936] transition shadow-2xs active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next quote"
              className="w-7 h-7 rounded-lg bg-white dark:bg-[#1C222D] border border-[#D6D4C2] dark:border-[#242936] flex items-center justify-center text-[#2C2B1C] dark:text-[#F9FAFB] hover:bg-[#F4F3EC] dark:hover:bg-[#242936] transition shadow-2xs active:scale-95 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Rotating Sacred Knowledge Quote (Arabic + English + Source) */}
        <div className="flex-1 w-full text-center px-1 sm:px-4 min-h-[68px] sm:min-h-[52px] md:min-h-[44px] flex flex-col justify-center">
          <div
            className={`transition-opacity duration-300 ease-in-out ${
              isFading ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {/* Arabic Script: larger, crisp dark olive-ink with high-definition diacritics */}
            <div
              lang="ar"
              dir="rtl"
              className="text-lg sm:text-xl md:text-[21px] font-semibold text-[#232215] dark:text-[#F9FAFB] leading-relaxed tracking-normal mb-1 break-words font-serif"
              style={{
                fontFamily: "'Amiri', 'Traditional Arabic', 'Scheherazade', serif",
              }}
            >
              {activeQuote.arabic}
            </div>

            {/* English Translation & Source Citation */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-[15px] font-medium text-[#3D3C27] dark:text-[#D1D5DB]">
              <span>{activeQuote.english}</span>
              <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#504F34] dark:text-[#84CC16] shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6B6A45]/80 dark:bg-[#84CC16]/80 shrink-0" />
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>{activeQuote.source}</span>
              </span>
            </div>
          </div>
        </div>

        {/* 3. Desktop Manual Chevron Controls (< >) */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-mono text-[#504F34] dark:text-[#9CA3AF] font-semibold pr-1">
            {currentIndex + 1}/8
          </span>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous sacred quote"
            className="w-7 h-7 rounded-lg bg-white dark:bg-[#1C222D] border border-[#D6D4C2] dark:border-[#242936] flex items-center justify-center text-[#2C2B1C] dark:text-[#F9FAFB] hover:bg-[#F4F3EC] dark:hover:bg-[#242936] transition shadow-2xs hover:scale-105 active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next sacred quote"
            className="w-7 h-7 rounded-lg bg-white dark:bg-[#1C222D] border border-[#D6D4C2] dark:border-[#242936] flex items-center justify-center text-[#2C2B1C] dark:text-[#F9FAFB] hover:bg-[#F4F3EC] dark:hover:bg-[#242936] transition shadow-2xs hover:scale-105 active:scale-95 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </section>
  );
};

export default MadrasaPublicKnowledgeStrip;
