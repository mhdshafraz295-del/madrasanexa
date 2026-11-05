import { prisma } from '../lib/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logTenantActivity } from './tenant.service.js';
import { parseDateOnly, formatDateOnly } from './ustadh.service.js';

/**
 * Checks if two date ranges overlap.
 * Null effectiveTo represents an open-ended/ongoing schedule.
 *
 * @param {{ effectiveFrom: Date, effectiveTo: Date|null }} a
 * @param {{ effectiveFrom: Date, effectiveTo: Date|null }} b
 * @returns {boolean}
 */
export function doEffectiveDatesOverlap(a, b) {
  const aFrom = a.effectiveFrom.getTime();
  const aTo = a.effectiveTo ? a.effectiveTo.getTime() : Infinity;
  const bFrom = b.effectiveFrom.getTime();
  const bTo = b.effectiveTo ? b.effectiveTo.getTime() : Infinity;

  return aFrom <= bTo && bFrom <= aTo;
}

/**
 * Checks if two time intervals (in minutes from midnight) overlap.
 *
 * @param {{ startMinutes: number, endMinutes: number }} a
 * @param {{ startMinutes: number, endMinutes: number }} b
 * @returns {boolean}
 */
export function doTimesOverlap(a, b) {
  return Math.max(a.startMinutes, b.startMinutes) < Math.min(a.endMinutes, b.endMinutes);
}

/**
 * Asserts that a schedule does not conflict with existing schedules for the same Ustadh.
 *
 * @param {string} madrasaId
 * @param {string} ustadhId
 * @param {string} dayOfWeek
 * @param {number} startMinutes
 * @param {number} endMinutes
 * @param {Date} effectiveFrom
 * @param {Date|null} effectiveTo
 * @param {string|null} excludeScheduleId
 */
export function formatMinutesToDisplayTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Asserts that a schedule does not conflict with:
 * 1. Existing schedules for the same Ustadh/Teacher.
 * 2. Existing teaching sessions for the same Class.
 * 3. Existing TimetableBreaks for the same Class.
 *
 * @param {string} madrasaId
 * @param {string} ustadhId
 * @param {string} dayOfWeek
 * @param {number} startMinutes
 * @param {number} endMinutes
 * @param {Date} effectiveFrom
 * @param {Date|null} effectiveTo
 * @param {string|null} excludeScheduleId
 * @param {string|null} classId
 */
