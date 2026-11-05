import { z } from 'zod';

/**
 * Canonical email normalization helper.
 * Trims surrounding whitespace and converts to lowercase.
 *
 * @param {any} value
 * @returns {string} Normalized email or empty string if input is null/invalid
 */
export function normalizeEmail(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  return value.trim().toLowerCase();
}

/**
 * Creates a reusable Zod email schema using canonical normalization order:
 * raw input -> trim -> lowercase -> validate normalized email.
 *
 * @param {string} [invalidMessage='Invalid email address']
 * @returns {z.ZodType}
 */
export function createNormalizedEmailSchema(invalidMessage = 'Invalid email address') {
  return z
    .string({ required_error: 'Email address is required' })
    .transform((val) => normalizeEmail(val))
    .pipe(
      z
        .string()
        .min(1, 'Email address is required')
        .max(120, 'Email address must not exceed 120 characters')
        .email(invalidMessage)
    );
}

/**
 * Optional version of normalized email schema for optional/nullable fields.
 *
 * @param {string} [invalidMessage='Invalid email address']
 * @returns {z.ZodType}
 */
export function createOptionalNormalizedEmailSchema(invalidMessage = 'Invalid email address') {
  return z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((val) => {
      if (val === null || val === undefined || (typeof val === 'string' && !val.trim())) {
        return null;
      }
      return normalizeEmail(val);
    })
    .refine(
      (val) => {
        if (val === null) return true;
        return z.string().email().safeParse(val).success && val.length <= 120;
      },
      { message: invalidMessage }
    );
}
