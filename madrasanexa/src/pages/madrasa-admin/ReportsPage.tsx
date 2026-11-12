import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  apiGetReportPreview,
  apiDownloadReport,
  apiGetStudentStatementPreview,
  apiDownloadStudentStatement,
  apiListAcademicSections,
  apiListClasses,
  apiSearchStudentsForPOS,
  type ReportPreviewData,
  type ReportFilterParams,
  type AcademicSectionItem,
  type ClassItem,
  type POSStudentSearchResult,
} from '../../services/api';
import {
  FileBarChart,
  Download,
  FileSpreadsheet,
  Layers,
  BookOpen,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Coins,
  AlertTriangle,
  User,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  FileText,
  CreditCard,
  History,
  X,
  SearchX,
  WalletCards,
  Percent,
  Banknote,
  ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

type ReportTypeKey =
  | 'paid'
  | 'unpaid'
  | 'partial'
  | 'overdue'
  | 'outstanding'
  | 'missing-invoices'
  | 'monthly-collection'
  | 'section-collection'
  | 'class-collection'
  | 'cash-collection'
  | 'payment-method-summary'
  | 'payment-history'
  | 'student-statement';

interface ReportTabConfig {
  key: ReportTypeKey;
  label: string;
  category: 'STUDENT FEE STATUS' | 'COLLECTIONS' | 'TRANSACTIONS' | 'STUDENT';
  icon: any;
  description: string;
}

const REPORT_TABS: ReportTabConfig[] = [
  // 1. Student Fee Status
  {
    key: 'paid',
    label: 'Paid Students',
    category: 'STUDENT FEE STATUS',
    icon: CheckCircle2,
    description: 'Students whose selected monthly invoices are fully settled.',
  },
  {
    key: 'unpaid',
    label: 'Unpaid Students',
    category: 'STUDENT FEE STATUS',
    icon: AlertCircle,
    description: 'Students with zero payments for the selected billing month, tracking pending and overdue balances.',
  },
  {
    key: 'partial',
    label: 'Partial Payments',
    category: 'STUDENT FEE STATUS',
    icon: Clock,
    description: 'Students who have partially settled their fees, showing remaining balances and realization percentages.',
  },
  {
    key: 'overdue',
    label: 'Overdue Invoices',
    category: 'STUDENT FEE STATUS',
    icon: AlertTriangle,
    description: 'Unsettled invoices past their due date grouped by aging intervals (1–30, 31–60, 61–90, 90+ days).',
  },
  {
    key: 'outstanding',
    label: 'Outstanding Balance',
    category: 'STUDENT FEE STATUS',
    icon: Coins,
    description: 'Cumulative outstanding fee debt per student across all unsettled invoices, sortable by balance.',
  },
  {
    key: 'missing-invoices',
    label: 'Missing Invoices',
    category: 'STUDENT FEE STATUS',
    icon: FileText,
    description: 'Active students who were eligible for billing but have no invoice generated for the selected month.',
  },

  // 2. Collections
  {
    key: 'monthly-collection',
    label: 'Monthly Collection',
    category: 'COLLECTIONS',
    icon: TrendingUp,
    description: 'Comprehensive month-by-month fee collection performance, outstanding dues, and realization rates.',
  },
  {
    key: 'section-collection',
    label: 'Section-wise',
    category: 'COLLECTIONS',
    icon: Layers,
    description: 'Fee realization and collection efficiency breakdown across dynamic academic sections.',
  },
  {
    key: 'class-collection',
    label: 'Class-wise',
    category: 'COLLECTIONS',
    icon: BookOpen,
    description: 'Class-by-class realization audit showing billed amounts, collected totals, and settlement rates.',
  },

  // 3. Transactions
  {
    key: 'cash-collection',
    label: 'Cash Collection',
    category: 'TRANSACTIONS',
    icon: Banknote,
    description: 'Physical cash payments received within a date range, audited by receipt numbers and collector.',
  },
  {
    key: 'payment-method-summary',
    label: 'Payment Methods',
    category: 'TRANSACTIONS',
    icon: CreditCard,
    description: 'Realization volume across payment channels: Cash, Bank Transfer, Card, and Other.',
  },
  {
    key: 'payment-history',
    label: 'Payment History',
    category: 'TRANSACTIONS',
    icon: History,
    description: 'Chronological audit log of fee payments, payment allocations, and receipt vouchers.',
  },

  // 4. Student
  {
    key: 'student-statement',
    label: 'Student Fee Statement',
    category: 'STUDENT',
    icon: User,
    description: 'Individual student account statement with full billing ledger and payment allocation history.',
  },
];

const CATEGORIES = ['STUDENT FEE STATUS', 'COLLECTIONS', 'TRANSACTIONS', 'STUDENT'] as const;

function formatPaymentMethod(pm?: string): string {
  if (pm === 'BANK_TRANSFER') return 'Bank Transfer';
  if (pm === 'CASH') return 'Cash';
  if (pm === 'CARD') return 'Card';
  if (pm === 'OTHER') return 'Other';
  return pm || '';
}

function formatCurrency(amount: any, currency = 'LKR'): string {
  if (amount === null || amount === undefined) return `${currency} 0.00`;
  const num = Number(amount);
  if (isNaN(num)) return String(amount);
  return `${currency} ${num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ReportsPage() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const [activeReport, setActiveReport] = useState<ReportTypeKey>('paid');

  // Filter state
  const [billingYear, setBillingYear] = useState<number>(currentYear);
  const [billingMonth, setBillingMonth] = useState<number>(currentMonth);
  const [academicSectionId, setAcademicSectionId] = useState<string>('');
  const [classId, setClassId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('default');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(25);

  // Student statement specific state
  const [statementStudentSearch, setStatementStudentSearch] = useState<string>('');
  const [statementSelectedStudent, setStatementSelectedStudent] = useState<POSStudentSearchResult | null>(null);
  const [studentSearchResults, setStudentSearchResults] = useState<POSStudentSearchResult[]>([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState<boolean>(false);

  // Dropdown options
  const [sections, setSections] = useState<AcademicSectionItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  // Report preview data state
  const [reportData, setReportData] = useState<ReportPreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Export loading state
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Mobile navigation selector state
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  // Load sections on mount
  useEffect(() => {
    async function loadSections() {
      try {
        const res = await apiListAcademicSections({ pageSize: 100, status: 'ACTIVE' });
        setSections(res.sections || []);
      } catch (err) {
        console.error('Failed to load academic sections:', err);
      }
    }
    loadSections();
  }, []);

  // Cascading classes when section changes
  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await apiListClasses({
          pageSize: 100,
          status: 'ACTIVE',
          ...(academicSectionId ? { academicSectionId } : {}),
        });
        setClasses(res.classes || []);
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    }
    loadClasses();
    setClassId('');
  }, [academicSectionId]);

  // Student search debounce for statement
  useEffect(() => {
    if (!statementStudentSearch || statementStudentSearch.trim().length < 2) {
      setStudentSearchResults([]);
      return;
    }

    const handler = setTimeout(async () => {
      setIsSearchingStudents(true);
      try {
        const results = await apiSearchStudentsForPOS(statementStudentSearch.trim());
        setStudentSearchResults(results || []);
      } catch (err) {
        console.error('Student search failed:', err);
      } finally {
        setIsSearchingStudents(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [statementStudentSearch]);

  // Fetch report preview
  const fetchReportPreview = useCallback(async () => {
    setIsLoadingPreview(true);
    setPreviewError(null);
    setExportError(null);

    try {
      if (activeReport === 'student-statement') {
        if (!statementSelectedStudent) {
          setReportData(null);
          setIsLoadingPreview(false);
          return;
        }
        const data = await apiGetStudentStatementPreview(statementSelectedStudent.id, {
          year: billingYear,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
        setReportData(data);
      } else {
        const params: ReportFilterParams = {
          billingYear,
          billingMonth,
          academicSectionId: academicSectionId || undefined,
          classId: classId || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          paymentMethod: (paymentMethod as any) || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          sortBy: sortBy !== 'default' ? sortBy : undefined,
          page,
          limit,
        };
        const data = await apiGetReportPreview(activeReport, params);
        setReportData(data);
      }
    } catch (err: any) {
      setPreviewError(err.response?.data?.message || err.message || 'Failed to load report preview.');
    } finally {
      setIsLoadingPreview(false);
    }
  }, [
    activeReport,
    billingYear,
    billingMonth,
    academicSectionId,
    classId,
    statusFilter,
    paymentMethod,
    startDate,
    endDate,
    sortBy,
    page,
    limit,
    statementSelectedStudent,
  ]);

  useEffect(() => {
    fetchReportPreview();
  }, [fetchReportPreview]);

  const handleTabChange = (tab: ReportTypeKey) => {
    setActiveReport(tab);
    setPage(1);
    setIsMobileNavOpen(false);
  };

  // Export Handlers
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    setExportError(null);
    try {
      if (activeReport === 'student-statement') {
        if (!statementSelectedStudent) return;
        await apiDownloadStudentStatement(
          statementSelectedStudent.id,
          {
            year: billingYear,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          },
          'pdf'
        );
      } else {
        const params: ReportFilterParams = {
          billingYear,
          billingMonth,
          academicSectionId: academicSectionId || undefined,
          classId: classId || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          paymentMethod: (paymentMethod as any) || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          sortBy: sortBy !== 'default' ? sortBy : undefined,
        };
        await apiDownloadReport(activeReport, params, 'pdf');
      }
    } catch (err: any) {
      setExportError(err.message || 'Failed to generate PDF report.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    setExportError(null);
    try {
      if (activeReport === 'student-statement') {
        if (!statementSelectedStudent) return;
        await apiDownloadStudentStatement(
          statementSelectedStudent.id,
          {
            year: billingYear,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          },
          'csv'
        );
      } else {
        const params: ReportFilterParams = {
          billingYear,
          billingMonth,
          academicSectionId: academicSectionId || undefined,
          classId: classId || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          paymentMethod: (paymentMethod as any) || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          sortBy: sortBy !== 'default' ? sortBy : undefined,
        };
        await apiDownloadReport(activeReport, params, 'csv');
      }
    } catch (err: any) {
      setExportError(err.message || 'Failed to export CSV report.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const resetFilters = () => {
    setBillingYear(currentYear);
    setBillingMonth(currentMonth);
    setAcademicSectionId('');
    setClassId('');
    setStatusFilter('ALL');
    setPaymentMethod('');
    setStartDate('');
    setEndDate('');
    setSortBy('default');
    setPage(1);
    setStatementSelectedStudent(null);
    setStatementStudentSearch('');
  };

  // Active report configuration
  const currentTabConfig = useMemo(
    () => REPORT_TABS.find((t) => t.key === activeReport) || REPORT_TABS[0],
    [activeReport]
  );

  // Active filter chips computation
  const activeFilterChips = useMemo(() => {
    const chips: { label: string; onClear: () => void }[] = [];

    if (!['cash-collection', 'payment-method-summary', 'payment-history'].includes(activeReport)) {
      chips.push({
        label: `${new Date(2000, billingMonth - 1, 1).toLocaleString('default', { month: 'short' })} ${billingYear}`,
        onClear: () => {
          setBillingYear(currentYear);
          setBillingMonth(currentMonth);
        },
      });
    }

    if (academicSectionId) {
      const sec = sections.find((s) => s.id === academicSectionId);
      chips.push({
        label: `Section: ${sec?.name || 'Section'}`,
        onClear: () => setAcademicSectionId(''),
      });
    }

    if (classId) {
      const cls = classes.find((c) => c.id === classId);
      chips.push({
        label: `Class: ${cls?.name || 'Class'}`,
        onClear: () => setClassId(''),
      });
    }

    if (statusFilter !== 'ALL') {
      chips.push({
        label: `Status: ${statusFilter}`,
        onClear: () => setStatusFilter('ALL'),
      });
    }

    if (paymentMethod) {
      chips.push({
        label: `Method: ${formatPaymentMethod(paymentMethod)}`,
        onClear: () => setPaymentMethod(''),
      });
    }

    if (startDate) {
      chips.push({
        label: `From: ${startDate}`,
        onClear: () => setStartDate(''),
      });
    }

    if (endDate) {
      chips.push({
        label: `To: ${endDate}`,
        onClear: () => setEndDate(''),
      });
    }

    if (sortBy !== 'default') {
      chips.push({
        label: `Sort: ${sortBy.replace(/_/g, ' ')}`,
        onClear: () => setSortBy('default'),
      });
    }

    return chips;
  }, [
    activeReport,
    billingYear,
    billingMonth,
    academicSectionId,
    classId,
    statusFilter,
    paymentMethod,
    startDate,
    endDate,
    sortBy,
    sections,
    classes,
    currentYear,
    currentMonth,
  ]);

  // Derived 4 Global KPI Cards based on report data
  const overviewKpis = useMemo(() => {
    const s = reportData?.summary as any;
    const curr = reportData?.madrasa?.currency || 'LKR';

    if (!s) {
      return [
        { label: 'Total Billed', value: `${curr} 0.00`, sub: 'Active billing period', icon: FileText, color: 'navy' },
        { label: 'Total Collected', value: `${curr} 0.00`, sub: 'Completed allocations', icon: TrendingUp, color: 'mint' },
        { label: 'Outstanding Balance', value: `${curr} 0.00`, sub: 'Receivables balance', icon: Clock, color: 'gold' },
        { label: 'Realization Rate', value: '0.00%', sub: 'Collection efficiency', icon: Percent, color: 'mint' },
      ];
    }

    if (activeReport === 'cash-collection') {
      return [
        { label: 'Total Received', value: formatCurrency(s.totalCollected, curr), sub: 'Physical cash audit', icon: Banknote, color: 'mint' },
        { label: 'Cash Channel', value: formatCurrency(s.totalCash, curr), sub: 'Physical cash drawer', icon: Coins, color: 'gold' },
        { label: 'Bank Transfers', value: formatCurrency(s.totalBankTransfer, curr), sub: 'Direct bank receipts', icon: CreditCard, color: 'navy' },
        { label: 'Transactions', value: `${s.totalTransactions || 0}`, sub: 'Completed entries', icon: CheckCircle2, color: 'mint' },
      ];
    }

    if (activeReport === 'payment-method-summary') {
      return [
        { label: 'Completed Volume', value: formatCurrency(s.totalCompletedAmount, curr), sub: 'Realized collections', icon: TrendingUp, color: 'mint' },
        { label: 'Completed Count', value: `${s.totalCompletedTransactions || 0}`, sub: 'Successful receipts', icon: CheckCircle2, color: 'mint' },
        { label: 'Voided Amount', value: formatCurrency(s.totalVoidAmount, curr), sub: 'Reversed transactions', icon: AlertTriangle, color: 'gold' },
        { label: 'Voided Count', value: `${s.totalVoidTransactions || 0}`, sub: 'Cancelled vouchers', icon: History, color: 'navy' },
      ];
    }

    if (activeReport === 'missing-invoices') {
      return [
        { label: 'Unbilled Students', value: `${s.totalMissing || 0}`, sub: 'Missing monthly invoices', icon: AlertCircle, color: 'gold' },
        { label: 'Unbilled Fee Value', value: formatCurrency(s.totalExpectedFee, curr), sub: 'Unbilled potential fees', icon: Coins, color: 'navy' },
        { label: 'Eligible Students', value: `${s.totalMissing || 0}`, sub: 'Admitted active students', icon: User, color: 'mint' },
        { label: 'Realization Status', value: 'Pending Generation', sub: 'Action required', icon: FileText, color: 'gold' },
      ];
    }

    // Default financial summary
    const billed = s.totalBilled || s.totalExpected || s.expectedAmount || (s.totalPaid && s.totalOutstanding ? Number(s.totalPaid) + Number(s.totalOutstanding) : 0);
    const collected = s.totalCollected || s.totalPaid || s.completedAmount || 0;
    const balance = s.totalOutstanding || s.totalBalance || s.currentBalance || s.balanceAmount || 0;
    const rate = s.overallCollectionRate || s.collectionRate || (Number(billed) > 0 ? `${((Number(collected) / Number(billed)) * 100).toFixed(2)}%` : '0.00%');

    return [
      { label: 'Total Billed', value: formatCurrency(billed, curr), sub: 'Active billing period', icon: FileText, color: 'navy' },
      { label: 'Total Collected', value: formatCurrency(collected, curr), sub: 'Authoritative completed allocations', icon: TrendingUp, color: 'mint' },
      { label: 'Outstanding Balance', value: formatCurrency(balance, curr), sub: 'Receivables balance', icon: Clock, color: 'gold' },
      { label: 'Realization Rate', value: typeof rate === 'string' && rate.includes('%') ? rate : `${rate}%`, sub: 'Collection efficiency', icon: Percent, color: 'mint' },
    ];
  }, [reportData, activeReport]);

  // Chart data for Section & Class collection reports
  const visualChartData = useMemo(() => {
    if (!reportData?.records || reportData.records.length === 0) return null;
    if (activeReport === 'section-collection') {
      return reportData.records.slice(0, 10).map((r: any) => ({
        name: r.sectionName,
        Expected: Number(r.expectedAmount) || 0,
        Collected: Number(r.collectedAmount) || 0,
      }));
    }
    if (activeReport === 'class-collection') {
      return reportData.records.slice(0, 10).map((r: any) => ({
        name: r.className,
        Expected: Number(r.expectedAmount) || 0,
        Collected: Number(r.collectedAmount) || 0,
      }));
    }
    return null;
  }, [reportData, activeReport]);

  return (
    <div className="space-y-6 pb-12 font-sans print:pb-0">
      {/* 1. PREMIUM PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Fee Reports & Export Center</h1>
          <p className="text-xs sm:text-sm text-[#7C8A9A] mt-1 font-medium">
            Analyze fee collection, outstanding balances, payments and student billing records.
          </p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto px-4 py-2 bg-white border border-[#E7E9EE] rounded-full shadow-xs text-xs font-semibold text-[#0F172A]">
          <span className="w-2 h-2 rounded-full bg-[#37C6A3] animate-pulse" />
          <WalletCards className="w-4 h-4 text-[#37C6A3]" />
          <span>Financial Reports</span>
        </div>
      </div>

      {/* 2. TOP FINANCIAL OVERVIEW CARDS (4 Compact Premium Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewKpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-white border border-[#E7E9EE] rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:border-[#CBD5E1] flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C8A9A] truncate">
                  {kpi.label}
                </span>
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    kpi.color === 'mint'
                      ? 'bg-[#E6F8F4] text-[#0C6B58]'
                      : kpi.color === 'gold'
                      ? 'bg-[#FEF6E6] text-[#925807]'
                      : 'bg-[#F7F6F1] text-[#0F172A]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight tabular-nums truncate">
                  {kpi.value}
                </div>
                <div className="text-[11px] text-[#7C8A9A] mt-1 font-medium truncate">{kpi.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Error Banner */}
      {exportError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-xs text-red-700 shadow-xs print:hidden">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{exportError}</span>
          </div>
          <button
            onClick={() => setExportError(null)}
            className="p-1 hover:bg-red-100 rounded-md transition-colors"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. MAIN WORKSPACE CONTAINER: Left Navigator + Main Report Workspace */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Mobile Report Selector (Dropdown) */}
        <div className="lg:hidden w-full bg-white border border-[#E7E9EE] rounded-2xl p-3 shadow-xs print:hidden">
          <button
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="w-full flex items-center justify-between p-2.5 bg-[#F7F6F1] rounded-xl text-left text-xs font-bold text-[#0F172A]"
          >
            <div className="flex items-center gap-2">
              <currentTabConfig.icon className="w-4 h-4 text-[#37C6A3]" />
              <span>{currentTabConfig.label}</span>
              <span className="text-[10px] text-[#7C8A9A] font-normal">({currentTabConfig.category})</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-[#7C8A9A] transition-transform ${isMobileNavOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMobileNavOpen && (
            <div className="mt-3 space-y-4 max-h-96 overflow-y-auto pt-2 border-t border-[#E7E9EE]">
              {CATEGORIES.map((category) => (
                <div key={category} className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#7C8A9A] px-2">
                    {category}
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {REPORT_TABS.filter((t) => t.category === category).map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeReport === tab.key;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => handleTabChange(tab.key)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left transition-all ${
                            isActive
                              ? 'bg-[#0F172A] text-white font-bold'
                              : 'text-[#475569] hover:bg-[#F7F6F1] font-medium'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isActive ? 'text-[#37C6A3]' : 'text-[#7C8A9A]'}`} />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Left-Side Report Navigator (260px) */}
        <div className="hidden lg:block w-64 shrink-0 bg-white border border-[#E7E9EE] rounded-[22px] p-4 shadow-xs lg:sticky lg:top-4 space-y-6 print:hidden">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E7E9EE]">
            <FileBarChart className="w-4 h-4 text-[#37C6A3]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">Report Catalog</span>
          </div>

          <div className="space-y-5">
            {CATEGORIES.map((category) => (
              <div key={category} className="space-y-1.5">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#7C8A9A] px-2.5">
                  {category}
                </div>
                <div className="space-y-0.5">
                  {REPORT_TABS.filter((t) => t.category === category).map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeReport === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => handleTabChange(tab.key)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all group ${
                          isActive
                            ? 'bg-[#0F172A] text-white font-bold shadow-xs'
                            : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F7F6F1] font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              isActive ? 'text-[#37C6A3]' : 'text-[#7C8A9A] group-hover:text-[#0F172A]'
                            }`}
                          />
                          <span className="truncate">{tab.label}</span>
                        </div>
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#37C6A3] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. MAIN REPORT WORKSPACE (Fluid remaining width) */}
        <div className="flex-1 min-w-0 w-full bg-white border border-[#E7E9EE] rounded-[22px] shadow-xs p-5 sm:p-7 space-y-6 print:border-0 print:shadow-none print:p-0">
          {/* 5. REPORT-SPECIFIC HEADER WITH EXPORT CONTROLS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E7E9EE]">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#F7F6F1] border border-[#E7E9EE] flex items-center justify-center text-[#0F172A] shrink-0 shadow-2xs">
                <currentTabConfig.icon className="w-5 h-5 text-[#37C6A3]" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#0F172A] tracking-tight">
                  {currentTabConfig.label} Report
                </h2>
                <p className="text-xs text-[#7C8A9A] mt-0.5 font-medium max-w-xl leading-relaxed">
                  {currentTabConfig.description}
                </p>
              </div>
            </div>

            {/* Premium Export Buttons */}
            <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0 print:hidden">
              <button
                onClick={handleExportPdf}
                disabled={
                  isExportingPdf ||
                  isLoadingPreview ||
                  (activeReport === 'student-statement' && !statementSelectedStudent)
                }
                className="flex items-center gap-2 px-4 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Download professional printable PDF report"
              >
                {isExportingPdf ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#37C6A3]" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-[#37C6A3]" />
                )}
                <span>{isExportingPdf ? 'Generating...' : 'Download PDF'}</span>
              </button>

              <button
                onClick={handleExportCsv}
                disabled={
                  isExportingCsv ||
                  isLoadingPreview ||
                  (activeReport === 'student-statement' && !statementSelectedStudent)
                }
                className="flex items-center gap-2 px-4 py-2.5 bg-[#FFD978] hover:bg-[#F6CE65] text-[#0F172A] border border-[#F0CA68] text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Export complete filtered dataset to CSV"
              >
                {isExportingCsv ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0F172A]" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#0F172A]" />
                )}
                <span>{isExportingCsv ? 'Exporting...' : 'Export CSV'}</span>
              </button>
            </div>
          </div>

          {/* 6. REPORT FILTERS PANEL */}
          <div className="bg-[#F7F6F1]/70 border border-[#E7E9EE] rounded-2xl p-4 sm:p-5 space-y-4 print:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                <Filter className="w-3.5 h-3.5 text-[#37C6A3]" />
                <span>Report Filters</span>
              </div>
              <button
                onClick={resetFilters}
                className="text-xs text-[#7C8A9A] hover:text-[#0F172A] font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white border border-transparent hover:border-[#E7E9EE] transition-all cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {/* Year & Month (for billing period reports) */}
              {!['cash-collection', 'payment-method-summary', 'payment-history'].includes(activeReport) && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-[#7C8A9A] mb-1.5 uppercase tracking-wide">
                      Billing Year
                    </label>
                    <select
                      value={billingYear}
                      onChange={(e) => setBillingYear(Number(e.target.value))}
                      className="w-full h-11 text-xs bg-white border border-[#E7E9EE] rounded-xl px-3 font-semibold text-[#0F172A] focus:outline-hidden focus:border-[#37C6A3] focus:ring-2 focus:ring-[#37C6A3]/20 shadow-2xs"
                    >
                      {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>

                  {activeReport !== 'student-statement' && (
                    <div>
                      <label className="block text-[11px] font-bold text-[#7C8A9A] mb-1.5 uppercase tracking-wide">
                        Billing Month
                      </label>
                      <select
                        value={billingMonth}
                        onChange={(e) => setBillingMonth(Number(e.target.value))}
                        className="w-full h-11 text-xs bg-white border border-[#E7E9EE] rounded-xl px-3 font-semibold text-[#0F172A] focus:outline-hidden focus:border-[#37C6A3] focus:ring-2 focus:ring-[#37C6A3]/20 shadow-2xs"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <option key={m} value={m}>
                            {new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' })}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* Academic Section */}
              {activeReport !== 'student-statement' && activeReport !== 'payment-method-summary' && (
                <div>
                  <label className="block text-[11px] font-bold text-[#7C8A9A] mb-1.5 uppercase tracking-wide">
                    Academic Section
                  </label>
                  <select
                    value={academicSectionId}
                    onChange={(e) => setAcademicSectionId(e.target.value)}
                    className="w-full h-11 text-xs bg-white border border-[#E7E9EE] rounded-xl px-3 font-semibold text-[#0F172A] focus:outline-hidden focus:border-[#37C6A3] focus:ring-2 focus:ring-[#37C6A3]/20 shadow-2xs"
                  >
                    <option value="">All Academic Sections</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Class (Cascading) */}
              {activeReport !== 'student-statement' &&
                activeReport !== 'section-collection' &&
                activeReport !== 'payment-method-summary' && (
                  <div>
                    <label className="block text-[11px] font-bold text-[#7C8A9A] mb-1.5 uppercase tracking-wide">
                      Class
                    </label>
                    <select
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      className="w-full h-11 text-xs bg-white border border-[#E7E9EE] rounded-xl px-3 font-semibold text-[#0F172A] focus:outline-hidden focus:border-[#37C6A3] focus:ring-2 focus:ring-[#37C6A3]/20 shadow-2xs"
                    >
                      <option value="">All Classes</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.code ? `(${c.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              {/* Date Range (For Cash Collection, Payment Method, Payment History, Student Statement) */}
              {['cash-collection', 'payment-method-summary', 'payment-history', 'student-statement'].includes(
                activeReport
              ) && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-[#7C8A9A] mb-1.5 uppercase tracking-wide">
                      Date From
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full h-11 text-xs bg-white border border-[#E7E9EE] rounded-xl px-3 font-semibold text-[#0F172A] focus:outline-hidden focus:border-[#37C6A3] focus:ring-2 focus:ring-[#37C6A3]/20 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#7C8A9A] mb-1.5 uppercase tracking-wide">
                      Date To
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full h-11 text-xs bg-white border border-[#E7E9EE] rounded-xl px-3 font-semibold text-[#0F172A] focus:outline-hidden focus:border-[#37C6A3] focus:ring-2 focus:ring-[#37C6A3]/20 shadow-2xs"
                    />
                  </div>
                </>
              )}

              {/* Payment Method Filter */}
              {['cash-collection', 'payment-history'].includes(activeReport) && (
                <div>
                  <label className="block text-[11px] font-bold text-[#7C8A9A] mb-1.5 uppercase tracking-wide">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full h-11 text-xs bg-white border border-[#E7E9EE] rounded-xl px-3 font-semibold text-[#0F172A] focus:outline-hidden focus:border-[#37C6A3] focus:ring-2 focus:ring-[#37C6A3]/20 shadow-2xs"
                  >
                    <option value="">All Payment Methods</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CARD">Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              )}

              {/* Status Filter for Unpaid Report */}
              {activeReport === 'unpaid' && (
                <div>
                  <label className="block text-[11px] font-bold text-[#7C8A9A] mb-1.5 uppercase tracking-wide">
                    Due Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full h-11 text-xs bg-white border border-[#E7E9EE] rounded-xl px-3 font-semibold text-[#0F172A] focus:outline-hidden focus:border-[#37C6A3] focus:ring-2 focus:ring-[#37C6A3]/20 shadow-2xs"
                  >
                    <option value="ALL">All Unpaid (Pending + Overdue)</option>
                    <option value="PENDING">Pending Invoices</option>
                    <option value="OVERDUE">Overdue Invoices</option>
                  </select>
                </div>
              )}

              {/* Sort By for Outstanding */}
              {activeReport === 'outstanding' && (
                <div>
                  <label className="block text-[11px] font-bold text-[#7C8A9A] mb-1.5 uppercase tracking-wide">
                    Sort Hierarchy
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full h-11 text-xs bg-white border border-[#E7E9EE] rounded-xl px-3 font-semibold text-[#0F172A] focus:outline-hidden focus:border-[#37C6A3] focus:ring-2 focus:ring-[#37C6A3]/20 shadow-2xs"
                  >
                    <option value="default">Default (Admission No)</option>
                    <option value="largest_balance">Largest Balance First</option>
                    <option value="oldest_due">Oldest Due Date First</option>
                    <option value="student_name">Student Name (A-Z)</option>
                    <option value="class">Class Name</option>
                    <option value="section">Section Name</option>
                  </select>
                </div>
              )}
            </div>

            {/* Student Statement Student Picker */}
            {activeReport === 'student-statement' && (
              <div className="pt-3 border-t border-[#E7E9EE]">
                <label className="block text-[11px] font-bold text-[#7C8A9A] mb-1.5 uppercase tracking-wide">
                  Select Student Account
                </label>
                {statementSelectedStudent ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#E6F8F4] border border-[#37C6A3] rounded-2xl shadow-2xs">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-[#0C6B58] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        {statementSelectedStudent.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#0F172A]">
                          {statementSelectedStudent.fullName}
                        </div>
                        <div className="text-xs text-[#475569] mt-0.5">
                          Admission No: <span className="font-semibold text-[#0F172A]">{statementSelectedStudent.admissionNo}</span>
                          {statementSelectedStudent.currentClass && (
                            <span> &bull; Class: <span className="font-semibold text-[#0F172A]">{statementSelectedStudent.currentClass.name}</span></span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setStatementSelectedStudent(null)}
                      className="self-start sm:self-auto text-xs text-red-600 hover:text-red-800 font-bold px-3 py-1.5 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      Change Student
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#7C8A9A] absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        placeholder="Search student by name or admission number (min 2 letters)..."
                        value={statementStudentSearch}
                        onChange={(e) => setStatementStudentSearch(e.target.value)}
                        className="w-full h-11 text-xs bg-white border border-[#E7E9EE] rounded-xl pl-10 pr-10 font-medium text-[#0F172A] focus:outline-hidden focus:border-[#37C6A3] focus:ring-2 focus:ring-[#37C6A3]/20 shadow-2xs"
                      />
                      {isSearchingStudents && (
                        <RefreshCw className="w-4 h-4 animate-spin text-[#37C6A3] absolute right-3.5 top-3.5" />
                      )}
                    </div>

                    {studentSearchResults.length > 0 && (
                      <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-[#E7E9EE] rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-[#E7E9EE]">
                        {studentSearchResults.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setStatementSelectedStudent(s);
                              setStudentSearchResults([]);
                              setStatementStudentSearch('');
                            }}
                            className="w-full p-3 text-left text-xs hover:bg-[#F7F6F1] flex items-center justify-between transition-colors cursor-pointer"
                          >
                            <div>
                              <span className="font-bold text-[#0F172A]">{s.fullName}</span>
                              <span className="text-[#7C8A9A] ml-2">({s.admissionNo})</span>
                            </div>
                            <span className="text-[11px] text-[#0C6B58] bg-[#E6F8F4] px-2 py-0.5 rounded-md font-semibold">
                              {s.currentClass?.name || 'Unassigned'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 7. FILTER ACTION BUTTONS */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E7E9EE]/60">
              <button
                onClick={resetFilters}
                className="px-4 py-2 bg-white hover:bg-[#F7F6F1] text-[#475569] border border-[#E7E9EE] rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Reset Filters
              </button>
              <button
                onClick={fetchReportPreview}
                disabled={isLoadingPreview}
                className="px-4 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPreview ? 'animate-spin text-[#37C6A3]' : ''}`} />
                <span>Apply Filters</span>
              </button>
            </div>
          </div>

          {/* 8. ACTIVE FILTER CHIPS */}
          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-bold text-[#7C8A9A] uppercase tracking-wide mr-1">
                Applied:
              </span>
              {activeFilterChips.map((chip, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F7F6F1] border border-[#E7E9EE] text-[#0F172A] text-xs font-semibold rounded-full shadow-2xs"
                >
                  <span>{chip.label}</span>
                  <button
                    onClick={chip.onClear}
                    className="w-3.5 h-3.5 rounded-full hover:bg-[#E2E8F0] flex items-center justify-center text-[#7C8A9A] hover:text-[#0F172A] transition-colors"
                    aria-label={`Remove filter ${chip.label}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* 17. OPTIONAL RECHARTS VISUALIZATION FOR SECTION / CLASS REPORTS */}
          {visualChartData && visualChartData.length > 0 && (
            <div className="bg-[#F8FAFC] border border-[#E7E9EE] rounded-2xl p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#37C6A3]" />
                  <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                    Collection Performance Comparison ({activeReport === 'section-collection' ? 'By Section' : 'By Class'})
                  </h3>
                </div>
                <span className="text-[11px] text-[#7C8A9A] font-medium">Expected vs Realized</span>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={visualChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      interval={0}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E7E9EE',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        fontSize: '11px',
                        fontWeight: '600',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="Expected" fill="#0F172A" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Collected" fill="#37C6A3" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 18. PAYMENT METHOD SUMMARY 4 CARDS */}
          {activeReport === 'payment-method-summary' && reportData?.records && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {reportData.records.map((m: any, idx: number) => (
                <div
                  key={idx}
                  className="p-4 bg-white border border-[#E7E9EE] rounded-2xl shadow-2xs hover:border-[#CBD5E1] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0F172A]">
                      {formatPaymentMethod(m.paymentMethod)}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569]">
                      {m.transactionCount} txns
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="text-lg font-black text-[#0C6B58] tabular-nums">
                      {formatCurrency(m.completedAmount, reportData.madrasa?.currency)}
                    </div>
                    {Number(m.voidCount) > 0 && (
                      <div className="text-[11px] text-[#7C8A9A] mt-0.5 line-through">
                        Void: {formatCurrency(m.voidAmount, reportData.madrasa?.currency)} ({m.voidCount})
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 9. REPORT SUMMARY STRIP (Detailed Contextual Counters) */}
          {reportData?.summary && (
            <div className="bg-[#F7F6F1] border border-[#E7E9EE] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6">
                {Object.entries(reportData.summary)
                  .filter(([k]) => k !== 'currency')
                  .slice(0, 4)
                  .map(([key, val]) => (
                    <div key={key} className="space-y-0.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#7C8A9A]">
                        {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm sm:text-base font-extrabold text-[#0F172A] tabular-nums">
                        {typeof val === 'number' || (!isNaN(Number(val)) && !String(val).includes('%'))
                          ? formatCurrency(val, reportData.madrasa?.currency)
                          : String(val)}
                      </div>
                    </div>
                  ))}
              </div>
              <div className="text-xs font-bold px-3 py-1 bg-white border border-[#E7E9EE] rounded-full text-[#475569]">
                {reportData.totalRecords || reportData.records?.length || 0} Total Records
              </div>
            </div>
          )}

          {/* 16. INDIVIDUAL STUDENT STATEMENT SPECIAL VIEW */}
          {activeReport === 'student-statement' && reportData && (
            <div className="space-y-6">
              {reportData.student && (
                <div className="p-5 bg-white border border-[#E7E9EE] rounded-2xl shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E9EE]">
                    <div>
                      <h3 className="text-base font-black text-[#0F172A]">{reportData.student.fullName}</h3>
                      <p className="text-xs text-[#7C8A9A] mt-0.5">
                        Admission No: <span className="font-semibold text-[#0F172A]">{reportData.student.admissionNo}</span> &bull;
                        Class: <span className="font-semibold text-[#0F172A]">{reportData.student.currentClass || reportData.student.className || 'Unassigned'}</span>
                      </p>
                    </div>
                    <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-bold bg-[#E6F8F4] text-[#0C6B58] border border-[#B9EEDF]">
                      {reportData.student.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-[#7C8A9A]">Guardian: </span>
                      <span className="font-semibold text-[#0F172A]">{reportData.student.guardianName || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[#7C8A9A]">Contact: </span>
                      <span className="font-semibold text-[#0F172A]">{reportData.student.guardianPhone || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[#7C8A9A]">Enrolled: </span>
                      <span className="font-semibold text-[#0F172A]">{reportData.student.admissionDate || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[#7C8A9A]">Currency: </span>
                      <span className="font-semibold text-[#0F172A]">{reportData.madrasa?.currency || 'LKR'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Invoices Ledger Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                    Monthly Fee Billing Ledger
                  </h3>
                  <span className="text-xs text-[#7C8A9A]">
                    {reportData.billingLedger?.length || 0} Invoices
                  </span>
                </div>

                <div className="border border-[#E7E9EE] rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFC] text-[#0F172A] font-bold text-[11px] uppercase tracking-wider border-b border-[#E7E9EE]">
                        <tr>
                          <th className="px-4 py-3">Billing Month</th>
                          <th className="px-4 py-3">Invoice No</th>
                          <th className="px-4 py-3">Issue Date</th>
                          <th className="px-4 py-3">Due Date</th>
                          <th className="px-4 py-3 text-right">Expected</th>
                          <th className="px-4 py-3 text-right">Paid</th>
                          <th className="px-4 py-3 text-right">Balance</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E7E9EE]">
                        {(reportData.billingLedger || []).map((inv: any) => (
                          <tr key={inv.id || inv.invoiceNo} className="hover:bg-[#F8FAFC] transition-colors">
                            <td className="px-4 py-3 font-semibold text-[#0F172A]">{inv.month}</td>
                            <td className="px-4 py-3 font-mono text-[11px] text-[#475569]">{inv.invoiceNo}</td>
                            <td className="px-4 py-3 text-[#475569]">{inv.issueDate}</td>
                            <td className="px-4 py-3 text-[#475569]">{inv.dueDate}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{inv.expectedAmount || inv.totalAmount}</td>
                            <td className="px-4 py-3 text-right font-semibold text-[#0C6B58] tabular-nums">{inv.paidAmount}</td>
                            <td className="px-4 py-3 text-right font-bold text-[#0F172A] tabular-nums">{inv.balanceAmount}</td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  inv.status === 'PAID'
                                    ? 'bg-[#E6F8F4] text-[#0C6B58] border border-[#B9EEDF]'
                                    : inv.status === 'OVERDUE'
                                    ? 'bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4]'
                                    : inv.status === 'PARTIAL'
                                    ? 'bg-[#FEF6E6] text-[#925807] border border-[#FCE1B4]'
                                    : 'bg-[#F1F5F9] text-[#334155] border border-[#E2E8F0]'
                                }`}
                              >
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Payment History Table */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                    Payment History & Allocations
                  </h3>
                  <span className="text-xs text-[#7C8A9A]">
                    {reportData.paymentHistory?.length || 0} Transactions
                  </span>
                </div>

                <div className="border border-[#E7E9EE] rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFC] text-[#0F172A] font-bold text-[11px] uppercase tracking-wider border-b border-[#E7E9EE]">
                        <tr>
                          <th className="px-4 py-3">Paid Date</th>
                          <th className="px-4 py-3">Payment No</th>
                          <th className="px-4 py-3">Receipt No</th>
                          <th className="px-4 py-3">Method</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                          <th className="px-4 py-3 text-center">Status</th>
                          <th className="px-4 py-3">Allocated Period(s)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E7E9EE]">
                        {(reportData.paymentHistory || []).map((p: any) => (
                          <tr key={p.id || p.paymentNo} className="hover:bg-[#F8FAFC] transition-colors">
                            <td className="px-4 py-3 text-[#475569]">{p.paidAt}</td>
                            <td className="px-4 py-3 font-mono text-[11px] text-[#475569]">{p.paymentNo}</td>
                            <td className="px-4 py-3 font-mono text-[11px] text-[#475569]">{p.receiptNo}</td>
                            <td className="px-4 py-3 text-[#475569]">{formatPaymentMethod(p.paymentMethod)}</td>
                            <td className="px-4 py-3 text-right font-bold text-[#0C6B58] tabular-nums">{p.amount}</td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  p.status === 'COMPLETED'
                                    ? 'bg-[#E6F8F4] text-[#0C6B58] border border-[#B9EEDF]'
                                    : 'bg-[#F3F4F6] text-[#6B7280] line-through border border-[#E5E7EB]'
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[11px] text-[#7C8A9A]">{p.allocatedPeriods}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 10. STANDARD REPORT PREVIEW TABLE */}
          {activeReport !== 'student-statement' && (
            <div className="space-y-4">
              {/* 13. LOADING STATE: SKELETON ROWS */}
              {isLoadingPreview && !reportData ? (
                <div className="border border-[#E7E9EE] rounded-2xl overflow-hidden bg-white p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#E7E9EE]">
                    <div className="h-4 w-48 bg-[#F1F5F9] rounded-md animate-pulse" />
                    <div className="h-4 w-24 bg-[#F1F5F9] rounded-md animate-pulse" />
                  </div>
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="flex items-center gap-4 py-2">
                        <div className="h-4 w-16 bg-[#F1F5F9] rounded animate-pulse" />
                        <div className="h-4 w-40 bg-[#F1F5F9] rounded animate-pulse" />
                        <div className="h-4 w-24 bg-[#F1F5F9] rounded animate-pulse" />
                        <div className="h-4 w-28 bg-[#F1F5F9] rounded animate-pulse" />
                        <div className="h-4 w-20 ml-auto bg-[#F1F5F9] rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : previewError ? (
                /* 14. ERROR STATE */
                <div className="p-8 text-center bg-red-50/50 border border-red-200 rounded-2xl">
                  <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2.5" />
                  <h3 className="text-sm font-bold text-[#0F172A]">Unable to load this report</h3>
                  <p className="text-xs text-[#7C8A9A] mt-1 max-w-md mx-auto">{previewError}</p>
                  <button
                    onClick={fetchReportPreview}
                    className="mt-4 px-4 py-2 bg-[#0F172A] text-white rounded-xl text-xs font-bold hover:bg-[#1E293B] transition-colors cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : !reportData || !reportData.records || reportData.records.length === 0 ? (
                /* 12. EMPTY STATE */
                <div className="py-16 px-4 text-center bg-[#F8FAFC]/60 border border-[#E7E9EE] rounded-2xl">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-[#E7E9EE] flex items-center justify-center text-[#7C8A9A] mx-auto mb-3 shadow-2xs">
                    <SearchX className="w-6 h-6 text-[#7C8A9A]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#0F172A]">No records found</h3>
                  <p className="text-xs text-[#7C8A9A] mt-1 max-w-sm mx-auto">
                    Try changing the selected filters, broadening date intervals, or checking another academic section.
                  </p>
                </div>
              ) : (
                /* TABLE RENDER */
                <div className="border border-[#E7E9EE] rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFC] text-[#0F172A] font-bold text-[11px] uppercase tracking-wider border-b border-[#E7E9EE]">
                        <tr>
                          {activeReport === 'paid' && (
                            <>
                              <th className="px-4 py-3.5">Adm No</th>
                              <th className="px-4 py-3.5">Student Name</th>
                              <th className="px-4 py-3.5">Section</th>
                              <th className="px-4 py-3.5">Class</th>
                              <th className="px-4 py-3.5">Invoice No</th>
                              <th className="px-4 py-3.5 text-right">Expected</th>
                              <th className="px-4 py-3.5 text-right">Paid</th>
                              <th className="px-4 py-3.5 text-center">Status</th>
                            </>
                          )}
                          {activeReport === 'unpaid' && (
                            <>
                              <th className="px-4 py-3.5">Adm No</th>
                              <th className="px-4 py-3.5">Student Name</th>
                              <th className="px-4 py-3.5">Section</th>
                              <th className="px-4 py-3.5">Class</th>
                              <th className="px-4 py-3.5">Invoice No</th>
                              <th className="px-4 py-3.5 text-right">Balance</th>
                              <th className="px-4 py-3.5">Due Date</th>
                              <th className="px-4 py-3.5 text-center">Status</th>
                              <th className="px-4 py-3.5">Guardian Contact</th>
                            </>
                          )}
                          {activeReport === 'partial' && (
                            <>
                              <th className="px-4 py-3.5">Adm No</th>
                              <th className="px-4 py-3.5">Student Name</th>
                              <th className="px-4 py-3.5">Class</th>
                              <th className="px-4 py-3.5">Invoice No</th>
                              <th className="px-4 py-3.5 text-right">Expected</th>
                              <th className="px-4 py-3.5 text-right">Paid</th>
                              <th className="px-4 py-3.5 text-right">Balance</th>
                              <th className="px-4 py-3.5 text-center">Status</th>
                            </>
                          )}
                          {activeReport === 'overdue' && (
                            <>
                              <th className="px-4 py-3.5">Adm No</th>
                              <th className="px-4 py-3.5">Student Name</th>
                              <th className="px-4 py-3.5">Class</th>
                              <th className="px-4 py-3.5">Period</th>
                              <th className="px-4 py-3.5 text-right">Balance</th>
                              <th className="px-4 py-3.5">Due Date</th>
                              <th className="px-4 py-3.5 text-center">Days Overdue</th>
                            </>
                          )}
                          {activeReport === 'outstanding' && (
                            <>
                              <th className="px-4 py-3.5">Adm No</th>
                              <th className="px-4 py-3.5">Student Name</th>
                              <th className="px-4 py-3.5">Class</th>
                              <th className="px-4 py-3.5">Period</th>
                              <th className="px-4 py-3.5 text-right">Expected</th>
                              <th className="px-4 py-3.5 text-right">Paid</th>
                              <th className="px-4 py-3.5 text-right">Balance</th>
                              <th className="px-4 py-3.5 text-center">Status</th>
                            </>
                          )}
                          {activeReport === 'missing-invoices' && (
                            <>
                              <th className="px-4 py-3.5">Adm No</th>
                              <th className="px-4 py-3.5">Student Name</th>
                              <th className="px-4 py-3.5">Section</th>
                              <th className="px-4 py-3.5">Class</th>
                              <th className="px-4 py-3.5">Admission Date</th>
                              <th className="px-4 py-3.5 text-right">Expected Fee</th>
                              <th className="px-4 py-3.5 text-center">Status</th>
                            </>
                          )}
                          {activeReport === 'section-collection' && (
                            <>
                              <th className="px-4 py-3.5">Section Name</th>
                              <th className="px-4 py-3.5 text-center">Students Billed</th>
                              <th className="px-4 py-3.5 text-right">Expected</th>
                              <th className="px-4 py-3.5 text-right">Collected</th>
                              <th className="px-4 py-3.5 text-right">Outstanding</th>
                              <th className="px-4 py-3.5 text-center">Realization</th>
                            </>
                          )}
                          {activeReport === 'class-collection' && (
                            <>
                              <th className="px-4 py-3.5">Section</th>
                              <th className="px-4 py-3.5">Class</th>
                              <th className="px-4 py-3.5 text-center">Billed</th>
                              <th className="px-4 py-3.5 text-right">Expected</th>
                              <th className="px-4 py-3.5 text-right">Collected</th>
                              <th className="px-4 py-3.5 text-right">Outstanding</th>
                              <th className="px-4 py-3.5 text-center">Realization</th>
                            </>
                          )}
                          {activeReport === 'cash-collection' && (
                            <>
                              <th className="px-4 py-3.5">Payment Date</th>
                              <th className="px-4 py-3.5">Payment No</th>
                              <th className="px-4 py-3.5">Receipt No</th>
                              <th className="px-4 py-3.5">Student Name</th>
                              <th className="px-4 py-3.5">Class</th>
                              <th className="px-4 py-3.5">Method</th>
                              <th className="px-4 py-3.5 text-right">Amount</th>
                            </>
                          )}
                          {activeReport === 'payment-method-summary' && (
                            <>
                              <th className="px-4 py-3.5">Payment Method</th>
                              <th className="px-4 py-3.5 text-center">Completed Txns</th>
                              <th className="px-4 py-3.5 text-right">Completed Amount</th>
                              <th className="px-4 py-3.5 text-center">Void Txns</th>
                              <th className="px-4 py-3.5 text-right">Void Amount</th>
                            </>
                          )}
                          {activeReport === 'payment-history' && (
                            <>
                              <th className="px-4 py-3.5">Paid Date</th>
                              <th className="px-4 py-3.5">Payment No</th>
                              <th className="px-4 py-3.5">Receipt No</th>
                              <th className="px-4 py-3.5">Student Name</th>
                              <th className="px-4 py-3.5">Method</th>
                              <th className="px-4 py-3.5 text-right">Amount</th>
                              <th className="px-4 py-3.5 text-center">Status</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E7E9EE]">
                        {reportData.records.map((row: any, idx: number) => (
                          <tr key={row.id || idx} className="hover:bg-[#F8FAFC] transition-colors">
                            {activeReport === 'paid' && (
                              <>
                                <td className="px-4 py-3 text-[#7C8A9A] font-mono text-[11px]">{row.admissionNo}</td>
                                <td className="px-4 py-3 font-bold text-[#0F172A]">{row.studentName}</td>
                                <td className="px-4 py-3 text-[#475569]">{row.sectionName}</td>
                                <td className="px-4 py-3 text-[#475569]">{row.className}</td>
                                <td className="px-4 py-3 font-mono text-[11px] text-[#475569]">{row.invoiceNo}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{row.expectedAmount}</td>
                                <td className="px-4 py-3 text-right font-semibold text-[#0C6B58] tabular-nums">{row.paidAmount}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F8F4] text-[#0C6B58] border border-[#B9EEDF]">
                                    PAID
                                  </span>
                                </td>
                              </>
                            )}
                            {activeReport === 'unpaid' && (
                              <>
                                <td className="px-4 py-3 text-[#7C8A9A] font-mono text-[11px]">{row.admissionNo}</td>
                                <td className="px-4 py-3 font-bold text-[#0F172A]">{row.studentName}</td>
                                <td className="px-4 py-3 text-[#475569]">{row.sectionName}</td>
                                <td className="px-4 py-3 text-[#475569]">{row.className}</td>
                                <td className="px-4 py-3 font-mono text-[11px] text-[#475569]">{row.invoiceNo}</td>
                                <td className="px-4 py-3 text-right font-bold text-red-600 tabular-nums">{row.balanceAmount}</td>
                                <td className="px-4 py-3 text-[#475569]">{row.dueDate}</td>
                                <td className="px-4 py-3 text-center">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                      row.status === 'OVERDUE'
                                        ? 'bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4]'
                                        : 'bg-[#FEF6E6] text-[#925807] border border-[#FCE1B4]'
                                    }`}
                                  >
                                    {row.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-[11px] text-[#7C8A9A]">
                                  {row.guardianName} ({row.guardianPhone})
                                </td>
                              </>
                            )}
                            {activeReport === 'partial' && (
                              <>
                                <td className="px-4 py-3 text-[#7C8A9A] font-mono text-[11px]">{row.admissionNo}</td>
                                <td className="px-4 py-3 font-bold text-[#0F172A]">{row.studentName}</td>
                                <td className="px-4 py-3 text-[#475569]">{row.className}</td>
                                <td className="px-4 py-3 font-mono text-[11px] text-[#475569]">{row.invoiceNo}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{row.expectedAmount}</td>
                                <td className="px-4 py-3 text-right font-semibold text-[#0C6B58] tabular-nums">{row.paidAmount}</td>
                                <td className="px-4 py-3 text-right font-bold text-[#0F172A] tabular-nums">{row.balanceAmount}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF6E6] text-[#925807] border border-[#FCE1B4]">
                                    PARTIAL
                                  </span>
                                </td>
                              </>
                            )}
                            {activeReport === 'overdue' && (
                              <>
                                <td className="px-4 py-3 text-[#7C8A9A] font-mono text-[11px]">{row.admissionNo}</td>
                                <td className="px-4 py-3 font-bold text-[#0F172A]">{row.studentName}</td>
                                <td className="px-4 py-3 text-[#475569]">{row.className}</td>
                                <td className="px-4 py-3 text-[#475569]">{row.billingPeriod}</td>
                                <td className="px-4 py-3 text-right font-bold text-red-600 tabular-nums">{row.balanceAmount}</td>
                                <td className="px-4 py-3 text-[#475569]">{row.dueDate}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4]">
                                    {row.daysOverdue} days
                                  </span>
                                </td>
                              </>
                            )}
                            {activeReport === 'outstanding' && (
                              <>
                                <td className="px-4 py-3 text-[#7C8A9A] font-mono text-[11px]">{row.admissionNo}</td>
                                <td className="px-4 py-3 font-bold text-[#0F172A]">{row.studentName}</td>
                                <td className="px-4 py-3 text-[#475569]">{row.className}</td>
                                <td className="px-4 py-3 text-[#475569]">{row.billingPeriod}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{row.expectedAmount}</td>
                                <td className="px-4 py-3 text-right font-semibold text-[#0C6B58] tabular-nums">{row.paidAmount}</td>
                                <td className="px-4 py-3 text-right font-bold text-[#0F172A] tabular-nums">{row.balanceAmount}</td>
                                <td className="px-4 py-3 text-center">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                      row.status === 'OVERDUE'
                                        ? 'bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4]'
                                        : row.status === 'PARTIAL'
                                        ? 'bg-[#FEF6E6] text-[#925807] border border-[#FCE1B4]'
                                        : 'bg-[#F1F5F9] text-[#334155] border border-[#E2E8F0]'
                                    }`}
                                  >
                                    {row.status}
                                  </span>
                                </td>
                              </>
                            )}
                            {activeReport === 'missing-invoices' && (
                              <>
                                <td className="px-4 py-3 text-[#7C8A9A] font-mono text-[11px]">{row.admissionNo}</td>
                                <td className="px-4 py-3 font-bold text-[#0F172A]">{row.studentName}</td>
                                <td className="px-4 py-3 text-[#475569]">{row.sectionName}</td>
                                <td className="px-4 py-3 text-[#475569]">{row.className}</td>
                                <td className="px-4 py-3 text-[#475569]">{row.admissionDate}</td>
                                <td className="px-4 py-3 text-right font-bold tabular-nums">{row.expectedFee}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]">
                                    NOT GENERATED
                                  </span>
                                </td>
                              </>
                            )}
                            {activeReport === 'section-collection' && (
                              <>
                                <td className="px-4 py-3 font-bold text-[#0F172A]">{row.sectionName}</td>
                                <td className="px-4 py-3 text-center tabular-nums">{row.studentsBilled}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{row.expectedAmount}</td>
                                <td className="px-4 py-3 text-right font-semibold text-[#0C6B58] tabular-nums">{row.collectedAmount}</td>
                                <td className="px-4 py-3 text-right font-bold text-[#0F172A] tabular-nums">{row.outstandingAmount}</td>
                                <td className="px-4 py-3 text-center font-bold text-[#0C6B58] tabular-nums">{row.collectionRate}</td>
                              </>
                            )}
                            {activeReport === 'class-collection' && (
                              <>
                                <td className="px-4 py-3 text-[#475569]">{row.sectionName}</td>
                                <td className="px-4 py-3 font-bold text-[#0F172A]">{row.className}</td>
                                <td className="px-4 py-3 text-center tabular-nums">{row.studentsBilled}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{row.expectedAmount}</td>
                                <td className="px-4 py-3 text-right font-semibold text-[#0C6B58] tabular-nums">{row.collectedAmount}</td>
                                <td className="px-4 py-3 text-right font-bold text-[#0F172A] tabular-nums">{row.outstandingAmount}</td>
                                <td className="px-4 py-3 text-center font-bold text-[#0C6B58] tabular-nums">{row.collectionRate}</td>
                              </>
                            )}
                            {activeReport === 'cash-collection' && (
                              <>
                                <td className="px-4 py-3 text-[#475569]">{row.paidAt}</td>
                                <td className="px-4 py-3 font-mono text-[11px] text-[#475569]">{row.paymentNo}</td>
                                <td className="px-4 py-3 font-mono text-[11px] text-[#475569]">{row.receiptNo}</td>
                                <td className="px-4 py-3 font-bold text-[#0F172A]">{row.studentName}</td>
                                <td className="px-4 py-3 text-[#475569]">{row.className}</td>
                                <td className="px-4 py-3 text-[#475569]">{formatPaymentMethod(row.paymentMethod)}</td>
                                <td className="px-4 py-3 text-right font-bold text-[#0C6B58] tabular-nums">{row.amount}</td>
                              </>
                            )}
                            {activeReport === 'payment-method-summary' && (
                              <>
                                <td className="px-4 py-3 font-bold text-[#0F172A]">{formatPaymentMethod(row.paymentMethod)}</td>
                                <td className="px-4 py-3 text-center tabular-nums">{row.transactionCount}</td>
                                <td className="px-4 py-3 text-right font-bold text-[#0C6B58] tabular-nums">{row.completedAmount}</td>
                                <td className="px-4 py-3 text-center text-[#7C8A9A] tabular-nums">{row.voidCount}</td>
                                <td className="px-4 py-3 text-right text-[#7C8A9A] tabular-nums">{row.voidAmount}</td>
                              </>
                            )}
                            {activeReport === 'payment-history' && (
                              <>
                                <td className="px-4 py-3 text-[#475569]">{row.paidAt}</td>
                                <td className="px-4 py-3 font-mono text-[11px] text-[#475569]">{row.paymentNo}</td>
                                <td className="px-4 py-3 font-mono text-[11px] text-[#475569]">{row.receiptNo}</td>
                                <td className="px-4 py-3 font-bold text-[#0F172A]">{row.studentName}</td>
                                <td className="px-4 py-3 text-[#475569]">{formatPaymentMethod(row.paymentMethod)}</td>
                                <td className="px-4 py-3 text-right font-bold text-[#0C6B58] tabular-nums">{row.amount}</td>
                                <td className="px-4 py-3 text-center">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                      row.status === 'COMPLETED'
                                        ? 'bg-[#E6F8F4] text-[#0C6B58] border border-[#B9EEDF]'
                                        : 'bg-[#F3F4F6] text-[#6B7280] line-through border border-[#E5E7EB]'
                                    }`}
                                  >
                                    {row.status}
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 15. CLEAN PAGINATION FOOTER */}
              {reportData?.pagination && reportData.pagination.totalPages > 1 && (
                <div className="p-4 bg-[#F8FAFC]/50 border border-[#E7E9EE] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="text-[#7C8A9A] font-medium">
                    Showing <span className="font-bold text-[#0F172A]">{(page - 1) * limit + 1}</span> to{' '}
                    <span className="font-bold text-[#0F172A]">
                      {Math.min(page * limit, reportData.pagination.totalRecords)}
                    </span>{' '}
                    of <span className="font-bold text-[#0F172A]">{reportData.pagination.totalRecords}</span> records
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-3 py-1.5 rounded-xl border border-[#E7E9EE] bg-white text-[#475569] hover:text-[#0F172A] hover:bg-[#F7F6F1] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>

                    {/* Numeric Page Buttons */}
                    <div className="hidden sm:flex items-center gap-1">
                      {Array.from({ length: Math.min(5, reportData.pagination.totalPages) }, (_, i) => {
                        let pageNum = i + 1;
                        if (reportData.pagination!.totalPages > 5 && page > 3) {
                          pageNum = page - 2 + i;
                          if (pageNum > reportData.pagination!.totalPages) {
                            pageNum = reportData.pagination!.totalPages - (4 - i);
                          }
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              page === pageNum
                                ? 'bg-[#0F172A] text-white shadow-xs'
                                : 'bg-white border border-[#E7E9EE] text-[#475569] hover:bg-[#F7F6F1] hover:text-[#0F172A]'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setPage((p) => Math.min(reportData.pagination!.totalPages, p + 1))}
                      disabled={page >= reportData.pagination.totalPages}
                      className="px-3 py-1.5 rounded-xl border border-[#E7E9EE] bg-white text-[#475569] hover:text-[#0F172A] hover:bg-[#F7F6F1] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
