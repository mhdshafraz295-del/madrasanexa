import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, MapPin, Images, ChevronLeft, ChevronRight, X, Eye, ZoomIn, ZoomOut } from 'lucide-react';
import type { MadrasaProfileEvent, MadrasaThemeTokens, EventAlbumImage } from '../../services/api';

interface MadrasaPublicEventsProps {
  events: MadrasaProfileEvent[];
  theme: MadrasaThemeTokens;
}

function getEventAlbumImages(event: MadrasaProfileEvent): EventAlbumImage[] {
  if (Array.isArray(event.images) && event.images.length > 0) {
    const valid = event.images.filter((img) => img && (img.url || img.fileId));
    if (valid.length > 0) return valid;
  }
  const fallbackUrl = event.coverUrl || event.posterUrl;
  if (fallbackUrl) {
    return [
      {
        id: `img-legacy-${event.coverFileId || event.posterFileId || 'single'}`,
        url: fallbackUrl,
        fileId: event.coverFileId || event.posterFileId || null,
        isCover: true,
        sortOrder: 0,
      },
    ];
  }
  return [];
}

export const MadrasaPublicEvents: React.FC<MadrasaPublicEventsProps> = ({
  events,
  theme,
}) => {
  const [activeAlbum, setActiveAlbum] = useState<{
    event: MadrasaProfileEvent;
    images: EventAlbumImage[];
    currentIndex: number;
  } | null>(null);

  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  const handleCloseAlbum = React.useCallback(() => {
    setActiveAlbum(null);
    setIsZoomed(false);
    setTouchStartX(null);
    setTouchEndX(null);
  }, []);

  const handlePrevImage = React.useCallback(() => {
    setIsZoomed(false);
    setActiveAlbum((prev) => {
      if (!prev || prev.images.length <= 1) return prev;
      const nextIdx = (prev.currentIndex - 1 + prev.images.length) % prev.images.length;
      return { ...prev, currentIndex: nextIdx };
    });
  }, []);

  const handleNextImage = React.useCallback(() => {
    setIsZoomed(false);
    setActiveAlbum((prev) => {
      if (!prev || prev.images.length <= 1) return prev;
      const nextIdx = (prev.currentIndex + 1) % prev.images.length;
      return { ...prev, currentIndex: nextIdx };
    });
  }, []);

  const handleOpenAlbum = (event: MadrasaProfileEvent, startIndex: number = 0) => {
    const images = getEventAlbumImages(event);
    if (images.length === 0) return;

    let initialIndex = startIndex;
    if (startIndex === 0 && images.length > 1) {
      const coverIdx = images.findIndex((img) => img.isCover);
      if (coverIdx >= 0) initialIndex = coverIdx;
    }

    setIsZoomed(false);
    setActiveAlbum({
      event,
      images,
      currentIndex: initialIndex >= 0 && initialIndex < images.length ? initialIndex : 0,
    });
  };

  // Keyboard navigation & full viewport scroll locking
  useEffect(() => {
    if (!activeAlbum) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseAlbum();
      } else if (e.key === 'ArrowLeft') {
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const origBodyOverflow = document.body.style.overflow;
    const origHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = origBodyOverflow;
      document.documentElement.style.overflow = origHtmlOverflow;
    };
  }, [activeAlbum, handleCloseAlbum, handlePrevImage, handleNextImage]);

  // Mobile swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchEndX(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const deltaX = touchStartX - touchEndX;
    const minSwipeDistance = 45;
    if (deltaX > minSwipeDistance) {
      handleNextImage();
    } else if (deltaX < -minSwipeDistance) {
      handlePrevImage();
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <section id="events" className="scroll-mt-28 public-section-enter">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
        <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#85845C] mb-2 px-3.5 py-1 rounded-full bg-[#F5F5F1] border border-[#E5E5DF] shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-[#85845C]" />
          <span>Events & Gallery</span>
        </div>
        <h2
          className="text-2xl sm:text-4xl font-serif font-bold tracking-tight mb-3 text-[#252525]"
          style={{ color: theme.headingColor || '#252525' }}
        >
          Upcoming Institutional Events & Albums
        </h2>
        <p className="text-sm sm:text-base text-[#666666] max-w-xl mx-auto">
          Explore commemorative milestones, academic ceremonies, and student events.
        </p>
        <div className="w-16 h-1 bg-gradient-to-r from-[#85845C] via-[#A5A477] to-[#85845C] mx-auto rounded-full mt-3" />
      </div>

      {/* Events / Gallery Centered & Balanced CSS Grid Layout
          Desktop (1280px+): exactly 3 cards per row
          Tablet (768px - 1279px): 2 cards per row
          Mobile (<768px): 1 card per row
      */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-7 lg:gap-8 items-stretch w-full max-w-7xl mx-auto">
        {events.map((event) => {
          const albumImages = getEventAlbumImages(event);
          const photoCount = albumImages.length > 0 ? albumImages.length : (event.posterUrl ? 1 : 0);

          // Find primary cover image
          const coverImage = albumImages.find((img) => img.isCover) || albumImages[0];
          const coverIdx = albumImages.findIndex((img) => img.id === coverImage?.id);
          const effectiveCoverIdx = coverIdx >= 0 ? coverIdx : 0;

          // Remaining images (all except cover) with original indices preserved
          const remainingItems = albumImages
            .map((img, originalIdx) => ({ img, originalIdx }))
            .filter((item) => item.originalIdx !== effectiveCoverIdx);

          // Maximum 4 preview thumbnails under the cover
          const previewThumbnails = remainingItems.slice(0, 4);
          // Hidden count for +N overlay on the 4th thumbnail when more than 5 total photos exist
          const hiddenCount = albumImages.length - 5;

          return (
            <div
              key={event.id}
              className="w-full bg-white rounded-2xl border border-[#E5E5DF] flex flex-col justify-between overflow-hidden p-5 space-y-4 shadow-xs hover:border-[#85845C]/50 hover:shadow-md transition-all h-full"
            >
              {/* Premium Photo Album Layout */}
              {albumImages.length > 0 ? (
                <div className="space-y-2.5">
                  {/* Large Main Cover Image */}
                  <div
                    onClick={() => handleOpenAlbum(event, effectiveCoverIdx)}
                    className="group/cover relative w-full h-52 sm:h-56 md:h-60 rounded-xl overflow-hidden border border-[#E5E5DF] bg-[#F5F5F1] cursor-pointer shadow-xs hover:border-[#85845C] hover:shadow-sm transition-all"
                    title={`Open full album: ${event.title}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenAlbum(event, effectiveCoverIdx);
                      }
                    }}
                  >
                    <img
                      src={coverImage?.url || ''}
                      alt={coverImage?.caption || event.title}
                      className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover/cover:scale-104"
                      loading="lazy"
                    />

                    {/* Top-Left: Photo Count Pill */}
                    <div className="absolute top-3 left-3 z-10">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-semibold shadow-xs border border-white/15">
                        <Images className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>{photoCount} {photoCount === 1 ? 'Photo' : 'Photos'}</span>
                      </span>
                    </div>

                    {/* Top-Right: Click to View Hint */}
                    <div className="absolute top-3 right-3 z-10 opacity-90 group-hover/cover:opacity-100 transition-opacity">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#85845C]/90 backdrop-blur-md text-white text-[11px] font-medium shadow-xs">
                        <Eye className="w-3 h-3 text-white" />
                        <span>View HD</span>
                      </span>
                    </div>

                    {/* Hover Overlay with Full Album Trigger */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover/cover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                      <span className="text-white text-xs font-semibold flex items-center gap-2">
                        <Eye className="w-4 h-4 text-[#D4AF37]" />
                        <span>Click to Open Full Album Viewer</span>
                      </span>
                    </div>
                  </div>

                  {/* Remaining Photo Thumbnail Grid */}
                  {previewThumbnails.length > 0 && (
                    <div
                      className={`grid gap-2 sm:gap-2.5 ${
                        previewThumbnails.length === 1
                          ? 'grid-cols-1'
                          : previewThumbnails.length === 2
                          ? 'grid-cols-2'
                          : previewThumbnails.length === 3
                          ? 'grid-cols-3'
                          : 'grid-cols-4'
                      }`}
                    >
                      {previewThumbnails.map((item, thumbIdx) => {
                        const isLastWithHidden = thumbIdx === 3 && hiddenCount > 0;

                        return (
                          <div
                            key={item.img.id || item.originalIdx}
                            onClick={() => handleOpenAlbum(event, item.originalIdx)}
                            className="group/thumb relative aspect-square sm:aspect-[4/3] rounded-lg sm:rounded-xl overflow-hidden border border-[#E5E5DF] bg-[#F5F5F1] cursor-pointer shadow-2xs hover:border-[#85845C] hover:shadow-xs transition-all"
                            title={isLastWithHidden ? `+${hiddenCount} more photos in this album` : `View photo ${item.originalIdx + 1}`}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleOpenAlbum(event, item.originalIdx);
                              }
                            }}
                          >
                            <img
                              src={item.img.url || ''}
                              alt={item.img.caption || `${event.title} - Photo ${item.originalIdx + 1}`}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-108"
                              loading="lazy"
                            />

                            {/* +N Overlay on the 4th thumbnail when extra hidden photos exist */}
                            {isLastWithHidden ? (
                              <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center text-white transition-all group-hover/thumb:bg-black/80">
                                <span className="font-serif font-bold text-base sm:text-lg leading-none">+{hiddenCount}</span>
                                <span className="text-[10px] font-semibold text-[#D4AF37] tracking-wider uppercase mt-0.5">More</span>
                              </div>
                            ) : (
                              <div className="absolute inset-0 bg-[#504F34]/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                <Eye className="w-3.5 h-3.5 text-white" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-36 bg-[#504F34] rounded-xl p-4 flex flex-col items-center justify-center text-white shrink-0">
                  <Calendar className="w-8 h-8 text-[#D4AF37] mb-2" />
                  <span className="text-xs uppercase font-bold tracking-wider text-white/90">Institutional Event</span>
                </div>
              )}

              {/* Event Body */}
              <div className="flex-1 flex flex-col justify-between pt-1">
                <div>
                  {/* Event Date Badge */}
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-[#F5F5F1] text-[#85845C] text-xs font-bold mb-3 border border-[#E5E5DF]">
                    <Calendar className="w-3.5 h-3.5 text-[#85845C]" />
                    <span>{event.date}</span>
                  </div>

                  {/* Event Title */}
                  <h3
                    className="text-base sm:text-lg font-serif font-bold mb-2 leading-snug line-clamp-2 text-[#252525]"
                    style={{ color: theme.headingColor || '#252525' }}
                  >
                    {event.title}
                  </h3>

                  {/* Event Description */}
                  {event.description ? (
                    <p className="text-xs sm:text-sm text-[#666666] leading-relaxed line-clamp-3 mb-4">
                      {event.description}
                    </p>
                  ) : null}
                </div>

                <div className="pt-3.5 border-t border-[#E5E5DF] space-y-3">
                  {/* Event Location */}
                  {event.location ? (
                    <div className="flex items-center space-x-2 text-xs text-[#666666] font-medium">
                      <MapPin className="w-3.5 h-3.5 text-[#85845C] shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  ) : null}

                  {/* View Album Action */}
                  {albumImages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenAlbum(event, effectiveCoverIdx)}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl text-xs font-bold bg-[#85845C] hover:bg-[#6B6A45] active:bg-[#504F34] text-white shadow-xs cursor-pointer transition-colors"
                    >
                      <Images className="w-3.5 h-3.5 text-white" />
                      <span>Open Full Album ({photoCount} {photoCount === 1 ? 'Photo' : 'Photos'})</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Premium Full-Screen Photo Album Lightbox (Rendered via React Portal into document.body) */}
      {activeAlbum && activeAlbum.images.length > 0 && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 w-screen h-screen min-h-[100dvh] max-h-[100dvh] z-[9999] bg-black/95 backdrop-blur-md flex flex-col justify-between overflow-hidden select-none animate-in fade-in duration-200"
              style={{
                position: 'fixed',
                inset: 0,
                width: '100vw',
                height: '100dvh',
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Event Photo Album Gallery"
            >
              {/* Top Information Bar */}
              <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 border-b border-white/10 shrink-0 bg-black/75 backdrop-blur-md z-30 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <div className="min-w-0 pr-3 sm:pr-4 flex-1">
                  <h3 className="text-white text-sm sm:text-base font-serif font-bold truncate">
                    {activeAlbum.event.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#C5C497] mt-0.5">
                    <span className="font-medium text-white/90">{activeAlbum.event.date}</span>
                    {activeAlbum.event.location ? (
                      <>
                        <span className="text-white/40">•</span>
                        <span className="text-white/70 truncate max-w-[140px] sm:max-w-xs">
                          {activeAlbum.event.location}
                        </span>
                      </>
                    ) : null}
                    <span className="text-white/40">•</span>
                    <span className="font-semibold text-[#D4AF37]">
                      Photo {activeAlbum.currentIndex + 1} of {activeAlbum.images.length}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {/* Zoom Button */}
                  <button
                    type="button"
                    onClick={() => setIsZoomed((prev) => !prev)}
                    aria-label={isZoomed ? 'Zoom Out' : 'Zoom In'}
                    title={isZoomed ? 'Zoom Out' : 'Zoom In'}
                    className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 focus:outline-hidden focus:ring-2 focus:ring-[#D4AF37] text-white transition-colors cursor-pointer"
                  >
                    {isZoomed ? <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" /> : <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>

                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={handleCloseAlbum}
                    aria-label="Close Gallery (Esc)"
                    title="Close Gallery (Esc)"
                    className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 focus:outline-hidden focus:ring-2 focus:ring-[#D4AF37] text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>

              {/* Main Viewing Area */}
              <div
                className="flex-1 min-h-0 relative w-full flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden select-none"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={(e) => {
                  if (e.target === e.currentTarget && !isZoomed) {
                    handleCloseAlbum();
                  }
                }}
              >
                {/* Previous Button */}
                {activeAlbum.images.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevImage();
                    }}
                    aria-label="Previous Image (Left Arrow)"
                    title="Previous Image (Left Arrow)"
                    className="absolute left-2 sm:left-4 md:left-6 top-1/2 -translate-y-1/2 z-30 p-2 sm:p-3 rounded-full bg-black/60 hover:bg-[#85845C] focus:outline-hidden focus:ring-2 focus:ring-[#D4AF37] text-white border border-white/20 transition-all shadow-xl hover:scale-110 active:scale-95 cursor-pointer touch-manipulation"
                  >
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                )}

                {/* Active Image and Caption */}
                <div
                  className="relative w-full h-full max-w-full max-h-full flex flex-col items-center justify-center min-h-0 overflow-hidden"
                  onClick={(e) => {
                    if (e.target === e.currentTarget && !isZoomed) {
                      handleCloseAlbum();
                    }
                  }}
                >
                  <div className="relative flex items-center justify-center max-w-full max-h-full min-h-0">
                    <img
                      key={activeAlbum.images[activeAlbum.currentIndex]?.url || activeAlbum.currentIndex}
                      src={activeAlbum.images[activeAlbum.currentIndex]?.url || ''}
                      alt={activeAlbum.images[activeAlbum.currentIndex]?.caption || activeAlbum.event.title}
                      className={`max-w-[calc(100vw-4.5rem)] sm:max-w-[calc(100vw-7rem)] md:max-w-[calc(100vw-9rem)] max-h-[calc(100dvh-10rem)] sm:max-h-[calc(100dvh-11rem)] w-auto h-auto object-contain rounded-lg sm:rounded-xl shadow-2xl transition-transform duration-300 ${
                        isZoomed ? 'scale-125 sm:scale-150 cursor-zoom-out z-20' : 'cursor-zoom-in'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsZoomed((prev) => !prev);
                      }}
                    />
                  </div>

                  {activeAlbum.images[activeAlbum.currentIndex]?.caption ? (
                    <p className="text-white/90 text-xs sm:text-sm font-medium mt-2 text-center max-w-2xl px-3 sm:px-4 shrink-0 bg-black/60 backdrop-blur-xs py-1 rounded-md line-clamp-2">
                      {activeAlbum.images[activeAlbum.currentIndex].caption}
                    </p>
                  ) : null}
                </div>

                {/* Next Button */}
                {activeAlbum.images.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextImage();
                    }}
                    aria-label="Next Image (Right Arrow)"
                    title="Next Image (Right Arrow)"
                    className="absolute right-2 sm:right-4 md:right-6 top-1/2 -translate-y-1/2 z-30 p-2 sm:p-3 rounded-full bg-black/60 hover:bg-[#85845C] focus:outline-hidden focus:ring-2 focus:ring-[#D4AF37] text-white border border-white/20 transition-all shadow-xl hover:scale-110 active:scale-95 cursor-pointer touch-manipulation"
                  >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                )}
              </div>

              {/* Bottom Thumbnails Strip */}
              <div className="px-3 sm:px-4 py-2 sm:py-3 border-t border-white/10 shrink-0 bg-black/75 backdrop-blur-md flex flex-col items-center gap-1.5 sm:gap-2 z-30 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {activeAlbum.images.length > 1 ? (
                  <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto max-w-full py-1 px-2 no-scrollbar">
                    {activeAlbum.images.map((img, idx) => {
                      const isActive = idx === activeAlbum.currentIndex;
                      return (
                        <button
                          key={img.id || idx}
                          type="button"
                          onClick={() => {
                            setIsZoomed(false);
                            setActiveAlbum({ ...activeAlbum, currentIndex: idx });
                          }}
                          className={`relative rounded-lg overflow-hidden shrink-0 transition-all cursor-pointer ${
                            isActive
                              ? 'ring-2 ring-[#D4AF37] ring-offset-2 ring-offset-black scale-105 border-2 border-white'
                              : 'opacity-60 hover:opacity-100 border border-white/20'
                          }`}
                          style={{ width: '48px', height: '48px' }}
                          aria-label={`Jump to photo ${idx + 1}`}
                          title={`Jump to photo ${idx + 1}`}
                        >
                          <img
                            src={img.url || ''}
                            alt={`Thumbnail ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {img.isCover && (
                            <span className="absolute top-0.5 right-0.5 bg-[#85845C] text-white text-[8px] font-bold px-1 rounded-xs">
                              ★
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <p className="text-[10px] sm:text-[11px] text-white/50 text-center select-none">
                  Use ← → arrow keys or swipe left/right to navigate • Click image to zoom • Esc to close
                </p>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
};
