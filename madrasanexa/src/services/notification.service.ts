import { apiClient } from './api';

export type NotificationChannel = 'SMS' | 'EMAIL';
export type NotificationStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED'
  | 'DELIVERY_UNKNOWN'
  | 'SKIPPED_NO_RECIPIENT';

export type NotificationEventType =
  | 'FEE_PARTIAL_PAYMENT'
  | 'FEE_FULLY_PAID'
  | 'FEE_MONTH_END_REMINDER'
  | 'SALARY_PAID'
  | 'TIMETABLE_FINALIZED';

export type TimetableRecipientScope =
  | 'ALL_TEACHING_STAFF'
  | 'USTADH_ONLY'
  | 'SCHOOL_TEACHER_ONLY'
  | 'SELECTED_STAFF'
  | 'AFFECTED_STAFF_ONLY';

export interface NotificationJob {
  id: string;
  madrasaId: string;
  channel: NotificationChannel;
  eventType: NotificationEventType;
  recipientType: 'GUARDIAN' | 'STAFF';
  recipientEntityId: string;
  recipientAddress: string;
  recipientName: string | null;
  subject: string | null;
  message: string;
  payloadJson: any;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  dedupeKey: string;
  status: NotificationStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  processingStartedAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSettings {
  autoFeePaymentSmsEnabled: boolean;
  autoPartialFeeSmsEnabled: boolean;
  autoFeeReminderSmsEnabled: boolean;
  autoFeePaymentEmailEnabled: boolean;
  autoPartialFeeEmailEnabled: boolean;
  autoFeeReminderEmailEnabled: boolean;
  autoSalaryPaidEmailEnabled: boolean;
  feeReminderSendTime: string;
  timezone: string;
}

export interface UpdateNotificationSettingsPayload {
  autoFeePaymentSmsEnabled?: boolean;
  autoPartialFeeSmsEnabled?: boolean;
  autoFeeReminderSmsEnabled?: boolean;
  autoFeePaymentEmailEnabled?: boolean;
  autoPartialFeeEmailEnabled?: boolean;
  autoFeeReminderEmailEnabled?: boolean;
  autoSalaryPaidEmailEnabled?: boolean;
  feeReminderSendTime?: string;
}

export interface NotificationJobsQuery {
  page?: number;
  pageSize?: number;
  channel?: string;
  status?: string;
  eventType?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface NotificationJobsResponse {
  items: NotificationJob[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface TimetablePublication {
  id: string;
  idempotencyKey: string;
  effectiveDate: string | null;
  sendEmail: boolean;
  recipientScope: TimetableRecipientScope;
  staffCount: number;
  queuedCount: number;
  skippedCount: number;
  scheduleFingerprint: string;
  publishedById: string;
  publishedBy?: { id: string; name: string; email: string };
  publishedAt: string;
}

export interface FinalizeTimetablePayload {
  idempotencyKey: string;
  effectiveDate: string;
  sendEmail: boolean;
  recipientScope: TimetableRecipientScope;
  selectedStaffIds?: string[] | null;
  notes?: string | null;
}

export const notificationService = {
  async getSettings(): Promise<NotificationSettings> {
    const res = await apiClient.get('/madrasa-admin/notifications/settings');
    return res.data.data;
  },

  async updateSettings(data: UpdateNotificationSettingsPayload): Promise<NotificationSettings> {
    const res = await apiClient.patch('/madrasa-admin/notifications/settings', data);
    return res.data.data;
  },

  async listJobs(params: NotificationJobsQuery = {}): Promise<NotificationJobsResponse> {
    const res = await apiClient.get('/madrasa-admin/notifications/jobs', { params });
    return res.data;
  },

  async getJobById(id: string): Promise<NotificationJob> {
    const res = await apiClient.get(`/madrasa-admin/notifications/jobs/${id}`);
    return res.data.data;
  },

  async retryJob(id: string): Promise<NotificationJob> {
    const res = await apiClient.post(`/madrasa-admin/notifications/jobs/${id}/retry`);
    return res.data.data;
  },

  async listTimetablePublications(): Promise<TimetablePublication[]> {
    const res = await apiClient.get('/madrasa-admin/timetable/publications');
    return res.data.data;
  },

  async finalizeTimetable(payload: FinalizeTimetablePayload): Promise<TimetablePublication> {
    const res = await apiClient.post('/madrasa-admin/timetable/finalize', payload);
    return res.data.data;
  },
};
