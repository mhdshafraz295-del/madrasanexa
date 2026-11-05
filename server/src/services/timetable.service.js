import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import { logTenantActivity } from './tenant.service.js';
import { parseDateOnly, formatDateOnly } from './ustadh.service.js';
import {
  doEffectiveDatesOverlap,
  doTimesOverlap,
  formatMinutesToDisplayTime,
} from './ustadh-schedule.service.js';
import { renderRawHtmlToPdf } from './pdf-report.service.js';
import { resolveLogoDataUri } from './branding.service.js';

export const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const WEEKDAY_ORDER = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
};

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Resolves a date string or defaults to today (date-only UTC).
 * @param {string|undefined} dateStr
 * @returns {Date}
 */
export function resolveReferenceDate(dateStr) {
  if (dateStr) {
    return parseDateOnly(dateStr);
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return parseDateOnly(`${year}-${month}-${day}`);
}

/**
 * Asserts that a break does not conflict with:
 * 1. Existing breaks for the same class on that day.
 * 2. Existing teaching sessions for the same class on that day.
 */
export async function assertNoBreakConflict(
  madrasaId,
  classId,
  dayOfWeek,
  startMinutes,
  endMinutes,
  effectiveFrom,
  effectiveTo,
  excludeBreakId = null
) {
  const candidate = { startMinutes, endMinutes, effectiveFrom, effectiveTo };

  // 1. Break vs Break conflict
  const existingBreaks = await prisma.timetableBreak.findMany({
    where: {
      madrasaId,
      classId,
      dayOfWeek,
      isActive: true,
      ...(excludeBreakId ? { id: { not: excludeBreakId } } : {}),
    },
  });

  for (const b of existingBreaks) {
    if (doEffectiveDatesOverlap(candidate, b) && doTimesOverlap(candidate, b)) {
      throw new BadRequestError(
        `This break overlaps with existing break "${b.name}" ` +
        `(${formatMinutesToDisplayTime(b.startMinutes)} - ${formatMinutesToDisplayTime(b.endMinutes)}).`
      );
    }
  }

  // 2. Break vs Teaching conflict
  const existingSchedules = await prisma.ustadhSchedule.findMany({
    where: {
      madrasaId,
      classId,
      dayOfWeek,
      isActive: true,
    },
    include: {
      subject: { select: { name: true } },
    },
  });

  for (const s of existingSchedules) {
    if (doEffectiveDatesOverlap(candidate, s) && doTimesOverlap(candidate, s)) {
      throw new BadRequestError(
        `This break overlaps with teaching session for ${s.subject.name} ` +
        `(${formatMinutesToDisplayTime(s.startMinutes)} - ${formatMinutesToDisplayTime(s.endMinutes)}).`
      );
    }
  }
}

/**
 * Creates a TimetableBreak.
 */
export async function createBreak(madrasaId, userId, data) {
  const targetClass = await prisma.class.findFirst({
    where: { id: data.classId, madrasaId },
  });
  if (!targetClass) {
    throw new NotFoundError('Class not found.');
  }

  const effectiveFrom = parseDateOnly(data.effectiveFrom);
  const effectiveTo = data.effectiveTo ? parseDateOnly(data.effectiveTo) : null;

  await assertNoBreakConflict(
    madrasaId,
    data.classId,
    data.dayOfWeek,
    data.startMinutes,
    data.endMinutes,
    effectiveFrom,
    effectiveTo
  );

  const newBreak = await prisma.timetableBreak.create({
    data: {
      madrasaId,
      classId: data.classId,
      name: data.name.trim(),
      dayOfWeek: data.dayOfWeek,
      startMinutes: data.startMinutes,
      endMinutes: data.endMinutes,
      effectiveFrom,
      effectiveTo,
      isActive: true,
    },
    include: {
      class: { select: { id: true, name: true, code: true } },
    },
  });

  logTenantActivity({
    madrasaId,
    userId,
    action: 'TIMETABLE_BREAK_CREATED',
    entityType: 'TimetableBreak',
    entityId: newBreak.id,
    metadata: {
      classId: data.classId,
      name: data.name,
      dayOfWeek: data.dayOfWeek,
      startMinutes: data.startMinutes,
      endMinutes: data.endMinutes,
    },
  }).catch(() => {});

  return formatBreakResponse(newBreak);
}

/**
 * Updates a TimetableBreak safely preserving historical integrity.
 */
export async function updateBreak(madrasaId, breakId, userId, updates) {
  const existing = await prisma.timetableBreak.findFirst({
    where: { id: breakId, madrasaId },
    include: { class: true },
  });
  if (!existing) {
    throw new NotFoundError('Break not found.');
  }

  const targetClassId = updates.classId || existing.classId;
  const targetName = updates.name ? updates.name.trim() : existing.name;
  const targetDayOfWeek = updates.dayOfWeek || existing.dayOfWeek;
  const targetStartMinutes = updates.startMinutes !== undefined ? updates.startMinutes : existing.startMinutes;
  const targetEndMinutes = updates.endMinutes !== undefined ? updates.endMinutes : existing.endMinutes;
  const targetEffectiveFrom = updates.effectiveFrom ? parseDateOnly(updates.effectiveFrom) : existing.effectiveFrom;
  const targetEffectiveTo = updates.effectiveTo !== undefined
    ? (updates.effectiveTo ? parseDateOnly(updates.effectiveTo) : null)
    : existing.effectiveTo;
  const targetIsActive = updates.isActive !== undefined ? updates.isActive : existing.isActive;

  if (updates.classId && updates.classId !== existing.classId) {
    const c = await prisma.class.findFirst({ where: { id: updates.classId, madrasaId } });
    if (!c) throw new NotFoundError('Class not found.');
  }

  const coreSemanticsChanged =
    (updates.classId && updates.classId !== existing.classId) ||
    (updates.dayOfWeek && updates.dayOfWeek !== existing.dayOfWeek) ||
    (updates.startMinutes !== undefined && updates.startMinutes !== existing.startMinutes) ||
    (updates.endMinutes !== undefined && updates.endMinutes !== existing.endMinutes);

  const hasHistory = existing.effectiveFrom <= new Date();

  // If already effective historically and core semantics changed, close out old break and create new one
  if (hasHistory && coreSemanticsChanged) {
    const newFromDate = updates.effectiveFrom ? parseDateOnly(updates.effectiveFrom) : new Date();
    const oldEndDate = new Date(newFromDate.getTime() - 86400000);

    await assertNoBreakConflict(
      madrasaId,
      targetClassId,
      targetDayOfWeek,
      targetStartMinutes,
      targetEndMinutes,
      newFromDate,
      targetEffectiveTo,
      existing.id
    );

    const result = await prisma.$transaction(async (tx) => {
      // 1. Close out old break
      await tx.timetableBreak.update({
        where: { id: existing.id },
        data: {
          effectiveTo: oldEndDate,
          isActive: false,
        },
      });

      // 2. Create new break
      const created = await tx.timetableBreak.create({
        data: {
          madrasaId,
          classId: targetClassId,
          name: targetName,
          dayOfWeek: targetDayOfWeek,
          startMinutes: targetStartMinutes,
          endMinutes: targetEndMinutes,
          effectiveFrom: newFromDate,
          effectiveTo: targetEffectiveTo,
          isActive: targetIsActive,
        },
        include: {
          class: { select: { id: true, name: true, code: true } },
        },
      });

      return created;
    });

    logTenantActivity({
      madrasaId,
      userId,
      action: 'TIMETABLE_BREAK_UPDATED',
      entityType: 'TimetableBreak',
      entityId: result.id,
      metadata: { previousBreakId: existing.id, preservedHistorical: true },
    }).catch(() => {});

    return formatBreakResponse(result);
  }

  // In-place update for future or non-semantic changes
  if (coreSemanticsChanged) {
    await assertNoBreakConflict(
      madrasaId,
      targetClassId,
      targetDayOfWeek,
      targetStartMinutes,
      targetEndMinutes,
      targetEffectiveFrom,
      targetEffectiveTo,
      existing.id
    );
  }

  const updated = await prisma.timetableBreak.update({
    where: { id: existing.id },
    data: {
      classId: targetClassId,
      name: targetName,
      dayOfWeek: targetDayOfWeek,
      startMinutes: targetStartMinutes,
      endMinutes: targetEndMinutes,
      effectiveFrom: targetEffectiveFrom,
      effectiveTo: targetEffectiveTo,
      isActive: targetIsActive,
    },
    include: {
      class: { select: { id: true, name: true, code: true } },
    },
  });

  logTenantActivity({
    madrasaId,
    userId,
    action: 'TIMETABLE_BREAK_UPDATED',
    entityType: 'TimetableBreak',
    entityId: updated.id,
    metadata: { preservedHistorical: false },
  }).catch(() => {});

  return formatBreakResponse(updated);
}

/**
 * Safely deactivates or closes a break.
 */
export async function deleteBreak(madrasaId, breakId, userId) {
  const existing = await prisma.timetableBreak.findFirst({
    where: { id: breakId, madrasaId },
  });
  if (!existing) {
    throw new NotFoundError('Break not found.');
  }

  const isHistorical = existing.effectiveFrom <= new Date();

  if (isHistorical) {
    // End-date the break as of yesterday so historical records remain intact
    const yesterday = new Date(Date.now() - 86400000);
    await prisma.timetableBreak.update({
      where: { id: existing.id },
      data: {
        effectiveTo: yesterday,
        isActive: false,
      },
    });
  } else {
    // If future-only, deactivate
    await prisma.timetableBreak.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
  }

  logTenantActivity({
    madrasaId,
    userId,
    action: 'TIMETABLE_BREAK_DEACTIVATED',
    entityType: 'TimetableBreak',
    entityId: existing.id,
    metadata: { isHistorical },
  }).catch(() => {});

  return { success: true, message: 'Break successfully deactivated.' };
}

/**
 * Lists breaks with optional filters.
 */
export async function listBreaks(madrasaId, query = {}) {
  const { classId, dayOfWeek, isActive } = query;
  const where = { madrasaId };

  if (classId) where.classId = classId;
  if (dayOfWeek) where.dayOfWeek = dayOfWeek;
  if (isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true' || isActive === true;
  }

  const items = await prisma.timetableBreak.findMany({
    where,
    orderBy: [
      { dayOfWeek: 'asc' },
      { startMinutes: 'asc' },
    ],
    include: {
      class: { select: { id: true, name: true, code: true } },
    },
  });

  return {
    items: items.map(formatBreakResponse),
    total: items.length,
  };
}

/**
 * Gets the Unified Class-wise Weekly Timetable.
 * Combines UstadhSchedule (Teaching) + TimetableBreak (Breaks)
 * Authoritative historical query: matches records effective on referenceDate.
 */
export async function getClassTimetable(madrasaId, query = {}) {
  const { classId, referenceDate } = query;

  const targetClass = await prisma.class.findFirst({
    where: { id: classId, madrasaId },
    select: { id: true, name: true, code: true },
  });
  if (!targetClass) {
    throw new NotFoundError('Class not found.');
  }

  const refDate = resolveReferenceDate(referenceDate);

  // Authoritative date condition:
  // effectiveFrom <= refDate AND (effectiveTo == null && isActive || effectiveTo >= refDate)
  const dateWhereCondition = {
    effectiveFrom: { lte: refDate },
    OR: [
      { effectiveTo: null, isActive: true },
      { effectiveTo: { gte: refDate } },
    ],
  };

  // 1. Fetch teaching sessions
  const schedules = await prisma.ustadhSchedule.findMany({
    where: {
      madrasaId,
      classId,
      ...dateWhereCondition,
    },
    include: {
      ustadh: { select: { id: true, fullName: true, ustadhCode: true, staffType: true } },
      subject: { select: { id: true, name: true, code: true } },
      class: { select: { id: true, name: true, code: true } },
    },
  });

  // 2. Fetch breaks
  const breaks = await prisma.timetableBreak.findMany({
    where: {
      madrasaId,
      classId,
      ...dateWhereCondition,
    },
    include: {
      class: { select: { id: true, name: true, code: true } },
    },
  });

  // 3. Normalize into Unified DTO entries
  const normalizedSchedules = schedules.map((s) => ({
    type: 'TEACHING',
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    startMinutes: s.startMinutes,
    endMinutes: s.endMinutes,
    class: s.class,
    subject: s.subject,
    staff: s.ustadh,
    effectiveFrom: formatDateOnly(s.effectiveFrom),
    effectiveTo: s.effectiveTo ? formatDateOnly(s.effectiveTo) : null,
  }));

  const normalizedBreaks = breaks.map((b) => ({
    type: 'BREAK',
    id: b.id,
    dayOfWeek: b.dayOfWeek,
    startMinutes: b.startMinutes,
    endMinutes: b.endMinutes,
    class: b.class,
    name: b.name,
    effectiveFrom: formatDateOnly(b.effectiveFrom),
    effectiveTo: b.effectiveTo ? formatDateOnly(b.effectiveTo) : null,
  }));

  // 4. Merge & Sort by day of week then start time
  const items = [...normalizedSchedules, ...normalizedBreaks].sort((a, b) => {
    const dayDiff = (WEEKDAY_ORDER[a.dayOfWeek] || 0) - (WEEKDAY_ORDER[b.dayOfWeek] || 0);
    if (dayDiff !== 0) return dayDiff;
    const timeDiff = a.startMinutes - b.startMinutes;
    if (timeDiff !== 0) return timeDiff;
    return a.endMinutes - b.endMinutes;
  });

  return {
    class: targetClass,
    referenceDate: formatDateOnly(refDate),
    items,
  };
}

/**
 * Gets Staff-wise Timetable.
 * Mandatory rule: Shows TEACHING sessions only. Does NOT mix unrelated class breaks.
 */
export async function getStaffTimetable(madrasaId, query = {}) {
  const { ustadhId, staffType, referenceDate } = query;
  const refDate = resolveReferenceDate(referenceDate);

  let selectedStaff = null;
  if (ustadhId) {
    selectedStaff = await prisma.ustadh.findFirst({
      where: { id: ustadhId, madrasaId },
      select: { id: true, fullName: true, ustadhCode: true, staffType: true },
    });
    if (!selectedStaff) {
      throw new NotFoundError('Teaching staff member not found.');
    }
  }

  const where = {
    madrasaId,
    effectiveFrom: { lte: refDate },
    OR: [
      { effectiveTo: null, isActive: true },
      { effectiveTo: { gte: refDate } },
    ],
  };

  if (ustadhId) {
    where.ustadhId = ustadhId;
  }
  if (staffType) {
    where.ustadh = { staffType };
  }

  const schedules = await prisma.ustadhSchedule.findMany({
    where,
    include: {
      ustadh: { select: { id: true, fullName: true, ustadhCode: true, staffType: true } },
      subject: { select: { id: true, name: true, code: true } },
      class: { select: { id: true, name: true, code: true } },
    },
    orderBy: [
      { dayOfWeek: 'asc' },
      { startMinutes: 'asc' },
    ],
  });

  const items = schedules
    .map((s) => ({
      type: 'TEACHING',
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startMinutes: s.startMinutes,
      endMinutes: s.endMinutes,
      class: s.class,
      subject: s.subject,
      staff: s.ustadh,
      effectiveFrom: formatDateOnly(s.effectiveFrom),
      effectiveTo: s.effectiveTo ? formatDateOnly(s.effectiveTo) : null,
    }))
    .sort((a, b) => {
      const dayDiff = (WEEKDAY_ORDER[a.dayOfWeek] || 0) - (WEEKDAY_ORDER[b.dayOfWeek] || 0);
      if (dayDiff !== 0) return dayDiff;
      return a.startMinutes - b.startMinutes;
    });

  return {
    staff: selectedStaff,
    referenceDate: formatDateOnly(refDate),
    items,
  };
}

/**
 * Gets Full Master Weekly Timetable across the entire Madrasa tenant.
 */
export async function getFullTimetable(madrasaId, query = {}) {
  const { referenceDate } = query;
  const refDate = resolveReferenceDate(referenceDate);

  const dateWhereCondition = {
    effectiveFrom: { lte: refDate },
    OR: [
      { effectiveTo: null, isActive: true },
      { effectiveTo: { gte: refDate } },
    ],
  };

  const [schedules, breaks] = await Promise.all([
    prisma.ustadhSchedule.findMany({
      where: {
        madrasaId,
        ...dateWhereCondition,
      },
      include: {
        ustadh: { select: { id: true, fullName: true, ustadhCode: true, staffType: true } },
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.timetableBreak.findMany({
      where: {
        madrasaId,
        ...dateWhereCondition,
      },
      include: {
        class: { select: { id: true, name: true, code: true } },
      },
    }),
  ]);

  const normalizedSchedules = schedules.map((s) => ({
    type: 'TEACHING',
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    startMinutes: s.startMinutes,
    endMinutes: s.endMinutes,
    class: s.class,
    subject: s.subject,
    staff: s.ustadh,
    effectiveFrom: formatDateOnly(s.effectiveFrom),
    effectiveTo: s.effectiveTo ? formatDateOnly(s.effectiveTo) : null,
  }));

  const normalizedBreaks = breaks.map((b) => ({
    type: 'BREAK',
    id: b.id,
    dayOfWeek: b.dayOfWeek,
    startMinutes: b.startMinutes,
    endMinutes: b.endMinutes,
    class: b.class,
    name: b.name,
    effectiveFrom: formatDateOnly(b.effectiveFrom),
    effectiveTo: b.effectiveTo ? formatDateOnly(b.effectiveTo) : null,
  }));

  const items = [...normalizedSchedules, ...normalizedBreaks].sort((a, b) => {
    const dayDiff = (WEEKDAY_ORDER[a.dayOfWeek] || 0) - (WEEKDAY_ORDER[b.dayOfWeek] || 0);
    if (dayDiff !== 0) return dayDiff;
    const timeDiff = a.startMinutes - b.startMinutes;
    if (timeDiff !== 0) return timeDiff;
    return a.endMinutes - b.endMinutes;
  });

  return {
    referenceDate: formatDateOnly(refDate),
    items,
  };
}

/**
 * Generates an institutional A4 Landscape PDF for a Class Timetable.
 * Renders an official weekly grid: TIME ROWS × DAY COLUMNS.
 * Predominantly white background, clean SOLID borders, centered dynamic Madrasa logo.
 */
export async function exportClassTimetablePdf(madrasaId, query = {}) {
  const timetableData = await getClassTimetable(madrasaId, query);
  const madrasa = await prisma.madrasa.findUnique({ where: { id: madrasaId } });

  let logoDataUri = null;
  try {
    logoDataUri = await resolveLogoDataUri(madrasaId);
  } catch (e) {
    logoDataUri = null;
  }

  const madrasaName = escapeHtml(madrasa?.name || 'Madrasa');
  const className = escapeHtml(timetableData.class.name);
  const classCode = timetableData.class.code ? escapeHtml(timetableData.class.code) : '';
  const refDateStr = escapeHtml(timetableData.referenceDate);

  // 1. Identify active days with sessions; omit excessive unused days
  const daysWithSessions = new Set(timetableData.items.map((it) => it.dayOfWeek));
  const activeDays = WEEKDAYS.filter((d) => daysWithSessions.has(d));
  const daysToRender = activeDays.length > 0
    ? activeDays
    : ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

  const dayLabels = {
    MONDAY: 'Monday',
    TUESDAY: 'Tuesday',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
    FRIDAY: 'Friday',
    SATURDAY: 'Saturday',
    SUNDAY: 'Sunday',
  };

  // 2. Extract unique time ranges (startMinutes, endMinutes) across all items
  const timeSlotMap = new Map();
  for (const it of timetableData.items) {
    const key = `${it.startMinutes}-${it.endMinutes}`;
    if (!timeSlotMap.has(key)) {
      timeSlotMap.set(key, { startMinutes: it.startMinutes, endMinutes: it.endMinutes });
    }
  }
  const timeSlots = Array.from(timeSlotMap.values()).sort((a, b) => {
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
    return a.endMinutes - b.endMinutes;
  });

  // 3. Build table header
  const theadHtml = `
    <tr>
      <th style="width: 140px; text-align: center;">TIME</th>
      ${daysToRender.map((d) => `<th style="text-align: center;">${escapeHtml(dayLabels[d])}</th>`).join('')}
    </tr>
  `;

  // 4. Build table rows
  let tbodyHtml = '';
  if (timeSlots.length === 0) {
    tbodyHtml = `
      <tr>
        <td colspan="${daysToRender.length + 1}" style="text-align: center; padding: 28px; color: #4B5563; font-style: italic;">
          No timetable sessions scheduled for this class on ${refDateStr}.
        </td>
      </tr>
    `;
  } else {
    tbodyHtml = timeSlots
      .map((slot) => {
        const timeLabel = `${formatMinutesToDisplayTime(slot.startMinutes)} – ${formatMinutesToDisplayTime(slot.endMinutes)}`;

        const cellsHtml = daysToRender
          .map((day) => {
            const session = timetableData.items.find(
              (it) => it.dayOfWeek === day && it.startMinutes === slot.startMinutes && it.endMinutes === slot.endMinutes
            );

            if (!session) {
              return '<td class="empty-cell"></td>';
            }

            if (session.type === 'BREAK') {
              return `
                <td class="break-cell">
                  <div class="break-title">${escapeHtml(session.name || 'INTERVAL')}</div>
                </td>
              `;
            }

            return `
              <td class="teaching-cell">
                <div class="subject-title">${escapeHtml(session.subject?.name || '')}</div>
                <div class="staff-name">${escapeHtml(session.staff?.fullName || '')}</div>
              </td>
            `;
          })
          .join('');

        return `
          <tr>
            <td class="time-cell">${timeLabel}</td>
            ${cellsHtml}
          </tr>
        `;
      })
      .join('');
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Class Timetable - ${className}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 10mm 12mm 8mm 12mm;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Noto Sans Local', 'Noto Sans Arabic Local', 'Noto Sans Tamil Local', 'Noto Sans Sinhala Local', sans-serif;
          color: #111827;
          background: #FFFFFF;
          font-size: 11px;
          line-height: 1.35;
        }
        .header-container {
          text-align: center;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1.5px solid #374151;
        }
        .header-logo {
          height: 60px;
          max-width: 160px;
          object-fit: contain;
          margin: 0 auto 6px auto;
          display: block;
        }
        .madrasa-name {
          font-size: 18px;
          font-weight: 800;
          color: #111827;
          letter-spacing: -0.2px;
          text-transform: uppercase;
          line-height: 1.2;
          margin-bottom: 3px;
        }
        .timetable-title {
          font-size: 13px;
          font-weight: 700;
          color: #374151;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        .meta-bar {
          font-size: 11px;
          color: #4B5563;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .meta-bar strong {
          color: #111827;
        }
        .meta-dot {
          color: #9CA3AF;
        }
        .table-container {
          width: 100%;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          border: 1.5px solid #374151;
          background: #FFFFFF;
          table-layout: fixed;
        }
        th, td {
          border: 1px solid #374151;
          padding: 8px 6px;
          vertical-align: middle;
          box-sizing: border-box;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        th {
          background-color: #F3F4F6;
          color: #111827;
          font-weight: 700;
          font-size: 11px;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .time-cell {
          background-color: #F9FAFB;
          font-weight: 700;
          font-size: 10px;
          text-align: center;
          color: #111827;
          white-space: nowrap;
          width: 135px;
        }
        .teaching-cell {
          background-color: #FFFFFF;
          text-align: center;
        }
        .subject-title {
          font-size: 11px;
          font-weight: 800;
          color: #111827;
          line-height: 1.25;
        }
        .staff-name {
          font-size: 9.5px;
          font-weight: 400;
          color: #374151;
          margin-top: 3px;
          line-height: 1.2;
        }
        .break-cell {
          background-color: #F3F4F6;
          text-align: center;
        }
        .break-title {
          font-size: 10px;
          font-weight: 700;
          color: #1F2937;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .empty-cell {
          background-color: #FFFFFF;
        }
        .footer {
          margin-top: 10px;
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #6B7280;
          padding-top: 6px;
          border-top: 1px solid #E5E7EB;
        }
      </style>
    </head>
    <body>
      <div class="header-container">
        ${logoDataUri ? `<img src="${logoDataUri}" class="header-logo" alt="Madrasa Logo" />` : ''}
        <div class="madrasa-name">${madrasaName}</div>
        <div class="timetable-title">WEEKLY CLASS TIMETABLE</div>
        <div class="meta-bar">
          <span>Class: <strong>${className}${classCode ? ` (${classCode})` : ''}</strong></span>
          <span class="meta-dot">•</span>
          <span>Effective Date: <strong>${refDateStr}</strong></span>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            ${theadHtml}
          </thead>
          <tbody>
            ${tbodyHtml}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <div>Generated by MadrasaNexa Timetable Management</div>
        <div>Date: ${new Date().toLocaleDateString()}</div>
      </div>
    </body>
    </html>
  `;

  return await renderRawHtmlToPdf({ html, landscape: true });
}

/**
 * Generates an institutional A4 Portrait PDF for a Teacher / Ustadh Timetable.
 * Shows teaching sessions only. Clean solid borders and centered dynamic logo.
 */
export async function exportStaffTimetablePdf(madrasaId, query = {}) {
  const timetableData = await getStaffTimetable(madrasaId, query);
  const madrasa = await prisma.madrasa.findUnique({ where: { id: madrasaId } });

  let logoDataUri = null;
  try {
    logoDataUri = await resolveLogoDataUri(madrasaId);
  } catch (e) {
    logoDataUri = null;
  }

  const madrasaName = escapeHtml(madrasa?.name || 'Madrasa');
  const staffName = escapeHtml(timetableData.staff?.fullName || 'All Teaching Staff');
  const staffTypeBadge = timetableData.staff?.staffType === 'SCHOOL_TEACHER' ? 'School Teacher' : 'Ustadh';
  const refDateStr = escapeHtml(timetableData.referenceDate);

  const rowsHtml = timetableData.items.length === 0
    ? '<tr><td colspan="4" style="text-align: center; padding: 24px; color: #4B5563; font-style: italic;">No teaching sessions scheduled for this staff member.</td></tr>'
    : timetableData.items.map((it) => `
        <tr>
          <td style="font-weight: 700; color: #111827; text-align: center;">${escapeHtml(it.dayOfWeek)}</td>
          <td style="font-weight: 600; color: #111827; text-align: center;">${formatMinutesToDisplayTime(it.startMinutes)} – ${formatMinutesToDisplayTime(it.endMinutes)}</td>
          <td style="font-weight: 600; color: #111827;">${escapeHtml(it.class.name)}</td>
          <td style="font-weight: 700; color: #111827;">${escapeHtml(it.subject.name)}</td>
        </tr>
      `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Staff Timetable - ${staffName}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Noto Sans Local', 'Noto Sans Arabic Local', 'Noto Sans Tamil Local', 'Noto Sans Sinhala Local', sans-serif;
          color: #111827;
          background: #FFFFFF;
          font-size: 11px;
          line-height: 1.4;
        }
        .header-container {
          text-align: center;
          margin-bottom: 14px;
          padding-bottom: 8px;
          border-bottom: 1.5px solid #374151;
        }
        .header-logo {
          height: 60px;
          max-width: 160px;
          object-fit: contain;
          margin: 0 auto 6px auto;
          display: block;
        }
        .madrasa-name {
          font-size: 18px;
          font-weight: 800;
          color: #111827;
          letter-spacing: -0.2px;
          text-transform: uppercase;
          line-height: 1.2;
          margin-bottom: 3px;
        }
        .timetable-title {
          font-size: 13px;
          font-weight: 700;
          color: #374151;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        .meta-bar {
          font-size: 11px;
          color: #4B5563;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .meta-bar strong {
          color: #111827;
        }
        .meta-dot {
          color: #9CA3AF;
        }
        .table-container {
          margin-top: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          border: 1.5px solid #374151;
          background: #FFFFFF;
        }
        thead th {
          background: #F3F4F6;
          color: #111827;
          font-weight: 700;
          padding: 8px 10px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border: 1px solid #374151;
        }
        tbody td {
          padding: 8px 10px;
          border: 1px solid #374151;
          font-size: 11px;
        }
        .footer {
          margin-top: 20px;
          border-top: 1px solid #E5E7EB;
          padding-top: 6px;
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #6B7280;
        }
      </style>
    </head>
    <body>
      <div class="header-container">
        ${logoDataUri ? `<img src="${logoDataUri}" class="header-logo" alt="Madrasa Logo" />` : ''}
        <div class="madrasa-name">${madrasaName}</div>
        <div class="timetable-title">TEACHING STAFF TIMETABLE</div>
        <div class="meta-bar">
          <span>Staff: <strong>${staffName}</strong> (${staffTypeBadge})</span>
          <span class="meta-dot">•</span>
          <span>Effective Date: <strong>${refDateStr}</strong></span>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 110px;">Day</th>
              <th style="width: 140px;">Time Slot</th>
              <th>Class</th>
              <th>Subject</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <div>Generated by MadrasaNexa Timetable Management</div>
        <div>Date: ${new Date().toLocaleDateString()}</div>
      </div>
    </body>
    </html>
  `;

  return await renderRawHtmlToPdf({ html, landscape: false });
}

/**
 * Generates an institutional A4 Landscape PDF for the Full Weekly Timetable.
 * Clean solid borders, centered dynamic logo, minimal colours.
 */
export async function exportFullTimetablePdf(madrasaId, query = {}) {
  const timetableData = await getFullTimetable(madrasaId, query);
  const madrasa = await prisma.madrasa.findUnique({ where: { id: madrasaId } });

  let logoDataUri = null;
  try {
    logoDataUri = await resolveLogoDataUri(madrasaId);
  } catch (e) {
    logoDataUri = null;
  }

  const madrasaName = escapeHtml(madrasa?.name || 'Madrasa');
  const refDateStr = escapeHtml(timetableData.referenceDate);

  const rowsHtml = timetableData.items.length === 0
    ? '<tr><td colspan="5" style="text-align: center; padding: 24px; color: #4B5563; font-style: italic;">No timetable sessions scheduled across this Madrasa.</td></tr>'
    : timetableData.items.map((it) => {
        if (it.type === 'BREAK') {
          return `
            <tr style="background: #F3F4F6;">
              <td style="font-weight: 700; color: #111827; text-align: center;">${escapeHtml(it.dayOfWeek)}</td>
              <td style="font-weight: 600; color: #111827; text-align: center;">${formatMinutesToDisplayTime(it.startMinutes)} – ${formatMinutesToDisplayTime(it.endMinutes)}</td>
              <td style="font-weight: 600; color: #111827;">${escapeHtml(it.class.name)}</td>
              <td colspan="2" style="font-weight: 700; color: #1F2937; text-transform: uppercase; text-align: center;">[BREAK] ${escapeHtml(it.name)}</td>
            </tr>
          `;
        }
        const staffTypeLabel = it.staff.staffType === 'SCHOOL_TEACHER' ? 'Teacher' : 'Ustadh';
        return `
          <tr>
            <td style="font-weight: 700; color: #111827; text-align: center;">${escapeHtml(it.dayOfWeek)}</td>
            <td style="font-weight: 600; color: #111827; text-align: center;">${formatMinutesToDisplayTime(it.startMinutes)} – ${formatMinutesToDisplayTime(it.endMinutes)}</td>
            <td style="font-weight: 600; color: #111827;">${escapeHtml(it.class.name)}</td>
            <td style="font-weight: 700; color: #111827;">${escapeHtml(it.subject.name)}</td>
            <td>${escapeHtml(it.staff.fullName)} <span style="font-size: 8.5px; color: #4B5563;">(${staffTypeLabel})</span></td>
          </tr>
        `;
      }).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Full Weekly Timetable</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 10mm 12mm 8mm 12mm;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Noto Sans Local', 'Noto Sans Arabic Local', 'Noto Sans Tamil Local', 'Noto Sans Sinhala Local', sans-serif;
          color: #111827;
          background: #FFFFFF;
          font-size: 11px;
          line-height: 1.35;
        }
        .header-container {
          text-align: center;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1.5px solid #374151;
        }
        .header-logo {
          height: 60px;
          max-width: 160px;
          object-fit: contain;
          margin: 0 auto 6px auto;
          display: block;
        }
        .madrasa-name {
          font-size: 18px;
          font-weight: 800;
          color: #111827;
          letter-spacing: -0.2px;
          text-transform: uppercase;
          line-height: 1.2;
          margin-bottom: 3px;
        }
        .timetable-title {
          font-size: 13px;
          font-weight: 700;
          color: #374151;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        .meta-bar {
          font-size: 11px;
          color: #4B5563;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .meta-bar strong {
          color: #111827;
        }
        .meta-dot {
          color: #9CA3AF;
        }
        .table-container {
          width: 100%;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          border: 1.5px solid #374151;
          background: #FFFFFF;
        }
        thead th {
          background: #F3F4F6;
          color: #111827;
          font-weight: 700;
          padding: 8px 10px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border: 1px solid #374151;
        }
        tbody td {
          padding: 8px 10px;
          border: 1px solid #374151;
          font-size: 11px;
        }
        .footer {
          margin-top: 10px;
          border-top: 1px solid #E5E7EB;
          padding-top: 6px;
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #6B7280;
        }
      </style>
    </head>
    <body>
      <div class="header-container">
        ${logoDataUri ? `<img src="${logoDataUri}" class="header-logo" alt="Madrasa Logo" />` : ''}
        <div class="madrasa-name">${madrasaName}</div>
        <div class="timetable-title">FULL MASTER WEEKLY TIMETABLE</div>
        <div class="meta-bar">
          <span>Reference Date: <strong>${refDateStr}</strong></span>
          <span class="meta-dot">•</span>
          <span>Total Sessions: <strong>${timetableData.items.length}</strong></span>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 110px;">Day</th>
              <th style="width: 140px;">Time Slot</th>
              <th>Class</th>
              <th>Subject / Activity</th>
              <th>Teaching Staff</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <div>Generated by MadrasaNexa Master Timetable</div>
        <div>Date: ${new Date().toLocaleDateString()}</div>
      </div>
    </body>
    </html>
  `;

  return await renderRawHtmlToPdf({ html, landscape: true });
}

function formatBreakResponse(b) {
  return {
    id: b.id,
    madrasaId: b.madrasaId,
    classId: b.classId,
    name: b.name,
    dayOfWeek: b.dayOfWeek,
    startMinutes: b.startMinutes,
    endMinutes: b.endMinutes,
    effectiveFrom: formatDateOnly(b.effectiveFrom),
    effectiveTo: b.effectiveTo ? formatDateOnly(b.effectiveTo) : null,
    isActive: b.isActive,
    class: b.class,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

/**
 * Generates an institutional A4 Portrait PDF for a staff member strictly from
 * finalized immutable snapshot data, avoiding live mutable schedule reads.
 */
export async function exportStaffTimetableSnapshotPdf(madrasaId, { staffName, staffType, effectiveDate, sessions }) {
  const madrasa = await prisma.madrasa.findUnique({ where: { id: madrasaId } });

  let logoDataUri = null;
  try {
    logoDataUri = await resolveLogoDataUri(madrasaId);
  } catch (e) {
    logoDataUri = null;
  }

  const madrasaName = escapeHtml(madrasa?.name || 'Madrasa');
  const safeStaffName = escapeHtml(staffName || 'Staff Member');
  const staffTypeBadge = staffType === 'SCHOOL_TEACHER' ? 'School Teacher' : 'Ustadh';
  const refDateStr = escapeHtml(effectiveDate || 'Finalized');

  // Sort sessions deterministically
  const sortedSessions = [...(sessions || [])].sort((a, b) => {
    const dayDiff = (WEEKDAY_ORDER[a.dayOfWeek] || 99) - (WEEKDAY_ORDER[b.dayOfWeek] || 99);
    if (dayDiff !== 0) return dayDiff;
    return a.startMinutes - b.startMinutes;
  });

  const rowsHtml = sortedSessions.length === 0
    ? '<tr><td colspan="4" style="text-align: center; padding: 24px; color: #4B5563; font-style: italic;">No teaching sessions scheduled for this staff member as of this publication.</td></tr>'
    : sortedSessions.map((it) => `
        <tr>
          <td style="font-weight: 700; color: #111827; text-align: center;">${escapeHtml(it.dayOfWeek)}</td>
          <td style="font-weight: 600; color: #111827; text-align: center;">${formatMinutesToDisplayTime(it.startMinutes)} – ${formatMinutesToDisplayTime(it.endMinutes)}</td>
          <td style="font-weight: 600; color: #111827;">${escapeHtml(it.className || 'Class')}</td>
          <td style="font-weight: 700; color: #111827;">${escapeHtml(it.subjectName || 'Subject')}</td>
        </tr>
      `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Staff Timetable - ${safeStaffName}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Noto Sans Local', 'Noto Sans Arabic Local', 'Noto Sans Tamil Local', 'Noto Sans Sinhala Local', sans-serif;
          color: #111827;
          background: #FFFFFF;
          font-size: 11px;
          line-height: 1.4;
        }
        .header-container {
          text-align: center;
          margin-bottom: 14px;
          padding-bottom: 8px;
          border-bottom: 1.5px solid #374151;
        }
        .header-logo {
          height: 60px;
          max-width: 160px;
          object-fit: contain;
          margin: 0 auto 6px auto;
          display: block;
        }
        .madrasa-name {
          font-size: 18px;
          font-weight: 800;
          color: #111827;
          letter-spacing: -0.2px;
          text-transform: uppercase;
          line-height: 1.2;
          margin-bottom: 3px;
        }
        .timetable-title {
          font-size: 13px;
          font-weight: 700;
          color: #374151;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        .meta-bar {
          font-size: 11px;
          color: #4B5563;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .meta-bar strong { color: #111827; }
        .meta-dot { color: #9CA3AF; }
        .table-container { margin-top: 10px; }
        table {
          width: 100%;
          border-collapse: collapse;
          border: 1.5px solid #374151;
          background: #FFFFFF;
        }
        thead th {
          background: #F3F4F6;
          color: #111827;
          font-weight: 700;
          padding: 8px 10px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border: 1px solid #374151;
        }
        tbody td {
          padding: 8px 10px;
          border: 1px solid #374151;
          font-size: 11px;
        }
        .footer {
          margin-top: 20px;
          border-top: 1px solid #E5E7EB;
          padding-top: 6px;
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #6B7280;
        }
      </style>
    </head>
    <body>
      <div class="header-container">
        ${logoDataUri ? `<img src="${logoDataUri}" class="header-logo" alt="Madrasa Logo" />` : ''}
        <div class="madrasa-name">${madrasaName}</div>
        <div class="timetable-title">FINALIZED TEACHING STAFF TIMETABLE</div>
        <div class="meta-bar">
          <span>Staff: <strong>${safeStaffName}</strong> (${staffTypeBadge})</span>
          <span class="meta-dot">•</span>
          <span>Effective Date: <strong>${refDateStr}</strong></span>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 110px;">Day</th>
              <th style="width: 140px;">Time Slot</th>
              <th>Class</th>
              <th>Subject</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <div>Generated by MadrasaNexa Official Publication</div>
        <div>Date: ${new Date().toLocaleDateString()}</div>
      </div>
    </body>
    </html>
  `;

  return await renderRawHtmlToPdf({ html, landscape: false });
}

/**
 * Finalizes teaching timetable, generates immutable snapshots, and atomically queues
 * notification jobs if email delivery was requested.
 */
export async function finalizeTimetable(madrasaId, payload, userId) {
  const { idempotencyKey, effectiveDate, sendEmail, recipientScope, selectedStaffIds, notes } = payload;
  const effDate = parseDateOnly(effectiveDate);

  // 1. Compute requestHash strictly from normalized request parameters ONLY
  const canonicalRequest = JSON.stringify({
    effectiveDate,
    sendEmail: Boolean(sendEmail),
    recipientScope,
    selectedStaffIds: selectedStaffIds ? [...selectedStaffIds].sort() : null,
  });
  const requestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');

  // 2. Pre-check existing publication by madrasaId + idempotencyKey
  const existing = await prisma.timetablePublication.findUnique({
    where: { madrasaId_idempotencyKey: { madrasaId, idempotencyKey } },
    include: { publishedBy: { select: { id: true, name: true, email: true } } },
  });

  if (existing) {
    if (existing.requestHash === requestHash) {
      return existing; // Clean idempotent replay
    }
    throw new ConflictError('IDEMPOTENCY_KEY_REUSE: Idempotency key reuse with different parameters.');
  }

  // 3. Validate selectedStaffIds for scope SELECTED_STAFF
  let canonicalSelectedIds = null;
  if (recipientScope === 'SELECTED_STAFF') {
    canonicalSelectedIds = Array.from(new Set(selectedStaffIds || [])).sort();
    if (canonicalSelectedIds.length === 0) {
      throw new BadRequestError('At least one staff member must be selected for SELECTED_STAFF scope.');
    }
    const staffCount = await prisma.ustadh.count({
      where: { id: { in: canonicalSelectedIds }, madrasaId },
    });
    if (staffCount !== canonicalSelectedIds.length) {
      throw new NotFoundError('One or more selected staff members not found.');
    }
  }

  // 4. Live schedule read & snapshot creation
  const activeStaff = await prisma.ustadh.findMany({
    where: { madrasaId, isActive: true },
    select: { id: true, fullName: true, ustadhCode: true, email: true, staffType: true },
    orderBy: { fullName: 'asc' },
  });

  const schedules = await prisma.ustadhSchedule.findMany({
    where: {
      madrasaId,
      isActive: true,
      effectiveFrom: { lte: effDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effDate } }],
    },
    include: {
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
    },
  });

  // Group schedules by staff and build canonical snapshot
  const scheduleSnapshotJson = {};
  for (const staff of activeStaff) {
    const staffSchedules = schedules
      .filter((s) => s.ustadhId === staff.id)
      .map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startMinutes: s.startMinutes,
        endMinutes: s.endMinutes,
        classId: s.class.id,
        className: s.class.name,
        subjectId: s.subject.id,
        subjectName: s.subject.name,
      }))
      .sort((a, b) => {
        const dayDiff = (WEEKDAY_ORDER[a.dayOfWeek] || 99) - (WEEKDAY_ORDER[b.dayOfWeek] || 99);
        if (dayDiff !== 0) return dayDiff;
        return a.startMinutes - b.startMinutes;
      });

    const staffFingerprint = crypto.createHash('sha256').update(JSON.stringify(staffSchedules)).digest('hex');

    scheduleSnapshotJson[staff.id] = {
      staffId: staff.id,
      staffName: staff.fullName,
      staffType: staff.staffType,
      email: staff.email ? staff.email.trim().toLowerCase() : null,
      fingerprint: staffFingerprint,
      sessions: staffSchedules,
    };
  }

  // Deterministic global schedule fingerprint
  const scheduleFingerprint = crypto.createHash('sha256').update(JSON.stringify(scheduleSnapshotJson)).digest('hex');

  // 5. Query deterministic previous publication (effectiveDate <= effDate, excluding current)
  const previousPublication = await prisma.timetablePublication.findFirst({
    where: {
      madrasaId,
      effectiveDate: { lte: effDate },
    },
    orderBy: [
      { effectiveDate: 'desc' },
      { publishedAt: 'desc' },
    ],
  });

  // 6. Determine target staff based on recipientScope
  let targetStaff = [];
  if (recipientScope === 'ALL_TEACHING_STAFF') {
    targetStaff = activeStaff;
  } else if (recipientScope === 'USTADH_ONLY') {
    targetStaff = activeStaff.filter((s) => s.staffType === 'USTADH');
  } else if (recipientScope === 'SCHOOL_TEACHER_ONLY') {
    targetStaff = activeStaff.filter((s) => s.staffType === 'SCHOOL_TEACHER');
  } else if (recipientScope === 'SELECTED_STAFF') {
    targetStaff = activeStaff.filter((s) => canonicalSelectedIds.includes(s.id));
  } else if (recipientScope === 'AFFECTED_STAFF_ONLY') {
    if (!previousPublication || !previousPublication.scheduleSnapshotJson) {
      // First publication: active staff with >= 1 session are affected
      targetStaff = activeStaff.filter((s) => (scheduleSnapshotJson[s.id]?.sessions || []).length > 0);
    } else {
      const prevSnapshot = previousPublication.scheduleSnapshotJson;
      // Union of active staff
      targetStaff = activeStaff.filter((s) => {
        const prevFingerprint = prevSnapshot[s.id]?.fingerprint || 'NONE';
        const currFingerprint = scheduleSnapshotJson[s.id]?.fingerprint || 'NONE';
        return prevFingerprint !== currFingerprint;
      });
    }
  }

  // 7. Atomic Prisma Transaction (with P2002 concurrent race recovery)
  try {
    return await prisma.$transaction(async (tx) => {
      // In-tx idempotency check
      const inTxExisting = await tx.timetablePublication.findUnique({
        where: { madrasaId_idempotencyKey: { madrasaId, idempotencyKey } },
        include: { publishedBy: { select: { id: true, name: true, email: true } } },
      });
      if (inTxExisting) {
        if (inTxExisting.requestHash === requestHash) {
          return inTxExisting;
        }
        throw new ConflictError('IDEMPOTENCY_KEY_REUSE: Idempotency key reuse with different parameters.');
      }

      let queuedCount = 0;
      let skippedCount = 0;

      // Pre-calculate counts if sendEmail is true
      if (sendEmail) {
        for (const staff of targetStaff) {
          const email = staff.email ? staff.email.trim().toLowerCase() : null;
          if (email) {
            queuedCount++;
          } else {
            skippedCount++;
          }
        }
      }

      const publication = await tx.timetablePublication.create({
        data: {
          madrasaId,
          idempotencyKey,
          requestHash,
          effectiveDate: effDate,
          sendEmail: Boolean(sendEmail),
          recipientScope,
          selectedStaffIdsJson: canonicalSelectedIds,
          staffCount: targetStaff.length,
          queuedCount,
          skippedCount,
          scheduleFingerprint,
          scheduleSnapshotJson,
          notes: notes ? notes.trim() : null,
          publishedById: userId,
          publishedAt: new Date(),
        },
        include: { publishedBy: { select: { id: true, name: true, email: true } } },
      });

      // Create recipient NotificationJobs atomically
      if (sendEmail) {
        for (const staff of targetStaff) {
          const email = staff.email ? staff.email.trim().toLowerCase() : null;
          const staffSessions = scheduleSnapshotJson[staff.id]?.sessions || [];

          if (email) {
            const dedupeKey = `TIMETABLE_FINALIZED:EMAIL:${publication.id}:${staff.id}:${email}`;
            await tx.notificationJob.create({
              data: {
                madrasaId,
                channel: 'EMAIL',
                eventType: 'TIMETABLE_FINALIZED',
                recipientType: 'STAFF',
                recipientEntityId: staff.id,
                recipientAddress: email,
                recipientName: staff.fullName,
                subject: `Teaching Timetable Finalized — Effective ${effectiveDate}`,
                message: `Your teaching timetable has been finalized and published, effective from ${effectiveDate}. Total sessions: ${staffSessions.length}.`,
                payloadJson: {
                  publicationId: publication.id,
                  staffId: staff.id,
                  effectiveDate,
                  sessionCount: staffSessions.length,
                },
                relatedEntityType: 'TimetablePublication',
                relatedEntityId: publication.id,
                dedupeKey,
                status: 'PENDING',
              },
            });
          } else {
            const dedupeKey = `TIMETABLE_FINALIZED:EMAIL:${publication.id}:${staff.id}:NO_RECIPIENT`;
            await tx.notificationJob.create({
              data: {
                madrasaId,
                channel: 'EMAIL',
                eventType: 'TIMETABLE_FINALIZED',
                recipientType: 'STAFF',
                recipientEntityId: staff.id,
                recipientAddress: null,
                recipientName: staff.fullName,
                subject: `Teaching Timetable Finalized — Effective ${effectiveDate}`,
                message: `Your teaching timetable has been finalized and published, effective from ${effectiveDate}.`,
                payloadJson: {
                  publicationId: publication.id,
                  staffId: staff.id,
                  effectiveDate,
                  sessionCount: staffSessions.length,
                },
                relatedEntityType: 'TimetablePublication',
                relatedEntityId: publication.id,
                dedupeKey,
                status: 'SKIPPED_NO_RECIPIENT',
              },
            });
          }
        }

        await tx.activityLog.create({
          data: {
            madrasaId,
            userId,
            action: 'TIMETABLE_EMAILS_QUEUED',
            entityType: 'TimetablePublication',
            entityId: publication.id,
            metadata: {
              publicationId: publication.id,
              queuedCount,
              skippedCount,
              recipientScope,
            },
          },
        });
      }

      await tx.activityLog.create({
        data: {
          madrasaId,
          userId,
          action: 'TIMETABLE_FINALIZED',
          entityType: 'TimetablePublication',
          entityId: publication.id,
          metadata: {
            publicationId: publication.id,
            effectiveDate,
            sendEmail: Boolean(sendEmail),
            recipientScope,
            staffCount: targetStaff.length,
            fingerprint: scheduleFingerprint,
          },
        },
      });

      return publication;
    });
  } catch (err) {
    // Handle concurrent P2002 race recovery gracefully
    if (err?.code === 'P2002' || err?.message?.includes('P2002') || err?.message?.includes('idempotencyKey')) {
      const raceExisting = await prisma.timetablePublication.findUnique({
        where: { madrasaId_idempotencyKey: { madrasaId, idempotencyKey } },
        include: { publishedBy: { select: { id: true, name: true, email: true } } },
      });
      if (raceExisting) {
        if (raceExisting.requestHash === requestHash) {
          return raceExisting; // Concurrent twin returned cleanly
        }
        throw new ConflictError('IDEMPOTENCY_KEY_REUSE: Idempotency key reuse with different parameters.');
      }
    }
    throw err;
  }
}
