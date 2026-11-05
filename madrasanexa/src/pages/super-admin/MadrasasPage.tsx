import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  apiListMadrasas,
  apiListPlans,
  type MadrasaListItem,
  type MadrasaKpis,
  type PlanItem,
} from '../../services/api';
import {
  Search,
  Building2,
  ArrowRight,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  PauseCircle,
  Archive,
  Clock,
  X,
  GraduationCap,
  Layers,
} from 'lucide-react';

export default function MadrasasPage() {
  const [madrasas, setMadrasas] = useState<MadrasaListItem[]>([]);
  const [kpis, setKpis] = useState<MadrasaKpis>({
    total: 0,
    active: 0,
    suspended: 0,
    archived: 0,
    expiringSoon: 0,
  });
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Pagination state
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [planFilter, setPlanFilter] = useState<string>('ALL');
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load plans for dynamic plan filter dropdown
  useEffect(() => {
    let mounted = true;
    apiListPlans()
      .then((data) => {
        if (mounted) setPlans(data);
      })
      .catch((err) => console.error('Failed to load plans:', err));
    return () => {
      mounted = false;
    };
  }, []);

  // 300ms Debounce for search input to prevent network storms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadMadrasas = useCallback(
    async (
      pageToLoad: number,
      searchVal: string,
      statusVal: string,
      planVal: string,
      subStatusVal: string
    ) => {
      // Cancel previous in-flight request to prevent race conditions and timeouts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      try {
        const res = await apiListMadrasas(
          {
            search: searchVal.trim() || undefined,
            status: statusVal === 'ALL' ? undefined : statusVal,
            planId: planVal === 'ALL' ? undefined : planVal,
            subscriptionStatus: subStatusVal === 'ALL' ? undefined : subStatusVal,
            page: pageToLoad,
            pageSize: pagination.pageSize,
          },
          controller.signal
        );

        setMadrasas(res.madrasas);
        setPagination({
          page: res.page,
          pageSize: res.pageSize,
          total: res.total,
          totalPages: res.totalPages,
        });
        if (res.kpis) {
          setKpis(res.kpis);
        }
      } catch (err: any) {
        if (axios.isCancel(err) || err?.name === 'CanceledError') {
          // Stale request cancelled cleanly, ignore
          return;
        }
        console.error('Failed to load madrasas:', err);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [pagination.pageSize]
  );

  useEffect(() => {
    loadMadrasas(
      pagination.page,
      debouncedSearch,
      statusFilter,
      planFilter,
      subscriptionStatusFilter
    );
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [
    debouncedSearch,
    statusFilter,
    planFilter,
    subscriptionStatusFilter,
    pagination.page,
    loadMadrasas,
  ]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('ALL');
    setPlanFilter('ALL');
    setSubscriptionStatusFilter('ALL');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters =
    debouncedSearch.trim() !== '' ||
    statusFilter !== 'ALL' ||
    planFilter !== 'ALL' ||
    subscriptionStatusFilter !== 'ALL';

  const renderLifecycleBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Active</span>
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <PauseCircle className="w-3 h-3 text-amber-600" />
            <span>Suspended</span>
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Archive className="w-3 h-3 text-slate-500" />
            <span>Archived</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  const renderSubscriptionBadge = (sub?: MadrasaListItem['activeSubscription']) => {
    if (!sub) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
          No Plan
        </span>
      );
    }

    switch (sub.status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Active</span>
          </span>
        );
      case 'EXPIRING_SOON':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Expiring Soon</span>
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
            Expired
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-800 border border-orange-200">
            Suspended
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
            {sub.status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Madrasa Institutions</h1>
          <p className="text-xs text-[#7C8A9A] mt-1">
            Manage institutional tenants, workspace lifecycles, and tenant administrators.
          </p>
        </div>
      </div>

      {/* Dynamic KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* 1. Total */}
        <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#7C8A9A] uppercase tracking-wider">
              Total Institutions
            </span>
            <div className="p-2 rounded-xl bg-slate-100 text-[#0F172A]">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#0F172A]">
              {isLoading ? '...' : kpis.total}
            </span>
          </div>
        </div>

        {/* 2. Active */}
        <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Active
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#0F172A]">
              {isLoading ? '...' : kpis.active}
            </span>
          </div>
        </div>

        {/* 3. Suspended */}
        <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              Suspended
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <PauseCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#0F172A]">
              {isLoading ? '...' : kpis.suspended}
            </span>
          </div>
        </div>

        {/* 4. Archived */}
        <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Archived
            </span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
              <Archive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#0F172A]">
              {isLoading ? '...' : kpis.archived}
            </span>
          </div>
        </div>

        {/* 5. Expiring Soon */}
        <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Expiring Soon
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-900">
              {isLoading ? '...' : kpis.expiringSoon}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-[#F7F6F1] rounded-xl overflow-x-auto">
            {['ALL', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-[#7C8A9A] hover:text-[#0F172A]'
                }`}
              >
                {st === 'ALL' ? 'All Tenants' : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 lg:max-w-md">
            <Search className="w-4 h-4 text-[#7C8A9A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, admin, phone, email..."
              className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-[#E7E9EE] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 focus:border-[#37C6A3] transition bg-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setDebouncedSearch('');
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7C8A9A] hover:text-[#0F172A] p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
        </div>

        {/* Dynamic Plan & Subscription Status Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#E7E9EE]/60 text-xs">
          {/* Plan Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#7C8A9A] text-[11px] font-medium">Plan:</span>
            <select
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="px-2.5 py-1.5 rounded-lg border border-[#E7E9EE] bg-[#F7F6F1] text-xs font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
            >
              <option value="ALL">All Plans</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subscription Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#7C8A9A] text-[11px] font-medium">Subscription:</span>
            <select
              value={subscriptionStatusFilter}
              onChange={(e) => {
                setSubscriptionStatusFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="px-2.5 py-1.5 rounded-lg border border-[#E7E9EE] bg-[#F7F6F1] text-xs font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
            >
              <option value="ALL">All Subscriptions</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRING_SOON">Expiring Soon</option>
              <option value="EXPIRED">Expired</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Madrasa Content: Desktop Table & Mobile Cards */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3]" />
            <p className="text-xs text-[#7C8A9A]">Loading Madrasa institutions...</p>
          </div>
        ) : madrasas.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <Building2 className="w-8 h-8 text-[#7C8A9A] mx-auto opacity-50" />
            <div className="font-semibold text-sm text-[#0F172A]">No Madrasa institutions found</div>
            <p className="text-xs text-[#7C8A9A]">
              {hasActiveFilters
                ? 'Try adjusting your search criteria or resetting active filters.'
                : 'Approved institutions will appear automatically here.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-[#F7F6F1] hover:bg-[#E7E9EE] text-[#0F172A] rounded-xl text-xs font-semibold transition"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table (Visible at 1024px and above) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F6F1] text-[#7C8A9A] font-semibold border-b border-[#E7E9EE]">
                  <tr>
                    <th className="px-5 py-3">Institution</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-5 py-3">Tenant Admin</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Subscription</th>
                    <th className="px-3 py-3 text-center">Students</th>
                    <th className="px-3 py-3 text-center">Classes</th>
                    <th className="px-4 py-3">Lifecycle</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E9EE]">
                  {madrasas.map((m) => {
                    const primaryAdmin = m.primaryAdmin || m.admins?.[0];
                    return (
                      <tr key={m.id} className="hover:bg-[#F7F6F1]/50 transition">
                        {/* Institution with Logo/Initials */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#0F172A] text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden shadow-xs">
                              {m.logoUrl ? (
                                <img
                                  src={m.logoUrl}
                                  alt={m.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>{m.initials || 'MN'}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <Link
                                to={`/super-admin/madrasas/${m.id}`}
                                className="font-semibold text-[#0F172A] hover:text-[#37C6A3] transition truncate block"
                              >
                                {m.name}
                              </Link>
                              <div className="text-[11px] text-[#7C8A9A] truncate">
                                {m.email || m.phone || 'No direct contact'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Code */}
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-xs font-bold text-[#0F172A] bg-[#F7F6F1] px-2 py-0.5 rounded-lg border border-[#E7E9EE]">
                            {m.code}
                          </span>
                        </td>

                        {/* Tenant Admin */}
                        <td className="px-5 py-3.5">
                          {primaryAdmin ? (
                            <div className="min-w-0">
                              <div className="font-semibold text-[#0F172A] flex items-center gap-1">
                                <span className="truncate">{primaryAdmin.name}</span>
                                {!primaryAdmin.isActive && (
                                  <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-bold">
                                    INACTIVE
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-[#7C8A9A] font-mono truncate">
                                {primaryAdmin.email}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[#7C8A9A] italic text-[11px]">No Admin</span>
                          )}
                        </td>

                        {/* Plan */}
                        <td className="px-4 py-3.5">
                          {m.activeSubscription?.plan ? (
                            <div>
                              <div className="font-semibold text-[#0F172A]">
                                {m.activeSubscription.plan.name}
                              </div>
                              <div className="text-[10px] text-[#7C8A9A]">
                                {m.activeSubscription.plan.durationMonths} months
                              </div>
                            </div>
                          ) : (
                            <span className="text-[#7C8A9A] text-[11px]">None</span>
                          )}
                        </td>

                        {/* Subscription Status */}
                        <td className="px-4 py-3.5">
                          <div>
                            {renderSubscriptionBadge(m.activeSubscription)}
                            {m.activeSubscription?.endsAt && (
                              <div className="text-[10px] text-[#7C8A9A] mt-0.5">
                                {m.activeSubscription.daysRemaining !== null &&
                                m.activeSubscription.daysRemaining !== undefined
                                  ? `${m.activeSubscription.daysRemaining}d left`
                                  : new Date(m.activeSubscription.endsAt).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Students */}
                        <td className="px-3 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#0F172A]">
                            <GraduationCap className="w-3.5 h-3.5 text-[#7C8A9A]" />
                            <span>{m.counts?.students ?? 0}</span>
                          </span>
                        </td>

                        {/* Classes */}
                        <td className="px-3 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#0F172A]">
                            <Layers className="w-3.5 h-3.5 text-[#7C8A9A]" />
                            <span>{m.counts?.classes ?? 0}</span>
                          </span>
                        </td>

                        {/* Lifecycle Status */}
                        <td className="px-4 py-3.5">
                          {renderLifecycleBadge(m.status)}
                        </td>

                        {/* Created Date */}
                        <td className="px-4 py-3.5 text-[#7C8A9A] whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <Link
                            to={`/super-admin/madrasas/${m.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#F7F6F1] hover:bg-[#E7E9EE] text-[#0F172A] rounded-xl text-xs font-semibold transition"
                          >
                            <span>Manage</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards (Visible on screens below 1024px: 320px–768px) */}
            <div className="lg:hidden divide-y divide-[#E7E9EE]">
              {madrasas.map((m) => {
                const primaryAdmin = m.primaryAdmin || m.admins?.[0];
                return (
                  <div key={m.id} className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#0F172A] text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden shadow-xs">
                          {m.logoUrl ? (
                            <img
                              src={m.logoUrl}
                              alt={m.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{m.initials || 'MN'}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            to={`/super-admin/madrasas/${m.id}`}
                            className="font-bold text-sm text-[#0F172A] hover:text-[#37C6A3] transition truncate block"
                          >
                            {m.name}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] font-bold text-[#0F172A] bg-[#F7F6F1] px-1.5 py-0.5 rounded border border-[#E7E9EE]">
                              {m.code}
                            </span>
                            <span className="text-[10px] text-[#7C8A9A]">
                              Since {new Date(m.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>{renderLifecycleBadge(m.status)}</div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-[#F7F6F1] p-3 rounded-xl">
                      <div>
                        <span className="text-[#7C8A9A] text-[10px] block font-semibold uppercase">
                          Tenant Admin
                        </span>
                        <span className="font-semibold text-[#0F172A] block truncate">
                          {primaryAdmin?.name || 'No Admin'}
                        </span>
                        {primaryAdmin?.email && (
                          <span className="font-mono text-[10px] text-[#7C8A9A] block truncate">
                            {primaryAdmin.email}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[#7C8A9A] text-[10px] block font-semibold uppercase">
                          Plan & Status
                        </span>
                        <span className="font-semibold text-[#0F172A] block truncate">
                          {m.activeSubscription?.plan?.name || 'No Plan'}
                        </span>
                        <div className="mt-1">
                          {renderSubscriptionBadge(m.activeSubscription)}
                        </div>
                      </div>
                    </div>

                    {/* Usage & Actions Row */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-4 text-xs text-[#7C8A9A]">
                        <span className="inline-flex items-center gap-1 font-semibold text-[#0F172A]">
                          <GraduationCap className="w-3.5 h-3.5 text-[#7C8A9A]" />
                          <span>{m.counts?.students ?? 0} Students</span>
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-[#0F172A]">
                          <Layers className="w-3.5 h-3.5 text-[#7C8A9A]" />
                          <span>{m.counts?.classes ?? 0} Classes</span>
                        </span>
                      </div>

                      <Link
                        to={`/super-admin/madrasas/${m.id}`}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0F172A] text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition shadow-xs"
                      >
                        <span>Manage</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="p-4 bg-[#F7F6F1]/50 border-t border-[#E7E9EE] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-[#7C8A9A]">
                Showing{' '}
                <span className="font-bold text-[#0F172A]">
                  {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-bold text-[#0F172A]">
                  {Math.min(pagination.page * pagination.pageSize, pagination.total)}
                </span>{' '}
                of <span className="font-bold text-[#0F172A]">{pagination.total}</span> institutions
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  className="min-h-[36px] px-3 inline-flex items-center gap-1 rounded-xl bg-white border border-[#E7E9EE] font-semibold text-[#0F172A] hover:bg-[#F7F6F1] transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <span className="px-2 font-bold text-[#0F172A]">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  className="min-h-[36px] px-3 inline-flex items-center gap-1 rounded-xl bg-white border border-[#E7E9EE] font-semibold text-[#0F172A] hover:bg-[#F7F6F1] transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
