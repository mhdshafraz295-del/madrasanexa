import type { SecuritySectionData } from '../../services/homepage.service';
import { Lock, ShieldCheck, Shield, FileText, CheckCircle2 } from 'lucide-react';

interface SecuritySectionProps {
  data: SecuritySectionData;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Lock,
  ShieldCheck,
  Shield,
  FileText,
  CheckCircle2,
};

export default function SecuritySection({ data }: SecuritySectionProps) {
  if (!data.enabled) return null;

  const items = (data.items || []).filter((i) => i.enabled);
  if (items.length === 0) return null;

  return (
    <section id="security" className="py-20 sm:py-28 bg-[#F5F5F1] border-t border-[#E5E5DF] relative scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-20">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white text-[#85845C] text-xs font-semibold tracking-wider uppercase mb-3 border border-[#E5E5DF] shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#A5A477]" />
            <span>Platform Security Architecture</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-bold text-[#252525] tracking-tight">
            {data.heading || 'Engineered with Architectural Rigor & Isolation'}
          </h2>
          <div className="w-16 h-1 bg-[#85845C] mx-auto rounded-full mt-4 mb-4" />
          {data.description && (
            <p className="text-base sm:text-lg text-[#666666] leading-relaxed">
              {data.description}
            </p>
          )}
        </div>

        {/* Pillars Grid with ACJU Card Hover */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item) => {
            const Icon = iconMap[item.icon] || ShieldCheck;
            return (
              <div
                key={item.id}
                className="acju-card bg-white rounded-xl p-6 sm:p-7 border border-[#E5E5DF] shadow-xs flex flex-col justify-between transition-all duration-300 group"
              >
                <div>
                  <div className="acju-icon-badge w-12 h-12 rounded-xl bg-[#F5F5F1] group-hover:bg-white border border-[#E5E5DF] flex items-center justify-center text-[#85845C] mb-5 transition-colors">
                    <Icon className="w-6 h-6 text-[#85845C]" />
                  </div>

                  <h3 className="font-serif text-base font-bold text-[#252525] tracking-tight mb-2 group-hover:text-white transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#666666] leading-relaxed group-hover:text-white/90 transition-colors">
                    {item.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#E5E5DF]/60 group-hover:border-white/20 flex items-center gap-1.5 text-[11px] font-semibold text-[#85845C] group-hover:text-white transition-colors">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#85845C] group-hover:text-white" />
                  <span>Enforced at Runtime</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
