import React, { useState, useEffect, useRef } from 'react';
import {
  apiGetPlansWorkspace,
  apiGetPlan,
  apiCreatePlan,
  apiUpdatePlan,
  apiActivatePlan,
  apiDeactivatePlan,
  apiGetFeatureCatalogue,
  type PlanItem,
  type PlanKpis,
  type PlanDetailItem,
  type FeatureCategoryGroup,
} from '../../services/api';
import {
  Plus,
  Edit2,
  Loader2,
  AlertCircle,
  X,
  Search,
  CheckCircle2,
  PauseCircle,
  TrendingUp,
  Building2,
  Layers,
  Eye,
  DollarSign,
  Clock,
  History,
  Info,
  Sliders,
  Table2,
  Lock,
} from 'lucide-react';
import { ManagePlanFeaturesModal } from '../../components/super-admin/ManagePlanFeaturesModal';
import { PlanComparisonMatrix } from '../../components/super-admin/PlanComparisonMatrix';

const DURATION_PRESETS = [1, 3, 6, 12];

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [kpis, setKpis] = useState<PlanKpis>({
    totalPlans: 0,
    activePlans: 0,
    inactivePlans: 0,
    activeSubscriptions: 0,
    institutionsUsingPlans: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Active Tab: 'plans' (standard table) or 'matrix' (side-by-side matrix)
  const [activeTab, setActiveTab] = useState<'plans' | 'matrix'>('plans');

  // Feature Catalogue for Entitlement Management
  const [catalogueCategories, setCatalogueCategories] = useState<FeatureCategoryGroup[]>([]);
  const [matrixRefreshTrigger, setMatrixRefreshTrigger] = useState(0);

  // Manage Features Modal State
  const [featureModalState, setFeatureModalState] = useState<{
    isOpen: boolean;
    plan: PlanItem | PlanDetailItem | null;
  }>({
    isOpen: false,
    plan: null,
  });

  // Load feature catalogue on mount
  useEffect(() => {
    apiGetFeatureCatalogue()
      .then((res) => {
        setCatalogueCategories(res.categories);
      })
      .catch((err) => {
        console.error('Failed to load canonical feature catalogue:', err);
      });
  }, []);

  // Plan Detail Drawer
  const [selectedPlanDetail, setSelectedPlanDetail] = useState<PlanDetailItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoadingDrawer, setIsLoadingDrawer] = useState(false);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    description: '',
    durationMonths: 1,
    price: '',
    isActive: true,
  });
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Modal
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    durationMonths: 1,
    price: '',
    isActive: true,
  });
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Deactivate/Activate Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    plan: PlanItem | null;
    action: 'activate' | 'deactivate';
    isSubmitting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    plan: null,
    action: 'deactivate',
    isSubmitting: false,
    error: null,
  });

  // Debounce search by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load plans & global KPIs with AbortController
  const fetchAbortRef = useRef<AbortController | null>(null);

  const loadPlans = async (signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      const res = await apiGetPlansWorkspace(
        {
          search: debouncedSearch.trim() || undefined,
          status: statusFilter,
        },
        signal
      );
      setPlans(res.plans);
      setKpis(res.kpis);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.error('Failed to load subscription plans:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    loadPlans(controller.signal);

    return () => {
      controller.abort();
    };
  }, [debouncedSearch, statusFilter]);

  // Handle auto-suggesting code from name
  const handleNameChangeOnCreate = (val: string) => {
    setCreateForm((prev) => {
      const updated = { ...prev, name: val };
      if (!codeManuallyEdited) {
        updated.code = val
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '_')
          .replace(/_+/g, '_')
          .slice(0, 30);
      }
      return updated;
    });
  };

  // Submit Create Plan
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const trimmedName = createForm.name.trim();
    const cleanCode = createForm.code.trim().toUpperCase();

    if (!trimmedName || trimmedName.length < 2) {
      setCreateError('Plan name must be at least 2 characters.');
      return;
    }
    if (!cleanCode || cleanCode.length < 2) {
      setCreateError('Plan code must be at least 2 characters.');
      return;
    }
    if (!/^[A-Z0-9_-]+$/.test(cleanCode)) {
      setCreateError('Code must contain only uppercase letters, numbers, hyphens, and underscores.');
      return;
    }
    const duration = Number(createForm.durationMonths);
    if (!Number.isInteger(duration) || duration < 1) {
      setCreateError('Duration must be a positive whole number of months (minimum 1).');
      return;
    }
    const priceStr = String(createForm.price).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(priceStr) || Number(priceStr) < 0) {
      setCreateError('Price must be a valid non-negative number with at most 2 decimal places.');
      return;
    }

    try {
      setIsCreating(true);
      await apiCreatePlan({
        name: trimmedName,
        code: cleanCode,
        description: createForm.description.trim() || null,
        durationMonths: duration,
        price: priceStr,
        isActive: createForm.isActive,
      });

      setIsCreateOpen(false);
      setCreateForm({
        name: '',
        code: '',
        description: '',
        durationMonths: 1,
        price: '',
        isActive: true,
      });
      setCodeManuallyEdited(false);
      loadPlans();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || err.message || 'Failed to create plan.');
    } finally {
      setIsCreating(false);
    }
  };

  // Open Edit Plan Modal (reloads fresh state from backend)
  const handleOpenEdit = async (plan: PlanItem) => {
    setEditingPlan(plan);
    setUpdateError(null);
    setIsLoadingEdit(true);
    setIsUpdating(false);

    try {
      const freshPlan = await apiGetPlan(plan.id);
      setEditForm({
        name: freshPlan.name,
        description: freshPlan.description || '',
        durationMonths: freshPlan.durationMonths,
        price: String(freshPlan.price),
        isActive: freshPlan.isActive,
      });
    } catch (err: any) {
      // Fallback to table item if single-fetch fails
      setEditForm({
        name: plan.name,
        description: plan.description || '',
        durationMonths: plan.durationMonths,
        price: String(plan.price),
        isActive: plan.isActive,
      });
    } finally {
      setIsLoadingEdit(false);
    }
  };

  // Submit Edit Plan
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setUpdateError(null);

    const trimmedName = editForm.name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setUpdateError('Plan name must be at least 2 characters.');
      return;
    }
    const duration = Number(editForm.durationMonths);
    if (!Number.isInteger(duration) || duration < 1) {
      setUpdateError('Duration must be a positive whole number of months (minimum 1).');
      return;
    }
    const priceStr = String(editForm.price).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(priceStr) || Number(priceStr) < 0) {
      setUpdateError('Price must be a valid non-negative number with at most 2 decimal places.');
      return;
    }

    try {
      setIsUpdating(true);
      await apiUpdatePlan(editingPlan.id, {
        name: trimmedName,
        description: editForm.description.trim() || null,
        durationMonths: duration,
        price: priceStr,
        isActive: editForm.isActive,
      });

      setEditingPlan(null);
      loadPlans();
    } catch (err: any) {
      setUpdateError(err.response?.data?.message || err.message || 'Failed to update plan.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Open Details Drawer
  const handleOpenDetails = async (planId: string) => {
    setIsDrawerOpen(true);
    setIsLoadingDrawer(true);
    try {
      const detail = await apiGetPlan(planId);
      setSelectedPlanDetail(detail);
    } catch (err) {
      console.error('Failed to load plan details:', err);
    } finally {
      setIsLoadingDrawer(false);
    }
  };

  // Open Activate/Deactivate Confirmation Modal
  const handleOpenConfirmModal = (plan: PlanItem, action: 'activate' | 'deactivate') => {
    setConfirmModal({
      isOpen: true,
      plan,
      action,
      isSubmitting: false,
      error: null,
    });
  };

  // Submit Activate/Deactivate
  const handleConfirmAction = async () => {
    if (!confirmModal.plan) return;
    setConfirmModal((prev) => ({ ...prev, isSubmitting: true, error: null }));

    try {
      if (confirmModal.action === 'activate') {
        await apiActivatePlan(confirmModal.plan.id);
      } else {
        await apiDeactivatePlan(confirmModal.plan.id);
      }
      setConfirmModal({ isOpen: false, plan: null, action: 'deactivate', isSubmitting: false, error: null });
      loadPlans();
    } catch (err: any) {
      setConfirmModal((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err.response?.data?.message || err.message || 'Status transition failed.',
      }));
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Subscription Plans</h1>
          <p className="text-xs text-[#7C8A9A] mt-1">
            Configure dynamic institutional subscription tiers, duration limits, and pricing authority.
          </p>
        </div>
        <button
          onClick={() => {
            setIsCreateOpen(true);
            setCreateError(null);
            setCodeManuallyEdited(false);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FFD978] hover:bg-[#ffe18f] text-[#0F172A] rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs min-h-[44px] w-full sm:w-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Plan</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E7E9EE] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('plans')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'plans'
              ? 'bg-[#0F172A] text-white shadow-xs'
              : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>All Plans</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
              activeTab === 'plans' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {kpis.totalPlans}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'matrix'
              ? 'bg-[#0F172A] text-white shadow-xs'
              : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-slate-100'
          }`}
        >
          <Table2 className="w-4 h-4" />
          <span>Feature Comparison Matrix</span>
        </button>
      </div>

      {activeTab === 'matrix' ? (
        <PlanComparisonMatrix
          onManagePlanFeatures={(p) => setFeatureModalState({ isOpen: true, plan: p as PlanItem })}
          onRefreshTrigger={matrixRefreshTrigger}
        />
      ) : (
        <>
          {/* 2. Global KPI Cards (Independent of Search / Status Filters) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total Plans */}
            <div className="bg-white rounded-2xl border border-[#E7E9EE] p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7C8A9A]">Total Plans</span>
            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            {isLoading ? (
              <div className="h-7 w-16 bg-slate-100 animate-pulse rounded-md" />
            ) : (
              <span className="text-2xl font-bold text-[#0F172A]">{kpis.totalPlans}</span>
            )}
            <p className="text-[11px] text-[#7C8A9A] mt-0.5">Platform subscription catalog</p>
          </div>
        </div>

        {/* Active Plans */}
        <div className="bg-white rounded-2xl border border-[#E7E9EE] p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7C8A9A]">Active Plans</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-[#37C6A3]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            {isLoading ? (
              <div className="h-7 w-16 bg-slate-100 animate-pulse rounded-md" />
            ) : (
              <span className="text-2xl font-bold text-[#0F172A]">{kpis.activePlans}</span>
            )}
            <p className="text-[11px] text-[#7C8A9A] mt-0.5">Selectable for onboarding/renewal</p>
          </div>
        </div>

        {/* Inactive Plans */}
        <div className="bg-white rounded-2xl border border-[#E7E9EE] p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7C8A9A]">Inactive Plans</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
              <PauseCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            {isLoading ? (
              <div className="h-7 w-16 bg-slate-100 animate-pulse rounded-md" />
            ) : (
              <span className="text-2xl font-bold text-[#0F172A]">{kpis.inactivePlans}</span>
            )}
            <p className="text-[11px] text-[#7C8A9A] mt-0.5">Archived or disabled tiers</p>
          </div>
        </div>

        {/* Effective Active Subscriptions */}
        <div className="bg-white rounded-2xl border border-[#E7E9EE] p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7C8A9A]">Active Subscriptions</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-[#37C6A3]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            {isLoading ? (
              <div className="h-7 w-16 bg-slate-100 animate-pulse rounded-md" />
            ) : (
              <span className="text-2xl font-bold text-[#0F172A]">{kpis.activeSubscriptions}</span>
            )}
            <p className="text-[11px] text-[#7C8A9A] mt-0.5">Current non-suspended terms</p>
          </div>
        </div>

        {/* Institutions Using Plans */}
        <div className="bg-white rounded-2xl border border-[#E7E9EE] p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#7C8A9A]">Institutions Enrolled</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-[#0F172A]">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            {isLoading ? (
              <div className="h-7 w-16 bg-slate-100 animate-pulse rounded-md" />
            ) : (
              <span className="text-2xl font-bold text-[#0F172A]">{kpis.institutionsUsingPlans}</span>
            )}
            <p className="text-[11px] text-[#7C8A9A] mt-0.5">Tenants on active plans</p>
          </div>
        </div>
      </div>

      {/* 3. Filter and Search Controls */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#7C8A9A] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search plans by name, code, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-[#E7E9EE] bg-[#F7F6F1] focus:bg-white focus:outline-none focus:border-[#37C6A3] text-[#0F172A] transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7C8A9A] hover:text-[#0F172A] p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center bg-[#F7F6F1] p-1 rounded-xl border border-[#E7E9EE]">
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  statusFilter === status
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-[#7C8A9A] hover:text-[#0F172A]'
                }`}
              >
                {status === 'ALL' ? 'All Plans' : status === 'ACTIVE' ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>

          <div className="text-xs font-medium text-[#7C8A9A] pl-2 border-l border-[#E7E9EE] whitespace-nowrap">
            {plans.length} {plans.length === 1 ? 'plan' : 'plans'}
          </div>
        </div>
      </div>

      {/* 4. Plan Listing (Responsive: Desktop Table + Mobile Card Grid) */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 gap-3 bg-white rounded-2xl border border-[#E7E9EE]">
          <Loader2 className="w-7 h-7 animate-spin text-[#37C6A3]" />
          <p className="text-xs text-[#7C8A9A]">Loading subscription plans...</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-[#E7E9EE] space-y-2">
          <Layers className="w-8 h-8 text-[#7C8A9A] mx-auto opacity-50" />
          <h3 className="text-sm font-semibold text-[#0F172A]">No subscription plans found</h3>
          <p className="text-xs text-[#7C8A9A] max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'ALL'
              ? 'No plans match the applied search query or status filter.'
              : 'No subscription plans have been created yet. Click "Create Plan" to define the first plan.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Data Table */}
          <div className="hidden md:block bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E7E9EE] bg-[#F7F6F1]/50 text-[11px] font-semibold text-[#7C8A9A] uppercase tracking-wider">
                    <th className="py-3.5 px-4">Plan Name & Code</th>
                    <th className="py-3.5 px-4">Cycle & Price</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-center">Features</th>
                    <th className="py-3.5 px-4 text-center">Active Subscriptions</th>
                    <th className="py-3.5 px-4 text-center">Institutions</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E9EE] text-xs text-[#0F172A]">
                  {plans.map((plan) => {
                    const priceNum = Number(plan.price);
                    const formattedPrice = isNaN(priceNum) ? '$0.00' : `$${priceNum.toFixed(2)}`;

                    return (
                      <tr key={plan.id} className="hover:bg-[#F7F6F1]/40 transition">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-[#0F172A]">{plan.name}</span>
                            <span className="font-mono text-[10px] font-bold text-[#7C8A9A] bg-[#F7F6F1] px-2 py-0.5 rounded-md border border-[#E7E9EE]">
                              {plan.code}
                            </span>
                          </div>
                          {plan.description && (
                            <p className="text-[11px] text-[#7C8A9A] mt-0.5 line-clamp-1 max-w-md">
                              {plan.description}
                            </p>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-bold text-sm text-[#0F172A]">{formattedPrice}</div>
                          <div className="text-[11px] text-[#7C8A9A]">
                            / {plan.durationMonths} {plan.durationMonths === 1 ? 'month' : 'months'}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              plan.isActive
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                plan.isActive ? 'bg-[#37C6A3]' : 'bg-slate-400'
                              }`}
                            />
                            {plan.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setFeatureModalState({ isOpen: true, plan })}
                            title="Manage Dynamic Feature Entitlements"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold cursor-pointer transition"
                          >
                            <Sliders className="w-3 h-3 text-[#059669]" />
                            <span>{plan.featuresCount ?? (plan.assignedFeatureKeys?.length ?? (plan.planFeatures?.length ?? 0))}</span>
                            <span className="text-[10px] text-emerald-600 font-normal">/ 61</span>
                          </button>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-[#F7F6F1] font-semibold text-xs text-[#0F172A]">
                            {plan.activeSubscriptionsCount ?? 0}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-[#F7F6F1] font-semibold text-xs text-[#0F172A]">
                            {plan.institutionsCount ?? 0}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Manage Features */}
                            <button
                              onClick={() => setFeatureModalState({ isOpen: true, plan })}
                              title="Manage Feature Entitlements"
                              className="p-1.5 text-[#059669] hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                            >
                              <Sliders className="w-4 h-4" />
                            </button>

                            {/* View Details */}
                            <button
                              onClick={() => handleOpenDetails(plan.id)}
                              title="View Plan Details & Audit History"
                              className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1] rounded-lg transition cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Edit Plan */}
                            <button
                              onClick={() => handleOpenEdit(plan)}
                              title="Edit Plan Specifications"
                              className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1] rounded-lg transition cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Toggle Active */}
                            <button
                              onClick={() =>
                                handleOpenConfirmModal(plan, plan.isActive ? 'deactivate' : 'activate')
                              }
                              title={plan.isActive ? 'Deactivate Plan' : 'Reactivate Plan'}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                plan.isActive
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {plan.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card Grid (< 768px) */}
          <div className="block md:hidden space-y-3">
            {plans.map((plan) => {
              const priceNum = Number(plan.price);
              const formattedPrice = isNaN(priceNum) ? '$0.00' : `$${priceNum.toFixed(2)}`;

              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-2xl border p-4 shadow-xs space-y-3 transition ${
                    plan.isActive ? 'border-[#E7E9EE]' : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-[#0F172A]">{plan.name}</h3>
                      <span className="inline-block mt-0.5 font-mono text-[10px] font-bold text-[#7C8A9A] bg-[#F7F6F1] px-2 py-0.5 rounded border border-[#E7E9EE]">
                        {plan.code}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        plan.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {plan.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>

                  {plan.description && (
                    <p className="text-xs text-[#7C8A9A] line-clamp-2">{plan.description}</p>
                  )}

                  <div className="flex items-baseline gap-1 pt-2 border-t border-[#E7E9EE]">
                    <span className="text-xl font-bold text-[#0F172A]">{formattedPrice}</span>
                    <span className="text-xs text-[#7C8A9A]">
                      / {plan.durationMonths} {plan.durationMonths === 1 ? 'month' : 'months'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-[#F7F6F1] p-2.5 rounded-xl text-center">
                    <div>
                      <div className="text-[10px] text-[#7C8A9A] font-medium">Features</div>
                      <div className="font-bold text-xs text-[#059669]">
                        {plan.featuresCount ?? (plan.assignedFeatureKeys?.length ?? (plan.planFeatures?.length ?? 0))} / 61
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#7C8A9A] font-medium">Active Subs</div>
                      <div className="font-bold text-xs text-[#0F172A]">
                        {plan.activeSubscriptionsCount ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#7C8A9A] font-medium">Institutions</div>
                      <div className="font-bold text-xs text-[#0F172A]">
                        {plan.institutionsCount ?? 0}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#E7E9EE]">
                    <button
                      onClick={() => setFeatureModalState({ isOpen: true, plan })}
                      className="py-2 px-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1 min-h-[44px]"
                      title="Manage Features"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Features</span>
                    </button>
                    <button
                      onClick={() => handleOpenDetails(plan.id)}
                      className="py-2 px-1 bg-[#F7F6F1] hover:bg-[#E7E9EE] text-[#0F172A] rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1 min-h-[44px]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>
                    <button
                      onClick={() => handleOpenEdit(plan)}
                      className="py-2 px-1 bg-[#F7F6F1] hover:bg-[#E7E9EE] text-[#0F172A] rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1 min-h-[44px]"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() =>
                        handleOpenConfirmModal(plan, plan.isActive ? 'deactivate' : 'activate')
                      }
                      className={`py-2 px-1 rounded-xl text-[11px] font-semibold transition cursor-pointer min-h-[44px] ${
                        plan.isActive
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {plan.isActive ? 'Deact' : 'Act'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  )}

      {/* 5. Plan Detail Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between border-l border-[#E7E9EE] animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#E7E9EE] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-700">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#0F172A]">Plan Details</h3>
                  <p className="text-[11px] text-[#7C8A9A]">Specification and adoption metrics</p>
                </div>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-6 text-xs text-[#0F172A]">
              {isLoadingDrawer || !selectedPlanDetail ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-[#37C6A3]" />
                  <p className="text-xs text-[#7C8A9A]">Loading plan details...</p>
                </div>
              ) : (
                <>
                  {/* Identity Badge */}
                  <div className="bg-[#F7F6F1] p-4 rounded-2xl border border-[#E7E9EE] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#7C8A9A] uppercase">
                        {selectedPlanDetail.code}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          selectedPlanDetail.isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {selectedPlanDetail.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-[#0F172A]">{selectedPlanDetail.name}</h2>
                    <p className="text-xs text-[#7C8A9A]">
                      {selectedPlanDetail.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Pricing and Cycle */}
                  <div>
                    <h4 className="font-semibold text-xs text-[#7C8A9A] uppercase tracking-wider mb-2">
                      Pricing & Duration
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-white border border-[#E7E9EE] rounded-xl">
                        <div className="text-[11px] text-[#7C8A9A] flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" /> Price
                        </div>
                        <div className="text-sm font-bold text-[#0F172A] mt-1">
                          ${Number(selectedPlanDetail.price).toFixed(2)}
                        </div>
                      </div>
                      <div className="p-3 bg-white border border-[#E7E9EE] rounded-xl">
                        <div className="text-[11px] text-[#7C8A9A] flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Duration
                        </div>
                        <div className="text-sm font-bold text-[#0F172A] mt-1">
                          {selectedPlanDetail.durationMonths}{' '}
                          {selectedPlanDetail.durationMonths === 1 ? 'month' : 'months'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Usage & Adoption Stats */}
                  <div>
                    <h4 className="font-semibold text-xs text-[#7C8A9A] uppercase tracking-wider mb-2">
                      Adoption & Usage
                    </h4>
                    <div className="grid grid-cols-3 gap-2 bg-[#F7F6F1] p-3 rounded-2xl border border-[#E7E9EE] text-center">
                      <div>
                        <div className="text-[10px] text-[#7C8A9A] font-medium">Effective Active</div>
                        <div className="text-base font-bold text-[#0F172A] mt-0.5">
                          {selectedPlanDetail.activeSubscriptionsCount ?? 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#7C8A9A] font-medium">Institutions</div>
                        <div className="text-base font-bold text-[#0F172A] mt-0.5">
                          {selectedPlanDetail.institutionsCount ?? 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#7C8A9A] font-medium">Total Lifetime</div>
                        <div className="text-base font-bold text-[#0F172A] mt-0.5">
                          {selectedPlanDetail.totalSubscriptionsCount ?? 0}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Feature Entitlements */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-xs text-[#7C8A9A] uppercase tracking-wider flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-[#059669]" />
                        <span>Feature Entitlements</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setFeatureModalState({ isOpen: true, plan: selectedPlanDetail });
                        }}
                        className="text-[11px] font-semibold text-[#059669] hover:text-emerald-800 underline cursor-pointer"
                      >
                        Manage Features
                      </button>
                    </div>

                    <div className="bg-[#F7F6F1] p-3.5 rounded-2xl border border-[#E7E9EE] space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#0F172A]">
                          {selectedPlanDetail.featuresCount ?? (selectedPlanDetail.assignedFeatureKeys?.length ?? (selectedPlanDetail.planFeatures?.length ?? 0))} of 61 Implemented Assigned
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700">
                          <Lock className="w-2.5 h-2.5" />
                          20 Core Platform
                        </span>
                      </div>

                      {selectedPlanDetail.assignedFeatureKeys && selectedPlanDetail.assignedFeatureKeys.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pt-1">
                          {selectedPlanDetail.assignedFeatureKeys.map((key) => (
                            <span
                              key={key}
                              className="font-mono text-[10px] bg-white px-2 py-0.5 rounded-md border border-[#E7E9EE] text-[#0F172A]"
                            >
                              {key}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#7C8A9A] italic">
                          No features assigned yet. Tenants on this tier will have access to core platform capabilities only.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Audit Activity Log */}
                  <div>
                    <h4 className="font-semibold text-xs text-[#7C8A9A] uppercase tracking-wider mb-2 flex items-center gap-1">
                      <History className="w-3.5 h-3.5" /> Recent Activity Logs
                    </h4>
                    {!selectedPlanDetail.recentActivity || selectedPlanDetail.recentActivity.length === 0 ? (
                      <div className="p-4 bg-[#F7F6F1] rounded-xl text-center text-[#7C8A9A] text-xs">
                        No activity records logged for this plan yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedPlanDetail.recentActivity.map((log) => (
                          <div
                            key={log.id}
                            className="p-3 bg-white border border-[#E7E9EE] rounded-xl space-y-1 shadow-2xs"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-[#0F172A]">{log.action}</span>
                              <span className="text-[#7C8A9A]">
                                {new Date(log.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            {log.user && (
                              <div className="text-[10px] text-[#7C8A9A]">
                                By: <strong className="text-[#0F172A]">{log.user.name}</strong> ({log.user.email})
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#E7E9EE] bg-[#F7F6F1] flex items-center justify-end">
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="px-4 py-2 bg-white hover:bg-[#E7E9EE] text-[#0F172A] rounded-xl text-xs font-semibold border border-[#E7E9EE] cursor-pointer transition min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Create Plan Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#E7E9EE] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E9EE]">
              <h3 className="font-bold text-base text-[#0F172A]">Create Subscription Plan</h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              {/* Name */}
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">
                  Plan Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Institutional Annual"
                  value={createForm.name}
                  onChange={(e) => handleNameChangeOnCreate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl focus:border-[#37C6A3] focus:outline-none"
                />
              </div>

              {/* Code */}
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">
                  Plan Code <span className="text-red-500">*</span>{' '}
                  <span className="text-[10px] font-normal text-[#7C8A9A]">
                    (authoritative uppercase unique identifier)
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. STANDARD_ANNUAL"
                  value={createForm.code}
                  onChange={(e) => {
                    setCodeManuallyEdited(true);
                    setCreateForm({ ...createForm, code: e.target.value.toUpperCase() });
                  }}
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl focus:border-[#37C6A3] focus:outline-none font-mono text-xs"
                />
              </div>

              {/* Duration Months (Presets + Custom input) */}
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">
                  Duration (Months) <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                  {DURATION_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, durationMonths: p })}
                      className={`py-1.5 rounded-xl font-semibold text-xs border transition cursor-pointer ${
                        Number(createForm.durationMonths) === p
                          ? 'bg-[#0F172A] text-white border-[#0F172A]'
                          : 'bg-[#F7F6F1] text-[#0F172A] border-[#E7E9EE] hover:bg-[#E7E9EE]'
                      }`}
                    >
                      {p} {p === 1 ? 'Month' : 'Months'}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="Or enter custom duration in months"
                  value={createForm.durationMonths}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, durationMonths: parseInt(e.target.value, 10) || 1 })
                  }
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl focus:border-[#37C6A3] focus:outline-none"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">
                  Price ($) <span className="text-red-500">*</span>{' '}
                  <span className="text-[10px] font-normal text-[#7C8A9A]">
                    (decimal-safe non-negative; 0 for free tiers)
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5000.00 or 0"
                  value={createForm.price}
                  onChange={(e) => setCreateForm({ ...createForm, price: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl focus:border-[#37C6A3] focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">
                  Description <span className="text-[10px] font-normal text-[#7C8A9A]">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief description of who this plan is tailored for..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl focus:border-[#37C6A3] focus:outline-none resize-none"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="create-isActive"
                  checked={createForm.isActive}
                  onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                  className="rounded border-[#E7E9EE] text-[#37C6A3] focus:ring-[#37C6A3] cursor-pointer"
                />
                <label htmlFor="create-isActive" className="font-semibold text-[#0F172A] cursor-pointer">
                  Immediately active for tenant selection and onboarding
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E7E9EE]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isCreating}
                  className="px-4 py-2 border border-[#E7E9EE] text-[#7C8A9A] hover:bg-slate-50 rounded-xl font-semibold transition cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-[#FFD978] hover:bg-[#ffe18f] text-[#0F172A] rounded-xl font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs min-h-[44px]"
                >
                  {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{isCreating ? 'Creating Plan...' : 'Create Plan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#E7E9EE] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E9EE]">
              <div>
                <h3 className="font-bold text-base text-[#0F172A]">Edit Subscription Plan</h3>
                <span className="font-mono text-xs font-semibold text-[#7C8A9A]">{editingPlan.code}</span>
              </div>
              <button
                onClick={() => setEditingPlan(null)}
                className="p-1 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Snapshot Disclaimer Notice */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 text-amber-900 text-[11px] rounded-xl flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <span>
                <strong>Subscription Snapshot Invariance:</strong> Editing price or duration applies only to
                future onboarding approvals and renewals. Existing tenant subscriptions retain their historical
                snapshot terms and price.
              </span>
            </div>

            {updateError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{updateError}</span>
              </div>
            )}

            {isLoadingEdit ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#37C6A3]" />
                <p className="text-xs text-[#7C8A9A]">Loading latest plan state...</p>
              </div>
            ) : (
              <form onSubmit={handleUpdateSubmit} className="space-y-4 text-xs">
                {/* Code (Immutable) */}
                <div>
                  <label className="block font-semibold text-[#7C8A9A] mb-1">Plan Code (Immutable)</label>
                  <input
                    type="text"
                    disabled
                    value={editingPlan.code}
                    className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl bg-slate-100 text-slate-600 font-mono text-xs cursor-not-allowed"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">
                    Plan Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl focus:border-[#37C6A3] focus:outline-none"
                  />
                </div>

                {/* Duration Months */}
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">
                    Duration (Months) <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    {DURATION_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, durationMonths: p })}
                        className={`py-1.5 rounded-xl font-semibold text-xs border transition cursor-pointer ${
                          Number(editForm.durationMonths) === p
                            ? 'bg-[#0F172A] text-white border-[#0F172A]'
                            : 'bg-[#F7F6F1] text-[#0F172A] border-[#E7E9EE] hover:bg-[#E7E9EE]'
                        }`}
                      >
                        {p} {p === 1 ? 'Month' : 'Months'}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={editForm.durationMonths}
                    onChange={(e) =>
                      setEditForm({ ...editForm, durationMonths: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl focus:border-[#37C6A3] focus:outline-none"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">
                    Price ($) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl focus:border-[#37C6A3] focus:outline-none"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E7E9EE] rounded-xl focus:border-[#37C6A3] focus:outline-none resize-none"
                  />
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="edit-isActive"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="rounded border-[#E7E9EE] text-[#37C6A3] focus:ring-[#37C6A3] cursor-pointer"
                  />
                  <label htmlFor="edit-isActive" className="font-semibold text-[#0F172A] cursor-pointer">
                    Active for new registrations and renewals
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E7E9EE]">
                  <button
                    type="button"
                    onClick={() => setEditingPlan(null)}
                    disabled={isUpdating}
                    className="px-4 py-2 border border-[#E7E9EE] text-[#7C8A9A] hover:bg-slate-50 rounded-xl font-semibold transition cursor-pointer min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-4 py-2 bg-[#FFD978] hover:bg-[#ffe18f] text-[#0F172A] rounded-xl font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs min-h-[44px]"
                  >
                    {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{isUpdating ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 8. Deactivate / Reactivate Confirmation Modal */}
      {confirmModal.isOpen && confirmModal.plan && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-[#E7E9EE] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E9EE]">
              <h3 className="font-bold text-base text-[#0F172A]">
                {confirmModal.action === 'deactivate' ? 'Deactivate Plan' : 'Reactivate Plan'}
              </h3>
              <button
                onClick={() =>
                  setConfirmModal({ isOpen: false, plan: null, action: 'deactivate', isSubmitting: false, error: null })
                }
                className="p-1 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {confirmModal.error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{confirmModal.error}</span>
              </div>
            )}

            <div className="text-xs text-[#0F172A] space-y-2">
              <p>
                Are you sure you want to{' '}
                <strong>{confirmModal.action === 'deactivate' ? 'deactivate' : 'reactivate'}</strong> the plan{' '}
                <span className="font-bold text-[#0F172A]">"{confirmModal.plan.name}"</span> (
                <span className="font-mono text-[#7C8A9A]">{confirmModal.plan.code}</span>)?
              </p>
              {confirmModal.action === 'deactivate' ? (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px]">
                  <strong>Non-destructive action:</strong> Existing tenants currently subscribed to this plan will
                  retain full access until their term ends. The plan will only be hidden from new registrations and
                  prevented from future renewals.
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-[11px]">
                  This plan will immediately become available again in the Registration Approval Center and for
                  tenant subscription renewals.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E7E9EE]">
              <button
                type="button"
                onClick={() =>
                  setConfirmModal({ isOpen: false, plan: null, action: 'deactivate', isSubmitting: false, error: null })
                }
                disabled={confirmModal.isSubmitting}
                className="px-4 py-2 border border-[#E7E9EE] text-[#7C8A9A] hover:bg-slate-50 rounded-xl font-semibold transition cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={confirmModal.isSubmitting}
                className={`px-4 py-2 rounded-xl font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs min-h-[44px] ${
                  confirmModal.action === 'deactivate'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-[#37C6A3] hover:bg-[#2eb392] text-white'
                }`}
              >
                {confirmModal.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {confirmModal.isSubmitting
                    ? 'Processing...'
                    : confirmModal.action === 'deactivate'
                    ? 'Confirm Deactivation'
                    : 'Confirm Reactivation'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Dynamic Feature Entitlements Modal */}
      <ManagePlanFeaturesModal
        isOpen={featureModalState.isOpen}
        plan={featureModalState.plan}
        categories={catalogueCategories}
        onClose={() => setFeatureModalState({ isOpen: false, plan: null })}
        onSuccess={(result) => {
          loadPlans();
          setMatrixRefreshTrigger((prev) => prev + 1);
          if (selectedPlanDetail && selectedPlanDetail.id === result.planId) {
            apiGetPlan(result.planId).then(setSelectedPlanDetail).catch(console.error);
          }
        }}
      />
    </div>
  );
}
