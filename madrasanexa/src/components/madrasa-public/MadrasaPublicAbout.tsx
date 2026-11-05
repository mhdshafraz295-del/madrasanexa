import React from 'react';
import { Building2, Sparkles, ArrowRight } from 'lucide-react';
import type { MadrasaThemeTokens } from '../../services/api';

interface MadrasaPublicAboutProps {
  madrasaName: string;
  introduction?: string | null;
  generatedSummary?: string | null;
  aboutImageUrl?: string | null;
  theme: MadrasaThemeTokens;
}

const DEFAULT_PORTAL_ABOUT_IMG = 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=900&q=80';

export const MadrasaPublicAbout: React.FC<MadrasaPublicAboutProps> = ({
  madrasaName,
  introduction,
  generatedSummary,
  aboutImageUrl,
}) => {
  const imgSrc = aboutImageUrl || DEFAULT_PORTAL_ABOUT_IMG;

  return (
    <section id="about" className="scroll-mt-28 py-6">
      {/* Centered Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
        <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-[#85845C] mb-2 px-3 py-1 rounded-full bg-[#F5F5F1] border border-[#E5E5DF]">
          <Building2 className="w-3.5 h-3.5 text-[#85845C]" />
          <span>ABOUT OUR MADRASA</span>
        </div>
        <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-[#252525] mb-3">
          About Our Institution
        </h2>
        <div className="w-16 h-1 bg-[#85845C] mx-auto rounded-full" />
      </div>

      {/* Cohesive Image & Description Component with ACJU Hover Behavior */}
      <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-[#E5E5DF] shadow-md overflow-hidden transition-all duration-300 group">
        <div className="flex flex-col lg:flex-row items-stretch">

          {/* Medium-Sized Landscape Image (~350-450px on desktop, untouched on hover) */}
          <div className="w-full lg:w-[420px] xl:w-[450px] shrink-0 bg-slate-100 overflow-hidden relative min-h-[260px] sm:min-h-[320px]">
            <img
              src={imgSrc}
              alt={`About ${madrasaName}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-4 left-4 right-4 text-white text-xs font-medium backdrop-blur-sm bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 w-fit">
              {madrasaName}
            </div>
          </div>

          {/* Description Card (Transitions to Primary Olive from Bottom-Left on Hover) */}
          <div className="acju-hover-br flex-1 p-6 sm:p-8 lg:p-10 flex flex-col justify-between transition-colors duration-300">
            <div>
              <div className="flex items-center space-x-2 text-xs font-bold text-[#85845C] group-hover:text-white uppercase tracking-wider mb-3 transition-colors duration-300">
                <div className="w-7 h-7 rounded-lg bg-[#F5F5F1] group-hover:bg-white/20 flex items-center justify-center transition-colors duration-300">
                  <Building2 className="w-3.5 h-3.5 text-[#85845C] group-hover:text-white" />
                </div>
                <span>Heritage & Foundations</span>
              </div>

              <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#252525] group-hover:text-white mb-4 tracking-tight transition-colors duration-300">
                Welcome to {madrasaName}
              </h3>

              <div className="text-sm sm:text-base leading-relaxed text-[#252525]/90 group-hover:text-white transition-colors duration-300 whitespace-pre-line mb-4 font-normal">
                {introduction ||
                  `${madrasaName} is dedicated to establishing sound religious foundations and inspiring our students toward righteousness, academic diligence, and exemplary character.`}
              </div>

              {generatedSummary && (
                <div className="mt-4 p-4 rounded-xl bg-[#F5F5F1] group-hover:bg-white/10 transition-colors duration-300">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#85845C] group-hover:text-white mb-1.5 transition-colors duration-300">
                    <Sparkles className="w-3.5 h-3.5 text-[#85845C] group-hover:text-white" />
                    <span>Academic & Moral Framework</span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#666666] group-hover:text-white/85 leading-relaxed transition-colors duration-300">
                    {generatedSummary}
                  </p>
                </div>
              )}
            </div>

            {/* Read More Link in Terracotta (Turns White on Hover) */}
            <div className="mt-6 pt-4 border-t border-[#E5E5DF] group-hover:border-white/20 flex items-center justify-between transition-colors duration-300">
              <a
                href="#curriculum"
                className="text-xs sm:text-sm font-bold text-[#E56A45] group-hover:text-white inline-flex items-center gap-1.5 transition-colors duration-300"
              >
                <span>Explore Academic Programs</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </a>

              <span className="text-[11px] font-semibold text-[#85845C] group-hover:text-white/80 transition-colors duration-300">
                Institutional Roster
              </span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
