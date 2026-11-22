/**
 * MadrasaNexa Teacher Portal — Unified API Client
 * Connects all 13 Teacher Portal screens to the Phase 4E-2 persistent backend services.
 * Implements token attachment, unauthorized event dispatching, and offline fallback.
 */

import type {
  TeacherProfile,
  TimetableSlot,
  AssignedClass,
  DetailedPayslip,
  TeacherAttendanceRecord,
  TeacherNotification,
} from '../mock/teacherMockData';

export type { TeacherProfile, DetailedPayslip, TimetableSlot, AssignedClass, TeacherAttendanceRecord, TeacherNotification };

export const AUTH_STORAGE_KEYS = {
  TEACHER_TOKEN: 'madrasanexa_teacher_token',
  TEACHER_USER: 'madrasanexa_teacher_user',
};

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Resolves static or uploaded asset URLs safely.
 * - Returns null if url is empty/null.
 * - Returns url as-is if it starts with http://, https://, or data:.
 * - Prepends the backend API origin (stripping /api from BASE_URL) if url is a relative path.
 */
export function resolveAssetUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  const origin = BASE_URL.replace(/\/api\/?$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${origin}${path}`;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'TEACHER' | 'MADRASA_ADMIN' | 'SUPER_ADMIN';
  madrasaId: string | null;
  mustChangePassword?: boolean;
  avatarUrl?: string | null;
  photoUrl?: string | null;
  madrasa?: {
    id: string;
    name: string;
    code: string;
    logoUrl?: string | null;
  };
  teacherProfile?: {
    id: string;
    ustadhCode: string;
    fullName: string;
    staffType: string;
    photoUrl?: string | null;
    avatarUrl?: string | null;
  };
}

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

export interface DashboardData {
  teacher?: {
    id: string;
    photoUrl?: string | null;
    avatarUrl?: string | null;
  };
  stats: {
    totalClasses: number;
    totalStudents: number;
    weeklyTeachingHours: number;
    averageAttendanceRate: number;
    syllabusCompletionRate: number;
    pendingEvaluations: number;
    todayTotalSessions: number;
    todayCompletedSessions: number;
  };
  todaySchedule: Array<{
    id: string;
    period: number;
    timeSlot: string;
    className: string;
    classId: string;
    subject: string;
    room: string;
    roomId: string;
    studentsCount: number;
    status: string;
  }>;
  recentNotifications: Array<{
    id: string;
    title: string;
    message: string;
    category: string;
    priority: string;
    timestamp: string;
  }>;
  timeContext: {
    timeZone: string;
    date: string;
    weekday: string;
  };
  madrasa?: {
    id: string;
    name: string;
    code: string;
    logoUrl?: string | null;
  } | null;
}

export interface StudentPeriodRosterItem {
  studentId: string;
  rollNo: string;
  name: string;
  status: 'Present' | 'Late' | 'Excused' | 'Absent';
  scannedTime: string | null;
  method: string;
  remarks: string;
}

export interface PeriodSessionData {
  sessionCode: string;
  date: string;
  period: number;
  timeSlot: string;
  className: string;
  subject: string;
  totalEnrolled: number;
  isSealed: boolean;
  sealedAt: string | null;
  roster: StudentPeriodRosterItem[];
}

export interface DailyStudentItem {
  id: string;
  fullName: string;
  admissionNo: string;
  rollNo: string;
  classId: string | null;
  className: string;
  category: 'DAY_SCHOLAR' | 'BOARDING';
  guardianEmail: string | null;
  guardianPhone: string | null;
  status: 'PRESENT' | 'ABSENT' | 'UNMARKED';
  checkInTime: string | null;
  checkOutTime: string | null;
  method: string | null;
  parentEmailSent: boolean;
}

export interface DailyStudentRosterData {
  date: string;
  stats: {
    totalStudents: number;
    presentCount: number;
    dayScholarsPresent: number;
    boardingPresent: number;
    unmarkedCount: number;
  };
  students: DailyStudentItem[];
}

export interface DailyStudentScanResult {
  success: boolean;
  direction: 'ENTRY' | 'EXIT';
  student: {
    id: string;
    fullName: string;
    admissionNo: string;
    classId?: string | null;
    className?: string;
    category: 'DAY_SCHOLAR' | 'BOARDING';
    guardianEmail?: string | null;
    guardianPhone?: string;
  };
  status: string;
  alreadyMarked: boolean;
  scannedAt: string;
  scannedTime: string;
  method: string;
  parentEmailSent: boolean;
  parentEmail?: string | null;
  emailError?: string | null;
  message: string;
}

export interface SalarySummaryData {
  basicSalary: number;
  allowances: Array<{ id?: string; name: string; category: string; amount: number; description?: string }>;
  adjustments?: Array<{ id?: string; name: string; amount: number; category?: string; type?: string }>;
  deductions: Array<{ id?: string; name: string; category: string; amount: number; description?: string }>;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  currency: string;
  currentStatus: string;
  latestPaymentMonth: string;
  latestPaymentDate: string;
  epfNumber: string | null;
  bankDetails: {
    bankName: string;
    branch: string;
    accountNumber: string;
    accountHolder: string;
  } | null;
  employerContributions: {
    employerEpfRate: string;
    employerEpfAmount: number;
    employerEtfRate: string;
    employerEtfAmount: number;
    institutionalNotice: string;
  };
  monthlyTrends: Array<{
    month: string;
    basic: number;
    allowances: number;
    deductions: number;
    net: number;
    status: string;
  }>;
}

export interface PaginatedResponse<T> {
  totalCount: number;
  page: number;
  limit: number;
  data: T[];
  unreadCount?: number;
}

export interface TeacherSettingsData {
  account: {
    id: string;
    name: string;
    email: string;
    role: string;
    ustadhCode: string;
    mustChangePassword: boolean;
    memberSince: string;
  };
  preferences: {
    emailNotifications: boolean;
    whatsappAlerts: boolean;
    language: string;
  };
}

/**
 * Generic Fetch Wrapper with Authorization and 401 Interception
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem(AUTH_STORAGE_KEYS.TEACHER_TOKEN);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
    delete headers['content-type'];
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${BASE_URL}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem(AUTH_STORAGE_KEYS.TEACHER_TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.TEACHER_USER);
    window.dispatchEvent(new CustomEvent('teacher:unauthorized'));
    throw new Error('Your session has expired. Please log in again.');
  }

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || `Request failed with status ${res.status}`);
  }

  return (json.data !== undefined ? json.data : json) as T;
}

// =============================================================================
// 1. Authentication API
// =============================================================================
export const authApi = {
  async login(email: string, password: string): Promise<LoginResult> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Login failed.');
    }

    const result: LoginResult = json.data;
    if (result.user.role !== 'TEACHER') {
      throw new Error('Access denied: Only accounts with TEACHER role can access the Teacher Portal.');
    }

    localStorage.setItem(AUTH_STORAGE_KEYS.TEACHER_TOKEN, result.accessToken);
    localStorage.setItem(AUTH_STORAGE_KEYS.TEACHER_USER, JSON.stringify(result.user));
    return result;
  },

  logout(): void {
    localStorage.removeItem(AUTH_STORAGE_KEYS.TEACHER_TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.TEACHER_USER);
    window.dispatchEvent(new CustomEvent('teacher:logout'));
  },

  isAuthenticated(): boolean {
    return Boolean(localStorage.getItem(AUTH_STORAGE_KEYS.TEACHER_TOKEN));
  },

  getStoredUser(): AuthUser | null {
    try {
      const userStr = localStorage.getItem(AUTH_STORAGE_KEYS.TEACHER_USER);
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },
};

// =============================================================================
// 2. Dashboard API
// =============================================================================
export const dashboardApi = {
  getDashboard(): Promise<DashboardData> {
    return request<DashboardData>('/teacher/dashboard', { method: 'GET' });
  },
};

// =============================================================================
// 3. Profile API
// =============================================================================
export const profileApi = {
  getProfile(): Promise<TeacherProfile> {
    return request<TeacherProfile>('/teacher/profile', { method: 'GET' });
  },

  updateProfile(data: {
    fullName?: string;
    arabicName?: string;
    phoneNumber?: string;
    whatsappNumber?: string;
    address?: string;
    residentialAddress?: string;
    nicPassport?: string;
    dateOfBirth?: string;
    gender?: string;
    maritalStatus?: string;
    bloodGroup?: string;
    district?: string;
    postalCode?: string;
    country?: string;
    avatarUrl?: string;
    emergencyContact?: { name: string; relationship: string; phone: string };
    academicQualifications?: any[];
    professionalQualifications?: any[];
    teachingExperience?: any[];
    documents?: any[];
  }): Promise<{ id: string; fullName?: string; message: string }> {
    return request<{ id: string; fullName?: string; message: string }>('/teacher/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async uploadPhoto(file: File): Promise<{ photoUrl: string; avatarUrl: string; message: string }> {
    const formData = new FormData();
    formData.append('photo', file);
    const token = localStorage.getItem(AUTH_STORAGE_KEYS.TEACHER_TOKEN);
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${BASE_URL}/teacher/profile/photo`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (res.status === 401) {
      localStorage.removeItem(AUTH_STORAGE_KEYS.TEACHER_TOKEN);
      localStorage.removeItem(AUTH_STORAGE_KEYS.TEACHER_USER);
      window.dispatchEvent(new CustomEvent('teacher:unauthorized'));
      throw new Error('Your session has expired. Please log in again.');
    }
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Failed to upload photo.');
    }
    return json.data;
  },
};

