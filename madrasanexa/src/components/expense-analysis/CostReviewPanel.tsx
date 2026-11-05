import React from 'react';
import type { CostReviewData } from '../../services/expense-analysis.service';
import { TrendingUp, TrendingDown, FileText, Activity, Lightbulb, ClipboardList } from 'lucide-react';

interface CostReviewPanelProps {
  costReview: CostReviewData | null;
  currency?: string;
}

export const CostReviewPanel: React.FC<CostReviewPanelProps> = ({ costReview, currency = 'LKR' }) => {
  if (!costReview) return null;

  return (
    <div className="space-y-6">
      {/* Top Cost Movements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Increases */}
        <div className="bg-white rounded-3xl p-5 border border-[#E7E9EE] shadow-xs">
          <div className="flex items-center gap-2 mb-3 text-rose-600 font-bold text-xs uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" />
            <span>Top Cost Increases</span>
          </div>
          {costReview.topIncreases.length === 0 ? (
            <p className="text-xs text-[#7C8A9A]">No cost increases recorded this month.</p>
          ) : (
            <div className="space-y-2.5">
              {costReview.topIncreases.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-rose-50/40 rounded-2xl border border-rose-100/60"
                >
                  <div>
                    <span className="font-bold text-xs text-[#0F172A] block">{item.categoryName}</span>
                    <span className="text-[11px] text-[#7C8A9A]">Change: {item.changeLabel}</span>
                  </div>
                  <div className="font-mono font-extrabold text-xs text-rose-600">
                    +{currency} {Number(item.difference).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Decreases */}
        <div className="bg-white rounded-3xl p-5 border border-[#E7E9EE] shadow-xs">
          <div className="flex items-center gap-2 mb-3 text-emerald-600 font-bold text-xs uppercase tracking-wider">
            <TrendingDown className="w-4 h-4" />
            <span>Top Cost Reductions</span>
          </div>
          {costReview.topDecreases.length === 0 ? (
            <p className="text-xs text-[#7C8A9A]">No cost decreases recorded this month.</p>
          ) : (
            <div className="space-y-2.5">
              {costReview.topDecreases.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-emerald-50/40 rounded-2xl border border-emerald-100/60"
                >
                  <div>
                    <span className="font-bold text-xs text-[#0F172A] block">{item.categoryName}</span>
                    <span className="text-[11px] text-[#7C8A9A]">Reduction: {item.changeLabel}</span>
                  </div>
                  <div className="font-mono font-extrabold text-xs text-emerald-600">
                    {currency} {Number(item.difference).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detailed Category Cost Review Sections */}
      <div className="bg-white rounded-3xl border border-[#E7E9EE] shadow-xs p-6">
        <h3 className="text-sm font-bold text-[#0F172A] mb-1">Detailed Category Cost Review</h3>
        <p className="text-xs text-[#7C8A9A] mb-5">
          Strict three-way separation: Recorded Reasons &bull; System Data Signals &bull; Deterministic Cost Review Suggestions
        </p>

        <div className="space-y-6">
          {costReview.categories.map((c) => (
            <div key={c.categoryId} className="p-5 bg-[#F7F6F1] rounded-2xl border border-[#E7E9EE] space-y-4">
              <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-3">
                <div>
                  <h4 className="font-extrabold text-sm text-[#0F172A]">{c.categoryName}</h4>
                  <span className="text-[11px] text-[#7C8A9A]">
                    Spend: {currency} {Number(c.currentTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })} &bull;
                    Diff: {Number(c.difference) >= 0 ? '+' : ''}{Number(c.difference).toLocaleString('en-US', { minimumFractionDigits: 2 })} ({c.changeLabel})
                  </span>
                </div>
                {c.budgetStatus === 'OVER_BUDGET' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                    Over Budget
                  </span>
                )}
              </div>

              {/* 1. Recorded Reasons (Admin Entered) */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A] mb-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#37C6A3]" />
                  <span>Recorded Reasons (Entered by Staff/Admin)</span>
                </div>
                {c.recordedReasons.length === 0 && !c.adminReason ? (
                  <p className="text-xs text-[#7C8A9A] italic pl-5">No recorded reason available.</p>
                ) : (
                  <ul className="list-disc list-inside space-y-1 text-xs text-[#0F172A] pl-1">
                    {c.recordedReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                    {c.adminReason && (
                      <li>
                        <span className="font-semibold text-emerald-800">Admin Explanation:</span> {c.adminReason}
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {/* 2. System Data Signals (Factual Calculations) */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A] mb-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-600" />
                  <span>Factual Data Signals</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-xs text-[#475569] pl-1">
                  {c.dataSignals.map((sig, i) => (
                    <li key={i}>{sig}</li>
                  ))}
                </ul>
              </div>

              {/* 3. Cost Review Suggestions (Deterministic Management Review Prompts) */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A] mb-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  <span>Cost Review Suggestions (Management Prompts)</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-xs text-amber-900 bg-amber-50/60 p-3 rounded-xl border border-amber-200/60">
                  {c.suggestions.map((sug, i) => (
                    <li key={i}>{sug}</li>
                  ))}
                </ul>
              </div>

              {/* Management Action Plan */}
              {c.actionPlan && (
                <div className="pt-2 border-t border-[#E7E9EE]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A] mb-1">
                    <ClipboardList className="w-3.5 h-3.5 text-purple-600" />
                    <span>Management Action Plan</span>
                  </div>
                  <p className="text-xs text-[#0F172A] pl-5">{c.actionPlan}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default CostReviewPanel;
