import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { CtaData } from '../../services/homepage.service';

interface CTASectionProps {
  data: CtaData;
}

export default function CTASection({ data }: CTASectionProps) {
  if (!data.enabled) return null;

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 md:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="relative rounded-2xl bg-[#504F34] text-white p-8 sm:p-14 lg:p-20 overflow-hidden shadow-xl border border-[#6B6A45]">
          {/* Subtle Ambient Radial Glows */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#A5A477]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#85845C]/20 rounded-full blur-3xl pointer-events-none" />

          {/* Controlled Content Box */}
          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-[#F5F5F1] mb-6">
              <Sparkles className="w-3.5 h-3.5 text-[#A5A477]" />
              <span>Dedicated Madrasa Workspaces</span>
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
              {data.heading || 'Ready to Modernize Your Madrasa Operations?'}
            </h2>

            {data.description && (
              <p className="mt-6 text-base sm:text-lg text-[#F5F5F1]/85 leading-relaxed max-w-2xl mx-auto">
                {data.description}
              </p>
            )}

            <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-4">
              {data.primaryCtaLabel && (
                <Link
                  to={data.primaryCtaUrl || '/register'}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-xs font-bold bg-white text-[#504F34] hover:bg-[#F5F5F1] transition shadow-md hover:shadow-lg cursor-pointer"
                >
                  <span>{data.primaryCtaLabel}</span>
                  <ArrowRight className="w-4 h-4 text-[#504F34]" />
                </Link>
              )}

              {data.secondaryCtaLabel && (
                <Link
                  to={data.secondaryCtaUrl || '/login'}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-xs font-semibold bg-transparent border border-white/30 text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <span>{data.secondaryCtaLabel}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
