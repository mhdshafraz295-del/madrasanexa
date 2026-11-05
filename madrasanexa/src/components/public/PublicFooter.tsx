import { Link } from 'react-router-dom';
import logoUrl from '../../assets/logo/madrasanexa-logo.png';
import type { FooterData } from '../../services/homepage.service';

interface PublicFooterProps {
  data?: FooterData | null;
  contactEnabled?: boolean;
}

export default function PublicFooter({ data, contactEnabled = true }: PublicFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#504F34] text-white pt-14 sm:pt-18 pb-10 sm:pb-12 border-t border-[#6B6A45]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-8 sm:gap-10 pb-10 sm:pb-12 border-b border-[#6B6A45]/50">

          {/* Column 1: Brand & Institutional Statement */}
          <div className="sm:col-span-2 md:col-span-5 flex flex-col items-start text-left">
            <Link to="/" className="flex items-center gap-3 mb-4 focus:outline-none rounded-lg group">
              <img src={logoUrl} alt="MadrasaNexa" className="h-10 w-auto object-contain bg-white/95 p-1 rounded-lg" />
              <div className="flex flex-col">
                <span className="font-serif font-bold text-lg sm:text-xl tracking-tight text-white">
                  MadrasaNexa
                </span>
                <span className="text-[10px] uppercase tracking-widest text-[#F5F5F1]/80 font-semibold -mt-0.5">
                  Institutional Platform
                </span>
              </div>
            </Link>

            <p className="text-xs sm:text-sm text-[#F5F5F1]/80 max-w-sm leading-relaxed mb-6 text-left">
              {data?.platformDescription ||
                'Next-generation cloud administration platform designed specifically for modern Islamic educational institutions.'}
            </p>

            <div className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-white/10 px-3 py-1.5 rounded-lg border border-white/15">
              <span className="w-2 h-2 rounded-full bg-[#A5A477] shrink-0 animate-pulse" />
              <span>Platform Systems Operational</span>
            </div>
          </div>

          {/* Column 2: Platform Modules */}
          <div className="sm:col-span-1 md:col-span-2 text-left">
            <h4 className="font-serif text-sm font-bold text-white mb-4 tracking-wide">
              Modules
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-left">
              <li>
                <a href="#features" className="text-[#F5F5F1]/80 hover:text-white transition-colors">
                  Student Records
                </a>
              </li>
              <li>
                <a href="#features" className="text-[#F5F5F1]/80 hover:text-white transition-colors">
                  Daily Attendance
                </a>
              </li>
              <li>
                <a href="#features" className="text-[#F5F5F1]/80 hover:text-white transition-colors">
                  Fee Settlements
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-[#F5F5F1]/80 hover:text-white transition-colors">
                  Subscriptions
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Platform Information */}
          <div className="sm:col-span-1 md:col-span-2 text-left">
            <h4 className="font-serif text-sm font-bold text-white mb-4 tracking-wide">
              Organization
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-left">
              <li>
                <Link to="/about-us" className="text-[#F5F5F1]/80 hover:text-white transition-colors">
                  About MadrasaNexa
                </Link>
              </li>
              <li>
                <a href="#how-it-works" className="text-[#F5F5F1]/80 hover:text-white transition-colors">
                  Onboarding Process
                </a>
              </li>
              <li>
                <a href="#security" className="text-[#F5F5F1]/80 hover:text-white transition-colors">
                  Data Security & Privacy
                </a>
              </li>
              {contactEnabled && (
                <li>
                  <a href="#contact" className="text-[#F5F5F1]/80 hover:text-white transition-colors">
                    Contact Administration
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* Column 4: Portals */}
          <div className="sm:col-span-2 md:col-span-3 text-left">
            <h4 className="font-serif text-sm font-bold text-white mb-4 tracking-wide">
              Direct Access
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-left mb-4">
              <li>
                <Link to="/login" className="text-[#F5F5F1]/80 hover:text-white transition-colors">
                  Staff & Administrative Portal
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-[#F5F5F1]/80 hover:text-white transition-colors">
                  Register Your Madrasa
                </Link>
              </li>
            </ul>

            <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-xs text-[#F5F5F1]/80">
              <span className="font-semibold text-white block mb-0.5">Need institutional assistance?</span>
              Direct enquiries to your regional onboarding director.
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Preserved Links */}
        <div className="pt-6 sm:pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 text-xs text-[#F5F5F1]/70 text-left">
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
