import { z } from 'zod';

/**
 * Strict Decimal validation helpers:
 * - Rejects non-numeric strings such as "100abc", "NaN", "Infinity", scientific notation, etc.
 * - Enforces exact decimal place constraints.
 * - Enforces MySQL DECIMAL limits.
 */
const DECIMAL_12_2_REGEX = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const DECIMAL_12_3_REGEX = /^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/;

/**
 * Validates a positive decimal with max 2 decimal places fitting Decimal(12, 2).
 * Must be > 0.
 */
const positiveDecimal12_2 = z.union([z.number(), z.string()]).superRefine((val, ctx) => {
  const str = typeof val === 'number' ? (Number.isFinite(val) ? val.toString() : '') : val.trim();
  if (!DECIMAL_12_2_REGEX.test(str)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Must be a valid positive decimal number with at most 2 decimal places and maximum 10 integer digits.',
    });
    return;
  }
  const num = Number(str);
  if (num <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Amount must be greater than 0.',
    });
  }
});

/**
 * Validates a non-negative decimal with max 2 decimal places fitting Decimal(12, 2).
 * Must be >= 0.
 */
const nonNegativeDecimal12_2 = z.union([z.number(), z.string()]).superRefine((val, ctx) => {
  const str = typeof val === 'number' ? (Number.isFinite(val) ? val.toString() : '') : val.trim();
  if (!DECIMAL_12_2_REGEX.test(str)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Must be a valid non-negative decimal number with at most 2 decimal places and maximum 10 integer digits.',
    });
    return;
  }
  const num = Number(str);
  if (num < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Value cannot be negative.',
    });
  }
});

/**
 * Validates a positive decimal with max 3 decimal places fitting Decimal(12, 3).
 * Must be > 0.
 */
const positiveDecimal12_3 = z.union([z.number(), z.string()]).superRefine((val, ctx) => {
  const str = typeof val === 'number' ? (Number.isFinite(val) ? val.toString() : '') : val.trim();
  if (!DECIMAL_12_3_REGEX.test(str)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Must be a valid positive decimal number with at most 3 decimal places and maximum 9 integer digits.',
    });
    return;
  }
  const num = Number(str);
  if (num <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Quantity must be greater than 0.',
    });
  }
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required.').max(100, 'Category name cannot exceed 100 characters.'),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters.').optional().nullable(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name cannot be empty.').max(100, 'Category name cannot exceed 100 characters.').optional(),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters.').optional().nullable(),
  isActive: z.boolean().optional(),
});

export const createExpenseSchema = z.object({
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD.').superRefine((val, ctx) => {
    const [y, m, d] = val.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid calendar date.',
      });
    }
  }),
  categoryId: z.string().min(1, 'Category is required.'),
  description: z.string().trim().min(1, 'Description is required.').max(255, 'Description cannot exceed 255 characters.'),
  amount: positiveDecimal12_2,
  quantity: positiveDecimal12_3.optional().nullable(),
  unitLabel: z.string().trim().max(50, 'Unit label cannot exceed 50 characters.').optional().nullable(),
  unitCost: nonNegativeDecimal12_2.optional().nullable(),
  supplierName: z.string().trim().max(150, 'Supplier name cannot exceed 150 characters.').optional().nullable(),
  reasonNote: z.string().trim().max(2000, 'Reason note cannot exceed 2000 characters.').optional().nullable(),
});

export const updateExpenseSchema = z.object({
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD.').superRefine((val, ctx) => {
    const [y, m, d] = val.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid calendar date.',
      });
    }
  }).optional(),
  categoryId: z.string().min(1).optional(),
  description: z.string().trim().min(1).max(255).optional(),
  amount: positiveDecimal12_2.optional(),
  quantity: positiveDecimal12_3.optional().nullable(),
  unitLabel: z.string().trim().max(50).optional().nullable(),
  unitCost: nonNegativeDecimal12_2.optional().nullable(),
  supplierName: z.string().trim().max(150).optional().nullable(),
  reasonNote: z.string().trim().max(2000).optional().nullable(),
});

export const voidExpenseSchema = z.object({
  voidReason: z.string().trim().min(1, 'Void reason is required.').max(500, 'Void reason cannot exceed 500 characters.'),
});

export const listExpensesSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format. Expected YYYY-MM.').optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid startDate format. Expected YYYY-MM-DD.').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid endDate format. Expected YYYY-MM-DD.').optional(),
  categoryId: z.string().optional(),
  status: z.enum(['ACTIVE', 'VOID']).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const monthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format. Expected YYYY-MM.'),
});

export const upsertBudgetSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1, 'Month must be between 1 and 12.').max(12, 'Month must be between 1 and 12.'),
  budgets: z.array(
    z.object({
      categoryId: z.string().min(1, 'Category ID is required.'),
      amount: nonNegativeDecimal12_2,
    })
  ).min(1, 'At least one budget entry is required.').superRefine((items, ctx) => {
    const seen = new Set();
    for (let i = 0; i < items.length; i++) {
      if (seen.has(items[i].categoryId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate categoryId '${items[i].categoryId}' in budgets array. Each category can only have one budget per month.`,
          path: [i, 'categoryId'],
        });
      }
      seen.add(items[i].categoryId);
    }
  }),
});

export const upsertInsightSchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required.'),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1, 'Month must be between 1 and 12.').max(12, 'Month must be between 1 and 12.'),
  adminReason: z.string().trim().max(2000, 'Admin reason cannot exceed 2000 characters.').optional().nullable(),
  actionPlan: z.string().trim().max(2000, 'Action plan cannot exceed 2000 characters.').optional().nullable(),
});
