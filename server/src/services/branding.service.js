import sharp from 'sharp';
import { prisma } from '../lib/prisma.js';
import {
  buildMadrasaKey,
  uploadBufferToR2,
  getObjectBufferFromR2,
  deleteObjectFromR2,
  resolveObjectAccessUrl,
  getR2PublicUrl,
} from './r2.service.js';
import { isR2Configured } from '../config/r2.js';
import { AppError, BadRequestError, NotFoundError } from '../utils/errors.js';

// Allowed image formats decoded by Sharp
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Sanitizes original filename for FileObject storage.
 */
function sanitizeOriginalFilename(rawName) {
  if (!rawName || typeof rawName !== 'string') return 'logo.webp';
  return rawName
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

/**
 * Generates deterministic 2-letter uppercase initials for fallback.
 */
export function generateInitials(name) {
  if (!name || typeof name !== 'string') return 'MN';
  const clean = name.trim();
  if (!clean) return 'MN';

  const words = clean.split(/[\s-]+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (words[0].length >= 2) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return words[0][0].toUpperCase();
}

/**
 * Resolves current Madrasa branding information and dynamic logo URL.
 * Never persists expiring signed URLs to the database.
 *
 * @param {string} madrasaId
 * @returns {Promise<object>}
 */
export async function getMadrasaBranding(madrasaId) {
  const madrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
    select: {
      id: true,
      name: true,
      code: true,
      logoFileId: true,
    },
  });

  if (!madrasa) {
    throw new NotFoundError('Madrasa institution not found.');
  }

  let logoUrl = null;
  if (madrasa.logoFileId) {
    const fileObj = await prisma.fileObject.findFirst({
      where: {
        id: madrasa.logoFileId,
        madrasaId,
        type: 'MADRASA_LOGO',
      },
    });

    if (fileObj) {
      logoUrl = await resolveObjectAccessUrl(fileObj.objectKey);
    }
  }

  return {
    id: madrasa.id,
    name: madrasa.name,
    code: madrasa.code,
    logoUrl,
    logoFileId: madrasa.logoFileId,
    initials: generateInitials(madrasa.name),
  };
}

