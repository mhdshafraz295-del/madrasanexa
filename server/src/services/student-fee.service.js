import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { assertTenantOwnership } from '../lib/tenant-prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';

/**
 * Resolves the effective monthly fee for a student for an arbitrary target date.
 *
 * MANDATORY CORRECTION 1:
 * StudentFeeSetting is the SOLE source of truth for date-based fee resolution.
 * Student.monthlyFee is NOT a historical fallback.
 *
 * Priority:
 * 1. StudentFeeSetting interval containing targetDate:
 *    effectiveFrom <= targetDate AND (effectiveTo IS NULL OR targetDate < effectiveTo)
 * 2. Assigned Class.defaultMonthlyFee
 * 3. null / UNCONFIGURED
 *
 * @param {string} studentId
 * @param {string} madrasaId
 * @param {Date|string} [targetDate=new Date()]
 * @returns {Promise<{ effectiveMonthlyFee: string|null, feeSource: 'STUDENT_OVERRIDE'|'CLASS_DEFAULT'|'UNCONFIGURED', settingId?: string, classId?: string, className?: string }>}
 */
export async function getEffectiveStudentFee(studentId, madrasaId, targetDate = new Date(), db = prisma) {
  const dateObj = targetDate instanceof Date ? targetDate : new Date(targetDate);

  // 1. Check StudentFeeSetting for the target date interval
  const overrideSetting = await db.studentFeeSetting.findFirst({
    where: {
      madrasaId,
      studentId,
      effectiveFrom: { lte: dateObj },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gt: dateObj } },
      ],
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  if (overrideSetting) {
    return {
      effectiveMonthlyFee: Number(overrideSetting.amount).toFixed(2),
      feeSource: 'STUDENT_OVERRIDE',
      settingId: overrideSetting.id,
    };
  }

  // 2. No override for target date: use assigned Class default fee
  const student = await db.student.findFirst({
    where: { id: studentId, madrasaId },
    select: {
      class: {
        select: {
          id: true,
          name: true,
          defaultMonthlyFee: true,
        },
      },
    },
  });

  if (student?.class?.defaultMonthlyFee !== undefined && student.class.defaultMonthlyFee !== null) {
    return {
      effectiveMonthlyFee: Number(student.class.defaultMonthlyFee).toFixed(2),
      feeSource: 'CLASS_DEFAULT',
      classId: student.class.id,
      className: student.class.name,
    };
  }

  // 3. Unassigned or no default fee configured
  return {
    effectiveMonthlyFee: null,
    feeSource: 'UNCONFIGURED',
  };
}

/**
 * Fetches the chronological fee history for a student.
 *
 * @param {string} studentId
 * @param {string} madrasaId
 * @returns {Promise<Array<object>>}
 */
