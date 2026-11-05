import sharp from 'sharp';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import {
  uploadBufferToR2,
  deleteObjectFromR2,
  resolveObjectAccessUrl,
} from './r2.service.js';
import { isR2Configured } from '../config/r2.js';
import { AppError, BadRequestError, NotFoundError } from '../utils/errors.js';

const SINGLETON_ID = 'global';
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

function sanitizeOriginalFilename(rawName, defaultName = 'image.webp') {
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
async function processImage(fileBuffer, originalName, { maxWidth, maxHeight }) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new BadRequestError('No image file provided.');
  }

  if (fileBuffer.length > MAX_UPLOAD_SIZE) {
    throw new BadRequestError('Image must be smaller than 5 MB.');
  }

  // Strictly reject SVGs before sharp decoding to prevent XML parsing/SSRF/XSS
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
      limitInputPixels: 16777216, // Max 4096 x 4096 decoded pixels
      failOnError: true,
    });
    metadata = await probe.metadata();
  } catch (err) {
    throw new BadRequestError('Corrupted or invalid image file. Please upload a valid JPG, PNG, or WebP image.');
  }

  if (metadata.format === 'svg') {
    throw new BadRequestError('SVG images are not allowed for security reasons.');
  }

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
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
      .rotate() // Apply EXIF orientation
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
 * Ensures array items have stable IDs.
 */
function ensureArrayItemIds(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (item && typeof item === 'object') {
      const copy = { ...item };
      if (!copy.id || typeof copy.id !== 'string' || !copy.id.trim()) {
        copy.id = crypto.randomUUID();
      }
      return copy;
    }
    return item;
  });
}

/**
 * Race-safe singleton getter / initializer
 */
export async function getOrCreateAboutUs(tx = prisma) {
  return await tx.aboutUs.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: {
      id: SINGLETON_ID,
      status: 'DRAFT',
    },
    include: {
      draftHeroFile: true,
      draftStoryFile: true,
      publishedHeroFile: true,
      publishedStoryFile: true,
    },
  });
}

/**
 * Normalizes legacy array items lacking IDs. Controlled, idempotent one-time path.
 */
export async function normalizeLegacyAboutUsArrayIds(tx = prisma) {
  const aboutUs = await tx.aboutUs.findUnique({ where: { id: SINGLETON_ID } });
  if (!aboutUs) return { normalized: false };

  let changed = false;

  const normalizeArray = (arr) => {
    if (!Array.isArray(arr)) return arr;
    return arr.map((item) => {
      if (item && typeof item === 'object' && !item.id) {
        changed = true;
        return { ...item, id: crypto.randomUUID() };
      }
      return item;
    });
  };

  const draftCoreValues = normalizeArray(aboutUs.draftCoreValues);
  const publishedCoreValues = normalizeArray(aboutUs.publishedCoreValues);
  const draftHighlights = normalizeArray(aboutUs.draftHighlights);
  const publishedHighlights = normalizeArray(aboutUs.publishedHighlights);

  if (changed) {
    await tx.aboutUs.update({
      where: { id: SINGLETON_ID },
      data: {
        draftCoreValues,
        publishedCoreValues,
        draftHighlights,
        publishedHighlights,
      },
    });
  }

  return { normalized: changed };
}

/**
 * Loads the complete About Us CMS record for Super Admin management,
 * including EN draft/published and AR/TA translation snapshots.
 */
