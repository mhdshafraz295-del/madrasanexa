import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  apiGetStudent,
  apiGetStudentFeeHistory,
  apiSetStudentFeeOverride,
  apiUseClassDefaultFee,
  apiActivateStudent,
  apiInactivateStudent,
  apiArchiveStudent,
  apiGetStudentInvoices,
  apiGetStudentMonthlyLedger,
  apiGetStudentPayments,
  type StudentDetail,
  type StudentFeeHistoryItem,
  type InvoiceListItem,
  type StudentMonthlyLedgerResponse,
  type StudentLedgerAllocationItem,
  type PaymentListItem,
} from '../../services/api';
import { StudentRecordsPanels } from '../../components/students/StudentRecordsPanels';
import {
  ArrowLeft,
  Edit2,
  BookOpen,
  Phone,
  MessageSquare,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  AlertCircle,
  Loader2,
  Archive,
  RotateCcw,
  Sparkles,
  History,
  MapPin,
  UserCheck,
  UserX,
  Receipt,
  Eye,
  ChevronLeft,
  ChevronRight,
  Coins,
  Banknote,
  CheckCircle2,
  Ban,
  ExternalLink,
  ReceiptText,
  Award,
  ShieldAlert,
  Users,
  CalendarClock,
  ShieldCheck,
} from 'lucide-react';

