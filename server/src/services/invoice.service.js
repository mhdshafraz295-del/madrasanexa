import crypto from 'crypto';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { assertTenantOwnership, findTenantRecordOrThrow } from '../lib/tenant-prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors.js';
import { getEffectiveStudentFee } from './student-fee.service.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Retrieves the configured timezone for a Madrasa (defaults to Asia/Colombo).
 *
 * @param {string} madrasaId
 * @returns {Promise<string>}
 */
export async function getMadrasaTimezone(madrasaId) {
  const setting = await prisma.madrasaSetting.findUnique({
    where: { madrasaId },
    select: { timezone: true },
  });
  return setting?.timezone || 'Asia/Colombo';
}

/**
 * Retrieves the configured invoice prefix for a Madrasa (defaults to INV-).
 *
 * @param {string} madrasaId
 * @returns {Promise<string>}
 */
export async function getMadrasaInvoicePrefix(madrasaId) {
  const setting = await prisma.madrasaSetting.findUnique({
    where: { madrasaId },
    select: { invoicePrefix: true },
  });
  return setting?.invoicePrefix || 'INV-';
}

/**
 * Computes the local billing period boundaries normalized to UTC.
 *
 * @param {number} billingYear
 * @param {number} billingMonth (1-12)
 * @param {string} tz (IANA Timezone)
 * @returns {{ periodStart: Date, periodEndExclusive: Date }}
 */
export function calculateBillingBoundaries(billingYear, billingMonth, tz = 'Asia/Colombo') {
  const monthStr = String(billingMonth).padStart(2, '0');
  const periodStart = dayjs.tz(`${billingYear}-${monthStr}-01`, tz).startOf('day').toDate();

  const nextMonth = billingMonth === 12 ? 1 : billingMonth + 1;
  const nextYear = billingMonth === 12 ? billingYear + 1 : billingYear;
  const nextMonthStr = String(nextMonth).padStart(2, '0');
  const periodEndExclusive = dayjs.tz(`${nextYear}-${nextMonthStr}-01`, tz).startOf('day').toDate();

  return { periodStart, periodEndExclusive };
}

/**
 * Normalizes a user-selected due date (calendar date) in the Madrasa's timezone.
 * Sets the boundary to the END of that calendar day in local time.
 *
 * @param {string} dueDateStr (YYYY-MM-DD)
 * @param {string} tz
 * @returns {Date}
 */
export function normalizeDueDate(dueDateStr, tz = 'Asia/Colombo') {
  return dayjs.tz(dueDateStr, tz).endOf('day').toDate();
}

/**
 * Generates a human-readable, collision-safe invoice number with Madrasa prefix.
 * Example: INV-202609-A7C2E9
 *
 * @param {string} prefix
 * @param {number} year
 * @param {number} month
 * @returns {string}
 */
export function generateInvoiceNumber(prefix, year, month) {
  const yyyymm = `${year}${String(month).padStart(2, '0')}`;
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  const cleanPrefix = prefix.endsWith('-') ? prefix : `${prefix}-`;
  return `${cleanPrefix}${yyyymm}-${randomSuffix}`;
}

/**
 * Resolves the display status and overdue flag for an invoice.
 * Central authority across list, detail, summaries, and dashboard.
 *
 * @param {object} invoice
 * @param {Date} [nowUtc=new Date()]
 * @returns {{ displayStatus: string, isOverdue: boolean }}
 */
export function resolveInvoiceDisplayStatus(invoice, nowUtc = new Date()) {
  const storedStatus = invoice.status;

  if (storedStatus === 'VOID') {
    return { displayStatus: 'VOID', isOverdue: false };
  }
  if (storedStatus === 'PAID') {
    return { displayStatus: 'PAID', isOverdue: false };
  }

  const balance = Number(invoice.balanceAmount ?? invoice.totalAmount ?? 0);
  let isOverdue = false;

  if (balance > 0 && invoice.dueDate) {
    const dueTime = new Date(invoice.dueDate).getTime();
    if (nowUtc.getTime() > dueTime) {
      isOverdue = true;
    }
  }

  if (isOverdue) {
    return { displayStatus: 'OVERDUE', isOverdue: true };
  }

  return { displayStatus: storedStatus, isOverdue: false };
}

/**
 * Checks if a Prisma P2002 error was caused by invoiceNo uniqueness violation.
 *
 * @param {any} error
 * @returns {boolean}
 */
