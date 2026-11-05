import { z } from 'zod';

export const createPaymentSchema = z
  .object({
    studentId: z.string().min(1, 'Student ID is required.'),
    amount: z.coerce.number().positive('Payment amount must be greater than zero.'),
    paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER'], {
      errorMap: () => ({ message: 'Payment method must be CASH, BANK_TRANSFER, CARD, or OTHER.' }),
    }),
    paidAt: z.string().optional().nullable(),
    reference: z.string().max(100, 'Reference cannot exceed 100 characters.').optional().nullable(),
    idempotencyKey: z
      .string()
      .trim()
      .min(1, 'Idempotency key is required for payment creation.')
      .max(100, 'Idempotency key cannot exceed 100 characters.'),
    notes: z.string().max(1000, 'Notes cannot exceed 1000 characters.').optional().nullable(),
    allocations: z
      .array(
        z.object({
          invoiceId: z.string().min(1, 'Invoice ID is required.'),
          amount: z.coerce.number().positive('Allocation amount must be greater than zero.'),
        })
      )
      .min(1, 'Payment must have at least one allocation.'),
  })
  .refine(
    (data) => {
      const invoiceIds = data.allocations.map((a) => a.invoiceId);
      return new Set(invoiceIds).size === invoiceIds.length;
    },
    {
      message: 'Duplicate invoice IDs inside one payment request are not allowed. Provide unique invoice allocations.',
      path: ['allocations'],
    }
  );

export const voidPaymentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Void reason must be at least 3 characters.')
    .max(500, 'Void reason cannot exceed 500 characters.'),
});

export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  studentId: z.string().optional(),
  paymentMethod: z.enum(['ALL', 'CASH', 'BANK_TRANSFER', 'CARD', 'OTHER']).default('ALL'),
  status: z.enum(['ALL', 'COMPLETED', 'VOID']).default('ALL'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.enum(['paidAt', 'createdAt', 'amount', 'paymentNo']).default('paidAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const monthlyLedgerQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const posSearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query cannot be empty.').max(100),
});
