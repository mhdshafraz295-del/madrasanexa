import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const canonicalUtcDate = z
  .string()
  .trim()
  .min(1, 'Payment date is required')
  .refine((val) => {
    const d = new Date(val);
    return !isNaN(d.getTime());
  }, { message: 'Invalid payment date format. Expected YYYY-MM-DD.' })
  .transform((val) => {
    // If YYYY-MM-DD format, set strictly to UTC midnight
    if (dateRegex.test(val)) {
      return new Date(`${val}T00:00:00.000Z`);
    }
    const d = new Date(val);
    const isoDate = d.toISOString().slice(0, 10);
    return new Date(`${isoDate}T00:00:00.000Z`);
  });

export const createPaymentSubmissionSchema = z
  .object({
    planId: z.string({ required_error: 'Subscription plan is required' }).trim().min(1, 'Plan ID cannot be empty'),
    submittedAmount: z.coerce
      .number({ required_error: 'Submitted amount is required' })
      .positive('Submitted amount must be a positive number')
      .refine((val) => /^\d+(\.\d{1,2})?$/.test(String(val)), {
        message: 'Submitted amount can have at most 2 decimal places',
      }),
    paymentDate: canonicalUtcDate,
    reference: z.string().trim().max(100, 'Reference cannot exceed 100 characters').optional().nullable(),
    notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional().nullable(),
  })
  .strict();

export const rejectPaymentSubmissionSchema = z
  .object({
    rejectionReason: z
      .string({ required_error: 'Rejection reason is required' })
      .trim()
      .min(3, 'Rejection reason must be at least 3 characters')
      .max(500, 'Rejection reason cannot exceed 500 characters'),
  })
  .strict();

export const updateBankDetailsSchema = z
  .object({
    bankName: z.string().trim().min(2, 'Bank name is required').max(100),
    accountName: z.string().trim().min(2, 'Account name is required').max(100),
    accountNumber: z.string().trim().min(2, 'Account number is required').max(50),
    branch: z.string().trim().min(2, 'Branch is required').max(100),
    instructions: z.string().trim().max(1000).optional().nullable(),
  })
  .strict();

export const listPaymentSubmissionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ALL']).optional().default('ALL'),
  search: z.string().trim().optional(),
});
