import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import { logTenantActivity } from './tenant.service.js';

/**
 * Generates a 256-bit cryptographically secure room token for permanent classroom QR plaques.
 * Specification:
 * - Prefix: mnx_rm_v1_
 * - Secret: 64 hexadecimal characters generated using crypto.randomBytes(32).toString('hex')
 * - Total length: exactly 74 characters
 * - Database capacity: VarChar(100)
 *
 * @param {string} [_madrasaId] - Maintained for backwards-compatible call signature
 * @returns {string}
 */
export function generateRoomToken(_madrasaId) {
  const secret = crypto.randomBytes(32).toString('hex');
  return `mnx_rm_v1_${secret}`;
}

/**
 * Ensures a dedicated physical classroom with a unique printable QR plaque exists for a Class.
 * Idempotent: returns existing classroom if one already matches the roomNumber or name.
 *
 * @param {string} madrasaId
 * @param {{ id: string, name: string, code?: string|null }} classObj
 * @returns {Promise<object>}
 */
export async function ensureClassroomForClass(madrasaId, classObj) {
  if (!classObj || !classObj.name) return null;

  const cleanCode = (classObj.code || classObj.name)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10) || 'CLS';

  const candidateRoomNumber = `CR-${cleanCode}`;

  // Check if a classroom already exists for this class
  let existing = await prisma.classroom.findFirst({
    where: {
      madrasaId,
      OR: [
        { roomNumber: candidateRoomNumber },
        { name: `Classroom - ${classObj.name}` },
        { name: classObj.name },
      ],
    },
  });

  if (existing) {
    return existing;
  }

  // Create new classroom linked to this class
  let roomNumberToUse = candidateRoomNumber;
  const duplicateNumber = await prisma.classroom.findFirst({
    where: { madrasaId, roomNumber: roomNumberToUse },
  });
  if (duplicateNumber) {
    roomNumberToUse = `CR-${cleanCode}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  }

  const roomToken = `CLS-${cleanCode}-${crypto.randomBytes(16).toString('hex')}`;

  const created = await prisma.classroom.create({
    data: {
      madrasaId,
      name: `Classroom - ${classObj.name}`,
      roomNumber: roomNumberToUse,
      roomToken,
      capacity: 35,
      facilities: 'Standard Class Venue, Whiteboard, High-Contrast Matte Wall Plaque',
      isActive: true,
    },
  });

  return created;
}

/**
 * Ensures all active classes in a Madrasa have a dedicated classroom QR plaque.
 *
 * @param {string} madrasaId
 */
export async function ensureClassroomsForAllClasses(madrasaId) {
  try {
    const classes = await prisma.class.findMany({
      where: { madrasaId, isActive: true },
      select: { id: true, name: true, code: true },
    });

    for (const cls of classes) {
      await ensureClassroomForClass(madrasaId, cls);
    }
  } catch (err) {
    // Non-fatal if DB table is syncing or running in sandbox
  }
}

/**
 * Lists permanent physical classrooms for a Madrasa with pagination and filters.
 *
 * @param {string} madrasaId
 * @param {object} query
 * @returns {Promise<object>}
 */
export async function listClassrooms(madrasaId, query = {}) {
  // Idempotently ensure all classes have a classroom QR plaque ready
  await ensureClassroomsForAllClasses(madrasaId);

  const { page = 1, pageSize = 50, search, isActive } = query;
  const skip = (Number(page) - 1) * Number(pageSize);
  const take = Number(pageSize);

  const where = { madrasaId };

  if (isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true' || isActive === true;
  }

  if (search && search.trim()) {
    const s = search.trim();
    where.OR = [
      { name: { contains: s } },
      { roomNumber: { contains: s } },
      { roomToken: { contains: s } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.classroom.count({ where }),
    prisma.classroom.findMany({
      where,
      skip,
      take,
      orderBy: [{ roomNumber: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { schedules: true },
        },
      },
    }),
  ]);

  return {
    items: items.map((c) => ({
      id: c.id,
      madrasaId: c.madrasaId,
      name: c.name,
      roomNumber: c.roomNumber,
      roomToken: c.roomToken,
      capacity: c.capacity,
      facilities: c.facilities,
      isActive: c.isActive,
      schedulesCount: c._count.schedules,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    total,
    page: Number(page),
    pageSize: Number(pageSize),
    totalPages: Math.ceil(total / Number(pageSize)) || 1,
  };
}

/**
 * Gets a single classroom by ID with its allocated weekly timetable schedules.
 *
 * @param {string} madrasaId
 * @param {string} classroomId
 * @returns {Promise<object>}
 */
export async function getClassroomById(madrasaId, classroomId) {
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, madrasaId },
    include: {
      schedules: {
        where: { isActive: true },
        include: {
          class: { select: { id: true, name: true, code: true } },
          subject: { select: { id: true, name: true, code: true } },
          ustadh: { select: { id: true, fullName: true, ustadhCode: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startMinutes: 'asc' }],
      },
      _count: {
        select: { schedules: true },
      },
    },
  });

  if (!classroom) {
    throw new NotFoundError('Classroom not found.');
  }

  return {
    id: classroom.id,
    madrasaId: classroom.madrasaId,
    name: classroom.name,
    roomNumber: classroom.roomNumber,
    roomToken: classroom.roomToken,
    capacity: classroom.capacity,
    facilities: classroom.facilities,
    isActive: classroom.isActive,
    schedulesCount: classroom._count.schedules,
    schedules: classroom.schedules.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startMinutes: s.startMinutes,
      endMinutes: s.endMinutes,
      className: s.class?.name || 'Class',
      subjectName: s.subject?.name || 'Subject',
      teacherName: s.ustadh?.fullName || 'Teacher',
      teacherCode: s.ustadh?.ustadhCode || '',
    })),
    createdAt: classroom.createdAt,
    updatedAt: classroom.updatedAt,
  };
}

/**
 * Creates a new permanent physical classroom and assigns an invariant roomToken.
 *
 * @param {string} madrasaId
 * @param {string} adminUserId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function createClassroom(madrasaId, adminUserId, data) {
  const existingWithNumber = await prisma.classroom.findFirst({
    where: { madrasaId, roomNumber: data.roomNumber.trim() },
  });

  if (existingWithNumber) {
    throw new ConflictError(`Classroom with room number "${data.roomNumber}" already exists in this institution.`);
  }

  const roomToken = generateRoomToken(madrasaId);

  const created = await prisma.classroom.create({
    data: {
      madrasaId,
      name: data.name.trim(),
      roomNumber: data.roomNumber.trim(),
      roomToken,
      capacity: data.capacity !== undefined ? data.capacity : null,
      facilities: data.facilities ? data.facilities.trim() : null,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
  });

  logTenantActivity({
    madrasaId,
    userId: adminUserId,
    action: 'CLASSROOM_CREATED',
    entityType: 'Classroom',
    entityId: created.id,
    metadata: {
      name: created.name,
      roomNumber: created.roomNumber,
      tokenHint: `${created.roomToken.slice(0, 14)}...${created.roomToken.slice(-6)}`,
    },
  }).catch(() => {});

  return {
    id: created.id,
    madrasaId: created.madrasaId,
    name: created.name,
    roomNumber: created.roomNumber,
    roomToken: created.roomToken,
    capacity: created.capacity,
    facilities: created.facilities,
    isActive: created.isActive,
    schedulesCount: 0,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

/**
 * Updates classroom parameters.
 *
 * @param {string} madrasaId
 * @param {string} classroomId
 * @param {string} adminUserId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function updateClassroom(madrasaId, classroomId, adminUserId, data) {
  const existing = await prisma.classroom.findFirst({
    where: { id: classroomId, madrasaId },
  });

  if (!existing) {
    throw new NotFoundError('Classroom not found.');
  }

  if (data.roomNumber && data.roomNumber.trim() !== existing.roomNumber) {
    const duplicate = await prisma.classroom.findFirst({
      where: { madrasaId, roomNumber: data.roomNumber.trim(), id: { not: classroomId } },
    });
    if (duplicate) {
      throw new ConflictError(`Classroom with room number "${data.roomNumber}" already exists.`);
    }
  }

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.roomNumber !== undefined) updateData.roomNumber = data.roomNumber.trim();
  if (data.capacity !== undefined) updateData.capacity = data.capacity;
  if (data.facilities !== undefined) updateData.facilities = data.facilities ? data.facilities.trim() : null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const updated = await prisma.classroom.update({
    where: { id: existing.id },
    data: updateData,
  });

  logTenantActivity({
    madrasaId,
    userId: adminUserId,
    action: 'CLASSROOM_UPDATED',
    entityType: 'Classroom',
    entityId: updated.id,
    metadata: {
      name: updated.name,
      roomNumber: updated.roomNumber,
    },
  }).catch(() => {});

  return {
    id: updated.id,
    madrasaId: updated.madrasaId,
    name: updated.name,
    roomNumber: updated.roomNumber,
    roomToken: updated.roomToken,
    capacity: updated.capacity,
    facilities: updated.facilities,
    isActive: updated.isActive,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

/**
 * Regenerates the permanent roomToken for a classroom plaque, invalidating former QR prints.
 *
 * @param {string} madrasaId
 * @param {string} classroomId
 * @param {string} adminUserId
 * @returns {Promise<object>}
 */
export async function regenerateClassroomQr(madrasaId, classroomId, adminUserId) {
  const existing = await prisma.classroom.findFirst({
    where: { id: classroomId, madrasaId },
  });

  if (!existing) {
    throw new NotFoundError('Classroom not found.');
  }

  const previousToken = existing.roomToken;
  const newRoomToken = generateRoomToken(madrasaId);

  const updated = await prisma.classroom.update({
    where: { id: existing.id },
    data: { roomToken: newRoomToken },
  });

  logTenantActivity({
    madrasaId,
    userId: adminUserId,
    action: 'CLASSROOM_QR_REGENERATED',
    entityType: 'Classroom',
    entityId: updated.id,
    metadata: {
      roomNumber: updated.roomNumber,
      previousTokenHint: `${previousToken.slice(0, 14)}...${previousToken.slice(-6)}`,
      newTokenHint: `${updated.roomToken.slice(0, 14)}...${updated.roomToken.slice(-6)}`,
    },
  }).catch(() => {});

  return {
    id: updated.id,
    name: updated.name,
    roomNumber: updated.roomNumber,
    roomToken: updated.roomToken,
    previousToken,
    isActive: updated.isActive,
    message: 'Classroom QR token regenerated successfully. Former printed plaques are now invalid.',
  };
}

/**
 * Revokes classroom QR access by soft-deactivating the classroom (Stakeholder Decision 1).
 *
 * @param {string} madrasaId
 * @param {string} classroomId
 * @param {string} adminUserId
 * @returns {Promise<object>}
 */
export async function revokeClassroomQr(madrasaId, classroomId, adminUserId) {
  const existing = await prisma.classroom.findFirst({
    where: { id: classroomId, madrasaId },
  });

  if (!existing) {
    throw new NotFoundError('Classroom not found.');
  }

  const updated = await prisma.classroom.update({
    where: { id: existing.id },
    data: { isActive: false },
  });

  logTenantActivity({
    madrasaId,
    userId: adminUserId,
    action: 'CLASSROOM_QR_REVOKED',
    entityType: 'Classroom',
    entityId: updated.id,
    metadata: {
      roomNumber: updated.roomNumber,
      tokenHint: `${updated.roomToken.slice(0, 14)}...${updated.roomToken.slice(-6)}`,
    },
  }).catch(() => {});

  return {
    id: updated.id,
    name: updated.name,
    roomNumber: updated.roomNumber,
    roomToken: updated.roomToken,
    isActive: false,
    message: 'Classroom QR access has been revoked. Faculty members cannot check in with this room plaque.',
  };
}

/**
 * Re-activates a previously revoked classroom.
 *
 * @param {string} madrasaId
 * @param {string} classroomId
 * @param {string} adminUserId
 * @returns {Promise<object>}
 */
export async function activateClassroom(madrasaId, classroomId, adminUserId) {
  const existing = await prisma.classroom.findFirst({
    where: { id: classroomId, madrasaId },
  });

  if (!existing) {
    throw new NotFoundError('Classroom not found.');
  }

  const updated = await prisma.classroom.update({
    where: { id: existing.id },
    data: { isActive: true },
  });

  logTenantActivity({
    madrasaId,
    userId: adminUserId,
    action: 'CLASSROOM_ACTIVATED',
    entityType: 'Classroom',
    entityId: updated.id,
    metadata: {
      roomNumber: updated.roomNumber,
    },
  }).catch(() => {});

  return {
    id: updated.id,
    name: updated.name,
    roomNumber: updated.roomNumber,
    roomToken: updated.roomToken,
    isActive: true,
    message: 'Classroom re-activated successfully.',
  };
}

/**
 * Returns structured metadata and payload for generating and printing formal A4 entrance plaques.
 *
 * @param {string} madrasaId
 * @param {string} classroomId
 * @returns {Promise<object>}
 */
export async function getClassroomQrPrintData(madrasaId, classroomId) {
  const [classroom, madrasa] = await Promise.all([
    prisma.classroom.findFirst({
      where: { id: classroomId, madrasaId },
      include: {
        _count: { select: { schedules: true } },
      },
    }),
    prisma.madrasa.findUnique({
      where: { id: madrasaId },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
      },
    }),
  ]);

  if (!classroom) {
    throw new NotFoundError('Classroom not found.');
  }

  const qrPayload = classroom.roomToken;

  return {
    id: classroom.id,
    name: classroom.name,
    roomNumber: classroom.roomNumber,
    roomToken: classroom.roomToken,
    capacity: classroom.capacity,
    facilities: classroom.facilities,
    isActive: classroom.isActive,
    qrPayload,
    venuePlaqueTitle: `Venue Plaque - ${classroom.roomNumber} ${classroom.name}`,
    architecturalDisclaimer:
      'Classroom QR codes verify venue and schedule alignment within the approved timetable window. Static QR codes do not certify continuous attendance or biometric physical presence.',
    institution: {
      id: madrasa?.id || madrasaId,
      name: madrasa?.name || 'MadrasaNexa Partner Institution',
      code: madrasa?.code || 'MNX',
      address: madrasa?.address || '',
      phone: madrasa?.phone || '',
    },
    classroom: {
      id: classroom.id,
      name: classroom.name,
      roomNumber: classroom.roomNumber,
      roomToken: classroom.roomToken,
      capacity: classroom.capacity,
      facilities: classroom.facilities,
      isActive: classroom.isActive,
      schedulesCount: classroom._count.schedules,
    },
    plaqueStandard: {
      type: 'PERMANENT_VENUE_PLAQUE',
      specification: 'High-Contrast Matte A4 Wall Plaque',
      mountingInstructions: 'Affix securely beside the main lecture hall entrance door at eye level (1.5m from floor).',
      usageProtocol: 'Visiting and resident faculty members scan this QR code with their mobile device at lecture start time.',
      securityNotice: 'Classroom QR codes verify venue and schedule alignment within the approved timetable window. Static QR codes do not certify continuous attendance or biometric physical presence.',
    },
  };
}
