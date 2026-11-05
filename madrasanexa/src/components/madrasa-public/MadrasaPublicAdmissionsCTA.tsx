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
  return (
    <section
      className="relative overflow-hidden rounded-3xl bg-[#504F34] p-8 sm:p-12 lg:p-14 text-white shadow-xl border border-white/10 public-section-enter"
      style={{
        borderColor: theme.secondaryBtnBorder || '#E5E5DF',
      }}
    >
      {/* Background Islamic Motif Overlay */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0l10 10-10 10-10-10L20 0zm0 20l10 10-10 10-10-10 10-10z' fill='%23FFFFFF' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
        <div className="max-w-2xl text-center lg:text-left space-y-3">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Admissions & Enrollment</span>
          </div>

          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold tracking-tight text-white leading-tight">
            Begin Your Child's Journey in Sacred Knowledge
          </h3>

          <p className="text-[#F5F5F1] text-sm sm:text-base leading-relaxed">
            {hasActiveAdmissions ? (
              <>
                Applications are actively being received for{' '}
                <strong className="text-white underline decoration-[#A5A477]">
                  {activeIntakeName || 'the current academic cycle'}
                </strong>{' '}
                {activeAcademicYear ? `(${activeAcademicYear})` : ''}. Review guidelines and submit online.
              </>
            ) : (
              'Discover our curriculum, class standards, baseline assessments, and admissions guidelines.'
            )}
          </p>
        </div>

        <div className="shrink-0">
          <Link
            to={`/madrasa/${slug}/admissions`}
            className="inline-flex items-center space-x-2.5 px-8 py-4 rounded-xl font-bold text-sm sm:text-base bg-white text-[#252525] hover:bg-[#F5F5F1] transition-all shadow-md hover:shadow-lg hover:scale-102 active:scale-98 cursor-pointer"
          >
            <GraduationCap className="w-5 h-5 text-[#85845C]" />
            <span>{hasActiveAdmissions ? 'View Intake & Apply' : 'Admissions Portal'}</span>
            <ChevronRight className="w-4 h-4 text-[#85845C]" />
          </Link>
        </div>
      </div>
    </section>
  );
};
