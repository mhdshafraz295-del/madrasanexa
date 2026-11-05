import apiClient from './api';

export interface SubscriptionPaymentSubmissionItem {
  id: string;
  madrasa: {
    id: string;
    name: string;
    code: string;
    contactEmail?: string;
    contactName?: string;
  };
  plan: {
    id: string;
    name: string;
    code: string;
    durationMonths: number;
    expectedPrice: number;
  };
  submittedAmount: number;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  reviewedBy: {
    id: string;
    name: string;
  } | null;
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

export interface ListSuperAdminSubmissionsResponse {
  success: boolean;
  data: SubscriptionPaymentSubmissionItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  counts?: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
  kpis?: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
}

export interface ListSubmissionsQuery {
  page?: number;
  limit?: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
  search?: string;
}

/**
 * Super Admin: List all subscription payment submissions with filters
 */
export const apiListSuperAdminSubmissions = async (
  query?: ListSubmissionsQuery
): Promise<ListSuperAdminSubmissionsResponse> => {
  const response = await apiClient.get<ListSuperAdminSubmissionsResponse>(
    '/super-admin/subscription-payments',
    { params: query }
  );
  return response.data;
};

/**
 * Super Admin: Get single payment submission detail
 */
export const apiGetSuperAdminSubmissionDetail = async (
  id: string
): Promise<SubscriptionPaymentSubmissionItem> => {
  const response = await apiClient.get<{ success: boolean; data: SubscriptionPaymentSubmissionItem }>(
    `/super-admin/subscription-payments/${id}`
  );
  return response.data.data;
};

/**
 * Super Admin: Approve pending subscription payment submission
 */
export const apiApproveSubscriptionPayment = async (
  id: string
): Promise<any> => {
  const response = await apiClient.post(`/super-admin/subscription-payments/${id}/approve`);
  return response.data;
};

/**
 * Super Admin: Reject subscription payment submission
 */
export const apiRejectSubscriptionPayment = async (
  id: string,
  rejectionReason: string
): Promise<any> => {
  const response = await apiClient.post(`/super-admin/subscription-payments/${id}/reject`, {
    rejectionReason,
  });
  return response.data;
};

export interface SecureReceiptData {
  id: string;
  submissionId: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  expiresIn: number;
}

/**
 * Super Admin: Request authorized temporary signed receipt URL on demand
 * Never persists or exposes permanent public R2 URL.
 */
export const apiGetSuperAdminReceiptUrl = async (
  submissionId: string
): Promise<SecureReceiptData> => {
  const response = await apiClient.get<{ success: boolean; data: SecureReceiptData }>(
    `/super-admin/subscription-payments/${submissionId}/receipt`
  );
  return response.data.data;
};
