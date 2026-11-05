import sharp from 'sharp';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { BadRequestError, NotFoundError, AppError } from '../utils/errors.js';
import { updateHomepageDraftSchema, ALLOWED_HOMEPAGE_SECTIONS } from '../validations/homepage.validation.js';
import {
  uploadBufferToR2,
  deleteObjectFromR2,
  resolveObjectAccessUrl,
} from './r2.service.js';
import { isR2Configured } from '../config/r2.js';
import * as aboutUsService from './about-us.service.js';

const SINGLETON_ID = 'global';
const ALLOWED_IMAGE_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp']);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

export const DEFAULT_HOMEPAGE_CONTENT = {
  hero: {
    eyebrow: 'Modern Madrasa Management Platform',
    title: 'Manage Your Madrasa Smarter. Teach Better. Grow Further.',
    highlightedText: 'Teach Better. Grow Further.',
    description:
      'A modern all-in-one platform for managing students, classes, fees, attendance, reports and everyday Madrasa operations securely.',
    primaryCtaLabel: 'Start Madrasa Onboarding',
    primaryCtaUrl: '/register',
    secondaryCtaLabel: 'Explore Features',
    secondaryCtaUrl: '#features',
    enabled: true,
  },
  heroMedia: {
    enabled: true,
    autoplay: true,
    autoplayInterval: 5000,
    items: [],
  },
  productPreviewMedia: {
    enabled: true,
    fileId: null,
    alt: '',
    caption: null,
  },
  trustStrip: [
    { id: 'trust-1', text: 'Multi-Tenant Data Isolation', icon: 'ShieldCheck', enabled: true },
    { id: 'trust-2', text: 'Role-Based Access Control', icon: 'Lock', enabled: true },
    { id: 'trust-3', text: 'Secure Private Receipt Access', icon: 'Shield', enabled: true },
    { id: 'trust-4', text: 'Cloud File Storage', icon: 'Cloud', enabled: true },
    { id: 'trust-5', text: 'Professional Reports', icon: 'FileText', enabled: true },
  ],
  features: [
    {
      id: 'feat-students',
      title: 'Student & Academic Records',
      description: 'Comprehensive student profiles, guardian information, enrollment history, and document tracking with full tenant data privacy.',
      icon: 'GraduationCap',
      sortOrder: 1,
      enabled: true,
    },
    {
      id: 'feat-attendance',
      title: 'Daily Attendance Management',
      description: 'Fast, intuitive daily attendance tracking by class and section with automatic summaries and absence follow-up records.',
      icon: 'Calendar',
      sortOrder: 2,
      enabled: true,
    },
    {
      id: 'feat-fees',
      title: 'Fee POS & Invoice Management',
      description: 'Generate itemized student fee invoices, record multi-method payments with printable official receipts, and monitor balances.',
      icon: 'DollarSign',
      sortOrder: 3,
      enabled: true,
    },
    {
      id: 'feat-classes',
      title: 'Class & Academic Structure',
      description: 'Organize your Madrasa by academic sections, class levels, teachers, and capacity limits seamlessly.',
      icon: 'Layers',
      sortOrder: 4,
      enabled: true,
    },
    {
      id: 'feat-reports',
      title: 'Reports & Analytics Center',
      description: 'Generate institutional insights on student demographics, fee collection efficiency, and attendance trends on demand.',
      icon: 'BarChart3',
      sortOrder: 5,
      enabled: true,
    },
    {
      id: 'feat-announcements',
      title: 'Announcement Center',
      description: 'Broadcast urgent announcements, maintenance alerts, and academic updates directly to teachers and staff.',
      icon: 'Megaphone',
      sortOrder: 6,
      enabled: true,
    },
    {
      id: 'feat-storage',
      title: 'Secure Media & Documents',
      description: 'Cloud-native storage for student photos, birth certificates, institutional branding, and bank transfer payment receipts.',
      icon: 'Cloud',
      sortOrder: 7,
      enabled: true,
    },
    {
      id: 'feat-security',
      title: 'Role-Based Workspace Control',
      description: 'Strict role separation between Super Admin oversight and Madrasa Admin operational control with zero cross-tenant leakage.',
      icon: 'ShieldCheck',
      sortOrder: 8,
      enabled: true,
    },
  ],
  howItWorks: [
    {
      id: 'step-1',
      step: 1,
      title: 'Register Your Madrasa',
      description: 'Submit your institutional onboarding application with contact and location details.',
      enabled: true,
    },
    {
      id: 'step-2',
      step: 2,
      title: 'Platform Approval',
      description: 'Super Admin reviews and approves your registration application to verify your institution.',
      enabled: true,
    },
    {
      id: 'step-3',
      step: 3,
      title: 'Choose a Subscription Plan',
      description: 'Select the active subscription plan that best fits your Madrasa\'s student capacity.',
      enabled: true,
    },
    {
      id: 'step-4',
      step: 4,
      title: 'Submit Payment Receipt',
      description: 'Transfer fees directly to official platform bank details and submit your payment receipt for verification.',
      enabled: true,
    },
    {
      id: 'step-5',
      step: 5,
      title: 'Payment Approval & Start Managing',
      description: 'Super Admin verifies payment to activate your subscription and unlock all management modules.',
      enabled: true,
    },
  ],
  security: {
    heading: 'Built with Architectural Rigor & Multi-Tenant Data Isolation',
    description:
      'MadrasaNexa enforces strict multi-tenant data isolation, role-based access control, hashed credential authentication, and short-lived authorized receipt access.',
    items: [
      {
        id: 'sec-1',
        title: 'Multi-Tenant Data Isolation',
        description: 'Every database query and storage operation enforces strict madrasaId scoping. No Madrasa can access another institution’s records.',
        icon: 'Lock',
        enabled: true,
      },
      {
        id: 'sec-2',
        title: 'Role-Based Access Control',
        description: 'Granular role separation isolates Super Admin platform oversight from Madrasa Admin institutional management.',
        icon: 'ShieldCheck',
        enabled: true,
      },
      {
        id: 'sec-3',
        title: 'Secure Private Receipt Access',
        description: 'Subscription payment receipts are kept in private storage, accessible solely via 15-minute authorized presigned URLs.',
        icon: 'Shield',
        enabled: true,
      },
      {
        id: 'sec-4',
        title: 'Secure Password Authentication',
        description: 'User passwords are protected with strong one-way cryptographic hashing (bcrypt) and mandatory temporary password rotations.',
        icon: 'FileText',
        enabled: true,
      },
    ],
    enabled: true,
  },
  cta: {
    heading: 'Ready to Modernize Your Madrasa Operations?',
    description:
      'Join modern institutions streamlining their academic records, student attendance, fee collections, and reporting.',
    primaryCtaLabel: 'Start Madrasa Onboarding',
    primaryCtaUrl: '/register',
    secondaryCtaLabel: 'Login to Portal',
    secondaryCtaUrl: '/login',
    enabled: true,
  },
  contact: {
    headline: 'Connect with Platform Administration',
    description: 'Have questions about onboarding, institutional subscription plans, or platform capabilities?',
    email: null,
    phone: null,
    address: null,
    officeHours: null,
    enabled: true,
  },
  whatsapp: {
    enabled: true,
    number: '+94 78 325 4552',
    defaultMessage: 'Assalamu Alaikum, I would like to know more about MadrasaNexa.',
  },
  footer: {
    platformDescription:
      'Next-generation cloud administration platform designed specifically for modern Islamic educational institutions.',
    copyrightText: 'MadrasaNexa Platform. All rights reserved.',
    quickLinks: [
      { label: 'Features', url: '#features' },
      { label: 'How It Works', url: '#how-it-works' },
      { label: 'Subscription Plans', url: '#pricing' },
      { label: 'About Us', url: '/about-us' },
      { label: 'Register Madrasa', url: '/register' },
      { label: 'Admin Login', url: '/login' },
    ],
  },
  seo: {
    metaTitle: 'MadrasaNexa — Modern Madrasa Management Platform',
    metaDescription: 'All-in-one cloud platform for Madrasa student records, classes, fee collections, attendance, and reporting.',
    ogTitle: 'MadrasaNexa — Modern Madrasa Management Platform',
    ogDescription: 'Streamline Madrasa administration with multi-tenant security, automated billing, and student records.',
  },
};

