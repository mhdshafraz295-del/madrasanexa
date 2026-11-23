import { Link } from 'react-router-dom';
import logoUrl from '../../assets/logo/madrasanexa-logo.png';
import type { FooterData } from '../../services/homepage.service';

interface PublicFooterProps {
  data?: FooterData | null;
  contactEnabled?: boolean;
}

// 14 Staggered twinkling stars coordinates and animation delays
const NIGHT_SKY_STARS = [
  { top: '8%', left: '12%', size: 10, delay: '0s', opacity: 0.85 },
  { top: '15%', left: '28%', size: 8, delay: '0.4s', opacity: 0.7 },
  { top: '22%', left: '8%', size: 12, delay: '0.9s', opacity: 0.9 },
  { top: '12%', left: '52%', size: 9, delay: '1.3s', opacity: 0.75 },
  { top: '28%', left: '42%', size: 11, delay: '1.8s', opacity: 0.8 },
  { top: '10%', left: '72%', size: 13, delay: '0.6s', opacity: 0.95 },
  { top: '24%', left: '88%', size: 10, delay: '1.1s', opacity: 0.7 },
  { top: '45%', left: '18%', size: 8, delay: '1.5s', opacity: 0.65 },
  { top: '55%', left: '34%', size: 11, delay: '0.2s', opacity: 0.85 },
  { top: '65%', left: '14%', size: 9, delay: '2.1s', opacity: 0.75 },
  { top: '75%', left: '48%', size: 12, delay: '1.4s', opacity: 0.9 },
  { top: '50%', left: '68%', size: 8, delay: '0.8s', opacity: 0.7 },
  { top: '68%', left: '82%', size: 11, delay: '2.3s', opacity: 0.8 },
  { top: '82%', left: '92%', size: 10, delay: '1.7s', opacity: 0.75 },
];

