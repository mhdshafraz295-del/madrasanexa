import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  apiGetMadrasa,
  apiUpdateMadrasa,
  apiActivateMadrasa,
  apiSuspendMadrasa,
  apiArchiveMadrasa,
  apiResetMadrasaAdminPassword,
  apiToggleMadrasaAdminActive,
  apiRenewMadrasaSubscription,
  apiListPlans,
  type MadrasaDetailItem,
  type PlanItem,
} from '../../services/api';
import {
  Building2,
  Users,
  CreditCard,
  Key,
  ArrowLeft,
  Edit2,
  AlertTriangle,
  RotateCcw,
  PauseCircle,
  Archive,
  Loader2,
  Copy,
  Check,
  X,
  RefreshCw,
  ShieldCheck,
  GraduationCap,
  Layers,
  FileText,
  DollarSign,
  Activity,
  Image as ImageIcon,
} from 'lucide-react';

export default function MadrasaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [madrasa, setMadrasa] = useState<MadrasaDetailItem | null>(null);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Edit Profile Modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  // Lifecycle Confirmation Modals
  const [pendingLifecycleAction, setPendingLifecycleAction] = useState<
    'suspend' | 'activate' | 'archive' | null
  >(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  // Admin Reset Modal
  const [resetAdminUser, setResetAdminUser] = useState<any | null>(null);
  const [customTempPassword, setCustomTempPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetCredentialResult, setResetCredentialResult] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Renewal Modal
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [renewForm, setRenewForm] = useState({
    planId: '',
    paymentMethod: 'BANK_TRANSFER' as 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER',
    reference: '',
    notes: '',
  });
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);

  const fetchMadrasa = async (signal?: AbortSignal) => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await apiGetMadrasa(id, signal);
      setMadrasa(data);
      setEditForm({
        name: data.name,
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
      });
    } catch (err: any) {
      if (axios.isCancel(err) || err?.name === 'CanceledError') {
        return;
      }
      setError(err.response?.data?.message || err.message || 'Failed to load madrasa details');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await apiListPlans();
      const activePlans = res.filter((p) => p.isActive);
      setPlans(activePlans);
      if (activePlans.length > 0) {
        setRenewForm((prev) => ({ ...prev, planId: activePlans[0].id }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchMadrasa(controller.signal);
    fetchPlans();
    return () => {
      controller.abort();
    };
  }, [id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsUpdating(true);
    try {
      await apiUpdateMadrasa(id, editForm);
      setIsEditOpen(false);
      setFeedbackNotice({
        type: 'success',
        message: 'Institution profile updated successfully.',
      });
      fetchMadrasa();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmLifecycleTransition = async () => {
    if (!id || !pendingLifecycleAction) return;
    setIsChangingStatus(true);
    try {
      if (pendingLifecycleAction === 'activate') {
        await apiActivateMadrasa(id);
        setFeedbackNotice({
          type: 'success',
          message: `${madrasa?.name} reactivated successfully.`,
        });
      } else if (pendingLifecycleAction === 'suspend') {
        await apiSuspendMadrasa(id);
        setFeedbackNotice({
          type: 'success',
          message: `${madrasa?.name} suspended successfully.`,
        });
      } else if (pendingLifecycleAction === 'archive') {
        await apiArchiveMadrasa(id);
        setFeedbackNotice({
          type: 'success',
          message: `${madrasa?.name} archived successfully. All records preserved safely.`,
        });
      }
      setPendingLifecycleAction(null);
      fetchMadrasa();
    } catch (err: any) {
      const errMsg =
        err.response?.data?.message || err.message || 'Status transition failed';
      setFeedbackNotice({
        type: 'error',
        message: errMsg,
      });
      setPendingLifecycleAction(null);
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleToggleAdminActive = async (adminUserId: string, currentActive: boolean) => {
    if (!id) return;
    try {
      await apiToggleMadrasaAdminActive(id, adminUserId, !currentActive);
      setFeedbackNotice({
        type: 'success',
        message: `Administrator ${!currentActive ? 'activated' : 'deactivated'} successfully.`,
      });
      fetchMadrasa();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update admin state');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !resetAdminUser) return;
    setIsResetting(true);
    try {
      const res = await apiResetMadrasaAdminPassword(
        id,
        resetAdminUser.id,
        customTempPassword || undefined
      );
      setResetAdminUser(null);
      setCustomTempPassword('');
      setResetCredentialResult({
        email: res.email,
        temporaryPassword: res.temporaryPassword || '',
      });
      fetchMadrasa();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Password reset failed');
    } finally {
      setIsResetting(false);
    }
  };

  const handleRenewSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsRenewing(true);
    setRenewError(null);
    try {
      await apiRenewMadrasaSubscription(id, renewForm);
      setIsRenewOpen(false);
      setFeedbackNotice({
        type: 'success',
        message: 'Subscription renewed successfully.',
      });
      fetchMadrasa();
    } catch (err: any) {
      setRenewError(err.response?.data?.message || err.message || 'Renewal failed');
    } finally {
      setIsRenewing(false);
    }
  };

  const copyResetCredentials = () => {
    if (!resetCredentialResult || !madrasa) return;
    const text =
      `MadrasaNexa Password Reset\n` +
      `Institution: ${madrasa.name} (${madrasa.code})\n` +
      `Admin Email: ${resetCredentialResult.email}\n` +
      `Temporary Password: ${resetCredentialResult.temporaryPassword}\n` +
      `Login URL: ${window.location.origin}/login\n\n` +
      `Note: You will be prompted to change your password immediately upon signing in.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3]" />
        <p className="text-xs text-[#7C8A9A]">Loading Madrasa details...</p>
      </div>
    );
  }

  if (error || !madrasa) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
        <p>{error || 'Madrasa not found'}</p>
        <Link to="/super-admin/madrasas" className="mt-3 inline-block font-semibold underline">
          &larr; Back to Madrasas
        </Link>
      </div>
    );
  }

  const latestSub = madrasa.activeSubscription || madrasa.subscriptions?.[0];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Status Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/super-admin/madrasas"
            className="p-2.5 bg-white border border-[#E7E9EE] hover:bg-[#F7F6F1] rounded-xl text-[#7C8A9A] hover:text-[#0F172A] transition shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-3">
            {/* Dynamic Avatar/Logo */}
            <div className="w-12 h-12 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden shadow-xs border border-[#E7E9EE]">
              {madrasa.branding?.logoUrl || madrasa.logoUrl ? (
                <img
                  src={madrasa.branding?.logoUrl || madrasa.logoUrl || ''}
                  alt={madrasa.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{madrasa.branding?.initials || madrasa.initials || 'MN'}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">{madrasa.name}</h1>
                {/* Lifecycle Badge */}
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    madrasa.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : madrasa.status === 'SUSPENDED'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {madrasa.status}
                </span>
                {/* Subscription Badge */}
                {latestSub && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      latestSub.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : latestSub.status === 'EXPIRING_SOON'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    SUB: {latestSub.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#7C8A9A] mt-0.5">
                Code: <strong className="font-mono text-[#0F172A]">{madrasa.code}</strong> &bull; Slug:{' '}
                <span className="font-mono text-[#0F172A]">{madrasa.slug}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Status Lifecycle Buttons */}
        <div className="flex items-center gap-2">
          {madrasa.status === 'SUSPENDED' && (
            <button
              onClick={() => setPendingLifecycleAction('activate')}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reactivate</span>
            </button>
          )}

          {madrasa.status === 'ACTIVE' && (
            <button
              onClick={() => setPendingLifecycleAction('suspend')}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <PauseCircle className="w-3.5 h-3.5" />
              <span>Suspend</span>
            </button>
          )}

          {madrasa.status !== 'ARCHIVED' && (
            <button
              onClick={() => setPendingLifecycleAction('archive')}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Archive</span>
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Feedback Banner */}
      {feedbackNotice && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in ${
            feedbackNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackNotice.type === 'success' ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedbackNotice.message}</span>
          </div>
          <button
            onClick={() => setFeedbackNotice(null)}
            className="p-1 hover:bg-black/5 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION E: USAGE & WORKSPACE SUMMARY METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Active Students */}
        <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#7C8A9A] uppercase tracking-wider">
              Students
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-[#0F172A]">
              {madrasa.usage?.activeStudents ?? 0}
            </span>
            <span className="text-[11px] text-[#7C8A9A] block mt-0.5">
              Active ({madrasa.usage?.totalStudents ?? 0} Total)
            </span>
          </div>
        </div>

        {/* Classes */}
        <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#7C8A9A] uppercase tracking-wider">
              Classes
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-[#0F172A]">
              {madrasa.usage?.classes ?? 0}
            </span>
            <span className="text-[11px] text-[#7C8A9A] block mt-0.5">Academic Classes</span>
          </div>
        </div>

        {/* Invoices */}
        <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#7C8A9A] uppercase tracking-wider">
              Invoices
            </span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-[#0F172A]">
              {madrasa.usage?.invoices ?? 0}
            </span>
            <span className="text-[11px] text-[#7C8A9A] block mt-0.5">Fee Invoices</span>
          </div>
        </div>

        {/* Payments */}
        <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#7C8A9A] uppercase tracking-wider">
              Payments
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-[#0F172A]">
              {madrasa.usage?.payments ?? 0}
            </span>
            <span className="text-[11px] text-[#7C8A9A] block mt-0.5">Recorded Transactions</span>
          </div>
        </div>
      </div>

      {/* SECTIONS A & B: INSTITUTION IDENTITY & CONTACT DETAILS */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#37C6A3]" />
            <h2 className="font-bold text-sm text-[#0F172A]">Institution Profile & Identity</h2>
          </div>
          <button
            onClick={() => setIsEditOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F6F1] hover:bg-[#E7E9EE] text-[#0F172A] rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-[#F7F6F1] rounded-xl">
            <span className="text-[#7C8A9A] block text-[10px] uppercase font-semibold">Official Email</span>
            <span className="font-semibold text-[#0F172A] mt-0.5 block">{madrasa.email || 'None'}</span>
          </div>
          <div className="p-3.5 bg-[#F7F6F1] rounded-xl">
            <span className="text-[#7C8A9A] block text-[10px] uppercase font-semibold">Contact Phone</span>
            <span className="font-semibold text-[#0F172A] mt-0.5 block">{madrasa.phone || 'None'}</span>
          </div>
          <div className="p-3.5 bg-[#F7F6F1] rounded-xl">
            <span className="text-[#7C8A9A] block text-[10px] uppercase font-semibold">Onboarded Since</span>
            <span className="font-semibold text-[#0F172A] mt-0.5 block">
              {new Date(madrasa.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="sm:col-span-2 p-3.5 bg-[#F7F6F1] rounded-xl">
            <span className="text-[#7C8A9A] block text-[10px] uppercase font-semibold">Campus Address</span>
            <span className="font-semibold text-[#0F172A] mt-0.5 block">{madrasa.address || 'No address specified'}</span>
          </div>
          <div className="p-3.5 bg-[#F7F6F1] rounded-xl">
            <span className="text-[#7C8A9A] block text-[10px] uppercase font-semibold">Academic Year / Timezone</span>
            <span className="font-semibold text-[#0F172A] mt-0.5 block">
              {madrasa.settings?.academicYear || 'Current'} &bull; {madrasa.settings?.timezone || 'UTC'}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION C: TENANT ADMINISTRATORS */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#E7E9EE] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-sm text-[#0F172A]">Tenant Administrators</h2>
          </div>
          <span className="text-xs text-[#7C8A9A]">
            {madrasa.admins?.length ?? 0} Designated Admin(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F6F1] text-[#7C8A9A] font-semibold border-b border-[#E7E9EE]">
              <tr>
                <th className="px-5 py-3">Administrator</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Account Status</th>
                <th className="px-5 py-3">Password Status</th>
                <th className="px-5 py-3">Last Login</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E9EE]">
              {madrasa.admins?.map((adm) => (
                <tr key={adm.id} className="hover:bg-[#F7F6F1]/50 transition">
                  <td className="px-5 py-3 font-semibold text-[#0F172A]">{adm.name}</td>
                  <td className="px-5 py-3 text-[#7C8A9A] font-mono">{adm.email}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        adm.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {adm.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {adm.mustChangePassword ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800">
                        MUST CHANGE PASSWORD
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        PERMANENT SET
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[#7C8A9A]">
                    {adm.lastLoginAt ? new Date(adm.lastLoginAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button
                      onClick={() => setResetAdminUser(adm)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FFD978] hover:bg-[#ffe18f] text-[#0F172A] rounded-xl text-[11px] font-semibold transition cursor-pointer shadow-xs"
                    >
                      <Key className="w-3 h-3" />
                      <span>Reset Password</span>
                    </button>
                    <button
                      onClick={() => handleToggleAdminActive(adm.id, adm.isActive)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                        adm.isActive
                          ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {adm.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION D: SUBSCRIPTION HISTORY & TERMS */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#E7E9EE] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <h2 className="font-bold text-sm text-[#0F172A]">Subscription History & Terms</h2>
          </div>
          <button
            onClick={() => setIsRenewOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Renew Subscription</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F6F1] text-[#7C8A9A] font-semibold border-b border-[#E7E9EE]">
              <tr>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Duration</th>
                <th className="px-5 py-3">Term Period</th>
                <th className="px-5 py-3">Term Status</th>
                <th className="px-5 py-3">Days Remaining</th>
                <th className="px-5 py-3">Price Paid</th>
                <th className="px-5 py-3">Renewed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E9EE]">
              {madrasa.subscriptions?.map((s) => (
                <tr key={s.id} className="hover:bg-[#F7F6F1]/50 transition">
                  <td className="px-5 py-3 font-semibold text-[#0F172A]">
                    {s.plan?.name || 'Active Plan'}
                  </td>
                  <td className="px-5 py-3 text-[#7C8A9A]">
                    {s.durationMonthsAtPurchase || s.plan?.durationMonths} months
                  </td>
                  <td className="px-5 py-3 font-mono text-[11px] text-[#0F172A]">
                    {new Date(s.startsAt).toLocaleDateString()} &rarr;{' '}
                    {new Date(s.endsAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700'
                          : s.status === 'EXPIRING_SOON'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-bold text-[#0F172A]">
                    {s.daysRemaining !== null && s.daysRemaining !== undefined
                      ? `${s.daysRemaining} days`
                      : '-'}
                  </td>
                  <td className="px-5 py-3 font-mono text-[#0F172A]">
                    ${Number(s.priceAtPurchase || 0).toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-[#7C8A9A]">
                    {s.renewedAt ? new Date(s.renewedAt).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION F: DYNAMIC BRANDING */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#37C6A3]" />
            <h2 className="font-bold text-sm text-[#0F172A]">Institution Branding & Visual Identity</h2>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-[#F7F6F1] rounded-2xl">
          <div className="w-20 h-20 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden shadow-md border-2 border-white">
            {madrasa.branding?.logoUrl || madrasa.logoUrl ? (
              <img
                src={madrasa.branding?.logoUrl || madrasa.logoUrl || ''}
                alt={madrasa.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{madrasa.branding?.initials || madrasa.initials || 'MN'}</span>
            )}
          </div>
          <div className="space-y-1 text-xs text-center sm:text-left">
            <div className="font-bold text-sm text-[#0F172A]">
              {madrasa.branding?.logoUrl ? 'Custom Dynamic Logo Active' : 'Fallback Visual Initials Active'}
            </div>
            <p className="text-[#7C8A9A]">
              {madrasa.branding?.logoUrl
                ? 'Resolved securely via Cloudflare R2 storage bucket.'
                : 'Generated automatically from the official Madrasa Name initials.'}
            </p>
            {madrasa.logoFileId && (
              <div className="font-mono text-[10px] text-[#7C8A9A]">
                File Object ID: {madrasa.logoFileId}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION G: ACTIVITY TIMELINE */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-600" />
            <h2 className="font-bold text-sm text-[#0F172A]">Institutional Activity Timeline</h2>
          </div>
          <span className="text-xs text-[#7C8A9A]">Audit Trail</span>
        </div>

        {madrasa.recentActivity && madrasa.recentActivity.length > 0 ? (
          <div className="space-y-4 border-l-2 border-[#E7E9EE] ml-3 pl-4">
            {madrasa.recentActivity.map((act) => (
              <div key={act.id} className="relative space-y-1">
                <div className="w-2.5 h-2.5 rounded-full bg-[#37C6A3] absolute -left-[21px] top-1.5" />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs text-[#0F172A] font-mono">
                    {act.action}
                  </span>
                  <span className="text-[10px] text-[#7C8A9A]">
                    {new Date(act.createdAt).toLocaleString()}
                  </span>
                  {act.user && (
                    <span className="text-[10px] text-[#7C8A9A] bg-[#F7F6F1] px-1.5 py-0.5 rounded">
                      by {act.user.name} ({act.user.role})
                    </span>
                  )}
                </div>
                {act.metadata && (
                  <pre className="text-[10px] bg-[#F7F6F1] p-2 rounded-lg text-[#0F172A] font-mono overflow-x-auto max-w-xl">
                    {JSON.stringify(act.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-[#7C8A9A]">
            No recent activity logs recorded for this institution.
          </div>
        )}
      </div>

      {/* MODAL: CONFIRM LIFECYCLE ACTION */}
      {pendingLifecycleAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E7E9EE] space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl ${
                  pendingLifecycleAction === 'archive'
                    ? 'bg-red-50 text-red-700'
                    : pendingLifecycleAction === 'suspend'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {pendingLifecycleAction === 'archive' ? (
                  <Archive className="w-6 h-6" />
                ) : pendingLifecycleAction === 'suspend' ? (
                  <PauseCircle className="w-6 h-6" />
                ) : (
                  <RotateCcw className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-base text-[#0F172A]">
                  {pendingLifecycleAction === 'archive'
                    ? 'Archive Institution'
                    : pendingLifecycleAction === 'suspend'
                    ? 'Suspend Institution'
                    : 'Reactivate Institution'}
                </h3>
                <p className="text-xs text-[#7C8A9A]">{madrasa.name}</p>
              </div>
            </div>

            <div className="p-4 bg-[#F7F6F1] rounded-2xl text-xs space-y-2 text-[#0F172A]">
              {pendingLifecycleAction === 'suspend' && (
                <p>
                  Suspending this institution will <strong>block workspace access</strong> for tenant
                  administrators, but <strong>will NOT delete any data</strong>. All students,
                  classes, invoices, and historical records remain intact.
                </p>
              )}
              {pendingLifecycleAction === 'archive' && (
                <p>
                  Archiving this institution will disable workspace access and{' '}
                  <strong>preserve all historical business data</strong> indefinitely. No records
                  are hard-deleted.
                </p>
              )}
              {pendingLifecycleAction === 'activate' && (
                <p>
                  Reactivating this institution will restore access. Note that if the
                  institution's subscription is <strong>EXPIRED</strong>, subscription locking will
                  continue to protect business modules until renewed.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isChangingStatus}
                onClick={() => setPendingLifecycleAction(null)}
                className="px-4 py-2.5 bg-[#F7F6F1] text-[#0F172A] hover:bg-[#E7E9EE] rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isChangingStatus}
                onClick={confirmLifecycleTransition}
                className={`px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition cursor-pointer flex items-center gap-1.5 shadow-xs ${
                  pendingLifecycleAction === 'archive'
                    ? 'bg-red-600 hover:bg-red-700'
                    : pendingLifecycleAction === 'suspend'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isChangingStatus ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>
                  Confirm{' '}
                  {pendingLifecycleAction === 'archive'
                    ? 'Archive'
                    : pendingLifecycleAction === 'suspend'
                    ? 'Suspend'
                    : 'Reactivate'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: EDIT PROFILE */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E7E9EE] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E9EE]">
              <h3 className="font-bold text-base text-[#0F172A]">Edit Madrasa Profile</h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="p-1 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Madrasa Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E7E9EE]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Official Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E7E9EE]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E7E9EE]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Campus Address</label>
                <textarea
                  rows={2}
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E7E9EE]"
                />
              </div>

              <div className="pt-3 border-t border-[#E7E9EE] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 bg-[#F7F6F1] text-[#0F172A] rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-[#0F172A] text-white rounded-xl font-semibold cursor-pointer"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESET ADMIN PASSWORD */}
      {resetAdminUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E7E9EE] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E9EE]">
              <div>
                <h3 className="font-bold text-base text-[#0F172A]">Reset Administrator Password</h3>
                <p className="text-xs text-[#7C8A9A]">
                  {resetAdminUser.name} ({resetAdminUser.email})
                </p>
              </div>
              <button
                onClick={() => setResetAdminUser(null)}
                className="p-1 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <p className="text-[#7C8A9A]">
                Resetting this administrator's password will enforce{' '}
                <code className="text-[#0F172A]">mustChangePassword = true</code>. They will be
                forced to choose a new secure password upon logging in.
              </p>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">
                  Custom Temporary Password (Optional)
                </label>
                <input
                  type="text"
                  value={customTempPassword}
                  onChange={(e) => setCustomTempPassword(e.target.value)}
                  placeholder="Leave empty to auto-generate a secure password"
                  className="w-full px-3 py-2 rounded-xl border border-[#E7E9EE] font-mono text-xs"
                />
              </div>

              <div className="pt-3 border-t border-[#E7E9EE] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetAdminUser(null)}
                  className="px-4 py-2 bg-[#F7F6F1] text-[#0F172A] rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-4 py-2 bg-[#FFD978] text-[#0F172A] hover:bg-[#ffe18f] rounded-xl font-semibold cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  {isResetting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Key className="w-3.5 h-3.5" />
                  )}
                  <span>Confirm Reset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ONE-TIME RESET CREDENTIAL DISPLAY */}
      {resetCredentialResult && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E7E9EE] space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#0F172A]">Password Reset Successfully</h3>
              <p className="text-xs text-[#7C8A9A]">New temporary credentials provisioned.</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#0F172A] text-white space-y-2 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Admin Email:</span>
                <span className="text-white">{resetCredentialResult.email}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/10">
                <span className="text-[#FFD978] font-bold">Temporary Password:</span>
                <span className="font-bold text-sm text-[#FFD978] bg-white/10 px-2 py-0.5 rounded">
                  {resetCredentialResult.temporaryPassword}
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Note:</strong> This temporary password will NOT be shown again. Please copy
                and provide it to the administrator securely now.
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={copyResetCredentials}
                className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold bg-[#FFD978] text-[#0F172A] hover:bg-[#ffe18f] transition cursor-pointer shadow-xs"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Credentials Copied!' : 'Copy Credentials'}</span>
              </button>
              <button
                onClick={() => setResetCredentialResult(null)}
                className="px-5 h-11 bg-[#F7F6F1] text-[#0F172A] hover:bg-[#E7E9EE] rounded-xl text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: RENEW SUBSCRIPTION */}
      {isRenewOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E7E9EE] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E9EE]">
              <div>
                <h3 className="font-bold text-base text-[#0F172A]">Renew Subscription</h3>
                <p className="text-xs text-[#7C8A9A]">{madrasa.name}</p>
              </div>
              <button
                onClick={() => setIsRenewOpen(false)}
                className="p-1 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {renewError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {renewError}
              </div>
            )}

            <form onSubmit={handleRenewSubscription} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Select Plan</label>
                <select
                  required
                  value={renewForm.planId}
                  onChange={(e) => setRenewForm({ ...renewForm, planId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E7E9EE] bg-white"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.durationMonths} mos) - ${Number(p.price).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Payment Method</label>
                  <select
                    value={renewForm.paymentMethod}
                    onChange={(e) =>
                      setRenewForm({ ...renewForm, paymentMethod: e.target.value as any })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#E7E9EE] bg-white"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Credit/Debit Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Payment Ref</label>
                  <input
                    type="text"
                    value={renewForm.reference}
                    onChange={(e) => setRenewForm({ ...renewForm, reference: e.target.value })}
                    placeholder="e.g. REC-1234"
                    className="w-full px-3 py-2 rounded-xl border border-[#E7E9EE]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Payment Notes</label>
                <textarea
                  rows={2}
                  value={renewForm.notes}
                  onChange={(e) => setRenewForm({ ...renewForm, notes: e.target.value })}
                  placeholder="Renewal remarks or transaction confirmation"
                  className="w-full px-3 py-2 rounded-xl border border-[#E7E9EE]"
                />
              </div>

              <div className="pt-3 border-t border-[#E7E9EE] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRenewOpen(false)}
                  className="px-4 py-2 bg-[#F7F6F1] text-[#0F172A] rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRenewing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  {isRenewing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Confirm Renewal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
