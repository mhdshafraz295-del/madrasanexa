import { useState, useEffect, useCallback } from 'react';
import {
  apiListSuperAdminSubmissions,
  apiApproveSubscriptionPayment,
  apiRejectSubscriptionPayment,
  apiGetSuperAdminReceiptUrl,
  type SubscriptionPaymentSubmissionItem,
  type SecureReceiptData,
} from '../../services/subscription-payment.service';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Loader2,
  FileText,
  ExternalLink,
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Receipt,
  X,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';

export default function SubscriptionPaymentsPage() {
  const [submissions, setSubmissions] = useState<SubscriptionPaymentSubmissionItem[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [activeReceipt, setActiveReceipt] = useState<{
    sub: SubscriptionPaymentSubmissionItem;
    secureData: SecureReceiptData;
  } | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);
  const [approveItem, setApproveItem] = useState<SubscriptionPaymentSubmissionItem | null>(null);
  const [rejectItem, setRejectItem] = useState<SubscriptionPaymentSubmissionItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((p) => ({ ...p, page: 1 }));
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchSubmissions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiListSuperAdminSubmissions({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter,
        search: debouncedSearch || undefined,
      });

      setSubmissions(res.data || []);
      if (res.pagination) {
        setPagination({
          page: res.pagination.page,
          limit: res.pagination.limit,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages,
        });
      }
      if (res.counts || res.kpis) {
        const c = res.counts || res.kpis;
        setCounts({
          pending: c?.pending ?? 0,
          approved: c?.approved ?? 0,
          rejected: c?.rejected ?? 0,
          total: c?.total ?? 0,
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load subscription payment submissions.');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRef(id);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const handleViewReceipt = async (sub: SubscriptionPaymentSubmissionItem) => {
    setLoadingReceiptId(sub.id);
    try {
      const secureData = await apiGetSuperAdminReceiptUrl(sub.id);
      setActiveReceipt({ sub, secureData });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to load authorized receipt URL.');
    } finally {
      setLoadingReceiptId(null);
    }
  };

  const handleConfirmApprove = async () => {
    if (!approveItem) return;
    setIsProcessing(true);
    try {
      await apiApproveSubscriptionPayment(approveItem.id);
      setApproveItem(null);
      await fetchSubmissions();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve subscription payment.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectItem || !rejectionReason.trim()) return;
    setIsProcessing(true);
    try {
      await apiRejectSubscriptionPayment(rejectItem.id, rejectionReason.trim());
      setRejectItem(null);
      setRejectionReason('');
      await fetchSubmissions();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reject subscription payment.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Subscription Payment Approvals</h1>
          <p className="text-xs text-[#7C8A9A] mt-1">
            Review offline bank transfer receipts, verify transaction references, and activate or extend Madrasa SaaS subscriptions.
          </p>
        </div>
        <button
          onClick={fetchSubmissions}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-[#E7E9EE] hover:bg-[#F7F6F1] text-xs font-semibold text-[#0F172A] rounded-xl transition shadow-xs cursor-pointer w-fit disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#7C8A9A] ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => { setStatusFilter('PENDING'); setPagination((p) => ({ ...p, page: 1 })); }}
          className={`p-5 rounded-2xl border transition cursor-pointer ${
            statusFilter === 'PENDING'
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20'
              : 'bg-white border-[#E7E9EE] hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pending Review</span>
            <span className="p-2 rounded-xl bg-amber-100/80 text-amber-800">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A] mt-2 font-mono">
            {counts.pending}
          </div>
          <p className="text-[11px] text-[#7C8A9A] mt-1">Receipts awaiting verification</p>
        </div>

        <div
          onClick={() => { setStatusFilter('APPROVED'); setPagination((p) => ({ ...p, page: 1 })); }}
          className={`p-5 rounded-2xl border transition cursor-pointer ${
            statusFilter === 'APPROVED'
              ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-400/20'
              : 'bg-white border-[#E7E9EE] hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Approved</span>
            <span className="p-2 rounded-xl bg-emerald-100/80 text-emerald-800">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A] mt-2 font-mono">
            {counts.approved}
          </div>
          <p className="text-[11px] text-[#7C8A9A] mt-1">Activated subscriptions</p>
        </div>

        <div
          onClick={() => { setStatusFilter('REJECTED'); setPagination((p) => ({ ...p, page: 1 })); }}
          className={`p-5 rounded-2xl border transition cursor-pointer ${
            statusFilter === 'REJECTED'
              ? 'bg-red-50/70 border-red-300 ring-2 ring-red-400/20'
              : 'bg-white border-[#E7E9EE] hover:border-red-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-800 uppercase tracking-wider">Rejected</span>
            <span className="p-2 rounded-xl bg-red-100/80 text-red-800">
              <XCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A] mt-2 font-mono">
            {counts.rejected}
          </div>
          <p className="text-[11px] text-[#7C8A9A] mt-1">Declined or invalid transfers</p>
        </div>

        <div
          onClick={() => { setStatusFilter('ALL'); setPagination((p) => ({ ...p, page: 1 })); }}
          className={`p-5 rounded-2xl border transition cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-[#F7F6F1] border-[#0F172A]/30 ring-2 ring-[#0F172A]/10'
              : 'bg-white border-[#E7E9EE] hover:border-[#7C8A9A]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#7C8A9A] uppercase tracking-wider">All Submissions</span>
            <span className="p-2 rounded-xl bg-gray-100 text-[#0F172A]">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A] mt-2 font-mono">
            {counts.total}
          </div>
          <p className="text-[11px] text-[#7C8A9A] mt-1">Total lifetime receipts</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#7C8A9A] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Madrasa name, code or reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9.5 pr-4 py-2 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs focus:ring-2 focus:ring-[#37C6A3] focus:border-transparent"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center bg-[#F7F6F1] p-1 rounded-xl border border-[#E7E9EE] self-stretch sm:self-auto overflow-x-auto">
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPagination((p) => ({ ...p, page: 1 })); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                statusFilter === s
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#7C8A9A] hover:text-[#0F172A]'
              }`}
            >
              {s === 'PENDING' && 'Pending'}
              {s === 'APPROVED' && 'Approved'}
              {s === 'REJECTED' && 'Rejected'}
              {s === 'ALL' && 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Submissions Table / Cards */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3]" />
            <p className="text-xs text-[#7C8A9A]">Loading payment submissions...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F7F6F1] flex items-center justify-center mx-auto text-[#7C8A9A]">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A]">No Payment Submissions Found</h3>
            <p className="text-xs text-[#7C8A9A] max-w-sm mx-auto">
              {statusFilter === 'PENDING'
                ? 'There are currently no pending subscription payments waiting for Super Admin review.'
                : 'No submissions matched your selected filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F6F1] text-[#7C8A9A] font-semibold uppercase tracking-wider border-b border-[#E7E9EE]">
                <tr>
                  <th className="px-5 py-3">Madrasa & Contact</th>
                  <th className="px-5 py-3">Selected Plan</th>
                  <th className="px-5 py-3">Amount & Date</th>
                  <th className="px-5 py-3">Bank Reference</th>
                  <th className="px-5 py-3">Receipt File</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9EE]">
                {submissions.map((sub) => {
                  const isPending = sub.status === 'PENDING';
                  const isApproved = sub.status === 'APPROVED';
                  const isRejected = sub.status === 'REJECTED';
                  const amountMismatch = sub.submittedAmount !== sub.plan.expectedPrice;

                  return (
                    <tr key={sub.id} className="hover:bg-[#F7F6F1]/50 transition">
                      {/* Madrasa */}
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[#0F172A]/5 text-[#0F172A] flex items-center justify-center shrink-0 mt-0.5">
                            <Building2 className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-bold text-[#0F172A]">{sub.madrasa.name}</div>
                            <div className="text-[10px] font-mono text-[#7C8A9A]">{sub.madrasa.code}</div>
                            {sub.madrasa.contactEmail && (
                              <div className="text-[11px] text-[#7C8A9A] mt-0.5">{sub.madrasa.contactEmail}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-[#0F172A]">{sub.plan.name}</div>
                        <div className="text-[11px] font-mono text-[#7C8A9A]">
                          Expected: LKR {sub.plan.expectedPrice.toLocaleString()} / {sub.plan.durationMonths} mo
                        </div>
                      </td>

                      {/* Amount & Date */}
                      <td className="px-5 py-4">
                        <div className={`font-mono font-bold text-sm ${amountMismatch ? 'text-amber-700' : 'text-emerald-700'}`}>
                          LKR {sub.submittedAmount.toLocaleString()}
                        </div>
                        {amountMismatch && (
                          <div className="text-[10px] text-amber-700 font-semibold flex items-center gap-1 mt-0.5">
                            <AlertCircle className="w-3 h-3" />
                            <span>Amount Mismatch</span>
                          </div>
                        )}
                        <div className="text-[10px] text-[#7C8A9A] mt-0.5 font-mono">
                          Paid: {new Date(sub.paymentDate).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Bank Reference */}
                      <td className="px-5 py-4">
                        {sub.reference ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F7F6F1] border border-[#E7E9EE] rounded-lg">
                            <span className="font-mono text-xs text-[#0F172A]">{sub.reference}</span>
                            <button
                              onClick={() => handleCopy(sub.reference!, sub.id)}
                              className="text-[#7C8A9A] hover:text-[#0F172A] cursor-pointer"
                              title="Copy Reference"
                            >
                              {copiedRef === sub.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[#7C8A9A] italic text-xs">No reference</span>
                        )}
                        {sub.notes && (
                          <div className="text-[10px] text-[#7C8A9A] mt-1 max-w-xs truncate" title={sub.notes}>
                            Note: {sub.notes}
                          </div>
                        )}
                      </td>

                      {/* Receipt File */}
                      <td className="px-5 py-4">
                        {sub.receipt ? (
                          <button
                            onClick={() => handleViewReceipt(sub)}
                            disabled={loadingReceiptId === sub.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#37C6A3]/10 hover:bg-[#37C6A3]/20 text-[#0F172A] rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                          >
                            {loadingReceiptId === sub.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#37C6A3]" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-[#37C6A3]" />
                            )}
                            <span>View Receipt</span>
                          </button>
                        ) : (
                          <span className="text-[#7C8A9A] text-xs">No file</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </span>
                        )}
                        {isApproved && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Approved</span>
                            </span>
                            {sub.reviewedBy && (
                              <div className="text-[10px] text-[#7C8A9A]">By: {sub.reviewedBy.name}</div>
                            )}
                          </div>
                        )}
                        {isRejected && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-900 border border-red-300">
                              <XCircle className="w-3 h-3" />
                              <span>Rejected</span>
                            </span>
                            {sub.rejectionReason && (
                              <div className="text-[10px] text-red-700 max-w-xs truncate" title={sub.rejectionReason}>
                                {sub.rejectionReason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setApproveItem(sub)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#37C6A3] hover:bg-[#2fa88a] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => { setRejectItem(sub); setRejectionReason(''); }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#7C8A9A] font-mono">
                            {sub.reviewedAt ? new Date(sub.reviewedAt).toLocaleDateString() : 'Processed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-[#E7E9EE] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAFAF8] text-xs">
            <span className="text-[#7C8A9A]">
              Showing page <span className="font-semibold text-[#0F172A]">{pagination.page}</span> of{' '}
              <span className="font-semibold text-[#0F172A]">{pagination.totalPages}</span> ({pagination.total} total items)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={pagination.page <= 1 || isLoading}
                className="px-3 py-1.5 bg-white border border-[#E7E9EE] rounded-lg font-semibold text-[#0F172A] disabled:opacity-50 hover:bg-[#F7F6F1] cursor-pointer inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: Math.min(pagination.totalPages, p.page + 1) }))}
                disabled={pagination.page >= pagination.totalPages || isLoading}
                className="px-3 py-1.5 bg-white border border-[#E7E9EE] rounded-lg font-semibold text-[#0F172A] disabled:opacity-50 hover:bg-[#F7F6F1] cursor-pointer inline-flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Receipt Review Modal */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-[#E7E9EE] flex items-center justify-between bg-[#FAFAF8]">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">Payment Receipt Preview</h3>
                <p className="text-[11px] text-[#7C8A9A] mt-0.5">
                  {activeReceipt.sub.madrasa.name} &bull; LKR {activeReceipt.sub.submittedAmount.toLocaleString()}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-[#37C6A3] font-semibold mt-0.5">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Authorized Temporary Access (Expires in 15 mins)</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeReceipt.secureData.url && (
                  <a
                    href={activeReceipt.secureData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#E7E9EE] rounded-xl transition cursor-pointer"
                    title="Open original in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => setActiveReceipt(null)}
                  className="p-2 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#E7E9EE] rounded-xl transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-[#F7F6F1] flex flex-col items-center justify-center min-h-[300px]">
              {activeReceipt.secureData.url ? (
                activeReceipt.secureData.mimeType.includes('pdf') ? (
                  <div className="text-center space-y-4 p-8 bg-white rounded-2xl border border-[#E7E9EE] shadow-xs">
                    <FileText className="w-16 h-16 text-red-500 mx-auto" />
                    <div>
                      <div className="font-bold text-[#0F172A] text-sm">{activeReceipt.secureData.originalName}</div>
                      <div className="text-xs text-[#7C8A9A] mt-1 font-mono">{formatFileSize(activeReceipt.secureData.size)} &bull; PDF Document</div>
                    </div>
                    <a
                      href={activeReceipt.secureData.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl text-xs font-semibold shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open PDF in New Window</span>
                    </a>
                  </div>
                ) : (
                  <img
                    src={activeReceipt.secureData.url}
                    alt="Receipt"
                    className="max-h-[60vh] max-w-full rounded-xl object-contain border border-[#E7E9EE] shadow-md bg-white"
                  />
                )
              ) : (
                <div className="text-xs text-[#7C8A9A]">Receipt file not available.</div>
              )}
            </div>

            <div className="p-4 border-t border-[#E7E9EE] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-[#7C8A9A] min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>Ref: <strong className="text-[#0F172A]">{activeReceipt.sub.reference || 'N/A'}</strong></span>
                <span>&bull;</span>
                <span className="truncate max-w-full">File: {activeReceipt.secureData.originalName}</span>
              </div>
              <button
                onClick={() => setActiveReceipt(null)}
                className="px-4 py-2 bg-[#F7F6F1] text-[#0F172A] hover:bg-[#E7E9EE] rounded-xl font-semibold cursor-pointer shrink-0 self-end sm:self-auto"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Confirmation Modal */}
      {approveItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-[#0F172A]">Confirm Subscription Payment Approval</h3>
              <p className="text-xs text-[#7C8A9A] mt-1">
                Are you sure you want to approve this payment receipt? Approving will activate or extend the subscription for:
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE] text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[#7C8A9A]">Madrasa:</span>
                <span className="font-bold text-[#0F172A]">{approveItem.madrasa.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7C8A9A]">Plan:</span>
                <span className="font-semibold text-[#0F172A]">{approveItem.plan.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7C8A9A]">Submitted Amount:</span>
                <span className="font-bold font-mono text-emerald-700">LKR {approveItem.submittedAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7C8A9A]">Reference:</span>
                <span className="font-mono text-[#0F172A]">{approveItem.reference || 'None'}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApproveItem(null)}
                disabled={isProcessing}
                className="px-4 py-2 bg-[#F7F6F1] text-[#0F172A] hover:bg-[#E7E9EE] rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={isProcessing}
                className="px-4 py-2 bg-[#37C6A3] hover:bg-[#2fa88a] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Confirm & Activate</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-[#0F172A]">Reject Payment Receipt</h3>
              <p className="text-xs text-[#7C8A9A] mt-1">
                Please provide a clear reason for rejecting this payment submission. The reason will be sent to the Madrasa Administrator.
              </p>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Bank reference not found in statement, incorrect transferred amount, or blurry receipt file..."
                  className="w-full px-3 py-2 rounded-xl border border-[#E7E9EE] text-xs focus:ring-2 focus:ring-red-300 focus:border-red-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7E9EE]">
                <button
                  type="button"
                  onClick={() => setRejectItem(null)}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-[#F7F6F1] text-[#0F172A] hover:bg-[#E7E9EE] rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || rejectionReason.trim().length < 3}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