export async function getAdminAboutUs() {
  const aboutUs = await getOrCreateAboutUs();

  const translations = await prisma.aboutUsTranslation.findMany({
    where: { aboutUsId: SINGLETON_ID },
  });

  const [
    draftHeroImageUrl,
    draftStoryImageUrl,
    publishedHeroImageUrl,
    publishedStoryImageUrl,
  ] = await Promise.all([
    aboutUs.draftHeroFile ? resolveObjectAccessUrl(aboutUs.draftHeroFile.objectKey) : null,
    aboutUs.draftStoryFile ? resolveObjectAccessUrl(aboutUs.draftStoryFile.objectKey) : null,
    aboutUs.publishedHeroFile ? resolveObjectAccessUrl(aboutUs.publishedHeroFile.objectKey) : null,
    aboutUs.publishedStoryFile ? resolveObjectAccessUrl(aboutUs.publishedStoryFile.objectKey) : null,
  ]);

  const findTranslation = (lang, targetState) => {
    const row = translations.find((t) => t.language === lang && t.targetState === targetState);
    if (!row) return null;
    return {
      title: row.title || '',
      subtitle: row.subtitle || '',
      introduction: row.introduction || '',
      story: row.story || '',
      mission: row.mission || '',
      vision: row.vision || '',
      coreValues: Array.isArray(row.coreValues) ? row.coreValues : [],
      highlights: Array.isArray(row.highlights) ? row.highlights : [],
      ctaLabel: row.ctaLabel || '',
      heroAlt: row.heroAlt || '',
      storyAlt: row.storyAlt || '',
    };
  };

  return {
    id: aboutUs.id,
    status: aboutUs.status,
    draft: {
      title: aboutUs.draftTitle || '',
      subtitle: aboutUs.draftSubtitle || '',
      introduction: aboutUs.draftIntroduction || '',
      story: aboutUs.draftStory || '',
      mission: aboutUs.draftMission || '',
      vision: aboutUs.draftVision || '',
      coreValues: Array.isArray(aboutUs.draftCoreValues) ? aboutUs.draftCoreValues : [],
      highlights: Array.isArray(aboutUs.draftHighlights) ? aboutUs.draftHighlights : [],
      ctaLabel: aboutUs.draftCtaLabel || '',
      ctaUrl: aboutUs.draftCtaUrl || '',
      heroFileId: aboutUs.draftHeroFileId,
      heroImageUrl: draftHeroImageUrl,
      heroAlt: aboutUs.draftHeroAlt || '',
      storyFileId: aboutUs.draftStoryFileId,
      storyImageUrl: draftStoryImageUrl,
      storyAlt: aboutUs.draftStoryAlt || '',
    },
    published: {
      title: aboutUs.publishedTitle || '',
      subtitle: aboutUs.publishedSubtitle || '',
      introduction: aboutUs.publishedIntroduction || '',
      story: aboutUs.publishedStory || '',
      mission: aboutUs.publishedMission || '',
      vision: aboutUs.publishedVision || '',
      coreValues: Array.isArray(aboutUs.publishedCoreValues) ? aboutUs.publishedCoreValues : [],
      highlights: Array.isArray(aboutUs.publishedHighlights) ? aboutUs.publishedHighlights : [],
      ctaLabel: aboutUs.publishedCtaLabel || '',
      ctaUrl: aboutUs.publishedCtaUrl || '',
      heroFileId: aboutUs.publishedHeroFileId,
      heroImageUrl: publishedHeroImageUrl,
      heroAlt: aboutUs.publishedHeroAlt || '',
      storyFileId: aboutUs.publishedStoryFileId,
      storyImageUrl: publishedStoryImageUrl,
      storyAlt: aboutUs.publishedStoryAlt || '',
      publishedAt: aboutUs.publishedAt,
    },
    translations: {
      ar: {
        draft: findTranslation('AR', 'DRAFT'),
        published: findTranslation('AR', 'PUBLISHED'),
      },
      ta: {
        draft: findTranslation('TA', 'DRAFT'),
        published: findTranslation('TA', 'PUBLISHED'),
      },
    },
    createdAt: aboutUs.createdAt,
    updatedAt: aboutUs.updatedAt,
  };
}

/**
 * Updates draft content snapshot for EN, AR, or TA.
 * Preserves published status and does NOT overwrite published content.
 */