function sanitizeOriginalFilename(rawName, defaultName = 'hero.webp') {
  if (!rawName || typeof rawName !== 'string') return defaultName;
  return rawName
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

/**
 * Validates, security-checks, and processes an image using Sharp.
 */
async function processImage(fileBuffer, originalName, { maxWidth = 1600, maxHeight = 1200 } = {}) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new BadRequestError('No image file provided.');
  }

  if (fileBuffer.length > MAX_IMAGE_SIZE) {
    throw new BadRequestError('Each image must be smaller than 5 MB.');
  }

  const nameLower = (originalName || '').toLowerCase();
  const isSvgExtension = nameLower.endsWith('.svg');
  const bufferPrefix = fileBuffer.slice(0, 100).toString('utf8').toLowerCase();
  const isSvgContent = bufferPrefix.includes('<svg') || bufferPrefix.includes('<?xml');

  if (isSvgExtension || isSvgContent) {
    throw new BadRequestError('SVG images are not allowed for security reasons. Please upload a JPG, PNG or WebP image.');
  }

  let metadata;
  try {
    const probe = sharp(fileBuffer, {
      limitInputPixels: 16777216,
      failOnError: true,
    });
    metadata = await probe.metadata();
  } catch (err) {
    throw new BadRequestError('Corrupted or invalid image file. Please upload a valid JPG, PNG, or WebP image.');
  }

  if (metadata.format === 'svg') {
    throw new BadRequestError('SVG images are not allowed for security reasons.');
  }

  if (!metadata.format || !ALLOWED_IMAGE_FORMATS.has(metadata.format)) {
    throw new BadRequestError('Please upload a JPG, PNG or WebP image.');
  }

  if (metadata.pages && metadata.pages > 1) {
    throw new BadRequestError('Animated or multi-page images are not supported.');
  }

  if ((metadata.width && metadata.width > 4096) || (metadata.height && metadata.height > 4096)) {
    throw new BadRequestError('Image dimensions are too large. Maximum supported dimensions are 4096x4096px.');
  }

  try {
    const processedBuffer = await sharp(fileBuffer, { limitInputPixels: 16777216 })
      .rotate()
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();

    return processedBuffer;
  } catch (err) {
    throw new BadRequestError('Failed to process image file.');
  }
}

