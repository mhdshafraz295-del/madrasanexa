import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach madrasanexa_token if available
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('madrasanexa_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // For FormData uploads, remove Content-Type header so the browser/Axios sets multipart/form-data with boundary
    if (config.data instanceof FormData && config.headers) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle 401 unauthorized session expiration cleanly
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Only handle 401 on protected requests, ignore login attempts so form errors can display
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('madrasanexa_token');
      // Dispatch custom event to notify AuthContext without circular import
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

// ==========================================
// TYPES & API METHODS
// ==========================================

export interface HealthResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

export interface MadrasaIdentity {
  id: string;
  name: string;
  code: string;
  logoUrl?: string | null;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'MADRASA_ADMIN';
  madrasaId: string | null;
  mustChangePassword?: boolean;
  madrasa?: MadrasaIdentity;
}


export interface LoginResponseData {
  accessToken: string;
  user: AuthUser;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const checkHealth = async (): Promise<HealthResponse> => {
  const response = await apiClient.get<HealthResponse>('/health');
  return response.data;
};

export const apiLogin = async (credentials: { email: string; password: string }): Promise<LoginResponseData> => {
  const response = await apiClient.post<ApiResponse<LoginResponseData>>('/auth/login', credentials);
  return response.data.data;
};

export const apiGetMe = async (): Promise<AuthUser> => {
  const response = await apiClient.get<ApiResponse<{ user: AuthUser }>>('/auth/me');
  return response.data.data.user;
};

// ==========================================
// SUBSCRIPTION TYPES & METHODS
// ==========================================

export type SubscriptionAccessCode =
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'SUBSCRIPTION_REQUIRED'
  | 'SUBSCRIPTION_NOT_STARTED'
  | 'SUBSCRIPTION_CONFLICT';

export interface SubscriptionPlanSummary {
  id: string;
  name: string;
  code: string;
  durationMonths: number;
}

export interface SubscriptionDetails {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  priceAtPurchase?: string | number;
  durationMonthsAtPurchase?: number;
  renewedAt?: string | null;
  plan?: SubscriptionPlanSummary | null;
}

export interface SubscriptionSummary {
  allowed: boolean;
  code: SubscriptionAccessCode;
  status: string;
  daysRemaining: number;
  reason: string | null;
  subscription: SubscriptionDetails | null;
}

export const apiGetMySubscription = async (): Promise<SubscriptionSummary> => {
  const response = await apiClient.get<ApiResponse<SubscriptionSummary>>('/subscriptions/me');
  return response.data.data;
};

// ==========================================
// PHASE 6: ONBOARDING, PASSWORD & SUPER ADMIN
// ==========================================

export interface PublicOnboardingPayload {
  madrasaName: string;
  contactName: string;
  email: string;
  phone: string;
  whatsappNumber?: string;
  district?: string;
  address?: string;
  expectedStudentCount?: number;
  message?: string;
  website?: string;
}

export const apiSubmitOnboardingRequest = async (
  payload: PublicOnboardingPayload
): Promise<{ id: string; message: string }> => {
  const response = await apiClient.post<ApiResponse<{ id: string }>>('/onboarding/requests', payload);
  return {
    id: response.data.data.id,
    message: response.data.message || 'Onboarding request submitted successfully.',
  };
};

export const apiChangePassword = async (payload: {
  currentPassword?: string;
  newPassword: string;
}): Promise<{ message: string }> => {
  const response = await apiClient.post<ApiResponse<null>>('/auth/change-password', payload);
  return { message: response.data.message || 'Password changed successfully.' };
};

// --- Super Admin Dashboard & Onboarding Types ---

export type OnboardingEmailStatus = 'NOT_SENT' | 'SENT' | 'FAILED' | 'NOT_CONFIGURED';

export interface OnboardingTimelineItem {
  action: string;
  title: string;
  date: string;
  actor?: string;
  notes?: string;
}

export interface OnboardingRequestItem {
  id: string;
  madrasaName: string;
  contactName: string;
  email: string;
  phone: string;
  whatsappNumber?: string | null;
  district?: string | null;
  address?: string | null;
  expectedStudentCount?: number | null;
  message?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  reviewedByUser?: { id: string; name: string } | null;
  approvedMadrasaId?: string | null;
  approvedMadrasa?: { id: string; name: string; code: string } | null;
  planName?: string | null;
  emailStatus?: OnboardingEmailStatus;
  emailSentAt?: string | null;
  emailError?: string | null;
  timeline?: OnboardingTimelineItem[];
  subscription?: any;
  createdAt: string;
  updatedAt?: string;
}

export interface OnboardingKpiData {
  pending: number;
  approved: number;
  rejected: number;
  activeMadrasas: number;
}

export interface ChartInstitutionGrowthItem {
  month: string;
  label: string;
  institutions: number;
}

export interface ChartSubscriptionRevenueItem {
  month: string;
  label: string;
  revenue: number;
}

export interface ChartSubscriptionStatusItem {
  status: string;
  label: string;
  count: number;
}

export interface ChartPlanDistributionItem {
  planId: string;
  planName: string;
  institutionCount: number;
}

export interface SuperAdminDashboardCharts {
  institutionGrowth: ChartInstitutionGrowthItem[];
  subscriptionRevenue: ChartSubscriptionRevenueItem[];
  subscriptionStatus: ChartSubscriptionStatusItem[];
  planDistribution: ChartPlanDistributionItem[];
}

export interface SuperAdminDashboardMetrics {
  counts: {
    totalMadrasas: number;
    activeMadrasas: number;
    suspendedMadrasas: number;
    archivedMadrasas: number;
    pendingOnboardings: number;
    pendingBankSubmissions?: number;
    activeSubscriptions: number;
    expiringSoonSubscriptions: number;
    totalPlans: number;
  };
  financials: {
    totalCollected: number;
  };
  bankSubmissions?: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  pendingOnboardingsList: OnboardingRequestItem[];
  recentMadrasas: Array<{
    id: string;
    name: string;
    code: string;
    status: string;
    createdAt: string;
    subscriptionSummary?: {
      code: string;
      status: string;
      daysRemaining: number;
    };
  }>;
  charts?: SuperAdminDashboardCharts;
}

export const apiGetSuperAdminDashboard = async (options?: {
  period?: '6m' | '12m';
  signal?: AbortSignal;
}): Promise<SuperAdminDashboardMetrics> => {
  const response = await apiClient.get<ApiResponse<SuperAdminDashboardMetrics>>('/super-admin/dashboard', {
    params: options?.period ? { period: options.period } : undefined,
    signal: options?.signal,
  });
  return response.data.data;
};

export const apiListOnboardings = async (params?: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  requests: OnboardingRequestItem[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
  kpi: OnboardingKpiData;
}> => {
  const response = await apiClient.get<ApiResponse<any>>('/super-admin/onboarding', { params });
  return response.data.data;
};

export const apiGetOnboardingById = async (id: string): Promise<OnboardingRequestItem> => {
  const response = await apiClient.get<ApiResponse<OnboardingRequestItem>>(`/super-admin/onboarding/${id}`);
  return response.data.data;
};

export interface ApproveOnboardingPayload {
  madrasaCode: string;
  madrasaSlug: string;
  madrasaName?: string;
  adminName?: string;
  adminEmail?: string;
  planId: string;
  startsAt?: string;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
  paymentReference?: string;
  paymentNotes?: string;
  recordInitialPayment?: boolean;
  temporaryPassword?: string;
}

export interface ApproveOnboardingResult {
  madrasa: { id: string; name: string; code: string; slug: string };
  adminUser: { id: string; name: string; email: string; role: string; temporaryPassword?: string; mustChangePassword: boolean };
  subscription: any;
  emailDelivery?: {
    status: OnboardingEmailStatus;
    error?: string | null;
    sentAt?: string | null;
  };
}

export const apiApproveOnboarding = async (
  id: string,
  payload: ApproveOnboardingPayload
): Promise<ApproveOnboardingResult> => {
  const response = await apiClient.post<ApiResponse<ApproveOnboardingResult>>(
    `/super-admin/onboarding/${id}/approve`,
    payload
  );
  return response.data.data;
};

export const apiRejectOnboarding = async (
  id: string,
  rejectionReason: string
): Promise<{ id: string; status: string; rejectionReason: string }> => {
  const response = await apiClient.post<ApiResponse<any>>(`/super-admin/onboarding/${id}/reject`, {
    rejectionReason,
  });
  return response.data.data;
};

export const apiResendApprovalEmail = async (
  id: string
): Promise<{
  success: boolean;
  message: string;
  data: {
    success: boolean;
    emailDelivery: {
      status: OnboardingEmailStatus;
      error?: string | null;
      sentAt?: string | null;
    };
  };
}> => {
  const response = await apiClient.post<ApiResponse<any>>(
    `/super-admin/onboarding/${id}/resend-email`,
    {},
    { timeout: 20000 }
  );
  return response.data as any;
};

export interface SetupTokenVerificationData {
  valid: boolean;
  email: string;
  name: string;
  madrasaName?: string | null;
}

export const apiVerifySetupToken = async (
  token: string
): Promise<SetupTokenVerificationData> => {
  const response = await apiClient.get<ApiResponse<SetupTokenVerificationData>>(
    `/auth/setup-password/verify`,
    { params: { token } }
  );
  return response.data.data;
};

export const apiSetupPassword = async (data: {
  token: string;
  password?: string;
  newPassword?: string;
}): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.post<ApiResponse<any>>(`/auth/setup-password`, data);
  return response.data as any;
};

// --- Madrasas & Admin Management ---

export interface MadrasaKpis {
  total: number;
  active: number;
  suspended: number;
  archived: number;
  expiringSoon: number;
}

export interface MadrasaListItem {
  id: string;
  name: string;
  code: string;
  slug: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string | null;
  logoFileId?: string | null;
  logoUrl?: string | null;
  initials?: string;
  adminCount: number;
  primaryAdmin?: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    mustChangePassword: boolean;
    lastLoginAt?: string | null;
    createdAt?: string;
  } | null;
  admins?: Array<{
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    mustChangePassword: boolean;
    lastLoginAt?: string | null;
    createdAt?: string;
  }>;
  activeSubscription?: {
    id: string;
    planId: string;
    status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED';
    startsAt: string;
    endsAt: string;
    priceAtPurchase?: number | string;
    durationMonthsAtPurchase?: number;
    daysRemaining?: number | null;
    plan?: {
      id: string;
      name: string;
      code: string;
      durationMonths: number;
      price: number | string;
    };
  } | null;
  counts?: {
    students: number;
    classes: number;
  };
}

export interface MadrasaDetailItem extends MadrasaListItem {
  settings?: {
    id: string;
    academicYear?: string | null;
    feeGracePeriodDays?: number;
    receiptPrefix?: string | null;
    receiptFooterNotes?: string | null;
    currency?: string;
    timezone?: string;
  } | null;
  branding?: {
    id: string;
    name: string;
    code: string;
    logoUrl?: string | null;
    logoFileId?: string | null;
    initials?: string;
  };
  admins: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    mustChangePassword: boolean;
    lastLoginAt?: string | null;
    createdAt: string;
  }>;
  subscriptions: Array<{
    id: string;
    status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED';
    startsAt: string;
    endsAt: string;
    priceAtPurchase?: number | string;
    durationMonthsAtPurchase?: number;
    daysRemaining?: number | null;
    renewedAt?: string | null;
    plan?: {
      id: string;
      name: string;
      code: string;
      durationMonths: number;
      price: number | string;
    };
  }>;
  usage?: {
    totalStudents: number;
    activeStudents: number;
    classes: number;
    invoices: number;
    payments: number;
  };
  recentActivity?: Array<{
    id: string;
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: any;
    ipAddress?: string | null;
    userAgent?: string | null;
    createdAt: string;
    user?: {
      id: string;
      name: string;
      email: string;
      role: string;
    } | null;
  }>;
}

export const apiListMadrasas = async (
  params?: {
    search?: string;
    status?: string;
    planId?: string;
    subscriptionStatus?: string;
    page?: number;
    pageSize?: number;
  },
  signal?: AbortSignal
): Promise<{
  madrasas: MadrasaListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  kpis?: MadrasaKpis;
}> => {
  const response = await apiClient.get<ApiResponse<any>>('/super-admin/madrasas', { params, signal });
  return {
    ...response.data.data,
    total: response.data.data.pagination?.total ?? response.data.data.total ?? 0,
    page: response.data.data.pagination?.page ?? response.data.data.page ?? 1,
    pageSize: response.data.data.pagination?.pageSize ?? response.data.data.pageSize ?? 10,
    totalPages: response.data.data.pagination?.totalPages ?? response.data.data.totalPages ?? 1,
  };
};

export const apiGetMadrasa = async (id: string, signal?: AbortSignal): Promise<MadrasaDetailItem> => {
  const response = await apiClient.get<ApiResponse<MadrasaDetailItem>>(`/super-admin/madrasas/${id}`, { signal });
  return response.data.data;
};

export const apiUpdateMadrasa = async (
  id: string,
  data: { name?: string; email?: string; phone?: string; address?: string }
): Promise<MadrasaListItem> => {
  const response = await apiClient.patch<ApiResponse<MadrasaListItem>>(`/super-admin/madrasas/${id}`, data);
  return response.data.data;
};

export const apiUpdateMadrasaStatus = async (
  id: string,
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED',
  reason?: string
): Promise<MadrasaListItem> => {
  const response = await apiClient.patch<ApiResponse<MadrasaListItem>>(`/super-admin/madrasas/${id}/status`, {
    status,
    reason,
  });
  return response.data.data;
};

export const apiActivateMadrasa = async (id: string): Promise<MadrasaListItem> => {
  const response = await apiClient.post<ApiResponse<MadrasaListItem>>(`/super-admin/madrasas/${id}/activate`);
  return response.data.data;
};

export const apiSuspendMadrasa = async (id: string): Promise<MadrasaListItem> => {
  const response = await apiClient.post<ApiResponse<MadrasaListItem>>(`/super-admin/madrasas/${id}/suspend`);
  return response.data.data;
};

export const apiArchiveMadrasa = async (id: string): Promise<MadrasaListItem> => {
  const response = await apiClient.post<ApiResponse<MadrasaListItem>>(`/super-admin/madrasas/${id}/archive`);
  return response.data.data;
};

export const apiResetMadrasaAdminPassword = async (
  madrasaId: string,
  adminUserId: string,
  temporaryPassword?: string
): Promise<{ adminUserId: string; email: string; temporaryPassword?: string }> => {
  const response = await apiClient.post<ApiResponse<any>>(
    `/super-admin/madrasas/${madrasaId}/admins/${adminUserId}/reset-password`,
    { temporaryPassword }
  );
  return response.data.data;
};

export const apiToggleMadrasaAdminActive = async (
  madrasaId: string,
  adminUserId: string,
  isActive: boolean
): Promise<{ adminUserId: string; isActive: boolean }> => {
  const response = await apiClient.post<ApiResponse<any>>(
    `/super-admin/madrasas/${madrasaId}/admins/${adminUserId}/toggle-active`,
    { isActive }
  );
  return response.data.data;
};

// --- Plans & Feature Management ---

