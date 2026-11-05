import { z } from 'zod';

/**
 * Common query schemas for Madrasa Fee Reports
 */

export const reportQuerySchema = z.object({
  billingYear: z.coerce.number().int().min(2000).max(2100).optional(),
  billingMonth: z.coerce.number().int().min(1).max(12).optional(),
  academicSectionId: z.string().trim().min(1).optional().nullable(),
  classId: z.string().trim().min(1).optional().nullable(),
  studentId: z.string().trim().min(1).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid startDate format (YYYY-MM-DD)').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid endDate format (YYYY-MM-DD)').optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER']).optional(),
  status: z.string().trim().max(50).optional(),
  sortBy: z.enum(['largest_balance', 'oldest_due', 'student_name', 'class', 'section', 'amount_desc', 'date_desc', 'date_asc']).optional(),
  format: z.enum(['json', 'pdf', 'csv']).default('json'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

export const studentStatementQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid startDate format (YYYY-MM-DD)').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid endDate format (YYYY-MM-DD)').optional(),
  format: z.enum(['json', 'pdf', 'csv']).default('json'),
});
