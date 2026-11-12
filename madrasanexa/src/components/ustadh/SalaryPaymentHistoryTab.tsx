import React, { useState, useEffect } from 'react';
import {
  Download,
  MessageCircle,
  Filter,
  Loader2,
  Mail,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  listSalaries,
  downloadSalarySlipPdf,
  buildSalaryWhatsAppUrl,
  maskEmail,
  type UstadhSalaryItem,
} from '../../services/ustadh.service';
import { SalaryEmailModal } from './SalaryEmailModal';
import { formatDateOnly } from '../../utils/dateTime';

interface SalaryPaymentHistoryTabProps {
  ustadhsList: Array<{ id: string; fullName: string; ustadhCode: string; staffType?: any }>;
  madrasaName?: string;
  refreshKey: number;
}

export const SalaryPaymentHistoryTab: React.FC<SalaryPaymentHistoryTabProps> = ({
  ustadhsList,
  madrasaName,
  refreshKey,
}) => {
  const [items, setItems] = useState<UstadhSalaryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [selectedUstadhId, setSelectedUstadhId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [emailModalSalary, setEmailModalSalary] = useState<UstadhSalaryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchPaidSalaries = async () => {
    setLoading(true);
    try {
      const res = await listSalaries({
        month: selectedMonth || undefined,
        ustadhId: selectedUstadhId || undefined,
        status: 'PAID',
        page,
        pageSize,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaidSalaries();
  }, [page, selectedUstadhId, selectedMonth, refreshKey]);

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

  const totalPaidSum = items.reduce((acc, s) => acc + s.payableAmount, 0);

  return (
    <div className="space-y-6">
      {/* Feedback Alerts */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold ml-2">✕</button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
          <button type="button" onClick={() => setSuccess(null)} className="text-emerald-500 hover:text-emerald-700 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Top Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <h3 className="font-semibold text-slate-800 text-sm">Disbursement History</h3>
          <span className="text-xs px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded-full border border-emerald-200">
            Total Paid: {totalPaidSum.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <span className="font-medium text-slate-600 shrink-0">Staff:</span>
            <select
              value={selectedUstadhId}
              onChange={(e) => {
                setSelectedUstadhId(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-auto sm:max-w-xs min-w-0 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Staff</option>
              {ustadhsList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.ustadhCode}){u.staffType === 'SCHOOL_TEACHER' ? ' — Teacher' : ' — Ustadh'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-slate-600">Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {selectedMonth && (
              <button
                type="button"
                onClick={() => setSelectedMonth('')}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* History Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Staff Member</th>
                <th className="py-3.5 px-4">Salary Month</th>
                <th className="py-3.5 px-4">Paid Amount</th>
                <th className="py-3.5 px-4">Payment Method</th>
                <th className="py-3.5 px-4">Payment Date</th>
                <th className="py-3.5 px-4">Reference / Note</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
                    <span>Loading payment history...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No payment history records found matching the filter.
                  </td>
                </tr>
              ) : (
                items.map((s) => {
                  const waUrl = s.ustadh.whatsappNumber
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

                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {s.salaryMonth}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {s.payableAmount.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-700 font-medium">
                        {s.paymentMethodLabel || s.paymentMethod || 'OTHER'}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {s.paymentDate ? formatDateOnly(s.paymentDate) : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-500 max-w-[200px] truncate">
                        {s.paymentReference && (
                          <div className="font-mono text-slate-700 font-medium">
                            Ref: {s.paymentReference}
                          </div>
                        )}
                        {s.paymentNote && <div>{s.paymentNote}</div>}
                        {!s.paymentReference && !s.paymentNote && '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
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
                            <span>Slip</span>
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
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
            <div>
              Showing {items.length} of {total} records
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-2 font-medium">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
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
