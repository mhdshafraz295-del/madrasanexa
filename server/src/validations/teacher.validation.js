import { z } from 'zod';

/**
 * Teacher Profile Self-Update Schema (PATCH /api/teacher/profile)
 * Allows updating personal and emergency contact details while strictly prohibiting
 * modification of institutional, financial, or security fields.
 */
export const teacherProfileUpdateSchema = z.object({
  phoneNumber: z.string().trim().max(30).optional().nullable(),
  whatsappNumber: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  emergencyContact: z
    .object({
      name: z.string().trim().min(1).max(100),
      relationship: z.string().trim().min(1).max(50),
      phone: z.string().trim().min(1).max(30),
    })
    .optional()
    .nullable(),
  academicQualifications: z.array(z.any()).optional().nullable(),
  professionalQualifications: z.array(z.any()).optional().nullable(),
  teachingExperience: z.array(z.any()).optional().nullable(),
  documents: z.array(z.any()).optional().nullable(),
});

/**
 * Teacher Timetable Query Schema (GET /api/teacher/timetable)
 */
export const teacherTimetableQuerySchema = z.object({
  day: z
    .enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
           'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])
    .optional(),
});

/**
 * Permanent Classroom QR Check-In Verification Schema (POST /api/teacher/attendance/teacher/verify-qr)
 * Note: Acknowledges static QR cannot cryptographically prove physical presence, but strictly
 * bounds verification to schedule ownership, tenant identity, and Asia/Colombo wall-clock window.
 */
export const teacherVerifyQrSchema = z.object({
  roomToken: z
    .string({ required_error: 'Classroom roomToken is required.' })
    .trim()
    .min(1, 'roomToken cannot be empty.'),
  scheduleId: z
    .string({ required_error: 'scheduleId is required.' })
    .trim()
    .min(1, 'scheduleId cannot be empty.'),
  method: z.enum(['Classroom QR', 'Manual Fallback']).default('Classroom QR'),
  notes: z.string().trim().max(255).optional(),
});

/**
 * Student Period Attendance Session Query Schema (GET /api/teacher/attendance/student/session)
 */
export const studentPeriodSessionQuerySchema = z.object({
  scheduleId: z
    .string({ required_error: 'scheduleId is required.' })
    .trim()
    .min(1, 'scheduleId cannot be empty.'),
  date: z
    .string({ required_error: 'date is required (YYYY-MM-DD).' })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.'),
});

/**
 * Student Period Attendance Roll-Call Mark Schema (POST /api/teacher/attendance/student/mark)
 * Option A Full Isolation: Mark period lecture attendance without touching daily attendance.
 */
export const studentPeriodMarkSchema = z.object({
  scheduleId: z
    .string({ required_error: 'scheduleId is required.' })
    .trim()
    .min(1, 'scheduleId cannot be empty.'),
  date: z
    .string({ required_error: 'date is required (YYYY-MM-DD).' })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.'),
  records: z
    .array(
      z.object({
        studentId: z.string({ required_error: 'studentId is required.' }).trim().min(1),
        status: z.enum(['Present', 'Late', 'Excused', 'Absent'], {
          required_error: 'status must be Present, Late, Excused, or Absent.',
        }),
        remarks: z.string().trim().max(255).optional(),
        method: z.enum(['Barcode Scan', 'Teacher Manual']).default('Teacher Manual'),
      })
    )
    .min(1, 'At least one student attendance record must be provided.'),
});

/**
 * Student Period Attendance Session Seal Schema (POST /api/teacher/attendance/student/seal)
 */
export const studentPeriodSealSchema = z.object({
  scheduleId: z
    .string({ required_error: 'scheduleId is required.' })
    .trim()
    .min(1, 'scheduleId cannot be empty.'),
  date: z
    .string({ required_error: 'date is required (YYYY-MM-DD).' })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.'),
});

/**
 * Attendance History Query Schema (GET /api/teacher/attendance/history)
 */
export const teacherAttendanceHistoryQuerySchema = z.object({
  type: z.enum(['teacher', 'student']).default('teacher'),
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format.')
    .optional(),
  endDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format.')
    .optional(),
  classId: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Payment History Query Schema (GET /api/teacher/salary/history)
 */
export const teacherPaymentHistoryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Notifications Query Schema (GET /api/teacher/notifications)
 */
export const teacherNotificationsQuerySchema = z.object({
  category: z.string().trim().optional(),
  unreadOnly: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Password Change Schema (PUT /api/teacher/settings/password)
 */
export const teacherPasswordChangeSchema = z.object({
  currentPassword: z.string({ required_error: 'Current password is required.' }).min(1),
  newPassword: z
    .string({ required_error: 'New password is required.' })
    .min(8, 'New password must be at least 8 characters long.')
    .max(128, 'New password cannot exceed 128 characters.'),
});

/**
 * Teacher Preferences Update Schema (PUT /api/teacher/settings/preferences)
 */
export const teacherPreferencesUpdateSchema = z.object({
  emailNotifications: z.boolean().optional(),
  whatsappAlerts: z.boolean().optional(),
  language: z.enum(['en', 'ar', 'ta', 'si']).optional(),
});