/**
 * Resolves FileObject records into full URLs for hero media items.
 */
async function resolveHeroMedia(heroMedia) {
  if (!heroMedia || typeof heroMedia !== 'object') {
    return {
      enabled: true,
      autoplay: true,
      autoplayInterval: 5000,
      items: [],
    };
  }

  const items = Array.isArray(heroMedia.items) ? heroMedia.items : [];
  if (items.length === 0) {
    return {
      enabled: heroMedia.enabled !== false,
      autoplay: heroMedia.autoplay !== false,
      autoplayInterval: heroMedia.autoplayInterval || 5000,
      items: [],
    };
  }

  const fileIds = items.map((i) => i.fileId).filter(Boolean);
  const fileObjects = fileIds.length > 0
    ? await prisma.fileObject.findMany({
        where: { id: { in: fileIds } },
      })
    : [];

  const fileMap = new Map(fileObjects.map((f) => [f.id, f]));

  const resolvedItems = [];
  for (const item of items) {
    const file = fileMap.get(item.fileId);
    if (!file) continue;

    const url = await resolveObjectAccessUrl(file.objectKey);
    resolvedItems.push({
      id: item.id,
      fileId: item.fileId,
      url,
      alt: item.alt || '',
      caption: item.caption || null,
      enabled: item.enabled !== false,
      sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
      originalName: file.originalName,
      size: file.size,
    });
  }

  resolvedItems.sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    enabled: heroMedia.enabled !== false,
    autoplay: heroMedia.autoplay !== false,
    autoplayInterval: heroMedia.autoplayInterval || 5000,
    items: resolvedItems,
  };
}

/**
 * Strict FileObject Reference Validator
 * Ensures that any file referenced in homepage CMS is an authorized, global public asset.
 * Rejects tenant assets, non-OTHER types, non-homepage paths, and receipts.
 */
export async function validateHomepageFileReference(fileId, fieldLabel = 'Image file') {
  if (!fileId) return null;
  const fileObj = await prisma.fileObject.findUnique({ where: { id: fileId } });
  if (!fileObj) {
    throw new BadRequestError(`${fieldLabel} not found (ID: ${fileId}).`);
  }
  if (fileObj.madrasaId !== null) {
    throw new BadRequestError(`${fieldLabel} must be a global public asset (cannot belong to a tenant).`);
  }
  if (fileObj.type !== 'OTHER') {
    throw new BadRequestError(`${fieldLabel} has invalid file type.`);
  }
  if (!fileObj.objectKey || !fileObj.objectKey.startsWith('platform/homepage/')) {
    throw new BadRequestError(`${fieldLabel} must belong to platform homepage storage.`);
  }
  if (fileObj.objectKey.toLowerCase().includes('receipt')) {
    throw new BadRequestError(`${fieldLabel} cannot be a private receipt object.`);
  }
  return fileObj;
}

