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

      {/* Hero Content Container */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

        {/* Institutional Accreditation / Excellence Badge */}
        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-[#F5F5F1] text-[11px] sm:text-xs font-semibold uppercase tracking-wider mb-6 shadow-xs max-w-full">
          <Sparkles className="w-3.5 h-3.5 text-[#A5A477] shrink-0" />
          <span className="text-center">Established Arabic & Islamic College</span>
          <span className="w-1 h-1 rounded-full bg-white/60 hidden sm:inline-block" />
          <ShieldCheck className="w-3.5 h-3.5 text-[#A5A477] shrink-0 hidden sm:inline-block" />
        </div>

        {/* Institution Title / Headline in Serif */}
        <h1
          className="font-serif text-2xl sm:text-4xl lg:text-6xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.18] mb-6 drop-shadow-xs break-words"
          style={{ color: theme.heroTextColor || '#FFFFFF' }}
        >
          {heroTitle || `Welcome to ${madrasaName}`}
        </h1>

        {/* Subtitle / Institutional Mission Tagline */}
        <p
          className="text-sm sm:text-lg lg:text-xl max-w-2xl mx-auto font-normal leading-relaxed text-[#F5F5F1]/90 mb-10 text-balance break-words"
        >
          {heroSubtitle ||
            'Nurturing faithful hearts, scholarly intellects, and exemplary Islamic character through authentic classical learning and holistic moral development.'}
        </p>

        {/* Primary and Secondary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
          {hasActiveAdmissions ? (
            <Link
              to={`/madrasa/${slug}/admissions?apply=true`}
              className="inline-flex items-center space-x-2.5 px-6 py-3 sm:px-7 sm:py-3.5 rounded-xl font-semibold text-xs sm:text-sm text-[#504F34] bg-white hover:bg-[#F5F5F1] transition-all shadow-md hover:shadow-lg hover:scale-102 active:scale-98"
            >
              <GraduationCap className="w-4 h-4 text-[#504F34]" />
              <span>Apply for Admissions</span>
              <ChevronRight className="w-4 h-4 text-[#504F34]" />
            </Link>
          ) : (
            <a
              href="#about"
              onClick={(e) => handleScrollToSection(e, '#about')}
              className="inline-flex items-center space-x-2.5 px-6 py-3 sm:px-7 sm:py-3.5 rounded-xl font-semibold text-xs sm:text-sm text-[#504F34] bg-white hover:bg-[#F5F5F1] transition-all shadow-md hover:shadow-lg"
            >
              <span>Explore Our Institution</span>
              <ArrowDown className="w-4 h-4 text-[#504F34]" />
            </a>
          )}

          <a
            href="#curriculum"
            onClick={(e) => handleScrollToSection(e, '#curriculum')}
            className="inline-flex items-center space-x-2 px-5 py-3 sm:px-6 sm:py-3.5 rounded-xl font-semibold text-xs sm:text-sm text-white border border-white/30 hover:bg-white/10 transition-colors"
          >
            <span>Academic Curriculum</span>
            <ChevronRight className="w-4 h-4 text-white/70" />
          </a>
        </div>

        {/* Active Admissions Callout Pill */}
        {hasActiveAdmissions && activeIntakeName ? (
          <div className="mt-8 inline-flex items-center space-x-2 text-xs font-semibold px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[#F5F5F1] max-w-full">
            <span className="w-2 h-2 rounded-full bg-[#A5A477] animate-ping shrink-0" />
            <span className="truncate">
              Now Enrolling: {activeIntakeName} {activeAcademicYear ? `(${activeAcademicYear})` : ''}
            </span>
          </div>
        ) : null}

      </div>
    </section>
  );
};
