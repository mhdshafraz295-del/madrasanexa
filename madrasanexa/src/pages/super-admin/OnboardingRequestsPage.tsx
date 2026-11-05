import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  apiListOnboardings,
  apiGetOnboardingById,
  apiApproveOnboarding,
  apiRejectOnboarding,
  apiResendApprovalEmail,
  apiListPlans,
  type OnboardingRequestItem,
  type OnboardingKpiData,
  type OnboardingEmailStatus,
  type PlanItem,
  type ApproveOnboardingResult,
} from '../../services/api';
import {
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Check,
  X,
  Copy,
  AlertTriangle,
  Loader2,
  Building2,
  Clock,
  Send,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function OnboardingRequestsPage() {
  const [searchParams] = useSearchParams();
  const [requests, setRequests] = useState<OnboardingRequestItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 10, totalPages: 1 });
  const [kpi, setKpi] = useState<OnboardingKpiData>({ pending: 0, approved: 0, rejected: 0, activeMadrasas: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [emailFilter, setEmailFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [plans, setPlans] = useState<PlanItem[]>([]);

  // Modals and Drawer state
  const [viewRequest, setViewRequest] = useState<OnboardingRequestItem | null>(null);
  const [approveRequest, setApproveRequest] = useState<OnboardingRequestItem | null>(null);
  const [rejectRequest, setRejectRequest] = useState<OnboardingRequestItem | null>(null);
  const [provisionedResult, setProvisionedResult] = useState<ApproveOnboardingResult | null>(null);

  // Approval Form State
  const [approvalForm, setApprovalForm] = useState({
    madrasaCode: '',
    madrasaSlug: '',
    planId: '',
    adminName: '',
    adminEmail: '',
    temporaryPassword: '',
    paymentMethod: 'BANK_TRANSFER' as 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER',
    paymentReference: '',
    paymentNotes: '',
    recordInitialPayment: true,
  });
  const [isApproving, setIsApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvalNotice, setApprovalNotice] = useState<{ type: 'success' | 'warning'; message: string } | null>(null);

  // Rejection Form State
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Resend Email State
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Copy state
  const [copied, setCopied] = useState(false);

  const fetchRequests = useCallback(async (pageToLoad = pagination.page) => {
    setIsLoading(true);
    try {
      const res = await apiListOnboardings({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: search.trim() || undefined,
        page: pageToLoad,
        pageSize: pagination.pageSize,
      });

      let filtered = res.requests;
      if (emailFilter !== 'ALL') {
        filtered = filtered.filter((r) => (r.emailStatus || 'NOT_SENT') === emailFilter);
      }

      setRequests(filtered);
      setPagination(res.pagination);
      if (res.kpi) {
        setKpi(res.kpi);
      }
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search, pagination.pageSize, pagination.page, emailFilter]);

  const fetchPlans = async () => {
    try {
      const res = await apiListPlans();
      const activePlans = res.filter((p) => p.isActive);
      setPlans(activePlans);
      if (activePlans.length > 0 && !approvalForm.planId) {
        setApprovalForm((prev) => ({ ...prev, planId: activePlans[0].id }));
      }
    } catch (err) {
      console.error('Failed to load plans:', err);
    }
  };

  useEffect(() => {
    fetchRequests(1);
    fetchPlans();
  }, [statusFilter, emailFilter]);

  // Handle URL query parameter ?select=ID
  useEffect(() => {
    const selectId = searchParams.get('select');
    if (selectId && requests.length > 0) {
      const match = requests.find((r) => r.id === selectId);
      if (match) {
        handleOpenDetail(match.id);
      }
    }
  }, [searchParams, requests]);

  const handleOpenDetail = async (id: string) => {
    try {
      const detail = await apiGetOnboardingById(id);
      setViewRequest(detail);
    } catch (err) {
      console.error('Failed to fetch request detail:', err);
    }
  };

  const handleOpenApproveModal = (req: OnboardingRequestItem) => {
    const cleaned = req.madrasaName.replace(/[^a-zA-Z0-9]/g, '');
    const code = cleaned.slice(0, 8).toUpperCase() || 'MDRS01';
    const slug = req.madrasaName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'madrasa';

    setApprovalForm({
      madrasaCode: code,
      madrasaSlug: slug,
      planId: plans.length > 0 ? plans[0].id : '',
      adminName: req.contactName,
      adminEmail: req.email,
      temporaryPassword: '',
      paymentMethod: 'BANK_TRANSFER',
      paymentReference: '',
      paymentNotes: '',
      recordInitialPayment: true,
    });
    setApprovalError(null);
    setApproveRequest(req);
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveRequest) return;

    setIsApproving(true);
    setApprovalError(null);

    try {
      const result = await apiApproveOnboarding(approveRequest.id, {
        madrasaCode: approvalForm.madrasaCode,
        madrasaSlug: approvalForm.madrasaSlug,
        planId: approvalForm.planId,
        adminName: approvalForm.adminName,
        adminEmail: approvalForm.adminEmail,
        temporaryPassword: approvalForm.temporaryPassword || undefined,
        paymentMethod: approvalForm.paymentMethod,
        paymentReference: approvalForm.paymentReference || undefined,
        paymentNotes: approvalForm.paymentNotes || undefined,
        recordInitialPayment: approvalForm.recordInitialPayment,
      });

      setApproveRequest(null);
      setProvisionedResult(result);

      // Handle partial success feedback
      if (result.emailDelivery?.status === 'SENT') {
        setApprovalNotice({
          type: 'success',
          message: `Madrasa workspace approved successfully. Automatic approval email delivered to ${result.adminUser.email}.`,
        });
      } else {
        setApprovalNotice({
          type: 'warning',
          message: `Madrasa workspace approved successfully, but the approval email could not be delivered (${result.emailDelivery?.error || 'provider unconfigured'}).`,
        });
      }

      fetchRequests();
    } catch (err: any) {
      setApprovalError(err.response?.data?.message || err.message || 'Approval failed');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectRequest) return;

    if (!rejectionReason.trim() || rejectionReason.trim().length < 3) {
      setRejectError('Please provide a rejection reason of at least 3 characters.');
      return;
    }

    setIsRejecting(true);
    setRejectError(null);

    try {
      await apiRejectOnboarding(rejectRequest.id, rejectionReason.trim());
      setRejectRequest(null);
      setRejectionReason('');
      fetchRequests();
    } catch (err: any) {
      setRejectError(err.response?.data?.message || err.message || 'Rejection failed');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleResendEmail = async (req: OnboardingRequestItem) => {
    setResendingId(req.id);
    setResendNotice(null);

    try {
      const res = await apiResendApprovalEmail(req.id);
      if (res.data?.emailDelivery?.status === 'SENT') {
        setResendNotice({
          type: 'success',
          message: `Approval email resent successfully to ${req.email}.`,
        });
      } else {
        setResendNotice({
          type: 'error',
          message: `Email delivery attempted, but provider returned: ${res.data?.emailDelivery?.error || 'unconfigured'}.`,
        });
      }
      fetchRequests();
    } catch (err: any) {
      setResendNotice({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to resend approval email.',
      });
    } finally {
      setResendingId(null);
    }
  };

  const copyCredentials = () => {
    if (!provisionedResult?.adminUser) return;
    const text =
      `MadrasaNexa Administrator Credentials\n` +
      `Institution: ${provisionedResult.madrasa.name} (${provisionedResult.madrasa.code})\n` +
      `Admin Email: ${provisionedResult.adminUser.email}\n` +
      `Temporary Password: ${provisionedResult.adminUser.temporaryPassword}\n` +
      `Login URL: ${window.location.origin}/login\n\n` +
      `Note: You will be required to change your password immediately upon first sign-in.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const renderEmailStatusBadge = (status?: OnboardingEmailStatus) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Sent</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-3 h-3 text-red-600" />
            <span>Failed</span>
          </span>
        );
      case 'NOT_CONFIGURED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>Not Configured</span>
          </span>
        );
      case 'NOT_SENT':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Not Sent</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Registration Approval Center</h1>
          <p className="text-xs text-[#7C8A9A] mt-1">
            Review, approve and manage Madrasa registration requests.
          </p>
        </div>
      </div>

      {/* Dynamic Feedback Notices */}
      {approvalNotice && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in ${
            approvalNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {approvalNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            )}
            <span>{approvalNotice.message}</span>
          </div>
          <button
            onClick={() => setApprovalNotice(null)}
            className="p-1 hover:bg-black/5 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {resendNotice && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in ${
            resendNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {resendNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span>{resendNotice.message}</span>
          </div>
          <button
            onClick={() => setResendNotice(null)}
            className="p-1 hover:bg-black/5 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Dynamic KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[#7C8A9A]">Pending Requests</span>
            <div className="text-2xl font-bold text-[#0F172A] mt-1">{kpi.pending}</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[#7C8A9A]">Approved Requests</span>
            <div className="text-2xl font-bold text-[#0F172A] mt-1">{kpi.approved}</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[#7C8A9A]">Rejected Requests</span>
            <div className="text-2xl font-bold text-[#0F172A] mt-1">{kpi.rejected}</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[#7C8A9A]">Active Madrasas</span>
            <div className="text-2xl font-bold text-[#0F172A] mt-1">{kpi.activeMadrasas}</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F7F6F1] rounded-xl">
          {[
            { key: 'PENDING', label: 'Pending', count: kpi.pending },
            { key: 'APPROVED', label: 'Approved', count: kpi.approved },
            { key: 'REJECTED', label: 'Rejected', count: kpi.rejected },
            { key: 'ALL', label: 'All', count: kpi.pending + kpi.approved + kpi.rejected },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                statusFilter === tab.key
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#7C8A9A] hover:text-[#0F172A]'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#E7E9EE] text-[#0F172A] font-bold">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Email Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <select
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-[#E7E9EE] bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
          >
            <option value="ALL">All Email States</option>
            <option value="SENT">Email: Sent</option>
            <option value="FAILED">Email: Failed</option>
            <option value="NOT_CONFIGURED">Email: Not Configured</option>
            <option value="NOT_SENT">Email: Not Sent</option>
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#7C8A9A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchRequests(1)}
              placeholder="Search institute, contact, email..."
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-[#E7E9EE] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 focus:border-[#37C6A3] transition"
            />
          </div>
        </div>
      </div>

      {/* Content Area: Desktop Table & Mobile Cards */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-[#37C6A3]" />
            <p className="text-xs text-[#7C8A9A]">Loading registration requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <Building2 className="w-10 h-10 text-[#7C8A9A]/40 mx-auto" />
            <div className="text-sm font-semibold text-[#0F172A]">
              {statusFilter === 'PENDING'
                ? "You're all caught up. No pending registration requests."
                : 'No registration requests found matching current filters.'}
            </div>
            <p className="text-xs text-[#7C8A9A]">Try clearing search or adjusting your status filters.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table (Hidden on Mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F6F1] text-[#7C8A9A] font-semibold border-b border-[#E7E9EE]">
                  <tr>
                    <th className="px-5 py-3.5">Institution</th>
                    <th className="px-5 py-3.5">Applicant</th>
                    <th className="px-5 py-3.5">Contact</th>
                    <th className="px-5 py-3.5">Submitted</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Plan</th>
                    <th className="px-5 py-3.5">Email Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E9EE]">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-[#F7F6F1]/50 transition">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-[#0F172A]">{req.madrasaName}</div>
                        {req.district && <div className="text-[10px] text-[#7C8A9A]">{req.district}</div>}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-[#0F172A]">{req.contactName}</td>
                      <td className="px-5 py-3.5 text-[#7C8A9A]">
                        <div className="font-mono text-[11px] text-[#0F172A]">{req.email}</div>
                        <div className="text-[10px]">{req.phone}</div>
                      </td>
                      <td className="px-5 py-3.5 text-[#7C8A9A] whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === 'PENDING'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : req.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-red-50 text-red-800 border border-red-200'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {req.planName ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#F7F6F1] border border-[#E7E9EE] text-[#0F172A] font-semibold text-[11px]">
                            {req.planName}
                          </span>
                        ) : (
                          <span className="text-[#7C8A9A] text-[11px]">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">{renderEmailStatusBadge(req.emailStatus)}</td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-1.5">
                        <button
                          onClick={() => handleOpenDetail(req.id)}
                          className="p-1.5 hover:bg-[#E7E9EE] text-[#7C8A9A] hover:text-[#0F172A] rounded-lg transition cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {req.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleOpenApproveModal(req)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs"
                              title="Approve Application"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => {
                                setRejectRequest(req);
                                setRejectionReason('');
                                setRejectError(null);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                              title="Reject Application"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}

                        {req.status === 'APPROVED' && (
                          <div className="inline-flex items-center gap-1.5">
                            {req.approvedMadrasaId && (
                              <Link
                                to={`/super-admin/madrasas/${req.approvedMadrasaId}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#0F172A] text-white hover:bg-slate-800 rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs"
                                title="View Madrasa Institution"
                              >
                                <Building2 className="w-3.5 h-3.5 text-[#37C6A3]" />
                                <span>View Madrasa</span>
                              </Link>
                            )}
                            <button
                              onClick={() => handleResendEmail(req)}
                              disabled={resendingId === req.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#F7F6F1] hover:bg-[#E7E9EE] text-[#0F172A] border border-[#E7E9EE] rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                              title="Resend Approval Email"
                            >
                              {resendingId === req.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#37C6A3]" />
                              ) : (
                                <Send className="w-3.5 h-3.5 text-[#37C6A3]" />
                              )}
                              <span>Resend Email</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Request Cards (Visible on Mobile only) */}
            <div className="md:hidden divide-y divide-[#E7E9EE]">
              {requests.map((req) => (
                <div key={req.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-[#0F172A]">{req.madrasaName}</h4>
                      <p className="text-xs text-[#7C8A9A] mt-0.5">{req.contactName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          req.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : req.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                      >
                        {req.status}
                      </span>
                      {renderEmailStatusBadge(req.emailStatus)}
                    </div>
                  </div>

                  <div className="text-xs text-[#7C8A9A] space-y-1 bg-[#F7F6F1] p-3 rounded-xl">
                    <div className="flex justify-between">
                      <span>Email:</span>
                      <span className="font-mono text-[#0F172A] font-medium">{req.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Phone:</span>
                      <span className="text-[#0F172A] font-medium">{req.phone}</span>
                    </div>
                    {req.planName && (
                      <div className="flex justify-between">
                        <span>Plan:</span>
                        <span className="font-semibold text-[#0F172A]">{req.planName}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Submitted:</span>
                      <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Mobile Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleOpenDetail(req.id)}
                      className="flex-1 py-2 bg-[#F7F6F1] hover:bg-[#E7E9EE] text-[#0F172A] rounded-xl text-xs font-semibold transition cursor-pointer text-center"
                    >
                      View Details
                    </button>

                    {req.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleOpenApproveModal(req)}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer text-center"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setRejectRequest(req);
                            setRejectionReason('');
                            setRejectError(null);
                          }}
                          className="py-2 px-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-semibold transition cursor-pointer text-center"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {req.status === 'APPROVED' && (
                      <div className="flex-1 flex gap-2">
                        {(req.approvedMadrasaId || req.approvedMadrasa?.id) && (
                          <Link
                            to={`/super-admin/madrasas/${req.approvedMadrasaId || req.approvedMadrasa?.id}`}
                            className="flex-1 py-2 bg-[#0F172A] text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <Building2 className="w-3.5 h-3.5 text-[#37C6A3]" />
                            <span>View Madrasa</span>
                          </Link>
                        )}
                        <button
                          onClick={() => handleResendEmail(req)}
                          disabled={resendingId === req.id}
                          className="flex-1 py-2 bg-[#F7F6F1] hover:bg-[#E7E9EE] text-[#0F172A] border border-[#E7E9EE] rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {resendingId === req.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#37C6A3]" />
                          ) : (
                            <Send className="w-3.5 h-3.5 text-[#37C6A3]" />
                          )}
                          <span>Resend Email</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Bar */}
            <div className="p-4 bg-[#F7F6F1]/50 border-t border-[#E7E9EE] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#7C8A9A]">
              <div>
                Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} requests
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => fetchRequests(pagination.page - 1)}
                  className="p-2 bg-white border border-[#E7E9EE] rounded-xl text-[#0F172A] hover:bg-[#F7F6F1] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-[#0F172A]">
                  Page {pagination.page} of {pagination.totalPages || 1}
                </span>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchRequests(pagination.page + 1)}
                  className="p-2 bg-white border border-[#E7E9EE] rounded-xl text-[#0F172A] hover:bg-[#F7F6F1] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-xs"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* DRAWER / MODAL: VIEW DETAILS & AUDIT TIMELINE */}
      {viewRequest && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center sm:justify-end p-0 backdrop-blur-xs">
          <div className="bg-white h-full max-w-xl w-full p-6 shadow-2xl border-l border-[#E7E9EE] space-y-6 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#E7E9EE]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#0F172A] text-[#37C6A3] flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#0F172A]">{viewRequest.madrasaName}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-bold ${
                        viewRequest.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-800'
                          : viewRequest.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-red-50 text-red-800'
                      }`}
                    >
                      {viewRequest.status}
                    </span>
                    {renderEmailStatusBadge(viewRequest.emailStatus)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setViewRequest(null)}
                className="p-2 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1] rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Institution Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Institution Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#F7F6F1] rounded-xl">
                  <span className="text-[#7C8A9A] block text-[10px] uppercase font-semibold">Madrasa Name</span>
                  <span className="font-semibold text-[#0F172A] mt-0.5 block">{viewRequest.madrasaName}</span>
                </div>
                <div className="p-3 bg-[#F7F6F1] rounded-xl">
                  <span className="text-[#7C8A9A] block text-[10px] uppercase font-semibold">District</span>
                  <span className="font-semibold text-[#0F172A] mt-0.5 block">
                    {viewRequest.district || 'Not Specified'}
                  </span>
                </div>
                <div className="p-3 bg-[#F7F6F1] rounded-xl sm:col-span-2">
                  <span className="text-[#7C8A9A] block text-[10px] uppercase font-semibold">Campus Address</span>
                  <span className="font-medium text-[#0F172A] mt-0.5 block">
                    {viewRequest.address || 'Not Specified'}
                  </span>
                </div>
                <div className="p-3 bg-[#F7F6F1] rounded-xl">
                  <span className="text-[#7C8A9A] block text-[10px] uppercase font-semibold">Expected Students</span>
                  <span className="font-semibold text-[#0F172A] mt-0.5 block">
                    {viewRequest.expectedStudentCount || 'Not Specified'}
                  </span>
                </div>
                <div className="p-3 bg-[#F7F6F1] rounded-xl">
                  <span className="text-[#7C8A9A] block text-[10px] uppercase font-semibold">Provisioned Code</span>
                  <span className="font-mono font-bold text-[#0F172A] mt-0.5 block">
                    {viewRequest.approvedMadrasa?.code || '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Applicant Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Applicant & Contact</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#F7F6F1] rounded-xl">
                  <span className="text-[#7C8A9A] block text-[10px] uppercase font-semibold">Contact Person</span>
                  <span className="font-semibold text-[#0F172A] mt-0.5 block">{viewRequest.contactName}</span>
                </div>
                <div className="p-3 bg-[#F7F6F1] rounded-xl">
                  <span className="text-[#7C8A9A] block text-[10px] uppercase font-semibold">Login Email</span>
                  <span className="font-mono text-[#0F172A] mt-0.5 block truncate">{viewRequest.email}</span>
                </div>
                <div className="p-3 bg-[#F7F6F1] rounded-xl">
                  <span className="text-[#7C8A9A] block text-[10px] uppercase font-semibold">Phone</span>
                  <span className="font-medium text-[#0F172A] mt-0.5 block">{viewRequest.phone}</span>
                </div>
                <div className="p-3 bg-[#F7F6F1] rounded-xl">
                  <span className="text-[#7C8A9A] block text-[10px] uppercase font-semibold">WhatsApp</span>
                  <span className="font-medium text-[#0F172A] mt-0.5 block">
                    {viewRequest.whatsappNumber || 'Not Provided'}
                  </span>
                </div>
              </div>
            </div>

            {/* Applicant Message */}
            {viewRequest.message && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Applicant Notes</h4>
                <div className="p-3 bg-[#F7F6F1] rounded-xl text-xs text-[#0F172A] italic">
                  "{viewRequest.message}"
                </div>
              </div>
            )}

            {/* Rejection Details */}
            {viewRequest.rejectionReason && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-1">
                <span className="text-red-700 block text-[10px] uppercase font-bold tracking-wider">
                  Rejection Reason
                </span>
                <span className="text-xs text-red-900 block">{viewRequest.rejectionReason}</span>
              </div>
            )}

            {/* Audit Timeline */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Activity Timeline</h4>
              <div className="space-y-3 border-l-2 border-[#E7E9EE] ml-2 pl-4">
                {viewRequest.timeline && viewRequest.timeline.length > 0 ? (
                  viewRequest.timeline.map((item, idx) => (
                    <div key={idx} className="relative space-y-0.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#37C6A3] absolute -left-[21px] top-1.5" />
                      <div className="text-xs font-bold text-[#0F172A]">{item.title}</div>
                      <div className="text-[11px] text-[#7C8A9A]">
                        {new Date(item.date).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {item.actor ? ` • by ${item.actor}` : ''}
                      </div>
                      {item.notes && <div className="text-[11px] text-[#0F172A] mt-0.5">{item.notes}</div>}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[#7C8A9A]">No timeline events recorded yet.</div>
                )}
              </div>
            </div>

            {/* Drawer Actions */}
            <div className="pt-4 border-t border-[#E7E9EE] flex items-center justify-end gap-2">
              <button
                onClick={() => setViewRequest(null)}
                className="px-4 py-2.5 bg-[#F7F6F1] text-[#0F172A] hover:bg-[#E7E9EE] rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              {viewRequest.status === 'APPROVED' && (viewRequest.approvedMadrasaId || viewRequest.approvedMadrasa?.id) && (
                <Link
                  to={`/super-admin/madrasas/${viewRequest.approvedMadrasaId || viewRequest.approvedMadrasa?.id}`}
                  className="px-5 py-2.5 bg-[#0F172A] text-white hover:bg-slate-800 rounded-xl text-xs font-semibold cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <Building2 className="w-3.5 h-3.5 text-[#37C6A3]" />
                  <span>View Madrasa</span>
                </Link>
              )}
              {viewRequest.status === 'PENDING' && (
                <button
                  onClick={() => {
                    const req = viewRequest;
                    setViewRequest(null);
                    handleOpenApproveModal(req);
                  }}
                  className="px-5 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
                >
                  Approve Registration
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: APPROVE ONBOARDING (DYNAMIC PLAN SELECTOR) */}
      {approveRequest && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-[#E7E9EE] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E9EE]">
              <div>
                <h3 className="font-bold text-base text-[#0F172A]">Approve Madrasa Registration</h3>
                <p className="text-xs text-[#7C8A9A]">{approveRequest.madrasaName}</p>
              </div>
              <button
                onClick={() => setApproveRequest(null)}
                className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {approvalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{approvalError}</span>
              </div>
            )}

            <form onSubmit={handleApproveSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#0F172A] block mb-1">
                    Madrasa Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={approvalForm.madrasaCode}
                    onChange={(e) => setApprovalForm({ ...approvalForm, madrasaCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. MDRS01"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9EE] font-mono text-xs focus:ring-2 focus:ring-[#37C6A3]/30"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#0F172A] block mb-1">
                    Workspace Slug <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={approvalForm.madrasaSlug}
                    onChange={(e) => setApprovalForm({ ...approvalForm, madrasaSlug: e.target.value.toLowerCase() })}
                    placeholder="e.g. madrasa-alnoor"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9EE] font-mono text-xs focus:ring-2 focus:ring-[#37C6A3]/30"
                  />
                </div>
              </div>

              {/* Dynamic DB Plan Selector */}
              <div>
                <label className="font-semibold text-[#0F172A] block mb-1">
                  Subscription Plan <span className="text-red-500">*</span>
                </label>
                {plans.length === 0 ? (
                  <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs">
                    No active plans found in the system. Please create an active plan first.
                  </div>
                ) : (
                  <select
                    required
                    value={approvalForm.planId}
                    onChange={(e) => setApprovalForm({ ...approvalForm, planId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9EE] text-xs focus:ring-2 focus:ring-[#37C6A3]/30 bg-white"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.durationMonths} months) — LKR {Number(p.price).toLocaleString()}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#0F172A] block mb-1">Admin Full Name</label>
                  <input
                    type="text"
                    value={approvalForm.adminName}
                    onChange={(e) => setApprovalForm({ ...approvalForm, adminName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9EE] text-xs focus:ring-2 focus:ring-[#37C6A3]/30"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#0F172A] block mb-1">Admin Login Email</label>
                  <input
                    type="email"
                    value={approvalForm.adminEmail}
                    onChange={(e) => setApprovalForm({ ...approvalForm, adminEmail: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9EE] text-xs focus:ring-2 focus:ring-[#37C6A3]/30"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#0F172A] block mb-1">
                  Custom Temporary Password (Optional)
                </label>
                <input
                  type="text"
                  value={approvalForm.temporaryPassword}
                  onChange={(e) => setApprovalForm({ ...approvalForm, temporaryPassword: e.target.value })}
                  placeholder="Leave empty to auto-generate a secure temporary password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9EE] font-mono text-xs focus:ring-2 focus:ring-[#37C6A3]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#0F172A] block mb-1">Initial Payment Method</label>
                  <select
                    value={approvalForm.paymentMethod}
                    onChange={(e) => setApprovalForm({ ...approvalForm, paymentMethod: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9EE] text-xs bg-white"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Credit / Debit Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#0F172A] block mb-1">Payment Reference</label>
                  <input
                    type="text"
                    value={approvalForm.paymentReference}
                    onChange={(e) => setApprovalForm({ ...approvalForm, paymentReference: e.target.value })}
                    placeholder="e.g. TXN-99823"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7E9EE] text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="recordInitialPayment"
                  checked={approvalForm.recordInitialPayment}
                  onChange={(e) => setApprovalForm({ ...approvalForm, recordInitialPayment: e.target.checked })}
                  className="rounded text-[#37C6A3] focus:ring-[#37C6A3]"
                />
                <label htmlFor="recordInitialPayment" className="text-xs text-[#0F172A]">
                  Mark initial subscription payment as collected (creates PAID invoice & payment record)
                </label>
              </div>

              <div className="pt-4 border-t border-[#E7E9EE] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setApproveRequest(null)}
                  className="px-4 py-2.5 bg-[#F7F6F1] text-[#0F172A] hover:bg-[#E7E9EE] rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isApproving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Approve & Provision</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ONE-TIME PROVISIONED CREDENTIALS DISPLAY */}
      {provisionedResult && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-[#E7E9EE] space-y-5">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-[#0F172A]">Madrasa Workspace Provisioned!</h3>
              <p className="text-xs text-[#7C8A9A]">
                Initial tenant workspace, administrator account, and subscription are active.
              </p>
            </div>

            {/* Email Status Alert */}
            {provisionedResult.emailDelivery?.status === 'SENT' ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>An automatic approval email has been dispatched to {provisionedResult.adminUser.email}.</span>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Approval email delivery status: {provisionedResult.emailDelivery?.status || 'NOT_CONFIGURED'}. You can resend the email from the Approval Center.
                </span>
              </div>
            )}

            {/* Credential Card */}
            <div className="p-4 rounded-2xl bg-[#0F172A] text-white space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-[10px] uppercase font-bold text-[#37C6A3]">One-Time Admin Credentials</span>
                <span className="text-[10px] text-[#7C8A9A]">Must Change Password on Login</span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Institution:</span>
                  <span className="font-semibold text-white">
                    {provisionedResult.madrasa.name} ({provisionedResult.madrasa.code})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Admin Email:</span>
                  <span className="font-semibold text-white">{provisionedResult.adminUser.email}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-white/10">
                  <span className="text-[#FFD978] font-bold">Temporary Password:</span>
                  <span className="font-mono text-sm font-bold text-[#FFD978] bg-white/10 px-2.5 py-1 rounded">
                    {provisionedResult.adminUser.temporaryPassword}
                  </span>
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>CRITICAL:</strong> This temporary password will <strong>NOT</strong> be displayed again and cannot be retrieved from the server. Copy and share these credentials securely with the Madrasa Admin now.
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={copyCredentials}
                className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold bg-[#FFD978] text-[#0F172A] hover:bg-[#ffe18f] transition shadow-xs cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Credentials Copied!' : 'Copy Credentials'}</span>
              </button>
              <button
                onClick={() => setProvisionedResult(null)}
                className="px-6 h-11 inline-flex items-center justify-center rounded-xl text-xs font-semibold bg-[#F7F6F1] text-[#0F172A] hover:bg-[#E7E9EE] transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REJECT ONBOARDING */}
      {rejectRequest && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E7E9EE] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E9EE]">
              <div>
                <h3 className="font-bold text-base text-red-700">Reject Registration Request</h3>
                <p className="text-xs text-[#7C8A9A]">{rejectRequest.madrasaName}</p>
              </div>
              <button
                onClick={() => setRejectRequest(null)}
                className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {rejectError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {rejectError}
              </div>
            )}

            <form onSubmit={handleRejectSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this application cannot be approved at this time (minimum 3 characters)..."
                  className="w-full px-3 py-2 rounded-xl border border-[#E7E9EE] text-xs focus:ring-2 focus:ring-red-200 focus:border-red-400 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-[#E7E9EE] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectRequest(null)}
                  className="px-4 py-2 bg-[#F7F6F1] text-[#0F172A] hover:bg-[#E7E9EE] rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRejecting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {isRejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
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
