import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Banknote,
  Coins,
  CreditCard,
  FileText,
  TrendingUp,
  CheckCircle2,
  Clock,
  Building2,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Info,
  ChevronRight,
  Receipt,
  Download,
  AlertCircle,
} from 'lucide-react';
import { salaryApi, SalarySummaryData } from '../../services/api';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';

export default function MySalaryPage() {
  const [selectedMonthCode, setSelectedMonthCode] = useState('2026-10');
  const [salaryData, setSalaryData] = useState<SalarySummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSalary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await salaryApi.getSalarySummary();
      if (data) setSalaryData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load salary summary.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSalary();
  }, []);

  if (isLoading) {
    return <LoadingState message="Loading salary summary & statutory EPF/ETF breakdown..." className="my-8" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadSalary} className="my-8" />;
  }

  if (!salaryData) {
    return (
      <EmptyState
        title="No Salary Summary Available"
        description="Your payroll and remuneration details have not been processed by the administration yet."
      />
    );
  }

  // Find corresponding payslip/trend for the selected month
  const selectedTrend =
    salaryData.monthlyTrends?.find((t) => selectedMonthCode && t.month.toLowerCase().includes(selectedMonthCode.toLowerCase())) ||
    salaryData.monthlyTrends?.[0] || {
      month: 'Current',
      basic: salaryData.basicSalary,
      allowances: (salaryData.grossSalary || 0) - (salaryData.basicSalary || 0),
      deductions: salaryData.totalDeductions,
      net: salaryData.netSalary,
      status: salaryData.currentStatus || 'Pending',
    };

  const formatLKR = (amount: number) => {
    return `Rs. ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0D9488] uppercase tracking-wider mb-1">
            <Coins className="w-4 h-4" />
            <span>Faculty Compensation & Remuneration</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            My Salary & Compensation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent institutional salary structure, statutory deductions, and monthly disbursement status
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <NavLink
            to="/salary/payslips"
            className="px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
          >
            <FileText className="w-3.5 h-3.5 text-[#37C6A3]" />
            <span>View Payslips</span>
          </NavLink>
          <NavLink
            to="/salary/history"
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition"
          >
            Payment History
          </NavLink>
        </div>
      </div>

      {/* Prototype Disclaimer Banner */}
      <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-950">
        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Prototype Sample Data Notice:</span> All compensation amounts, EPF identifiers, bank references, and financial numbers below are demonstrative sample fixtures for UI prototype evaluation only. No genuine legal identity, official seal, or banking transaction is represented.
        </div>
      </div>

      {/* 2. Primary Salary Metrics Overview Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Basic Base Salary */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Basic Base Salary</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">Fixed</span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatLKR(salaryData.basicSalary)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Academic Grade: Senior Faculty Tier II (Sample)
          </p>
        </div>

        {/* Metric 2: Total Allowances */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Monthly Allowances</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">+36.5%</span>
          </div>
          <div className="text-2xl font-black text-[#0D9488] mt-1">
            {formatLKR(salaryData.allowances.reduce((acc, a) => acc + a.amount, 0))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Research, Housing, Ijazah & Travel
          </p>
        </div>

        {/* Metric 3: Total Deductions */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Statutory Deductions</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">EPF 8%</span>
          </div>
          <div className="text-2xl font-black text-rose-700 mt-1">
            - {formatLKR(salaryData.totalDeductions)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-mono">
            EPF Ref: {salaryData.epfNumber || 'Not Registered'}
          </p>
        </div>

        {/* Metric 4: Net Take-Home Salary Hero Card */}
        <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white rounded-2xl p-5 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
              <span className="text-[#37C6A3]">Net Payable Salary</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-[#37C6A3] font-bold">
                {salaryData.currentStatus}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1">
              {formatLKR(salaryData.netSalary)}
            </div>
          </div>
          <p className="text-[11px] text-slate-300 mt-2">
            Disbursed on {salaryData.latestPaymentDate} for {salaryData.latestPaymentMonth}
          </p>
        </div>
      </div>

      {/* 3. Latest Payment Summary & Bank Deposit Info Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0D9488] flex items-center justify-center font-bold text-sm shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Direct Bank Deposit Particulars
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verified institutional direct credit account for faculty payroll
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Status: {salaryData.currentStatus}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 text-xs">
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <span className="text-slate-500 text-[11px] block">Commercial Bank</span>
            <strong className="text-slate-900 font-bold block mt-0.5">{salaryData.bankDetails?.bankName || 'Direct Clearance'}</strong>
            <span className="text-slate-400 text-[10px]">{salaryData.bankDetails?.branch || 'Accounts Department'}</span>
          </div>
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <span className="text-slate-500 text-[11px] block">Account Number</span>
            <strong className="text-slate-900 font-mono font-bold block mt-0.5">{salaryData.bankDetails?.accountNumber || '—'}</strong>
            <span className="text-slate-400 text-[10px]">Beneficiary: {salaryData.bankDetails?.accountHolder || 'Registered Ustadh'}</span>
          </div>
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <span className="text-slate-500 text-[11px] block">Latest Payment Cycle</span>
            <strong className="text-slate-900 font-bold block mt-0.5">{salaryData.latestPaymentMonth}</strong>
            <span className="text-slate-400 text-[10px]">Settled: {salaryData.latestPaymentDate}</span>
          </div>
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <span className="text-slate-500 text-[11px] block">Statutory EPF Number</span>
            <strong className="text-[#0D9488] font-mono font-bold block mt-0.5">{salaryData.epfNumber || 'Not Registered'}</strong>
            <span className="text-slate-400 text-[10px]">Central Bank of Sri Lanka</span>
          </div>
        </div>
      </div>

      {/* 4. Detailed Monthly Salary Breakdown Statement */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Monthly Salary Breakdown Statement
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Itemized components including base pay, academic allowances, honoraria, and statutory deductions
            </p>
          </div>

          {/* Month/Year Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600">Select Month:</label>
            <select
              value={selectedMonthCode}
              onChange={(e) => setSelectedMonthCode(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            >
              <option value="2026-10">October 2026</option>
              <option value="2026-09">September 2026</option>
              <option value="2026-08">August 2026</option>
              <option value="2026-07">July 2026</option>
              <option value="2026-06">June 2026</option>
              <option value="2026-05">May 2026</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Earnings & Allowances Sub-table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                1. Earnings & Faculty Allowances
              </span>
              <span className="text-xs font-bold text-emerald-800">
                {formatLKR(salaryData.grossSalary)}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {/* Basic Salary */}
              <div className="p-3 rounded-xl bg-slate-50/70 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Basic Monthly Salary</div>
                  <div className="text-[11px] text-slate-500">Core instructional contract salary</div>
                </div>
                <div className="font-mono font-bold text-slate-900">{formatLKR(salaryData.basicSalary)}</div>
              </div>

              {/* Allowances */}
              {salaryData.allowances.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50/70 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">{item.name}</div>
                    <div className="text-[11px] text-slate-500">{item.description}</div>
                  </div>
                  <div className="font-mono font-bold text-slate-800">{formatLKR(item.amount)}</div>
                </div>
              ))}

              {/* Adjustments */}
              {salaryData.adjustments?.map((adj: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl bg-teal-50/40 border border-teal-100 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-teal-950 flex items-center gap-1.5">
                      <span>{adj.name}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-100 text-teal-800 font-bold">Adjustment</span>
                    </div>
                    <div className="text-[11px] text-teal-700">{adj.remarks}</div>
                  </div>
                  <div className="font-mono font-bold text-teal-900">+{formatLKR(adj.amount)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Deductions & Statutory Sub-table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                2. Deductions & Statutory Withholdings
              </span>
              <span className="text-xs font-bold text-rose-700">
                - {formatLKR(salaryData.totalDeductions)}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {salaryData.deductions.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50/70 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">{item.name}</div>
                    <div className="text-[11px] text-slate-500">{item.description}</div>
                  </div>
                  <div className="font-mono font-bold text-rose-700">- {formatLKR(item.amount)}</div>
                </div>
              ))}

              {/* Total Calculation Card */}
              <div className="mt-4 p-4 rounded-xl bg-slate-900 text-white space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Gross Earnings:</span>
                  <span className="font-mono">{formatLKR(salaryData.grossSalary)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Total Deductions:</span>
                  <span className="font-mono text-rose-300">- {formatLKR(salaryData.totalDeductions)}</span>
                </div>
                <div className="pt-2 border-t border-slate-700 flex justify-between text-sm font-bold">
                  <span className="text-[#37C6A3]">Net Payable Amount:</span>
                  <span className="font-mono text-white text-base font-black">{formatLKR(salaryData.netSalary)}</span>
                </div>
                <div className="text-[11px] text-slate-400 italic pt-1 text-right">
                  "One Hundred and Six Thousand Sri Lankan Rupees Only"
                </div>
                {/* Employer Statutory Contribution Informational (Not Deducted) */}
                <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row justify-between gap-1">
                  <span>Employer EPF (12%) & ETF (3%):</span>
                  <span className="font-mono text-slate-300 font-semibold">
                    Rs. 12,750.00 (Borne by Institution — Not Deducted)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. 6-Month Compensation History Trends */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#0D9488]" />
              <span>Recent 6-Month Compensation Trajectory</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical monthly salary records for the current academic year
            </p>
          </div>
          <NavLink
            to="/salary/history"
            className="text-xs font-semibold text-[#0D9488] hover:text-[#0F766E] flex items-center gap-1"
          >
            <span>Full History Archive</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </NavLink>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          {salaryData.monthlyTrends.map((t, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border text-center transition ${
                t.month.includes('Oct')
                  ? 'border-teal-300 bg-teal-50/40 ring-1 ring-teal-200'
                  : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <div className="text-[11px] font-bold text-slate-700">{t.month.split(' ')[0]}</div>
              <div className="text-[10px] text-slate-400 font-mono">{t.month.split(' ')[1]}</div>
              <div className="text-xs font-black text-slate-900 mt-2 font-mono">
                {formatLKR(t.net).replace('Rs. ', '')}
              </div>
              <span className="mt-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-900">
                {t.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