export async function updateDraft(data, user, { ipAddress = null, userAgent = null, language = 'en' } = {}) {
  await getOrCreateAboutUs();
  const targetLang = (data.language || language || 'en').toString().toLowerCase().trim();
  const langUpper = targetLang.toUpperCase();

  if (langUpper === 'EN') {
    const updatePayload = {};

    if (data.title !== undefined) updatePayload.draftTitle = data.title;
    if (data.subtitle !== undefined) updatePayload.draftSubtitle = data.subtitle;
    if (data.introduction !== undefined) updatePayload.draftIntroduction = data.introduction;
    if (data.story !== undefined) updatePayload.draftStory = data.story;
    if (data.mission !== undefined) updatePayload.draftMission = data.mission;
    if (data.vision !== undefined) updatePayload.draftVision = data.vision;
    if (data.coreValues !== undefined) updatePayload.draftCoreValues = ensureArrayItemIds(data.coreValues);
    if (data.highlights !== undefined) updatePayload.draftHighlights = ensureArrayItemIds(data.highlights);
    if (data.ctaLabel !== undefined) updatePayload.draftCtaLabel = data.ctaLabel;
    if (data.ctaUrl !== undefined) updatePayload.draftCtaUrl = data.ctaUrl;
    if (data.heroAlt !== undefined) updatePayload.draftHeroAlt = data.heroAlt;
    if (data.storyAlt !== undefined) updatePayload.draftStoryAlt = data.storyAlt;

    await prisma.$transaction(async (tx) => {
      await tx.aboutUs.update({
        where: { id: SINGLETON_ID },
        data: updatePayload,
      });

      await tx.activityLog.create({
        data: {
          madrasaId: null,
          userId: user?.userId || user?.id || null,
          action: 'ABOUT_US_DRAFT_UPDATED',
          entityType: 'AboutUs',
          entityId: SINGLETON_ID,
          metadata: {
            language: 'EN',
            updatedFields: Object.keys(updatePayload),
          },
          ipAddress: ipAddress ? String(ipAddress) : null,
          userAgent: userAgent ? String(userAgent) : null,
        },
      });
    });
  } else if (langUpper === 'AR' || langUpper === 'TA') {
    const translationData = {};

    if (data.title !== undefined) translationData.title = data.title;
    if (data.subtitle !== undefined) translationData.subtitle = data.subtitle;
    if (data.introduction !== undefined) translationData.introduction = data.introduction;
    if (data.story !== undefined) translationData.story = data.story;
    if (data.mission !== undefined) translationData.mission = data.mission;
    if (data.vision !== undefined) translationData.vision = data.vision;
    if (data.coreValues !== undefined) translationData.coreValues = Array.isArray(data.coreValues) ? data.coreValues : [];
    if (data.highlights !== undefined) translationData.highlights = Array.isArray(data.highlights) ? data.highlights : [];
    if (data.ctaLabel !== undefined) translationData.ctaLabel = data.ctaLabel;
    if (data.heroAlt !== undefined) translationData.heroAlt = data.heroAlt;
    if (data.storyAlt !== undefined) translationData.storyAlt = data.storyAlt;

    await prisma.$transaction(async (tx) => {
      await tx.aboutUsTranslation.upsert({
        where: {
          aboutUsId_language_targetState: {
            aboutUsId: SINGLETON_ID,
            language: langUpper,
            targetState: 'DRAFT',
          },
        },
        create: {
          aboutUsId: SINGLETON_ID,
          language: langUpper,
          targetState: 'DRAFT',
          ...translationData,
        },
        update: translationData,
      });

      await tx.activityLog.create({
        data: {
          madrasaId: null,
          userId: user?.userId || user?.id || null,
          action: 'ABOUT_US_DRAFT_UPDATED',
          entityType: 'AboutUsTranslation',
          entityId: `${SINGLETON_ID}_${langUpper}_DRAFT`,
          metadata: {
            language: langUpper,
            updatedFields: Object.keys(translationData),
          },
          ipAddress: ipAddress ? String(ipAddress) : null,
          userAgent: userAgent ? String(userAgent) : null,
        },
      });
    });
  } else {
    throw new BadRequestError(`Invalid language: ${language}`);
  }

  return await getAdminAboutUs();
}

