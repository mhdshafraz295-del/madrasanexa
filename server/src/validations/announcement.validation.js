import { z } from 'zod';

const noHtmlRegex = /<[^>]+>/;

const plainText = (maxLength) =>
  z
    .string()
    .trim()
    .max(maxLength, `Maximum length is ${maxLength} characters`)
    .refine((val) => !noHtmlRegex.test(val), {
      message: 'HTML tags are not permitted. Use plain structured text only.',
    });

const isoDateTimeString = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val) return true;
      const d = new Date(val);
      return !isNaN(d.getTime());
    },
    { message: 'Invalid datetime format. Must be an ISO 8601 string.' }
  )
  .transform((val) => (val ? new Date(val).toISOString() : null));

export const createAnnouncementSchema = z
  .object({
    title: plainText(255).min(1, 'Title is required'),
    message: plainText(10000).min(1, 'Message is required'),
    category: z
      .enum(['GENERAL', 'SYSTEM', 'MAINTENANCE', 'UPDATE', 'BILLING', 'EVENT', 'OTHER'])
      .default('GENERAL'),
    priority: z.enum(['NORMAL', 'IMPORTANT', 'URGENT']).default('NORMAL'),
    audience: z.enum(['ALL_MADRASAS', 'SELECTED_MADRASAS']).default('ALL_MADRASAS'),
    publishAt: isoDateTimeString.optional().nullable(),
    expiresAt: isoDateTimeString.optional().nullable(),
    selectedMadrasaIds: z
      .array(z.string().trim().min(1, 'Madrasa ID cannot be empty'))
      .optional()
      .nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.audience === 'SELECTED_MADRASAS') {
      if (!data.selectedMadrasaIds || data.selectedMadrasaIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one Madrasa must be selected when audience is SELECTED_MADRASAS.',
          path: ['selectedMadrasaIds'],
        });
      }
    }
    if (data.publishAt && data.expiresAt) {
      if (new Date(data.expiresAt) <= new Date(data.publishAt)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Expiry date/time must be strictly after the publish date/time.',
          path: ['expiresAt'],
        });
      }
    }
  });

export const updateAnnouncementSchema = z
  .object({
    title: plainText(255).min(1, 'Title cannot be empty').optional(),
    message: plainText(10000).min(1, 'Message cannot be empty').optional(),
    category: z
      .enum(['GENERAL', 'SYSTEM', 'MAINTENANCE', 'UPDATE', 'BILLING', 'EVENT', 'OTHER'])
      .optional(),
    priority: z.enum(['NORMAL', 'IMPORTANT', 'URGENT']).optional(),
    audience: z.enum(['ALL_MADRASAS', 'SELECTED_MADRASAS']).optional(),
    publishAt: isoDateTimeString.optional().nullable(),
    expiresAt: isoDateTimeString.optional().nullable(),
    selectedMadrasaIds: z
      .array(z.string().trim().min(1, 'Madrasa ID cannot be empty'))
      .optional()
      .nullable(),
  })
  .strict();

export const publishAnnouncementSchema = z
  .object({
    publishAt: isoDateTimeString.optional().nullable(),
    expiresAt: isoDateTimeString.optional().nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.publishAt && data.expiresAt) {
      if (new Date(data.expiresAt) <= new Date(data.publishAt)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Expiry date/time must be strictly after the publish date/time.',
          path: ['expiresAt'],
        });
      }
    }
  });

export const superAdminListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'ALL']).optional().default('ALL'),
  category: z
    .enum(['GENERAL', 'SYSTEM', 'MAINTENANCE', 'UPDATE', 'BILLING', 'EVENT', 'OTHER'])
    .optional(),
  priority: z.enum(['NORMAL', 'IMPORTANT', 'URGENT']).optional(),
  audience: z.enum(['ALL_MADRASAS', 'SELECTED_MADRASAS']).optional(),
});

export const madrasaAdminListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  readStatus: z.enum(['ALL', 'READ', 'UNREAD']).optional().default('ALL'),
  category: z
    .enum(['GENERAL', 'SYSTEM', 'MAINTENANCE', 'UPDATE', 'BILLING', 'EVENT', 'OTHER'])
    .optional(),
  priority: z.enum(['NORMAL', 'IMPORTANT', 'URGENT']).optional(),
  search: z.string().trim().optional(),
});