export async function getStudentFeeHistory(studentId, madrasaId) {
  await assertTenantOwnership(prisma.student, studentId, madrasaId);

  const settings = await prisma.studentFeeSetting.findMany({
    where: {
      madrasaId,
      studentId,
    },
    orderBy: [
      { effectiveFrom: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  const now = new Date();

  return settings.map((s) => ({
    id: s.id,
    amount: Number(s.amount).toFixed(2),
    effectiveFrom: s.effectiveFrom,
    effectiveTo: s.effectiveTo,
    reason: s.reason,
    isCurrent: s.effectiveFrom <= now && (s.effectiveTo === null || s.effectiveTo > now),
    createdAt: s.createdAt,
  }));
}

/**
 * Sets a student-specific fee override with deterministic interval insertion.
 *
 * MANDATORY CORRECTIONS 2, 3, 4:
 * 1. Checks exact duplicate effectiveFrom (both service check and DB constraint catch).
 * 2. Finds adjacent settings before and after effectiveFrom.
 * 3. Sets new.effectiveTo = next.effectiveFrom (if next exists).
 * 4. Sets prev.effectiveTo = new.effectiveFrom (if prev was open or extended past new).
 * 5. Recomputes Student.monthlyFee to reflect the override active NOW.
 *
 * @param {string} studentId
 * @param {string} madrasaId
 * @param {{ amount: string|number, effectiveFrom: Date, reason?: string|null }} data
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function setStudentFeeOverride(studentId, madrasaId, data, userId) {
  await assertTenantOwnership(prisma.student, studentId, madrasaId);

  const { amount, effectiveFrom, reason } = data;
  const now = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      // Check for exact duplicate effectiveFrom
      const existingExact = await tx.studentFeeSetting.findFirst({
        where: {
          madrasaId,
          studentId,
          effectiveFrom,
        },
      });

      if (existingExact) {
        throw new ConflictError('A fee override setting with this exact effective date already exists.');
      }

      // Find next setting after effectiveFrom (earliest future setting)
      const nextSetting = await tx.studentFeeSetting.findFirst({
        where: {
          madrasaId,
          studentId,
          effectiveFrom: { gt: effectiveFrom },
        },
        orderBy: { effectiveFrom: 'asc' },
      });

      // Find previous setting before effectiveFrom (latest past setting)
      const prevSetting = await tx.studentFeeSetting.findFirst({
        where: {
          madrasaId,
          studentId,
          effectiveFrom: { lt: effectiveFrom },
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      // If prev setting exists and was open or overlapping past new effectiveFrom, close it
      if (prevSetting && (prevSetting.effectiveTo === null || prevSetting.effectiveTo > effectiveFrom)) {
        await tx.studentFeeSetting.update({
          where: { id: prevSetting.id },
          data: { effectiveTo: effectiveFrom },
        });
      }

      // Determine effectiveTo for the new setting
      const newEffectiveTo = nextSetting ? nextSetting.effectiveFrom : null;

      // Insert new StudentFeeSetting
      const newSetting = await tx.studentFeeSetting.create({
        data: {
          madrasaId,
          studentId,
          amount: new Prisma.Decimal(amount),
          effectiveFrom,
          effectiveTo: newEffectiveTo,
          reason: reason || null,
        },
      });

      // Recompute Student.monthlyFee based strictly on what is active NOW
      const activeNowSetting = await tx.studentFeeSetting.findFirst({
        where: {
          madrasaId,
          studentId,
          effectiveFrom: { lte: now },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gt: now } },
          ],
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      const currentMonthlyFee = activeNowSetting ? activeNowSetting.amount : null;

      await tx.student.update({
        where: { id: studentId },
        data: { monthlyFee: currentMonthlyFee },
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          madrasaId,
          userId: userId || null,
          action: 'STUDENT_FEE_OVERRIDE_SET',
          entityType: 'STUDENT',
          entityId: studentId,
          metadata: {
            settingId: newSetting.id,
            amount: newSetting.amount.toString(),
            effectiveFrom: newSetting.effectiveFrom.toISOString(),
            effectiveTo: newSetting.effectiveTo ? newSetting.effectiveTo.toISOString() : null,
            reason: newSetting.reason,
          },
        },
      });

      return {
        id: newSetting.id,
        studentId,
        amount: newSetting.amount.toString(),
        effectiveFrom: newSetting.effectiveFrom,
        effectiveTo: newSetting.effectiveTo,
        reason: newSetting.reason,
        activeNow: activeNowSetting?.id === newSetting.id,
      };
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new ConflictError('A fee override setting with this exact effective date already exists.');
    }
    throw error;
  }
}

/**
 * Reverts student fee to class default starting at an explicit effective date.
 *
 * MANDATORY CORRECTIONS 3, 8:
 * - Accepts explicit effectiveDate (default now).
 * - Closes setting active at effectiveDate.
 * - Does NOT prematurely clear today's override if effectiveDate is in the future.
 * - Preserves any future settings that begin after effectiveDate.
 *
 * @param {string} studentId
 * @param {string} madrasaId
 * @param {{ effectiveDate?: Date, reason?: string|null }} data
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function useClassDefaultFee(studentId, madrasaId, data = {}, userId) {
  await assertTenantOwnership(prisma.student, studentId, madrasaId);

  const effectiveDate = data.effectiveDate || new Date();
  const reason = data.reason || null;
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    // Find setting active at the effectiveDate and close it
    const activeAtTarget = await tx.studentFeeSetting.findFirst({
      where: {
        madrasaId,
        studentId,
        effectiveFrom: { lte: effectiveDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gt: effectiveDate } },
        ],
      },
    });

    if (activeAtTarget) {
      await tx.studentFeeSetting.update({
        where: { id: activeAtTarget.id },
        data: { effectiveTo: effectiveDate },
      });
    }

    // Recompute Student.monthlyFee for NOW
    const activeNowSetting = await tx.studentFeeSetting.findFirst({
      where: {
        madrasaId,
        studentId,
        effectiveFrom: { lte: now },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gt: now } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    await tx.student.update({
      where: { id: studentId },
      data: { monthlyFee: activeNowSetting ? activeNowSetting.amount : null },
    });

    // Log activity
    await tx.activityLog.create({
      data: {
        madrasaId,
        userId: userId || null,
        action: 'STUDENT_FEE_CLASS_DEFAULT_RESTORED',
        entityType: 'STUDENT',
        entityId: studentId,
        metadata: {
          effectiveDate: effectiveDate.toISOString(),
          reason,
        },
      },
    });

    return {
      success: true,
      message: 'Reverted to class default fee.',
      effectiveDate,
      activeNowFeeSource: activeNowSetting ? 'STUDENT_OVERRIDE' : 'CLASS_DEFAULT',
      currentMonthlyFee: activeNowSetting ? activeNowSetting.amount.toString() : null,
    };
  });
}
