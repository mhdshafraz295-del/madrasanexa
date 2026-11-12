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
  originalPrice?: number | string | null;
  isSpecialOffer?: boolean;
  specialOfferLabel?: string | null;
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
  const isFeatured = Boolean(plan.isRecommended);

  // Dynamic price formatting in LKR
  const numericPrice = typeof plan.price === 'string' ? parseFloat(plan.price) : plan.price;
  const formattedPrice = isNaN(numericPrice)
    ? String(plan.price)
    : numericPrice.toLocaleString('en-LK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

  // Strikethrough / special offer formatting only when genuine data exists
  const originalPriceNum =
    plan.originalPrice !== undefined && plan.originalPrice !== null
      ? typeof plan.originalPrice === 'string'
        ? parseFloat(plan.originalPrice)
        : Number(plan.originalPrice)
      : null;

  const hasGenuineOffer =
    originalPriceNum !== null &&
    !isNaN(originalPriceNum) &&
    !isNaN(numericPrice) &&
    originalPriceNum > numericPrice;

  const formattedOriginalPrice = hasGenuineOffer
    ? originalPriceNum.toLocaleString('en-LK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : null;

  const savingsAmount = hasGenuineOffer ? originalPriceNum - numericPrice : 0;
  const formattedSavings = hasGenuineOffer
    ? savingsAmount.toLocaleString('en-LK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : null;

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
      className={`relative rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 flex flex-col justify-between h-full transition-all duration-300 outline-none overflow-hidden ${
        mode === 'admin' ? 'cursor-pointer select-none' : ''
      } ${
        isSelected
          ? isFeatured
            ? 'bg-[#0F172A] text-white border-2 border-[#37C6A3] ring-4 ring-[#37C6A3]/20 shadow-2xl scale-[1.01]'
            : 'bg-[#37C6A3]/5 border-2 border-[#37C6A3] ring-4 ring-[#37C6A3]/15 shadow-md scale-[1.01]'
          : isFeatured
          ? 'bg-[#0F172A] text-white border-2 border-[#89865D] ring-4 ring-[#89865D]/20 shadow-xl hover:shadow-2xl z-10 lg:scale-[1.03] lg:-translate-y-1'
          : 'bg-white border border-[#E7E9EE] shadow-sm hover:shadow-xl text-[#0F172A]'
      }`}
    >
      {/* Distinctive Curved Top-Right Corner Badge / Ribbon */}
      {isFeatured && (
        <div className="absolute top-0 right-0 bg-[#89865D] text-white text-[11px] sm:text-xs font-bold uppercase tracking-wider px-4 sm:px-5 py-1.5 sm:py-2 rounded-bl-2xl shadow-sm flex items-center gap-1.5 z-10">
          <Sparkles className="w-3.5 h-3.5 text-[#FFD978] shrink-0" />
          <span>{plan.specialOfferLabel || 'Recommended'}</span>
        </div>
      )}

      {/* Special Offer Ribbon for Non-Featured Plan */}
      {!isFeatured && hasGenuineOffer && !(mode === 'admin' && isSelected) && (
        <div className="absolute top-0 right-0 bg-[#FFD978] text-[#0F172A] text-[11px] sm:text-xs font-bold uppercase tracking-wider px-4 sm:px-5 py-1.5 sm:py-2 rounded-bl-2xl shadow-sm flex items-center gap-1.5 z-10">
          <Sparkles className="w-3.5 h-3.5 text-amber-800 shrink-0" />
          <span>{plan.specialOfferLabel || 'Special Offer'}</span>
        </div>
      )}

      {/* Selected Indicator Ribbon for Admin Mode */}
      {mode === 'admin' && isSelected && !isFeatured && (
        <div className="absolute top-0 right-0 bg-[#37C6A3] text-[#0F172A] text-[11px] sm:text-xs font-extrabold uppercase tracking-wider px-4 sm:px-5 py-1.5 sm:py-2 rounded-bl-2xl shadow-sm flex items-center gap-1.5 z-10">
          <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
          <span>Selected Plan</span>
        </div>
      )}

      <div>
        {/* Top Header: Name and Code Pill */}
        <div className="flex items-start justify-between gap-3 mb-4 pr-16 sm:pr-20">
          <div className="min-w-0">
            <h3
              className={`font-serif text-xl sm:text-2xl font-bold tracking-tight ${
                isFeatured ? 'text-white' : 'text-[#252525]'
              }`}
            >
              {plan.name}
            </h3>
            <span
              className={`inline-block mt-1.5 text-xs font-mono font-semibold px-2.5 py-0.5 rounded-md border ${
                isFeatured
                  ? 'bg-white/10 text-white/80 border-white/15'
                  : 'bg-[#F7F6F1] text-[#7C8A9A] border-[#E7E9EE]'
              }`}
            >
              {plan.code}
            </span>
          </div>

          {mode === 'admin' && (
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors mt-0.5 ${
                isSelected
                  ? 'bg-[#37C6A3] text-[#0F172A] shadow-xs'
                  : isFeatured
                  ? 'border border-white/20 bg-white/10 text-transparent'
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
          {hasGenuineOffer && formattedOriginalPrice && (
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs font-bold line-through ${
                  isFeatured ? 'text-white/50' : 'text-[#7C8A9A]'
                }`}
              >
                LKR {formattedOriginalPrice}
              </span>
              {savingsAmount > 0 && formattedSavings && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#37C6A3]/20 text-[#37C6A3]">
                  Save LKR {formattedSavings}
                </span>
              )}
            </div>
          )}

          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-xs font-bold tracking-wider uppercase ${
                isFeatured ? 'text-[#FFD978]' : 'text-[#666666]'
              }`}
            >
              LKR
            </span>
            <span
              className={`font-serif text-3xl sm:text-4xl font-bold tracking-tight ${
                isFeatured ? 'text-white' : 'text-[#252525]'
              }`}
            >
              {formattedPrice}
            </span>
          </div>
          <p
            className={`text-xs font-medium mt-1 ${
              isFeatured ? 'text-white/70' : 'text-[#666666]'
            }`}
          >
            Coverage for {durationLabel}
          </p>
        </div>

        {/* Plan Description */}
        {plan.description && (
          <p
            className={`text-xs sm:text-sm mb-6 leading-relaxed line-clamp-3 ${
              isFeatured ? 'text-white/80' : 'text-[#666666]'
            }`}
          >
            {plan.description}
          </p>
        )}

        {/* Feature List with Elegant Checkmarks */}
        <div
          className={`space-y-3 pt-5 border-t text-xs sm:text-sm ${
            isFeatured ? 'border-white/10 text-white/90' : 'border-[#E7E9EE] text-[#252525]'
          }`}
        >
          {plan.features && plan.features.length > 0 ? (
            plan.features.slice(0, 4).map((feat, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    isFeatured ? 'bg-[#37C6A3]/20 text-[#37C6A3]' : 'bg-[#89865D]/10 text-[#89865D]'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span className={`font-mono text-xs ${isFeatured ? 'text-white/95' : 'text-[#252525]'}`}>
                  {feat}
                </span>
              </div>
            ))
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    isFeatured ? 'bg-[#37C6A3]/20 text-[#37C6A3]' : 'bg-[#89865D]/10 text-[#89865D]'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span>Full Student &amp; Academic Records</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    isFeatured ? 'bg-[#37C6A3]/20 text-[#37C6A3]' : 'bg-[#89865D]/10 text-[#89865D]'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span>Fee POS &amp; Official Invoice Receipts</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    isFeatured ? 'bg-[#37C6A3]/20 text-[#37C6A3]' : 'bg-[#89865D]/10 text-[#89865D]'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span>Daily Attendance &amp; Absence Tracking</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    isFeatured ? 'bg-[#37C6A3]/20 text-[#37C6A3]' : 'bg-[#89865D]/10 text-[#89865D]'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span>Cloud Storage &amp; Export Center</span>
              </div>
            </>
          )}

          {plan.featuresCount !== undefined && plan.featuresCount > 0 && (
            <div
              className={`flex items-center gap-2.5 pt-1 text-xs font-semibold ${
                isFeatured ? 'text-[#FFD978]' : 'text-[#89865D]'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
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
                className={`inline-flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer ${
                  isFeatured
                    ? 'text-[#FFD978] hover:text-[#FFE5A3]'
                    : 'text-[#89865D] hover:text-[#504F34]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>View Feature Details</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card Action / CTA */}
      <div
        className={`mt-8 pt-4 border-t ${
          isFeatured ? 'border-white/10' : 'border-[#E7E9EE]'
        }`}
      >
        {mode === 'public' ? (
          isFeatured ? (
            /* Recommended Plan Button (Dynamic Gold Tier): Solid Olive */
            <Link
              to={`/register?plan=${encodeURIComponent(plan.code)}`}
              className="w-full py-3.5 px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer bg-[#89865D] text-white hover:bg-[#6B6A45] shadow-sm hover:shadow-lg"
            >
              <span>Choose {plan.name}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            /* Non-Recommended Plan Button: White with Olive Border & Olive Text */
            <Link
              to={`/register?plan=${encodeURIComponent(plan.code)}`}
              className="w-full py-3.5 px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer bg-white text-[#89865D] border-2 border-[#89865D] hover:bg-[#89865D]/5 shadow-2xs hover:shadow-xs"
            >
              <span>Choose {plan.name}</span>
              <ArrowRight className="w-4 h-4 text-[#89865D]" />
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
            className={`w-full py-3.5 px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isSelected
                ? 'bg-[#37C6A3] text-[#0F172A] shadow-xs hover:bg-[#32B494]'
                : isFeatured
                ? 'bg-[#89865D] text-white hover:bg-[#6B6A45] shadow-xs hover:shadow-md'
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
