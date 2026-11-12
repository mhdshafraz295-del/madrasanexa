import React from 'react';
import type { CategoryComparisonItem } from '../../services/expense-analysis.service';
import { TrendingUp, TrendingDown, MessageSquare } from 'lucide-react';

interface MonthlyComparisonTableProps {
  comparison: CategoryComparisonItem[];
  selectedMonth: string;
  previousMonth: string;
  currency?: string;
  onOpenInsightModal?: (categoryId: string, categoryName: string) => void;
}

export const MonthlyComparisonTable: React.FC<MonthlyComparisonTableProps> = ({
  comparison,
  selectedMonth,
  previousMonth,
  currency = 'LKR',
  onOpenInsightModal,
}) => {
  return (
    <div className="bg-white rounded-3xl border border-[#E7E9EE] shadow-xs overflow-hidden">
      <div className="p-5 border-b border-[#E7E9EE] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A]">Category-Wise Cost Comparison</h3>
          <p className="text-xs text-[#7C8A9A] mt-0.5">
            Complete category-union comparison: {selectedMonth} vs {previousMonth}
          </p>
        </div>
      </div>

      {/* Desktop / Tablet Table view */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[#F7F6F1] border-b border-[#E7E9EE] text-[#7C8A9A] uppercase tracking-wider text-[10px] font-bold">
              <th className="py-3 px-4 whitespace-nowrap">Category</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Previous ({previousMonth})</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Current ({selectedMonth})</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Difference</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Change %</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Budget</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Variance</th>
              <th className="py-3 px-4 text-center whitespace-nowrap">Status</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Management</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E9EE]">
            {comparison.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-[#7C8A9A]">
                  No expense records found for {selectedMonth} or {previousMonth}.
                </td>
              </tr>
            ) : (
              comparison.map((r) => {
                const diffNum = Number(r.difference);
                const isDiffPositive = diffNum > 0;
                const isDiffZero = diffNum === 0;

                let statusBadge = (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-[#7C8A9A]">
                    Not Set
                  </span>
                );
                if (r.budgetStatus === 'OVER_BUDGET') {
                  statusBadge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                      Over Budget
                    </span>
                  );
                } else if (r.budgetStatus === 'NEAR_BUDGET') {
                  statusBadge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      Near Budget
                    </span>
                  );
                } else if (r.budgetStatus === 'WITHIN_BUDGET') {
                  statusBadge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Within Budget
                    </span>
                  );
                }

                return (
                  <tr key={r.categoryId} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-[#0F172A] whitespace-nowrap">
                      {r.categoryName}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-[#7C8A9A] whitespace-nowrap">
                      {Number(r.previousTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-[#0F172A] whitespace-nowrap">
                      {Number(r.currentTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-mono font-semibold whitespace-nowrap ${
                        isDiffPositive ? 'text-rose-600' : isDiffZero ? 'text-[#7C8A9A]' : 'text-emerald-600'
                      }`}
                    >
                      {diffNum >= 0 ? '+' : ''}
                      {diffNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {r.changeLabel === 'NEW_SPEND' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          New Spend
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-0.5 font-bold ${
                            isDiffPositive ? 'text-rose-600' : isDiffZero ? 'text-[#7C8A9A]' : 'text-emerald-600'
                          }`}
                        >
                          {isDiffPositive ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : isDiffZero ? null : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {r.changeLabel}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-[#7C8A9A] whitespace-nowrap">
                      {r.budget ? Number(r.budget).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                      {r.budgetVariance ? (
                        <span
                          className={
                            Number(r.budgetVariance) > 0
                              ? 'text-rose-600 font-bold'
                              : 'text-emerald-600 font-medium'
                          }
                        >
                          {Number(r.budgetVariance) >= 0 ? '+' : ''}
                          {Number(r.budgetVariance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">{statusBadge}</td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {onOpenInsightModal && (
                        <button
                          onClick={() => onOpenInsightModal(r.categoryId, r.categoryName)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition cursor-pointer ${
                            r.adminReason || r.actionPlan
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-white text-[#7C8A9A] border-[#E7E9EE] hover:bg-[#F7F6F1]'
                          }`}
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>{r.adminReason || r.actionPlan ? 'Edit Note' : 'Add Note'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout (<=768px) */}
      <div className="md:hidden divide-y divide-[#E7E9EE] p-4 space-y-3">
        {comparison.length === 0 ? (
          <div className="py-8 text-center text-[#7C8A9A] text-xs">
            No expense records found for {selectedMonth} or {previousMonth}.
          </div>
        ) : (
          comparison.map((r) => {
            const diffNum = Number(r.difference);
            const isDiffPositive = diffNum > 0;
            const isDiffZero = diffNum === 0;

            return (
              <div key={r.categoryId} className="p-4 bg-[#F7F6F1] rounded-2xl border border-[#E7E9EE] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-[#0F172A] min-w-0 break-words">{r.categoryName}</span>
                  {r.changeLabel === 'NEW_SPEND' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      New Spend
                    </span>
                  ) : (
                    <span
                      className={`text-xs font-bold ${
                        isDiffPositive ? 'text-rose-600' : isDiffZero ? 'text-[#7C8A9A]' : 'text-emerald-600'
                      }`}
                    >
                      {r.changeLabel}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#E7E9EE]">
                  <div>
                    <span className="text-[10px] text-[#7C8A9A] block uppercase font-bold">Previous</span>
                    <span className="font-mono text-[#7C8A9A]">
                      {currency} {Number(r.previousTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7C8A9A] block uppercase font-bold">Current</span>
                    <span className="font-mono font-bold text-[#0F172A]">
                      {currency} {Number(r.currentTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#E7E9EE]">
                  <div>
                    <span className="text-[10px] text-[#7C8A9A] block uppercase font-bold">Difference</span>
                    <span
                      className={`font-mono font-semibold ${
                        isDiffPositive ? 'text-rose-600' : isDiffZero ? 'text-[#7C8A9A]' : 'text-emerald-600'
                      }`}
                    >
                      {diffNum >= 0 ? '+' : ''}
                      {diffNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7C8A9A] block uppercase font-bold">Budget Status</span>
                    <span className="text-[11px] font-bold capitalize">
                      {r.budgetStatus.toLowerCase().replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {onOpenInsightModal && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => onOpenInsightModal(r.categoryId, r.categoryName)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold bg-white border border-[#E7E9EE] text-[#0F172A] cursor-pointer"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>{r.adminReason || r.actionPlan ? 'Edit Analysis Note' : 'Add Analysis Note'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
export default MonthlyComparisonTable;
