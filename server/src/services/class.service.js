import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { findTenantRecordOrThrow, assertTenantOwnership } from '../lib/tenant-prisma.js';
import { ConflictError, NotFoundError, BadRequestError } from '../utils/errors.js';

/**
 * Lists classes for the authenticated Madrasa with pagination and filters.
 *
 * @param {string} madrasaId
 * @param {{ page?: number, pageSize?: number, search?: string, academicSectionId?: string, isActive?: boolean }} query
 * @returns {Promise<{ items: Array<object>, total: number, page: number, pageSize: number, totalPages: number }>}
 */
export async function listClasses(madrasaId, query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 20));
  const skip = (page - 1) * pageSize;

  const where = {
    madrasaId,
  };

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  if (query.academicSectionId) {
    if (query.academicSectionId === 'UNASSIGNED') {
      where.academicSectionId = null;
    } else if (query.academicSectionId !== 'ALL') {
      where.academicSectionId = query.academicSectionId;
    }
  }

  if (query.search && query.search.trim() !== '') {
    const s = query.search.trim();
    where.OR = [
      { name: { contains: s } },
      { code: { contains: s } },
    ];
  }

  const [total, rawClasses] = await Promise.all([
    prisma.class.count({ where }),
    prisma.class.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [
        { name: 'asc' },
      ],
      include: {
        _count: {
          select: { students: true },
        },
        academicSection: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    }),
  ]);

  const items = rawClasses.map((c) => ({
    id: c.id,
    academicSectionId: c.academicSectionId,
    academicSection: c.academicSection
      ? {
          id: c.academicSection.id,
          name: c.academicSection.name,
          code: c.academicSection.code,
        }
      : null,
    sectionName: c.academicSection ? c.academicSection.name : 'Unassigned',
    name: c.name,
    code: c.code,
    description: c.description,
    defaultMonthlyFee: Number(c.defaultMonthlyFee).toFixed(2),
    isActive: c.isActive,
    status: c.isActive ? 'ACTIVE' : 'INACTIVE',
    studentCount: c._count.students,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));

  return {
    items,
    classes: items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

/**
 * Fetches class details with student count metrics and section info.
 *
 * @param {string} madrasaId
 * @param {string} classId
 * @returns {Promise<object>}
 */
export async function getClassById(madrasaId, classId) {
  const c = await findTenantRecordOrThrow(
    prisma.class,
    classId,
    madrasaId,
    {
      include: {
        _count: {
          select: { students: true },
        },
        academicSection: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    },
    'Class not found.'
  );

  // Breakdown of active vs inactive students in this class
  const [activeCount, inactiveCount, archivedCount] = await Promise.all([
    prisma.student.count({ where: { madrasaId, classId, status: 'ACTIVE' } }),
    prisma.student.count({ where: { madrasaId, classId, status: 'INACTIVE' } }),
    prisma.student.count({ where: { madrasaId, classId, status: 'ARCHIVED' } }),
  ]);

  return {
    id: c.id,
    academicSectionId: c.academicSectionId,
    academicSection: c.academicSection
      ? {
          id: c.academicSection.id,
          name: c.academicSection.name,
          code: c.academicSection.code,
        }
      : null,
    sectionName: c.academicSection ? c.academicSection.name : 'Unassigned',
    name: c.name,
    code: c.code,
    description: c.description,
    defaultMonthlyFee: Number(c.defaultMonthlyFee).toFixed(2),
    isActive: c.isActive,
    status: c.isActive ? 'ACTIVE' : 'INACTIVE',
    studentCount: c._count.students,
    activeStudentCount: activeCount,
    inactiveStudentCount: inactiveCount,
    archivedStudentCount: archivedCount,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/**
 * Creates a new class under the authenticated Madrasa.
 * Requires a valid academicSectionId belonging to the same Madrasa.
 *
 * @param {string} madrasaId
 * @param {{ academicSectionId: string, name: string, code?: string|null, description?: string|null, defaultMonthlyFee: string }} data
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function createClass(madrasaId, data, userId) {
  const { academicSectionId, name, code, description, defaultMonthlyFee } = data;

  if (!academicSectionId) {
    throw new BadRequestError('Academic section is required for new classes.');
  }

  // Verify academic section exists and belongs to this madrasa
  const section = await prisma.academicSection.findFirst({
    where: { id: academicSectionId, madrasaId },
  });
  if (!section) {
    throw new NotFoundError('Academic section not found.');
  }
  if (!section.isActive) {
    throw new BadRequestError('Cannot create a class under an inactive academic section.');
  }

  // Pre-check for duplicate name within this academic section
  const existingName = await prisma.class.findFirst({
    where: { madrasaId, academicSectionId, name },
  });
  if (existingName) {
    throw new ConflictError('A class with this name already exists in this academic section.');
  }

  if (code) {
    const existingCode = await prisma.class.findFirst({
      where: { madrasaId, code },
    });
    if (existingCode) {
      throw new ConflictError('A class with this code already exists in your Madrasa.');
    }
  }

  try {
    const createdClass = await prisma.class.create({
      data: {
        madrasaId,
        academicSectionId,
        name,
        code: code || null,
        description: description || null,
        defaultMonthlyFee: new Prisma.Decimal(defaultMonthlyFee),
        isActive: true,
      },
      include: {
        academicSection: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Activity log
    await prisma.activityLog.create({
      data: {
        madrasaId,
        userId: userId || null,
        action: 'CLASS_CREATED',
        entityType: 'CLASS',
        entityId: createdClass.id,
        metadata: {
          name: createdClass.name,
          code: createdClass.code,
          academicSectionId: createdClass.academicSectionId,
          sectionName: section.name,
          defaultMonthlyFee: createdClass.defaultMonthlyFee.toString(),
        },
      },
    });

    return {
      id: createdClass.id,
      academicSectionId: createdClass.academicSectionId,
      academicSection: createdClass.academicSection,
      sectionName: createdClass.academicSection?.name || 'Unassigned',
      name: createdClass.name,
      code: createdClass.code,
      description: createdClass.description,
      defaultMonthlyFee: Number(createdClass.defaultMonthlyFee).toFixed(2),
      isActive: createdClass.isActive,
      studentCount: 0,
      createdAt: createdClass.createdAt,
      updatedAt: createdClass.updatedAt,
    };
  } catch (error) {
    if (error?.code === 'P2002') {
      const target = error.meta?.target || [];
      if (Array.isArray(target) && target.includes('name')) {
        throw new ConflictError('A class with this name already exists in this academic section.');
      }
      if (Array.isArray(target) && target.includes('code')) {
        throw new ConflictError('A class with this code already exists in your Madrasa.');
      }
      throw new ConflictError('A class with this name or code already exists in your Madrasa.');
    }
    throw error;
  }
}

/**
 * Updates class details.
 * Prevents unassigning a section back to null.
 *
 * @param {string} madrasaId
 * @param {string} classId
 * @param {{ academicSectionId?: string, name?: string, code?: string|null, description?: string|null, defaultMonthlyFee?: string }} data
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function updateClass(madrasaId, classId, data, userId) {
  const existing = await assertTenantOwnership(prisma.class, classId, madrasaId, 'Class not found.');

  // Invariant: If class is already assigned to a section, it cannot be reset to null
  if (existing.academicSectionId && data.academicSectionId === null) {
    throw new BadRequestError('Assigned classes cannot be reset to unassigned.');
  }

  // If academicSectionId is being updated
  let newSection = null;
  if (data.academicSectionId && data.academicSectionId !== existing.academicSectionId) {
    newSection = await prisma.academicSection.findFirst({
      where: { id: data.academicSectionId, madrasaId },
    });
    if (!newSection) {
      throw new NotFoundError('Academic section not found.');
    }
    if (!newSection.isActive) {
      throw new BadRequestError('Cannot assign a class to an inactive academic section.');
    }
  }

  const targetSectionId = data.academicSectionId !== undefined ? data.academicSectionId : existing.academicSectionId;
  const targetName = data.name !== undefined ? data.name : existing.name;

  // Check duplicate name within the target section if name or section changed
  if (
    (data.name && data.name !== existing.name) ||
    (data.academicSectionId !== undefined && data.academicSectionId !== existing.academicSectionId)
  ) {
    const dupName = await prisma.class.findFirst({
      where: {
        madrasaId,
        academicSectionId: targetSectionId,
        name: targetName,
        id: { not: classId },
      },
    });
    if (dupName) {
      throw new ConflictError('A class with this name already exists in this academic section.');
    }
  }

  if (data.code && data.code !== existing.code) {
    const dupCode = await prisma.class.findFirst({
      where: { madrasaId, code: data.code, id: { not: classId } },
    });
    if (dupCode) {
      throw new ConflictError('A class with this code already exists in your Madrasa.');
    }
  }

  try {
    const updateData = {};
    if (data.academicSectionId !== undefined) updateData.academicSectionId = data.academicSectionId;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.defaultMonthlyFee !== undefined) {
      updateData.defaultMonthlyFee = new Prisma.Decimal(data.defaultMonthlyFee);
    }

    const updated = await prisma.class.update({
      where: { id: classId },
      data: updateData,
      include: {
        _count: {
          select: { students: true },
        },
        academicSection: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        madrasaId,
        userId: userId || null,
        action: 'CLASS_UPDATED',
        entityType: 'CLASS',
        entityId: classId,
        metadata: {
          changes: data,
        },
      },
    });

    return {
      id: updated.id,
      academicSectionId: updated.academicSectionId,
      academicSection: updated.academicSection,
      sectionName: updated.academicSection?.name || 'Unassigned',
      name: updated.name,
      code: updated.code,
      description: updated.description,
      defaultMonthlyFee: Number(updated.defaultMonthlyFee).toFixed(2),
      isActive: updated.isActive,
      studentCount: updated._count.students,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new ConflictError('A class with this name or code already exists in your Madrasa.');
    }
    throw error;
  }
}

/**
 * Activates a class.
 *
 * @param {string} madrasaId
 * @param {string} classId
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function activateClass(madrasaId, classId, userId) {
  await assertTenantOwnership(prisma.class, classId, madrasaId, 'Class not found.');

  const updated = await prisma.class.update({
    where: { id: classId },
    data: { isActive: true },
  });

  await prisma.activityLog.create({
    data: {
      madrasaId,
      userId: userId || null,
      action: 'CLASS_ACTIVATED',
      entityType: 'CLASS',
      entityId: classId,
      metadata: { name: updated.name },
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    isActive: true,
    message: 'Class activated successfully.',
  };
}

/**
 * Deactivates a class. Existing assigned students remain intact.
 *
 * @param {string} madrasaId
 * @param {string} classId
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function deactivateClass(madrasaId, classId, userId) {
  await assertTenantOwnership(prisma.class, classId, madrasaId, 'Class not found.');

  const updated = await prisma.class.update({
    where: { id: classId },
    data: { isActive: false },
  });

  await prisma.activityLog.create({
    data: {
      madrasaId,
      userId: userId || null,
      action: 'CLASS_DEACTIVATED',
      entityType: 'CLASS',
      entityId: classId,
      metadata: { name: updated.name },
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    isActive: false,
    message: 'Class deactivated successfully. Existing student assignments remain intact.',
  };
}
