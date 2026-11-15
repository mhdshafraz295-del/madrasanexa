import { apiClient } from './api';

// ==========================================
// TYPES & ENUMS
// ==========================================

export type GateEventType = 'ENTRY' | 'EXIT';

export type GateEmailStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'SKIPPED_NO_RECIPIENT'
  | 'NOT_APPLICABLE';

export type StudentCategory = 'DAY_SCHOLAR' | 'BOARDING';

export interface GateScanPayload {
  token: string;
  eventType: GateEventType;
  idempotencyKey?: string;
}

export interface GateEventRecord {
  id: string;
  madrasaId: string;
  studentId: string;
  recordedByUserId: string;
  eventType: GateEventType;
  category: StudentCategory;
  scannedAt: string;
  idempotencyKey?: string | null;
  emailStatus: GateEmailStatus;
  emailSkipReason?: string | null;
  emailError?: string | null;
  attemptCount?: number;
  nextAttemptAt?: string | null;
  sentAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GateScanStudent {
  id: string;
  admissionNo: string;
  fullName: string;
  category: StudentCategory;
  photoFileId?: string | null;
  class?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
}

export interface GateScanAttendanceResult {
  reconciled: boolean;
  sessionId?: string;
  recordId?: string;
  status?: 'PRESENT' | 'ABSENT';
  date?: string;
  reason?: string;
}

export interface GateScanResult {
  idempotentReplay: boolean;
  event: GateEventRecord;
  student: GateScanStudent;
  attendance?: GateScanAttendanceResult;
}

export interface GateScanApiResponse {
  success: boolean;
  message: string;
  data: GateScanResult;
}

export interface GateEventItem extends GateEventRecord {
  student: GateScanStudent;
  recordedByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface GateEventsPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GateEventsApiResponse {
  success: boolean;
  data: {
    events: GateEventItem[];
    pagination: GateEventsPagination;
  };
}

export interface GateEventsQueryParams {
  page?: number;
  limit?: number;
  date?: string;
  studentId?: string;
  classId?: string;
  eventType?: GateEventType;
  emailStatus?: GateEmailStatus;
}

export interface GateSettings {
  gateParentEmailNotificationsEnabled: boolean;
  autoGateAttendanceReconciliation: boolean;
  timezone: string;
}

export interface GateSettingsApiResponse {
  success: boolean;
  data: GateSettings;
}

export interface UpdateGateSettingsPayload {
  gateParentEmailNotificationsEnabled?: boolean;
  autoGateAttendanceReconciliation?: boolean;
}

export interface UpdateGateSettingsApiResponse {
  success: boolean;
  message: string;
  data: GateSettings;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Robust UUIDv4 generator for scan idempotency.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ==========================================
// API CLIENT METHODS
// ==========================================

/**
 * POST /api/gate/scan
 * Operator scan card at gate (ENTRY or EXIT)
 */
export async function apiScanGateCard(payload: GateScanPayload): Promise<GateScanApiResponse> {
  const response = await apiClient.post<GateScanApiResponse>('/gate/scan', payload);
  return response.data;
}

/**
 * GET /api/gate/events
 * Retrieves paginated gate audit events with filters
 */
export async function apiGetGateEvents(params?: GateEventsQueryParams): Promise<GateEventsApiResponse> {
  const response = await apiClient.get<GateEventsApiResponse>('/gate/events', { params });
  return response.data;
}

/**
 * GET /api/gate/settings
 * Retrieves tenant gate settings
 */
export async function apiGetGateSettings(): Promise<GateSettingsApiResponse> {
  const response = await apiClient.get<GateSettingsApiResponse>('/gate/settings');
  return response.data;
}

/**
 * PATCH /api/gate/settings
 * Updates tenant gate settings (Admin only)
 */
export async function apiUpdateGateSettings(
  payload: UpdateGateSettingsPayload
): Promise<UpdateGateSettingsApiResponse> {
  const response = await apiClient.patch<UpdateGateSettingsApiResponse>('/gate/settings', payload);
  return response.data;
}
