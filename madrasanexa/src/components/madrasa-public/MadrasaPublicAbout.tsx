import React from 'react';
import { Building2, BookOpen, Compass, Award, ShieldCheck, ArrowRight } from 'lucide-react';
import type { MadrasaThemeTokens } from '../../services/api';

export interface MadrasaPublicAboutProps {
  madrasaName: string;
  introduction?: string | null;
  generatedSummary?: string | null;
  aboutImageUrl?: string | null;
  mission?: string | null;
  vision?: string | null;
  syllabusInfo?: string | null;
  rulesAndRegulations?: string | null;
  theme: MadrasaThemeTokens;
}

export const MadrasaPublicAbout: React.FC<MadrasaPublicAboutProps> = ({
  madrasaName,
  introduction,
  generatedSummary,
  mission,
  vision,
  syllabusInfo,
  rulesAndRegulations,
}) => {
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const id = href.replace('#', '');
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 88;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: Math.max(0, elementPosition - headerOffset),
        behavior: 'smooth',
      });
      window.history.pushState(null, '', href);
    }
  };

  return (
    <section id="about" className="scroll-mt-28 py-6">
      {/* Split Container: Deep Emerald Left Panel + Soft Cream Right Panel */}
      <div className="rounded-3xl overflow-hidden border-0 shadow-lg grid grid-cols-1 lg:grid-cols-12 bg-white">

        {/* Left Panel: Deep Emerald / Forest Green */}
        <div className="lg:col-span-5 bg-[#0B3B2C] text-white p-8 sm:p-10 lg:p-12 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Islamic Motif Overlay */}
          <div
            className="absolute inset-0 bg-islamic-diamond-pattern opacity-15 pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative z-10">
            <div className="inline-flex items-center space-x-2 text-[11px] font-bold uppercase tracking-wider text-[#DFC076] mb-3 px-3.5 py-1 rounded-full bg-white/10 border border-[#DFC076]/30 w-fit">
              <Building2 className="w-3.5 h-3.5 text-[#DFC076]" />
              <span>Heritage & Foundations</span>
            </div>

            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight mb-4 drop-shadow-xs">
              Welcome to {madrasaName || 'Our Madrasa'}
            </h2>

            <div className="w-16 h-1 bg-[#DFC076] rounded-full mb-5" />

            <p className="text-sm sm:text-base text-[#FDFCF9]/95 leading-relaxed font-normal whitespace-pre-line">
              {introduction ||
                `${madrasaName || 'Our madrasa'} is dedicated to establishing sound religious foundations and inspiring our students toward righteousness, academic diligence, and exemplary prophetic character.`}
            </p>
          </div>

          <div className="relative z-10 mt-8 pt-6 border-t border-white/15 flex flex-wrap items-center gap-3">
            <a
              href="#curriculum"
              onClick={(e) => handleNavClick(e, '#curriculum')}
              className="inline-flex items-center space-x-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#C5A059] via-[#DFC076] to-[#C5A059] text-[#1C2826] font-bold text-xs uppercase tracking-wider shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <span>Explore Programs</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#contact"
              onClick={(e) => handleNavClick(e, '#contact')}
              className="inline-flex items-center space-x-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer"
            >
              <span>Campus Directory</span>
            </a>
          </div>
        </div>

        {/* Right Panel: Soft Cream with 2x2 Grid of Real Data */}
        <div className="lg:col-span-7 bg-[#FDFCF9] p-6 sm:p-8 lg:p-12 flex flex-col justify-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-7 w-full">

            {/* 1. Academic & Moral Framework */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border-0 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#FAF8F3] border border-[#C5A059]/40 flex items-center justify-center text-[#0B3B2C] mb-3">
                  <BookOpen className="w-5 h-5 text-[#C5A059]" />
                </div>
                <h3 className="font-serif font-bold text-base sm:text-lg text-[#1C2826] mb-1.5">
                  Academic Framework
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                  {generatedSummary || syllabusInfo || 'Comprehensive Islamic education combining Quranic mastery, Hadith sciences, and accredited academic curricula.'}
                </p>
              </div>
            </div>

            {/* 2. Guiding Purpose / Mission */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border-0 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#FAF8F3] border border-[#C5A059]/40 flex items-center justify-center text-[#0B3B2C] mb-3">
                  <Compass className="w-5 h-5 text-[#0B3B2C]" />
                </div>
                <h3 className="font-serif font-bold text-base sm:text-lg text-[#1C2826] mb-1.5">
                  Our Mission
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                  {mission || 'To cultivate a deep, living understanding of the Quran and Sunnah, empowering students toward righteousness, piety, and exemplary service.'}
                </p>
              </div>
            </div>

            {/* 3. Future Horizon / Vision */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border-0 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#FAF8F3] border border-[#C5A059]/40 flex items-center justify-center text-[#0B3B2C] mb-3">
                  <Award className="w-5 h-5 text-[#C5A059]" />
                </div>
                <h3 className="font-serif font-bold text-base sm:text-lg text-[#1C2826] mb-1.5">
                  Our Vision
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                  {vision || 'To be recognized as a premier center of classical scholarship, moral refinement, and academic distinction nurturing upright community guides.'}
                </p>
              </div>
            </div>

            {/* 4. Institutional Discipline & Adab */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border-0 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#FAF8F3] border border-[#C5A059]/40 flex items-center justify-center text-[#0B3B2C] mb-3">
                  <ShieldCheck className="w-5 h-5 text-[#0B3B2C]" />
                </div>
                <h3 className="font-serif font-bold text-base sm:text-lg text-[#1C2826] mb-1.5">
                  Character & Conduct
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal line-clamp-4">
                  {rulesAndRegulations ||
                    'Upholding authentic Islamic adab, spiritual modesty, academic diligence, and respectful conduct across all campus environments.'}
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
