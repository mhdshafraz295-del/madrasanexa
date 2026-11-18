import { z } from 'zod';

export const createStaffNoticeSchema = z.object({
  title: z.string().trim().min(1, 'Notice title is required.').max(255),
  message: z.string().trim().min(1, 'Notice message is required.').max(5000),
  priority: z.enum(['NORMAL', 'IMPORTANT', 'URGENT']).default('NORMAL'),
  category: z.enum(['GENERAL', 'SCHEDULE', 'EXAM', 'PAYROLL', 'EVENT']).default('GENERAL'),
  targetType: z.enum(['ALL_TEACHERS', 'CLASS', 'SPECIFIC_USTADHS']).default('ALL_TEACHERS'),
  targetClassId: z.string().trim().optional().nullable(),
  targetUstadhIds: z.array(z.string().trim()).optional().nullable(),
});

export const listStaffNoticesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().optional(),
  priority: z.string().trim().optional(),
  category: z.string().trim().optional(),
});
