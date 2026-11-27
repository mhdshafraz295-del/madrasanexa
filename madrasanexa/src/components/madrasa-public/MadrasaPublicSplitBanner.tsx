import React from 'react';
import { ChevronRight, Award, Compass, HeartHandshake, Globe2 } from 'lucide-react';
import type { MadrasaThemeTokens } from '../../services/api';

interface MadrasaPublicSplitBannerProps {
  madrasaName: string;
  theme: MadrasaThemeTokens;
}

export const MadrasaPublicSplitBanner: React.FC<MadrasaPublicSplitBannerProps> = ({
  madrasaName,
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

  const highlights = [
    {
      title: 'Prophetic Foundations',
      description: 'Authentic classical curriculum transmitted through verified sanad chains and scholarly rigor.',
      icon: Award,
    },
    {
      title: 'Holistic Tarbiyah',
      description: 'Daily character cultivation, spiritual refinement, and upright prophetic etiquette (Adab).',
      icon: Compass,
    },
    {
      title: 'Dedicated Scholars',
      description: 'Full-time scholarly mentorship nurturing intellects and moral integrity in a supportive campus.',
      icon: HeartHandshake,
    },
    {
      title: 'Enduring Social Impact',
      description: 'Generations of graduates serving mosques, families, and educational hubs worldwide.',
      icon: Globe2,
    },
  ];

  return (
    <section className="my-10 sm:my-16">
      <div className="rounded-3xl overflow-hidden border border-[#E5E0D5] shadow-md grid grid-cols-1 lg:grid-cols-12 bg-white">

        {/* Left Side: Deep Emerald Hero Banner */}
        <div className="lg:col-span-5 bg-[#0B3B2C] text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Islamic Motif Overlay */}
          <div
            className="absolute inset-0 bg-islamic-diamond-pattern opacity-15 pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative z-10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#DFC076] block mb-3">
              Guiding Purpose & Vision
            </span>

            <h3 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight mb-4">
              Together for the Future of Sacred Knowledge
            </h3>

            <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-normal">
              At {madrasaName}, we are dedicated to establishing sound religious foundations, inspiring students toward righteousness, academic diligence, and exemplary prophetic character.
            </p>
          </div>

          <div className="relative z-10 mt-8 pt-6 border-t border-white/15">
            <a
              href="#about"
              onClick={(e) => handleNavClick(e, '#about')}
              className="inline-flex items-center space-x-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#C5A059] via-[#DFC076] to-[#C5A059] text-[#1C2826] font-bold text-xs uppercase tracking-wider shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <span>Explore Our Foundations</span>
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Right Side: 2x2 Highlights on Soft Cream/White */}
        <div className="lg:col-span-7 bg-[#FDFCF9] p-6 sm:p-10 lg:p-12 flex items-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 w-full">
            {highlights.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-white border border-[#C5A059]/40 flex items-center justify-center text-[#0B3B2C] shrink-0 shadow-2xs">
                    <Icon className="w-6 h-6 text-[#0B3B2C]" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-base sm:text-lg text-[#1C2826] mb-1">
                      {item.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
};