export function isInvoiceNoCollision(error) {
  if (error?.code !== 'P2002') return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes('invoiceNo');
  }
  if (typeof target === 'string') {
    return target.includes('invoiceNo');
  }
  if (typeof error.message === 'string') {
    return error.message.includes('invoiceNo');
  }
  return false;
}

/**
 * Checks if a Prisma P2002 error was caused by monthly uniqueness violation.
 * (madrasaId + studentId + billingYear + billingMonth)
 *
 * @param {any} error
 * @returns {boolean}
 */
export function isMonthlyDuplicateCollision(error) {
  if (error?.code !== 'P2002') return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes('billingYear') || target.includes('billingMonth') || target.includes('studentId');
  }
  if (typeof target === 'string') {
    return target.includes('billingYear') || target.includes('billingMonth') || target.includes('studentId');
  }
  if (typeof error.message === 'string') {
    return error.message.includes('billingYear') || error.message.includes('billingMonth');
  }
  return false;
}

/**
 * Read-only preview of monthly tuition fee invoices.
 * Calculates eligible students, fees, duplicate checks, and Decimal sums.
 * Creates ZERO database records.
 *
 * @param {string} madrasaId
 * @param {{ billingYear: number, billingMonth: number, dueDate?: string|null, classId?: string|null, studentIds?: string[]|null }} data
 * @returns {Promise<object>}
 */
