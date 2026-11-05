import { z } from 'zod';

export const curriculumBookSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  author: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  displayOrder: z.number().int().default(0),
  completionNotes: z.string().max(500).optional().nullable(),
  chapters: z.array(z.string().max(200)).optional().nullable().default([])
});

export const curriculumSubjectSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  code: z.string().max(50).optional().nullable(),
  isOptional: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
  description: z.string().max(2000).optional().nullable(),
  learningOutcomes: z.array(z.string().max(500)).optional().nullable().default([]),
  books: z.array(curriculumBookSchema).max(30).default([])
});

export const curriculumLevelSchema = z.object({
  id: z.string().min(1).max(100),
  levelType: z.enum(['GRADE', 'YEAR', 'STREAM', 'LEVEL']).default('GRADE'),
  levelLabel: z.string().min(1).max(150),
  streamName: z.string().max(100).optional().nullable(),
  displayOrder: z.number().int().default(0),
  description: z.string().max(2000).optional().nullable(),
  subjects: z.array(curriculumSubjectSchema).max(60).default([])
});

export const curriculumProgrammeSchema = z.object({
  id: z.string().min(1).max(100),
  categoryId: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  code: z.string().max(50).optional().nullable(),
  description: z.string().max(3000).optional().nullable(),
  durationYears: z.union([z.number(), z.string().max(50)]).optional().nullable(),
  admissionRequirements: z.string().max(2000).optional().nullable(),
  isPublished: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
  levels: z.array(curriculumLevelSchema).max(40).default([])
});

export const curriculumCategorySchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(150),
  description: z.string().max(500).optional().nullable(),
  displayOrder: z.number().int().default(0),
  isCustom: z.boolean().optional().default(false)
});

export const curriculumPayloadSchema = z.object({
  categories: z.array(curriculumCategorySchema).max(30).default([]),
  programmes: z.array(curriculumProgrammeSchema).max(100).default([])
});

export const eventAlbumImageSchema = z.object({
  id: z.string().optional().nullable(),
  fileId: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  caption: z.string().max(300).optional().nullable(),
  isCover: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).max(10).optional().default(0),
});

export const eventAlbumSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  date: z.string(),
  description: z.string().max(1000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  isPublished: z.boolean().default(true),
  // Backward compatibility with single-poster schema
  posterFileId: z.string().optional().nullable(),
  posterUrl: z.string().optional().nullable(),
  // Multi-image album fields
  coverFileId: z.string().optional().nullable(),
  coverUrl: z.string().optional().nullable(),
  images: z.array(eventAlbumImageSchema).max(5, 'An event album supports up to 5 images.').optional().nullable(),
  photoCount: z.number().int().optional().nullable(),
});

export const staffPresentationItemSchema = z.object({
  ustadhId: z.string().min(1, 'Ustadh ID is required'),
  isPublic: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  designation: z.string().max(100).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  qualification: z.string().max(150).optional().nullable(),
  experienceYears: z.union([z.number().min(0).max(80), z.string().max(50)]).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  photoFileId: z.string().max(191).optional().nullable(),
  photoUrl: z.string().url().max(1000).optional().nullable(),
});

export const staffSectionSchema = z.object({
  isEnabled: z.boolean().default(true),
  showStats: z.boolean().default(true),
  sectionTitle: z.string().max(120).optional().nullable(),
  sectionSubtitle: z.string().max(255).optional().nullable(),
  items: z.array(staffPresentationItemSchema).max(50).default([]),
});

export const updateMadrasaProfileSchema = z.object({
  heroTitle: z.string().max(255).optional().nullable(),
  heroSubtitle: z.string().max(1000).optional().nullable(),
  introduction: z.string().max(5000).optional().nullable(),
  mission: z.string().max(2000).optional().nullable(),
  vision: z.string().max(2000).optional().nullable(),
  syllabusInfo: z.string().max(5000).optional().nullable(),
  rulesAndRegulations: z.string().max(5000).optional().nullable(),
  contactPhone: z.string().max(50).optional().nullable(),
  contactEmail: z.string().email().max(255).optional().nullable().or(z.literal('')),
  address: z.string().max(1000).optional().nullable(),
  curriculumJson: curriculumPayloadSchema.optional().nullable(),
  staffJson: staffSectionSchema.optional().nullable(),
  eventsJson: z.array(eventAlbumSchema).optional().nullable(),
  noticesJson: z.array(z.object({
    id: z.string(),
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(2000),
    postedAt: z.string(),
    priority: z.enum(['NORMAL', 'URGENT']).default('NORMAL'),
    isPublished: z.boolean().default(true),
    posterFileId: z.string().optional().nullable(),
    posterUrl: z.string().optional().nullable()
  })).optional().nullable()
});

export const broadcastNoticeSchema = z.object({
  noticeId: z.string().min(1)
});
