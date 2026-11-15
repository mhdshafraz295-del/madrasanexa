import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { prisma } from '../lib/prisma.js';
import { hashToken, isValidTokenFormat } from '../utils/scan-token-crypto.js';
import {
  AppError,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../utils/errors.js';
import { reconcileGateAttendance } from './gate-attendance.service.js';
import { logTenantActivity } from './tenant.service.js';
import { isValidTimezone } from '../utils/dateTime.js';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Processes an operator gate scan (ENTRY or EXIT) for a student.
 *
 * Enforces:
 * - Token format & cryptographic SHA-256 verification.
 * - Idempotency lookup before debounce (matches -> 200 replay; payload mismatch -> 409 conflict).
 * - Anti-enumeration: returns 404 if token does not exist in the tenant's workspace.
 * - Option A Fail-Closed Policy: Student category === null returns HTTP 422 immediately (no event/email created).
 * - Same-direction 60-second debounce protection (HTTP 429).
 * - Transactional creation of StudentGateEvent, metric increment, attendance reconciliation, and tenant audit log.
 * - Outbox status determination: QUEUED vs NOT_APPLICABLE vs SKIPPED_NO_RECIPIENT.
 *
 * @param {object} params
 * @param {string} params.madrasaId - Tenant madrasa ID
 * @param {string} params.userId - Authenticated operator user ID
 * @param {string} params.token - Raw 37-character token scanned at the gate
 * @param {string} params.eventType - 'ENTRY' | 'EXIT'
 * @param {string} [params.idempotencyKey] - Optional client idempotency key (max 36 chars)
 * @returns {Promise<object>} Result payload
 */
export async function processGateScan({
  madrasaId,
  userId,
  token,
  eventType,
  idempotencyKey = null,
}) {
  // 1. Token format validation
  if (!isValidTokenFormat(token)) {
    throw new BadRequestError('Invalid token format. Expected canonical format MNX1_<32 hex chars>.');
  }

  const tokenHash = hashToken(token);

  // 2. Idempotency Key Pre-Check (BEFORE debounce check)
  if (idempotencyKey) {
    const existingEvent = await prisma.studentGateEvent.findUnique({
      where: {
        madrasaId_idempotencyKey: {
          madrasaId,
          idempotencyKey,
        },
      },
      include: {
        student: {
          include: {
            class: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
    });

    if (existingEvent) {
      // Find the student's active token to compare tokenHash
      const matchingToken = await prisma.studentScanToken.findFirst({
        where: {
          tokenHash,
          madrasaId,
          studentId: existingEvent.studentId,
        },
      });

      // Same key but divergent payload -> 409 Conflict
      if (!matchingToken || existingEvent.eventType !== eventType) {
        throw new ConflictError(
          'Idempotency key payload mismatch. The specified idempotencyKey was previously used with a different token or eventType.'
        );
      }

      // Identical payload -> Safe idempotent replay (HTTP 200)
      return {
        idempotentReplay: true,
        event: existingEvent,
        student: {
          id: existingEvent.student.id,
          admissionNo: existingEvent.student.admissionNo,
          fullName: existingEvent.student.fullName,
          category: existingEvent.student.category,
          class: existingEvent.student.class,
        },
        attendance: {
          reconciled: false,
          reason: 'IDEMPOTENT_REPLAY',
        },
      };
    }
  }

  // 3. Resolve scan token within tenant workspace (Anti-enumeration: 404)
  const tokenRecord = await prisma.studentScanToken.findFirst({
    where: {
      tokenHash,
      madrasaId,
    },
    include: {
      student: {
        include: {
          class: {
            select: { id: true, name: true, code: true },
          },
        },
      },
    },
  });

  if (!tokenRecord) {
    throw new NotFoundError('Scan token not found.');
  }

  if (tokenRecord.revokedAt) {
    throw new ForbiddenError('Scan token has been revoked.');
  }

  const student = tokenRecord.student;
  if (!student || student.status !== 'ACTIVE') {
    throw new ForbiddenError('Student account is not active.');
  }

  // 4. Fail-Closed Policy (Option A): Student category must be explicitly set
  if (!student.category) {
    throw new AppError(
      'Student category unset. Student must be designated as Boarding or Day Scholar before gate access is permitted.',
      422
    );
  }

  // 5. Debounce Check: Reject same student + same eventType within 60 seconds
  const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
  const recentScan = await prisma.studentGateEvent.findFirst({
    where: {
      madrasaId,
      studentId: student.id,
      eventType,
      scannedAt: {
        gte: sixtySecondsAgo,
      },
    },
    orderBy: {
      scannedAt: 'desc',
    },
  });

  if (recentScan) {
    throw new AppError(
      'Student scan debounced. Please wait 60 seconds between consecutive scans of the same type.',
      429
    );
  }

  // 6. Fetch Madrasa Settings for email and attendance policies
  const settings = await prisma.madrasaSetting.findUnique({
    where: { madrasaId },
  });

  // 7. Determine initial email status & skip reason
  let initialEmailStatus = 'NOT_APPLICABLE';
  let initialEmailSkipReason = null;
  const now = new Date();

  if (student.category === 'BOARDING') {
    initialEmailStatus = 'NOT_APPLICABLE';
    initialEmailSkipReason = 'BOARDING_STUDENT_EXEMPT';
  } else if (!settings?.gateParentEmailNotificationsEnabled) {
    initialEmailStatus = 'NOT_APPLICABLE';
    initialEmailSkipReason = 'NOTIFICATIONS_DISABLED_BY_TENANT';
  } else if (!student.guardianEmail || student.guardianEmail.trim().length === 0) {
    initialEmailStatus = 'SKIPPED_NO_RECIPIENT';
    initialEmailSkipReason = 'NO_GUARDIAN_EMAIL_REGISTERED';
  } else {
    // Eligible DAY_SCHOLAR with active notification toggle and valid email
    initialEmailStatus = 'QUEUED';
    initialEmailSkipReason = null;
  }

  // 8. Execute Database Mutation within an isolated Prisma Transaction
  const transactionResult = await prisma.$transaction(async (tx) => {
    // A. Create StudentGateEvent
    const createdEvent = await tx.studentGateEvent.create({
      data: {
        madrasaId,
        studentId: student.id,
        recordedByUserId: userId,
        eventType,
        category: student.category,
        scannedAt: now,
        idempotencyKey: idempotencyKey || null,
        emailStatus: initialEmailStatus,
        emailSkipReason: initialEmailSkipReason,
        attemptCount: 0,
        nextAttemptAt: initialEmailStatus === 'QUEUED' ? now : null,
      },
    });

    // B. Increment Scan Count & Update Last Scanned Timestamp on StudentScanToken
    await tx.studentScanToken.update({
      where: { id: tokenRecord.id },
      data: {
        scanCount: { increment: 1 },
        lastScannedAt: now,
      },
    });

    // C. Reconcile Attendance (strictly for ENTRY scans with autoGateAttendanceReconciliation)
    const attendanceResult = await reconcileGateAttendance({
      tx,
      madrasaId,
      student,
      eventType,
      scannedAt: now,
      settings,
      userId,
    });

    // D. Audit Logging
    await logTenantActivity({
      madrasaId,
      userId,
      action: 'GATE_SCAN_RECORDED',
      entityType: 'StudentGateEvent',
      entityId: createdEvent.id,
      metadata: {
        eventType,
        studentId: student.id,
        studentCategory: student.category,
        emailStatus: initialEmailStatus,
        emailSkipReason: initialEmailSkipReason,
        attendanceReconciled: attendanceResult.reconciled,
      },
      prismaClient: tx,
    });

    return {
      event: createdEvent,
      attendance: attendanceResult,
    };
  });

  return {
    idempotentReplay: false,
    event: transactionResult.event,
    student: {
      id: student.id,
      admissionNo: student.admissionNo,
      fullName: student.fullName,
      category: student.category,
      class: student.class,
    },
    attendance: transactionResult.attendance,
  };
}

/**
 * Calculates start and end timestamps representing a calendar date in a tenant's timezone.
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} [timezone='Asia/Colombo'] - IANA timezone identifier
 * @returns {{ startOfDay: Date, endOfDay: Date }}
 */
export function getTenantDateBoundaries(dateStr, timezone = 'Asia/Colombo') {
  const tz = isValidTimezone(timezone) ? timezone : 'Asia/Colombo';
  const startOfDay = dayjs.tz(`${dateStr} 00:00:00.000`, tz).toDate();
  const endOfDay = dayjs.tz(`${dateStr} 23:59:59.999`, tz).toDate();
  return { startOfDay, endOfDay };
}

/**
 * Retrieves a paginated list of gate movement events for a tenant.
 *
 * @param {object} params
 * @param {string} params.madrasaId - Tenant madrasa ID
 * @param {object} params.query - Validated query parameters
 * @returns {Promise<object>} Paginated events list
 */
export async function getGateEvents({ madrasaId, query }) {
  const { page = 1, limit = 20, date, studentId, classId, eventType, emailStatus } = query;
  const skip = (page - 1) * limit;

  const where = {
    madrasaId,
  };

  if (studentId) {
    where.studentId = studentId;
  }

  if (eventType) {
    where.eventType = eventType;
  }

  if (emailStatus) {
    where.emailStatus = emailStatus;
  }

  if (classId) {
    where.student = {
      classId,
    };
  }

  if (date) {
    // Resolve tenant timezone with fallback to Asia/Colombo
    const settings = await prisma.madrasaSetting.findUnique({
      where: { madrasaId },
      select: { timezone: true },
    });

    const tenantTimezone = (settings?.timezone && isValidTimezone(settings.timezone))
      ? settings.timezone
      : 'Asia/Colombo';

    const { startOfDay, endOfDay } = getTenantDateBoundaries(date, tenantTimezone);
    where.scannedAt = {
      gte: startOfDay,
      lte: endOfDay,
    };
  }

  const [total, events] = await Promise.all([
    prisma.studentGateEvent.count({ where }),
    prisma.studentGateEvent.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        scannedAt: 'desc',
      },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            fullName: true,
            category: true,
            class: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        recordedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return {
    events,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieves gate-related settings for a tenant.
 *
 * @param {string} madrasaId - Tenant madrasa ID
 * @returns {Promise<object>}
 */
export async function getGateSettings(madrasaId) {
  let settings = await prisma.madrasaSetting.findUnique({
    where: { madrasaId },
    select: {
      gateParentEmailNotificationsEnabled: true,
      autoGateAttendanceReconciliation: true,
      timezone: true,
    },
  });

  if (!settings) {
    settings = {
      gateParentEmailNotificationsEnabled: false,
      autoGateAttendanceReconciliation: false,
      timezone: 'Asia/Colombo',
    };
  }

  return settings;
}

/**
 * Updates institutional gate settings for a tenant.
 *
 * @param {object} params
 * @param {string} params.madrasaId - Tenant madrasa ID
 * @param {string} params.userId - Authenticated admin user ID
 * @param {object} params.data - Validated update fields
 * @returns {Promise<object>} Updated settings
 */
export async function updateGateSettings({ madrasaId, userId, data }) {
  const updateData = {};
  if (data.gateParentEmailNotificationsEnabled !== undefined) {
    updateData.gateParentEmailNotificationsEnabled = data.gateParentEmailNotificationsEnabled;
  }
  if (data.autoGateAttendanceReconciliation !== undefined) {
    updateData.autoGateAttendanceReconciliation = data.autoGateAttendanceReconciliation;
  }

  const updated = await prisma.madrasaSetting.upsert({
    where: { madrasaId },
    update: updateData,
    create: {
      madrasaId,
      ...updateData,
    },
    select: {
      gateParentEmailNotificationsEnabled: true,
      autoGateAttendanceReconciliation: true,
      timezone: true,
    },
  });

  await logTenantActivity({
    madrasaId,
    userId,
    action: 'GATE_SETTINGS_UPDATED',
    entityType: 'MadrasaSetting',
    entityId: madrasaId,
    metadata: updateData,
  });

  return updated;
}
