import type { TrustItem } from '../../services/homepage.service';
import {
  Building2,
  ShieldCheck,
  Lock,
  Cloud,
  FileText,
  Sparkles,
  Award,
  Layers,
  CheckCircle2,
} from 'lucide-react';

interface TrustStripProps {
  items: TrustItem[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  ShieldCheck,
  Lock,
  Cloud,
  FileText,
  Sparkles,
  Award,
  Layers,
  CheckCircle2,
};

export default function TrustStrip({ items }: TrustStripProps) {
  const activeItems = (items || []).filter((i) => i.enabled);
  if (activeItems.length === 0) return null;

  return (
    <div className="border-y border-[#E5E5DF] bg-[#F5F5F1]/80 py-6 sm:py-7">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 md:gap-12">
          {activeItems.map((item) => {
            const Icon = iconMap[item.icon] || ShieldCheck;
            return (
              <div
                key={item.id}
                className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-[#252525]/85 hover:text-[#85845C] transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-[#E5E5DF] shadow-2xs flex items-center justify-center text-[#85845C]">
                  <Icon className="w-4 h-4" />
                </div>
                <span>{item.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
