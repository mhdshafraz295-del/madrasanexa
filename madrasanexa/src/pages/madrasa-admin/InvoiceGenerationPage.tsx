import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  apiListClasses,
  apiPreviewInvoices,
  apiGenerateInvoices,
  type ClassItem,
  type InvoicePreviewResponse,
  type InvoiceGenerateResponse,
} from '../../services/api';
import {
  Receipt,
  ArrowLeft,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function InvoiceGenerationPage() {
  const navigate = useNavigate();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Form Configuration
  const [billingYear, setBillingYear] = useState<number>(currentYear);
  const [billingMonth, setBillingMonth] = useState<number>(currentMonth);
  // Default due date: 10th of current/selected month
  const defaultDueDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-10`;
  const [dueDate, setDueDate] = useState<string>(defaultDueDate);
  const [classId, setClassId] = useState<string>('ALL');
  const [notes, setNotes] = useState<string>('');

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<InvoicePreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Generation State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationResult, setGenerationResult] = useState<InvoiceGenerateResponse | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);

  // Load Classes
  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await apiListClasses({ pageSize: 100, status: 'ACTIVE' });
        setClasses(res.items || res.classes || []);
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    }
    loadClasses();
  }, []);

  // Update default due date when month/year changes
  const handlePeriodChange = (newYear: number, newMonth: number) => {
    setBillingYear(newYear);
    setBillingMonth(newMonth);
    setDueDate(`${newYear}-${String(newMonth).padStart(2, '0')}-10`);
    setPreviewData(null);
    setGenerationResult(null);
  };

  // Run Preview
  const handleFetchPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dueDate) {
      setPreviewError('Please select a due date.');
      return;
    }

    try {
      setIsPreviewing(true);
      setPreviewError(null);
      setGenerationResult(null);

      const preview = await apiPreviewInvoices({
        billingYear,
        billingMonth,
        dueDate,
        classId: classId === 'ALL' ? undefined : classId,
      });

      setPreviewData(preview);
    } catch (err: any) {
      console.error('Failed to preview invoices:', err);
      setPreviewError(err.response?.data?.message || 'Failed to preview invoices.');
    } finally {
      setIsPreviewing(false);
    }
  };

  // Run Generation
  const handleExecuteGeneration = async () => {
    if (!previewData || previewData.readyCount === 0) return;

    try {
      setIsGenerating(true);
      setGenerationError(null);
      setConfirmModalOpen(false);

      const res = await apiGenerateInvoices({
        billingYear,
        billingMonth,
        dueDate,
        classId: classId === 'ALL' ? undefined : classId,
        notes: notes.trim() || undefined,
      });

      setGenerationResult(res);
      setPreviewData(null);
    } catch (err: any) {
      console.error('Failed to generate invoices:', err);
      setGenerationError(err.response?.data?.message || 'Failed to generate invoices.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/madrasa-admin/invoices"
            className="p-2 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-white rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Generate Monthly Invoices</h1>
            <p className="text-sm text-[#7C8A9A]">
              Preview and batch-generate tuition fee invoices for active students with duplicate protection.
            </p>
          </div>
        </div>
      </div>

      {/* Step 1: Configuration Form */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs p-6 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-[#E7E9EE] text-sm font-bold text-[#0F172A]">
          <Calendar className="w-4 h-4 text-[#37C6A3]" />
          <span>Billing Period & Parameters</span>
        </div>

        <form onSubmit={handleFetchPreview} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Year */}
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                Billing Year <span className="text-red-500">*</span>
              </label>
              <select
                value={billingYear}
                onChange={(e) => handlePeriodChange(Number(e.target.value), billingMonth)}
                disabled={isGenerating}
                className="w-full px-3 py-2 text-sm bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:bg-white focus:outline-hidden focus:border-[#37C6A3] focus:ring-1 focus:ring-[#37C6A3]"
              >
                <option value={currentYear - 1}>{currentYear - 1}</option>
                <option value={currentYear}>{currentYear}</option>
                <option value={currentYear + 1}>{currentYear + 1}</option>
              </select>
            </div>

            {/* Month */}
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                Billing Month <span className="text-red-500">*</span>
              </label>
              <select
                value={billingMonth}
                onChange={(e) => handlePeriodChange(billingYear, Number(e.target.value))}
                disabled={isGenerating}
                className="w-full px-3 py-2 text-sm bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:bg-white focus:outline-hidden focus:border-[#37C6A3] focus:ring-1 focus:ring-[#37C6A3]"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                Payment Due Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setPreviewData(null);
                }}
                disabled={isGenerating}
                required
                className="w-full px-3 py-2 text-sm bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:bg-white focus:outline-hidden focus:border-[#37C6A3] focus:ring-1 focus:ring-[#37C6A3]"
              />
            </div>

            {/* Class Filter */}
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                Target Class (Optional)
              </label>
              <select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setPreviewData(null);
                }}
                disabled={isGenerating}
                className="w-full px-3 py-2 text-sm bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:bg-white focus:outline-hidden focus:border-[#37C6A3] focus:ring-1 focus:ring-[#37C6A3]"
              >
                <option value="ALL">All Active Classes (Madrasa-wide)</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
              Invoice Memo / Remarks (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Monthly tuition fee for September 2026"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isGenerating}
              className="w-full px-3 py-2 text-sm bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:bg-white focus:outline-hidden focus:border-[#37C6A3] focus:ring-1 focus:ring-[#37C6A3]"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-[#7C8A9A]">
              Duplicate prevention will automatically check existing invoices for{' '}
              <strong className="text-[#0F172A]">
                {MONTH_NAMES[billingMonth - 1]} {billingYear}
              </strong>
              .
            </p>
            <button
              type="submit"
              disabled={isPreviewing || isGenerating}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#37C6A3] hover:bg-[#2BB393] text-white text-sm font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isPreviewing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Calculating Eligibility...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Preview Invoices
                </>
              )}
            </button>
          </div>
        </form>

        {previewError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{previewError}</span>
          </div>
        )}
      </div>

      {/* Step 2: Preview Results */}
      {previewData && (
        <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[#E7E9EE]">
            <div>
              <h2 className="text-lg font-bold text-[#0F172A]">
                Generation Preview: {previewData.monthName} {previewData.billingYear}
              </h2>
              <p className="text-xs text-[#7C8A9A] mt-0.5">
                Due Date: {previewData.dueDate ? new Date(previewData.dueDate).toLocaleDateString() : 'None'} • Evaluated {previewData.eligibleCount} enrolled students
              </p>
            </div>

            {previewData.readyCount > 0 && (
              <button
                onClick={() => setConfirmModalOpen(true)}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Generate {previewData.readyCount} Invoices (LKR {previewData.totalExpectedAmount})
              </button>
            )}
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="font-semibold text-emerald-800">Ready to Generate</span>
              <p className="text-xl font-bold text-emerald-700 mt-1">{previewData.readyCount}</p>
              <p className="text-[11px] text-emerald-600">Total: LKR {previewData.totalExpectedAmount}</p>
            </div>

            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
              <span className="font-semibold text-blue-800">Already Invoiced</span>
              <p className="text-xl font-bold text-blue-700 mt-1">{previewData.alreadyInvoicedCount}</p>
              <p className="text-[11px] text-blue-600">Protected against duplicates</p>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <span className="font-semibold text-amber-800">Skipped (No Fee)</span>
              <p className="text-xl font-bold text-amber-700 mt-1">
                {previewData.skippedBreakdown.noFee}
              </p>
              <p className="text-[11px] text-amber-600">Unconfigured monthly fee</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-semibold text-slate-800">Other Ineligible</span>
              <p className="text-xl font-bold text-slate-700 mt-1">
                {previewData.skippedBreakdown.inactive +
                  previewData.skippedBreakdown.archived +
                  previewData.skippedBreakdown.notAdmitted}
              </p>
              <p className="text-[11px] text-slate-600">Inactive or future admitted</p>
            </div>
          </div>

          {/* Table of Candidate Students */}
          <div className="border border-[#E7E9EE] rounded-xl overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[#F7F6F1] border-b border-[#E7E9EE] text-[#7C8A9A] font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Adm #</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Class</th>
                    <th className="py-2.5 px-3">Fee Source</th>
                    <th className="py-2.5 px-3 text-right">Fee Amount</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E9EE]">
                  {previewData.items.map((item) => (
                    <tr key={item.studentId} className="hover:bg-[#F7F6F1]/40">
                      <td className="py-2 px-3 font-mono font-medium text-[#0F172A]">
                        {item.admissionNo}
                      </td>
                      <td className="py-2 px-3 font-medium text-[#0F172A]">{item.studentName}</td>
                      <td className="py-2 px-3 text-[#7C8A9A]">{item.className}</td>
                      <td className="py-2 px-3">
                        {item.feeSource === 'STUDENT_OVERRIDE' && (
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-mono text-[10px]">
                            Student Override
                          </span>
                        )}
                        {item.feeSource === 'CLASS_DEFAULT' && (
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px]">
                            Class Default
                          </span>
                        )}
                        {item.feeSource === 'EXISTING_INVOICE' && (
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[10px]">
                            Existing Invoice
                          </span>
                        )}
                        {item.feeSource === 'UNCONFIGURED' && (
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono text-[10px]">
                            Unconfigured
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-[#0F172A]">
                        {item.resolvedFee ? `LKR ${item.resolvedFee}` : '—'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {item.status === 'READY' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Ready
                          </span>
                        )}
                        {item.status === 'ALREADY_INVOICED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            Already Invoiced
                          </span>
                        )}
                        {item.status.startsWith('SKIPPED') && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Skipped
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-[#7C8A9A] text-[11px]">
                        {item.skipReason || (item.existingInvoiceNo ? `Invoice #${item.existingInvoiceNo}` : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Generation Success Result */}
      {generationResult && (
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-xs p-6 space-y-5">
          <div className="flex items-center gap-3 text-emerald-600">
            <div className="p-2.5 bg-emerald-50 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0F172A]">
                Invoice Generation Complete!
              </h2>
              <p className="text-xs text-[#7C8A9A]">
                Billing Period: {generationResult.monthName} {generationResult.billingYear}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
              <span className="text-xs font-semibold text-emerald-800">Generated Invoices</span>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {generationResult.generatedCount}
              </p>
              <p className="text-xs text-emerald-600 font-medium mt-1">
                Total Value: LKR {generationResult.totalGeneratedAmount}
              </p>
            </div>

            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100">
              <span className="text-xs font-semibold text-blue-800">Already Existed</span>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                {generationResult.alreadyExistingCount}
              </p>
              <p className="text-xs text-blue-600 mt-1">Untouched to prevent duplicate billing</p>
            </div>

            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100">
              <span className="text-xs font-semibold text-amber-800">Skipped (No Fee / Ineligible)</span>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {generationResult.skippedNoFeeCount + generationResult.otherSkippedCount}
              </p>
              <p className="text-xs text-amber-600 mt-1">Requires fee setting or enrollment</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setGenerationResult(null);
                setPreviewData(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-[#7C8A9A] hover:text-[#0F172A]"
            >
              Generate Another Batch
            </button>
            <button
              onClick={() => navigate('/madrasa-admin/invoices')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#37C6A3] hover:bg-[#2BB393] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              View Invoices Directory
            </button>
          </div>
        </div>
      )}

      {generationError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{generationError}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && previewData && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E7E9EE] space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="p-2.5 bg-emerald-50 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">Confirm Invoice Generation</h3>
                <p className="text-xs text-[#7C8A9A]">
                  {previewData.monthName} {previewData.billingYear}
                </p>
              </div>
            </div>

            <div className="text-xs text-[#7C8A9A] space-y-2">
              <p>
                You are about to generate{' '}
                <strong className="text-[#0F172A]">{previewData.readyCount} invoices</strong> for a
                total billing amount of{' '}
                <strong className="text-emerald-700">LKR {previewData.totalExpectedAmount}</strong>.
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 space-y-1 text-[11px]">
                <div>• Initial status: <strong>PENDING</strong></div>
                <div>• Due Date: <strong>{dueDate}</strong></div>
                <div>• Zero payment entry or WhatsApp alerts will be dispatched in this phase.</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModalOpen(false)}
                disabled={isGenerating}
                className="px-4 py-2 text-xs font-semibold text-[#7C8A9A] hover:text-[#0F172A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteGeneration}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {isGenerating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm & Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
