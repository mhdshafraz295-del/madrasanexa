import React, { useState, useEffect } from 'react';
import type { ExpenseCategory, ExpenseBudgetItem } from '../../services/expense-analysis.service';
import { X, AlertCircle } from 'lucide-react';

interface ExpenseBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ExpenseCategory[];
  existingBudgets: ExpenseBudgetItem[];
  year: number;
  month: number;
  onSaveBudgets: (budgets: { categoryId: string; amount: number | string }[]) => Promise<void>;
  currency?: string;
}

export const ExpenseBudgetModal: React.FC<ExpenseBudgetModalProps> = ({
  isOpen,
  onClose,
  categories,
  existingBudgets,
  year,
  month,
  onSaveBudgets,
  currency = 'LKR',
}) => {
  const [budgetValues, setBudgetValues] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const cat of categories) {
      const match = existingBudgets.find((b) => b.categoryId === cat.id);
      map[cat.id] = match ? match.amount : '0.00';
    }
    setBudgetValues(map);
    setError(null);
  }, [categories, existingBudgets, isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (categoryId: string, val: string) => {
    setBudgetValues((prev) => ({
      ...prev,
      [categoryId]: val,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: { categoryId: string; amount: string }[] = [];

    for (const cat of categories) {
      const rawVal = budgetValues[cat.id] !== undefined ? budgetValues[cat.id].trim() : '0';
      const numVal = Number(rawVal);
      if (isNaN(numVal) || numVal < 0) {
        setError(`Invalid budget amount for category "${cat.name}". Must be 0 or greater.`);
        return;
      }
      payload.push({
        categoryId: cat.id,
        amount: rawVal,
      });
    }

    try {
      setIsSubmitting(true);
      await onSaveBudgets(payload);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to update budgets.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCalculatedBudget = Object.values(budgetValues).reduce((acc, curr) => {
    const n = Number(curr);
    return acc + (isNaN(n) || n < 0 ? 0 : n);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#E7E9EE] flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-[#E7E9EE]">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">Set Monthly Category Budgets</h2>
            <p className="text-xs text-[#7C8A9A]">
              Target operational spending limits for {year}-{String(month).padStart(2, '0')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#7C8A9A] hover:text-[#0F172A] rounded-xl hover:bg-[#F7F6F1] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="my-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-3 space-y-3">
          {categories.length === 0 ? (
            <div className="py-8 text-center text-[#7C8A9A] text-xs">
              No categories found. Create categories before setting budgets.
            </div>
          ) : (
            categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between gap-3 p-3 bg-[#F7F6F1] rounded-2xl border border-[#E7E9EE]"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-[#0F172A] truncate">{cat.name}</div>
                  <div className="text-[10px] text-[#7C8A9A] truncate">{cat.description || 'No description'}</div>
                </div>

                <div className="w-36 flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#7C8A9A]">{currency}</span>
                  <input
                    type="text"
                    value={budgetValues[cat.id] || ''}
                    onChange={(e) => handleInputChange(cat.id, e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E7E9EE] rounded-xl text-xs font-mono font-bold text-right focus:outline-hidden focus:border-[#37C6A3]"
                  />
                </div>
              </div>
            ))
          )}
        </form>

        <div className="pt-4 border-t border-[#E7E9EE] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#7C8A9A] uppercase font-bold tracking-wider block">
              Total Monthly Budget
            </span>
            <span className="text-sm font-extrabold text-[#0F172A]">
              {currency} {totalCalculatedBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#E7E9EE] text-xs font-semibold text-[#7C8A9A] hover:bg-[#F7F6F1] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting || categories.length === 0}
              className="px-5 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Save All Budgets'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ExpenseBudgetModal;
