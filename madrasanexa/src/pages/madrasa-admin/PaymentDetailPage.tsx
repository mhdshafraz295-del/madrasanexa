import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  FileText,
  User,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import {
  apiGetPayment,
  apiVoidPayment,
  type PaymentDetail,
} from '../../services/api';

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Void modal state
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const fetchPayment = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await apiGetPayment(id);
      setPayment(data);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Payment not found or access denied.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPayment();
  }, [fetchPayment]);

  const handleConfirmVoid = async () => {
    if (!payment) return;
    if (!voidReason.trim() || voidReason.trim().length < 3) {
      setVoidError('Please enter a reason of at least 3 characters.');
      return;
    }

    setIsVoiding(true);
    setVoidError(null);

    try {
      await apiVoidPayment(payment.id, voidReason.trim());
      setVoidModalOpen(false);
      await fetchPayment();
    } catch (err: any) {
      setVoidError(err.response?.data?.message || 'Failed to void payment.');
    } finally {
      setIsVoiding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto py-24 text-center text-[#5B6B7F]">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm">Loading payment dossier...</p>
      </div>
    );
  }

  if (errorMessage || !payment) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        <Link
          to="/madrasa-admin/payments"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5B6B7F] hover:text-[#0F172A]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Payments</span>
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-800 space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto text-red-600" />
          <h2 className="text-lg font-bold">Unable to View Payment</h2>
          <p className="text-sm text-red-700">{errorMessage || 'Payment record not found.'}</p>
        </div>
      </div>
    );
  }

  const isVoid = payment.status === 'VOID';

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Back button & top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/madrasa-admin/payments"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5B6B7F] hover:text-[#0F172A] mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Payments</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono text-[#0F172A]">{payment.paymentNo}</h1>
            {isVoid ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                <Ban className="w-3.5 h-3.5" /> VOID
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                COMPLETED
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {payment.receipt && (
            <Link
              to={`/madrasa-admin/receipts/${payment.receipt.id}`}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-[#E7E9EE] hover:bg-gray-50 text-[#0F172A] font-semibold text-xs rounded-xl transition shadow-xs"
            >
              <FileText className="w-4 h-4 text-emerald-700" />
              <span>Receipt {payment.receipt.receiptNo}</span>
            </Link>
          )}

          {!isVoid && (
            <button
              onClick={() => {
                setVoidReason('');
                setVoidError(null);
                setVoidModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-xs rounded-xl transition"
            >
              <Ban className="w-4 h-4 text-red-600" />
              <span>Void Payment</span>
            </button>
          )}
        </div>
      </div>

      {/* Void Notice Banner */}
      {isVoid && payment.voidMetadata && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
          <Ban className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm text-red-900">
            <div className="font-bold text-red-950">Payment Voided</div>
            <p className="text-xs text-red-800">
              Voided on {new Date(payment.voidMetadata.voidedAt!).toLocaleString()}
            </p>
            <p className="text-xs bg-white/60 p-2.5 rounded-lg border border-red-200/60 mt-1 font-medium">
              Reason: "{payment.voidMetadata.voidReason}"
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Student & Payment Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Student Card */}
        <div className="bg-white border border-[#E7E9EE] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E7E9EE] pb-3 text-xs font-bold text-[#7C8A9A] uppercase tracking-wider">
            <User className="w-4 h-4 text-emerald-800" />
            <span>Student Information</span>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-[#5B6B7F] block">Full Name:</span>
              <Link
                to={`/madrasa-admin/students/${payment.student.id}`}
                className="font-bold text-[#0F172A] hover:text-[#08483A] hover:underline"
              >
                {payment.student.fullName}
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-[#5B6B7F] block">Admission No:</span>
                <span className="font-mono font-bold text-[#0F172A]">{payment.student.admissionNo}</span>
              </div>
              <div>
                <span className="text-xs text-[#5B6B7F] block">Class:</span>
                <span className="font-semibold text-[#0F172A]">
                  {payment.student.currentClass?.name || 'Unassigned'}
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs text-[#5B6B7F] block">Guardian Details:</span>
              <span className="font-medium text-[#0F172A]">{payment.student.guardianName}</span>
              {payment.student.guardianPhone && (
                <span className="text-xs text-[#5B6B7F] block">Phone: {payment.student.guardianPhone}</span>
              )}
            </div>
          </div>
        </div>

        {/* Payment Transaction Details Card */}
        <div className="bg-white border border-[#E7E9EE] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E7E9EE] pb-3 text-xs font-bold text-[#7C8A9A] uppercase tracking-wider">
            <CreditCard className="w-4 h-4 text-emerald-800" />
            <span>Transaction Details</span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-[#5B6B7F]">Total Amount:</span>
              <span className={`text-xl font-black ${isVoid ? 'line-through text-gray-400' : 'text-[#08483A]'}`}>
                LKR {Number(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[#5B6B7F] block">Payment Method:</span>
                <span className="font-semibold text-[#0F172A]">{payment.paymentMethod.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-[#5B6B7F] block">Paid At:</span>
                <span className="font-semibold text-[#0F172A]">
                  {new Date(payment.paidAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {payment.reference && (
              <div className="text-xs">
                <span className="text-[#5B6B7F] block">Reference / Slip:</span>
                <span className="font-mono font-medium text-[#0F172A]">{payment.reference}</span>
              </div>
            )}

            {payment.notes && (
              <div className="text-xs">
                <span className="text-[#5B6B7F] block">Notes:</span>
                <span className="text-gray-700 italic">{payment.notes}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Allocations Table */}
      <div className="bg-white border border-[#E7E9EE] rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#E7E9EE] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#0F172A]">Invoice Allocations</h3>
            <p className="text-xs text-[#5B6B7F]">Invoices credited by this payment transaction.</p>
          </div>
          <span className="text-xs font-bold text-gray-500">{payment.allocations.length} allocation(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E7E9EE] bg-[#F8F9FA] text-xs font-bold text-[#7C8A9A] uppercase tracking-wider">
                <th className="py-3 px-4">Billing Month</th>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4 text-right">Invoice Total (LKR)</th>
                <th className="py-3 px-4 text-right">Allocated Amount (LKR)</th>
                <th className="py-3 px-4 text-right">Current Invoice Balance</th>
                <th className="py-3 px-4 text-center">Invoice Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E9EE]">
              {payment.allocations.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50/50">
                  <td className="py-3.5 px-4 font-bold text-[#0F172A]">
                    {a.monthName} {a.billingYear}
                  </td>
                  <td className="py-3.5 px-4">
                    <Link
                      to={`/madrasa-admin/invoices/${a.invoiceId}`}
                      className="font-mono text-xs font-bold text-emerald-800 hover:underline"
                    >
                      {a.invoiceNo}
                    </Link>
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium text-gray-600">
                    {Number(a.invoiceTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-emerald-700">
                    {Number(a.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium text-[#0F172A]">
                    {Number(a.invoiceBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-800">
                      {a.invoiceStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Void Modal */}
      {voidModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#E7E9EE]">
            <div className="flex items-center gap-2 text-red-600 font-bold">
              <Ban className="w-5 h-5" />
              <h3 className="text-lg">Void Payment {payment.paymentNo}</h3>
            </div>

            <p className="text-xs text-[#5B6B7F]">
              This action will reverse the allocated amounts from all {payment.allocations.length} affected invoice(s) and mark this payment as VOID.
            </p>

            {voidError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                {voidError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#0F172A]">Reason for Voiding *</label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Provide a mandatory reason..."
                rows={3}
                className="w-full px-3 py-2 text-sm bg-[#F8F9FA] border border-[#E7E9EE] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setVoidModalOpen(false)}
                disabled={isVoiding}
                className="flex-1 py-2 px-4 border border-[#E7E9EE] font-semibold text-gray-700 rounded-xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVoid}
                disabled={isVoiding}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 font-semibold text-white rounded-xl transition flex items-center justify-center gap-2"
              >
                {isVoiding ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Confirm Void</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
