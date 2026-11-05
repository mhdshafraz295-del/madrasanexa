import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Compass } from 'lucide-react';
import type { HeroData, HeroMediaSection } from '../../services/homepage.service';
import ProductPreview from './ProductPreview';
import HeroMediaSlider from './HeroMediaSlider';

interface HeroSectionProps {
  data: HeroData;
  heroMedia?: HeroMediaSection;
}

export default function HeroSection({ data, heroMedia }: HeroSectionProps) {
  if (!data.enabled) return null;

  // Split title if highlightedText is provided
  const title = data.title;
  const highlight = data.highlightedText;

  let beforeHighlight = title;
  let highlightedPart = '';
  let afterHighlight = '';

  if (highlight && title.includes(highlight)) {
    const idx = title.indexOf(highlight);
    beforeHighlight = title.substring(0, idx);
    highlightedPart = highlight;
    afterHighlight = title.substring(idx + highlight.length);
  }

  return (
    <section className="relative pt-28 sm:pt-32 pb-16 sm:pb-24 bg-gradient-to-b from-white via-[#F5F5F1]/50 to-white overflow-hidden">
      {/* Background ambient lighting in soft olive */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[900px] h-[400px] sm:h-[500px] bg-[#A5A477]/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Copy & Actions */}
          <div className="lg:col-span-6 xl:col-span-7 flex flex-col items-start text-left">
            {/* Pill Eyebrow */}
            {data.eyebrow && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F5F5F1] border border-[#E5E5DF] text-xs font-semibold text-[#85845C] mb-6">
                <span className="flex h-2 w-2 rounded-full bg-[#85845C]" />
                <span>{data.eyebrow}</span>
                <Sparkles className="w-3.5 h-3.5 text-[#A5A477]" />
              </div>
            )}

            {/* Main Headline with Serif Typography */}
            <h1 className="font-serif text-3xl sm:text-5xl xl:text-6xl font-bold text-[#252525] tracking-tight leading-[1.18]">
              {highlightedPart ? (
                <>
                  {beforeHighlight}
                  <span className="relative inline-block text-[#85845C]">
                    <span className="relative z-10">{highlightedPart}</span>
                    <span className="absolute bottom-1.5 left-0 w-full h-3 bg-[#A5A477]/25 -z-10 rounded-sm" />
                  </span>
                  {afterHighlight}
                </>
              ) : (
                title
              )}
            </h1>

            {/* Description */}
            {data.description && (
              <p className="mt-6 text-base sm:text-lg text-[#666666] max-w-2xl leading-relaxed">
                {data.description}
              </p>
            )}

            {/* Actions: Primary Dark Olive + Secondary Olive Border */}
            <div className="mt-8 sm:mt-10 flex flex-wrap items-center gap-3 sm:gap-4 w-full sm:w-auto">
              {data.primaryCtaLabel && (
                <Link
                  to={data.primaryCtaUrl || '/register'}
                  className="btn-olive-primary inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 text-sm font-semibold w-full sm:w-auto cursor-pointer"
                >
                  <span>{data.primaryCtaLabel}</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </Link>
              )}

              {data.secondaryCtaLabel && (
                <a
                  href={data.secondaryCtaUrl || '#features'}
                  className="btn-olive-secondary inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 text-sm font-semibold w-full sm:w-auto cursor-pointer"
                >
                  <Compass className="w-4 h-4 text-[#85845C]" />
                  <span>{data.secondaryCtaLabel}</span>
                </a>
              )}
            </div>
          </div>

          {/* Right Column: Hero Media Slider or High-Fidelity Product Preview */}
          <div className="lg:col-span-6 xl:col-span-5 w-full">
            {heroMedia &&
            heroMedia.enabled !== false &&
            Array.isArray(heroMedia.items) &&
            heroMedia.items.filter((i) => i.enabled && i.url).length > 0 ? (
              <HeroMediaSlider
                items={heroMedia.items}
                autoplay={heroMedia.autoplay !== false}
                autoplayInterval={heroMedia.autoplayInterval || 5000}
              />
            ) : (
              <ProductPreview />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
