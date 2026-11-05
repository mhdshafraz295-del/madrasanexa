import { prisma } from '../lib/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logTenantActivity } from './tenant.service.js';
import { parseDateOnly, formatDateOnly } from './ustadh.service.js';
import { getMonthlyAttendanceSummary } from './ustadh-attendance.service.js';
import { sendUstadhSalaryPaidEmail, sendUstadhDirectEmail } from './email.service.js';
import { renderRawHtmlToPdf, formatPaymentMethodLabel } from './pdf-report.service.js';
import { resolveLogoDataUri } from './branding.service.js';
import { Prisma } from '@prisma/client';
import { maskRecipientAddress } from './notification.service.js';

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
 * Parses YYYY-MM to the first day of that month (UTC midnight).
 *
 * @param {string} monthStr
 * @returns {Date}
 */
export function parseSalaryMonth(monthStr) {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
    throw new BadRequestError('Invalid month format. Expected YYYY-MM.');
  }
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

/**
 * Formats a Date into YYYY-MM string.
 *
 * @param {Date|string} d
 * @returns {string}
 */
export function formatSalaryMonth(d) {
  if (!d) return '';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Generates monthly salaries for all eligible Ustadhs for a given month.
 * Idempotent: Existing records are NEVER overwritten or snapshot values replaced.
 *
 * @param {string} madrasaId
 * @param {string} userId
 * @param {string} monthStr
 * @returns {Promise<object>}
 */
export async function generateMonthlySalaries(madrasaId, userId, monthStr) {
  const salaryMonth = parseSalaryMonth(monthStr);
  const [year, month] = monthStr.split('-').map(Number);
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endOfMonth = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59, 999));

  // 1. Find all eligible Ustadhs whose employment period overlaps this month
  const eligibleUstadhs = await prisma.ustadh.findMany({
    where: {
      madrasaId,
      joinDate: { lte: endOfMonth },
      OR: [
        { leaveDate: null },
        { leaveDate: { gte: startOfMonth } },
      ],
    },
    select: {
      id: true,
      fullName: true,
      ustadhCode: true,
      baseMonthlySalary: true,
    },
  });

  // 2. Fetch existing salaries for this month to avoid overwriting snapshots
  const existingSalaries = await prisma.ustadhSalary.findMany({
    where: {
      madrasaId,
      salaryMonth,
    },
    select: { ustadhId: true },
  });

  const existingUstadhIds = new Set(existingSalaries.map((s) => s.ustadhId));

  // 3. Filter only Ustadhs that do not yet have a record
  const missingUstadhs = eligibleUstadhs.filter((u) => !existingUstadhIds.has(u.id));

  // 4. Create missing records (preserving existing ones completely untouched)
  if (missingUstadhs.length > 0) {
    await prisma.ustadhSalary.createMany({
      data: missingUstadhs.map((u) => ({
        madrasaId,
        ustadhId: u.id,
        salaryMonth,
        baseSalarySnapshot: u.baseMonthlySalary,
        payableAmount: u.baseMonthlySalary,
        status: 'PENDING',
      })),
      skipDuplicates: true,
    });

    logTenantActivity({
      madrasaId,
      userId,
      action: 'USTADH_SALARY_GENERATED',
      entityType: 'UstadhSalary',
      entityId: monthStr,
      metadata: { month: monthStr, createdCount: missingUstadhs.length },
    }).catch(() => {});
  }

  // Return all salaries for this month
  return await getSalaries(madrasaId, { month: monthStr, pageSize: 100 });
}

/**
 * Retrieves salaries with optional month/status filters and attendance metrics.
 *
 * @param {string} madrasaId
 * @param {object} query
 * @returns {Promise<object>}
 */
