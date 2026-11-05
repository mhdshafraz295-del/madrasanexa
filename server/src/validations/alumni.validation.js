import { z } from 'zod';

export const createAlumniProfileSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required.'),
  leavingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Leaving date must be in YYYY-MM-DD format.'),
  leavingReason: z.string().trim().max(100).optional().nullable(),
  completedProgrammes: z.array(z.string().trim().min(1)).optional().default([]),
  academicHighlights: z.array(z.string().trim().min(1)).optional().default([]),
  characterAssessmentRating: z.enum(['EXCELLENT', 'VERY_GOOD', 'GOOD', 'SATISFACTORY', 'CONDITIONAL']).optional().nullable(),
  characterAssessmentText: z.string().trim().max(1000).optional().nullable(),
  allowPublicConductShare: z.boolean().optional().default(false),
});

export const updateAlumniProfileSchema = z.object({
  leavingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Leaving date must be in YYYY-MM-DD format.').optional(),
  leavingReason: z.string().trim().max(100).optional().nullable(),
  completedProgrammes: z.array(z.string().trim().min(1)).optional(),
  academicHighlights: z.array(z.string().trim().min(1)).optional(),
  characterAssessmentRating: z.enum(['EXCELLENT', 'VERY_GOOD', 'GOOD', 'SATISFACTORY', 'CONDITIONAL']).optional().nullable(),
  characterAssessmentText: z.string().trim().max(1000).optional().nullable(),
  allowPublicConductShare: z.boolean().optional(),
});

export const recordConsentSchema = z.object({
  consentParty: z.enum(['STUDENT', 'GUARDIAN', 'BOTH']),
  signerName: z.string().trim().min(2, 'Signer name must be at least 2 characters.').max(191),
  proofType: z.enum(['SIGNED_PHYSICAL_FORM', 'DIGITAL_SIGNATURE', 'GUARDIAN_AFFIDAVIT', 'DIRECT_APPLICATION']),
  consentVersion: z.string().trim().min(1).max(20).default('v1.0-2026'),
  consentFileId: z.string().optional().nullable(),
  consentNotes: z.string().trim().max(1000).optional().nullable(),
});

export const renewConsentSchema = z.object({
  consentParty: z.enum(['STUDENT', 'GUARDIAN', 'BOTH']),
  signerName: z.string().trim().min(2, 'Signer name must be at least 2 characters.').max(191),
  proofType: z.enum(['SIGNED_PHYSICAL_FORM', 'DIGITAL_SIGNATURE', 'GUARDIAN_AFFIDAVIT', 'DIRECT_APPLICATION']),
  consentVersion: z.string().trim().min(1).max(20),
  consentFileId: z.string().min(1, 'Fresh consent evidence document file is required.'),
  consentNotes: z.string().trim().max(1000).optional().nullable(),
});

export const withdrawConsentSchema = z.object({
  reason: z.string().trim().min(3, 'Withdrawal reason must be at least 3 characters.').max(1000),
});

export const directorySearchSchema = z.object({
  indexNumber: z.string().trim().max(100).refine(
    (val) => !/[*%_]/.test(val),
    'Wildcard characters (*, %, _) are not permitted in directory queries.'
  ).optional(),
  alumniIndexNumber: z.string().trim().max(100).refine(
    (val) => !/[*%_]/.test(val),
    'Wildcard characters (*, %, _) are not permitted in directory queries.'
  ).optional(),
  q: z.string().trim().max(100).refine(
    (val) => !/[*%_]/.test(val),
    'Wildcard characters (*, %, _) are not permitted in directory queries.'
  ).optional(),
  qualification: z.string().trim().max(100).optional(),
  programme: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(12),
});

export const requestVerificationSchema = z.object({
  purpose: z.string().trim().min(5, 'Purpose must be at least 5 characters.').max(255),
  specificInquiry: z.string().trim().max(1000).optional().nullable(),
  includeCharacter: z.boolean().optional().default(false),
});

export const respondVerificationSchema = z.object({
  status: z.enum(['APPROVED_VERIFIED', 'REJECTED', 'CLOSED']),
  responseNotes: z.string().trim().max(1000).optional().nullable(),
});
