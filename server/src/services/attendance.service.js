import { prisma } from '../lib/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logTenantActivity } from './tenant.service.js';
import {
  calculateDailySummary,
  calculateStudentAttendancePercentage,
  calculateMonthlyClassAttendanceRate,
  calculateAverageDailyAttendanceRate,
} from './attendance-calculation.service.js';
import { renderRawHtmlToPdf, embeddedFontsCss } from './pdf-report.service.js';
import { resolveLogoDataUri } from './branding.service.js';
import { generateCsvString } from './csv-report.service.js';

/**
 * Parses YYYY-MM-DD into a UTC midnight Date object.
 * Prevents timezone date shifting.
 *
 * @param {string} dateStr
 * @returns {Date}
 */
export function parseDateOnly(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new BadRequestError('Invalid date format. Expected YYYY-MM-DD.');
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (isNaN(date.getTime())) {
    throw new BadRequestError('Invalid calendar date.');
  }
  return date;
}

/**
 * Formats a Date object as YYYY-MM-DD using UTC values.
 *
 * @param {Date|string} date
 * @returns {string}
 */
export function formatDateOnly(date) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Escapes HTML entities for safe PDF rendering.
 */
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
 * Loads daily attendance for a Class and Date.
 *
 * Invariants:
 * - If session already exists: returns historically recorded students and their saved statuses.
 * - If new session: evaluates eligible students as of attendanceDate (admissionDate <= attendanceDate).
 *
 * @param {string} madrasaId
 * @param {{ classId: string, academicYear: string, date: string }} params
 * @returns {Promise<object>}
 */
export async function getClassDailyAttendance(madrasaId, { classId, academicYear, date: dateStr }) {
  const targetClass = await prisma.class.findFirst({
    where: { id: classId, madrasaId },
    select: { id: true, name: true, code: true },
  });

  if (!targetClass) {
    throw new NotFoundError('Class not found.');
  }

  const attendanceDate = parseDateOnly(dateStr);

  // Check if session already exists
  const existingSession = await prisma.attendanceSession.findUnique({
    where: {
      madrasaId_classId_attendanceDate: {
        madrasaId,
        classId,
        attendanceDate,
      },
    },
    include: {
      records: {
        include: {
          student: {
            select: {
              id: true,
              admissionNo: true,
              fullName: true,
              status: true,
            },
          },
        },
        orderBy: {
          student: { admissionNo: 'asc' },
        },
      },
    },
  });

  if (existingSession) {
    const records = existingSession.records.map((rec) => ({
      studentId: rec.studentId,
      admissionNo: rec.student.admissionNo,
      fullName: rec.student.fullName,
      status: rec.status,
    }));

    const summary = calculateDailySummary(records);

    return {
      isSaved: true,
      sessionId: existingSession.id,
      classId: targetClass.id,
      className: targetClass.name,
      academicYear: existingSession.academicYear,
      date: dateStr,
      updatedAt: existingSession.updatedAt,
      summary,
      students: records,
    };
  }

  // New session: find active students admitted on or before this attendanceDate
  const endOfDayUtc = new Date(Date.UTC(
    attendanceDate.getUTCFullYear(),
    attendanceDate.getUTCMonth(),
    attendanceDate.getUTCDate(),
    23, 59, 59, 999
  ));

  const eligibleStudents = await prisma.student.findMany({
    where: {
      madrasaId,
      classId,
      status: 'ACTIVE',
      admissionDate: { lte: endOfDayUtc },
    },
    orderBy: { admissionNo: 'asc' },
    select: {
      id: true,
      admissionNo: true,
      fullName: true,
    },
  });

  const students = eligibleStudents.map((st) => ({
    studentId: st.id,
    admissionNo: st.admissionNo,
    fullName: st.fullName,
    status: null, // UI state: NOT_MARKED
  }));

  return {
    isSaved: false,
    sessionId: null,
    classId: targetClass.id,
    className: targetClass.name,
    academicYear,
    date: dateStr,
    updatedAt: null,
    summary: {
      totalStudents: students.length,
      presentCount: 0,
      absentCount: 0,
      attendanceRate: 0.0,
    },
    students,
  };
}

