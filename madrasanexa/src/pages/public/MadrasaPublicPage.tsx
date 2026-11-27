import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGetPublicMadrasaProfile } from '../../services/api';
import type { PublicMadrasaProfile } from '../../services/api';
import { AlertCircle } from 'lucide-react';
import { resolvePublicTheme } from '../../components/madrasa-public/publicThemeHelper';
import { MadrasaPublicNavbar } from '../../components/madrasa-public/MadrasaPublicNavbar';
import { MadrasaPublicHero } from '../../components/madrasa-public/MadrasaPublicHero';
import { MadrasaPublicKnowledgeStrip } from '../../components/madrasa-public/MadrasaPublicKnowledgeStrip';
import { MadrasaPublicHighlightStrip } from '../../components/madrasa-public/MadrasaPublicHighlightStrip';
import { MadrasaPublicDisciplines } from '../../components/madrasa-public/MadrasaPublicDisciplines';
import { MadrasaPublicSplitBanner } from '../../components/madrasa-public/MadrasaPublicSplitBanner';
import { MadrasaPublicTestimonials } from '../../components/madrasa-public/MadrasaPublicTestimonials';
import { MadrasaPublicNewsletter } from '../../components/madrasa-public/MadrasaPublicNewsletter';
import { IslamicSectionDivider } from '../../components/common/IslamicSectionDivider';
import { MadrasaPublicAbout } from '../../components/madrasa-public/MadrasaPublicAbout';
import { MadrasaPublicMissionVision } from '../../components/madrasa-public/MadrasaPublicMissionVision';
import { MadrasaPublicCurriculum } from '../../components/madrasa-public/MadrasaPublicCurriculum';
import { MadrasaPublicNotices } from '../../components/madrasa-public/MadrasaPublicNotices';
import { MadrasaPublicEvents } from '../../components/madrasa-public/MadrasaPublicEvents';
import { MadrasaPublicStats } from '../../components/madrasa-public/MadrasaPublicStats';
import { MadrasaPublicStaff } from '../../components/madrasa-public/MadrasaPublicStaff';
import { MadrasaPublicExecutive } from '../../components/madrasa-public/MadrasaPublicExecutive';
import { MadrasaPublicAlumni } from '../../components/madrasa-public/MadrasaPublicAlumni';
import { MadrasaPublicAdmissionsCTA } from '../../components/madrasa-public/MadrasaPublicAdmissionsCTA';
import { MadrasaPublicContact } from '../../components/madrasa-public/MadrasaPublicContact';
import { MadrasaPublicFooter } from '../../components/madrasa-public/MadrasaPublicFooter';

