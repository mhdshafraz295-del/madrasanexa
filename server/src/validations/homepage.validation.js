import { z } from 'zod';
import { createOptionalNormalizedEmailSchema } from '../utils/email-normalization.js';

export const ALLOWED_HOMEPAGE_ICONS = [
  'GraduationCap',
  'Users',
  'Calendar',
  'DollarSign',
  'FileText',
  'BarChart3',
  'Megaphone',
  'Cloud',
  'ShieldCheck',
  'Layers',
  'Clock',
  'Sparkles',
  'BookOpen',
  'Award',
  'CheckCircle2',
  'Building2',
  'Landmark',
  'Lock',
  'Compass',
  'Globe',
  'HelpCircle',
  'Laptop',
  'Shield',
];

const iconEnum = z.enum(ALLOWED_HOMEPAGE_ICONS, {
  errorMap: () => ({ message: 'Invalid icon name. Must be from the approved icon whitelist.' }),
});

// Strictly validate that URLs are either safe internal paths (/ or #) or valid HTTPS URLs
const safeUrlSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val) return true;
      const lower = val.toLowerCase();
      if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
        return false;
      }
      if (lower.startsWith('/') || lower.startsWith('#')) {
        return true;
      }
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    {
      message: 'URL must be a safe internal path (e.g. /register, #pricing) or a valid HTTPS URL.',
    }
  );

const heroSectionSchema = z
  .object({
    eyebrow: z.string().trim().max(100).optional().nullable(),
    title: z.string().trim().min(1, 'Hero title is required').max(200),
    highlightedText: z.string().trim().max(100).optional().nullable(),
    description: z.string().trim().max(1000).optional().nullable(),
    primaryCtaLabel: z.string().trim().max(50).default('Get Started'),
    primaryCtaUrl: safeUrlSchema.default('/register'),
    secondaryCtaLabel: z.string().trim().max(50).default('Explore Features'),
    secondaryCtaUrl: safeUrlSchema.default('#features'),
    enabled: z.boolean().default(true),
  })
  .partial();

const featureItemSchema = z
  .object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1, 'Feature title is required').max(100),
    description: z.string().trim().min(1, 'Feature description is required').max(500),
    icon: iconEnum.default('Sparkles'),
    sortOrder: z.number().int().default(0),
    enabled: z.boolean().default(true),
    imageFileId: z.string().trim().nullable().optional(),
    imageAlt: z.string().trim().max(200).nullable().optional(),
    imageCaption: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.enabled !== false && data.imageFileId) {
      if (!data.imageAlt || data.imageAlt.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Image alt text is required (minimum 3 characters) when a feature screenshot is attached.',
          path: ['imageAlt'],
        });
      }
    }
  });

const howItWorksItemSchema = z.object({
  id: z.string().trim().min(1),
  step: z.number().int().positive(),
  title: z.string().trim().min(1, 'Step title is required').max(100),
  description: z.string().trim().min(1, 'Step description is required').max(500),
  enabled: z.boolean().default(true),
});

const trustItemSchema = z.object({
  id: z.string().trim().min(1),
  text: z.string().trim().min(1, 'Trust item text is required').max(100),
  icon: iconEnum.default('ShieldCheck'),
  enabled: z.boolean().default(true),
});

const securityItemSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1, 'Security item title is required').max(100),
  description: z.string().trim().min(1, 'Security item description is required').max(500),
  icon: iconEnum.default('ShieldCheck'),
  enabled: z.boolean().default(true),
});

const securitySectionSchema = z
  .object({
    heading: z.string().trim().max(150).optional().nullable(),
    description: z.string().trim().max(1000).optional().nullable(),
    items: z.array(securityItemSchema).max(10).optional().nullable(),
    enabled: z.boolean().default(true),
  })
  .partial();

const ctaSectionSchema = z
  .object({
    heading: z.string().trim().min(1, 'CTA heading is required').max(150),
    description: z.string().trim().max(1000).optional().nullable(),
    primaryCtaLabel: z.string().trim().max(50).default('Get Started'),
    primaryCtaUrl: safeUrlSchema.default('/register'),
    secondaryCtaLabel: z.string().trim().max(50).default('Login'),
    secondaryCtaUrl: safeUrlSchema.default('/login'),
    enabled: z.boolean().default(true),
  })
  .partial();