/**
 * Saves daily attendance in a single atomic transaction.
 *
 * Rules:
 * - Every eligible student must be marked PRESENT or ABSENT (no NOT_MARKED persisted).
 * - Re-saving preserves valid historical records.
 * - Idempotent upsert of session and records.
 *
 * @param {string} madrasaId
 * @param {string} userId
 * @param {{ classId: string, academicYear: string, date: string, records: Array<{ studentId: string, status: 'PRESENT' | 'ABSENT' }> }} payload
 * @returns {Promise<object>}
 */
export async function saveClassDailyAttendance(madrasaId, userId, payload) {
  const { classId, academicYear, date: dateStr, records } = payload;

  const targetClass = await prisma.class.findFirst({
    where: { id: classId, madrasaId },
    select: { id: true, name: true },
  });

  if (!targetClass) {
    throw new NotFoundError('Class not found.');
  }

  const attendanceDate = parseDateOnly(dateStr);

  // 1. Check duplicate student IDs in payload
  const payloadStudentIds = new Set();
  for (const r of records) {
    if (payloadStudentIds.has(r.studentId)) {
      throw new BadRequestError(`Duplicate student ID (${r.studentId}) in attendance payload.`);
    }
    payloadStudentIds.add(r.studentId);
    if (r.status !== 'PRESENT' && r.status !== 'ABSENT') {
      throw new BadRequestError(`Invalid status for student (${r.studentId}). Must be PRESENT or ABSENT.`);
    }
  }

  // 2. Determine authoritative eligible students for this date
  const existingSession = await prisma.attendanceSession.findUnique({
    where: {
      madrasaId_classId_attendanceDate: {
        madrasaId,
        classId,
        attendanceDate,
      },
    },
    include: {
      records: { select: { studentId: true } },
    },
  });

  let eligibleStudentIds = new Set();
  if (existingSession && existingSession.records.length > 0) {
    // Existing session preserves historically recorded students
    eligibleStudentIds = new Set(existingSession.records.map((r) => r.studentId));
  } else {
    // New session uses date-aware active students
    const endOfDayUtc = new Date(Date.UTC(
      attendanceDate.getUTCFullYear(),
      attendanceDate.getUTCMonth(),
      attendanceDate.getUTCDate(),
      23, 59, 59, 999
    ));

    const eligible = await prisma.student.findMany({
      where: {
        madrasaId,
        classId,
        status: 'ACTIVE',
        admissionDate: { lte: endOfDayUtc },
      },
      select: { id: true },
    });
    eligibleStudentIds = new Set(eligible.map((s) => s.id));
  }

  // 3. Verify completeness: all eligible students must be present in records
  if (records.length !== eligibleStudentIds.size) {
    throw new BadRequestError(
      `Attendance payload must contain all ${eligibleStudentIds.size} eligible students for this session. Received ${records.length}.`
    );
  }

  for (const studentId of eligibleStudentIds) {
    if (!payloadStudentIds.has(studentId)) {
      throw new BadRequestError(`Missing attendance record for eligible student (${studentId}). All students must be marked.`);
    }
  }

  for (const r of records) {
    if (!eligibleStudentIds.has(r.studentId)) {
      throw new BadRequestError(`Ineligible or cross-class student (${r.studentId}) included in attendance payload.`);
    }
  }

  // 4. Atomic transaction upsert
  const result = await prisma.$transaction(async (tx) => {
    // Upsert session
    const session = await tx.attendanceSession.upsert({
      where: {
        madrasaId_classId_attendanceDate: {
          madrasaId,
          classId,
          attendanceDate,
        },
      },
      create: {
        madrasaId,
        classId,
        academicYear,
        attendanceDate,
        createdById: userId,
      },
      update: {
        academicYear,
      },
    });

    // Upsert each record (does NOT delete valid historical records)
    for (const r of records) {
      await tx.attendanceRecord.upsert({
        where: {
          sessionId_studentId: {
            sessionId: session.id,
            studentId: r.studentId,
          },
        },
        create: {
          madrasaId,
          sessionId: session.id,
          studentId: r.studentId,
          status: r.status,
        },
        update: {
          status: r.status,
        },
      });
    }

    return session;
  });

  const isUpdate = Boolean(existingSession);

  // Audit log
  logTenantActivity({
    madrasaId,
    userId,
    action: isUpdate ? 'ATTENDANCE_UPDATED' : 'ATTENDANCE_CREATED',
    entityType: 'AttendanceSession',
    entityId: result.id,
    metadata: {
      classId,
      className: targetClass.name,
      academicYear,
      date: dateStr,
      totalStudents: records.length,
    },
  }).catch(() => {});

  return await getClassDailyAttendance(madrasaId, { classId, academicYear, date: dateStr });
}