export type FeatureStatus = 'CORE' | 'IMPLEMENTED' | 'PARTIALLY_IMPLEMENTED' | 'PLANNED';

export interface FeatureCatalogueItem {
  key: string;
  name: string;
  description: string;
  categoryNumber: number;
  categoryName: string;
  category: string;
  status: FeatureStatus;
  isAssignable: boolean;
}

export interface FeatureCategoryGroup {
  number: number;
  name: string;
  label: string;
  features: FeatureCatalogueItem[];
}

export interface FeatureCatalogueSummary {
  totalFeatures: number;
  implemented: number;
  core: number;
  partiallyImplemented: number;
  planned: number;
  totalCategories: number;
}

export interface FeatureCatalogueResponse {
  categories: FeatureCategoryGroup[];
  summary: FeatureCatalogueSummary;
}

export interface PlanFeatureRecord {
  id: string;
  planId?: string;
  featureKey: string;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ComparisonPlanItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  durationMonths: number;
  price: string;
  currency: string;
  isActive: boolean;
  activeSubscriptionsCount: number;
  featuresCount: number;
  featureAvailability: Record<string, boolean>;
}

export interface PlanComparisonResponse {
  plans: ComparisonPlanItem[];
  categories: FeatureCategoryGroup[];
  catalogueStats: {
    totalFeatures: number;
    implemented: number;
    core: number;
    partiallyImplemented: number;
    planned: number;
  };
}

export interface UpdatePlanFeaturesResult {
  planId: string;
  planName: string;
  planCode: string;
  assignedCount: number;
  addedCount: number;
  removedCount: number;
  addedKeys: string[];
  removedKeys: string[];
  assignedFeatureKeys: string[];
  isNoOp: boolean;
}

export interface PlanItem {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  durationMonths: number;
  price: string | number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  activeSubscriptionsCount?: number;
  institutionsCount?: number;
  totalSubscriptionsCount?: number;
  featuresCount?: number;
  assignedFeatureKeys?: string[];
  planFeatures?: PlanFeatureRecord[];
  _count?: { subscriptions: number };
}

export interface PlanKpis {
  totalPlans: number;
  activePlans: number;
  inactivePlans: number;
  activeSubscriptions: number;
  institutionsUsingPlans: number;
}

export interface PlanActivityItem {
  id: string;
  action: string;
  metadata?: any;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export interface PlanDetailItem extends PlanItem {
  disabledFeaturesCount?: number;
  recentActivity?: PlanActivityItem[];
}

export const apiGetFeatureCatalogue = async (signal?: AbortSignal): Promise<FeatureCatalogueResponse> => {
  const response = await apiClient.get<ApiResponse<FeatureCatalogueResponse>>('/super-admin/features', {
    signal,
  });
  return response.data.data;
};

export const apiGetPlanComparison = async (
  params?: { includeInactive?: boolean; planIds?: string[] },
  signal?: AbortSignal
): Promise<PlanComparisonResponse> => {
  const response = await apiClient.get<ApiResponse<PlanComparisonResponse>>('/super-admin/plans/comparison', {
    params: {
      includeInactive: params?.includeInactive,
      planIds: params?.planIds && params.planIds.length > 0 ? params.planIds.join(',') : undefined,
    },
    signal,
  });
  return response.data.data;
};

export const apiListPlans = async (
  params?: { search?: string; status?: 'ALL' | 'ACTIVE' | 'INACTIVE' },
  signal?: AbortSignal
): Promise<PlanItem[]> => {
  const response = await apiClient.get<ApiResponse<PlanItem[]>>('/super-admin/plans', {
    params,
    signal,
  });
  return response.data.data;
};

export const apiGetPlansWorkspace = async (
  params?: { search?: string; status?: 'ALL' | 'ACTIVE' | 'INACTIVE' },
  signal?: AbortSignal
): Promise<{ plans: PlanItem[]; kpis: PlanKpis }> => {
  const response = await apiClient.get<ApiResponse<PlanItem[]> & { kpis: PlanKpis }>('/super-admin/plans', {
    params,
    signal,
  });
  return {
    plans: response.data.data,
    kpis: response.data.kpis,
  };
};

export const apiGetPlan = async (id: string, signal?: AbortSignal): Promise<PlanDetailItem> => {
  const response = await apiClient.get<ApiResponse<PlanDetailItem>>(`/super-admin/plans/${id}`, {
    signal,
  });
  return response.data.data;
};

export const apiCreatePlan = async (payload: {
  name: string;
  code: string;
  description?: string | null;
  durationMonths: number;
  price: number | string;
  isActive?: boolean;
  featureKeys?: string[];
}): Promise<PlanItem> => {
  const response = await apiClient.post<ApiResponse<PlanItem>>('/super-admin/plans', payload);
  return response.data.data;
};

export const apiUpdatePlan = async (
  id: string,
  payload: {
    name?: string;
    description?: string | null;
    durationMonths?: number;
    price?: number | string;
    isActive?: boolean;
  }
): Promise<PlanItem> => {
  const response = await apiClient.patch<ApiResponse<PlanItem>>(`/super-admin/plans/${id}`, payload);
  return response.data.data;
};

export const apiUpdatePlanFeatures = async (
  id: string,
  payload: { featureKeys: string[] }
): Promise<UpdatePlanFeaturesResult> => {
  const response = await apiClient.put<ApiResponse<UpdatePlanFeaturesResult>>(
    `/super-admin/plans/${encodeURIComponent(id)}/features`,
    payload
  );
  return response.data.data;
};

export const apiActivatePlan = async (id: string): Promise<PlanItem> => {
  const response = await apiClient.post<ApiResponse<PlanItem>>(`/super-admin/plans/${id}/activate`);
  return response.data.data;
};

export const apiDeactivatePlan = async (id: string): Promise<PlanItem> => {
  const response = await apiClient.post<ApiResponse<PlanItem>>(`/super-admin/plans/${id}/deactivate`);
  return response.data.data;
};

// --- Subscriptions & Renewals ---

export const apiGetMadrasaSubscriptions = async (madrasaId: string): Promise<any> => {
  const response = await apiClient.get<ApiResponse<any>>(`/super-admin/madrasas/${madrasaId}/subscriptions`);
  return response.data.data;
};

export const apiRenewMadrasaSubscription = async (
  madrasaId: string,
  payload: {
    planId: string;
    paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
    reference?: string;
    notes?: string;
  }
): Promise<any> => {
  const response = await apiClient.post<ApiResponse<any>>(
    `/super-admin/madrasas/${madrasaId}/subscriptions/renew`,
    payload
  );
  return response.data.data;
};

export const apiSuspendSubscription = async (id: string): Promise<any> => {
  const response = await apiClient.post<ApiResponse<any>>(`/super-admin/subscriptions/${id}/suspend`);
  return response.data.data;
};

export const apiCancelSubscription = async (id: string): Promise<any> => {
  const response = await apiClient.post<ApiResponse<any>>(`/super-admin/subscriptions/${id}/cancel`);
  return response.data.data;
};

// --- Activity Logs ---

export interface ActivityLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  performedByUserId?: string | null;
  performedByUser?: { id: string; name: string; email: string } | null;
  madrasaId?: string | null;
  madrasa?: { id: string; name: string; code: string } | null;
  ipAddress?: string | null;
  metadata?: any;
  createdAt: string;
}

export const apiListActivityLogs = async (params?: {
  page?: number;
  pageSize?: number;
  action?: string;
  madrasaId?: string;
}): Promise<{ logs: ActivityLogItem[]; total: number; page: number; pageSize: number; totalPages: number }> => {
  const response = await apiClient.get<ApiResponse<any>>('/super-admin/activity-logs', { params });
  return response.data.data;
};

// ==========================================
// PHASE 7: MADRASA ADMIN WORKSPACE APIS
// ==========================================

export interface MonthlyFeePoint {
  month: string;
  label: string;
  expected: number;
  collected: number;
  pending: number;
}

export interface MonthlyCashPoint {
  month: string;
  label: string;
  collected: number;
}

export interface StudentStatusBreakdown {
  active: number;
  inactive: number;
  archived: number;
}

export interface InvoiceStatusBreakdown {
  pending: number;
  partial: number;
  paid: number;
  overdue: number;
  void: number;
}

export interface TenantActivityItem {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: any;
  createdAt: string;
  user?: { id: string; name: string; email?: string } | null;
}

export interface MadrasaAdminDashboardData {
  kpis: {
    totalStudents: number;
    activeStudents: number;
    activeClasses: number;
    currentMonthExpectedFees: number;
    currentMonthCollectedFees: number;
    currentMonthPendingFees: number;
    totalOutstandingBalance: number;
  };
  subscription: {
    allowed: boolean;
    code: string;
    status: string;
    daysRemaining: number;
    isExpiringSoon: boolean;
    subscription?: {
      id: string;
      startsAt: string;
      endsAt: string;
      plan?: {
        id: string;
        name: string;
        code: string;
        price: number;
        durationMonths: number;
      } | null;
    } | null;
  };
  charts: {
    monthlyFeePerformance: MonthlyFeePoint[];
    monthlyCashCollection: MonthlyCashPoint[];
    studentStatusDistribution: StudentStatusBreakdown;
    invoiceStatusDistribution: InvoiceStatusBreakdown;
  };
  recentActivity: TenantActivityItem[];
  teacherStats?: {
    totalTeachers: number;
    activeTeachers: number;
    ustadhCount: number;
    schoolTeacherCount: number;
    teachersWithClasses: number;
    classesWithTeachers: number;
  };
  academicGroupStats?: {
    totalSections: number;
    sections: Array<{
      id: string;
      name: string;
      code?: string | null;
      classCount: number;
      studentCount: number;
    }>;
  };
}