type StudentProfileTab =
  | 'LEDGER'
  | 'INVOICES'
  | 'PAYMENTS'
  | 'PROFILE'
  | 'QUALIFICATIONS'
  | 'DISCIPLINE'
  | 'MEETINGS'
  | 'FOLLOW_UPS'
  | 'TIMELINE';

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [feeHistory, setFeeHistory] = useState<StudentFeeHistoryItem[]>([]);
  const [feeHistoryLoading, setFeeHistoryLoading] = useState(false);
  const [feeHistoryError, setFeeHistoryError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Set Fee Override Modal
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    monthlyFee: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
    reason: '',
  });
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // Revert to Class Default Modal
  const [isRevertModalOpen, setIsRevertModalOpen] = useState(false);
  const [revertForm, setRevertForm] = useState({
    effectiveDate: new Date().toISOString().split('T')[0],
    reason: 'Reverted to class standard fee',
  });
  const [isSubmittingRevert, setIsSubmittingRevert] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);

  // Status Action Modal
  const [statusAction, setStatusAction] = useState<'ACTIVATE' | 'INACTIVATE' | 'ARCHIVE' | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Invoices & Billing History
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [invoicesTotal, setInvoicesTotal] = useState(0);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Tab state (supports deep-linking via ?tab=FOLLOW_UPS etc.)
  const initialTabParam = searchParams.get('tab') as StudentProfileTab | null;
  const [activeTab, setActiveTab] = useState<StudentProfileTab>(
    initialTabParam &&
      [
        'LEDGER',
        'INVOICES',
        'PAYMENTS',
        'PROFILE',
        'QUALIFICATIONS',
        'DISCIPLINE',
        'MEETINGS',
        'FOLLOW_UPS',
        'TIMELINE',
      ].includes(initialTabParam)
      ? initialTabParam
      : 'LEDGER'
  );

  // Phase 10 Monthly Ledger
  const [ledgerYear, setLedgerYear] = useState<number>(new Date().getFullYear());
  const [ledgerData, setLedgerData] = useState<StudentMonthlyLedgerResponse | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [activeAllocationsModal, setActiveAllocationsModal] = useState<{
    monthName: string;
    allocations: StudentLedgerAllocationItem[];
  } | null>(null);

  // Phase 10 Student Payments
  const [studentPayments, setStudentPayments] = useState<PaymentListItem[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsTotal, setPaymentsTotal] = useState(0);

  const loadLedgerData = useCallback(async (year: number) => {
    if (!id) return;
    try {
      setLedgerLoading(true);
      setLedgerError(null);
      const data = await apiGetStudentMonthlyLedger(id, year);
      setLedgerData(data);
    } catch (err: any) {
      console.error('Failed to load student monthly ledger:', err);
      setLedgerError(err.response?.data?.message || 'Failed to load monthly fee ledger.');
    } finally {
      setLedgerLoading(false);
    }
  }, [id]);

  const loadPaymentsData = useCallback(async (p: number) => {
    if (!id) return;
    try {
      setPaymentsLoading(true);
      const data = await apiGetStudentPayments(id, { page: p, pageSize: 10 });
      setStudentPayments(data.items);
      setPaymentsTotal(data.pagination.total);
    } catch (err) {
      console.error('Failed to load student payments:', err);
    } finally {
      setPaymentsLoading(false);
    }
  }, [id]);

  const loadStudentData = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setInvoicesLoading(true);
      setFeeHistoryLoading(true);
      setError(null);
      setFeeHistoryError(null);
      const [studentData, historyData, invoicesData] = await Promise.all([
        apiGetStudent(id),
        apiGetStudentFeeHistory(id).catch((err: any) => {
          console.error('Failed to load student fee history:', err);
          setFeeHistoryError(err.response?.data?.message || 'Failed to load fee override history.');
          return null;
        }),
        apiGetStudentInvoices(id, { page: invoicesPage, pageSize: 10 }).catch(() => ({ items: [], pagination: { total: 0 } })),
      ]);
      setStudent(studentData);
      const parsedHistory: StudentFeeHistoryItem[] = Array.isArray(historyData)
        ? historyData
        : Array.isArray((historyData as any)?.history)
        ? (historyData as any).history
        : Array.isArray((studentData as any)?.feeHistory)
        ? (studentData as any).feeHistory
        : [];
      setFeeHistory(parsedHistory);
      setInvoices(invoicesData.items || []);
      setInvoicesTotal(invoicesData.pagination?.total || 0);
    } catch (err: any) {
      console.error('Failed to load student details:', err);
      setError(err.response?.data?.message || 'Failed to load student dossier.');
    } finally {
      setIsLoading(false);
      setInvoicesLoading(false);
      setFeeHistoryLoading(false);
    }
  }, [id, invoicesPage]);

  useEffect(() => {
    loadStudentData();
    loadLedgerData(ledgerYear);
    loadPaymentsData(paymentsPage);
  }, [loadStudentData, loadLedgerData, loadPaymentsData, ledgerYear, paymentsPage]);

  // Handle Set Override
  const handleSetOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    const feeNum = parseFloat(overrideForm.monthlyFee);
    if (isNaN(feeNum) || feeNum < 0) {
      setOverrideError('Please provide a valid non-negative fee amount.');
      return;
    }
    if (!overrideForm.effectiveFrom) {
      setOverrideError('Effective date is required.');
      return;
    }

    try {
      setIsSubmittingOverride(true);
      setOverrideError(null);
      await apiSetStudentFeeOverride(id, {
        monthlyFee: feeNum,
        effectiveFrom: overrideForm.effectiveFrom,
        reason: overrideForm.reason.trim() || null,
      });

      setIsOverrideModalOpen(false);
      setOverrideForm({
        monthlyFee: '',
        effectiveFrom: new Date().toISOString().split('T')[0],
        reason: '',
      });
      loadStudentData();
    } catch (err: any) {
      console.error('Failed to set fee override:', err);
      setOverrideError(err.response?.data?.message || 'Failed to record fee override.');
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Handle Revert to Class Default
  const handleRevertClassDefault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      setIsSubmittingRevert(true);
      setRevertError(null);
      await apiUseClassDefaultFee(id, {
        effectiveDate: revertForm.effectiveDate,
        reason: revertForm.reason.trim() || null,
      });

      setIsRevertModalOpen(false);
      loadStudentData();
    } catch (err: any) {
      console.error('Failed to revert to class default:', err);
      setRevertError(err.response?.data?.message || 'Failed to restore class default fee.');
    } finally {
      setIsSubmittingRevert(false);
    }
  };

  // Handle Status Transitions
  const handleExecuteStatusChange = async () => {
    if (!id || !statusAction) return;

    try {
      setIsUpdatingStatus(true);
      if (statusAction === 'ACTIVATE') {
        await apiActivateStudent(id);
      } else if (statusAction === 'INACTIVATE') {
        await apiInactivateStudent(id);
      } else if (statusAction === 'ARCHIVE') {
        await apiArchiveStudent(id);
      }

      setStatusAction(null);
      loadStudentData();
    } catch (err: any) {
      console.error('Failed to change student status:', err);
      alert(err.response?.data?.message || 'Failed to update student status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-[#E7E9EE] p-16 flex flex-col items-center justify-center text-[#7C8A9A]">
        <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3] mb-3" />
        <p className="text-xs font-medium">Loading student dossier...</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center max-w-lg mx-auto">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <p className="text-xs text-rose-700 font-medium">{error || 'Student not found.'}</p>
        <Link
          to="/madrasa-admin/students"
          className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F172A] text-white text-xs font-semibold rounded-xl hover:bg-[#0F172A]/90 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Students Directory</span>
        </Link>
      </div>
    );
  }

  const initials = student.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');

  const activeFeeSetting =
    student.activeFeeSetting ||
    (student.feeSource === 'STUDENT_OVERRIDE' && Array.isArray(feeHistory)
      ? feeHistory.find((item) => item.isCurrent || !item.effectiveTo)
      : null);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/madrasa-admin/students"
            className="p-2 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-white rounded-xl border border-[#E7E9EE] transition shadow-xs shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="font-mono text-xs font-bold bg-[#E7E9EE] text-[#0F172A] px-2 py-0.5 rounded">
              {student.admissionNo}
            </span>
            <span className="text-xs text-[#7C8A9A]">/ Student Dossier</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/madrasa-admin/students/${student.id}/edit`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E7E9EE] hover:bg-[#F7F6F1] text-[#0F172A] text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <Edit2 className="w-3.5 h-3.5 text-[#7C8A9A]" />
            <span>Edit Profile</span>
          </Link>

          <Link
            to="/madrasa-admin/alumni-network"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-[#075E46] text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#075E46]" />
            <span>Alumni Network</span>
          </Link>

          {/* Status Actions */}
          {student.status === 'ACTIVE' && (
            <>
              <button
                onClick={() => setStatusAction('INACTIVATE')}
                className="px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 transition"
              >
                Inactivate
              </button>
              <button
                onClick={() => setStatusAction('ARCHIVE')}
                className="px-3 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 transition"
              >
                Archive
              </button>
            </>
          )}
          {student.status === 'INACTIVE' && (
            <>
              <button
                onClick={() => setStatusAction('ACTIVATE')}
                className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition"
              >
                Activate
              </button>
              <button
                onClick={() => setStatusAction('ARCHIVE')}
                className="px-3 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 transition"
              >
                Archive
              </button>
            </>
          )}
          {student.status === 'ARCHIVED' && (
            <button
              onClick={() => setStatusAction('ACTIVATE')}
              className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition"
            >
              Reactivate Student
            </button>
          )}
        </div>
      </div>

      {/* Main Student Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white flex items-center justify-center font-bold text-xl tracking-wider shadow-sm">
            {initials || 'ST'}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">{student.fullName}</h1>
              {student.status === 'ACTIVE' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              )}
              {student.status === 'INACTIVE' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Inactive
                </span>
              )}
              {student.status === 'ARCHIVED' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  <Archive className="w-3 h-3 text-purple-500" />
                  Archived
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#7C8A9A]">
              <span>
                Admission #: <span className="font-mono font-bold text-[#0F172A]">{student.admissionNo}</span>
              </span>
              <span>•</span>
              <span>
                Joined {new Date(student.admissionDate || student.joinedAt || Date.now()).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Academic / Class Section */}
        <div className="bg-[#F7F6F1] p-4 rounded-xl border border-[#E7E9EE] min-w-[220px]">
          <span className="text-[10px] font-bold text-[#7C8A9A] uppercase tracking-wider block mb-1">Class & Section</span>
          {student.class?.name ? (
            <div>
              {student.class.academicSection && (
                <div className="text-[10px] font-bold text-[#08483A] bg-[#08483A]/10 px-2 py-0.5 rounded border border-[#08483A]/20 w-fit mb-1.5">
                  {student.class.academicSection.name} {student.class.academicSection.code ? `(${student.class.academicSection.code})` : ''}
                </div>
              )}
              <div className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <span>{student.class.name}</span>
              </div>
              <div className="text-[11px] text-[#7C8A9A] mt-0.5 font-mono">
                {student.class.code ? `Code: ${student.class.code} • ` : ''}Base Fee: LKR {student.class.defaultMonthlyFee || '0.00'}
              </div>
            </div>
          ) : (
            <div className="text-sm font-bold text-[#7C8A9A]">Unassigned</div>
          )}
        </div>
      </div>

      {/* Phase 10 Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-[#E7E9EE] pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'LEDGER'
              ? 'text-[#08483A] border-[#08483A] bg-white shadow-xs'
              : 'text-[#5B6B7F] border-transparent hover:text-[#0F172A]'
          }`}
        >
          <Coins className="w-4 h-4 text-emerald-700" />
          <span>Monthly Fee Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('INVOICES')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'INVOICES'
              ? 'text-[#08483A] border-[#08483A] bg-white shadow-xs'
              : 'text-[#5B6B7F] border-transparent hover:text-[#0F172A]'
          }`}
        >
          <Receipt className="w-4 h-4 text-blue-600" />
          <span>Invoices ({invoicesTotal})</span>
        </button>

        <button
          onClick={() => setActiveTab('PAYMENTS')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'PAYMENTS'
              ? 'text-[#08483A] border-[#08483A] bg-white shadow-xs'
              : 'text-[#5B6B7F] border-transparent hover:text-[#0F172A]'
          }`}
        >
          <Banknote className="w-4 h-4 text-emerald-600" />
          <span>Payments ({paymentsTotal})</span>
        </button>

        <button
          onClick={() => setActiveTab('PROFILE')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'PROFILE'
              ? 'text-[#08483A] border-[#08483A] bg-white shadow-xs'
              : 'text-[#5B6B7F] border-transparent hover:text-[#0F172A]'
          }`}
        >
          <UserCheck className="w-4 h-4 text-purple-600" />
          <span>Profile & Fee Overrides</span>
        </button>

        <button
          onClick={() => setActiveTab('QUALIFICATIONS')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'QUALIFICATIONS'
              ? 'text-[#08483A] border-[#08483A] bg-white shadow-xs'
              : 'text-[#5B6B7F] border-transparent hover:text-[#0F172A]'
          }`}
        >
          <Award className="w-4 h-4 text-amber-600" />
          <span>Qualifications & Certificates</span>
        </button>

        <button
          onClick={() => setActiveTab('DISCIPLINE')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'DISCIPLINE'
              ? 'text-[#08483A] border-[#08483A] bg-white shadow-xs'
              : 'text-[#5B6B7F] border-transparent hover:text-[#0F172A]'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-600" />
          <span>Discipline & Incidents</span>
        </button>

        <button
          onClick={() => setActiveTab('MEETINGS')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'MEETINGS'
              ? 'text-[#08483A] border-[#08483A] bg-white shadow-xs'
              : 'text-[#5B6B7F] border-transparent hover:text-[#0F172A]'
          }`}
        >
          <Users className="w-4 h-4 text-indigo-600" />
          <span>Meetings</span>
        </button>

        <button
          onClick={() => setActiveTab('FOLLOW_UPS')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'FOLLOW_UPS'
              ? 'text-[#08483A] border-[#08483A] bg-white shadow-xs'
              : 'text-[#5B6B7F] border-transparent hover:text-[#0F172A]'
          }`}
        >
          <CalendarClock className="w-4 h-4 text-teal-600" />
          <span>Follow-Ups & Reminders</span>
        </button>

        <button
          onClick={() => setActiveTab('TIMELINE')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'TIMELINE'
              ? 'text-[#08483A] border-[#08483A] bg-white shadow-xs'
              : 'text-[#5B6B7F] border-transparent hover:text-[#0F172A]'
          }`}
        >
          <History className="w-4 h-4 text-slate-600" />
          <span>Timeline</span>
        </button>
      </div>

      {/* TAB 1: MONTHLY FEE LEDGER */}
      {activeTab === 'LEDGER' && (
        <div className="space-y-6">
          {/* Ledger Controls & Year Switcher */}
          <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-[#F8F9FA] rounded-xl border border-[#E7E9EE] p-1">
                <button
                  onClick={() => setLedgerYear((y) => y - 1)}
                  className="p-1.5 rounded-lg hover:bg-white text-[#5B6B7F] hover:text-[#0F172A] transition"
                  title="Previous Year"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 text-sm font-bold text-[#0F172A]">{ledgerYear}</span>
                <button
                  onClick={() => setLedgerYear((y) => y + 1)}
                  className="p-1.5 rounded-lg hover:bg-white text-[#5B6B7F] hover:text-[#0F172A] transition"
                  title="Next Year"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <span className="text-xs text-[#5B6B7F]">12-Month Academic & Tuition Ledger</span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/madrasa-admin/fee-pos"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#08483A] hover:bg-[#073d31] rounded-xl transition shadow-xs"
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Open Fee POS</span>
              </Link>
            </div>
          </div>

          {/* Ledger KPI Summary Cards */}
          {ledgerData?.summary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
                <span className="text-xs font-bold text-[#7C8A9A] uppercase tracking-wider block">Total Expected</span>
                <div className="text-xl font-black text-[#0F172A] mt-1">
                  LKR {Number(ledgerData.summary.totalExpected).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-[#7C8A9A] mt-0.5">Billed tuition for {ledgerYear}</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">Total Paid</span>
                <div className="text-xl font-black text-emerald-800 mt-1">
                  LKR {Number(ledgerData.summary.totalPaid).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-emerald-600/80 mt-0.5">
                  {ledgerData.summary.paidMonthsCount} months fully paid
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
                <span className="text-xs font-bold text-red-600 uppercase tracking-wider block">Outstanding Balance</span>
                <div className="text-xl font-black text-red-600 mt-1">
                  LKR {Number(ledgerData.summary.totalBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-red-500 mt-0.5">
                  {ledgerData.summary.pendingMonthsCount + ledgerData.summary.overdueMonthsCount + ledgerData.summary.partialMonthsCount} months with balance
                </p>
              </div>
            </div>
          )}

          {/* 12-Month Table */}
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
            {ledgerLoading ? (
              <div className="py-16 text-center text-[#5B6B7F]">
                <Loader2 className="w-8 h-8 animate-spin text-[#08483A] mx-auto mb-2" />
                <p className="text-xs">Loading ledger for {ledgerYear}...</p>
              </div>
            ) : ledgerError ? (
              <div className="p-6 text-center text-red-700 bg-red-50">
                <AlertCircle className="w-6 h-6 mx-auto mb-1" />
                <p className="text-xs font-semibold">{ledgerError}</p>
              </div>
            ) : !ledgerData ? null : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F8F9FA] border-b border-[#E7E9EE] text-[#7C8A9A] font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Month</th>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4 text-right">Expected (LKR)</th>
                      <th className="py-3 px-4 text-right">Paid (LKR)</th>
                      <th className="py-3 px-4 text-right">Balance (LKR)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E9EE]">
                    {ledgerData.months.map((m) => (
                      <tr key={m.month} className="hover:bg-gray-50/50 transition">
                        <td className="py-3.5 px-4 font-bold text-[#0F172A]">
                          {m.monthName} {ledgerYear}
                        </td>
                        <td className="py-3.5 px-4">
                          {m.invoiceId ? (
                            <Link
                              to={`/madrasa-admin/invoices/${m.invoiceId}`}
                              className="font-mono text-xs font-bold text-emerald-800 hover:underline"
                            >
                              {m.invoiceNo}
                            </Link>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-gray-700">
                          {m.expectedAmount ? Number(m.expectedAmount).toFixed(2) : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-700">
                          {Number(m.paidAmount).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold">
                          {Number(m.balanceAmount) > 0 ? (
                            <span className="text-red-600">{Number(m.balanceAmount).toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-400">0.00</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {m.displayStatus === 'PAID' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Paid
                            </span>
                          )}
                          {m.displayStatus === 'PARTIAL' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              Partial
                            </span>
                          )}
                          {m.displayStatus === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Pending
                            </span>
                          )}
                          {m.displayStatus === 'OVERDUE' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                              <Clock className="w-3 h-3" /> Overdue
                            </span>
                          )}
                          {m.displayStatus === 'VOID' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-300">
                              <Ban className="w-3 h-3" /> Void
                            </span>
                          )}
                          {m.displayStatus === 'NOT_GENERATED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-50 text-gray-500 border border-dashed border-gray-300">
                              Not Generated
                            </span>
                          )}
                          {m.displayStatus === 'NOT_ADMITTED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-400">
                              Not Admitted
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                          {/* View Payments / Receipts Modal Button */}
                          {m.allocations && m.allocations.length > 0 && (
                            <button
                              onClick={() =>
                                setActiveAllocationsModal({
                                  monthName: `${m.monthName} ${ledgerYear}`,
                                  allocations: m.allocations,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                            >
                              <FileText className="w-3 h-3" />
                              <span>View Payments / Receipts ({m.allocations.length})</span>
                            </button>
                          )}

                          {/* Collect Fee Link */}
                          {m.canAddPayment && (
                            <Link
                              to="/madrasa-admin/fee-pos"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#08483A] bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                            >
                              <Coins className="w-3 h-3" />
                              <span>Collect Fee</span>
                            </Link>
                          )}

                          {/* Generate Invoice Link */}
                          {m.canGenerateInvoice && (
                            <Link
                              to="/madrasa-admin/invoices/generate"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                            >
                              <span>Generate Invoice</span>
                            </Link>
                          )}

                          {/* Void or Not Admitted labels */}
                          {m.displayStatus === 'VOID' && (
                            <span className="text-[11px] text-gray-400 italic">Invoice Voided</span>
                          )}
                          {m.isNotAdmitted && (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INVOICES DIRECTORY */}
      {activeTab === 'INVOICES' && (
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E7E9EE]">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#37C6A3]" />
              <h2 className="text-sm font-bold text-[#0F172A]">Invoices & Billing History</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {invoicesTotal}
              </span>
            </div>
            <Link
              to="/madrasa-admin/invoices/generate"
              className="text-xs text-[#2BB393] hover:underline font-semibold"
            >
              Generate Monthly Invoices →
            </Link>
          </div>

          {invoicesLoading ? (
            <div className="p-8 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#37C6A3]" />
              <p className="text-xs text-[#7C8A9A]">Loading billing history...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-8 text-center text-[#7C8A9A] text-xs">
              <Receipt className="w-8 h-8 mx-auto mb-2 text-[#7C8A9A]/40" />
              <p className="font-medium text-[#0F172A]">No Invoices Generated Yet</p>
              <p className="text-[11px] mt-0.5">
                Monthly tuition invoices generated for this student will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F7F6F1]/50 border-b border-[#E7E9EE] text-[#7C8A9A] font-semibold">
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Period</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-right">Balance</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E9EE]">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#F7F6F1]/30">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#0F172A]">
                        <Link to={`/madrasa-admin/invoices/${inv.id}`} className="text-[#2BB393] hover:underline">
                          {inv.invoiceNo}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#0F172A]">
                        {inv.monthName} {inv.billingYear}
                      </td>
                      <td className="py-2.5 px-3 text-[#7C8A9A]">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-[#0F172A]">
                        LKR {inv.totalAmount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <span className={Number(inv.balanceAmount) > 0 ? 'text-red-600' : 'text-emerald-600'}>
                          LKR {inv.balanceAmount}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {inv.displayStatus === 'PAID' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Paid
                          </span>
                        )}
                        {inv.displayStatus === 'OVERDUE' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                            Overdue
                          </span>
                        )}
                        {inv.displayStatus === 'PARTIAL' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            Partial
                          </span>
                        )}
                        {inv.displayStatus === 'VOID' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            Void
                          </span>
                        )}
                        {inv.displayStatus === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          to={`/madrasa-admin/invoices/${inv.id}`}
                          className="inline-flex items-center gap-1 text-[11px] text-[#2BB393] hover:underline font-semibold"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {invoicesTotal > 10 && (
            <div className="p-3 border-t border-[#E7E9EE] flex items-center justify-between text-xs text-[#7C8A9A]">
              <span>
                Showing page {invoicesPage} of {Math.ceil(invoicesTotal / 10)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setInvoicesPage((p) => Math.max(1, p - 1))}
                  disabled={invoicesPage === 1}
                  className="p-1 rounded border border-[#E7E9EE] disabled:opacity-40 hover:bg-[#F7F6F1] cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setInvoicesPage((p) => p + 1)}
                  disabled={invoicesPage >= Math.ceil(invoicesTotal / 10)}
                  className="p-1 rounded border border-[#E7E9EE] disabled:opacity-40 hover:bg-[#F7F6F1] cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYMENTS HISTORY */}
      {activeTab === 'PAYMENTS' && (
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E7E9EE]">
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-emerald-700" />
              <h2 className="text-sm font-bold text-[#0F172A]">Payment History & Receipts</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {paymentsTotal}
              </span>
            </div>
            <Link
              to="/madrasa-admin/fee-pos"
              className="text-xs text-[#08483A] hover:underline font-semibold flex items-center gap-1"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Record Payment (POS) →</span>
            </Link>
          </div>

          {paymentsLoading ? (
            <div className="p-8 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#08483A]" />
              <p className="text-xs text-[#7C8A9A]">Loading payments...</p>
            </div>
          ) : studentPayments.length === 0 ? (
            <div className="py-8 text-center text-[#7C8A9A] text-xs">
              <Banknote className="w-8 h-8 mx-auto mb-2 text-[#7C8A9A]/40" />
              <p className="font-medium text-[#0F172A]">No Payments Recorded</p>
              <p className="text-[11px] mt-0.5">
                Payments recorded for this student via the POS will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b border-[#E7E9EE] text-[#7C8A9A] font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Payment #</th>
                    <th className="py-2.5 px-3">Receipt #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3 text-right">Amount (LKR)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E9EE]">
                  {studentPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#0F172A]">
                        <Link to={`/madrasa-admin/payments/${p.id}`} className="hover:underline text-emerald-800">
                          {p.paymentNo}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3">
                        {p.receipt ? (
                          <Link
                            to={`/madrasa-admin/receipts/${p.receipt.id}`}
                            className="font-mono text-xs font-bold text-emerald-700 hover:underline inline-flex items-center gap-1.5"
                          >
                            <ReceiptText className="h-3.5 w-3.5 shrink-0" />
                            <span>{p.receipt.receiptNo}</span>
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[#7C8A9A]">{new Date(p.paidAt).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 font-medium text-[#0F172A]">{p.paymentMethod.replace('_', ' ')}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#0F172A]">
                        {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {p.status === 'COMPLETED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                            Void
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        <Link
                          to={`/madrasa-admin/payments/${p.id}`}
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-800 hover:underline font-semibold"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </Link>
                        {p.receipt && (
                          <Link
                            to={`/madrasa-admin/receipts/${p.receipt.id}`}
                            className="inline-flex items-center gap-1 text-[11px] text-gray-600 hover:underline font-semibold"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Receipt
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {paymentsTotal > 10 && (
            <div className="p-3 border-t border-[#E7E9EE] flex items-center justify-between text-xs text-[#7C8A9A]">
              <span>
                Showing page {paymentsPage} of {Math.ceil(paymentsTotal / 10)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPaymentsPage((p) => Math.max(1, p - 1))}
                  disabled={paymentsPage === 1}
                  className="p-1 rounded border border-[#E7E9EE] disabled:opacity-40 hover:bg-[#F7F6F1] cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPaymentsPage((p) => p + 1)}
                  disabled={paymentsPage >= Math.ceil(paymentsTotal / 10)}
                  className="p-1 rounded border border-[#E7E9EE] disabled:opacity-40 hover:bg-[#F7F6F1] cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PROFILE & FEE OVERRIDES */}
      {activeTab === 'PROFILE' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Fee Overview & Fee History */}
          <div className="lg:col-span-2 space-y-6">
            {/* Effective Monthly Fee Card */}
            <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E7E9EE]">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#37C6A3]" />
                  <h2 className="text-sm font-bold text-[#0F172A]">Tuition Fee Arrangement</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {student.feeSource === 'STUDENT_OVERRIDE' && (
                    <button
                      onClick={() => setIsRevertModalOpen(true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#F7F6F1] hover:bg-[#E7E9EE] text-[#0F172A] text-xs font-semibold rounded-xl border border-[#E7E9EE] transition cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3 text-[#7C8A9A]" />
                      <span>Revert to Class Default</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsOverrideModalOpen(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0F172A] hover:bg-[#0F172A]/90 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-[#37C6A3]" />
                    <span>Set Fee Override</span>
                  </button>
                </div>
              </div>

              <div className="bg-[#F7F6F1] p-5 rounded-2xl border border-[#E7E9EE] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-medium text-[#7C8A9A]">Current Effective Monthly Fee</span>
                  <div className="text-2xl font-bold font-mono text-[#0F172A] mt-0.5">
                    LKR {student.effectiveMonthlyFee || '0.00'}
                    <span className="text-xs font-normal text-[#7C8A9A] ml-1">/ month</span>
                  </div>
                </div>

                <div>
                  {student.feeSource === 'STUDENT_OVERRIDE' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Individual Override
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      Standard Class Default
                    </span>
                  )}
                </div>
              </div>

              {activeFeeSetting && (
                <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    <span>
                      Override active since{' '}
                      {activeFeeSetting.effectiveFrom
                        ? new Date(activeFeeSetting.effectiveFrom).toLocaleDateString()
                        : '—'}
                    </span>
                  </div>
                  {activeFeeSetting.reason && (
                    <p className="text-[11px] text-amber-800">
                      Reason: <span className="italic">{activeFeeSetting.reason}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Fee History Timeline */}
            <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#E7E9EE]">
                <History className="w-4 h-4 text-[#37C6A3]" />
                <h2 className="text-sm font-bold text-[#0F172A]">Fee Override History Log</h2>
              </div>

              {feeHistoryError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{feeHistoryError}</span>
                </div>
              )}

              {feeHistoryLoading ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-[#7C8A9A]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#37C6A3]" />
                  <p className="text-xs">Loading fee override history...</p>
                </div>
              ) : !feeHistory || feeHistory.length === 0 ? (
                <div className="py-8 text-center text-[#7C8A9A] text-xs">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-[#7C8A9A]/40" />
                  <p className="font-medium text-[#0F172A]">No Individual Fee Overrides Recorded</p>
                  <p className="text-[11px] mt-0.5">
                    This student has consistently used the standard class tuition rate.
                  </p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E7E9EE]">
                  {feeHistory.map((item) => {
                    const isCurrent = item.isCurrent ?? !item.effectiveTo;
                    const feeAmount = item.amount || item.monthlyFee || '0.00';
                    return (
                      <div key={item.id} className="relative group">
                        <span
                          className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-xs ${
                            isCurrent ? 'bg-[#37C6A3]' : 'bg-[#7C8A9A]'
                          }`}
                        />
                        <div className="p-3.5 rounded-xl border border-[#E7E9EE] bg-[#F7F6F1]/50 hover:bg-white transition space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-[#0F172A] text-sm">
                              LKR {feeAmount} / mo
                            </span>
                            {isCurrent ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Current Term
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#E7E9EE] text-[#7C8A9A]">
                                Concluded
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-[#7C8A9A]">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {item.effectiveFrom ? new Date(item.effectiveFrom).toLocaleDateString() : '—'} →{' '}
                              {item.effectiveTo
                                ? new Date(item.effectiveTo).toLocaleDateString()
                                : 'Present (Open-ended)'}
                            </span>
                          </div>

                          {item.reason && (
                            <div className="text-[11px] text-[#0F172A]/80 italic pt-1 border-t border-[#E7E9EE]/40">
                              "{item.reason}"
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right 1 Col: Guardian & Student Details */}
          <div className="space-y-6">
            {/* Guardian & Contact Card */}
            <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#E7E9EE]">
                <Phone className="w-4 h-4 text-[#37C6A3]" />
                <h2 className="text-sm font-bold text-[#0F172A]">Guardian & Contact</h2>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] text-[#7C8A9A] uppercase tracking-wider block">Guardian Name</span>
                  <span className="font-bold text-[#0F172A] text-sm">{student.guardianName || 'Not specified'}</span>
                  {student.guardianRelationship && (
                    <span className="text-[11px] text-[#7C8A9A] block capitalize">
                      Relation: {typeof student.guardianRelationship === 'string' ? student.guardianRelationship.toLowerCase() : student.guardianRelationship}
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-[#E7E9EE]">
                  <span className="text-[10px] text-[#7C8A9A] uppercase tracking-wider block">Primary Phone</span>
                  <span className="font-mono font-semibold text-[#0F172A]">{student.guardianPhone || 'Not provided'}</span>
                </div>

                <div className="pt-2 border-t border-[#E7E9EE]">
                  <span className="text-[10px] text-[#7C8A9A] uppercase tracking-wider block">Guardian Email</span>
                  <span className="font-mono text-xs text-[#0F172A] break-all block">{student.guardianEmail || 'Not provided'}</span>
                </div>

                <div>
                  <span className="text-[10px] text-[#7C8A9A] uppercase tracking-wider block">WhatsApp</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono font-semibold text-[#0F172A]">
                      {student.guardianWhatsapp || student.whatsappNumber || 'Not provided'}
                    </span>
                    {(student.whatsappNotification || student.whatsappOptIn) && (student.guardianWhatsapp || student.whatsappNumber) && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                        <MessageSquare className="w-2.5 h-2.5 text-emerald-600" />
                        <span>Opted In</span>
                      </span>
                    )}
                  </div>
                </div>

                {student.address && (
                  <div className="pt-2 border-t border-[#E7E9EE]">
                    <span className="text-[10px] text-[#7C8A9A] uppercase tracking-wider block flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#7C8A9A]" />
                      Address
                    </span>
                    <p className="text-[#0F172A] mt-0.5 leading-relaxed">{student.address}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Institutional Notes Card */}
            <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#E7E9EE]">
                <FileText className="w-4 h-4 text-[#37C6A3]" />
                <h2 className="text-sm font-bold text-[#0F172A]">Institutional Notes</h2>
              </div>

              {student.notes ? (
                <p className="text-xs text-[#0F172A]/80 whitespace-pre-wrap leading-relaxed bg-[#F7F6F1] p-3 rounded-xl border border-[#E7E9EE]">
                  {student.notes}
                </p>
              ) : (
                <p className="text-xs text-[#7C8A9A] italic">No internal administrative notes recorded.</p>
              )}

              <div className="text-[10px] text-[#7C8A9A] pt-2 border-t border-[#E7E9EE] space-y-1">
                <div>Record created: {student.createdAt ? new Date(student.createdAt).toLocaleString() : '—'}</div>
                <div>Last updated: {student.updatedAt ? new Date(student.updatedAt).toLocaleString() : '—'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABS 5-9: STUDENT QUALIFICATIONS, DISCIPLINE, MEETINGS, FOLLOW-UPS & TIMELINE */}
      {(activeTab === 'QUALIFICATIONS' ||
        activeTab === 'DISCIPLINE' ||
        activeTab === 'MEETINGS' ||
        activeTab === 'FOLLOW_UPS' ||
        activeTab === 'TIMELINE') && (
        <StudentRecordsPanels
          studentId={student.id}
          studentName={student.fullName}
          activeSubTab={activeTab}
        />
      )}

      {/* Modal: View Payments / Receipts for a Month (Mandatory Correction 12) */}
      {activeAllocationsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveAllocationsModal(null);
            }
          }}
        >
          <div
            className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#E7E9EE] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-[#0F172A]">
                  Payments & Receipts for {activeAllocationsModal.monthName}
                </h3>
              </div>
              <button
                onClick={() => setActiveAllocationsModal(null)}
                className="text-[#7C8A9A] hover:text-[#0F172A] text-lg font-bold p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-[#5B6B7F]">
                This month has {activeAllocationsModal.allocations.length} recorded payment allocation(s).
              </p>

              <div className="divide-y divide-[#E7E9EE] border border-[#E7E9EE] rounded-xl overflow-hidden text-xs">
                {activeAllocationsModal.allocations.map((alloc, idx) => {
                  const payment = {
                    id: alloc.paymentId || (alloc as any).payment?.id || alloc.id,
                    paymentNo: alloc.paymentNo || (alloc as any).payment?.paymentNo || 'Payment',
                    paymentMethod: alloc.paymentMethod || (alloc as any).payment?.paymentMethod || 'OTHER',
                    paidAt: alloc.paidAt || (alloc as any).payment?.paidAt,
                  };
                  const receipt = {
                    id: alloc.receiptId || (alloc as any).payment?.receipt?.id || (alloc as any).receipt?.id,
                    receiptNo: alloc.receiptNo || (alloc as any).payment?.receipt?.receiptNo || (alloc as any).receipt?.receiptNo,
                  };

                  return (
                    <div
                      key={alloc.id || payment.id || idx}
                      className="p-3.5 hover:bg-gray-50 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/madrasa-admin/payments/${payment.id}`}
                            onClick={() => setActiveAllocationsModal(null)}
                            className="font-mono font-bold text-emerald-800 hover:underline cursor-pointer"
                          >
                            {payment.paymentNo}
                          </Link>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                            {String(payment.paymentMethod).replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#7C8A9A]">
                          Paid on {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : '—'}
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <div className="font-bold text-[#0F172A] text-sm">
                          LKR {Number(alloc.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        {receipt.id && (
                          <Link
                            to={`/madrasa-admin/receipts/${receipt.id}`}
                            onClick={() => setActiveAllocationsModal(null)}
                            className="text-[11px] font-mono text-emerald-700 hover:underline inline-flex items-center gap-1.5 font-semibold cursor-pointer"
                          >
                            <ReceiptText className="h-3.5 w-3.5 shrink-0" />
                            <span>{receipt.receiptNo}</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-[#E7E9EE] bg-[#F8F9FA] flex justify-end">
              <button
                onClick={() => setActiveAllocationsModal(null)}
                className="px-4 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-[#E7E9EE] rounded-xl hover:bg-gray-50 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Set Fee Override */}
      {isOverrideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#E7E9EE] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#37C6A3]" />
                <h3 className="text-sm font-bold text-[#0F172A]">Set Individual Fee Override</h3>
              </div>
              <button
                onClick={() => setIsOverrideModalOpen(false)}
                className="text-[#7C8A9A] hover:text-[#0F172A] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSetOverride} className="p-5 space-y-4">
              {overrideError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{overrideError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Custom Monthly Fee (LKR) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#7C8A9A]">
                    LKR
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={overrideForm.monthlyFee}
                    onChange={(e) => setOverrideForm({ ...overrideForm, monthlyFee: e.target.value })}
                    placeholder="2500.00"
                    className="w-full pl-12 pr-4 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
                  />
                </div>
                <p className="text-[10px] text-[#7C8A9A] mt-1">
                  Current class default is LKR {student.class?.defaultMonthlyFee ?? '0.00'}.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Effective From Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={overrideForm.effectiveFrom}
                  onChange={(e) => setOverrideForm({ ...overrideForm, effectiveFrom: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
                />
                <p className="text-[10px] text-[#7C8A9A] mt-1">
                  Overrides any prior open fee setting starting on this date.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Reason for Override <span className="text-[#7C8A9A] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={overrideForm.reason}
                  onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                  placeholder="e.g., Sibling discount, Orphan scholarship, Merit grant"
                  className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#7C8A9A] hover:text-[#0F172A] rounded-xl hover:bg-[#F7F6F1] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOverride}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#37C6A3] hover:bg-[#30b594] text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {isSubmittingOverride && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Override</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Revert to Class Default */}
      {isRevertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#E7E9EE] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#0F172A]" />
                <h3 className="text-sm font-bold text-[#0F172A]">Revert to Class Default Fee</h3>
              </div>
              <button
                onClick={() => setIsRevertModalOpen(false)}
                className="text-[#7C8A9A] hover:text-[#0F172A] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRevertClassDefault} className="p-5 space-y-4">
              {revertError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{revertError}</span>
                </div>
              )}

              <p className="text-xs text-[#0F172A]/80 leading-relaxed">
                This action will conclude the active fee override and return this student to the standard class rate (
                <span className="font-bold text-[#0F172A]">
                  LKR {student.class?.defaultMonthlyFee ?? '0.00'} / month
                </span>
                ).
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Revert Effective Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={revertForm.effectiveDate}
                  onChange={(e) => setRevertForm({ ...revertForm, effectiveDate: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
                />
                <p className="text-[10px] text-[#7C8A9A] mt-1">
                  Past historical periods will preserve their override rate for auditing.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Reason <span className="text-[#7C8A9A] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={revertForm.reason}
                  onChange={(e) => setRevertForm({ ...revertForm, reason: e.target.value })}
                  placeholder="e.g., Concession term completed"
                  className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRevertModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#7C8A9A] hover:text-[#0F172A] rounded-xl hover:bg-[#F7F6F1] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRevert}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F172A] hover:bg-[#0F172A]/90 text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {isSubmittingRevert && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Revert to Class Default</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Status Action Confirmation */}
      {statusAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  statusAction === 'ACTIVATE'
                    ? 'bg-emerald-50 text-emerald-600'
                    : statusAction === 'INACTIVATE'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-purple-50 text-purple-600'
                }`}
              >
                {statusAction === 'ACTIVATE' ? (
                  <UserCheck className="w-5 h-5" />
                ) : statusAction === 'INACTIVATE' ? (
                  <UserX className="w-5 h-5" />
                ) : (
                  <Archive className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">
                  {statusAction === 'ACTIVATE'
                    ? 'Activate Student'
                    : statusAction === 'INACTIVATE'
                    ? 'Set Student Inactive'
                    : 'Archive Student'}
                </h3>
                <p className="text-xs text-[#7C8A9A]">
                  {student.fullName} ({student.admissionNo})
                </p>
              </div>
            </div>

            <p className="text-xs text-[#0F172A]/80 leading-relaxed">
              {statusAction === 'ACTIVATE' &&
                'Activating this student will include them in upcoming monthly billing runs and active attendance rosters.'}
              {statusAction === 'INACTIVATE' &&
                'Marking this student inactive temporarily suspends automated invoice generation. Existing financial history is strictly preserved.'}
              {statusAction === 'ARCHIVE' &&
                'Archiving moves this student to alumni / inactive storage. Historical records and fee logs remain intact, but the student will not appear in daily operations.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStatusAction(null)}
                className="px-3.5 py-2 text-xs font-semibold text-[#7C8A9A] hover:text-[#0F172A] rounded-xl hover:bg-[#F7F6F1] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={handleExecuteStatusChange}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-xs transition disabled:opacity-50 ${
                  statusAction === 'ACTIVATE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : statusAction === 'INACTIVATE'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {isUpdatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {statusAction === 'ACTIVATE'
                    ? 'Confirm Activate'
                    : statusAction === 'INACTIVATE'
                    ? 'Confirm Inactive'
                    : 'Confirm Archive'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
