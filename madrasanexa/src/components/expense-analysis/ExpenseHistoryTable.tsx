import React, { useState } from 'react';
import type { ExpenseCategory, ExpenseItem, ExpenseStatus } from '../../services/expense-analysis.service';
import { Search, Ban, Edit, Info, AlertTriangle } from 'lucide-react';

interface ExpenseHistoryTableProps {
  expenses: ExpenseItem[];
  categories: ExpenseCategory[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onFilterChange: (filters: any) => void;
  onEdit: (expense: ExpenseItem) => void;
  onVoid: (expense: ExpenseItem) => void;
  currency?: string;
  selectedMonth: string;
}

export const ExpenseHistoryTable: React.FC<ExpenseHistoryTableProps> = ({
  expenses,
  categories,
  total,
  page,
  pageSize,
  onPageChange,
  onFilterChange,
  onEdit,
  onVoid,
  currency = 'LKR',
  selectedMonth,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [voidModalExpense, setVoidModalExpense] = useState<ExpenseItem | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      search: searchTerm || undefined,
      categoryId: categoryFilter || undefined,
      status: (statusFilter as ExpenseStatus) || undefined,
    });
  };

  const handleCategorySelect = (val: string) => {
    setCategoryFilter(val);
    onFilterChange({
      search: searchTerm || undefined,
      categoryId: val || undefined,
      status: (statusFilter as ExpenseStatus) || undefined,
    });
  };

  const handleStatusSelect = (val: string) => {
    setStatusFilter(val);
    onFilterChange({
      search: searchTerm || undefined,
      categoryId: categoryFilter || undefined,
      status: (val as ExpenseStatus) || undefined,
    });
  };

  const handleConfirmVoid = async () => {
    if (!voidModalExpense) return;
    if (!voidReason.trim()) {
      setVoidError('Void reason is mandatory.');
      return;
    }
    try {
      setIsVoiding(true);
      setVoidError(null);
      await onVoid({ ...voidModalExpense, voidReason: voidReason.trim() });
      setVoidModalExpense(null);
      setVoidReason('');
    } catch (err: any) {
      setVoidError(err?.response?.data?.message || err.message || 'Failed to void expense.');
    } finally {
      setIsVoiding(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="bg-white rounded-3xl border border-[#E7E9EE] shadow-xs overflow-hidden">
      {/* Filters Bar */}
      <div className="p-5 border-b border-[#E7E9EE] flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#7C8A9A] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search description, supplier, notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#37C6A3]"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={categoryFilter}
            onChange={(e) => handleCategorySelect(e.target.value)}
            className="px-3 py-2 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-semibold focus:outline-hidden focus:border-[#37C6A3]"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => handleStatusSelect(e.target.value)}
            className="px-3 py-2 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-semibold focus:outline-hidden focus:border-[#37C6A3]"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="VOID">VOID</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[#F7F6F1] border-b border-[#E7E9EE] text-[#7C8A9A] uppercase tracking-wider text-[10px] font-bold">
              <th className="py-3 px-4 whitespace-nowrap">Date</th>
              <th className="py-3 px-4 whitespace-nowrap">Category</th>
              <th className="py-3 px-4 whitespace-nowrap">Description</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Amount ({currency})</th>
              <th className="py-3 px-4 whitespace-nowrap">Supplier</th>
              <th className="py-3 px-4 whitespace-nowrap">Reason / Notes</th>
              <th className="py-3 px-4 text-center whitespace-nowrap">Status</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7E9EE]">
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[#7C8A9A]">
                  <div className="max-w-xs mx-auto flex flex-col items-center">
                    <Info className="w-8 h-8 text-[#7C8A9A]/60 mb-2" />
                    <p className="font-semibold text-xs">No expenses found.</p>
                    <p className="text-[11px] text-[#7C8A9A] mt-0.5">
                      No records match the current filter criteria for {selectedMonth}.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              expenses.map((e) => {
                const isVoid = e.status === 'VOID';
                return (
                  <tr
                    key={e.id}
                    className={`hover:bg-slate-50/60 transition ${isVoid ? 'bg-rose-50/20 text-[#7C8A9A]' : ''}`}
                  >
                    <td className="py-3 px-4 font-mono whitespace-nowrap text-[#0F172A] font-semibold">
                      {e.expenseDate}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#0F172A] whitespace-nowrap">
                      {e.category?.name || 'Unassigned'}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate" title={e.description}>
                      <span className={isVoid ? 'line-through text-[#7C8A9A]' : 'text-[#0F172A] font-medium'}>
                        {e.description}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#0F172A] whitespace-nowrap">
                      <span className={isVoid ? 'line-through text-rose-400' : ''}>
                        {Number(e.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#7C8A9A] max-w-[120px] truncate" title={e.supplierName || ''}>
                      {e.supplierName || '-'}
                    </td>
                    <td className="py-3 px-4 text-[#7C8A9A] max-w-xs truncate" title={e.reasonNote || ''}>
                      {e.reasonNote || '-'}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {isVoid ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700"
                          title={`Void Reason: ${e.voidReason || 'No reason specified'}`}
                        >
                          VOID
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          ACTIVE
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {!isVoid && (
                          <>
                            <button
                              onClick={() => onEdit(e)}
                              className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#E7E9EE] rounded-lg transition cursor-pointer"
                              title="Edit Expense"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setVoidModalExpense(e);
                                setVoidReason('');
                                setVoidError(null);
                              }}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Void Expense"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {isVoid && e.voidReason && (
                          <span className="text-[10px] italic text-[#7C8A9A]" title={e.voidReason}>
                            Reason: {e.voidReason.substring(0, 20)}...
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-[#E7E9EE] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#7C8A9A]">
          <span>
            Showing page {page} of {totalPages} ({total} total records)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-[#E7E9EE] font-semibold hover:bg-[#F7F6F1] disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-[#E7E9EE] font-semibold hover:bg-[#F7F6F1] disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Void Confirmation Modal */}
      {voidModalExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-[#E7E9EE]">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">Void Expense Record</h3>
                <span className="text-xs text-[#7C8A9A]">This action will mark the record as VOID.</span>
              </div>
            </div>

            <p className="text-xs text-[#7C8A9A] mb-3 leading-relaxed">
              Voided records remain preserved in history for audit compliance, but will be excluded from all active totals,
              monthly comparisons, budget actuals, and reports.
            </p>

            <div className="p-3 bg-[#F7F6F1] rounded-xl mb-3 text-xs">
              <div className="font-bold text-[#0F172A]">{voidModalExpense.description}</div>
              <div className="text-[11px] text-[#7C8A9A]">
                {currency} {Number(voidModalExpense.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} &bull; {voidModalExpense.expenseDate}
              </div>
            </div>

            {voidError && (
              <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                {voidError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Void Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Duplicate entry; invoice cancelled by vendor"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                maxLength={500}
                className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#37C6A3] resize-none"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setVoidModalExpense(null)}
                className="px-4 py-2 rounded-xl border border-[#E7E9EE] text-xs font-semibold text-[#7C8A9A] hover:bg-[#F7F6F1] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={isVoiding || !voidReason.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                {isVoiding ? 'Voiding...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ExpenseHistoryTable;
