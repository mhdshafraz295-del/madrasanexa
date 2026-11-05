import { z } from 'zod';

export const createAcademicSectionSchema = z.object({
  name: z
    .string({ required_error: 'Section name is required.' })
    .trim()
    .min(2, 'Section name must be at least 2 characters.')
    .max(100, 'Section name must not exceed 100 characters.'),
  code: z
    .string()
    .trim()
    .max(30, 'Section code must not exceed 30 characters.')
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
  description: z
    .string()
    .trim()
    .max(500, 'Section description must not exceed 500 characters.')
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
  sortOrder: z.coerce.number().int().min(0, 'Sort order must be non-negative.').default(0),
});

export const updateAcademicSectionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Section name must be at least 2 characters.')
    .max(100, 'Section name must not exceed 100 characters.')
    .optional(),
  code: z
    .string()
    .trim()
    .max(30, 'Section code must not exceed 30 characters.')
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val.trim() : null)),
  description: z
    .string()
    .trim()
    .max(500, 'Section description must not exceed 500 characters.')
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val.trim() : null)),
  sortOrder: z.coerce.number().int().min(0, 'Sort order must be non-negative.').optional(),
});

export const listAcademicSectionsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().optional(),
    isActive: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .optional()
      .transform((val) => (val === undefined ? undefined : val === true || val === 'true')),
    status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).optional(),
  })
  .transform((data) => {
    let isActive = data.isActive;
    if (isActive === undefined && data.status) {
      if (data.status === 'ACTIVE') isActive = true;
      else if (data.status === 'INACTIVE') isActive = false;
    }
    return {
      page: data.page,
      pageSize: data.pageSize,
      search: data.search,
      isActive,
    };
  });