// =============================================================================
// 4. Timetable API
// =============================================================================
export const timetableApi = {
  getTimetable(day?: string): Promise<TimetableSlot[]> {
    const query = day ? `?day=${day}` : '';
    return request<TimetableSlot[]>(`/teacher/timetable${query}`, { method: 'GET' });
  },
};

// =============================================================================
// 5. Classes & Subjects API
// =============================================================================
export const classesApi = {
  getAssignedClasses(): Promise<AssignedClass[]> {
    return request<AssignedClass[]>('/teacher/classes', { method: 'GET' }).then((list) =>
      list.map((cls) => ({
        ...cls,
        stream: cls.stream || 'Islamic Studies',
        gradeLevel: cls.gradeLevel || cls.name,
        subjectTaught: cls.subjectTaught || 'General Subject',
        students: cls.students || [],
      }))
    );
  },

  getClassDetail(classId: string): Promise<AssignedClass> {
    return request<AssignedClass>(`/teacher/classes/${classId}`, { method: 'GET' }).then((cls) => ({
      ...cls,
      stream: cls.stream || 'Islamic Studies',
      gradeLevel: cls.gradeLevel || cls.name,
      subjectTaught: cls.subjectTaught || 'General Subject',
      students: cls.students || [],
    }));
  },
};

