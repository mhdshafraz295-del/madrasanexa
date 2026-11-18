import { z } from 'zod';
import { createNormalizedEmailSchema } from '../utils/email-normalization.js';

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email or Staff ID is required' })
    .trim()
    .min(1, 'Email or Staff ID is required')
    .max(120, 'Identifier must not exceed 120 characters')
    .transform((val) => val.toLowerCase()),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password cannot be empty'),
});