/**
 * Resolves product preview screenshot URL.
 */
async function resolveProductPreviewMedia(previewMedia) {
  if (!previewMedia || typeof previewMedia !== 'object') {
    return {
      enabled: true,
      fileId: null,
      url: null,
      alt: '',
      caption: null,
    };
  }

  let url = null;
  let originalName = null;
  let size = null;

  if (previewMedia.fileId) {
    const fileObj = await prisma.fileObject.findUnique({
      where: { id: previewMedia.fileId },
    });
    if (fileObj && fileObj.madrasaId === null && fileObj.objectKey?.startsWith('platform/homepage/')) {
      url = await resolveObjectAccessUrl(fileObj.objectKey);
      originalName = fileObj.originalName;
      size = fileObj.size;
    }
  }

  return {
    enabled: previewMedia.enabled !== false,
    fileId: previewMedia.fileId || null,
    url,
    alt: previewMedia.alt || '',
    caption: previewMedia.caption || null,
    originalName,
    size,
  };
}

/**
 * Resolves optional screenshot URLs for individual feature cards.
 */
async function resolveFeaturesMedia(features) {
  if (!Array.isArray(features)) return [];
  const fileIds = features.map((f) => f.imageFileId).filter(Boolean);
  const fileObjects = fileIds.length > 0
    ? await prisma.fileObject.findMany({
        where: { id: { in: fileIds } },
      })
    : [];

  const fileMap = new Map(fileObjects.map((f) => [f.id, f]));

  const resolved = [];
  for (const feat of features) {
    let imageUrl = null;
    let originalName = null;
    let size = null;
    if (feat.imageFileId) {
      const file = fileMap.get(feat.imageFileId);
      if (file && file.madrasaId === null && file.objectKey?.startsWith('platform/homepage/')) {
        imageUrl = await resolveObjectAccessUrl(file.objectKey);
        originalName = file.originalName;
        size = file.size;
      }
    }
    resolved.push({
      ...feat,
      imageUrl,
      imageOriginalName: originalName,
      imageSize: size,
    });
  }
  return resolved;
}

/**
 * Returns all FileObject IDs referenced anywhere in a homepage content tree
 * (hero slider, product preview showcase, and feature items).
 */
export function getAllReferencedFileIds(content) {
  if (!content || typeof content !== 'object') return new Set();
  const ids = new Set();
  if (Array.isArray(content.heroMedia?.items)) {
    for (const item of content.heroMedia.items) {
      if (item?.fileId) ids.add(item.fileId);
    }
  }
  if (content.productPreviewMedia?.fileId) {
    ids.add(content.productPreviewMedia.fileId);
  }
  if (Array.isArray(content.features)) {
    for (const feat of content.features) {
      if (feat?.imageFileId) ids.add(feat.imageFileId);
    }
  }
  return ids;
}

/**
 * Race-safe singleton getter / initializer
 */
export async function getOrCreateHomepageContent(tx = prisma) {
  let record = await tx.homepageContent.findUnique({
    where: { id: SINGLETON_ID },
  });

  if (!record) {
    record = await tx.homepageContent.create({
      data: {
        id: SINGLETON_ID,
        status: 'DRAFT',
        draftContent: DEFAULT_HOMEPAGE_CONTENT,
        publishedContent: null,
      },
    });
  }

  return record;
}

/**
 * Public: GET /api/public/homepage
 * Exposes ONLY published data, real active subscription plans, and published About Us.
 * Strictly NEVER exposes draft content to unauthenticated visitors.
 */
