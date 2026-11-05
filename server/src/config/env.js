import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // Configurable Trust Proxy: strictly validated, trust-all ("true") is forbidden
  TRUST_PROXY: z
    .string()
    .optional()
    .default('false')
    .refine((val) => {
      if (val === 'false') return true;
      if (val === 'true') return false; // Strictly disallow trust-all!
      // Must be a positive integer hop count (e.g. '1', '2', '3')
      if (/^[1-9]\d*$/.test(val)) return true;
      // Or approved subnet keywords / CIDR ranges
      const allowedSubnetKeywords = new Set(['loopback', 'linklocal', 'uniquelocal']);
      const parts = val.split(',').map((s) => s.trim().toLowerCase());
      return parts.length > 0 && parts.every((p) => allowedSubnetKeywords.has(p) || /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(p));
    }, {
      message: 'Invalid TRUST_PROXY: trust-all ("true") is strictly prohibited. Must be "false", a positive integer hop count (e.g. "1", "2"), or approved subnets ("loopback, linklocal, uniquelocal").'
    }),

  // Required from Phase 2 onward
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_TEST_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),

  // Cloudflare R2 (Optional during Phase 1)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // Cloudflare R2 Dedicated Private Receipts Bucket (Isolated from public media)
  R2_RECEIPTS_BUCKET: z.string().optional(),
  R2_RECEIPTS_ACCOUNT_ID: z.string().optional(),
  R2_RECEIPTS_ACCESS_KEY_ID: z.string().optional(),
  R2_RECEIPTS_SECRET_ACCESS_KEY: z.string().optional(),

  // Phase 5 Subscription settings
  SUBSCRIPTION_EXPIRING_SOON_DAYS: z.coerce.number().int().positive().default(7),

  // Email Notification Settings
  EMAIL_PROVIDER: z.enum(['smtp', 'test']).default('smtp'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z
    .preprocess((val) => {
      if (typeof val === 'string') return val.trim().toLowerCase();
      return val;
    }, z.union([z.boolean(), z.enum(['true', 'false'])]).default('false'))
    .transform((value) => value === true || value === 'true'),
  EMAIL_FROM: z.string().optional(),

  // Email Sender Credential Encryption Key (64 hex characters = 32 bytes)
  EMAIL_CREDENTIAL_ENCRYPTION_KEY: z
    .string()
    .length(64, 'EMAIL_CREDENTIAL_ENCRYPTION_KEY must be exactly 64 hexadecimal characters')
    .regex(/^[0-9a-fA-F]{64}$/, 'EMAIL_CREDENTIAL_ENCRYPTION_KEY must be a valid hex string')
    .optional()
    .default('00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'),
}).superRefine((data, ctx) => {
  if (data.EMAIL_PROVIDER === 'smtp' && data.SMTP_HOST) {
    if (data.SMTP_PORT === 587 && data.SMTP_SECURE === true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid SMTP configuration: Port 587 requires SMTP_SECURE=false (STARTTLS). Direct TLS (SMTP_SECURE=true) is not supported on port 587.',
        path: ['SMTP_SECURE'],
      });
    }
    if (data.SMTP_PORT === 465 && data.SMTP_SECURE === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid SMTP configuration: Port 465 requires SMTP_SECURE=true (direct TLS/SSL). Plain/STARTTLS (SMTP_SECURE=false) is not supported on port 465.',
        path: ['SMTP_SECURE'],
      });
    }
  }
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Environment configuration error:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
