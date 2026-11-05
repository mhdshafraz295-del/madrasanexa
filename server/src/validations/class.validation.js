import { z } from 'zod';

export const createClassSchema = z.object({
  academicSectionId: z
    .string({ required_error: 'Academic section is required for new classes.' })
    .trim()
    .min(1, 'Academic section is required.'),
  name: z
    .string({ required_error: 'Class name is required.' })
    .trim()
    .min(2, 'Class name must be at least 2 characters.')
    .max(100, 'Class name must not exceed 100 characters.'),
  code: z
    .string()
    .trim()
    .max(30, 'Class code must not exceed 30 characters.')
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
  description: z
    .string()
    .trim()
    .max(500, 'Description must not exceed 500 characters.')
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
  defaultMonthlyFee: z
    .union([z.string(), z.number()])
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
      message: 'Default monthly fee must be a valid non-negative number.',
    })
    .transform((val) => String(Number(val).toFixed(2))),
});

export const updateClassSchema = z.object({
  academicSectionId: z
    .string()
    .trim()
    .min(1, 'Academic section ID cannot be empty.')
    .optional(),
  name: z
    .string()
    .trim()
    .min(2, 'Class name must be at least 2 characters.')
    .max(100, 'Class name must not exceed 100 characters.')
    .optional(),
  code: z
    .string()
    .trim()
    .max(30, 'Class code must not exceed 30 characters.')
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val.trim() : null)),
  description: z
    .string()
    .trim()
    .max(500, 'Description must not exceed 500 characters.')
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val && val.trim() !== '' ? val.trim() : null)),
  defaultMonthlyFee: z
    .union([z.string(), z.number()])
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
      message: 'Default monthly fee must be a valid non-negative number.',
    })
    .transform((val) => String(Number(val).toFixed(2)))
    .optional(),
});

export const listClassesQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(200).default(20),
    search: z.string().trim().optional(),
    academicSectionId: z.string().trim().optional(),
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
      academicSectionId: data.academicSectionId,
      isActive,
    };
  });
