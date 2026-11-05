import { apiClient } from './api';
import type { Weekday, TeachingStaffType } from './ustadh.service';

export type TimetableEntryType = 'TEACHING' | 'BREAK';

export interface TimetableBreakItem {
  id: string;
  madrasaId: string;
  classId: string;
  name: string;
  dayOfWeek: Weekday;
  startMinutes: number;
  endMinutes: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
  class?: { id: string; name: string; code?: string | null };
  createdAt?: string;
  updatedAt?: string;
}

export interface TimetableEntry {
  type: TimetableEntryType;
  id: string;
  dayOfWeek: Weekday;
  startMinutes: number;
  endMinutes: number;
  class?: { id: string; name: string; code?: string | null };
  subject?: { id: string; name: string; code?: string | null };
  staff?: {
    id: string;
    fullName: string;
    ustadhCode: string;
    staffType?: TeachingStaffType;
  };
  name?: string; // Break name
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface ClassTimetableResponse {
  class: { id: string; name: string; code?: string | null };
  referenceDate: string;
  items: TimetableEntry[];
}

export interface StaffTimetableResponse {
  staff?: {
    id: string;
    fullName: string;
    ustadhCode: string;
    staffType?: TeachingStaffType;
  } | null;
  referenceDate: string;
  items: TimetableEntry[];
}

export interface FullTimetableResponse {
  referenceDate: string;
  items: TimetableEntry[];
}

export const WEEKDAYS: Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export function formatMinutesToDisplayTime(totalMinutes: number): string {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  const mm = String(minutes).padStart(2, '0');
  return `${hours12}:${mm} ${period}`;
}

export function parseTimeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatMinutesToInputTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ==========================================
// TIMETABLE VIEWS
// ==========================================

export async function getClassTimetable(params: {
  classId: string;
  referenceDate?: string;
}): Promise<ClassTimetableResponse> {
  const res = await apiClient.get<any>('/madrasa-admin/timetable/class', { params });
  return res.data.data;
}

export async function getStaffTimetable(params?: {
  ustadhId?: string;
  staffType?: TeachingStaffType;
  referenceDate?: string;
}): Promise<StaffTimetableResponse> {
  const res = await apiClient.get<any>('/madrasa-admin/timetable/staff', { params });
  return res.data.data;
}

export async function getFullTimetable(params?: {
  referenceDate?: string;
}): Promise<FullTimetableResponse> {
  const res = await apiClient.get<any>('/madrasa-admin/timetable/full', { params });
  return res.data.data;
}

// ==========================================
// BREAKS CRUD
// ==========================================

export async function listBreaks(params?: {
  classId?: string;
  dayOfWeek?: Weekday;
  isActive?: boolean;
}): Promise<{ items: TimetableBreakItem[]; total: number }> {
  const res = await apiClient.get<any>('/madrasa-admin/timetable/breaks', { params });
  return res.data.data;
}

export async function createBreak(payload: {
  classId: string;
  name: string;
  dayOfWeek: Weekday;
  startMinutes: number;
  endMinutes: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}): Promise<TimetableBreakItem> {
  const res = await apiClient.post<any>('/madrasa-admin/timetable/breaks', payload);
  return res.data.data;
}

export async function updateBreak(
  id: string,
  payload: Partial<{
    classId: string;
    name: string;
    dayOfWeek: Weekday;
    startMinutes: number;
    endMinutes: number;
    effectiveFrom: string;
    effectiveTo?: string | null;
    isActive: boolean;
  }>
): Promise<TimetableBreakItem> {
  const res = await apiClient.patch<any>(`/madrasa-admin/timetable/breaks/${id}`, payload);
  return res.data.data;
}

export async function deleteBreak(id: string): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.delete<any>(`/madrasa-admin/timetable/breaks/${id}`);
  return res.data;
}

// ==========================================
// PDF EXPORTS
// ==========================================

export async function downloadClassTimetablePdf(
  classId: string,
  referenceDate?: string,
  filename?: string
): Promise<void> {
  const res = await apiClient.get('/madrasa-admin/timetable/export/class/pdf', {
    params: { classId, referenceDate },
    responseType: 'blob',
  });

  const resolvedFilename = filename || `Class_Timetable_${classId}.pdf`;
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = resolvedFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function downloadStaffTimetablePdf(
  params: { ustadhId?: string; staffType?: TeachingStaffType; referenceDate?: string },
  filename?: string
): Promise<void> {
  const res = await apiClient.get('/madrasa-admin/timetable/export/staff/pdf', {
    params,
    responseType: 'blob',
  });

  const suffix = params.ustadhId ? params.ustadhId : 'All_Staff';
  const resolvedFilename = filename || `Staff_Timetable_${suffix}.pdf`;
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = resolvedFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function downloadFullTimetablePdf(
  referenceDate?: string,
  filename?: string
): Promise<void> {
  const res = await apiClient.get('/madrasa-admin/timetable/export/full/pdf', {
    params: { referenceDate },
    responseType: 'blob',
  });

  const resolvedFilename = filename || `Master_Weekly_Timetable_${referenceDate || 'current'}.pdf`;
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = resolvedFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
