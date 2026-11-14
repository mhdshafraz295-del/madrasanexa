import { prisma } from '../lib/prisma.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import { isValidTokenFormat, hashToken } from '../utils/scan-token-crypto.js';
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
export async function getClassDailyAttendance(madrasaId, { classId, academicYear, date: dateStr }, prismaClient = prisma) {
  const targetClass = await prismaClient.class.findFirst({
    where: { id: classId, madrasaId },
    select: { id: true, name: true, code: true },
  });

  if (!targetClass) {
    throw new NotFoundError('Class not found.');
  }

  const attendanceDate = parseDateOnly(dateStr);

  // Check if session already exists
  const existingSession = await prismaClient.attendanceSession.findUnique({
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

  // Evaluate date-aware eligible active students as of attendanceDate
  const endOfDayUtc = new Date(Date.UTC(
    attendanceDate.getUTCFullYear(),
    attendanceDate.getUTCMonth(),
    attendanceDate.getUTCDate(),
    23, 59, 59, 999
  ));

  const eligibleStudents = await prismaClient.student.findMany({
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

  if (existingSession) {
    // Build map of studentId -> student record item
    const recordMap = new Map();

    // 1. Preserve historically recorded students and their saved statuses
    for (const rec of existingSession.records) {
      recordMap.set(rec.studentId, {
        studentId: rec.studentId,
        admissionNo: rec.student?.admissionNo || '',
        fullName: rec.student?.fullName || '',
        status: rec.status,
      });
    }

    // 2. Include all eligible active students who do not yet have an AttendanceRecord (status: null)
    for (const st of eligibleStudents) {
      if (!recordMap.has(st.id)) {
        recordMap.set(st.id, {
          studentId: st.id,
          admissionNo: st.admissionNo,
          fullName: st.fullName,
          status: null, // UI state: NOT_MARKED
        });
      }
    }

    // 3. Preserve student ordering according to existing application behavior (admissionNo asc)
    const records = Array.from(recordMap.values()).sort((a, b) =>
      (a.admissionNo || '').localeCompare(b.admissionNo || '')
    );

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
export async function saveClassDailyAttendance(madrasaId, userId, payload, prismaClient = prisma) {
  const { classId, academicYear, date: dateStr, records } = payload;

  const targetClass = await prismaClient.class.findFirst({
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
  const existingSession = await prismaClient.attendanceSession.findUnique({
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

  const endOfDayUtc = new Date(Date.UTC(
    attendanceDate.getUTCFullYear(),
    attendanceDate.getUTCMonth(),
    attendanceDate.getUTCDate(),
    23, 59, 59, 999
  ));

  const eligible = await prismaClient.student.findMany({
    where: {
      madrasaId,
      classId,
      status: 'ACTIVE',
      admissionDate: { lte: endOfDayUtc },
    },
    select: { id: true },
  });

  const eligibleStudentIds = new Set(eligible.map((s) => s.id));
  if (existingSession && existingSession.records.length > 0) {
    // Preserve historically recorded students as eligible for this session
    for (const r of existingSession.records) {
      eligibleStudentIds.add(r.studentId);
    }
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
  const result = await prismaClient.$transaction(async (tx) => {
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
  }, prismaClient).catch(() => {});

  return await getClassDailyAttendance(madrasaId, { classId, academicYear, date: dateStr }, prismaClient);
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

/**
 * Phase 02 – Secure Attendance Scan Token Verification
 *
 * Verifies student QR/Code128 scan token for the attendance workflow.
 *
 * Invariants:
 * - Strictly validates canonical 37-character token format (`MNX1_<32 hex>`) before DB lookup.
 * - Enforces tenant isolation (madrasaId).
 * - Rejects inactive, revoked, or cross-tenant tokens.
 * - Confirms student active status and date-based admission eligibility.
 * - Safely updates scan metrics (lastScannedAt, scanCount).
 * - Detects duplicate scans and existing session attendance records.
 * - Returns only minimum non-sensitive student metadata (zero raw tokens or cryptographic secrets).
 *
 * @param {object} params
 * @param {string} params.madrasaId - Authenticated tenant madrasa ID
 * @param {string} params.token - Raw scan token (e.g. from USB scanner or camera)
 * @param {string} [params.classId] - Optional class ID of current attendance session
 * @param {string} [params.date] - Optional date of attendance session (YYYY-MM-DD)
 * @param {string} [params.academicYear] - Optional academic year
 * @param {object} [params.prismaClient] - Optional injected Prisma client (for isolated unit tests)
 * @returns {Promise<object>} Minimum student attendance verification payload
 */
export async function verifyScanTokenForAttendance({
  madrasaId,
  token,
  classId = null,
  date = null,
  academicYear = null,
  recordScanMetric = true,
  prismaClient = prisma,
}) {
  if (!madrasaId || typeof madrasaId !== 'string') {
    throw new BadRequestError('Tenant madrasaId is required.');
  }

  // 1. Pre-lookup format validation: Reject non-canonical formats immediately
  if (!token || typeof token !== 'string') {
    throw new BadRequestError('Scan token is required.');
  }

  const trimmedToken = token.trim();
  if (!isValidTokenFormat(trimmedToken)) {
    throw new BadRequestError('Invalid token format. Token must follow the canonical MNX1_ format.');
  }

  // 2. Cryptographic token hash lookup within tenant boundary
  const tokenHash = hashToken(trimmedToken);

  const tokenRecord = await prismaClient.studentScanToken.findFirst({
    where: {
      tokenHash,
      madrasaId,
    },
    include: {
      student: {
        select: {
          id: true,
          madrasaId: true,
          classId: true,
          admissionNo: true,
          fullName: true,
          status: true,
          admissionDate: true,
          class: {
            select: { id: true, name: true, code: true },
          },
        },
      },
    },
  });

  // Anti-enumeration: Generic NotFoundError for missing or cross-tenant token
  if (!tokenRecord) {
    throw new NotFoundError('Unrecognized or invalid scan token.');
  }

  // 3. Token state verification
  if (!tokenRecord.isActive || tokenRecord.revokedAt) {
    const err = new BadRequestError(
      `Scan token has been revoked (Reason: ${tokenRecord.revokeReason || 'Revoked by institution'}).`
    );
    err.code = 'TOKEN_REVOKED';
    throw err;
  }

  // 4. Student eligibility checks
  const student = tokenRecord.student;
  if (!student || student.madrasaId !== madrasaId) {
    throw new NotFoundError('Student not found for this institution.');
  }

  if (student.status !== 'ACTIVE') {
    throw new BadRequestError(
      `Student (${student.admissionNo} - ${student.fullName}) is currently ${student.status} and ineligible for attendance.`
    );
  }

  // 5. Class match verification (if classId provided)
  if (classId && typeof classId === 'string' && classId.trim().length > 0) {
    if (student.classId !== classId.trim()) {
      const className = student.class?.name || student.classId;
      throw new BadRequestError(
        `Class mismatch: Student (${student.fullName}) belongs to class "${className}", not the selected attendance session.`
      );
    }
  }

  // 6. Admission date eligibility (if date provided)
  let attendanceDate = null;
  if (date && typeof date === 'string' && date.trim().length > 0) {
    attendanceDate = parseDateOnly(date.trim());
    if (student.admissionDate) {
      const endOfDayUtc = new Date(Date.UTC(
        attendanceDate.getUTCFullYear(),
        attendanceDate.getUTCMonth(),
        attendanceDate.getUTCDate(),
        23, 59, 59, 999
      ));
      if (new Date(student.admissionDate) > endOfDayUtc) {
        throw new BadRequestError(
          `Student (${student.admissionNo}) was admitted on ${formatDateOnly(student.admissionDate)}, after the attendance date.`
        );
      }
    }
  }

  // 7. Safe scan metrics update
  const now = new Date();
  if (recordScanMetric) {
    await prismaClient.studentScanToken.update({
      where: { id: tokenRecord.id },
      data: {
        lastScannedAt: now,
        scanCount: { increment: 1 },
      },
    });
  }

  // 8. Attendance Session duplicate check
  let duplicateScan = false;
  let alreadyMarked = false;
  let existingStatus = null;

  if (classId && attendanceDate) {
    const session = await prismaClient.attendanceSession.findUnique({
      where: {
        madrasaId_classId_attendanceDate: {
          madrasaId,
          classId: classId.trim(),
          attendanceDate,
        },
      },
      include: {
        records: {
          where: { studentId: student.id },
          select: { id: true, status: true },
        },
      },
    });

    if (session) {
      if (academicYear && typeof academicYear === 'string' && academicYear.trim().length > 0) {
        if (session.academicYear !== academicYear.trim()) {
          throw new ConflictError(
            `Academic year mismatch: Existing attendance session for this date belongs to academic year "${session.academicYear}", but request specified "${academicYear.trim()}".`
          );
        }
      }

      if (session.records.length > 0) {
        alreadyMarked = true;
        duplicateScan = true;
        existingStatus = session.records[0].status;
      }
    }
  }

  // 9. Minimum, non-sensitive payload returned (zero cryptographic secrets leaked)
  return {
    verified: true,
    student: {
      id: student.id,
      admissionNo: student.admissionNo,
      fullName: student.fullName,
      classId: student.classId,
      className: student.class?.name || null,
    },
    tokenHint: tokenRecord.tokenHint,
    scannedAt: now.toISOString(),
    scanCount: recordScanMetric ? tokenRecord.scanCount + 1 : tokenRecord.scanCount,
    duplicateScan,
    alreadyMarked,
    existingStatus,
    suggestedStatus: 'PRESENT',
    tokenId: tokenRecord.id,
    lastScannedAt: tokenRecord.lastScannedAt,
  };
}

/**
 * Phase 02 – Ingest Scanned Attendance Record
 *
 * Securely ingests an individual scanned attendance record for an open or saved session.
 * Protects against silent overwriting by requiring explicit overwrite=true to modify an existing status.
 *
 * @param {object} params
 * @param {string} params.madrasaId - Tenant madrasa ID
 * @param {string} params.userId - Authenticated user ID
 * @param {string} params.token - Raw scan token
 * @param {string} params.classId - Class ID
 * @param {string} params.date - Date in YYYY-MM-DD
 * @param {string} params.academicYear - Academic Year string
 * @param {'PRESENT'|'ABSENT'} [params.status='PRESENT'] - Status to record
 * @param {boolean} [params.overwrite=false] - Whether to overwrite an existing record
 * @param {object} [params.prismaClient] - Optional injected Prisma client
 * @returns {Promise<object>}
 */
export async function ingestScannedAttendanceRecord({
  madrasaId,
  userId,
  token,
  classId,
  date: dateStr,
  academicYear,
  status = 'PRESENT',
  overwrite = false,
  reason = null,
  alreadyVerified = false,
  prismaClient = prisma,
}) {
  // AUDIT-02: Mandatory reason check when overwrite is true
  if (overwrite) {
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      throw new BadRequestError(
        'A mandatory reason (minimum 3 characters) is required to overwrite an existing attendance record.'
      );
    }
  }

  const attendanceDate = parseDateOnly(dateStr);
  let verifiedStudent = null;

  try {
    // Atomic ingestion transaction (AUDIT-03: verification runs inside transaction to eliminate TOCTOU gap)
    const result = await prismaClient.$transaction(async (tx) => {
      // 1. Transactional token verification: validates token, student status, admission date, class match
      const verification = await verifyScanTokenForAttendance({
        madrasaId,
        token,
        classId,
        date: dateStr,
        academicYear,
        recordScanMetric: false, // Metric increment handled transactionally below
        prismaClient: tx,
      });

      verifiedStudent = verification.student;
      const studentId = verification.student.id;

      // 2. AUDIT-04: Prevent double-increment of scanCount when verify is followed by ingestion
      const now = new Date();
      const lastScannedTime = verification.lastScannedAt ? new Date(verification.lastScannedAt).getTime() : 0;
      const wasRecentlyVerified = alreadyVerified === true || (now.getTime() - lastScannedTime < 30_000);

      if (!wasRecentlyVerified && verification.tokenId) {
        await tx.studentScanToken.update({
          where: { id: verification.tokenId },
          data: {
            lastScannedAt: now,
            scanCount: { increment: 1 },
          },
        });
      }

      // 3. Upsert / find attendance session (Fix B: Concurrency-safe atomic upsert preserving established fields)
      const session = await tx.attendanceSession.upsert({
        where: {
          madrasaId_classId_attendanceDate: {
            madrasaId,
            classId: classId.trim(),
            attendanceDate,
          },
        },
        update: {}, // Invariant: Do not overwrite an existing session's academic year or other established fields
        create: {
          madrasaId,
          classId: classId.trim(),
          attendanceDate,
          academicYear: academicYear ? academicYear.trim() : '2026-2027',
          createdById: userId || null,
        },
      });

      // Validate the returned session's academic year against the request (AUDIT-07 ConflictError)
      if (academicYear && typeof academicYear === 'string' && session.academicYear !== academicYear.trim()) {
        throw new ConflictError(
          `Academic year mismatch: Existing attendance session for this date belongs to academic year "${session.academicYear}", but request specified "${academicYear.trim()}".`
        );
      }

      // 4. Check existing record for this student
      const existingRecord = await tx.attendanceRecord.findUnique({
        where: {
          sessionId_studentId: {
            sessionId: session.id,
            studentId,
          },
        },
      });

      if (existingRecord) {
        const previousStatus = existingRecord.status;
        if (!overwrite) {
          return {
            recorded: false,
            duplicateScan: true,
            alreadyMarked: true,
            status: existingRecord.status,
            message: `Student (${verification.student.admissionNo}) is already marked ${existingRecord.status}. Silent overwrite prohibited.`,
            student: verification.student,
          };
        }

        // Overwrite permitted
        const updated = await tx.attendanceRecord.update({
          where: { id: existingRecord.id },
          data: { status },
        });

        // AUDIT-02 & Step 0.7 Fix A: Atomically persist ActivityLog inside the active transaction
        await logTenantActivity(
          {
            madrasaId,
            userId,
            action: 'ATTENDANCE_RECORD_OVERWRITTEN',
            entityType: 'AttendanceRecord',
            entityId: existingRecord.id,
            metadata: {
              sessionId: session.id,
              studentId,
              admissionNo: verification.student.admissionNo,
              classId: classId.trim(),
              date: dateStr,
              previousStatus,
              newStatus: updated.status,
              reason: reason.trim(),
            },
          },
          tx
        );

        return {
          recorded: true,
          overwritten: true,
          duplicateScan: true,
          status: updated.status,
          message: 'Attendance record updated successfully.',
          student: verification.student,
        };
      }

      // 5. Create fresh record
      const created = await tx.attendanceRecord.create({
        data: {
          madrasaId,
          sessionId: session.id,
          studentId,
          status,
        },
      });

      return {
        recorded: true,
        overwritten: false,
        duplicateScan: false,
        status: created.status,
        message: 'Attendance record ingested successfully.',
        student: verification.student,
      };
    });

    return result;
  } catch (err) {
    // AUDIT-05: Handle Prisma P2002 concurrent duplicate attendance inserts gracefully
    if (err?.code === 'P2002' || err?.message?.includes('P2002') || err?.message?.includes('Unique constraint')) {
      const session = await prismaClient.attendanceSession.findUnique({
        where: {
          madrasaId_classId_attendanceDate: {
            madrasaId,
            classId: classId.trim(),
            attendanceDate,
          },
        },
      });

      if (session && verifiedStudent?.id) {
        const raceRecord = await prismaClient.attendanceRecord.findUnique({
          where: {
            sessionId_studentId: {
              sessionId: session.id,
              studentId: verifiedStudent.id,
            },
          },
        });

        if (raceRecord) {
          return {
            recorded: false,
            duplicateScan: true,
            alreadyMarked: true,
            status: raceRecord.status,
            message: `Student (${verifiedStudent.admissionNo}) is already marked ${raceRecord.status}. Concurrent duplicate scan detected.`,
            student: verifiedStudent,
          };
        }
      }
    }
    throw err;
  }
}

/**
 * Verifies a student via Code128 1D admission number barcode (Tier 2 Fallback).
 *
 * Mandatory Security & Integrity Invariants:
 * 1. Lower-security fallback: Never treated as cryptographically verified.
 * 2. Scoped strictly within tenant boundary (madrasaId + admissionNo).
 * 3. Requires active student status, class eligibility, and academic year match.
 * 4. Checks session duplicate status. If duplicate and overwrite is true, requires mandatory reason (>= 3 chars).
 * 5. Atomically logs the fallback event to ActivityLog inside a Prisma transaction.
 * 6. CRITICAL: Does NOT create or update AttendanceRecord or AttendanceSession.
 *    Attendance persistence is performed strictly through the complete-roster PUT attendance flow.
 *
 * @param {object} params
 * @param {string} params.madrasaId - Tenant madrasa ID
 * @param {string} params.userId - Authenticated operator ID
 * @param {string} params.admissionNo - Student admission number (from 1D barcode)
 * @param {string} [params.classId] - Optional class filter
 * @param {string} [params.date] - Optional attendance date YYYY-MM-DD
 * @param {string} [params.academicYear] - Optional academic year string
 * @param {boolean} [params.overwrite] - Whether operator authorized overwriting a duplicate
 * @param {string} [params.reason] - Mandatory operator reason if overwrite is authorized
 * @param {object} [params.prismaClient] - Injected Prisma client
 * @returns {Promise<object>} Verified scan event metadata
 */
export async function verifyAdmissionBarcodeForAttendance({
  madrasaId,
  userId,
  admissionNo,
  classId = null,
  date = null,
  academicYear = null,
  overwrite = false,
  reason = null,
  prismaClient = prisma,
}) {
  if (!madrasaId || typeof madrasaId !== 'string') {
    throw new BadRequestError('Tenant madrasaId is required.');
  }
  if (!admissionNo || typeof admissionNo !== 'string') {
    throw new BadRequestError('Admission number is required.');
  }

  const trimmedAdmissionNo = admissionNo.trim();
  if (trimmedAdmissionNo.length === 0) {
    throw new BadRequestError('Admission number cannot be empty.');
  }

  // 1. Look up student strictly within tenant boundary
  const student = await prismaClient.student.findFirst({
    where: {
      madrasaId,
      admissionNo: trimmedAdmissionNo,
    },
    include: {
      class: {
        select: { id: true, name: true, code: true },
      },
    },
  });

  if (!student) {
    throw new NotFoundError(`Student with admission number "${trimmedAdmissionNo}" not found in this institution.`);
  }

  // 2. Active status enforcement
  if (student.status !== 'ACTIVE') {
    throw new BadRequestError(
      `Student (${student.admissionNo} - ${student.fullName}) is currently ${student.status} and ineligible for attendance.`
    );
  }

  // 3. Class match verification (if classId provided)
  if (classId && typeof classId === 'string' && classId.trim().length > 0) {
    if (student.classId !== classId.trim()) {
      const className = student.class?.name || student.classId;
      throw new BadRequestError(
        `Class mismatch: Student (${student.fullName}) belongs to class "${className}", not the selected attendance session.`
      );
    }
  }

  // 4. Admission date eligibility (if date provided)
  let attendanceDate = null;
  if (date && typeof date === 'string' && date.trim().length > 0) {
    attendanceDate = parseDateOnly(date.trim());
    if (student.admissionDate) {
      const endOfDayUtc = new Date(Date.UTC(
        attendanceDate.getUTCFullYear(),
        attendanceDate.getUTCMonth(),
        attendanceDate.getUTCDate(),
        23, 59, 59, 999
      ));
      if (new Date(student.admissionDate) > endOfDayUtc) {
        throw new BadRequestError(
          `Student (${student.admissionNo}) was admitted on ${formatDateOnly(student.admissionDate)}, after the attendance date.`
        );
      }
    }
  }

  // 5. Attendance Session duplicate check
  let duplicateScan = false;
  let alreadyMarked = false;
  let existingStatus = null;

  if (classId && attendanceDate) {
    const session = await prismaClient.attendanceSession.findUnique({
      where: {
        madrasaId_classId_attendanceDate: {
          madrasaId,
          classId: classId.trim(),
          attendanceDate,
        },
      },
      include: {
        records: {
          where: { studentId: student.id },
          select: { id: true, status: true },
        },
      },
    });

    if (session) {
      if (academicYear && typeof academicYear === 'string' && academicYear.trim().length > 0) {
        if (session.academicYear !== academicYear.trim()) {
          throw new ConflictError(
            `Academic year mismatch: Existing attendance session for this date belongs to academic year "${session.academicYear}", but request specified "${academicYear.trim()}".`
          );
        }
      }

      if (session.records.length > 0) {
        alreadyMarked = true;
        duplicateScan = true;
        existingStatus = session.records[0].status;
      }
    }
  }

  // 6. Overwrite authorization check
  if (alreadyMarked) {
    if (overwrite) {
      if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
        throw new BadRequestError('A mandatory reason (minimum 3 characters) is required to overwrite an existing attendance record.');
      }
    }
  }

  const now = new Date();

  // 7. Atomic transaction for in-transaction ActivityLog
  await prismaClient.$transaction(async (tx) => {
    await tx.activityLog.create({
      data: {
        madrasaId,
        userId: userId || null,
        action: 'ATTENDANCE_VERIFY_1D_BARCODE_FALLBACK',
        entityType: 'Student',
        entityId: student.id,
        details: {
          admissionNo: student.admissionNo,
          studentId: student.id,
          classId: classId || student.classId,
          date: date || null,
          academicYear: academicYear || null,
          verificationMethod: 'VERIFIED_1D_BARCODE_FALLBACK',
          duplicateScan,
          alreadyMarked,
          existingStatus,
          overwritten: Boolean(alreadyMarked && overwrite),
          operatorReason: reason ? reason.trim() : null,
          securityTier: 'FALLBACK_LOW_TRUST',
          securityNotice: 'Verified via static 1D barcode identifier (Tier 2)',
        },
      },
    });
  });

  // 8. Return verified scan event (does NOT mutate attendance session or records)
  return {
    verified: true,
    verificationMethod: 'VERIFIED_1D_BARCODE_FALLBACK',
    student: {
      id: student.id,
      admissionNo: student.admissionNo,
      fullName: student.fullName,
      classId: student.classId,
      className: student.class?.name || null,
    },
    scannedAt: now.toISOString(),
    duplicateScan,
    alreadyMarked,
    existingStatus,
    suggestedStatus: 'PRESENT',
    securityTier: 'FALLBACK_LOW_TRUST',
    securityNotice: 'Verified via static 1D barcode identifier (Tier 2)',
  };
}


