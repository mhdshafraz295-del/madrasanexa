import prisma from '../lib/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logTenantActivity } from './tenant.service.js';
import { maskPhoneNumber } from './sms.service.js';

/**
 * Masks an email address for safe audit display (e.g. g***@example.com).
 * @param {string} email
 * @returns {string}
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return 'N/A';
  const clean = email.trim();
  const parts = clean.split('@');
  if (parts.length !== 2) return '***';
  const user = parts[0];
  const domain = parts[1];
  const maskedUser = user.length <= 2 ? `${user[0] || '*'}***` : `${user.slice(0, 2)}***`;
  return `${maskedUser}@${domain}`;
}

/**
 * Masks a recipient address based on channel.
 * @param {string} channel
 * @param {string|null} address
 * @returns {string}
 */
export function maskRecipientAddress(channel, address) {
  if (!address) return 'No Address';
  return channel === 'SMS' ? maskPhoneNumber(address) : maskEmail(address);
}

/**
 * Strips secrets, headers, and stack traces from job objects.
 * @param {object} job
 * @returns {object}
 */
export function sanitizeNotificationJob(job) {
  if (!job) return null;

  // Safe sanitized error message (no stack trace or credentials)
  let cleanError = null;
  if (job.lastError) {
    cleanError = String(job.lastError).split('\n')[0].replace(/password=[^&;]+/gi, 'password=***').trim();
  }

  return {
    id: job.id,
    madrasaId: job.madrasaId,
    channel: job.channel,
    eventType: job.eventType,
    recipientType: job.recipientType,
    recipientEntityId: job.recipientEntityId,
    recipientAddress: maskRecipientAddress(job.channel, job.recipientAddress),
    recipientName: job.recipientName,
    subject: job.subject,
    message: job.message,
    payloadJson: job.payloadJson,
    relatedEntityType: job.relatedEntityType,
    relatedEntityId: job.relatedEntityId,
    dedupeKey: job.dedupeKey,
    status: job.status,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    nextAttemptAt: job.nextAttemptAt,
    processingStartedAt: job.processingStartedAt,
    sentAt: job.sentAt,
    failedAt: job.failedAt,
    lastError: cleanError,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function formatSafeAmount(value) {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeEmailHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats a fee payment SMS text message.
 */
export function buildFeePaymentSmsMessage({ madrasaName, studentName, amount, receiptNo, eventType, periodLabel, periodSummary, remainingBalance }) {
  const formattedAmount = formatSafeAmount(amount);
  const formattedBalance = formatSafeAmount(remainingBalance);

  if (eventType === 'FEE_FULLY_PAID') {
    return `${madrasaName}: Fee payment of LKR ${formattedAmount} received for ${studentName}. Receipt #${receiptNo}. ${periodLabel}: ${periodSummary}. Outstanding Balance: LKR 0.00. Thank you!`;
  }
  return `${madrasaName}: Partial payment of LKR ${formattedAmount} received for ${studentName}. Receipt #${receiptNo}. ${periodLabel}: ${periodSummary}. Remaining Balance: LKR ${formattedBalance}.`;
}

/**
 * Formats a fee payment email HTML message.
 */
export function buildFeePaymentEmailHtml({ madrasaName, studentName, admissionNo, amount, receiptNo, eventType, periodLabel, appliedInvoices, remainingBalance }) {
  const formattedAmount = formatSafeAmount(amount);
  const formattedBalance = formatSafeAmount(remainingBalance);
  const isFull = eventType === 'FEE_FULLY_PAID';
  const safeMadrasa = escapeEmailHtml(madrasaName);
  const safeStudent = escapeEmailHtml(studentName);
  const safeAdmission = escapeEmailHtml(admissionNo);
  const safeReceipt = escapeEmailHtml(receiptNo);
  const safePeriodLabel = escapeEmailHtml(periodLabel);

  const invoiceRows = (appliedInvoices || [])
    .map((inv) => {
      const paidVal = formatSafeAmount(inv.allocatedAmount ?? inv.totalAmount);
      const remVal = formatSafeAmount(inv.balanceAmount);
      const monthText = escapeEmailHtml(inv.monthLabel || `${inv.billingYear}-${inv.billingMonth}`);
      const invNoText = escapeEmailHtml(inv.invoiceNo || '');
      return `
      <tr class="fee-row">
        <td data-label="Invoice No" style="padding: 8px 6px; border-bottom: 1px solid #E2E8F0; font-family: monospace; font-size: 11px; word-break: break-word; overflow-wrap: anywhere;">${invNoText}</td>
        <td data-label="Period" style="padding: 8px 6px; border-bottom: 1px solid #E2E8F0; font-size: 12px; word-break: break-word;">${monthText}</td>
        <td data-label="Paid" style="padding: 8px 6px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600; font-size: 12px; white-space: nowrap;">LKR ${paidVal}</td>
        <td data-label="Remaining" style="padding: 8px 6px; border-bottom: 1px solid #E2E8F0; text-align: right; font-size: 12px; white-space: nowrap;">LKR ${remVal}</td>
      </tr>
    `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt - ${safeReceipt}</title>
  <style>
    @media only screen and (max-width: 520px) {
      .email-outer { padding: 10px 6px !important; }
      .email-header { padding: 18px 14px !important; }
      .email-body { padding: 16px 14px !important; }
      .fee-table thead { display: none !important; }
      .fee-table, .fee-table tbody, .fee-table tr.fee-row, .fee-table td { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .fee-table tr.fee-row { background: #F8FAFC !important; border: 1px solid #E2E8F0 !important; border-radius: 8px !important; padding: 8px 10px !important; margin-bottom: 8px !important; }
      .fee-table td { border-bottom: none !important; padding: 3px 0 !important; text-align: right !important; white-space: normal !important; }
      .fee-table td::before { content: attr(data-label); float: left; font-weight: 600; color: #64748B; text-align: left; }
    }
  </style>
</head>
<body style="font-family: 'Noto Sans Tamil', 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #0F172A; background-color: #F8FAFC; margin: 0; padding: 0; -webkit-text-size-adjust: 100%;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="email-outer" style="background-color: #F8FAFC; padding: 20px 12px;">
    <tr>
      <td align="center">
        <div style="max-width: 600px; width: 100%; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: left;">
          <div class="email-header" style="background-color: #0F172A; color: #FFFFFF; padding: 22px 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 19px; font-weight: 700; line-height: 1.3; word-break: break-word;">${safeMadrasa}</h2>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #94A3B8;">Official Fee Payment Confirmation</p>
          </div>
          <div class="email-body" style="padding: 22px 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="display: inline-block; padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 9999px; background-color: ${isFull ? '#DCFCE7; color: #166534;' : '#FEF3C7; color: #92400E;'}">
                ${isFull ? 'PAYMENT COMPLETED — FULLY SETTLED' : 'PARTIAL PAYMENT RECEIVED'}
              </span>
              <h1 style="margin: 12px 0 4px 0; font-size: 26px; font-weight: 800; color: #0F172A;">LKR ${formattedAmount}</h1>
              <p style="margin: 0; color: #64748B; font-size: 13px; word-break: break-word;">Official Receipt No: <strong style="color: #0F172A;">${safeReceipt}</strong></p>
            </div>

            <div style="background-color: #F8FAFC; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 13px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 4px 0; color: #64748B; vertical-align: top;">Student Name:</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #0F172A; word-break: break-word;">${safeStudent}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748B; vertical-align: top;">Admission Number:</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #0F172A; font-family: monospace; word-break: break-all;">${safeAdmission}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748B; vertical-align: top;">Remaining Outstanding Balance:</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: 700; color: ${isFull ? '#059669' : '#DC2626'}; white-space: nowrap;">LKR ${formattedBalance}</td>
                </tr>
              </table>
            </div>

            <h3 style="font-size: 13px; font-weight: 700; color: #0F172A; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.05em;">
              ${safePeriodLabel}
            </h3>
            <table class="fee-table" style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; table-layout: fixed;">
              <thead>
                <tr style="background-color: #F1F5F9; text-align: left; color: #475569;">
                  <th style="padding: 8px 6px; width: 32%;">Invoice No</th>
                  <th style="padding: 8px 6px; width: 22%;">Period</th>
                  <th style="padding: 8px 6px; width: 23%; text-align: right;">Paid</th>
                  <th style="padding: 8px 6px; width: 23%; text-align: right;">Remaining</th>
                </tr>
              </thead>
              <tbody>
                ${invoiceRows}
              </tbody>
            </table>

            <div style="border-top: 1px solid #E2E8F0; padding-top: 14px; font-size: 11px; color: #94A3B8; text-align: center; line-height: 1.5;">
              This is an automated notification from ${safeMadrasa}. For fee inquiries, please contact the madrasa administrative office.
            </div>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Builds a month-end fee reminder text message.
 */
export function buildFeeReminderMessage({ madrasaName, studentName, remainingBalance, monthYear }) {
  const formattedBalance = formatSafeAmount(remainingBalance);
  return `${madrasaName}: Friendly reminder that the monthly fee balance for ${studentName} (${monthYear}) is LKR ${formattedBalance}. Please settle at your earliest convenience.`;
}

/**
 * Retrieves paginated notification jobs for the tenant.
 */
export async function listNotificationJobs(madrasaId, query) {
  const { page = 1, pageSize = 20, channel, status, eventType, search, startDate, endDate } = query;
  const skip = (page - 1) * pageSize;

  const where = { madrasaId };

  if (channel && channel !== 'ALL') {
    where.channel = channel;
  }
  if (status && status !== 'ALL') {
    where.status = status;
  }
  if (eventType && eventType !== 'ALL') {
    where.eventType = eventType;
  }
  if (search) {
    where.OR = [
      { recipientName: { contains: search } },
      { recipientAddress: { contains: search } },
      { dedupeKey: { contains: search } },
      { message: { contains: search } },
    ];
  }
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [total, jobs] = await Promise.all([
    prisma.notificationJob.count({ where }),
    prisma.notificationJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    items: jobs.map(sanitizeNotificationJob),
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Retrieves a single notification job by ID (sanitized).
 */
export async function getNotificationJobById(madrasaId, jobId) {
  const job = await prisma.notificationJob.findFirst({
    where: { id: jobId, madrasaId },
  });

  if (!job) {
    throw new NotFoundError('Notification job not found.');
  }

  return sanitizeNotificationJob(job);
}

/**
 * Manually retries an eligible failed or delivery-unknown job.
 */
export async function retryNotificationJob(madrasaId, jobId, userId) {
  const job = await prisma.notificationJob.findFirst({
    where: { id: jobId, madrasaId },
  });

  if (!job) {
    throw new NotFoundError('Notification job not found.');
  }

  if (job.status !== 'FAILED' && job.status !== 'DELIVERY_UNKNOWN') {
    throw new BadRequestError(`Cannot retry job with status ${job.status}. Only FAILED or DELIVERY_UNKNOWN jobs can be retried.`);
  }

  const updated = await prisma.notificationJob.update({
    where: { id: jobId },
    data: {
      status: 'PENDING',
      attemptCount: 0,
      nextAttemptAt: new Date(),
      processingStartedAt: null,
      failedAt: null,
      lastError: null,
    },
  });

  await logTenantActivity({
    madrasaId,
    userId,
    action: 'NOTIFICATION_RETRY_REQUESTED',
    entityType: 'NotificationJob',
    entityId: job.id,
    metadata: {
      jobId: job.id,
      channel: job.channel,
      eventType: job.eventType,
      recipient: maskRecipientAddress(job.channel, job.recipientAddress),
      previousStatus: job.status,
    },
  });

  return sanitizeNotificationJob(updated);
}

/**
 * Retrieves notification settings for a madrasa.
 */
export async function getNotificationSettings(madrasaId) {
  let settings = await prisma.madrasaSetting.findUnique({
    where: { madrasaId },
  });

  if (!settings) {
    settings = await prisma.madrasaSetting.create({
      data: { madrasaId },
    });
  }

  return {
    autoFeePaymentSmsEnabled: settings.autoFeePaymentSmsEnabled,
    autoPartialFeeSmsEnabled: settings.autoPartialFeeSmsEnabled,
    autoFeeReminderSmsEnabled: settings.autoFeeReminderSmsEnabled,
    autoFeePaymentEmailEnabled: settings.autoFeePaymentEmailEnabled,
    autoPartialFeeEmailEnabled: settings.autoPartialFeeEmailEnabled,
    autoFeeReminderEmailEnabled: settings.autoFeeReminderEmailEnabled,
    autoSalaryPaidEmailEnabled: settings.autoSalaryPaidEmailEnabled,
    feeReminderSendTime: settings.feeReminderSendTime || '09:00',
    timezone: settings.timezone || 'Asia/Colombo',
  };
}

/**
 * Updates notification settings for a madrasa.
 */
export async function updateNotificationSettings(madrasaId, data, userId) {
  const updated = await prisma.madrasaSetting.upsert({
    where: { madrasaId },
    create: {
      madrasaId,
      ...data,
    },
    update: {
      ...data,
    },
  });

  await logTenantActivity({
    madrasaId,
    userId,
    action: 'NOTIFICATION_SETTINGS_UPDATED',
    entityType: 'MadrasaSetting',
    entityId: updated.id,
    metadata: { changes: data },
  });

  return {
    autoFeePaymentSmsEnabled: updated.autoFeePaymentSmsEnabled,
    autoPartialFeeSmsEnabled: updated.autoPartialFeeSmsEnabled,
    autoFeeReminderSmsEnabled: updated.autoFeeReminderSmsEnabled,
    autoFeePaymentEmailEnabled: updated.autoFeePaymentEmailEnabled,
    autoPartialFeeEmailEnabled: updated.autoPartialFeeEmailEnabled,
    autoFeeReminderEmailEnabled: updated.autoFeeReminderEmailEnabled,
    autoSalaryPaidEmailEnabled: updated.autoSalaryPaidEmailEnabled,
    feeReminderSendTime: updated.feeReminderSendTime || '09:00',
    timezone: updated.timezone || 'Asia/Colombo',
  };
}

/**
 * Lists timetable publications for the tenant.
 */
export async function listTimetablePublications(madrasaId) {
  const publications = await prisma.timetablePublication.findMany({
    where: { madrasaId },
    include: {
      publishedBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  });

  return publications.map((p) => ({
    id: p.id,
    idempotencyKey: p.idempotencyKey,
    effectiveDate: p.effectiveDate ? p.effectiveDate.toISOString().split('T')[0] : null,
    sendEmail: p.sendEmail,
    recipientScope: p.recipientScope,
    staffCount: p.staffCount,
    queuedCount: p.queuedCount,
    skippedCount: p.skippedCount,
    scheduleFingerprint: p.scheduleFingerprint,
    publishedById: p.publishedById,
    publishedBy: p.publishedBy,
    publishedAt: p.publishedAt,
  }));
}
