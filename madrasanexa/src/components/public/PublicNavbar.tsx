import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logoUrl from '../../assets/logo/madrasanexa-logo.png';
import { Menu, X, ArrowRight, ChevronDown, ShieldCheck, Sparkles, BookOpen, Layers, DollarSign, UserCheck } from 'lucide-react';

interface PublicNavbarProps {
  contactEnabled?: boolean;
}

export default function PublicNavbar({ contactEnabled = true }: PublicNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickLinksOpen, setQuickLinksOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setQuickLinksOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setQuickLinksOpen(false);
  }, [location.pathname, location.hash]);

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Features', href: '/#features' },
    { label: 'How It Works', href: '/#how-it-works' },
    { label: 'Pricing', href: '/#pricing' },
    { label: 'About Us', href: '/about-us' },
    ...(contactEnabled ? [{ label: 'Contact', href: '/#contact' }] : []),
  ];

  const quickLinks = [
    { label: 'Platform Features', href: '/#features', icon: Layers, desc: 'Student, fee, and academic management' },
    { label: 'How It Works', href: '/#how-it-works', icon: Sparkles, desc: '5-step institutional onboarding' },
    { label: 'Subscription Plans', href: '/#pricing', icon: DollarSign, desc: 'Transparent tiered institution capacity' },
    { label: 'About MadrasaNexa', href: '/about-us', icon: BookOpen, desc: 'Institutional heritage & vision' },
    { label: 'Security & Privacy', href: '/#security', icon: ShieldCheck, desc: 'Multi-tenant isolation & data defense' },
    { label: 'Register Madrasa', href: '/register', icon: UserCheck, desc: 'Submit onboarding application' },
  ];

  return (
    <header className="fixed top-0 inset-x-0 z-50 transition-all duration-300 print:hidden">
      <div className={`w-full transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-xs border-b border-[#E5E5DF]'
          : 'bg-white border-b border-[#E5E5DF]'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Main Navigation" className="h-20 flex items-center justify-between gap-4">

            {/* Logo Brand (Official Logo Unchanged) */}
            <Link
              to="/"
              className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#85845C] rounded-lg group"
            >
              <img
                src={logoUrl}
                alt="MadrasaNexa"
                className="h-10 w-auto object-contain transition-transform group-hover:scale-102"
              />
              <div className="flex flex-col">
                <span className="font-serif font-bold text-lg sm:text-xl tracking-tight text-[#252525]">
                  MadrasaNexa
                </span>
                <span className="text-[10px] uppercase tracking-widest text-[#666666] font-semibold -mt-1 hidden sm:block">
                  Islamic Institutional Platform
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex items-center gap-1 xl:gap-2">
              {navLinks.map((item) => {
                const isAnchor = item.href.includes('#');
                const Tag = isAnchor ? 'a' : Link;
                const linkProps = isAnchor ? { href: item.href } : { to: item.href };

                return (
                  <Tag
                    key={item.label}
                    {...linkProps as any}
                    className="relative inline-flex items-center px-3.5 py-2 rounded-lg text-xs xl:text-sm font-medium whitespace-nowrap text-[#252525] hover:text-[#85845C] transition-colors duration-200 group"
                  >
                    <span>{item.label}</span>
                    <span className="absolute bottom-1 left-3.5 right-3.5 h-0.5 bg-[#85845C] scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-center" />
                  </Tag>
                );
              })}

              {/* Quick Links Dropdown (Desktop) */}
              <div className="relative shrink-0" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setQuickLinksOpen(!quickLinksOpen)}
                  onMouseEnter={() => setQuickLinksOpen(true)}
                  aria-expanded={quickLinksOpen}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs xl:text-sm font-medium whitespace-nowrap transition-colors duration-200 cursor-pointer ${
                    quickLinksOpen ? 'text-[#85845C] bg-[#F5F5F1]' : 'text-[#252525] hover:text-[#85845C]'
                  }`}
                >
                  <span>Quick Links</span>
                  <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${quickLinksOpen ? 'rotate-180 text-[#85845C]' : 'text-[#666666]'}`} />
                </button>

                {quickLinksOpen && (
                  <div
                    onMouseLeave={() => setQuickLinksOpen(false)}
                    className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl border border-[#E5E5DF] shadow-lg p-2.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    <div className="px-3 py-1.5 mb-1.5 border-b border-[#E5E5DF]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#85845C]">
                        Navigation Directory
                      </span>
                    </div>
                    <div className="space-y-1">
                      {quickLinks.map((ql) => {
                        const isAnchor = ql.href.includes('#');
                        const Tag = isAnchor ? 'a' : Link;
                        const linkProps = isAnchor ? { href: ql.href } : { to: ql.href };
                        const Icon = ql.icon;

                        return (
                          <Tag
                            key={ql.label}
                            {...linkProps as any}
                            onClick={() => setQuickLinksOpen(false)}
                            className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#F5F5F1] transition-colors group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-[#F5F5F1] group-hover:bg-[#85845C] flex items-center justify-center shrink-0 transition-colors">
                              <Icon className="w-4 h-4 text-[#85845C] group-hover:text-white transition-colors" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[#252525] group-hover:text-[#85845C] transition-colors">
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
            </div>

            {/* Desktop CTAs: Clean Dark Olive Action Button */}
            <div className="hidden lg:flex items-center gap-3">
              <Link
                to="/login"
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#252525] hover:text-[#85845C] hover:bg-[#F5F5F1] transition duration-150"
              >
                Portal Login
              </Link>
              <Link
                to="/register"
                className="btn-olive-primary inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold"
              >
                <span>Get Started</span>
                <ArrowRight className="w-3.5 h-3.5 text-white" />
              </Link>
            </div>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
              aria-expanded={mobileMenuOpen}
              className="lg:hidden p-2 rounded-xl text-[#252525] hover:bg-[#F5F5F1] transition cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </nav>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-[#E5E5DF] px-4 py-5 shadow-lg max-h-[85vh] overflow-y-auto space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Primary Nav Links */}
            <div className="space-y-1">
              {navLinks.map((item) => {
                const isAnchor = item.href.includes('#');
                const Tag = isAnchor ? 'a' : Link;
                const linkProps = isAnchor ? { href: item.href } : { to: item.href };

                return (
                  <Tag
                    key={item.label}
                    {...linkProps as any}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3.5 py-2.5 rounded-lg text-sm font-medium text-[#252525] hover:bg-[#F5F5F1] hover:text-[#85845C] transition"
                  >
                    {item.label}
                  </Tag>
                );
              })}
            </div>

            {/* Mobile Quick Links Section */}
            <div className="pt-3 border-t border-[#E5E5DF]">
              <p className="px-3.5 text-[11px] font-bold uppercase tracking-wider text-[#85845C] mb-2">
                Quick Links Directory
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {quickLinks.map((ql) => {
                  const isAnchor = ql.href.includes('#');
                  const Tag = isAnchor ? 'a' : Link;
                  const linkProps = isAnchor ? { href: ql.href } : { to: ql.href };
                  const Icon = ql.icon;

                  return (
                    <Tag
                      key={ql.label}
                      {...linkProps as any}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-xs font-medium text-[#252525] hover:bg-[#F5F5F1] hover:text-[#85845C] transition"
                    >
                      <Icon className="w-3.5 h-3.5 text-[#85845C]" />
                      <span>{ql.label}</span>
                    </Tag>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-[#E5E5DF] flex flex-col gap-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-xl text-xs font-semibold border border-[#E5E5DF] text-[#252525] hover:bg-[#F5F5F1] transition"
              >
                Portal Login
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="btn-olive-primary w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