/**
 * Uploads a hero image (max 1920px), sets it as draftHeroFileId with compensation.
 */
export async function uploadHeroImage(fileBuffer, originalName, user, { ipAddress = null, userAgent = null, altText = null } = {}) {
  await getOrCreateAboutUs();

  const processedBuffer = await processImage(fileBuffer, originalName, {
    maxWidth: 1920,
    maxHeight: 1920,
  });

  const objectKey = `platform/about-us/hero/${crypto.randomUUID()}.webp`;

  // Step 1: Upload to Cloudflare R2
  try {
    await uploadBufferToR2(objectKey, processedBuffer, 'image/webp');
  } catch (storageErr) {
    console.error('[AboutUsService] Hero image upload failed:', storageErr.message);
    if (!isR2Configured() && process.env.NODE_ENV !== 'test') {
      throw new AppError('File storage is not configured.', 500);
    }
    throw new AppError(storageErr.message || 'File storage service is unavailable.', 500);
  }

  // Step 2: Database transaction with compensation rollback
  let fileRecord;
  try {
    fileRecord = await prisma.$transaction(async (tx) => {
      const fileObj = await tx.fileObject.create({
        data: {
          madrasaId: null, // Global platform file
          type: 'ABOUT_US_HERO',
          objectKey,
          originalName: sanitizeOriginalFilename(originalName, 'hero.webp'),
          mimeType: 'image/webp',
          size: processedBuffer.length,
        },
      });

      const updateData = {
        draftHeroFileId: fileObj.id,
      };
      if (altText !== null && altText !== undefined) {
        updateData.draftHeroAlt = String(altText).trim();
      }

      await tx.aboutUs.update({
        where: { id: SINGLETON_ID },
        data: updateData,
      });

      await tx.activityLog.create({
        data: {
          madrasaId: null,
          userId: user?.userId || user?.id || null,
          action: 'ABOUT_US_HERO_UPLOADED',
          entityType: 'FileObject',
          entityId: fileObj.id,
          metadata: {
            fileId: fileObj.id,
            size: processedBuffer.length,
          },
          ipAddress: ipAddress ? String(ipAddress) : null,
          userAgent: userAgent ? String(userAgent) : null,
        },
      });

      return fileObj;
    });
  } catch (dbErr) {
    // Best-effort compensation: delete newly uploaded R2 object
    console.error('[AboutUsService] DB transaction failed, compensating R2 object:', objectKey);
    await deleteObjectFromR2(objectKey).catch((cleanupErr) => {
      console.error('[AboutUsService] R2 compensation delete failed:', cleanupErr.message);
    });
    throw dbErr;
  }

  return await getAdminAboutUs();
}

/**
 * Removes draft hero image reference (does NOT delete published hero image).
 */
export async function removeHeroImage(user, { ipAddress = null, userAgent = null } = {}) {
  await getOrCreateAboutUs();

  await prisma.$transaction(async (tx) => {
    await tx.aboutUs.update({
      where: { id: SINGLETON_ID },
      data: {
        draftHeroFileId: null,
      },
    });

    await tx.activityLog.create({
      data: {
        madrasaId: null,
        userId: user?.userId || user?.id || null,
        action: 'ABOUT_US_HERO_REMOVED',
        entityType: 'AboutUs',
        entityId: SINGLETON_ID,
        ipAddress: ipAddress ? String(ipAddress) : null,
        userAgent: userAgent ? String(userAgent) : null,
      },
    });
  });

  return await getAdminAboutUs();
}

/**
 * Uploads a story image (max 1200px), sets it as draftStoryFileId with compensation.
 */
