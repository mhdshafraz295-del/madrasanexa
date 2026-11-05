import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  MessageCircle,
  Edit3,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  Mail,
} from 'lucide-react';
import {
  generateSalaries,
  listSalaries,
  downloadSalarySlipPdf,
  buildSalaryWhatsAppUrl,
  maskEmail,
  type UstadhSalaryItem,
  type UstadhSalaryStatus,
} from '../../services/ustadh.service';
import { SalaryEmailModal } from './SalaryEmailModal';
import { formatDateOnly } from '../../utils/dateTime';

interface MonthlySalaryTabProps {
  onAdjustSalary: (salary: UstadhSalaryItem) => void;
  onPaySalary: (salary: UstadhSalaryItem) => void;
  madrasaName?: string;
  refreshKey: number;
}

export const MonthlySalaryTab: React.FC<MonthlySalaryTabProps> = ({
  onAdjustSalary,
  onPaySalary,
  madrasaName,
  refreshKey,
}) => {
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [salaries, setSalaries] = useState<UstadhSalaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [emailModalSalary, setEmailModalSalary] = useState<UstadhSalaryItem | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | UstadhSalaryStatus>('ALL');
  const [staffTypeFilter, setStaffTypeFilter] = useState<'ALL' | 'USTADH' | 'SCHOOL_TEACHER'>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSalaries = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listSalaries({
        month: selectedMonth,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        staffType: staffTypeFilter === 'ALL' ? undefined : staffTypeFilter,
        pageSize: 100,
      });
      setSalaries(res.items);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to load salaries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaries();
  }, [selectedMonth, statusFilter, staffTypeFilter, refreshKey]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await generateSalaries(selectedMonth);
      setSuccess(`Generated / loaded salary sheet for ${res.items.length} staff member(s) for ${selectedMonth}.`);
      setTimeout(() => setSuccess(null), 4000);
      fetchSalaries();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to generate salaries');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadSlip = async (salary: UstadhSalaryItem) => {
    setDownloadingId(salary.id);
    try {
      const filename = `SalarySlip_${salary.ustadh.fullName.replace(/\s+/g, '_')}_${salary.salaryMonth}.pdf`;
      await downloadSalarySlipPdf(salary.id, filename);
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || 'Failed to download salary slip PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  // Filtered by search
  const filteredSalaries = salaries.filter((s) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      s.ustadh.fullName.toLowerCase().includes(term) ||
      s.ustadh.ustadhCode.toLowerCase().includes(term)
    );
  });

  // Aggregates
  const totalSalaries = salaries.length;
  const totalPayable = salaries.reduce((acc, s) => acc + s.payableAmount, 0);
  const paidCount = salaries.filter((s) => s.status === 'PAID').length;
  const paidAmount = salaries
    .filter((s) => s.status === 'PAID')
    .reduce((acc, s) => acc + s.payableAmount, 0);
  const pendingCount = salaries.filter((s) => s.status === 'PENDING').length;
  const pendingAmount = salaries
    .filter((s) => s.status === 'PENDING')
    .reduce((acc, s) => acc + s.payableAmount, 0);

  return (
    <div className="space-y-6">
      {/* Month Selector and Generate Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <label className="text-sm font-semibold text-slate-700">Salary Month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>Generate / Load Payroll</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-emerald-800 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Aggregate Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Ustadhs on Payroll</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalSalaries}</div>
          <div className="text-xs text-slate-400 mt-1">Total {selectedMonth}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-medium">Total Payroll Budget</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 flex items-center">
            <DollarSign className="w-5 h-5 text-slate-400" />
            <span>{totalPayable.toLocaleString()}</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Payable across staff</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-emerald-600 font-medium">Paid Salaries</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 flex items-center">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <span>{paidAmount.toLocaleString()}</span>
          </div>
          <div className="text-xs text-emerald-600/80 mt-1">
            {paidCount} of {totalSalaries} staff paid
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-amber-600 font-medium">Pending Disbursement</div>
          <div className="text-2xl font-bold text-amber-700 mt-1 flex items-center">
            <DollarSign className="w-5 h-5 text-amber-600" />
            <span>{pendingAmount.toLocaleString()}</span>
          </div>
          <div className="text-xs text-amber-600/80 mt-1">
            {pendingCount} staff pending
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by Ustadh name or code..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Staff Type Filter */}
          <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setStaffTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded font-medium ${
                staffTypeFilter === 'ALL'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Staff
            </button>
            <button
              type="button"
              onClick={() => setStaffTypeFilter('USTADH')}
              className={`px-2.5 py-1 rounded font-medium ${
                staffTypeFilter === 'USTADH'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ustadh
            </button>
            <button
              type="button"
              onClick={() => setStaffTypeFilter('SCHOOL_TEACHER')}
              className={`px-2.5 py-1 rounded font-medium ${
                staffTypeFilter === 'SCHOOL_TEACHER'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Teacher
            </button>
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded font-medium ${
                statusFilter === 'ALL'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({totalSalaries})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('PENDING')}
              className={`px-2.5 py-1 rounded font-medium ${
                statusFilter === 'PENDING'
                  ? 'bg-white text-amber-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('PAID')}
              className={`px-2.5 py-1 rounded font-medium ${
                statusFilter === 'PAID'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paid ({paidCount})
            </button>
          </div>
        </div>
      </div>

      {/* Salary Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Staff Member</th>
                <th className="py-3.5 px-4">Base Salary</th>
                <th className="py-3.5 px-4">Attendance (Info)</th>
                <th className="py-3.5 px-4">Payable Amount</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
                    <span>Loading monthly salaries...</span>
                  </td>
                </tr>
              ) : filteredSalaries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No salary records found for {selectedMonth}. Click "Generate / Load Payroll" to generate drafts.
                  </td>
                </tr>
              ) : (
                filteredSalaries.map((s) => {
                  const isAdjusted = s.payableAmount !== s.baseSalarySnapshot;
                  const isPaid = s.status === 'PAID';
                  const waUrl =
                    isPaid && s.ustadh.whatsappNumber
                      ? buildSalaryWhatsAppUrl({
                          whatsappNumber: s.ustadh.whatsappNumber,
                          ustadhName: s.ustadh.fullName,
                          salaryMonth: s.salaryMonth,
                          payableAmount: s.payableAmount,
                          paymentMethod: s.paymentMethodLabel || s.paymentMethod,
                          paymentDate: s.paymentDate,
                          madrasaName,
                        })
                      : null;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/75 transition-colors">
                      {/* Staff Member */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-900">{s.ustadh.fullName}</span>
                          {s.ustadh.staffType && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                                s.ustadh.staffType === 'SCHOOL_TEACHER'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {s.ustadh.staffType === 'SCHOOL_TEACHER' ? 'Teacher' : 'Ustadh'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-emerald-700">{s.ustadh.ustadhCode}</div>
                      </td>

                      {/* Base Salary */}
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {s.baseSalarySnapshot.toLocaleString()}
                      </td>

                      {/* Attendance Stats */}
                      <td className="py-3.5 px-4">
                        {s.attendance ? (
                          <div className="text-xs space-y-0.5">
                            <div className="font-medium text-slate-800">
                              {s.attendance.presentSessions} / {s.attendance.recordedSessions} present ({s.attendance.attendancePercentage}%)
                            </div>
                            <div className="text-slate-400 text-[11px]">
                              {s.attendance.absentSessions} absent session(s)
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No attendance data</span>
                        )}
                      </td>

                      {/* Payable Amount */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                          <span>{s.payableAmount.toLocaleString()}</span>
                          {isAdjusted && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 font-semibold rounded" title={s.adjustmentReason || 'Adjusted'}>
                              Adjusted
                            </span>
                          )}
                        </div>
                        {isAdjusted && s.adjustmentReason && (
                          <div className="text-[11px] text-amber-700 truncate max-w-[200px]" title={s.adjustmentReason}>
                            Reason: {s.adjustmentReason}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isPaid ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>PAID</span>
                            </span>
                            <div className="text-[11px] text-slate-400 mt-1">
                              {s.paymentDate ? formatDateOnly(s.paymentDate) : ''} • {s.paymentMethodLabel || s.paymentMethod}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>PENDING</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {!isPaid ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onAdjustSalary(s)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                title="Adjust Payable Amount"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                                <span>Adjust</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onPaySalary(s)}
                                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Mark Paid</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleDownloadSlip(s)}
                                disabled={downloadingId === s.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                                title="Download PDF Salary Slip"
                              >
                                {downloadingId === s.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5 text-slate-500" />
                                )}
                                <span>Slip PDF</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setEmailModalSalary(s)}
                                disabled={!s.ustadh.email}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={s.ustadh.email ? `Send Email to ${maskEmail(s.ustadh.email)}` : 'No email address is available for this staff member.'}
                              >
                                <Mail className="w-3.5 h-3.5 text-blue-600" />
                                <span>Send Email</span>
                              </button>

                              {waUrl && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                                  title="Send WhatsApp Confirmation"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>WhatsApp</span>
                                </a>
                              )}
                            </>
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
      </div>

      {/* Salary Email Quick Message Composer Modal */}
      {emailModalSalary && (
        <SalaryEmailModal
          salary={emailModalSalary}
          isOpen={!!emailModalSalary}
          onClose={() => setEmailModalSalary(null)}
          onSuccess={(msg) => {
            setSuccess(msg);
            setTimeout(() => setSuccess(null), 5000);
          }}
          madrasaName={madrasaName}
        />
      )}
    </div>
  );
};
