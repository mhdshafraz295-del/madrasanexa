import { prisma } from '../lib/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logTenantActivity } from './tenant.service.js';
import { parseDateOnly, formatDateOnly } from './ustadh.service.js';

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/**
 * Returns the Weekday enum for a given UTC midnight Date.
 *
 * @param {Date} dateObj
 * @returns {string} MONDAY | TUESDAY | etc.
 */
export function getWeekdayFromDate(dateObj) {
  const dayIndex = dateObj.getUTCDay();
  return WEEKDAYS[dayIndex];
}

/**
 * Loads staff attendance roster for a specific calendar date.
 * For existing attendance dates, preserves and returns all historical saved records.
 * For new sessions, loads active schedules effective on that date.
 *
 * @param {string} madrasaId
 * @param {string} dateStr
 * @returns {Promise<object>}
 */
export async function getStaffDailyAttendance(madrasaId, dateStr) {
  const attendanceDate = parseDateOnly(dateStr);
  const weekday = getWeekdayFromDate(attendanceDate);

  // 1. Fetch existing saved attendance records for this date
  const existingRecords = await prisma.ustadhAttendanceRecord.findMany({
    where: {
      madrasaId,
      attendanceDate,
    },
    include: {
      schedule: {
        include: {
          ustadh: { select: { id: true, fullName: true, ustadhCode: true, staffType: true, phoneNumber: true, whatsappNumber: true } },
          class: { select: { id: true, name: true, code: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  const existingMap = new Map();
  for (const rec of existingRecords) {
    existingMap.set(rec.scheduleId, rec);
  }

  // 2. Fetch all schedules effective for this date matching this weekday
  const activeSchedules = await prisma.ustadhSchedule.findMany({
    where: {
      madrasaId,
      dayOfWeek: weekday,
      isActive: true,
      effectiveFrom: { lte: attendanceDate },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: attendanceDate } },
      ],
      ustadh: {
        isActive: true,
        joinDate: { lte: attendanceDate },
        OR: [
          { leaveDate: null },
          { leaveDate: { gte: attendanceDate } },
        ],
      },
    },
    include: {
      ustadh: { select: { id: true, fullName: true, ustadhCode: true, staffType: true, phoneNumber: true, whatsappNumber: true } },
      class: { select: { id: true, name: true, code: true } },
      subject: { select: { id: true, name: true, code: true } },
    },
    orderBy: { startMinutes: 'asc' },
  });

  // Combine: Include all currently active scheduled sessions AND any historical records
  // that were saved previously on this date (even if schedule was later end-dated)
  const allSessionsMap = new Map();

  for (const s of activeSchedules) {
    allSessionsMap.set(s.id, {
      scheduleId: s.id,
      ustadhId: s.ustadh.id,
      ustadhName: s.ustadh.fullName,
      ustadhCode: s.ustadh.ustadhCode,
      staffType: s.ustadh.staffType || 'USTADH',
      phoneNumber: s.ustadh.phoneNumber,
      whatsappNumber: s.ustadh.whatsappNumber,
      classId: s.class.id,
      className: s.class.name,
      subjectId: s.subject.id,
      subjectName: s.subject.name,
      startMinutes: s.startMinutes,
      endMinutes: s.endMinutes,
      status: null, // UI: NOT_MARKED
      isSaved: false,
    });
  }

  // Overlay existing saved records
  for (const rec of existingRecords) {
    const s = rec.schedule;
    allSessionsMap.set(rec.scheduleId, {
      scheduleId: s.id,
      ustadhId: s.ustadh.id,
      ustadhName: s.ustadh.fullName,
      ustadhCode: s.ustadh.ustadhCode,
      staffType: s.ustadh?.staffType || 'USTADH',
      phoneNumber: s.ustadh.phoneNumber,
      whatsappNumber: s.ustadh.whatsappNumber,
      classId: s.class.id,
      className: s.class.name,
      subjectId: s.subject.id,
      subjectName: s.subject.name,
      startMinutes: s.startMinutes,
      endMinutes: s.endMinutes,
      status: rec.status,
      isSaved: true,
      updatedAt: rec.updatedAt,
    });
  }

  const sessions = Array.from(allSessionsMap.values());
  sessions.sort((a, b) => a.startMinutes - b.startMinutes);

  const presentCount = sessions.filter((s) => s.status === 'PRESENT').length;
  const absentCount = sessions.filter((s) => s.status === 'ABSENT').length;
  const notMarkedCount = sessions.filter((s) => s.status === null).length;
  const isSaved = existingRecords.length > 0;

  return {
    date: dateStr,
    weekday,
    isSaved,
    summary: {
      totalScheduled: sessions.length,
      presentCount,
      absentCount,
      notMarkedCount,
      attendanceRate: sessions.length > 0 ? (presentCount / sessions.length) * 100 : 0.0,
    },
    sessions,
  };
}

/**
 * Saves staff attendance for multiple sessions on a date atomically.
 *
 * @param {string} madrasaId
 * @param {string} userId
 * @param {{ date: string, records: Array<{ scheduleId: string, status: 'PRESENT'|'ABSENT' }> }} payload
 * @returns {Promise<object>}
 */
export async function saveStaffDailyAttendance(madrasaId, userId, payload) {
  const { date: dateStr, records } = payload;
  const attendanceDate = parseDateOnly(dateStr);

  // Validate that all schedule IDs belong to this tenant
  const scheduleIds = records.map((r) => r.scheduleId);
  const schedules = await prisma.ustadhSchedule.findMany({
    where: {
      id: { in: scheduleIds },
      madrasaId,
    },
    select: { id: true, ustadhId: true },
  });

  const scheduleMap = new Map(schedules.map((s) => [s.id, s]));

  for (const r of records) {
    if (!scheduleMap.has(r.scheduleId)) {
      throw new BadRequestError(`Schedule ID "${r.scheduleId}" does not exist in this Madrasa.`);
    }
  }

  // Atomic upsert transaction
  await prisma.$transaction(async (tx) => {
    for (const r of records) {
      const schedule = scheduleMap.get(r.scheduleId);

      await tx.ustadhAttendanceRecord.upsert({
        where: {
          scheduleId_attendanceDate: {
            scheduleId: r.scheduleId,
            attendanceDate,
          },
        },
        create: {
          madrasaId,
          ustadhId: schedule.ustadhId,
          scheduleId: r.scheduleId,
          attendanceDate,
          status: r.status,
          recordedById: userId,
        },
        update: {
          status: r.status,
          recordedById: userId,
        },
      });
    }
  });

  logTenantActivity({
    madrasaId,
    userId,
    action: 'USTADH_ATTENDANCE_SAVED',
    entityType: 'UstadhAttendanceRecord',
    entityId: dateStr,
    metadata: { date: dateStr, totalSessions: records.length },
  }).catch(() => {});

  return await getStaffDailyAttendance(madrasaId, dateStr);
}

/**
 * Retrieves paginated staff attendance history with filters.
 *
 * @param {string} madrasaId
 * @param {object} query
 * @returns {Promise<object>}
 */
export async function getAttendanceHistory(madrasaId, query = {}) {
  const { ustadhId, classId, startDate, endDate, status, page = 1, pageSize = 20 } = query;
  const where = { madrasaId };

  if (ustadhId) where.ustadhId = ustadhId;
  if (classId) where.schedule = { classId };
  if (status) where.status = status;

  if (startDate || endDate) {
    where.attendanceDate = {};
    if (startDate) where.attendanceDate.gte = parseDateOnly(startDate);
    if (endDate) where.attendanceDate.lte = parseDateOnly(endDate);
  }

  const [total, items] = await Promise.all([
    prisma.ustadhAttendanceRecord.count({ where }),
    prisma.ustadhAttendanceRecord.findMany({
      where,
      orderBy: [{ attendanceDate: 'desc' }, { schedule: { startMinutes: 'asc' } }],
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      include: {
        ustadh: { select: { id: true, fullName: true, ustadhCode: true } },
        schedule: {
          include: {
            class: { select: { id: true, name: true, code: true } },
            subject: { select: { id: true, name: true, code: true } },
          },
        },
      },
    }),
  ]);

  return {
    items: items.map((rec) => ({
      id: rec.id,
      date: formatDateOnly(rec.attendanceDate),
      status: rec.status,
      ustadh: rec.ustadh,
      schedule: {
        id: rec.schedule.id,
        dayOfWeek: rec.schedule.dayOfWeek,
        startMinutes: rec.schedule.startMinutes,
        endMinutes: rec.schedule.endMinutes,
        class: rec.schedule.class,
        subject: rec.schedule.subject,
      },
      updatedAt: rec.updatedAt,
    })),
    total,
    page: Number(page),
    pageSize: Number(pageSize),
    totalPages: Math.ceil(total / Number(pageSize)) || 1,
  };
}

/**
 * Calculates monthly attendance summary per Ustadh.
 * Invariant: Missing attendance is NOT treated as absent.
 * Denominator is strictly totalRecordedSessions.
 *
 * @param {string} madrasaId
 * @param {{ month: string, ustadhId?: string }} query
 * @returns {Promise<object>}
 */
export async function getMonthlyAttendanceSummary(madrasaId, query) {
  const { month: monthStr, ustadhId } = query;
  const [year, month] = monthStr.split('-').map(Number);
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endOfMonth = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59, 999));

  const where = {
    madrasaId,
    attendanceDate: {
      gte: startOfMonth,
      lte: endOfMonth,
    },
  };

  if (ustadhId) where.ustadhId = ustadhId;

  // Fetch all attendance records in month
  const records = await prisma.ustadhAttendanceRecord.findMany({
    where,
    include: {
      ustadh: { select: { id: true, fullName: true, ustadhCode: true, staffType: true } },
    },
  });

  // Group by ustadhId
  const summaryMap = new Map();

  for (const rec of records) {
    let entry = summaryMap.get(rec.ustadhId);
    if (!entry) {
      entry = {
        ustadhId: rec.ustadh.id,
        ustadhName: rec.ustadh.fullName,
        ustadhCode: rec.ustadh.ustadhCode,
        staffType: rec.ustadh.staffType || 'USTADH',
        recordedSessions: 0,
        presentSessions: 0,
        absentSessions: 0,
        attendancePercentage: 0.0,
      };
      summaryMap.set(rec.ustadhId, entry);
    }

    entry.recordedSessions++;
    if (rec.status === 'PRESENT') entry.presentSessions++;
    else if (rec.status === 'ABSENT') entry.absentSessions++;
  }

  // Calculate percentages
  const items = Array.from(summaryMap.values()).map((e) => {
    e.attendancePercentage = e.recordedSessions > 0
      ? (e.presentSessions / e.recordedSessions) * 100
      : 0.0;
    return e;
  });

  items.sort((a, b) => a.ustadhCode.localeCompare(b.ustadhCode));

  return {
    month: monthStr,
    totalRecords: records.length,
    items,
  };
}
