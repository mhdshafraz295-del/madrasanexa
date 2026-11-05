import { apiClient } from './api';

export type AttendanceRecordStatus = 'PRESENT' | 'ABSENT' | 'NOT_MARKED';

export interface DailyStudentItem {
  studentId: string;
  admissionNo: string;
  fullName: string;
  status: 'PRESENT' | 'ABSENT' | null;
}

export interface DailySummary {
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  attendanceRate: number;
}

export interface DailyAttendanceData {
  isSaved: boolean;
  sessionId: string | null;
  classId: string;
  className: string;
  academicYear: string;
  date: string;
  updatedAt: string | null;
  summary: DailySummary;
  students: DailyStudentItem[];
}

export interface AttendanceHistoryItem {
  id: string;
  date: string;
  academicYear: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  attendanceRate: number;
  updatedAt: string;
}

export interface AttendanceHistoryData {
  classId: string;
  className: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: AttendanceHistoryItem[];
}

export interface MonthlySummaryStudentItem {
  studentId: string;
  admissionNo: string;
  fullName: string;
  presentDays: number;
  absentDays: number;
  recordedDays: number;
  attendancePercentage: number;
}

export interface MonthlySummaryData {
  classId: string;
  className: string;
  month: string;
  academicYear: string;
  summary: {
    totalAttendanceDays: number;
    totalStudents: number;
    monthlyClassRate: number;
    averageDailyRate: number;
    highestDailyRate: number;
    lowestDailyRate: number;
    totalPresentRecords: number;
    totalRecordedRecords: number;
  };
  students: MonthlySummaryStudentItem[];
}

export interface StudentAttendanceHistoryItem {
  id: string;
  sessionId: string;
  date: string;
  academicYear: string;
  className: string;
  status: 'PRESENT' | 'ABSENT';
}

export interface StudentAttendanceData {
  student: {
    id: string;
    admissionNo: string;
    fullName: string;
    className: string;
    status: string;
  };
  summary: {
    presentDays: number;
    absentDays: number;
    recordedDays: number;
    attendancePercentage: number;
  };
  history: StudentAttendanceHistoryItem[];
}

export async function getDailyAttendance(params: {
  classId: string;
  academicYear: string;
  date: string;
}): Promise<DailyAttendanceData> {
  const searchParams = new URLSearchParams({
    classId: params.classId,
    academicYear: params.academicYear,
    date: params.date,
  });
  const res = await apiClient.get<{ success: boolean; data: DailyAttendanceData }>(
    `/madrasa-admin/attendance?${searchParams.toString()}`
  );
  return res.data.data;
}

export async function saveDailyAttendance(payload: {
  classId: string;
  academicYear: string;
  date: string;
  records: Array<{ studentId: string; status: 'PRESENT' | 'ABSENT' }>;
}): Promise<DailyAttendanceData> {
  const res = await apiClient.put<{ success: boolean; message: string; data: DailyAttendanceData }>(
    '/madrasa-admin/attendance',
    payload
  );
  return res.data.data;
}

export async function getAttendanceHistory(params: {
  classId: string;
  academicYear?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<AttendanceHistoryData> {
  const searchParams = new URLSearchParams({
    classId: params.classId,
  });
  if (params.academicYear) searchParams.append('academicYear', params.academicYear);
  if (params.startDate) searchParams.append('startDate', params.startDate);
  if (params.endDate) searchParams.append('endDate', params.endDate);
  if (params.page) searchParams.append('page', String(params.page));
  if (params.pageSize) searchParams.append('pageSize', String(params.pageSize));

  const res = await apiClient.get<{ success: boolean; data: AttendanceHistoryData }>(
    `/madrasa-admin/attendance/history?${searchParams.toString()}`
  );
  return res.data.data;
}

export async function getMonthlySummary(params: {
  classId: string;
  academicYear?: string;
  month: string;
}): Promise<MonthlySummaryData> {
  const searchParams = new URLSearchParams({
    classId: params.classId,
    month: params.month,
  });
  if (params.academicYear) searchParams.append('academicYear', params.academicYear);

  const res = await apiClient.get<{ success: boolean; data: MonthlySummaryData }>(
    `/madrasa-admin/attendance/monthly-summary?${searchParams.toString()}`
  );
  return res.data.data;
}

export async function getStudentAttendance(
  studentId: string,
  params: { classId?: string; academicYear?: string } = {}
): Promise<StudentAttendanceData> {
  const searchParams = new URLSearchParams();
  if (params.classId) searchParams.append('classId', params.classId);
  if (params.academicYear) searchParams.append('academicYear', params.academicYear);

  const res = await apiClient.get<{ success: boolean; data: StudentAttendanceData }>(
    `/madrasa-admin/attendance/students/${studentId}?${searchParams.toString()}`
  );
  return res.data.data;
}

export async function downloadDailyPdf(
  params: { classId: string; academicYear: string; date: string },
  filename = 'Daily_Attendance.pdf'
): Promise<void> {
  const searchParams = new URLSearchParams(params);
  const res = await apiClient.get(`/madrasa-admin/attendance/export/daily/pdf?${searchParams.toString()}`, {
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

export async function downloadMonthlyPdf(
  params: { classId: string; academicYear?: string; month: string },
  filename = 'Monthly_Attendance.pdf'
): Promise<void> {
  const searchParams = new URLSearchParams({
    classId: params.classId,
    month: params.month,
  });
  if (params.academicYear) searchParams.append('academicYear', params.academicYear);

  const res = await apiClient.get(`/madrasa-admin/attendance/export/monthly/pdf?${searchParams.toString()}`, {
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

export async function downloadDailyCsv(
  params: { classId: string; academicYear: string; date: string },
  filename = 'Daily_Attendance.csv'
): Promise<void> {
  const searchParams = new URLSearchParams(params);
  const res = await apiClient.get(`/madrasa-admin/attendance/export/daily/csv?${searchParams.toString()}`, {
    responseType: 'blob',
  });

  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function downloadMonthlyCsv(
  params: { classId: string; academicYear?: string; month: string },
  filename = 'Monthly_Attendance.csv'
): Promise<void> {
  const searchParams = new URLSearchParams({
    classId: params.classId,
    month: params.month,
  });
  if (params.academicYear) searchParams.append('academicYear', params.academicYear);

  const res = await apiClient.get(`/madrasa-admin/attendance/export/monthly/csv?${searchParams.toString()}`, {
    responseType: 'blob',
  });

  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