export const MadrasaPublicPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<PublicMadrasaProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Ensure the public madrasa website strictly stays in clean Light Mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    apiGetPublicMadrasaProfile(slug)
      .then((data) => {
        setProfile(data);
      })
      .catch((err) => {
        const msg =
          err.response?.data?.message ||
          'This madrasa portal is currently in preparation or unavailable.';
        setError(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  // Handle direct hash navigation after profile has loaded and rendered
  useEffect(() => {
    if (!loading && profile && window.location.hash) {
      const hash = window.location.hash;
      const id = hash.replace('#', '');
      const timer = setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          const headerOffset = 88;
          const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
          window.scrollTo({
            top: Math.max(0, elementPosition - headerOffset),
            behavior: 'smooth',
          });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [loading, profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-[#85845C] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[#252525] font-semibold text-sm tracking-wide">Loading institutional portal...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-[#E5E5DF] p-8 text-center">
          <div className="w-16 h-16 bg-[#F5F5F1] rounded-full flex items-center justify-center mx-auto mb-4 text-[#85845C]">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-[#252525] mb-2">Portal Unavailable</h2>
          <p className="text-[#666666] text-sm mb-6 leading-relaxed">
            {error || 'This madrasa portal has not been published yet or is temporarily inaccessible.'}
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#85845C] text-white font-medium text-sm hover:bg-[#504F34] transition-colors shadow-xs"
          >
            Return to MadrasaNexa Home
          </Link>
        </div>
      </div>
    );
  }

  const { madrasa } = profile;
  const theme = resolvePublicTheme(profile.theme);
  const hasActiveAdmissions =
    Boolean(profile.activeAdmissionPeriods && profile.activeAdmissionPeriods.length > 0);
  const firstActiveIntake = profile.activeAdmissionPeriods?.[0];
  const hasEvents = Boolean(profile.events && profile.events.length > 0);
  const hasNotices = Boolean(profile.notices && profile.notices.length > 0);
  const hasStaff = Boolean(profile.staff && profile.staff.isEnabled && profile.staff.members && profile.staff.members.length > 0);
  const hasExecutive = Boolean(profile.executiveMembers && profile.executiveMembers.length > 0);
  const hasAlumni = Boolean((madrasa as any).showAlumniOnWebsite);

  return (
    <div
      className="min-h-screen flex flex-col font-sans selection:bg-[#F5F5F1] selection:text-[#252525] overflow-x-clip bg-gradient-to-b from-[#FAF8F3] via-[#F5F3EC] to-[#F8F6F1] relative"
      style={{
        color: theme.bodyTextColor || '#252525',
      }}
    >
      {/* Ambient warm golden glow lighting across background canvas */}
      <div
        className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[950px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.11)_0%,rgba(197,160,89,0.05)_50%,transparent_75%)] blur-3xl" />
        <div className="absolute top-[32%] -left-32 w-[650px] h-[650px] bg-[radial-gradient(circle,rgba(197,160,89,0.08)_0%,transparent_70%)] blur-3xl" />
        <div className="absolute top-[68%] -right-32 w-[700px] h-[700px] bg-[radial-gradient(circle,rgba(212,175,55,0.09)_0%,transparent_70%)] blur-3xl" />
      </div>

      {/* 1. Institutional Navigation Header */}
      <MadrasaPublicNavbar
        slug={slug!}
        madrasaName={madrasa.name}
        logoUrl={madrasa.logoUrl}
        initials={madrasa.initials}
        theme={theme}
        hasActiveAdmissions={hasActiveAdmissions}
        hasEvents={hasEvents}
        hasNotices={hasNotices}
        hasStaff={hasStaff}
        hasAlumni={hasAlumni}
        hasExecutive={hasExecutive}
        activeIntakeCount={profile.activeAdmissionPeriods?.length || 0}
      />

      {/* 2. Institutional Hero Section */}
      <MadrasaPublicHero
        slug={slug!}
        madrasaName={madrasa.name}
        heroTitle={profile.heroTitle}
        heroSubtitle={profile.heroSubtitle}
        heroImageUrl={profile.heroImageUrl}
        theme={theme}
        hasActiveAdmissions={hasActiveAdmissions}
        activeIntakeName={firstActiveIntake?.name}
        activeAcademicYear={firstActiveIntake?.academicYear}
      />

      {/* 2.5. Editorial Floating Highlight Strip */}
      <MadrasaPublicHighlightStrip
        slug={slug!}
        theme={theme}
        hasActiveAdmissions={hasActiveAdmissions}
        activeIntakeName={firstActiveIntake?.name}
        activeAcademicYear={firstActiveIntake?.academicYear}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-12 sm:space-y-16 w-full">

        {/* 2.7. Live Hijri Date & Sacred Knowledge Wisdom Strip */}
        <MadrasaPublicKnowledgeStrip theme={theme} className="rounded-2xl" />

        {/* 2.8. Academic Pathways & Sacred Sciences (4-Column Feature Cards) */}
        <MadrasaPublicDisciplines theme={theme} />

        {/* 3. About Our Madrasa & Summary */}
        <MadrasaPublicAbout
          madrasaName={madrasa.name}
          introduction={profile.introduction}
          generatedSummary={profile.generatedSummary}
          theme={theme}
        />

        <IslamicSectionDivider />

        {/* 3.5. Deep Green Split Feature Banner with Side Highlights */}
        <MadrasaPublicSplitBanner
          madrasaName={madrasa.name}
          theme={theme}
        />

        <IslamicSectionDivider />

        {/* 4. Guiding Purpose: Mission & Vision */}
        <MadrasaPublicMissionVision
          mission={profile.mission}
          vision={profile.vision}
          theme={theme}
        />

        <IslamicSectionDivider />

        {/* 5. Academic Curriculum & Institutional Conduct */}
        <MadrasaPublicCurriculum
          syllabusInfo={profile.syllabusInfo}
          rulesAndRegulations={profile.rulesAndRegulations}
          curriculum={profile.curriculum}
          theme={theme}
        />

        {/* 6. Living Academic Statistics */}
        {profile.stats ? (
          <>
            <IslamicSectionDivider />
            <MadrasaPublicStats
              stats={profile.stats}
              theme={theme}
            />
          </>
        ) : null}

        {/* 7. Scholarly Faculty & Leadership */}
        {hasStaff && profile.staff ? (
          <>
            <IslamicSectionDivider />
            <MadrasaPublicStaff
              staff={profile.staff}
              theme={theme}
            />
          </>
        ) : null}

        {/* 7.2. Executive Committee & Board of Management */}
        {hasExecutive && profile.executiveMembers ? (
          <>
            <IslamicSectionDivider />
            <MadrasaPublicExecutive
              executiveMembers={profile.executiveMembers}
              theme={theme}
            />
          </>
        ) : null}

        {/* 7.5. Undergraduate & Alumni Hub */}
        {hasAlumni ? (
          <>
            <IslamicSectionDivider />
            <MadrasaPublicAlumni
              madrasaCode={madrasa.code || slug!}
              madrasaName={madrasa.name}
              theme={theme}
            />
          </>
        ) : null}

        {/* 8. Upcoming Institutional Events */}
        {hasEvents ? (
          <>
            <IslamicSectionDivider />
            <MadrasaPublicEvents
              events={profile.events}
              theme={theme}
            />
          </>
        ) : null}

        {/* 9. Institutional Circulars & Notices */}
        {hasNotices ? (
          <>
            <IslamicSectionDivider />
            <MadrasaPublicNotices
              notices={profile.notices}
              theme={theme}
            />
          </>
        ) : null}

        <IslamicSectionDivider />

        {/* 9.3. Words of Reflection & Community Trust (Testimonials) */}
        <MadrasaPublicTestimonials
          madrasaName={madrasa.name}
          theme={theme}
        />

        {/* 9.6. Stay Informed & Connected (Newsletter Strip) */}
        <MadrasaPublicNewsletter
          madrasaName={madrasa.name}
        />

        <IslamicSectionDivider />

        {/* 8. Admissions Callout Banner */}
        <MadrasaPublicAdmissionsCTA
          slug={slug!}
          theme={theme}
          hasActiveAdmissions={hasActiveAdmissions}
          activeIntakeName={firstActiveIntake?.name}
          activeAcademicYear={firstActiveIntake?.academicYear}
        />

        <IslamicSectionDivider />

        {/* 9. Contact Directory & Campus Location */}
        <MadrasaPublicContact
          madrasaName={madrasa.name}
          address={profile.address}
          contactPhone={profile.contactPhone}
          contactEmail={profile.contactEmail}
          theme={theme}
        />

      </main>

      {/* 10. Institutional Footer */}
      <MadrasaPublicFooter
        slug={slug!}
        madrasaName={madrasa.name}
        logoUrl={madrasa.logoUrl}
        initials={madrasa.initials}
        introduction={profile.introduction}
        theme={theme}
        hasEvents={hasEvents}
        hasNotices={hasNotices}
      />
    </div>
  );
};

export default MadrasaPublicPage;
