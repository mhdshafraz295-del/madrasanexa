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
        <div className="acju-card flex flex-col h-full bg-white border border-[#E5E5DF] p-7 sm:p-9 rounded-xl shadow-xs transition-all duration-300 group">
          <div className="acju-icon-badge w-12 h-12 rounded-full bg-[#F5F5F1] group-hover:bg-white flex items-center justify-center text-[#85845C] mb-5 border border-[#E5E5DF] shadow-xs transition-colors">
            <Target className="w-6 h-6 text-[#85845C]" />
          </div>

          <span className="text-xs font-bold text-[#85845C] group-hover:text-white uppercase tracking-wider mb-1 block transition-colors">
            Guiding Purpose
          </span>

          <h3 className="font-serif text-xl sm:text-2xl font-bold mb-4 tracking-tight text-[#252525] group-hover:text-white transition-colors">
            Our Mission
          </h3>

          <p className="text-sm sm:text-base leading-relaxed whitespace-pre-line flex-1 text-[#666666] group-hover:text-white/90 transition-colors font-normal">
            {mission ||
              'To cultivate a deep, living understanding of the Holy Quran, Sunnah, and classical Islamic sciences, empowering each student to lead a life of knowledge, piety, and exemplary service to community and humanity.'}
          </p>
        </div>

        {/* Vision Card */}
        <div className="acju-card flex flex-col h-full bg-white border border-[#E5E5DF] p-7 sm:p-9 rounded-xl shadow-xs transition-all duration-300 group">
          <div className="acju-icon-badge w-12 h-12 rounded-full bg-[#F5F5F1] group-hover:bg-white flex items-center justify-center text-[#85845C] mb-5 border border-[#E5E5DF] shadow-xs transition-colors">
            <Compass className="w-6 h-6 text-[#85845C]" />
          </div>

          <span className="text-xs font-bold text-[#85845C] group-hover:text-white uppercase tracking-wider mb-1 block transition-colors">
            Future Horizon
          </span>

          <h3 className="font-serif text-xl sm:text-2xl font-bold mb-4 tracking-tight text-[#252525] group-hover:text-white transition-colors">
            Our Vision
          </h3>

          <p className="text-sm sm:text-base leading-relaxed whitespace-pre-line flex-1 text-[#666666] group-hover:text-white/90 transition-colors font-normal">
            {vision ||
              'To be recognized as a premier center of Islamic scholarship, spiritual refinement, and academic distinction, nurturing generations of upright leaders and compassionate community guides.'}
          </p>
        </div>

      </div>
    </section>
  );
};
