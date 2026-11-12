import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  apiListInvoices,
  apiListClasses,
  apiVoidInvoice,
  type InvoiceListItem,
  type InvoiceSummaryKpi,
  type ClassItem,
} from '../../services/api';
import {
  Receipt,
  Plus,
  Search,
  Eye,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Ban,
  DollarSign,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [summary, setSummary] = useState<InvoiceSummaryKpi | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const currentYear = new Date().getFullYear();
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string>(String(currentYear));
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Void Modal State
  const [voidModalInvoice, setVoidModalInvoice] = useState<InvoiceListItem | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  // Load Classes for filter dropdown
  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await apiListClasses({ pageSize: 100, status: 'ALL' });
        setClasses(res.items || res.classes || []);
      } catch (err) {
        console.error('Failed to load class filters:', err);
      }
    }
    loadClasses();
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiListInvoices({
        page,
        pageSize,
        search: search.trim() || undefined,
        billingYear: yearFilter === 'ALL' ? undefined : Number(yearFilter),
        billingMonth: monthFilter === 'ALL' ? undefined : Number(monthFilter),
        classId: classFilter === 'ALL' ? undefined : classFilter,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });

      setInvoices(data.items || []);
      setSummary(data.summary);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (err: any) {
      console.error('Failed to load invoices:', err);
      setError(err.response?.data?.message || 'Failed to load invoices. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, yearFilter, monthFilter, classFilter, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleOpenVoidModal = (inv: InvoiceListItem) => {
    setVoidModalInvoice(inv);
    setVoidReason('');
    setVoidError(null);
  };

  const handleExecuteVoid = async () => {
    if (!voidModalInvoice) return;
    if (!voidReason.trim()) {
      setVoidError('Please provide a reason for voiding this invoice.');
      return;
    }

    try {
      setIsVoiding(true);
      setVoidError(null);
      await apiVoidInvoice(voidModalInvoice.id, voidReason.trim());
      setVoidModalInvoice(null);
      await fetchInvoices();
    } catch (err: any) {
      console.error('Failed to void invoice:', err);
      setVoidError(err.response?.data?.message || 'Failed to void invoice.');
    } finally {
      setIsVoiding(false);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setYearFilter(String(currentYear));
    setMonthFilter('ALL');
    setClassFilter('ALL');
    setStatusFilter('ALL');
    setPage(1);
  };

  // Status Badge Helper
  const renderStatusBadge = (displayStatus: string) => {
    switch (displayStatus) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Paid
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Overdue
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5" />
            Partial
          </span>
        );
      case 'VOID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <Ban className="w-3.5 h-3.5" />
            Void
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#37C6A3]/10 text-[#2BB393] rounded-xl">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#0F172A]">Invoices Directory</h1>
              <p className="text-sm text-[#7C8A9A]">
                Generate and oversee student monthly tuition fees, balances, and overdue statuses.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/madrasa-admin/invoices/generate')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#37C6A3] hover:bg-[#2BB393] text-white font-semibold text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Generate Monthly Invoices
        </button>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#7C8A9A] uppercase tracking-wider">Total Active Invoices</p>
              <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{summary.totalInvoices}</h3>
              <p className="text-xs text-[#7C8A9A] mt-1">
                {summary.voidCount} void excluded
              </p>
            </div>
            <div className="p-3 bg-[#37C6A3]/10 text-[#2BB393] rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#7C8A9A] uppercase tracking-wider">Expected Collectible</p>
              <h3 className="text-2xl font-bold text-[#0F172A] mt-1">LKR {summary.expectedAmount}</h3>
              <p className="text-xs text-emerald-600 font-medium mt-1">
                LKR {summary.paidAmount} received
              </p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#7C8A9A] uppercase tracking-wider">Outstanding Balance</p>
              <h3 className="text-2xl font-bold text-amber-600 mt-1">LKR {summary.outstandingAmount}</h3>
              <p className="text-xs text-[#7C8A9A] mt-1">
                Across active unpaid invoices
              </p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#7C8A9A] uppercase tracking-wider">Overdue Invoices</p>
              <h3 className="text-2xl font-bold text-red-600 mt-1">{summary.overdueCount}</h3>
              <p className="text-xs text-red-500 font-medium mt-1">
                Past due date with balance
              </p>
            </div>
            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7C8A9A]" />
            <input
              type="text"
              placeholder="Search by invoice #, admission # or name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-sm bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:bg-white focus:outline-hidden focus:border-[#37C6A3] focus:ring-1 focus:ring-[#37C6A3] transition-all"
            />
          </div>

          {/* Billing Year */}
          <div>
            <select
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:bg-white focus:outline-hidden focus:border-[#37C6A3] focus:ring-1 focus:ring-[#37C6A3] transition-all"
            >
              <option value="ALL">All Years</option>
              <option value={String(currentYear - 1)}>{currentYear - 1}</option>
              <option value={String(currentYear)}>{currentYear}</option>
              <option value={String(currentYear + 1)}>{currentYear + 1}</option>
            </select>
          </div>

          {/* Billing Month */}
          <div>
            <select
              value={monthFilter}
              onChange={(e) => {
                setMonthFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:bg-white focus:outline-hidden focus:border-[#37C6A3] focus:ring-1 focus:ring-[#37C6A3] transition-all"
            >
              <option value="ALL">All Months</option>
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={String(idx + 1)}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:bg-white focus:outline-hidden focus:border-[#37C6A3] focus:ring-1 focus:ring-[#37C6A3] transition-all"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending (Upcoming/Current)</option>
              <option value="OVERDUE">Overdue</option>
              <option value="PARTIAL">Partially Paid</option>
              <option value="PAID">Paid</option>
              <option value="VOID">Void</option>
            </select>
          </div>
        </div>

        {/* Secondary row: Class filter and Clear */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E7E9EE]/60 text-xs text-[#7C8A9A]">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[#0F172A]">Filter by Class:</span>
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-lg focus:bg-white focus:outline-hidden focus:border-[#37C6A3]"
            >
              <option value="ALL">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {(search || yearFilter !== String(currentYear) || monthFilter !== 'ALL' || classFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 text-xs text-[#2BB393] hover:underline font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Content Area */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3]" />
            <p className="text-sm font-medium text-[#7C8A9A]">Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-[#F7F6F1] flex items-center justify-center mx-auto mb-3 text-[#7C8A9A]">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-[#0F172A]">No invoices found</h3>
            <p className="text-sm text-[#7C8A9A] max-w-sm mx-auto mt-1">
              No invoice records matched your filter criteria or no invoices have been generated for this period.
            </p>
            <button
              onClick={() => navigate('/madrasa-admin/invoices/generate')}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#37C6A3] hover:bg-[#2BB393] text-white font-medium text-xs rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Generate First Invoices
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E7E9EE] bg-[#F7F6F1]/50 text-xs font-semibold text-[#7C8A9A] whitespace-nowrap">
                    <th className="py-3.5 px-4">Invoice #</th>
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Current Class</th>
                    <th className="py-3.5 px-4">Period</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4 text-right">Total</th>
                    <th className="py-3.5 px-4 text-right">Balance</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E9EE]/70">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#F7F6F1]/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-xs text-[#0F172A]">
                        <Link
                          to={`/madrasa-admin/invoices/${inv.id}`}
                          className="text-[#2BB393] hover:underline"
                        >
                          {inv.invoiceNo}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#0F172A]">{inv.student.fullName}</div>
                        <div className="text-xs text-[#7C8A9A] font-mono">{inv.student.admissionNo}</div>
                      </td>
                      <td className="py-3 px-4">
                        {inv.student.currentClass ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {inv.student.currentClass.name}
                          </span>
                        ) : (
                          <span className="text-xs text-[#7C8A9A] italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#0F172A]">
                        {inv.monthName} {inv.billingYear}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#7C8A9A]">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-[#0F172A]">
                        LKR {inv.totalAmount}
                      </td>
                      <td className="py-3 px-4 text-right font-bold">
                        <span className={Number(inv.balanceAmount) > 0 ? 'text-red-600' : 'text-emerald-600'}>
                          LKR {inv.balanceAmount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {renderStatusBadge(inv.displayStatus)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/madrasa-admin/invoices/${inv.id}`}
                            className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1] rounded-lg transition-colors"
                            title="View Invoice Dossier"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {inv.status !== 'VOID' && Number(inv.paidAmount) === 0 && (
                            <button
                              onClick={() => handleOpenVoidModal(inv)}
                              className="p-1.5 text-[#7C8A9A] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Void Invoice"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-[#E7E9EE]">
              {invoices.map((inv) => (
                <div key={inv.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#2BB393]">
                      <Link to={`/madrasa-admin/invoices/${inv.id}`}>{inv.invoiceNo}</Link>
                    </span>
                    {renderStatusBadge(inv.displayStatus)}
                  </div>
                  <div>
                    <h4 className="font-medium text-[#0F172A]">{inv.student.fullName}</h4>
                    <p className="text-xs text-[#7C8A9A] font-mono">
                      Adm: {inv.student.admissionNo} • Current Class:{' '}
                      {inv.student.currentClass?.name || 'Unassigned'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-[#E7E9EE]/60">
                    <span className="text-[#7C8A9A]">
                      {inv.monthName} {inv.billingYear} • Due {new Date(inv.dueDate).toLocaleDateString()}
                    </span>
                    <div className="text-right">
                      <span className="text-[#7C8A9A] mr-2">Total: LKR {inv.totalAmount}</span>
                      <span className="font-bold text-red-600">Bal: LKR {inv.balanceAmount}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Link
                      to={`/madrasa-admin/invoices/${inv.id}`}
                      className="px-3 py-1.5 text-xs font-medium text-[#0F172A] bg-[#F7F6F1] rounded-lg hover:bg-[#E7E9EE]"
                    >
                      View Dossier
                    </Link>
                    {inv.status !== 'VOID' && Number(inv.paidAmount) === 0 && (
                      <button
                        onClick={() => handleOpenVoidModal(inv)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer"
                      >
                        Void
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-[#E7E9EE] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#7C8A9A]">
                <span>
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} invoices
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-[#E7E9EE] hover:bg-[#F7F6F1] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-medium text-[#0F172A]">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-[#E7E9EE] hover:bg-[#F7F6F1] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Void Invoice Confirmation Modal */}
      {voidModalInvoice && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl border border-[#E7E9EE] space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <Ban className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">Void Invoice</h3>
                <p className="text-xs text-[#7C8A9A] font-mono">{voidModalInvoice.invoiceNo}</p>
              </div>
            </div>

            <div className="text-sm text-[#7C8A9A] space-y-2">
              <p>
                Are you sure you want to void this invoice for{' '}
                <strong className="text-[#0F172A]">{voidModalInvoice.student.fullName}</strong>?
              </p>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs">
                Voiding is an audit-tracked action. The invoice balance will become non-collectible, and original notes will be preserved.
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0F172A]">
                Reason for Voiding <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Duplicate generated by mistake, student fee waived by administration..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:bg-white focus:outline-hidden focus:border-[#37C6A3] focus:ring-1 focus:ring-[#37C6A3]"
              />
            </div>

            {voidError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{voidError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setVoidModalInvoice(null)}
                disabled={isVoiding}
                className="px-4 py-2 text-xs font-semibold text-[#7C8A9A] hover:text-[#0F172A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteVoid}
                disabled={isVoiding}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isVoiding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
