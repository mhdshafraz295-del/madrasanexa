import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Banknote,
  Search,
  Eye,
  Ban,
  AlertCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  Coins,
  CreditCard,
  Building,
  RotateCcw,
} from 'lucide-react';
import {
  apiListPayments,
  apiVoidPayment,
  type PaymentListItem,
  type PaymentSummaryKpi,
} from '../../services/api';

export default function PaymentsPage() {
  const navigate = useNavigate();

  // Query & pagination state
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Data state
  const [payments, setPayments] = useState<PaymentListItem[]>([]);
  const [summary, setSummary] = useState<PaymentSummaryKpi | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Void modal state
  const [voidModalPayment, setVoidModalPayment] = useState<PaymentListItem | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await apiListPayments({
        page,
        pageSize,
        search: search.trim() || undefined,
        paymentMethod: paymentMethod || undefined,
        status: status || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      setPayments(data.items);
      setSummary(data.summary);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.total);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to load payments.');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, paymentMethod, status, startDate, endDate]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPayments();
  };

  const handleClearFilters = () => {
    setSearch('');
    setPaymentMethod('');
    setStatus('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleOpenVoidModal = (p: PaymentListItem) => {
    setVoidModalPayment(p);
    setVoidReason('');
    setVoidError(null);
  };

  const handleConfirmVoid = async () => {
    if (!voidModalPayment) return;
    if (!voidReason.trim() || voidReason.trim().length < 3) {
      setVoidError('Please provide a reason of at least 3 characters.');
      return;
    }

    setIsVoiding(true);
    setVoidError(null);

    try {
      await apiVoidPayment(voidModalPayment.id, voidReason.trim());
      setVoidModalPayment(null);
      await fetchPayments();
    } catch (err: any) {
      setVoidError(err.response?.data?.message || 'Failed to void payment.');
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#0F172A]">Payment History & Collections</h1>
              <p className="text-sm text-[#5B6B7F]">Audit trail of fee payments, receipts, and allocations.</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/madrasa-admin/fee-pos')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#08483A] hover:bg-[#073d31] text-white font-semibold rounded-xl transition shadow-xs self-start sm:self-auto"
        >
          <Coins className="w-4 h-4" />
          <span>New Collection (POS)</span>
        </button>
      </div>

      {/* KPI Cards (Mandatory Correction 16: Completed only, void separate) */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white border border-[#E7E9EE] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold text-[#5B6B7F]">
              <Coins className="w-4 h-4 text-emerald-700" />
              <span>Total Collected</span>
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-black text-[#08483A]">
              LKR {Number(summary.totalCollected).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-[#7C8A9A] mt-0.5">{summary.completedCount} active payments</p>
          </div>

          <div className="bg-white border border-[#E7E9EE] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold text-[#5B6B7F]">
              <Banknote className="w-4 h-4 text-emerald-600" />
              <span>Cash</span>
            </div>
            <div className="mt-2 text-lg sm:text-xl font-bold text-[#0F172A]">
              LKR {Number(summary.cashCollected).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-[#7C8A9A] mt-0.5">Direct cash inflows</p>
          </div>

          <div className="bg-white border border-[#E7E9EE] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold text-[#5B6B7F]">
              <Building className="w-4 h-4 text-blue-600" />
              <span>Bank Transfer</span>
            </div>
            <div className="mt-2 text-lg sm:text-xl font-bold text-[#0F172A]">
              LKR {Number(summary.bankTransferCollected).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-[#7C8A9A] mt-0.5">Deposits & online</p>
          </div>

          <div className="bg-white border border-[#E7E9EE] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold text-[#5B6B7F]">
              <CreditCard className="w-4 h-4 text-purple-600" />
              <span>Card / Other</span>
            </div>
            <div className="mt-2 text-lg sm:text-xl font-bold text-[#0F172A]">
              LKR {(Number(summary.cardCollected) + Number(summary.otherCollected)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-[#7C8A9A] mt-0.5">Cards & other methods</p>
          </div>

          <div className="bg-white border border-rose-100 rounded-2xl p-4 shadow-xs bg-rose-50/30">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-700">
              <Ban className="w-4 h-4 text-rose-600" />
              <span>Voided Payments</span>
            </div>
            <div className="mt-2 text-lg sm:text-xl font-bold text-rose-700">
              {summary.voidedCount}
            </div>
            <p className="text-[11px] text-rose-600/80 mt-0.5">
              LKR {Number(summary.voidedAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} reverted
            </p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-[#E7E9EE] rounded-2xl p-4 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7C8A9A]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Payment #, Receipt #, or Student..."
              className="w-full pl-9 pr-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#08483A]"
            />
          </div>

          <div>
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#08483A]"
            >
              <option value="">All Payment Methods</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#08483A]"
            >
              <option value="">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="VOID">Void</option>
            </select>
          </div>

          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#08483A]"
              title="From Date"
            />
          </div>

          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#08483A]"
              title="To Date"
            />
          </div>
        </form>

        {(search || paymentMethod || status || startDate || endDate) && (
          <div className="flex items-center justify-between pt-2 border-t border-[#E7E9EE] text-xs">
            <span className="text-[#5B6B7F]">Filters active</span>
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:text-emerald-950 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-white border border-[#E7E9EE] rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-[#5B6B7F]">
            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm">Loading payments...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center text-[#5B6B7F] space-y-2">
            <Coins className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-base font-bold text-[#0F172A]">No Payments Found</p>
            <p className="text-xs text-[#7C8A9A]">No payment transactions match the active filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E7E9EE] bg-[#F8F9FA] text-xs font-bold text-[#7C8A9A] uppercase tracking-wider whitespace-nowrap">
                  <th className="py-3 px-4">Payment #</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Amount (LKR)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9EE] text-sm">
                {payments.map((p) => {
                  const isVoid = p.status === 'VOID';
                  return (
                    <tr key={p.id} className={`transition ${isVoid ? 'bg-red-50/30' : 'hover:bg-gray-50/60'}`}>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#0F172A]">
                        <Link
                          to={`/madrasa-admin/payments/${p.id}`}
                          className="hover:text-emerald-700 hover:underline"
                        >
                          {p.paymentNo}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#0F172A]">{p.student.fullName}</div>
                        <div className="text-xs text-[#5B6B7F]">
                          <span className="font-mono">{p.student.admissionNo}</span>
                          {p.student.currentClass && ` • ${p.student.currentClass.name}`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {p.receipt ? (
                          <Link
                            to={`/madrasa-admin/receipts/${p.receipt.id}`}
                            className="font-mono text-xs font-bold text-emerald-800 hover:underline inline-flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{p.receipt.receiptNo}</span>
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-800">
                          {p.paymentMethod.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#5B6B7F]">
                        {new Date(p.paidAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black">
                        <span className={isVoid ? 'line-through text-gray-400' : 'text-[#0F172A]'}>
                          {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isVoid ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200"
                            title={p.voidMetadata?.voidReason || 'Voided'}
                          >
                            <Ban className="w-3 h-3" /> VOID
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            COMPLETED
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                        <Link
                          to={`/madrasa-admin/payments/${p.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#08483A] hover:text-[#073d31] p-1 rounded hover:bg-emerald-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </Link>

                        {!isVoid && (
                          <button
                            onClick={() => handleOpenVoidModal(p)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Void</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[#E7E9EE] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5B6B7F]">
            <div>
              Showing page <span className="font-bold text-[#0F172A]">{page}</span> of{' '}
              <span className="font-bold text-[#0F172A]">{totalPages}</span> ({totalCount} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-[#E7E9EE] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-[#E7E9EE] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Void Modal */}
      {voidModalPayment && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl border border-[#E7E9EE]">
            <div className="flex items-center gap-2 text-red-600 font-bold">
              <Ban className="w-5 h-5" />
              <h3 className="text-lg">Void Payment {voidModalPayment.paymentNo}</h3>
            </div>

            <p className="text-xs text-[#5B6B7F]">
              Voiding will reverse all allocated amounts, restore the student's unpaid invoice balances, and invalidate the official receipt.
            </p>

            {voidError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                {voidError}
              </div>
            )}

            <div className="bg-[#F8F9FA] rounded-xl p-3 border border-[#E7E9EE] text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#5B6B7F]">Student:</span>
                <span className="font-bold text-[#0F172A]">{voidModalPayment.student.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6B7F]">Amount to Revert:</span>
                <span className="font-bold text-red-600">LKR {Number(voidModalPayment.amount).toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#0F172A]">Reason for Voiding *</label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Duplicate entry, check returned, payment recorded in error..."
                rows={3}
                className="w-full px-3 py-2 text-sm bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setVoidModalPayment(null)}
                disabled={isVoiding}
                className="flex-1 py-2 px-4 border border-[#E7E9EE] font-semibold text-gray-700 rounded-xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVoid}
                disabled={isVoiding}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 font-semibold text-white rounded-xl transition flex items-center justify-center gap-2"
              >
                {isVoiding ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Confirm Void</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