export async function previewMonthlyInvoices(madrasaId, data) {
  const { billingYear, billingMonth, dueDate, classId, studentIds: rawStudentIds } = data;
  const tz = await getMadrasaTimezone(madrasaId);
  const { periodStart, periodEndExclusive } = calculateBillingBoundaries(billingYear, billingMonth, tz);

  // 1. Class ownership assertion if classId supplied
  if (classId) {
    await assertTenantOwnership(prisma.class, classId, madrasaId);
  }

  // 2. Student query preparation
  let candidateStudents = [];
  const isExplicitSelection = Array.isArray(rawStudentIds) && rawStudentIds.length > 0;

  if (isExplicitSelection) {
    const uniqueStudentIds = Array.from(new Set(rawStudentIds));
    candidateStudents = await prisma.student.findMany({
      where: {
        id: { in: uniqueStudentIds },
        madrasaId,
      },
      include: {
        class: { select: { id: true, name: true, code: true, defaultMonthlyFee: true } },
      },
      orderBy: { admissionNo: 'asc' },
    });

    // Anti-enumeration: all explicitly passed IDs must exist in this tenant
    if (candidateStudents.length !== uniqueStudentIds.length) {
      throw new NotFoundError('Resource not found.');
    }

    // If both classId and studentIds are supplied, all selected students must belong to that class
    if (classId) {
      const mismatched = candidateStudents.some((s) => s.classId !== classId);
      if (mismatched) {
        throw new BadRequestError('Selected students must belong to the specified class.');
      }
    }
  } else {
    // Bulk generation defaults: ACTIVE students enrolled before periodEndExclusive
    const whereClause = {
      madrasaId,
      status: 'ACTIVE',
      admissionDate: { lt: periodEndExclusive },
    };
    if (classId) {
      whereClause.classId = classId;
    }

    candidateStudents = await prisma.student.findMany({
      where: whereClause,
      include: {
        class: { select: { id: true, name: true, code: true, defaultMonthlyFee: true } },
      },
      orderBy: { admissionNo: 'asc' },
    });
  }

  const studentIds = candidateStudents.map((s) => s.id);

  // 3. Batched lookup of existing invoices for this billing period
  const existingInvoices = await prisma.invoice.findMany({
    where: {
      madrasaId,
      billingYear,
      billingMonth,
      studentId: { in: studentIds },
    },
    select: {
      id: true,
      studentId: true,
      invoiceNo: true,
      status: true,
      totalAmount: true,
    },
  });
  const existingInvoiceMap = new Map(existingInvoices.map((inv) => [inv.studentId, inv]));

  // 4. Batched lookup of StudentFeeSetting intervals for candidate students
  const feeSettings = await prisma.studentFeeSetting.findMany({
    where: {
      madrasaId,
      studentId: { in: studentIds },
      effectiveFrom: { lte: periodEndExclusive },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gt: periodStart } },
      ],
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  // Group fee settings by studentId
  const feeSettingsMap = new Map();
  for (const fs of feeSettings) {
    const list = feeSettingsMap.get(fs.studentId) || [];
    list.push(fs);
    feeSettingsMap.set(fs.studentId, list);
  }

  // 5. Evaluate each candidate student
  const previewItems = [];
  let readyCount = 0;
  let alreadyInvoicedCount = 0;
  let skippedNoFeeCount = 0;
  let skippedInactiveCount = 0;
  let skippedArchivedCount = 0;
  let skippedNotAdmittedCount = 0;
  let totalExpectedDecimal = new Prisma.Decimal('0.00');

  for (const student of candidateStudents) {
    const existing = existingInvoiceMap.get(student.id);

    // If explicitly selected, check status eligibility first
    if (isExplicitSelection) {
      if (student.status === 'INACTIVE') {
        skippedInactiveCount++;
        previewItems.push({
          studentId: student.id,
          admissionNo: student.admissionNo,
          studentName: student.fullName,
          className: student.class?.name || 'Unassigned',
          classCode: student.class?.code || null,
          feeSource: 'UNCONFIGURED',
          resolvedFee: null,
          status: 'SKIPPED_INACTIVE',
          skipReason: 'Student account is inactive.',
        });
        continue;
      }
      if (student.status === 'ARCHIVED') {
        skippedArchivedCount++;
        previewItems.push({
          studentId: student.id,
          admissionNo: student.admissionNo,
          studentName: student.fullName,
          className: student.class?.name || 'Unassigned',
          classCode: student.class?.code || null,
          feeSource: 'UNCONFIGURED',
          resolvedFee: null,
          status: 'SKIPPED_ARCHIVED',
          skipReason: 'Student record is archived.',
        });
        continue;
      }
      if (new Date(student.admissionDate) >= periodEndExclusive) {
        skippedNotAdmittedCount++;
        previewItems.push({
          studentId: student.id,
          admissionNo: student.admissionNo,
          studentName: student.fullName,
          className: student.class?.name || 'Unassigned',
          classCode: student.class?.code || null,
          feeSource: 'UNCONFIGURED',
          resolvedFee: null,
          status: 'SKIPPED_NOT_ADMITTED',
          skipReason: 'Student admitted after billing month.',
        });
        continue;
      }
    }

    // Check if already invoiced
    if (existing) {
      alreadyInvoicedCount++;
      previewItems.push({
        studentId: student.id,
        admissionNo: student.admissionNo,
        studentName: student.fullName,
        className: student.class?.name || 'Unassigned',
        classCode: student.class?.code || null,
        feeSource: 'EXISTING_INVOICE',
        resolvedFee: Number(existing.totalAmount).toFixed(2),
        status: 'ALREADY_INVOICED',
        existingInvoiceId: existing.id,
        existingInvoiceNo: existing.invoiceNo,
        skipReason: `Already invoiced as ${existing.invoiceNo}.`,
      });
      continue;
    }

    // Fee target date = max(periodStart, student.admissionDate)
    const admTime = new Date(student.admissionDate).getTime();
    const startTime = periodStart.getTime();
    const feeTargetDate = new Date(Math.max(startTime, admTime));

    // Resolve fee from batched feeSettings
    const studentSettings = feeSettingsMap.get(student.id) || [];
    const activeOverride = studentSettings.find(
      (s) => s.effectiveFrom <= feeTargetDate && (s.effectiveTo === null || s.effectiveTo > feeTargetDate)
    );

    let feeSource = 'UNCONFIGURED';
    let resolvedFee = null;

    if (activeOverride) {
      feeSource = 'STUDENT_OVERRIDE';
      resolvedFee = Number(activeOverride.amount).toFixed(2);
    } else if (student.class?.defaultMonthlyFee !== null && student.class?.defaultMonthlyFee !== undefined) {
      feeSource = 'CLASS_DEFAULT';
      resolvedFee = Number(student.class.defaultMonthlyFee).toFixed(2);
    }

    // Mandatory Correction 10: 0.00 is a valid fee; only null is UNCONFIGURED
    if (resolvedFee === null) {
      skippedNoFeeCount++;
      previewItems.push({
        studentId: student.id,
        admissionNo: student.admissionNo,
        studentName: student.fullName,
        className: student.class?.name || 'Unassigned',
        classCode: student.class?.code || null,
        feeSource: 'UNCONFIGURED',
        resolvedFee: null,
        status: 'SKIPPED_NO_FEE',
        skipReason: 'Monthly fee is not configured.',
      });
      continue;
    }

    // Ready for generation
    readyCount++;
    totalExpectedDecimal = totalExpectedDecimal.add(new Prisma.Decimal(resolvedFee));

    previewItems.push({
      studentId: student.id,
      admissionNo: student.admissionNo,
      studentName: student.fullName,
      className: student.class?.name || 'Unassigned',
      classCode: student.class?.code || null,
      feeSource,
      resolvedFee,
      status: 'READY',
      skipReason: null,
    });
  }

  const skippedCount =
    skippedNoFeeCount + skippedInactiveCount + skippedArchivedCount + skippedNotAdmittedCount;

  return {
    billingYear,
    billingMonth,
    monthName: MONTH_NAMES[billingMonth - 1],
    dueDate: dueDate || null,
    eligibleCount: candidateStudents.length,
    readyCount,
    alreadyInvoicedCount,
    skippedCount,
    skippedBreakdown: {
      noFee: skippedNoFeeCount,
      inactive: skippedInactiveCount,
      archived: skippedArchivedCount,
      notAdmitted: skippedNotAdmittedCount,
    },
    totalExpectedAmount: totalExpectedDecimal.toFixed(2),
    items: previewItems,
  };
}