export default function PublicFooter({ data, contactEnabled = true }: PublicFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-b from-[#06281e] via-[#041d16] to-[#02120d] relative overflow-hidden text-white pt-16 sm:pt-20 pb-10 sm:pb-12 border-t border-emerald-900/60 selection:bg-emerald-500/30 selection:text-white">
      {/* 1. Serene Crescent Moon SVG in Upper-Right Night Sky */}
      <div
        className="absolute top-6 right-6 sm:right-14 w-16 h-16 sm:w-22 sm:h-22 pointer-events-none z-0 animate-moon-float opacity-90"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_0_24px_rgba(245,158,11,0.55)]"
        >
          <defs>
            <linearGradient id="crescentMoonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FEF3C7" />
              <stop offset="45%" stopColor="#FDE68A" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Ambient Glow */}
          <circle cx="34" cy="34" r="28" fill="url(#moonGlow)" />
          {/* Elegant Curved Islamic Crescent */}
          <path
            d="M45 10 C31 12 21 23 21 36 C21 49 31 60 45 62 C29 60 16 48 16 34 C16 20 29 10 45 10 Z"
            fill="url(#crescentMoonGrad)"
          />
        </svg>
      </div>

      {/* 2. 14 Twinkling 4-Point Islamic Stars */}
      <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true">
        {NIGHT_SKY_STARS.map((star, idx) => (
          <div
            key={idx}
            className="absolute animate-star-twinkle"
            style={{
              top: star.top,
              left: star.left,
              animationDelay: star.delay,
              opacity: star.opacity,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={star.size}
              height={star.size}
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-[0_0_6px_rgba(253,230,138,0.8)]"
            >
              <path
                d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z"
                fill="#FEF3C7"
              />
            </svg>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-8 sm:gap-10 pb-10 sm:pb-12 border-b border-emerald-900/50">

          {/* Column 1: Brand & Institutional Statement with Footer Perch Anchor */}
          <div className="sm:col-span-2 md:col-span-5 flex flex-col items-start text-left">
            <Link to="/" className="flex items-center gap-3 mb-4 focus:outline-none rounded-lg group">
              <img src={logoUrl} alt="MadrasaNexa" className="h-10 w-auto object-contain bg-white/95 p-1 rounded-lg" />
              <div className="flex flex-col">
                {/* data-dove-perch="footer" lets the dove land gracefully in the night-sky footer */}
                <span
                  data-dove-perch="footer"
                  className="font-serif font-bold text-lg sm:text-xl tracking-tight text-white relative inline-block w-fit"
                >
                  MadrasaNexa
                </span>
                <span className="text-[10px] uppercase tracking-widest text-emerald-200/80 font-semibold -mt-0.5">
                  Islamic Institutional Platform
                </span>
              </div>
            </Link>

            <p className="text-xs sm:text-sm text-emerald-100/80 max-w-sm leading-relaxed mb-6 text-left">
              {data?.platformDescription ||
                'Next-generation cloud administration platform designed specifically for modern Islamic educational institutions.'}
            </p>

            <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-200 bg-emerald-950/70 px-3 py-1.5 rounded-lg border border-emerald-800/60 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              <span>Platform Systems Operational</span>
            </div>
          </div>

          {/* Column 2: Platform Modules */}
          <div className="sm:col-span-1 md:col-span-2 text-left">
            <h4 className="font-serif text-sm font-bold text-emerald-200 mb-4 tracking-wide">
              Modules
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-left">
              <li>
                <a href="#features" className="text-emerald-100/75 hover:text-white transition-colors">
                  Student Records
                </a>
              </li>
              <li>
                <a href="#features" className="text-emerald-100/75 hover:text-white transition-colors">
                  Daily Attendance
                </a>
              </li>
              <li>
                <a href="#features" className="text-emerald-100/75 hover:text-white transition-colors">
                  Fee Settlements
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-emerald-100/75 hover:text-white transition-colors">
                  Subscriptions
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Platform Information */}
          <div className="sm:col-span-1 md:col-span-2 text-left">
            <h4 className="font-serif text-sm font-bold text-emerald-200 mb-4 tracking-wide">
              Organization
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-left">
              <li>
                <Link to="/about-us" className="text-emerald-100/75 hover:text-white transition-colors">
                  About MadrasaNexa
                </Link>
              </li>
              <li>
                <a href="#how-it-works" className="text-emerald-100/75 hover:text-white transition-colors">
                  Onboarding Process
                </a>
              </li>
              <li>
                <a href="#security" className="text-emerald-100/75 hover:text-white transition-colors">
                  Data Security & Privacy
                </a>
              </li>
              {contactEnabled && (
                <li>
                  <a href="#contact" className="text-emerald-100/75 hover:text-white transition-colors">
                    Contact Administration
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* Column 4: Portals */}
          <div className="sm:col-span-2 md:col-span-3 text-left">
            <h4 className="font-serif text-sm font-bold text-emerald-200 mb-4 tracking-wide">
              Direct Access
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-left mb-4">
              <li>
                <Link to="/login" className="text-emerald-100/75 hover:text-white transition-colors">
                  Staff & Administrative Portal
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-emerald-100/75 hover:text-white transition-colors">
                  Register Your Madrasa
                </Link>
              </li>
            </ul>

            <div className="p-3 bg-emerald-950/60 rounded-xl border border-emerald-800/50 text-xs text-emerald-100/80">
              <span className="font-semibold text-emerald-200 block mb-0.5">Need institutional assistance?</span>
              Direct enquiries to your regional onboarding director.
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Preserved Links */}
        <div className="pt-6 sm:pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 text-xs text-emerald-200/70 text-left">
          <div>
            {data?.copyrightText || `© ${currentYear} MadrasaNexa Institutional Platform. All rights reserved.`}
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <Link to="/about-us" className="hover:text-white transition-colors">
              Institutional Heritage
            </Link>
            <a href="#security" className="hover:text-white transition-colors">
              Data Isolation
            </a>
            <Link to="/login" className="hover:text-white transition-colors font-medium">
              Portal Access
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