/**
 * Retrieves paginated attendance history for a class.
 *
 * @param {string} madrasaId
 * @param {{ classId: string, academicYear?: string, startDate?: string, endDate?: string, page: number, pageSize: number }} query
 * @returns {Promise<object>}
 */
export async function getAttendanceHistory(madrasaId, query) {
  const { classId, academicYear, startDate, endDate, page = 1, pageSize = 30 } = query;

  const targetClass = await prisma.class.findFirst({
    where: { id: classId, madrasaId },
    select: { id: true, name: true },
  });

  if (!targetClass) {
    throw new NotFoundError('Class not found.');
  }

  const where = {
    madrasaId,
    classId,
  };

  if (academicYear) {
    where.academicYear = academicYear;
  }

  if (startDate || endDate) {
    where.attendanceDate = {};
    if (startDate) where.attendanceDate.gte = parseDateOnly(startDate);
    if (endDate) where.attendanceDate.lte = parseDateOnly(endDate);
  }

  const [total, sessions] = await Promise.all([
    prisma.attendanceSession.count({ where }),
    prisma.attendanceSession.findMany({
      where,
      orderBy: { attendanceDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        records: {
          select: { status: true },
        },
      },
    }),
  ]);

  const items = sessions.map((s) => {
    const summary = calculateDailySummary(s.records);
    return {
      id: s.id,
      date: formatDateOnly(s.attendanceDate),
      academicYear: s.academicYear,
      totalStudents: summary.totalStudents,
      presentCount: summary.presentCount,
      absentCount: summary.absentCount,
      attendanceRate: summary.attendanceRate,
      updatedAt: s.updatedAt,
    };
  });

  return {
    classId: targetClass.id,
    className: targetClass.name,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
    items,
  };
}

/**
 * Calculates monthly attendance summary for a class.
 *
 * Invariants:
 * - totalStudents = unique students with at least 1 record in the month.
 * - monthlyClassRate = totalPresent / totalRecorded * 100.
 * - averageDailyRate = mean of daily session rates.
 * - student percentage uses only actual recorded sessions for that student.
 *
 * @param {string} madrasaId
 * @param {{ classId: string, academicYear?: string, month: string }} query
 * @returns {Promise<object>}
 */
