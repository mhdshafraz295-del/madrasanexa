import React from 'react';
import { Link } from 'react-router-dom';
import type {
  AboutUsContentSnapshot,
  AboutUsLanguage,
  FieldMetadata,
  FieldOriginMeta,
} from '../../services/aboutUs.service';
import { getAboutUiLabels } from './aboutUsDictionary';
import {
  Compass,
  Target,
  ShieldCheck,
  Award,
  BookOpen,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Globe2,
} from 'lucide-react';

interface AboutUsContentViewProps {
  content: AboutUsContentSnapshot;
  isPreview?: boolean;
  variant?: 'default' | 'admin';
  language?: AboutUsLanguage;
  direction?: 'ltr' | 'rtl';
  fieldMetadata?: FieldMetadata;
}

// Icon mapper for core values
const iconMap: Record<string, React.ElementType> = {
  Shield: ShieldCheck,
  Award: Award,
  Book: BookOpen,
  Compass: Compass,
  Target: Target,
  Users: Users,
  Sparkles: Sparkles,
  Default: CheckCircle2,
};

/**
 * Renders a localized text block with bidi isolation when an English fallback field is rendered in an RTL page.
 */
function renderText(
  text: string | null | undefined,
  meta?: FieldOriginMeta,
  fallbackLang: AboutUsLanguage = 'en'
): React.ReactNode {
  if (!text) return null;
  const lang = meta?.lang || fallbackLang;
  const dir = meta?.dir || (lang === 'ar' ? 'rtl' : 'ltr');
  const isFallback = meta?.isFallback || false;

  if (isFallback) {
    return (
      <span lang="en" dir="ltr" className="inline-block text-left font-sans">
        {text}
      </span>
    );
  }

  return (
    <span lang={lang} dir={dir}>
      {text}
    </span>
  );
}

