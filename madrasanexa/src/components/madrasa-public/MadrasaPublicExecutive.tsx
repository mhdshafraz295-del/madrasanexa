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
  theme: _theme,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter only active members and sort by displayOrder
  const members = (executiveMembers || [])
    .filter((m) => m && m.isActive !== false)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const totalMembers = members.length;

  // Helper to identify President (excluding Vice President)
  const isPresident = (pos: string) => {
    const p = (pos || '').toLowerCase();
    return p.includes('president') && !p.includes('vice');
  };

  // Helper to identify Principal / Mudir
  const isPrincipal = (pos: string) => {
    const p = (pos || '').toLowerCase();
    return p.includes('principal') || p.includes('mudir');
  };

  // Partition into Featured Dual Leadership (President & Principal/Mudir) and Committee Members
  const president = members.find((m) => isPresident(m.position));
  const principal = members.find((m) => isPrincipal(m.position));
  const leadershipMembers = [president, principal].filter(Boolean) as ExecutiveMember[];
  const leadershipIds = new Set(leadershipMembers.map((m) => m.id));

  // The remaining members for the persistent-card expanding deck
  const committeeMembers = members.filter((m) => !leadershipIds.has(m.id));

  // Active state for committee deck
  const [activeCommitteeId, setActiveCommitteeId] = useState<string>('');

  useEffect(() => {
    if (committeeMembers.length > 0) {
      if (!activeCommitteeId || !committeeMembers.some((m) => m.id === activeCommitteeId)) {
        setActiveCommitteeId(committeeMembers[0].id);
      }
    }
  }, [committeeMembers, activeCommitteeId]);

  if (totalMembers === 0) {
    return null;
  }

  // Derive initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join('');
  };

  // Committee members navigation helpers
  const currentCommitteeIdx = Math.max(
    0,
    committeeMembers.findIndex((m) => m.id === activeCommitteeId)
  );

  const activeCommitteeMember = committeeMembers[currentCommitteeIdx] || committeeMembers[0];

  const handlePrevCommittee = () => {
    if (committeeMembers.length <= 1) return;
    const prevIdx = (currentCommitteeIdx - 1 + committeeMembers.length) % committeeMembers.length;
    setActiveCommitteeId(committeeMembers[prevIdx].id);
  };

  const handleNextCommittee = () => {
    if (committeeMembers.length <= 1) return;
    const nextIdx = (currentCommitteeIdx + 1) % committeeMembers.length;
    setActiveCommitteeId(committeeMembers[nextIdx].id);
  };

  // Window visible cards for persistent-card expanding track (max 5 persistent cards around active)
  const getVisibleCommitteeCards = () => {
    const len = committeeMembers.length;
    if (len <= 5) {
      return committeeMembers;
    }
    const idx = currentCommitteeIdx;
    const windowedIndices = [
      (idx - 2 + len) % len,
      (idx - 1 + len) % len,
      idx,
      (idx + 1) % len,
      (idx + 2) % len,
    ];
    return windowedIndices.map((i) => committeeMembers[i]);
  };

  const visibleCommitteeCards = getVisibleCommitteeCards();

  return (
    <section
      id="executive-board"
      ref={containerRef}
      className="public-section-enter scroll-mt-28 py-8 sm:py-12 overflow-x-clip"
      aria-label="Executive Board & Leadership"
    >
      {/* Leadership Gold Shimmer & Sheen Keyframes */}
      <style>{`
        @keyframes executiveGoldSweep {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes executiveGoldSheen {
          0% { transform: translateX(-150%); opacity: 0; }
          25% { opacity: 0.65; }
          50% { opacity: 0.65; }
          100% { transform: translateX(250%); opacity: 0; }
        }
        .executive-gold-pill-shimmer {
          background-size: 200% 100%;
          animation: executiveGoldSweep 4s ease-in-out infinite;
        }
        .executive-gold-pill-sheen {
          animation: executiveGoldSheen 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14 px-4">
        <div className="inline-flex items-center space-x-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#0B3B2C] mb-2.5 px-3.5 py-1.5 rounded-full bg-[#FAF8F3] border border-[#C5A059]/40 shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Governance & Leadership</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight text-[#1C2826] mb-3">
          Executive Committee & Board
        </h2>
        <div className="w-16 h-1 bg-gradient-to-r from-[#0B3B2C] via-[#C5A059] to-[#0B3B2C] mx-auto rounded-full mb-3" />
        <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Guiding the institution with visionary leadership, steadfast Islamic stewardship, and devoted community governance.
        </p>
      </div>

      {/* ========================================================= */}
      {/* 1. TOP DUAL LEADERSHIP SPOTLIGHT (President & Mudir)     */}
      {/* ========================================================= */}
      {leadershipMembers.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-12 sm:mb-16">
          <div
            className={`grid grid-cols-1 ${
              leadershipMembers.length > 1 ? 'md:grid-cols-2' : 'max-w-2xl mx-auto'
            } gap-6`}
          >
            {leadershipMembers.map((leader) => (
              <div
                key={leader.id}
                className="bg-white rounded-2xl border-0 shadow-xs hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col sm:flex-row relative hover:-translate-y-1.5 group"
              >
                {/* Left Content Pane */}
                <div className="flex-1 p-6 sm:p-7 flex flex-col justify-between space-y-4 relative z-10">
                  {/* Badges: Animated Antique Gold Leadership Crest Pill + Term Period */}
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="relative inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-[#B58D3D] via-[#DFC076] to-[#B58D3D] bg-[length:200%_100%] executive-gold-pill-shimmer text-[#1F1B0E] border border-[#F0D999]/80 shadow-xs overflow-hidden">
                      {/* Subtle continuous gold-sweep sheen overlay */}
                      <span
                        className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none executive-gold-pill-sheen"
                        aria-hidden="true"
                      />
                      <ShieldCheck className="w-3.5 h-3.5 text-[#1F1B0E] shrink-0 relative z-10" />
                      <span className="relative z-10">{leader.position}</span>
                    </span>
                    {leader.termPeriod && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FAF8F3] border border-[#C5A059]/30 text-[#0B3B2C]">
                        <Calendar className="w-3 h-3 text-[#C5A059]" />
                        <span>{leader.termPeriod}</span>
                      </span>
                    )}
                  </div>

                  {/* Leadership Message / Quote */}
                  <div className="relative py-1">
                    <Quote className="w-5 h-5 text-[#C5A059]/30 absolute -top-1 -left-1 pointer-events-none" />
                    <p className="text-xs sm:text-sm leading-relaxed text-slate-700 font-medium italic pl-4 line-clamp-5">
                      {leader.messageOrBio
                        ? `"${leader.messageOrBio}"`
                        : '"Dedicated to uplifting Islamic scholarship, preserving sacred traditions, and guiding students and teachers with steadfast wisdom and community service."'}
                    </p>
                  </div>

                  {/* Name & Qualifications */}
                  <div className="pt-2 border-t border-[#F0ECE1]">
                    <h3 className="text-lg sm:text-xl font-bold font-serif text-[#1C2826] group-hover:text-[#0B3B2C] transition-colors tracking-tight">
                      {leader.fullName}
                    </h3>
                    {leader.qualification && (
                      <div className="text-xs sm:text-sm font-semibold text-[#0B3B2C] mt-0.5 flex items-center space-x-1.5">
                        <Award className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                        <span>{leader.qualification}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Portrait Pane */}
                <div className="w-full sm:w-[200px] md:w-[220px] lg:w-[230px] shrink-0 p-3 sm:p-3.5 flex items-center justify-center bg-gradient-to-r from-transparent to-[#FAF8F3]/60">
                  <div className="w-full h-56 sm:h-full min-h-[220px] rounded-2xl overflow-hidden bg-[#FAF8F3] border border-[#E5E0D5] relative shadow-inner">
                    {leader.photoUrl ? (
                      <>
                        <img
                          src={leader.photoUrl}
                          alt={leader.fullName}
                          className="w-full h-full object-cover object-top transition-transform duration-700 hover:scale-105"
                          loading="eager"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement?.querySelector('.exec-fallback-avatar');
                            if (fallback) (fallback as HTMLElement).style.display = 'flex';
                          }}
                        />
                        <div className="exec-fallback-avatar hidden w-full h-full flex-col items-center justify-center bg-gradient-to-b from-[#F4F3EC] to-[#E5E3D5] text-[#0B3B2C]">
                          <span className="text-3xl font-bold font-serif">{getInitials(leader.fullName)}</span>
                          <User className="w-6 h-6 mt-1.5 opacity-40" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#F4F3EC] to-[#E5E3D5] dark:from-[#1C222D] dark:to-[#242936] text-[#6B6A45] dark:text-[#84CC16]">
                        <span className="text-3xl font-bold font-serif">{getInitials(leader.fullName)}</span>
                        <User className="w-6 h-6 mt-1.5 opacity-40" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. BOARD & COMMITTEE MEMBERS (PERSISTENT-CARD EXPANDING)  */}
      {/* ========================================================= */}
      {committeeMembers.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 xl:px-6 relative">
          {/* Subheader if Leadership Spotlight is also present */}
          {leadershipMembers.length > 0 && (
            <div className="text-center mb-6 sm:mb-8">
              <div className="inline-flex items-center space-x-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#0B3B2C] px-3.5 py-1.5 rounded-full bg-[#FAF8F3] border border-[#C5A059]/40 shadow-2xs">
                <span>Board of Management & Committee Members</span>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------- */}
          {/* DESKTOP EXPANDING DECK TRACK (Hidden on < lg)              */}
          {/* --------------------------------------------------------- */}
          <div className="hidden lg:block">
            <div className="flex items-stretch justify-center gap-3.5 xl:gap-4 max-w-6xl mx-auto overflow-hidden py-3">
              {visibleCommitteeCards.map((member) => {
                const isCurrent = member.id === activeCommitteeId;
                return (
                  <div
                    key={member.id}
                    onClick={() => !isCurrent && setActiveCommitteeId(member.id)}
                    className={`h-[380px] overflow-hidden shrink-0 transition-[width,flex-basis,transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isCurrent
                        ? 'w-[560px] xl:w-[640px] rounded-3xl bg-white border border-[#E5E0D5] shadow-xl relative flex select-text'
                        : 'w-[115px] xl:w-[130px] rounded-2xl cursor-pointer relative group border border-[#E5E0D5] bg-[#FAF8F3] shadow-xs hover:shadow-md hover:-translate-y-1.5 select-none'
                    }`}
                    title={!isCurrent ? `View ${member.fullName} (${member.position})` : undefined}
                  >
                    {isCurrent ? (
                      /* EXPANDED ACTIVE CARD CONTENT */
                      <>
                        {/* Background Geometric Accent */}
                        <div
                          className="absolute -top-10 -right-10 text-[#0B3B2C]/5 pointer-events-none select-none"
                          aria-hidden="true"
                        >
                          <svg width="180" height="180" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l2.4 2.4H18v3.6L20.4 10.4 22 12l-1.6 1.6-2.4 2.4V20h-3.6L12 22.4 9.6 20H6v-4L3.6 13.6 2 12l1.6-1.6L6 8V4.4h3.6L12 2z" />
                          </svg>
                        </div>

                        {/* Left Text Pane */}
                        <div className="flex-1 p-6 sm:p-7 flex flex-col justify-between overflow-hidden relative z-10 transition-opacity duration-300 delay-150">
                          {/* Top: Position & Term */}
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#0B3B2C] text-white shadow-2xs">
                              {member.position}
                            </span>
                            {member.termPeriod && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FAF8F3] border border-[#C5A059]/30 text-[#0B3B2C]">
                                <Calendar className="w-3 h-3 text-[#C5A059]" />
                                <span>{member.termPeriod}</span>
                              </span>
                            )}
                          </div>

                          {/* Middle: Crisp Quote */}
                          <div className="relative my-auto py-2">
                            <Quote className="w-5 h-5 text-[#C5A059]/30 absolute -top-1 -left-1 pointer-events-none" />
                            <p className="text-xs sm:text-sm xl:text-[14.5px] leading-relaxed text-slate-700 font-medium italic pl-4 line-clamp-4">
                              {member.messageOrBio
                                ? `"${member.messageOrBio}"`
                                : '"Devoted to preserving sacred Islamic knowledge, nurturing steadfast character, and serving the students and community with integrity."'}
                            </p>
                          </div>

                          {/* Bottom: Name & Qualifications */}
                          <div className="pt-2 border-t border-[#F0ECE1]">
                            <h4 className="text-lg xl:text-xl font-bold font-serif text-[#1C2826] truncate tracking-tight">
                              {member.fullName}
                            </h4>
                            {member.qualification && (
                              <div className="text-xs font-semibold text-[#0B3B2C] mt-0.5 flex items-center space-x-1.5 truncate">
                                <Award className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                                <span className="truncate">{member.qualification}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Portrait Frame */}
                        <div className="w-[220px] xl:w-[250px] shrink-0 p-3 flex items-center justify-center bg-gradient-to-r from-transparent to-[#F8F7F2]/60 dark:to-transparent">
                          <div className="w-full h-full rounded-2xl overflow-hidden bg-[#F3F1E6] dark:bg-[#1C222D] border border-[#E2E0D0]/80 dark:border-[#242936] relative shadow-inner">
                            {member.photoUrl ? (
                              <>
                                <img
                                  src={member.photoUrl}
                                  alt={member.fullName}
                                  className="w-full h-full object-cover object-top transition-transform duration-700 hover:scale-105"
                                  loading="eager"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const fb = e.currentTarget.parentElement?.querySelector('.exec-fallback-avatar');
                                    if (fb) (fb as HTMLElement).style.display = 'flex';
                                  }}
                                />
                                <div className="exec-fallback-avatar hidden w-full h-full flex-col items-center justify-center bg-gradient-to-b from-[#F4F3EC] to-[#E5E3D5] text-[#0B3B2C]">
                                  <span className="text-3xl font-bold font-serif">{getInitials(member.fullName)}</span>
                                  <User className="w-6 h-6 mt-1.5 opacity-40" />
                                </div>
                              </>
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#F4F3EC] to-[#E5E3D5] text-[#0B3B2C]">
                                <span className="text-3xl font-bold font-serif">{getInitials(member.fullName)}</span>
                                <User className="w-6 h-6 mt-1.5 opacity-40" />
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      /* COLLAPSED CARD CONTENT */
                      <>
                        {member.photoUrl ? (
                          <>
                            <img
                              src={member.photoUrl}
                              alt={member.fullName}
                              className="w-full h-full object-cover object-top brightness-90 group-hover:brightness-100 group-hover:scale-105 transition-all duration-500"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fb = e.currentTarget.parentElement?.querySelector('.exec-fallback-mini');
                                if (fb) (fb as HTMLElement).style.display = 'flex';
                              }}
                            />
                            <div className="exec-fallback-mini hidden w-full h-full flex-col items-center justify-center bg-gradient-to-b from-[#F4F3EC] to-[#E5E3D5] text-[#0B3B2C]">
                              <span className="text-xl font-bold font-serif">{getInitials(member.fullName)}</span>
                              <User className="w-4 h-4 mt-1 opacity-50" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#F4F3EC] to-[#E5E3D5] text-[#0B3B2C]">
                            <span className="text-xl font-bold font-serif">{getInitials(member.fullName)}</span>
                            <User className="w-4 h-4 mt-1 opacity-50" />
                          </div>
                        )}
                        {/* Bottom dark-olive gradient overlay with Name & Position */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1F1E12]/95 via-[#1F1E12]/35 to-transparent flex flex-col justify-end p-2.5 text-center">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#6B6A45]/90 text-white truncate max-w-full mb-1">
                            {member.position}
                          </span>
                          <span className="text-xs font-bold text-white truncate drop-shadow-sm">
                            {member.fullName.split(' ')[0]}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Navigation Controls: Prev/Next & Counter */}
            {committeeMembers.length > 1 && (
              <div className="mt-5 flex items-center justify-center space-x-4">
                <button
                  type="button"
                  onClick={handlePrevCommittee}
                  aria-label="Previous Committee Member"
                  className="w-9 h-9 rounded-full border border-[#E5E0D5] bg-white hover:bg-[#FAF8F3] text-[#0B3B2C] flex items-center justify-center shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-xs font-semibold text-[#0B3B2C] px-3 py-1 rounded-full bg-[#FAF8F3] border border-[#C5A059]/30">
                  {currentCommitteeIdx + 1} of {committeeMembers.length}
                </span>

                <button
                  type="button"
                  onClick={handleNextCommittee}
                  aria-label="Next Committee Member"
                  className="w-9 h-9 rounded-full border border-[#E5E0D5] bg-white hover:bg-[#FAF8F3] text-[#0B3B2C] flex items-center justify-center shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* --------------------------------------------------------- */}
          {/* MOBILE / TABLET COMMITTEE LAYOUT (< lg, 360px to 1023px)   */}
          {/* --------------------------------------------------------- */}
          <div className="block lg:hidden max-w-md mx-auto">
            {/* Single Spotlight Card */}
            <div className="w-full rounded-2xl bg-white border border-[#E5E0D5] shadow-md overflow-hidden">
              {/* Portrait Top Frame */}
              <div className="relative h-60 sm:h-72 w-full overflow-hidden bg-[#FAF8F3]">
                {activeCommitteeMember.photoUrl ? (
                  <>
                    <img
                      src={activeCommitteeMember.photoUrl}
                      alt={activeCommitteeMember.fullName}
                      className="w-full h-full object-cover object-top"
                      loading="eager"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fb = e.currentTarget.parentElement?.querySelector('.exec-active-fallback');
                        if (fb) (fb as HTMLElement).style.display = 'flex';
                      }}
                    />
                    <div className="exec-active-fallback hidden w-full h-full flex-col items-center justify-center bg-gradient-to-b from-[#F4F3EC] to-[#E5E3D5] text-[#0B3B2C]">
                      <span className="text-4xl font-serif font-bold">{getInitials(activeCommitteeMember.fullName)}</span>
                      <User className="w-7 h-7 mt-2 opacity-40" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#F4F3EC] to-[#E5E3D5] text-[#0B3B2C]">
                    <span className="text-4xl font-serif font-bold">{getInitials(activeCommitteeMember.fullName)}</span>
                    <User className="w-7 h-7 mt-2 opacity-40" />
                  </div>
                )}

                {/* Position Pill Floating Bottom-Left */}
                <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#0B3B2C] text-white shadow-md">
                  {activeCommitteeMember.position}
                </div>

                {/* Term Period Floating Bottom-Right */}
                {activeCommitteeMember.termPeriod && (
                  <div className="absolute bottom-3 right-3 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FAF8F3] border border-[#C5A059]/30 text-[#0B3B2C] shadow-xs flex items-center space-x-1">
                    <Calendar className="w-3 h-3 text-[#C5A059]" />
                    <span>{activeCommitteeMember.termPeriod}</span>
                  </div>
                )}
              </div>

              {/* Details & Quote */}
              <div className="p-5 sm:p-6 space-y-3">
                <div>
                  <h4 className="text-lg sm:text-xl font-bold font-serif text-[#1C2826] tracking-tight">
                    {activeCommitteeMember.fullName}
                  </h4>
                  {activeCommitteeMember.qualification && (
                    <div className="text-xs sm:text-sm font-semibold text-[#0B3B2C] mt-0.5 flex items-center space-x-1.5">
                      <Award className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                      <span>{activeCommitteeMember.qualification}</span>
                    </div>
                  )}
                </div>

                <div className="relative pl-3 border-l-2 border-[#C5A059]/50 py-1">
                  <p className="text-xs sm:text-sm text-slate-700 italic leading-relaxed line-clamp-4">
                    {activeCommitteeMember.messageOrBio
                      ? `"${activeCommitteeMember.messageOrBio}"`
                      : '"Devoted to preserving sacred Islamic knowledge, nurturing steadfast character, and serving the community with vision and integrity."'}
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile Controls & Avatar Selector */}
            {committeeMembers.length > 1 && (
              <div className="mt-5 space-y-3.5">
                {/* Prev / Next & Counter */}
                <div className="flex items-center justify-center space-x-4">
                  <button
                    type="button"
                    onClick={handlePrevCommittee}
                    aria-label="Previous Committee Member"
                    className="w-9 h-9 rounded-full border border-[#E5E0D5] bg-white hover:bg-[#FAF8F3] text-[#0B3B2C] flex items-center justify-center shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-semibold text-[#0B3B2C] px-3 py-1 rounded-full bg-[#FAF8F3] border border-[#C5A059]/30">
                    {currentCommitteeIdx + 1} of {committeeMembers.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextCommittee}
                    aria-label="Next Committee Member"
                    className="w-9 h-9 rounded-full border border-[#E5E0D5] bg-white hover:bg-[#FAF8F3] text-[#0B3B2C] flex items-center justify-center shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Avatar Strip */}
                <div className="w-full overflow-x-auto no-scrollbar py-1 px-1 flex items-center justify-center">
                  <div className="inline-flex items-center space-x-2">
                    {committeeMembers.map((member) => {
                      const isCurrent = member.id === activeCommitteeId;
                      return (
                        <button
                          key={`mob-avatar-${member.id}`}
                          type="button"
                          onClick={() => setActiveCommitteeId(member.id)}
                          className={`relative shrink-0 p-0.5 rounded-xl transition-all ${
                            isCurrent ? 'scale-110 opacity-100' : 'opacity-60 hover:opacity-100'
                          }`}
                          title={`${member.fullName} (${member.position})`}
                        >
                          <div
                            className={`w-11 h-11 rounded-xl overflow-hidden bg-[#FAF8F3] flex items-center justify-center border-2 transition-all ${
                              isCurrent
                                ? 'border-[#0B3B2C] ring-2 ring-[#0B3B2C]/30 shadow-sm'
                                : 'border-[#E5E0D5]'
                            }`}
                          >
                            {member.photoUrl ? (
                              <img
                                src={member.photoUrl}
                                alt={member.fullName}
                                className="w-full h-full object-cover object-top"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <span className="text-[11px] font-bold text-[#0B3B2C]">
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
        </div>
      )}
    </section>
  );
};