export async function getSalaries(madrasaId, query = {}) {
  const { month, ustadhId, status, staffType, page = 1, pageSize = 50 } = query;
  const where = { madrasaId };

  let monthStr = null;
  if (month) {
    where.salaryMonth = parseSalaryMonth(month);
    monthStr = month;
  }
  if (ustadhId) {
    where.ustadhId = ustadhId;
  }
  if (status) {
    where.status = status;
  }
  if (staffType && ['USTADH', 'SCHOOL_TEACHER'].includes(staffType)) {
    where.ustadh = { staffType };
  }

  const [total, items] = await Promise.all([
    prisma.ustadhSalary.count({ where }),
    prisma.ustadhSalary.findMany({
      where,
      orderBy: [{ salaryMonth: 'desc' }, { ustadh: { ustadhCode: 'asc' } }],
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      include: {
        ustadh: {
          select: {
            id: true,
            fullName: true,
            ustadhCode: true,
            staffType: true,
            phoneNumber: true,
            whatsappNumber: true,
            email: true,
          },
        },
        paidBy: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  // If a specific month is queried, attach attendance stats per Ustadh
  let attendanceMap = new Map();
  if (monthStr) {
    const attSummary = await getMonthlyAttendanceSummary(madrasaId, { month: monthStr });
    for (const item of attSummary.items) {
      attendanceMap.set(item.ustadhId, item);
    }
  }

  const formattedItems = items.map((s) => {
    const formatted = formatSalaryResponse(s);
    const att = attendanceMap.get(s.ustadhId);

    return {
      ...formatted,
      attendance: att
        ? {
            recordedSessions: att.recordedSessions,
            presentSessions: att.presentSessions,
            absentSessions: att.absentSessions,
            attendancePercentage: att.attendancePercentage,
          }
        : {
            recordedSessions: 0,
            presentSessions: 0,
            absentSessions: 0,
            attendancePercentage: 0.0,
          },
    };
  });

  return {
    items: formattedItems,
    total,
    page: Number(page),
    pageSize: Number(pageSize),
    totalPages: Math.ceil(total / Number(pageSize)) || 1,
  };
}

export const listSalaries = getSalaries;

/**
 * Updates payable amount for a PENDING salary record.
 * If payableAmount != baseSalarySnapshot, adjustmentReason is MANDATORY.
 * PAID records are strictly immutable.
 *
 * @param {string} madrasaId
 * @param {string} salaryId
 * @param {string} userId
 * @param {{ payableAmount: number|string, adjustmentReason?: string }} payload
 * @returns {Promise<object>}
 */
export async function updateSalaryPayable(madrasaId, salaryId, userId, payload) {
  const existing = await prisma.ustadhSalary.findFirst({
    where: { id: salaryId, madrasaId },
  });

  if (!existing) {
    throw new NotFoundError('Salary record not found.');
  }

  if (existing.status === 'PAID') {
    throw new BadRequestError('Paid salary records are immutable and cannot be edited.');
  }

  const newPayable = new Prisma.Decimal(payload.payableAmount);
  const isDifferentFromBase = !newPayable.equals(existing.baseSalarySnapshot);

  const reason = payload.adjustmentReason ? payload.adjustmentReason.trim() : '';

  if (isDifferentFromBase && !reason) {
    throw new BadRequestError('Adjustment reason is mandatory when payable amount differs from base salary snapshot.');
  }

  const updated = await prisma.ustadhSalary.update({
    where: { id: existing.id },
    data: {
      payableAmount: newPayable,
      adjustmentReason: isDifferentFromBase ? reason : null,
    },
    include: {
      ustadh: {
        select: {
          id: true,
          fullName: true,
          ustadhCode: true,
          phoneNumber: true,
          whatsappNumber: true,
          email: true,
        },
      },
      paidBy: { select: { id: true, name: true, email: true } },
    },
  });

  logTenantActivity({
    madrasaId,
    userId,
    action: 'USTADH_SALARY_UPDATED',
    entityType: 'UstadhSalary',
    entityId: updated.id,
    metadata: {
      ustadhId: updated.ustadhId,
      baseSalarySnapshot: updated.baseSalarySnapshot.toString(),
      payableAmount: updated.payableAmount.toString(),
      adjustmentReason: updated.adjustmentReason,
    },
  }).catch(() => {});

  return formatSalaryResponse(updated);
}

/**
 * Marks a salary record as PAID atomically with double-click protection and post-commit email.
 *
 * @param {string} madrasaId
 * @param {string} salaryId
 * @param {string} userId
 * @param {{ paymentMethod: string, paymentDate: string, paymentReference?: string, paymentNote?: string }} paymentData
 * @returns {Promise<object>}
 */
export async function paySalary(madrasaId, salaryId, userId, paymentData) {
  const paymentDate = paymentData.paymentDate ? parseDateOnly(paymentData.paymentDate) : new Date();

  let createdJob = null;
  let emailNotificationStatus = 'DISABLED';
  let emailQueued = false;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Atomic transition from PENDING -> PAID
    const updateResult = await tx.ustadhSalary.updateMany({
      where: {
        id: salaryId,
        madrasaId,
        status: 'PENDING',
      },
      data: {
        status: 'PAID',
        paymentMethod: paymentData.paymentMethod,
        paymentDate,
        paymentReference: paymentData.paymentReference ? paymentData.paymentReference.trim() : null,
        paymentNote: paymentData.paymentNote ? paymentData.paymentNote.trim() : null,
        paidById: userId,
        paidAt: new Date(),
      },
    });

    // If update count is 0, check if already paid or not found
    if (updateResult.count === 0) {
      const existing = await tx.ustadhSalary.findFirst({
        where: { id: salaryId, madrasaId },
        include: {
          ustadh: { select: { id: true, fullName: true, ustadhCode: true, email: true, whatsappNumber: true } },
          paidBy: { select: { id: true, name: true, email: true } },
        },
      });

      if (!existing) {
        throw new NotFoundError('Salary record not found.');
      }

      if (existing.status === 'PAID') {
        // Safe idempotent return: already paid
        return {
          alreadyPaid: true,
          emailQueued: false,
          emailSent: false,
          emailNotificationStatus: 'ALREADY_PAID',
          notificationJobId: null,
          data: formatSalaryResponse(existing),
        };
      }
    }

    // Fetch the newly paid record
    const paidSalary = await tx.ustadhSalary.findFirst({
      where: { id: salaryId, madrasaId },
      include: {
        ustadh: { select: { id: true, fullName: true, ustadhCode: true, email: true, whatsappNumber: true, staffType: true } },
        paidBy: { select: { id: true, name: true, email: true } },
      },
    });

    await tx.activityLog.create({
      data: {
        madrasaId,
        userId,
        action: 'USTADH_SALARY_PAID',
        entityType: 'UstadhSalary',
        entityId: paidSalary.id,
        metadata: {
          ustadhId: paidSalary.ustadhId,
          salaryMonth: formatSalaryMonth(paidSalary.salaryMonth),
          payableAmount: paidSalary.payableAmount.toString(),
          paymentMethod: paidSalary.paymentMethod,
        },
      },
    });

    // Check setting for automatic salary email
    const setting = await tx.madrasaSetting.findUnique({
      where: { madrasaId },
      select: { autoSalaryPaidEmailEnabled: true },
    });

    // Option A: defaults true if not explicitly set to false
    const isAutoSalaryEmailEnabled = setting?.autoSalaryPaidEmailEnabled !== false;

    if (isAutoSalaryEmailEnabled) {
      const rawEmail = paidSalary.ustadh?.email;
      const hasEmail = Boolean(rawEmail && typeof rawEmail === 'string' && rawEmail.trim() !== '');
      const staffEmail = hasEmail ? rawEmail.trim().toLowerCase() : null;
      const dedupeKey = `SALARY_PAID:${paidSalary.id}:${staffEmail || 'NO_RECIPIENT'}`;

      if (hasEmail) {
        const job = await tx.notificationJob.create({
          data: {
            madrasaId,
            channel: 'EMAIL',
            eventType: 'SALARY_PAID',
            recipientType: 'STAFF',
            recipientEntityId: paidSalary.ustadh.id,
            recipientAddress: staffEmail,
            recipientName: paidSalary.ustadh.fullName,
            subject: `Salary Payment Confirmation — ${formatSalaryMonth(paidSalary.salaryMonth)}`,
            message: `Salary of LKR ${parseFloat(paidSalary.payableAmount.toString()).toLocaleString('en-US', { minimumFractionDigits: 2 })} has been paid for month ${formatSalaryMonth(paidSalary.salaryMonth)}.`,
            payloadJson: {
              salaryId: paidSalary.id,
              staffId: paidSalary.ustadh.id,
              salaryMonth: formatSalaryMonth(paidSalary.salaryMonth),
              payableAmount: paidSalary.payableAmount.toString(),
              baseSalarySnapshot: paidSalary.baseSalarySnapshot.toString(),
              adjustmentReason: paidSalary.adjustmentReason,
              paymentMethod: paidSalary.paymentMethod,
              paymentDate: formatDateOnly(paidSalary.paymentDate),
            },
            relatedEntityType: 'UstadhSalary',
            relatedEntityId: paidSalary.id,
            dedupeKey,
            status: 'PENDING',
          },
        });

        await tx.activityLog.create({
          data: {
            madrasaId,
            userId,
            action: 'AUTO_SALARY_EMAIL_QUEUED',
            entityType: 'NotificationJob',
            entityId: paidSalary.id,
            metadata: {
              salaryId: paidSalary.id,
              recipient: maskRecipientAddress('EMAIL', staffEmail),
              status: 'PENDING',
            },
          },
        });

        emailNotificationStatus = 'QUEUED';
        emailQueued = true;
        createdJob = job;
      } else {
        const skipJob = await tx.notificationJob.create({
          data: {
            madrasaId,
            channel: 'EMAIL',
            eventType: 'SALARY_PAID',
            recipientType: 'STAFF',
            recipientEntityId: paidSalary.ustadh.id,
            recipientAddress: null,
            recipientName: paidSalary.ustadh.fullName,
            subject: `Salary Payment Confirmation — ${formatSalaryMonth(paidSalary.salaryMonth)}`,
            message: `Salary of LKR ${parseFloat(paidSalary.payableAmount.toString()).toLocaleString('en-US', { minimumFractionDigits: 2 })} has been paid for month ${formatSalaryMonth(paidSalary.salaryMonth)}.`,
            payloadJson: {
              salaryId: paidSalary.id,
              staffId: paidSalary.ustadh.id,
              salaryMonth: formatSalaryMonth(paidSalary.salaryMonth),
              payableAmount: paidSalary.payableAmount.toString(),
            },
            relatedEntityType: 'UstadhSalary',
            relatedEntityId: paidSalary.id,
            dedupeKey,
            status: 'SKIPPED_NO_RECIPIENT',
          },
        });

        emailNotificationStatus = 'SKIPPED_NO_RECIPIENT';
        emailQueued = false;
        createdJob = skipJob;
      }
    } else {
      emailNotificationStatus = 'DISABLED';
      emailQueued = false;
      createdJob = null;
    }

    return {
      alreadyPaid: false,
      emailQueued,
      emailSent: false,
      emailNotificationStatus,
      notificationJobId: createdJob?.id || null,
      data: formatSalaryResponse(paidSalary),
    };
  });

  return result;
}

/**
 * Sends a direct administrative communication email to an Ustadh.
 * Recipient comes strictly from tenant-owned Ustadh.email (no arbitrary injection).
 *
 * @param {string} madrasaId
 * @param {string} ustadhId
 * @param {string} userId
 * @param {{ subject: string, message: string }} payload
 * @returns {Promise<object>}
 */
export async function sendDirectEmail(madrasaId, ustadhId, userId, payload) {
  const ustadh = await prisma.ustadh.findFirst({
    where: { id: ustadhId, madrasaId },
    select: { id: true, fullName: true, email: true },
  });

  if (!ustadh) {
    throw new NotFoundError('Ustadh not found.');
  }

  if (!ustadh.email) {
    throw new BadRequestError('This Ustadh does not have an email address configured.');
  }

  const madrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
    select: { name: true },
  });

  await sendUstadhDirectEmail({
    madrasaId,
    to: ustadh.email,
    ustadhName: ustadh.fullName,
    madrasaName: madrasa?.name || 'Madrasa Administration',
    subject: payload.subject,
    message: payload.message,
  });

  logTenantActivity({
    madrasaId,
    userId,
    action: 'USTADH_EMAIL_SENT',
    entityType: 'Ustadh',
    entityId: ustadh.id,
    metadata: { subject: payload.subject },
  }).catch(() => {});

  return { success: true, message: 'Email sent successfully.' };
}

/**
 * Generates an institutional Puppeteer A4 PDF salary slip for a PAID salary.
 * Uses immutable snapshot and payment data.
 *
 * @param {string} madrasaId
 * @param {string} salaryId
 * @returns {Promise<Buffer>}
 */
export async function generateSalarySlipPdf(madrasaId, salaryId) {
  const salary = await prisma.ustadhSalary.findFirst({
    where: { id: salaryId, madrasaId },
    include: {
      ustadh: true,
      paidBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!salary) {
    throw new NotFoundError('Salary record not found.');
  }

  if (salary.status !== 'PAID') {
    throw new BadRequestError('Salary slip can only be downloaded for paid salaries.');
  }

  const madrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
  });

  let logoDataUri = null;
  try {
    logoDataUri = await resolveLogoDataUri(madrasaId);
  } catch (e) {
    logoDataUri = null;
  }

  const monthStr = formatSalaryMonth(salary.salaryMonth);
  const attSummary = await getMonthlyAttendanceSummary(madrasaId, {
    month: monthStr,
    ustadhId: salary.ustadhId,
  });

  const att = attSummary.items[0] || {
    recordedSessions: 0,
    presentSessions: 0,
    absentSessions: 0,
    attendancePercentage: 0.0,
  };

  const madrasaName = escapeHtml(madrasa?.name || 'Madrasa');
  const madrasaAddress = escapeHtml(madrasa?.address || '');
  const madrasaPhone = escapeHtml(madrasa?.phone || '');
  const ustadhName = escapeHtml(salary.ustadh.fullName);
  const ustadhCode = escapeHtml(salary.ustadh.ustadhCode);
  const baseSalary = parseFloat(salary.baseSalarySnapshot.toString());
  const payableAmount = parseFloat(salary.payableAmount.toString());
  const adjustmentDiff = payableAmount - baseSalary;
  const adjustmentReason = escapeHtml(salary.adjustmentReason || 'Standard payout');
  const paymentMethod = escapeHtml(formatPaymentMethodLabel(salary.paymentMethod));
  const paymentDate = escapeHtml(formatDateOnly(salary.paymentDate));
  const paymentReference = escapeHtml(salary.paymentReference || 'N/A');
  const paidByAdmin = escapeHtml(salary.paidBy?.name || 'Administrator');

  const fullHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Salary Slip - ${ustadhCode} - ${monthStr}</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 15mm 15mm;
      }
      body {
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        color: #0F172A;
        background-color: #FFFFFF;
        margin: 0;
        padding: 0;
        font-size: 12px;
      }
      .slip-container {
        border: 1px solid #E2E8F0;
        border-radius: 12px;
        padding: 24px;
      }
      .header-table {
        width: 100%;
        border-bottom: 2px solid #0F172A;
        padding-bottom: 16px;
        margin-bottom: 20px;
      }
      .title-box {
        background-color: #0F172A;
        color: #FFFFFF;
        padding: 6px 12px;
        border-radius: 6px;
        display: inline-block;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 20px;
      }
      .panel {
        background: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 8px;
        padding: 12px 14px;
      }
      .panel-title {
        font-size: 10px;
        font-weight: 700;
        color: #64748B;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 8px;
        border-bottom: 1px solid #E2E8F0;
        padding-bottom: 4px;
      }
      .detail-row {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        font-size: 12px;
      }
      .detail-label { color: #64748B; }
      .detail-value { font-weight: 600; color: #0F172A; }
      .financial-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        border: 1px solid #E2E8F0;
      }
      .financial-table th {
        background: #0F172A;
        color: #FFFFFF;
        padding: 8px 12px;
        font-size: 11px;
        font-weight: 600;
        text-align: left;
      }
      .financial-table td {
        padding: 10px 12px;
        border-bottom: 1px solid #E2E8F0;
        font-size: 12px;
      }
      .financial-table tr.total-row td {
        background: #F8FAFC;
        font-weight: 700;
        font-size: 14px;
        color: #059669;
        border-top: 2px solid #CBD5E1;
      }
      .badge-paid {
        display: inline-block;
        background: #DEF7EC;
        color: #03543F;
        padding: 2px 8px;
        border-radius: 9999px;
        font-weight: 700;
        font-size: 11px;
      }
      .footer-sign {
        margin-top: 40px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
      }
      .sign-box {
        border-top: 1px dashed #94A3B8;
        padding-top: 8px;
        text-align: center;
        font-size: 11px;
        color: #64748B;
      }
    </style>
  </head>
  <body>
    <div class="slip-container">
      <!-- Header -->
      <table class="header-table">
        <tr>
          <td style="vertical-align: middle;">
            ${logoDataUri ? `<img src="${logoDataUri}" style="height: 48px; max-width: 140px; object-fit: contain; margin-bottom: 6px;" />` : ''}
            <div style="font-size: 18px; font-weight: 800; color: #0F172A;">${madrasaName}</div>
            <div style="font-size: 11px; color: #64748B;">${madrasaAddress} ${madrasaPhone ? `| Tel: ${madrasaPhone}` : ''}</div>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <div class="title-box">Salary Payment Slip</div>
            <div style="font-size: 13px; font-weight: 700; color: #0F172A; margin-top: 6px;">Month: ${monthStr}</div>
            <div style="margin-top: 4px;"><span class="badge-paid">STATUS: PAID</span></div>
          </td>
        </tr>
      </table>

      <!-- Meta Grid -->
      <div class="grid-2">
        <div class="panel">
          <div class="panel-title">Staff Information</div>
          <div class="detail-row"><span class="detail-label">Staff Type:</span><span class="detail-value" style="color: #0284C7; font-weight: 700;">${salary.ustadh.staffType === 'SCHOOL_TEACHER' ? 'School Teacher' : 'Ustadh'}</span></div>
          <div class="detail-row"><span class="detail-label">Full Name:</span><span class="detail-value">${ustadhName}</span></div>
          <div class="detail-row"><span class="detail-label">Staff Code:</span><span class="detail-value" style="font-family: monospace;">${ustadhCode}</span></div>
          <div class="detail-row"><span class="detail-label">Phone:</span><span class="detail-value">${escapeHtml(salary.ustadh.phoneNumber || 'N/A')}</span></div>
        </div>

        <div class="panel">
          <div class="panel-title">Attendance Summary (Informational)</div>
          <div class="detail-row"><span class="detail-label">Recorded Sessions:</span><span class="detail-value">${att.recordedSessions}</span></div>
          <div class="detail-row"><span class="detail-label">Present Sessions:</span><span class="detail-value" style="color: #059669;">${att.presentSessions}</span></div>
          <div class="detail-row"><span class="detail-label">Absent Sessions:</span><span class="detail-value" style="color: #DC2626;">${att.absentSessions}</span></div>
          <div class="detail-row"><span class="detail-label">Attendance Rate:</span><span class="detail-value">${att.attendancePercentage.toFixed(1)}%</span></div>
        </div>
      </div>

      <!-- Financial Table -->
      <table class="financial-table">
        <thead>
          <tr>
            <th>Description</th>
            <th style="width: 250px;">Notes / Reason</th>
            <th style="text-align: right; width: 140px;">Amount (LKR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Monthly Base Salary Snapshot</strong></td>
            <td style="color: #64748B;">Fixed contractual base salary</td>
            <td style="text-align: right; font-weight: 600;">${baseSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
          </tr>
          ${adjustmentDiff !== 0 ? `
          <tr>
            <td><strong>Salary Adjustment</strong></td>
            <td style="color: #64748B;">${adjustmentReason}</td>
            <td style="text-align: right; font-weight: 600; color: ${adjustmentDiff < 0 ? '#DC2626' : '#059669'};">
              ${adjustmentDiff > 0 ? '+' : ''}${adjustmentDiff.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </td>
          </tr>
          ` : ''}
          <tr class="total-row">
            <td colspan="2">Net Payable Salary Paid</td>
            <td style="text-align: right;">LKR ${payableAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      <!-- Payment Audit Panel -->
      <div class="panel" style="margin-bottom: 20px;">
        <div class="panel-title">Payment Settlement Details</div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
          <div><span class="detail-label" style="font-size: 10px;">Payment Date:</span><div class="detail-value">${paymentDate}</div></div>
          <div><span class="detail-label" style="font-size: 10px;">Payment Method:</span><div class="detail-value">${paymentMethod}</div></div>
          <div><span class="detail-label" style="font-size: 10px;">Reference No:</span><div class="detail-value">${paymentReference}</div></div>
          <div><span class="detail-label" style="font-size: 10px;">Authorized By:</span><div class="detail-value">${paidByAdmin}</div></div>
        </div>
      </div>

      <!-- Signatures -->
      <div class="footer-sign">
        <div class="sign-box">Authorized Signatory<br /><strong>${madrasaName}</strong></div>
        <div class="sign-box">Received By<br /><strong>${ustadhName}</strong></div>
      </div>
    </div>
  </body>
</html>`;

  return await renderRawHtmlToPdf({ html: fullHtml, landscape: false });
}

/**
 * Formats database UstadhSalary record for API responses.
 *
 * @param {object} s
 * @returns {object}
 */
export function formatSalaryResponse(s) {
  return {
    id: s.id,
    madrasaId: s.madrasaId,
    ustadhId: s.ustadhId,
    salaryMonth: formatSalaryMonth(s.salaryMonth),
    baseSalarySnapshot: parseFloat(s.baseSalarySnapshot.toString()),
    payableAmount: parseFloat(s.payableAmount.toString()),
    adjustmentReason: s.adjustmentReason,
    status: s.status,
    paymentMethod: s.paymentMethod,
    paymentMethodLabel: formatPaymentMethodLabel(s.paymentMethod),
    paymentDate: s.paymentDate ? formatDateOnly(s.paymentDate) : null,
    paymentReference: s.paymentReference,
    paymentNote: s.paymentNote,
    paidById: s.paidById,
    paidBy: s.paidBy,
    paidAt: s.paidAt,
    ustadh: s.ustadh,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

/**
 * Manually sends or resends salary payment confirmation email for a PAID salary.
 * Strictly uses tenant-owned staff email and historical salary/payment snapshot data.
 * Zero mutations to salary status, payable amounts, or payment records.
 *
 * @param {string} madrasaId
 * @param {string} salaryId
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function sendSalaryPaymentEmail(madrasaId, salaryId, userId, options = {}) {
  const { subject, message } = options;

  // 1. Fetch salary scoped to tenant
  const salary = await prisma.ustadhSalary.findFirst({
    where: { id: salaryId, madrasaId },
    include: {
      ustadh: true,
      paidBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!salary) {
    throw new NotFoundError('Salary record not found.');
  }

  // 2. Must be PAID
  if (salary.status !== 'PAID') {
    throw new BadRequestError('Salary email can only be sent for paid salaries.');
  }

  // 3. Verify staff email exists and is valid
  const rawEmail = salary.ustadh?.email;
  if (!rawEmail || typeof rawEmail !== 'string' || !rawEmail.trim()) {
    throw new BadRequestError('No email address is available for this staff member.');
  }

  const staffEmail = rawEmail.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(staffEmail)) {
    throw new BadRequestError('Invalid email address in staff profile.');
  }

  // 4. Fetch dynamic madrasa details
  const madrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
    select: { name: true },
  });

  const formattedMonth = formatSalaryMonth(salary.salaryMonth);
  const formattedDate = formatDateOnly(salary.paymentDate);
  const formattedAmount = `LKR ${parseFloat(salary.payableAmount.toString()).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const paymentMethodLabel = formatPaymentMethodLabel(salary.paymentMethod);

  // 5. Optional PDF attachment
  let attachments = undefined;
  try {
    const pdfBuffer = await generateSalarySlipPdf(madrasaId, salaryId);
    const sanitizedStaffName = (salary.ustadh.fullName || 'Staff').replace(/[^a-zA-Z0-9_-]/g, '_');
    attachments = [
      {
        filename: `${sanitizedStaffName}_${formattedMonth}_Salary-Slip.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ];
  } catch (pdfErr) {
    console.warn('[UstadhSalary] Could not generate slip PDF for email attachment:', pdfErr.message);
  }

  // 6. Send email using existing email.service.js
  let emailResult;
  try {
    emailResult = await sendUstadhSalaryPaidEmail({
      madrasaId,
      to: staffEmail,
      ustadhName: salary.ustadh.fullName,
      madrasaName: madrasa?.name || 'Madrasa',
      salaryMonth: formattedMonth,
      amount: formattedAmount,
      paymentDate: formattedDate,
      paymentMethod: paymentMethodLabel,
      attachments,
      subject,
      message,
    });
  } catch (err) {
    logTenantActivity({
      madrasaId,
      userId,
      action: 'SALARY_EMAIL_FAILED',
      entityType: 'UstadhSalary',
      entityId: salary.id,
      metadata: { error: err.message, to: staffEmail, salaryId: salary.id },
    }).catch(() => {});

    return {
      success: false,
      message: 'Salary payment remains completed, but the email could not be sent.',
      error: err.message,
      recipient: staffEmail,
    };
  }

  if (emailResult && !emailResult.success) {
    logTenantActivity({
      madrasaId,
      userId,
      action: 'SALARY_EMAIL_FAILED',
      entityType: 'UstadhSalary',
      entityId: salary.id,
      metadata: { error: emailResult.error, to: staffEmail, salaryId: salary.id },
    }).catch(() => {});

    return {
      success: false,
      message: 'Salary payment remains completed, but the email could not be sent.',
      error: emailResult.error,
      recipient: staffEmail,
      delivery: emailResult,
    };
  }

  // 7. Activity Log
  logTenantActivity({
    madrasaId,
    userId,
    action: 'SALARY_EMAIL_SENT',
    entityType: 'UstadhSalary',
    entityId: salary.id,
    metadata: {
      to: staffEmail,
      salaryMonth: formattedMonth,
      staffId: salary.ustadhId,
      salaryId: salary.id,
    },
  }).catch(() => {});

  return {
    success: true,
    message: 'Salary email sent successfully.',
    recipient: staffEmail,
    delivery: emailResult,
  };
}
