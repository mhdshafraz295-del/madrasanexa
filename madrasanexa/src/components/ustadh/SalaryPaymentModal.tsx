import React, { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle2, CreditCard, Calendar, FileText, AlertTriangle } from 'lucide-react';
import type { UstadhSalaryItem, PaymentMethod } from '../../services/ustadh.service';

interface SalaryPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    paymentMethod: PaymentMethod;
    paymentDate: string;
    paymentReference?: string | null;
    paymentNote?: string | null;
  }) => Promise<void>;
  salary: UstadhSalaryItem | null;
  isSaving: boolean;
}

export const SalaryPaymentModal: React.FC<SalaryPaymentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  salary,
  isSaving,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPaymentMethod('BANK_TRANSFER');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentReference('');
    setPaymentNote('');
    setError(null);
  }, [salary, isOpen]);

  if (!isOpen || !salary) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!paymentDate) {
      setError('Payment date is required.');
      return;
    }

    try {
      await onConfirm({
        paymentMethod,
        paymentDate,
        paymentReference: paymentReference.trim() || null,
        paymentNote: paymentNote.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to record salary payment.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-stone-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">Record Salary Payment</h3>
              <p className="text-xs text-stone-500">
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
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Amount Box */}
          <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                Total Payable Amount
              </span>
              <span className="text-2xl font-black text-emerald-900">
                LKR {salary.payableAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="sm:text-right text-[11px] text-stone-500">
              Base: LKR {salary.baseSalarySnapshot.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-stone-400" />
              Payment Method <span className="text-rose-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-medium"
              required
            >
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Payment Date */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-stone-400" />
              Payment Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-medium"
              required
            />
          </div>

          {/* Reference */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Transaction / Cheque Reference <span className="text-stone-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="e.g. TXN-12345678"
              className="w-full h-10 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 font-mono"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-stone-400" />
              Payment Note <span className="text-stone-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              rows={2}
              placeholder="e.g. Disbursed via Commercial Bank batch transfer"
              className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Immutability Warning */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <span>
              Once marked as paid, this salary record becomes an immutable financial entry. An automatic email receipt will be sent if the Ustadh has an email configured.
            </span>
          </div>

          {/* Footer Actions */}
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
              <span>Confirm Payment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
