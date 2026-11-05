import { useState, useEffect } from 'react';
import {
  apiGetPublicHomepage,
  apiGetAdminHomepageDraft,
  type HomepageContentSnapshot,
  type PlanData,
} from '../../services/homepage.service';
import PublicNavbar from '../../components/public/PublicNavbar';
import QuranVerseMarquee from '../../components/public/QuranVerseMarquee';
import HeroSection from '../../components/public/HeroSection';
import TrustStrip from '../../components/public/TrustStrip';
import ProductShowcaseSection from '../../components/public/ProductShowcaseSection';
import FeaturesSection from '../../components/public/FeaturesSection';
import HowItWorksSection from '../../components/public/HowItWorksSection';
import PricingSection from '../../components/public/PricingSection';
import AboutSection from '../../components/public/AboutSection';
import SecuritySection from '../../components/public/SecuritySection';
import CTASection from '../../components/public/CTASection';
import ContactSection from '../../components/public/ContactSection';
import PublicFooter from '../../components/public/PublicFooter';
import FloatingWhatsAppButton from '../../components/public/FloatingWhatsAppButton';
import { Loader2, Eye, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

// Safe static fallback marketing shell matching Section 45 & Section 11 of master prompt
const FALLBACK_HOMEPAGE_SHELL: HomepageContentSnapshot = {
  hero: {
    eyebrow: 'Modern Madrasa Management Platform',
    title: 'Manage Your Madrasa Smarter. Teach Better. Grow Further.',
    highlightedText: 'Teach Better. Grow Further.',
    description:
      'A modern all-in-one platform for managing students, classes, fees, attendance, reports and everyday Madrasa operations securely.',
    primaryCtaLabel: 'Get Started',
    primaryCtaUrl: '/register',
    secondaryCtaLabel: 'Explore Features',
    secondaryCtaUrl: '#features',
    enabled: true,
  },
  heroMedia: {
    enabled: true,
    autoplay: true,
    autoplayInterval: 5000,
    items: [],
  },
  productPreviewMedia: {
    enabled: true,
    fileId: null,
    url: null,
    alt: '',
    caption: null,
  },
  whatsapp: {
    enabled: true,
    number: '+94 78 325 4552',
    defaultMessage: 'Assalamu Alaikum, I would like to know more about MadrasaNexa.',
  },
  trustStrip: [
    { id: 'trust-1', text: 'Multi-Tenant Data Isolation', icon: 'ShieldCheck', enabled: true },
    { id: 'trust-2', text: 'Role-Based Access Control', icon: 'Lock', enabled: true },
    { id: 'trust-3', text: 'Secure Private Receipt Access', icon: 'Shield', enabled: true },
    { id: 'trust-4', text: 'Cloud File Storage', icon: 'Cloud', enabled: true },
    { id: 'trust-5', text: 'Professional Reports', icon: 'FileText', enabled: true },
  ],
  features: [
    {
      id: 'feat-students',
      title: 'Student & Academic Records',
      description: 'Comprehensive student profiles, guardian information, enrollment history, and document tracking with full tenant data privacy.',
      icon: 'GraduationCap',
      sortOrder: 1,
      enabled: true,
    },
    {
      id: 'feat-attendance',
      title: 'Daily Attendance Management',
      description: 'Fast, intuitive daily attendance tracking by class and section with automatic summaries and absence follow-up records.',
      icon: 'Calendar',
      sortOrder: 2,
      enabled: true,
    },
    {
      id: 'feat-fees',
      title: 'Fee POS & Invoice Management',
      description: 'Generate itemized student fee invoices, record multi-method payments with printable official receipts, and monitor balances.',
      icon: 'DollarSign',
      sortOrder: 3,
      enabled: true,
    },
    {
      id: 'feat-classes',
      title: 'Class & Academic Structure',
      description: 'Organize your Madrasa by academic sections, class levels, teachers, and capacity limits seamlessly.',
      icon: 'Layers',
      sortOrder: 4,
      enabled: true,
    },
    {
      id: 'feat-reports',
      title: 'Reports & Analytics Center',
      description: 'Generate institutional insights on student demographics, fee collection efficiency, and attendance trends on demand.',
      icon: 'BarChart3',
      sortOrder: 5,
      enabled: true,
    },
    {
      id: 'feat-announcements',
      title: 'Announcement Center',
      description: 'Broadcast urgent announcements, maintenance alerts, and academic updates directly to teachers and staff.',
      icon: 'Megaphone',
      sortOrder: 6,
      enabled: true,
    },
    {
      id: 'feat-storage',
      title: 'Secure Media & Documents',
      description: 'Cloud-native storage for student photos, birth certificates, institutional branding, and bank transfer payment receipts.',
      icon: 'Cloud',
      sortOrder: 7,
      enabled: true,
    },
    {
      id: 'feat-security',
      title: 'Role-Based Workspace Control',
      description: 'Strict role separation between Super Admin oversight and Madrasa Admin operational control with zero cross-tenant leakage.',
      icon: 'ShieldCheck',
      sortOrder: 8,
      enabled: true,
    },
  ],
  howItWorks: [
    {
      id: 'step-1',
      step: 1,
      title: 'Register Your Madrasa',
      description: 'Submit your institutional onboarding application with contact and location details.',
      enabled: true,
    },
    {
      id: 'step-2',
      step: 2,
      title: 'Platform Approval',
      description: 'Super Admin reviews and approves your registration application to verify your institution.',
      enabled: true,
    },
    {
      id: 'step-3',
      step: 3,
      title: 'Choose a Subscription Plan',
      description: 'Select the active subscription plan that best fits your Madrasa\'s student capacity.',
      enabled: true,
    },
    {
      id: 'step-4',
      step: 4,
      title: 'Submit Payment Receipt',
      description: 'Transfer fees directly to official platform bank details and submit your payment receipt for verification.',
      enabled: true,
    },
    {
      id: 'step-5',
      step: 5,
      title: 'Payment Approval & Start Managing',
      description: 'Super Admin verifies payment to activate your subscription and unlock all management modules.',
      enabled: true,
    },
  ],
  security: {
    heading: 'Built with Architectural Rigor & Multi-Tenant Data Isolation',
    description:
      'MadrasaNexa enforces strict multi-tenant data isolation, role-based access control, hashed credential authentication, and short-lived authorized receipt access.',
    items: [
      {
        id: 'sec-1',
        title: 'Multi-Tenant Data Isolation',
        description: 'Every database query and storage operation enforces strict madrasaId scoping. No Madrasa can access another institution’s records.',
        icon: 'Lock',
        enabled: true,
      },
      {
        id: 'sec-2',
        title: 'Role-Based Access Control',
        description: 'Granular role separation isolates Super Admin platform oversight from Madrasa Admin institutional management.',
        icon: 'ShieldCheck',
        enabled: true,
      },
      {
        id: 'sec-3',
        title: 'Secure Private Receipt Access',
        description: 'Subscription payment receipts are kept in private storage, accessible solely via 15-minute authorized presigned URLs.',
        icon: 'Shield',
        enabled: true,
      },
      {
        id: 'sec-4',
        title: 'Secure Password Authentication',
        description: 'User passwords are protected with strong one-way cryptographic hashing (bcrypt) and mandatory temporary password rotations.',
        icon: 'FileText',
        enabled: true,
      },
    ],
    enabled: true,
  },
  cta: {
    heading: 'Ready to Modernize Your Madrasa Operations?',
    description:
      'Join modern institutions streamlining their academic records, student attendance, fee collections, and reporting.',
    primaryCtaLabel: 'Start Madrasa Onboarding',
    primaryCtaUrl: '/register',
    secondaryCtaLabel: 'Login to Portal',
    secondaryCtaUrl: '/login',
    enabled: true,
  },
  contact: {
    headline: 'Connect with Platform Administration',
    description: 'Have questions about onboarding, institutional subscription plans, or platform capabilities?',
    email: null,
    phone: null,
    address: null,
    officeHours: null,
    enabled: true,
  },
  footer: {
    platformDescription:
      'Next-generation cloud administration platform designed specifically for modern Islamic educational institutions.',
    copyrightText: 'MadrasaNexa Platform. All rights reserved.',
    quickLinks: [
      { label: 'Features', url: '#features' },
      { label: 'How It Works', url: '#how-it-works' },
      { label: 'Subscription Plans', url: '#pricing' },
      { label: 'About Us', url: '/about-us' },
      { label: 'Register Madrasa', url: '/register' },
      { label: 'Admin Login', url: '/login' },
    ],
  },
  seo: {
    metaTitle: 'MadrasaNexa — Modern Madrasa Management Platform',
    metaDescription: 'All-in-one cloud platform for Madrasa student records, classes, fee collections, attendance, and reporting.',
    ogTitle: 'MadrasaNexa — Modern Madrasa Management Platform',
    ogDescription: 'Streamline Madrasa administration with multi-tenant security, automated billing, and student records.',
  },
};

interface HomePageProps {
  previewMode?: boolean;
  previewData?: HomepageContentSnapshot | null;
}

export default function HomePage({ previewMode = false, previewData = null }: HomePageProps) {
  const [content, setContent] = useState<HomepageContentSnapshot>(FALLBACK_HOMEPAGE_SHELL);
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [aboutUs, setAboutUs] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(!previewMode);

  useEffect(() => {
    if (previewMode && previewData) {
      setContent(previewData);
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function loadHomepage() {
      try {
        if (previewMode) {
          const draftRes = await apiGetAdminHomepageDraft();
          if (!isMounted) return;
          if (draftRes?.draftContent) {
            setContent(draftRes.draftContent);
          }
          const pubRes = await apiGetPublicHomepage().catch(() => null);
          if (isMounted && pubRes) {
            if (Array.isArray(pubRes.plans)) setPlans(pubRes.plans);
            if (pubRes.aboutUs) setAboutUs(pubRes.aboutUs);
          }
          return;
        }

        const res = await apiGetPublicHomepage();
        if (!isMounted) return;

        if (res.status === 'PUBLISHED' && res.content) {
          setContent(res.content);
        } else {
          setContent(FALLBACK_HOMEPAGE_SHELL);
        }

        if (Array.isArray(res.plans)) {
          setPlans(res.plans);
        }

        if (res.aboutUs) {
          setAboutUs(res.aboutUs);
        }

        // Apply SEO Meta Title if present
        const activeSeo = res.status === 'PUBLISHED' && res.content?.seo ? res.content.seo : FALLBACK_HOMEPAGE_SHELL.seo;
        if (activeSeo?.metaTitle) {
          document.title = activeSeo.metaTitle;
        }
      } catch (err) {
        console.error('[HomePage] Failed to load public homepage data, using safe fallback shell:', err);
        if (isMounted) {
          setContent(FALLBACK_HOMEPAGE_SHELL);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadHomepage();
    return () => {
      isMounted = false;
    };
  }, [previewMode, previewData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F1] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#85845C]" />
          <p className="text-xs font-semibold text-[#666666] tracking-wider uppercase">
            Loading MadrasaNexa...
          </p>
        </div>
      </div>
    );
  }

  const contactHasData = Boolean(
    content.contact?.enabled &&
      (content.contact.email || content.contact.phone || content.contact.address || content.contact.officeHours)
  );

  return (
    <div className="min-h-screen bg-white text-[#252525] font-sans antialiased selection:bg-[#A5A477]/20 selection:text-[#252525]">
      {/* Super Admin Preview Banner */}
      {previewMode && (
        <div className="sticky top-0 z-60 bg-amber-500 text-amber-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            <span>Draft Preview Mode — Changes are not yet published to the public website.</span>
          </div>
          <Link
            to="/super-admin/website-content"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-950 text-white hover:bg-black transition text-[11px]"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Back to Editor</span>
          </Link>
        </div>
      )}

      {/* Floating Glass Navbar */}
      <PublicNavbar contactEnabled={contactHasData} />

      {/* Horizontal Qur'an Verse Marquee */}
      <QuranVerseMarquee />

      {/* 1. Hero Section with Layered Product Preview */}
      <HeroSection data={content.hero} heroMedia={content.heroMedia} />

      {/* 2. Architectural Trust Strip */}
      <TrustStrip items={content.trustStrip} />

      {/* 2b. Product Showcase (Screenshot with Lightbox or Interactive Mockup) */}
      <ProductShowcaseSection productPreviewMedia={content.productPreviewMedia} />

      {/* 3. Bento-Grid Features Section */}
      <FeaturesSection features={content.features} />

      {/* 4. Connected Process Timeline */}
      <HowItWorksSection steps={content.howItWorks} />

      {/* 5. Authoritative Pricing Plans */}
      <PricingSection plans={plans} />

      {/* 6. Authoritative Global About Us Snapshot */}
      <AboutSection aboutUs={aboutUs} />

      {/* 7. Security Architecture Pillars */}
      <SecuritySection data={content.security} />

      {/* 8. Dark Navy CTA Banner */}
      <CTASection data={content.cta} />

      {/* 9. Contact Section (Gracefully omitted if empty) */}
      <ContactSection data={content.contact} />

      {/* 10. Multi-Column Footer */}
      <PublicFooter data={content.footer} contactEnabled={contactHasData} />

      {/* 11. Floating WhatsApp Button */}
      <FloatingWhatsAppButton
        enabled={content.whatsapp?.enabled}
        number={content.whatsapp?.number}
        defaultMessage={content.whatsapp?.defaultMessage}
      />
    </div>
  );
}
