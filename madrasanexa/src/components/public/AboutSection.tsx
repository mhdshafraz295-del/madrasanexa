import { Link } from 'react-router-dom';
import { ArrowRight, Target, Compass, Sparkles } from 'lucide-react';

interface AboutSectionProps {
  aboutUs: any | null;
}

const DEFAULT_ABOUT_IMAGE = 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=900&q=80';

export default function AboutSection({ aboutUs }: AboutSectionProps) {
  const title = aboutUs?.title || 'Empowering Islamic Educational Institutions';
  const subtitle = aboutUs?.subtitle || 'ABOUT OUR MADRASA';
  const introduction =
    aboutUs?.introduction ||
    'MadrasaNexa was established to provide contemporary cloud administration tools tailored specifically for traditional Madrasas and Quran academies.';
  const story =
    aboutUs?.story ||
    'By bridging classical educational values with modern software engineering, we empower Madrasa administrators and educators to operate with transparency, efficiency, and pedagogical excellence.';
  const mission = aboutUs?.mission;
  const vision = aboutUs?.vision;
  const heroImageUrl = aboutUs?.heroImageUrl || DEFAULT_ABOUT_IMAGE;

  return (
    <section id="about" className="py-20 sm:py-28 bg-white border-t border-[#E5E5DF] relative scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">

        {/* Professional Centered Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#F5F5F1] text-[#85845C] text-xs font-semibold tracking-wider uppercase mb-3 border border-[#E5E5DF]">
            <Sparkles className="w-3.5 h-3.5 text-[#A5A477]" />
            <span>{subtitle}</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-bold text-[#252525] tracking-tight">
            {title}
          </h2>
          <div className="w-16 h-1 bg-[#85845C] mx-auto rounded-full mt-4 mb-4" />
          <p className="text-base sm:text-lg text-[#666666]">
            Dedicated to traditional educational foundations, institutional integrity, and modern operational stewardship.
          </p>
        </div>

        {/* Cohesive Image & Description Component */}
        <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-[#E5E5DF] shadow-md overflow-hidden transition-all duration-300 group">
          <div className="flex flex-col lg:flex-row items-stretch">

            {/* Medium-Sized Landscape Image (350-450px wide on desktop, untouched on hover) */}
            <div className="w-full lg:w-[420px] xl:w-[450px] shrink-0 bg-slate-100 overflow-hidden relative min-h-[260px] sm:min-h-[320px]">
              <img
                src={heroImageUrl}
                alt={aboutUs?.heroAlt || 'About Our Madrasa'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4 text-white text-xs font-medium backdrop-blur-sm bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 w-fit">
                Institutional Heritage & Excellence
              </div>
            </div>

            {/* Description Card (Changes to Primary Olive from Bottom-Left on Hover) */}
            <div className="acju-hover-br flex-1 p-6 sm:p-8 lg:p-10 flex flex-col justify-between transition-colors duration-300">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-[#85845C] group-hover:bg-white transition-colors duration-300" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#85845C] group-hover:text-white transition-colors duration-300">
                    Institutional Profile
                  </span>
                </div>

                <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#252525] tracking-tight mb-4 group-hover:text-white transition-colors duration-300">
                  Welcome to MadrasaNexa
                </h3>

                <p className="text-sm sm:text-base font-medium text-[#252525]/90 leading-relaxed mb-4 group-hover:text-white transition-colors duration-300">
                  {introduction}
                </p>

                <p className="text-xs sm:text-sm text-[#666666] leading-relaxed group-hover:text-white/90 transition-colors duration-300">
                  {story}
                </p>

                {/* Optional Mission / Vision Pills */}
                {(mission || vision) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 pt-5 border-t border-[#E5E5DF] group-hover:border-white/20 transition-colors duration-300">
                    {mission && (
                      <div className="p-3 rounded-xl bg-[#F5F5F1] group-hover:bg-white/10 transition-colors duration-300">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#252525] group-hover:text-white mb-1 transition-colors">
                          <Target className="w-3.5 h-3.5 text-[#85845C] group-hover:text-white" />
                          <span>Our Mission</span>
                        </div>
                        <p className="text-xs text-[#666666] group-hover:text-white/80 line-clamp-2 transition-colors">
                          {mission}
                        </p>
                      </div>
                    )}

                    {vision && (
                      <div className="p-3 rounded-xl bg-[#F5F5F1] group-hover:bg-white/10 transition-colors duration-300">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#252525] group-hover:text-white mb-1 transition-colors">
                          <Compass className="w-3.5 h-3.5 text-[#85845C] group-hover:text-white" />
                          <span>Our Vision</span>
                        </div>
                        <p className="text-xs text-[#666666] group-hover:text-white/80 line-clamp-2 transition-colors">
                          {vision}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Terracotta Read More link (Turns white on hover) */}
              <div className="mt-6 pt-4 border-t border-[#E5E5DF] group-hover:border-white/20 flex flex-wrap items-center justify-between gap-2 transition-colors duration-300">
                <Link
                  to="/about-us"
                  className="text-xs sm:text-sm font-bold text-[#E56A45] group-hover:text-white inline-flex items-center gap-1.5 transition-colors duration-300"
                >
                  <span>Read Full Institutional Dossier</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>

                <span className="text-[11px] font-semibold text-[#85845C] group-hover:text-white/80 transition-colors duration-300">
                  Established 2026
                </span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
