import { z } from 'zod';
import { TOKEN_FORMAT_REGEX, TOKEN_TOTAL_LENGTH } from '../utils/scan-token-crypto.js';

/**
 * Gate Scan Request Schema (POST /api/gate/scan)
 */
export const gateScanSchema = z.object({
  token: z
    .string({ required_error: 'Scan token is required.' })
    .trim()
    .length(TOKEN_TOTAL_LENGTH, `Token must be exactly ${TOKEN_TOTAL_LENGTH} characters.`)
    .regex(TOKEN_FORMAT_REGEX, 'Invalid token format. Expected canonical format MNX1_<32 hex chars>.'),
  eventType: z.enum(['ENTRY', 'EXIT'], {
    required_error: 'eventType is required and must be either ENTRY or EXIT.',
    invalid_type_error: 'eventType must be either ENTRY or EXIT.',
  }),
  idempotencyKey: z
    .string()
    .trim()
    .min(1, 'idempotencyKey cannot be empty.')
    .max(36, 'idempotencyKey cannot exceed 36 characters.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

/**
 * Gate Event Audit Query Schema (GET /api/gate/events)
 */
export const gateEventQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.')
    .optional(),
  studentId: z.string().trim().min(1).optional(),
  classId: z.string().trim().min(1).optional(),
  eventType: z.enum(['ENTRY', 'EXIT']).optional(),
  emailStatus: z
    .enum(['NOT_APPLICABLE', 'QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED_NO_RECIPIENT'])
    .optional(),
});

/**
 * Gate Institutional Settings Update Schema (PATCH /api/gate/settings)
 */
export const gateSettingsUpdateSchema = z
  .object({
    gateParentEmailNotificationsEnabled: z.boolean().optional(),
    autoGateAttendanceReconciliation: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.gateParentEmailNotificationsEnabled !== undefined ||
      data.autoGateAttendanceReconciliation !== undefined,
    {
      message: 'At least one gate setting must be provided for update.',
    }
  );
