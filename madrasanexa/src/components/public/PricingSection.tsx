import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PlanData } from '../../services/homepage.service';
import { Sparkles, ArrowRight, ShieldCheck, Lock, RefreshCw } from 'lucide-react';
import { PlanCard, type PlanCardData } from '../subscription/PlanCard';
import { PlanFeatureDrawer } from '../subscription/PlanFeatureDrawer';

interface PricingSectionProps {
  plans: PlanData[];
}

export default function PricingSection({ plans }: PricingSectionProps) {
  const [selectedDrawerPlan, setSelectedDrawerPlan] = useState<PlanCardData | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [durationFilter, setDurationFilter] = useState<'ALL' | 'ANNUAL' | 'MONTHLY'>('ALL');

  const activePlans = (plans || []).filter((p) => p.isActive);

  // Check if genuine multiple duration variants exist in actual data
  const hasMonthly = activePlans.some((p) => p.durationMonths === 1);
  const hasAnnual = activePlans.some((p) => p.durationMonths >= 12);
  const hasMultipleDurations = hasMonthly && hasAnnual;

  const displayedPlans = activePlans.filter((p) => {
    if (!hasMultipleDurations || durationFilter === 'ALL') return true;
    if (durationFilter === 'MONTHLY') return p.durationMonths === 1;
    if (durationFilter === 'ANNUAL') return p.durationMonths >= 12;
    return true;
  });

  const handleOpenFeatures = (plan: PlanCardData) => {
    setSelectedDrawerPlan(plan);
    setIsDrawerOpen(true);
  };

  const handleCloseFeatures = () => {
    setIsDrawerOpen(false);
    setSelectedDrawerPlan(null);
  };

  return (
    <section id="pricing" className="py-20 sm:py-28 bg-[#F7F6F1] relative scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white text-[#89865D] text-xs font-bold tracking-wider uppercase mb-3 border border-[#E7E9EE] shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-[#FFD978]" />
            <span>Institutional Subscriptions</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0F172A] tracking-tight">
            Transparent Subscription Plans
          </h2>
          <div className="w-16 h-1 bg-[#89865D] mx-auto rounded-full mt-4 mb-4" />
          <p className="text-base sm:text-lg text-[#7C8A9A] leading-relaxed">
            Official subscription tiers authorized for registered Islamic institutions. Zero hidden maintenance charges.
          </p>

          {/* Genuine Duration Filter (Rendered only if multiple durations exist in database) */}
          {hasMultipleDurations && (
            <div className="flex items-center justify-center mt-8">
              <div className="inline-flex items-center p-1 rounded-2xl bg-white border border-[#E7E9EE] shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDurationFilter('ALL')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    durationFilter === 'ALL'
                      ? 'bg-[#0F172A] text-white shadow-xs'
                      : 'text-[#7C8A9A] hover:text-[#0F172A]'
                  }`}
                >
                  All Plans
                </button>
                <button
                  type="button"
                  onClick={() => setDurationFilter('ANNUAL')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    durationFilter === 'ANNUAL'
                      ? 'bg-[#0F172A] text-white shadow-xs'
                      : 'text-[#7C8A9A] hover:text-[#0F172A]'
                  }`}
                >
                  Annual
                </button>
                <button
                  type="button"
                  onClick={() => setDurationFilter('MONTHLY')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    durationFilter === 'MONTHLY'
                      ? 'bg-[#0F172A] text-white shadow-xs'
                      : 'text-[#7C8A9A] hover:text-[#0F172A]'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Plans Container */}
        {displayedPlans.length > 0 ? (
          <div
            className={`grid grid-cols-1 ${
              displayedPlans.length === 1
                ? 'max-w-md mx-auto'
                : displayedPlans.length === 2
                ? 'max-w-4xl mx-auto md:grid-cols-2'
                : 'lg:grid-cols-3'
            } gap-6 sm:gap-8 items-stretch pt-2`}
          >
            {displayedPlans.map((plan) => {
              const code = (plan.code || '').toUpperCase();
              const name = (plan.name || '').toLowerCase();
              // Approved product decision: Dynamic Gold Tier is the designated recommended plan
              const isRecommended =
                (plan as any).isRecommended === true ||
                code === '079438_GOLD' ||
                (name.includes('dynamic') && name.includes('gold'));

              const cardData: PlanCardData = {
                id: plan.id,
                name: plan.name,
                code: plan.code,
                description: plan.description,
                price: plan.price,
                durationMonths: plan.durationMonths,
                isActive: plan.isActive,
                isRecommended,
                originalPrice: plan.originalPrice ?? null,
                isSpecialOffer: Boolean(plan.isSpecialOffer),
                specialOfferLabel: plan.specialOfferLabel ?? null,
              };

              return (
                <PlanCard
                  key={plan.id}
                  plan={cardData}
                  mode="public"
                  onViewFeatures={handleOpenFeatures}
                />
              );
            })}
          </div>
        ) : (
          <div className="max-w-md mx-auto text-center p-8 bg-white rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#F7F6F1] text-[#89865D] flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-lg font-bold text-[#0F172A]">Plans Under Configuration</h3>
              <p className="text-xs text-[#7C8A9A] leading-relaxed">
                Platform subscription plans are currently being configured by Platform Administration.
              </p>
            </div>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0F172A] text-white hover:bg-[#1E293B] transition shadow-xs"
            >
              <span>Apply for Onboarding</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Trust & Guarantee Strip */}
        <div className="mt-16 sm:mt-24 pt-12 border-t border-[#E7E9EE] grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-[#E7E9EE] shadow-2xs">
            <div className="p-2.5 rounded-xl bg-[#37C6A3]/10 text-[#37C6A3] shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-[#0F172A]">Multi-Tenant Data Privacy</h4>
              <p className="text-[11px] text-[#7C8A9A] leading-relaxed">
                Strict database-level isolation ensures no Madrasa can ever access another institution's data.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-[#E7E9EE] shadow-2xs">
            <div className="p-2.5 rounded-xl bg-[#89865D]/10 text-[#89865D] shrink-0 mt-0.5">
              <Lock className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-[#0F172A]">Zero Business Data Loss</h4>
              <p className="text-[11px] text-[#7C8A9A] leading-relaxed">
                Even during renewal transitions, student, invoice, and operational records remain 100% intact.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-[#E7E9EE] shadow-2xs">
            <div className="p-2.5 rounded-xl bg-[#FFD978]/30 text-amber-900 shrink-0 mt-0.5">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-[#0F172A]">Consecutive Extension</h4>
              <p className="text-[11px] text-[#7C8A9A] leading-relaxed">
                Early renewals seamlessly extend consecutive coverage without losing any active days.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Details Modal / Drawer */}
      <PlanFeatureDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseFeatures}
        plan={selectedDrawerPlan}
      />
    </section>
  );
}
