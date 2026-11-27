import React, { useState } from 'react';
import { BellRing, Calendar, AlertCircle, ArrowRight, X, FileText, CheckCircle2 } from 'lucide-react';
import type { MadrasaProfileNotice, MadrasaThemeTokens } from '../../services/api';

interface MadrasaPublicNoticesProps {
  notices: MadrasaProfileNotice[];
  theme: MadrasaThemeTokens;
  madrasaName?: string;
}

export const MadrasaPublicNotices: React.FC<MadrasaPublicNoticesProps> = ({
  notices,
  madrasaName = 'Our Madrasa',
}) => {
  const [selectedNotice, setSelectedNotice] = useState<MadrasaProfileNotice | null>(null);

  // Strictly return null if no notices exist in the database for this tenant — zero fake notices
  if (!notices || notices.length === 0) {
    return null;
  }

  return (
    <section id="notices" className="scroll-mt-28 py-6">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12 px-4">
        <div className="inline-flex items-center space-x-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#0B3B2C] mb-2.5 px-3.5 py-1.5 rounded-full bg-[#FAF8F3] border border-[#C5A059]/40 shadow-2xs">
          <BellRing className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Official Announcements</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight text-[#1C2826] mb-3">
          Institutional Circulars & Notices
        </h2>
        <div className="w-16 h-1 bg-gradient-to-r from-[#0B3B2C] via-[#C5A059] to-[#0B3B2C] mx-auto rounded-full mb-3" />
        <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Official communiqués, academic bulletins, and administrative notices published by {madrasaName}.
        </p>
      </div>

      {/* Editorial Notices Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 items-stretch">
        {notices.map((notice) => {
          const isUrgent = notice.priority === 'URGENT';

          return (
            <div
              key={notice.id}
              className={`bg-white rounded-2xl border overflow-hidden p-6 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between group ${
                isUrgent ? 'border-amber-400/80 bg-amber-50/20' : 'border-[#E5E0D5]'
              }`}
            >
              <div>
                {/* Header Metadata: Category + Date */}
                <div className="flex items-center justify-between gap-2 mb-3.5 pb-3 border-b border-[#F0ECE1]">
                  {isUrgent ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                      <span>Urgent Notice</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FAF8F3] text-[#0B3B2C] border border-[#C5A059]/30">
                      <FileText className="w-3.5 h-3.5 text-[#C5A059]" />
                      <span>Official Bulletin</span>
                    </span>
                  )}

                  <span className="text-xs text-slate-500 font-medium flex items-center space-x-1.5 shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{notice.postedAt}</span>
                  </span>
                </div>

                {/* Optional Notice Image Poster with Error Handling (Never breaks) */}
                {notice.posterUrl ? (
                  <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-slate-50 border border-[#E5E0D5] mb-4">
                    <img
                      src={notice.posterUrl}
                      alt={notice.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                ) : null}

                {/* Notice Title */}
                <h3 className="text-base sm:text-lg font-serif font-bold text-[#1C2826] group-hover:text-[#0B3B2C] transition-colors mb-2.5 leading-snug line-clamp-2">
                  {notice.title}
                </h3>

                {/* Notice Content Snippet */}
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal whitespace-pre-line line-clamp-4 mb-4">
                  {notice.content}
                </p>
              </div>

              {/* Read Full Notice Trigger */}
              <button
                type="button"
                onClick={() => setSelectedNotice(notice)}
                className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[#0B3B2C] group-hover:text-[#C5A059] transition-colors pt-3 border-t border-[#F0ECE1] w-full text-left cursor-pointer"
              >
                <span>Read Full Circular</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Full Notice Reading Modal */}
      {selectedNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setSelectedNotice(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-[#E5E0D5] relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedNotice(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#FAF8F3] hover:bg-[#F0ECE1] border border-[#E5E0D5] flex items-center justify-center text-slate-600 hover:text-[#1C2826] transition-colors cursor-pointer"
              aria-label="Close Notice"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center space-x-2.5 mb-3">
              {selectedNotice.priority === 'URGENT' ? (
                <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                  <span>Urgent Notice</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#FAF8F3] text-[#0B3B2C] border border-[#C5A059]/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0B3B2C]" />
                  <span>Official Circular</span>
                </span>
              )}
              <span className="text-xs text-slate-500 font-medium">
                Posted on {selectedNotice.postedAt}
              </span>
            </div>

            <h2 className="font-serif font-bold text-xl sm:text-2xl text-[#1C2826] mb-4 leading-tight">
              {selectedNotice.title}
            </h2>

            {/* Poster if present */}
            {selectedNotice.posterUrl ? (
              <div className="w-full rounded-xl overflow-hidden border border-[#E5E0D5] mb-5 bg-slate-50">
                <img
                  src={selectedNotice.posterUrl}
                  alt={selectedNotice.title}
                  className="w-full h-auto max-h-96 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            ) : null}

            {/* Notice Body */}
            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal whitespace-pre-line border-t border-[#F0ECE1] pt-4">
              {selectedNotice.content}
            </div>

            {/* Modal Footer */}
            <div className="mt-6 pt-4 border-t border-[#F0ECE1] flex items-center justify-between text-xs text-slate-500">
              <span>{madrasaName} Official Administration</span>
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                className="px-4 py-2 rounded-xl bg-[#0B3B2C] hover:bg-[#07281D] text-white font-bold uppercase tracking-wider text-[11px] shadow-xs cursor-pointer"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