export async function uploadStoryImage(fileBuffer, originalName, user, { ipAddress = null, userAgent = null, altText = null } = {}) {
  await getOrCreateAboutUs();

  const processedBuffer = await processImage(fileBuffer, originalName, {
    maxWidth: 1200,
    maxHeight: 1200,
  });

  const objectKey = `platform/about-us/story/${crypto.randomUUID()}.webp`;

  // Step 1: Upload to Cloudflare R2
  try {
    await uploadBufferToR2(objectKey, processedBuffer, 'image/webp');
  } catch (storageErr) {
    console.error('[AboutUsService] Story image upload failed:', storageErr.message);
    if (!isR2Configured() && process.env.NODE_ENV !== 'test') {
      throw new AppError('File storage is not configured.', 500);
    }
    throw new AppError(storageErr.message || 'File storage service is unavailable.', 500);
  }

  // Step 2: Database transaction with compensation rollback
  let fileRecord;
  try {
    fileRecord = await prisma.$transaction(async (tx) => {
      const fileObj = await tx.fileObject.create({
        data: {
          madrasaId: null, // Global platform file
          type: 'ABOUT_US_STORY',
          objectKey,
          originalName: sanitizeOriginalFilename(originalName, 'story.webp'),
          mimeType: 'image/webp',
          size: processedBuffer.length,
        },
      });

      const updateData = {
        draftStoryFileId: fileObj.id,
      };
      if (altText !== null && altText !== undefined) {
        updateData.draftStoryAlt = String(altText).trim();
      }

      await tx.aboutUs.update({
        where: { id: SINGLETON_ID },
        data: updateData,
      });

      await tx.activityLog.create({
        data: {
          madrasaId: null,
          userId: user?.userId || user?.id || null,
          action: 'ABOUT_US_STORY_UPLOADED',
          entityType: 'FileObject',
          entityId: fileObj.id,
          metadata: {
            fileId: fileObj.id,
            size: processedBuffer.length,
          },
          ipAddress: ipAddress ? String(ipAddress) : null,
          userAgent: userAgent ? String(userAgent) : null,
        },
      });

      return fileObj;
    });
  } catch (dbErr) {
    console.error('[AboutUsService] DB transaction failed, compensating R2 object:', objectKey);
    await deleteObjectFromR2(objectKey).catch((cleanupErr) => {
      console.error('[AboutUsService] R2 compensation delete failed:', cleanupErr.message);
    });
    throw dbErr;
  }

  return await getAdminAboutUs();
}

/**
 * Removes draft story image reference (does NOT delete published story image).
 */
export async function removeStoryImage(user, { ipAddress = null, userAgent = null } = {}) {
  await getOrCreateAboutUs();

  await prisma.$transaction(async (tx) => {
    await tx.aboutUs.update({
      where: { id: SINGLETON_ID },
      data: {
        draftStoryFileId: null,
      },
    });

    await tx.activityLog.create({
      data: {
        madrasaId: null,
        userId: user?.userId || user?.id || null,
        action: 'ABOUT_US_STORY_REMOVED',
        entityType: 'AboutUs',
        entityId: SINGLETON_ID,
        ipAddress: ipAddress ? String(ipAddress) : null,
        userAgent: userAgent ? String(userAgent) : null,
      },
    });
  });

  return await getAdminAboutUs();
}

/**
 * Atomically publishes draft snapshot to live published snapshot for EN, AR, and TA.
 */
