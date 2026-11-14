import { z } from 'zod';
import { TOKEN_FORMAT_REGEX } from '../utils/scan-token-crypto.js';

export const getDailyAttendanceSchema = z.object({
  classId: z.string().min(1, 'Class ID is required.'),
  academicYear: z.string().min(1, 'Academic Year is required.').max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.'),
});

export const saveDailyAttendanceSchema = z.object({
  classId: z.string().min(1, 'Class ID is required.'),
  academicYear: z.string().min(1, 'Academic Year is required.').max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.'),
  records: z
    .array(
      z.object({
        studentId: z.string().min(1, 'Student ID is required.'),
        status: z.enum(['PRESENT', 'ABSENT'], {
          errorMap: () => ({ message: 'Status must be either PRESENT or ABSENT.' }),
        }),
      })
    )
    .min(1, 'At least one student record is required.'),
});

export const getAttendanceHistorySchema = z.object({
  classId: z.string().min(1, 'Class ID is required.'),
  academicYear: z.string().max(50).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const getMonthlySummarySchema = z.object({
  classId: z.string().min(1, 'Class ID is required.'),
  academicYear: z.string().max(50).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format.'),
});

export const getStudentAttendanceSchema = z.object({
  academicYear: z.string().max(50).optional(),
});

export const verifyScanTokenSchema = z.object({
  token: z
    .string()
    .min(1, 'Scan token is required.')
    .trim()
    .regex(TOKEN_FORMAT_REGEX, 'Invalid token format. Token must follow the canonical MNX1_ format.'),
  classId: z.string().min(1, 'Class ID must be a non-empty string.').optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.').optional(),
  academicYear: z.string().max(50).optional(),
});

export const ingestScannedAttendanceSchema = z
  .object({
    token: z
      .string()
      .min(1, 'Scan token is required.')
      .trim()
      .regex(TOKEN_FORMAT_REGEX, 'Invalid token format. Token must follow the canonical MNX1_ format.'),
    classId: z.string().min(1, 'Class ID is required.'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.'),
    academicYear: z.string().min(1, 'Academic Year is required.').max(50),
    status: z.enum(['PRESENT', 'ABSENT']).default('PRESENT'),
    overwrite: z.boolean().default(false),
    reason: z.string().max(255).optional(),
  })
  .refine(
    (data) => !data.overwrite || (typeof data.reason === 'string' && data.reason.trim().length >= 3),
    {
      message: 'A mandatory reason (minimum 3 characters) is required when overwrite is true.',
      path: ['reason'],
    }
  );

export const verifyAdmissionBarcodeSchema = z
  .object({
    admissionNo: z.string({ required_error: 'Admission number is required.' }).trim().min(1, 'Admission number is required.'),
    classId: z.string().trim().min(1, 'Class ID must be a non-empty string.').optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.').optional(),
    academicYear: z.string().trim().max(50).optional(),
    overwrite: z.boolean().default(false),
    reason: z.string().max(255).optional(),
  })
  .refine(
    (data) => !data.overwrite || (typeof data.reason === 'string' && data.reason.trim().length >= 3),
    {
      message: 'A mandatory reason (minimum 3 characters) is required when overwrite is true.',
      path: ['reason'],
    }
  );


