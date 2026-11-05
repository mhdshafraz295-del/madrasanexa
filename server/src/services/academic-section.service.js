import { prisma } from '../lib/prisma.js';
import { findTenantRecordOrThrow, assertTenantOwnership } from '../lib/tenant-prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';

/**
 * Lists academic sections for the authenticated Madrasa with pagination and metrics.
 *
 * @param {string} madrasaId
 * @param {{ page?: number, pageSize?: number, search?: string, isActive?: boolean }} query
 * @returns {Promise<{ items: Array<object>, total: number, page: number, pageSize: number, totalPages: number }>}
 */
export async function listAcademicSections(madrasaId, query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  const skip = (page - 1) * pageSize;

  const where = {
    madrasaId,
  };

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  if (query.search && query.search.trim() !== '') {
    const s = query.search.trim();
    where.OR = [
      { name: { contains: s } },
      { code: { contains: s } },
    ];
  }

  const [total, rawSections] = await Promise.all([
    prisma.academicSection.count({ where }),
    prisma.academicSection.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      include: {
        _count: {
          select: { classes: true },
        },
        classes: {
          select: {
            id: true,
            _count: {
              select: { students: true },
            },
          },
        },
      },
    }),
  ]);

  const items = rawSections.map((s) => {
    const studentCount = s.classes.reduce((sum, c) => sum + (c._count?.students || 0), 0);
    return {
      id: s.id,
      name: s.name,
      code: s.code,
      description: s.description,
      sortOrder: s.sortOrder,
      isActive: s.isActive,
      status: s.isActive ? 'ACTIVE' : 'INACTIVE',
      classCount: s._count.classes,
      studentCount,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  });

  return {
    items,
    sections: items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

/**
 * Fetches academic section details with class and student breakdowns.
 *
 * @param {string} madrasaId
 * @param {string} sectionId
 * @returns {Promise<object>}
 */
export async function getAcademicSectionById(madrasaId, sectionId) {
  const section = await findTenantRecordOrThrow(
    prisma.academicSection,
    sectionId,
    madrasaId,
    {
      include: {
        classes: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
            defaultMonthlyFee: true,
            _count: {
              select: { students: true },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    },
    'Academic section not found.'
  );

  const classes = section.classes.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    isActive: c.isActive,
    status: c.isActive ? 'ACTIVE' : 'INACTIVE',
    defaultMonthlyFee: Number(c.defaultMonthlyFee).toFixed(2),
    studentCount: c._count.students,
  }));

  const activeClasses = classes.filter((c) => c.isActive).length;
  const inactiveClasses = classes.filter((c) => !c.isActive).length;
  const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);

  return {
    id: section.id,
    name: section.name,
    code: section.code,
    description: section.description,
    sortOrder: section.sortOrder,
    isActive: section.isActive,
    status: section.isActive ? 'ACTIVE' : 'INACTIVE',
    classCount: classes.length,
    activeClassesCount: activeClasses,
    inactiveClassesCount: inactiveClasses,
    totalStudents,
    classes,
    createdAt: section.createdAt,
    updatedAt: section.updatedAt,
  };
}

