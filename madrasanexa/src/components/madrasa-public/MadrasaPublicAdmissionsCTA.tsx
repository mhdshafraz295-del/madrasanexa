import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ChevronRight, Sparkles } from 'lucide-react';
import type { MadrasaThemeTokens } from '../../services/api';

interface MadrasaPublicAdmissionsCTAProps {
  slug: string;
  theme: MadrasaThemeTokens;
  hasActiveAdmissions: boolean;
  activeIntakeName?: string;
  activeAcademicYear?: string | number;
}

export const MadrasaPublicAdmissionsCTA: React.FC<MadrasaPublicAdmissionsCTAProps> = ({
  slug,
  theme,
  hasActiveAdmissions,
  activeIntakeName,
  activeAcademicYear,
}) => {
  const ctaBg = theme.footerBg || '#0B3B2C';

  return (
    <section
      className="relative overflow-hidden rounded-3xl p-6 sm:p-12 lg:p-14 text-white shadow-xl border border-[#C5A059]/40 public-section-enter"
      style={{
        backgroundColor: ctaBg,
      }}
    >
      {/* Background Islamic Motif Overlay */}
      <div
        className="absolute inset-0 bg-islamic-diamond-pattern opacity-20 pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8">
        <div className="max-w-2xl text-center lg:text-left space-y-3">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-[#DFC076]/40 text-[#DFC076] text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Admissions & Enrollment</span>
          </div>

          <h3 className="text-xl sm:text-3xl lg:text-4xl font-serif font-bold tracking-tight text-white leading-tight break-words">
            Begin Your Child's Journey in Sacred Knowledge
          </h3>

          <p className="text-[#FDFCF9]/90 text-xs sm:text-base leading-relaxed font-normal">
            {hasActiveAdmissions ? (
              <>
                Applications are actively being received for{' '}
                <strong className="text-white underline decoration-[#DFC076]">
                  {activeIntakeName || 'the current academic cycle'}
                </strong>{' '}
                {activeAcademicYear ? `(${activeAcademicYear})` : ''}. Review guidelines and submit online.
              </>
            ) : (
              'Discover our curriculum, class standards, baseline assessments, and admissions guidelines.'
            )}
          </p>
        </div>

        <div className="shrink-0 w-full sm:w-auto text-center">
          <Link
            to={`/madrasa/${slug}/admissions`}
            className="inline-flex items-center justify-center space-x-2.5 px-6 py-3.5 sm:px-8 sm:py-4 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider text-[#1C2826] bg-gradient-to-r from-[#C5A059] via-[#DFC076] to-[#C5A059] hover:shadow-xl transition-all hover:scale-102 active:scale-98 cursor-pointer w-full sm:w-auto shadow-md"
          >
            <GraduationCap className="w-5 h-5 shrink-0 text-[#1C2826]" />
            <span>{hasActiveAdmissions ? 'View Intake & Apply' : 'Admissions Portal'}</span>
            <ChevronRight className="w-4 h-4 shrink-0 text-[#1C2826]" />
          </Link>
        </div>
      </div>
    </section>
  );
};
