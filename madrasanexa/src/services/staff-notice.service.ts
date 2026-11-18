import { apiClient } from './api';

export interface ReadReceiptUser {
  ustadhId: string;
  fullName: string;
  ustadhCode: string;
  staffType: string;
  readAt?: string;
}

export interface StaffNoticeStats {
  totalRecipients: number;
  readCount: number;
  unreadCount: number;
  readRate: number;
  readBy: ReadReceiptUser[];
  unreadBy: ReadReceiptUser[];
}

export interface StaffNoticeItem {
  id: string;
  title: string;
  message: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  category: 'GENERAL' | 'SCHEDULE' | 'EXAM' | 'PAYROLL' | 'EVENT';
  targetType: 'ALL_TEACHERS' | 'CLASS' | 'SPECIFIC_USTADHS';
  targetClass?: { id: string; name: string; code?: string | null } | null;
  targetUstadhIds?: string[] | null;
  createdAt: string;
  updatedAt: string;
  senderName: string;
  stats: StaffNoticeStats;
}

export interface StaffNoticeKPIs {
  totalSent: number;
  urgentCount: number;
  avgReadRate: number;
  activeStaffCount: number;
}

export interface StaffNoticeListResponse {
  kpis: StaffNoticeKPIs;
  activeStaff: Array<{ id: string; ustadhCode: string; fullName: string; staffType: string }>;
  notices: StaffNoticeItem[];
}

export interface CreateStaffNoticePayload {
  title: string;
  message: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  category: 'GENERAL' | 'SCHEDULE' | 'EXAM' | 'PAYROLL' | 'EVENT';
  targetType: 'ALL_TEACHERS' | 'CLASS' | 'SPECIFIC_USTADHS';
  targetClassId?: string | null;
  targetUstadhIds?: string[] | null;
}

export async function getStaffNotices(params: {
  search?: string;
  priority?: string;
  category?: string;
} = {}): Promise<StaffNoticeListResponse> {
  const res = await apiClient.get<{ success: boolean; data: StaffNoticeListResponse }>('/madrasa-admin/staff-notices', {
    params,
  });
  return res.data.data;
}

export async function createStaffNotice(payload: CreateStaffNoticePayload): Promise<StaffNoticeItem> {
  const res = await apiClient.post<{ success: boolean; data: StaffNoticeItem }>('/madrasa-admin/staff-notices', payload);
  return res.data.data;
}

export async function deleteStaffNotice(id: string): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.delete<{ success: boolean; data: { success: boolean; message: string } }>(`/madrasa-admin/staff-notices/${id}`);
  return res.data.data;
}
