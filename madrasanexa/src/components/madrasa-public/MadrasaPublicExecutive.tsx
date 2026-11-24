import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Award,
  Calendar,
  Quote,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react';
import type { ExecutiveMember, MadrasaThemeTokens } from '../../services/api';

interface MadrasaPublicExecutiveProps {
  executiveMembers: ExecutiveMember[];
  theme: MadrasaThemeTokens;
}

export const MadrasaPublicExecutive: React.FC<MadrasaPublicExecutiveProps> = ({
  executiveMembers,
  theme,
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter only active members (fallback guard) and sort by displayOrder
  const members = (executiveMembers || [])
    .filter((m) => m && m.isActive !== false)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const totalMembers = members.length;

  useEffect(() => {
    if (activeIndex >= totalMembers && totalMembers > 0) {
      setActiveIndex(0);
    }
  }, [totalMembers, activeIndex]);

  if (totalMembers === 0) {
    return null;
  }

  const handleSelectMember = (idx: number) => {
    if (idx === activeIndex || isAnimating) return;
    setIsAnimating(true);
    setActiveIndex(idx);
    setTimeout(() => setIsAnimating(false), 400);
  };

  const handlePrev = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setActiveIndex((prev) => (prev === 0 ? totalMembers - 1 : prev - 1));
    setTimeout(() => setIsAnimating(false), 400);
  };

  const handleNext = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setActiveIndex((prev) => (prev === totalMembers - 1 ? 0 : prev + 1));
    setTimeout(() => setIsAnimating(false), 400);
  };

  const currentMember = members[activeIndex] || members[0];

  // Derive initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join('');
  };

  // Safe adjacent indices for desktop deck preview
  const prevIndex = (activeIndex - 1 + totalMembers) % totalMembers;
  const nextIndex = (activeIndex + 1) % totalMembers;
  const showAdjacentCards = totalMembers >= 3;

  return (
    <section
      id="executive-committee"
      ref={containerRef}
      className="public-section-enter scroll-mt-28 py-6 sm:py-8 overflow-x-clip"
      aria-label="Executive Committee & Board of Management"
    >
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 px-4">
        <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#6B6A45] mb-3 px-3.5 py-1 rounded-full bg-[#F4F3EC] border border-[#E2E0D0] shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-[#6B6A45]" />
          <span>Governance & Leadership</span>
        </div>
        <h2
          className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold tracking-tight text-[#232215]"
          style={{ color: theme.headingColor || '#232215' }}
        >
          Executive Committee & Board
        </h2>
        <p className="mt-2.5 text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Guiding the institution with visionary leadership, steadfast Islamic stewardship, and devoted community governance.
        </p>
      </div>

      {/* Spotlight Deck Showcase Area */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative">
        {/* Desktop Expanding Spotlight Deck Container */}
        <div className="relative flex items-center justify-center min-h-[440px] sm:min-h-[400px]">
          {/* Left Preview Card (Desktop Only: lg+ and if 3+ members) */}
          {showAdjacentCards && (
            <div
              onClick={handlePrev}
              className="hidden lg:flex flex-col items-center justify-center absolute left-0 w-64 h-80 bg-white/70 backdrop-blur-sm rounded-2xl border border-[#E2E0D0]/80 p-5 shadow-sm transform -translate-x-8 scale-90 opacity-60 hover:opacity-90 hover:scale-95 transition-all duration-500 cursor-pointer z-10 select-none group"
              title={`View ${members[prevIndex].fullName}`}
            >
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#F4F3EC] border border-[#E2E0D0] mb-3 group-hover:border-[#6B6A45] transition-colors flex items-center justify-center shrink-0">
                {members[prevIndex].photoUrl ? (
                  <img
                    src={members[prevIndex].photoUrl}
                    alt={members[prevIndex].fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-[#6B6A45]">
                    {getInitials(members[prevIndex].fullName)}
                  </span>
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-800 text-center truncate w-full">
                {members[prevIndex].fullName}
              </h4>
              <span className="text-[11px] font-semibold text-[#6B6A45] mt-1 text-center truncate w-full">
                {members[prevIndex].position}
              </span>
            </div>
          )}

          {/* Central Expanding Spotlight Card */}
          <div
            className={`w-full max-w-2xl bg-[#FDFCF7] border border-[#E2E0D0] rounded-3xl p-5 sm:p-7 md:p-9 shadow-xl shadow-[#6B6A45]/5 relative overflow-hidden bg-islamic-diamond-subtle transition-all duration-500 z-20 ${
              isAnimating ? 'opacity-85 scale-[0.99]' : 'opacity-100 scale-100'
            }`}
          >
            {/* Corner Rub el Hizb Star Watermark Accent */}
            <div
              className="absolute -top-6 -right-6 text-[#6B6A45]/5 pointer-events-none select-none"
              aria-hidden="true"
            >
              <svg width="140" height="140" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.4 2.4H18v3.6L20.4 10.4 22 12l-1.6 1.6-2.4 2.4V20h-3.6L12 22.4 9.6 20H6v-4L3.6 13.6 2 12l1.6-1.6L6 8V4.4h3.6L12 2z" />
              </svg>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8 relative z-10">
              {/* Member Portrait Column */}
              <div className="flex flex-col items-center shrink-0 text-center">
                <div className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-44 md:h-44 rounded-2xl md:rounded-3xl overflow-hidden bg-[#F4F3EC] border-2 border-[#8C8A58]/40 shadow-md ring-4 ring-[#6B6A45]/10 flex items-center justify-center">
                  {currentMember.photoUrl ? (
                    <img
                      src={currentMember.photoUrl}
                      alt={currentMember.fullName}
                      className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                      loading="eager"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#6B6A45] bg-gradient-to-b from-[#F4F3EC] to-[#EAE8DD]">
                      <span className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
                        {getInitials(currentMember.fullName)}
                      </span>
                      <User className="w-5 h-5 mt-1 opacity-50" />
                    </div>
                  )}
                </div>

                {/* Position Pill */}
                <div className="mt-3.5 inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold tracking-wide bg-[#6B6A45] text-white shadow-xs">
                  {currentMember.position}
                </div>

                {/* Term Period */}
                {currentMember.termPeriod && (
                  <div className="flex items-center space-x-1 text-[11px] font-medium text-slate-500 mt-2">
                    <Calendar className="w-3 h-3 text-[#8C8A58]" />
                    <span>{currentMember.termPeriod}</span>
                  </div>
                )}
              </div>

              {/* Bio & Information Column */}
              <div className="flex-1 text-center sm:text-left min-w-0">
                {/* Full Name */}
                <h3 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-[#232215] tracking-tight">
                  {currentMember.fullName}
                </h3>

                {/* Qualification / Honorific */}
                {currentMember.qualification && (
                  <div className="inline-flex items-center space-x-1.5 mt-1 text-xs sm:text-sm font-semibold text-[#8C8A58]">
                    <Award className="w-3.5 h-3.5 shrink-0" />
                    <span>{currentMember.qualification}</span>
                  </div>
                )}

                {/* Decorative Divider */}
                <div className="my-3.5 flex items-center justify-center sm:justify-start space-x-2">
                  <div className="h-[1px] w-12 bg-gradient-to-r from-[#6B6A45]/40 to-transparent" />
                  <span className="text-xs text-[#8C8A58]">۞</span>
                  <div className="h-[1px] w-12 bg-gradient-to-l from-[#6B6A45]/40 to-transparent" />
                </div>

                {/* Message / Bio / Quote */}
                <div className="relative mt-2">
                  <Quote className="w-6 h-6 text-[#6B6A45]/20 absolute -top-2 -left-2 hidden sm:block pointer-events-none" />
                  <p className="text-xs sm:text-sm md:text-base leading-relaxed text-[#2C2B22] font-medium italic sm:pl-5">
                    {currentMember.messageOrBio
                      ? `"${currentMember.messageOrBio}"`
                      : 'Devoted to preserving sacred knowledge, nurturing authentic Islamic ethics, and serving the students, faculty, and broader community with sincerity and vision.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Preview Card (Desktop Only: lg+ and if 3+ members) */}
          {showAdjacentCards && (
            <div
              onClick={handleNext}
              className="hidden lg:flex flex-col items-center justify-center absolute right-0 w-64 h-80 bg-white/70 backdrop-blur-sm rounded-2xl border border-[#E2E0D0]/80 p-5 shadow-sm transform translate-x-8 scale-90 opacity-60 hover:opacity-90 hover:scale-95 transition-all duration-500 cursor-pointer z-10 select-none group"
              title={`View ${members[nextIndex].fullName}`}
            >
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#F4F3EC] border border-[#E2E0D0] mb-3 group-hover:border-[#6B6A45] transition-colors flex items-center justify-center shrink-0">
                {members[nextIndex].photoUrl ? (
                  <img
                    src={members[nextIndex].photoUrl}
                    alt={members[nextIndex].fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-[#6B6A45]">
                    {getInitials(members[nextIndex].fullName)}
                  </span>
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-800 text-center truncate w-full">
                {members[nextIndex].fullName}
              </h4>
              <span className="text-[11px] font-semibold text-[#6B6A45] mt-1 text-center truncate w-full">
                {members[nextIndex].position}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Controls & Pagination */}
        {totalMembers > 1 && (
          <div className="mt-6 flex flex-col items-center space-y-4">
            {/* Arrow Controls & Counter */}
            <div className="flex items-center justify-center space-x-4">
              <button
                type="button"
                onClick={handlePrev}
                disabled={isAnimating}
                aria-label="Previous Executive Member"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[#E2E0D0] bg-white hover:bg-[#F4F3EC] text-[#6B6A45] flex items-center justify-center shadow-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <span className="text-xs font-semibold text-slate-600 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                {activeIndex + 1} of {totalMembers}
              </span>

              <button
                type="button"
                onClick={handleNext}
                disabled={isAnimating}
                aria-label="Next Executive Member"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[#E2E0D0] bg-white hover:bg-[#F4F3EC] text-[#6B6A45] flex items-center justify-center shadow-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Horizontal Touch-Friendly Member Avatar Selector Row */}
            <div className="w-full overflow-x-auto no-scrollbar py-2 px-1 flex items-center justify-center">
              <div className="inline-flex items-center space-x-2 sm:space-x-3">
                {members.map((member, idx) => {
                  const isCurrent = idx === activeIndex;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleSelectMember(idx)}
                      className={`group relative flex flex-col items-center shrink-0 p-1 rounded-xl transition-all ${
                        isCurrent
                          ? 'scale-110 opacity-100'
                          : 'opacity-60 hover:opacity-100 hover:scale-105'
                      }`}
                      title={`${member.fullName} (${member.position})`}
                    >
                      <div
                        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-[#F4F3EC] flex items-center justify-center border-2 transition-all ${
                          isCurrent
                            ? 'border-[#6B6A45] ring-2 ring-[#6B6A45]/30 shadow-sm'
                            : 'border-[#E2E0D0] group-hover:border-[#8C8A58]'
                        }`}
                      >
                        {member.photoUrl ? (
                          <img
                            src={member.photoUrl}
                            alt={member.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[11px] font-bold text-[#6B6A45]">
                            {getInitials(member.fullName)}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-semibold mt-1 max-w-[64px] truncate text-center ${
                          isCurrent ? 'text-[#6B6A45] font-bold' : 'text-slate-500'
                        }`}
                      >
                        {member.fullName.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