export async function getPublicHomepage() {
  const record = await getOrCreateHomepageContent();

  // Fetch authoritative active plans
  const activePlans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      price: true,
      durationMonths: true,
      isActive: true,
    },
  });

  // Fetch published About Us snapshot (if available)
  let aboutUsSnapshot = null;
  try {
    const aboutUsData = await aboutUsService.getPublicAboutUs();
    aboutUsSnapshot = aboutUsData || null;
  } catch (err) {
    aboutUsSnapshot = null;
  }

  const isPublished = record.status === 'PUBLISHED' && Boolean(record.publishedContent);

  let publicContent = null;
  if (isPublished && record.publishedContent) {
    const published = { ...record.publishedContent };

    // Resolve public hero media items (only enabled ones)
    if (published.heroMedia) {
      const resolvedHeroMedia = await resolveHeroMedia(published.heroMedia);
      resolvedHeroMedia.items = resolvedHeroMedia.items.filter((i) => i.enabled);
      published.heroMedia = resolvedHeroMedia;
    }

    // Resolve public product preview media
    if (published.productPreviewMedia) {
      const resolvedPreview = await resolveProductPreviewMedia(published.productPreviewMedia);
      published.productPreviewMedia = {
        enabled: resolvedPreview.enabled,
        url: resolvedPreview.enabled ? resolvedPreview.url : null,
        alt: resolvedPreview.alt,
        caption: resolvedPreview.caption,
      };
    } else {
      published.productPreviewMedia = {
        enabled: true,
        url: null,
        alt: '',
        caption: null,
      };
    }

    // Resolve public features media
    if (published.features) {
      const resolvedFeatures = await resolveFeaturesMedia(published.features);
      published.features = resolvedFeatures.map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description,
        icon: f.icon,
        sortOrder: f.sortOrder,
        enabled: f.enabled !== false,
        imageUrl: f.imageUrl || null,
        imageAlt: f.imageAlt || '',
        imageCaption: f.imageCaption || null,
      }));
    }

    // Format WhatsApp configuration
    if (published.whatsapp) {
      published.whatsapp = {
        enabled: published.whatsapp.enabled !== false,
        number: published.whatsapp.number || '+94 78 325 4552',
        defaultMessage:
          published.whatsapp.defaultMessage ||
          'Assalamu Alaikum, I would like to know more about MadrasaNexa.',
      };
    } else {
      published.whatsapp = {
        enabled: true,
        number: '+94 78 325 4552',
        defaultMessage: 'Assalamu Alaikum, I would like to know more about MadrasaNexa.',
      };
    }

    publicContent = published;
  }

  // Return strictly whitelisted public-safe response
  return {
    isPublished,
    status: record.status,
    publishedAt: record.publishedAt,
    content: publicContent,
    plans: activePlans,
    aboutUs: aboutUsSnapshot,
  };
}

/**
 * Super Admin: GET /api/super-admin/website-content/homepage
 * Returns full draft, published snapshot, and management metadata.
 */
export async function getAdminHomepageDraft() {
  const record = await getOrCreateHomepageContent();

  const activePlansCount = await prisma.plan.count({
    where: { isActive: true },
  });

  const draft = record.draftContent || DEFAULT_HOMEPAGE_CONTENT;
  const resolvedDraft = { ...draft };

  if (resolvedDraft.heroMedia) {
    resolvedDraft.heroMedia = await resolveHeroMedia(resolvedDraft.heroMedia);
  } else {
    resolvedDraft.heroMedia = { enabled: true, autoplay: true, autoplayInterval: 5000, items: [] };
  }

  resolvedDraft.productPreviewMedia = await resolveProductPreviewMedia(
    resolvedDraft.productPreviewMedia || DEFAULT_HOMEPAGE_CONTENT.productPreviewMedia
  );

  resolvedDraft.features = await resolveFeaturesMedia(resolvedDraft.features || []);

  if (!resolvedDraft.whatsapp) {
    resolvedDraft.whatsapp = {
      enabled: true,
      number: '+94 78 325 4552',
      defaultMessage: 'Assalamu Alaikum, I would like to know more about MadrasaNexa.',
    };
  }

  let resolvedPublished = null;
  if (record.publishedContent) {
    resolvedPublished = { ...record.publishedContent };
    if (resolvedPublished.heroMedia) {
      resolvedPublished.heroMedia = await resolveHeroMedia(resolvedPublished.heroMedia);
    }
    if (resolvedPublished.productPreviewMedia) {
      resolvedPublished.productPreviewMedia = await resolveProductPreviewMedia(
        resolvedPublished.productPreviewMedia
      );
    }
    if (resolvedPublished.features) {
      resolvedPublished.features = await resolveFeaturesMedia(resolvedPublished.features);
    }
  }

  return {
    id: record.id,
    status: record.status,
    draftContent: resolvedDraft,
    publishedContent: resolvedPublished,
    publishedAt: record.publishedAt,
    publishedById: record.publishedById,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    activePlansCount,
  };
}

