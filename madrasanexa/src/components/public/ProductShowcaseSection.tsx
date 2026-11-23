import { useState, useRef } from 'react';
import type { ProductPreviewMedia } from '../../services/homepage.service';
import ProductPreview from './ProductPreview';
import { ImageLightbox } from './ImageLightbox';
import { ZoomIn, Eye, Sparkles } from 'lucide-react';

interface ProductShowcaseSectionProps {
  productPreviewMedia?: ProductPreviewMedia;
}

export default function ProductShowcaseSection({
  productPreviewMedia,
}: ProductShowcaseSectionProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const hasValidImage =
    productPreviewMedia &&
    productPreviewMedia.enabled !== false &&
    Boolean(productPreviewMedia.url) &&
    !imageFailed;

  return (
    <section className="py-16 sm:py-24 relative overflow-hidden bg-gradient-to-b from-transparent via-[#F5F5F1]/80 to-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#F5F5F1] text-[#85845C] text-xs font-semibold tracking-wider uppercase mb-3 border border-[#E5E5DF]">
            <Sparkles className="w-3.5 h-3.5 text-[#A5A477]" />
            <span>Intuitive Workspace</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-bold text-[#252525] tracking-tight">
            Designed for Real Madrasa Workflows
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#666666] leading-relaxed">
            Experience our unified interface for attendance, student enrollment, fee settlements, and institutional oversight.
          </p>
        </div>

        {/* Visual Container */}
        <div className="max-w-5xl mx-auto">
          {hasValidImage ? (
            <div className="relative group">
              {/* Decorative Window Container */}
              <div className="bg-[#252525] rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-2xl border border-[#E5E5DF]/40">
                {/* Window Header Bar */}
                <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/10 mb-3 sm:mb-4 px-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#E56A45] inline-block" />
                    <span className="w-3 h-3 rounded-full bg-[#A5A477] inline-block" />
                    <span className="w-3 h-3 rounded-full bg-[#85845C] inline-block" />
                    <span className="hidden sm:inline-block ml-3 text-xs font-medium text-slate-300">
                      MadrasaNexa Portal — Live Administrative Suite
                    </span>
                  </div>
                  <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#85845C]/30 text-white text-xs font-medium hover:bg-[#85845C]/50 transition border border-[#A5A477]/40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#85845C]"
                    aria-label="Enlarge dashboard screenshot"
                  >
                    <ZoomIn className="w-3.5 h-3.5 text-white" />
                    <span>Expand</span>
                  </button>
                </div>

                {/* Image Trigger / Preview */}
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="w-full relative rounded-xl overflow-hidden cursor-zoom-in block text-left focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  aria-label="Click to enlarge product screenshot"
                >
                  <img
                    src={productPreviewMedia?.url || ''}
                    alt={productPreviewMedia?.alt || 'MadrasaNexa Management Suite'}
                    onError={() => setImageFailed(true)}
                    className="w-full h-auto max-h-[600px] object-cover sm:object-contain rounded-xl transition-transform duration-300 group-hover:scale-[1.01]"
                  />

                  {/* Hover Overlay Tag */}
                  <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 text-white text-xs font-semibold shadow-xl border border-white/20 backdrop-blur-md">
                      <Eye className="w-4 h-4 text-emerald-400" />
                      <span>Click to view full size</span>
                    </span>
                  </div>
                </button>

                {productPreviewMedia?.caption && (
                  <p className="mt-3 text-xs text-center text-slate-400">
                    {productPreviewMedia.caption}
                  </p>
                )}
              </div>

              {/* Lightbox Dialog */}
              <ImageLightbox
                isOpen={lightboxOpen}
                imageUrl={productPreviewMedia?.url || null}
                altText={productPreviewMedia?.alt || 'MadrasaNexa Management Suite'}
                caption={productPreviewMedia?.caption}
                onClose={() => setLightboxOpen(false)}
                triggerRef={triggerRef}
              />
            </div>
          ) : (
            /* Fallback to CSS mockup if image is disabled or missing */
            <ProductPreview />
          )}
        </div>
      </div>
    </section>
  );
}