const contactSectionSchema = z
  .object({
    headline: z.string().trim().max(150).optional().nullable(),
    description: z.string().trim().max(500).optional().nullable(),
    email: createOptionalNormalizedEmailSchema(),
    phone: z.string().trim().max(50).optional().nullable(),
    address: z.string().trim().max(300).optional().nullable(),
    officeHours: z.string().trim().max(100).optional().nullable(),
    enabled: z.boolean().default(true),
  })
  .partial();

const footerQuickLinkSchema = z.object({
  label: z.string().trim().min(1).max(50),
  url: safeUrlSchema,
});

const footerSectionSchema = z
  .object({
    platformDescription: z.string().trim().max(500).optional().nullable(),
    copyrightText: z.string().trim().max(200).optional().nullable(),
    quickLinks: z.array(footerQuickLinkSchema).max(12).optional().nullable(),
  })
  .partial();

const seoSectionSchema = z
  .object({
    metaTitle: z.string().trim().max(100).optional().nullable(),
    metaDescription: z.string().trim().max(300).optional().nullable(),
    ogTitle: z.string().trim().max(100).optional().nullable(),
    ogDescription: z.string().trim().max(300).optional().nullable(),
  })
  .partial();

const heroMediaItemSchema = z
  .object({
    id: z.string().trim().min(1),
    fileId: z.string().trim().min(1, 'File ID is required'),
    alt: z.string().trim().max(200, 'Alt text cannot exceed 200 characters').default(''),
    caption: z.string().trim().max(500).optional().nullable(),
    enabled: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  })
  .superRefine((data, ctx) => {
    if (data.enabled !== false) {
      if (!data.alt || data.alt.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Alt text is required (minimum 3 characters) for enabled images.',
          path: ['alt'],
        });
      }
    }
  });

const heroMediaSectionSchema = z
  .object({
    enabled: z.boolean().default(true),
    autoplay: z.boolean().default(true),
    autoplayInterval: z
      .number()
      .int()
      .min(3000, 'Autoplay interval must be at least 3000 ms')
      .max(15000, 'Autoplay interval cannot exceed 15000 ms')
      .default(5000),
    items: z.array(heroMediaItemSchema).max(8, 'Maximum 8 slider images allowed').default([]),
  })
  .partial();

const whatsAppSectionSchema = z
  .object({
    enabled: z.boolean().default(true),
    number: z
      .string()
      .trim()
      .min(7, 'Phone number must be at least 7 digits')
      .max(30, 'Phone number cannot exceed 30 characters')
      .refine((val) => /^\+?[0-9\s\-()]+$/.test(val), {
        message: 'Invalid WhatsApp phone number format. Use international format (e.g. +94 78 325 4552).',
      })
      .default('+94 78 325 4552'),
    defaultMessage: z.string().trim().max(500).default('Assalamu Alaikum, I would like to know more about MadrasaNexa.'),
  })
  .partial();

export const ALLOWED_HOMEPAGE_SECTIONS = ['hero', 'product-preview', 'features'];

const productPreviewMediaSchema = z
  .object({
    enabled: z.boolean().default(true),
    fileId: z.string().trim().nullable().optional(),
    alt: z.string().trim().max(200, 'Alt text cannot exceed 200 characters').default(''),
    caption: z.string().trim().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.enabled !== false && data.fileId) {
      if (!data.alt || data.alt.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Alt text is required (minimum 3 characters) when a product dashboard screenshot is attached.',
          path: ['alt'],
        });
      }
    }
  })
  .optional()
  .nullable();

export const updateHomepageDraftSchema = z.object({
  hero: heroSectionSchema.optional().nullable(),
  heroMedia: heroMediaSectionSchema.optional().nullable(),
  productPreviewMedia: productPreviewMediaSchema,
  features: z.array(featureItemSchema).max(16).optional().nullable(),
  howItWorks: z.array(howItWorksItemSchema).max(10).optional().nullable(),
  trustStrip: z.array(trustItemSchema).max(10).optional().nullable(),
  security: securitySectionSchema.optional().nullable(),
  cta: ctaSectionSchema.optional().nullable(),
  contact: contactSectionSchema.optional().nullable(),
  whatsapp: whatsAppSectionSchema.optional().nullable(),
  footer: footerSectionSchema.optional().nullable(),
  seo: seoSectionSchema.optional().nullable(),
});
