import crypto from 'crypto';
import sharp from 'sharp';
import prisma from '../lib/prisma.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';
import {
  uploadBufferToR2,
  resolveObjectAccessUrl,
  getR2PublicUrl,
} from './r2.service.js';
import { isR2Configured } from '../config/r2.js';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp']);

function sanitizeOriginalFilename(rawName, defaultName = 'announcement.webp') {
  if (!rawName || typeof rawName !== 'string') return defaultName;
  const clean = rawName
    .replace(/[\/\\]+/g, '')
    .replace(/\.\.+/g, '.')
    .replace(/[^\w\.\-\s]/g, '')
    .trim();
  return clean || defaultName;
}

async function processAnnouncementImage(fileBuffer, originalName, { maxWidth = 2560, maxHeight = 1600 } = {}) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new BadRequestError('No image file provided.');
  }

  if (fileBuffer.length > MAX_IMAGE_SIZE) {
    throw new BadRequestError('Image must be smaller than 5 MB.');
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
        kernel: sharp.kernel.lanczos3,
      })
      .webp({ quality: 90 })
      .toBuffer();

    return processedBuffer;
  } catch (err) {
    throw new BadRequestError('Failed to process image file.');
  }
}

/**
 * ==========================================
 * SUPER ADMIN ANNOUNCEMENT SERVICE
 * ==========================================
 */

