import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ChevronRight,
  GraduationCap,
  Sparkles,
  ArrowDown,
} from 'lucide-react';
import type { MadrasaThemeTokens } from '../../services/api';

interface MadrasaPublicHeroProps {
  slug: string;
  madrasaName: string;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  heroImageUrl?: string | null;
  theme: MadrasaThemeTokens;
  hasActiveAdmissions: boolean;
  activeIntakeName?: string;
  activeAcademicYear?: string | number;
}

export const MadrasaPublicHero: React.FC<MadrasaPublicHeroProps> = ({
  slug,
  madrasaName,
  heroTitle,
  heroSubtitle,
  heroImageUrl,
  theme,
  hasActiveAdmissions,
  activeIntakeName,
  activeAcademicYear,
}) => {
  const overlayColor = theme.heroOverlay || '#504F34';
  const overlayOpacity = theme.heroOverlayOpacity ?? 0.90;

  const handleScrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const id = targetId.replace('#', '');
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 88;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: Math.max(0, elementPosition - headerOffset),
        behavior: 'smooth',
      });
      window.history.pushState(null, '', targetId);
    }
  };

  return (
    <section
      className="relative overflow-hidden w-full text-white py-16 sm:py-24 lg:py-32"
      style={{ backgroundColor: overlayColor }}
    >
      {/* Background Hero Image */}
      {heroImageUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 scale-102"
          style={{ backgroundImage: `url(${heroImageUrl})` }}
        />
      ) : null}

      {/* Institutional Scrim Overlay with Subtle Radial Lighting */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: overlayColor,
          opacity: overlayOpacity,
          backgroundImage: `radial-gradient(circle at 50% 30%, rgba(165, 164, 119, 0.45) 0%, rgba(80, 79, 52, 0.95) 75%)`,
        }}
      />

      {/* Subtle Geometric Diamond Pattern Texture Blend */}
      <div
        className="absolute inset-0 bg-islamic-diamond-pattern pointer-events-none opacity-60"
        aria-hidden="true"
      />

      {/* Hero Content Container */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

          {/* Left Column: Editorial Headline & Actions */}
          <div className="lg:col-span-7 xl:col-span-8 text-center lg:text-left">
            {/* Institutional Accreditation / Excellence Badge */}
            <div className="inline-flex flex-wrap items-center justify-center lg:justify-start gap-1.5 sm:gap-2 px-4 py-1.5 rounded-full bg-white/15 border border-[#C5A059]/40 backdrop-blur-md text-[#F5F5F1] text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-6 shadow-[0_0_16px_rgba(197,160,89,0.25)] max-w-full">
              <Sparkles className="w-3.5 h-3.5 text-[#E5D7B7] shrink-0" />
              <span className="text-center">Established Arabic & Islamic College</span>
              <span className="w-1 h-1 rounded-full bg-white/60 hidden sm:inline-block" />
              <ShieldCheck className="w-3.5 h-3.5 text-[#E5D7B7] shrink-0 hidden sm:inline-block" />
            </div>

            {/* Institution Title / Headline in Serif */}
            <h1
              className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl leading-[1.16] mb-6 drop-shadow-xs break-words"
              style={{ color: theme.heroTextColor || '#FFFFFF' }}
            >
              {heroTitle || `Welcome to ${madrasaName}`}
            </h1>

            {/* Subtitle / Institutional Mission Tagline */}
            <p
              className="text-sm sm:text-base lg:text-lg max-w-2xl font-normal leading-relaxed text-[#F5F5F1]/90 mb-8 text-balance break-words mx-auto lg:mx-0"
            >
              {heroSubtitle ||
                'Nurturing faithful hearts, scholarly intellects, and exemplary Islamic character through authentic classical learning and holistic moral development.'}
            </p>

            {/* Primary and Secondary Action Buttons */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4">
              {hasActiveAdmissions ? (
                <Link
                  to={`/madrasa/${slug}/admissions?apply=true`}
                  className="inline-flex items-center space-x-2.5 px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#0B3B2C] hover:bg-[#07281D] border border-[#DFC076]/50 shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <GraduationCap className="w-4 h-4 text-[#DFC076]" />
                  <span>Apply for Admissions</span>
                  <ChevronRight className="w-4 h-4 text-[#DFC076]" />
                </Link>
              ) : (
                <a
                  href="#about"
                  onClick={(e) => handleScrollToSection(e, '#about')}
                  className="inline-flex items-center space-x-2.5 px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#0B3B2C] hover:bg-[#07281D] border border-[#DFC076]/50 shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <span>Explore Our Institution</span>
                  <ArrowDown className="w-4 h-4 text-[#DFC076]" />
                </a>
              )}

              <a
                href="#curriculum"
                onClick={(e) => handleScrollToSection(e, '#curriculum')}
                className="inline-flex items-center space-x-2 px-5 py-3.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-white/15 backdrop-blur-md border border-[#C5A059]/40 hover:bg-white/25 hover:border-[#C5A059]/70 shadow-[0_0_15px_rgba(197,160,89,0.22)] transition-all cursor-pointer"
              >
                <span>Academic Curriculum</span>
                <ChevronRight className="w-4 h-4 text-white/80" />
              </a>
            </div>

            {/* Active Admissions Callout Pill */}
            {hasActiveAdmissions && activeIntakeName ? (
              <div className="mt-6 inline-flex items-center space-x-2 text-xs font-semibold px-4 py-2 rounded-full bg-white/20 backdrop-blur-md border border-[#C5A059]/50 shadow-[0_0_16px_rgba(197,160,89,0.28)] text-white max-w-full">
                <span className="w-2 h-2 rounded-full bg-[#E5C178] animate-ping shrink-0" />
                <span className="truncate">
                  Now Enrolling: {activeIntakeName} {activeAcademicYear ? `(${activeAcademicYear})` : ''}
                </span>
              </div>
            ) : null}
          </div>

          {/* Right Column: Floating Spotlight Card (Editorial reference inspired) */}
          <div className="lg:col-span-5 xl:col-span-4 mt-4 lg:mt-0">
            <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.22)] border border-[#E5E0D5] text-left relative overflow-hidden">
              {/* Top Golden Accent Bar */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0B3B2C] via-[#C5A059] to-[#0B3B2C]" />

              <div className="w-12 h-12 rounded-xl bg-[#FAF8F3] border border-[#C5A059]/40 flex items-center justify-center text-[#0B3B2C] mb-4 shadow-2xs">
                <Sparkles className="w-6 h-6 text-[#C5A059]" />
              </div>

              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B3B2C] block mb-1">
                {hasActiveAdmissions ? 'Active Enrollment' : 'Institutional Excellence'}
              </span>

              <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#1C2826] tracking-tight mb-2">
                {hasActiveAdmissions && activeIntakeName
                  ? activeIntakeName
                  : 'Sacred Knowledge & Distinction'}
              </h3>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6 font-normal">
                {hasActiveAdmissions
                  ? `Online applications are actively being received for the ${activeAcademicYear ? `Academic Year ${activeAcademicYear}` : 'upcoming academic session'}. Register early to secure enrollment.`
                  : 'Cultivating scholarly intellects, righteous character, and deep understanding of the Holy Quran, Sunnah, and classical Islamic disciplines.'}
              </p>

              {hasActiveAdmissions ? (
                <Link
                  to={`/madrasa/${slug}/admissions?apply=true`}
                  className="w-full inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#C5A059] via-[#DFC076] to-[#C5A059] text-[#1C2826] font-bold text-xs uppercase tracking-wider shadow-xs hover:shadow-md transition-all cursor-pointer"
                >
                  <span>Enroll Online Now</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              ) : (
                <a
                  href="#about"
                  onClick={(e) => handleScrollToSection(e, '#about')}
                  className="w-full inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#C5A059] via-[#DFC076] to-[#C5A059] text-[#1C2826] font-bold text-xs uppercase tracking-wider shadow-xs hover:shadow-md transition-all cursor-pointer"
                >
                  <span>Discover Our Story</span>
                  <ChevronRight className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
