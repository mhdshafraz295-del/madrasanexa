import React, { useState, useEffect } from 'react';
import type { ExpenseCategory, ExpenseItem } from '../../services/expense-analysis.service';
import { X, AlertCircle } from 'lucide-react';

interface ExpenseEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  categories: ExpenseCategory[];
  expenseToEdit?: ExpenseItem | null;
  currency?: string;
}

export const ExpenseEntryModal: React.FC<ExpenseEntryModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  categories,
  expenseToEdit,
  currency = 'LKR',
}) => {
  const [expenseDate, setExpenseDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitLabel, setUnitLabel] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [reasonNote, setReasonNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (expenseToEdit) {
      setExpenseDate(expenseToEdit.expenseDate);
      setCategoryId(expenseToEdit.categoryId);
      setDescription(expenseToEdit.description);
      setAmount(expenseToEdit.amount);
      setQuantity(expenseToEdit.quantity || '');
      setUnitLabel(expenseToEdit.unitLabel || '');
      setUnitCost(expenseToEdit.unitCost || '');
      setSupplierName(expenseToEdit.supplierName || '');
      setReasonNote(expenseToEdit.reasonNote || '');
    } else {
      const today = new Date().toISOString().split('T')[0];
      setExpenseDate(today);
      setCategoryId(categories.length > 0 ? categories[0].id : '');
      setDescription('');
      setAmount('');
      setQuantity('');
      setUnitLabel('');
      setUnitCost('');
      setSupplierName('');
      setReasonNote('');
    }
    setError(null);
  }, [expenseToEdit, isOpen, categories]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!expenseDate) {
      setError('Date is required.');
      return;
    }
    if (!categoryId) {
      setError('Category is required.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError('Amount must be greater than 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        expenseDate,
        categoryId,
        description: description.trim(),
        amount: amount.trim(),
        quantity: quantity.trim() ? quantity.trim() : null,
        unitLabel: unitLabel.trim() ? unitLabel.trim() : null,
        unitCost: unitCost.trim() ? unitCost.trim() : null,
        supplierName: supplierName.trim() ? supplierName.trim() : null,
        reasonNote: reasonNote.trim() ? reasonNote.trim() : null,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to save expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[#E7E9EE] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-[#E7E9EE]">
          <h2 className="text-lg font-bold text-[#0F172A]">
            {expenseToEdit ? 'Edit Expense Record' : 'Record New Expense'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-[#7C8A9A] hover:text-[#0F172A] rounded-xl hover:bg-[#F7F6F1] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="my-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto py-4 pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-semibold focus:outline-hidden focus:border-[#37C6A3]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-semibold focus:outline-hidden focus:border-[#37C6A3]"
                required
              >
                {categories.length === 0 ? (
                  <option value="">No categories available</option>
                ) : (
                  categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {!c.isActive ? '(Inactive)' : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Description <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Rice and milk purchase for hostel kitchen"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={255}
              className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#37C6A3]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Total Amount ({currency}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-extrabold focus:outline-hidden focus:border-[#37C6A3]"
                required
              />
              <span className="text-[10px] text-[#7C8A9A]">Authoritative total recorded for this expense.</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Supplier / Vendor (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. ABC Wholesalers"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                maxLength={150}
                className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#37C6A3]"
              />
            </div>
          </div>

          {/* Optional Analysis Metadata */}
          <div className="p-4 bg-slate-50/70 border border-[#E7E9EE] rounded-2xl space-y-3">
            <span className="text-[11px] font-bold text-[#7C8A9A] uppercase tracking-wider block">
              Optional Analysis Metadata (For Unit Cost Review)
            </span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">Quantity</label>
                <input
                  type="text"
                  placeholder="e.g. 50"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E7E9EE] rounded-xl text-xs focus:outline-hidden focus:border-[#37C6A3]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">Unit</label>
                <input
                  type="text"
                  placeholder="e.g. kg, L, pack"
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  maxLength={50}
                  className="w-full px-3 py-2 bg-white border border-[#E7E9EE] rounded-xl text-xs focus:outline-hidden focus:border-[#37C6A3]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">Unit Cost</label>
                <input
                  type="text"
                  placeholder="e.g. 250"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E7E9EE] rounded-xl text-xs focus:outline-hidden focus:border-[#37C6A3]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Reason / Operational Note (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Hostel student count increased for exams; bulk purchase"
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              maxLength={2000}
              className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#37C6A3] resize-none"
            />
            <span className="text-[10px] text-[#7C8A9A]">
              Will be recorded verbatim as Recorded Reason in cost analysis reports.
            </span>
          </div>

          <div className="pt-4 border-t border-[#E7E9EE] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-semibold text-[#7C8A9A] hover:bg-[#F7F6F1] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || categories.length === 0}
              className="px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : expenseToEdit ? 'Update Expense' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default ExpenseEntryModal;
