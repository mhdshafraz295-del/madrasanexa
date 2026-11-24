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
    setTimeout(() => setIsAnimating(false), 450);
  };

  const handlePrev = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setActiveIndex((prev) => (prev === 0 ? totalMembers - 1 : prev - 1));
    setTimeout(() => setIsAnimating(false), 450);
  };

  const handleNext = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setActiveIndex((prev) => (prev === totalMembers - 1 ? 0 : prev + 1));
    setTimeout(() => setIsAnimating(false), 450);
  };

  const currentMember = members[activeIndex] || members[0];

  // Helper: derive initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join('');
  };

  // Derive visible flanking cards for desktop Calendly-style deck (up to 2 left, 2 right)
  const getFlankingCards = () => {
    if (totalMembers <= 1) {
      return { left: [], right: [] };
    }
    if (totalMembers === 2) {
      const otherIdx = (activeIndex + 1) % 2;
      return { left: [otherIdx], right: [] };
    }
    if (totalMembers === 3) {
      const leftIdx = (activeIndex - 1 + 3) % 3;
      const rightIdx = (activeIndex + 1) % 3;
      return { left: [leftIdx], right: [rightIdx] };
    }
    if (totalMembers === 4) {
      const leftIdx = (activeIndex - 1 + 4) % 4;
      const right1 = (activeIndex + 1) % 4;
      const right2 = (activeIndex + 2) % 4;
      return { left: [leftIdx], right: [right1, right2] };
    }
    // 5 or more members: 2 on left, 2 on right
    const left2 = (activeIndex - 2 + totalMembers) % totalMembers;
    const left1 = (activeIndex - 1 + totalMembers) % totalMembers;
    const right1 = (activeIndex + 1) % totalMembers;
    const right2 = (activeIndex + 2) % totalMembers;
    return { left: [left2, left1], right: [right1, right2] };
  };

  const { left: leftIndices, right: rightIndices } = getFlankingCards();

  return (
    <section
      id="executive-committee"
      ref={containerRef}
      className="public-section-enter scroll-mt-28 py-8 sm:py-12 overflow-x-clip"
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

      {/* ========================================================= */}
      {/* DESKTOP CALENDLY-STYLE EXPANDING DECK (Hidden on < lg)   */}
      {/* ========================================================= */}
      <div className="hidden lg:block max-w-6xl mx-auto px-4 xl:px-6 relative">
        <div className="flex items-stretch justify-center gap-3.5 xl:gap-4.5 max-w-6xl mx-auto overflow-hidden py-3">
          {/* Left Collapsed Cards */}
          {leftIndices.map((idx) => {
            const member = members[idx];
            return (
              <div
                key={`left-${member.id}-${idx}`}
                onClick={() => handleSelectMember(idx)}
                className="w-[115px] xl:w-[135px] h-[380px] rounded-2xl overflow-hidden cursor-pointer relative group transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 shrink-0 border border-[#E2E0D0] bg-[#F3F1E6] shadow-sm hover:shadow-md select-none"
                title={`View ${member.fullName} (${member.position})`}
              >
                {member.photoUrl ? (
                  <img
                    src={member.photoUrl}
                    alt={member.fullName}
                    className="w-full h-full object-cover object-top brightness-90 group-hover:brightness-100 group-hover:scale-105 transition-all duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#F4F3EC] to-[#E5E3D5] text-[#6B6A45]">
                    <span className="text-xl font-bold font-serif">{getInitials(member.fullName)}</span>
                    <User className="w-4 h-4 mt-1 opacity-50" />
                  </div>
                )}
                {/* Subtle dark-olive gradient overlay with name & position */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1F1E12]/95 via-[#1F1E12]/35 to-transparent flex flex-col justify-end p-2.5 text-center">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#6B6A45]/90 text-white truncate max-w-full mb-1">
                    {member.position}
                  </span>
                  <span className="text-xs font-bold text-white truncate drop-shadow-sm">
                    {member.fullName.split(' ')[0]}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Expanded Active Card (Center Spotlight) */}
          <div
            className={`w-[580px] xl:w-[660px] h-[380px] rounded-3xl bg-white border border-[#E2E0D0] shadow-xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] shrink-0 flex overflow-hidden relative bg-islamic-diamond-subtle ${
              isAnimating ? 'opacity-90 scale-[0.995]' : 'opacity-100 scale-100'
            }`}
          >
            {/* Background Geometric Accent */}
            <div
              className="absolute -top-10 -right-10 text-[#6B6A45]/5 pointer-events-none select-none"
              aria-hidden="true"
            >
              <svg width="180" height="180" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.4 2.4H18v3.6L20.4 10.4 22 12l-1.6 1.6-2.4 2.4V20h-3.6L12 22.4 9.6 20H6v-4L3.6 13.6 2 12l1.6-1.6L6 8V4.4h3.6L12 2z" />
              </svg>
            </div>

            {/* Left Content Pane */}
            <div className="flex-1 p-6 sm:p-7 flex flex-col justify-between overflow-hidden relative z-10">
              {/* Top: Position Pill + Term Period */}
              <div className="flex items-center flex-wrap gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#6B6A45] text-white shadow-xs">
                  {currentMember.position}
                </span>
                {currentMember.termPeriod && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F4F3EC] border border-[#E2E0D0] text-slate-600">
                    <Calendar className="w-3 h-3 text-[#8C8A58]" />
                    <span>{currentMember.termPeriod}</span>
                  </span>
                )}
              </div>

              {/* Middle: Crisp Quote / Message */}
              <div className="relative my-auto py-2">
                <Quote className="w-5 h-5 text-[#6B6A45]/20 absolute -top-1 -left-1 pointer-events-none" />
                <p className="text-xs sm:text-sm xl:text-[14.5px] leading-relaxed text-[#232215] font-medium italic pl-4 line-clamp-4">
                  {currentMember.messageOrBio
                    ? `"${currentMember.messageOrBio}"`
                    : '"Devoted to preserving sacred Islamic knowledge, nurturing steadfast character, and serving the students and community with vision and integrity."'}
                </p>
              </div>

              {/* Bottom: Name & Qualifications */}
              <div className="pt-2 border-t border-[#E2E0D0]/60">
                <h3 className="text-lg xl:text-xl font-bold font-serif text-[#232215] truncate tracking-tight">
                  {currentMember.fullName}
                </h3>
                {currentMember.qualification && (
                  <div className="text-xs font-semibold text-[#6B6A45] mt-0.5 flex items-center space-x-1.5 truncate">
                    <Award className="w-3.5 h-3.5 text-[#8C8A58] shrink-0" />
                    <span className="truncate">{currentMember.qualification}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Portrait Pane */}
            <div className="w-[230px] xl:w-[260px] shrink-0 p-3 flex items-center justify-center bg-gradient-to-r from-transparent to-[#F8F7F2]/60">
              <div className="w-full h-full rounded-2xl overflow-hidden bg-[#F3F1E6] border border-[#E2E0D0]/80 relative shadow-inner">
                {currentMember.photoUrl ? (
                  <img
                    src={currentMember.photoUrl}
                    alt={currentMember.fullName}
                    className="w-full h-full object-cover object-top transition-transform duration-700 hover:scale-105"
                    loading="eager"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#F4F3EC] to-[#E5E3D5] text-[#6B6A45]">
                    <span className="text-3xl font-bold font-serif">{getInitials(currentMember.fullName)}</span>
                    <User className="w-6 h-6 mt-1.5 opacity-40" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Collapsed Cards */}
          {rightIndices.map((idx) => {
            const member = members[idx];
            return (
              <div
                key={`right-${member.id}-${idx}`}
                onClick={() => handleSelectMember(idx)}
                className="w-[115px] xl:w-[135px] h-[380px] rounded-2xl overflow-hidden cursor-pointer relative group transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 shrink-0 border border-[#E2E0D0] bg-[#F3F1E6] shadow-sm hover:shadow-md select-none"
                title={`View ${member.fullName} (${member.position})`}
              >
                {member.photoUrl ? (
                  <img
                    src={member.photoUrl}
                    alt={member.fullName}
                    className="w-full h-full object-cover object-top brightness-90 group-hover:brightness-100 group-hover:scale-105 transition-all duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#F4F3EC] to-[#E5E3D5] text-[#6B6A45]">
                    <span className="text-xl font-bold font-serif">{getInitials(member.fullName)}</span>
                    <User className="w-4 h-4 mt-1 opacity-50" />
                  </div>
                )}
                {/* Subtle dark-olive gradient overlay with name & position */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1F1E12]/95 via-[#1F1E12]/35 to-transparent flex flex-col justify-end p-2.5 text-center">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#6B6A45]/90 text-white truncate max-w-full mb-1">
                    {member.position}
                  </span>
                  <span className="text-xs font-bold text-white truncate drop-shadow-sm">
                    {member.fullName.split(' ')[0]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Controls: Prev/Next & Counter */}
        {totalMembers > 1 && (
          <div className="mt-5 flex items-center justify-center space-x-4">
            <button
              type="button"
              onClick={handlePrev}
              disabled={isAnimating}
              aria-label="Previous Executive Member"
              className="w-9 h-9 rounded-full border border-[#E2E0D0] bg-white hover:bg-[#F4F3EC] text-[#6B6A45] flex items-center justify-center shadow-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-semibold text-slate-600 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
              {activeIndex + 1} of {totalMembers}
            </span>

            <button
              type="button"
              onClick={handleNext}
              disabled={isAnimating}
              aria-label="Next Executive Member"
              className="w-9 h-9 rounded-full border border-[#E2E0D0] bg-white hover:bg-[#F4F3EC] text-[#6B6A45] flex items-center justify-center shadow-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MOBILE / TABLET LAYOUT (< lg, 360px to 1023px)            */}
      {/* ========================================================= */}
      <div className="block lg:hidden max-w-md mx-auto px-4">
        {/* Single-Column Spotlight Card */}
        <div
          className={`w-full rounded-3xl bg-white border border-[#E2E0D0] shadow-lg overflow-hidden bg-islamic-diamond-subtle transition-all duration-400 ${
            isAnimating ? 'opacity-85 scale-[0.99]' : 'opacity-100 scale-100'
          }`}
        >
          {/* Portrait Image Frame */}
          <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-[#F3F1E6]">
            {currentMember.photoUrl ? (
              <img
                src={currentMember.photoUrl}
                alt={currentMember.fullName}
                className="w-full h-full object-cover object-top"
                loading="eager"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#F4F3EC] to-[#E5E3D5] text-[#6B6A45]">
                <span className="text-4xl font-serif font-bold">{getInitials(currentMember.fullName)}</span>
                <User className="w-7 h-7 mt-2 opacity-40" />
              </div>
            )}

            {/* Position Pill Floating on Bottom Left */}
            <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#6B6A45] text-white shadow-md">
              {currentMember.position}
            </div>

            {/* Term Period Floating on Bottom Right */}
            {currentMember.termPeriod && (
              <div className="absolute bottom-3 right-3 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/90 backdrop-blur-xs border border-[#E2E0D0] text-slate-700 shadow-xs flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-[#8C8A58]" />
                <span>{currentMember.termPeriod}</span>
              </div>
            )}
          </div>

          {/* Member Details */}
          <div className="p-5 sm:p-6 space-y-3">
            <div>
              <h3 className="text-lg sm:text-xl font-bold font-serif text-[#232215] tracking-tight">
                {currentMember.fullName}
              </h3>
              {currentMember.qualification && (
                <div className="text-xs sm:text-sm font-semibold text-[#6B6A45] mt-0.5 flex items-center space-x-1.5">
                  <Award className="w-3.5 h-3.5 text-[#8C8A58] shrink-0" />
                  <span>{currentMember.qualification}</span>
                </div>
              )}
            </div>

            {/* Quote / Message */}
            <div className="relative pl-3 border-l-2 border-[#6B6A45]/40 py-1">
              <p className="text-xs sm:text-sm text-[#232215] italic leading-relaxed line-clamp-4">
                {currentMember.messageOrBio
                  ? `"${currentMember.messageOrBio}"`
                  : '"Devoted to preserving sacred Islamic knowledge, nurturing steadfast character, and serving the community with vision and integrity."'}
              </p>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Controls & Avatar Row */}
        {totalMembers > 1 && (
          <div className="mt-5 space-y-3.5">
            {/* Prev/Next and Counter */}
            <div className="flex items-center justify-center space-x-4">
              <button
                type="button"
                onClick={handlePrev}
                disabled={isAnimating}
                aria-label="Previous Executive Member"
                className="w-9 h-9 rounded-full border border-[#E2E0D0] bg-white hover:bg-[#F4F3EC] text-[#6B6A45] flex items-center justify-center shadow-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-semibold text-slate-600 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                {activeIndex + 1} of {totalMembers}
              </span>

              <button
                type="button"
                onClick={handleNext}
                disabled={isAnimating}
                aria-label="Next Executive Member"
                className="w-9 h-9 rounded-full border border-[#E2E0D0] bg-white hover:bg-[#F4F3EC] text-[#6B6A45] flex items-center justify-center shadow-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Circular Avatar Selector Bar */}
            <div className="w-full overflow-x-auto no-scrollbar py-1 px-1 flex items-center justify-center">
              <div className="inline-flex items-center space-x-2">
                {members.map((member, idx) => {
                  const isCurrent = idx === activeIndex;
                  return (
                    <button
                      key={`mob-avatar-${member.id}-${idx}`}
                      type="button"
                      onClick={() => handleSelectMember(idx)}
                      className={`relative shrink-0 p-0.5 rounded-xl transition-all ${
                        isCurrent ? 'scale-110 opacity-100' : 'opacity-60 hover:opacity-100'
                      }`}
                      title={`${member.fullName} (${member.position})`}
                    >
                      <div
                        className={`w-11 h-11 rounded-xl overflow-hidden bg-[#F3F1E6] flex items-center justify-center border-2 transition-all ${
                          isCurrent
                            ? 'border-[#6B6A45] ring-2 ring-[#6B6A45]/30 shadow-sm'
                            : 'border-[#E2E0D0]'
                        }`}
                      >
                        {member.photoUrl ? (
                          <img
                            src={member.photoUrl}
                            alt={member.fullName}
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          <span className="text-[11px] font-bold text-[#6B6A45]">
                            {getInitials(member.fullName)}
                          </span>
                        )}
                      </div>
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
