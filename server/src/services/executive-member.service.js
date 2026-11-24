import { prisma } from '../lib/prisma.js';
import sharp from 'sharp';
import {
  uploadBufferToR2,
  deleteObjectFromR2,
  getR2PublicUrl,
  buildMadrasaKey,
  resolveObjectAccessUrl,
} from './r2.service.js';
import { isR2Configured } from '../config/r2.js';
import { AppError, BadRequestError, NotFoundError } from '../utils/errors.js';
import { logTenantActivity } from './tenant.service.js';

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_PHOTO_FORMATS = new Set(['jpeg', 'png', 'webp']);

const sanitizeFilename = (name) => {
  if (!name || typeof name !== 'string') return 'photo';
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
};

/**
 * List executive members for a specific madrasa with optional active filter.
 */
export async function listExecutiveMembers(madrasaId, { isActive } = {}) {
  const where = { madrasaId };
  if (typeof isActive === 'boolean') {
    where.isActive = isActive;
  } else if (isActive === 'true') {
    where.isActive = true;
  } else if (isActive === 'false') {
    where.isActive = false;
  }

  const members = await prisma.executiveMember.findMany({
    where,
    orderBy: [
      { displayOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  // Dynamically resolve photo URLs if photoFileId is present
  const resolvedMembers = await Promise.all(
    members.map(async (m) => {
      let photoUrl = m.photoUrl;
      if (m.photoFileId) {
        try {
          const file = await prisma.fileObject.findFirst({
            where: { id: m.photoFileId, madrasaId },
            select: { objectKey: true, publicUrl: true },
          });
          if (file) {
            photoUrl = file.publicUrl || (await resolveObjectAccessUrl(file.objectKey));
          }
        } catch {
          // Keep existing photoUrl if resolve fails
        }
      }
      return {
        ...m,
        photoUrl,
      };
    })
  );

  return resolvedMembers;
}

/**
 * Get an executive member by ID (tenant isolated).
 */
export async function getExecutiveMemberById(madrasaId, id) {
  const member = await prisma.executiveMember.findFirst({
    where: { id, madrasaId },
  });

  if (!member) {
    throw new NotFoundError('Executive member not found.');
  }

  let photoUrl = member.photoUrl;
  if (member.photoFileId) {
    try {
      const file = await prisma.fileObject.findFirst({
        where: { id: member.photoFileId, madrasaId },
        select: { objectKey: true, publicUrl: true },
      });
      if (file) {
        photoUrl = file.publicUrl || (await resolveObjectAccessUrl(file.objectKey));
      }
    } catch {
      // Keep existing photoUrl
    }
  }

  return {
    ...member,
    photoUrl,
  };
}

/**
 * Create a new executive member.
 */
export async function createExecutiveMember(madrasaId, data, userId = null, ipAddress = null, userAgent = null) {
  const fullName = typeof data.fullName === 'string' ? data.fullName.trim() : '';
  const position = typeof data.position === 'string' ? data.position.trim() : '';

  if (!fullName) {
    throw new BadRequestError('Full name is required.');
  }
  if (!position) {
    throw new BadRequestError('Position/Title is required.');
  }

  let displayOrder = 0;
  if (data.displayOrder !== undefined && data.displayOrder !== null && data.displayOrder !== '') {
    const parsedOrder = parseInt(data.displayOrder, 10);
    if (!isNaN(parsedOrder)) {
      displayOrder = parsedOrder;
    }
  }

  const newMember = await prisma.executiveMember.create({
    data: {
      madrasaId,
      fullName: fullName.slice(0, 200),
      position: position.slice(0, 100),
      displayOrder,
      photoUrl: data.photoUrl ? String(data.photoUrl).trim() : null,
      photoFileId: data.photoFileId ? String(data.photoFileId).trim() : null,
      qualification: data.qualification ? String(data.qualification).trim().slice(0, 200) : null,
      messageOrBio: data.messageOrBio ? String(data.messageOrBio).trim() : null,
      termPeriod: data.termPeriod ? String(data.termPeriod).trim().slice(0, 100) : null,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    },
  });

  if (userId) {
    try {
      await logTenantActivity({
        madrasaId,
        userId,
        action: 'EXECUTIVE_MEMBER_CREATED',
        details: `Executive member created: ${newMember.fullName} (${newMember.position})`,
        ipAddress,
        userAgent,
      });
    } catch {
      // Non-blocking log
    }
  }

  return newMember;
}

/**
 * Update an existing executive member.
 */
export async function updateExecutiveMember(madrasaId, id, data, userId = null, ipAddress = null, userAgent = null) {
  const existing = await prisma.executiveMember.findFirst({
    where: { id, madrasaId },
  });

  if (!existing) {
    throw new NotFoundError('Executive member not found.');
  }

  const updateData = {};

  if (data.fullName !== undefined) {
    const fullName = String(data.fullName).trim();
    if (!fullName) {
      throw new BadRequestError('Full name cannot be empty.');
    }
    updateData.fullName = fullName.slice(0, 200);
  }

  if (data.position !== undefined) {
    const position = String(data.position).trim();
    if (!position) {
      throw new BadRequestError('Position cannot be empty.');
    }
    updateData.position = position.slice(0, 100);
  }

  if (data.displayOrder !== undefined && data.displayOrder !== null && data.displayOrder !== '') {
    const parsedOrder = parseInt(data.displayOrder, 10);
    if (!isNaN(parsedOrder)) {
      updateData.displayOrder = parsedOrder;
    }
  }

  if (data.qualification !== undefined) {
    updateData.qualification = data.qualification ? String(data.qualification).trim().slice(0, 200) : null;
  }

  if (data.messageOrBio !== undefined) {
    updateData.messageOrBio = data.messageOrBio ? String(data.messageOrBio).trim() : null;
  }

  if (data.termPeriod !== undefined) {
    updateData.termPeriod = data.termPeriod ? String(data.termPeriod).trim().slice(0, 100) : null;
  }

  if (data.photoUrl !== undefined) {
    updateData.photoUrl = data.photoUrl ? String(data.photoUrl).trim() : null;
  }

  if (data.photoFileId !== undefined) {
    updateData.photoFileId = data.photoFileId ? String(data.photoFileId).trim() : null;
  }

  if (data.isActive !== undefined) {
    updateData.isActive = Boolean(data.isActive);
  }

  const updated = await prisma.executiveMember.update({
    where: { id },
    data: updateData,
  });

  if (userId) {
    try {
      await logTenantActivity({
        madrasaId,
        userId,
        action: 'EXECUTIVE_MEMBER_UPDATED',
        details: `Executive member updated: ${updated.fullName}`,
        ipAddress,
        userAgent,
      });
    } catch {
      // Non-blocking log
    }
  }

  return updated;
}

/**
 * Delete an executive member.
 */
export async function deleteExecutiveMember(madrasaId, id, userId = null, ipAddress = null, userAgent = null) {
  const existing = await prisma.executiveMember.findFirst({
    where: { id, madrasaId },
  });

  if (!existing) {
    throw new NotFoundError('Executive member not found.');
  }

  await prisma.executiveMember.delete({
    where: { id },
  });

  if (userId) {
    try {
      await logTenantActivity({
        madrasaId,
        userId,
        action: 'EXECUTIVE_MEMBER_DELETED',
        details: `Executive member deleted: ${existing.fullName} (${existing.position})`,
        ipAddress,
        userAgent,
      });
    } catch {
      // Non-blocking log
    }
  }

  return { success: true, message: 'Executive member deleted successfully.' };
}

/**
 * Upload an executive portrait photo.
 */
export async function uploadExecutivePhoto(
  madrasaId,
  fileBuffer,
  originalName,
  userId = null,
  ipAddress = null,
  userAgent = null
) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new BadRequestError('No image file provided. Please upload a valid image.');
  }

  if (fileBuffer.length > MAX_PHOTO_SIZE) {
    throw new BadRequestError('Photo image must be smaller than 5 MB.');
  }

  const nameLower = (originalName || '').toLowerCase();
  const isSvg = nameLower.endsWith('.svg');
  const bufferPrefix = fileBuffer.slice(0, 100).toString('utf8').toLowerCase();
  if (isSvg || bufferPrefix.includes('<svg') || bufferPrefix.includes('<?xml')) {
    throw new BadRequestError('SVG images are not allowed for security reasons. Please upload a JPG, PNG or WebP image.');
  }

  let metadata;
  try {
    const probe = sharp(fileBuffer, { limitInputPixels: 67108864, failOnError: true });
    metadata = await probe.metadata();
  } catch {
    throw new BadRequestError('Corrupted or invalid image file. Please upload a valid JPG, PNG, or WebP image.');
  }

  if (!metadata.format || !ALLOWED_PHOTO_FORMATS.has(metadata.format)) {
    throw new BadRequestError('Please upload a JPG, PNG or WebP image.');
  }

  if (metadata.pages && metadata.pages > 1) {
    throw new BadRequestError('Animated or multi-page images are not supported.');
  }

  // Optimize portrait photo: max 1200x1200, WebP quality 92
  let processedBuffer;
  try {
    processedBuffer = await sharp(fileBuffer, { limitInputPixels: 67108864 })
      .rotate()
      .resize(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
      .webp({ quality: 92 })
      .toBuffer();
  } catch {
    throw new BadRequestError('Failed to process image. Please ensure it is a valid image file.');
  }

  const uniqueId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const objectKey = buildMadrasaKey(madrasaId, 'executive', `${uniqueId}.webp`);

  try {
    await uploadBufferToR2(objectKey, processedBuffer, 'image/webp');
  } catch (storageErr) {
    if (!isR2Configured()) {
      throw new AppError('File storage is not configured.', 500);
    }
    throw new AppError(storageErr.message || 'File storage service is unavailable.', 500);
  }

  let fileRecord;
  try {
    fileRecord = await prisma.fileObject.create({
      data: {
        madrasaId,
        type: 'OTHER',
        objectKey,
        originalName: sanitizeFilename(originalName),
        mimeType: 'image/webp',
        size: processedBuffer.length,
        publicUrl: getR2PublicUrl(objectKey) || null,
      },
    });

    if (userId) {
      try {
        await logTenantActivity({
          madrasaId,
          userId,
          action: 'EXECUTIVE_PHOTO_UPLOADED',
          details: `Executive photo uploaded (${fileRecord.id}).`,
          ipAddress,
          userAgent,
        });
      } catch {
        // Non-blocking log
      }
    }
  } catch (dbError) {
    try {
      await deleteObjectFromR2(objectKey);
    } catch {
      // Ignored
    }
    throw new AppError('Failed to save file metadata record.', 500);
  }

  const accessUrl = fileRecord.publicUrl || (await resolveObjectAccessUrl(objectKey));

  return {
    success: true,
    fileId: fileRecord.id,
    url: accessUrl,
  };
}
