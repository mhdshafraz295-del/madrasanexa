import { z } from 'zod';
import { createOptionalNormalizedEmailSchema } from '../utils/email-normalization.js';
import { getFeatureByKey } from '../constants/feature-catalogue.js';

/**
 * Super Admin Action Validation Schemas
 */

export const approveOnboardingSchema = z.object({
  madrasaCode: z
    .string({ required_error: 'Madrasa code is required' })
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(20, 'Code cannot exceed 20 characters')
    .regex(/^[A-Z0-9_-]+$/i, 'Code must contain only letters, numbers, hyphens, and underscores'),
  madrasaSlug: z
    .string({ required_error: 'Madrasa slug is required' })
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug cannot exceed 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  madrasaName: z.string().trim().min(2).max(120).optional(),
  adminName: z.string().trim().min(2).max(100).optional(),
  adminEmail: createOptionalNormalizedEmailSchema('Invalid admin email address format.').optional(),
  planId: z.string().trim().min(1).optional().nullable(), // Legacy optional: omitted in standard onboarding
  startsAt: z.coerce.date().optional(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER']).optional(),
  paymentReference: z.string().trim().max(100).optional().nullable(),
  paymentNotes: z.string().trim().max(500).optional().nullable(),
  recordInitialPayment: z.boolean().default(false),
  temporaryPassword: z.string().min(10).max(100).optional(),
}).strict();

export const rejectOnboardingSchema = z.object({
  rejectionReason: z
    .string({ required_error: 'Rejection reason is required' })
    .trim()
    .min(3, 'Rejection reason must be at least 3 characters')
    .max(500, 'Rejection reason cannot exceed 500 characters'),
}).strict();

export const updateMadrasaSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: createOptionalNormalizedEmailSchema('Invalid madrasa email address format.').optional(),
  phone: z.string().trim().min(7).max(25).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
}).strict();

const planDurationSchema = z.union([z.number(), z.string()])
  .refine((val) => {
    const s = String(val).trim();
    if (!/^\d+$/.test(s)) return false;
    const n = parseInt(s, 10);
    return n >= 1 && Number.isSafeInteger(n);
  }, { message: 'Duration must be an integer of at least 1 month' })
  .transform((val) => parseInt(String(val).trim(), 10));

const planPriceSchema = z.union([z.number(), z.string()])
  .refine((val) => {
    const s = String(val).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return false;
    const n = Number(s);
    return !isNaN(n) && n >= 0 && Number.isFinite(n);
  }, { message: 'Price must be a valid non-negative number with at most 2 decimal places' })
  .transform((val) => String(val).trim());

const featureKeysSchema = z
  .array(z.string().trim())
  .superRefine((keys, ctx) => {
    const seen = new Set();
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate feature key '${key}' is not allowed`,
          path: [i],
        });
        continue;
      }
      seen.add(key);

      const feature = getFeatureByKey(key);
      if (!feature) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown feature key '${key}'`,
          path: [i],
        });
      } else if (!feature.isAssignable) {
        if (feature.status === 'CORE') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Feature '${key}' is a CORE platform feature and cannot be assigned to plans`,
            path: [i],
          });
        } else if (feature.status === 'PARTIALLY_IMPLEMENTED') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Feature '${key}' is partially implemented and cannot be assigned to plans`,
            path: [i],
          });
        } else if (feature.status === 'PLANNED') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Feature '${key}' is a planned roadmap feature and cannot be assigned to plans`,
            path: [i],
          });
        } else {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Feature '${key}' is not assignable to plans`,
            path: [i],
          });
        }
      }
    }
  });

export const createPlanSchema = z.object({
  name: z.string({ required_error: 'Plan name is required' }).trim().min(2, 'Plan name must be at least 2 characters').max(100, 'Plan name cannot exceed 100 characters'),
  code: z
    .string({ required_error: 'Plan code is required' })
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(50, 'Code cannot exceed 50 characters')
    .regex(/^[A-Z0-9_-]+$/i, 'Code must contain only alphanumeric characters, underscores, and hyphens')
    .transform((c) => c.toUpperCase()),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional().nullable(),
  durationMonths: planDurationSchema,
  price: planPriceSchema,
  isActive: z.boolean().default(true),
  featureKeys: featureKeysSchema.optional(),
}).strict();

export const updatePlanFeaturesSchema = z.object({
  featureKeys: featureKeysSchema,
}).strict();

export const updatePlanSchema = z.object({
  name: z.string().trim().min(2, 'Plan name must be at least 2 characters').max(100, 'Plan name cannot exceed 100 characters').optional(),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional().nullable(),
  durationMonths: planDurationSchema.optional(),
  price: planPriceSchema.optional(),
  isActive: z.boolean().optional(),
}).strict();

export const listPlansQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['ALL', 'ACTIVE', 'INACTIVE']).default('ALL').optional(),
});

export const planComparisonQuerySchema = z.object({
  includeInactive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((val) => val === true || val === 'true')
    .optional()
    .default(false),
  planIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      if (Array.isArray(val)) return val.map((s) => s.trim()).filter(Boolean);
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }),
});

export const renewSubscriptionSchema = z.object({
  planId: z.string({ required_error: 'Plan is required' }).min(1),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER']).default('BANK_TRANSFER'),
  reference: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
}).strict();

export const adminPasswordResetSchema = z.object({
  temporaryPassword: z.string().min(10).max(100).optional(),
}).strict();

export const listMadrasasQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']).optional(),
  planId: z.string().trim().optional(),
  subscriptionStatus: z.enum(['ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'SUSPENDED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const updateMadrasaStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED'], { required_error: 'Status is required' }),
  reason: z.string().trim().max(500).optional().nullable(),
}).strict();

export const dashboardQuerySchema = z.object({
  period: z.enum(['6m', '12m'], {
    errorMap: () => ({ message: "Invalid period. Must be '6m' or '12m'." }),
  }).optional().default('6m'),
});
