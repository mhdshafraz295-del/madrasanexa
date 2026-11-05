import React, { useState, useRef } from 'react';
import type { FeatureItem } from '../../services/homepage.service';
import { ImageLightbox } from './ImageLightbox';
import {
  GraduationCap,
  Users,
  Calendar,
  DollarSign,
  FileText,
  BarChart3,
  Megaphone,
  Cloud,
  ShieldCheck,
  Layers,
  Clock,
  Sparkles,
  BookOpen,
  Award,
  CheckCircle2,
  Building2,
  Landmark,
  Lock,
  Compass,
  Globe,
  HelpCircle,
  Laptop,
  Shield,
  ArrowRight,
  ZoomIn,
} from 'lucide-react';

interface FeaturesSectionProps {
  features: FeatureItem[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  GraduationCap,
  Users,
  Calendar,
  DollarSign,
  FileText,
  BarChart3,
  Megaphone,
  Cloud,
  ShieldCheck,
  Layers,
  Clock,
  Sparkles,
  BookOpen,
  Award,
  CheckCircle2,
  Building2,
  Landmark,
  Lock,
  Compass,
  Globe,
  HelpCircle,
  Laptop,
  Shield,
};

// Institutional default photography for service cards
const DEFAULT_CARD_IMAGES = [
  'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=800&q=80',
];

export default function FeaturesSection({ features }: FeaturesSectionProps) {
  const [activeLightboxImage, setActiveLightboxImage] = useState<{
    url: string;
    alt: string;
    caption?: string | null;
  } | null>(null);

  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const activeFeatures = (features || [])
    .filter((f) => f.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (activeFeatures.length === 0) return null;

  return (
    <section id="features" className="py-20 sm:py-28 bg-[#F5F5F1] relative scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-20">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white text-[#85845C] text-xs font-semibold tracking-wider uppercase mb-3 border border-[#E5E5DF] shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-[#A5A477]" />
            <span>Institutional Services & Modules</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-bold text-[#252525] tracking-tight">
            Engineered for Modern Madrasa Operations
          </h2>
          <div className="w-16 h-1 bg-[#85845C] mx-auto rounded-full mt-4 mb-4" />
          <p className="text-base sm:text-lg text-[#666666] leading-relaxed">
            Eliminate fragmented registers and spreadsheets. Everything your administration, teachers, and staff need in one coherent workspace.
          </p>
        </div>

        {/* ACJU Service Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {activeFeatures.map((feat, idx) => {
            const Icon = iconMap[feat.icon] || Sparkles;
            const cardImage = feat.imageUrl || DEFAULT_CARD_IMAGES[idx % DEFAULT_CARD_IMAGES.length];

            return (
              <div
                key={feat.id}
                className="acju-card flex flex-col h-full bg-white border border-[#E5E5DF] rounded-xl shadow-xs hover:shadow-md transition-all duration-300 group"
              >
                {/* Top Image */}
                <div className="relative w-full h-48 sm:h-52 overflow-hidden bg-slate-100 shrink-0">
                  <img
                    src={cardImage}
                    alt={feat.imageAlt || feat.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                    loading="lazy"
                  />
                  {/* Subtle top image shade */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />

                  {/* Lightbox trigger if custom image */}
                  {feat.imageUrl && (
                    <button
                      ref={(el) => {
                        triggerRefs.current[feat.id] = el;
                      }}
                      type="button"
                      onClick={() =>
                        setActiveLightboxImage({
                          url: feat.imageUrl!,
                          alt: feat.imageAlt || feat.title,
                          caption: feat.imageCaption || feat.title,
                        })
                      }
                      className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/80 backdrop-blur-sm text-[#252525] hover:bg-white transition opacity-0 group-hover:opacity-100"
                      aria-label="Enlarge image"
                    >
                      <ZoomIn className="w-4 h-4 text-[#85845C]" />
                    </button>
                  )}
                </div>

                {/* Overlapping Circular White Icon Badge */}
                <div className="px-6 -mt-6 relative z-10">
                  <div className="acju-icon-badge w-12 h-12 rounded-full bg-white border border-[#E5E5DF] shadow-md flex items-center justify-center text-[#85845C]">
                    <Icon className="w-6 h-6 text-[#85845C]" />
                  </div>
                </div>

                {/* Card Content (Transitions to Olive on Hover) */}
                <div className="acju-card-content p-6 pt-3 flex-1 flex flex-col justify-between transition-colors duration-300">
                  <div>
                    <h3 className="acju-title font-serif text-lg sm:text-xl font-bold text-[#252525] tracking-tight mb-2.5 transition-colors duration-300">
                      {feat.title}
                    </h3>
                    <p className="acju-desc text-xs sm:text-sm text-[#666666] leading-relaxed line-clamp-3 transition-colors duration-300">
                      {feat.description}
                    </p>
                  </div>

                  {/* Terracotta Read More link (Turns white on hover) */}
                  <div className="mt-5 pt-3 border-t border-[#E5E5DF]/60 flex items-center justify-between">
                    <a
                      href="#pricing"
                      className="acju-read-more text-[#E56A45] text-xs font-bold inline-flex items-center gap-1.5 transition-colors duration-300 group-hover:text-white"
                    >
                      <span>Read More</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </a>

                    <span className="text-[11px] font-semibold text-[#85845C] group-hover:text-white/80 transition-colors duration-300">
                      Module 0{idx + 1}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature Lightbox */}
      <ImageLightbox
        isOpen={Boolean(activeLightboxImage)}
        imageUrl={activeLightboxImage?.url || null}
        altText={activeLightboxImage?.alt || ''}
        caption={activeLightboxImage?.caption}
        onClose={() => setActiveLightboxImage(null)}
      />
    </section>
  );
}
