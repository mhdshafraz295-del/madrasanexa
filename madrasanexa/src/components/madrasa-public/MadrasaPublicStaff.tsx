import React, { useState } from 'react';
import { Users, Award, BookOpen, Clock, ChevronDown } from 'lucide-react';
import type { PublicStaffSection, PublicStaffMember, MadrasaThemeTokens } from '../../services/api';

interface MadrasaPublicStaffProps {
  staff: PublicStaffSection;
  theme: MadrasaThemeTokens;
}

export const MadrasaPublicStaff: React.FC<MadrasaPublicStaffProps> = ({ staff, theme }) => {
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
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#85845C] mb-3 px-3.5 py-1 rounded-full bg-[#F5F5F1] border border-[#E5E5DF] shadow-2xs">
          <Users className="w-3.5 h-3.5 text-[#85845C]" />
          <span>Scholarly Faculty & Leadership</span>
        </div>
        <h2
          className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold tracking-tight text-[#252525]"
          style={{ color: theme.headingColor || '#252525' }}
        >
          {staff.sectionTitle || 'Our Scholarly Faculty & Mentors'}
        </h2>
        <p className="mt-3 text-sm sm:text-base text-[#666666] leading-relaxed">
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
              className={`group relative bg-white rounded-2xl border border-[#E5E5DF] overflow-hidden transition-all duration-300 w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.2rem)] max-w-sm flex flex-col shadow-xs ${
                isExpanded
                  ? 'shadow-md border-[#85845C] -translate-y-1'
                  : 'hover:shadow-md hover:border-[#85845C]/50 hover:-translate-y-1'
              }`}
            >
              {/* 1. Individual Photograph Container */}
              <div className="relative w-full aspect-square bg-[#F5F5F1] overflow-hidden border-b border-[#E5E5DF]">
                {member.photoUrl ? (
                  <img
                    src={member.photoUrl}
                    alt={member.fullName}
                    loading="lazy"
                    className="w-full h-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-104"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#85845C] text-white p-6">
                    <div className="w-20 h-20 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-2xl font-serif font-bold tracking-wider text-white shadow-inner mb-3">
                      {initials || <Users className="w-8 h-8 text-white" />}
                    </div>
                    <span className="text-xs uppercase tracking-widest text-white/90 font-bold">
                      Faculty Profile
                    </span>
                  </div>
                )}

                {/* Subtle Olive Accent Band */}
                <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#85845C] to-transparent opacity-60" />
              </div>

              {/* 2. Core Identity (Visible At All Times) */}
              <div className="p-6 pb-4 flex flex-col flex-1">
                {/* Staff Full Name */}
                <h3
                  className="text-lg sm:text-xl font-serif font-bold tracking-tight mb-1 text-[#252525]"
                  style={{ color: theme.headingColor || '#252525' }}
                >
                  {member.fullName}
                </h3>

                {/* Designation / Role */}
                <p className="text-sm font-semibold text-[#85845C] mb-3">
                  {member.designation}
                </p>

                {/* Department / Subject Badge */}
                {member.department && (
                  <div className="inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#F5F5F1] text-[#85845C] w-fit mb-3 border border-[#E5E5DF]">
                    <BookOpen className="w-3 h-3 shrink-0 text-[#85845C]" />
                    <span>{member.department}</span>
                  </div>
                )}

                {/* Desktop Expand-On-Hover & Mobile Tap Details Drawer */}
                <div
                  className={`space-y-3 transition-all duration-300 ease-in-out ${
                    isExpanded
                      ? 'max-h-96 opacity-100 pt-3 border-t border-[#E5E5DF]'
                      : 'max-h-0 opacity-0 lg:group-hover:max-h-96 lg:group-hover:opacity-100 lg:group-hover:pt-3 lg:group-hover:border-t lg:group-hover:border-[#E5E5DF] overflow-hidden'
                  }`}
                >
                  {/* Qualification */}
                  {member.qualification && (
                    <div className="flex items-start space-x-2 text-xs text-[#252525]">
                      <Award className="w-3.5 h-3.5 text-[#E56A45] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[#252525]">Credentials: </span>
                        <span className="text-[#666666]">{member.qualification}</span>
                      </div>
                    </div>
                  )}

                  {/* Experience */}
                  {member.experienceYears && (
                    <div className="flex items-start space-x-2 text-xs text-[#252525]">
                      <Clock className="w-3.5 h-3.5 text-[#85845C] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[#252525]">Experience: </span>
                        <span className="text-[#666666]">
                          {typeof member.experienceYears === 'number'
                            ? `${member.experienceYears}+ Years`
                            : member.experienceYears}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Biography */}
                  {member.bio && (
                    <p className="text-xs text-[#666666] leading-relaxed pt-1.5 border-t border-[#E5E5DF] italic">
                      "{member.bio}"
                    </p>
                  )}
                </div>

                {/* Mobile Tap-To-Expand Button */}
                <div className="mt-4 pt-3 border-t border-[#E5E5DF] flex items-center justify-between lg:hidden">
                  <button
                    type="button"
                    onClick={() => toggleExpand(member.id)}
                    aria-expanded={isExpanded}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#85845C] hover:text-[#504F34] transition-colors focus:outline-hidden cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide Details' : 'View Full Profile'}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-300 ${
                        isExpanded ? 'rotate-180 text-[#85845C]' : ''
                      }`}
                    />
                  </button>
                  <span className="text-[10px] text-[#666666] font-medium uppercase tracking-wider">
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
