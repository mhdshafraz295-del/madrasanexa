import { z } from 'zod';

const noHtmlRegex = /<[^>]+>/;
const cmsHelperCopyRegex = /Hero Visual & Main Headlines|Primary visual banner|Page Title \(Hero Headline\)|Introduction & Our Story|Comprehensive narrative/i;

const plainText = (maxLength) =>
  z
    .string()
    .trim()
    .max(maxLength, `Maximum length is ${maxLength} characters`)
    .refine((val) => !noHtmlRegex.test(val), {
      message: 'HTML tags are not permitted. Use plain text only.',
    })
    .refine((val) => !cmsHelperCopyRegex.test(val), {
      message: 'CMS admin UI header copy cannot be saved as content.',
    });

export const coreValueItemSchema = z
  .object({
    id: z.string().optional(),
    title: plainText(100),
    description: plainText(500),
    icon: z.string().trim().max(50).optional().nullable(),
  })
  .strict();

export const highlightItemSchema = z
  .object({
    id: z.string().optional(),
    title: plainText(100),
    metric: plainText(50),
    description: plainText(500).optional().nullable(),
  })
  .strict();

export const ctaUrlSchema = z
  .string()
  .trim()
  .max(500, 'CTA URL cannot exceed 500 characters')
  .refine(
    (val) => {
      if (!val) return true;
      const lower = val.toLowerCase();
      if (
        lower.startsWith('javascript:') ||
        lower.startsWith('data:') ||
        lower.startsWith('file:') ||
        lower.startsWith('vbscript:')
      ) {
        return false;
      }
      return val.startsWith('/') || lower.startsWith('https://');
    },
    {
      message: 'CTA URL must be an internal path beginning with "/" or a secure HTTPS URL beginning with "https://"',
    }
  )
  .optional()
  .nullable();

export const updateAboutUsDraftSchema = z
  .object({
    language: z.enum(['en', 'ar', 'ta']).optional().nullable(),
    title: plainText(255).optional().nullable(),
    subtitle: plainText(1000).optional().nullable(),
    introduction: plainText(2000).optional().nullable(),
    story: plainText(5000).optional().nullable(),
    mission: plainText(2000).optional().nullable(),
    vision: plainText(2000).optional().nullable(),
    coreValues: z
      .array(coreValueItemSchema)
      .max(12, 'Maximum 12 core values allowed')
      .optional()
      .nullable(),
    highlights: z
      .array(highlightItemSchema)
      .max(12, 'Maximum 12 highlights allowed')
      .optional()
      .nullable(),
    ctaLabel: plainText(100).optional().nullable(),
    ctaUrl: ctaUrlSchema,
    heroAlt: plainText(255).optional().nullable(),
    storyAlt: plainText(255).optional().nullable(),
  })
  .strict();

export const updateAltTextSchema = z
  .object({
    altText: plainText(255).optional().nullable(),
  })
  .strict();

export const languageSchema = z.enum(['en', 'ar', 'ta']);

export const translatedCoreValueItemSchema = z
  .object({
    id: z.string(),
    title: plainText(100).optional().nullable(),
    description: plainText(500).optional().nullable(),
  })
  .strict();

export const translatedHighlightItemSchema = z
  .object({
    id: z.string(),
    title: plainText(100).optional().nullable(),
    description: plainText(500).optional().nullable(),
  })
  .strict();

export const updateAboutUsTranslationDraftSchema = z
  .object({
    language: z.enum(['ar', 'ta']).optional().nullable(),
    title: plainText(255).optional().nullable(),
    subtitle: plainText(1000).optional().nullable(),
    introduction: plainText(2000).optional().nullable(),
    story: plainText(5000).optional().nullable(),
    mission: plainText(2000).optional().nullable(),
    vision: plainText(2000).optional().nullable(),
    coreValues: z
      .array(translatedCoreValueItemSchema)
      .max(12, 'Maximum 12 core values allowed')
      .optional()
      .nullable(),
    highlights: z
      .array(translatedHighlightItemSchema)
      .max(12, 'Maximum 12 highlights allowed')
      .optional()
      .nullable(),
    ctaLabel: plainText(100).optional().nullable(),
    heroAlt: plainText(255).optional().nullable(),
    storyAlt: plainText(255).optional().nullable(),
  })
  .strict();