export async function uploadAnnouncementImage(file, userId, ipAddress, userAgent) {
  if (!file || !file.buffer) {
    throw new BadRequestError('No image file provided.');
  }

  const originalName = file.originalname || 'announcement.webp';
  const processedBuffer = await processAnnouncementImage(file.buffer, originalName);

  const uniqueId = `ann_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
  const objectKey = `platform/announcements/${uniqueId}.webp`;

  let publicUrl = null;
  if (isR2Configured()) {
    try {
      await uploadBufferToR2(objectKey, processedBuffer, 'image/webp');
      publicUrl = getR2PublicUrl(objectKey);
    } catch (err) {
      console.warn('[AnnouncementService] Failed to upload to R2, continuing with fallback:', err.message);
    }
  }

  let fileRecord = null;
  try {
    fileRecord = await prisma.fileObject.create({
      data: {
        madrasaId: null, // Platform announcement file
        type: 'OTHER',
        objectKey,
        originalName: sanitizeOriginalFilename(originalName, 'announcement.webp'),
        mimeType: 'image/webp',
        size: processedBuffer.length,
        publicUrl,
      },
    });
  } catch (err) {
    console.warn('[AnnouncementService] FileObject record creation error:', err.message);
  }

  const finalUrl =
    publicUrl ||
    (fileRecord?.objectKey ? await resolveObjectAccessUrl(fileRecord.objectKey) : null) ||
    `data:image/webp;base64,${processedBuffer.toString('base64')}`;

  return {
    fileId: fileRecord?.id || uniqueId,
    url: finalUrl,
    originalName: sanitizeOriginalFilename(originalName, 'announcement.webp'),
  };
}

export async function createAnnouncement(data, userId, ipAddress, userAgent) {
  let uniqueTargetIds = [];
  if (data.audience === 'SELECTED_MADRASAS') {
    if (!data.selectedMadrasaIds || data.selectedMadrasaIds.length === 0) {
      throw new BadRequestError('At least one Madrasa must be selected for targeted announcements.');
    }
    uniqueTargetIds = [...new Set(data.selectedMadrasaIds)];
    const existingCount = await prisma.madrasa.count({
      where: { id: { in: uniqueTargetIds } },
    });
    if (existingCount !== uniqueTargetIds.length) {
      throw new BadRequestError('One or more selected Madrasa IDs do not exist.');
    }
  }

  const publishAtDate = data.publishAt ? new Date(data.publishAt) : null;
  const expiresAtDate = data.expiresAt ? new Date(data.expiresAt) : null;

  if (publishAtDate && expiresAtDate && expiresAtDate <= publishAtDate) {
    throw new BadRequestError('Expiry date/time must be strictly after publish date/time.');
  }

  // Tenant Isolation: verify image file ownership if linked
  if (data.imageFileId) {
    const fileObj = await prisma.fileObject.findUnique({
      where: { id: data.imageFileId },
    });
    if (fileObj && fileObj.madrasaId) {
      if (data.audience === 'ALL_MADRASAS' || !uniqueTargetIds.includes(fileObj.madrasaId)) {
        throw new BadRequestError('Referenced image does not belong to the targeted madrasa.');
      }
    }
  }

  // MANDATORY CORRECTION 1: POST create MUST ALWAYS create/save DRAFT.
  const announcement = await prisma.$transaction(async (tx) => {
    const record = await tx.announcement.create({
      data: {
        title: data.title,
        message: data.message,
        imageUrl: data.imageUrl || null,
        imageFileId: data.imageFileId || null,
        category: data.category || 'GENERAL',
        priority: data.priority || 'NORMAL',
        audience: data.audience || 'ALL_MADRASAS',
        status: 'DRAFT',
        publishAt: publishAtDate,
        expiresAt: expiresAtDate,
        publishedAt: null,
        createdById: userId,
        targets:
          data.audience === 'SELECTED_MADRASAS' && uniqueTargetIds.length > 0
            ? {
                create: uniqueTargetIds.map((madrasaId) => ({ madrasaId })),
              }
            : undefined,
      },
      include: {
        targets: {
          include: {
            madrasa: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await tx.activityLog.create({
      data: {
        action: 'ANNOUNCEMENT_CREATED',
        entityType: 'Announcement',
        entityId: record.id,
        userId,
        madrasaId: null,
        metadata: {
          title: record.title,
          audience: record.audience,
          status: record.status,
          targetCount: uniqueTargetIds.length,
        },
        ipAddress,
        userAgent,
      },
    });

    return record;
  });

  return formatAnnouncementResponse(announcement, 0);
}

export async function updateAnnouncement(id, patch, userId, ipAddress, userAgent) {
  const existing = await prisma.announcement.findUnique({
    where: { id },
    include: {
      targets: true,
    },
  });

  if (!existing) {
    throw new NotFoundError('Announcement not found.');
  }

  // MANDATORY CORRECTION 7: Archived announcements are non-editable
  if (existing.status === 'ARCHIVED') {
    throw new ConflictError('Cannot edit an archived announcement.');
  }

  // MANDATORY CORRECTION 3: Validate EFFECTIVE merged state
  const effectiveTitle = patch.title !== undefined ? patch.title : existing.title;
  const effectiveMessage = patch.message !== undefined ? patch.message : existing.message;
  const effectiveCategory = patch.category !== undefined ? patch.category : existing.category;
  const effectivePriority = patch.priority !== undefined ? patch.priority : existing.priority;
  const effectiveAudience = patch.audience !== undefined ? patch.audience : existing.audience;

  const effectivePublishAt =
    patch.publishAt !== undefined
      ? patch.publishAt
        ? new Date(patch.publishAt)
        : null
      : existing.publishAt;

  const effectiveExpiresAt =
    patch.expiresAt !== undefined
      ? patch.expiresAt
        ? new Date(patch.expiresAt)
        : null
      : existing.expiresAt;

  if (effectivePublishAt && effectiveExpiresAt && effectiveExpiresAt <= effectivePublishAt) {
    throw new BadRequestError('Expiry date/time must be strictly after publish date/time.');
  }

  let uniqueTargetIds = [];
  if (effectiveAudience === 'SELECTED_MADRASAS') {
    const rawTargetIds =
      patch.selectedMadrasaIds !== undefined
        ? patch.selectedMadrasaIds
        : existing.targets.map((t) => t.madrasaId);

    if (!rawTargetIds || rawTargetIds.length === 0) {
      throw new BadRequestError('At least one Madrasa must be selected for targeted announcements.');
    }

    uniqueTargetIds = [...new Set(rawTargetIds)];
    const existingCount = await prisma.madrasa.count({
      where: { id: { in: uniqueTargetIds } },
    });
    if (existingCount !== uniqueTargetIds.length) {
      throw new BadRequestError('One or more selected Madrasa IDs do not exist.');
    }
  }

  // Tenant Isolation: verify image file ownership if linked
  if (patch.imageFileId) {
    const fileObj = await prisma.fileObject.findUnique({
      where: { id: patch.imageFileId },
    });
    if (fileObj && fileObj.madrasaId) {
      if (effectiveAudience === 'ALL_MADRASAS' || !uniqueTargetIds.includes(fileObj.madrasaId)) {
        throw new BadRequestError('Referenced image does not belong to the targeted madrasa.');
      }
    }
  }

  // Atomic update with target replacement & ActivityLog
  const updated = await prisma.$transaction(async (tx) => {
    if (effectiveAudience === 'ALL_MADRASAS') {
      // Clean up any existing targets when switching to ALL_MADRASAS
      await tx.announcementMadrasa.deleteMany({
        where: { announcementId: id },
      });
    } else if (patch.selectedMadrasaIds !== undefined || existing.audience !== 'SELECTED_MADRASAS') {
      // Replace targets for SELECTED_MADRASAS
      await tx.announcementMadrasa.deleteMany({
        where: { announcementId: id },
      });
      await tx.announcementMadrasa.createMany({
        data: uniqueTargetIds.map((madrasaId) => ({
          announcementId: id,
          madrasaId,
        })),
      });
    }

    const record = await tx.announcement.update({
      where: { id },
      data: {
        title: effectiveTitle,
        message: effectiveMessage,
        imageUrl: patch.imageUrl !== undefined ? (patch.imageUrl || null) : undefined,
        imageFileId: patch.imageFileId !== undefined ? (patch.imageFileId || null) : undefined,
        category: effectiveCategory,
        priority: effectivePriority,
        audience: effectiveAudience,
        publishAt: effectivePublishAt,
        expiresAt: effectiveExpiresAt,
      },
      include: {
        targets: {
          include: {
            madrasa: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { reads: true },
        },
      },
    });

    await tx.activityLog.create({
      data: {
        action: 'ANNOUNCEMENT_UPDATED',
        entityType: 'Announcement',
        entityId: id,
        userId,
        madrasaId: null,
        metadata: {
          title: record.title,
          audience: record.audience,
          status: record.status,
          targetCount: effectiveAudience === 'SELECTED_MADRASAS' ? uniqueTargetIds.length : null,
        },
        ipAddress,
        userAgent,
      },
    });

    return record;
  });

  return formatAnnouncementResponse(updated, updated._count?.reads ?? 0);
}

export async function publishAnnouncement(id, publishData, userId, ipAddress, userAgent) {
  const existing = await prisma.announcement.findUnique({
    where: { id },
    include: { targets: true },
  });

  if (!existing) {
    throw new NotFoundError('Announcement not found.');
  }

  // MANDATORY CORRECTION 7: Archived cannot be published
  if (existing.status === 'ARCHIVED') {
    throw new ConflictError('Cannot publish an archived announcement.');
  }

  // Scheduling and expiry resolution
  const now = new Date();
  const effectivePublishAt =
    publishData.publishAt !== undefined
      ? publishData.publishAt
        ? new Date(publishData.publishAt)
        : null
      : existing.publishAt;

  const effectiveExpiresAt =
    publishData.expiresAt !== undefined
      ? publishData.expiresAt
        ? new Date(publishData.expiresAt)
        : null
      : existing.expiresAt;

  if (effectivePublishAt && effectiveExpiresAt && effectiveExpiresAt <= effectivePublishAt) {
    throw new BadRequestError('Expiry date/time must be strictly after publish date/time.');
  }

  if (effectiveExpiresAt && effectiveExpiresAt <= now) {
    throw new BadRequestError('Expiry date/time must be in the future.');
  }

  if (existing.audience === 'SELECTED_MADRASAS' && existing.targets.length === 0) {
    throw new BadRequestError('Cannot publish targeted announcement without selected Madrasas.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.announcement.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: now,
        publishAt: effectivePublishAt,
        expiresAt: effectiveExpiresAt,
      },
      include: {
        targets: {
          include: {
            madrasa: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { reads: true },
        },
      },
    });

    await tx.activityLog.create({
      data: {
        action: 'ANNOUNCEMENT_PUBLISHED',
        entityType: 'Announcement',
        entityId: id,
        userId,
        madrasaId: null,
        metadata: {
          title: record.title,
          publishAt: record.publishAt,
          expiresAt: record.expiresAt,
          status: record.status,
        },
        ipAddress,
        userAgent,
      },
    });

    return record;
  });

  return formatAnnouncementResponse(updated, updated._count?.reads ?? 0);
}

export async function archiveAnnouncement(id, userId, ipAddress, userAgent) {
  const existing = await prisma.announcement.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Announcement not found.');
  }

  if (existing.status === 'ARCHIVED') {
    throw new ConflictError('Announcement is already archived.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.announcement.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
      },
      include: {
        targets: {
          include: {
            madrasa: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { reads: true },
        },
      },
    });

    await tx.activityLog.create({
      data: {
        action: 'ANNOUNCEMENT_ARCHIVED',
        entityType: 'Announcement',
        entityId: id,
        userId,
        madrasaId: null,
        metadata: {
          title: record.title,
          status: record.status,
        },
        ipAddress,
        userAgent,
      },
    });

    return record;
  });

  return formatAnnouncementResponse(updated, updated._count?.reads ?? 0);
}

export async function unpublishAnnouncement(id, userId, ipAddress, userAgent) {
  const existing = await prisma.announcement.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Announcement not found.');
  }

  if (existing.status === 'ARCHIVED') {
    throw new ConflictError('Cannot unpublish an archived announcement.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.announcement.update({
      where: { id },
      data: {
        status: 'DRAFT',
      },
      include: {
        targets: {
          include: {
            madrasa: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { reads: true },
        },
      },
    });

    await tx.activityLog.create({
      data: {
        action: 'ANNOUNCEMENT_UNPUBLISHED',
        entityType: 'Announcement',
        entityId: id,
        userId,
        madrasaId: null,
        metadata: {
          title: record.title,
          status: record.status,
        },
        ipAddress,
        userAgent,
      },
    });

    return record;
  });

  return formatAnnouncementResponse(updated, updated._count?.reads ?? 0);
}

export async function listSuperAdminAnnouncements(query) {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const skip = (page - 1) * limit;

  const where = {};

  if (query.status && query.status !== 'ALL') {
    where.status = query.status;
  }
  if (query.category) {
    where.category = query.category;
  }
  if (query.priority) {
    where.priority = query.priority;
  }
  if (query.audience) {
    where.audience = query.audience;
  }
  if (query.search) {
    where.OR = [
      { title: { contains: query.search } },
      { message: { contains: query.search } },
    ];
  }

  const [totalCount, publishedCount, draftCount, archivedCount, totalFiltered, records, totalActiveMadrasas] =
    await Promise.all([
      prisma.announcement.count(),
      prisma.announcement.count({ where: { status: 'PUBLISHED' } }),
      prisma.announcement.count({ where: { status: 'DRAFT' } }),
      prisma.announcement.count({ where: { status: 'ARCHIVED' } }),
      prisma.announcement.count({ where }),
      prisma.announcement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          targets: {
            include: {
              madrasa: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { reads: true },
          },
        },
      }),
      prisma.madrasa.count({ where: { status: 'ACTIVE' } }),
    ]);

  const announcements = records.map((record) =>
    formatAnnouncementResponse(record, record._count?.reads ?? 0, totalActiveMadrasas)
  );

  return {
    announcements,
    counts: {
      total: totalCount,
      published: publishedCount,
      draft: draftCount,
      archived: archivedCount,
    },
    pagination: {
      page,
      limit,
      total: totalFiltered,
      totalPages: Math.ceil(totalFiltered / limit) || 1,
    },
  };
}

export async function getSuperAdminAnnouncementById(id) {
  const record = await prisma.announcement.findUnique({
    where: { id },
    include: {
      targets: {
        include: {
          madrasa: {
            select: { id: true, name: true, code: true, status: true },
          },
        },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      reads: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              madrasa: {
                select: { id: true, name: true, code: true },
              },
            },
          },
        },
        orderBy: { readAt: 'desc' },
      },
    },
  });

  if (!record) {
    throw new NotFoundError('Announcement not found.');
  }

  const totalActiveMadrasas = await prisma.madrasa.count({ where: { status: 'ACTIVE' } });

  return {
    ...formatAnnouncementResponse(record, record.reads.length, totalActiveMadrasas),
    reads: record.reads.map((r) => ({
      userId: r.userId,
      userName: r.user?.name,
      userEmail: r.user?.email,
      madrasaName: r.user?.madrasa?.name,
      madrasaCode: r.user?.madrasa?.code,
      readAt: r.readAt,
    })),
  };
}

/**
 * ==========================================
 * MADRASA ADMIN ANNOUNCEMENT SERVICE
 * ==========================================
 */

/**
 * Builds request-time UTC visibility filter for a given tenant Madrasa ID
 */
function buildMadrasaVisibilityWhere(madrasaId) {
  const now = new Date();

  return {
    status: 'PUBLISHED',
    OR: [
      { publishAt: null },
      { publishAt: { lte: now } },
    ],
    AND: [
      {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      {
        OR: [
          { audience: 'ALL_MADRASAS' },
          {
            audience: 'SELECTED_MADRASAS',
            targets: {
              some: { madrasaId },
            },
          },
        ],
      },
    ],
  };
}

export async function listMadrasaAnnouncements(madrasaId, userId, query) {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const skip = (page - 1) * limit;

  const baseWhere = buildMadrasaVisibilityWhere(madrasaId);

  const andConditions = [...(baseWhere.AND || [])];

  if (query.category) {
    andConditions.push({ category: query.category });
  }
  if (query.priority) {
    andConditions.push({ priority: query.priority });
  }
  if (query.search) {
    andConditions.push({
      OR: [
        { title: { contains: query.search } },
        { message: { contains: query.search } },
      ],
    });
  }

  // MANDATORY CORRECTION 5: readStatus filter
  if (query.readStatus === 'READ') {
    andConditions.push({
      reads: {
        some: { userId },
      },
    });
  } else if (query.readStatus === 'UNREAD') {
    andConditions.push({
      reads: {
        none: { userId },
      },
    });
  }

  const finalWhere = {
    ...baseWhere,
    AND: andConditions,
  };

  const [total, records, unreadCount] = await Promise.all([
    prisma.announcement.count({ where: finalWhere }),
    prisma.announcement.findMany({
      where: finalWhere,
      skip,
      take: limit,
      orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        message: true,
        imageUrl: true,
        imageFileId: true,
        category: true,
        priority: true,
        audience: true,
        publishAt: true,
        expiresAt: true,
        publishedAt: true,
        createdAt: true,
        reads: {
          where: { userId },
          select: { readAt: true },
        },
      },
    }),
    getMadrasaUnreadCount(madrasaId, userId),
  ]);

  const announcements = records.map((item) => {
    const isRead = item.reads.length > 0;
    const readAt = isRead ? item.reads[0].readAt : null;
    return {
      id: item.id,
      title: item.title,
      message: item.message,
      imageUrl: item.imageUrl || null,
      imageFileId: item.imageFileId || null,
      category: item.category,
      priority: item.priority,
      audience: item.audience,
      publishAt: item.publishAt,
      expiresAt: item.expiresAt,
      publishedAt: item.publishedAt,
      createdAt: item.createdAt,
      isRead,
      readAt,
    };
  });

  return {
    announcements,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getMadrasaAnnouncementById(id, madrasaId, userId) {
  const baseWhere = buildMadrasaVisibilityWhere(madrasaId);

  const record = await prisma.announcement.findFirst({
    where: {
      id,
      ...baseWhere,
    },
    select: {
      id: true,
      title: true,
      message: true,
      imageUrl: true,
      imageFileId: true,
      category: true,
      priority: true,
      audience: true,
      publishAt: true,
      expiresAt: true,
      publishedAt: true,
      createdAt: true,
      reads: {
        where: { userId },
        select: { readAt: true },
      },
    },
  });

  if (!record) {
    throw new NotFoundError('Announcement not found.');
  }

  const isRead = record.reads.length > 0;
  const readAt = isRead ? record.reads[0].readAt : null;

  return {
    id: record.id,
    title: record.title,
    message: record.message,
    imageUrl: record.imageUrl || null,
    imageFileId: record.imageFileId || null,
    category: record.category,
    priority: record.priority,
    audience: record.audience,
    publishAt: record.publishAt,
    expiresAt: record.expiresAt,
    publishedAt: record.publishedAt,
    createdAt: record.createdAt,
    isRead,
    readAt,
  };
}

export async function markAnnouncementAsRead(id, madrasaId, userId) {
  const baseWhere = buildMadrasaVisibilityWhere(madrasaId);

  const record = await prisma.announcement.findFirst({
    where: {
      id,
      ...baseWhere,
    },
    select: { id: true },
  });

  if (!record) {
    throw new NotFoundError('Announcement not found.');
  }

  // Idempotent upsert
  const read = await prisma.announcementRead.upsert({
    where: {
      announcementId_userId: {
        announcementId: id,
        userId,
      },
    },
    create: {
      announcementId: id,
      userId,
      readAt: new Date(),
    },
    update: {},
  });

  return {
    readAt: read.readAt,
  };
}

export async function markAllAnnouncementsAsRead(madrasaId, userId) {
  const baseWhere = buildMadrasaVisibilityWhere(madrasaId);

  // Find all announcements currently visible to this tenant that are unread by this user
  const unreadRecords = await prisma.announcement.findMany({
    where: {
      ...baseWhere,
      reads: {
        none: { userId },
      },
    },
    select: { id: true },
  });

  if (unreadRecords.length === 0) {
    return { markedCount: 0 };
  }

  const now = new Date();
  await prisma.announcementRead.createMany({
    data: unreadRecords.map((r) => ({
      announcementId: r.id,
      userId,
      readAt: now,
    })),
    skipDuplicates: true,
  });

  return {
    markedCount: unreadRecords.length,
  };
}

export async function getMadrasaUnreadCount(madrasaId, userId) {
  const baseWhere = buildMadrasaVisibilityWhere(madrasaId);

  const count = await prisma.announcement.count({
    where: {
      ...baseWhere,
      reads: {
        none: { userId },
      },
    },
  });

  return count;
}

export async function getMadrasaLatestAnnouncements(madrasaId, userId, limit = 5) {
  const baseWhere = buildMadrasaVisibilityWhere(madrasaId);

  const records = await prisma.announcement.findMany({
    where: baseWhere,
    take: limit,
    orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      message: true,
      imageUrl: true,
      imageFileId: true,
      category: true,
      priority: true,
      publishAt: true,
      expiresAt: true,
      publishedAt: true,
      createdAt: true,
      reads: {
        where: { userId },
        select: { readAt: true },
      },
    },
  });

  return records.map((item) => ({
    id: item.id,
    title: item.title,
    message: item.message,
    imageUrl: item.imageUrl || null,
    imageFileId: item.imageFileId || null,
    category: item.category,
    priority: item.priority,
    publishAt: item.publishAt,
    expiresAt: item.expiresAt,
    publishedAt: item.publishedAt,
    createdAt: item.createdAt,
    isRead: item.reads.length > 0,
    readAt: item.reads[0]?.readAt || null,
  }));
}

/**
 * Helpers
 */
function formatAnnouncementResponse(record, readCount = 0, totalActiveMadrasas = 0) {
  const now = new Date();
  const isScheduled =
    record.status === 'PUBLISHED' && record.publishAt && new Date(record.publishAt) > now;
  const isExpired =
    record.expiresAt && new Date(record.expiresAt) <= now;

  const targetMadrasaCount =
    record.audience === 'ALL_MADRASAS'
      ? totalActiveMadrasas
      : (record.targets?.length ?? 0);

  return {
    id: record.id,
    title: record.title,
    message: record.message,
    imageUrl: record.imageUrl || null,
    imageFileId: record.imageFileId || null,
    category: record.category,
    priority: record.priority,
    audience: record.audience,
    status: record.status,
    publishAt: record.publishAt,
    expiresAt: record.expiresAt,
    publishedAt: record.publishedAt,
    createdById: record.createdById,
    createdByName: record.createdBy?.name || null,
    createdByEmail: record.createdBy?.email || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    isScheduled: Boolean(isScheduled),
    isExpired: Boolean(isExpired),
    // MANDATORY CORRECTION 8: Report targetMadrasaCount and readCount separately.
    targetMadrasaCount,
    readCount,
    targets: record.targets
      ? record.targets.map((t) => ({
          madrasaId: t.madrasaId,
          name: t.madrasa?.name,
          code: t.madrasa?.code,
        }))
      : [],
  };
}
