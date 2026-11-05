import { z } from 'zod';
import { createOptionalNormalizedEmailSchema } from '../utils/email-normalization.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_REGEX = /^\d{4}-\d{2}$/;
// International E.164 format: starts with +, followed by country code and digits (8-15 total digits)
const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

export const createUstadhSchema = z.object({
  ustadhCode: z.string().trim().min(1).max(50).optional(),
  staffType: z.enum(['USTADH', 'SCHOOL_TEACHER']).default('USTADH'),
  fullName: z.string().trim().min(1, 'Full name is required.').max(100),
  phoneNumber: z.string().trim().max(30).optional().nullable(),
  whatsappNumber: z.string().trim().regex(E164_PHONE_REGEX, {
    message: 'WhatsApp number must be in canonical international format (e.g. +94783254552 or +12025550123).',
  }).optional().nullable(),
  email: createOptionalNormalizedEmailSchema(),
  address: z.string().trim().max(500).optional().nullable(),
  joinDate: z.string().regex(DATE_REGEX, 'Join date must be in YYYY-MM-DD format.'),
  leaveDate: z.string().regex(DATE_REGEX, 'Leave date must be in YYYY-MM-DD format.').optional().nullable(),
  baseMonthlySalary: z.union([z.number().min(0), z.string()]).refine((val) => {
    const num = typeof val === 'number' ? val : parseFloat(val);
    return !isNaN(num) && num >= 0;
  }, { message: 'Base monthly salary must be a valid non-negative number.' }),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
}).refine((data) => {
  if (data.leaveDate && data.joinDate) {
    return data.leaveDate >= data.joinDate;
  }
  return true;
}, {
  message: 'Leave date must be on or after join date.',
  path: ['leaveDate'],
});

export const updateUstadhSchema = z.object({
  ustadhCode: z.string().trim().min(1).max(50).optional(),
  staffType: z.enum(['USTADH', 'SCHOOL_TEACHER']).optional(),
  fullName: z.string().trim().min(1).max(100).optional(),
  phoneNumber: z.string().trim().max(30).optional().nullable(),
  whatsappNumber: z.string().trim().regex(E164_PHONE_REGEX, {
    message: 'WhatsApp number must be in canonical international format (e.g. +94783254552 or +12025550123).',
  }).optional().nullable(),
  email: z.preprocess((val) => (val === undefined ? undefined : val), createOptionalNormalizedEmailSchema()).optional(),
  address: z.string().trim().max(500).optional().nullable(),
  joinDate: z.string().regex(DATE_REGEX).optional(),
  leaveDate: z.string().regex(DATE_REGEX).optional().nullable(),
  baseMonthlySalary: z.union([z.number().min(0), z.string()]).refine((val) => {
    const num = typeof val === 'number' ? val : parseFloat(val);
    return !isNaN(num) && num >= 0;
  }, { message: 'Base monthly salary must be a valid non-negative number.' }).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
}).refine((data) => {
  if (data.leaveDate && data.joinDate) {
    return data.leaveDate >= data.joinDate;
  }
  return true;
}, {
  message: 'Leave date must be on or after join date.',
  path: ['leaveDate'],
});

export const createScheduleSchema = z.object({
  ustadhId: z.string().min(1, 'Ustadh ID is required.'),
  classId: z.string().min(1, 'Class ID is required.'),
  subjectId: z.string().min(1, 'Subject ID is required.'),
  dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
  startMinutes: z.number().int().min(0).max(1439, 'Start minutes must be between 0 and 1439.'),
  endMinutes: z.number().int().min(1).max(1440, 'End minutes must be between 1 and 1440.'),
  effectiveFrom: z.string().regex(DATE_REGEX, 'Effective from date must be in YYYY-MM-DD format.'),
  effectiveTo: z.string().regex(DATE_REGEX, 'Effective to date must be in YYYY-MM-DD format.').optional().nullable(),
  isActive: z.boolean().optional(),
}).refine((data) => data.endMinutes > data.startMinutes, {
  message: 'End time must be strictly after start time.',
  path: ['endMinutes'],
}).refine((data) => {
  if (data.effectiveTo && data.effectiveFrom) {
    return data.effectiveTo >= data.effectiveFrom;
  }
  return true;
}, {
  message: 'Effective to date must be on or after effective from date.',
  path: ['effectiveTo'],
});

