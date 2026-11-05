import { apiClient } from './api';

export type Weekday = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type UstadhSalaryStatus = 'PENDING' | 'PAID';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
export type TeachingStaffType = 'USTADH' | 'SCHOOL_TEACHER';

export interface UstadhItem {
  id: string;
  madrasaId: string;
  ustadhCode: string;
  staffType: TeachingStaffType;
  fullName: string;
  phoneNumber?: string | null;
  whatsappNumber?: string | null;
  normalizedWhatsApp?: string;
  email?: string | null;
  address?: string | null;
  joinDate: string;
  leaveDate?: string | null;
  baseMonthlySalary: number;
  isActive: boolean;
  notes?: string | null;
  activeScheduleCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UstadhScheduleItem {
  id: string;
  madrasaId: string;
  ustadhId: string;
  classId: string;
  subjectId: string;
  dayOfWeek: Weekday;
  startMinutes: number;
  endMinutes: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
  ustadh?: {
    id: string;
    fullName: string;
    ustadhCode: string;
    staffType?: TeachingStaffType;
    phoneNumber?: string | null;
    whatsappNumber?: string | null;
  };
  class?: { id: string; name: string; code?: string | null };
  subject?: { id: string; name: string; code?: string | null };
  createdAt?: string;
  updatedAt?: string;
}

export interface StaffDailySessionItem {
  scheduleId: string;
  ustadhId: string;
  ustadhName: string;
  ustadhCode: string;
  staffType?: TeachingStaffType;
  phoneNumber?: string | null;
  whatsappNumber?: string | null;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  startMinutes: number;
  endMinutes: number;
  status: 'PRESENT' | 'ABSENT' | null;
  isSaved: boolean;
  updatedAt?: string;
}

export interface StaffDailyAttendanceData {
  date: string;
  weekday: Weekday;
  isSaved: boolean;
  summary: {
    totalScheduled: number;
    presentCount: number;
    absentCount: number;
    notMarkedCount: number;
    attendanceRate: number;
  };
  sessions: StaffDailySessionItem[];
}

export interface StaffAttendanceHistoryItem {
  id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT';
  ustadh: { id: string; fullName: string; ustadhCode: string };
  schedule: {
    id: string;
    dayOfWeek: Weekday;
    startMinutes: number;
    endMinutes: number;
    class: { id: string; name: string; code?: string | null };
    subject: { id: string; name: string; code?: string | null };
  };
  updatedAt: string;
}

export interface MonthlyStaffAttendanceItem {
  ustadhId: string;
  ustadhName: string;
  ustadhCode: string;
  recordedSessions: number;
  presentSessions: number;
  absentSessions: number;
  attendancePercentage: number;
}

export interface UstadhSalaryItem {
  id: string;
  madrasaId: string;
  ustadhId: string;
  salaryMonth: string;
  baseSalarySnapshot: number;
  payableAmount: number;
  adjustmentReason?: string | null;
  status: UstadhSalaryStatus;
  paymentMethod?: PaymentMethod | null;
  paymentMethodLabel?: string;
  paymentDate?: string | null;
  paymentReference?: string | null;
  paymentNote?: string | null;
  paidById?: string | null;
  paidBy?: { id: string; name: string; email?: string } | null;
  paidAt?: string | null;
  ustadh: {
    id: string;
    fullName: string;
    ustadhCode: string;
    staffType?: TeachingStaffType;
    phoneNumber?: string | null;
    whatsappNumber?: string | null;
    email?: string | null;
  };
  attendance?: {
    recordedSessions: number;
    presentSessions: number;
    absentSessions: number;
    attendancePercentage: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ==========================================
// USTADH PROFILES
// ==========================================

export async function createUstadh(payload: {
  ustadhCode?: string;
  staffType?: TeachingStaffType;
  fullName: string;
  phoneNumber?: string | null;
  whatsappNumber?: string | null;
  email?: string | null;
  address?: string | null;
  joinDate: string;
  leaveDate?: string | null;
  baseMonthlySalary: number;
  notes?: string | null;
  isActive?: boolean;
}): Promise<UstadhItem> {
  const res = await apiClient.post<{ success: boolean; data: UstadhItem }>('/madrasa-admin/ustadhs', payload);
  return res.data.data;
}

export async function listUstadhs(query: { search?: string; isActive?: boolean | string; staffType?: TeachingStaffType | string; page?: number; pageSize?: number } = {}): Promise<{
  items: UstadhItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const params = new URLSearchParams();
  if (query.search) params.append('search', query.search);
  if (query.isActive !== undefined && query.isActive !== '') params.append('isActive', String(query.isActive));
  if (query.staffType && query.staffType !== 'ALL') params.append('staffType', query.staffType);
  if (query.page) params.append('page', String(query.page));
  if (query.pageSize) params.append('pageSize', String(query.pageSize));

  const res = await apiClient.get<{ success: boolean; data: any }>(`/madrasa-admin/ustadhs?${params.toString()}`);
  return res.data.data;
}

export async function getUstadh(id: string): Promise<UstadhItem & { schedules: UstadhScheduleItem[] }> {
  const res = await apiClient.get<{ success: boolean; data: any }>(`/madrasa-admin/ustadhs/${id}`);
  return res.data.data;
}

export async function updateUstadh(id: string, payload: Partial<UstadhItem>): Promise<UstadhItem> {
  const res = await apiClient.patch<{ success: boolean; data: UstadhItem }>(`/madrasa-admin/ustadhs/${id}`, payload);
  return res.data.data;
}

export async function sendUstadhEmail(id: string, payload: { subject: string; message: string }): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.post<{ success: boolean; message: string }>(`/madrasa-admin/ustadhs/${id}/email`, payload);
  return res.data;
}

// ==========================================
// WEEKLY SCHEDULES
// ==========================================

export async function createSchedule(payload: {
  ustadhId: string;
  classId: string;
  subjectId: string;
  dayOfWeek: Weekday;
  startMinutes: number;
  endMinutes: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive?: boolean;
}): Promise<UstadhScheduleItem> {
  const res = await apiClient.post<{ success: boolean; data: UstadhScheduleItem }>('/madrasa-admin/ustadh-schedules', payload);
  return res.data.data;
}

export async function listSchedules(query: {
  ustadhId?: string;
  classId?: string;
  subjectId?: string;
  dayOfWeek?: Weekday;
  isActive?: boolean | string;
} = {}): Promise<{ items: UstadhScheduleItem[]; total: number }> {
  const params = new URLSearchParams();
  if (query.ustadhId) params.append('ustadhId', query.ustadhId);
  if (query.classId) params.append('classId', query.classId);
  if (query.subjectId) params.append('subjectId', query.subjectId);
  if (query.dayOfWeek) params.append('dayOfWeek', query.dayOfWeek);
  if (query.isActive !== undefined && query.isActive !== '') params.append('isActive', String(query.isActive));

  const res = await apiClient.get<{ success: boolean; data: any }>(`/madrasa-admin/ustadh-schedules?${params.toString()}`);
  return res.data.data;
}

export async function updateSchedule(id: string, payload: Partial<UstadhScheduleItem>): Promise<UstadhScheduleItem> {
  const res = await apiClient.patch<{ success: boolean; data: UstadhScheduleItem }>(`/madrasa-admin/ustadh-schedules/${id}`, payload);
  return res.data.data;
}

export async function deleteSchedule(id: string): Promise<{ success: boolean; message: string; deactivated?: boolean; deleted?: boolean }> {
  const res = await apiClient.delete<{ success: boolean; message: string; deactivated?: boolean; deleted?: boolean }>(`/madrasa-admin/ustadh-schedules/${id}`);
  return res.data;
}

// ==========================================
// STAFF ATTENDANCE
// ==========================================

export async function getStaffAttendance(date: string): Promise<StaffDailyAttendanceData> {
  const res = await apiClient.get<{ success: boolean; data: StaffDailyAttendanceData }>(`/madrasa-admin/ustadh-attendance?date=${date}`);
  return res.data.data;
}

export async function saveStaffAttendance(payload: {
  date: string;
  records: Array<{ scheduleId: string; status: 'PRESENT' | 'ABSENT' }>;
}): Promise<StaffDailyAttendanceData> {
  const res = await apiClient.put<{ success: boolean; data: StaffDailyAttendanceData }>('/madrasa-admin/ustadh-attendance', payload);
  return res.data.data;
}

export async function getStaffAttendanceHistory(query: {
  ustadhId?: string;
  classId?: string;
  startDate?: string;
  endDate?: string;
  status?: 'PRESENT' | 'ABSENT';
  page?: number;
  pageSize?: number;
} = {}): Promise<{
  items: StaffAttendanceHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const params = new URLSearchParams();
  if (query.ustadhId) params.append('ustadhId', query.ustadhId);
  if (query.classId) params.append('classId', query.classId);
  if (query.startDate) params.append('startDate', query.startDate);
  if (query.endDate) params.append('endDate', query.endDate);
  if (query.status) params.append('status', query.status);
  if (query.page) params.append('page', String(query.page));
  if (query.pageSize) params.append('pageSize', String(query.pageSize));

  const res = await apiClient.get<{ success: boolean; data: any }>(`/madrasa-admin/ustadh-attendance/history?${params.toString()}`);
  return res.data.data;
}

export async function getMonthlyStaffAttendanceSummary(month: string, ustadhId?: string): Promise<{
  month: string;
  totalRecords: number;
  items: MonthlyStaffAttendanceItem[];
}> {
  const params = new URLSearchParams({ month });
  if (ustadhId) params.append('ustadhId', ustadhId);

  const res = await apiClient.get<{ success: boolean; data: any }>(`/madrasa-admin/ustadh-attendance/monthly-summary?${params.toString()}`);
  return res.data.data;
}

// ==========================================
// MONTHLY SALARIES
// ==========================================

export async function generateSalaries(month: string): Promise<{
  items: UstadhSalaryItem[];
  total: number;
}> {
  const res = await apiClient.post<{ success: boolean; data: any }>('/madrasa-admin/ustadh-salaries/generate', { month });
  return res.data.data;
}

export async function listSalaries(query: {
  month?: string;
  ustadhId?: string;
  status?: UstadhSalaryStatus;
  staffType?: TeachingStaffType | string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{
  items: UstadhSalaryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const params = new URLSearchParams();
  if (query.month) params.append('month', query.month);
  if (query.ustadhId) params.append('ustadhId', query.ustadhId);
  if (query.status) params.append('status', query.status);
  if (query.staffType && query.staffType !== 'ALL') params.append('staffType', query.staffType);
  if (query.page) params.append('page', String(query.page));
  if (query.pageSize) params.append('pageSize', String(query.pageSize));

  const res = await apiClient.get<{ success: boolean; data: any }>(`/madrasa-admin/ustadh-salaries?${params.toString()}`);
  return res.data.data;
}

export async function updateSalaryPayable(id: string, payload: {
  payableAmount: number;
  adjustmentReason?: string | null;
}): Promise<UstadhSalaryItem> {
  const res = await apiClient.patch<{ success: boolean; data: UstadhSalaryItem }>(`/madrasa-admin/ustadh-salaries/${id}`, payload);
  return res.data.data;
}

export async function paySalary(id: string, payload: {
  paymentMethod: PaymentMethod;
  paymentDate: string;
  paymentReference?: string | null;
  paymentNote?: string | null;
}): Promise<{
  success: boolean;
  message: string;
  alreadyPaid: boolean;
  emailSent?: boolean;
  emailError?: string | null;
  data: UstadhSalaryItem;
}> {
  const res = await apiClient.post<any>(`/madrasa-admin/ustadh-salaries/${id}/pay`, payload);
  return res.data;
}

export async function downloadSalarySlipPdf(salaryId: string, filename = 'Salary_Slip.pdf'): Promise<void> {
  const res = await apiClient.get(`/madrasa-admin/ustadh-salaries/${salaryId}/slip`, {
    responseType: 'blob',
  });

  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function buildSalaryWhatsAppUrl(opts: {
  whatsappNumber: string;
  ustadhName: string;
  salaryMonth: string;
  payableAmount: number;
  paymentMethod?: string | null;
  paymentDate?: string | null;
  madrasaName?: string;
}): string {
  const digits = opts.whatsappNumber.replace(/\D/g, '');
  if (!digits) return '';
  const text = `Assalamu Alaikum ${opts.ustadhName},\nYour salary for ${opts.salaryMonth} has been paid.\nAmount: ${opts.payableAmount.toLocaleString()}\nPayment Method: ${opts.paymentMethod || 'N/A'}\nDate: ${opts.paymentDate || new Date().toISOString().split('T')[0]}\nMadrasa: ${opts.madrasaName || 'Madrasa'}\nJazakallahu Khairan.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function buildUstadhWhatsAppContactUrl(whatsappNumber: string, ustadhName?: string): string {
  const digits = whatsappNumber.replace(/\D/g, '');
  if (!digits) return '';
  const text = ustadhName ? `Assalamu Alaikum ${ustadhName},` : 'Assalamu Alaikum,';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export async function sendSalaryEmail(
  salaryId: string,
  payload?: { subject?: string; message?: string }
): Promise<{
  success: boolean;
  message: string;
  recipient?: string;
  error?: string;
}> {
  const res = await apiClient.post<{
    success: boolean;
    message: string;
    recipient?: string;
    error?: string;
  }>(`/madrasa-admin/ustadh-salaries/${salaryId}/send-email`, payload || {});
  return res.data;
}

export function maskEmail(email?: string | null): string {
  if (!email) return '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [name, domain] = parts;
  const visible = name.slice(0, 3);
  return `${visible}***@${domain}`;
}