/**
 * Super Admin: POST /api/super-admin/website-content/homepage/images
 * Uploads one or multiple images safely to Cloudflare R2 and creates FileObject records.
 */
export async function uploadHomepageImages(files, user, { ipAddress = null, userAgent = null, section = 'hero' } = {}) {
  if (!files || (Array.isArray(files) && files.length === 0)) {
    throw new BadRequestError('No image files provided.');
  }

  const validSection = ALLOWED_HOMEPAGE_SECTIONS.includes(section) ? section : 'hero';

  const fileList = Array.isArray(files) ? files : [files];
  if (fileList.length > 8) {
    throw new BadRequestError('Cannot upload more than 8 images at once.');
  }

  let maxWidth = 1600;
  let maxHeight = 1200;
  if (validSection === 'product-preview') {
    maxWidth = 2000;
    maxHeight = 1400;
  } else if (validSection === 'features') {
    maxWidth = 1200;
    maxHeight = 900;
  }

  const uploadedRecords = [];
  const rollbackKeys = [];

  try {
    for (const file of fileList) {
      const originalName = file.originalname || 'image.webp';
      const fileBuffer = file.buffer;

      // 1. Process and validate image with Sharp
      const processedBuffer = await processImage(fileBuffer, originalName, {
        maxWidth,
        maxHeight,
      });

      // 2. Upload to Cloudflare R2 public bucket
      const sectionFolder = validSection === 'hero' ? 'platform/homepage/hero' : `platform/homepage/sections/${validSection}`;
      const objectKey = `${sectionFolder}/${crypto.randomUUID()}.webp`;
      await uploadBufferToR2(objectKey, processedBuffer, 'image/webp');
      rollbackKeys.push(objectKey);

      // 3. Create FileObject in database
      const fileRecord = await prisma.fileObject.create({
        data: {
          madrasaId: null,
          type: 'OTHER',
          objectKey,
          originalName: sanitizeOriginalFilename(originalName, `${validSection}.webp`),
          mimeType: 'image/webp',
          size: processedBuffer.length,
        },
      });

      const url = await resolveObjectAccessUrl(fileRecord.objectKey);
      uploadedRecords.push({
        id: fileRecord.id,
        fileId: fileRecord.id,
        url,
        originalName: fileRecord.originalName,
        size: fileRecord.size,
        mimeType: fileRecord.mimeType,
        section: validSection,
      });
    }

    // Record activity log
    try {
      await prisma.activityLog.create({
        data: {
          action: 'HOMEPAGE_IMAGES_UPLOADED',
          userId: user?.id || user?.userId || null,
          entityType: 'HomepageContent',
          entityId: SINGLETON_ID,
          metadata: {
            section: validSection,
            uploadedCount: uploadedRecords.length,
            fileIds: uploadedRecords.map((r) => r.id),
          },
          ipAddress: ipAddress ? String(ipAddress) : null,
          userAgent: userAgent ? String(userAgent) : null,
        },
      });
    } catch (logErr) {
      console.error('[HomepageService] Failed to record upload activity log:', logErr.message);
    }

    return uploadedRecords;
  } catch (err) {
    // Rollback any R2 objects uploaded in this failed batch
    for (const key of rollbackKeys) {
      await deleteObjectFromR2(key).catch(() => {});
    }
    throw err;
  }
}

/**
 * Super Admin: DELETE /api/super-admin/website-content/homepage/images/:fileId
 * Deletes an uploaded image from R2 and FileObject ONLY IF it is not referenced in draft or published content.
 */
export async function removeHomepageImage(fileId, user) {
  if (!fileId) {
    throw new BadRequestError('File ID is required.');
  }

  const record = await getOrCreateHomepageContent();
  const draftFileIds = getAllReferencedFileIds(record.draftContent);
  const publishedFileIds = getAllReferencedFileIds(record.publishedContent);

  if (draftFileIds.has(fileId)) {
    throw new BadRequestError(
      'Cannot delete image while it is referenced in the current draft. Remove it from the draft first.'
    );
  }
  if (publishedFileIds.has(fileId)) {
    throw new BadRequestError(
      'Cannot delete image while it is currently published on the live website. Unpublish or replace it first.'
    );
  }

  const fileObj = await prisma.fileObject.findUnique({ where: { id: fileId } });
  if (!fileObj) {
    throw new NotFoundError('Image file not found.');
  }

  if (fileObj.madrasaId !== null || !fileObj.objectKey?.startsWith('platform/homepage/')) {
    throw new BadRequestError('Unauthorized file deletion target.');
  }

  try {
    await deleteObjectFromR2(fileObj.objectKey);
  } catch (r2Err) {
    console.error('[HomepageService] Failed to delete object from R2:', r2Err.message);
  }

  await prisma.fileObject.delete({ where: { id: fileId } });

  return { success: true, message: 'Image deleted successfully.' };
}