/**
 * Creates a new academic section under the authenticated Madrasa.
 *
 * @param {string} madrasaId
 * @param {{ name: string, code?: string|null, description?: string|null, sortOrder?: number }} data
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function createAcademicSection(madrasaId, data, userId) {
  const { name, code, description, sortOrder } = data;

  const existingName = await prisma.academicSection.findFirst({
    where: { madrasaId, name },
  });
  if (existingName) {
    throw new ConflictError('An academic section with this name already exists in your Madrasa.');
  }

  if (code) {
    const existingCode = await prisma.academicSection.findFirst({
      where: { madrasaId, code },
    });
    if (existingCode) {
      throw new ConflictError('An academic section with this code already exists in your Madrasa.');
    }
  }

  try {
    const created = await prisma.academicSection.create({
      data: {
        madrasaId,
        name,
        code: code || null,
        description: description || null,
        sortOrder: sortOrder || 0,
        isActive: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        madrasaId,
        userId: userId || null,
        action: 'SECTION_CREATED',
        entityType: 'ACADEMIC_SECTION',
        entityId: created.id,
        metadata: {
          name: created.name,
          code: created.code,
        },
      },
    });

    return {
      id: created.id,
      name: created.name,
      code: created.code,
      description: created.description,
      sortOrder: created.sortOrder,
      isActive: created.isActive,
      classCount: 0,
      studentCount: 0,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  } catch (error) {
    if (error?.code === 'P2002') {
      const target = error.meta?.target || [];
      if (Array.isArray(target) && target.includes('name')) {
        throw new ConflictError('An academic section with this name already exists in your Madrasa.');
      }
      if (Array.isArray(target) && target.includes('code')) {
        throw new ConflictError('An academic section with this code already exists in your Madrasa.');
      }
      throw new ConflictError('An academic section with this name or code already exists in your Madrasa.');
    }
    throw error;
  }
}

/**
 * Updates an academic section.
 *
 * @param {string} madrasaId
 * @param {string} sectionId
 * @param {{ name?: string, code?: string|null, description?: string|null, sortOrder?: number }} data
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function updateAcademicSection(madrasaId, sectionId, data, userId) {
  const existing = await assertTenantOwnership(prisma.academicSection, sectionId, madrasaId, 'Academic section not found.');

  if (data.name && data.name !== existing.name) {
    const dupName = await prisma.academicSection.findFirst({
      where: { madrasaId, name: data.name, id: { not: sectionId } },
    });
    if (dupName) {
      throw new ConflictError('An academic section with this name already exists in your Madrasa.');
    }
  }

  if (data.code && data.code !== existing.code) {
    const dupCode = await prisma.academicSection.findFirst({
      where: { madrasaId, code: data.code, id: { not: sectionId } },
    });
    if (dupCode) {
      throw new ConflictError('An academic section with this code already exists in your Madrasa.');
    }
  }

  try {
    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    const updated = await prisma.academicSection.update({
      where: { id: sectionId },
      data: updateData,
      include: {
        _count: {
          select: { classes: true },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        madrasaId,
        userId: userId || null,
        action: 'SECTION_UPDATED',
        entityType: 'ACADEMIC_SECTION',
        entityId: sectionId,
        metadata: {
          changes: data,
        },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      code: updated.code,
      description: updated.description,
      sortOrder: updated.sortOrder,
      isActive: updated.isActive,
      classCount: updated._count.classes,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new ConflictError('An academic section with this name or code already exists in your Madrasa.');
    }
    throw error;
  }
}

/**
 * Activates an academic section.
 *
 * @param {string} madrasaId
 * @param {string} sectionId
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function activateAcademicSection(madrasaId, sectionId, userId) {
  await assertTenantOwnership(prisma.academicSection, sectionId, madrasaId, 'Academic section not found.');

  const updated = await prisma.academicSection.update({
    where: { id: sectionId },
    data: { isActive: true },
  });

  await prisma.activityLog.create({
    data: {
      madrasaId,
      userId: userId || null,
      action: 'SECTION_ACTIVATED',
      entityType: 'ACADEMIC_SECTION',
      entityId: sectionId,
      metadata: { name: updated.name },
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    isActive: true,
    message: 'Academic section activated successfully.',
  };
}

/**
 * Deactivates an academic section. Classes within it remain intact.
 *
 * @param {string} madrasaId
 * @param {string} sectionId
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function deactivateAcademicSection(madrasaId, sectionId, userId) {
  await assertTenantOwnership(prisma.academicSection, sectionId, madrasaId, 'Academic section not found.');

  const updated = await prisma.academicSection.update({
    where: { id: sectionId },
    data: { isActive: false },
  });

  await prisma.activityLog.create({
    data: {
      madrasaId,
      userId: userId || null,
      action: 'SECTION_DEACTIVATED',
      entityType: 'ACADEMIC_SECTION',
      entityId: sectionId,
      metadata: { name: updated.name },
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    isActive: false,
    message: 'Academic section deactivated successfully. Classes within this section remain intact.',
  };
}
