import { z } from 'zod';

export const createAdmissionPeriodSchema = z.object({
  code: z
    .string()
    .min(1, 'Period code is required.')
    .max(50, 'Code cannot exceed 50 characters.')
    .regex(/^[A-Za-z0-9_-]+$/, 'Code can only contain letters, numbers, hyphens, and underscores.')
    .transform((val) => val.trim().toUpperCase()),
  name: z
    .string()
    .min(2, 'Period name must be at least 2 characters.')
    .max(191, 'Name cannot exceed 191 characters.')
    .transform((val) => val.trim()),
  academicYear: z
    .coerce
    .number()
    .int('Academic year must be an integer.')
    .min(2000, 'Academic year must be 2000 or later.')
    .max(2100, 'Academic year must be 2100 or earlier.'),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Valid start date is required.',
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Valid end date is required.',
  }),
  isOpen: z.boolean().optional().default(true),
  instructions: z.string().max(2000, 'Instructions cannot exceed 2000 characters.').optional().nullable(),
  capacity: z.coerce.number().int().positive('Capacity must be a positive integer.').optional().nullable(),
}).refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
  message: 'End date must be on or after start date.',
  path: ['endDate'],
});

export const submitApplicationSchema = z.object({
  admissionPeriodId: z.string().min(1, 'Admission intake period is required.'),
  applicantName: z
    .string()
    .min(2, 'Applicant full name must be at least 2 characters.')
    .max(191, 'Name cannot exceed 191 characters.')
    .transform((val) => val.trim()),
  dateOfBirth: z.string().refine((val) => {
    const d = new Date(val);
    return !isNaN(d.getTime()) && d < new Date();
  }, {
    message: 'Valid past date of birth is required.',
  }),
  gender: z.enum(['MALE', 'FEMALE'], {
    errorMap: () => ({ message: 'Gender must be either MALE or FEMALE.' }),
  }),
  guardianName: z
    .string()
    .min(2, 'Guardian name must be at least 2 characters.')
    .max(191, 'Guardian name cannot exceed 191 characters.')
    .transform((val) => val.trim()),
  guardianRelationship: z
    .string()
    .min(2, 'Relationship to applicant is required.')
    .max(100, 'Relationship cannot exceed 100 characters.')
    .transform((val) => val.trim()),
  guardianPhone: z
    .string()
    .min(6, 'Valid contact phone number is required.')
    .max(50, 'Phone number cannot exceed 50 characters.')
    .transform((val) => val.trim()),
  guardianEmail: z
    .string({ required_error: 'Guardian email address is required for admissions updates.' })
    .email('Please enter a valid email address for application correspondence.')
    .max(255)
    .transform((val) => val.trim().toLowerCase()),
  address: z
    .string()
    .min(3, 'Residential address is required.')
    .max(1000, 'Address cannot exceed 1000 characters.')
    .transform((val) => val.trim()),
  appliedClassId: z.string().optional().nullable().or(z.literal('')).transform((val) => val || null),
  previousSchool: z
    .string()
    .max(255, 'Previous school cannot exceed 255 characters.')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val && val.trim() ? val.trim() : null)),
  documents: z
    .array(
      z
        .object({
          fileId: z.string(),
          name: z.string().optional(),
          originalName: z.string().optional(),
          fileUrl: z.string().optional().nullable(),
          size: z.number().optional(),
          mimeType: z.string().optional(),
        })
        .transform((doc) => ({
          ...doc,
          name: doc.name || doc.originalName || 'document',
        }))
    )
    .optional()
    .default([]),
});

export const reviewApplicationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED'], {
    errorMap: () => ({ message: 'Status must be APPROVED or REJECTED.' }),
  }),
  reviewRemarks: z
    .string()
    .max(2000, 'Review remarks cannot exceed 2000 characters.')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val && val.trim() ? val.trim() : null)),
});

export const convertApplicationSchema = z.object({
  admissionNo: z
    .string()
    .min(1, 'Admission number is required.')
    .max(50, 'Admission number cannot exceed 50 characters.')
    .transform((val) => val.trim()),
  classId: z.string().optional().nullable().or(z.literal('')).transform((val) => val || null),
  admissionDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid admission date.',
    })
    .transform((val) => (val ? new Date(val) : new Date())),
});