/**
 * Uploads, validates, optimizes, and atomically sets a new Madrasa logo.
 *
 * Security & Reliability Guarantees:
 * - Multer memory storage (size <= 5MB)
 * - Sharp decompression bomb protection (limitInputPixels, dimension check)
 * - Rejects SVG, non-images, corrupt files, and multi-page/animated files
 * - Preserves aspect ratio with max 512x512 fitting
 * - Generates WebP at quality 90
 * - Atomically commits new logo and unlinks old logo
 * - Safely cleans up previous logo only after successful commit
 * - If DB update fails, compensates by deleting the newly uploaded R2 object
 *
 * @param {string} madrasaId
 * @param {Buffer} fileBuffer
 * @param {string} originalName
 * @param {string} [userId]
 * @param {string} [ipAddress]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
export async function uploadMadrasaLogo(
  madrasaId,
  fileBuffer,
  originalName,
  userId = null,
  ipAddress = null,
  userAgent = null
) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new BadRequestError('No logo file provided. Please upload a valid image.');
  }

  if (fileBuffer.length > MAX_UPLOAD_SIZE) {
    throw new BadRequestError('Logo must be smaller than 5 MB.');
  }

  // Reject SVGs strictly before sharp decoding to prevent XML parsing/SSRF/Stored XSS
  const nameLower = (originalName || '').toLowerCase();
  const isSvgExtension = nameLower.endsWith('.svg');
  const bufferPrefix = fileBuffer.slice(0, 100).toString('utf8').toLowerCase();
  const isSvgContent = bufferPrefix.includes('<svg') || bufferPrefix.includes('<?xml');

  if (isSvgExtension || isSvgContent) {
    throw new BadRequestError('SVG images are not allowed for security reasons. Please upload a JPG, PNG or WebP image.');
  }

  // Decompression-bomb and format validation using Sharp
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

  // Double-check format after decode
  if (metadata.format === 'svg') {
    throw new BadRequestError('SVG images are not allowed for security reasons. Please upload a JPG, PNG or WebP image.');
  }

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new BadRequestError('Please upload a JPG, PNG or WebP image.');
  }

  if (metadata.pages && metadata.pages > 1) {
    throw new BadRequestError('Animated or multi-page images are not supported.');
  }

  if ((metadata.width && metadata.width > 4096) || (metadata.height && metadata.height > 4096)) {
    throw new BadRequestError('Image dimensions are too large. Maximum supported dimensions are 4096x4096.');
  }

  // Normalize image: preserve aspect ratio, fit inside 512x512, convert to high-quality WebP
  let processedBuffer;
  try {
    processedBuffer = await sharp(fileBuffer, { limitInputPixels: 16777216 })
      .resize(512, 512, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toBuffer();
  } catch (err) {
    throw new BadRequestError('Failed to process image. Please ensure it is a valid image file.');
  }

  // Generate unique R2 object key
  const uniqueId = `logo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const objectKey = buildMadrasaKey(madrasaId, 'logos', `${uniqueId}.webp`);

  // Step 1: Upload to Cloudflare R2
  try {
    await uploadBufferToR2(objectKey, processedBuffer, 'image/webp');
  } catch (storageErr) {
    console.error('[BrandingService] Storage upload failed:', storageErr.message);
    if (!isR2Configured()) {
      throw new AppError('File storage is not configured.', 500);
    }
    throw new AppError(storageErr.message || 'File storage service is unavailable.', 500);
  }

  // Step 2: Atomic DB update with compensation rollback
  let newFileRecord;
  let previousLogoFileId = null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find current madrasa to capture previous logo
      const currentMadrasa = await tx.madrasa.findUnique({
        where: { id: madrasaId },
        select: { id: true, logoFileId: true },
      });

      if (!currentMadrasa) {
        throw new NotFoundError('Madrasa institution not found.');
      }

      previousLogoFileId = currentMadrasa.logoFileId;

      // Create new FileObject record
      const fileRecord = await tx.fileObject.create({
        data: {
          madrasaId,
          type: 'MADRASA_LOGO',
          objectKey,
          originalName: sanitizeOriginalFilename(originalName),
          mimeType: 'image/webp',
          size: processedBuffer.length,
          publicUrl: getR2PublicUrl(objectKey) || null,
        },
      });

      // Update Madrasa with new logoFileId
      await tx.madrasa.update({
        where: { id: madrasaId },
        data: { logoFileId: fileRecord.id },
      });

      // Audit Log: only created upon successful commit
      await tx.activityLog.create({
        data: {
          madrasaId,
          userId: userId || null,
          action: 'MADRASA_LOGO_UPDATED',
          entityType: 'MADRASA',
          entityId: madrasaId,
          metadata: {
            fileId: fileRecord.id,
            objectKey,
            size: processedBuffer.length,
            mimeType: 'image/webp',
          },
          ipAddress: ipAddress ? String(ipAddress).slice(0, 45) : null,
          userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
        },
      });

      return fileRecord;
    });

    newFileRecord = result;
  } catch (dbError) {
    // DB failure compensation: best-effort delete the orphaned newly uploaded R2 object
    try {
      await deleteObjectFromR2(objectKey);
    } catch (cleanupErr) {
      console.warn('[BrandingService] Compensation cleanup failed for orphaned object:', objectKey, cleanupErr.message);
    }
    throw dbError;
  }

  // Step 3: Best-effort asynchronous cleanup of previously active logo
  if (previousLogoFileId && previousLogoFileId !== newFileRecord.id) {
    cleanupPreviousLogoFile(madrasaId, previousLogoFileId, newFileRecord.id).catch((err) => {
      console.warn('[BrandingService] Non-blocking cleanup of previous logo failed:', err.message);
    });
  }

  const logoUrl = await resolveObjectAccessUrl(objectKey);

  return {
    success: true,
    message: 'Institutional logo updated successfully.',
    data: {
      fileId: newFileRecord.id,
      logoUrl,
      size: processedBuffer.length,
      mimeType: 'image/webp',
    },
  };
}

/**
 * Safely cleans up an old logo file from DB and R2.
 * Verifies that the old file is NOT the currently active logo before deleting.
 */
