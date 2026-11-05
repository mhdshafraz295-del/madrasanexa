import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  apiGetMadrasaAdminDashboard,
  apiGetMadrasaFollowUpsSummary,
  type MadrasaAdminDashboardData,
  type MadrasaFollowUpsSummaryData,
} from '../../services/api';
import {
  Users,
  Receipt,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  CreditCard,
  RefreshCw,
  Loader2,
  ArrowRight,
  PieChart as PieChartIcon,
  BarChart3,
  GraduationCap,
  BookOpen,
  Coins,
  Banknote,
  Info,
  Megaphone,
  AlertTriangle,
  CalendarClock,
} from 'lucide-react';
import {
  announcementService,
  type MadrasaAnnouncementItem,
} from '../../services/announcement.service';
import InstitutionalLiveClock from '../../components/dashboard/InstitutionalLiveClock';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function DashboardPage() {
  const [data, setData] = useState<MadrasaAdminDashboardData | null>(null);
  const [latestAnnouncements, setLatestAnnouncements] = useState<MadrasaAnnouncementItem[]>([]);
  const [followUpsSummary, setFollowUpsSummary] = useState<MadrasaFollowUpsSummaryData | null>(null);
  const [range, setRange] = useState<string>('12m');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async (selectedRange = range) => {
    setIsLoading(true);
    setError(null);
    try {
      const [response, announcements, followUps] = await Promise.all([
        apiGetMadrasaAdminDashboard(selectedRange),
        announcementService.getMadrasaLatestAnnouncements(4).catch(() => []),
        apiGetMadrasaFollowUpsSummary().catch(() => null),
      ]);
      setData(response);
      setLatestAnnouncements(announcements);
      setFollowUpsSummary(followUps);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard analytics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(range);
  }, [range]);

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3]" />
        <p className="text-xs text-[#7C8A9A]">Loading institutional workspace analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span className="font-semibold">{error || 'An error occurred while loading dashboard.'}</span>
        </div>
        <button
          onClick={() => fetchDashboard(range)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold w-fit cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const { kpis, subscription, charts, recentActivity } = data;

  // Formatting helpers
  const formatLKR = (amount: number) => {
    return `LKR ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Check if financial charts have real data
  const hasFeeData = charts.monthlyFeePerformance.some((p) => p.expected > 0 || p.collected > 0);
  const hasCashData = charts.monthlyCashCollection.some((p) => p.collected > 0);
  const hasStudentData = kpis.totalStudents > 0;
  const hasInvoiceData = charts.invoiceStatusDistribution && (
    charts.invoiceStatusDistribution.pending > 0 ||
    charts.invoiceStatusDistribution.partial > 0 ||
    charts.invoiceStatusDistribution.paid > 0 ||
    charts.invoiceStatusDistribution.overdue > 0 ||
    charts.invoiceStatusDistribution.void > 0
  );

  // Student pie data
  const studentPieData = [
    { name: 'Active', value: charts.studentStatusDistribution.active, color: '#37C6A3' },
    { name: 'Inactive', value: charts.studentStatusDistribution.inactive, color: '#7C8A9A' },
    { name: 'Archived', value: charts.studentStatusDistribution.archived, color: '#0F172A' },
  ].filter((d) => d.value > 0);

  // Invoice pie data
  const invoicePieData = [
    { name: 'Paid', value: charts.invoiceStatusDistribution.paid, color: '#37C6A3' },
    { name: 'Partial', value: charts.invoiceStatusDistribution.partial, color: '#3B82F6' },
    { name: 'Pending', value: charts.invoiceStatusDistribution.pending, color: '#F59E0B' },
    { name: 'Overdue', value: charts.invoiceStatusDistribution.overdue, color: '#EF4444' },
    { name: 'Void', value: charts.invoiceStatusDistribution.void, color: '#94A3B8' },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex flex-col h-[calc(100dvh-10rem)] md:h-[calc(100dvh-11.5rem)] min-h-[520px] overflow-hidden">
      {/* Fixed Top Section: Dashboard Header & Live Clock */}
      <div className="shrink-0 space-y-4 pb-4 bg-[#F7F6F1] z-20">
        {/* Top Header & Range Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Institutional Dashboard</h1>
            <p className="text-xs text-[#7C8A9A] mt-1">
              Real-time fee collection performance, student capacity, and subscription status.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-white border border-[#E7E9EE] rounded-xl p-1 shadow-xs">
              {[
                { id: 'current_month', label: 'This Month' },
                { id: '3m', label: '3M' },
                { id: '6m', label: '6M' },
                { id: '12m', label: '12M' },
                { id: 'year', label: 'This Year' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setRange(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    range === opt.id
                      ? 'bg-[#0F172A] text-white shadow-xs'
                      : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => fetchDashboard(range)}
              disabled={isLoading}
              className="p-2 bg-white border border-[#E7E9EE] hover:bg-[#F7F6F1] text-[#7C8A9A] hover:text-[#0F172A] rounded-xl transition shadow-xs cursor-pointer"
              title="Refresh dashboard data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Institutional Live Clock */}
        <InstitutionalLiveClock />
      </div>

      {/* Scrollable Analytics / Charts Section */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-1 sm:pr-2 pb-6">
        {/* Expiring Soon Banner */}
      {subscription.isExpiringSoon && (
        <div className="bg-[#FFD978]/25 border border-[#FFD978]/80 rounded-2xl p-4 sm:p-5 flex items-start gap-4 shadow-xs">
          <div className="p-2.5 rounded-xl bg-[#FFD978]/60 text-amber-950 shrink-0 mt-0.5">
            <Clock className="w-5 h-5 text-amber-900" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0F172A]">
                Subscription Expiring Soon
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FFD978] text-amber-950 uppercase tracking-wide">
                {subscription.daysRemaining} {subscription.daysRemaining === 1 ? 'day' : 'days'} left
              </span>
            </div>
            <p className="text-xs text-[#0F172A]/80 leading-relaxed">
              Your institution's subscription term expires shortly. All student, class, and fee records will remain 100% safe. Contact platform administration or renew promptly to ensure uninterrupted administrative access.
            </p>
          </div>
          <Link
            to="/madrasa-admin/subscription"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F172A] text-white rounded-xl text-xs font-semibold shrink-0 hover:bg-[#0F172A]/90 transition"
          >
            <span>View Subscription</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#7C8A9A]">Total Students</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{kpis.totalStudents}</h3>
            <div className="flex items-center gap-2 mt-2 text-[11px]">
              <span className="text-emerald-700 font-medium">{kpis.activeStudents} Active</span>
              <span className="text-[#7C8A9A]">&bull;</span>
              <span className="text-[#7C8A9A]">{kpis.activeClasses} Active Classes</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Current Month Expected Fees */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#7C8A9A]">This Month Expected</p>
            <h3 className="text-xl font-bold text-[#0F172A] mt-1">{formatLKR(kpis.currentMonthExpectedFees)}</h3>
            <p className="text-[11px] text-[#7C8A9A] mt-2">Billed institutional invoices</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        {/* Current Month Collected Fees */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#7C8A9A]">This Month Collected</p>
            <h3 className="text-xl font-bold text-emerald-700 mt-1">{formatLKR(kpis.currentMonthCollectedFees)}</h3>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-800 font-medium">
              <span>Pending:</span>
              <span className="font-semibold">{formatLKR(kpis.currentMonthPendingFees)}</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Outstanding Balance & Subscription */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#7C8A9A]">Total Outstanding</p>
            <h3 className="text-xl font-bold text-[#0F172A] mt-1">{formatLKR(kpis.totalOutstandingBalance)}</h3>
            <div className="flex items-center gap-2 mt-2 text-[11px]">
              <span className="px-2 py-0.5 rounded font-bold bg-[#37C6A3]/15 text-[#0F172A]">
                {subscription.subscription?.plan?.name || 'Active Plan'}
              </span>
              <span className="text-[#7C8A9A]">{subscription.daysRemaining}d left</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Teacher & Student Groups Overview Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Teachers & Roles Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#7C8A9A]">Teaching Staff</p>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-[#0F172A] mt-1">
            {data.teacherStats?.totalTeachers ?? 0}
          </h3>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-[#7C8A9A]">
            <span className="text-emerald-700 font-medium">
              {data.teacherStats?.ustadhCount ?? 0} Ustadhs
            </span>
            <span>&bull;</span>
            <span className="text-blue-700 font-medium">
              {data.teacherStats?.schoolTeacherCount ?? 0} School Teachers
            </span>
          </div>
          <Link
            to="/madrasa-admin/ustadh-management"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#37C6A3] hover:underline mt-2.5"
          >
            <span>Manage Teachers</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Assigned Classes */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#7C8A9A]">Assigned Teachers</p>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-[#0F172A] mt-1">
            {data.teacherStats?.teachersWithClasses ?? 0}
          </h3>
          <p className="text-[11px] text-[#7C8A9A] mt-2">
            Staff with active weekly schedules across {kpis.activeClasses} classes
          </p>
          <Link
            to="/madrasa-admin/timetable"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#37C6A3] hover:underline mt-2.5"
          >
            <span>View Timetable</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Academic Sections */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#7C8A9A]">Academic Sections</p>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-[#0F172A] mt-1">
            {data.academicGroupStats?.totalSections ?? 0}
          </h3>
          <p className="text-[11px] text-[#7C8A9A] mt-2">
            Dynamic sections (e.g. Hifz, Kitab, Primary)
          </p>
          <Link
            to="/madrasa-admin/classes"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#37C6A3] hover:underline mt-2.5"
          >
            <span>Manage Sections</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Student Groups Distribution summary */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#7C8A9A]">Student Groups</p>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 space-y-1.5 max-h-[64px] overflow-y-auto pr-1">
            {data.academicGroupStats?.sections && data.academicGroupStats.sections.length > 0 ? (
              data.academicGroupStats.sections.slice(0, 3).map((sec) => (
                <div key={sec.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-[#0F172A] font-medium truncate max-w-[120px]">{sec.name}</span>
                  <span className="text-[#7C8A9A] font-semibold">{sec.studentCount} students</span>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-[#7C8A9A] mt-1">No section groups created yet</p>
            )}
          </div>
          <Link
            to="/madrasa-admin/students"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#37C6A3] hover:underline mt-2.5"
          >
            <span>Student Directory</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Monthly Fee Performance (Expected vs Collected vs Pending by Invoice Billing Month) */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#37C6A3]" />
                <span>Monthly Fee Performance</span>
              </h2>
              <p className="text-xs text-[#7C8A9A] mt-0.5">
                Expected vs Allocated Collections by invoice billing month.
              </p>
            </div>
          </div>

          {hasFeeData ? (
            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.monthlyFeePerformance} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9EE" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7C8A9A' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#7C8A9A' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: any) => [`LKR ${Number(value).toLocaleString()}`, '']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E7E9EE', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="expected" name="Expected Fees" fill="#0F172A" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="collected" name="Collected Fees" fill="#37C6A3" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" name="Pending Balance" fill="#FFD978" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-center p-6 bg-[#F7F6F1]/50 rounded-xl border border-dashed border-[#E7E9EE]">
              <Receipt className="w-10 h-10 text-[#7C8A9A]/40 mb-3" />
              <h4 className="text-xs font-bold text-[#0F172A]">No fee collection data available yet</h4>
              <p className="text-[11px] text-[#7C8A9A] max-w-sm mt-1">
                Your monthly fee analytics will automatically populate as student invoices and fee allocations are generated in Phase 9 & 10.
              </p>
            </div>
          )}
        </div>

        {/* Chart 2: Monthly Cash Collection Trend (Actual payments received by paidAt month) */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Monthly Cash Collection</span>
              </h2>
              <p className="text-xs text-[#7C8A9A] mt-0.5">
                Actual completed fee payments received by calendar month.
              </p>
            </div>
          </div>

          {hasCashData ? (
            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.monthlyCashCollection} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#37C6A3" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#37C6A3" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9EE" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7C8A9A' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#7C8A9A' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: any) => [`LKR ${Number(value).toLocaleString()}`, 'Cash Received']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E7E9EE', fontSize: '12px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="collected"
                    name="Cash Collected"
                    stroke="#37C6A3"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCash)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-center p-6 bg-[#F7F6F1]/50 rounded-xl border border-dashed border-[#E7E9EE]">
              <TrendingUp className="w-10 h-10 text-[#7C8A9A]/40 mb-3" />
              <h4 className="text-xs font-bold text-[#0F172A]">No payment transactions recorded yet</h4>
              <p className="text-[11px] text-[#7C8A9A] max-w-sm mt-1">
                Completed cash and bank transfer payment transactions will plot your actual cash inflow here once fee collection begins.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Distribution Charts & Status Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Student Status Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span>Student Capacity & Status</span>
          </h2>

          {hasStudentData && studentPieData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={studentPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                    >
                      {studentPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [v, 'Students']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 flex-1 w-full text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#F7F6F1]">
                  <span className="flex items-center gap-2 font-medium text-[#0F172A]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#37C6A3]" />
                    Active Students
                  </span>
                  <span className="font-bold">{charts.studentStatusDistribution.active}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#F7F6F1]">
                  <span className="flex items-center gap-2 font-medium text-[#0F172A]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#7C8A9A]" />
                    Inactive Students
                  </span>
                  <span className="font-bold">{charts.studentStatusDistribution.inactive}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#F7F6F1]">
                  <span className="flex items-center gap-2 font-medium text-[#0F172A]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0F172A]" />
                    Archived Students
                  </span>
                  <span className="font-bold">{charts.studentStatusDistribution.archived}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-center p-4 bg-[#F7F6F1]/50 rounded-xl border border-dashed border-[#E7E9EE]">
              <Users className="w-8 h-8 text-[#7C8A9A]/40 mb-2" />
              <p className="text-xs font-bold text-[#0F172A]">No student profiles enrolled yet</p>
              <p className="text-[11px] text-[#7C8A9A] mt-0.5">Enrolled student metrics will appear here in Phase 8.</p>
            </div>
          )}
        </div>

        {/* Invoice Status Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-purple-600" />
            <span>Invoice Lifecycle Breakdown</span>
          </h2>

          {hasInvoiceData && invoicePieData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={invoicePieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                    >
                      {invoicePieData.map((entry, index) => (
                        <Cell key={`inv-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [v, 'Invoices']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 flex-1 w-full text-xs">
                {invoicePieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-1.5 rounded-lg bg-[#F7F6F1]">
                    <span className="flex items-center gap-2 font-medium text-[#0F172A]">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="font-bold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-center p-4 bg-[#F7F6F1]/50 rounded-xl border border-dashed border-[#E7E9EE]">
              <Receipt className="w-8 h-8 text-[#7C8A9A]/40 mb-2" />
              <p className="text-xs font-bold text-[#0F172A]">No invoices recorded yet</p>
              <p className="text-[11px] text-[#7C8A9A] mt-0.5">Generate monthly tuition fee invoices for active students.</p>
              <Link
                to="/madrasa-admin/invoices/generate"
                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#37C6A3] hover:bg-[#2BB393] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5" />
                Generate Invoices
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Latest Announcements Compact Widget */}
      <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#37C6A3]" />
            <h2 className="text-sm font-bold text-[#0F172A]">Latest Announcements</h2>
            {latestAnnouncements.some((a) => !a.isRead) && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#37C6A3] text-[#0F172A]">
                New
              </span>
            )}
          </div>
          <Link
            to="/madrasa-admin/announcements"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#37C6A3] hover:underline"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {latestAnnouncements.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#7C8A9A]">
            No platform announcements at this time.
          </div>
        ) : (
          <div className="divide-y divide-[#E7E9EE]">
            {latestAnnouncements.map((item) => (
              <Link
                key={item.id}
                to="/madrasa-admin/announcements"
                className="py-3 flex items-center justify-between gap-3 text-xs hover:bg-[#F7F6F1]/60 px-2 rounded-xl transition group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {!item.isRead ? (
                    <span className="w-2 h-2 rounded-full bg-[#37C6A3] shrink-0" title="Unread" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-200 shrink-0" title="Read" />
                  )}

                  {item.priority === 'URGENT' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 shrink-0">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      URGENT
                    </span>
                  ) : item.priority === 'IMPORTANT' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 shrink-0">
                      <Info className="w-2.5 h-2.5" />
                      IMPORTANT
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] font-semibold shrink-0">
                      NORMAL
                    </span>
                  )}

                  <span className="font-semibold text-[#0F172A] truncate group-hover:text-[#37C6A3] transition">
                    {item.title}
                  </span>
                </div>

                <span className="text-[11px] text-[#7C8A9A] shrink-0">
                  {item.publishedAt
                    ? new Date(item.publishedAt).toLocaleDateString()
                    : new Date(item.createdAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Section: Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions Panel */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">Quick Actions</h2>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">
              Phase 9 Active
            </span>
          </div>

          <div className="space-y-2.5">
            <Link
              to="/madrasa-admin/invoices/generate"
              className="flex items-center justify-between p-3.5 rounded-xl border border-[#37C6A3]/30 bg-[#37C6A3]/5 hover:bg-[#37C6A3]/10 transition group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#37C6A3] text-white transition">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">Generate Invoices</div>
                  <div className="text-[11px] text-[#7C8A9A]">Run monthly fee engine with duplicate checks</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#37C6A3] group-hover:translate-x-0.5 transition" />
            </Link>

            <Link
              to="/madrasa-admin/invoices"
              className="flex items-center justify-between p-3.5 rounded-xl border border-[#E7E9EE] hover:bg-[#F7F6F1] transition group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#0F172A]/5 text-[#0F172A] group-hover:bg-[#0F172A] group-hover:text-white transition">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">Invoices Directory</div>
                  <div className="text-[11px] text-[#7C8A9A]">Track billing status, balances & overdues</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#7C8A9A] group-hover:translate-x-0.5 transition" />
            </Link>

            <Link
              to="/madrasa-admin/students/new"
              className="flex items-center justify-between p-3.5 rounded-xl border border-[#E7E9EE] hover:bg-[#F7F6F1] transition group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#0F172A]/5 text-[#0F172A] group-hover:bg-[#0F172A] group-hover:text-white transition">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">Add New Student</div>
                  <div className="text-[11px] text-[#7C8A9A]">Register student, fee & guardian details</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#7C8A9A] group-hover:translate-x-0.5 transition" />
            </Link>

            <Link
              to="/madrasa-admin/classes"
              className="flex items-center justify-between p-3.5 rounded-xl border border-[#E7E9EE] hover:bg-[#F7F6F1] transition group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#0F172A]/5 text-[#0F172A] group-hover:bg-[#0F172A] group-hover:text-white transition">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">Manage Class Groups</div>
                  <div className="text-[11px] text-[#7C8A9A]">Create classes and default monthly fees</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#7C8A9A] group-hover:translate-x-0.5 transition" />
            </Link>

            <Link
              to="/madrasa-admin/students"
              className="flex items-center justify-between p-3.5 rounded-xl border border-[#E7E9EE] hover:bg-[#F7F6F1] transition group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#0F172A]/5 text-[#0F172A] group-hover:bg-[#0F172A] group-hover:text-white transition">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">Student Directory</div>
                  <div className="text-[11px] text-[#7C8A9A]">Search, fee overrides & status lifecycle</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#7C8A9A] group-hover:translate-x-0.5 transition" />
            </Link>

            <Link
              to="/madrasa-admin/fee-pos"
              className="flex items-center justify-between p-3.5 rounded-xl border border-[#E7E9EE] hover:bg-[#F7F6F1] transition group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 group-hover:bg-[#08483A] group-hover:text-white transition">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">Fee Collection POS</div>
                  <div className="text-[11px] text-[#7C8A9A]">Collect tuition and issue receipts</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#7C8A9A] group-hover:translate-x-0.5 transition" />
            </Link>

            <Link
              to="/madrasa-admin/payments"
              className="flex items-center justify-between p-3.5 rounded-xl border border-[#E7E9EE] hover:bg-[#F7F6F1] transition group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-800 group-hover:bg-blue-700 group-hover:text-white transition">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">Payment History & Collections</div>
                  <div className="text-[11px] text-[#7C8A9A]">Receipts, audits, and void records</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#7C8A9A] group-hover:translate-x-0.5 transition" />
            </Link>

            <Link
              to="/madrasa-admin/subscription"
              className="flex items-center justify-between p-3.5 rounded-xl border border-[#E7E9EE] hover:bg-[#F7F6F1] transition group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#37C6A3]/10 text-[#37C6A3] group-hover:bg-[#37C6A3] group-hover:text-white transition">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">Subscription Overview</div>
                  <div className="text-[11px] text-[#7C8A9A]">View terms and payment history</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#7C8A9A] group-hover:translate-x-0.5 transition" />
            </Link>

            <Link
              to="/madrasa-admin/about-us"
              className="flex items-center justify-between p-3.5 rounded-xl border border-[#E7E9EE] hover:bg-[#F7F6F1] transition group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#37C6A3]/10 text-[#37C6A3] group-hover:bg-[#37C6A3] group-hover:text-white transition">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">About MadrasaNexa</div>
                  <div className="text-[11px] text-[#7C8A9A]">Platform overview, mission & values</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#7C8A9A] group-hover:translate-x-0.5 transition" />
            </Link>

            {/* Upcoming Roadmap Items */}
            {[
              { label: 'Financial & Audit Reports', badge: 'Phase 12' },
            ].map((action) => (
              <div
                key={action.label}
                className="flex items-center justify-between p-3 rounded-xl bg-[#F7F6F1]/60 border border-[#E7E9EE]/80 text-[#7C8A9A] text-xs cursor-not-allowed select-none"
              >
                <span>{action.label}</span>
                <span className="text-[9px] font-bold bg-[#E7E9EE] text-[#7C8A9A] px-2 py-0.5 rounded uppercase">
                  {action.badge}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">Recent Institutional Activity</h2>
              <p className="text-xs text-[#7C8A9A] mt-0.5">Audit log entries for your Madrasa workspace.</p>
            </div>
            <Link
              to="/madrasa-admin/activity"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#37C6A3] hover:underline"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentActivity && recentActivity.length > 0 ? (
            <div className="divide-y divide-[#E7E9EE]">
              {recentActivity.map((log) => (
                <div key={log.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#37C6A3] shrink-0" />
                    <div>
                      <span className="font-semibold text-[#0F172A] font-mono">{log.action}</span>
                      <div className="text-[11px] text-[#7C8A9A]">
                        {log.user?.name ? `By ${log.user.name}` : 'By System'}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-[#7C8A9A] shrink-0">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-[#7C8A9A] text-xs">
              No recent activity recorded for this workspace yet.
            </div>
          )}
        </div>
      </div>

      {/* Student Follow-Ups & Scheduled Reminders Summary Widget */}
      {followUpsSummary && (
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E9EE]">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[#08483A]" />
              <div>
                <h2 className="text-sm font-bold text-[#0F172A]">
                  Student Follow-Ups & Scheduled Reminders
                </h2>
                <p className="text-xs text-[#7C8A9A]">
                  Active follow-ups across your Madrasa ({followUpsSummary.todayDate})
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200">
                Overdue: {followUpsSummary.overdueCount}
              </span>
              <span className="px-2.5 py-1 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Due Today: {followUpsSummary.dueTodayCount}
              </span>
              <span className="px-2.5 py-1 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Upcoming: {followUpsSummary.upcomingCount}
              </span>
            </div>
          </div>

          {followUpsSummary.items.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#7C8A9A]">
              No open student follow-ups or pending reminders at this time.
            </div>
          ) : (
            <div className="divide-y divide-[#E7E9EE]">
              {followUpsSummary.items.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.isOverdue
                            ? 'bg-rose-100 text-rose-800'
                            : item.isDueToday
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {item.isOverdue ? 'OVERDUE' : item.isDueToday ? 'DUE TODAY' : 'UPCOMING'}
                      </span>
                      <span className="font-bold text-[#0F172A]">{item.title}</span>
                      {item.student && (
                        <span className="text-[#5B6B7F]">
                          • {item.student.fullName} ({item.student.admissionNo})
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#7C8A9A]">
                      Due: {item.dueDate} • Priority: {item.priority}
                      {item.assignedToUstadh ? ` • Assigned: ${item.assignedToUstadh.fullName}` : ''}
                    </div>
                  </div>
                  <Link
                    to={item.navigationUrl}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#08483A]/10 text-[#08483A] hover:bg-[#08483A] hover:text-white font-bold transition w-fit"
                  >
                    <span>Open Follow-Up</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
