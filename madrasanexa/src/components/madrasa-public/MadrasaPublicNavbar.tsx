import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Menu,
  X,
  Building2,
  Calendar,
  BellRing,
  BookOpen,
  Phone,
  Sparkles,
  Users,
  ChevronDown,
} from 'lucide-react';
import type { MadrasaThemeTokens } from '../../services/api';

interface MadrasaPublicNavbarProps {
  slug: string;
  madrasaName: string;
  logoUrl?: string | null;
  initials?: string;
  theme: MadrasaThemeTokens;
  hasActiveAdmissions: boolean;
  hasEvents?: boolean;
  hasNotices?: boolean;
  hasStaff?: boolean;
  activeIntakeCount?: number;
}

export const MadrasaPublicNavbar: React.FC<MadrasaPublicNavbarProps> = ({
  slug,
  madrasaName,
  logoUrl,
  initials,
  theme,
  hasActiveAdmissions,
  hasEvents = false,
  hasNotices = false,
  hasStaff = false,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickLinksOpen, setQuickLinksOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setQuickLinksOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setQuickLinksOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      setMobileMenuOpen(false);
      setQuickLinksOpen(false);
      // Wait until mobile menu has closed and layout is stable before scrolling
      requestAnimationFrame(() => {
        setTimeout(() => {
          const id = href.replace('#', '');
          const element = document.getElementById(id);
          if (element) {
            const headerOffset = 88; // 80px header + 8px margin
            const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({
              top: Math.max(0, elementPosition - headerOffset),
              behavior: 'smooth',
            });
            window.history.pushState(null, '', href);
          }
        }, 120);
      });
    }
  };

  const navLinks = [
    { label: 'About', href: '#about', icon: Building2 },
    { label: 'Curriculum & Rules', href: '#curriculum', icon: BookOpen },
    ...(hasStaff ? [{ label: 'Faculty', href: '#staff', icon: Users }] : []),
    ...(hasEvents ? [{ label: 'Events', href: '#events', icon: Calendar }] : []),
    ...(hasNotices ? [{ label: 'Notices', href: '#notices', icon: BellRing }] : []),
    { label: 'Contact', href: '#contact', icon: Phone },
  ];

  const quickLinks = [
    { label: 'Institutional Profile', href: '#about', icon: Building2, desc: 'History, foundation, & vision' },
    { label: 'Academic Curriculum', href: '#curriculum', icon: BookOpen, desc: 'Syllabus, subjects & code of conduct' },
    ...(hasStaff ? [{ label: 'Faculty & Scholars', href: '#staff', icon: Users, desc: 'Academic leadership directory' }] : []),
    ...(hasEvents ? [{ label: 'Campus Events', href: '#events', icon: Calendar, desc: 'Programs & upcoming schedules' }] : []),
    ...(hasNotices ? [{ label: 'Circulars & Notices', href: '#notices', icon: BellRing, desc: 'Official administrative bulletins' }] : []),
    { label: 'Admissions Portal', href: `/madrasa/${slug}/admissions`, icon: GraduationCap, desc: 'Online application & enrollment' },
    { label: 'Campus Contact', href: '#contact', icon: Phone, desc: 'Address, phone, and inquiry channels' },
  ];

  const primaryColor = theme.primaryBtnBg || '#504F34';
  const navBg = theme.navbarBg || '#ffffff';

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 print:hidden ${
        scrolled
          ? 'shadow-xs border-b border-[#E5E5DF] backdrop-blur-md'
          : 'border-b border-[#E5E5DF]'
      }`}
      style={{ backgroundColor: navBg }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="h-20 flex items-center justify-between gap-2 sm:gap-4">

          {/* Brand Logo & Institution Name */}
          <Link
            to={`/madrasa/${slug}`}
            className="flex items-center space-x-2.5 sm:space-x-3.5 group focus:outline-hidden focus:ring-2 rounded-xl p-1 -m-1 transition-transform min-w-0 flex-1"
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={madrasaName}
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain rounded-xl border border-[#E5E5DF] bg-white p-1 shadow-xs transition-transform group-hover:scale-102 shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback-avatar');
                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                }}
              />
            ) : null}

            <div
              className={`logo-fallback-avatar w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white shadow-xs font-bold text-sm sm:text-lg border border-white/20 shrink-0 ${
                logoUrl ? 'hidden' : 'flex'
              }`}
              style={{ backgroundColor: primaryColor }}
            >
              {initials || madrasaName.slice(0, 2).toUpperCase() || 'AM'}
            </div>

            <div className="flex flex-col justify-center min-w-0">
              <span className="font-serif font-bold text-sm sm:text-lg lg:text-xl tracking-tight leading-tight truncate text-[#252525]">
                {madrasaName}
              </span>
              <div className="flex items-center space-x-2 mt-0.5 hidden sm:flex">
                <span
                  className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider flex items-center gap-1 whitespace-nowrap"
                  style={{ color: primaryColor }}
                >
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span>Official Institutional Portal</span>
                </span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-xs xl:text-sm font-medium">
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="inline-flex items-center px-3 py-2 rounded-lg text-xs xl:text-sm font-medium whitespace-nowrap text-[#252525] hover:opacity-80 hover:bg-[#F5F5F1]/60 transition-colors relative group focus:outline-hidden focus:ring-2"
              >
                <span>{item.label}</span>
                <span
                  className="absolute bottom-1.5 left-3 right-3 h-0.5 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-center"
                  style={{ backgroundColor: primaryColor }}
                />
              </a>
            ))}

            {/* Quick Links Dropdown */}
            <div className="relative shrink-0" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setQuickLinksOpen(!quickLinksOpen)}
                onMouseEnter={() => setQuickLinksOpen(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs xl:text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  quickLinksOpen ? 'bg-[#F5F5F1]' : 'text-[#252525] hover:bg-[#F5F5F1]/60'
                }`}
                style={quickLinksOpen ? { color: primaryColor } : undefined}
              >
                <span>Quick Links</span>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${quickLinksOpen ? 'rotate-180' : 'text-[#666666]'}`} />
              </button>

              {quickLinksOpen && (
                <div
                  onMouseLeave={() => setQuickLinksOpen(false)}
                  className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl border border-[#E5E5DF] shadow-lg p-2.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                >
                  <div className="px-3 py-1.5 mb-1.5 border-b border-[#E5E5DF]">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: primaryColor }}
                    >
                      Campus Directory
                    </span>
                  </div>
                  <div className="space-y-1">
                    {quickLinks.map((ql) => {
                      const isAnchor = ql.href.startsWith('#');
                      const Tag = isAnchor ? 'a' : Link;
                      const linkProps = isAnchor
                        ? {
                            href: ql.href,
                            onClick: (e: React.MouseEvent<HTMLAnchorElement>) => handleNavClick(e, ql.href),
                          }
                        : {
                            to: ql.href,
                            onClick: () => setQuickLinksOpen(false),
                          };
                      const Icon = ql.icon;

                      return (
                        <Tag
                          key={ql.label}
                          {...linkProps as any}
                          className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#F5F5F1] transition-colors group"
                        >
                          <div
                            className="w-8 h-8 rounded-lg bg-[#F5F5F1] flex items-center justify-center shrink-0 transition-colors"
                          >
                            <Icon className="w-4 h-4 transition-colors" style={{ color: primaryColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#252525] transition-colors">
                              {ql.label}
                            </p>
                            <p className="text-[11px] text-[#666666] truncate mt-0.5">
                              {ql.desc}
                            </p>
                          </div>
                        </Tag>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Right Action: Admissions CTA & Mobile Hamburger */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Link
              to={`/madrasa/${slug}/admissions`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4.5 sm:py-2 rounded-xl text-xs font-semibold shadow-xs whitespace-nowrap shrink-0 transition-all hover:opacity-95"
              style={{
                backgroundColor: primaryColor,
                color: theme.primaryBtnText || '#ffffff',
              }}
            >
              <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
              <span>Admissions</span>
              {hasActiveAdmissions && (
                <span className="flex h-2 w-2 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
              )}
            </Link>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 sm:p-2 rounded-xl text-[#252525] hover:bg-[#F5F5F1] transition-colors border border-[#E5E5DF] shrink-0"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-[#252525] shrink-0" /> : <Menu className="w-5 h-5 text-[#252525] shrink-0" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile navigation panel - absolute to prevent layout shift of main document flow */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full inset-x-0 bg-white border-b border-[#E5E5DF] px-4 py-5 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
          <div className="space-y-1">
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#252525] hover:bg-[#F5F5F1] transition-colors"
              >
                <item.icon className="w-4 h-4" style={{ color: primaryColor }} />
                <span>{item.label}</span>
              </a>
            ))}
          </div>

          <div className="pt-3 border-t border-[#E5E5DF]">
            <p
              className="px-3 text-[11px] font-bold uppercase tracking-wider mb-2"
              style={{ color: primaryColor }}
            >
              Campus Quick Links
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {quickLinks.map((ql) => {
                const isAnchor = ql.href.startsWith('#');
                const Tag = isAnchor ? 'a' : Link;
                const linkProps = isAnchor
                  ? {
                      href: ql.href,
                      onClick: (e: React.MouseEvent<HTMLAnchorElement>) => handleNavClick(e, ql.href),
                    }
                  : {
                      to: ql.href,
                      onClick: () => setMobileMenuOpen(false),
                    };
                const Icon = ql.icon;

                return (
                  <Tag
                    key={ql.label}
                    {...linkProps as any}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#252525] hover:bg-[#F5F5F1] transition"
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                    <span>{ql.label}</span>
                  </Tag>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-[#E5E5DF]">
            <Link
              to={`/madrasa/${slug}/admissions`}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center space-x-2 w-full py-2.5 text-xs font-semibold rounded-xl shadow-xs transition-opacity hover:opacity-95"
              style={{
                backgroundColor: primaryColor,
                color: theme.primaryBtnText || '#ffffff',
              }}
            >
              <GraduationCap className="w-4 h-4 text-white" />
              <span>Apply for Admissions</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
