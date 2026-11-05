import { z } from 'zod';

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
