import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import type { MadrasaThemeTokens } from '../../services/api';

interface MadrasaPublicFooterProps {
  slug: string;
  madrasaName: string;
  logoUrl?: string | null;
  initials?: string;
  introduction?: string | null;
  theme: MadrasaThemeTokens;
  hasEvents?: boolean;
  hasNotices?: boolean;
}

export const MadrasaPublicFooter: React.FC<MadrasaPublicFooterProps> = ({
  slug,
  madrasaName,
  logoUrl,
  initials,
  introduction,
  theme,
  hasEvents = false,
  hasNotices = false,
}) => {
  const currentYear = new Date().getFullYear();
  const primaryColor = theme.primaryBtnBg || '#504F34';
  const footerBg = theme.footerBg || '#504F34';
  const footerTextColor = theme.footerTextColor || '#F5F5F1';
  const accentColor = theme.secondaryBtnBorder || '#A5A477';

  const handleFooterNav = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    if (window.location.pathname === `/madrasa/${slug}`) {
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
    }
  };

  const getHref = (targetId: string) => {
    return `/madrasa/${slug}${targetId}`;
  };

  return (
    <footer
      className="pt-16 pb-16 sm:pb-12 border-t border-white/10 mt-20 print:hidden relative overflow-hidden"
      style={{
        backgroundColor: footerBg,
        color: footerTextColor,
      }}
    >
      {/* Top separator strip */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: primaryColor }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 sm:gap-10 pb-12 border-b border-white/10">

          {/* Institution Brand & Summary (6 cols) */}
          <div className="md:col-span-6 space-y-4 min-w-0">
            <div className="flex items-center space-x-3.5 min-w-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={madrasaName}
                  className="w-12 h-12 object-contain rounded-xl border border-white/20 bg-white p-1 shrink-0"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-xl border border-white/20 flex items-center justify-center text-white font-serif font-bold text-lg shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  {initials || madrasaName.slice(0, 2).toUpperCase() || 'AM'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="font-serif font-bold text-lg sm:text-xl text-white tracking-tight block break-words">
                  {madrasaName}
                </span>
                <span
                  className="text-xs font-medium uppercase tracking-wider block"
                  style={{ color: accentColor }}
                >
                  Established Arabic & Islamic College
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#F5F5F1]/80 leading-relaxed max-w-md break-words">
              {introduction ||
                `${madrasaName} is committed to classical Islamic education, spiritual refinement, and nurturing future generations grounded in knowledge and character.`}
            </p>
          </div>

          {/* Quick Institutional Links (3 cols) */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="font-serif text-xs font-bold uppercase tracking-wider text-white">
              Navigation
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-[#F5F5F1]/80">
              <li>
                <a
                  href={getHref('#about')}
                  onClick={(e) => handleFooterNav(e, '#about')}
                  className="hover:text-white transition-colors"
                >
                  About Our Madrasa
                </a>
              </li>
              <li>
                <a
                  href={getHref('#mission')}
                  onClick={(e) => handleFooterNav(e, '#mission')}
                  className="hover:text-white transition-colors"
                >
                  Mission & Vision
                </a>
              </li>
              <li>
                <a
                  href={getHref('#curriculum')}
                  onClick={(e) => handleFooterNav(e, '#curriculum')}
                  className="hover:text-white transition-colors"
                >
                  Curriculum & Syllabus
                </a>
              </li>
              <li>
                <a
                  href={getHref('#rules')}
                  onClick={(e) => handleFooterNav(e, '#rules')}
                  className="hover:text-white transition-colors"
                >
                  Rules & Conduct
                </a>
              </li>
              {hasEvents && (
                <li>
                  <a
                    href={getHref('#events')}
                    onClick={(e) => handleFooterNav(e, '#events')}
                    className="hover:text-white transition-colors"
                  >
                    Institutional Events
                  </a>
                </li>
              )}
              {hasNotices && (
                <li>
                  <a
                    href={getHref('#notices')}
                    onClick={(e) => handleFooterNav(e, '#notices')}
                    className="hover:text-white transition-colors"
                  >
                    Circulars & Notices
                  </a>
                </li>
              )}
              <li>
                <a
                  href={getHref('#contact')}
                  onClick={(e) => handleFooterNav(e, '#contact')}
                  className="hover:text-white transition-colors"
                >
                  Contact Directory
                </a>
              </li>
            </ul>
          </div>

          {/* Admissions Desk (3 cols) */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="font-serif text-xs font-bold uppercase tracking-wider text-white">
              Admissions Desk
            </h4>
            <p className="text-xs text-[#F5F5F1]/80 leading-relaxed">
              Explore open academic intakes, eligibility requirements, and submit online applications.
            </p>
            <div className="pt-1">
              <Link
                to={`/madrasa/${slug}/admissions`}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold text-white border border-white/20 transition-all shadow-xs hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                <GraduationCap className="w-3.5 h-3.5 text-white" />
                <span>Visit Admissions Desk</span>
              </Link>
            </div>
          </div>

        </div>

        {/* Bottom Bar: Copyright & Attribution */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#F5F5F1]/70">
          <p>© {currentYear} {madrasaName}. All rights reserved.</p>
          <div
            className="flex items-center space-x-2 font-mono text-[11px]"
            style={{ color: accentColor }}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>MadrasaNexa Institutional SaaS Platform</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