export async function getMonthlySummary(madrasaId, query) {
  const { classId, academicYear, month: monthStr } = query;

  const targetClass = await prisma.class.findFirst({
    where: { id: classId, madrasaId },
    select: { id: true, name: true },
  });

  if (!targetClass) {
    throw new NotFoundError('Class not found.');
  }

  const [yearNum, monthNum] = monthStr.split('-').map(Number);
  const startOfMonth = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0, 0));
  const lastDay = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();
  const endOfMonth = new Date(Date.UTC(yearNum, monthNum - 1, lastDay, 23, 59, 59, 999));

  const where = {
    madrasaId,
    classId,
    attendanceDate: {
      gte: startOfMonth,
      lte: endOfMonth,
    },
  };

  if (academicYear) {
    where.academicYear = academicYear;
  }

  const sessions = await prisma.attendanceSession.findMany({
    where,
    orderBy: { attendanceDate: 'asc' },
    include: {
      records: {
        include: {
          student: {
            select: {
              id: true,
              admissionNo: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  const totalAttendanceDays = sessions.length;
  let totalPresentRecordsInMonth = 0;
  let totalRecordedRecordsInMonth = 0;
  const dailyRates = [];

  // Map of studentId -> { studentId, admissionNo, fullName, presentDays, absentDays, recordedDays }
  const studentMap = new Map();

  for (const session of sessions) {
    const dailySummary = calculateDailySummary(session.records);
    dailyRates.push(dailySummary.attendanceRate);

    for (const rec of session.records) {
      totalRecordedRecordsInMonth++;
      if (rec.status === 'PRESENT') totalPresentRecordsInMonth++;

      let entry = studentMap.get(rec.studentId);
      if (!entry) {
        entry = {
          studentId: rec.student.id,
          admissionNo: rec.student.admissionNo,
          fullName: rec.student.fullName,
          presentDays: 0,
          absentDays: 0,
          recordedDays: 0,
          attendancePercentage: 0.0,
        };
        studentMap.set(rec.studentId, entry);
      }

      entry.recordedDays++;
      if (rec.status === 'PRESENT') entry.presentDays++;
      else if (rec.status === 'ABSENT') entry.absentDays++;
    }
  }

  // Calculate student percentages
  const studentsList = Array.from(studentMap.values()).map((st) => {
    st.attendancePercentage = calculateStudentAttendancePercentage(st.presentDays, st.recordedDays);
    return st;
  });

  studentsList.sort((a, b) => a.admissionNo.localeCompare(b.admissionNo));

  const monthlyClassRate = calculateMonthlyClassAttendanceRate(
    totalPresentRecordsInMonth,
    totalRecordedRecordsInMonth
  );

  const averageDailyRate = calculateAverageDailyAttendanceRate(dailyRates);
  const highestDailyRate = dailyRates.length > 0 ? Math.max(...dailyRates) : 0.0;
  const lowestDailyRate = dailyRates.length > 0 ? Math.min(...dailyRates) : 0.0;

  return {
    classId: targetClass.id,
    className: targetClass.name,
    month: monthStr,
    academicYear: academicYear || (sessions[0]?.academicYear ?? ''),
    summary: {
      totalAttendanceDays,
      totalStudents: studentMap.size, // Unique students in month (Correction 7)
      monthlyClassRate,
      averageDailyRate,
      highestDailyRate,
      lowestDailyRate,
      totalPresentRecords: totalPresentRecordsInMonth,
      totalRecordedRecords: totalRecordedRecordsInMonth,
    },
    students: studentsList,
  };
}

/**
 * Retrieves attendance profile and full record history for an individual student.
 *
 * @param {string} madrasaId
 * @param {string} studentId
 * @param {{ academicYear?: string }} query
 * @returns {Promise<object>}
 */
export async function getStudentAttendanceSummary(madrasaId, studentId, query = {}) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, madrasaId },
    include: {
      class: { select: { id: true, name: true } },
    },
  });

  if (!student) {
    throw new NotFoundError('Student not found.');
  }

  const where = {
    madrasaId,
    studentId,
  };

  if (query.academicYear) {
    where.session = { academicYear: query.academicYear };
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: {
      session: {
        select: {
          id: true,
          attendanceDate: true,
          academicYear: true,
          class: { select: { name: true } },
        },
      },
    },
    orderBy: {
      session: { attendanceDate: 'desc' },
    },
  });

  let presentDays = 0;
  let absentDays = 0;

  const history = records.map((r) => {
    if (r.status === 'PRESENT') presentDays++;
    else if (r.status === 'ABSENT') absentDays++;

    return {
      id: r.id,
      sessionId: r.sessionId,
      date: formatDateOnly(r.session.attendanceDate),
      academicYear: r.session.academicYear,
      className: r.session.class?.name || student.class?.name || 'Class',
      status: r.status,
    };
  });

  const recordedDays = records.length;
  const attendancePercentage = calculateStudentAttendancePercentage(presentDays, recordedDays);

  return {
    student: {
      id: student.id,
      admissionNo: student.admissionNo,
      fullName: student.fullName,
      className: student.class?.name || 'Unassigned',
      status: student.status,
    },
    summary: {
      presentDays,
      absentDays,
      recordedDays,
      attendancePercentage,
    },
    history,
  };
}

/**
 * Generates an institutional branded A4 PDF report for a daily attendance session.
 *
 * @param {string} madrasaId
 * @param {{ classId: string, academicYear: string, date: string }} params
 * @returns {Promise<Buffer>}
 */
export async function generateDailyAttendancePdf(madrasaId, params) {
  const data = await getClassDailyAttendance(madrasaId, params);
  const madrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
  });

  let logoDataUri = null;
  try {
    logoDataUri = await resolveLogoDataUri(madrasaId);
  } catch (e) {
    logoDataUri = null;
  }

  const madrasaName = escapeHtml(madrasa?.name || 'Madrasa');
  const madrasaAddress = escapeHtml(madrasa?.address || '');
  const madrasaPhone = escapeHtml(madrasa?.phone || '');

  const rowsHtml = data.students.map((st, idx) => {
    const isPresent = st.status === 'PRESENT';
    const statusBg = isPresent ? '#DEF7EC' : '#FDE8E8';
    const statusColor = isPresent ? '#03543F' : '#9B1C1C';
    const statusText = st.status || 'NOT MARKED';

    return `
      <tr style="border-bottom: 1px solid #E5E7EB;">
        <td style="padding: 8px 12px; text-align: center; color: #6B7280; font-size: 11px;">${idx + 1}</td>
        <td style="padding: 8px 12px; font-family: monospace; font-weight: 600; color: #374151; font-size: 11px;">${escapeHtml(st.admissionNo)}</td>
        <td style="padding: 8px 12px; font-weight: 600; color: #111827; font-size: 12px;">${escapeHtml(st.fullName)}</td>
        <td style="padding: 8px 12px; text-align: center;">
          <span style="display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 10px; font-weight: 700; background-color: ${statusBg}; color: ${statusColor};">
            ${statusText}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Daily Attendance - ${escapeHtml(data.className)} - ${escapeHtml(data.date)}</title>
        <style>
          ${embeddedFontsCss}
          @page {
            size: A4 portrait;
            margin: 15mm 12mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Noto Sans Local', 'Noto Sans Tamil Local', 'Noto Sans Sinhala Local', 'Noto Sans Arabic Local', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #0F172A;
            background: #FFFFFF;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div style="border-bottom: 2px solid #0F172A; padding-bottom: 14px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 14px;">
            ${logoDataUri ? `<img src="${logoDataUri}" alt="Logo" style="height: 48px; width: 48px; object-fit: contain; border-radius: 6px; border: 1px solid #E5E7EB; padding: 2px;" />` : ''}
            <div>
              <h1 style="font-size: 18px; font-weight: 800; color: #0F172A; margin: 0;">${madrasaName}</h1>
              <p style="font-size: 11px; color: #4B5563; margin: 2px 0 0 0;">${madrasaAddress}${madrasaPhone ? ` • ${madrasaPhone}` : ''}</p>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; font-weight: 700; color: #059669; text-transform: uppercase;">Attendance Module</div>
            <div style="font-size: 14px; font-weight: 800; color: #0F172A; margin-top: 1px;">DAILY ATTENDANCE REPORT</div>
          </div>
        </div>

        <!-- Meta Grid -->
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 11px;">
          <div>
            <span style="color: #64748B; font-size: 10px; text-transform: uppercase; font-weight: 600;">Class</span>
            <div style="font-size: 13px; font-weight: 700; color: #0F172A;">${escapeHtml(data.className)}</div>
          </div>
          <div>
            <span style="color: #64748B; font-size: 10px; text-transform: uppercase; font-weight: 600;">Attendance Date</span>
            <div style="font-size: 13px; font-weight: 700; color: #0F172A;">${escapeHtml(data.date)}</div>
          </div>
          <div>
            <span style="color: #64748B; font-size: 10px; text-transform: uppercase; font-weight: 600;">Academic Year</span>
            <div style="font-size: 13px; font-weight: 700; color: #0F172A;">${escapeHtml(data.academicYear)}</div>
          </div>
        </div>

        <!-- Attendance Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #E5E7EB;">
          <thead>
            <tr style="background-color: #0F172A; color: #FFFFFF; font-size: 11px;">
              <th style="padding: 8px 12px; text-align: center; width: 40px;">#</th>
              <th style="padding: 8px 12px; text-align: left; width: 120px;">Student ID</th>
              <th style="padding: 8px 12px; text-align: left;">Student Name</th>
              <th style="padding: 8px 12px; text-align: center; width: 100px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- Summary Footer Cards -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 16px;">
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px; text-align: center; background: #FFFFFF;">
            <div style="font-size: 10px; font-weight: 700; color: #6B7280; text-transform: uppercase;">Total Students</div>
            <div style="font-size: 16px; font-weight: 800; color: #111827; margin-top: 2px;">${data.summary.totalStudents}</div>
          </div>
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px; text-align: center; background: #FFFFFF;">
            <div style="font-size: 10px; font-weight: 700; color: #059669; text-transform: uppercase;">Present</div>
            <div style="font-size: 16px; font-weight: 800; color: #059669; margin-top: 2px;">${data.summary.presentCount}</div>
          </div>
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px; text-align: center; background: #FFFFFF;">
            <div style="font-size: 10px; font-weight: 700; color: #DC2626; text-transform: uppercase;">Absent</div>
            <div style="font-size: 16px; font-weight: 800; color: #DC2626; margin-top: 2px;">${data.summary.absentCount}</div>
          </div>
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px; text-align: center; background: #FFFFFF;">
            <div style="font-size: 10px; font-weight: 700; color: #2563EB; text-transform: uppercase;">Attendance Rate</div>
            <div style="font-size: 16px; font-weight: 800; color: #2563EB; margin-top: 2px;">${data.summary.attendanceRate.toFixed(2)}%</div>
          </div>
        </div>
      </body>
    </html>
  `;

  return await renderRawHtmlToPdf({ html: fullHtml, landscape: false });
}

/**
 * Generates an institutional branded A4 PDF report for monthly attendance summary.
 *
 * @param {string} madrasaId
 * @param {{ classId: string, academicYear?: string, month: string }} params
 * @returns {Promise<Buffer>}
 */
export async function generateMonthlyAttendancePdf(madrasaId, params) {
  const data = await getMonthlySummary(madrasaId, params);
  const madrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
  });

  let logoDataUri = null;
  try {
    logoDataUri = await resolveLogoDataUri(madrasaId);
  } catch (e) {
    logoDataUri = null;
  }

  const madrasaName = escapeHtml(madrasa?.name || 'Madrasa');
  const madrasaAddress = escapeHtml(madrasa?.address || '');
  const madrasaPhone = escapeHtml(madrasa?.phone || '');

  const rowsHtml = data.students.map((st, idx) => {
    return `
      <tr style="border-bottom: 1px solid #E5E7EB;">
        <td style="padding: 8px 10px; text-align: center; color: #6B7280; font-size: 11px;">${idx + 1}</td>
        <td style="padding: 8px 10px; font-family: monospace; font-weight: 600; color: #374151; font-size: 11px;">${escapeHtml(st.admissionNo)}</td>
        <td style="padding: 8px 10px; font-weight: 600; color: #111827; font-size: 11px;">${escapeHtml(st.fullName)}</td>
        <td style="padding: 8px 10px; text-align: center; font-weight: 700; color: #059669; font-size: 11px;">${st.presentDays}</td>
        <td style="padding: 8px 10px; text-align: center; font-weight: 700; color: #DC2626; font-size: 11px;">${st.absentDays}</td>
        <td style="padding: 8px 10px; text-align: center; font-weight: 600; color: #4B5563; font-size: 11px;">${st.recordedDays}</td>
        <td style="padding: 8px 10px; text-align: center; font-weight: 800; color: #111827; font-size: 11px;">${st.attendancePercentage.toFixed(2)}%</td>
      </tr>
    `;
  }).join('');

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Monthly Attendance - ${escapeHtml(data.className)} - ${escapeHtml(data.month)}</title>
        <style>
          ${embeddedFontsCss}
          @page {
            size: A4 portrait;
            margin: 15mm 12mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Noto Sans Local', 'Noto Sans Tamil Local', 'Noto Sans Sinhala Local', 'Noto Sans Arabic Local', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #0F172A;
            background: #FFFFFF;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        </style>
      </head>
      <body>
        <!-- Institutional Header -->
        <div style="border-bottom: 2px solid #0F172A; padding-bottom: 14px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 14px;">
            ${logoDataUri ? `<img src="${logoDataUri}" alt="Logo" style="height: 48px; width: 48px; object-fit: contain; border-radius: 6px; border: 1px solid #E5E7EB; padding: 2px;" />` : ''}
            <div>
              <h1 style="font-size: 18px; font-weight: 800; color: #0F172A; margin: 0;">${madrasaName}</h1>
              <p style="font-size: 11px; color: #4B5563; margin: 2px 0 0 0;">${madrasaAddress}${madrasaPhone ? ` • ${madrasaPhone}` : ''}</p>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; font-weight: 700; color: #059669; text-transform: uppercase;">Attendance Module</div>
            <div style="font-size: 14px; font-weight: 800; color: #0F172A; margin-top: 1px;">MONTHLY ATTENDANCE REPORT</div>
          </div>
        </div>

        <!-- Meta Grid -->
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 11px;">
          <div>
            <span style="color: #64748B; font-size: 10px; text-transform: uppercase; font-weight: 600;">Class</span>
            <div style="font-size: 13px; font-weight: 700; color: #0F172A;">${escapeHtml(data.className)}</div>
          </div>
          <div>
            <span style="color: #64748B; font-size: 10px; text-transform: uppercase; font-weight: 600;">Month</span>
            <div style="font-size: 13px; font-weight: 700; color: #0F172A;">${escapeHtml(data.month)}</div>
          </div>
          <div>
            <span style="color: #64748B; font-size: 10px; text-transform: uppercase; font-weight: 600;">Academic Year</span>
            <div style="font-size: 13px; font-weight: 700; color: #0F172A;">${escapeHtml(data.academicYear || '-')}</div>
          </div>
        </div>

        <!-- Monthly Metrics Cards -->
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 18px;">
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 8px; text-align: center; background: #FFFFFF;">
            <div style="font-size: 9px; font-weight: 700; color: #6B7280; text-transform: uppercase;">Sessions</div>
            <div style="font-size: 15px; font-weight: 800; color: #111827; margin-top: 2px;">${data.summary.totalAttendanceDays}</div>
          </div>
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 8px; text-align: center; background: #FFFFFF;">
            <div style="font-size: 9px; font-weight: 700; color: #6B7280; text-transform: uppercase;">Total Students</div>
            <div style="font-size: 15px; font-weight: 800; color: #111827; margin-top: 2px;">${data.summary.totalStudents}</div>
          </div>
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 8px; text-align: center; background: #FFFFFF;">
            <div style="font-size: 9px; font-weight: 700; color: #059669; text-transform: uppercase;">Weighted Class Rate</div>
            <div style="font-size: 15px; font-weight: 800; color: #059669; margin-top: 2px;">${data.summary.monthlyClassRate.toFixed(2)}%</div>
          </div>
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 8px; text-align: center; background: #FFFFFF;">
            <div style="font-size: 9px; font-weight: 700; color: #2563EB; text-transform: uppercase;">Daily Average</div>
            <div style="font-size: 15px; font-weight: 800; color: #2563EB; margin-top: 2px;">${data.summary.averageDailyRate.toFixed(2)}%</div>
          </div>
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 8px; text-align: center; background: #FFFFFF;">
            <div style="font-size: 9px; font-weight: 700; color: #6B7280; text-transform: uppercase;">High / Low Rate</div>
            <div style="font-size: 13px; font-weight: 700; color: #111827; margin-top: 2px;">${data.summary.highestDailyRate.toFixed(0)}% / ${data.summary.lowestDailyRate.toFixed(0)}%</div>
          </div>
        </div>

        <!-- Student Summary Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #E5E7EB;">
          <thead>
            <tr style="background-color: #0F172A; color: #FFFFFF; font-size: 10px;">
              <th style="padding: 8px 10px; text-align: center; width: 35px;">#</th>
              <th style="padding: 8px 10px; text-align: left; width: 110px;">Student ID</th>
              <th style="padding: 8px 10px; text-align: left;">Student Name</th>
              <th style="padding: 8px 10px; text-align: center; width: 80px;">Present</th>
              <th style="padding: 8px 10px; text-align: center; width: 80px;">Absent</th>
              <th style="padding: 8px 10px; text-align: center; width: 90px;">Recorded</th>
              <th style="padding: 8px 10px; text-align: center; width: 90px;">Attendance %</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `;

  return await renderRawHtmlToPdf({ html: fullHtml, landscape: false });
}

/**
 * Generates Daily Attendance CSV with formula defense and UTF-8 BOM.
 *
 * @param {string} madrasaId
 * @param {{ classId: string, academicYear: string, date: string }} params
 * @returns {Promise<string>}
 */
export async function generateDailyAttendanceCsv(madrasaId, params) {
  const data = await getClassDailyAttendance(madrasaId, params);

  const headers = ['Student ID', 'Student Name', 'Status'];
  const rows = data.students.map((st) => [
    st.admissionNo,
    st.fullName,
    st.status || 'NOT MARKED',
  ]);

  return generateCsvString({ headers, rows });
}

/**
 * Generates Monthly Attendance CSV with formula defense and UTF-8 BOM.
 *
 * @param {string} madrasaId
 * @param {{ classId: string, academicYear?: string, month: string }} params
 * @returns {Promise<string>}
 */
export async function generateMonthlyAttendanceCsv(madrasaId, params) {
  const data = await getMonthlySummary(madrasaId, params);

  const headers = [
    'Student ID',
    'Student Name',
    'Present Days',
    'Absent Days',
    'Recorded Days',
    'Attendance Percentage',
  ];

  const rows = data.students.map((st) => [
    st.admissionNo,
    st.fullName,
    st.presentDays,
    st.absentDays,
    st.recordedDays,
    `${st.attendancePercentage.toFixed(2)}%`,
  ]);

  return generateCsvString({ headers, rows });
}
