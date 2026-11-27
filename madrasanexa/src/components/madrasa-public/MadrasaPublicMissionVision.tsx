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
    <section id="mission" className="scroll-mt-28 py-4">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">

        {/* Mission Card */}
        <div className="glass-panel-gold flex flex-col h-full bg-islamic-diamond-subtle p-7 sm:p-9 rounded-3xl shadow-md transition-all duration-300 group hover:-translate-y-1">
          <div className="w-12 h-12 rounded-2xl bg-white/90 border border-[#C5A059]/40 shadow-[0_0_14px_rgba(197,160,89,0.22)] flex items-center justify-center text-[#85845C] mb-5 transition-transform group-hover:scale-105">
            <Target className="w-6 h-6 text-[#85845C]" />
          </div>

          <span className="text-xs font-bold text-[#85845C] uppercase tracking-wider mb-1 block">
            Guiding Purpose
          </span>

          <h3 className="font-serif text-xl sm:text-2xl font-bold mb-4 tracking-tight text-[#252525]">
            Our Mission
          </h3>

          <p className="text-sm sm:text-base leading-relaxed whitespace-pre-line flex-1 text-slate-700 font-normal">
            {mission ||
              'To cultivate a deep, living understanding of the Holy Quran, Sunnah, and classical Islamic sciences, empowering each student to lead a life of knowledge, piety, and exemplary service to community and humanity.'}
          </p>
        </div>

        {/* Vision Card */}
        <div className="glass-panel-gold flex flex-col h-full bg-islamic-diamond-subtle p-7 sm:p-9 rounded-3xl shadow-md transition-all duration-300 group hover:-translate-y-1">
          <div className="w-12 h-12 rounded-2xl bg-white/90 border border-[#C5A059]/40 shadow-[0_0_14px_rgba(197,160,89,0.22)] flex items-center justify-center text-[#85845C] mb-5 transition-transform group-hover:scale-105">
            <Compass className="w-6 h-6 text-[#85845C]" />
          </div>

          <span className="text-xs font-bold text-[#85845C] uppercase tracking-wider mb-1 block">
            Future Horizon
          </span>

          <h3 className="font-serif text-xl sm:text-2xl font-bold mb-4 tracking-tight text-[#252525]">
            Our Vision
          </h3>

          <p className="text-sm sm:text-base leading-relaxed whitespace-pre-line flex-1 text-slate-700 font-normal">
            {vision ||
              'To be recognized as a premier center of Islamic scholarship, spiritual refinement, and academic distinction, nurturing generations of upright leaders and compassionate community guides.'}
          </p>
        </div>

      </div>
    </section>
  );
};
