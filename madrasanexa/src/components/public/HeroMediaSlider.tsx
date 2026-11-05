import { useState, useEffect, useRef, useCallback } from 'react';
import type { HeroMediaItem } from '../../services/homepage.service';
import ProductPreview from './ProductPreview';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HeroMediaSliderProps {
  items: HeroMediaItem[];
  autoplay?: boolean;
  autoplayInterval?: number;
}

export default function HeroMediaSlider({
  items = [],
  autoplay = true,
  autoplayInterval = 5000,
}: HeroMediaSliderProps) {
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter valid, enabled items that haven't failed to load
  const validItems = (items || []).filter(
    (item) => item.enabled && item.url && !failedImageIds.has(item.id)
  );

  const total = validItems.length;

  // Next Slide
  const handleNext = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  // Previous Slide
  const handlePrev = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Go to specific slide
  const handleDotClick = (idx: number) => {
    setCurrentIndex(idx);
  };

  // Handle Image Error
  const handleImageError = (id: string) => {
    setFailedImageIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // Keyboard navigation when focused
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (total <= 1) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNext();
    }
  };

  // Autoplay management
  useEffect(() => {
    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const prefersReducedMotion = mediaQuery.matches;

    if (!autoplay || isPaused || prefersReducedMotion || total <= 1) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const intervalTime = Math.max(3000, Math.min(15000, autoplayInterval || 5000));
    timerRef.current = window.setInterval(() => {
      handleNext();
    }, intervalTime);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoplay, isPaused, total, autoplayInterval, handleNext]);

  // Ensure currentIndex stays within bounds if items change
  useEffect(() => {
    if (currentIndex >= total && total > 0) {
      setCurrentIndex(0);
    }
  }, [currentIndex, total]);

  // Zero image fallback: render ProductPreview
  if (total === 0) {
    return <ProductPreview />;
  }

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="Madrasa Platform Showcase Gallery"
      className="relative w-full max-w-xl mx-auto lg:max-w-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#85845C] rounded-3xl group select-none"
    >
      {/* Ambient background glows */}
      <div className="absolute -top-10 -right-10 w-64 h-64 bg-[#A5A477]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-[#85845C]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glass Frame Container */}
      <div className="relative bg-white/85 backdrop-blur-xl border border-white/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden aspect-[16/10]">
        {/* Slides */}
        {validItems.map((item, idx) => {
          const isActive = idx === currentIndex;
          return (
            <div
              key={item.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
              aria-hidden={!isActive}
            >
              <img
                src={item.url}
                alt={item.alt || 'MadrasaNexa platform showcase preview'}
                onError={() => handleImageError(item.id)}
                loading={idx === 0 ? 'eager' : 'lazy'}
                className="w-full h-full object-cover"
              />

              {/* Optional Caption Overlay */}
              {item.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#252525]/80 via-[#252525]/40 to-transparent p-4 sm:p-6 text-white text-xs sm:text-sm font-medium backdrop-blur-[2px]">
                  <p className="line-clamp-2 max-w-2xl">{item.caption}</p>
                </div>
              )}
            </div>
          );
        })}

        {/* Navigation Arrows: Only show if more than 1 image */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#252525]/60 hover:bg-[#252525]/85 text-white backdrop-blur-md flex items-center justify-center transition-all opacity-80 hover:opacity-100 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#85845C] cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#252525]/60 hover:bg-[#252525]/85 text-white backdrop-blur-md flex items-center justify-center transition-all opacity-80 hover:opacity-100 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#85845C] cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Pagination Dots: Only show if more than 1 image */}
        {total > 1 && (
          <div
            role="tablist"
            aria-label="Slider Pagination"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#252525]/60 backdrop-blur-md border border-white/20 shadow-sm"
          >
            {validItems.map((item, idx) => {
              const isSelected = idx === currentIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  onClick={() => handleDotClick(idx)}
                  aria-selected={isSelected}
                  aria-current={isSelected ? 'true' : undefined}
                  aria-label={`Go to image ${idx + 1} of ${total}`}
                  className={`transition-all duration-300 rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#85845C] ${
                    isSelected
                      ? 'w-5 h-2 bg-[#85845C]'
                      : 'w-2 h-2 bg-white/60 hover:bg-white'
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
