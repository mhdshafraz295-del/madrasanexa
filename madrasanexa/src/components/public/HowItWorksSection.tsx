import type { HowItWorksItem } from '../../services/homepage.service';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

interface HowItWorksSectionProps {
  steps: HowItWorksItem[];
}

export default function HowItWorksSection({ steps }: HowItWorksSectionProps) {
  const activeSteps = (steps || []).filter((s) => s.enabled).sort((a, b) => a.step - b.step);
  if (activeSteps.length === 0) return null;

  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-white border-t border-[#E5E5DF] relative scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-24">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#F5F5F1] text-[#85845C] text-xs font-semibold tracking-wider uppercase mb-3 border border-[#E5E5DF]">
            Onboarding Protocol
          </div>
          <h2 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-bold text-[#252525] tracking-tight">
            How MadrasaNexa Works
          </h2>
          <div className="w-16 h-1 bg-[#85845C] mx-auto rounded-full mt-4 mb-4" />
          <p className="text-base sm:text-lg text-[#666666]">
            From application to active portal in five clear, verified institutional steps.
          </p>
        </div>

        {/* Steps Container */}
        <div className="relative">
          {/* Desktop connecting line */}
          <div className="hidden lg:block absolute top-1/2 left-8 right-8 h-0.5 bg-[#E5E5DF] -translate-y-12 z-0" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-6 relative z-10">
            {activeSteps.map((step, idx) => (
              <div
                key={step.id}
                className="acju-card bg-white rounded-xl p-6 border border-[#E5E5DF] shadow-xs flex flex-col justify-between transition-all duration-300 group"
              >
                <div>
                  {/* Step Badge */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="acju-icon-badge w-10 h-10 rounded-xl bg-[#85845C] text-white flex items-center justify-center font-bold text-sm shadow-xs group-hover:bg-white group-hover:text-[#85845C] transition-colors">
                      0{step.step || idx + 1}
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-[#85845C] group-hover:text-white transition-colors" />
                  </div>

                  <h3 className="font-serif text-base font-bold text-[#252525] tracking-tight mb-2 group-hover:text-white transition-colors">
                    {step.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#666666] leading-relaxed group-hover:text-white/90 transition-colors">
                    {step.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-[#E5E5DF]/60 text-[11px] font-bold text-[#E56A45] group-hover:text-white flex items-center gap-1 transition-colors">
                  <span>Step {step.step || idx + 1}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
