import { z } from 'zod';

export const previewInvoicesSchema = z.object({
  billingYear: z.coerce.number().int().min(2000).max(2100),
  billingMonth: z.coerce.number().int().min(1).max(12),
  dueDate: z.string().optional().nullable(),
  classId: z.string().optional().nullable(),
  studentIds: z.array(z.string()).optional().nullable(),
});

export const generateInvoicesSchema = z.object({
  billingYear: z.coerce.number().int().min(2000).max(2100),
  billingMonth: z.coerce.number().int().min(1).max(12),
  dueDate: z.string().min(1, 'Due date is required.'),
  classId: z.string().optional().nullable(),
  studentIds: z.array(z.string()).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  billingYear: z.coerce.number().int().min(2000).max(2100).optional(),
  billingMonth: z.coerce.number().int().min(1).max(12).optional(),
  status: z.enum(['ALL', 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID']).default('ALL'),
  classId: z.string().optional(),
  studentId: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'invoiceNo', 'totalAmount', 'dueDate', 'billingMonth']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const voidInvoiceSchema = z.object({
  reason: z.string().trim().min(3, 'Void reason must be at least 3 characters.').max(500, 'Void reason cannot exceed 500 characters.'),
});

export const studentInvoiceHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
