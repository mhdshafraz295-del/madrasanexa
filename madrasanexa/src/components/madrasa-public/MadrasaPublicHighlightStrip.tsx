import React from 'react';
import { Calendar, GraduationCap, BookOpen, Users, ChevronRight } from 'lucide-react';
import { formatHijriDate } from '../../utils/hijriDate';
import type { MadrasaThemeTokens } from '../../services/api';

interface MadrasaPublicHighlightStripProps {
  slug: string;
  theme: MadrasaThemeTokens;
  hasActiveAdmissions: boolean;
  activeIntakeName?: string;
  activeAcademicYear?: string | number;
}

export const MadrasaPublicHighlightStrip: React.FC<MadrasaPublicHighlightStripProps> = ({
  slug,
  hasActiveAdmissions,
  activeIntakeName,
  activeAcademicYear,
}) => {
  const hijri = formatHijriDate();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 sm:-mt-12 relative z-20">
      <div className="bg-white rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.08)] border border-[#E5E0D5] p-4 sm:p-6 transition-all">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6 items-center">

          {/* 1. Hijri Date */}
          <div className="flex items-center space-x-3.5 border-r border-[#E5E0D5] pr-3 sm:pr-4">
            <div className="w-10 h-10 rounded-xl bg-[#FAF8F3] border border-[#C5A059]/30 flex items-center justify-center text-[#0B3B2C] shrink-0">
              <Calendar className="w-5 h-5 text-[#C5A059]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                Hijri Calendar
              </span>
              <span className="text-xs sm:text-sm font-serif font-bold text-[#1C2826] truncate block">
                {hijri}
              </span>
            </div>
          </div>

          {/* 2. Academic Enrollment Status */}
          <div className="flex items-center space-x-3.5 border-r border-[#E5E0D5] pr-3 sm:pr-4">
            <div className="w-10 h-10 rounded-xl bg-[#FAF8F3] border border-[#C5A059]/30 flex items-center justify-center text-[#0B3B2C] shrink-0">
              <GraduationCap className="w-5 h-5 text-[#0B3B2C]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                Admissions Status
              </span>
              <span className="text-xs sm:text-sm font-semibold text-[#0B3B2C] flex items-center gap-1.5 truncate">
                <span className={`w-2 h-2 rounded-full shrink-0 ${hasActiveAdmissions ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <span className="truncate">{hasActiveAdmissions ? (activeIntakeName || 'Now Open') : 'In Session'}</span>
              </span>
            </div>
          </div>

          {/* 3. Classical Disciplines */}
          <div className="flex items-center space-x-3.5 border-r border-[#E5E0D5] pr-3 sm:pr-4 hidden sm:flex">
            <div className="w-10 h-10 rounded-xl bg-[#FAF8F3] border border-[#C5A059]/30 flex items-center justify-center text-[#0B3B2C] shrink-0">
              <BookOpen className="w-5 h-5 text-[#C5A059]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                Curricula Scope
              </span>
              <span className="text-xs sm:text-sm font-serif font-bold text-[#1C2826] truncate block">
                Hifz, Alim & Tajweed
              </span>
            </div>
          </div>

          {/* 4. Academic Year */}
          <div className="flex items-center space-x-3.5 border-r border-[#E5E0D5] pr-3 sm:pr-4 hidden lg:flex">
            <div className="w-10 h-10 rounded-xl bg-[#FAF8F3] border border-[#C5A059]/30 flex items-center justify-center text-[#0B3B2C] shrink-0">
              <Users className="w-5 h-5 text-[#0B3B2C]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                Academic Session
              </span>
              <span className="text-xs sm:text-sm font-serif font-bold text-[#1C2826] truncate block">
                {activeAcademicYear ? `Year ${activeAcademicYear}` : 'Current Academic Term'}
              </span>
            </div>
          </div>

          {/* 5. Direct Action CTA */}
          <div className="col-span-2 sm:col-span-1 flex justify-end">
            {hasActiveAdmissions ? (
              <a
                href={`/madrasa/${slug}/admissions?apply=true`}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-[#0B3B2C] hover:bg-[#07281D] text-white text-xs font-bold uppercase tracking-wider shadow-xs hover:shadow-md transition-all"
              >
                <span>Apply Online</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#DFC076]" />
              </a>
            ) : (
              <a
                href="#curriculum"
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-[#0B3B2C] hover:bg-[#07281D] text-white text-xs font-bold uppercase tracking-wider shadow-xs hover:shadow-md transition-all"
              >
                <span>View Syllabus</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#DFC076]" />
              </a>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
