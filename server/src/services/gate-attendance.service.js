import { parseDateOnly } from './attendance.service.js';

/**
 * Derives the calendar date string (YYYY-MM-DD) for a given timestamp in the specified timezone.
 *
 * @param {Date} date - Timestamp to format
 * @param {string} [timezone='Asia/Colombo'] - IANA timezone identifier
 * @returns {string} Formatted date string (YYYY-MM-DD)
 */
export function getTenantLocalDateString(date, timezone = 'Asia/Colombo') {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch (_err) {
    // Fallback if an invalid timezone string was stored
    const fallbackFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return fallbackFormatter.format(date);
  }
}

/**
 * Reconciles gate scan entry with the student's daily attendance record.
 *
 * Rules:
 * 1. ONLY 'ENTRY' events can trigger attendance reconciliation. 'EXIT' scans must never modify AttendanceRecord.
 * 2. Only runs if settings.autoGateAttendanceReconciliation is explicitly true.
 * 3. Requires student to be assigned to an active class (classId != null).
 * 4. Determines the calendar date according to the tenant's configured timezone (default: Asia/Colombo).
 * 5. Atomically upserts the daily AttendanceSession and AttendanceRecord to PRESENT.
 *
 * @param {object} params
 * @param {object} params.tx - Active Prisma transaction client
 * @param {string} params.madrasaId - Tenant madrasa ID
 * @param {object} params.student - Verified student object ({ id, classId, admissionDate })
 * @param {string} params.eventType - 'ENTRY' | 'EXIT'
 * @param {Date} params.scannedAt - Physical scan timestamp
 * @param {object} params.settings - Madrasa settings object
 * @param {string} [params.userId] - User ID who operated the scanner
 * @returns {Promise<{ reconciled: boolean, sessionId?: string, recordId?: string, status?: string, date?: string, reason?: string }>}
 */
export async function reconcileGateAttendance({
  tx,
  madrasaId,
  student,
  eventType,
  scannedAt,
  settings,
  userId = null,
}) {
  // Invariant 1: Only ENTRY triggers attendance
  if (eventType !== 'ENTRY') {
    return {
      reconciled: false,
      reason: 'EXIT_SCAN_EXEMPT_FROM_ATTENDANCE',
    };
  }

  // Invariant 2: Tenant setting must be enabled
  if (!settings?.autoGateAttendanceReconciliation) {
    return {
      reconciled: false,
      reason: 'AUTO_RECONCILIATION_DISABLED',
    };
  }

  // Invariant 3: Student must belong to a class
  if (!student?.classId) {
    return {
      reconciled: false,
      reason: 'STUDENT_NOT_ASSIGNED_TO_CLASS',
    };
  }

  // Invariant 4: Resolve tenant calendar date
  const tenantTimezone = settings?.timezone || 'Asia/Colombo';
  const dateStr = getTenantLocalDateString(scannedAt, tenantTimezone);
  const attendanceDate = parseDateOnly(dateStr);

  // Invariant 5: Admission date check (cannot mark attendance before admission)
  if (student.admissionDate) {
    const endOfDayUtc = new Date(
      Date.UTC(
        attendanceDate.getUTCFullYear(),
        attendanceDate.getUTCMonth(),
        attendanceDate.getUTCDate(),
        23,
        59,
        59,
        999
      )
    );
    if (new Date(student.admissionDate) > endOfDayUtc) {
      return {
        reconciled: false,
        reason: 'STUDENT_NOT_YET_ADMITTED_ON_DATE',
      };
    }
  }

  // Invariant 6: Concurrency-safe atomic upsert for AttendanceSession
  const academicYear = settings?.academicYear || '2026-2027';
  const session = await tx.attendanceSession.upsert({
    where: {
      madrasaId_classId_attendanceDate: {
        madrasaId,
        classId: student.classId,
        attendanceDate,
      },
    },
    update: {}, // Preserve established session fields
    create: {
      madrasaId,
      classId: student.classId,
      attendanceDate,
      academicYear: academicYear.trim(),
      createdById: userId,
    },
  });

  // Invariant 7: Atomic upsert for AttendanceRecord -> PRESENT
  const record = await tx.attendanceRecord.upsert({
    where: {
      sessionId_studentId: {
        sessionId: session.id,
        studentId: student.id,
      },
    },
    update: {
      status: 'PRESENT',
    },
    create: {
      madrasaId,
      sessionId: session.id,
      studentId: student.id,
      status: 'PRESENT',
    },
  });

  return {
    reconciled: true,
    sessionId: session.id,
    recordId: record.id,
    status: 'PRESENT',
    date: dateStr,
  };
}