/**
 * Bulk or single monthly invoice generation.
 * Recomputes all financial values server-side and enforces atomic invoice + items creation.
 * Implements bounded retries on invoiceNo collisions and clean P2002 handling.
 *
 * @param {string} madrasaId
 * @param {{ billingYear: number, billingMonth: number, dueDate: string, classId?: string|null, studentIds?: string[]|null, notes?: string|null }} data
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function generateMonthlyInvoices(madrasaId, data, userId) {
  const { billingYear, billingMonth, dueDate: rawDueDate, classId, studentIds: rawStudentIds, notes } = data;
  const tz = await getMadrasaTimezone(madrasaId);
  const invoicePrefix = await getMadrasaInvoicePrefix(madrasaId);
  const { periodStart, periodEndExclusive } = calculateBillingBoundaries(billingYear, billingMonth, tz);
  const dueDate = normalizeDueDate(rawDueDate, tz);
  const monthName = MONTH_NAMES[billingMonth - 1];

  // 1. Class ownership assertion if classId supplied
  if (classId) {
    await assertTenantOwnership(prisma.class, classId, madrasaId);
  }

  // 2. Student query
  let candidateStudents = [];
  const isExplicitSelection = Array.isArray(rawStudentIds) && rawStudentIds.length > 0;

  if (isExplicitSelection) {
    const uniqueStudentIds = Array.from(new Set(rawStudentIds));
    candidateStudents = await prisma.student.findMany({
      where: {
        id: { in: uniqueStudentIds },
        madrasaId,
      },
      include: {
        class: { select: { id: true, name: true, code: true, defaultMonthlyFee: true } },
      },
      orderBy: { admissionNo: 'asc' },
    });

    if (candidateStudents.length !== uniqueStudentIds.length) {
      throw new NotFoundError('Resource not found.');
    }

    if (classId) {
      const mismatched = candidateStudents.some((s) => s.classId !== classId);
      if (mismatched) {
        throw new BadRequestError('Selected students must belong to the specified class.');
      }
    }
  } else {
    const whereClause = {
      madrasaId,
      status: 'ACTIVE',
      admissionDate: { lt: periodEndExclusive },
    };
    if (classId) {
      whereClause.classId = classId;
    }

    candidateStudents = await prisma.student.findMany({
      where: whereClause,
      include: {
        class: { select: { id: true, name: true, code: true, defaultMonthlyFee: true } },
      },
      orderBy: { admissionNo: 'asc' },
    });
  }

  const results = [];
  let generatedCount = 0;
  let alreadyExistingCount = 0;
  let skippedNoFeeCount = 0;
  let otherSkippedCount = 0;
  let totalGeneratedDecimal = new Prisma.Decimal('0.00');

  for (const student of candidateStudents) {
    // Explicit selection eligibility checks
    if (isExplicitSelection) {
      if (student.status === 'INACTIVE') {
        otherSkippedCount++;
        results.push({
          studentId: student.id,
          admissionNo: student.admissionNo,
          studentName: student.fullName,
          status: 'SKIPPED_INACTIVE',
          skipReason: 'Student account is inactive.',
        });
        continue;
      }
      if (student.status === 'ARCHIVED') {
        otherSkippedCount++;
        results.push({
          studentId: student.id,
          admissionNo: student.admissionNo,
          studentName: student.fullName,
          status: 'SKIPPED_ARCHIVED',
          skipReason: 'Student record is archived.',
        });
        continue;
      }
      if (new Date(student.admissionDate) >= periodEndExclusive) {
        otherSkippedCount++;
        results.push({
          studentId: student.id,
          admissionNo: student.admissionNo,
          studentName: student.fullName,
          status: 'SKIPPED_NOT_ADMITTED',
          skipReason: 'Student admitted after billing month.',
        });
        continue;
      }
    }

    const admTime = new Date(student.admissionDate).getTime();
    const startTime = periodStart.getTime();
    const feeTargetDate = new Date(Math.max(startTime, admTime));

    // Bounded retries on invoice number collision (Mandatory Correction 1)
    let attempts = 0;
    const maxAttempts = 5;
    let studentResult = null;

    while (attempts < maxAttempts) {
      attempts++;
      const candidateInvoiceNo = generateInvoiceNumber(invoicePrefix, billingYear, billingMonth);

      try {
        studentResult = await prisma.$transaction(async (tx) => {
          // 1. In-transaction duplicate check (Mandatory Correction 9)
          const existing = await tx.invoice.findFirst({
            where: { madrasaId, studentId: student.id, billingYear, billingMonth },
          });
          if (existing) {
            return {
              status: 'ALREADY_INVOICED',
              invoiceId: existing.id,
              invoiceNo: existing.invoiceNo,
              totalAmount: Number(existing.totalAmount).toFixed(2),
            };
          }

          // 2. In-transaction fee resolution (Mandatory Correction 9)
          const feeResult = await getEffectiveStudentFee(student.id, madrasaId, feeTargetDate, tx);
          if (feeResult.effectiveMonthlyFee === null) {
            return {
              status: 'SKIPPED_NO_FEE',
              skipReason: 'Monthly fee is not configured.',
            };
          }

          const feeDecimal = new Prisma.Decimal(feeResult.effectiveMonthlyFee);

          // 3. Create Invoice + InvoiceItem atomically with explicit initial financial state (Mandatory Correction 2)
          const invoice = await tx.invoice.create({
            data: {
              madrasaId,
              studentId: student.id,
              invoiceNo: candidateInvoiceNo,
              billingYear,
              billingMonth,
              issueDate: new Date(),
              dueDate,
              subtotal: feeDecimal,
              discountAmount: new Prisma.Decimal('0.00'),
              totalAmount: feeDecimal,
              paidAmount: new Prisma.Decimal('0.00'),
              balanceAmount: feeDecimal,
              status: 'PENDING',
              notes: notes ? notes.trim() : null,
              items: {
                create: {
                  description: `Monthly Fee — ${monthName} ${billingYear}`,
                  quantity: 1,
                  unitAmount: feeDecimal,
                  totalAmount: feeDecimal,
                },
              },
            },
            select: {
              id: true,
              invoiceNo: true,
              totalAmount: true,
              status: true,
              dueDate: true,
            },
          });

          return {
            status: 'GENERATED',
            invoiceId: invoice.id,
            invoiceNo: invoice.invoiceNo,
            totalAmount: Number(invoice.totalAmount).toFixed(2),
            feeSource: feeResult.feeSource,
          };
        });

        // Break on clean transaction resolution
        break;
      } catch (err) {
        if (isInvoiceNoCollision(err)) {
          if (attempts >= maxAttempts) {
            throw new ConflictError('Failed to generate a unique invoice number after multiple attempts. Please try again.');
          }
          // Retry with fresh candidate invoice number
          continue;
        }
        if (isMonthlyDuplicateCollision(err)) {
          // Concurrent monthly duplicate: report ALREADY_INVOICED safely
          const existing = await prisma.invoice.findFirst({
            where: { madrasaId, studentId: student.id, billingYear, billingMonth },
          });
          studentResult = {
            status: 'ALREADY_INVOICED',
            invoiceId: existing?.id || null,
            invoiceNo: existing?.invoiceNo || null,
            totalAmount: existing ? Number(existing.totalAmount).toFixed(2) : null,
          };
          break;
        }
        throw err;
      }
    }

    if (studentResult.status === 'GENERATED') {
      generatedCount++;
      totalGeneratedDecimal = totalGeneratedDecimal.add(new Prisma.Decimal(studentResult.totalAmount));
    } else if (studentResult.status === 'ALREADY_INVOICED') {
      alreadyExistingCount++;
    } else if (studentResult.status === 'SKIPPED_NO_FEE') {
      skippedNoFeeCount++;
    }

    results.push({
      studentId: student.id,
      admissionNo: student.admissionNo,
      studentName: student.fullName,
      className: student.class?.name || 'Unassigned',
      ...studentResult,
    });
  }

  // Summary ActivityLog (Avoid log storm for bulk runs, Mandatory Correction 80)
  const logAction = isExplicitSelection && candidateStudents.length === 1 ? 'INVOICE_GENERATED' : 'INVOICE_BULK_GENERATED';
  await prisma.activityLog.create({
    data: {
      madrasaId,
      userId,
      action: logAction,
      entityType: 'INVOICE',
      entityId: results.find((r) => r.status === 'GENERATED')?.invoiceId || null,
      metadata: {
        billingYear,
        billingMonth,
        monthName,
        generatedCount,
        alreadyExistingCount,
        skippedCount: skippedNoFeeCount + otherSkippedCount,
        totalAmount: totalGeneratedDecimal.toFixed(2),
      },
    },
  });

  return {
    billingYear,
    billingMonth,
    monthName,
    generatedCount,
    alreadyExistingCount,
    skippedNoFeeCount,
    otherSkippedCount,
    totalGeneratedAmount: totalGeneratedDecimal.toFixed(2),
    items: results,
  };
}

/**
 * Lists tenant invoices with search, filters, pagination, and summary financial KPIs.
 * Excludes VOID records from expected & outstanding collectible totals.
 *
 * @param {string} madrasaId
 * @param {object} query
 * @returns {Promise<object>}
 */
