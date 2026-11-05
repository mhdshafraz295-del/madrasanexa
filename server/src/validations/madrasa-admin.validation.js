import { z } from 'zod';
import {
  createNormalizedEmailSchema,
  createOptionalNormalizedEmailSchema,
} from '../utils/email-normalization.js';

/**
 * Valid IANA timezone checker using Intl.
 */
function isValidTimezone(tz) {
  if (typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Dashboard query parameters validation.
 * Supports: 'current_month', '3m', '6m', '12m', 'year'.
 * Default: '12m'.
 */
export const dashboardQuerySchema = z.object({
  range: z
    .enum(['current_month', '3m', '6m', '12m', 'year'])
    .optional()
    .default('12m'),
});

/**
 * Tenant settings update schema.
 * Allows updating editable profile and MadrasaSetting fields.
 * Explicitly strips/ignores platform-level identifiers (code, slug, status, id, madrasaId, archivedAt).
 */
export const updateSettingsSchema = z.object({
  // Editable Madrasa Institution Fields
  name: z
    .string()
    .trim()
    .min(2, 'Institution name must be at least 2 characters.')
    .max(100, 'Institution name must not exceed 100 characters.')
    .optional(),
  email: createOptionalNormalizedEmailSchema(120).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,25}$/, 'Invalid phone number format.')
    .optional()
    .nullable(),
  address: z
    .string()
    .trim()
    .max(500, 'Address must not exceed 500 characters.')
    .optional()
    .nullable(),

  // Editable MadrasaSetting Fields
  invoicePrefix: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_-]{1,10}$/, 'Invoice prefix must be 1-10 alphanumeric characters (uppercase, digits, _, -).')
    .optional(),
  receiptPrefix: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_-]{1,10}$/, 'Receipt prefix must be 1-10 alphanumeric characters (uppercase, digits, _, -).')
    .optional(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, 'Currency code must be a valid 3-letter ISO code (e.g. LKR, USD).')
    .optional(),
  timezone: z
    .string()
    .trim()
    .refine(isValidTimezone, 'Timezone must be a valid IANA timezone (e.g. Asia/Colombo).')
    .optional(),
  academicYear: z
    .string()
    .trim()
    .regex(/^[0-9]{4}(\/[0-9]{4})?$/, 'Academic year must be a 4-digit year or format YYYY/YYYY (e.g. 2026 or 2026/2027).')
    .optional()
    .nullable(),
  receiptHeader: z
    .string()
    .trim()
    .max(500, 'Receipt header text must not exceed 500 characters.')
    .optional()
    .nullable(),
  receiptFooter: z
    .string()
    .trim()
    .max(500, 'Receipt footer text must not exceed 500 characters.')
    .optional()
    .nullable(),

  // Centralized Date & Time Settings
  dateFormat: z
    .enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'])
    .optional(),
  timeFormat: z
    .enum(['12_HOUR', '24_HOUR'])
    .optional(),
  workingHoursStart: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Working hours start must be in HH:mm format (e.g. 07:30).')
    .optional(),
  workingHoursEnd: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Working hours end must be in HH:mm format (e.g. 16:30).')
    .optional(),
  workingDays: z
    .array(z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']))
    .optional(),
  weeklyHolidays: z
    .array(z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']))
    .optional(),
  attendanceStartTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Attendance start time must be in HH:mm format (e.g. 07:30).')
    .optional(),
  attendanceClosingTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Attendance closing time must be in HH:mm format (e.g. 08:30).')
    .optional(),
  lateMarkingTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Late marking time must be in HH:mm format (e.g. 08:00).')
    .optional(),
  attendanceGracePeriodMinutes: z
    .coerce
    .number()
    .int('Grace period must be an integer.')
    .min(0, 'Grace period cannot be negative.')
    .max(180, 'Grace period cannot exceed 180 minutes.')
    .optional(),
  autoAttendanceClosing: z
    .boolean()
    .optional(),
  timetableSlotDurationMinutes: z
    .coerce
    .number()
    .int('Slot duration must be an integer.')
    .min(15, 'Slot duration must be at least 15 minutes.')
    .max(180, 'Slot duration cannot exceed 180 minutes.')
    .optional(),
}).superRefine((data, ctx) => {
  // 1. Working hours logical sequence
  if (data.workingHoursStart && data.workingHoursEnd) {
    if (data.workingHoursStart >= data.workingHoursEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['workingHoursEnd'],
        message: 'Working hours end time must be after start time.',
      });
    }
  }

  // 2. Attendance timing logical sequence
  if (data.attendanceStartTime && data.lateMarkingTime) {
    if (data.attendanceStartTime > data.lateMarkingTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lateMarkingTime'],
        message: 'Late marking time must be at or after attendance start time.',
      });
    }
  }

  if (data.lateMarkingTime && data.attendanceClosingTime) {
    if (data.lateMarkingTime > data.attendanceClosingTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['attendanceClosingTime'],
        message: 'Attendance closing time must be at or after late marking time.',
      });
    }
  }

  // 3. Mutual exclusivity of working days and weekly holidays
  if (Array.isArray(data.workingDays) && Array.isArray(data.weeklyHolidays)) {
    const overlapping = data.workingDays.filter((day) => data.weeklyHolidays.includes(day));
    if (overlapping.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weeklyHolidays'],
        message: `Days cannot be both working days and weekly holidays: ${overlapping.join(', ')}.`,
      });
    }
  }
});

/**
 * Admin profile update schema.
 * Allows updating admin user name and email.
 * Rejects privilege-escalation fields (role, madrasaId, isActive, mustChangePassword, passwordHash).
 */
export const updateAdminProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(100, 'Name must not exceed 100 characters.')
    .optional(),
  email: createOptionalNormalizedEmailSchema(120),
});

/**
 * Tenant activity query schema.
 */
export const activityQuerySchema = z.object({
  page: z
    .coerce
    .number()
    .int()
    .min(1)
    .default(1),
  pageSize: z
    .coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  action: z
    .string()
    .trim()
    .optional(),
});
