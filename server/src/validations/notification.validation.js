import { z } from 'zod';

export const updateNotificationSettingsSchema = z.object({
  autoFeePaymentSmsEnabled: z.boolean().optional(),
  autoPartialFeeSmsEnabled: z.boolean().optional(),
  autoFeeReminderSmsEnabled: z.boolean().optional(),
  autoFeePaymentEmailEnabled: z.boolean().optional(),
  autoPartialFeeEmailEnabled: z.boolean().optional(),
  autoFeeReminderEmailEnabled: z.boolean().optional(),
  autoSalaryPaidEmailEnabled: z.boolean().optional(),
  feeReminderSendTime: z
    .string()
    .trim()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format. Use 24-hour HH:mm format (e.g. 09:00).')
    .optional(),
});

export const listNotificationJobsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  channel: z.enum(['SMS', 'EMAIL', 'ALL']).optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED', 'DELIVERY_UNKNOWN', 'SKIPPED_NO_RECIPIENT', 'ALL']).optional(),
  eventType: z.enum(['FEE_PARTIAL_PAYMENT', 'FEE_FULLY_PAID', 'FEE_MONTH_END_REMINDER', 'SALARY_PAID', 'TIMETABLE_FINALIZED', 'ALL']).optional(),
  search: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
});

export const finalizeTimetableSchema = z
  .object({
    idempotencyKey: z
      .string({ required_error: 'Idempotency key is required.' })
      .trim()
      .min(1, 'Idempotency key must not be empty.'),
    effectiveDate: z
      .string({ required_error: 'Effective date is required.' })
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective date must be in YYYY-MM-DD format.'),
    sendEmail: z.boolean().default(false),
    recipientScope: z.enum(
      ['ALL_TEACHING_STAFF', 'USTADH_ONLY', 'SCHOOL_TEACHER_ONLY', 'SELECTED_STAFF', 'AFFECTED_STAFF_ONLY'],
      { required_error: 'Recipient scope is required.' }
    ),
    selectedStaffIds: z.array(z.string().trim()).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .transform((data) => {
    let canonicalSelectedStaffIds = null;
    if (data.recipientScope === 'SELECTED_STAFF') {
      const rawIds = Array.isArray(data.selectedStaffIds) ? data.selectedStaffIds : [];
      canonicalSelectedStaffIds = Array.from(new Set(rawIds.map((id) => id.trim()).filter(Boolean))).sort();
    }
    return {
      ...data,
      selectedStaffIds: canonicalSelectedStaffIds,
    };
  })
  .refine(
    (data) => {
      if (data.recipientScope === 'SELECTED_STAFF') {
        return Array.isArray(data.selectedStaffIds) && data.selectedStaffIds.length > 0;
      }
      return true;
    },
    {
      message: 'At least one staff member must be selected when recipient scope is SELECTED_STAFF.',
      path: ['selectedStaffIds'],
    }
  );
