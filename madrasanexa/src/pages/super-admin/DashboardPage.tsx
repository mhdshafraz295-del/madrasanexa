import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  apiGetSuperAdminDashboard,
  type SuperAdminDashboardMetrics,
} from '../../services/api';
import {
  Building2,
  Clock,
  Layers,
  ArrowRight,
  RefreshCw,
  Loader2,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  PieChart as PieChartIcon,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#37C6A3',
  EXPIRING_SOON: '#FFD978',
  EXPIRED: '#EF4444',
  SUSPENDED: '#F59E0B',
  CANCELLED: '#7C8A9A',
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<SuperAdminDashboardMetrics | null>(null);
  const [period, setPeriod] = useState<'6m' | '12m'>('6m');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchMetrics = async (selectedPeriod = period) => {
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGetSuperAdminDashboard({
        period: selectedPeriod,
        signal: controller.signal,
      });
      setMetrics(data);
    } catch (err: any) {
      if (axios.isCancel(err) || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return; // Canceled request, ignore safely
      }
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics(period);
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, []);

  const handlePeriodChange = (newPeriod: '6m' | '12m') => {
    if (newPeriod === period) return;
    setPeriod(newPeriod);
    fetchMetrics(newPeriod);
  };

  const formatCurrency = (amount: number | string) => {
    return `LKR ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCount = (count: number) => {
    return `${count} ${count === 1 ? 'Institution' : 'Institutions'}`;
  };

  if (isLoading && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3]" />
        <p className="text-xs text-[#7C8A9A]">Loading platform analytics...</p>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex flex-col gap-3">
        <p>{error || 'An error occurred while loading dashboard metrics.'}</p>
        <button
          onClick={() => fetchMetrics(period)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold w-fit cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const { counts, financials, pendingOnboardingsList, recentMadrasas, charts } = metrics;

  // Chart data checks
  const growthData = charts?.institutionGrowth || [];
  const hasGrowthData = growthData.some((d) => d.institutions > 0);

  const revenueData = charts?.subscriptionRevenue || [];
  const hasRevenueData = revenueData.some((d) => d.revenue > 0);

  const rawStatusData = charts?.subscriptionStatus || [];
  const statusPieData = rawStatusData.filter((s) => s.count > 0);
  const totalStatusCount = rawStatusData.reduce((acc, s) => acc + s.count, 0);

  const planData = charts?.planDistribution || [];
  const totalPlanInstitutions = planData.reduce((acc, p) => acc + p.institutionCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Platform Dashboard</h1>
          <p className="text-xs text-[#7C8A9A] mt-1">
            Global multi-tenant overview, subscriptions, and tenant onboarding pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period Selector Toggle */}
          <div className="inline-flex p-1 bg-white border border-[#E7E9EE] rounded-xl shadow-xs text-xs font-semibold">
            <button
              onClick={() => handlePeriodChange('6m')}
              disabled={isLoading}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                period === '6m'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-[#7C8A9A] hover:text-[#0F172A]'
              }`}
            >
              6 Months
            </button>
            <button
              onClick={() => handlePeriodChange('12m')}
              disabled={isLoading}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                period === '12m'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-[#7C8A9A] hover:text-[#0F172A]'
              }`}
            >
              12 Months
            </button>
          </div>

          <button
            onClick={() => fetchMetrics(period)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-[#E7E9EE] hover:bg-[#F7F6F1] text-xs font-semibold text-[#0F172A] rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#7C8A9A] ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Madrasas */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#7C8A9A]">Total Madrasas</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{counts.totalMadrasas}</h3>
            <div className="flex items-center gap-2 mt-2 text-[11px]">
              <span className="text-emerald-700 font-medium">{counts.activeMadrasas} Active</span>
              <span className="text-[#7C8A9A]">&bull;</span>
              <span className="text-amber-700 font-medium">{counts.suspendedMadrasas} Suspended</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Onboarding Requests */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#7C8A9A]">Pending Onboarding</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{counts.pendingOnboardings}</h3>
            <Link
              to="/super-admin/onboarding"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#37C6A3] hover:underline mt-2"
            >
              <span>Review Requests</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Active Subscriptions */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#7C8A9A]">Active Subscriptions</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{counts.activeSubscriptions}</h3>
            <div className="flex items-center gap-2 mt-2 text-[11px]">
              <span className="text-amber-600 font-medium">{counts.expiringSoonSubscriptions} Expiring Soon</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Total Subscription Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#7C8A9A]">Total Revenue</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-1">
              ${Number(financials.totalCollected).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
            <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium mt-2">
              <TrendingUp className="w-3 h-3" />
              <span>Paid Invoices</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#FFD978]/20 text-[#0F172A] flex items-center justify-center">
            <Layers className="w-6 h-6 text-[#d9a826]" />
          </div>
        </div>

        {/* Bank Transfer Receipts Verification */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E9EE] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#7C8A9A]">Bank Transfer Receipts</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-1">
              {metrics.bankSubmissions?.total ?? 0}
            </h3>
            <div className="flex items-center gap-2 mt-2 text-[11px]">
              <span className="text-amber-700 font-semibold">{metrics.bankSubmissions?.pending ?? counts.pendingBankSubmissions ?? 0} Pending</span>
              <span className="text-[#7C8A9A]">&bull;</span>
              <span className="text-emerald-700 font-medium">{metrics.bankSubmissions?.approved ?? 0} Verified</span>
            </div>
            <Link
              to="/super-admin/subscription-payments"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#37C6A3] hover:underline mt-2"
            >
              <span>Review Payments</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Institution Growth */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#37C6A3]" />
                <span>Institution Growth</span>
              </h2>
              <p className="text-xs text-[#7C8A9A] mt-0.5">
                Monthly new Madrasa registrations over time ({period === '12m' ? 'Last 12 Months' : 'Last 6 Months'}).
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#37C6A3]" />
            </div>
          ) : hasGrowthData ? (
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9EE" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7C8A9A' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#7C8A9A' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => [formatCount(Number(val)), 'New Registrations']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E7E9EE', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="institutions"
                    stroke="#37C6A3"
                    strokeWidth={2.5}
                    fill="#37C6A3"
                    fillOpacity={0.15}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#F7F6F1]/50 rounded-xl border border-dashed border-[#E7E9EE]">
              <Building2 className="w-10 h-10 text-[#7C8A9A]/40 mb-3" />
              <h4 className="text-xs font-bold text-[#0F172A]">No institution registrations recorded yet</h4>
              <p className="text-[11px] text-[#7C8A9A] max-w-sm mt-1">
                New Madrasa institutions provisioned on the platform will plot continuous registration growth here.
              </p>
            </div>
          )}
        </div>

        {/* Chart 2: Subscription Revenue Trend */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Subscription Revenue</span>
              </h2>
              <p className="text-xs text-[#7C8A9A] mt-0.5">
                Realized platform subscription payments ({period === '12m' ? 'Last 12 Months' : 'Last 6 Months'}).
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#37C6A3]" />
            </div>
          ) : hasRevenueData ? (
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9EE" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7C8A9A' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#7C8A9A' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => Number(val) >= 1000 ? `${(Number(val) / 1000).toFixed(0)}k` : `${val}`}
                  />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(val), 'Subscription Revenue']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E7E9EE', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0F172A"
                    strokeWidth={2.5}
                    fill="#FFD978"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#F7F6F1]/50 rounded-xl border border-dashed border-[#E7E9EE]">
              <TrendingUp className="w-10 h-10 text-[#7C8A9A]/40 mb-3" />
              <h4 className="text-xs font-bold text-[#0F172A]">No subscription revenue recorded yet</h4>
              <p className="text-[11px] text-[#7C8A9A] max-w-sm mt-1">
                Completed platform subscription renewal payments and onboarding receipts will plot revenue trends here.
              </p>
            </div>
          )}
        </div>

        {/* Chart 3: Subscription Status Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-purple-600" />
              <span>Subscription Status</span>
            </h2>
            <span className="text-xs text-[#7C8A9A]">Current Effective</span>
          </div>

          {isLoading ? (
            <div className="h-52 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#37C6A3]" />
            </div>
          ) : totalStatusCount > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
              <div className="h-48 w-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={4}
                    >
                      {statusPieData.map((entry) => (
                        <Cell key={`status-${entry.status}`} fill={STATUS_COLORS[entry.status] || '#7C8A9A'} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [formatCount(Number(val)), 'Institutions']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #E7E9EE', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 flex-1 w-full text-xs">
                {rawStatusData.map((entry) => (
                  <div key={entry.status} className="flex items-center justify-between p-2 rounded-xl bg-[#F7F6F1]">
                    <span className="flex items-center gap-2 font-medium text-[#0F172A]">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: STATUS_COLORS[entry.status] || '#7C8A9A' }}
                      />
                      {entry.label}
                    </span>
                    <span className="font-bold text-[#0F172A]">{entry.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-52 flex flex-col items-center justify-center text-center p-6 bg-[#F7F6F1]/50 rounded-xl border border-dashed border-[#E7E9EE]">
              <PieChartIcon className="w-10 h-10 text-[#7C8A9A]/40 mb-2" />
              <h4 className="text-xs font-bold text-[#0F172A]">No subscription status data available</h4>
              <p className="text-[11px] text-[#7C8A9A] max-w-sm mt-1">
                Active, expiring, and expired tenant subscription lifecycles will plot distribution here.
              </p>
            </div>
          )}
        </div>

        {/* Chart 4: Institutions by Plan */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>Institutions by Plan</span>
            </h2>
            <span className="text-xs text-[#7C8A9A]">Active Tiers</span>
          </div>

          {isLoading ? (
            <div className="h-52 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#37C6A3]" />
            </div>
          ) : totalPlanInstitutions > 0 ? (
            <div className="h-48 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={planData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E7E9EE" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#7C8A9A' }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="planName"
                    tick={{ fontSize: 11, fill: '#0F172A', fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    width={100}
                  />
                  <Tooltip
                    formatter={(val: any) => [formatCount(Number(val)), 'Institutions']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E7E9EE', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                  />
                  <Bar dataKey="institutionCount" radius={[0, 8, 8, 0]} barSize={20}>
                    {planData.map((_, idx) => (
                      <Cell key={`plan-${idx}`} fill={idx % 2 === 0 ? '#0F172A' : '#37C6A3'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex flex-col items-center justify-center text-center p-6 bg-[#F7F6F1]/50 rounded-xl border border-dashed border-[#E7E9EE]">
              <BarChart3 className="w-10 h-10 text-[#7C8A9A]/40 mb-2" />
              <h4 className="text-xs font-bold text-[#0F172A]">No plan enrollment recorded yet</h4>
              <p className="text-[11px] text-[#7C8A9A] max-w-sm mt-1">
                Distribution of institutions across subscription tiers will plot here once plans are assigned.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pending Onboarding Requests Section */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#E7E9EE] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-[#0F172A]">Pending Onboarding Applications</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              {pendingOnboardingsList.length}
            </span>
          </div>
          <Link
            to="/super-admin/onboarding"
            className="text-xs font-semibold text-[#0F172A] hover:text-[#37C6A3] flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {pendingOnboardingsList.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#7C8A9A]">
            No pending onboarding requests at this time.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F6F1] text-[#7C8A9A] font-semibold border-b border-[#E7E9EE]">
                <tr>
                  <th className="px-5 py-3">Madrasa Name</th>
                  <th className="px-5 py-3">Contact Person</th>
                  <th className="px-5 py-3">Email & Phone</th>
                  <th className="px-5 py-3">Applied Date</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9EE]">
                {pendingOnboardingsList.slice(0, 5).map((req) => (
                  <tr key={req.id} className="hover:bg-[#F7F6F1]/50 transition">
                    <td className="px-5 py-3 font-semibold text-[#0F172A]">{req.madrasaName}</td>
                    <td className="px-5 py-3 text-[#0F172A]">{req.contactName}</td>
                    <td className="px-5 py-3 text-[#7C8A9A]">
                      <div>{req.email}</div>
                      <div className="text-[10px]">{req.phone}</div>
                    </td>
                    <td className="px-5 py-3 text-[#7C8A9A]">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/super-admin/onboarding?select=${req.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FFD978] hover:bg-[#ffe18f] text-[#0F172A] rounded-lg text-xs font-semibold transition"
                      >
                        <span>Review</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Madrasas Section */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#E7E9EE] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#37C6A3]" />
            <h2 className="text-sm font-bold text-[#0F172A]">Recent Madrasas</h2>
          </div>
          <Link
            to="/super-admin/madrasas"
            className="text-xs font-semibold text-[#0F172A] hover:text-[#37C6A3] flex items-center gap-1"
          >
            <span>View All Madrasas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentMadrasas.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#7C8A9A]">No Madrasas registered yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F6F1] text-[#7C8A9A] font-semibold border-b border-[#E7E9EE]">
                <tr>
                  <th className="px-5 py-3">Madrasa</th>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Workspace Status</th>
                  <th className="px-5 py-3">Subscription</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9EE]">
                {recentMadrasas.map((m) => (
                  <tr key={m.id} className="hover:bg-[#F7F6F1]/50 transition">
                    <td className="px-5 py-3 font-semibold text-[#0F172A]">{m.name}</td>
                    <td className="px-5 py-3 font-mono text-[11px] text-[#7C8A9A]">{m.code}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          m.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : m.status === 'SUSPENDED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {m.subscriptionSummary ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            m.subscriptionSummary.code === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700'
                              : m.subscriptionSummary.code === 'EXPIRING_SOON'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {m.subscriptionSummary.code === 'ACTIVE'
                            ? `${m.subscriptionSummary.daysRemaining}d left`
                            : m.subscriptionSummary.code}
                        </span>
                      ) : (
                        <span className="text-[#7C8A9A] text-[10px]">No Subscription</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[#7C8A9A]">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/super-admin/madrasas/${m.id}`}
                        className="text-xs font-semibold text-[#0F172A] hover:text-[#37C6A3]"
                      >
                        Manage &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
