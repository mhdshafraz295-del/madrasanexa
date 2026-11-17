import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Download,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronRight,
  Eye,
  Info,
  X,
  User,
  CreditCard,
} from 'lucide-react';
import { payslipsApi, profileApi, TeacherProfile } from '../../services/api';
import type {
  DetailedPayslip,
} from '../../mock/teacherMockData';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';

export default function PayslipsPage() {
  const [payslips, setPayslips] = useState<DetailedPayslip[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<DetailedPayslip | null>(null);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [listRes, profileRes] = await Promise.allSettled([
        payslipsApi.listPayslips(),
        profileApi.getProfile(),
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value) {
        setProfile(profileRes.value);
      } else {
        setProfile(null);
      }

      if (listRes.status === 'fulfilled' && Array.isArray(listRes.value) && listRes.value.length > 0) {
        const firstId = listRes.value[0].id;
        try {
          const detail = await payslipsApi.getPayslipDetail(firstId);
          setSelectedPayslip(detail);
        } catch {
          setSelectedPayslip(null);
        }
        const detailedList: DetailedPayslip[] = listRes.value.map((item) => {
          return {
            id: item.id,
            payslipNumber: item.payslipNumber,
            monthYear: item.monthYear,
            monthCode: item.monthCode,
            issueDate: item.issueDate,
            disbursementDate: item.issueDate,
            status: item.status as any,
            basicSalary: 85000,
            allowances: [],
            adjustments: [],
            deductions: [],
            grossEarnings: item.netSalary,
            totalDeductions: 0,
            netPayable: item.netSalary,
            netPayableWords: 'Sri Lankan Rupees',
            workingDays: 22,
            lecturesConducted: 40,
            attendanceRate: 98,
            bankName: 'Bank of Ceylon',
            bankBranch: 'Colombo Main Branch',
            accountNumber: 'BOC-****-4910',
            paymentMethod: 'Bank Transfer',
            paymentReference: item.payslipNumber,
            authorizedSignatory: 'Administrative Officer',
            authorizedTitle: 'Finance Division',
          };
        });
        setPayslips(detailedList);
        if (!selectedPayslip && detailedList.length > 0) {
          setSelectedPayslip(detailedList[0]);
        }
      } else if (listRes.status === 'fulfilled') {
        setPayslips([]);
        setSelectedPayslip(null);
      } else {
        const rejectionReason = (listRes as PromiseRejectedResult).reason;
        throw rejectionReason || new Error('Failed to load payslips from server');
      }
    } catch (err: any) {
      setPayslips([]);
      setSelectedPayslip(null);
      setError(err?.message || 'Failed to load live payslips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectPayslip = async (ps: DetailedPayslip) => {
    setSelectedPayslip(ps);
    try {
      const detail = await payslipsApi.getPayslipDetail(ps.id);
      if (detail) {
        setSelectedPayslip(detail);
      }
    } catch (err) {
      console.warn('Could not fetch detail from server, using existing item:', err);
    }
  };

  const formatLKR = (amount: number) => {
    return `Rs. ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handlePrint = (payslip: DetailedPayslip) => {
    setSelectedPayslip(payslip);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="space-y-6 print:space-y-0 print:m-0">
      {/* 1. Header Banner (Hidden during Print) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0D9488] uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4" />
            <span>Institutional Salary Slips</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Official Faculty Payslips
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View, verify, and print your formal A4 monthly compensation statements
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={() => selectedPayslip && handlePrint(selectedPayslip)}
            disabled={!selectedPayslip}
            className="px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-[#37C6A3]" />
            <span>Print Current Payslip (A4)</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 bg-white rounded-2xl border border-slate-200">
          <LoadingState message="Loading official faculty payslips..." />
        </div>
      ) : error && payslips.length === 0 ? (
        <div className="py-12 bg-white rounded-2xl border border-slate-200">
          <ErrorState message={error} onRetry={loadData} />
        </div>
      ) : payslips.length === 0 ? (
        <div className="py-12 bg-white rounded-2xl border border-slate-200">
          <EmptyState
            title="No Payslips Issued"
            description="No formal payslip statements have been issued for your faculty profile yet."
          />
        </div>
      ) : (
        <>
          {/* 2. Available Monthly Payslips List (Screen Only) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs print:hidden">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Available Monthly Salary Statements
              </h2>
              <span className="text-xs font-semibold text-slate-500">
                {payslips.length} Statements Archived
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {payslips.map((ps) => {
                const isSelected = selectedPayslip?.id === ps.id;
                return (
                  <div
                    key={ps.id}
                    onClick={() => handleSelectPayslip(ps)}
                    className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#0D9488] bg-teal-50/30 ring-1 ring-[#0D9488]/40 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {ps.payslipNumber}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {ps.status}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900">
                        {ps.monthYear}
                      </h3>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Disbursed: {ps.disbursementDate}
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Net Remittance:</span>
                        <span className="font-mono font-bold text-slate-900">{formatLKR(ps.netPayable)}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPayslip(ps);
                          setPreviewModalOpen(true);
                        }}
                        className="text-xs font-bold text-[#0D9488] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Quick Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrint(ps);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                        title="Print Payslip"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

      {/* 3. Official A4 Payslip Document Container (Both Screen Preview & Single-Page Print) */}
      {selectedPayslip && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-xs max-w-4xl mx-auto print:max-w-none print:p-0 print:border-none print:shadow-none print-only-sheet">
          {/* Printable Payslip Card Header */}
          <div className="border-b-2 border-slate-900 pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-[#0F172A] text-[#37C6A3] font-black text-lg flex items-center justify-center shrink-0 border border-slate-800 shadow-xs">
                  MNX
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                    {(profile as any)?.madrasa?.name || 'MadrasaNexa Institutional Faculty'}
                  </h2>
                  <p className="text-xs text-slate-600">
                    {(profile as any)?.madrasa?.address || 'Main Campus'} • Code: <span className="font-mono">{(profile as any)?.madrasa?.code || 'MNX'}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Institutional Reg: <span className="font-mono">REG-{(profile as any)?.madrasa?.code || 'LK-2026'}</span>
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                  OFFICIAL PAYSLIP
                </span>
                <div className="text-xs font-mono font-bold text-slate-900 mt-1">
                  Ref: {selectedPayslip.payslipNumber}
                </div>
                <div className="text-[11px] text-slate-500">
                  Issued: {selectedPayslip.issueDate}
                </div>
              </div>
            </div>
          </div>

        {/* Teacher & Period Details Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3.5 border-b border-slate-200 text-xs">
          {/* Faculty Particulars */}
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Faculty Member Particulars
            </div>
            <div className="font-bold text-slate-900 text-sm">
              {profile?.fullName || 'Faculty Member'}
            </div>
            <div className="text-[11px] font-arabic text-emerald-800 font-semibold">
              {profile?.arabicName || 'أستاذ معتمد لدى المنظومة'}
            </div>
            <div className="text-slate-600">
              ID: <strong className="font-mono text-slate-800">{profile?.employeeCode || 'UST-001'}</strong> • EPF: <strong className="font-mono text-slate-800">EPF-{profile?.employeeCode || '7841'}</strong>
            </div>
            <div className="text-slate-600">
              NIC / Passport: <strong className="font-mono text-slate-800">{profile?.nicPassport || '—'}</strong>
            </div>
            <div className="text-slate-500 text-[11px]">
              {profile?.designation || 'Faculty Member'} • {profile?.department || 'Academic Faculty'}
            </div>
          </div>

          {/* Payroll Period & Performance */}
          <div className="space-y-1 sm:text-right">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Remuneration Cycle & Attendance
            </div>
            <div className="font-bold text-slate-900 text-sm">
              Salary Month: {selectedPayslip.monthYear}
            </div>
            <div className="text-slate-600">
              Working Days: <strong>{selectedPayslip.workingDays} Days</strong>
            </div>
            <div className="text-slate-600">
              Lectures Conducted: <strong>{selectedPayslip.lecturesConducted} Sessions</strong>
            </div>
            <div className="text-slate-600">
              Attendance Verification: <strong className="text-emerald-700">{selectedPayslip.attendanceRate}% (Sample Verified)</strong>
            </div>
            <div className="text-slate-500 text-[11px] font-mono">
              Status: <span className="font-bold text-emerald-700 uppercase">{selectedPayslip.status}</span> ({selectedPayslip.disbursementDate})
            </div>
          </div>
        </div>

        {/* Itemized Tables: Earnings vs Deductions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-3.5 border-b border-slate-200">
          {/* Earnings Table */}
          <div>
            <div className="bg-slate-50 p-2 border-b border-slate-200 text-xs font-bold text-slate-800 uppercase tracking-wider flex justify-between">
              <span>Earnings Component</span>
              <span>Amount (LKR)</span>
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2 px-2 font-semibold text-slate-900">Basic Monthly Base Salary</td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">{formatLKR(selectedPayslip.basicSalary)}</td>
                </tr>
                {selectedPayslip.allowances.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-2 text-slate-700">{item.name}</td>
                    <td className="py-2 px-2 text-right font-mono text-slate-800">{formatLKR(item.amount)}</td>
                  </tr>
                ))}
                {selectedPayslip.adjustments.map((adj, idx) => (
                  <tr key={idx} className="bg-teal-50/30">
                    <td className="py-2 px-2 text-teal-900 font-medium">{adj.name}</td>
                    <td className="py-2 px-2 text-right font-mono text-teal-900 font-bold">+{formatLKR(adj.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-bold bg-slate-50/70">
                  <td className="py-2 px-2 text-slate-900 uppercase text-[11px]">Total Gross Earnings</td>
                  <td className="py-2 px-2 text-right font-mono text-slate-900 font-black">{formatLKR(selectedPayslip.grossEarnings)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Deductions Table */}
          <div>
            <div className="bg-slate-50 p-2 border-b border-slate-200 text-xs font-bold text-slate-800 uppercase tracking-wider flex justify-between">
              <span>Deductions Component</span>
              <span>Amount (LKR)</span>
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-100">
                {selectedPayslip.deductions.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-1.5 px-2 text-slate-700">{item.name}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-rose-700 font-medium">- {formatLKR(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-bold bg-slate-50/70">
                  <td className="py-2 px-2 text-rose-900 uppercase text-[11px]">Total Deductions</td>
                  <td className="py-2 px-2 text-right font-mono text-rose-800 font-black">- {formatLKR(selectedPayslip.totalDeductions)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Statutory Employer Contributions (For Information Only — Not Deducted from Employee Remuneration) */}
        <div className="my-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center justify-between font-bold text-slate-700 text-[11px] uppercase tracking-wider mb-1">
            <span>Statutory Employer Contributions (Institutional Cost — Not Deducted from Net Salary)</span>
            <span className="text-[10px] font-semibold text-slate-500">Sample Informational Data</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-700 text-[11px]">
            <div>
              Employer EPF (12%): <strong className="font-mono text-slate-900">{formatLKR(selectedPayslip.basicSalary * 0.12)}</strong>
            </div>
            <div>
              Employer ETF (3%): <strong className="font-mono text-slate-900">{formatLKR(selectedPayslip.basicSalary * 0.03)}</strong>
            </div>
            <div className="col-span-2 sm:col-span-1 text-slate-500 text-[10px] italic">
              Total: <strong className="font-mono text-slate-900">{formatLKR(selectedPayslip.basicSalary * 0.15)}</strong> directly remitted to CBSL by institution.
            </div>
          </div>
        </div>

        {/* Net Pay Highlighted Box */}
        <div className="my-2.5 p-3 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-[#37C6A3] uppercase tracking-wider">
              Net Payable Remittance (Take-Home Pay)
            </span>
            <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
              {formatLKR(selectedPayslip.netPayable)}
            </div>
            <div className="text-[11px] text-slate-300 italic mt-0.5">
              "{selectedPayslip.netPayableWords}"
            </div>
          </div>

          <div className="text-left sm:text-right text-xs text-slate-300 space-y-0.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
            <div>Disbursement: <strong className="text-white">{selectedPayslip.paymentMethod || 'Direct Clearance'}</strong></div>
            {selectedPayslip.bankName && <div>Bank: <strong className="text-white">{selectedPayslip.bankName}</strong></div>}
            <div className="font-mono text-[11px]">Ref: {selectedPayslip.paymentReference || 'SAL-REF-SYS'}</div>
          </div>
        </div>

        {/* Authorized Signatures & Verification Placeholders */}
        <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-4 text-center text-xs">
          <div className="p-2.5 border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
            <div className="text-[9.5px] uppercase font-bold text-slate-500 tracking-wider mb-1">
              [Authorized Signature Block]
            </div>
            <div className="h-5 flex items-center justify-center text-slate-400 italic text-[11px]">
              {selectedPayslip.authorizedSignatory ? 'Official Signatory' : '(Pending Verification)'}
            </div>
            <div className="font-bold text-slate-900 mt-1">{selectedPayslip.authorizedSignatory || 'Bursar & Accounts'}</div>
            <div className="text-slate-500 text-[10.5px]">{selectedPayslip.authorizedTitle || 'Institutional Signatory'}</div>
            <div className="text-[10px] text-slate-400">Finance Directorate</div>
          </div>

          <div className="p-2.5 border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
            <div className="text-[9.5px] uppercase font-bold text-slate-500 tracking-wider mb-1">
              [Sample Faculty Acknowledgment Placeholder - Not an Official Signature]
            </div>
            <div className="h-5 flex items-center justify-center text-slate-400 italic text-[11px]">
              (Illustrative Placeholder Only)
            </div>
            <div className="font-bold text-slate-900 mt-1">{profile?.fullName || 'Faculty Member'}</div>
            <div className="text-slate-500 text-[10.5px]">Faculty Member</div>
            <div className="text-[10px] text-slate-400">Ustadh ID: {profile?.employeeCode || 'UST-001'}</div>
          </div>

          <div className="col-span-2 pt-1.5 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] text-slate-400">
            <span className="px-2 py-0.5 rounded border border-dashed border-slate-300 bg-slate-50">
              [Sample Institutional Stamp Placeholder - No Official Seal Claimed]
            </span>
          </div>
        </div>

        {/* Prototype Disclaimer Footnote */}
        <div className="mt-2.5 p-2 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[9.5px] text-amber-900 text-center leading-relaxed">
          <strong>PROTOTYPE SAMPLE DATA NOTICE:</strong> All figures, employee identity numbers, NICs, EPF accounts, transaction references, institutional registration codes, and signature blocks in this document are demonstrative sample fixtures for UI testing only. This document does not constitute a genuine legal statement, official seal, or financial certification.
        </div>
      </div>
      )}
    </>
  )}

      {/* 4. Quick Preview Modal */}
      {previewModalOpen && selectedPayslip && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Payslip: {selectedPayslip.monthYear}
              </h3>
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Payslip Number:</span>
                <span className="font-mono font-bold text-slate-900">{selectedPayslip.payslipNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Gross Contract Earnings:</span>
                <span className="font-mono font-semibold text-slate-900">{formatLKR(selectedPayslip.grossEarnings)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Total Deductions:</span>
                <span className="font-mono text-rose-700 font-semibold">- {formatLKR(selectedPayslip.totalDeductions)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 text-sm font-bold">
                <span className="text-[#0D9488]">Net Payable Amount:</span>
                <span className="font-mono text-slate-900">{formatLKR(selectedPayslip.netPayable)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600">
                Directly remitted to {selectedPayslip.bankName} on {selectedPayslip.disbursementDate}.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewModalOpen(false);
                  handlePrint(selectedPayslip);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-[#37C6A3]" />
                <span>Print Statement</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