export interface TenantSettingsData {
  madrasa: {
    id: string;
    name: string;
    code: string;
    slug: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    status: string;
    logoFileId?: string | null;
    logoUrl?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  settings: {
    id: string;
    invoicePrefix: string;
    receiptPrefix: string;
    currency: string;
    timezone: string;
    academicYear?: string | null;
    receiptHeader?: string | null;
    receiptFooter?: string | null;
    dateFormat?: string;
    timeFormat?: string;
    workingHoursStart?: string;
    workingHoursEnd?: string;
    workingDays?: string[];
    weeklyHolidays?: string[];
    attendanceStartTime?: string;
    attendanceClosingTime?: string;
    lateMarkingTime?: string;
    attendanceGracePeriodMinutes?: number;
    autoAttendanceClosing?: boolean;
    timetableSlotDurationMinutes?: number;
    updatedAt: string;
  };
}

export interface AdminProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSubscriptionOverview {
  currentAccess: {
    allowed: boolean;
    code: string;
    status: string;
    daysRemaining: number;
    isExpiringSoon: boolean;
    subscription?: {
      id: string;
      status: string;
      startsAt: string;
      endsAt: string;
      priceAtPurchase: number;
      durationMonthsAtPurchase: number;
      plan?: {
        id: string;
        name: string;
        code: string;
      } | null;
    } | null;
  };
  terms: Array<{
    id: string;
    status: string;
    startsAt: string;
    endsAt: string;
    priceAtPurchase: number;
    durationMonthsAtPurchase: number;
    renewedAt?: string | null;
    createdAt: string;
    plan: {
      id: string;
      name: string;
      code: string;
    };
  }>;
  payments: Array<{
    id: string;
    amount: number;
    paymentMethod: string;
    reference?: string | null;
    paidAt: string;
    subscriptionId: string;
    planName: string;
  }>;
}

export const apiGetMadrasaAdminDashboard = async (
  range: string = '12m'
): Promise<MadrasaAdminDashboardData> => {
  const response = await apiClient.get<ApiResponse<MadrasaAdminDashboardData>>(
    '/madrasa-admin/dashboard',
    { params: { range } }
  );
  return response.data.data;
};

export const apiGetMadrasaSettings = async (): Promise<TenantSettingsData> => {
  const response = await apiClient.get<ApiResponse<TenantSettingsData>>('/madrasa-admin/settings');
  return response.data.data;
};

export const apiUpdateMadrasaSettings = async (
  data: Partial<TenantSettingsData['madrasa']> & Partial<TenantSettingsData['settings']>
): Promise<TenantSettingsData> => {
  const response = await apiClient.patch<ApiResponse<TenantSettingsData>>('/madrasa-admin/settings', data);
  return response.data.data;
};

export const apiGetMadrasaAdminProfile = async (): Promise<AdminProfileData> => {
  const response = await apiClient.get<ApiResponse<AdminProfileData>>('/madrasa-admin/profile');
  return response.data.data;
};

export const apiUpdateMadrasaAdminProfile = async (
  data: { name?: string; email?: string }
): Promise<AdminProfileData> => {
  const response = await apiClient.patch<ApiResponse<AdminProfileData>>('/madrasa-admin/profile', data);
  return response.data.data;
};

export const apiGetMadrasaActivity = async (params?: {
  page?: number;
  pageSize?: number;
  action?: string;
}): Promise<{ logs: TenantActivityItem[]; total: number; page: number; pageSize: number; totalPages: number }> => {
  const response = await apiClient.get<ApiResponse<any>>('/madrasa-admin/activity', { params });
  return response.data.data;
};

export const apiGetMadrasaSubscriptionOverview = async (): Promise<TenantSubscriptionOverview> => {
  const response = await apiClient.get<ApiResponse<TenantSubscriptionOverview>>('/madrasa-admin/subscription');
  return response.data.data;
};

// ==========================================
// MADRASA SUBSCRIPTION PLANS & PAYMENT SUBMISSIONS
// ==========================================

export interface MadrasaSubscriptionPlan {
  id: string;
  name: string;
  code: string;
  description: string | null;
  durationMonths: number;
  price: number;
  isActive: boolean;
}

export interface MadrasaPlatformBankDetails {
  isConfigured: boolean;
  message?: string;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  branch: string | null;
  instructions: string | null;
  updatedAt?: string;
}

export interface MadrasaPaymentSubmissionItem {
  id: string;
  planId: string;
  planName: string;
  planPrice: number;
  planDurationMonths: number;
  submittedAmount: number;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  receipt: {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string | null;
  } | null;
}

export const apiGetMadrasaSubscriptionPlans = async (): Promise<MadrasaSubscriptionPlan[]> => {
  const response = await apiClient.get<ApiResponse<MadrasaSubscriptionPlan[]>>('/madrasa-admin/subscription/plans');
  return response.data.data;
};

export const apiGetMadrasaPlatformBankDetails = async (): Promise<MadrasaPlatformBankDetails> => {
  const response = await apiClient.get<ApiResponse<MadrasaPlatformBankDetails>>('/madrasa-admin/subscription/bank-details');
  return response.data.data;
};

export const apiGetMadrasaPaymentSubmissions = async (): Promise<MadrasaPaymentSubmissionItem[]> => {
  const response = await apiClient.get<ApiResponse<MadrasaPaymentSubmissionItem[]>>('/madrasa-admin/subscription/payment-submissions');
  return response.data.data;
};

export const apiSubmitMadrasaPaymentReceipt = async (formData: FormData): Promise<any> => {
  const response = await apiClient.post<ApiResponse<any>>('/madrasa-admin/subscription/payment-submissions', formData);
  return response.data;
};

export const apiGetMadrasaPaymentSubmissionReceipt = async (
  submissionId: string
): Promise<{ id: string; submissionId: string; url: string; expiresIn: number; originalName: string; mimeType: string; size: number }> => {
  const response = await apiClient.get<ApiResponse<any>>(
    `/madrasa-admin/subscription/payment-submissions/${submissionId}/receipt`
  );
  return response.data.data;
};

// Super Admin Platform Bank Configuration
export interface SuperAdminPlatformBankDetails {
  isConfigured: boolean;
  message?: string;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  branch: string | null;
  instructions: string | null;
  updatedAt?: string;
}

export interface UpdatePlatformBankDetailsPayload {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  instructions?: string | null;
}

export const apiGetSuperAdminPlatformBankDetails = async (): Promise<SuperAdminPlatformBankDetails> => {
  const response = await apiClient.get<ApiResponse<SuperAdminPlatformBankDetails>>('/super-admin/platform-bank-details');
  return response.data.data;
};

export const apiUpdateSuperAdminPlatformBankDetails = async (
  payload: UpdatePlatformBankDetailsPayload
): Promise<SuperAdminPlatformBankDetails> => {
  const response = await apiClient.put<ApiResponse<SuperAdminPlatformBankDetails>>(
    '/super-admin/platform-bank-details',
    payload
  );
  return response.data.data;
};

// ==========================================
// MADRASA INSTITUTION BRANDING & LOGO
// ==========================================

export interface BrandingData {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  logoFileId: string | null;
  initials: string;
}

export interface LogoUploadResult {
  fileId: string;
  logoUrl: string | null;
  size: number;
  mimeType: string;
}

export const apiGetMadrasaBranding = async (): Promise<BrandingData> => {
  const response = await apiClient.get<ApiResponse<BrandingData>>('/madrasa-admin/branding');
  return response.data.data;
};

export const apiUploadMadrasaLogo = async (file: File): Promise<LogoUploadResult> => {
  const formData = new FormData();
  formData.append('logo', file);
  const response = await apiClient.post<ApiResponse<LogoUploadResult>>('/madrasa-admin/branding/logo', formData);
  return response.data.data;
};

export const apiRemoveMadrasaLogo = async (): Promise<void> => {
  await apiClient.delete<ApiResponse<null>>('/madrasa-admin/branding/logo');
};

// ==========================================
// ACADEMIC STRUCTURE: SECTIONS & DYNAMIC CLASSES
// ==========================================

export interface AcademicSectionItem {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  classCount: number;
  studentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicSectionDetail {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  classCount: number;
  activeClassesCount: number;
  inactiveClassesCount: number;
  totalStudents: number;
  classes: Array<{
    id: string;
    name: string;
    code: string | null;
    isActive: boolean;
    status: 'ACTIVE' | 'INACTIVE';
    defaultMonthlyFee: string;
    studentCount: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAcademicSectionPayload {
  name: string;
  code?: string | null;
  description?: string | null;
  sortOrder?: number;
}

export interface UpdateAcademicSectionPayload {
  name?: string;
  code?: string | null;
  description?: string | null;
  sortOrder?: number;
}

export interface ClassItem {
  id: string;
  academicSectionId?: string | null;
  academicSection?: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  sectionName?: string;
  name: string;
  code: string | null;
  description?: string | null;
  defaultMonthlyFee: string;
  isActive?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
  studentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClassDetail extends ClassItem {
  students?: Array<{
    id: string;
    admissionNo: string;
    fullName: string;
    status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
    effectiveFee?: string;
  }>;
}

export interface CreateClassPayload {
  academicSectionId: string;
  name: string;
  code?: string | null;
  description?: string | null;
  defaultMonthlyFee: number | string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface UpdateClassPayload {
  academicSectionId?: string;
  name?: string;
  code?: string | null;
  description?: string | null;
  defaultMonthlyFee?: number | string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface StudentListItem {
  id: string;
  admissionNo: string;
  fullName: string;
  classId: string | null;
  class: {
    id: string;
    name: string;
    code: string | null;
    defaultMonthlyFee?: string | null;
    isActive?: boolean;
    status?: string;
    academicSectionId?: string | null;
    academicSection?: {
      id: string;
      name: string;
      code: string | null;
    } | null;
    sectionName?: string;
  } | null;
  sectionName?: string;
  effectiveMonthlyFee?: string | null;
  effectiveFee?: string | null;
  feeSource: 'CLASS_DEFAULT' | 'STUDENT_OVERRIDE' | 'UNCONFIGURED';
  whatsappNumber?: string | null;
  guardianWhatsapp?: string | null;
  whatsappOptIn?: boolean;
  whatsappNotification?: boolean;
  guardianName: string;
  guardianPhone?: string | null;
  admissionDate?: string;
  joinedAt?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  createdAt: string;
}

export interface StudentFeeHistoryItem {
  id: string;
  monthlyFee?: string;
  amount?: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string | null;
  isCurrent?: boolean;
  createdAt: string;
}

export interface StudentDetail {
  id: string;
  admissionNo: string;
  fullName: string;
  admissionDate?: string;
  joinedAt?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  classId: string | null;
  class: {
    id: string;
    name: string;
    code: string | null;
    defaultMonthlyFee?: string;
    isActive?: boolean;
    status?: string;
    academicSectionId?: string | null;
    academicSection?: {
      id: string;
      name: string;
      code: string | null;
    } | null;
    sectionName?: string;
  } | null;
  sectionName?: string;
  guardianName: string;
  guardianRelationship?: string;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  whatsappNumber?: string | null;
  guardianWhatsapp?: string | null;
  whatsappOptIn?: boolean;
  whatsappNotification?: boolean;
  address?: string | null;
  notes?: string | null;
  effectiveMonthlyFee?: string | null;
  effectiveFee?: string | null;
  feeSource: 'CLASS_DEFAULT' | 'STUDENT_OVERRIDE' | 'UNCONFIGURED';
  activeFeeSetting?: StudentFeeHistoryItem | null;
  feeHistory?: StudentFeeHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentPayload {
  admissionNo: string;
  fullName: string;
  academicSectionId?: string | null;
  admissionDate?: string | null;
  joinedAt?: string | null;
  classId?: string | null;
  monthlyFeeOverride?: number | string | null;
  monthlyFee?: number | string | null;
  guardianName: string;
  guardianRelationship?: string;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  whatsappNumber?: string | null;
  guardianWhatsapp?: string | null;
  whatsappOptIn?: boolean;
  whatsappNotification?: boolean;
  address?: string | null;
  notes?: string | null;
}

export interface UpdateStudentPayload {
  admissionNo?: string;
  fullName?: string;
  academicSectionId?: string | null;
  admissionDate?: string | null;
  joinedAt?: string | null;
  classId?: string | null;
  guardianName?: string;
  guardianRelationship?: string;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  whatsappNumber?: string | null;
  guardianWhatsapp?: string | null;
  whatsappOptIn?: boolean;
  whatsappNotification?: boolean;
  address?: string | null;
  notes?: string | null;
}

export interface SetFeeOverridePayload {
  amount?: number | string;
  monthlyFee?: number | string;
  effectiveFrom: string;
  reason?: string | null;
}

export interface UseClassDefaultPayload {
  effectiveDate: string;
  reason?: string | null;
}

// Class API Methods
export const apiListClasses = async (params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  academicSectionId?: string;
  status?: string;
  isActive?: boolean;
}): Promise<{ items: ClassItem[]; classes: ClassItem[]; total: number; page: number; pageSize: number; totalPages: number }> => {
  const response = await apiClient.get<ApiResponse<any>>('/madrasa-admin/classes', { params });
  const d = response.data.data;
  const items: ClassItem[] = d.items || d.classes || [];
  return {
    ...d,
    items,
    classes: items,
  };
};

export const apiGetClass = async (id: string): Promise<ClassDetail> => {
  const response = await apiClient.get<ApiResponse<any>>(`/madrasa-admin/classes/${id}`);
  const d = response.data.data;
  return d.class || d;
};

export const apiCreateClass = async (payload: CreateClassPayload): Promise<ClassItem> => {
  const response = await apiClient.post<ApiResponse<any>>('/madrasa-admin/classes', payload);
  const d = response.data.data;
  return d.class || d;
};

export const apiUpdateClass = async (id: string, payload: UpdateClassPayload): Promise<ClassItem> => {
  const response = await apiClient.patch<ApiResponse<any>>(`/madrasa-admin/classes/${id}`, payload);
  const d = response.data.data;
  return d.class || d;
};

export const apiActivateClass = async (id: string): Promise<ClassItem> => {
  const response = await apiClient.post<ApiResponse<any>>(`/madrasa-admin/classes/${id}/activate`);
  const d = response.data.data;
  return d.class || d;
};

export const apiDeactivateClass = async (id: string): Promise<ClassItem> => {
  const response = await apiClient.post<ApiResponse<any>>(`/madrasa-admin/classes/${id}/deactivate`);
  const d = response.data.data;
  return d.class || d;
};

// Academic Section API Methods
export const apiListAcademicSections = async (params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  isActive?: boolean;
}): Promise<{ items: AcademicSectionItem[]; sections: AcademicSectionItem[]; total: number; page: number; pageSize: number; totalPages: number }> => {
  const response = await apiClient.get<ApiResponse<any>>('/madrasa-admin/academic-sections', { params });
  const d = response.data.data;
  const items: AcademicSectionItem[] = d.items || d.sections || [];
  return {
    ...d,
    items,
    sections: items,
  };
};

export const apiGetAcademicSection = async (id: string): Promise<AcademicSectionDetail> => {
  const response = await apiClient.get<ApiResponse<any>>(`/madrasa-admin/academic-sections/${id}`);
  const d = response.data.data;
  return d.section || d;
};

export const apiCreateAcademicSection = async (payload: CreateAcademicSectionPayload): Promise<AcademicSectionItem> => {
  const response = await apiClient.post<ApiResponse<any>>('/madrasa-admin/academic-sections', payload);
  const d = response.data.data;
  return d.section || d;
};

export const apiUpdateAcademicSection = async (id: string, payload: UpdateAcademicSectionPayload): Promise<AcademicSectionItem> => {
  const response = await apiClient.patch<ApiResponse<any>>(`/madrasa-admin/academic-sections/${id}`, payload);
  const d = response.data.data;
  return d.section || d;
};

export const apiActivateAcademicSection = async (id: string): Promise<AcademicSectionItem> => {
  const response = await apiClient.post<ApiResponse<any>>(`/madrasa-admin/academic-sections/${id}/activate`);
  const d = response.data.data;
  return d.section || d;
};

export const apiDeactivateAcademicSection = async (id: string): Promise<AcademicSectionItem> => {
  const response = await apiClient.post<ApiResponse<any>>(`/madrasa-admin/academic-sections/${id}/deactivate`);
  const d = response.data.data;
  return d.section || d;
};

// Student API Methods
export const apiListStudents = async (params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  academicSectionId?: string;
  classId?: string;
  status?: string;
}): Promise<{ items: StudentListItem[]; students: StudentListItem[]; total: number; page: number; pageSize: number; totalPages: number }> => {
  const response = await apiClient.get<ApiResponse<any>>('/madrasa-admin/students', { params });
  const d = response.data.data;
  const items: StudentListItem[] = d.items || d.students || [];
  return {
    ...d,
    items,
    students: items,
  };
};

export const apiGetStudent = async (id: string): Promise<StudentDetail> => {
  const response = await apiClient.get<ApiResponse<any>>(`/madrasa-admin/students/${id}`);
  const d = response.data.data;
  return d.student || d;
};

export const apiCreateStudent = async (payload: CreateStudentPayload): Promise<StudentDetail> => {
  const response = await apiClient.post<ApiResponse<any>>('/madrasa-admin/students', payload);
  const d = response.data.data;
  return d.student || d;
};

export const apiUpdateStudent = async (id: string, payload: UpdateStudentPayload): Promise<StudentDetail> => {
  const response = await apiClient.patch<ApiResponse<any>>(`/madrasa-admin/students/${id}`, payload);
  const d = response.data.data;
  return d.student || d;
};

export const apiActivateStudent = async (id: string): Promise<StudentDetail> => {
  const response = await apiClient.post<ApiResponse<any>>(`/madrasa-admin/students/${id}/activate`);
  const d = response.data.data;
  return d.student || d;
};

export const apiInactivateStudent = async (id: string): Promise<StudentDetail> => {
  const response = await apiClient.post<ApiResponse<any>>(`/madrasa-admin/students/${id}/inactivate`);
  const d = response.data.data;
  return d.student || d;
};

export const apiArchiveStudent = async (id: string): Promise<StudentDetail> => {
  const response = await apiClient.post<ApiResponse<any>>(`/madrasa-admin/students/${id}/archive`);
  const d = response.data.data;
  return d.student || d;
};

export const apiGetStudentFeeHistory = async (id: string): Promise<StudentFeeHistoryItem[] | {
  history: StudentFeeHistoryItem[];
  student?: { id: string; fullName: string; admissionNo: string; class: { id: string; name: string; defaultMonthlyFee: string } | null };
}> => {
  const response = await apiClient.get<ApiResponse<any>>(`/madrasa-admin/students/${id}/fee-history`);
  return response.data.data;
};

export const apiSetStudentFeeOverride = async (id: string, payload: SetFeeOverridePayload): Promise<{
  feeSetting: StudentFeeHistoryItem;
  effectiveFee: string;
}> => {
  const response = await apiClient.post<ApiResponse<any>>(`/madrasa-admin/students/${id}/fee-settings`, payload);
  return response.data.data;
};

export const apiUseClassDefaultFee = async (id: string, payload: UseClassDefaultPayload): Promise<{
  effectiveFee: string;
  feeSource: 'CLASS_DEFAULT';
}> => {
  const response = await apiClient.post<ApiResponse<any>>(`/madrasa-admin/students/${id}/fee-settings/use-class-default`, payload);
  return response.data.data;
};

// ==========================================
// PHASE 9: INVOICE ENGINE TYPES & METHODS
// ==========================================

export interface InvoiceListItem {
  id: string;
  invoiceNo: string;
  billingYear: number;
  billingMonth: number;
  monthName: string;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  discountAmount: string;
  totalAmount: string;
  paidAmount: string;
  balanceAmount: string;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'VOID';
  displayStatus: 'PENDING' | 'PARTIAL' | 'PAID' | 'VOID' | 'OVERDUE';
  isOverdue: boolean;
  notes?: string | null;
  student: {
    id: string;
    admissionNo: string;
    fullName: string;
    currentClass: {
      id: string;
      name: string;
      code: string | null;
    } | null;
  };
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitAmount: string;
  totalAmount: string;
  createdAt?: string;
}

export interface InvoiceAllocation {
  id: string;
  amount: string;
  paymentNo: string;
  paymentMethod: string;
  paidAt: string;
}

export interface InvoiceDetail {
  id: string;
  invoiceNo: string;
  billingYear: number;
  billingMonth: number;
  monthName: string;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  discountAmount: string;
  totalAmount: string;
  paidAmount: string;
  balanceAmount: string;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'VOID';
  displayStatus: 'PENDING' | 'PARTIAL' | 'PAID' | 'VOID' | 'OVERDUE';
  isOverdue: boolean;
  notes?: string | null;
  voidMetadata?: {
    voidedAt: string;
    reason: string | null;
    voidedBy: string;
  } | null;
  student: {
    id: string;
    admissionNo: string;
    fullName: string;
    guardianName: string;
    guardianPhone?: string | null;
    whatsappNumber?: string | null;
    currentClass: {
      id: string;
      name: string;
      code: string | null;
    } | null;
  };
  items: InvoiceItem[];
  allocations: InvoiceAllocation[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceSummaryKpi {
  totalInvoices: number;
  expectedAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  pendingCount: number;
  partialCount: number;
  paidCount: number;
  overdueCount: number;
  voidCount: number;
}

export interface InvoiceListResponse {
  items: InvoiceListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: InvoiceSummaryKpi;
}

export interface InvoicePreviewItem {
  studentId: string;
  admissionNo: string;
  studentName: string;
  className: string;
  classCode: string | null;
  feeSource: 'CLASS_DEFAULT' | 'STUDENT_OVERRIDE' | 'EXISTING_INVOICE' | 'UNCONFIGURED';
  resolvedFee: string | null;
  status: 'READY' | 'ALREADY_INVOICED' | 'SKIPPED_NO_FEE' | 'SKIPPED_INACTIVE' | 'SKIPPED_ARCHIVED' | 'SKIPPED_NOT_ADMITTED';
  existingInvoiceId?: string;
  existingInvoiceNo?: string;
  skipReason: string | null;
}

export interface InvoicePreviewResponse {
  billingYear: number;
  billingMonth: number;
  monthName: string;
  dueDate: string | null;
  eligibleCount: number;
  readyCount: number;
  alreadyInvoicedCount: number;
  skippedCount: number;
  skippedBreakdown: {
    noFee: number;
    inactive: number;
    archived: number;
    notAdmitted: number;
  };
  totalExpectedAmount: string;
  items: InvoicePreviewItem[];
}

export interface InvoiceGeneratePayload {
  billingYear: number;
  billingMonth: number;
  dueDate: string;
  classId?: string | null;
  studentIds?: string[] | null;
  notes?: string | null;
}

export interface InvoiceGenerateResultItem {
  studentId: string;
  admissionNo: string;
  studentName: string;
  className: string;
  status: 'GENERATED' | 'ALREADY_INVOICED' | 'SKIPPED_NO_FEE' | 'SKIPPED_INACTIVE' | 'SKIPPED_ARCHIVED' | 'SKIPPED_NOT_ADMITTED';
  invoiceId?: string | null;
  invoiceNo?: string | null;
  totalAmount?: string | null;
  reason?: string;
}

export interface InvoiceGenerateResponse {
  billingYear: number;
  billingMonth: number;
  monthName: string;
  generatedCount: number;
  alreadyExistingCount: number;
  skippedNoFeeCount: number;
  otherSkippedCount: number;
  totalGeneratedAmount: string;
  items: InvoiceGenerateResultItem[];
}

// Invoice API Methods
export const apiPreviewInvoices = async (payload: {
  billingYear: number;
  billingMonth: number;
  dueDate?: string;
  classId?: string;
  studentIds?: string[];
}): Promise<InvoicePreviewResponse> => {
  const response = await apiClient.post<ApiResponse<InvoicePreviewResponse>>('/madrasa-admin/invoices/preview', payload);
  return response.data.data;
};

export const apiGenerateInvoices = async (payload: InvoiceGeneratePayload): Promise<InvoiceGenerateResponse> => {
  const response = await apiClient.post<ApiResponse<InvoiceGenerateResponse>>('/madrasa-admin/invoices/generate', payload);
  return response.data.data;
};

export const apiListInvoices = async (params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  billingYear?: number;
  billingMonth?: number;
  status?: string;
  classId?: string;
  studentId?: string;
}): Promise<InvoiceListResponse> => {
  const response = await apiClient.get<ApiResponse<InvoiceListResponse>>('/madrasa-admin/invoices', { params });
  return response.data.data;
};

export const apiGetInvoice = async (id: string): Promise<InvoiceDetail> => {
  const response = await apiClient.get<ApiResponse<InvoiceDetail>>(`/madrasa-admin/invoices/${id}`);
  return response.data.data;
};

export const apiVoidInvoice = async (id: string, reason: string): Promise<InvoiceDetail> => {
  const response = await apiClient.post<ApiResponse<InvoiceDetail>>(`/madrasa-admin/invoices/${id}/void`, { reason });
  return response.data.data;
};

export const apiGetStudentInvoices = async (
  studentId: string,
  params?: { page?: number; pageSize?: number; billingYear?: number; status?: string }
): Promise<{ items: InvoiceListItem[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }> => {
  const response = await apiClient.get<ApiResponse<{ items: InvoiceListItem[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>>(
    `/madrasa-admin/students/${studentId}/invoices`,
    { params }
  );
  return response.data.data;
};

// ==========================================
// PHASE 10: PAYMENTS, RECEIPTS & LEDGER TYPES
// ==========================================

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
export type PaymentStatus = 'COMPLETED' | 'VOID';
export type LedgerMonthStatus =
  | 'PAID'
  | 'PARTIAL'
  | 'PENDING'
  | 'OVERDUE'
  | 'VOID'
  | 'NOT_GENERATED'
  | 'NOT_ADMITTED';

export interface StudentLedgerAllocationItem {
  id: string;
  paymentId: string;
  paymentNo: string;
  receiptId: string | null;
  receiptNo: string | null;
  amount: string;
  paidAt: string;
  paymentMethod: PaymentMethod;
}

export interface StudentLedgerMonthItem {
  month: number;
  monthName: string;
  invoiceId: string | null;
  invoiceNo: string | null;
  status: LedgerMonthStatus;
  displayStatus: LedgerMonthStatus;
  expectedAmount: string | null;
  paidAmount: string;
  balanceAmount: string;
  dueDate: string | null;
  isOverdue: boolean;
  canAddPayment: boolean;
  canGenerateInvoice: boolean;
  isNotAdmitted: boolean;
  allocations: StudentLedgerAllocationItem[];
}

export interface StudentMonthlyLedgerResponse {
  year: number;
  student: {
    id: string;
    admissionNo: string;
    fullName: string;
    admissionDate: string;
    monthlyFee: string | null;
    currentClass: {
      id: string;
      name: string;
      code: string | null;
    } | null;
  };
  summary: {
    totalExpected: string;
    totalPaid: string;
    totalBalance: string;
    paidMonthsCount: number;
    partialMonthsCount: number;
    pendingMonthsCount: number;
    overdueMonthsCount: number;
    notGeneratedMonthsCount: number;
    voidMonthsCount: number;
  };
  months: StudentLedgerMonthItem[];
}

export interface PaymentListItem {
  id: string;
  paymentNo: string;
  amount: string;
  paymentMethod: PaymentMethod;
  reference: string | null;
  notes: string | null;
  status: PaymentStatus;
  paidAt: string;
  createdAt: string;
  voidMetadata: {
    voidedAt: string | null;
    voidReason: string | null;
  } | null;
  student: {
    id: string;
    admissionNo: string;
    fullName: string;
    guardianName: string;
    currentClass: {
      id: string;
      name: string;
      code: string | null;
    } | null;
  };
  receipt: {
    id: string;
    receiptNo: string;
    issuedAt: string;
  } | null;
  allocationsCount: number;
}

export interface PaymentSummaryKpi {
  totalCollected: string;
  completedCount: number;
  cashCollected: string;
  bankTransferCollected: string;
  cardCollected: string;
  otherCollected: string;
  voidedCount: number;
  voidedAmount: string;
}

export interface PaymentListResponse {
  items: PaymentListItem[];
  summary: PaymentSummaryKpi;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface PaymentAllocationDetail {
  id: string;
  amount: string;
  invoiceId: string;
  invoiceNo: string;
  billingYear: number;
  billingMonth: number;
  monthName: string;
  invoiceTotal: string;
  invoiceBalance: string;
  invoiceStatus: string;
}

export interface PaymentDetail {
  id: string;
  paymentNo: string;
  amount: string;
  paymentMethod: PaymentMethod;
  reference: string | null;
  notes: string | null;
  status: PaymentStatus;
  paidAt: string;
  createdAt: string;
  voidMetadata: {
    voidedAt: string | null;
    voidReason: string | null;
  } | null;
  student: {
    id: string;
    admissionNo: string;
    fullName: string;
    guardianName: string;
    guardianPhone: string | null;
    whatsappNumber: string | null;
    currentClass: {
      id: string;
      name: string;
      code: string | null;
    } | null;
  };
  receipt: {
    id: string;
    receiptNo: string;
    issuedAt: string;
  } | null;
  allocations: PaymentAllocationDetail[];
}

export interface ReceiptDetail {
  id: string;
  receiptNo: string;
  issuedAt: string;
  createdAt: string;
  isVoid: boolean;
  madrasa: {
    id: string;
    name: string;
    code: string;
    email: string;
    logoUrl?: string | null;
    branding: {
      receiptHeader: string | null;
      receiptFooter: string | null;
      currency: string;
      timezone: string;
    };
  };
  payment: {
    id: string;
    paymentNo: string;
    amount: string;
    paymentMethod: PaymentMethod;
    reference: string | null;
    status: PaymentStatus;
    paidAt: string;
    voidMetadata: {
      voidedAt: string | null;
      voidReason: string | null;
    } | null;
  };
  student: {
    id: string;
    admissionNo: string;
    fullName: string;
    guardianName: string;
    guardianPhone: string | null;
    whatsappNumber: string | null;
    currentClass: {
      id: string;
      name: string;
      code: string | null;
    } | null;
  };
  allocations: {
    id: string;
    amount: string;
    invoiceNo: string;
    billingYear: number;
    billingMonth: number;
    monthName: string;
  }[];
}

export interface POSStudentSearchResult {
  id: string;
  admissionNo: string;
  fullName: string;
  guardianName: string;
  guardianPhone: string | null;
  whatsappNumber: string | null;
  monthlyFee: string | null;
  status: string;
  currentClass: {
    id: string;
    name: string;
    code: string | null;
    academicSectionId?: string | null;
    academicSection?: {
      id: string;
      name: string;
      code: string | null;
    } | null;
    sectionName?: string;
  } | null;
  sectionName?: string;
  outstandingBalance: string;
  unpaidInvoicesCount: number;
}

export interface POSOutstandingInvoice {
  id: string;
  invoiceNo: string;
  billingYear: number;
  billingMonth: number;
  monthName: string;
  issueDate: string;
  dueDate: string;
  totalAmount: string;
  paidAmount: string;
  balanceAmount: string;
  status: string;
  isOverdue: boolean;
}

export interface CreatePaymentPayload {
  studentId: string;
  amount: string | number;
  paymentMethod: PaymentMethod;
  paidAt?: string;
  reference?: string;
  idempotencyKey: string;
  notes?: string;
  allocations: {
    invoiceId: string;
    amount: string | number;
  }[];
}

// ==========================================
// PHASE 10: API CLIENT METHODS
// ==========================================

export const apiGetStudentMonthlyLedger = async (
  studentId: string,
  year?: number
): Promise<StudentMonthlyLedgerResponse> => {
  const response = await apiClient.get<ApiResponse<StudentMonthlyLedgerResponse>>(
    `/madrasa-admin/students/${studentId}/monthly-fees`,
    { params: year ? { year } : {} }
  );
  return response.data.data;
};

export const apiCreatePayment = async (payload: CreatePaymentPayload): Promise<PaymentDetail> => {
  const response = await apiClient.post<ApiResponse<PaymentDetail>>('/madrasa-admin/payments', payload);
  return response.data.data;
};

export const apiVoidPayment = async (paymentId: string, reason: string): Promise<PaymentDetail> => {
  const response = await apiClient.post<ApiResponse<PaymentDetail>>(
    `/madrasa-admin/payments/${paymentId}/void`,
    { reason }
  );
  return response.data.data;
};

export const apiListPayments = async (params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  studentId?: string;
  paymentMethod?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<PaymentListResponse> => {
  const response = await apiClient.get<ApiResponse<PaymentListResponse>>('/madrasa-admin/payments', {
    params,
  });
  return response.data.data;
};

export const apiGetPayment = async (id: string): Promise<PaymentDetail> => {
  const response = await apiClient.get<ApiResponse<PaymentDetail>>(`/madrasa-admin/payments/${id}`);
  return response.data.data;
};

export const apiGetReceipt = async (id: string): Promise<ReceiptDetail> => {
  const response = await apiClient.get<ApiResponse<any>>(`/madrasa-admin/receipts/${id}`);
  const raw = response.data?.data;
  if (!raw) return raw;

  const inst = raw.institution || {};
  const branding = raw.madrasa?.branding || {
    receiptHeader: inst.receiptHeader || null,
    receiptFooter: inst.receiptFooter || null,
    currency: inst.currency || 'LKR',
    timezone: inst.timezone || 'Asia/Colombo',
  };

  const madrasa = {
    id: raw.madrasa?.id || inst.id || raw.madrasaId || '',
    name: raw.madrasa?.name || inst.name || 'Madrasa',
    code: raw.madrasa?.code || inst.code || '',
    email: raw.madrasa?.email || inst.email || '',
    branding,
    ...raw.madrasa,
  };

  return {
    ...raw,
    madrasa,
    institution: inst,
  } as ReceiptDetail;
};

export const apiSearchStudentsForPOS = async (query: string): Promise<POSStudentSearchResult[]> => {
  const response = await apiClient.get<ApiResponse<POSStudentSearchResult[]>>(
    '/madrasa-admin/pos/search',
    { params: { q: query } }
  );
  return response.data.data;
};

export const apiGetStudentUnpaidInvoices = async (
  studentId: string
): Promise<{ student: { id: string; admissionNo: string; fullName: string }; totalOutstanding: string; invoices: POSOutstandingInvoice[] }> => {
  const response = await apiClient.get<
    ApiResponse<{ student: { id: string; admissionNo: string; fullName: string }; totalOutstanding: string; invoices: POSOutstandingInvoice[] }>
  >(`/madrasa-admin/students/${studentId}/unpaid-invoices`);
  return response.data.data;
};

export const apiGetStudentPayments = async (
  studentId: string,
  params?: { page?: number; pageSize?: number }
): Promise<{ items: PaymentListItem[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }> => {
  const response = await apiClient.get<
    ApiResponse<{ items: PaymentListItem[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>
  >(`/madrasa-admin/students/${studentId}/payments`, { params });
  return response.data.data;
};

// ==========================================
// FEE REPORTS & EXPORT CENTER API
// ==========================================

export interface ReportFilterParams {
  billingYear?: number;
  billingMonth?: number;
  academicSectionId?: string | null;
  classId?: string | null;
  studentId?: string | null;
  startDate?: string;
  endDate?: string;
  date?: string;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
  status?: string;
  sortBy?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ReportPreviewData {
  reportType: string;
  title: string;
  period: string;
  filters: Record<string, any>;
  madrasa: {
    id: string;
    name: string;
    code: string;
    phone?: string | null;
    address?: string | null;
    currency: string;
    timezone: string;
  };
  summary: Record<string, any>;
  totalRecords: number;
  records: any[];
  billingLedger?: any[];
  paymentHistory?: any[];
  student?: any;
  pagination?: {
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
  };
}

export const apiGetReportPreview = async (
  endpoint: string,
  params?: ReportFilterParams
): Promise<ReportPreviewData> => {
  const response = await apiClient.get<ApiResponse<ReportPreviewData>>(
    `/madrasa-admin/reports/${endpoint}`,
    { params: { ...params, format: 'json' } }
  );
  return response.data.data;
};

export const apiDownloadReport = async (
  endpoint: string,
  params: ReportFilterParams,
  format: 'pdf' | 'csv'
): Promise<void> => {
  const token = localStorage.getItem('madrasanexa_token');
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && k !== 'page' && k !== 'limit') {
      queryParams.append(k, String(v));
    }
  });
  queryParams.append('format', format);

  const url = `${apiClient.defaults.baseURL}/madrasa-admin/reports/${endpoint}?${queryParams.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.message || `Failed to export ${format.toUpperCase()} report.`);
  }

  const blob = await response.blob();
  let filename = `report.${format}`;
  const disposition = response.headers.get('Content-Disposition');
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) filename = match[1];
  }

  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);
};

export const apiGetStudentStatementPreview = async (
  studentId: string,
  params?: { year?: number; startDate?: string; endDate?: string }
): Promise<ReportPreviewData> => {
  const response = await apiClient.get<ApiResponse<ReportPreviewData>>(
    `/madrasa-admin/reports/student/${studentId}/statement`,
    { params: { ...params, format: 'json' } }
  );
  return response.data.data;
};

export const apiDownloadStudentStatement = async (
  studentId: string,
  params: { year?: number; startDate?: string; endDate?: string },
  format: 'pdf' | 'csv'
): Promise<void> => {
  const token = localStorage.getItem('madrasanexa_token');
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      queryParams.append(k, String(v));
    }
  });
  queryParams.append('format', format);

  const url = `${apiClient.defaults.baseURL}/madrasa-admin/reports/student/${studentId}/statement?${queryParams.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.message || `Failed to export ${format.toUpperCase()} statement.`);
  }

  const blob = await response.blob();
  let filename = `statement.${format}`;
  const disposition = response.headers.get('Content-Disposition');
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) filename = match[1];
  }

  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);
};

// ==========================================
// MADRASA EMAIL SENDER SETTINGS API
// ==========================================

export interface EmailSenderSettingsData {
  id?: string;
  madrasaId?: string;
  mode: 'PLATFORM' | 'CUSTOM_SMTP';
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: 'SSL_TLS' | 'STARTTLS';
  smtpUsername: string;
  hasSmtpPassword: boolean;
  isVerified: boolean;
  lastTestedAt: string | null;
  lastVerificationErrorCode: string | null;
  configVersion: number;
}

export interface UpdateEmailSenderSettingsPayload {
  mode: 'PLATFORM' | 'CUSTOM_SMTP';
  fromName?: string;
  fromEmail?: string;
  replyToEmail?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecurity?: 'SSL_TLS' | 'STARTTLS';
  smtpUsername?: string;
  smtpPassword?: string;
}

export interface TestEmailSenderPayload {
  recipientEmail?: string;
}

export const apiGetEmailSenderSettings = async (): Promise<EmailSenderSettingsData> => {
  const response = await apiClient.get('/madrasa-admin/settings/email-sender');
  return response.data.data;
};

export const apiUpdateEmailSenderSettings = async (
  payload: UpdateEmailSenderSettingsPayload
): Promise<EmailSenderSettingsData> => {
  const response = await apiClient.put('/madrasa-admin/settings/email-sender', payload);
  return response.data.data;
};

export const apiTestEmailSenderConnection = async (
  payload?: TestEmailSenderPayload
): Promise<{ success: boolean; isVerified: boolean; message: string; lastTestedAt?: string; errorCode?: string }> => {
  const response = await apiClient.post('/madrasa-admin/settings/email-sender/test', payload || {});
  return response.data.data;
};

// ==========================================
// STUDENT QUALIFICATIONS, DISCIPLINE, MEETINGS, FOLLOW-UPS & TIMELINE API
// ==========================================

export type QualificationRecordType = 'QUALIFICATION' | 'ACHIEVEMENT';
export type QualificationCategory =
  | 'HIFZ_JUZ'
  | 'QIRAATH'
  | 'NAZIRA_QURAN'
  | 'TAJWEED'
  | 'ISLAMIC_STUDIES'
  | 'ARABIC_LANGUAGE'
  | 'PREVIOUS_SCHOOLING'
  | 'EXTERNAL_CERTIFICATE'
  | 'AWARD_ACHIEVEMENT'
  | 'OTHER';
export type QualificationProgressStatus = 'IN_PROGRESS' | 'COMPLETED';
export type CertificateVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface StudentQualificationItem {
  id: string;
  madrasaId: string;
  studentId: string;
  recordType: QualificationRecordType;
  category: QualificationCategory;
  title: string;
  issuingAuthority: string | null;
  certificateNumber: string | null;
  progressStatus: QualificationProgressStatus;
  verificationStatus: CertificateVerificationStatus;
  achievedDate: string | null;
  expiryDate: string | null;
  gradeOrScore: string | null;
  description: string | null;
  certificateFileId: string | null;
  hasCertificateFile: boolean;
  certificateFile: {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    createdAt: string;
  } | null;
  examinerUstadhId: string | null;
  examinerUstadh: {
    id: string;
    fullName: string;
    ustadhCode: string;
    staffType: string;
  } | null;
  reviewedByUserId: string | null;
  reviewedByUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdByUserId: string;
  createdByUser: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentQualificationsListResponse {
  items: StudentQualificationItem[];
  summary: {
    total: number;
    verifiedCount: number;
    pendingCount: number;
    rejectedCount: number;
    inProgressCount: number;
    completedCount: number;
  };
}

export type IncidentCategory =
  | 'ATTENDANCE_TARDINESS'
  | 'BEHAVIOR_CONDUCT'
  | 'ACADEMIC_INTEGRITY'
  | 'DRESS_CODE'
  | 'PEER_CONFLICT'
  | 'PROPERTY_DAMAGE'
  | 'SAFETY_CONCERN'
  | 'OTHER';
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentVerificationStatus =
  | 'REPORTED'
  | 'UNDER_REVIEW'
  | 'CONFIRMED'
  | 'RESOLVED'
  | 'DISMISSED';

export interface StudentIncidentItem {
  id: string;
  madrasaId: string;
  studentId: string;
  title: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  occurredAt: string;
  location: string | null;
  isConfidential: boolean;
  reportedDescription: string;
  reportedByUstadhId: string | null;
  reportedByUstadh: {
    id: string;
    fullName: string;
    ustadhCode: string;
  } | null;
  reportedByUserId: string;
  reportedByUser: {
    id: string;
    name: string;
  } | null;
  reportedAt: string;
  verificationStatus: IncidentVerificationStatus;
  isUnconfirmedReport: boolean;
  isConfirmedMisconduct: boolean;
  isResolved: boolean;
  isDismissed: boolean;
  investigatedFindings: string | null;
  actionTaken: string | null;
  dismissalReason: string | null;
  reviewedByUserId: string | null;
  reviewedByUser: {
    id: string;
    name: string;
  } | null;
  reviewedAt: string | null;
  resolvedAt: string | null;
  evidenceFileId: string | null;
  hasEvidenceFile: boolean;
  evidenceFile: {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    createdAt: string;
  } | null;
  guardianNotified: boolean;
  guardianNotifiedAt: string | null;
  followUpCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudentIncidentsListResponse {
  items: StudentIncidentItem[];
  summary: {
    total: number;
    unconfirmedCount: number;
    confirmedCount: number;
    resolvedCount: number;
    dismissedCount: number;
  };
}

export type StudentMeetingType =
  | 'GUARDIAN_CONFERENCE'
  | 'ACADEMIC_REVIEW'
  | 'DISCIPLINARY_HEARING'
  | 'COUNSELING'
  | 'GENERAL';

export interface StudentMeetingItem {
  id: string;
  madrasaId: string;
  studentId: string;
  meetingType: StudentMeetingType;
  title: string;
  meetingAt: string;
  location: string | null;
  participantsSummary: string;
  ustadhId: string | null;
  ustadh: {
    id: string;
    fullName: string;
    ustadhCode: string;
  } | null;
  incidentId: string | null;
  incident: {
    id: string;
    title: string;
    verificationStatus: IncidentVerificationStatus;
  } | null;
  discussionNotes: string;
  outcomeSummary: string | null;
  createdByUserId: string;
  createdByUser: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export type FollowUpStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type FollowUpPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface StudentFollowUpItem {
  id: string;
  madrasaId: string;
  studentId: string;
  student: {
    id: string;
    fullName: string;
    admissionNo: string;
  } | null;
  incidentId: string | null;
  incident: {
    id: string;
    title: string;
    verificationStatus: IncidentVerificationStatus;
  } | null;
  qualificationId: string | null;
  qualification: {
    id: string;
    title: string;
  } | null;
  meetingId: string | null;
  meeting: {
    id: string;
    title: string;
  } | null;
  title: string;
  notes: string | null;
  dueDate: string;
  reminderAt: string | null;
  reminderSentAt: string | null;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  isOverdue: boolean;
  isDueToday: boolean;
  isUpcoming: boolean;
  assignedToUstadhId: string | null;
  assignedToUstadh: {
    id: string;
    fullName: string;
    ustadhCode: string;
    email: string | null;
  } | null;
  assignedToUserId: string | null;
  assignedToUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  completedAt: string | null;
  completedByUserId: string | null;
  completedByUser: {
    id: string;
    name: string;
  } | null;
  outcomeNotes: string | null;
  createdByUserId: string;
  createdByUser: {
    id: string;
    name: string;
  } | null;
  navigationUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentFollowUpsListResponse {
  items: StudentFollowUpItem[];
  summary: {
    total: number;
    overdueCount: number;
    dueTodayCount: number;
    upcomingCount: number;
    completedCount: number;
  };
}

export interface MadrasaFollowUpsSummaryData {
  todayDate: string;
  timezone: string;
  overdueCount: number;
  dueTodayCount: number;
  upcomingCount: number;
  totalOpenCount: number;
  overdueItems: StudentFollowUpItem[];
  dueTodayItems: StudentFollowUpItem[];
  upcomingItems: StudentFollowUpItem[];
  items: StudentFollowUpItem[];
}

export interface StudentTimelineEvent {
  id: string;
  entityId?: string;
  type: 'ENROLLMENT' | 'QUALIFICATION' | 'ACHIEVEMENT' | 'INCIDENT' | 'MEETING' | 'FOLLOW_UP';
  category: string;
  timestamp: string;
  title: string;
  subtitle: string;
  description?: string | null;
  status: string;
  progressStatus?: string;
  verificationStatus?: string;
  metadata?: Record<string, any>;
}

export const apiGetStudentQualifications = async (
  studentId: string,
  params?: Record<string, string | undefined>
): Promise<StudentQualificationsListResponse> => {
  const response = await apiClient.get<ApiResponse<StudentQualificationsListResponse>>(
    `/madrasa-admin/students/${studentId}/qualifications`,
    { params }
  );
  return response.data.data;
};

export const apiCreateStudentQualification = async (
  studentId: string,
  formData: FormData
): Promise<StudentQualificationItem> => {
  const response = await apiClient.post<ApiResponse<StudentQualificationItem>>(
    `/madrasa-admin/students/${studentId}/qualifications`,
    formData
  );
  return response.data.data;
};

export const apiUpdateStudentQualification = async (
  studentId: string,
  qualificationId: string,
  payloadOrFormData: FormData | Record<string, any>
): Promise<StudentQualificationItem> => {
  const response = await apiClient.patch<ApiResponse<StudentQualificationItem>>(
    `/madrasa-admin/students/${studentId}/qualifications/${qualificationId}`,
    payloadOrFormData
  );
  return response.data.data;
};

export const apiVerifyStudentQualification = async (
  studentId: string,
  qualificationId: string,
  payload: { verificationStatus: CertificateVerificationStatus; rejectionReason?: string; examinerUstadhId?: string }
): Promise<StudentQualificationItem> => {
  const response = await apiClient.post<ApiResponse<StudentQualificationItem>>(
    `/madrasa-admin/students/${studentId}/qualifications/${qualificationId}/verify`,
    payload
  );
  return response.data.data;
};

export const apiGetStudentQualificationCertificateUrl = async (
  studentId: string,
  qualificationId: string,
  mode: 'inline' | 'download' = 'inline'
): Promise<{ url: string; expiresIn: number; mode: string; originalName: string; mimeType: string; size: number }> => {
  const response = await apiClient.get<ApiResponse<any>>(
    `/madrasa-admin/students/${studentId}/qualifications/${qualificationId}/certificate`,
    { params: { mode } }
  );
  return response.data.data;
};

export const apiDeleteStudentQualification = async (
  studentId: string,
  qualificationId: string
): Promise<void> => {
  await apiClient.delete(`/madrasa-admin/students/${studentId}/qualifications/${qualificationId}`);
};

export const apiGetStudentIncidents = async (
  studentId: string,
  params?: Record<string, string | undefined>
): Promise<StudentIncidentsListResponse> => {
  const response = await apiClient.get<ApiResponse<StudentIncidentsListResponse>>(
    `/madrasa-admin/students/${studentId}/incidents`,
    { params }
  );
  return response.data.data;
};

export const apiCreateStudentIncident = async (
  studentId: string,
  formData: FormData
): Promise<StudentIncidentItem> => {
  const response = await apiClient.post<ApiResponse<StudentIncidentItem>>(
    `/madrasa-admin/students/${studentId}/incidents`,
    formData
  );
  return response.data.data;
};

export const apiUpdateStudentIncident = async (
  studentId: string,
  incidentId: string,
  payloadOrFormData: FormData | Record<string, any>
): Promise<StudentIncidentItem> => {
  const response = await apiClient.patch<ApiResponse<StudentIncidentItem>>(
    `/madrasa-admin/students/${studentId}/incidents/${incidentId}`,
    payloadOrFormData
  );
  return response.data.data;
};

export const apiGetStudentIncidentEvidenceUrl = async (
  studentId: string,
  incidentId: string,
  mode: 'inline' | 'download' = 'inline'
): Promise<{ url: string; expiresIn: number; mode: string; originalName: string; mimeType: string; size: number }> => {
  const response = await apiClient.get<ApiResponse<any>>(
    `/madrasa-admin/students/${studentId}/incidents/${incidentId}/evidence`,
    { params: { mode } }
  );
  return response.data.data;
};

export const apiDeleteStudentIncident = async (
  studentId: string,
  incidentId: string
): Promise<void> => {
  await apiClient.delete(`/madrasa-admin/students/${studentId}/incidents/${incidentId}`);
};

export const apiGetStudentMeetings = async (
  studentId: string,
  params?: Record<string, string | undefined>
): Promise<{ items: StudentMeetingItem[]; total: number }> => {
  const response = await apiClient.get<ApiResponse<{ items: StudentMeetingItem[]; total: number }>>(
    `/madrasa-admin/students/${studentId}/meetings`,
    { params }
  );
  return response.data.data;
};

export const apiCreateStudentMeeting = async (
  studentId: string,
  payload: Record<string, any>
): Promise<StudentMeetingItem> => {
  const response = await apiClient.post<ApiResponse<StudentMeetingItem>>(
    `/madrasa-admin/students/${studentId}/meetings`,
    payload
  );
  return response.data.data;
};

export const apiUpdateStudentMeeting = async (
  studentId: string,
  meetingId: string,
  payload: Record<string, any>
): Promise<StudentMeetingItem> => {
  const response = await apiClient.patch<ApiResponse<StudentMeetingItem>>(
    `/madrasa-admin/students/${studentId}/meetings/${meetingId}`,
    payload
  );
  return response.data.data;
};

export const apiDeleteStudentMeeting = async (
  studentId: string,
  meetingId: string
): Promise<void> => {
  await apiClient.delete(`/madrasa-admin/students/${studentId}/meetings/${meetingId}`);
};

export const apiGetStudentFollowUps = async (
  studentId: string,
  params?: Record<string, string | undefined>
): Promise<StudentFollowUpsListResponse> => {
  const response = await apiClient.get<ApiResponse<StudentFollowUpsListResponse>>(
    `/madrasa-admin/students/${studentId}/follow-ups`,
    { params }
  );
  return response.data.data;
};

export const apiCreateStudentFollowUp = async (
  studentId: string,
  payload: Record<string, any>
): Promise<StudentFollowUpItem> => {
  const response = await apiClient.post<ApiResponse<StudentFollowUpItem>>(
    `/madrasa-admin/students/${studentId}/follow-ups`,
    payload
  );
  return response.data.data;
};

export const apiUpdateStudentFollowUp = async (
  studentId: string,
  followUpId: string,
  payload: Record<string, any>
): Promise<StudentFollowUpItem> => {
  const response = await apiClient.patch<ApiResponse<StudentFollowUpItem>>(
    `/madrasa-admin/students/${studentId}/follow-ups/${followUpId}`,
    payload
  );
  return response.data.data;
};

export const apiDeleteStudentFollowUp = async (
  studentId: string,
  followUpId: string
): Promise<void> => {
  await apiClient.delete(`/madrasa-admin/students/${studentId}/follow-ups/${followUpId}`);
};

export const apiGetMadrasaFollowUpsSummary = async (): Promise<MadrasaFollowUpsSummaryData> => {
  const response = await apiClient.get<ApiResponse<MadrasaFollowUpsSummaryData>>(
    '/madrasa-admin/students-follow-ups/summary'
  );
  return response.data.data;
};

export const apiGetStudentTimeline = async (
  studentId: string,
  category?: string
): Promise<{ items: StudentTimelineEvent[]; total: number }> => {
  const response = await apiClient.get<ApiResponse<{ items: StudentTimelineEvent[]; total: number }>>(
    `/madrasa-admin/students/${studentId}/timeline`,
    { params: category && category !== 'ALL' ? { category } : undefined }
  );
  return response.data.data;
};

// ==========================================
// PHASE A: PER-MADRASA PUBLIC HOMEPAGE TYPES & API
// ==========================================

export interface EventAlbumImage {
  id?: string | null;
  fileId?: string | null;
  url?: string | null;
  caption?: string | null;
  isCover?: boolean;
  sortOrder?: number;
}

export interface MadrasaProfileEvent {
  id: string;
  title: string;
  date: string;
  description?: string;
  location?: string;
  isPublished: boolean;
  // Backward compatibility with single-poster schema
  posterFileId?: string | null;
  posterUrl?: string | null;
  // Multi-image album fields
  coverFileId?: string | null;
  coverUrl?: string | null;
  images?: EventAlbumImage[] | null;
  photoCount?: number;
}

export interface MadrasaProfileNotice {
  id: string;
  title: string;
  content: string;
  postedAt: string;
  priority: 'NORMAL' | 'URGENT';
  isPublished: boolean;
  posterFileId?: string | null;
  posterUrl?: string | null;
}

export interface CurriculumBook {
  id: string;
  title: string;
  author?: string | null;
  description?: string | null;
  displayOrder: number;
  completionNotes?: string | null;
  chapters?: string[] | null;
}

export interface CurriculumSubject {
  id: string;
  name: string;
  code?: string | null;
  isOptional?: boolean;
  displayOrder: number;
  description?: string | null;
  learningOutcomes?: string[] | null;
  books: CurriculumBook[];
}

export interface CurriculumLevel {
  id: string;
  levelType: 'GRADE' | 'YEAR' | 'STREAM' | 'LEVEL';
  levelLabel: string;
  streamName?: string | null;
  displayOrder: number;
  description?: string | null;
  subjects: CurriculumSubject[];
}

export interface CurriculumProgramme {
  id: string;
  categoryId: string;
  name: string;
  code?: string | null;
  description?: string | null;
  durationYears?: number | string | null;
  admissionRequirements?: string | null;
  isPublished: boolean;
  displayOrder: number;
  levels: CurriculumLevel[];
}

export interface CurriculumCategoryConfig {
  id: string;
  label: string;
  description?: string | null;
  displayOrder: number;
  isCustom?: boolean;
}

export interface CurriculumPayload {
  categories: CurriculumCategoryConfig[];
  programmes: CurriculumProgramme[];
}

export interface StaffPresentationItem {
  ustadhId: string;
  isPublic: boolean;
  sortOrder: number;
  designation?: string | null;
  department?: string | null;
  qualification?: string | null;
  experienceYears?: number | string | null;
  bio?: string | null;
  photoFileId?: string | null;
  photoUrl?: string | null;
}

export interface StaffSectionConfig {
  isEnabled: boolean;
  showStats: boolean;
  sectionTitle?: string | null;
  sectionSubtitle?: string | null;
  items: StaffPresentationItem[];
}

export interface PublicStaffMember {
  id: string;
  fullName: string;
  designation: string;
  department?: string | null;
  qualification?: string | null;
  experienceYears?: number | string | null;
  bio?: string | null;
  photoUrl?: string | null;
  sortOrder: number;
}

export interface PublicStaffSection {
  isEnabled: boolean;
  sectionTitle?: string | null;
  sectionSubtitle?: string | null;
  members: PublicStaffMember[];
}

export interface PublicStatsData {
  totalStudents: number;
  totalStaff: number;
  totalTeachers: number;
}

export interface MadrasaProfileData {
  id: string;
  madrasaId: string;
  isPublished: boolean;
  publishedAt: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImageFileId?: string | null;
  heroImageUrl?: string | null;
  introduction: string | null;
  mission: string | null;
  vision: string | null;
  syllabusInfo: string | null;
  rulesAndRegulations: string | null;
  curriculum?: CurriculumPayload | null;
  curriculumJson?: CurriculumPayload | null;
  staffJson?: StaffSectionConfig | null;
  stats?: PublicStatsData | null;
  staff?: PublicStaffSection | null;
  generatedSummary: string | null;
  summaryGeneratedAt: string | null;
  eventsJson: MadrasaProfileEvent[] | null;
  noticesJson: MadrasaProfileNotice[] | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
  madrasa: {
    id: string;
    name: string;
    code: string;
    slug: string;
    logoFileId: string | null;
    logoUrl?: string | null;
    initials?: string;
  };
}

export interface PublicMadrasaProfile {
  madrasa: {
    id: string;
    name: string;
    code: string;
    slug: string;
    logoFileId: string | null;
    logoUrl?: string | null;
    initials?: string;
  };
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImageFileId?: string | null;
  heroImageUrl?: string | null;
  theme?: MadrasaThemeTokens | null;
  introduction: string | null;
  mission: string | null;
  vision: string | null;
  syllabusInfo: string | null;
  rulesAndRegulations: string | null;
  curriculum?: CurriculumPayload | null;
  curriculumJson?: CurriculumPayload | null;
  staff?: PublicStaffSection | null;
  stats?: PublicStatsData | null;
  generatedSummary: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  events: MadrasaProfileEvent[];
  notices: MadrasaProfileNotice[];
  publishedAt: string | null;
  activeAdmissionPeriods?: {
    id: string;
    code: string;
    name: string;
    academicYear: number;
    startDate: string;
    endDate: string;
    isOpen: boolean;
    instructions: string | null;
    capacity: number | null;
  }[];
}

export const apiGetMadrasaHomepageProfile = async (): Promise<MadrasaProfileData> => {
  const response = await apiClient.get<ApiResponse<MadrasaProfileData>>('/madrasa-admin/homepage-profile');
  return response.data.data;
};

export const apiUpdateMadrasaHomepageProfile = async (
  payload: Partial<Omit<MadrasaProfileData, 'id' | 'madrasaId' | 'madrasa' | 'createdAt' | 'updatedAt'>>
): Promise<MadrasaProfileData> => {
  const response = await apiClient.patch<ApiResponse<MadrasaProfileData>>(
    '/madrasa-admin/homepage-profile',
    payload
  );
  return response.data.data;
};

export const apiGenerateMadrasaHomepageSummary = async (): Promise<MadrasaProfileData> => {
  const response = await apiClient.post<ApiResponse<MadrasaProfileData>>(
    '/madrasa-admin/homepage-profile/generate-summary'
  );
  return response.data.data;
};

export const apiPublishMadrasaHomepageProfile = async (): Promise<MadrasaProfileData> => {
  const response = await apiClient.post<ApiResponse<MadrasaProfileData>>(
    '/madrasa-admin/homepage-profile/publish'
  );
  return response.data.data;
};

export const apiUnpublishMadrasaHomepageProfile = async (): Promise<MadrasaProfileData> => {
  const response = await apiClient.post<ApiResponse<MadrasaProfileData>>(
    '/madrasa-admin/homepage-profile/unpublish'
  );
  return response.data.data;
};

export const apiBroadcastMadrasaNotice = async (
  noticeId: string
): Promise<{ noticeId: string; noticeTitle: string; recipientsQueued: number; totalEligibleStudents: number }> => {
  const response = await apiClient.post<
    ApiResponse<{ noticeId: string; noticeTitle: string; recipientsQueued: number; totalEligibleStudents: number }>
  >('/madrasa-admin/homepage-profile/broadcast-notice', { noticeId });
  return response.data.data;
};

export interface HeroImageUploadResult {
  fileId: string;
  heroImageUrl: string | null;
  heroImageFileId: string;
  size: number;
  mimeType: string;
}

export const apiUploadMadrasaHeroImage = async (file: File): Promise<HeroImageUploadResult> => {
  const formData = new FormData();
  formData.append('heroImage', file);
  const response = await apiClient.post<ApiResponse<HeroImageUploadResult>>(
    '/madrasa-admin/homepage-profile/hero-image',
    formData
  );
  return response.data.data;
};

export const apiRemoveMadrasaHeroImage = async (): Promise<void> => {
  await apiClient.delete<ApiResponse<null>>('/madrasa-admin/homepage-profile/hero-image');
};

export interface PosterUploadResult {
  fileId: string;
  posterUrl: string;
  size: number;
  mimeType: string;
}

export const apiUploadMadrasaPoster = async (file: File): Promise<PosterUploadResult> => {
  const formData = new FormData();
  formData.append('poster', file);
  const response = await apiClient.post<ApiResponse<PosterUploadResult>>(
    '/madrasa-admin/homepage-profile/poster',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data.data;
};

export const apiUploadMadrasaEventImages = async (files: File[]): Promise<PosterUploadResult[]> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('images', file);
  });
  const response = await apiClient.post<ApiResponse<PosterUploadResult[]>>(
    '/madrasa-admin/homepage-profile/event-images',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data.data;
};

export const apiRemoveMadrasaPoster = async (fileId: string): Promise<void> => {
  await apiClient.delete<ApiResponse<null>>(`/madrasa-admin/homepage-profile/poster/${fileId}`);
};

export const apiGetPublicMadrasaProfile = async (slug: string): Promise<PublicMadrasaProfile> => {
  const response = await apiClient.get<ApiResponse<PublicMadrasaProfile>>(`/public/madrasa/${slug}`);
  return response.data.data;
};

// ==========================================
// ADMISSIONS & STUDENT APPLICATIONS MODULE
// ==========================================

export interface AdmissionPeriodData {
  id: string;
  code: string;
  name: string;
  academicYear: number;
  startDate: string;
  endDate: string;
  isOpen: boolean;
  instructions: string | null;
  capacity: number | null;
  totalApplications?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PublicAdmissionsResponse {
  madrasa: {
    id: string;
    name: string;
    code: string;
    slug: string;
    logoUrl?: string | null;
    initials?: string;
    contactPhone?: string | null;
    contactEmail?: string | null;
  };
  heroImageUrl?: string | null;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  theme?: MadrasaThemeTokens | null;
  activeAdmissionPeriods: AdmissionPeriodData[];
  availableClasses: {
    id: string;
    name: string;
    code: string;
    academicSection?: {
      id: string;
      name: string;
    } | null;
  }[];
}

export interface ApplicationDocument {
  fileId: string;
  name: string;
  fileUrl?: string | null;
  size?: number;
  mimeType?: string;
}

export interface SubmitApplicationPayload {
  admissionPeriodId: string;
  applicantName: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE';
  guardianName: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianEmail?: string | null;
  address: string;
  appliedClassId?: string | null;
  previousSchool?: string | null;
  documents?: ApplicationDocument[];
}

export interface ApplicationSubmissionResult {
  id: string;
  applicationNo: string;
  applicantName: string;
  intakeName: string;
  academicYear: number;
  appliedClassName?: string | null;
  submittedAt: string;
  madrasaName: string;
}

export interface StudentApplicationItem {
  id: string;
  madrasaId: string;
  admissionPeriodId: string;
  applicationNo: string;
  applicantName: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE';
  guardianName: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianEmail?: string | null;
  address: string;
  appliedClassId?: string | null;
  previousSchool?: string | null;
  documentsJson?: ApplicationDocument[] | null;
  documents?: ApplicationDocument[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONVERTED';
  submittedAt: string;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  reviewRemarks?: string | null;
  convertedStudentId?: string | null;
  convertedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  admissionPeriod?: {
    id: string;
    name: string;
    code: string;
    academicYear: number;
  };
  appliedClass?: {
    id: string;
    name: string;
    code: string;
  } | null;
  convertedStudent?: {
    id: string;
    admissionNo: string;
    fullName: string;
  } | null;
  reviewedByUser?: {
    id: string;
    name: string;
  } | null;
}

export interface ApplicationListResponse {
  items: StudentApplicationItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const apiGetPublicAdmissionsData = async (slug: string): Promise<PublicAdmissionsResponse> => {
  const response = await apiClient.get<ApiResponse<PublicAdmissionsResponse>>(`/public/madrasa/${slug}/admissions`);
  return response.data.data;
};

export const apiUploadPublicAdmissionDocument = async (slug: string, file: File): Promise<ApplicationDocument> => {
  const formData = new FormData();
  formData.append('document', file);
  const response = await apiClient.post<ApiResponse<ApplicationDocument>>(
    `/public/madrasa/${slug}/admissions/upload-document`,
    formData
  );
  return response.data.data;
};

export const apiSubmitPublicApplication = async (
  slug: string,
  payload: SubmitApplicationPayload
): Promise<ApplicationSubmissionResult> => {
  const response = await apiClient.post<ApiResponse<ApplicationSubmissionResult>>(
    `/public/madrasa/${slug}/admissions/apply`,
    payload
  );
  return response.data.data;
};

export const apiListAdmissionPeriods = async (): Promise<AdmissionPeriodData[]> => {
  const response = await apiClient.get<ApiResponse<AdmissionPeriodData[]>>('/madrasa-admin/admissions/periods');
  return response.data.data;
};

export const apiCreateAdmissionPeriod = async (
  payload: Omit<AdmissionPeriodData, 'id' | 'totalApplications' | 'createdAt' | 'updatedAt'>
): Promise<AdmissionPeriodData> => {
  const response = await apiClient.post<ApiResponse<AdmissionPeriodData>>(
    '/madrasa-admin/admissions/periods',
    payload
  );
  return response.data.data;
};

export const apiToggleAdmissionPeriod = async (id: string): Promise<AdmissionPeriodData> => {
  const response = await apiClient.patch<ApiResponse<AdmissionPeriodData>>(
    `/madrasa-admin/admissions/periods/${id}/toggle`
  );
  return response.data.data;
};

export const apiListStudentApplications = async (params: {
  page?: number;
  pageSize?: number;
  status?: string;
  admissionPeriodId?: string;
  search?: string;
} = {}): Promise<ApplicationListResponse> => {
  const response = await apiClient.get<ApiResponse<ApplicationListResponse>>(
    '/madrasa-admin/admissions/applications',
    { params }
  );
  return response.data.data;
};

export const apiGetStudentApplication = async (id: string): Promise<StudentApplicationItem> => {
  const response = await apiClient.get<ApiResponse<StudentApplicationItem>>(
    `/madrasa-admin/admissions/applications/${id}`
  );
  return response.data.data;
};

export const apiReviewStudentApplication = async (
  id: string,
  payload: { status: 'APPROVED' | 'REJECTED'; reviewRemarks?: string | null }
): Promise<StudentApplicationItem> => {
  const response = await apiClient.patch<ApiResponse<StudentApplicationItem>>(
    `/madrasa-admin/admissions/applications/${id}/status`,
    payload
  );
  return response.data.data;
};

export const apiConvertStudentApplication = async (
  id: string,
  payload: { admissionNo: string; classId?: string | null; admissionDate?: string }
): Promise<{ student: any; application: StudentApplicationItem }> => {
  const response = await apiClient.post<ApiResponse<{ student: any; application: StudentApplicationItem }>>(
    `/madrasa-admin/admissions/applications/${id}/convert`,
    payload
  );
  return response.data.data;
};

// ==========================================
// PORTAL THEME & APPEARANCE CUSTOMIZATION
// ==========================================

export interface MadrasaThemeTokens {
  // Page & Backgrounds
  pageBg: string;
  navbarBg: string;
  heroOverlay: string;
  heroOverlayOpacity?: number;
  sectionBg: string;
  footerBg: string;
  cardBg: string;

  // Typography
  headingColor: string;
  sectionHeadingColor: string;
  bodyTextColor: string;
  mutedTextColor: string;
  linkColor: string;
  linkHoverColor: string;
  heroTextColor: string;
  footerTextColor: string;

  // Buttons
  primaryBtnBg: string;
  primaryBtnText: string;
  primaryBtnHoverBg?: string;
  secondaryBtnBg: string;
  secondaryBtnText: string;
  secondaryBtnBorder?: string;

  // Cards, Borders & Dividers
  cardBorderColor: string;
  cardShadowIntensity?: 'none' | 'subtle' | 'medium' | 'prominent';
  dividerColor: string;
  borderRadius?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';

  // Form Controls
  inputBg: string;
  inputBorderColor: string;
  inputFocusBorder: string;
  inputText: string;
  inputPlaceholder: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  tokens: MadrasaThemeTokens;
}

export interface ContrastWarning {
  element: string;
  role: string;
  contrastRatio: number;
  targetRatio: number;
  fg: string;
  bg: string;
  message: string;
  suggestedFg?: string;
}

export interface ContrastAnalysis {
  isAccessible: boolean;
  warnings: ContrastWarning[];
}

export interface ThemeCmsResponse {
  draft: MadrasaThemeTokens;
  published: MadrasaThemeTokens | null;
  defaultTheme?: MadrasaThemeTokens;
  presets: ThemePreset[];
  isPublished?: boolean;
  contrastAnalysis?: ContrastAnalysis;
}

export const apiGetPortalTheme = async (): Promise<ThemeCmsResponse> => {
  const response = await apiClient.get<ApiResponse<ThemeCmsResponse>>('/madrasa-admin/portal-cms/theme');
  return response.data.data;
};

export const apiSaveDraftTheme = async (
  tokens: MadrasaThemeTokens
): Promise<{ draft: MadrasaThemeTokens; published: MadrasaThemeTokens | null; contrastAnalysis: ContrastAnalysis }> => {
  const response = await apiClient.put<
    ApiResponse<{ draft: MadrasaThemeTokens; published: MadrasaThemeTokens | null; contrastAnalysis: ContrastAnalysis }>
  >('/madrasa-admin/portal-cms/theme/draft', tokens);
  return response.data.data;
};

export const apiPublishTheme = async (
  tokens?: MadrasaThemeTokens
): Promise<{ published: MadrasaThemeTokens; draft: MadrasaThemeTokens; contrastAnalysis: ContrastAnalysis }> => {
  const response = await apiClient.post<
    ApiResponse<{ published: MadrasaThemeTokens; draft: MadrasaThemeTokens; contrastAnalysis: ContrastAnalysis }>
  >('/madrasa-admin/portal-cms/theme/publish', tokens ? { tokens } : {});
  return response.data.data;
};

export const apiResetTheme = async (): Promise<{
  draft: MadrasaThemeTokens;
  defaultTheme: MadrasaThemeTokens;
  contrastAnalysis: ContrastAnalysis;
}> => {
  const response = await apiClient.post<
    ApiResponse<{
      draft: MadrasaThemeTokens;
      defaultTheme: MadrasaThemeTokens;
      contrastAnalysis: ContrastAnalysis;
    }>
  >('/madrasa-admin/portal-cms/theme/reset');
  return response.data.data;
};

export const apiDiscardTheme = async (): Promise<{
  draft: MadrasaThemeTokens;
  contrastAnalysis: ContrastAnalysis;
}> => {
  const response = await apiClient.post<
    ApiResponse<{ draft: MadrasaThemeTokens; contrastAnalysis: ContrastAnalysis }>
  >('/madrasa-admin/portal-cms/theme/discard');
  return response.data.data;
};

// ==========================================
// ALUMNI & ACADEMIC VERIFICATION NETWORK
// ==========================================

export type AlumniPublicationStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'REVOKED';
export type AlumniConsentStatus = 'PENDING' | 'GRANTED' | 'WITHDRAWN' | 'EXPIRED';
export type AlumniConsentParty = 'STUDENT' | 'GUARDIAN' | 'BOTH';
export type AlumniConsentProofType = 'SIGNED_PHYSICAL_FORM' | 'DIGITAL_SIGNATURE' | 'GUARDIAN_AFFIDAVIT' | 'DIRECT_APPLICATION';
export type CharacterConductRating = 'EXCELLENT' | 'VERY_GOOD' | 'GOOD' | 'SATISFACTORY' | 'UNDER_OBSERVATION';
export type AlumniVerificationStatus = 'PENDING' | 'APPROVED_VERIFIED' | 'REJECTED' | 'REVOKED';

export interface EligibleStudentItem {
  id: string;
  admissionNo?: string;
  admissionNumber?: string;
  fullName: string;
  status: string;
  admissionDate: string;
  className?: string | null;
  displayName?: string;
  qualifications?: Array<{
    id: string;
    title: string;
    category?: string | null;
    achievedDate?: string | null;
  }>;
}

export interface AlumniProfileItem {
  id: string;
  studentId: string;
  madrasaId: string;
  alumniIndexNumber: string;
  admissionDate: string;
  leavingDate: string;
  leavingReason?: string | null;
  publicationStatus: AlumniPublicationStatus;
  consentStatus: AlumniConsentStatus;
  consentGivenBy?: AlumniConsentParty | null;
  consentSignerName?: string | null;
  consentGrantedAt?: string | null;
  consentProofType?: string | null;
  consentFileId?: string | null;
  characterAssessment?: CharacterConductRating | null;
  characterAssessmentNotes?: string | null;
  academicAchievements?: Array<{
    title: string;
    year?: number | string;
    description?: string;
  }> | null;
  adminPrivateNotes?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    fullName: string;
    admissionNumber: string;
    gender: string;
    qualifications?: Array<{
      id: string;
      recordType: string;
      category: string;
      title: string;
      issuingAuthority?: string | null;
      completionYear?: number | null;
      verificationStatus: string;
      certificateFileId?: string | null;
    }>;
  };
  consentRecords?: Array<{
    id: string;
    action: string;
    consentParty: string;
    signerName: string;
    consentVersion: string;
    proofType: string;
    evidenceFileId?: string | null;
    createdAt: string;
    recordedByUser?: {
      name: string;
      email: string;
    };
  }>;
  incomingVerifications?: any[];
}

export interface GlobalDirectorySearchResult {
  id?: string;
  alumniIndexNumber: string;
  fullName: string;
  studentName?: string;
  photoUrl?: string | null;
  currentGrade?: string | null;
  gender?: string;
  leavingYear: number | null;
  admissionDate?: string | null;
  leavingDate?: string | null;
  completedProgrammes?: string[];
  madrasaName: string;
  madrasaCode: string;
  madrasaCity?: string | null;
  madrasaCountry?: string | null;
  qualificationsCount: number;
  featuredQualifications: Array<{
    title: string;
    category?: string | null;
    fieldOfStudy?: string | null;
    completionYear?: number | null;
  }>;
  hasVerifiedCertificates: boolean;
  characterAssessmentRating?: CharacterConductRating | null;
  issuingMadrasa?: {
    id: string;
    name: string;
    code: string;
    logoUrl?: string | null;
  };
  publishedAt?: string;
}

export interface GlobalAlumniProfileView {
  id?: string;
  alumniIndexNumber: string;
  studentName?: string;
  fullName: string;
  photoUrl?: string | null;
  gender?: string;
  admissionDate?: string | null;
  leavingDate?: string | null;
  admissionYear?: number | null;
  leavingYear?: number | null;
  leavingReason?: string | null;
  completedProgrammes?: string[];
  academicHighlights?: string[];
  madrasa?: {
    id: string;
    name: string;
    code: string;
    city?: string | null;
    country?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    logoUrl?: string | null;
  };
  issuingMadrasa?: {
    id: string;
    name: string;
    code: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    logoUrl?: string | null;
  };
  qualifications: Array<{
    id: string;
    recordType: string;
    category: string;
    title: string;
    fieldOfStudy?: string | null;
    issuingAuthority?: string | null;
    certificateNumber?: string | null;
    achievedDate?: string | null;
    completionYear?: number | null;
    gradeOrScore?: string | null;
    progressStatus?: string | null;
    verificationStatus: string;
    hasCertificateFile?: boolean;
    hasCertificateDocument?: boolean;
    canStreamCertificate: boolean;
  }>;
  academicAchievements?: Array<{
    title: string;
    year?: number | string;
    description?: string;
  }>;
  characterAssessment?: {
    rating?: CharacterConductRating | null;
    conductRating: CharacterConductRating | null;
    remarks?: string | null;
    officialNotes?: string | null;
    assessedByAuthority?: boolean;
  } | null;
  verificationAccessStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'OWNER';
  hasApprovedVerification?: boolean;
  verificationRequestId?: string | null;
  publishedAt?: string | null;
}

export interface VerificationRequestItem {
  id: string;
  alumniProfileId: string;
  requestingMadrasaId: string;
  issuingMadrasaId: string;
  purpose: string;
  notes?: string | null;
  status: AlumniVerificationStatus;
  requestedAt: string;
  respondedAt?: string | null;
  rejectionReason?: string | null;
  responseNotes?: string | null;
  alumniProfile: {
    alumniIndexNumber: string;
    student: {
      fullName: string;
    };
  };
  requestingMadrasa?: {
    id: string;
    name: string;
    code: string;
    city?: string | null;
  };
  issuingMadrasa?: {
    id: string;
    name: string;
    code: string;
    city?: string | null;
  };
  requestingUser?: {
    name: string;
    email: string;
  };
}

export const apiGetEligibleStudents = async (search = ''): Promise<EligibleStudentItem[]> => {
  const response = await apiClient.get<ApiResponse<EligibleStudentItem[]>>(
    '/madrasa-admin/alumni/eligible-students',
    { params: { search: search.trim() || undefined } }
  );
  const data = response.data.data;
  return Array.isArray(data) ? data : [];
};

export const apiListAlumni = async (params: {
  search?: string;
  publicationStatus?: string;
  consentStatus?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{
  data: AlumniProfileItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> => {
  const response = await apiClient.get<any>('/madrasa-admin/alumni', { params });
  const rawData = response.data.data ?? response.data.items ?? [];
  return {
    data: Array.isArray(rawData) ? rawData : [],
    pagination: response.data.pagination || { page: 1, limit: 15, total: 0, totalPages: 0 },
  };
};

export const apiGetAlumniDetails = async (alumniId: string): Promise<AlumniProfileItem> => {
  const response = await apiClient.get<ApiResponse<AlumniProfileItem>>(
    `/madrasa-admin/alumni/${alumniId}`
  );
  return response.data.data;
};

export const apiCreateAlumniProfile = async (payload: {
  studentId: string;
  leavingDate: string;
  leavingReason?: string;
  characterAssessment?: CharacterConductRating;
  characterAssessmentNotes?: string;
  academicAchievements?: Array<{ title: string; year?: number | string; description?: string }>;
  adminPrivateNotes?: string;
}): Promise<AlumniProfileItem> => {
  const response = await apiClient.post<ApiResponse<AlumniProfileItem>>(
    '/madrasa-admin/alumni',
    payload
  );
  return response.data.data;
};

export const apiUpdateAlumniProfile = async (
  alumniId: string,
  payload: {
    leavingDate?: string;
    leavingReason?: string;
    characterAssessment?: CharacterConductRating;
    characterAssessmentNotes?: string;
    academicAchievements?: Array<{ title: string; year?: number | string; description?: string }>;
    adminPrivateNotes?: string;
  }
): Promise<AlumniProfileItem> => {
  const response = await apiClient.patch<ApiResponse<AlumniProfileItem>>(
    `/madrasa-admin/alumni/${alumniId}`,
    payload
  );
  return response.data.data;
};

export const apiRecordConsent = async (
  alumniId: string,
  formData: FormData
): Promise<AlumniProfileItem> => {
  const response = await apiClient.post<ApiResponse<AlumniProfileItem>>(
    `/madrasa-admin/alumni/${alumniId}/consent`,
    formData
  );
  return response.data.data;
};

export const apiRenewConsent = async (
  alumniId: string,
  formData: FormData
): Promise<AlumniProfileItem> => {
  const response = await apiClient.post<ApiResponse<AlumniProfileItem>>(
    `/madrasa-admin/alumni/${alumniId}/consent/renew`,
    formData
  );
  return response.data.data;
};

export const apiWithdrawConsent = async (
  alumniId: string,
  reason: string
): Promise<AlumniProfileItem> => {
  const response = await apiClient.post<ApiResponse<AlumniProfileItem>>(
    `/madrasa-admin/alumni/${alumniId}/consent/withdraw`,
    { reason }
  );
  return response.data.data;
};

export const apiPublishAlumniProfile = async (alumniId: string): Promise<AlumniProfileItem> => {
  const response = await apiClient.post<ApiResponse<AlumniProfileItem>>(
    `/madrasa-admin/alumni/${alumniId}/publish`
  );
  return response.data.data;
};

export const apiUnpublishAlumniProfile = async (alumniId: string): Promise<AlumniProfileItem> => {
  const response = await apiClient.post<ApiResponse<AlumniProfileItem>>(
    `/madrasa-admin/alumni/${alumniId}/unpublish`
  );
  return response.data.data;
};

export const apiRevokeAlumniProfile = async (
  alumniId: string,
  reason: string
): Promise<AlumniProfileItem> => {
  const response = await apiClient.post<ApiResponse<AlumniProfileItem>>(
    `/madrasa-admin/alumni/${alumniId}/revoke`,
    { reason }
  );
  return response.data.data;
};

export const apiSearchGlobalDirectory = async (params: {
  indexNumber?: string;
  alumniIndexNumber?: string;
  q?: string;
  madrasa?: string;
  qualification?: string;
  studyLevel?: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: GlobalDirectorySearchResult[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> => {
  const response = await apiClient.get<any>('/madrasa-admin/alumni-network/directory', { params });
  const rawData = response.data.data ?? response.data.items ?? [];
  return {
    data: Array.isArray(rawData) ? rawData : [],
    pagination: response.data.pagination || { page: 1, limit: 12, total: 0, totalPages: 0 },
  };
};

export const apiGetGlobalAlumniProfile = async (
  indexNumber: string
): Promise<GlobalAlumniProfileView> => {
  const response = await apiClient.get<ApiResponse<GlobalAlumniProfileView>>(
    `/madrasa-admin/alumni-network/directory/${encodeURIComponent(indexNumber)}`
  );
  return response.data.data;
};

export const apiCreateVerificationRequest = async (payload: {
  alumniIndexNumber: string;
  purpose: string;
  notes?: string;
}): Promise<VerificationRequestItem> => {
  const response = await apiClient.post<ApiResponse<VerificationRequestItem>>(
    '/madrasa-admin/alumni-network/verifications',
    payload
  );
  return response.data.data;
};

export const apiListIncomingVerificationRequests = async (params: {
  status?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{
  data: VerificationRequestItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> => {
  const response = await apiClient.get<any>(
    '/madrasa-admin/alumni-network/verifications/incoming',
    { params }
  );
  const rawData = response.data.data ?? response.data.items ?? [];
  return {
    data: Array.isArray(rawData) ? rawData : [],
    pagination: response.data.pagination || { page: 1, limit: 15, total: 0, totalPages: 0 },
  };
};

export const apiListOutgoingVerificationRequests = async (params: {
  status?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{
  data: VerificationRequestItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> => {
  const response = await apiClient.get<any>(
    '/madrasa-admin/alumni-network/verifications/outgoing',
    { params }
  );
  const rawData = response.data.data ?? response.data.items ?? [];
  return {
    data: Array.isArray(rawData) ? rawData : [],
    pagination: response.data.pagination || { page: 1, limit: 15, total: 0, totalPages: 0 },
  };
};

export const apiRespondToVerificationRequest = async (
  requestId: string,
  payload: {
    action: 'APPROVE' | 'REJECT';
    notes?: string;
    rejectionReason?: string;
  }
): Promise<VerificationRequestItem> => {
  const response = await apiClient.post<ApiResponse<VerificationRequestItem>>(
    `/madrasa-admin/alumni-network/verifications/${requestId}/respond`,
    payload
  );
  return response.data.data;
};

export const apiDownloadAlumniCertificate = async (
  alumniId: string,
  qualificationId: string,
  fileName: string = 'certificate.pdf'
): Promise<void> => {
  const response = await apiClient.get(
    `/madrasa-admin/alumni-network/${alumniId}/qualifications/${qualificationId}/certificate/stream`,
    { responseType: 'blob' }
  );

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// ==========================================
// ADMISSIONS INTERVIEW MANAGEMENT MODULE
// ==========================================

export type InterviewRound = 'FIRST' | 'SECOND';
export type InterviewSchedulingMethod = 'SAME_TIME' | 'INDIVIDUAL_SLOTS';
export type InterviewAppointmentStatus = 'SCHEDULED' | 'RESCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type InterviewAttendance = 'PRESENT' | 'ABSENT';
export type InterviewResult = 'PENDING' | 'PASSED' | 'NEEDS_SECOND_INTERVIEW' | 'REJECTED';
export type InterviewEmailStatus = 'PENDING' | 'CLAIMED' | 'SENT' | 'FAILED' | 'UNCERTAIN';

export interface InterviewScheduleItem {
  id: string;
  madrasaId: string;
  admissionPeriodId: string;
  interviewRound: InterviewRound;
  schedulingMethod: InterviewSchedulingMethod;
  title: string;
  interviewDate: string;
  venue: string;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
  slotDurationMinutes?: number | null;
  instructions?: string | null;
  requiredDocuments?: string[] | null;
  admissionPeriod?: {
    id: string;
    name: string;
    code: string;
    academicYear: number;
  };
}

export interface InterviewEvaluationItem {
  id: string;
  appointmentId: string;
  attendance?: InterviewAttendance | null;
  quranRecitationScore?: number | null;
  islamicKnowledgeScore?: number | null;
  academicScore?: number | null;
  conductScore?: number | null;
  totalScore?: number | null;
  interviewerNotes?: string | null;
  recommendationNotes?: string | null;
  result: InterviewResult;
  evaluatedAt: string;
  evaluatedByUser?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface InterviewNotificationItem {
  id: string;
  appointmentId: string;
  recipientEmail: string;
  recipientName: string;
  pdfVersion: number;
  status: InterviewEmailStatus;
  claimedAt?: string | null;
  smtpMessageId?: string | null;
  sentAt?: string | null;
  errorDetails?: string | null;
  uncertainDelivery: boolean;
  retryCount: number;
  createdAt: string;
}

export interface InterviewAppointmentItem {
  id: string;
  madrasaId: string;
  scheduleId: string;
  applicationId: string;
  interviewRound: InterviewRound;
  invitationReference: string;
  interviewDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  status: InterviewAppointmentStatus;
  rescheduledFromId?: string | null;
  cancellationReason?: string | null;
  rescheduleReason?: string | null;
  fileObjectId?: string | null;
  pdfVersion: number;
  createdAt: string;
  schedule?: InterviewScheduleItem;
  application: {
    id: string;
    applicationNo: string;
    applicantName: string;
    dateOfBirth: string;
    gender: string;
    guardianName: string;
    guardianRelationship: string;
    guardianPhone: string;
    guardianEmail?: string | null;
    status: string;
    appliedClass?: {
      id: string;
      name: string;
    };
  };
  evaluation?: InterviewEvaluationItem | null;
  notifications?: InterviewNotificationItem[];
  fileObject?: {
    id: string;
    objectKey: string;
    originalName: string;
    size: number;
  };
}

export interface InterviewDashboardStats {
  totalAppointments: number;
  statuses: {
    scheduled: number;
    completed: number;
    cancelled: number;
    rescheduled: number;
    noShow: number;
  };
  rounds: {
    first: number;
    second: number;
  };
  attendance: {
    present: number;
    absent: number;
    unrecorded: number;
  };
  results: {
    passed: number;
    needsSecondRound: number;
    rejected: number;
    pending: number;
  };
  emails: {
    sent: number;
    pending: number;
    failed: number;
    uncertain: number;
  };
}

export interface EligibleApplicantItem {
  id: string;
  applicationNo: string;
  applicantName: string;
  dateOfBirth: string;
  gender: string;
  guardianName: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianEmail?: string | null;
  status: string;
  submittedAt: string;
  admissionPeriod: {
    id: string;
    name: string;
    code: string;
    academicYear: number;
  };
  appliedClass?: {
    id: string;
    name: string;
  };
  interviewAppointments?: {
    id: string;
    interviewRound: InterviewRound;
    status: InterviewAppointmentStatus;
    interviewDate: string;
    startTime: string;
    endTime: string;
    evaluation?: {
      result: InterviewResult;
      attendance?: InterviewAttendance | null;
      totalScore?: number | null;
    };
  }[];
}

export interface CreateBulkSchedulePayload {
  admissionPeriodId: string;
  interviewRound?: InterviewRound;
  schedulingMethod: InterviewSchedulingMethod;
  title: string;
  interviewDate: string;
  venue: string;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
  slotDurationMinutes?: number | null;
  instructions?: string | null;
  requiredDocuments?: string[] | null;
  applicationIds: string[];
  slotAllocations?: {
    applicationId: string;
    startTime: string;
    endTime: string;
  }[];
}

export const apiGetEligibleInterviewApplicants = async (params: {
  admissionPeriodId?: string;
  interviewRound?: InterviewRound;
  search?: string;
} = {}): Promise<EligibleApplicantItem[]> => {
  const response = await apiClient.get<ApiResponse<EligibleApplicantItem[]>>(
    '/madrasa-admin/admissions/interviews/eligible-applicants',
    { params }
  );
  return response.data.data;
};

export const apiCreateBulkInterviewSchedule = async (
  payload: CreateBulkSchedulePayload
): Promise<{ success: boolean; schedule: InterviewScheduleItem; appointmentsCount: number; appointmentIds: string[] }> => {
  const response = await apiClient.post<ApiResponse<{ success: boolean; schedule: InterviewScheduleItem; appointmentsCount: number; appointmentIds: string[] }>>(
    '/madrasa-admin/admissions/interviews/schedule',
    payload
  );
  return response.data.data;
};

export const apiListInterviewAppointments = async (params: {
  admissionPeriodId?: string;
  interviewRound?: InterviewRound;
  status?: InterviewAppointmentStatus;
  result?: InterviewResult;
  attendance?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ appointments: InterviewAppointmentItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> => {
  const response = await apiClient.get<any>(
    '/madrasa-admin/admissions/interviews/appointments',
    { params }
  );
  const rawData = response.data?.data;
  const appointments: InterviewAppointmentItem[] = Array.isArray(rawData)
    ? rawData
    : (rawData?.appointments || []);
  const pagination = response.data?.pagination || rawData?.pagination || {
    total: appointments.length,
    page: params.page || 1,
    limit: params.limit || 15,
    totalPages: Math.max(1, Math.ceil(appointments.length / (params.limit || 15))),
  };
  return { appointments, pagination };
};

export const apiGetInterviewAppointmentById = async (id: string): Promise<InterviewAppointmentItem> => {
  const response = await apiClient.get<ApiResponse<InterviewAppointmentItem>>(
    `/madrasa-admin/admissions/interviews/appointments/${id}`
  );
  return response.data.data;
};

export const apiRescheduleInterviewAppointment = async (
  id: string,
  payload: {
    interviewDate: string;
    startTime: string;
    endTime: string;
    venue?: string;
    rescheduleReason?: string;
  }
): Promise<InterviewAppointmentItem> => {
  const response = await apiClient.post<ApiResponse<InterviewAppointmentItem>>(
    `/madrasa-admin/admissions/interviews/appointments/${id}/reschedule`,
    payload
  );
  return response.data.data;
};

export const apiCancelInterviewAppointment = async (
  id: string,
  payload: { cancellationReason: string }
): Promise<InterviewAppointmentItem> => {
  const response = await apiClient.post<ApiResponse<InterviewAppointmentItem>>(
    `/madrasa-admin/admissions/interviews/appointments/${id}/cancel`,
    payload
  );
  return response.data.data;
};

export const apiEvaluateInterviewAppointment = async (
  id: string,
  payload: {
    attendance?: InterviewAttendance | null;
    quranRecitationScore?: number | null;
    islamicKnowledgeScore?: number | null;
    academicScore?: number | null;
    conductScore?: number | null;
    totalScore?: number | null;
    interviewerNotes?: string | null;
    recommendationNotes?: string | null;
    result?: InterviewResult;
  }
): Promise<InterviewEvaluationItem> => {
  const response = await apiClient.post<ApiResponse<InterviewEvaluationItem>>(
    `/madrasa-admin/admissions/interviews/appointments/${id}/evaluate`,
    payload
  );
  return response.data.data;
};

export const apiGetInterviewDashboardStats = async (params?: {
  admissionPeriodId?: string;
}): Promise<InterviewDashboardStats> => {
  const response = await apiClient.get<ApiResponse<InterviewDashboardStats>>(
    '/madrasa-admin/admissions/interviews/stats',
    { params }
  );
  return response.data.data;
};

export const apiGetApplicantInterviewHistory = async (applicationId: string): Promise<InterviewAppointmentItem[]> => {
  const response = await apiClient.get<ApiResponse<InterviewAppointmentItem[]>>(
    `/madrasa-admin/admissions/interviews/history/${applicationId}`
  );
  return response.data.data;
};

export const apiDownloadInterviewInvitationPdf = async (
  id: string,
  fileName: string = 'Interview_Invitation.pdf'
): Promise<void> => {
  const response = await apiClient.get(
    `/madrasa-admin/admissions/interviews/appointments/${id}/preview-pdf`,
    { responseType: 'blob' }
  );

  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const apiSendInterviewEmailNotification = async (
  id: string,
  forceRetry: boolean = false
): Promise<{ success: boolean; notification: InterviewNotificationItem; message?: string }> => {
  const response = await apiClient.post<ApiResponse<{ success: boolean; notification: InterviewNotificationItem; message?: string }>>(
    `/madrasa-admin/admissions/interviews/appointments/${id}/send-email`,
    { forceRetry }
  );
  return response.data as any;
};

export const apiRetryInterviewNotifications = async (payload: {
  notificationIds?: string[];
  appointmentId?: string;
  force?: boolean;
}): Promise<{ attempted: number; successful: number; failed: number }> => {
  const response = await apiClient.post<ApiResponse<{ attempted: number; successful: number; failed: number }>>(
    '/madrasa-admin/admissions/interviews/notifications/retry',
    payload
  );
  return response.data.data;
};

export const apiMarkUncertainNotificationDelivered = async (
  notificationId: string,
  smtpMessageId?: string
): Promise<InterviewNotificationItem> => {
  const response = await apiClient.post<ApiResponse<InterviewNotificationItem>>(
    `/madrasa-admin/admissions/interviews/notifications/${notificationId}/mark-delivered`,
    { smtpMessageId }
  );
  return response.data.data;
};

export const apiConfirmUncertainNotificationFailed = async (
  notificationId: string
): Promise<InterviewNotificationItem> => {
  const response = await apiClient.post<ApiResponse<InterviewNotificationItem>>(
    `/madrasa-admin/admissions/interviews/notifications/${notificationId}/confirm-failed`
  );
  return response.data.data;
};

export default apiClient;
