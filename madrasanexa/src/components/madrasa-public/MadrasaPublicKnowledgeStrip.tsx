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
  theme,
  className = '',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const primaryColor = theme?.primaryBtnBg || '#504F34';
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
      className={`w-full border-y border-[#E5E5DF] bg-[#FAF9F5] bg-islamic-diamond-subtle py-3 sm:py-3.5 px-4 sm:px-6 lg:px-8 transition-colors select-none ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">

        {/* 1. Live Hijri Date Pill & Mobile Controls Header */}
        <div className="w-full md:w-auto flex items-center justify-between md:justify-start gap-3 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E5E5DF] text-[#504F34] text-xs font-semibold shadow-2xs">
            <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: primaryColor }} />
            <span className="tracking-tight">{hijriDate}</span>
          </div>

          {/* Mobile-only compact chevron controls */}
          <div className="flex md:hidden items-center gap-1">
            <span className="text-[11px] font-mono text-[#85845C] font-semibold pr-1">
              {currentIndex + 1}/8
            </span>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous quote"
              className="w-7 h-7 rounded-lg bg-white border border-[#E5E5DF] flex items-center justify-center text-[#504F34] hover:bg-[#F5F5F1] transition shadow-2xs active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next quote"
              className="w-7 h-7 rounded-lg bg-white border border-[#E5E5DF] flex items-center justify-center text-[#504F34] hover:bg-[#F5F5F1] transition shadow-2xs active:scale-95 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Rotating Sacred Knowledge Quote (Arabic + English + Source) */}
        <div className="flex-1 w-full text-center px-1 sm:px-4 min-h-[72px] sm:min-h-[58px] md:min-h-[44px] flex flex-col justify-center">
          <div
            className={`transition-opacity duration-300 ease-in-out ${
              isFading ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {/* Arabic Script */}
            <div
              lang="ar"
              dir="rtl"
              className="text-base sm:text-lg lg:text-xl font-medium text-[#252525] leading-relaxed tracking-normal mb-1 break-words font-serif"
              style={{
                fontFamily: "'Amiri', 'Traditional Arabic', 'Scheherazade', serif",
              }}
            >
              {activeQuote.arabic}
            </div>

            {/* English Translation & Source Citation */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs sm:text-sm text-[#504F34]">
              <span className="italic font-normal">{activeQuote.english}</span>
              <span className="inline-flex items-center gap-1 font-semibold text-[11px] sm:text-xs" style={{ color: primaryColor }}>
                <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: primaryColor }} />
                <BookOpen className="w-3 h-3 shrink-0" style={{ color: primaryColor }} />
                <span>{activeQuote.source}</span>
              </span>
            </div>
          </div>
        </div>

        {/* 3. Desktop Manual Chevron Controls (< >) */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-mono text-[#85845C] font-semibold pr-1">
            {currentIndex + 1}/8
          </span>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous sacred quote"
            className="w-7 h-7 rounded-lg bg-white border border-[#E5E5DF] flex items-center justify-center text-[#504F34] hover:bg-[#F5F5F1] transition shadow-2xs hover:scale-105 active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next sacred quote"
            className="w-7 h-7 rounded-lg bg-white border border-[#E5E5DF] flex items-center justify-center text-[#504F34] hover:bg-[#F5F5F1] transition shadow-2xs hover:scale-105 active:scale-95 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </section>
  );
};

export default MadrasaPublicKnowledgeStrip;
