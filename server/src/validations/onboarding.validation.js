import { z } from 'zod';
import { createNormalizedEmailSchema } from '../utils/email-normalization.js';

/**
 * Public Onboarding Request Validation Schema
 *
 * Strict Whitelist:
 * Rejects any client-supplied role, status, madrasaId, planId, or administrative fields.
 */
export const publicOnboardingRequestSchema = z.object({
  madrasaName: z
    .string({ required_error: 'Madrasa name is required' })
    .trim()
    .min(2, 'Madrasa name must be at least 2 characters')
    .max(120, 'Madrasa name cannot exceed 120 characters'),
  contactName: z
    .string({ required_error: 'Contact person name is required' })
    .trim()
    .min(2, 'Contact person name must be at least 2 characters')
    .max(100, 'Contact person name cannot exceed 100 characters'),
  email: createNormalizedEmailSchema('Please provide a valid email address'),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .min(7, 'Phone number must be at least 7 characters')
    .max(25, 'Phone number cannot exceed 25 characters'),
  whatsappNumber: z
    .string()
    .trim()
    .max(25, 'WhatsApp number cannot exceed 25 characters')
    .optional()
    .nullable(),
  district: z
    .string()
    .trim()
    .max(60, 'District name cannot exceed 60 characters')
    .optional()
    .nullable(),
  address: z
    .string()
    .trim()
    .max(500, 'Address cannot exceed 500 characters')
    .optional()
    .nullable(),
  expectedStudentCount: z
    .coerce
    .number()
    .int('Expected student count must be an integer')
    .positive('Expected student count must be positive')
    .optional()
    .nullable(),
  message: z
    .string()
    .trim()
    .max(1000, 'Message cannot exceed 1000 characters')
    .optional()
    .nullable(),
  // Honeypot field: bots often fill this
  website: z.string().optional(),
}).strict();