export async function assertNoScheduleConflict(
  madrasaId,
  ustadhId,
  dayOfWeek,
  startMinutes,
  endMinutes,
  effectiveFrom,
  effectiveTo,
  excludeScheduleId = null,
  classId = null
) {
  const candidate = { startMinutes, endMinutes, effectiveFrom, effectiveTo };

  // 1. Teacher Conflict: Ustadh cannot teach another class at the same time
  const teacherSchedules = await prisma.ustadhSchedule.findMany({
    where: {
      madrasaId,
      ustadhId,
      dayOfWeek,
      isActive: true,
      ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
    },
    select: {
      id: true,
      startMinutes: true,
      endMinutes: true,
      effectiveFrom: true,
      effectiveTo: true,
      class: { select: { name: true } },
      subject: { select: { name: true } },
    },
  });

  for (const s of teacherSchedules) {
    if (doEffectiveDatesOverlap(candidate, s) && doTimesOverlap(candidate, s)) {
      throw new BadRequestError(
        `Schedule conflict for this Ustadh on ${dayOfWeek}: overlaps with existing session ` +
        `(${formatMinutesToDisplayTime(s.startMinutes)} - ${formatMinutesToDisplayTime(s.endMinutes)}) for ${s.class.name} - ${s.subject.name}.`
      );
    }
  }

  // 2. Class Teaching Conflict: Same class cannot have two concurrent teaching sessions
  if (classId) {
    const classSchedules = await prisma.ustadhSchedule.findMany({
      where: {
        madrasaId,
        classId,
        dayOfWeek,
        isActive: true,
        ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
      },
      select: {
        id: true,
        startMinutes: true,
        endMinutes: true,
        effectiveFrom: true,
        effectiveTo: true,
        ustadh: { select: { fullName: true } },
        subject: { select: { name: true } },
      },
    });

    for (const s of classSchedules) {
      if (doEffectiveDatesOverlap(candidate, s) && doTimesOverlap(candidate, s)) {
        throw new BadRequestError(
          `This class already has a teaching session scheduled at this time ` +
          `(${formatMinutesToDisplayTime(s.startMinutes)} - ${formatMinutesToDisplayTime(s.endMinutes)}) for ${s.subject.name} with ${s.ustadh.fullName}.`
        );
      }
    }

    // 3. Class Break Conflict: Teaching session cannot overlap with any active break for this class
    const classBreaks = await prisma.timetableBreak.findMany({
      where: {
        madrasaId,
        classId,
        dayOfWeek,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        startMinutes: true,
        endMinutes: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });

    for (const b of classBreaks) {
      if (doEffectiveDatesOverlap(candidate, b) && doTimesOverlap(candidate, b)) {
        throw new BadRequestError(
          `This time overlaps with ${b.name} (${formatMinutesToDisplayTime(b.startMinutes)} - ${formatMinutesToDisplayTime(b.endMinutes)}).`
        );
      }
    }
  }
}

/**
 * Creates a weekly teaching schedule session.
 *
 * @param {string} madrasaId
 * @param {string} userId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function createSchedule(madrasaId, userId, data) {
  // Validate Ustadh belongs to tenant
  const ustadh = await prisma.ustadh.findFirst({
    where: { id: data.ustadhId, madrasaId },
  });
  if (!ustadh) {
    throw new NotFoundError('Ustadh not found.');
  }

  // Validate Class belongs to tenant
  const targetClass = await prisma.class.findFirst({
    where: { id: data.classId, madrasaId },
  });
  if (!targetClass) {
    throw new NotFoundError('Class not found.');
  }

  // Validate Subject belongs to tenant
  const targetSubject = await prisma.subject.findFirst({
    where: { id: data.subjectId, madrasaId },
  });
  if (!targetSubject) {
    throw new NotFoundError('Subject not found.');
  }

  const effectiveFrom = parseDateOnly(data.effectiveFrom);
  const effectiveTo = data.effectiveTo ? parseDateOnly(data.effectiveTo) : null;

  // Conflict validation
  await assertNoScheduleConflict(
    madrasaId,
    data.ustadhId,
    data.dayOfWeek,
    data.startMinutes,
    data.endMinutes,
    effectiveFrom,
    effectiveTo,
    null,
    data.classId
  );

  const schedule = await prisma.ustadhSchedule.create({
    data: {
      madrasaId,
      ustadhId: data.ustadhId,
      classId: data.classId,
      subjectId: data.subjectId,
      dayOfWeek: data.dayOfWeek,
      startMinutes: data.startMinutes,
      endMinutes: data.endMinutes,
      effectiveFrom,
      effectiveTo,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
    include: {
      ustadh: { select: { id: true, fullName: true, ustadhCode: true, staffType: true } },
      class: { select: { id: true, name: true, code: true } },
      subject: { select: { id: true, name: true, code: true } },
    },
  });

  logTenantActivity({
    madrasaId,
    userId,
    action: 'USTADH_SCHEDULE_CREATED',
    entityType: 'UstadhSchedule',
    entityId: schedule.id,
    metadata: {
      ustadhId: data.ustadhId,
      dayOfWeek: data.dayOfWeek,
      startMinutes: data.startMinutes,
      endMinutes: data.endMinutes,
    },
  }).catch(() => {});

  return formatScheduleResponse(schedule);
}

/**
 * Lists weekly schedules with optional filters.
 *
 * @param {string} madrasaId
 * @param {object} query
 * @returns {Promise<object>}
 */
export async function listSchedules(madrasaId, query = {}) {
  const { ustadhId, classId, subjectId, dayOfWeek, isActive } = query;
  const where = { madrasaId };

  if (ustadhId) where.ustadhId = ustadhId;
  if (classId) where.classId = classId;
  if (subjectId) where.subjectId = subjectId;
  if (dayOfWeek) where.dayOfWeek = dayOfWeek;
  if (isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true' || isActive === true;
  }

  const items = await prisma.ustadhSchedule.findMany({
    where,
    orderBy: [
      { dayOfWeek: 'asc' },
      { startMinutes: 'asc' },
    ],
    include: {
      ustadh: { select: { id: true, fullName: true, ustadhCode: true, staffType: true, phoneNumber: true, whatsappNumber: true } },
      class: { select: { id: true, name: true, code: true } },
      subject: { select: { id: true, name: true, code: true } },
    },
  });

  return {
    items: items.map(formatScheduleResponse),
    total: items.length,
  };
}

/**
 * Updates a schedule safely preserving historical integrity.
 * If attendance exists and core semantics change, end-dates the old schedule and creates a new one.
 *
 * @param {string} madrasaId
 * @param {string} scheduleId
 * @param {string} userId
 * @param {object} updates
 * @returns {Promise<object>}
 */
export async function updateSchedule(madrasaId, scheduleId, userId, updates) {
  const existing = await prisma.ustadhSchedule.findFirst({
    where: { id: scheduleId, madrasaId },
    include: {
      _count: {
        select: { attendanceRecords: true },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError('Schedule not found.');
  }

  const attendanceCount = existing._count.attendanceRecords;

  const targetClassId = updates.classId || existing.classId;
  const targetSubjectId = updates.subjectId || existing.subjectId;
  const targetDayOfWeek = updates.dayOfWeek || existing.dayOfWeek;
  const targetStartMinutes = updates.startMinutes !== undefined ? updates.startMinutes : existing.startMinutes;
  const targetEndMinutes = updates.endMinutes !== undefined ? updates.endMinutes : existing.endMinutes;
  const targetEffectiveFrom = updates.effectiveFrom ? parseDateOnly(updates.effectiveFrom) : existing.effectiveFrom;
  const targetEffectiveTo = updates.effectiveTo !== undefined
    ? (updates.effectiveTo ? parseDateOnly(updates.effectiveTo) : null)
    : existing.effectiveTo;
  const targetIsActive = updates.isActive !== undefined ? updates.isActive : existing.isActive;

  // If class or subject changed, verify they belong to tenant
  if (updates.classId && updates.classId !== existing.classId) {
    const c = await prisma.class.findFirst({ where: { id: updates.classId, madrasaId } });
    if (!c) throw new NotFoundError('Class not found.');
  }
  if (updates.subjectId && updates.subjectId !== existing.subjectId) {
    const s = await prisma.subject.findFirst({ where: { id: updates.subjectId, madrasaId } });
    if (!s) throw new NotFoundError('Subject not found.');
  }

  const coreSemanticsChanged =
    (updates.classId && updates.classId !== existing.classId) ||
    (updates.subjectId && updates.subjectId !== existing.subjectId) ||
    (updates.dayOfWeek && updates.dayOfWeek !== existing.dayOfWeek) ||
    (updates.startMinutes !== undefined && updates.startMinutes !== existing.startMinutes) ||
    (updates.endMinutes !== undefined && updates.endMinutes !== existing.endMinutes);

  // If schedule has attendance history or has already become effective, and core semantics changed:
  // PRESERVE HISTORICAL SCHEDULE: End-date the old schedule and create a new effective schedule.
  const hasHistory = attendanceCount > 0 || (existing.effectiveFrom <= new Date());
  if (hasHistory && coreSemanticsChanged) {
    // End date for old schedule: day before new schedule takes effect (or today - 1 day)
    const newFromDate = updates.effectiveFrom ? parseDateOnly(updates.effectiveFrom) : new Date();
    const oldEndDate = new Date(newFromDate.getTime() - 86400000);

    // Validate conflict for the new schedule
    await assertNoScheduleConflict(
      madrasaId,
      existing.ustadhId,
      targetDayOfWeek,
      targetStartMinutes,
      targetEndMinutes,
      newFromDate,
      targetEffectiveTo,
      existing.id,
      targetClassId
    );

    const result = await prisma.$transaction(async (tx) => {
      // 1. Close out old schedule
      await tx.ustadhSchedule.update({
        where: { id: existing.id },
        data: {
          effectiveTo: oldEndDate,
          isActive: false,
        },
      });

      // 2. Create new schedule
      const newSchedule = await tx.ustadhSchedule.create({
        data: {
          madrasaId,
          ustadhId: existing.ustadhId,
          classId: targetClassId,
          subjectId: targetSubjectId,
          dayOfWeek: targetDayOfWeek,
          startMinutes: targetStartMinutes,
          endMinutes: targetEndMinutes,
          effectiveFrom: newFromDate,
          effectiveTo: targetEffectiveTo,
          isActive: targetIsActive,
        },
        include: {
          ustadh: { select: { id: true, fullName: true, ustadhCode: true, staffType: true } },
          class: { select: { id: true, name: true, code: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
      });

      return newSchedule;
    });

    logTenantActivity({
      madrasaId,
      userId,
      action: 'USTADH_SCHEDULE_UPDATED',
      entityType: 'UstadhSchedule',
      entityId: result.id,
      metadata: { previousScheduleId: existing.id, preservedHistorical: true },
    }).catch(() => {});

    return formatScheduleResponse(result);
  }

  // Otherwise, no history or non-semantic update (e.g. effectiveTo/isActive only): update in place
  if (coreSemanticsChanged) {
    await assertNoScheduleConflict(
      madrasaId,
      existing.ustadhId,
      targetDayOfWeek,
      targetStartMinutes,
      targetEndMinutes,
      targetEffectiveFrom,
      targetEffectiveTo,
      existing.id,
      targetClassId
    );
  }

  const updated = await prisma.ustadhSchedule.update({
    where: { id: existing.id },
    data: {
      classId: targetClassId,
      subjectId: targetSubjectId,
      dayOfWeek: targetDayOfWeek,
      startMinutes: targetStartMinutes,
      endMinutes: targetEndMinutes,
      effectiveFrom: targetEffectiveFrom,
      effectiveTo: targetEffectiveTo,
      isActive: targetIsActive,
    },
    include: {
      ustadh: { select: { id: true, fullName: true, ustadhCode: true } },
      class: { select: { id: true, name: true, code: true } },
      subject: { select: { id: true, name: true, code: true } },
    },
  });

  logTenantActivity({
    madrasaId,
    userId,
    action: 'USTADH_SCHEDULE_UPDATED',
    entityType: 'UstadhSchedule',
    entityId: updated.id,
    metadata: { preservedHistorical: false },
  }).catch(() => {});

  return formatScheduleResponse(updated);
}

/**
 * Safely deactivates or deletes a schedule.
 * If attendance records exist, hard-delete is strictly blocked to preserve historical attendance.
 *
 * @param {string} madrasaId
 * @param {string} scheduleId
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function deleteOrDeactivateSchedule(madrasaId, scheduleId, userId) {
  const existing = await prisma.ustadhSchedule.findFirst({
    where: { id: scheduleId, madrasaId },
    include: {
      _count: {
        select: { attendanceRecords: true },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError('Schedule not found.');
  }

  if (existing._count.attendanceRecords > 0) {
    // Soft-deactivate to protect historical attendance integrity
    const updated = await prisma.ustadhSchedule.update({
      where: { id: existing.id },
      data: {
        isActive: false,
        effectiveTo: new Date(),
      },
    });

    logTenantActivity({
      madrasaId,
      userId,
      action: 'USTADH_SCHEDULE_DEACTIVATED',
      entityType: 'UstadhSchedule',
      entityId: existing.id,
      metadata: { reason: 'Preserving historical attendance records' },
    }).catch(() => {});

    return { success: true, deactivated: true, message: 'Schedule deactivated to preserve historical attendance records.' };
  }

  // No attendance: safe to delete
  await prisma.ustadhSchedule.delete({
    where: { id: existing.id },
  });

  logTenantActivity({
    madrasaId,
    userId,
    action: 'USTADH_SCHEDULE_DELETED',
    entityType: 'UstadhSchedule',
    entityId: existing.id,
  }).catch(() => {});

  return { success: true, deleted: true, message: 'Schedule deleted successfully.' };
}

/**
 * Formats database schedule record for API responses.
 *
 * @param {object} s
 * @returns {object}
 */
export function formatScheduleResponse(s) {
  return {
    id: s.id,
    madrasaId: s.madrasaId,
    ustadhId: s.ustadhId,
    classId: s.classId,
    subjectId: s.subjectId,
    dayOfWeek: s.dayOfWeek,
    startMinutes: s.startMinutes,
    endMinutes: s.endMinutes,
    effectiveFrom: formatDateOnly(s.effectiveFrom),
    effectiveTo: s.effectiveTo ? formatDateOnly(s.effectiveTo) : null,
    isActive: s.isActive,
    ustadh: s.ustadh,
    class: s.class,
    subject: s.subject,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}
