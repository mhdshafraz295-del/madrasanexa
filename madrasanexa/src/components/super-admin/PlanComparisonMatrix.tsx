import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  X,
  Loader2,
  Check,
  Minus,
  Lock,
  Sparkles,
  AlertCircle,
  Sliders,
  ChevronDown,
  ChevronRight,
  Layers,
  TrendingUp,
} from 'lucide-react';
import {
  apiGetPlanComparison,
  type PlanComparisonResponse,
  type ComparisonPlanItem,
  type PlanItem,
} from '../../services/api';

interface PlanComparisonMatrixProps {
  onManagePlanFeatures?: (plan: ComparisonPlanItem | PlanItem) => void;
  onRefreshTrigger?: number; // increments when an external save occurs
}

export const PlanComparisonMatrix: React.FC<PlanComparisonMatrixProps> = ({
  onManagePlanFeatures,
  onRefreshTrigger = 0,
}) => {
  const [data, setData] = useState<PlanComparisonResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<number, boolean>>({});

  const loadComparison = useCallback(async (signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiGetPlanComparison({ includeInactive }, signal);
      setData(res);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setError(err.response?.data?.message || err.message || 'Failed to load plan comparison matrix.');
    } finally {
      setIsLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    const controller = new AbortController();
    loadComparison(controller.signal);
    return () => controller.abort();
  }, [loadComparison, onRefreshTrigger]);

  const toggleCategory = (catNum: number) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catNum]: !prev[catNum],
    }));
  };

  // Filter categories and features by search
  const filteredCategories = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return data.categories;

    return data.categories
      .map((cat) => {
        const matchingFeatures = cat.features.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.key.toLowerCase().includes(q) ||
            f.description.toLowerCase().includes(q) ||
            cat.name.toLowerCase().includes(q)
        );
        if (matchingFeatures.length === 0) return null;
        return {
          ...cat,
          features: matchingFeatures,
        };
      })
      .filter((cat): cat is typeof data.categories[number] => cat !== null);
  }, [data, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 gap-3 bg-white rounded-2xl border border-[#E7E9EE]">
        <Loader2 className="w-7 h-7 animate-spin text-[#37C6A3]" />
        <p className="text-xs text-[#7C8A9A]">Loading plan comparison matrix...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-red-200 text-red-700 space-y-2">
        <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
        <h3 className="font-semibold text-sm">Failed to load comparison</h3>
        <p className="text-xs text-red-600 max-w-md mx-auto">{error}</p>
        <button
          type="button"
          onClick={() => loadComparison()}
          className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-xl text-xs font-semibold cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const { plans, catalogueStats } = data;

  return (
    <div className="space-y-4">
      {/* 1. Matrix Header & Controls */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#7C8A9A] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search features across plans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-[#F7F6F1] rounded-xl border border-[#E7E9EE] focus:bg-white focus:border-[#37C6A3] focus:outline-none text-xs text-[#0F172A]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7C8A9A] hover:text-[#0F172A] p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Stats & Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-[#0F172A] select-none">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="rounded border-[#E7E9EE] text-[#37C6A3] focus:ring-[#37C6A3] cursor-pointer"
            />
            <span>Include Inactive Plans</span>
          </label>

          <div className="h-4 w-px bg-[#E7E9EE] hidden sm:block" />

          <div className="text-[11px] text-[#7C8A9A] flex items-center gap-2">
            <span>
              <strong>{plans.length}</strong> {plans.length === 1 ? 'plan' : 'plans'}
            </span>
            <span>•</span>
            <span>
              <strong>{catalogueStats.implemented}</strong> assignable features
            </span>
            <span>•</span>
            <span>
              <strong>{catalogueStats.core}</strong> core features
            </span>
          </div>
        </div>
      </div>

      {/* 2. Matrix Table */}
      {plans.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-[#E7E9EE] space-y-2">
          <Layers className="w-8 h-8 text-[#7C8A9A] mx-auto opacity-50" />
          <h3 className="text-sm font-semibold text-[#0F172A]">No plans available for comparison</h3>
          <p className="text-xs text-[#7C8A9A]">
            {includeInactive
              ? 'No subscription plans exist in the platform.'
              : 'No active plans found. Enable "Include Inactive Plans" or create an active plan.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
          <div className="overflow-x-auto max-h-[750px] relative">
            <table className="w-full border-collapse text-left">
              {/* Sticky Table Header */}
              <thead className="sticky top-0 z-30 bg-white shadow-2xs">
                <tr className="border-b border-[#E7E9EE]">
                  {/* Sticky Feature Column Header */}
                  <th className="sticky left-0 z-40 bg-white p-3 sm:p-4 min-w-[160px] sm:min-w-[260px] md:min-w-[340px] border-r border-[#E7E9EE] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    <div className="font-bold text-sm text-[#0F172A]">Feature Capabilities</div>
                    <div className="text-[11px] text-[#7C8A9A] font-normal mt-0.5">
                      Canonical Platform Catalogue (91 features)
                    </div>
                  </th>

                  {/* Plan Columns */}
                  {plans.map((p) => {
                    const priceNum = Number(p.price);
                    const formattedPrice = isNaN(priceNum) ? 'Rs. 0' : `Rs. ${priceNum.toLocaleString()}`;

                    return (
                      <th
                        key={p.id}
                        className="p-4 min-w-[200px] text-center bg-white border-r border-[#E7E9EE] last:border-r-0 align-top"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="font-bold text-sm text-[#0F172A]">{p.name}</span>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                p.isActive ? 'bg-[#37C6A3]' : 'bg-slate-300'
                              }`}
                              title={p.isActive ? 'Active Plan' : 'Inactive Plan'}
                            />
                          </div>

                          <div className="font-mono text-[10px] font-bold text-[#7C8A9A] bg-[#F7F6F1] px-2 py-0.5 rounded-md inline-block border border-[#E7E9EE]">
                            {p.code}
                          </div>

                          <div className="pt-1">
                            <span className="text-base font-extrabold text-[#0F172A]">
                              {formattedPrice}
                            </span>
                            <span className="text-[10px] text-[#7C8A9A]">
                              {' '}/ {p.durationMonths}m
                            </span>
                          </div>

                          <div className="flex items-center justify-center gap-2 text-[10px] text-[#7C8A9A] pt-0.5">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3 text-[#37C6A3]" />
                              <strong>{p.activeSubscriptionsCount}</strong> subs
                            </span>
                            <span>•</span>
                            <span>
                              <strong>{p.featuresCount}</strong> / {catalogueStats.implemented} feat
                            </span>
                          </div>

                          {/* Quick Manage Features Button */}
                          {onManagePlanFeatures && (
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={() => onManagePlanFeatures(p)}
                                className="w-full py-1.5 px-2 bg-[#F7F6F1] hover:bg-[#E7E9EE] text-[#0F172A] rounded-xl font-semibold text-[11px] border border-[#E7E9EE] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                              >
                                <Sliders className="w-3 h-3 text-[#059669]" />
                                <span>Manage Features</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Matrix Body: Grouped by Category */}
              <tbody className="divide-y divide-[#E7E9EE] text-xs">
                {filteredCategories.map((group) => {
                  const isCollapsed = Boolean(collapsedCategories[group.number]);

                  return (
                    <React.Fragment key={group.number}>
                      {/* Category Header Row */}
                      <tr
                        onClick={() => toggleCategory(group.number)}
                        className="bg-[#F7F6F1]/80 hover:bg-[#F7F6F1] cursor-pointer transition select-none border-t-2 border-[#E7E9EE]"
                      >
                        <td
                          colSpan={plans.length + 1}
                          className="py-2.5 px-4 font-bold text-xs text-[#0F172A]"
                        >
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-[#7C8A9A]" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-[#7C8A9A]" />
                            )}
                            <span>{group.label}</span>
                            <span className="text-[10px] font-normal text-[#7C8A9A]">
                              ({group.features.length} features)
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Feature Rows */}
                      {!isCollapsed &&
                        group.features.map((feat) => {
                          const isCore = feat.status === 'CORE';
                          const isPartial = feat.status === 'PARTIALLY_IMPLEMENTED';
                          const isPlanned = feat.status === 'PLANNED';

                          return (
                            <tr
                              key={feat.key}
                              className="hover:bg-[#F7F6F1]/40 transition border-b border-[#E7E9EE]/60"
                            >
                              {/* Sticky Feature Identity Column */}
                              <td className="sticky left-0 z-20 bg-white p-3.5 border-r border-[#E7E9EE] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-xs text-[#0F172A]">
                                      {feat.name}
                                    </span>
                                    {isCore && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                        <Lock className="w-2.5 h-2.5" />
                                        Core Platform
                                      </span>
                                    )}
                                    {isPartial && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                        <AlertCircle className="w-2.5 h-2.5" />
                                        Partial
                                      </span>
                                    )}
                                    {isPlanned && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                        <Sparkles className="w-2.5 h-2.5" />
                                        Soon
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-mono text-[10px] text-[#7C8A9A]">
                                    {feat.key}
                                  </div>
                                  <div className="text-[11px] text-[#7C8A9A] line-clamp-1">
                                    {feat.description}
                                  </div>
                                </div>
                              </td>

                              {/* Plan Availability Cells */}
                              {plans.map((p) => {
                                // CORE: Display as platform classification only (not a plan-assigned entitlement)
                                if (isCore) {
                                  return (
                                    <td
                                      key={p.id}
                                      className="p-3 text-center border-r border-[#E7E9EE] last:border-r-0 bg-slate-50/30"
                                    >
                                      <span
                                        title="Core platform classification (Not assignable to individual tiers)"
                                        className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-500 bg-slate-100"
                                      >
                                        <Lock className="w-2.5 h-2.5" />
                                        <span>Core (Platform)</span>
                                      </span>
                                    </td>
                                  );
                                }

                                if (isPartial || isPlanned) {
                                  return (
                                    <td
                                      key={p.id}
                                      className="p-3 text-center border-r border-[#E7E9EE] last:border-r-0 opacity-40 bg-slate-50/20"
                                    >
                                      <span className="text-[11px] text-[#7C8A9A]">—</span>
                                    </td>
                                  );
                                }

                                const isEnabled = Boolean(p.featureAvailability[feat.key]);

                                return (
                                  <td
                                    key={p.id}
                                    className={`p-3 text-center border-r border-[#E7E9EE] last:border-r-0 ${
                                      isEnabled ? 'bg-emerald-50/20' : ''
                                    }`}
                                  >
                                    {isEnabled ? (
                                      <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-[#059669]">
                                        <Check className="w-4 h-4 stroke-[3]" />
                                      </div>
                                    ) : (
                                      <div className="inline-flex items-center justify-center w-7 h-7 text-slate-300">
                                        <Minus className="w-4 h-4" />
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
