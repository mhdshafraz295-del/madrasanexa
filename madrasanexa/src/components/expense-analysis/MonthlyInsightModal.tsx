import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface MonthlyInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId: string;
  categoryName: string;
  year: number;
  month: number;
  existingReason?: string | null;
  existingActionPlan?: string | null;
  onSave: (payload: {
    categoryId: string;
    year: number;
    month: number;
    adminReason?: string | null;
    actionPlan?: string | null;
  }) => Promise<void>;
}

export const MonthlyInsightModal: React.FC<MonthlyInsightModalProps> = ({
  isOpen,
  onClose,
  categoryId,
  categoryName,
  year,
  month,
  existingReason,
  existingActionPlan,
  onSave,
}) => {
  const [adminReason, setAdminReason] = useState('');
  const [actionPlan, setActionPlan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAdminReason(existingReason || '');
    setActionPlan(existingActionPlan || '');
    setError(null);
  }, [existingReason, existingActionPlan, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        categoryId,
        year,
        month,
        adminReason: adminReason.trim() ? adminReason.trim() : null,
        actionPlan: actionPlan.trim() ? actionPlan.trim() : null,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to save analysis notes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E7E9EE]">
        <div className="flex items-center justify-between pb-3 border-b border-[#E7E9EE]">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">Management Analysis Note</h3>
            <span className="text-xs text-[#7C8A9A]">
              {categoryName} &bull; {year}-{String(month).padStart(2, '0')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] rounded-xl hover:bg-[#F7F6F1] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="my-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Admin Explanation / Cost Context
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Price increase from supplier; 40 extra students stayed in the hostel during exams."
              value={adminReason}
              onChange={(e) => setAdminReason(e.target.value)}
              maxLength={2000}
              className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#37C6A3] resize-none"
            />
            <span className="text-[10px] text-[#7C8A9A]">
              Will appear as an official Admin Explanation in monthly reports and PDF export.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Cost Control Action Plan (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Compare alternate milk suppliers; review daily kitchen rationing."
              value={actionPlan}
              onChange={(e) => setActionPlan(e.target.value)}
              maxLength={2000}
              className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#37C6A3] resize-none"
            />
            <span className="text-[10px] text-[#7C8A9A]">
              Management plan to reduce, optimize or control costs in subsequent months.
            </span>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#E7E9EE] text-xs font-semibold text-[#7C8A9A] hover:bg-[#F7F6F1] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default MonthlyInsightModal;
