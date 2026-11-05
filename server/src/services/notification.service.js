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

/**
 * Formats a fee payment SMS text message.
 */
export function buildFeePaymentSmsMessage({ madrasaName, studentName, amount, receiptNo, eventType, periodLabel, periodSummary, remainingBalance }) {
  const formattedAmount = Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedBalance = Number(remainingBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (eventType === 'FEE_FULLY_PAID') {
    return `${madrasaName}: Fee payment of LKR ${formattedAmount} received for ${studentName}. Receipt #${receiptNo}. ${periodLabel}: ${periodSummary}. Outstanding Balance: LKR 0.00. Thank you!`;
  }
  return `${madrasaName}: Partial payment of LKR ${formattedAmount} received for ${studentName}. Receipt #${receiptNo}. ${periodLabel}: ${periodSummary}. Remaining Balance: LKR ${formattedBalance}.`;
}

/**
 * Formats a fee payment email HTML message.
 */
export function buildFeePaymentEmailHtml({ madrasaName, studentName, admissionNo, amount, receiptNo, eventType, periodLabel, appliedInvoices, remainingBalance }) {
  const formattedAmount = Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedBalance = Number(remainingBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isFull = eventType === 'FEE_FULLY_PAID';

  const invoiceRows = (appliedInvoices || [])
    .map(
      (inv) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-family: monospace;">${inv.invoiceNo}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0;">${inv.monthLabel || `${inv.billingYear}-${inv.billingMonth}`}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600;">LKR ${Number(inv.allocatedAmount || inv.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; text-align: right;">LKR ${Number(inv.balanceAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Receipt - ${receiptNo}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0F172A; background-color: #F8FAFC; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background-color: #0F172A; color: #FFFFFF; padding: 24px; text-align: center;">
      <h2 style="margin: 0; font-size: 20px; font-weight: 700;">${madrasaName}</h2>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #94A3B8;">Official Fee Payment Confirmation</p>
    </div>
    <div style="padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 12px; font-size: 12px; font-weight: 700; border-radius: 9999px; background-color: ${isFull ? '#DCFCE7; color: #166534;' : '#FEF3C7; color: #92400E;'}">
          ${isFull ? 'PAYMENT COMPLETED — FULLY SETTLED' : 'PARTIAL PAYMENT RECEIVED'}
        </span>
        <h1 style="margin: 12px 0 4px 0; font-size: 28px; font-weight: 800; color: #0F172A;">LKR ${formattedAmount}</h1>
        <p style="margin: 0; color: #64748B; font-size: 13px;">Official Receipt No: <strong style="color: #0F172A;">${receiptNo}</strong></p>
      </div>

      <div style="background-color: #F8FAFC; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 13px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #64748B;">Student Name:</span>
          <strong style="color: #0F172A;">${studentName}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #64748B;">Admission Number:</span>
          <strong style="color: #0F172A;">${admissionNo}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #64748B;">Remaining Outstanding Balance:</span>
          <strong style="color: ${isFull ? '#059669;' : '#DC2626;'}">LKR ${formattedBalance}</strong>
        </div>
      </div>

      <h3 style="font-size: 14px; font-weight: 700; color: #0F172A; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.05em;">
        ${periodLabel}
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
        <thead>
          <tr style="background-color: #F1F5F9; text-align: left; color: #475569;">
            <th style="padding: 8px 12px;">Invoice No</th>
            <th style="padding: 8px 12px;">Period</th>
            <th style="padding: 8px 12px; text-align: right;">Paid</th>
            <th style="padding: 8px 12px; text-align: right;">Remaining</th>
          </tr>
        </thead>
        <tbody>
          ${invoiceRows}
        </tbody>
      </table>

      <div style="border-top: 1px solid #E2E8F0; padding-top: 16px; font-size: 11px; color: #94A3B8; text-align: center;">
        This is an automated notification from ${madrasaName}. For fee inquiries, please contact the madrasa administrative office.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Builds a month-end fee reminder text message.
 */
export function buildFeeReminderMessage({ madrasaName, studentName, remainingBalance, monthYear }) {
  const formattedBalance = Number(remainingBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
