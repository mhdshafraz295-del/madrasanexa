import React, { useState } from 'react';
import { Users, Award, BookOpen, Clock, ChevronDown } from 'lucide-react';
import type { PublicStaffSection, PublicStaffMember, MadrasaThemeTokens } from '../../services/api';

interface MadrasaPublicStaffProps {
  staff: PublicStaffSection;
  theme: MadrasaThemeTokens;
}

export const MadrasaPublicStaff: React.FC<MadrasaPublicStaffProps> = ({ staff, theme: _theme }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!staff.isEnabled || !staff.members || staff.members.length === 0) {
    return null;
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <section id="staff" className="public-section-enter scroll-mt-28" aria-label="Staff & Faculty">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12 px-4">
        <div className="inline-flex items-center space-x-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#0B3B2C] mb-2.5 px-3.5 py-1.5 rounded-full bg-[#FAF8F3] border border-[#C5A059]/40 shadow-2xs">
          <Users className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Scholarly Faculty & Leadership</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight text-[#1C2826] mb-3">
          {staff.sectionTitle || 'Our Scholarly Faculty & Mentors'}
        </h2>
        <div className="w-16 h-1 bg-gradient-to-r from-[#0B3B2C] via-[#C5A059] to-[#0B3B2C] mx-auto rounded-full mb-3" />
        <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
          {staff.sectionSubtitle ||
            'Dedicated scholars and educators guiding hearts and minds with classical wisdom, authentic character, and compassionate mentorship.'}
        </p>
      </div>

      {/* Balanced, Centered Individual Staff Cards */}
      <div className="flex flex-wrap justify-center gap-7 items-start overflow-visible">
        {staff.members.map((member: PublicStaffMember) => {
          const isExpanded = expandedId === member.id;
          const initials = member.fullName
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase())
            .join('');

          return (
            <div
              key={member.id}
              className={`group relative bg-white rounded-2xl border border-[#E5E0D5] overflow-hidden transition-all duration-300 w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.2rem)] max-w-sm flex flex-col shadow-xs hover:shadow-xl hover:-translate-y-1.5 ${
                isExpanded ? 'border-[#C5A059] shadow-md -translate-y-1' : ''
              }`}
            >
              {/* Top Accent Strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0B3B2C] via-[#C5A059] to-[#0B3B2C]" />

              {/* 1. Optional Individual Photograph Container (Collapses cleanly if missing or error) */}
              {member.photoUrl ? (
                <div className="staff-photo-container relative w-full aspect-[4/3] bg-slate-50 overflow-hidden border-b border-[#E5E0D5]">
                  <img
                    src={member.photoUrl}
                    alt={member.fullName}
                    loading="lazy"
                    className="w-full h-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-104"
                    onError={(e) => {
                      const container = e.currentTarget.closest('.staff-photo-container');
                      if (container) (container as HTMLElement).style.display = 'none';
                      const fallback = e.currentTarget.closest('.group')?.querySelector('.staff-inline-emblem');
                      if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                    }}
                  />
                  {/* Subtle Gold Accent Band */}
                  <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#C5A059] to-transparent opacity-80" />
                </div>
              ) : null}

              {/* 2. Core Identity (Refined Content-First Layout) */}
              <div className="p-6 pb-5 flex flex-col flex-1">
                {/* Fallback Emblem Monogram (Rendered when no photo or on photo error) */}
                <div
                  className={`staff-inline-emblem w-14 h-14 rounded-2xl bg-[#FAF8F3] border border-[#C5A059]/40 text-[#0B3B2C] font-bold font-serif flex items-center justify-center shadow-2xs mb-4 shrink-0 transition-transform duration-300 group-hover:scale-105 ${
                    member.photoUrl ? 'hidden' : ''
                  }`}
                >
                  <span className="text-lg tracking-wider text-[#0B3B2C]">{initials || <Users className="w-6 h-6 text-[#0B3B2C]" />}</span>
                </div>

                {/* Staff Full Name */}
                <h3 className="text-lg sm:text-xl font-serif font-bold tracking-tight mb-1 text-[#1C2826] group-hover:text-[#0B3B2C] transition-colors">
                  {member.fullName}
                </h3>

                {/* Designation / Role */}
                <p className="text-xs sm:text-sm font-semibold text-[#0B3B2C] mb-2.5">
                  {member.designation}
                </p>

                {/* Department / Subject Badge */}
                {member.department && (
                  <div className="inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#FAF8F3] text-[#0B3B2C] w-fit mb-3 border border-[#C5A059]/30 shadow-2xs">
                    <BookOpen className="w-3 h-3 shrink-0 text-[#C5A059]" />
                    <span>{member.department}</span>
                  </div>
                )}

                {/* Desktop Expand-On-Hover & Mobile Tap Details Drawer */}
                <div
                  className={`space-y-3 transition-all duration-300 ease-in-out ${
                    isExpanded
                      ? 'max-h-96 opacity-100 pt-3 border-t border-[#F0ECE1]'
                      : 'max-h-0 opacity-0 lg:group-hover:max-h-96 lg:group-hover:opacity-100 lg:group-hover:pt-3 lg:group-hover:border-t lg:group-hover:border-[#F0ECE1] overflow-hidden'
                  }`}
                >
                  {/* Qualification */}
                  {member.qualification && (
                    <div className="flex items-start space-x-2 text-xs text-[#1C2826]">
                      <Award className="w-3.5 h-3.5 text-[#C5A059] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[#1C2826]">Credentials: </span>
                        <span className="text-slate-600">{member.qualification}</span>
                      </div>
                    </div>
                  )}

                  {/* Experience */}
                  {member.experienceYears && (
                    <div className="flex items-start space-x-2 text-xs text-[#1C2826]">
                      <Clock className="w-3.5 h-3.5 text-[#0B3B2C] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[#1C2826]">Experience: </span>
                        <span className="text-slate-600">
                          {typeof member.experienceYears === 'number'
                            ? `${member.experienceYears}+ Years`
                            : member.experienceYears}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Biography */}
                  {member.bio && (
                    <p className="text-xs text-slate-600 leading-relaxed pt-1.5 border-t border-[#F0ECE1] italic">
                      "{member.bio}"
                    </p>
                  )}
                </div>

                {/* Mobile Tap-To-Expand Button */}
                <div className="mt-4 pt-3 border-t border-[#F0ECE1] flex items-center justify-between lg:hidden">
                  <button
                    type="button"
                    onClick={() => toggleExpand(member.id)}
                    aria-expanded={isExpanded}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#0B3B2C] hover:text-[#C5A059] transition-colors focus:outline-hidden cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide Details' : 'View Full Profile'}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-300 ${
                        isExpanded ? 'rotate-180 text-[#0B3B2C]' : ''
                      }`}
                    />
                  </button>
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                    {member.department || 'Faculty'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
