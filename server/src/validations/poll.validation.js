import { z } from 'zod';

export const createPollSchema = z.object({
  title: z.string().trim().min(3, 'Poll title must be at least 3 characters.').max(255),
  description: z.string().trim().max(3000).optional().nullable(),
  category: z.enum(['GOVERNANCE', 'ACADEMIC', 'CALENDAR', 'CURRICULUM', 'FEEDBACK']).default('GOVERNANCE'),
  targetAudience: z.enum(['MADRASA_ADMINS', 'TEACHERS', 'ALL']).default('ALL'),
  targetMadrasaIds: z.array(z.string().trim()).optional().nullable(),
  allowMultipleChoice: z.boolean().default(false),
  isAnonymous: z.boolean().default(false),
  closesAt: z.string().datetime().optional().nullable().or(z.date().optional().nullable()),
  options: z.array(z.string().trim().min(1, 'Option label cannot be empty')).min(2, 'At least 2 options are required.').max(8, 'Maximum 8 options allowed.'),
});

export const updatePollStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'CLOSED']),
});

export const submitVoteSchema = z.object({
  optionIds: z.array(z.string().trim().min(1)).min(1, 'Please select at least one option to vote.'),
});
