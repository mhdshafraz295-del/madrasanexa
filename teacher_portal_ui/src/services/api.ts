/**
 * MadrasaNexa Teacher Portal — Unified API Client
 * Connects all 13 Teacher Portal screens to the Phase 4E-2 persistent backend services.
 * Implements token attachment, unauthorized event dispatching, and offline fallback.
 */

import {
  MOCK_TEACHER_PROFILE,
  MOCK_INSTITUTION_INFO,
  MOCK_TIMETABLE,
  MOCK_ASSIGNED_CLASSES,
  MOCK_TEACHER_ATTENDANCE_LOGS,
  MOCK_PAYSLIPS,
  MOCK_NOTIFICATIONS,
  MOCK_TEACHER_STATS,
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

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
  teacherProfile?: {
    id: string;
    ustadhCode: string;
    fullName: string;
    staffType: string;
  };
}

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

export interface DashboardData {
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
 * Generic Fetch Wrapper with Authorization, 401 Interception, and Offline Mock Fallback
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  fallbackFn?: () => T
): Promise<T> {
  const token = localStorage.getItem(AUTH_STORAGE_KEYS.TEACHER_TOKEN);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${BASE_URL}${endpoint}`;

  try {
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
  } catch (err: any) {
    // If backend connection is refused (offline local dev), use illustrative prototype fallback ONLY in DEV mode
    if (
      import.meta.env.DEV &&
      fallbackFn &&
      (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('connection refused'))
    ) {
      console.info(`[MadrasaNexa Portal DEV] Offline fallback engaged for endpoint: ${endpoint}`);
      return fallbackFn();
    }
    // In production, never return mock data on failure; rethrow to display explicit ErrorState
    throw err;
  }
}

// =============================================================================
// 1. Authentication API
// =============================================================================
export const authApi = {
  async login(email: string, password: string): Promise<LoginResult> {
    try {
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
    } catch (err: any) {
      // Offline fallback for evaluator preview demo credentials STRICTLY in DEV mode
      if (
        import.meta.env.DEV &&
        (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) &&
        email === 'abdullah.farooq@madrasanexa.lk'
      ) {
        const demoResult: LoginResult = {
          accessToken: 'demo_faculty_token_offline_2026',
          user: {
            id: 'demo_ustadh_user_1',
            name: 'Ustadh Abdullah Farooq',
            email: 'abdullah.farooq@madrasanexa.lk',
            role: 'TEACHER',
            madrasaId: 'demo_madrasa_1',
            teacherProfile: {
              id: 'demo_ustadh_1',
              ustadhCode: 'UST-014',
              fullName: 'Ustadh Abdullah Farooq',
              staffType: 'USTADH',
            },
          },
        };
        localStorage.setItem(AUTH_STORAGE_KEYS.TEACHER_TOKEN, demoResult.accessToken);
        localStorage.setItem(AUTH_STORAGE_KEYS.TEACHER_USER, JSON.stringify(demoResult.user));
        return demoResult;
      }
      throw err;
    }
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
    return request<DashboardData>('/teacher/dashboard', { method: 'GET' }, () => ({
      stats: {
        totalClasses: 4,
        totalStudents: 104,
        weeklyTeachingHours: 18.5,
        averageAttendanceRate: 94.6,
        syllabusCompletionRate: 68.8,
        pendingEvaluations: 0,
        todayTotalSessions: 3,
        todayCompletedSessions: 1,
      },
      todaySchedule: MOCK_TIMETABLE.filter((t) => t.day === 'Monday').map((s) => ({
        id: s.id,
        period: s.period,
        timeSlot: s.timeSlot,
        className: s.className,
        classId: 'cls_1',
        subject: s.subject,
        room: s.room,
        roomId: s.roomId,
        studentsCount: s.studentsCount,
        status: s.status,
      })),
      recentNotifications: MOCK_NOTIFICATIONS.slice(0, 4).map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        category: n.category,
        priority: n.priority,
        timestamp: n.timestamp,
      })),
      timeContext: {
        timeZone: 'Asia/Colombo',
        date: new Date().toISOString().split('T')[0],
        weekday: 'MONDAY',
      },
    }));
  },
};

// =============================================================================
// 3. Profile API
// =============================================================================
export const profileApi = {
  getProfile(): Promise<TeacherProfile> {
    return request<TeacherProfile>('/teacher/profile', { method: 'GET' }, () => MOCK_TEACHER_PROFILE);
  },

  updateProfile(data: {
    phoneNumber?: string;
    whatsappNumber?: string;
    address?: string;
    emergencyContact?: { name: string; relationship: string; phone: string };
  }): Promise<{ id: string; message: string }> {
    return request<{ id: string; message: string }>('/teacher/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, () => ({ id: MOCK_TEACHER_PROFILE.id, message: 'Profile updated successfully (Offline preview).' }));
  },
};

// =============================================================================
// 4. Timetable API
// =============================================================================
export const timetableApi = {
  getTimetable(day?: string): Promise<TimetableSlot[]> {
    const query = day ? `?day=${day}` : '';
    return request<TimetableSlot[]>(`/teacher/timetable${query}`, { method: 'GET' }, () =>
      day ? MOCK_TIMETABLE.filter((t) => t.day.toUpperCase() === day.toUpperCase()) : MOCK_TIMETABLE
    );
  },
};

// =============================================================================
// 5. Classes & Subjects API
// =============================================================================
export const classesApi = {
  getAssignedClasses(): Promise<AssignedClass[]> {
    return request<AssignedClass[]>('/teacher/classes', { method: 'GET' }, () => MOCK_ASSIGNED_CLASSES);
  },

  getClassDetail(classId: string): Promise<AssignedClass> {
    return request<AssignedClass>(`/teacher/classes/${classId}`, { method: 'GET' }, () => {
      const cls = MOCK_ASSIGNED_CLASSES.find((c) => c.id === classId) || MOCK_ASSIGNED_CLASSES[0];
      return cls;
    });
  },
};

// =============================================================================
// 6. Teacher Classroom Attendance API
// =============================================================================
export const teacherAttendanceApi = {
  getTodayTeacherAttendance(): Promise<Array<{
    scheduleId: string;
    period: number;
    timeSlot: string;
    startMinutes: number;
    endMinutes: number;
    className: string;
    classId: string;
    subject: string;
    roomName: string;
    status: string;
    method: string | null;
    verifiedAt: string | null;
    graceWindowMinutes: number;
  }>> {
    return request('/teacher/attendance/teacher/today', { method: 'GET' }, () =>
      MOCK_TIMETABLE.filter((t) => t.day === 'Monday').map((s, idx) => ({
        scheduleId: s.id,
        period: idx + 1,
        timeSlot: s.timeSlot,
        startMinutes: 480 + idx * 45,
        endMinutes: 525 + idx * 45,
        className: s.className,
        classId: 'cls_1',
        subject: s.subject,
        roomName: s.room,
        status: idx === 0 ? 'Verified' : 'Pending',
        method: idx === 0 ? 'Classroom QR' : null,
        verifiedAt: idx === 0 ? new Date().toISOString() : null,
        graceWindowMinutes: 15,
      }))
    );
  },

  verifyClassroomQr(payload: {
    roomToken: string;
    scheduleId: string;
    method?: string;
    notes?: string;
  }): Promise<{
    id: string;
    status: string;
    method: string;
    verifiedAt: string;
    scheduleId: string;
    roomTokenAccepted: string;
    notice: string;
  }> {
    return request('/teacher/attendance/teacher/verify-qr', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, () => ({
      id: `att_mock_${Date.now()}`,
      status: 'Verified',
      method: payload.method || 'Classroom QR',
      verifiedAt: new Date().toISOString(),
      scheduleId: payload.scheduleId,
      roomTokenAccepted: payload.roomToken,
      notice: 'Verification recorded. Static QR code confirms institutional timetable compliance.',
    }));
  },
};

// =============================================================================
// 7. Student Period Attendance API (Option A: Full Isolation)
// =============================================================================
export const studentAttendanceApi = {
  getPeriodSession(scheduleId: string, date: string): Promise<PeriodSessionData> {
    return request<PeriodSessionData>(
      `/teacher/attendance/student/session?scheduleId=${encodeURIComponent(scheduleId)}&date=${encodeURIComponent(date)}`,
      { method: 'GET' },
      () => ({
        sessionCode: `SES-${date.replace(/-/g, '')}-${scheduleId.slice(-4)}`,
        date,
        period: 1,
        timeSlot: '08:00 AM – 08:45 AM',
        className: 'Class 10-A (Hifz & Tajweed)',
        subject: 'Tajweed Rules & Application',
        totalEnrolled: MOCK_ASSIGNED_CLASSES[0].students.length,
        isSealed: false,
        sealedAt: null,
        roster: MOCK_ASSIGNED_CLASSES[0].students.map((st) => ({
          studentId: st.id,
          rollNo: st.rollNo,
          name: st.name,
          status: 'Present',
          scannedTime: null,
          method: 'Teacher Manual',
          remarks: '',
        })),
      })
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
    }, () => ({
      success: true,
      message: `Period attendance recorded for ${payload.records.length} students.`,
      totalRecorded: payload.records.length,
      isSealed: false,
      optionAIsolationNotice: 'Attendance recorded exclusively for period roll-call. Daily institutional attendance is isolated and unaffected.',
    }));
  },

  sealPeriodSession(payload: {
    scheduleId: string;
    date: string;
  }): Promise<{ sessionCode: string; isSealed: boolean; sealedAt: string; message: string }> {
    return request('/teacher/attendance/student/seal', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, () => ({
      sessionCode: `SES-${payload.date.replace(/-/g, '')}`,
      isSealed: true,
      sealedAt: new Date().toISOString(),
      message: 'Period attendance session sealed successfully.',
    }));
  },
};

// =============================================================================
// 8. Attendance History API
// =============================================================================
export const attendanceHistoryApi = {
  getAttendanceHistory(type: 'student' | 'teacher', page = 1, limit = 10): Promise<PaginatedResponse<any>> {
    return request<PaginatedResponse<any>>(
      `/teacher/attendance/history?type=${type}&page=${page}&limit=${limit}`,
      { method: 'GET' },
      () => ({
        totalCount: type === 'teacher' ? MOCK_TEACHER_ATTENDANCE_LOGS.length : 4,
        page,
        limit,
        data: type === 'teacher' ? MOCK_TEACHER_ATTENDANCE_LOGS : [
          {
            id: 'ses_1',
            sessionCode: 'SES-20261116',
            date: '2026-11-16',
            period: 1,
            timeSlot: '08:00 AM – 08:45 AM',
            className: 'Class 10-A',
            subject: 'Tajweed Rules',
            totalEnrolled: 25,
            presentCount: 24,
            attendanceRate: 96,
            isSealed: true,
            sealedAt: '2026-11-16T08:50:00Z',
          },
        ],
      })
    );
  },
};

// =============================================================================
// 9. Salary Summary API
// =============================================================================
export const salaryApi = {
  getSalarySummary(): Promise<SalarySummaryData> {
    return request<SalarySummaryData>('/teacher/salary/summary', { method: 'GET' }, () => ({
      basicSalary: 85000,
      allowances: [
        { name: 'Academic Research & Pedagogy', category: 'Academic', amount: 12000, description: 'Manuscript study grant' },
        { name: 'Faculty Residential / Housing', category: 'Housing', amount: 8000, description: 'Housing stipend' },
        { name: 'Special Ten Qira’at Ijazah Allowance', category: 'Special', amount: 6000, description: 'Credential incentive' },
        { name: 'Transport & Inter-Campus Travel', category: 'Transport', amount: 5000, description: 'Commuter allowance' },
      ],
      deductions: [
        { name: 'Employee EPF Contribution (8%)', category: 'Statutory EPF', amount: 6800, description: 'Statutory 8% EPF' },
        { name: 'Staff Welfare & Benevolent Fund', category: 'Welfare', amount: 1200, description: 'Benevolent fund' },
        { name: 'Group Health Takaful Scheme', category: 'Takaful', amount: 2000, description: 'Medical takaful' },
      ],
      grossSalary: 116000,
      totalDeductions: 10000,
      netSalary: 106000,
      currency: 'Rs.',
      currentStatus: 'Paid',
      latestPaymentMonth: '2026-10',
      latestPaymentDate: '2026-10-31',
      epfNumber: 'EPF-7841-UST',
      bankDetails: {
        bankName: 'Bank of Ceylon (BOC)',
        branch: 'Colombo Central Branch',
        accountNumber: 'BOC-****-4910',
        accountHolder: 'Ustadh Abdullah Farooq',
      },
      employerContributions: {
        employerEpfRate: '12%',
        employerEpfAmount: 10200,
        employerEtfRate: '3%',
        employerEtfAmount: 2550,
        institutionalNotice: 'Employer EPF (12%) and ETF (3%) are institutional liabilities and are NOT deducted from employee net salary.',
      },
      monthlyTrends: [
        { month: 'Oct 2026', basic: 85000, allowances: 31000, deductions: 10000, net: 106000, status: 'Paid' },
        { month: 'Sep 2026', basic: 85000, allowances: 31000, deductions: 10000, net: 106000, status: 'Paid' },
        { month: 'Aug 2026', basic: 85000, allowances: 31000, deductions: 10000, net: 106000, status: 'Paid' },
      ],
    }));
  },
};

// =============================================================================
// 10. Payment History API
// =============================================================================
export const paymentHistoryApi = {
  getPaymentHistory(page = 1, limit = 10): Promise<PaginatedResponse<any>> {
    return request<PaginatedResponse<any>>(
      `/teacher/salary/history?page=${page}&limit=${limit}`,
      { method: 'GET' },
      () => ({
        totalCount: 3,
        page,
        limit,
        data: [
          {
            id: 'sal_oct',
            month: 'October 2026',
            monthCode: '2026-10',
            grossSalary: 116000,
            deductions: 10000,
            netSalary: 106000,
            paymentDate: '2026-10-31',
            paymentMethod: 'BANK_TRANSFER',
            paymentReference: 'SAL-REF-OCT26',
            transactionId: 'TXN-4910OCT',
            status: 'Paid',
            disbursementChannel: 'Direct Bank Clearance',
            bankSummary: 'BOC-****-4910',
          },
          {
            id: 'sal_sep',
            month: 'September 2026',
            monthCode: '2026-09',
            grossSalary: 116000,
            deductions: 10000,
            netSalary: 106000,
            paymentDate: '2026-09-30',
            paymentMethod: 'BANK_TRANSFER',
            paymentReference: 'SAL-REF-SEP26',
            transactionId: 'TXN-4910SEP',
            status: 'Paid',
            disbursementChannel: 'Direct Bank Clearance',
            bankSummary: 'BOC-****-4910',
          },
        ],
      })
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
    return request('/teacher/salary/payslips', { method: 'GET' }, () =>
      MOCK_PAYSLIPS.map((ps) => ({
        id: ps.id,
        payslipNumber: ps.payslipNumber,
        revision: 1,
        monthYear: ps.monthYear,
        monthCode: ps.monthCode,
        netSalary: ps.netPayable,
        issueDate: ps.issueDate,
        status: ps.status,
      }))
    );
  },

  getPayslipDetail(payslipId: string): Promise<DetailedPayslip> {
    return request<DetailedPayslip>(`/teacher/salary/payslips/${payslipId}`, { method: 'GET' }, () => {
      const ps = MOCK_PAYSLIPS.find((p) => p.id === payslipId) || MOCK_PAYSLIPS[0];
      return ps;
    });
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
      { method: 'GET' },
      () => ({
        totalCount: MOCK_NOTIFICATIONS.length,
        unreadCount: MOCK_NOTIFICATIONS.filter((n) => !n.isRead).length,
        page,
        limit,
        data: MOCK_NOTIFICATIONS,
      })
    );
  },

  markRead(id: string): Promise<{ success: boolean; announcementId: string; isRead: boolean }> {
    return request(`/teacher/notifications/${id}/read`, { method: 'PATCH' }, () => ({
      success: true,
      announcementId: id,
      isRead: true,
    }));
  },

  markAllRead(): Promise<{ success: boolean; message: string }> {
    return request('/teacher/notifications/read-all', { method: 'PATCH' }, () => ({
      success: true,
      message: 'All notifications marked as read.',
    }));
  },
};

// =============================================================================
// 13. Settings API
// =============================================================================
export const settingsApi = {
  getSettings(): Promise<TeacherSettingsData> {
    return request<TeacherSettingsData>('/teacher/settings', { method: 'GET' }, () => ({
      account: {
        id: 'user_1',
        name: 'Ustadh Abdullah Farooq',
        email: 'abdullah.farooq@madrasanexa.lk',
        role: 'TEACHER',
        ustadhCode: 'UST-014',
        mustChangePassword: false,
        memberSince: '2023-01-15T00:00:00Z',
      },
      preferences: {
        emailNotifications: true,
        whatsappAlerts: true,
        language: 'en',
      },
    }));
  },

  changePassword(payload: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    return request('/teacher/settings/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, () => ({ success: true, message: 'Password updated successfully.' }));
  },

  updatePreferences(preferences: { emailNotifications?: boolean; whatsappAlerts?: boolean; language?: string }): Promise<{
    success: boolean;
    message: string;
    preferences: any;
  }> {
    return request('/teacher/settings/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    }, () => ({ success: true, message: 'Preferences updated successfully.', preferences }));
  },
};
