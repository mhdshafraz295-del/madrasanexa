import { prisma } from '../lib/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logTenantActivity } from './tenant.service.js';

/**
 * Creates a new Staff Notice broadcasted by Madrasa Admin to teachers.
 */
export async function createStaffNotice({ madrasaId, userId, payload }) {
  const {
    title,
    message,
    priority = 'NORMAL',
    category = 'GENERAL',
    targetType = 'ALL_TEACHERS',
    targetClassId,
    targetUstadhIds,
  } = payload;

  if (!title || !title.trim()) {
    throw new BadRequestError('Notice title is required.');
  }
  if (!message || !message.trim()) {
    throw new BadRequestError('Notice message is required.');
  }

  // Verify class belongs to tenant if targetType is CLASS
  if (targetType === 'CLASS') {
    if (!targetClassId) {
      throw new BadRequestError('Target class is required when audience is set to Class.');
    }
    const classExists = await prisma.class.findFirst({
      where: { id: targetClassId, madrasaId },
    });
    if (!classExists) {
      throw new BadRequestError('Selected class does not exist in this institution.');
    }
  }

  // Verify ustadhs belong to tenant if targetType is SPECIFIC_USTADHS
  let cleanTargetUstadhIds = null;
  if (targetType === 'SPECIFIC_USTADHS') {
    if (!Array.isArray(targetUstadhIds) || targetUstadhIds.length === 0) {
      throw new BadRequestError('At least one teacher must be selected for specific targeting.');
    }
    const existingUstadhs = await prisma.ustadh.findMany({
      where: {
        madrasaId,
        id: { in: targetUstadhIds },
        isActive: true,
      },
      select: { id: true },
    });
    cleanTargetUstadhIds = existingUstadhs.map((u) => u.id);
    if (cleanTargetUstadhIds.length === 0) {
      throw new BadRequestError('None of the selected teachers are currently active in this institution.');
    }
  }

  const notice = await prisma.staffNotice.create({
    data: {
      madrasaId,
      createdByUserId: userId,
      title: title.trim(),
      message: message.trim(),
      priority,
      category,
      targetType,
      targetClassId: targetType === 'CLASS' ? targetClassId : null,
      targetUstadhIds: cleanTargetUstadhIds,
    },
    include: {
      createdByUser: {
        select: { id: true, name: true, email: true },
      },
      targetClass: {
        select: { id: true, name: true, code: true },
      },
      reads: true,
    },
  });

  try {
    await logTenantActivity({
      madrasaId,
      userId,
      action: 'STAFF_NOTICE_CREATED',
      entityType: 'StaffNotice',
      entityId: notice.id,
      details: {
        title: notice.title,
        priority: notice.priority,
        targetType: notice.targetType,
      },
    });
  } catch (_) {}

  return notice;
}

/**
 * Retrieves all Staff Notices with comprehensive read receipt analytics for Madrasa Admin.
 */
