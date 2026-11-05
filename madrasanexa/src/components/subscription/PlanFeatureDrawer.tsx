import React, { useEffect, useRef } from 'react';
import { X, Layers, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';
import type { PlanCardData } from './PlanCard';

export interface PlanFeatureDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanCardData | null;
}

export const PlanFeatureDrawer: React.FC<PlanFeatureDrawerProps> = ({
  isOpen,
  onClose,
  plan,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !plan) return null;

  const numericPrice = typeof plan.price === 'string' ? parseFloat(plan.price) : plan.price;
  const formattedPrice = isNaN(numericPrice)
    ? String(plan.price)
    : numericPrice.toLocaleString('en-LK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

  const durationLabel = plan.durationMonths === 1 ? '1 Month' : `${plan.durationMonths} Months`;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feature-drawer-title"
      onClick={onClose}
    >
      <div
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-250 border-l border-[#E7E9EE]"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#E7E9EE] bg-[#F7F6F1] flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white text-[#89865D] text-[11px] font-bold uppercase tracking-wider border border-[#E7E9EE] shadow-2xs mb-2">
              <Sparkles className="w-3 h-3 text-[#FFD978]" />
              <span>Subscription Tier Details</span>
            </div>
            <h2 id="feature-drawer-title" className="font-serif text-2xl font-bold text-[#0F172A]">
              {plan.name}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-white text-[#7C8A9A] border border-[#E7E9EE]">
                {plan.code}
              </span>
              <span className="text-xs text-[#7C8A9A]">
                LKR {formattedPrice} / {durationLabel}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close feature details drawer"
            className="p-2 rounded-xl text-[#7C8A9A] hover:text-[#0F172A] hover:bg-white border border-transparent hover:border-[#E7E9EE] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Description */}
          {plan.description && (
            <div className="p-4 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE]">
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1">
                Tier Description
              </h3>
              <p className="text-xs text-[#7C8A9A] leading-relaxed">
                {plan.description}
              </p>
            </div>
          )}

          {/* Assigned Features Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#89865D]" />
                <span>Verified Plan Features</span>
              </h3>
              {plan.featuresCount !== undefined && (
                <span className="text-xs font-mono font-semibold text-[#89865D]">
                  {plan.featuresCount} Features Assigned
                </span>
              )}
            </div>

            {plan.features && plan.features.length > 0 ? (
              <ul className="space-y-2.5">
                {plan.features.map((featKey) => (
                  <li
                    key={featKey}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white border border-[#E7E9EE] shadow-2xs"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#37C6A3] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-[#0F172A] font-mono">
                        {featKey}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-5 rounded-2xl bg-[#F7F6F1] border border-[#E7E9EE] space-y-3 text-xs leading-relaxed">
                <div className="flex items-start gap-2.5 text-[#0F172A]">
                  <ShieldAlert className="w-4 h-4 text-[#89865D] shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Authoritative Entitlement Verification</strong>
                    <span className="text-[#7C8A9A]">
                      Detailed feature-level assignments for this subscription tier are governed dynamically by Platform Administration. To prevent unverified claims, individual module entitlements are verified upon institutional account activation.
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E7E9EE] text-[11px] text-[#7C8A9A]">
                  Platform CORE services (e.g. multi-tenant isolation, data encryption, role access controls) serve as foundational infrastructure across all registered institutions.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#E7E9EE] bg-[#F7F6F1] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0F172A] text-white hover:bg-[#1E293B] transition shadow-xs cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
