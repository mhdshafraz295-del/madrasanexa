import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGetPublicMadrasaProfile } from '../../services/api';
import type { PublicMadrasaProfile } from '../../services/api';
import { AlertCircle } from 'lucide-react';
import { resolvePublicTheme } from '../../components/madrasa-public/publicThemeHelper';
import { MadrasaPublicNavbar } from '../../components/madrasa-public/MadrasaPublicNavbar';
import { MadrasaPublicHero } from '../../components/madrasa-public/MadrasaPublicHero';
import { MadrasaPublicAbout } from '../../components/madrasa-public/MadrasaPublicAbout';
import { MadrasaPublicMissionVision } from '../../components/madrasa-public/MadrasaPublicMissionVision';
import { MadrasaPublicCurriculum } from '../../components/madrasa-public/MadrasaPublicCurriculum';
import { MadrasaPublicNotices } from '../../components/madrasa-public/MadrasaPublicNotices';
import { MadrasaPublicEvents } from '../../components/madrasa-public/MadrasaPublicEvents';
import { MadrasaPublicStats } from '../../components/madrasa-public/MadrasaPublicStats';
import { MadrasaPublicStaff } from '../../components/madrasa-public/MadrasaPublicStaff';
import { MadrasaPublicAdmissionsCTA } from '../../components/madrasa-public/MadrasaPublicAdmissionsCTA';
import { MadrasaPublicContact } from '../../components/madrasa-public/MadrasaPublicContact';
import { MadrasaPublicFooter } from '../../components/madrasa-public/MadrasaPublicFooter';

export const MadrasaPublicPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<PublicMadrasaProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div
      className="min-h-screen flex flex-col font-sans selection:bg-[#F5F5F1] selection:text-[#252525]"
      style={{
        backgroundColor: theme.pageBg || '#ffffff',
        color: theme.bodyTextColor || '#252525',
      }}
    >
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-20 sm:space-y-24 w-full">

        {/* 3. About Our Madrasa & Summary */}
        <MadrasaPublicAbout
          madrasaName={madrasa.name}
          introduction={profile.introduction}
          generatedSummary={profile.generatedSummary}
          theme={theme}
        />

        {/* 4. Guiding Purpose: Mission & Vision */}
        <MadrasaPublicMissionVision
          mission={profile.mission}
          vision={profile.vision}
          theme={theme}
        />

        {/* 5. Academic Curriculum & Institutional Conduct */}
        <MadrasaPublicCurriculum
          syllabusInfo={profile.syllabusInfo}
          rulesAndRegulations={profile.rulesAndRegulations}
          curriculum={profile.curriculum}
          theme={theme}
        />

        {/* 6. Living Academic Statistics */}
        {profile.stats ? (
          <MadrasaPublicStats
            stats={profile.stats}
            theme={theme}
          />
        ) : null}

        {/* 7. Scholarly Faculty & Leadership */}
        {hasStaff && profile.staff ? (
          <MadrasaPublicStaff
            staff={profile.staff}
            theme={theme}
          />
        ) : null}

        {/* 8. Upcoming Institutional Events */}
        {hasEvents ? (
          <MadrasaPublicEvents
            events={profile.events}
            theme={theme}
          />
        ) : null}

        {/* 9. Institutional Circulars & Notices */}
        {hasNotices ? (
          <MadrasaPublicNotices
            notices={profile.notices}
            theme={theme}
          />
        ) : null}

        {/* 8. Admissions Callout Banner */}
        <MadrasaPublicAdmissionsCTA
          slug={slug!}
          theme={theme}
          hasActiveAdmissions={hasActiveAdmissions}
          activeIntakeName={firstActiveIntake?.name}
          activeAcademicYear={firstActiveIntake?.academicYear}
        />

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
