import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  CreditCard,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Building2,
  Calendar,
  FileText,
  X,
  ChevronRight,
  Info,
  ArrowRight,
  Receipt,
  Download,
} from 'lucide-react';
import { paymentHistoryApi } from '../../services/api';
import type {
  PaymentHistoryRecord,
} from '../../mock/teacherMockData';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';

type StatusFilter = 'All' | 'Paid' | 'Processing' | 'Pending';

export default function PaymentHistoryPage() {
  const [payments, setPayments] = useState<PaymentHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [yearFilter, setYearFilter] = useState('2026');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaymentModal, setSelectedPaymentModal] = useState<PaymentHistoryRecord | null>(null);

  const loadPaymentHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await paymentHistoryApi.getPaymentHistory(1, 50);
      setPayments((res.data as PaymentHistoryRecord[]) || []);
    } catch (err: any) {
      setPayments([]);
      setError(err?.message || 'Failed to load live payment history from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaymentHistory();
  }, []);

  const formatLKR = (amount: number) => {
    return `Rs. ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const filteredPayments = payments.filter((p) => {
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    const matchesYear = yearFilter === 'All' || (p.monthCode && p.monthCode.startsWith(yearFilter));
    const matchesSearch =
      (p.month && p.month.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.paymentReference && p.paymentReference.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.transactionId && p.transactionId.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesYear && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0D9488] uppercase tracking-wider mb-1">
            <CreditCard className="w-4 h-4" />
            <span>Salary Disbursement Archive</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Faculty Payment History
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete transaction ledger of all monthly salary disbursements, bank deposit slips, and pending remittances
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <NavLink
            to="/salary/payslips"
            className="px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
          >
            <FileText className="w-3.5 h-3.5 text-[#37C6A3]" />
            <span>Official Payslips</span>
          </NavLink>
        </div>
      </div>

      {/* Sample Data Disclaimer Banner */}
      <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-amber-950">
        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Prototype Sample Data Notice:</span> All historical disbursement records, transaction references, and settlement dates below are illustrative sample fixtures. No genuine bank account deposits or transactions have occurred.
        </div>
      </div>

      {/* 2. Multi-Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#0D9488]" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Filter Payments Ledger
            </span>
          </div>

          {(statusFilter !== 'All' || yearFilter !== '2026' || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('All');
                setYearFilter('2026');
                setSearchQuery('');
              }}
              className="text-xs font-semibold text-[#0D9488] hover:underline self-start sm:self-auto cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Status Filter Pills */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Payment Status</label>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              {(['All', 'Paid', 'Processing', 'Pending'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex-1 ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Year Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Fiscal Year</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            >
              <option value="All">All Years</option>
              <option value="2026">2026 (Current Academic Year)</option>
              <option value="2025">2025 (Previous Year)</option>
            </select>
          </div>

          {/* Keyword Search */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Search Payment</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Reference or month..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Payment History Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Disbursement Transactions ({filteredPayments.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any disbursement row to view full bank transaction particulars
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-8">
            <LoadingState message="Loading disbursement transactions..." />
          </div>
        ) : error && payments.length === 0 ? (
          <div className="py-8">
            <ErrorState message={error} onRetry={loadPaymentHistory} />
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-8">
            <EmptyState
              title="No Payment Records Found"
              description="No disbursement transactions match your selected filter criteria."
            />
          </div>
        ) : (
          <div className="overflow-x-auto mt-4 -mx-5 sm:mx-0">
            <table className="w-full text-left border-collapse min-w-[760px] text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Payment Month</th>
                  <th className="py-3 px-4">Gross Earnings</th>
                  <th className="py-3 px-4">Deductions</th>
                  <th className="py-3 px-4">Net Remittance</th>
                  <th className="py-3 px-4">Disbursement Date</th>
                  <th className="py-3 px-4">Payment Reference</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>{p.month}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.paymentMethod}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                      {formatLKR(p.grossSalary)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-rose-700 font-medium">
                      - {formatLKR(p.deductions)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-sm">
                      {formatLKR(p.netSalary)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {p.paymentDate}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                      <div>{p.paymentReference}</div>
                      <div className="text-[10px] text-slate-400">{p.transactionId}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'Paid'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : p.status === 'Processing'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentModal(p)}
                        className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Payment Details Modal */}
      {selectedPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0D9488]">
                  Payment Voucher Particulars
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedPaymentModal.month} Salary Disbursement
                </h3>
              </div>
              <button
                onClick={() => setSelectedPaymentModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 py-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Reference:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedPaymentModal.paymentReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction ID:</span>
                  <span className="font-mono text-slate-700">{selectedPaymentModal.transactionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Disbursement Channel:</span>
                  <span className="text-slate-700">{selectedPaymentModal.disbursementChannel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Destination Account:</span>
                  <span className="text-slate-700">{selectedPaymentModal.bankSummary}</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Gross Contract Earnings:</span>
                  <span className="font-mono font-semibold text-slate-900">{formatLKR(selectedPaymentModal.grossSalary)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Total Deductions (EPF/Welfare):</span>
                  <span className="font-mono font-semibold text-rose-700">- {formatLKR(selectedPaymentModal.deductions)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 text-sm font-bold">
                  <span className="text-[#0D9488]">Net Remitted Pay:</span>
                  <span className="font-mono text-slate-900">{formatLKR(selectedPaymentModal.netSalary)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <NavLink
                to="/salary/payslips"
                className="text-xs font-bold text-[#0D9488] hover:underline flex items-center gap-1"
              >
                <span>View Full Payslip</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </NavLink>
              <button
                type="button"
                onClick={() => setSelectedPaymentModal(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
