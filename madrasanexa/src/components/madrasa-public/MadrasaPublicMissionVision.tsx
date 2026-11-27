import React from 'react';
import { Target, Compass } from 'lucide-react';
import type { MadrasaThemeTokens } from '../../services/api';

interface MadrasaPublicMissionVisionProps {
  mission?: string | null;
  vision?: string | null;
  theme: MadrasaThemeTokens;
}

export const MadrasaPublicMissionVision: React.FC<MadrasaPublicMissionVisionProps> = ({
  mission,
  vision,
}) => {
  return (
    <section id="mission" className="scroll-mt-28 py-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-7 sm:gap-8 items-stretch">

        {/* Mission Card */}
        <div className="bg-white rounded-2xl border border-[#E5E0D5] p-7 sm:p-9 shadow-xs hover:shadow-xl transition-all duration-300 group hover:-translate-y-1.5 flex flex-col h-full relative overflow-hidden">
          {/* Top Emerald/Gold Accent Strip */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0B3B2C] via-[#C5A059] to-[#0B3B2C]" />

          <div className="w-12 h-12 rounded-2xl bg-[#0B3B2C] border border-[#C5A059]/40 flex items-center justify-center text-[#DFC076] mb-5 shadow-2xs transition-transform duration-300 group-hover:scale-105">
            <Target className="w-6 h-6 text-[#DFC076]" />
          </div>

          <span className="text-[11px] font-bold text-[#C5A059] uppercase tracking-wider mb-1 block">
            Guiding Purpose
          </span>

          <h3 className="font-serif text-xl sm:text-2xl font-bold mb-3 tracking-tight text-[#1C2826] group-hover:text-[#0B3B2C] transition-colors">
            Our Mission
          </h3>

          <p className="text-xs sm:text-sm md:text-base leading-relaxed whitespace-pre-line flex-1 text-slate-600 font-normal">
            {mission ||
              'To cultivate a deep, living understanding of the Holy Quran, Sunnah, and classical Islamic sciences, empowering each student to lead a life of knowledge, piety, and exemplary service to community and humanity.'}
          </p>
        </div>

        {/* Vision Card */}
        <div className="bg-white rounded-2xl border border-[#E5E0D5] p-7 sm:p-9 shadow-xs hover:shadow-xl transition-all duration-300 group hover:-translate-y-1.5 flex flex-col h-full relative overflow-hidden">
          {/* Top Emerald/Gold Accent Strip */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0B3B2C] via-[#C5A059] to-[#0B3B2C]" />

          <div className="w-12 h-12 rounded-2xl bg-[#0B3B2C] border border-[#C5A059]/40 flex items-center justify-center text-[#DFC076] mb-5 shadow-2xs transition-transform duration-300 group-hover:scale-105">
            <Compass className="w-6 h-6 text-[#DFC076]" />
          </div>

          <span className="text-[11px] font-bold text-[#C5A059] uppercase tracking-wider mb-1 block">
            Future Horizon
          </span>

          <h3 className="font-serif text-xl sm:text-2xl font-bold mb-3 tracking-tight text-[#1C2826] group-hover:text-[#0B3B2C] transition-colors">
            Our Vision
          </h3>

          <p className="text-xs sm:text-sm md:text-base leading-relaxed whitespace-pre-line flex-1 text-slate-600 font-normal">
            {vision ||
              'To be recognized as a premier center of Islamic scholarship, spiritual refinement, and academic distinction, nurturing generations of upright leaders and compassionate community guides.'}
          </p>
        </div>

      </div>
    </section>
  );
};