export async function publishAboutUs(user, { ipAddress = null, userAgent = null } = {}) {
  const current = await getOrCreateAboutUs();

  // Ensure canonical draft arrays have stable IDs before publishing
  const draftCoreValues = ensureArrayItemIds(current.draftCoreValues);
  const draftHighlights = ensureArrayItemIds(current.draftHighlights);

  await prisma.$transaction(async (tx) => {
    // 1. English draft -> English published
    await tx.aboutUs.update({
      where: { id: SINGLETON_ID },
      data: {
        status: 'PUBLISHED',
        draftCoreValues,
        draftHighlights,
        publishedTitle: current.draftTitle,
        publishedSubtitle: current.draftSubtitle,
        publishedIntroduction: current.draftIntroduction,
        publishedStory: current.draftStory,
        publishedMission: current.draftMission,
        publishedVision: current.draftVision,
        publishedCoreValues: draftCoreValues,
        publishedHighlights: draftHighlights,
        publishedCtaLabel: current.draftCtaLabel,
        publishedCtaUrl: current.draftCtaUrl,
        publishedHeroFileId: current.draftHeroFileId,
        publishedHeroAlt: current.draftHeroAlt,
        publishedStoryFileId: current.draftStoryFileId,
        publishedStoryAlt: current.draftStoryAlt,
        publishedAt: new Date(),
      },
    });

    // 2. Upsert AR published snapshot if AR draft exists
    const arDraft = await tx.aboutUsTranslation.findUnique({
      where: {
        aboutUsId_language_targetState: {
          aboutUsId: SINGLETON_ID,
          language: 'AR',
          targetState: 'DRAFT',
        },
      },
    });

    if (arDraft) {
      await tx.aboutUsTranslation.upsert({
        where: {
          aboutUsId_language_targetState: {
            aboutUsId: SINGLETON_ID,
            language: 'AR',
            targetState: 'PUBLISHED',
          },
        },
        create: {
          aboutUsId: SINGLETON_ID,
          language: 'AR',
          targetState: 'PUBLISHED',
          title: arDraft.title,
          subtitle: arDraft.subtitle,
          introduction: arDraft.introduction,
          story: arDraft.story,
          mission: arDraft.mission,
          vision: arDraft.vision,
          coreValues: arDraft.coreValues,
          highlights: arDraft.highlights,
          ctaLabel: arDraft.ctaLabel,
          heroAlt: arDraft.heroAlt,
          storyAlt: arDraft.storyAlt,
        },
        update: {
          title: arDraft.title,
          subtitle: arDraft.subtitle,
          introduction: arDraft.introduction,
          story: arDraft.story,
          mission: arDraft.mission,
          vision: arDraft.vision,
          coreValues: arDraft.coreValues,
          highlights: arDraft.highlights,
          ctaLabel: arDraft.ctaLabel,
          heroAlt: arDraft.heroAlt,
          storyAlt: arDraft.storyAlt,
        },
      });
    }

    // 3. Upsert TA published snapshot if TA draft exists
    const taDraft = await tx.aboutUsTranslation.findUnique({
      where: {
        aboutUsId_language_targetState: {
          aboutUsId: SINGLETON_ID,
          language: 'TA',
          targetState: 'DRAFT',
        },
      },
    });

    if (taDraft) {
      await tx.aboutUsTranslation.upsert({
        where: {
          aboutUsId_language_targetState: {
            aboutUsId: SINGLETON_ID,
            language: 'TA',
            targetState: 'PUBLISHED',
          },
        },
        create: {
          aboutUsId: SINGLETON_ID,
          language: 'TA',
          targetState: 'PUBLISHED',
          title: taDraft.title,
          subtitle: taDraft.subtitle,
          introduction: taDraft.introduction,
          story: taDraft.story,
          mission: taDraft.mission,
          vision: taDraft.vision,
          coreValues: taDraft.coreValues,
          highlights: taDraft.highlights,
          ctaLabel: taDraft.ctaLabel,
          heroAlt: taDraft.heroAlt,
          storyAlt: taDraft.storyAlt,
        },
        update: {
          title: taDraft.title,
          subtitle: taDraft.subtitle,
          introduction: taDraft.introduction,
          story: taDraft.story,
          mission: taDraft.mission,
          vision: taDraft.vision,
          coreValues: taDraft.coreValues,
          highlights: taDraft.highlights,
          ctaLabel: taDraft.ctaLabel,
          heroAlt: taDraft.heroAlt,
          storyAlt: taDraft.storyAlt,
        },
      });
    }

    await tx.activityLog.create({
      data: {
        madrasaId: null,
        userId: user?.userId || user?.id || null,
        action: 'ABOUT_US_PUBLISHED',
        entityType: 'AboutUs',
        entityId: SINGLETON_ID,
        ipAddress: ipAddress ? String(ipAddress) : null,
        userAgent: userAgent ? String(userAgent) : null,
      },
    });
  });

  return await getAdminAboutUs();
}

/**
 * Unpublishes About Us content without deleting any draft or published data.
 */
