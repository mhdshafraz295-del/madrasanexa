import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, Sparkles, Layers, ShieldCheck } from 'lucide-react';

export interface PlanCardData {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  price: number | string;
  durationMonths: number;
  isActive?: boolean;
  isRecommended?: boolean;
  featuresCount?: number;
  features?: string[];
}

export interface PlanCardProps {
  plan: PlanCardData;
  isSelected?: boolean;
  mode: 'public' | 'admin';
  onSelect?: (plan: PlanCardData) => void;
  onViewFeatures?: (plan: PlanCardData) => void;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isSelected = false,
  mode,
  onSelect,
  onViewFeatures,
}) => {
  const numericPrice = typeof plan.price === 'string' ? parseFloat(plan.price) : plan.price;
  const formattedPrice = isNaN(numericPrice)
    ? String(plan.price)
    : numericPrice.toLocaleString('en-LK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

  const durationLabel = plan.durationMonths === 1 ? '1 month' : `${plan.durationMonths} months`;

  return (
    <div
      tabIndex={mode === 'admin' ? 0 : undefined}
      role={mode === 'admin' ? 'button' : undefined}
      aria-pressed={mode === 'admin' ? isSelected : undefined}
      onKeyDown={(e) => {
        if (mode === 'admin' && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect?.(plan);
        }
      }}
      onClick={() => {
        if (mode === 'admin') {
          onSelect?.(plan);
        }
      }}
      className={`relative rounded-2xl p-6 sm:p-8 flex flex-col justify-between h-full transition-all duration-300 outline-none ${
        mode === 'admin' ? 'cursor-pointer select-none' : ''
      } ${
        isSelected
          ? 'bg-[#37C6A3]/5 border-2 border-[#37C6A3] ring-4 ring-[#37C6A3]/15 shadow-md'
          : plan.isRecommended
          ? 'bg-white border-2 border-[#89865D] shadow-lg hover:shadow-xl z-10'
          : 'bg-white border border-[#E7E9EE] shadow-xs hover:shadow-md'
      }`}
    >
      {/* Recommended Plan Pill (Displayed for recommended plan: Dynamic Gold Tier) */}
      {plan.isRecommended && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#89865D] text-white text-xs font-bold uppercase tracking-wider shadow-xs flex items-center gap-1.5 z-10 whitespace-nowrap">
          <Sparkles className="w-3.5 h-3.5 text-[#FFD978]" />
          <span>Recommended Plan</span>
        </div>
      )}

      {/* Selected Indicator Pill for Admin Mode */}
      {mode === 'admin' && isSelected && !plan.isRecommended && (
        <div className="absolute -top-3 left-6 px-3.5 py-0.5 rounded-full bg-[#37C6A3] text-[#0F172A] text-[11px] font-extrabold uppercase tracking-wider shadow-xs z-10 flex items-center gap-1">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
          <span>Selected Plan</span>
        </div>
      )}

      <div>
        {/* Top Header: Name and Code Pill */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#252525] tracking-tight">
              {plan.name}
            </h3>
            <span className="inline-block mt-1.5 text-xs font-mono font-semibold px-2.5 py-0.5 rounded bg-[#F7F6F1] text-[#7C8A9A] border border-[#E7E9EE]">
              {plan.code}
            </span>
          </div>

          {mode === 'admin' && (
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors mt-0.5 ${
                isSelected
                  ? 'bg-[#37C6A3] text-[#0F172A] shadow-2xs'
                  : 'border border-[#E7E9EE] bg-[#F7F6F1] text-transparent'
              }`}
              aria-hidden="true"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          )}
        </div>

        {/* Pricing & Duration */}
        <div className="mb-5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-bold text-[#666666] tracking-wider uppercase">LKR</span>
            <span className="font-serif text-3xl sm:text-4xl font-bold text-[#252525] tracking-tight">
              {formattedPrice}
            </span>
          </div>
          <p className="text-xs font-medium text-[#666666] mt-1">
            Coverage for {durationLabel}
          </p>
        </div>

        {/* Plan Description */}
        {plan.description && (
          <p className="text-xs sm:text-sm text-[#666666] mb-6 leading-relaxed line-clamp-3">
            {plan.description}
          </p>
        )}

        {/* Clean Feature List with Olive Checkmarks */}
        <div className="space-y-3 pt-5 border-t border-[#E7E9EE] text-xs sm:text-sm text-[#252525]">
          {plan.features && plan.features.length > 0 ? (
            plan.features.slice(0, 4).map((feat, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#89865D] shrink-0 stroke-[2.5]" />
                <span className="font-mono text-xs text-[#252525]">{feat}</span>
              </div>
            ))
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#89865D] shrink-0 stroke-[2.5]" />
                <span>Full Student &amp; Academic Records</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#89865D] shrink-0 stroke-[2.5]" />
                <span>Fee POS &amp; Official Invoice Receipts</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#89865D] shrink-0 stroke-[2.5]" />
                <span>Daily Attendance &amp; Absence Tracking</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#89865D] shrink-0 stroke-[2.5]" />
                <span>Cloud Storage &amp; Export Center</span>
              </div>
            </>
          )}

          {plan.featuresCount !== undefined && plan.featuresCount > 0 && (
            <div className="flex items-center gap-2.5 pt-1 text-xs text-[#89865D] font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#89865D] shrink-0" />
              <span>{plan.featuresCount} Verified Assigned Modules</span>
            </div>
          )}

          {/* Feature Inspection Link if handler provided */}
          {onViewFeatures && (
            <div className="pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewFeatures(plan);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#89865D] hover:text-[#504F34] transition cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>View Feature Details</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card Action / CTA */}
      <div className="mt-8 pt-4 border-t border-[#E7E9EE]">
        {mode === 'public' ? (
          plan.isRecommended ? (
            /* Recommended Plan Button (Dynamic Gold Tier): Solid Olive */
            <Link
              to={`/register?plan=${encodeURIComponent(plan.code)}`}
              className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer bg-[#89865D] text-white hover:bg-[#6B6A45] shadow-xs hover:shadow-md"
            >
              <span>Choose {plan.name}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            /* Non-Recommended Plan Button (Basic Plan): White with Olive Border & Olive Text */
            <Link
              to={`/register?plan=${encodeURIComponent(plan.code)}`}
              className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer bg-white text-[#89865D] border-2 border-[#89865D] hover:bg-[#89865D]/5 shadow-2xs"
            >
              <span>Choose {plan.name}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#89865D]" />
            </Link>
          )
        ) : (
          /* Admin Mode Selection Button */
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(plan);
            }}
            className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isSelected
                ? 'bg-[#37C6A3] text-[#0F172A] shadow-xs hover:bg-[#32B494]'
                : plan.isRecommended
                ? 'bg-[#89865D] text-white hover:bg-[#6B6A45] shadow-xs'
                : 'bg-white text-[#89865D] border-2 border-[#89865D] hover:bg-[#89865D]/5'
            }`}
          >
            {isSelected ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Selected</span>
              </>
            ) : (
              <span>Select {plan.name}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