export async function getAdminStaffNotices({ madrasaId, query = {} }) {
  const { search, priority, category } = query;

  // 1. Fetch active teachers and schedules in this tenant for accurate audience resolution
  const [activeStaff, classSchedules, rawNotices] = await Promise.all([
    prisma.ustadh.findMany({
      where: { madrasaId, isActive: true },
      select: { id: true, ustadhCode: true, fullName: true, staffType: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.ustadhSchedule.findMany({
      where: { madrasaId, isActive: true },
      select: { classId: true, ustadhId: true },
    }),
    prisma.staffNotice.findMany({
      where: {
        madrasaId,
        ...(priority ? { priority } : {}),
        ...(category ? { category } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search } },
                { message: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        createdByUser: {
          select: { id: true, name: true, email: true },
        },
        targetClass: {
          select: { id: true, name: true, code: true },
        },
        reads: {
          include: {
            ustadh: {
              select: { id: true, fullName: true, ustadhCode: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const activeStaffMap = new Map(activeStaff.map((u) => [u.id, u]));

  // Build mapping of classId -> Set of ustadhIds
  const classUstadhMap = new Map();
  for (const s of classSchedules) {
    if (!classUstadhMap.has(s.classId)) {
      classUstadhMap.set(s.classId, new Set());
    }
    classUstadhMap.get(s.classId).add(s.ustadhId);
  }

  // 2. Compute per-notice read metrics
  let totalReadPercentages = 0;
  const noticesWithStats = rawNotices.map((notice) => {
    let eligibleStaff = [];

    if (notice.targetType === 'ALL_TEACHERS') {
      eligibleStaff = activeStaff;
    } else if (notice.targetType === 'CLASS' && notice.targetClassId) {
      const ustadhIdSet = classUstadhMap.get(notice.targetClassId) || new Set();
      eligibleStaff = activeStaff.filter((u) => ustadhIdSet.has(u.id));
      // Fallback if no specific schedules are mapped yet: include all active staff to avoid 0 recipients
      if (eligibleStaff.length === 0) {
        eligibleStaff = activeStaff;
      }
    } else if (notice.targetType === 'SPECIFIC_USTADHS' && Array.isArray(notice.targetUstadhIds)) {
      const idSet = new Set(notice.targetUstadhIds);
      eligibleStaff = activeStaff.filter((u) => idSet.has(u.id));
    } else {
      eligibleStaff = activeStaff;
    }

    const totalRecipients = eligibleStaff.length;
    const readReceiptsMap = new Map();
    for (const r of notice.reads) {
      readReceiptsMap.set(r.ustadhId, r.readAt);
    }

    const readBy = [];
    const unreadBy = [];

    for (const staff of eligibleStaff) {
      if (readReceiptsMap.has(staff.id)) {
        readBy.push({
          ustadhId: staff.id,
          fullName: staff.fullName,
          ustadhCode: staff.ustadhCode,
          staffType: staff.staffType,
          readAt: readReceiptsMap.get(staff.id),
        });
      } else {
        unreadBy.push({
          ustadhId: staff.id,
          fullName: staff.fullName,
          ustadhCode: staff.ustadhCode,
          staffType: staff.staffType,
        });
      }
    }

    const readCount = readBy.length;
    const unreadCount = unreadBy.length;
    const readRate = totalRecipients > 0 ? Math.round((readCount / totalRecipients) * 100) : 0;
    totalReadPercentages += readRate;

    return {
      id: notice.id,
      title: notice.title,
      message: notice.message,
      priority: notice.priority,
      category: notice.category,
      targetType: notice.targetType,
      targetClass: notice.targetClass,
      targetUstadhIds: notice.targetUstadhIds,
      createdAt: notice.createdAt.toISOString(),
      updatedAt: notice.updatedAt.toISOString(),
      senderName: notice.createdByUser?.name || 'Administration',
      stats: {
        totalRecipients,
        readCount,
        unreadCount,
        readRate,
        readBy,
        unreadBy,
      },
    };
  });

  const totalSent = noticesWithStats.length;
  const urgentCount = noticesWithStats.filter((n) => n.priority === 'URGENT').length;
  const avgReadRate = totalSent > 0 ? Math.round(totalReadPercentages / totalSent) : 0;

  return {
    kpis: {
      totalSent,
      urgentCount,
      avgReadRate,
      activeStaffCount: activeStaff.length,
    },
    activeStaff,
    notices: noticesWithStats,
  };
}

/**
 * Deletes a Staff Notice by ID scoped to tenant.
 */
export async function deleteStaffNotice({ madrasaId, userId, noticeId }) {
  const notice = await prisma.staffNotice.findFirst({
    where: { id: noticeId, madrasaId },
  });

  if (!notice) {
    throw new NotFoundError('Staff notice not found in this institution.');
  }

  await prisma.staffNotice.delete({
    where: { id: noticeId },
  });

  try {
    await logTenantActivity({
      madrasaId,
      userId,
      action: 'STAFF_NOTICE_DELETED',
      entityType: 'StaffNotice',
      entityId: noticeId,
      details: { title: notice.title },
    });
  } catch (_) {}

  return {
    success: true,
    message: 'Staff notice deleted successfully.',
  };
}

/**
 * Retrieves notices targeted to a specific teacher/ustadh.
 */
export async function getTeacherStaffNotices({ madrasaId, userId, ustadhId, query = {} }) {
  // Resolve ustadhId from userId if not provided
  let resolvedUstadhId = ustadhId;
  if (!resolvedUstadhId) {
    const profile = await prisma.ustadh.findFirst({
      where: { madrasaId, userId },
      select: { id: true },
    });
    resolvedUstadhId = profile?.id;
  }

  if (!resolvedUstadhId) {
    return {
      totalCount: 0,
      unreadCount: 0,
      page: 1,
      limit: 50,
      data: [],
    };
  }

  // Fetch teacher's scheduled class IDs
  const schedules = await prisma.ustadhSchedule.findMany({
    where: { madrasaId, ustadhId: resolvedUstadhId, isActive: true },
    select: { classId: true },
  });
  const assignedClassIds = new Set(schedules.map((s) => s.classId));

  // Fetch all staff notices for this madrasa
  const rawNotices = await prisma.staffNotice.findMany({
    where: { madrasaId },
    include: {
      targetClass: {
        select: { id: true, name: true, code: true },
      },
      reads: {
        where: { ustadhId: resolvedUstadhId },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Filter notices that target this ustadh
  const eligibleNotices = rawNotices.filter((n) => {
    if (n.targetType === 'ALL_TEACHERS') return true;
    if (n.targetType === 'CLASS' && n.targetClassId) {
      return assignedClassIds.has(n.targetClassId);
    }
    if (n.targetType === 'SPECIFIC_USTADHS' && Array.isArray(n.targetUstadhIds)) {
      return n.targetUstadhIds.includes(resolvedUstadhId);
    }
    return false;
  });

  // Map to unified format matching the teacher portal notification schema
  let items = eligibleNotices.map((n) => {
    const isRead = n.reads && n.reads.length > 0;
    return {
      id: n.id,
      title: n.title,
      message: n.message,
      category: n.category,
      priority: n.priority,
      targetType: n.targetType,
      targetClass: n.targetClass ? n.targetClass.name : null,
      timestamp: n.createdAt.toISOString(),
      isRead,
      readAt: isRead ? n.reads[0].readAt.toISOString() : null,
      sender: 'Madrasa Administration',
    };
  });

  if (query.priority) {
    items = items.filter((i) => i.priority === query.priority.toUpperCase());
  }

  if (query.category) {
    items = items.filter((i) => i.category.toLowerCase() === query.category.toLowerCase());
  }

  const unreadCount = items.filter((i) => !i.isRead).length;

  if (query.unreadOnly === true || query.unreadOnly === 'true') {
    items = items.filter((i) => !i.isRead);
  }

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 50;
  const skip = (page - 1) * limit;
  const paginatedData = items.slice(skip, skip + limit);

  return {
    totalCount: items.length,
    unreadCount,
    page,
    limit,
    data: paginatedData,
  };
}

/**
 * Marks a Staff Notice as read by a teacher.
 */
export async function markTeacherNoticeRead({ madrasaId, userId, ustadhId, noticeId }) {
  let resolvedUstadhId = ustadhId;
  if (!resolvedUstadhId) {
    const profile = await prisma.ustadh.findFirst({
      where: { madrasaId, userId },
      select: { id: true },
    });
    resolvedUstadhId = profile?.id;
  }

  if (!resolvedUstadhId) {
    throw new BadRequestError('Teacher profile not found.');
  }

  // Check if notice exists in staff_notices
  const notice = await prisma.staffNotice.findFirst({
    where: { id: noticeId, madrasaId },
  });

  if (notice) {
    await prisma.staffNoticeRead.upsert({
      where: {
        noticeId_ustadhId: {
          noticeId,
          ustadhId: resolvedUstadhId,
        },
      },
      update: { readAt: new Date() },
      create: {
        madrasaId,
        noticeId,
        ustadhId: resolvedUstadhId,
        readAt: new Date(),
      },
    });

    return {
      success: true,
      noticeId,
      isRead: true,
    };
  }

  // Fallback to legacy Announcement if not found in staff_notices
  const announcement = await prisma.announcement.findUnique({
    where: { id: noticeId },
  });

  if (announcement) {
    await prisma.announcementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId: noticeId,
          userId,
        },
      },
      update: { readAt: new Date() },
      create: {
        announcementId: noticeId,
        userId,
      },
    });

    return {
      success: true,
      noticeId,
      isRead: true,
    };
  }

  throw new NotFoundError('Notification not found.');
}

/**
 * Marks all eligible Staff Notices as read for a teacher.
 */
export async function markAllTeacherNoticesRead({ madrasaId, userId, ustadhId }) {
  let resolvedUstadhId = ustadhId;
  if (!resolvedUstadhId) {
    const profile = await prisma.ustadh.findFirst({
      where: { madrasaId, userId },
      select: { id: true },
    });
    resolvedUstadhId = profile?.id;
  }

  if (!resolvedUstadhId) {
    throw new BadRequestError('Teacher profile not found.');
  }

  const { data: notices } = await getTeacherStaffNotices({
    madrasaId,
    userId,
    ustadhId: resolvedUstadhId,
    query: { unreadOnly: true, limit: 100 },
  });

  for (const n of notices) {
    await prisma.staffNoticeRead.upsert({
      where: {
        noticeId_ustadhId: {
          noticeId: n.id,
          ustadhId: resolvedUstadhId,
        },
      },
      update: { readAt: new Date() },
      create: {
        madrasaId,
        noticeId: n.id,
        ustadhId: resolvedUstadhId,
        readAt: new Date(),
      },
    });
  }

  return {
    success: true,
    message: 'All notifications marked as read.',
  };
}