export async function unpublishAboutUs(user, { ipAddress = null, userAgent = null } = {}) {
  await getOrCreateAboutUs();

  await prisma.$transaction(async (tx) => {
    await tx.aboutUs.update({
      where: { id: SINGLETON_ID },
      data: {
        status: 'UNPUBLISHED',
      },
    });

    await tx.activityLog.create({
      data: {
        madrasaId: null,
        userId: user?.userId || user?.id || null,
        action: 'ABOUT_US_UNPUBLISHED',
        entityType: 'AboutUs',
        entityId: SINGLETON_ID,
        ipAddress: ipAddress ? String(ipAddress) : null,
        userAgent: userAgent ? String(userAgent) : null,
      },
    });
  });

  return await getAdminAboutUs();
}

/**
 * Returns strictly public presentation data for the public /about-us endpoint.
 * Supports language-aware resolution with field-by-field fallback.
 */
export async function getPublicAboutUs(lang = 'en', { explicitLangQuery = false } = {}) {
  const allowedLangs = new Set(['en', 'ar', 'ta']);
  const normalizedLang = (typeof lang === 'string' && allowedLangs.has(lang.toLowerCase().trim()))
    ? lang.toLowerCase().trim()
    : 'en';

  const aboutUs = await prisma.aboutUs.findUnique({
    where: { id: SINGLETON_ID },
    include: {
      publishedHeroFile: true,
      publishedStoryFile: true,
    },
  });

  if (!aboutUs || aboutUs.status !== 'PUBLISHED') {
    return {
      isPublished: false,
      content: null,
      message: 'About Us content is currently unpublished.',
    };
  }

  const [heroImageUrl, storyImageUrl] = await Promise.all([
    aboutUs.publishedHeroFile ? resolveObjectAccessUrl(aboutUs.publishedHeroFile.objectKey) : null,
    aboutUs.publishedStoryFile ? resolveObjectAccessUrl(aboutUs.publishedStoryFile.objectKey) : null,
  ]);

  const enCoreValues = Array.isArray(aboutUs.publishedCoreValues) ? aboutUs.publishedCoreValues : [];
  const enHighlights = Array.isArray(aboutUs.publishedHighlights) ? aboutUs.publishedHighlights : [];

  // Default no-query request for English retains EXACT legacy contract
  if (!explicitLangQuery && normalizedLang === 'en') {
    return {
      isPublished: true,
      content: {
        title: aboutUs.publishedTitle || '',
        subtitle: aboutUs.publishedSubtitle || '',
        introduction: aboutUs.publishedIntroduction || '',
        story: aboutUs.publishedStory || '',
        mission: aboutUs.publishedMission || '',
        vision: aboutUs.publishedVision || '',
        coreValues: enCoreValues,
        highlights: enHighlights,
        ctaLabel: aboutUs.publishedCtaLabel || '',
        ctaUrl: aboutUs.publishedCtaUrl || '',
        heroImageUrl,
        heroImageAlt: aboutUs.publishedHeroAlt || '',
        storyImageUrl,
        storyImageAlt: aboutUs.publishedStoryAlt || '',
        publishedAt: aboutUs.publishedAt,
      },
    };
  }

  // Explicit language request
  let translationRow = null;
  if (normalizedLang === 'ar' || normalizedLang === 'ta') {
    translationRow = await prisma.aboutUsTranslation.findUnique({
      where: {
        aboutUsId_language_targetState: {
          aboutUsId: SINGLETON_ID,
          language: normalizedLang.toUpperCase(),
          targetState: 'PUBLISHED',
        },
      },
    });
  }

  const targetDir = normalizedLang === 'ar' ? 'rtl' : 'ltr';

  const resolveScalar = (localizedVal, englishVal) => {
    if (localizedVal !== null && localizedVal !== undefined && String(localizedVal).trim().length > 0) {
      return {
        value: String(localizedVal).trim(),
        meta: { lang: normalizedLang, dir: targetDir, isFallback: false },
      };
    }
    return {
      value: englishVal || '',
      meta: { lang: 'en', dir: 'ltr', isFallback: true },
    };
  };

  const titleRes = resolveScalar(translationRow?.title, aboutUs.publishedTitle);
  const subtitleRes = resolveScalar(translationRow?.subtitle, aboutUs.publishedSubtitle);
  const introRes = resolveScalar(translationRow?.introduction, aboutUs.publishedIntroduction);
  const storyRes = resolveScalar(translationRow?.story, aboutUs.publishedStory);
  const missionRes = resolveScalar(translationRow?.mission, aboutUs.publishedMission);
  const visionRes = resolveScalar(translationRow?.vision, aboutUs.publishedVision);
  const ctaLabelRes = resolveScalar(translationRow?.ctaLabel, aboutUs.publishedCtaLabel);
  const heroAltRes = resolveScalar(translationRow?.heroAlt, aboutUs.publishedHeroAlt);
  const storyAltRes = resolveScalar(translationRow?.storyAlt, aboutUs.publishedStoryAlt);

  // Core Values resolution
  const locCoreValuesMap = new Map();
  if (translationRow && Array.isArray(translationRow.coreValues)) {
    for (const item of translationRow.coreValues) {
      if (item && item.id) {
        locCoreValuesMap.set(String(item.id), item);
      }
    }
  }

  const locHighlightsMap = new Map();
  if (translationRow && Array.isArray(translationRow.highlights)) {
    for (const item of translationRow.highlights) {
      if (item && item.id) {
        locHighlightsMap.set(String(item.id), item);
      }
    }
  }

  const resolvedCoreValues = [];
  const coreValuesMeta = [];
  for (const enItem of enCoreValues) {
    const locItem = enItem.id ? locCoreValuesMap.get(String(enItem.id)) : null;

    const tRes = resolveScalar(locItem?.title, enItem.title);
    const dRes = resolveScalar(locItem?.description, enItem.description);

    resolvedCoreValues.push({
      id: enItem.id,
      title: tRes.value,
      description: dRes.value,
      icon: enItem.icon || null,
    });

    coreValuesMeta.push({
      id: enItem.id,
      title: tRes.meta,
      description: dRes.meta,
    });
  }

  const resolvedHighlights = [];
  const highlightsMeta = [];
  for (const enItem of enHighlights) {
    const locItem = enItem.id ? locHighlightsMap.get(String(enItem.id)) : null;

    const tRes = resolveScalar(locItem?.title, enItem.title);
    const dRes = resolveScalar(locItem?.description, enItem.description);

    resolvedHighlights.push({
      id: enItem.id,
      title: tRes.value,
      metric: enItem.metric || '',
      description: dRes.value || null,
    });

    highlightsMeta.push({
      id: enItem.id,
      title: tRes.meta,
      description: dRes.meta,
    });
  }

  return {
    isPublished: true,
    language: normalizedLang,
    direction: targetDir,
    content: {
      title: titleRes.value,
      subtitle: subtitleRes.value,
      introduction: introRes.value,
      story: storyRes.value,
      mission: missionRes.value,
      vision: visionRes.value,
      coreValues: resolvedCoreValues,
      highlights: resolvedHighlights,
      ctaLabel: ctaLabelRes.value,
      ctaUrl: aboutUs.publishedCtaUrl || '',
      heroImageUrl,
      heroImageAlt: heroAltRes.value,
      storyImageUrl,
      storyImageAlt: storyAltRes.value,
      publishedAt: aboutUs.publishedAt,
    },
    fieldMetadata: {
      title: titleRes.meta,
      subtitle: subtitleRes.meta,
      introduction: introRes.meta,
      story: storyRes.meta,
      mission: missionRes.meta,
      vision: visionRes.meta,
      ctaLabel: ctaLabelRes.meta,
      heroAlt: heroAltRes.meta,
      storyAlt: storyAltRes.meta,
      coreValues: coreValuesMeta,
      highlights: highlightsMeta,
    },
  };
}