export async function listInvoices(madrasaId, query) {
  const {
    page = 1,
    pageSize = 20,
    billingYear,
    billingMonth,
    status = 'ALL',
    classId,
    studentId,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = query;

  const skip = (page - 1) * pageSize;
  const take = pageSize;
  const now = new Date();

  // Base tenant filter
  const baseWhere = { madrasaId };

  if (billingYear) baseWhere.billingYear = billingYear;
  if (billingMonth) baseWhere.billingMonth = billingMonth;
  if (studentId) baseWhere.studentId = studentId;

  if (classId) {
    baseWhere.student = {
      ...(baseWhere.student || {}),
      classId,
    };
  }

  if (search && search.trim()) {
    const q = search.trim();
    baseWhere.OR = [
      { invoiceNo: { contains: q } },
      { student: { admissionNo: { contains: q } } },
      { student: { fullName: { contains: q } } },
    ];
  }

  // Filter-specific where for paginated items and total
  const itemsWhere = { ...baseWhere };

  if (status === 'VOID') {
    itemsWhere.status = 'VOID';
  } else if (status === 'PAID') {
    itemsWhere.status = 'PAID';
  } else if (status === 'PARTIAL') {
    itemsWhere.status = 'PARTIAL';
  } else if (status === 'OVERDUE') {
    itemsWhere.status = { in: ['PENDING', 'PARTIAL'] };
    itemsWhere.dueDate = { lt: now };
    itemsWhere.balanceAmount = { gt: 0 };
  } else if (status === 'PENDING') {
    itemsWhere.status = 'PENDING';
    itemsWhere.OR = [
      { dueDate: null },
      { dueDate: { gte: now } },
      { balanceAmount: { lte: 0 } },
    ];
  }

  // 1. Fetch paginated records & total count
  const [invoices, totalItems] = await Promise.all([
    prisma.invoice.findMany({
      where: itemsWhere,
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            fullName: true,
            class: { select: { id: true, name: true, code: true } },
          },
        },
        items: {
          select: { id: true, description: true, quantity: true, unitAmount: true, totalAmount: true },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
    }),
    prisma.invoice.count({ where: itemsWhere }),
  ]);

  // 2. Compute Summary Financial KPIs on base scope (Mandatory Correction 11)
  // Non-void totals for expected, paid, and outstanding
  const [activeAgg, voidCount, overdueCount, paidCount, pendingCount, partialCount] = await Promise.all([
    prisma.invoice.aggregate({
      where: {
        ...baseWhere,
        status: { not: 'VOID' },
      },
      _sum: {
        totalAmount: true,
        paidAmount: true,
        balanceAmount: true,
      },
      _count: { id: true },
    }),
    prisma.invoice.count({
      where: {
        ...baseWhere,
        status: 'VOID',
      },
    }),
    prisma.invoice.count({
      where: {
        ...baseWhere,
        status: { in: ['PENDING', 'PARTIAL'] },
        dueDate: { lt: now },
        balanceAmount: { gt: 0 },
      },
    }),
    prisma.invoice.count({
      where: {
        ...baseWhere,
        status: 'PAID',
      },
    }),
    prisma.invoice.count({
      where: {
        ...baseWhere,
        status: 'PENDING',
        OR: [
          { dueDate: null },
          { dueDate: { gte: now } },
          { balanceAmount: { lte: 0 } },
        ],
      },
    }),
    prisma.invoice.count({
      where: {
        ...baseWhere,
        status: 'PARTIAL',
        OR: [
          { dueDate: null },
          { dueDate: { gte: now } },
        ],
      },
    }),
  ]);

  const summary = {
    totalInvoices: activeAgg._count.id || 0,
    expectedAmount: Number(activeAgg._sum.totalAmount || 0).toFixed(2),
    paidAmount: Number(activeAgg._sum.paidAmount || 0).toFixed(2),
    outstandingAmount: Number(activeAgg._sum.balanceAmount || 0).toFixed(2),
    pendingCount,
    partialCount,
    paidCount,
    overdueCount,
    voidCount,
  };

  // Map each invoice with centralized displayStatus & isOverdue
  const mappedItems = invoices.map((inv) => {
    const { displayStatus, isOverdue } = resolveInvoiceDisplayStatus(inv, now);
    return {
      id: inv.id,
      invoiceNo: inv.invoiceNo,
      billingYear: inv.billingYear,
      billingMonth: inv.billingMonth,
      monthName: MONTH_NAMES[inv.billingMonth - 1],
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      subtotal: Number(inv.subtotal).toFixed(2),
      discountAmount: Number(inv.discountAmount).toFixed(2),
      totalAmount: Number(inv.totalAmount).toFixed(2),
      paidAmount: Number(inv.paidAmount).toFixed(2),
      balanceAmount: Number(inv.balanceAmount).toFixed(2),
      status: inv.status,
      displayStatus,
      isOverdue,
      notes: inv.notes,
      student: {
        id: inv.student.id,
        admissionNo: inv.student.admissionNo,
        fullName: inv.student.fullName,
        currentClass: inv.student.class
          ? { id: inv.student.class.id, name: inv.student.class.name, code: inv.student.class.code }
          : null,
      },
      itemCount: inv.items.length,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
    };
  });

  return {
    items: mappedItems,
    pagination: {
      page,
      pageSize,
      total: totalItems,
      totalPages: Math.ceil(totalItems / pageSize) || 1,
    },
    summary,
  };
}

