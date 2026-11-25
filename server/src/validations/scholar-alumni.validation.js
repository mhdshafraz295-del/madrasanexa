import { z } from 'zod';

export const academicStatusEnum = z.enum([
  'UNDERGRADUATE',
  'GRADUATE',
  'POSTGRADUATE',
  'WORKING_SCHOLAR',
  'HAFIL',
  'AL_AALIM',
  'OTHER',
]);

const approvalStatusEnum = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

const qualificationItemSchema = z.object({
  degree: z.string().max(191).optional().default(''),
  university: z.string().max(191).optional().default(''),
  year: z.string().max(50).optional().nullable().or(z.literal('')),
});

export const baseScholarObjectSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(191),
  photoUrl: z.string().optional().nullable().or(z.literal('')),
  batchYear: z.string().max(50).optional(),
  year: z.string().max(50).optional().nullable(),
  classOrDivision: z.string().max(191).optional().nullable(),
  classId: z.string().max(191).optional().nullable(),
  studentId: z.string().max(191).optional().nullable(),
  alumniProfileId: z.string().max(191).optional().nullable(),
  alumniId: z.string().max(191).optional().nullable(),
  academicStatus: academicStatusEnum.default('UNDERGRADUATE'),
  customStatusLabel: z.string().max(80, 'Custom status label cannot exceed 80 characters').optional().nullable().or(z.literal('')),
  qualification: z.string().max(191).optional().nullable().default(''),
  degree: z.string().max(191).optional().nullable(),
  university: z.string().max(191).optional().nullable().default(''),
  qualificationsList: z.array(qualificationItemSchema).optional().nullable(),
  facultyOrDepartment: z.string().max(191).optional().nullable(),
  currentRole: z.string().max(191).optional().nullable(),
  cityCountry: z.string().max(191).optional().nullable(),
  bio: z.string().max(20000).optional().nullable(),
  academicBio: z.string().max(20000).optional().nullable(),
  email: z.preprocess((v) => (v === '' ? null : v), z.string().email('Invalid email address').optional().nullable()),
  phone: z.preprocess((v) => (v === '' ? null : v), z.string().max(50).optional().nullable()),
  linkedinUrl: z.preprocess((v) => (v === '' ? null : v), z.string().url('Invalid LinkedIn URL').optional().nullable()),
  showContactPublicly: z.boolean().default(false),
  availableForMentorship: z.boolean().default(true),
  openForMentorship: z.boolean().optional(),
});

const validateBatchYear = (data) =>
  Boolean((data.batchYear && data.batchYear.trim()) || (data.year && data.year.trim()));

export const publicSubmitScholarSchema = baseScholarObjectSchema.refine(
  validateBatchYear,
  { message: 'Batch year is required', path: ['batchYear'] }
);

export const baseAdminCreateScholarObject = baseScholarObjectSchema.extend({
  approvalStatus: approvalStatusEnum.default('APPROVED'),
  isFeatured: z.boolean().default(false),
});

export const adminCreateScholarSchema = baseAdminCreateScholarObject.refine(
  validateBatchYear,
  { message: 'Batch year is required', path: ['batchYear'] }
);

export const adminUpdateScholarSchema = baseAdminCreateScholarObject.partial();

export const updateScholarStatusSchema = z.object({
  approvalStatus: approvalStatusEnum.optional(),
  isFeatured: z.boolean().optional(),
});

export const toggleWebsiteVisibilitySchema = z.object({
  showAlumniOnWebsite: z.boolean(),
});