// =============================================================================
// 6. Teacher Classroom Attendance API
// =============================================================================
export const teacherAttendanceApi = {
  getTodayTeacherAttendance(): Promise<Array<{
    scheduleId: string;
    id?: string;
    period: number;
    timeSlot: string;
    startMinutes: number;
    endMinutes: number;
    className: string;
    classId: string;
    subject: string;
    roomName: string;
    roomCode?: string;
    roomToken?: string;
    classroomId?: string | null;
    status: string;
    method: string | null;
    verifiedAt: string | null;
    graceWindowMinutes: number;
    isActiveSlot?: boolean;
    isCurrentPeriod?: boolean;
    checkInTime?: string | null;
    capacity?: number;
    studentsCount?: number;
    roomId?: string;
  }>> {
    return request('/teacher/attendance/teacher/today', { method: 'GET' });
  },

  verifyClassroomQr(payload: {
    roomToken: string;
    scheduleId?: string;
    method?: string;
    notes?: string;
  }): Promise<{
    id: string;
    status: string;
    method: string;
    verifiedAt: string;
    scheduleId: string;
    checkInTime?: string;
    markedAt?: string;
    schedule?: {
      id: string;
      period?: number;
      startMinutes: number;
      endMinutes: number;
      timeSlot: string;
      className: string;
      subject: string;
      roomName: string;
      roomCode: string;
    };
    roomTokenAccepted: string;
    notice: string;
  }> {
    return request('/teacher/attendance/teacher/verify-qr', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// =============================================================================
// 7. Student Period Attendance API (Option A: Full Isolation)
// =============================================================================
export const studentAttendanceApi = {
  getPeriodSession(scheduleId: string, date: string): Promise<PeriodSessionData> {
    return request<PeriodSessionData>(
      `/teacher/attendance/student/session?scheduleId=${encodeURIComponent(scheduleId)}&date=${encodeURIComponent(date)}`,
      { method: 'GET' }
    );
  },

  markPeriodAttendance(payload: {
    scheduleId: string;
    date: string;
    records: Array<{ studentId: string; status: string; remarks?: string; method?: string }>;
  }): Promise<{ success: boolean; message: string; totalRecorded: number; isSealed: boolean; optionAIsolationNotice: string }> {
    return request('/teacher/attendance/student/mark', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  sealPeriodSession(payload: {
    scheduleId: string;
    date: string;
  }): Promise<{ sessionCode: string; isSealed: boolean; sealedAt: string; message: string }> {
    return request('/teacher/attendance/student/seal', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getDailyRoster(params?: { date?: string; classId?: string; category?: string }): Promise<DailyStudentRosterData> {
    const q = new URLSearchParams();
    if (params?.date) q.append('date', params.date);
    if (params?.classId) q.append('classId', params.classId);
    if (params?.category) q.append('category', params.category);
    const query = q.toString() ? `?${q.toString()}` : '';
    return request<DailyStudentRosterData>(`/teacher/attendance/student/daily-roster${query}`, { method: 'GET' });
  },

  scanDailyStudentAttendance(payload: {
    scanInput: string;
    direction?: 'ENTRY' | 'EXIT';
    date?: string;
    classId?: string;
  }): Promise<DailyStudentScanResult> {
    return request<DailyStudentScanResult>('/teacher/attendance/student/daily-scan', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  scanStudentPeriodAttendance(payload: {
    scheduleId?: string;
    sessionId?: string;
    scanInput: string;
    date?: string;
    periodNumber?: number;
    direction?: 'ENTRY' | 'EXIT';
  }): Promise<{
    success: boolean;
    sessionId?: string;
    student: {
      id: string;
      fullName: string;
      admissionNo: string;
      classId?: string;
      className?: string;
      category?: 'DAY_SCHOLAR' | 'BOARDING';
      guardianEmail?: string | null;
      guardianPhone?: string;
    };
    status: string;
    alreadyMarked: boolean;
    scannedAt: string;
    scannedTime?: string;
    method: string;
    parentEmailSent?: boolean;
    parentEmail?: string | null;
    message: string;
  }> {
    return request('/teacher/attendance/student/scan', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// =============================================================================
// 8. Attendance History API
// =============================================================================
export const attendanceHistoryApi = {
  getAttendanceHistory(type: 'student' | 'teacher', page = 1, limit = 10): Promise<PaginatedResponse<any>> {
    return request<PaginatedResponse<any>>(
      `/teacher/attendance/history?type=${type}&page=${page}&limit=${limit}`,
      { method: 'GET' }
    );
  },
};

// =============================================================================
// 9. Salary Summary API
// =============================================================================
export const salaryApi = {
  getSalarySummary(): Promise<SalarySummaryData> {
    return request<SalarySummaryData>('/teacher/salary/summary', { method: 'GET' });
  },
};

// =============================================================================
// 10. Payment History API
// =============================================================================
export const paymentHistoryApi = {
  getPaymentHistory(page = 1, limit = 10): Promise<PaginatedResponse<any>> {
    return request<PaginatedResponse<any>>(
      `/teacher/salary/history?page=${page}&limit=${limit}`,
      { method: 'GET' }
    );
  },
};

// =============================================================================
// 11. Payslips API
// =============================================================================
export const payslipsApi = {
  listPayslips(): Promise<Array<{
    id: string;
    payslipNumber: string;
    revision?: number;
    monthYear: string;
    monthCode: string;
    netSalary: number;
    issueDate: string;
    status: string;
  }>> {
    return request('/teacher/salary/payslips', { method: 'GET' });
  },

  getPayslipDetail(payslipId: string): Promise<DetailedPayslip> {
    return request<DetailedPayslip>(`/teacher/salary/payslips/${payslipId}`, { method: 'GET' });
  },
};

// =============================================================================
// 12. Notifications API
// =============================================================================
export const notificationsApi = {
  getNotifications(category?: string, unreadOnly?: boolean, page = 1, limit = 20): Promise<PaginatedResponse<TeacherNotification>> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (unreadOnly) params.append('unreadOnly', 'true');
    params.append('page', String(page));
    params.append('limit', String(limit));

    return request<PaginatedResponse<TeacherNotification>>(
      `/teacher/notifications?${params.toString()}`,
      { method: 'GET' }
    );
  },

  markRead(id: string): Promise<{ success: boolean; announcementId: string; isRead: boolean }> {
    return request(`/teacher/notifications/${id}/read`, { method: 'PATCH' });
  },

  markAllRead(): Promise<{ success: boolean; message: string }> {
    return request('/teacher/notifications/read-all', { method: 'PATCH' });
  },
};

// =============================================================================
// 13. Settings API
// =============================================================================
export const settingsApi = {
  getSettings(): Promise<TeacherSettingsData> {
    return request<TeacherSettingsData>('/teacher/settings', { method: 'GET' });
  },

  changePassword(payload: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    return request('/teacher/settings/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  updatePreferences(preferences: { emailNotifications?: boolean; whatsappAlerts?: boolean; language?: string }): Promise<{
    success: boolean;
    message: string;
    preferences: any;
  }> {
    return request('/teacher/settings/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  },
};

// =============================================================================
// 14. Community Polls & Governance API
// =============================================================================
export interface TeacherPollOption {
  id: string;
  label: string;
  sortOrder: number;
  voteCount: number;
  percentage: number;
  isUserChoice?: boolean;
}

export interface TeacherPollItem {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  targetAudience: string;
  allowMultipleChoice: boolean;
  isAnonymous: boolean;
  status: string;
  closesAt?: string | null;
  createdAt: string;
  hasVoted?: boolean;
  userSelectedOptionIds?: string[];
  totalVotes?: number;
  options: TeacherPollOption[];
}

export const pollsApi = {
  getActivePolls(): Promise<TeacherPollItem[]> {
    return request<TeacherPollItem[]>('/teacher/polls', { method: 'GET' });
  },

  submitVote(pollId: string, optionIds: string[]): Promise<TeacherPollItem> {
    return request<TeacherPollItem>(`/teacher/polls/${pollId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionIds }),
    });
  },
};

// =============================================================================
// 15. Alumni & Scholar Directory API (Read-only)
// =============================================================================
export interface TeacherAlumniItem {
  id: string;
  fullName: string;
  photoUrl?: string | null;
  batchYear: string;
  classOrDivision?: string | null;
  academicStatus: 'UNDERGRADUATE' | 'GRADUATE' | 'POSTGRADUATE' | 'WORKING_SCHOLAR' | 'HAFIL' | 'AL_AALIM' | 'OTHER';
  customStatusLabel?: string | null;
  qualification: string;
  university: string;
  qualificationsList?: Array<{ degree: string; university: string; year?: string | null }> | null;
  facultyOrDepartment?: string | null;
  currentRole?: string | null;
  cityCountry?: string | null;
  bio?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  showContactPublicly: boolean;
  availableForMentorship: boolean;
  isFeatured: boolean;
  createdAt: string;
}

export const alumniApi = {
  getAlumniList(): Promise<TeacherAlumniItem[]> {
    return request<TeacherAlumniItem[]>('/teacher/alumni', { method: 'GET' });
  },
};

export function getScholarStatusInfo(status: string, customLabel?: string | null): { label: string; className: string } {
  switch (status) {
    case 'HAFIL':
      return { label: 'Hafil', className: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
    case 'AL_AALIM':
      return { label: 'Al Aalim', className: 'bg-amber-50 text-amber-800 border-amber-300' };
    case 'UNDERGRADUATE':
      return { label: 'Undergraduate', className: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'GRADUATE':
      return { label: 'Graduate', className: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'POSTGRADUATE':
      return { label: 'Postgraduate', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'WORKING_SCHOLAR':
      return { label: 'Working Scholar', className: 'bg-teal-50 text-teal-700 border-teal-200' };
    case 'OTHER':
      return { label: customLabel?.trim() || 'Other', className: 'bg-slate-100 text-slate-800 border-slate-300' };
    default:
      return { label: customLabel?.trim() || status || 'Alumnus', className: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}
