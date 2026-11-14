import { z } from 'zod';

export const listCardTokensQuerySchema = z.object({
  classId: z.string().trim().min(1).optional(),
  search: z.string().trim().optional(),
  status: z.enum(['ALL', 'ACTIVE_TOKEN', 'MISSING_TOKEN', 'REVOKED']).optional().default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const batchGenerateTokensSchema = z.object({
  classId: z.string().trim().min(1).optional(),
});

export const batchPrintTokensSchema = z
  .object({
    studentIds: z.array(z.string().trim().min(1)).min(1).max(100).optional(),
    classId: z.string().trim().min(1).optional(),
  })
  .refine(
    (data) => (data.studentIds && data.studentIds.length > 0) || Boolean(data.classId),
    {
      message: 'Either studentIds (array of 1-100 IDs) or classId must be provided for batch print data.',
      path: ['studentIds'],
    }
  );

export const regenerateTokenSchema = z.object({
  reason: z
    .string({ required_error: 'Mandatory reason is required for token regeneration.' })
    .trim()
    .min(3, 'A mandatory reason (minimum 3 characters) is required for token regeneration.')
    .max(255, 'Reason cannot exceed 255 characters.'),
});

export const revokeTokenSchema = z.object({
  reason: z
    .string({ required_error: 'Mandatory reason is required for token revocation.' })
    .trim()
    .min(3, 'A mandatory reason (minimum 3 characters) is required for token revocation.')
    .max(255, 'Reason cannot exceed 255 characters.'),
});

export const renderSheetPdfSchema = z.object({
  html: z
    .string({ required_error: 'HTML content is required for sheet rendering.' })
    .min(10, 'HTML content is too short.'),
  title: z.string().trim().max(100).optional().default('student-id-cards-a4'),
});

