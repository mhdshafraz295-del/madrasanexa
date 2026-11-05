import React from 'react';
import { BellRing, Clock, AlertCircle } from 'lucide-react';
import type { MadrasaProfileNotice, MadrasaThemeTokens } from '../../services/api';

interface MadrasaPublicNoticesProps {
  notices: MadrasaProfileNotice[];
  theme: MadrasaThemeTokens;
}

export const MadrasaPublicNotices: React.FC<MadrasaPublicNoticesProps> = ({
  notices,
  theme,
}) => {
  if (!notices || notices.length === 0) {
    return null;
  }

  return (
    <section id="notices" className="scroll-mt-28 public-section-enter">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
        <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#85845C] mb-2 px-3.5 py-1 rounded-full bg-[#F5F5F1] border border-[#E5E5DF] shadow-2xs">
          <BellRing className="w-3.5 h-3.5 text-[#85845C]" />
          <span>Official Announcements</span>
        </div>
        <h2
          className="text-2xl sm:text-4xl font-serif font-bold tracking-tight mb-3 text-[#252525]"
          style={{ color: theme.headingColor || '#252525' }}
        >
          Institutional Circulars & Notices
        </h2>
        <p className="text-sm sm:text-base text-[#666666] max-w-xl mx-auto">
          Official communiqués and guidelines issued by the madrasa administration.
        </p>
        <div className="w-16 h-1 bg-gradient-to-r from-[#85845C] via-[#A5A477] to-[#85845C] mx-auto rounded-full mt-3" />
      </div>

      {/* Notices Centered & Balanced Layout */}
      <div className="flex flex-wrap justify-center gap-7 items-stretch">
        {notices.map((notice) => {
          const isUrgent = notice.priority === 'URGENT';

          return (
            <div
              key={notice.id}
              className={`w-full md:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.2rem)] max-w-md bg-white rounded-2xl border flex flex-col justify-between overflow-hidden shadow-xs transition-all hover:shadow-md ${
                isUrgent
                  ? 'border-[#E56A45] ring-1 ring-[#E56A45]/30'
                  : 'border-[#E5E5DF] hover:border-[#85845C]/50'
              }`}
            >
              {/* Optional Notice Poster */}
              {notice.posterUrl ? (
                <div className="w-full aspect-[16/9] bg-[#F5F5F1] border-b border-[#E5E5DF] shrink-0 overflow-hidden">
                  <img
                    src={notice.posterUrl}
                    alt={notice.title}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-104"
                    loading="lazy"
                  />
                </div>
              ) : null}

              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <span className="text-xs text-[#666666] font-medium flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#666666]" />
                      <span>{notice.postedAt}</span>
                    </span>

                    {isUrgent ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E56A45]/15 text-[#E56A45] border border-[#E56A45]/30">
                        <AlertCircle className="w-3 h-3 text-[#E56A45]" />
                        <span>Urgent Notice</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F5F5F1] text-[#85845C] border border-[#E5E5DF]">
                        Official Circular
                      </span>
                    )}
                  </div>

                  <h3
                    className="text-base sm:text-lg font-serif font-bold mb-2.5 leading-snug line-clamp-2 text-[#252525]"
                    style={{ color: theme.headingColor || '#252525' }}
                  >
                    {notice.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#252525] leading-relaxed whitespace-pre-line line-clamp-5">
                    {notice.content}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
