import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  AlertCircle,
  Printer,
} from 'lucide-react';
import { apiGetReceipt, type ReceiptDetail } from '../../services/api';

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchReceipt = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await apiGetReceipt(id);
      setReceipt(data);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Receipt not found or access denied.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto py-24 text-center text-[#5B6B7F]">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm">Loading receipt details...</p>
      </div>
    );
  }

  if (errorMessage || !receipt) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <Link
          to="/madrasa-admin/payments"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5B6B7F] hover:text-[#0F172A]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Payments</span>
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-800 space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto text-red-600" />
          <h2 className="text-lg font-bold">Unable to View Receipt</h2>
          <p className="text-sm text-red-700">{errorMessage || 'Receipt record not found.'}</p>
        </div>
      </div>
    );
  }

  const { payment, student, allocations = [], isVoid } = receipt;
  const madrasa = receipt.madrasa || (receipt as any).institution || {};
  const logoUrl = madrasa.logoUrl || (receipt as any).institution?.logoUrl || null;
  const branding = madrasa.branding || {
    receiptHeader: (receipt as any).institution?.receiptHeader || null,
    receiptFooter: (receipt as any).institution?.receiptFooter || null,
    currency: (receipt as any).institution?.currency || 'LKR',
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Top Bar (Hidden in Print) */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          to={`/madrasa-admin/payments/${payment.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5B6B7F] hover:text-[#0F172A]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Payment</span>
        </Link>

        <div className="flex items-center gap-2">
          {isVoid ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
              <Ban className="w-3.5 h-3.5" /> VOID RECEIPT
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> OFFICIAL RECEIPT
            </span>
          )}

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-[#0F172A] text-white rounded-xl hover:bg-[#1E293B] transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Printable Receipt Card */}
      <div className="relative bg-white border border-[#E7E9EE] rounded-2xl p-6 sm:p-10 shadow-sm print:border-none print:shadow-none print:p-0 print:m-0 overflow-hidden">
        {/* Watermark for VOID receipts */}
        {isVoid && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none z-10 opacity-15">
            <div className="text-red-700 font-black text-8xl md:text-9xl rotate-[-30deg] tracking-widest border-8 border-red-700 p-6 rounded-3xl">
              VOID
            </div>
          </div>
        )}

        {/* Void Top Banner */}
        {isVoid && (
          <div className="bg-red-600 text-white font-bold text-center text-xs py-2 px-4 rounded-xl mb-6 tracking-wide">
            WARNING: THIS RECEIPT HAS BEEN VOIDED. IT IS NOT VALID FOR ACCOUNTING PURPOSES.
          </div>
        )}

        {/* Receipt Header */}
        <div className="border-b border-[#E7E9EE] pb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-3.5">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={madrasa.name || 'Logo'}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                  className="h-12 w-auto max-w-[80px] object-contain rounded-lg border border-[#E7E9EE] p-0.5 shrink-0 bg-white"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-[#0F172A]">{madrasa.name || 'Madrasa'}</h1>
                {madrasa.code && (
                  <p className="text-xs font-mono text-[#5B6B7F] mt-0.5">Madrasa Code: {madrasa.code}</p>
                )}
                {branding.receiptHeader && (
                  <p className="text-xs text-[#5B6B7F] mt-1 italic whitespace-pre-line">
                    {branding.receiptHeader}
                  </p>
                )}
              </div>
            </div>

            <div className="sm:text-right">
              <div className="text-xs font-bold uppercase tracking-wider text-[#7C8A9A]">Fee Payment Receipt</div>
              <div className="text-xl font-mono font-bold text-[#08483A] mt-0.5">{receipt.receiptNo}</div>
              <div className="text-xs text-[#5B6B7F] mt-1">
                Issued: {new Date(receipt.issuedAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Student & Payment Summary Info */}
        <div className="py-6 border-b border-[#E7E9EE] grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          {/* Student Dossier */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-[#7C8A9A] uppercase tracking-wider block">Student Details</span>
            <div className="font-bold text-[#0F172A] text-base">{student.fullName}</div>
            <div className="text-xs text-[#5B6B7F]">
              Admission No: <span className="font-mono font-semibold text-[#0F172A]">{student.admissionNo}</span>
            </div>
            <div className="text-xs text-[#5B6B7F]">
              Class: <span className="font-semibold text-[#0F172A]">{student.currentClass?.name || 'Unassigned'}</span>
            </div>
            <div className="text-xs text-[#5B6B7F]">
              Guardian: <span className="font-medium text-[#0F172A]">{student.guardianName}</span>
            </div>
          </div>

          {/* Payment Dossier */}
          <div className="space-y-1.5 sm:text-right">
            <span className="text-xs font-bold text-[#7C8A9A] uppercase tracking-wider block">Payment Details</span>
            <div className="text-xs text-[#5B6B7F]">
              Payment No: <span className="font-mono font-semibold text-[#0F172A]">{payment.paymentNo}</span>
            </div>
            <div className="text-xs text-[#5B6B7F]">
              Payment Method: <span className="font-semibold text-[#0F172A]">{payment.paymentMethod.replace('_', ' ')}</span>
            </div>
            {payment.reference && (
              <div className="text-xs text-[#5B6B7F]">
                Ref / Slip: <span className="font-mono font-semibold text-[#0F172A]">{payment.reference}</span>
              </div>
            )}
            <div className="text-xs text-[#5B6B7F]">
              Paid On: <span className="font-semibold text-[#0F172A]">{new Date(payment.paidAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Allocations Table */}
        <div className="py-6 space-y-3">
          <div className="text-xs font-bold text-[#7C8A9A] uppercase tracking-wider">Fee Allocations</div>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E7E9EE] text-xs font-bold text-[#7C8A9A]">
                <th className="py-2">Description / Month</th>
                <th className="py-2">Invoice #</th>
                <th className="py-2 text-right">Amount Paid ({branding.currency || 'LKR'})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E9EE]">
              {allocations.map((a) => (
                <tr key={a.id}>
                  <td className="py-3 font-semibold text-[#0F172A]">
                    Tuition Fee — {a.monthName} {a.billingYear}
                  </td>
                  <td className="py-3 font-mono text-xs text-[#5B6B7F]">{a.invoiceNo}</td>
                  <td className="py-3 text-right font-bold text-[#0F172A]">
                    {Number(a.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#0F172A] text-base font-bold">
                <td colSpan={2} className="py-3 text-right text-[#0F172A]">
                  Total Amount Received:
                </td>
                <td className="py-3 text-right text-emerald-800 font-black">
                  {branding.currency || 'LKR'} {Number(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Receipt Footer */}
        <div className="pt-6 border-t border-[#E7E9EE] text-center space-y-2">
          {branding.receiptFooter ? (
            <p className="text-xs text-[#5B6B7F] italic whitespace-pre-line">{branding.receiptFooter}</p>
          ) : (
            <p className="text-xs text-[#7C8A9A]">Thank you for your payment. May Allah bless your contribution.</p>
          )}
          <p className="text-[10px] text-gray-400 font-mono">Generated via MadrasaNexa Platform</p>
        </div>
      </div>
    </div>
  );
}
