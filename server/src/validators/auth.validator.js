import { z } from 'zod';
import { createNormalizedEmailSchema } from '../utils/email-normalization.js';

export const loginSchema = z.object({
  email: createNormalizedEmailSchema('Invalid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password cannot be empty'),
});
