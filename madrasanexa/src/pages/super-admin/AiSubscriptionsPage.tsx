import { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Building2,
  Receipt,
  Search,
  RefreshCw,
  ExternalLink,
  Check,
  X,
  Landmark,
  Save,
  FileText,
} from 'lucide-react';
import { aiService, type AiSubscriptionRequestItem, type PlatformAiSettings } from '../../services/ai.service';
import { apiClient } from '../../services/api';

export default function SuperAdminAiSubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<'requests' | 'madrasas' | 'settings'>('requests');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [requests, setRequests] = useState<AiSubscriptionRequestItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, totalCount: 0, totalPages: 1 });
  const [selectedReceipt, setSelectedReceipt] = useState<AiSubscriptionRequestItem | null>(null);

  // Rejection modal
  const [rejectingItem, setRejectingItem] = useState<AiSubscriptionRequestItem | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  // Approval modal
  const [approvingItem, setApprovingItem] = useState<AiSubscriptionRequestItem | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [customDays, setCustomDays] = useState<'30' | '365' | 'custom'>('30');
  const [customExpiryDate, setCustomExpiryDate] = useState('');

  // Madrasas list & override
  const [madrasas, setMadrasas] = useState<any[]>([]);
  const [madrasaSearch, setMadrasaSearch] = useState('');
  const [loadingMadrasas, setLoadingMadrasas] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Platform AI Settings
  const [settings, setSettings] = useState<PlatformAiSettings>({
    monthlyPrice: 2500,
    yearlyPrice: 25000,
    currency: 'LKR',
    bankName: '',
    accountName: '',
    accountNumber: '',
    branch: '',
    instructions: '',
    featuresList: [],
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  // Load Requests
  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await aiService.listAllRequests({
        status: statusFilter || undefined,
        page: pagination.page,
      });
      setRequests(res.requests);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to load AI subscription requests:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Madrasas for direct override
  const loadMadrasas = async () => {
    try {
      setLoadingMadrasas(true);
      const res = await apiClient.get('/super-admin/madrasas', {
        params: { limit: 100, pageSize: 100, _t: Date.now() },
      });
      const list = res.data?.data?.madrasas || res.data?.data || [];
      setMadrasas(list);
    } catch (err) {
      console.error('Failed to load madrasas:', err);
    } finally {
      setLoadingMadrasas(false);
    }
  };

  // Load Settings
  const loadSettings = async () => {
    try {
      const res = await aiService.getPlatformSettings();
      setSettings(res);
    } catch (err) {
      console.error('Failed to load AI platform settings:', err);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter, pagination.page]);

  useEffect(() => {
    if (activeTab === 'madrasas') loadMadrasas();
    if (activeTab === 'settings') loadSettings();
  }, [activeTab]);

  // Handle Approve
  const handleApprove = async () => {
    if (!approvingItem) return;
    setProcessingAction(true);
    try {
      let customDateStr = undefined;
      if (customDays === 'custom' && customExpiryDate) {
        customDateStr = new Date(customExpiryDate).toISOString();
      } else if (customDays === '365') {
        customDateStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      } else if (customDays === '30') {
        customDateStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      await aiService.approveRequest(approvingItem.id, {
        adminNote: approvalNote.trim() || undefined,
        customExpiresAt: customDateStr,
      });

      setApprovingItem(null);
      setApprovalNote('');
      loadRequests();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to approve request.');
    } finally {
      setProcessingAction(false);
    }
  };

  // Handle Reject
  const handleReject = async () => {
    if (!rejectingItem) return;
    setProcessingAction(true);
    try {
      await aiService.rejectRequest(rejectingItem.id, {
        adminNote: rejectionNote.trim() || 'Payment receipt could not be verified.',
      });

      setRejectingItem(null);
      setRejectionNote('');
      loadRequests();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to reject request.');
    } finally {
      setProcessingAction(false);
    }
  };

  // Handle Direct Madrasa AI Toggle with Optimistic State Update
  const handleToggleMadrasa = async (madrasa: any, enabled: boolean) => {
    setTogglingId(madrasa.id);
    const expectedExpiry = enabled
      ? (madrasa.aiExpiresAt && new Date(madrasa.aiExpiresAt) > new Date()
          ? madrasa.aiExpiresAt
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
      : null;

    // 1. Optimistic UI Update immediately reflected in table
    setMadrasas((prev) =>
      prev.map((m) =>
        m.id === madrasa.id
          ? {
              ...m,
              aiEnabled: enabled,
              aiExpiresAt: expectedExpiry,
            }
          : m
      )
    );

    try {
      const res = await aiService.toggleMadrasaAi(madrasa.id, {
        enabled,
        note: `Manual toggle by Super Admin on ${new Date().toLocaleDateString()}`,
      });
      // 2. Sync with server data
      if (res?.data) {
        setMadrasas((prev) =>
          prev.map((m) =>
            m.id === madrasa.id
              ? {
                  ...m,
                  ...res.data,
                  aiEnabled: Boolean(res.data.aiEnabled),
                  aiExpiresAt: res.data.aiExpiresAt,
                }
              : m
          )
        );
      }
      await loadMadrasas();
    } catch (err: any) {
      // Revert optimistic update on error
      setMadrasas((prev) =>
        prev.map((m) =>
          m.id === madrasa.id
            ? { ...m, aiEnabled: madrasa.aiEnabled, aiExpiresAt: madrasa.aiExpiresAt }
            : m
        )
      );
      alert(err.response?.data?.message || err.message || 'Failed to update AI access.');
    } finally {
      setTogglingId(null);
    }
  };

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const updated = await aiService.updatePlatformSettings(settings);
      setSettings(updated);
      setSettingsMsg('AI Pricing and Platform Bank settings saved successfully!');
      setTimeout(() => setSettingsMsg(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to update settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const filteredMadrasas = madrasas.filter(
    (m) =>
      m.name?.toLowerCase().includes(madrasaSearch.toLowerCase()) ||
      m.code?.toLowerCase().includes(madrasaSearch.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-[#E7E9EE] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#0F172A] text-[#37C6A3] flex items-center justify-center font-bold shadow-xs">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-[#0F172A] tracking-tight">
                AI Subscriptions & Activation Center
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0F172A] text-white">
                Super Admin
              </span>
            </div>
            <p className="text-xs text-[#7C8A9A] mt-0.5">
              Review incoming bank receipts, approve tenant subscriptions, and manage AI pricing
            </p>
          </div>
        </div>

        <button
          onClick={loadRequests}
          className="px-4 py-2 text-xs font-semibold rounded-xl border border-[#E7E9EE] hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#7C8A9A]" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E7E9EE] pb-2">
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'requests'
              ? 'bg-[#0F172A] text-white shadow-xs'
              : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-white'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Bank Payment Requests</span>
          {pagination.totalCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#37C6A3] text-[#0F172A] font-extrabold">
              {pagination.totalCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('madrasas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'madrasas'
              ? 'bg-[#0F172A] text-white shadow-xs'
              : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Madrasa AI Overrides</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-[#0F172A] text-white shadow-xs'
              : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-white'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Pricing & Bank Settings</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SUBSCRIPTION REQUESTS                                              */}
      {/* ========================================================================= */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Status Filter */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#7C8A9A]">Filter Status:</span>
              <div className="flex items-center gap-1.5">
                {[
                  { label: 'All', value: '' },
                  { label: 'Pending', value: 'PENDING' },
                  { label: 'Approved', value: 'APPROVED' },
                  { label: 'Rejected', value: 'REJECTED' },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      statusFilter === f.value
                        ? 'bg-[#0F172A] text-white'
                        : 'bg-white text-[#7C8A9A] border border-[#E7E9EE] hover:text-[#0F172A]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-[#7C8A9A]">
              Showing {requests.length} of {pagination.totalCount} total submissions
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl border border-[#E7E9EE] shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 space-y-2 text-[#7C8A9A]">
                <RefreshCw className="w-6 h-6 animate-spin text-[#37C6A3]" />
                <span className="text-xs">Loading subscription requests...</span>
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center p-12 text-[#7C8A9A]">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <h4 className="text-sm font-bold text-[#0F172A]">No Requests Found</h4>
                <p className="text-xs mt-1">There are currently no AI subscription requests matching this filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F6F1] border-b border-[#E7E9EE] text-[#7C8A9A] uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4 font-bold">Madrasa Tenant</th>
                      <th className="py-3 px-4 font-bold">Submitted By</th>
                      <th className="py-3 px-4 font-bold">Plan & Amount</th>
                      <th className="py-3 px-4 font-bold">Txn Ref</th>
                      <th className="py-3 px-4 font-bold">Submitted At</th>
                      <th className="py-3 px-4 font-bold">Receipt</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E9EE]">
                    {requests.map((req) => {
                      const isItemPending = req.status === 'PENDING';
                      return (
                        <tr key={req.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3.5 px-4 font-semibold text-[#0F172A]">
                            <div>{req.madrasa?.name || 'Unknown Madrasa'}</div>
                            <div className="text-[10px] text-[#7C8A9A] font-mono">{req.madrasa?.code}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-medium text-[#0F172A]">{req.submittedByUser?.name || 'Admin'}</div>
                            <div className="text-[10px] text-[#7C8A9A] truncate max-w-[150px]">{req.submittedByUser?.email}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-bold text-[#0F172A]">{req.planName}</span>
                            <div className="text-[11px] font-mono font-bold text-[#37C6A3]">
                              LKR {req.amount.toLocaleString()}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-700">
                            {req.transactionRef}
                          </td>

                          <td className="py-3.5 px-4 text-[#7C8A9A] text-[11px]">
                            {new Date(req.createdAt).toLocaleDateString()}{' '}
                            <span className="text-[10px] block opacity-70">
                              {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {req.receiptUrl ? (
                              <button
                                onClick={() => setSelectedReceipt(req)}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#37C6A3]" />
                                <span>Preview</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[10px]">No file</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                req.status === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : req.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-red-100 text-red-800 border border-red-200'
                              }`}
                            >
                              {req.status === 'PENDING' && <Clock className="w-2.5 h-2.5" />}
                              {req.status === 'APPROVED' && <CheckCircle2 className="w-2.5 h-2.5" />}
                              {req.status === 'REJECTED' && <XCircle className="w-2.5 h-2.5" />}
                              <span>{req.status}</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {isItemPending ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setApprovingItem(req);
                                    setCustomDays(req.planName.toLowerCase().includes('year') ? '365' : '30');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition flex items-center gap-1 cursor-pointer shadow-xs"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Approve</span>
                                </button>

                                <button
                                  onClick={() => setRejectingItem(req)}
                                  className="px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Reject</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-[#7C8A9A]">Processed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MADRASA AI ACCESS OVERRIDES                                        */}
      {/* ========================================================================= */}
      {activeTab === 'madrasas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#7C8A9A] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Madrasa name or code..."
                value={madrasaSearch}
                onChange={(e) => setMadrasaSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
              />
            </div>
            <button
              onClick={loadMadrasas}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-[#E7E9EE] hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh List</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-[#E7E9EE] shadow-sm overflow-hidden">
            {loadingMadrasas ? (
              <div className="p-12 text-center text-[#7C8A9A]">
                <RefreshCw className="w-6 h-6 animate-spin text-[#37C6A3] mx-auto mb-2" />
                <span className="text-xs">Loading Madrasas...</span>
              </div>
            ) : filteredMadrasas.length === 0 ? (
              <div className="p-12 text-center text-[#7C8A9A]">
                <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <span className="text-xs">No Madrasas found.</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F6F1] border-b border-[#E7E9EE] text-[#7C8A9A] uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4 font-bold">Madrasa</th>
                    <th className="py-3 px-4 font-bold">Code</th>
                    <th className="py-3 px-4 font-bold">AI Status</th>
                    <th className="py-3 px-4 font-bold">AI Expiry Date</th>
                    <th className="py-3 px-4 font-bold text-right">Direct Toggle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E9EE]">
                  {filteredMadrasas.map((m) => {
                    const isAiOn = Boolean(m.aiEnabled);
                    const isToggling = togglingId === m.id;
                    const isExpired = Boolean(m.aiExpiresAt && new Date(m.aiExpiresAt) < new Date());

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 font-bold text-[#0F172A]">{m.name}</td>
                        <td className="py-3.5 px-4 font-mono text-[#7C8A9A]">{m.code}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              isAiOn && !isExpired
                                ? 'bg-emerald-100 text-emerald-800'
                                : isExpired
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isAiOn && !isExpired ? 'ACTIVE ✅' : isExpired ? 'EXPIRED ⏳' : 'DISABLED 🔒'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-[#7C8A9A]">
                          {m.aiExpiresAt ? new Date(m.aiExpiresAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleToggleMadrasa(m, !isAiOn)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer disabled:opacity-50 ${
                              isAiOn
                                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                                : 'bg-[#0F172A] text-white hover:bg-[#1E293B]'
                            }`}
                          >
                            {isToggling ? 'Updating...' : isAiOn ? 'Disable AI' : 'Enable AI'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PRICING & OFFICIAL BANK SETTINGS                                    */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E7E9EE] shadow-sm space-y-6 max-w-3xl">
          <div className="border-b border-[#E7E9EE] pb-4">
            <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <Landmark className="w-5 h-5 text-[#37C6A3]" />
              <span>AI Assistant Pricing & Bank Details</span>
            </h2>
            <p className="text-xs text-[#7C8A9A] mt-1">
              Configure subscription tiers in LKR and platform bank account displayed on the Madrasa activation page
            </p>
          </div>

          {settingsMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{settingsMsg}</span>
            </div>
          )}

          {/* Pricing Tiers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                Monthly Subscription Fee ({settings.currency})
              </label>
              <input
                type="number"
                value={settings.monthlyPrice}
                onChange={(e) => setSettings({ ...settings, monthlyPrice: Number(e.target.value) })}
                required
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                Yearly Subscription Fee ({settings.currency})
              </label>
              <input
                type="number"
                value={settings.yearlyPrice}
                onChange={(e) => setSettings({ ...settings, yearlyPrice: Number(e.target.value) })}
                required
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-mono font-bold"
              />
            </div>
          </div>

          {/* Bank Details */}
          <div className="pt-2 border-t border-[#E7E9EE] space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#7C8A9A]">
              Official Bank Transfer Account
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. Bank of Ceylon (BOC)"
                  value={settings.bankName || ''}
                  onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Account Name</label>
                <input
                  type="text"
                  placeholder="e.g. MadrasaNexa Platform (Pvt) Ltd"
                  value={settings.accountName || ''}
                  onChange={(e) => setSettings({ ...settings, accountName: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Account Number</label>
                <input
                  type="text"
                  placeholder="e.g. 008920192841"
                  value={settings.accountNumber || ''}
                  onChange={(e) => setSettings({ ...settings, accountNumber: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Branch</label>
                <input
                  type="text"
                  placeholder="e.g. Colombo Corporate Branch"
                  value={settings.branch || ''}
                  onChange={(e) => setSettings({ ...settings, branch: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Payment Instructions</label>
              <textarea
                rows={3}
                placeholder="Instructions shown to Madrasa Admins when depositing..."
                value={settings.instructions || ''}
                onChange={(e) => setSettings({ ...settings, instructions: e.target.value })}
                className="w-full p-3 text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-[#37C6A3] bg-white font-medium"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="py-2.5 px-6 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {savingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-[#37C6A3]" />}
              <span>Save AI Platform Settings</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RECEIPT PREVIEW MODAL                                            */}
      {/* ========================================================================= */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 sm:p-5 border-b border-[#E7E9EE] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#0F172A] truncate">
                  Bank Payment Receipt — {selectedReceipt.madrasa?.name}
                </h3>
                <p className="text-[11px] text-[#7C8A9A] truncate">
                  Ref: {selectedReceipt.transactionRef} • LKR {selectedReceipt.amount.toLocaleString()} ({selectedReceipt.planName})
                </p>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer flex items-center justify-center shrink-0"
                aria-label="Close Preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-950/5">
              {(() => {
                const resolveFullUrl = (url?: string) => {
                  if (!url) return '';
                  if (url.startsWith('http://') || url.startsWith('https://')) return url;
                  const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
                  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
                };

                const rawUrl = selectedReceipt.receiptUrl || '';
                const key = (selectedReceipt as any).receiptKey || '';
                const fullUrl = resolveFullUrl(rawUrl);
                const cleanUrl = rawUrl.split('?')[0].toLowerCase();
                const isPdf = cleanUrl.endsWith('.pdf') || key.toLowerCase().endsWith('.pdf') || cleanUrl.includes('.pdf');

                if (isPdf) {
                  return (
                    <div className="w-full flex flex-col items-center gap-3">
                      <div className="w-full h-[55vh] max-h-[500px] rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                        <iframe
                          src={fullUrl}
                          title="PDF Bank Receipt Preview"
                          className="w-full h-full border-0"
                        />
                      </div>
                      <a
                        href={fullUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2.5 min-h-[44px] bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 shadow-xs transition"
                      >
                        <FileText className="w-4 h-4 text-[#37C6A3]" />
                        <span>Open / Download PDF Receipt</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  );
                }

                return (
                  <img
                    src={fullUrl}
                    alt="Receipt Slip"
                    className="max-h-[60vh] w-auto max-w-full object-contain rounded-xl shadow-xs"
                  />
                );
              })()}
            </div>

            <div className="p-4 border-t border-[#E7E9EE] bg-[#F7F6F1] flex items-center justify-between gap-2">
              <a
                href={(() => {
                  const url = selectedReceipt.receiptUrl || '';
                  if (url.startsWith('http://') || url.startsWith('https://')) return url;
                  const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
                  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
                })()}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-[#0F172A] hover:underline flex items-center gap-1.5 min-h-[44px]"
              >
                <span>Download Original</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 min-h-[44px] text-xs font-bold bg-white rounded-xl border border-[#E7E9EE] hover:bg-slate-50 transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: APPROVE CONFIRMATION MODAL                                       */}
      {/* ========================================================================= */}
      {approvingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-[95vw] sm:max-w-md p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#0F172A]">Approve & Enable AI Access</h3>
                <p className="text-xs text-[#7C8A9A] truncate">{approvingItem.madrasa?.name}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <p><span className="font-semibold">Plan:</span> {approvingItem.planName}</p>
              <p><span className="font-semibold">Amount:</span> LKR {approvingItem.amount.toLocaleString()}</p>
              <p className="break-words"><span className="font-semibold">Ref:</span> {approvingItem.transactionRef}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">Access Duration</label>
              <select
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value as any)}
                className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] font-medium bg-white"
              >
                <option value="30">30 Days (Standard Monthly)</option>
                <option value="365">365 Days (Standard Yearly)</option>
                <option value="custom">Custom Expiry Date</option>
              </select>
            </div>

            {customDays === 'custom' && (
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">Custom Expiry Date</label>
                <input
                  type="date"
                  value={customExpiryDate}
                  onChange={(e) => setCustomExpiryDate(e.target.value)}
                  className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] bg-white"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">Admin Approval Note (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Verified with bank deposit slip"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                className="w-full px-3 py-2.5 min-h-[44px] text-xs rounded-xl border border-[#E7E9EE] bg-white"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApprovingItem(null)}
                className="px-4 py-2.5 min-h-[44px] text-xs font-bold rounded-xl text-[#7C8A9A] hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingAction}
                onClick={handleApprove}
                className="px-5 py-2.5 min-h-[44px] text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {processingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Confirm & Enable AI</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: REJECT MODAL                                                     */}
      {/* ========================================================================= */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-[95vw] sm:max-w-md p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-bold shrink-0">
                <XCircle className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#0F172A]">Reject AI Subscription Request</h3>
                <p className="text-xs text-[#7C8A9A] truncate">{rejectingItem.madrasa?.name}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Reason for Rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Deposit slip image is unreadable, or transaction reference not found in bank statement."
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                className="w-full p-3 text-xs rounded-xl border border-[#E7E9EE] focus:outline-hidden focus:border-red-400 bg-white"
              />
              <span className="text-[10px] text-[#7C8A9A] mt-1 block">
                This explanation will be displayed to the Madrasa Admin so they can correct and resubmit.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="px-4 py-2.5 min-h-[44px] text-xs font-bold rounded-xl text-[#7C8A9A] hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingAction}
                onClick={handleReject}
                className="px-5 py-2.5 min-h-[44px] text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {processingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                <span>Reject Request</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