export const updateScheduleSchema = z.object({
  classId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).optional(),
  startMinutes: z.number().int().min(0).max(1439).optional(),
  endMinutes: z.number().int().min(1).max(1440).optional(),
  effectiveFrom: z.string().regex(DATE_REGEX).optional(),
  effectiveTo: z.string().regex(DATE_REGEX).optional().nullable(),
  isActive: z.boolean().optional(),
}).refine((data) => {
  if (data.startMinutes !== undefined && data.endMinutes !== undefined) {
    return data.endMinutes > data.startMinutes;
  }
  return true;
}, {
  message: 'End time must be strictly after start time.',
  path: ['endMinutes'],
}).refine((data) => {
  if (data.effectiveTo && data.effectiveFrom) {
    return data.effectiveTo >= data.effectiveFrom;
  }
  return true;
}, {
  message: 'Effective to date must be on or after effective from date.',
  path: ['effectiveTo'],
});

export const getAttendanceSchema = z.object({
  date: z.string().regex(DATE_REGEX, 'Date must be in YYYY-MM-DD format.'),
});

export const saveAttendanceRecordItem = z.object({
  scheduleId: z.string().min(1, 'Schedule ID is required.'),
  status: z.enum(['PRESENT', 'ABSENT']),
});

export const saveStaffAttendanceSchema = z.object({
  date: z.string().regex(DATE_REGEX, 'Date must be in YYYY-MM-DD format.'),
  records: z.array(saveAttendanceRecordItem).min(1, 'At least one attendance record is required.'),
});

export const getAttendanceHistorySchema = z.object({
  ustadhId: z.string().optional(),
  classId: z.string().optional(),
  startDate: z.string().regex(DATE_REGEX).optional(),
  endDate: z.string().regex(DATE_REGEX).optional(),
  status: z.enum(['PRESENT', 'ABSENT']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const getMonthlyAttendanceSummarySchema = z.object({
  month: z.string().regex(MONTH_REGEX, 'Month must be in YYYY-MM format.'),
  ustadhId: z.string().optional(),
});

export const generateSalariesSchema = z.object({
  month: z.string().regex(MONTH_REGEX, 'Month must be in YYYY-MM format.'),
});

export const getSalariesSchema = z.object({
  month: z.string().regex(MONTH_REGEX).optional(),
  ustadhId: z.string().optional(),
  status: z.enum(['PENDING', 'PAID']).optional(),
  staffType: z.enum(['USTADH', 'SCHOOL_TEACHER']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const updateSalaryPayableSchema = z.object({
  payableAmount: z.union([z.number().min(0), z.string()]).refine((val) => {
    const num = typeof val === 'number' ? val : parseFloat(val);
    return !isNaN(num) && num >= 0;
  }, { message: 'Payable amount must be a non-negative number.' }),
  adjustmentReason: z.string().trim().max(500).optional().nullable(),
});

export const paySalarySchema = z.object({
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER']),
  paymentDate: z.string().regex(DATE_REGEX, 'Payment date must be in YYYY-MM-DD format.'),
  paymentReference: z.string().trim().max(100).optional().nullable(),
  paymentNote: z.string().trim().max(500).optional().nullable(),
});

export const sendUstadhEmailSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required.').max(200, 'Subject is too long.'),
  message: z.string().trim().min(1, 'Message is required.').max(5000, 'Message is too long.'),
});

export const sendSalaryEmailSchema = z.object({
  subject: z
    .string({ invalid_type_error: 'Subject must be a string.' })
    .refine((val) => val.trim().length > 0, {
      message: 'Subject cannot be empty or only whitespace.',
    })
    .refine((val) => val.trim().length <= 200, {
      message: 'Subject cannot exceed 200 characters.',
    })
    .refine((val) => !/[\r\n]/.test(val), {
      message: 'Subject cannot contain newline or carriage return characters.',
    })
    .optional(),
  message: z
    .string({ invalid_type_error: 'Message must be a string.' })
    .refine((val) => val.trim().length > 0, {
      message: 'Message cannot be empty or only whitespace.',
    })
    .refine((val) => val.length <= 5000, {
      message: 'Message cannot exceed 5000 characters.',
    })
    .optional(),
});