/**
 * Fetches a single invoice dossier by ID with strict tenant isolation.
 *
 * @param {string} madrasaId
 * @param {string} invoiceId
 * @returns {Promise<object>}
 */
export async function getInvoiceById(madrasaId, invoiceId) {
  const invoice = await findTenantRecordOrThrow(prisma.invoice, invoiceId, madrasaId, {
    include: {
      student: {
        select: {
          id: true,
          admissionNo: true,
          fullName: true,
          guardianName: true,
          guardianPhone: true,
          whatsappNumber: true,
          class: { select: { id: true, name: true, code: true } },
        },
      },
      items: {
        select: {
          id: true,
          description: true,
          quantity: true,
          unitAmount: true,
          totalAmount: true,
          createdAt: true,
        },
      },
      allocations: {
        include: {
          payment: {
            select: {
              id: true,
              paymentNo: true,
              amount: true,
              paymentMethod: true,
              status: true,
              paidAt: true,
            },
          },
        },
      },
    },
  });

  const { displayStatus, isOverdue } = resolveInvoiceDisplayStatus(invoice);

  // If VOID, retrieve void metadata from ActivityLog without destroying notes (Mandatory Correction 6)
  let voidMetadata = null;
  if (invoice.status === 'VOID') {
    const voidLog = await prisma.activityLog.findFirst({
      where: {
        madrasaId,
        entityId: invoice.id,
        action: 'INVOICE_VOIDED',
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (voidLog) {
      voidMetadata = {
        voidedAt: voidLog.createdAt,
        reason: voidLog.metadata?.reason || null,
        voidedBy: voidLog.user?.name || voidLog.user?.email || 'Administrator',
      };
    }
  }

  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    billingYear: invoice.billingYear,
    billingMonth: invoice.billingMonth,
    monthName: MONTH_NAMES[invoice.billingMonth - 1],
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    subtotal: Number(invoice.subtotal).toFixed(2),
    discountAmount: Number(invoice.discountAmount).toFixed(2),
    totalAmount: Number(invoice.totalAmount).toFixed(2),
    paidAmount: Number(invoice.paidAmount).toFixed(2),
    balanceAmount: Number(invoice.balanceAmount).toFixed(2),
    status: invoice.status,
    displayStatus,
    isOverdue,
    notes: invoice.notes,
    voidMetadata,
    student: {
      id: invoice.student.id,
      admissionNo: invoice.student.admissionNo,
      fullName: invoice.student.fullName,
      guardianName: invoice.student.guardianName,
      guardianPhone: invoice.student.guardianPhone,
      whatsappNumber: invoice.student.whatsappNumber,
      currentClass: invoice.student.class
        ? { id: invoice.student.class.id, name: invoice.student.class.name, code: invoice.student.class.code }
        : null,
    },
    items: invoice.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitAmount: Number(item.unitAmount).toFixed(2),
      totalAmount: Number(item.totalAmount).toFixed(2),
    })),
    allocations: invoice.allocations.map((a) => ({
      id: a.id,
      amount: Number(a.amount).toFixed(2),
      paymentNo: a.payment.paymentNo,
      paymentMethod: a.payment.paymentMethod,
      paidAt: a.payment.paidAt,
    })),
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

/**
 * Voids an invoice while preserving existing notes and audit metadata.
 * Fails safely if completed payment allocations exist (Mandatory Correction 6 & 12).
 *
 * @param {string} madrasaId
 * @param {string} invoiceId
 * @param {string} reason
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function voidInvoice(madrasaId, invoiceId, reason, userId) {
  const invoice = await findTenantRecordOrThrow(prisma.invoice, invoiceId, madrasaId, {
    include: {
      allocations: {
        where: {
          payment: { status: 'COMPLETED' },
        },
      },
    },
  });

  if (invoice.status === 'VOID') {
    throw new ConflictError('Invoice is already voided.');
  }

  // Safety: Cannot casually void an invoice with allocated payments
  if (invoice.allocations && invoice.allocations.length > 0) {
    throw new BadRequestError(
      'Cannot void an invoice with existing payment allocations. Payment reversals must be handled through Phase 10 payment management.'
    );
  }

  // Preserve existing notes, update status to VOID, and record void audit log
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: 'VOID' },
    });

    await tx.activityLog.create({
      data: {
        madrasaId,
        userId,
        action: 'INVOICE_VOIDED',
        entityType: 'INVOICE',
        entityId: invoice.id,
        metadata: {
          invoiceNo: invoice.invoiceNo,
          reason: reason.trim(),
          voidedAt: new Date().toISOString(),
          voidedBy: userId,
        },
      },
    });
  });

  return await getInvoiceById(madrasaId, invoiceId);
}

/**
 * Returns paginated invoices for a specific student.
 *
 * @param {string} madrasaId
 * @param {string} studentId
 * @param {{ page?: number, pageSize?: number }} query
 * @returns {Promise<object>}
 */
export async function getStudentInvoices(madrasaId, studentId, query = {}) {
  await assertTenantOwnership(prisma.student, studentId, madrasaId);

  const page = Number(query.page) || 1;
  const pageSize = Number(query.pageSize) || 20;
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  const now = new Date();

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where: { madrasaId, studentId },
      include: {
        items: {
          select: { id: true, description: true, quantity: true, unitAmount: true, totalAmount: true },
        },
      },
      orderBy: [
        { billingYear: 'desc' },
        { billingMonth: 'desc' },
        { createdAt: 'desc' },
      ],
      skip,
      take,
    }),
    prisma.invoice.count({ where: { madrasaId, studentId } }),
  ]);

  const mapped = invoices.map((inv) => {
    const { displayStatus, isOverdue } = resolveInvoiceDisplayStatus(inv, now);
    return {
      id: inv.id,
      invoiceNo: inv.invoiceNo,
      billingYear: inv.billingYear,
      billingMonth: inv.billingMonth,
      monthName: MONTH_NAMES[inv.billingMonth - 1],
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      subtotal: Number(inv.subtotal).toFixed(2),
      discountAmount: Number(inv.discountAmount).toFixed(2),
      totalAmount: Number(inv.totalAmount).toFixed(2),
      paidAmount: Number(inv.paidAmount).toFixed(2),
      balanceAmount: Number(inv.balanceAmount).toFixed(2),
      status: inv.status,
      displayStatus,
      isOverdue,
      notes: inv.notes,
      itemCount: inv.items.length,
      createdAt: inv.createdAt,
    };
  });

  return {
    items: mapped,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}