export default function AboutUsContentView({
  content,
  isPreview = false,
  variant = 'default',
  language = 'en',
  direction,
  fieldMetadata,
}: AboutUsContentViewProps) {
  const {
    title,
    subtitle,
    introduction,
    story,
    mission,
    vision,
    coreValues = [],
    highlights = [],
    ctaLabel,
    ctaUrl,
    heroImageUrl,
    heroAlt,
    storyImageUrl,
    storyAlt,
  } = content;

  const effectiveLang = language || 'en';
  const effectiveDir = direction || (effectiveLang === 'ar' ? 'rtl' : 'ltr');
  const isRtl = effectiveDir === 'rtl';
  const ui = getAboutUiLabels(effectiveLang);

  // Resolved hero/story image alt attributes (handling both heroAlt and public heroImageAlt)
  const heroAltText = heroAlt || (content as any).heroImageAlt || title || ui.platformShowcase;
  const storyAltText = storyAlt || (content as any).storyImageAlt || ui.heritagePurpose;

  // Safe CTA click/link resolution
  const isExternalCta = ctaUrl?.toLowerCase().startsWith('https://');
  const safeCtaUrl = ctaUrl && (ctaUrl.startsWith('/') || isExternalCta) ? ctaUrl : null;

  const ActionArrow = isRtl ? ArrowLeft : ArrowRight;

  if (variant === 'admin') {
    return (
      <div
        lang={effectiveLang}
        dir={effectiveDir}
        className={`w-full text-[#0F172A] font-sans space-y-8 sm:space-y-12 ${
          isRtl ? 'text-right' : 'text-left'
        }`}
      >
        {/* 1. Hero Section Card */}
        <div className="bg-white rounded-3xl border border-[#E5E5DF] p-6 sm:p-10 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F5F5F1] border border-[#E5E5DF]">
                <Globe2 className="w-4 h-4 text-[#85845C]" />
                <span className="text-xs font-bold tracking-wider uppercase text-[#85845C]">
                  {ui.globalPlatform}
                </span>
              </div>

              <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#252525] leading-tight">
                {renderText(title || 'MadrasaNexa Global Islamic Educational Platform', fieldMetadata?.title, effectiveLang)}
              </h1>

              <p className="text-sm sm:text-base text-[#666666] leading-relaxed max-w-2xl font-normal">
                {renderText(subtitle || 'Unified cloud management for Islamic institutions globally.', fieldMetadata?.subtitle, effectiveLang)}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                {safeCtaUrl && ctaLabel ? (
                  isExternalCta ? (
                    <a
                      href={safeCtaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-olive-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold"
                    >
                      <span>{renderText(ctaLabel, fieldMetadata?.ctaLabel, effectiveLang)}</span>
                      <ActionArrow className="w-4 h-4 text-white" />
                    </a>
                  ) : (
                    <Link
                      to={safeCtaUrl}
                      className="btn-olive-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold"
                    >
                      <span>{renderText(ctaLabel, fieldMetadata?.ctaLabel, effectiveLang)}</span>
                      <ActionArrow className="w-4 h-4 text-white" />
                    </Link>
                  )
                ) : null}

                <Link
                  to="/about-us"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-[#F5F5F1] border border-[#E5E5DF] text-[#252525] text-xs font-bold transition shadow-2xs"
                >
                  <span>{ui.viewPublicPage}</span>
                  <ActionArrow className="w-3.5 h-3.5 text-[#666666]" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative rounded-2xl overflow-hidden border border-[#E7E9EE] bg-[#F7F6F1] shadow-xs aspect-[4/3]">
                {heroImageUrl ? (
                  <img
                    src={heroImageUrl}
                    alt={heroAltText}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#7C8A9A] p-6 text-center">
                    <Globe2 className="w-12 h-12 text-[#85845C] mb-3 opacity-60" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#0F172A]">
                      {ui.platformShowcase}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Global Reach Stat Card */}
        {highlights.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {highlights.map((item, idx) => {
              const metaItem = fieldMetadata?.highlights?.find((h) => h.id === item.id);
              return (
                <div
                  key={item.id || idx}
                  className="p-6 rounded-2xl bg-white border border-[#E7E9EE] shadow-xs space-y-2 hover:border-[#85845C] transition"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#85845C]/10 flex items-center justify-center text-[#85845C] mb-3">
                    <Globe2 className="w-5 h-5 text-[#85845C]" />
                  </div>
                  <div dir="ltr" className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                    {item.metric}
                  </div>
                  <div className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                    {renderText(item.title, metaItem?.title, effectiveLang)}
                  </div>
                  {item.description && (
                    <div className="text-xs text-[#7C8A9A] leading-relaxed">
                      {renderText(item.description, metaItem?.description, effectiveLang)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 3. Our Journey & Purpose */}
        {(introduction || story || storyImageUrl) && (
          <div className="bg-white rounded-3xl border border-[#E7E9EE] p-6 sm:p-10 shadow-xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              <div className="lg:col-span-5 order-2 lg:order-1">
                <div className="relative rounded-2xl overflow-hidden border border-[#E7E9EE] bg-[#F7F6F1] shadow-xs aspect-[4/3]">
                  {storyImageUrl ? (
                    <img
                      src={storyImageUrl}
                      alt={storyAltText}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#7C8A9A] p-6 text-center">
                      <BookOpen className="w-12 h-12 text-[#FFD978] mb-3" />
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#0F172A]">
                        {ui.heritagePurpose}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 order-1 lg:order-2 space-y-4 sm:space-y-6">
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#85845C]">
                    {ui.journeyPurpose}
                  </span>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#0F172A] tracking-tight">
                    {ui.builtForPurpose}
                  </h2>
                  <div className="h-1 w-12 bg-[#85845C] rounded-full mt-2" />
                </div>

                {introduction && (
                  <p className="text-xs sm:text-sm text-[#0F172A] font-medium leading-relaxed">
                    {renderText(introduction, fieldMetadata?.introduction, effectiveLang)}
                  </p>
                )}

                {story && (
                  <p className="text-xs sm:text-sm text-[#7C8A9A] leading-relaxed whitespace-pre-line">
                    {renderText(story, fieldMetadata?.story, effectiveLang)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. Mission & Vision */}
        {(mission || vision) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mission && (
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#E7E9EE] shadow-xs space-y-4 hover:border-[#85845C] transition">
                <div className="w-12 h-12 rounded-2xl bg-[#85845C]/10 border border-[#85845C]/20 flex items-center justify-center text-[#85845C] shadow-2xs">
                  <Target className="w-6 h-6 text-[#85845C]" />
                </div>
                <h3 className="text-lg font-bold text-[#0F172A]">{ui.ourMission}</h3>
                <p className="text-xs sm:text-sm text-[#7C8A9A] leading-relaxed whitespace-pre-line">
                  {renderText(mission, fieldMetadata?.mission, effectiveLang)}
                </p>
              </div>
            )}

            {vision && (
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#E7E9EE] shadow-xs space-y-4 hover:border-[#85845C] transition">
                <div className="w-12 h-12 rounded-2xl bg-[#85845C]/10 border border-[#85845C]/20 flex items-center justify-center text-[#0F172A] shadow-2xs">
                  <Compass className="w-6 h-6 text-[#85845C]" />
                </div>
                <h3 className="text-lg font-bold text-[#0F172A]">{ui.ourVision}</h3>
                <p className="text-xs sm:text-sm text-[#7C8A9A] leading-relaxed whitespace-pre-line">
                  {renderText(vision, fieldMetadata?.vision, effectiveLang)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 5. Foundational Pillars (Core Values) */}
        {coreValues.length > 0 && (
          <div className="bg-white rounded-3xl border border-[#E7E9EE] p-6 sm:p-10 shadow-xs space-y-8">
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#85845C]">
                {ui.foundationalPillars}
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
                {ui.valuesDefineUs}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {coreValues.map((val, idx) => {
                const IconComponent = (val.icon && iconMap[val.icon]) || iconMap.Default;
                const metaVal = fieldMetadata?.coreValues?.find((c) => c.id === val.id);
                return (
                  <div
                    key={val.id || idx}
                    className="p-6 rounded-2xl bg-[#F7F6F1] border border-[#E7E9EE] space-y-3 hover:border-[#85845C] transition"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white border border-[#E7E9EE] flex items-center justify-center text-[#0F172A]">
                      <IconComponent className="w-5 h-5 text-[#85845C]" />
                    </div>
                    <h3 className="text-sm font-bold text-[#0F172A]">
                      {renderText(val.title, metaVal?.title, effectiveLang)}
                    </h3>
                    <p className="text-xs text-[#7C8A9A] leading-relaxed">
                      {renderText(val.description, metaVal?.description, effectiveLang)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. CTA Panel */}
        {safeCtaUrl && ctaLabel && (
          <div className="rounded-3xl bg-[#504F34] text-white p-8 sm:p-12 text-center space-y-6 shadow-xl relative overflow-hidden">
            <div className="max-w-2xl mx-auto space-y-3">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
                {ui.readyToJoin}
              </h2>
              <p className="text-xs sm:text-sm text-[#F5F5F1]/80">
                {ui.joinDescription}
              </p>
            </div>

            <div>
              {isExternalCta ? (
                <a
                  href={safeCtaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-[#F5F5F1] text-[#504F34] text-xs font-bold transition shadow-lg"
                >
                  <span>{renderText(ctaLabel, fieldMetadata?.ctaLabel, effectiveLang)}</span>
                  <ActionArrow className="w-4 h-4" />
                </a>
              ) : (
                <Link
                  to={safeCtaUrl}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-[#F5F5F1] text-[#504F34] text-xs font-bold transition shadow-lg"
                >
                  <span>{renderText(ctaLabel, fieldMetadata?.ctaLabel, effectiveLang)}</span>
                  <ActionArrow className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* 7. Source Status Metadata Disclosure */}
        <div className="rounded-2xl border border-[#E7E9EE] bg-white p-4 text-center max-w-2xl mx-auto shadow-2xs">
          <p className="text-[11px] text-[#7C8A9A] flex items-center justify-center gap-2 font-medium">
            <Globe2 className="w-3.5 h-3.5 text-[#85845C]" />
            <span>{ui.globalContentSource} — {ui.sourceReady}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      lang={effectiveLang}
      dir={effectiveDir}
      className={`w-full bg-[#F5F5F1] text-[#252525] font-sans ${
        isRtl ? 'text-right' : 'text-left'
      }`}
    >
      {/* Preview Notification Banner if in preview mode */}
      {isPreview && (
        <div className="bg-[#504F34] text-white py-2 px-4 text-center text-xs font-semibold tracking-wide flex items-center justify-center gap-2 sticky top-0 z-50 shadow-sm">
          <Sparkles className="w-4 h-4 text-[#A5A477]" />
          <span>{ui.livePreviewMode}</span>
        </div>
      )}

      {/* 1. Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E5E5DF] shadow-xs">
              <Globe2 className="w-4 h-4 text-[#85845C]" />
              <span className="text-xs font-bold tracking-wider uppercase text-[#85845C]">
                {ui.globalPlatform}
              </span>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#252525] leading-[1.18]">
              {renderText(title || 'Empowering Islamic Institutions with Digital Excellence', fieldMetadata?.title, effectiveLang)}
            </h1>

            {subtitle && (
              <p className="text-base sm:text-lg text-[#666666] leading-relaxed max-w-2xl font-normal">
                {renderText(subtitle, fieldMetadata?.subtitle, effectiveLang)}
              </p>
            )}

            {safeCtaUrl && ctaLabel && (
              <div className="pt-2">
                {isExternalCta ? (
                  <a
                    href={safeCtaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-olive-primary inline-flex items-center gap-2 px-6 py-3.5 text-xs font-semibold shadow-xs"
                  >
                    <span>{renderText(ctaLabel, fieldMetadata?.ctaLabel, effectiveLang)}</span>
                    <ActionArrow className="w-4 h-4 text-white" />
                  </a>
                ) : (
                  <Link
                    to={safeCtaUrl}
                    className="btn-olive-primary inline-flex items-center gap-2 px-6 py-3.5 text-xs font-semibold shadow-xs"
                  >
                    <span>{renderText(ctaLabel, fieldMetadata?.ctaLabel, effectiveLang)}</span>
                    <ActionArrow className="w-4 h-4 text-white" />
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            <div className="relative rounded-2xl overflow-hidden border border-[#E7E9EE] bg-white shadow-md aspect-[4/3]">
              {heroImageUrl ? (
                <img
                  src={heroImageUrl}
                  alt={heroAltText}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#F7F6F1] to-[#E7E9EE] text-[#7C8A9A] p-6 text-center">
                  <Globe2 className="w-12 h-12 text-[#85845C] mb-3 opacity-60" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#0F172A]">
                    {ui.platformShowcase}
                  </p>
                  <p className="text-xs text-[#7C8A9A] mt-1">{ui.heroPendingUpload}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Highlights / Metrics Grid */}
      {highlights.length > 0 && (
        <section className="bg-white border-y border-[#E7E9EE] py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
              {highlights.map((item, idx) => {
                const metaItem = fieldMetadata?.highlights?.find((h) => h.id === item.id);
                return (
                  <div
                    key={item.id || idx}
                    className="p-4 sm:p-6 rounded-2xl bg-[#F7F6F1] border border-[#E7E9EE] text-center space-y-1.5 transition hover:border-[#85845C]"
                  >
                    <div dir="ltr" className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0F172A] tracking-tight">
                      {item.metric}
                    </div>
                    <div className="text-sm font-bold text-[#0F172A]">
                      {renderText(item.title, metaItem?.title, effectiveLang)}
                    </div>
                    {item.description && (
                      <div className="text-xs text-[#7C8A9A] leading-relaxed">
                        {renderText(item.description, metaItem?.description, effectiveLang)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 3. Introduction & Narrative Story */}
      {(introduction || story || storyImageUrl) && (
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 order-2 lg:order-1">
              <div className="relative rounded-2xl overflow-hidden border border-[#E7E9EE] bg-white shadow-md aspect-[4/3]">
                {storyImageUrl ? (
                  <img
                    src={storyImageUrl}
                    alt={storyAltText}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#F7F6F1] to-[#E7E9EE] text-[#7C8A9A] p-6 text-center">
                    <BookOpen className="w-12 h-12 text-[#FFD978] mb-3 opacity-80" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#0F172A]">
                      {ui.heritagePurpose}
                    </p>
                    <p className="text-xs text-[#7C8A9A] mt-1">{ui.storyPendingUpload}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 order-1 lg:order-2 space-y-6">
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#85845C]">
                  {ui.journeyPurpose}
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#252525] tracking-tight">
                  {ui.builtForPurpose}
                </h2>
              </div>

              {introduction && (
                <p className="text-base text-[#252525] font-medium leading-relaxed">
                  {renderText(introduction, fieldMetadata?.introduction, effectiveLang)}
                </p>
              )}

              {story && (
                <p className="text-sm text-[#666666] leading-relaxed whitespace-pre-line">
                  {renderText(story, fieldMetadata?.story, effectiveLang)}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 4. Mission & Vision Cards */}
      {(mission || vision) && (
        <section className="bg-white border-y border-[#E5E5DF] py-16 md:py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#85845C]">
                {ui.coreDirection}
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#252525] tracking-tight">
                {ui.missionVision}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {mission && (
                <div className="acju-card p-8 rounded-2xl bg-[#F5F5F1] border border-[#E5E5DF] space-y-4 transition group">
                  <div className="acju-icon-badge w-12 h-12 rounded-xl bg-white border border-[#E5E5DF] flex items-center justify-center text-[#85845C] shadow-xs group-hover:bg-white group-hover:text-[#85845C] transition-colors">
                    <Target className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif text-xl font-bold text-[#252525] group-hover:text-white transition-colors">{ui.ourMission}</h3>
                  <p className="text-sm text-[#666666] leading-relaxed whitespace-pre-line group-hover:text-white/90 transition-colors">
                    {renderText(mission, fieldMetadata?.mission, effectiveLang)}
                  </p>
                </div>
              )}

              {vision && (
                <div className="acju-card p-8 rounded-2xl bg-[#F5F5F1] border border-[#E5E5DF] space-y-4 transition group">
                  <div className="acju-icon-badge w-12 h-12 rounded-xl bg-white border border-[#E5E5DF] flex items-center justify-center text-[#85845C] shadow-xs group-hover:bg-white group-hover:text-[#85845C] transition-colors">
                    <Compass className="w-6 h-6 text-[#85845C]" />
                  </div>
                  <h3 className="font-serif text-xl font-bold text-[#252525] group-hover:text-white transition-colors">{ui.ourVision}</h3>
                  <p className="text-sm text-[#666666] leading-relaxed whitespace-pre-line group-hover:text-white/90 transition-colors">
                    {renderText(vision, fieldMetadata?.vision, effectiveLang)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 5. Core Values Grid */}
      {coreValues.length > 0 && (
        <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#85845C]">
              {ui.foundationalPillars}
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#252525] tracking-tight">
              {ui.valuesDefineUs}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreValues.map((val, idx) => {
              const IconComponent = (val.icon && iconMap[val.icon]) || iconMap.Default;
              const metaVal = fieldMetadata?.coreValues?.find((c) => c.id === val.id);
              return (
                <div
                  key={val.id || idx}
                  className="acju-card p-6 rounded-2xl bg-white border border-[#E5E5DF] shadow-xs space-y-3 transition group"
                >
                  <div className="acju-icon-badge w-10 h-10 rounded-xl bg-[#F5F5F1] flex items-center justify-center text-[#85845C] group-hover:bg-white transition-colors">
                    <IconComponent className="w-5 h-5 text-[#85845C]" />
                  </div>
                  <h3 className="font-serif text-base font-bold text-[#252525] group-hover:text-white transition-colors">
                    {renderText(val.title, metaVal?.title, effectiveLang)}
                  </h3>
                  <p className="text-xs text-[#666666] leading-relaxed group-hover:text-white/90 transition-colors">
                    {renderText(val.description, metaVal?.description, effectiveLang)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. Call To Action Footer Banner */}
      {safeCtaUrl && ctaLabel && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="rounded-3xl bg-[#504F34] text-white p-8 sm:p-12 lg:p-16 text-center space-y-6 shadow-xl relative overflow-hidden border border-[#6B6A45]">
            <div className="max-w-2xl mx-auto space-y-3">
              <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                {ui.readyToJoin}
              </h2>
              <p className="text-sm sm:text-base text-[#F5F5F1]/85">
                {ui.joinDescription}
              </p>
            </div>

            <div>
              {isExternalCta ? (
                <a
                  href={safeCtaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white hover:bg-[#F5F5F1] text-[#504F34] text-sm font-bold transition shadow-lg"
                >
                  <span>{renderText(ctaLabel, fieldMetadata?.ctaLabel, effectiveLang)}</span>
                  <ActionArrow className="w-4 h-4 text-[#504F34]" />
                </a>
              ) : (
                <Link
                  to={safeCtaUrl}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white hover:bg-[#F5F5F1] text-[#504F34] text-sm font-bold transition shadow-lg"
                >
                  <span>{renderText(ctaLabel, fieldMetadata?.ctaLabel, effectiveLang)}</span>
                  <ActionArrow className="w-4 h-4 text-[#504F34]" />
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Section 21 Architecture Disclosure Note */}
      <footer className="border-t border-[#E7E9EE] py-6 px-4 text-center">
        <p className="text-[11px] text-[#7C8A9A]">
          {ui.sourceReady}
        </p>
      </footer>
    </div>
  );
}
