import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  apiGetInvoice,
  apiVoidInvoice,
  type InvoiceDetail,
} from '../../services/api';
import {
  ArrowLeft,
  User,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Ban,
  FileText,
  CreditCard,
} from 'lucide-react';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Void modal state
  const [voidModalOpen, setVoidModalOpen] = useState<boolean>(false);
  const [voidReason, setVoidReason] = useState<string>('');
  const [isVoiding, setIsVoiding] = useState<boolean>(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiGetInvoice(id);
      setInvoice(data);
    } catch (err: any) {
      console.error('Failed to load invoice:', err);
      setError(err.response?.data?.message || 'Invoice not found or access denied.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handleExecuteVoid = async () => {
    if (!id || !voidReason.trim()) {
      setVoidError('Please provide a reason for voiding.');
      return;
    }

    try {
      setIsVoiding(true);
      setVoidError(null);
      const updated = await apiVoidInvoice(id, voidReason.trim());
      setInvoice(updated);
      setVoidModalOpen(false);
    } catch (err: any) {
      console.error('Failed to void invoice:', err);
      setVoidError(err.response?.data?.message || 'Failed to void invoice.');
    } finally {
      setIsVoiding(false);
    }
  };

  const renderStatusBadge = (displayStatus: string) => {
    switch (displayStatus) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4" />
            Paid
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle className="w-4 h-4" />
            Overdue
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-4 h-4" />
            Partially Paid
          </span>
        );
      case 'VOID':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <Ban className="w-4 h-4" />
            Void
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-4 h-4" />
            Pending Payment
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3]" />
        <p className="text-sm font-medium text-[#7C8A9A]">Loading invoice dossier...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error || 'Invoice not found.'}</span>
        </div>
        <Link
          to="/madrasa-admin/invoices"
          className="inline-flex items-center gap-2 text-sm text-[#2BB393] font-semibold hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 print:p-0 print:max-w-none">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/madrasa-admin/invoices"
            className="p-2 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-white rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] transition-colors print:hidden"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-[#0F172A]">{invoice.invoiceNo}</h1>
              {renderStatusBadge(invoice.displayStatus)}
            </div>
            <p className="text-xs text-[#7C8A9A] mt-0.5">
              Billing Period: {invoice.monthName} {invoice.billingYear} • Created on{' '}
              {new Date(invoice.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          {invoice.status !== 'VOID' && Number(invoice.paidAmount) === 0 && (
            <button
              onClick={() => {
                setVoidReason('');
                setVoidError(null);
                setVoidModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-xl border border-red-200 transition-colors cursor-pointer"
            >
              <Ban className="w-4 h-4" />
              Void Invoice
            </button>
          )}
        </div>
      </div>

      {/* Void Notice Banner */}
      {invoice.status === 'VOID' && (
        <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl flex items-start gap-3">
          <Ban className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-slate-800">This invoice was voided</h4>
            {invoice.voidMetadata && (
              <p className="text-slate-600">
                Voided on {new Date(invoice.voidMetadata.voidedAt).toLocaleString()} by{' '}
                <strong className="text-slate-800">{invoice.voidMetadata.voidedBy}</strong>.
                {invoice.voidMetadata.reason && (
                  <span className="block italic mt-0.5">Reason: "{invoice.voidMetadata.reason}"</span>
                )}
              </p>
            )}
            <p className="text-slate-500">
              Voided invoices are excluded from expected collections and outstanding balances.
            </p>
          </div>
        </div>
      )}

      {/* Grid: Student Dossier & Period/Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Student Details */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E7E9EE]">
            <div className="flex items-center gap-2 text-sm font-bold text-[#0F172A]">
              <User className="w-4 h-4 text-[#37C6A3]" />
              <span>Student Details</span>
            </div>
            <Link
              to={`/madrasa-admin/students/${invoice.student.id}`}
              className="text-xs text-[#2BB393] hover:underline font-medium"
            >
              View Student Profile →
            </Link>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[#7C8A9A]">Full Name:</span>
              <span className="font-semibold text-[#0F172A]">{invoice.student.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#7C8A9A]">Admission #:</span>
              <span className="font-mono font-medium text-[#0F172A]">{invoice.student.admissionNo}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#7C8A9A]">Current Class:</span>
              {invoice.student.currentClass ? (
                <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium border border-slate-200">
                  {invoice.student.currentClass.name}
                </span>
              ) : (
                <span className="italic text-[#7C8A9A]">Unassigned</span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-[#7C8A9A]">Guardian:</span>
              <span className="font-medium text-[#0F172A]">{invoice.student.guardianName}</span>
            </div>
            {invoice.student.guardianPhone && (
              <div className="flex justify-between">
                <span className="text-[#7C8A9A]">Guardian Phone:</span>
                <span className="font-mono text-[#0F172A]">{invoice.student.guardianPhone}</span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-[#7C8A9A] italic border-t border-[#E7E9EE]/60 pt-2">
            * Student's class reflects their current enrollment. The fee snapshot below is frozen.
          </p>
        </div>

        {/* Billing Schedule & Dates */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E7E9EE] text-sm font-bold text-[#0F172A]">
            <Calendar className="w-4 h-4 text-[#37C6A3]" />
            <span>Billing Period & Due Date</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[#7C8A9A]">Billing Month:</span>
              <span className="font-semibold text-[#0F172A]">
                {invoice.monthName} {invoice.billingYear}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#7C8A9A]">Issue Date:</span>
              <span className="font-medium text-[#0F172A]">
                {new Date(invoice.issueDate).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#7C8A9A]">Due Date:</span>
              <div className="text-right">
                <span className="font-medium text-[#0F172A]">
                  {new Date(invoice.dueDate).toLocaleDateString()}
                </span>
                {invoice.isOverdue && (
                  <span className="block text-[10px] text-red-600 font-bold">Past Due Date</span>
                )}
              </div>
            </div>
            {invoice.notes && (
              <div className="pt-2 border-t border-[#E7E9EE]/60">
                <span className="text-[#7C8A9A] block mb-0.5">Notes:</span>
                <span className="text-[#0F172A] italic">{invoice.notes}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Frozen Invoice Line Items */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E7E9EE] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#37C6A3]" />
            Fee Line Items (Snapshotted)
          </h3>
          <span className="text-[11px] text-[#7C8A9A]">
            Immutable item records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[460px]">
            <thead>
              <tr className="bg-[#F7F6F1]/50 border-b border-[#E7E9EE] text-[#7C8A9A] font-semibold">
                <th className="py-3 px-4">Item Description</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E9EE]">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 px-4 font-medium text-[#0F172A]">{item.description}</td>
                  <td className="py-3 px-4 text-center text-[#7C8A9A]">{item.quantity}</td>
                  <td className="py-3 px-4 text-right font-mono text-[#0F172A] whitespace-nowrap">
                    LKR {item.unitAmount}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-[#0F172A] whitespace-nowrap">
                    LKR {item.totalAmount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Calculation Summary */}
        <div className="p-4 bg-[#F7F6F1]/40 border-t border-[#E7E9EE] flex justify-end">
          <div className="w-full sm:w-64 space-y-2 text-xs">
            <div className="flex justify-between text-[#7C8A9A]">
              <span>Subtotal:</span>
              <span className="font-mono text-[#0F172A]">LKR {invoice.subtotal}</span>
            </div>
            {Number(invoice.discountAmount) > 0 && (
              <div className="flex justify-between text-[#7C8A9A]">
                <span>Discount:</span>
                <span className="font-mono text-emerald-600">- LKR {invoice.discountAmount}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm text-[#0F172A] pt-1 border-t border-[#E7E9EE]">
              <span>Total Amount:</span>
              <span className="font-mono">LKR {invoice.totalAmount}</span>
            </div>
            <div className="flex justify-between text-xs text-emerald-700">
              <span>Paid Amount:</span>
              <span className="font-mono font-medium">LKR {invoice.paidAmount}</span>
            </div>
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-[#E7E9EE]">
              <span className={Number(invoice.balanceAmount) > 0 ? 'text-red-700' : 'text-emerald-700'}>
                Balance Due:
              </span>
              <span
                className={`font-mono ${
                  Number(invoice.balanceAmount) > 0 ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                LKR {invoice.balanceAmount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment History & Allocations (Read-Only) */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs p-5 space-y-4 print:shadow-none">
        <div className="flex items-center justify-between pb-3 border-b border-[#E7E9EE]">
          <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#37C6A3]" />
            Payment Allocations (Read-Only)
          </h3>
          <span className="text-[11px] text-[#7C8A9A]">Phase 10 Foundation</span>
        </div>

        {invoice.allocations && invoice.allocations.length > 0 ? (
          <div className="divide-y divide-[#E7E9EE] text-xs">
            {invoice.allocations.map((alloc) => (
              <div key={alloc.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-[#0F172A]">{alloc.paymentNo}</span>
                  <span className="text-[#7C8A9A] ml-2">via {alloc.paymentMethod}</span>
                  <div className="text-[10px] text-[#7C8A9A]">
                    {new Date(alloc.paidAt).toLocaleString()}
                  </div>
                </div>
                <div className="font-mono font-bold text-emerald-700">
                  + LKR {alloc.amount}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[#7C8A9A] space-y-1">
            <p>No payment entries have been allocated to this invoice.</p>
            <p className="text-[11px] text-slate-400">
              Payment recording, receipts, and allocation creation are part of Phase 10 (Fee POS).
            </p>
          </div>
        )}
      </div>

      {/* Void Modal */}
      {voidModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E7E9EE] space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <Ban className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">Void Invoice</h3>
                <p className="text-xs text-[#7C8A9A] font-mono">{invoice.invoiceNo}</p>
              </div>
            </div>

            <div className="text-xs text-[#7C8A9A] space-y-2">
              <p>
                Are you sure you want to void this invoice? This will mark the balance as non-collectible.
              </p>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px]">
                Original notes will be preserved. The void reason and your user identity will be recorded in Activity Logs.
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0F172A]">
                Reason for Voiding <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="State the reason for voiding this invoice..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:bg-white focus:outline-hidden focus:border-[#37C6A3] focus:ring-1 focus:ring-[#37C6A3]"
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
                onClick={() => setVoidModalOpen(false)}
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
