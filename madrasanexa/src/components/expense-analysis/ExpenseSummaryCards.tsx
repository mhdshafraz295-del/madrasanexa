import React from 'react';
import type { MonthlySummary } from '../../services/expense-analysis.service';
import {
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  PieChart,
  Scale,
} from 'lucide-react';

interface ExpenseSummaryCardsProps {
  summary: MonthlySummary | null;
  currency?: string;
}

export const ExpenseSummaryCards: React.FC<ExpenseSummaryCardsProps> = ({ summary, currency = 'LKR' }) => {
  if (!summary) return null;

  const diffNum = Number(summary.difference);
  const isDiffPositive = diffNum > 0;
  const isDiffZero = diffNum === 0;

  const varianceNum = Number(summary.budgetVariance);
  const isOverBudget = summary.totalBudgetStatus === 'OVER_BUDGET';
  const isNearBudget = summary.totalBudgetStatus === 'NEAR_BUDGET';

  const cards = [
    {
      title: 'Current Month Expense',
      value: `${currency} ${Number(summary.currentTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      subtitle: `Selected: ${summary.selectedMonth}`,
      icon: DollarSign,
      iconBg: 'bg-emerald-50 text-[#37C6A3]',
    },
    {
      title: 'Previous Month Expense',
      value: `${currency} ${Number(summary.previousTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      subtitle: `Compared to: ${summary.previousMonth}`,
      icon: Calendar,
      iconBg: 'bg-slate-100 text-[#7C8A9A]',
    },
    {
      title: 'Difference / Change',
      value: `${isDiffPositive ? '+' : ''}${currency} ${Math.abs(diffNum).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      subtitle: summary.changeLabel === 'NEW_SPEND' ? 'New Spend' : summary.changeLabel,
      icon: isDiffPositive ? TrendingUp : TrendingDown,
      iconBg: isDiffPositive ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600',
      valueColor: isDiffPositive ? 'text-rose-600' : isDiffZero ? 'text-[#0F172A]' : 'text-emerald-600',
    },
    {
      title: 'Monthly Budget',
      value: `${currency} ${Number(summary.totalBudget).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      subtitle: Number(summary.totalBudget) > 0 ? 'Aggregated category budgets' : 'No budget configured',
      icon: PieChart,
      iconBg: 'bg-amber-50 text-amber-600',
    },
    {
      title: 'Budget Variance',
      value: `${varianceNum >= 0 ? '+' : ''}${currency} ${Math.abs(varianceNum).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      subtitle: isOverBudget ? 'Over Budget' : isNearBudget ? 'Near Budget' : 'Within Budget',
      icon: Scale,
      iconBg: isOverBudget ? 'bg-rose-50 text-rose-600' : isNearBudget ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600',
      valueColor: isOverBudget ? 'text-rose-600' : isNearBudget ? 'text-amber-600' : 'text-emerald-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className="bg-white rounded-2xl p-5 border border-[#E7E9EE] shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#7C8A9A] uppercase tracking-wider line-clamp-1">{c.title}</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${c.iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className={`text-xl font-extrabold tracking-tight ${c.valueColor || 'text-[#0F172A]'}`}>
                {c.value}
              </div>
              <div className="text-[11px] font-medium text-[#7C8A9A] mt-1 line-clamp-1">
                {c.subtitle}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
export default ExpenseSummaryCards;
