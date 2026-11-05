import { z } from 'zod';

export const updateEmailSenderSettingsSchema = z
  .object({
    mode: z.enum(['PLATFORM', 'CUSTOM_SMTP']),

    fromName: z
      .string()
      .trim()
      .min(2, 'Sender Name must be at least 2 characters.')
      .max(150, 'Sender Name cannot exceed 150 characters.')
      .optional()
      .or(z.literal('')),

    fromEmail: z
      .string()
      .trim()
      .email('Invalid sender email address format.')
      .max(255, 'Sender email cannot exceed 255 characters.')
      .optional()
      .or(z.literal('')),

    replyToEmail: z
      .string()
      .trim()
      .email('Invalid reply-to email address format.')
      .max(255, 'Reply-To email cannot exceed 255 characters.')
      .optional()
      .or(z.literal('')),

    smtpHost: z
      .string()
      .trim()
      .max(255, 'SMTP Host cannot exceed 255 characters.')
      .optional()
      .or(z.literal('')),

    smtpPort: z
      .coerce
      .number()
      .int('SMTP Port must be an integer.')
      .min(1, 'SMTP Port must be between 1 and 65535.')
      .max(65535, 'SMTP Port must be between 1 and 65535.')
      .optional(),

    smtpSecurity: z.enum(['SSL_TLS', 'STARTTLS']).default('STARTTLS'),

    smtpUsername: z
      .string()
      .trim()
      .max(255, 'SMTP Username cannot exceed 255 characters.')
      .optional()
      .or(z.literal('')),

    smtpPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'CUSTOM_SMTP') {
      if (!data.fromName || !data.fromName.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Sender Name is required for Custom Madrasa Email mode.',
          path: ['fromName'],
        });
      }
      if (!data.fromEmail || !data.fromEmail.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Sender Email is required for Custom Madrasa Email mode.',
          path: ['fromEmail'],
        });
      }
      if (!data.smtpHost || !data.smtpHost.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP Host is required for Custom Madrasa Email mode.',
          path: ['smtpHost'],
        });
      }
      if (!data.smtpPort) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP Port is required for Custom Madrasa Email mode.',
          path: ['smtpPort'],
        });
      }
      if (!data.smtpUsername || !data.smtpUsername.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP Username is required for Custom Madrasa Email mode.',
          path: ['smtpUsername'],
        });
      }
    }
  });

export const testEmailSenderConnectionSchema = z.object({
  recipientEmail: z
    .string()
    .trim()
    .email('Invalid test recipient email address format.')
    .optional()
    .or(z.literal('')),
});
