import { apiClient } from './api';

export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type AnnouncementAudience = 'ALL_MADRASAS' | 'SELECTED_MADRASAS';
export type AnnouncementPriority = 'NORMAL' | 'IMPORTANT' | 'URGENT';
export type AnnouncementCategory =
  | 'GENERAL'
  | 'SYSTEM'
  | 'MAINTENANCE'
  | 'UPDATE'
  | 'BILLING'
  | 'EVENT'
  | 'OTHER';

export interface TargetMadrasaItem {
  madrasaId: string;
  name?: string;
  code?: string;
  status?: string;
}

export interface AnnouncementReadItem {
  userId: string;
  userName?: string;
  userEmail?: string;
  madrasaName?: string;
  madrasaCode?: string;
  readAt: string;
}

export interface SuperAdminAnnouncementItem {
  id: string;
  title: string;
  message: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  publishAt: string | null;
  expiresAt: string | null;
  publishedAt: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  isScheduled: boolean;
  isExpired: boolean;
  targetMadrasaCount: number;
  readCount: number;
  targets: TargetMadrasaItem[];
  reads?: AnnouncementReadItem[];
}

export interface SuperAdminAnnouncementsResponse {
  announcements: SuperAdminAnnouncementItem[];
  counts: {
    total: number;
    published: number;
    draft: number;
    archived: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MadrasaAnnouncementItem {
  id: string;
  title: string;
  message: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  audience?: AnnouncementAudience;
  publishAt: string | null;
  expiresAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  isRead: boolean;
  readAt: string | null;
}

export interface MadrasaAnnouncementsResponse {
  announcements: MadrasaAnnouncementItem[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateAnnouncementPayload {
  title: string;
  message: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  publishAt?: string | null;
  expiresAt?: string | null;
  selectedMadrasaIds?: string[] | null;
}

export interface UpdateAnnouncementPayload {
  title?: string;
  message?: string;
  category?: AnnouncementCategory;
  priority?: AnnouncementPriority;
  audience?: AnnouncementAudience;
  publishAt?: string | null;
  expiresAt?: string | null;
  selectedMadrasaIds?: string[] | null;
}

export interface PublishAnnouncementPayload {
  publishAt?: string | null;
  expiresAt?: string | null;
}

export const announcementService = {
  // Super Admin Methods
  async listSuperAdminAnnouncements(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    category?: string;
    priority?: string;
    audience?: string;
  }): Promise<SuperAdminAnnouncementsResponse> {
    const res = await apiClient.get<{ success: boolean; data: SuperAdminAnnouncementsResponse }>(
      '/super-admin/announcements',
      { params }
    );
    return res.data.data;
  },

  async getSuperAdminAnnouncement(id: string): Promise<SuperAdminAnnouncementItem> {
    const res = await apiClient.get<{ success: boolean; data: SuperAdminAnnouncementItem }>(
      `/super-admin/announcements/${id}`
    );
    return res.data.data;
  },

  async createAnnouncement(data: CreateAnnouncementPayload): Promise<SuperAdminAnnouncementItem> {
    const res = await apiClient.post<{ success: boolean; data: SuperAdminAnnouncementItem }>(
      '/super-admin/announcements',
      data
    );
    return res.data.data;
  },

  async updateAnnouncement(
    id: string,
    data: UpdateAnnouncementPayload
  ): Promise<SuperAdminAnnouncementItem> {
    const res = await apiClient.put<{ success: boolean; data: SuperAdminAnnouncementItem }>(
      `/super-admin/announcements/${id}`,
      data
    );
    return res.data.data;
  },

  async publishAnnouncement(
    id: string,
    data?: PublishAnnouncementPayload
  ): Promise<SuperAdminAnnouncementItem> {
    const res = await apiClient.post<{ success: boolean; data: SuperAdminAnnouncementItem }>(
      `/super-admin/announcements/${id}/publish`,
      data || {}
    );
    return res.data.data;
  },

  async archiveAnnouncement(id: string): Promise<SuperAdminAnnouncementItem> {
    const res = await apiClient.post<{ success: boolean; data: SuperAdminAnnouncementItem }>(
      `/super-admin/announcements/${id}/archive`
    );
    return res.data.data;
  },

  async unpublishAnnouncement(id: string): Promise<SuperAdminAnnouncementItem> {
    const res = await apiClient.post<{ success: boolean; data: SuperAdminAnnouncementItem }>(
      `/super-admin/announcements/${id}/unpublish`
    );
    return res.data.data;
  },

  // Madrasa Admin Methods
  async listMadrasaAnnouncements(params?: {
    page?: number;
    limit?: number;
    readStatus?: 'ALL' | 'READ' | 'UNREAD';
    category?: string;
    priority?: string;
    search?: string;
  }): Promise<MadrasaAnnouncementsResponse> {
    const res = await apiClient.get<{ success: boolean; data: MadrasaAnnouncementsResponse }>(
      '/madrasa-admin/announcements',
      { params }
    );
    return res.data.data;
  },

  async getMadrasaAnnouncement(id: string): Promise<MadrasaAnnouncementItem> {
    const res = await apiClient.get<{ success: boolean; data: MadrasaAnnouncementItem }>(
      `/madrasa-admin/announcements/${id}`
    );
    return res.data.data;
  },

  async markAnnouncementAsRead(id: string): Promise<{ readAt: string }> {
    const res = await apiClient.post<{ success: boolean; data: { readAt: string } }>(
      `/madrasa-admin/announcements/${id}/read`
    );
    return res.data.data;
  },

  async markAllAnnouncementsAsRead(): Promise<{ markedCount: number }> {
    const res = await apiClient.post<{ success: boolean; data: { markedCount: number } }>(
      '/madrasa-admin/announcements/mark-all-read'
    );
    return res.data.data;
  },

  async getMadrasaUnreadCount(): Promise<number> {
    const res = await apiClient.get<{ success: boolean; data: { unreadCount: number } }>(
      '/madrasa-admin/announcements/unread-count'
    );
    return res.data.data.unreadCount;
  },

  async getMadrasaLatestAnnouncements(limit = 5): Promise<MadrasaAnnouncementItem[]> {
    const res = await apiClient.get<{
      success: boolean;
      data: { announcements: MadrasaAnnouncementItem[] };
    }>('/madrasa-admin/announcements/latest', { params: { limit } });
    return res.data.data.announcements;
  },
};
