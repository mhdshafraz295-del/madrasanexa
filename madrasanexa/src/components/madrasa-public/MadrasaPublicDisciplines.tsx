import React from 'react';
import { BookOpen, GraduationCap, ShieldCheck, Sparkles, Award, Compass, ArrowRight } from 'lucide-react';
import type { MadrasaThemeTokens, CurriculumPayload, CurriculumProgramme } from '../../services/api';

interface MadrasaPublicDisciplinesProps {
  curriculum?: CurriculumPayload | null;
  theme: MadrasaThemeTokens;
}

const ICONS = [BookOpen, GraduationCap, Award, Compass, Sparkles, ShieldCheck];

export const MadrasaPublicDisciplines: React.FC<MadrasaPublicDisciplinesProps> = ({
  curriculum,
}) => {
  // Extract strictly published programmes from real tenant curriculum
  const publishedProgrammes: CurriculumProgramme[] = (curriculum?.programmes || []).filter(
    (p) => p.isPublished
  );

  // If the active madrasa has no published programmes in its backend profile,
  // return null cleanly — zero fake cards or hardcoded placeholder disciplines.
  if (publishedProgrammes.length === 0) {
    return null;
  }

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
    <section className="py-8 sm:py-12" id="academic-disciplines" aria-label="Academic Disciplines">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14 px-4">
        <div className="inline-flex items-center space-x-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#0B3B2C] mb-2.5 px-3.5 py-1.5 rounded-full bg-[#FAF8F3] border border-[#C5A059]/40 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Our Academic Programs</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight text-[#1C2826] mb-3">
          Academic Pathways & Disciplines
        </h2>
        <div className="w-16 h-1 bg-gradient-to-r from-[#0B3B2C] via-[#C5A059] to-[#0B3B2C] mx-auto rounded-full mb-3" />
        <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Structured academic tracks and classical sciences published by our faculty, nurturing scholarly depth and character.
        </p>
      </div>

      {/* Responsive Cards Grid (Real Published Programs Only) */}
      <div
        className={`grid gap-6 sm:gap-7 items-stretch ${
          publishedProgrammes.length === 1
            ? 'grid-cols-1 max-w-md mx-auto'
            : publishedProgrammes.length === 2
            ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto'
            : publishedProgrammes.length === 3
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        }`}
      >
        {publishedProgrammes.map((prog, idx) => {
          const Icon = ICONS[idx % ICONS.length];
          const levelCount = prog.levels?.length || 0;

          return (
            <div
              key={prog.id}
              className="bg-white rounded-2xl overflow-hidden border-0 shadow-xs hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 flex flex-col group p-6 sm:p-7 justify-between relative"
            >
              <div>
                {/* Emblem Icon Badge */}
                <div className="w-12 h-12 rounded-2xl bg-[#0B3B2C] border border-[#C5A059]/40 flex items-center justify-center text-[#DFC076] shadow-sm mb-5 transition-transform duration-300 group-hover:scale-110">
                  <Icon className="w-6 h-6 text-[#DFC076]" />
                </div>

                {/* Subtitle / Code */}
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#C5A059] block mb-1.5">
                  {prog.code ? `Code: ${prog.code}` : 'Published Program'}
                </span>

                {/* Program Title */}
                <h3 className="font-serif text-lg sm:text-xl font-bold text-[#1C2826] group-hover:text-[#0B3B2C] transition-colors mb-2.5 leading-snug">
                  {prog.name}
                </h3>

                {/* Description */}
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal mb-5 line-clamp-3">
                  {prog.description ||
                    (levelCount > 0
                      ? `Structured multi-stage pathway encompassing ${levelCount} formal academic level${levelCount > 1 ? 's' : ''}.`
                      : 'Authentic syllabus focusing on core academic mastery, spiritual refinement, and scholarly excellence.')}
                </p>

                {/* Metadata Pills */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {levelCount > 0 && (
                    <span className="inline-flex items-center text-[10px] sm:text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#FAF8F3] text-[#0B3B2C] border border-[#C5A059]/30">
                      {levelCount} {levelCount === 1 ? 'Level' : 'Levels'}
                    </span>
                  )}
                  {prog.durationYears ? (
                    <span className="inline-flex items-center text-[10px] sm:text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#FAF8F3] text-[#0B3B2C] border border-[#C5A059]/30">
                      {prog.durationYears} {prog.durationYears === 1 ? 'Year' : 'Years'}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Bottom Navigation Link */}
              <a
                href="#curriculum"
                onClick={(e) => handleNavClick(e, '#curriculum')}
                className="inline-flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#0B3B2C] group-hover:text-[#C5A059] transition-colors pt-4 border-t border-[#F0ECE1] w-full"
              >
                <span>Explore Syllabus</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          );
        })}
      </div>
    </section>
  );
};
