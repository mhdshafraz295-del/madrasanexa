import React, { useState, useEffect } from 'react';
import { X, Loader2, DollarSign, AlertCircle } from 'lucide-react';
import type { UstadhSalaryItem } from '../../services/ustadh.service';

interface SalaryAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payableAmount: number, adjustmentReason: string | null) => Promise<void>;
  salary: UstadhSalaryItem | null;
  isSaving: boolean;
}

export const SalaryAdjustmentModal: React.FC<SalaryAdjustmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  salary,
  isSaving,
}) => {
  const [payableAmount, setPayableAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (salary) {
      setPayableAmount(String(salary.payableAmount));
      setAdjustmentReason(salary.adjustmentReason || '');
    }
    setError(null);
  }, [salary, isOpen]);

  if (!isOpen || !salary) return null;

  const baseSnapshot = salary.baseSalarySnapshot;
  const currentPayableNum = parseFloat(payableAmount) || 0;
  const diff = currentPayableNum - baseSnapshot;
  const isDifferent = Math.abs(diff) > 0.001;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(payableAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      setError('Please enter a valid non-negative payable amount.');
      return;
    }

    if (isDifferent && !adjustmentReason.trim()) {
      setError('An adjustment reason is mandatory when payable amount differs from base salary snapshot.');
      return;
    }

    try {
      await onSave(amountNum, isDifferent ? adjustmentReason.trim() : null);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update salary payable amount.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-stone-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between gap-2 bg-stone-50/50">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-stone-900">Adjust Payable Salary</h3>
              <p className="text-xs text-stone-500 truncate" title={`${salary.ustadh.fullName} (${salary.salaryMonth})`}>
                {salary.ustadh.fullName} ({salary.salaryMonth})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Base Snapshot Info */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 flex items-center justify-between">
            <span className="text-stone-500 font-medium">Base Salary Snapshot:</span>
            <span className="font-bold text-stone-900 text-sm">
              LKR {baseSnapshot.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* New Payable Amount */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Adjusted Payable Amount (LKR) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={payableAmount}
              onChange={(e) => setPayableAmount(e.target.value)}
              className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
              required
            />
            {isDifferent && (
              <span className={`text-[11px] font-semibold mt-1 block ${diff < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                Difference: {diff > 0 ? '+' : ''}LKR {diff.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>

          {/* Mandatory Reason Note */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Adjustment Reason Note {isDifferent && <span className="text-rose-500">* (Mandatory)</span>}
            </label>
            <textarea
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              rows={3}
              placeholder={isDifferent ? 'e.g. Approved leave deduction or performance bonus' : 'Optional note'}
              className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              required={isDifferent}
            />
            <p className="text-[10px] text-stone-400 mt-1">
              If payable amount differs from base snapshot, a clear reason must be provided for audit tracking.
            </p>
          </div>

          {/* Buttons */}
          <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-xs disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Save Adjustment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