async function cleanupPreviousLogoFile(madrasaId, oldFileId, currentActiveFileId) {
  if (!oldFileId || oldFileId === currentActiveFileId) return;

  // Re-verify current active logo in DB to protect against race conditions
  const currentMadrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
    select: { logoFileId: true },
  });

  if (currentMadrasa?.logoFileId === oldFileId) {
    // Abort: oldFileId is somehow still active (e.g. concurrent reversal)
    return;
  }

  const oldFile = await prisma.fileObject.findFirst({
    where: {
      id: oldFileId,
      madrasaId,
      type: 'MADRASA_LOGO',
    },
  });

  if (!oldFile) return;

  try {
    await prisma.fileObject.delete({ where: { id: oldFile.id } });
    await deleteObjectFromR2(oldFile.objectKey);
  } catch (err) {
    console.warn('[BrandingService] Safe old logo cleanup error:', err.message);
  }
}

/**
 * Atomically removes institutional logo and unlinks from Madrasa.
 *
 * @param {string} madrasaId
 * @param {string} [userId]
 * @param {string} [ipAddress]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
export async function removeMadrasaLogo(madrasaId, userId = null, ipAddress = null, userAgent = null) {
  let removedFileId = null;

  await prisma.$transaction(async (tx) => {
    const madrasa = await tx.madrasa.findUnique({
      where: { id: madrasaId },
      select: { id: true, logoFileId: true },
    });

    if (!madrasa) {
      throw new NotFoundError('Madrasa institution not found.');
    }

    if (!madrasa.logoFileId) {
      // Already has no logo; idempotent success
      return;
    }

    removedFileId = madrasa.logoFileId;

    // Unlink logo from Madrasa
    await tx.madrasa.update({
      where: { id: madrasaId },
      data: { logoFileId: null },
    });

    // Record ActivityLog only upon successful commit
    await tx.activityLog.create({
      data: {
        madrasaId,
        userId: userId || null,
        action: 'MADRASA_LOGO_REMOVED',
        entityType: 'MADRASA',
        entityId: madrasaId,
        metadata: { removedFileId },
        ipAddress: ipAddress ? String(ipAddress).slice(0, 45) : null,
        userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
      },
    });
  });

  // Best-effort cleanup after commit
  if (removedFileId) {
    cleanupPreviousLogoFile(madrasaId, removedFileId, null).catch((err) => {
      console.warn('[BrandingService] Non-blocking cleanup after logo removal failed:', err.message);
    });
  }

  return {
    success: true,
    message: 'Institutional logo removed successfully.',
  };
}

/**
 * Server-side base64 data URI resolution for PDF generation ONLY.
 * Never called for browser preview or CSV exports to save bandwidth and latency.
 * Non-blocking: gracefully returns null on missing logo or R2 failure.
 *
 * @param {string} madrasaId
 * @returns {Promise<string|null>} data:image/webp;base64,...
 */
export async function resolveLogoDataUri(madrasaId) {
  try {
    const madrasa = await prisma.madrasa.findUnique({
      where: { id: madrasaId },
      select: { logoFileId: true },
    });

    if (!madrasa || !madrasa.logoFileId) {
      return null;
    }

    const fileObj = await prisma.fileObject.findFirst({
      where: {
        id: madrasa.logoFileId,
        madrasaId,
        type: 'MADRASA_LOGO',
      },
    });

    if (!fileObj || !fileObj.objectKey) {
      return null;
    }

    const buffer = await getObjectBufferFromR2(fileObj.objectKey);
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      return null;
    }

    const mime = fileObj.mimeType || 'image/webp';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch (err) {
    // Non-blocking fallback: log diagnostic warning and allow PDF to continue without image
    console.warn(`[BrandingService] Could not resolve logo data URI for Madrasa ${madrasaId}:`, err.message);
    return null;
  }
}
