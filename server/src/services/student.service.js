import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { findTenantRecordOrThrow, assertTenantOwnership } from '../lib/tenant-prisma.js';
import { ConflictError, NotFoundError, BadRequestError } from '../utils/errors.js';
import { getEffectiveStudentFee, getStudentFeeHistory } from './student-fee.service.js';

/**
 * Lists students for the authenticated Madrasa with pagination and filters.
 *
 * MANDATORY CORRECTION 6:
 * Avoids N+1 queries. Fetches students and in a single batch query gets all active
 * fee settings for the current page, calculating effective fees in-memory.
 *
 * @param {string} madrasaId
 * @param {{ page?: number, pageSize?: number, search?: string, status?: string, classId?: string }} query
 * @returns {Promise<{ items: Array<object>, total: number, page: number, pageSize: number, totalPages: number }>}
 */
export async function listStudents(madrasaId, query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  const skip = (page - 1) * pageSize;

  const where = {
    madrasaId,
  };

  if (query.status) {
    where.status = query.status;
  }

  if (query.classId) {
    if (query.classId === 'UNASSIGNED') {
      where.classId = null;
    } else {
      where.classId = query.classId;
    }
  }

  if (query.academicSectionId) {
    if (query.academicSectionId === 'UNASSIGNED') {
      where.OR = [
        { classId: null },
        { class: { academicSectionId: null } },
      ];
    } else {
      where.class = { academicSectionId: query.academicSectionId };
    }
  }

  if (query.search && query.search.trim() !== '') {
    const s = query.search.trim();
    where.OR = [
      { admissionNo: { contains: s } },
      { fullName: { contains: s } },
      { guardianName: { contains: s } },
      { guardianPhone: { contains: s } },
      { whatsappNumber: { contains: s } },
    ];
  }

  const [total, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { admissionNo: 'asc' },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            code: true,
            defaultMonthlyFee: true,
            isActive: true,
            academicSectionId: true,
            academicSection: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    }),
  ]);

  // Batch load active fee settings for all students on this page (Zero N+1)
  const now = new Date();
  const studentIds = students.map((s) => s.id);

  const activeSettings = studentIds.length > 0
    ? await prisma.studentFeeSetting.findMany({
        where: {
          madrasaId,
          studentId: { in: studentIds },
          effectiveFrom: { lte: now },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gt: now } },
          ],
        },
        orderBy: { effectiveFrom: 'desc' },
      })
    : [];

  const feeSettingMap = new Map();
  for (const setting of activeSettings) {
    if (!feeSettingMap.has(setting.studentId)) {
      feeSettingMap.set(setting.studentId, setting);
    }
  }

  const items = students.map((s) => {
    const activeOverride = feeSettingMap.get(s.id);
    let effectiveMonthlyFee = null;
    let feeSource = 'UNCONFIGURED';

    if (activeOverride) {
      effectiveMonthlyFee = Number(activeOverride.amount).toFixed(2);
      feeSource = 'STUDENT_OVERRIDE';
    } else if (s.class?.defaultMonthlyFee !== undefined && s.class.defaultMonthlyFee !== null) {
      effectiveMonthlyFee = Number(s.class.defaultMonthlyFee).toFixed(2);
      feeSource = 'CLASS_DEFAULT';
    }

    return {
      id: s.id,
      admissionNo: s.admissionNo,
      fullName: s.fullName,
      classId: s.classId,
      class: s.class
        ? {
            id: s.class.id,
            name: s.class.name,
            code: s.class.code,
            defaultMonthlyFee: s.class.defaultMonthlyFee !== undefined && s.class.defaultMonthlyFee !== null
              ? Number(s.class.defaultMonthlyFee).toFixed(2)
              : null,
            isActive: s.class.isActive,
            status: s.class.isActive ? 'ACTIVE' : 'INACTIVE',
            academicSectionId: s.class.academicSectionId,
            academicSection: s.class.academicSection
              ? {
                  id: s.class.academicSection.id,
                  name: s.class.academicSection.name,
                  code: s.class.academicSection.code,
                }
              : null,
            sectionName: s.class.academicSection ? s.class.academicSection.name : 'Unassigned',
          }
        : null,
      sectionName: s.class?.academicSection ? s.class.academicSection.name : 'Unassigned',
      guardianName: s.guardianName,
      guardianPhone: s.guardianPhone,
      guardianEmail: s.guardianEmail,
      whatsappNumber: s.whatsappNumber,
      guardianWhatsapp: s.whatsappNumber,
      whatsappOptIn: s.whatsappOptIn,
      whatsappNotification: s.whatsappOptIn,
      admissionDate: s.admissionDate,
      joinedAt: s.admissionDate,
      status: s.status,
      effectiveMonthlyFee,
      effectiveFee: effectiveMonthlyFee,
      feeSource,
      createdAt: s.createdAt,
    };
  });

  return {
    items,
    students: items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

/**
 * Fetches full student profile with class, guardian, WhatsApp, fee history, and effective fee.
 *
 * @param {string} madrasaId
 * @param {string} studentId
 * @returns {Promise<object>}
 */
export async function getStudentById(madrasaId, studentId) {
  const student = await findTenantRecordOrThrow(
    prisma.student,
    studentId,
    madrasaId,
    {
      include: {
        class: {
          select: {
            id: true,
            name: true,
            code: true,
            defaultMonthlyFee: true,
            isActive: true,
            academicSectionId: true,
            academicSection: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    },
    'Student not found.'
  );

  const [feeResolution, feeHistory] = await Promise.all([
    getEffectiveStudentFee(studentId, madrasaId, new Date()),
    getStudentFeeHistory(studentId, madrasaId),
  ]);

  return {
    id: student.id,
    admissionNo: student.admissionNo,
    fullName: student.fullName,
    classId: student.classId,
    class: student.class
      ? {
          id: student.class.id,
          name: student.class.name,
          code: student.class.code,
          defaultMonthlyFee: student.class.defaultMonthlyFee
            ? Number(student.class.defaultMonthlyFee).toFixed(2)
            : '0.00',
          isActive: student.class.isActive,
          status: student.class.isActive ? 'ACTIVE' : 'INACTIVE',
          academicSectionId: student.class.academicSectionId,
          academicSection: student.class.academicSection
            ? {
                id: student.class.academicSection.id,
                name: student.class.academicSection.name,
                code: student.class.academicSection.code,
              }
            : null,
          sectionName: student.class.academicSection ? student.class.academicSection.name : 'Unassigned',
        }
      : null,
    sectionName: student.class?.academicSection ? student.class.academicSection.name : 'Unassigned',
    guardianName: student.guardianName,
    guardianPhone: student.guardianPhone,
    guardianEmail: student.guardianEmail,
    whatsappNumber: student.whatsappNumber,
    guardianWhatsapp: student.whatsappNumber,
    whatsappOptIn: student.whatsappOptIn,
    whatsappNotification: student.whatsappOptIn,
    whatsappOptInAt: student.whatsappOptInAt,
    address: student.address,
    admissionDate: student.admissionDate,
    joinedAt: student.admissionDate,
    status: student.status,
    notes: student.notes,
    effectiveMonthlyFee: feeResolution.effectiveMonthlyFee,
    effectiveFee: feeResolution.effectiveMonthlyFee,
    feeSource: feeResolution.feeSource,
    currentOverrideAmount: student.monthlyFee ? student.monthlyFee.toString() : null,
    feeHistory,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
  };
}

/**
 * Creates a student under the authenticated Madrasa.
 *
 * MANDATORY CORRECTIONS 4, 7, 9:
 * 1. Checks admissionNo uniqueness (and catches DB P2002).
 * 2. Validates class belongs to madrasa and isActive === true.
 * 3. Handles initial fee override: creates StudentFeeSetting and sets Student.monthlyFee only if active NOW.
 *
 * @param {string} madrasaId
 * @param {object} data
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function createStudent(madrasaId, data, userId) {
  const admissionNo = data.admissionNo.trim();

  // 1. Pre-check admissionNo uniqueness
  const existingAdmission = await prisma.student.findFirst({
    where: { madrasaId, admissionNo },
  });
  if (existingAdmission) {
    throw new ConflictError('A student with this admission number already exists in your Madrasa.');
  }

  // 2. Validate class if provided
  let targetClass = null;
  if (data.classId) {
    targetClass = await prisma.class.findFirst({
      where: { id: data.classId, madrasaId },
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
    if (!targetClass) {
      throw new NotFoundError('Class not found.');
    }
    if (!targetClass.isActive) {
      throw new BadRequestError('Cannot assign a new student to an inactive class.');
    }
    if (data.academicSectionId && targetClass.academicSectionId !== data.academicSectionId) {
      throw new BadRequestError('Selected class does not belong to the selected academic section.');
    }
  }

  // 3. WhatsApp consent validation
  const whatsappOptIn = Boolean(data.whatsappOptIn);
  const whatsappNumber = data.whatsappNumber ? data.whatsappNumber.trim() : null;

  if (whatsappOptIn && (!whatsappNumber || whatsappNumber === '')) {
    throw new BadRequestError('WhatsApp number is required when WhatsApp opt-in is enabled.');
  }

  const whatsappOptInAt = whatsappOptIn ? new Date() : null;

  // 4. Initial fee override handling
  const hasOverride = data.monthlyFeeOverride !== undefined && data.monthlyFeeOverride !== null && data.monthlyFeeOverride !== '';
  const overrideAmount = hasOverride ? new Prisma.Decimal(data.monthlyFeeOverride) : null;
  const effectiveFrom = data.admissionDate || new Date();
  const now = new Date();

  // Student.monthlyFee reflects what is active NOW
  const isActiveNow = hasOverride && effectiveFrom <= now;
  const initialCurrentMonthlyFee = isActiveNow ? overrideAmount : null;

  try {
    return await prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          madrasaId,
          admissionNo,
          fullName: data.fullName.trim(),
          classId: data.classId || null,
          guardianName: data.guardianName.trim(),
          guardianPhone: data.guardianPhone || null,
          guardianEmail: data.guardianEmail || null,
          whatsappNumber,
          whatsappOptIn,
          whatsappOptInAt,
          address: data.address || null,
          admissionDate: data.admissionDate,
          monthlyFee: initialCurrentMonthlyFee,
          status: 'ACTIVE',
          notes: data.notes || null,
        },
        include: {
          class: {
            include: {
              academicSection: true,
            },
          },
        },
      });

      if (hasOverride) {
        await tx.studentFeeSetting.create({
          data: {
            madrasaId,
            studentId: student.id,
            amount: overrideAmount,
            effectiveFrom,
            effectiveTo: null,
            reason: 'Initial fee override upon creation',
          },
        });

        await tx.activityLog.create({
          data: {
            madrasaId,
            userId: userId || null,
            action: 'STUDENT_FEE_OVERRIDE_SET',
            entityType: 'STUDENT',
            entityId: student.id,
            metadata: {
              amount: overrideAmount.toString(),
              effectiveFrom: effectiveFrom.toISOString(),
              reason: 'Initial student fee override',
            },
          },
        });
      }

      await tx.activityLog.create({
        data: {
          madrasaId,
          userId: userId || null,
          action: 'STUDENT_CREATED',
          entityType: 'STUDENT',
          entityId: student.id,
          metadata: {
            admissionNo: student.admissionNo,
            fullName: student.fullName,
            classId: student.classId,
          },
        },
      });

      if (whatsappOptIn) {
        await tx.activityLog.create({
          data: {
            madrasaId,
            userId: userId || null,
            action: 'WHATSAPP_CONSENT_ENABLED',
            entityType: 'STUDENT',
            entityId: student.id,
            metadata: {
              whatsappNumber,
              consentedAt: whatsappOptInAt.toISOString(),
            },
          },
        });
      }

      // Determine fee source
      let effectiveMonthlyFee = null;
      let feeSource = 'UNCONFIGURED';

      if (isActiveNow) {
        effectiveMonthlyFee = Number(overrideAmount).toFixed(2);
        feeSource = 'STUDENT_OVERRIDE';
      } else if (student.class?.defaultMonthlyFee !== undefined && student.class.defaultMonthlyFee !== null) {
        effectiveMonthlyFee = Number(student.class.defaultMonthlyFee).toFixed(2);
        feeSource = 'CLASS_DEFAULT';
      }

      return {
        id: student.id,
        admissionNo: student.admissionNo,
        fullName: student.fullName,
        classId: student.classId,
        class: student.class
          ? {
              id: student.class.id,
              name: student.class.name,
              code: student.class.code,
              defaultMonthlyFee: Number(student.class.defaultMonthlyFee).toFixed(2),
              isActive: student.class.isActive,
              status: student.class.isActive ? 'ACTIVE' : 'INACTIVE',
              academicSectionId: student.class.academicSectionId,
              academicSection: student.class.academicSection
                ? {
                    id: student.class.academicSection.id,
                    name: student.class.academicSection.name,
                    code: student.class.academicSection.code,
                  }
                : null,
              sectionName: student.class.academicSection ? student.class.academicSection.name : 'Unassigned',
            }
          : null,
        sectionName: student.class?.academicSection ? student.class.academicSection.name : 'Unassigned',
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        whatsappNumber: student.whatsappNumber,
        guardianWhatsapp: student.whatsappNumber,
        whatsappOptIn: student.whatsappOptIn,
        whatsappNotification: student.whatsappOptIn,
        whatsappOptInAt: student.whatsappOptInAt,
        address: student.address,
        admissionDate: student.admissionDate,
        joinedAt: student.admissionDate,
        status: student.status,
        effectiveMonthlyFee,
        effectiveFee: effectiveMonthlyFee,
        feeSource,
        createdAt: student.createdAt,
      };
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new ConflictError('A student with this admission number already exists in your Madrasa.');
    }
    throw error;
  }
}

/**
 * Updates a student record.
 *
 * MANDATORY CORRECTIONS 5, 7:
 * Validates WhatsApp consent against MERGED state.
 * Validates class assignment against active tenant classes.
 *
 * @param {string} madrasaId
 * @param {string} studentId
 * @param {object} data
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function updateStudent(madrasaId, studentId, data, userId) {
  const existing = await assertTenantOwnership(prisma.student, studentId, madrasaId, 'Student not found.');

  // 1. Admission number check if changed
  if (data.admissionNo && data.admissionNo.trim() !== existing.admissionNo) {
    const dup = await prisma.student.findFirst({
      where: {
        madrasaId,
        admissionNo: data.admissionNo.trim(),
        id: { not: studentId },
      },
    });
    if (dup) {
      throw new ConflictError('A student with this admission number already exists in your Madrasa.');
    }
  }

  // 2. Class change check
  let classChanged = false;
  if (data.classId !== undefined) {
    const targetClassId = data.classId || null;
    if (targetClassId !== existing.classId) {
      if (targetClassId) {
        const targetClass = await prisma.class.findFirst({
          where: { id: targetClassId, madrasaId },
          include: { academicSection: true },
        });
        if (!targetClass) {
          throw new NotFoundError('Class not found.');
        }
        if (!targetClass.isActive) {
          throw new BadRequestError('Cannot reassign student to an inactive class.');
        }
        if (data.academicSectionId && targetClass.academicSectionId !== data.academicSectionId) {
          throw new BadRequestError('Selected class does not belong to the selected academic section.');
        }
      }
      classChanged = true;
    } else if (targetClassId && data.academicSectionId) {
      const currentClass = await prisma.class.findFirst({
        where: { id: targetClassId, madrasaId },
      });
      if (currentClass && currentClass.academicSectionId !== data.academicSectionId) {
        throw new BadRequestError('Selected class does not belong to the selected academic section.');
      }
    }
  }

  // 3. Merged WhatsApp state validation (Mandatory Correction #5)
  const finalWhatsappNumber = data.whatsappNumber !== undefined
    ? (data.whatsappNumber ? data.whatsappNumber.trim() : null)
    : existing.whatsappNumber;

  const finalWhatsappOptIn = data.whatsappOptIn !== undefined
    ? Boolean(data.whatsappOptIn)
    : existing.whatsappOptIn;

  if (finalWhatsappOptIn === true && (!finalWhatsappNumber || finalWhatsappNumber === '')) {
    throw new BadRequestError('WhatsApp number is required when WhatsApp opt-in is enabled.');
  }

  let whatsappOptInAt = existing.whatsappOptInAt;
  let consentAction = null;

  if (!existing.whatsappOptIn && finalWhatsappOptIn === true) {
    whatsappOptInAt = new Date();
    consentAction = 'WHATSAPP_CONSENT_ENABLED';
  } else if (existing.whatsappOptIn && finalWhatsappOptIn === false) {
    whatsappOptInAt = null;
    consentAction = 'WHATSAPP_CONSENT_DISABLED';
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const updateData = {};
      if (data.admissionNo !== undefined) updateData.admissionNo = data.admissionNo.trim();
      if (data.fullName !== undefined) updateData.fullName = data.fullName.trim();
      if (data.classId !== undefined) updateData.classId = data.classId || null;
      if (data.guardianName !== undefined) updateData.guardianName = data.guardianName.trim();
      if (data.guardianPhone !== undefined) updateData.guardianPhone = data.guardianPhone || null;
      if (data.guardianEmail !== undefined) updateData.guardianEmail = data.guardianEmail || null;
      if (data.whatsappNumber !== undefined) updateData.whatsappNumber = finalWhatsappNumber;
      if (data.whatsappOptIn !== undefined) {
        updateData.whatsappOptIn = finalWhatsappOptIn;
        updateData.whatsappOptInAt = whatsappOptInAt;
      }
      if (data.address !== undefined) updateData.address = data.address || null;
      if (data.admissionDate !== undefined) updateData.admissionDate = data.admissionDate;
      if (data.notes !== undefined) updateData.notes = data.notes || null;

      const updated = await tx.student.update({
        where: { id: studentId },
        data: updateData,
        include: {
          class: {
            include: {
              academicSection: true,
            },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          madrasaId,
          userId: userId || null,
          action: 'STUDENT_UPDATED',
          entityType: 'STUDENT',
          entityId: studentId,
          metadata: { changes: data },
        },
      });

      if (classChanged) {
        await tx.activityLog.create({
          data: {
            madrasaId,
            userId: userId || null,
            action: 'STUDENT_CLASS_CHANGED',
            entityType: 'STUDENT',
            entityId: studentId,
            metadata: {
              previousClassId: existing.classId,
              newClassId: updated.classId,
            },
          },
        });
      }

      if (consentAction) {
        await tx.activityLog.create({
          data: {
            madrasaId,
            userId: userId || null,
            action: consentAction,
            entityType: 'STUDENT',
            entityId: studentId,
            metadata: {
              whatsappNumber: finalWhatsappNumber,
              timestamp: whatsappOptInAt ? whatsappOptInAt.toISOString() : null,
            },
          },
        });
      }

      return {
        id: updated.id,
        admissionNo: updated.admissionNo,
        fullName: updated.fullName,
        classId: updated.classId,
        class: updated.class
          ? {
              id: updated.class.id,
              name: updated.class.name,
              code: updated.class.code,
              defaultMonthlyFee: updated.class.defaultMonthlyFee
                ? Number(updated.class.defaultMonthlyFee).toFixed(2)
                : '0.00',
              isActive: updated.class.isActive,
              status: updated.class.isActive ? 'ACTIVE' : 'INACTIVE',
              academicSectionId: updated.class.academicSectionId,
              academicSection: updated.class.academicSection
                ? {
                    id: updated.class.academicSection.id,
                    name: updated.class.academicSection.name,
                    code: updated.class.academicSection.code,
                  }
                : null,
              sectionName: updated.class.academicSection ? updated.class.academicSection.name : 'Unassigned',
            }
          : null,
        sectionName: updated.class?.academicSection ? updated.class.academicSection.name : 'Unassigned',
        guardianName: updated.guardianName,
        guardianPhone: updated.guardianPhone,
        whatsappNumber: updated.whatsappNumber,
        guardianWhatsapp: updated.whatsappNumber,
        whatsappOptIn: updated.whatsappOptIn,
        whatsappNotification: updated.whatsappOptIn,
        whatsappOptInAt: updated.whatsappOptInAt,
        address: updated.address,
        admissionDate: updated.admissionDate,
        joinedAt: updated.admissionDate,
        status: updated.status,
        notes: updated.notes,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new ConflictError('A student with this admission number already exists in your Madrasa.');
    }
    throw error;
  }
}

/**
 * Updates a student's status (ACTIVE, INACTIVE, ARCHIVED).
 *
 * @param {string} madrasaId
 * @param {string} studentId
 * @param {'ACTIVE'|'INACTIVE'|'ARCHIVED'} targetStatus
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function updateStudentStatus(madrasaId, studentId, targetStatus, userId) {
  const existing = await assertTenantOwnership(prisma.student, studentId, madrasaId, 'Student not found.');

  if (!['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(targetStatus)) {
    throw new BadRequestError('Invalid student status.');
  }

  const updated = await prisma.student.update({
    where: { id: studentId },
    data: { status: targetStatus },
  });

  const actionMap = {
    ACTIVE: 'STUDENT_ACTIVATED',
    INACTIVE: 'STUDENT_INACTIVATED',
    ARCHIVED: 'STUDENT_ARCHIVED',
  };

  await prisma.activityLog.create({
    data: {
      madrasaId,
      userId: userId || null,
      action: actionMap[targetStatus],
      entityType: 'STUDENT',
      entityId: studentId,
      metadata: {
        previousStatus: existing.status,
        newStatus: targetStatus,
      },
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    message: `Student status updated to ${targetStatus}.`,
  };
}
