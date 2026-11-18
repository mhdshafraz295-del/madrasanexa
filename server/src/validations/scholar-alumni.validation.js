import { z } from 'zod';

const academicStatusEnum = z.enum([
  'UNDERGRADUATE',
  'GRADUATE',
  'POSTGRADUATE',
  'WORKING_SCHOLAR',
]);

const approvalStatusEnum = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

export const publicSubmitScholarSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(191),
  photoUrl: z.string().url('Invalid photo URL').optional().nullable().or(z.literal('')),
  batchYear: z.string().min(2, 'Batch year is required').max(20),
  classOrDivision: z.string().max(191).optional().nullable(),
  classId: z.string().max(191).optional().nullable(),
  academicStatus: academicStatusEnum.default('UNDERGRADUATE'),
  qualification: z.string().min(2, 'Qualification is required').max(191),
  university: z.string().min(2, 'University / Institution is required').max(191),
  facultyOrDepartment: z.string().max(191).optional().nullable(),
  currentRole: z.string().max(191).optional().nullable(),
  cityCountry: z.string().max(191).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable().or(z.literal('')),
  linkedinUrl: z.string().url('Invalid LinkedIn URL').optional().nullable().or(z.literal('')),
  showContactPublicly: z.boolean().default(false),
  availableForMentorship: z.boolean().default(true),
});

export const adminCreateScholarSchema = publicSubmitScholarSchema.extend({
  approvalStatus: approvalStatusEnum.default('APPROVED'),
  isFeatured: z.boolean().default(false),
});

export const adminUpdateScholarSchema = adminCreateScholarSchema.partial();

export const updateScholarStatusSchema = z.object({
  approvalStatus: approvalStatusEnum.optional(),
  isFeatured: z.boolean().optional(),
});

export const toggleWebsiteVisibilitySchema = z.object({
  showAlumniOnWebsite: z.boolean(),
});