/**
 * Super Admin: PUT /api/super-admin/website-content/homepage
 * Validates and saves changes to draftContent without altering published public content.
 */
export async function updateHomepageDraft(draftPayload, user) {
  const parsed = updateHomepageDraftSchema.parse(draftPayload);

  // Security Verification: Validate all referenced file IDs
  if (parsed.heroMedia?.items && Array.isArray(parsed.heroMedia.items)) {
    for (let i = 0; i < parsed.heroMedia.items.length; i++) {
      const item = parsed.heroMedia.items[i];
      if (item.fileId) {
        await validateHomepageFileReference(item.fileId, `Hero media image [${i + 1}]`);
      }
    }
  }

  if (parsed.productPreviewMedia?.fileId) {
    await validateHomepageFileReference(parsed.productPreviewMedia.fileId, 'Product preview image');
  }

  if (parsed.features && Array.isArray(parsed.features)) {
    for (let i = 0; i < parsed.features.length; i++) {
      const feat = parsed.features[i];
      if (feat.imageFileId) {
        await validateHomepageFileReference(feat.imageFileId, `Feature "${feat.title || i + 1}" image`);
      }
    }
  }

  // Merge with existing draft to preserve unedited sections
  const existing = await getOrCreateHomepageContent();
  const currentDraft = (existing.draftContent && typeof existing.draftContent === 'object')
    ? existing.draftContent
    : DEFAULT_HOMEPAGE_CONTENT;

  const mergedDraft = {
    ...currentDraft,
    ...parsed,
  };

  const updated = await prisma.homepageContent.update({
    where: { id: SINGLETON_ID },
    data: {
      draftContent: mergedDraft,
    },
  });

  return {
    status: updated.status,
    draftContent: updated.draftContent,
    updatedAt: updated.updatedAt,
  };
}

/**
 * Super Admin: POST /api/super-admin/website-content/homepage/publish
 * Promotes current validated draft into the authoritative published snapshot.
 */
export async function publishHomepage(user, meta = {}) {
  const record = await getOrCreateHomepageContent();
  const draft = record.draftContent || DEFAULT_HOMEPAGE_CONTENT;

  // Validate draft before publishing
  const validated = updateHomepageDraftSchema.parse(draft);

  const updated = await prisma.homepageContent.update({
    where: { id: SINGLETON_ID },
    data: {
      publishedContent: validated,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      publishedById: user?.id || null,
    },
  });

  // Log activity
  try {
    await prisma.activityLog.create({
      data: {
        action: 'HOMEPAGE_PUBLISHED',
        userId: user?.id || null,
        entityType: 'HomepageContent',
        entityId: SINGLETON_ID,
        metadata: {
          publishedAt: updated.publishedAt,
        },
        ipAddress: meta.ipAddress || null,
        userAgent: meta.userAgent || null,
      },
    });
  } catch (logErr) {
    console.error('[HomepageService] Failed to record publish activity log:', logErr.message);
  }

  return {
    status: updated.status,
    publishedAt: updated.publishedAt,
    publishedContent: updated.publishedContent,
  };
}

/**
 * Super Admin: POST /api/super-admin/website-content/homepage/unpublish
 * Reverts publication status to UNPUBLISHED, causing the public site to fall back safely.
 */
export async function unpublishHomepage(user, meta = {}) {
  const updated = await prisma.homepageContent.update({
    where: { id: SINGLETON_ID },
    data: {
      status: 'UNPUBLISHED',
    },
  });

  // Log activity
  try {
    await prisma.activityLog.create({
      data: {
        action: 'HOMEPAGE_UNPUBLISHED',
        userId: user?.id || null,
        entityType: 'HomepageContent',
        entityId: SINGLETON_ID,
        ipAddress: meta.ipAddress || null,
        userAgent: meta.userAgent || null,
      },
    });
  } catch (logErr) {
    console.error('[HomepageService] Failed to record unpublish activity log:', logErr.message);
  }

  return {
    status: updated.status,
    updatedAt: updated.updatedAt,
  };
}
