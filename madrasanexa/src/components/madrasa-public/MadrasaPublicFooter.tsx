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

  return (
    <footer
      className="bg-[#504F34] text-[#F5F5F1] pt-16 pb-12 border-t border-white/10 mt-20 print:hidden relative overflow-hidden"
      style={{
        backgroundColor: theme.footerBg || '#504F34',
        color: theme.footerTextColor || '#F5F5F1',
      }}
    >
      {/* Top olive separator strip */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#85845C]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/10">

          {/* Institution Brand & Summary (6 cols) */}
          <div className="md:col-span-6 space-y-4">
            <div className="flex items-center space-x-3.5">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={madrasaName}
                  className="w-12 h-12 object-contain rounded-xl border border-white/20 bg-white p-1"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[#85845C] border border-white/20 flex items-center justify-center text-white font-serif font-bold text-lg">
                  {initials || madrasaName.slice(0, 2).toUpperCase() || 'AM'}
                </div>
              )}
              <div>
                <span className="font-serif font-bold text-lg sm:text-xl text-white tracking-tight block">
                  {madrasaName}
                </span>
                <span className="text-xs text-[#A5A477] font-medium uppercase tracking-wider">
                  Established Arabic & Islamic College
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#F5F5F1]/80 leading-relaxed max-w-md line-clamp-3">
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
                <a href="#about" className="hover:text-white transition-colors">
                  About Our Madrasa
                </a>
              </li>
              <li>
                <a href="#mission" className="hover:text-white transition-colors">
                  Mission & Vision
                </a>
              </li>
              <li>
                <a href="#curriculum" className="hover:text-white transition-colors">
                  Curriculum & Syllabus
                </a>
              </li>
              <li>
                <a href="#rules" className="hover:text-white transition-colors">
                  Rules & Conduct
                </a>
              </li>
              {hasEvents && (
                <li>
                  <a href="#events" className="hover:text-white transition-colors">
                    Institutional Events
                  </a>
                </li>
              )}
              {hasNotices && (
                <li>
                  <a href="#notices" className="hover:text-white transition-colors">
                    Circulars & Notices
                  </a>
                </li>
              )}
              <li>
                <a href="#contact" className="hover:text-white transition-colors">
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
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#85845C] text-white hover:bg-[#85845C]/90 border border-white/20 transition-all shadow-xs"
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
          <div className="flex items-center space-x-2 font-mono text-[11px] text-[#A5A477]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>MadrasaNexa Institutional SaaS Platform</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
