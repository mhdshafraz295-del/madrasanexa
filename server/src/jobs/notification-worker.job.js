import { prisma } from '../lib/prisma.js';
import { resolveSubscriptionAccess } from '../services/subscription.service.js';
import { isSmsConfigured, sendSms } from '../services/sms.service.js';
import {
  isEmailConfigured,
  sendStudentFeePaymentEmail,
  sendStaffTimetableEmail,
  sendUstadhSalaryPaidEmail,
  sendAdmissionNotificationEmail,
  buildAdmissionEmailTemplate,
} from '../services/email.service.js';
import { resolveObjectAccessUrl } from '../services/r2.service.js';
import { buildFeeReminderMessage, buildFeePaymentEmailHtml } from '../services/notification.service.js';
import { generateSalarySlipPdf } from '../services/ustadh-salary.service.js';
import { exportStaffTimetableSnapshotPdf } from '../services/timetable.service.js';

let pollTimer = null;
let reminderCronTimer = null;
let isPollingActive = false;

/**
 * Recovers stale jobs that have been stuck in 'PROCESSING' state for longer than the timeout.
 *
 * @param {number} [staleThresholdMs=900000] - Default 15 minutes
 * @returns {Promise<number>} Number of recovered jobs
 */
export async function recoverStaleJobs(staleThresholdMs = 15 * 60 * 1000) {
  const threshold = new Date(Date.now() - staleThresholdMs);
  const result = await prisma.notificationJob.updateMany({
    where: {
      status: 'PROCESSING',
      processingStartedAt: { lte: threshold },
    },
    data: {
      status: 'DELIVERY_UNKNOWN',
      lastError: 'Job processing timed out after 15 minutes',
      failedAt: new Date(),
      nextAttemptAt: null,
    },
  });

  return result.count;
}

/**
 * Evaluates tenant time and triggers month-end fee reminder jobs for final 3 calendar days.
 * Safe for late server boot/restart recovery and idempotent per (student, invoice, date, channel).
 *
 * @param {Date} [referenceDate=new Date()]
 * @returns {Promise<{ createdCount: number, skippedCount: number }>}
 */
export async function processMonthEndReminders(referenceDate = new Date()) {
  let createdCount = 0;
  let skippedCount = 0;

  const madrasas = await prisma.madrasa.findMany({
    select: { id: true, name: true, settings: true },
  });

  for (const madrasa of madrasas) {
    const settings = madrasa.settings;
    if (!settings) continue;

    // Must have at least one reminder channel enabled
    if (!settings.autoFeeReminderSmsEnabled && !settings.autoFeeReminderEmailEnabled) {
      continue;
    }

    // Check subscription access
    const access = await resolveSubscriptionAccess(madrasa.id, referenceDate);
    if (!access.allowed) {
      continue;
    }

    // Determine current tenant date & time parts in configured timezone
    const tz = settings.timezone || 'Asia/Colombo';
    let parts;
    try {
      parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(referenceDate);
    } catch {
      parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Colombo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(referenceDate);
    }

    const partMap = {};
    for (const p of parts) partMap[p.type] = p.value;
    const year = parseInt(partMap.year, 10);
    const month = parseInt(partMap.month, 10);
    const day = parseInt(partMap.day, 10);
    const hour = parseInt(partMap.hour, 10);
    const minute = parseInt(partMap.minute, 10);

    const currentTimeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const configuredSendTime = settings.feeReminderSendTime || '09:00';

    // Late server recovery: process if currentTime >= configuredSendTime
    if (currentTimeStr < configuredSendTime) {
      continue;
    }

    // Check if within final 3 calendar days of the month
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const isFinal3Days = day >= (lastDayOfMonth - 2) && day <= lastDayOfMonth;
    if (!isFinal3Days) {
      continue;
    }

    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Find unpaid or partially paid student fee invoices
    const eligibleInvoices = await prisma.invoice.findMany({
      where: {
        madrasaId: madrasa.id,
        status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        balanceAmount: { gt: 0 },
        student: { status: 'ACTIVE' },
      },
      include: {
        student: true,
      },
    });

    for (const invoice of eligibleInvoices) {
      const student = invoice.student;
      if (!student) continue;

      const monthYear = `${invoice.billingYear}-${String(invoice.billingMonth).padStart(2, '0')}`;
      const balanceNum = Number(invoice.balanceAmount);

      // 1. SMS Reminder
      if (settings.autoFeeReminderSmsEnabled) {
        const dedupeKey = `FEE_REMINDER:${student.id}:${invoice.id}:${dateKey}:SMS`;
        const phone = student.guardianPhone ? student.guardianPhone.trim() : null;
        const smsMessage = buildFeeReminderMessage({
          madrasaName: madrasa.name,
          studentName: student.fullName,
          remainingBalance: balanceNum,
          monthYear,
        });

        try {
          const existingSms = await prisma.notificationJob.findUnique({
            where: { madrasaId_dedupeKey: { madrasaId: madrasa.id, dedupeKey } },
            select: { id: true },
          });

          if (!existingSms) {
            if (phone) {
              await prisma.notificationJob.create({
                data: {
                  madrasaId: madrasa.id,
                  channel: 'SMS',
                  eventType: 'FEE_MONTH_END_REMINDER',
                  recipientType: 'GUARDIAN',
                  recipientEntityId: student.id,
                  recipientAddress: phone,
                  recipientName: student.guardianName || student.fullName,
                  subject: `Fee Reminder: ${monthYear}`,
                  message: smsMessage,
                  payloadJson: {
                    studentId: student.id,
                    invoiceId: invoice.id,
                    balanceAmount: balanceNum,
                    billingYear: invoice.billingYear,
                    billingMonth: invoice.billingMonth,
                  },
                  relatedEntityType: 'FeeInvoice',
                  relatedEntityId: invoice.id,
                  dedupeKey,
                  status: 'PENDING',
                },
              });
              createdCount++;
            } else {
              await prisma.notificationJob.create({
                data: {
                  madrasaId: madrasa.id,
                  channel: 'SMS',
                  eventType: 'FEE_MONTH_END_REMINDER',
                  recipientType: 'GUARDIAN',
                  recipientEntityId: student.id,
                  recipientAddress: null,
                  recipientName: student.guardianName || student.fullName,
                  subject: `Fee Reminder: ${monthYear}`,
                  message: smsMessage,
                  payloadJson: {
                    studentId: student.id,
                    invoiceId: invoice.id,
                    balanceAmount: balanceNum,
                    billingYear: invoice.billingYear,
                    billingMonth: invoice.billingMonth,
                  },
                  relatedEntityType: 'FeeInvoice',
                  relatedEntityId: invoice.id,
                  dedupeKey,
                  status: 'SKIPPED_NO_RECIPIENT',
                },
              });
              skippedCount++;
            }
          }
        } catch (e) {
          // Ignore dedupe race collisions safely
        }
      }

      // 2. Email Reminder
      if (settings.autoFeeReminderEmailEnabled) {
        const dedupeKey = `FEE_REMINDER:${student.id}:${invoice.id}:${dateKey}:EMAIL`;
        const email = student.guardianEmail ? student.guardianEmail.trim().toLowerCase() : null;
        const emailSubject = `Monthly Fee Reminder — ${monthYear} — ${madrasa.name}`;
        const emailHtml = buildFeePaymentEmailHtml({
          madrasaName: madrasa.name,
          studentName: student.fullName,
          admissionNo: student.admissionNo || 'N/A',
          amount: 0,
          receiptNo: 'REMINDER',
          eventType: 'FEE_PARTIAL_PAYMENT',
          periodLabel: 'Outstanding Invoices',
          appliedInvoices: [
            {
              invoiceNo: invoice.invoiceNo,
              monthLabel: monthYear,
              allocatedAmount: 0,
              balanceAmount: balanceNum,
            },
          ],
          remainingBalance: balanceNum,
        });

        try {
          const existingEmail = await prisma.notificationJob.findUnique({
            where: { madrasaId_dedupeKey: { madrasaId: madrasa.id, dedupeKey } },
            select: { id: true },
          });

          if (!existingEmail) {
            if (email) {
              await prisma.notificationJob.create({
                data: {
                  madrasaId: madrasa.id,
                  channel: 'EMAIL',
                  eventType: 'FEE_MONTH_END_REMINDER',
                  recipientType: 'GUARDIAN',
                  recipientEntityId: student.id,
                  recipientAddress: email,
                  recipientName: student.guardianName || student.fullName,
                  subject: emailSubject,
                  message: emailHtml,
                  payloadJson: {
                    studentId: student.id,
                    invoiceId: invoice.id,
                    balanceAmount: balanceNum,
                    billingYear: invoice.billingYear,
                    billingMonth: invoice.billingMonth,
                  },
                  relatedEntityType: 'FeeInvoice',
                  relatedEntityId: invoice.id,
                  dedupeKey,
                  status: 'PENDING',
                },
              });
              createdCount++;
            } else {
              await prisma.notificationJob.create({
                data: {
                  madrasaId: madrasa.id,
                  channel: 'EMAIL',
                  eventType: 'FEE_MONTH_END_REMINDER',
                  recipientType: 'GUARDIAN',
                  recipientEntityId: student.id,
                  recipientAddress: null,
                  recipientName: student.guardianName || student.fullName,
                  subject: emailSubject,
                  message: emailSubject,
                  payloadJson: {
                    studentId: student.id,
                    invoiceId: invoice.id,
                    balanceAmount: balanceNum,
                    billingYear: invoice.billingYear,
                    billingMonth: invoice.billingMonth,
                  },
                  relatedEntityType: 'FeeInvoice',
                  relatedEntityId: invoice.id,
                  dedupeKey,
                  status: 'SKIPPED_NO_RECIPIENT',
                },
              });
              skippedCount++;
            }
          }
        } catch (e) {
          // Ignore dedupe race collisions safely
        }
      }
    }
  }

  return { createdCount, skippedCount };
}

/**
 * Evaluates tenant time and triggers fee reminder jobs 3 days prior to invoice.dueDate.
 * Independent of month-end calendar boundary.
 * Safe for late server boot/restart recovery and idempotent per (student, invoice, date, channel).
 *
 * @param {Date} [referenceDate=new Date()]
 * @returns {Promise<{ createdCount: number, skippedCount: number }>}
 */
export async function processDueDateReminders(referenceDate = new Date()) {
  let createdCount = 0;
  let skippedCount = 0;

  const madrasas = await prisma.madrasa.findMany({
    select: { id: true, name: true, settings: true },
  });

  for (const madrasa of madrasas) {
    const settings = madrasa.settings;
    if (!settings) continue;

    // Must have at least one reminder channel enabled
    if (!settings.autoFeeReminderSmsEnabled && !settings.autoFeeReminderEmailEnabled) {
      continue;
    }

    // Check subscription access
    const access = await resolveSubscriptionAccess(madrasa.id, referenceDate);
    if (!access.allowed) {
      continue;
    }

    // Determine current tenant date & time parts in configured timezone
    const tz = settings.timezone || 'Asia/Colombo';
    let parts;
    try {
      parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(referenceDate);
    } catch {
      parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Colombo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(referenceDate);
    }

    const partMap = {};
    for (const p of parts) partMap[p.type] = p.value;
    const year = parseInt(partMap.year, 10);
    const month = parseInt(partMap.month, 10);
    const day = parseInt(partMap.day, 10);
    const hour = parseInt(partMap.hour, 10);
    const minute = parseInt(partMap.minute, 10);

    const currentTimeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const configuredSendTime = settings.feeReminderSendTime || '09:00';

    // Late server recovery: process if currentTime >= configuredSendTime
    if (currentTimeStr < configuredSendTime) {
      continue;
    }

    const tenantDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Find unpaid or partially paid student fee invoices that have a non-null dueDate
    const eligibleInvoices = await prisma.invoice.findMany({
      where: {
        madrasaId: madrasa.id,
        status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        balanceAmount: { gt: 0 },
        dueDate: { not: null },
        student: { status: 'ACTIVE' },
      },
      include: {
        student: true,
      },
    });

    for (const invoice of eligibleInvoices) {
      const student = invoice.student;
      if (!student || !invoice.dueDate) continue;

      // Determine due date in tenant timezone
      let dueParts;
      try {
        dueParts = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(new Date(invoice.dueDate));
      } catch {
        dueParts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Colombo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(new Date(invoice.dueDate));
      }
      const dueMap = {};
      for (const p of dueParts) dueMap[p.type] = p.value;
      const dueYear = parseInt(dueMap.year, 10);
      const dueMonth = parseInt(dueMap.month, 10);
      const dueDay = parseInt(dueMap.day, 10);

      // Target reminder date is strictly 3 calendar days before the dueDate
      const targetReminderDate = new Date(Date.UTC(dueYear, dueMonth - 1, dueDay - 3));
      const targetDateStr = `${targetReminderDate.getUTCFullYear()}-${String(targetReminderDate.getUTCMonth() + 1).padStart(2, '0')}-${String(targetReminderDate.getUTCDate()).padStart(2, '0')}`;

      if (tenantDateStr !== targetDateStr) {
        continue;
      }

      const monthYear = `${invoice.billingYear}-${String(invoice.billingMonth).padStart(2, '0')}`;
      const balanceNum = Number(invoice.balanceAmount);
      const dueDateFormatted = `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;

      // 1. SMS Reminder
      if (settings.autoFeeReminderSmsEnabled) {
        const phone = student.guardianPhone ? student.guardianPhone.trim() : null;
        const dedupeKey = phone
          ? `FEE_DUE_REMINDER:${student.id}:${invoice.id}:${tenantDateStr}:SMS`
          : `FEE_DUE_REMINDER:${student.id}:${invoice.id}:${tenantDateStr}:SMS:NO_RECIPIENT`;

        const smsMessage = buildFeeReminderMessage({
          madrasaName: madrasa.name,
          studentName: student.fullName,
          remainingBalance: balanceNum,
          monthYear,
        });

        try {
          const existingSms = await prisma.notificationJob.findUnique({
            where: { madrasaId_dedupeKey: { madrasaId: madrasa.id, dedupeKey } },
            select: { id: true },
          });

          if (!existingSms) {
            if (phone) {
              await prisma.notificationJob.create({
                data: {
                  madrasaId: madrasa.id,
                  channel: 'SMS',
                  eventType: 'FEE_MONTH_END_REMINDER',
                  recipientType: 'GUARDIAN',
                  recipientEntityId: student.id,
                  recipientAddress: phone,
                  recipientName: student.guardianName || student.fullName,
                  subject: `Fee Due Reminder: ${monthYear}`,
                  message: smsMessage,
                  payloadJson: {
                    studentId: student.id,
                    invoiceId: invoice.id,
                    balanceAmount: balanceNum,
                    billingYear: invoice.billingYear,
                    billingMonth: invoice.billingMonth,
                    dueDate: invoice.dueDate,
                    reminderType: 'DUE_DATE_3_DAYS_PRIOR',
                  },
                  relatedEntityType: 'FeeInvoice',
                  relatedEntityId: invoice.id,
                  dedupeKey,
                  status: 'PENDING',
                },
              });
              createdCount++;
            } else {
              await prisma.notificationJob.create({
                data: {
                  madrasaId: madrasa.id,
                  channel: 'SMS',
                  eventType: 'FEE_MONTH_END_REMINDER',
                  recipientType: 'GUARDIAN',
                  recipientEntityId: student.id,
                  recipientAddress: null,
                  recipientName: student.guardianName || student.fullName,
                  subject: `Fee Due Reminder: ${monthYear}`,
                  message: smsMessage,
                  payloadJson: {
                    studentId: student.id,
                    invoiceId: invoice.id,
                    balanceAmount: balanceNum,
                    billingYear: invoice.billingYear,
                    billingMonth: invoice.billingMonth,
                    dueDate: invoice.dueDate,
                    reminderType: 'DUE_DATE_3_DAYS_PRIOR',
                  },
                  relatedEntityType: 'FeeInvoice',
                  relatedEntityId: invoice.id,
                  dedupeKey,
                  status: 'SKIPPED_NO_RECIPIENT',
                },
              });
              skippedCount++;
            }
          }
        } catch (e) {
          // Ignore dedupe race collisions safely
        }
      }

      // 2. Email Reminder
      if (settings.autoFeeReminderEmailEnabled) {
        const email = student.guardianEmail ? student.guardianEmail.trim().toLowerCase() : null;
        const dedupeKey = email
          ? `FEE_DUE_REMINDER:${student.id}:${invoice.id}:${tenantDateStr}:EMAIL`
          : `FEE_DUE_REMINDER:${student.id}:${invoice.id}:${tenantDateStr}:EMAIL:NO_RECIPIENT`;

        const emailSubject = `Upcoming Fee Due Reminder — ${monthYear} — ${madrasa.name}`;
        const emailHtml = buildFeePaymentEmailHtml({
          madrasaName: madrasa.name,
          studentName: student.fullName,
          admissionNo: student.admissionNo || 'N/A',
          amount: 0,
          receiptNo: 'DUE-REMINDER',
          eventType: 'FEE_PARTIAL_PAYMENT',
          periodLabel: `Due Date: ${dueDateFormatted}`,
          appliedInvoices: [
            {
              invoiceNo: invoice.invoiceNo,
              monthLabel: monthYear,
              allocatedAmount: 0,
              balanceAmount: balanceNum,
            },
          ],
          remainingBalance: balanceNum,
        });

        try {
          const existingEmail = await prisma.notificationJob.findUnique({
            where: { madrasaId_dedupeKey: { madrasaId: madrasa.id, dedupeKey } },
            select: { id: true },
          });

          if (!existingEmail) {
            if (email) {
              await prisma.notificationJob.create({
                data: {
                  madrasaId: madrasa.id,
                  channel: 'EMAIL',
                  eventType: 'FEE_MONTH_END_REMINDER',
                  recipientType: 'GUARDIAN',
                  recipientEntityId: student.id,
                  recipientAddress: email,
                  recipientName: student.guardianName || student.fullName,
                  subject: emailSubject,
                  message: emailHtml,
                  payloadJson: {
                    studentId: student.id,
                    invoiceId: invoice.id,
                    balanceAmount: balanceNum,
                    billingYear: invoice.billingYear,
                    billingMonth: invoice.billingMonth,
                    dueDate: invoice.dueDate,
                    reminderType: 'DUE_DATE_3_DAYS_PRIOR',
                  },
                  relatedEntityType: 'FeeInvoice',
                  relatedEntityId: invoice.id,
                  dedupeKey,
                  status: 'PENDING',
                },
              });
              createdCount++;
            } else {
              await prisma.notificationJob.create({
                data: {
                  madrasaId: madrasa.id,
                  channel: 'EMAIL',
                  eventType: 'FEE_MONTH_END_REMINDER',
                  recipientType: 'GUARDIAN',
                  recipientEntityId: student.id,
                  recipientAddress: null,
                  recipientName: student.guardianName || student.fullName,
                  subject: emailSubject,
                  message: emailSubject,
                  payloadJson: {
                    studentId: student.id,
                    invoiceId: invoice.id,
                    balanceAmount: balanceNum,
                    billingYear: invoice.billingYear,
                    billingMonth: invoice.billingMonth,
                    dueDate: invoice.dueDate,
                    reminderType: 'DUE_DATE_3_DAYS_PRIOR',
                  },
                  relatedEntityType: 'FeeInvoice',
                  relatedEntityId: invoice.id,
                  dedupeKey,
                  status: 'SKIPPED_NO_RECIPIENT',
                },
              });
              skippedCount++;
            }
          }
        } catch (e) {
          // Ignore dedupe race collisions safely
        }
      }
    }
  }

  return { createdCount, skippedCount };
}

/**
 * Builds an HTML email body for student follow-up assignment or scheduled reminder.
 */
export function buildFollowUpEmailHtml({
  madrasaName,
  recipientName,
  studentName,
  admissionNo,
  followUpTitle,
  dueDateStr,
  reminderAtStr,
  priority,
  notes,
  isReminder = true,
}) {
  const badgeBg = isReminder ? '#FEF3C7' : '#DBEAFE';
  const badgeColor = isReminder ? '#92400E' : '#1E40AF';
  const badgeText = isReminder ? 'SCHEDULED FOLLOW-UP REMINDER' : 'NEW FOLLOW-UP ASSIGNED';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${followUpTitle}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0F172A; background-color: #F8FAFC; margin: 0; padding: 24px;">
  <div style="max-width: 580px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden;">
    <div style="background-color: #0F172A; color: #FFFFFF; padding: 20px 24px; text-align: center;">
      <h2 style="margin: 0; font-size: 18px; font-weight: 700;">${madrasaName}</h2>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #94A3B8;">Student Follow-Up &amp; Welfare System</p>
    </div>
    <div style="padding: 24px;">
      <div style="margin-bottom: 16px;">
        <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 9999px; background-color: ${badgeBg}; color: ${badgeColor};">
          ${badgeText}
        </span>
      </div>
      <p style="margin: 0 0 12px 0; font-size: 14px;">Assalamu Alaikum <strong>${recipientName || 'Administrator'}</strong>,</p>
      <p style="margin: 0 0 16px 0; font-size: 13px; color: #334155; line-height: 1.5;">
        ${isReminder ? 'This is a scheduled reminder for the following student follow-up action:' : 'You have been assigned a student follow-up action:'}
      </p>
      <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 16px; font-size: 13px;">
        <div style="margin-bottom: 8px;"><strong>Follow-Up Title:</strong> ${followUpTitle}</div>
        <div style="margin-bottom: 8px;"><strong>Student:</strong> ${studentName} (${admissionNo || 'N/A'})</div>
        <div style="margin-bottom: 8px;"><strong>Due Date:</strong> ${dueDateStr}</div>
        ${reminderAtStr ? `<div style="margin-bottom: 8px;"><strong>Scheduled Reminder:</strong> ${reminderAtStr}</div>` : ''}
        <div style="margin-bottom: 8px;"><strong>Priority:</strong> ${priority}</div>
        ${notes ? `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #E2E8F0;"><strong>Notes:</strong><br/>${notes}</div>` : ''}
      </div>
      <p style="margin: 0; font-size: 12px; color: #64748B;">Please log in to the MadrasaNexa portal to review the student profile and record follow-up completion.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Evaluates due follow-up reminders strictly using each follow-up's scheduled `reminderAt` timestamp.
 * Does NOT use MadrasaSetting.feeReminderSendTime.
 * Supports safe rescheduling via reminderAt-scoped deduplication keys.
 *
 * @param {Date} [referenceDate=new Date()]
 * @returns {Promise<{ createdCount: number, skippedCount: number }>}
 */
export async function processFollowUpReminders(referenceDate = new Date()) {
  let createdCount = 0;
  let skippedCount = 0;

  const dueFollowUps = await prisma.studentFollowUp.findMany({
    where: {
      deletedAt: null,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      reminderAt: {
        not: null,
        lte: referenceDate,
      },
      reminderSentAt: null,
    },
    include: {
      madrasa: {
        include: { settings: true },
      },
      student: true,
      assignedToUstadh: true,
      assignedToUser: true,
      createdByUser: true,
    },
  });

  for (const followUp of dueFollowUps) {
    if (!followUp.madrasa || !followUp.student || !followUp.reminderAt) continue;

    const access = await resolveSubscriptionAccess(followUp.madrasaId, referenceDate);
    if (!access.allowed) {
      continue;
    }

    // Resolve recipient: assignedToUstadh -> assignedToUser -> createdByUser
    let recipientType = 'ADMIN_USER';
    let recipientEntityId = followUp.createdByUserId;
    let recipientName = followUp.createdByUser?.name || 'Madrasa Admin';
    let recipientEmail = followUp.createdByUser?.email ? followUp.createdByUser.email.trim().toLowerCase() : null;

    if (followUp.assignedToUstadh) {
      recipientType = 'STAFF';
      recipientEntityId = followUp.assignedToUstadh.id;
      recipientName = followUp.assignedToUstadh.fullName;
      recipientEmail = followUp.assignedToUstadh.email ? followUp.assignedToUstadh.email.trim().toLowerCase() : null;
    } else if (followUp.assignedToUser) {
      recipientType = 'ADMIN_USER';
      recipientEntityId = followUp.assignedToUser.id;
      recipientName = followUp.assignedToUser.name;
      recipientEmail = followUp.assignedToUser.email ? followUp.assignedToUser.email.trim().toLowerCase() : null;
    }

    const reminderIso = followUp.reminderAt.toISOString();
    const dedupeKey = `FOLLOW_UP_REMINDER:${followUp.id}:${reminderIso}:${recipientEntityId || 'DEFAULT'}:EMAIL`;
    const dueDateStr = followUp.dueDate instanceof Date ? followUp.dueDate.toISOString().split('T')[0] : String(followUp.dueDate);
    const subject = `Follow-Up Reminder: ${followUp.title} — ${followUp.student.fullName}`;
    const htmlMessage = buildFollowUpEmailHtml({
      madrasaName: followUp.madrasa.name,
      recipientName,
      studentName: followUp.student.fullName,
      admissionNo: followUp.student.admissionNo,
      followUpTitle: followUp.title,
      dueDateStr,
      reminderAtStr: reminderIso,
      priority: followUp.priority,
      notes: followUp.notes,
      isReminder: true,
    });

    try {
      const existingJob = await prisma.notificationJob.findUnique({
        where: {
          madrasaId_dedupeKey: {
            madrasaId: followUp.madrasaId,
            dedupeKey,
          },
        },
      });

      if (!existingJob) {
        if (recipientEmail) {
          await prisma.notificationJob.create({
            data: {
              madrasaId: followUp.madrasaId,
              channel: 'EMAIL',
              eventType: 'FOLLOW_UP_REMINDER',
              recipientType,
              recipientEntityId,
              recipientAddress: recipientEmail,
              recipientName,
              subject,
              message: htmlMessage,
              payloadJson: {
                followUpId: followUp.id,
                studentId: followUp.studentId,
                reminderAt: reminderIso,
                dueDate: dueDateStr,
                priority: followUp.priority,
              },
              relatedEntityType: 'StudentFollowUp',
              relatedEntityId: followUp.id,
              dedupeKey,
              status: 'PENDING',
              nextAttemptAt: new Date(),
            },
          });
          createdCount++;
        } else {
          await prisma.notificationJob.create({
            data: {
              madrasaId: followUp.madrasaId,
              channel: 'EMAIL',
              eventType: 'FOLLOW_UP_REMINDER',
              recipientType,
              recipientEntityId,
              recipientAddress: null,
              recipientName,
              subject,
              message: subject,
              payloadJson: {
                followUpId: followUp.id,
                studentId: followUp.studentId,
                reminderAt: reminderIso,
                dueDate: dueDateStr,
                priority: followUp.priority,
              },
              relatedEntityType: 'StudentFollowUp',
              relatedEntityId: followUp.id,
              dedupeKey,
              status: 'SKIPPED_NO_RECIPIENT',
              nextAttemptAt: null,
            },
          });
          skippedCount++;
        }
      } else if (existingJob.status === 'CANCELLED' && recipientEmail) {
        // Reactivate if rescheduled back to a previously cancelled reminder timestamp
        await prisma.notificationJob.update({
          where: { id: existingJob.id },
          data: {
            status: 'PENDING',
            attemptCount: 0,
            nextAttemptAt: new Date(),
            processingStartedAt: null,
            failedAt: null,
            lastError: null,
            recipientAddress: recipientEmail,
            recipientName,
            subject,
            message: htmlMessage,
          },
        });
        createdCount++;
      }
    } catch (e) {
      // Ignore concurrent deduplication race collisions safely
    }
  }

  return { createdCount, skippedCount, enqueuedCount: createdCount };
}

/**
 * Processes a single claimed notification job safely.
 */
async function dispatchClaimedJob(job, referenceDate = new Date()) {
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const currentAttempt = job.attemptCount; // already incremented during atomic claim

  // 1. Subscription Check
  const access = await resolveSubscriptionAccess(job.madrasaId, now);
  if (!access.allowed) {
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        status: 'CANCELLED',
        lastError: 'SUBSCRIPTION_INACTIVE',
        failedAt: now,
        nextAttemptAt: null,
      },
    });
    return { success: false, status: 'CANCELLED', reason: 'SUBSCRIPTION_INACTIVE' };
  }

  // 2. Pre-Delivery Revalidation for Fee Month-End Reminders
  if (job.eventType === 'FEE_MONTH_END_REMINDER' && job.relatedEntityId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: job.relatedEntityId },
      include: { student: true, madrasa: true },
    });

    if (!invoice || invoice.status === 'PAID' || invoice.status === 'VOID' || Number(invoice.balanceAmount) <= 0) {
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: 'CANCELLED',
          lastError: 'FEE_ALREADY_SETTLED',
          failedAt: now,
          nextAttemptAt: null,
        },
      });
      return { success: false, status: 'CANCELLED', reason: 'FEE_ALREADY_SETTLED' };
    }

    // Rebuild message if balance amount changed
    const currentBalance = Number(invoice.balanceAmount);
    if (job.channel === 'SMS') {
      const monthYear = `${invoice.billingYear}-${String(invoice.billingMonth).padStart(2, '0')}`;
      job.message = buildFeeReminderMessage({
        madrasaName: invoice.madrasa?.name || 'Madrasa',
        studentName: invoice.student?.fullName || job.recipientName || 'Student',
        remainingBalance: currentBalance,
        monthYear,
      });
    }
  }

  // 2b. Pre-Delivery Revalidation for Follow-Up Assignments & Reminders
  if ((job.eventType === 'FOLLOW_UP_REMINDER' || job.eventType === 'FOLLOW_UP_ASSIGNED') && job.relatedEntityId) {
    const followUp = await prisma.studentFollowUp.findFirst({
      where: {
        id: job.relatedEntityId,
        madrasaId: job.madrasaId,
      },
    });

    if (!followUp || followUp.deletedAt !== null || followUp.status === 'COMPLETED' || followUp.status === 'CANCELLED') {
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: 'CANCELLED',
          lastError: 'FOLLOW_UP_ALREADY_CLOSED',
          failedAt: now,
          nextAttemptAt: null,
        },
      });
      return { success: false, status: 'CANCELLED', reason: 'FOLLOW_UP_ALREADY_CLOSED' };
    }

    if (job.eventType === 'FOLLOW_UP_REMINDER') {
      const expectedReminderIso = job.payloadJson?.reminderAt || null;
      const currentReminderIso = followUp.reminderAt ? followUp.reminderAt.toISOString() : null;
      if (!followUp.reminderAt || (expectedReminderIso && currentReminderIso !== expectedReminderIso)) {
        await prisma.notificationJob.update({
          where: { id: job.id },
          data: {
            status: 'CANCELLED',
            lastError: 'FOLLOW_UP_RESCHEDULED',
            failedAt: now,
            nextAttemptAt: null,
          },
        });
        return { success: false, status: 'CANCELLED', reason: 'FOLLOW_UP_RESCHEDULED' };
      }
    }
  }

  // 3. Provider Dispatch
  try {
    if (job.channel === 'SMS') {
      if (!isSmsConfigured()) {
        await prisma.notificationJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            lastError: 'SMS provider not configured (SMS_API_KEY missing)',
            failedAt: now,
            nextAttemptAt: null, // Terminal failure, no indefinite retry
          },
        });
        return { success: false, status: 'FAILED', reason: 'SMS_PROVIDER_NOT_CONFIGURED' };
      }

      await sendSms({
        to: job.recipientAddress,
        message: job.message,
        madrasaId: job.madrasaId,
      });
    } else if (job.channel === 'EMAIL') {
      if (!isEmailConfigured()) {
        await prisma.notificationJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            lastError: 'Email provider not configured (SMTP settings missing)',
            failedAt: now,
            nextAttemptAt: null, // Terminal failure, no indefinite retry
          },
        });
        return { success: false, status: 'FAILED', reason: 'EMAIL_PROVIDER_NOT_CONFIGURED' };
      }

      // Branch on eventType for rich attachments & dynamic rendering
      if (job.eventType === 'SALARY_PAID') {
        let pdfBuffer = null;
        try {
          pdfBuffer = await generateSalarySlipPdf(job.madrasaId, job.relatedEntityId);
        } catch (pdfErr) {
          console.warn(`[NotificationWorker] Could not generate salary slip PDF for job ${job.id}:`, pdfErr.message);
        }

        const attachments = pdfBuffer
          ? [
              {
                filename: `SalarySlip_${job.payloadJson?.salaryMonth || 'Salary'}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
              },
            ]
          : [];

        const madrasa = await prisma.madrasa.findUnique({ where: { id: job.madrasaId } });
        await sendUstadhSalaryPaidEmail({
          madrasaId: job.madrasaId,
          to: job.recipientAddress,
          ustadhName: job.recipientName,
          madrasaName: madrasa?.name || 'Madrasa',
          salaryMonth: job.payloadJson?.salaryMonth || '',
          amount: job.payloadJson?.payableAmount
            ? `LKR ${Number(job.payloadJson.payableAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            : '',
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMethod: 'Bank Transfer',
          attachments,
          subject: job.subject,
          message: job.message,
        });
      } else if (job.eventType === 'TIMETABLE_FINALIZED') {
        let pdfBuffer = null;
        try {
          const publication = await prisma.timetablePublication.findUnique({
            where: { id: job.relatedEntityId },
          });
          if (publication?.scheduleSnapshotJson) {
            const staffData = publication.scheduleSnapshotJson[job.recipientEntityId];
            if (staffData) {
              pdfBuffer = await exportStaffTimetableSnapshotPdf(job.madrasaId, {
                staffName: staffData.staffName,
                staffType: staffData.staffType,
                effectiveDate: job.payloadJson?.effectiveDate || '',
                sessions: staffData.sessions || [],
              });
            }
          }
        } catch (pdfErr) {
          console.warn(`[NotificationWorker] Could not generate timetable snapshot PDF for job ${job.id}:`, pdfErr.message);
        }

        const attachments = pdfBuffer
          ? [
              {
                filename: `Timetable_${(job.recipientName || 'Staff').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
              },
            ]
          : [];

        const madrasa = await prisma.madrasa.findUnique({ where: { id: job.madrasaId } });
        await sendStaffTimetableEmail({
          madrasaId: job.madrasaId,
          to: job.recipientAddress,
          staffName: job.recipientName,
          madrasaName: madrasa?.name || 'Madrasa',
          effectiveDate: job.payloadJson?.effectiveDate || '',
          subject: job.subject,
          message: job.message,
          attachments,
        });
      } else if (
        job.eventType === 'APPLICATION_STATUS_UPDATE' ||
        job.relatedEntityType === 'StudentApplication' ||
        job.payloadJson?.applicationNo ||
        job.payloadJson?.subType
      ) {
        // Admissions confirmation or status update email
        let htmlContent = job.message;
        let textContent = job.payloadJson?.textMessage || job.message;

        // If job.message is not already an HTML document, build the rich branded template
        if (!htmlContent || !htmlContent.trim().startsWith('<')) {
          const madrasa = await prisma.madrasa.findUnique({
            where: { id: job.madrasaId },
            include: { profile: true },
          });

          let logoUrl = null;
          if (madrasa?.logoFileId) {
            const logoFile = await prisma.fileObject.findFirst({
              where: { id: madrasa.logoFileId, madrasaId: madrasa.id },
            });
            if (logoFile) {
              logoUrl = await resolveObjectAccessUrl(logoFile.objectKey);
            }
          }

          const templateResult = buildAdmissionEmailTemplate({
            subType:
              job.payloadJson?.subType ||
              (job.payloadJson?.status === 'CONVERTED' || job.payloadJson?.admissionNo
                ? 'CONVERTED'
                : job.payloadJson?.status === 'APPROVED'
                ? 'APPROVED'
                : job.payloadJson?.status === 'REJECTED'
                ? 'REJECTED'
                : 'SUBMITTED'),
            madrasaName: madrasa?.name || 'AL/MAHMOODHIYYA ARABIC COLLAGE',
            logoUrl,
            recipientName: job.recipientName || 'Parent / Guardian',
            applicantName: job.payloadJson?.applicantName || '',
            applicationNo: job.payloadJson?.applicationNo || '',
            admissionNo: job.payloadJson?.admissionNo || null,
            intakeName: job.payloadJson?.intakeName || job.payloadJson?.intake || '',
            academicYear: job.payloadJson?.academicYear || '',
            className: job.payloadJson?.className || job.payloadJson?.appliedClassName || '',
            status: job.payloadJson?.status || '',
            decisionText: job.payloadJson?.decisionText || '',
            remarks: job.payloadJson?.remarks || '',
            submittedAt: job.payloadJson?.submittedAt || null,
            contactPhone: madrasa?.profile?.contactPhone || madrasa?.phone || '',
            contactEmail: madrasa?.profile?.contactEmail || madrasa?.email || '',
            address: madrasa?.profile?.address || madrasa?.address || '',
          });

          htmlContent = templateResult.html;
          textContent = templateResult.text;
        }

        await sendAdmissionNotificationEmail({
          madrasaId: job.madrasaId,
          to: job.recipientAddress,
          subject: job.subject,
          html: htmlContent,
          text: textContent,
        });
      } else {
        // Fee payment confirmation or reminder email
        await sendStudentFeePaymentEmail({
          madrasaId: job.madrasaId,
          to: job.recipientAddress,
          subject: job.subject,
          html: job.message,
          text: job.payloadJson?.textMessage || job.subject,
        });
      }
    }

    // Success update
    const sentTimestamp = new Date();
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        status: 'SENT',
        sentAt: sentTimestamp,
        lastError: null,
      },
    });

    if (job.eventType === 'FOLLOW_UP_REMINDER' && job.relatedEntityId) {
      await prisma.studentFollowUp.updateMany({
        where: {
          id: job.relatedEntityId,
          madrasaId: job.madrasaId,
        },
        data: {
          reminderSentAt: sentTimestamp,
        },
      }).catch(() => {});
    }

    return { success: true, status: 'SENT' };
  } catch (err) {
    const maxAttempts = job.maxAttempts || 3;
    const isFinalAttempt = currentAttempt >= maxAttempts;

    if (isFinalAttempt) {
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          lastError: err.message || 'Delivery failed',
          nextAttemptAt: null,
        },
      });
      return { success: false, status: 'FAILED', error: err.message };
    } else {
      // Exponential backoff: 2^attempt * 60 seconds (Attempt 1: 120s, Attempt 2: 240s)
      const delaySeconds = Math.pow(2, currentAttempt) * 60;
      const nextAttemptAt = new Date(Date.now() + delaySeconds * 1000);

      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: 'PENDING',
          lastError: err.message || 'Delivery failed',
          nextAttemptAt,
        },
      });
      return { success: false, status: 'PENDING', error: err.message, nextAttemptAt };
    }
  }
}

/**
 * Processes queued notification jobs using atomic claim.
 *
 * @param {object} [options]
 * @param {number} [options.limit=10]
 * @returns {Promise<{ processedCount: number, claimedCount: number }>}
 */
export async function processNotificationJobs({ limit = 10, madrasaId } = {}) {
  const now = new Date();

  const whereClause = {
    status: 'PENDING',
    OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
  };
  if (madrasaId) {
    whereClause.madrasaId = madrasaId;
  }

  // Find candidate jobs
  const candidates = await prisma.notificationJob.findMany({
    where: whereClause,
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let processedCount = 0;
  let claimedCount = 0;

  for (const candidate of candidates) {
    // Atomic claim: update status to PROCESSING and increment attemptCount
    const claimResult = await prisma.notificationJob.updateMany({
      where: {
        id: candidate.id,
        status: 'PENDING',
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      data: {
        status: 'PROCESSING',
        processingStartedAt: now,
        attemptCount: { increment: 1 },
      },
    });

    if (claimResult.count === 0) {
      // Another worker/thread claimed this candidate
      continue;
    }

    claimedCount++;

    // Refresh candidate record with new attempt count
    const claimedJob = await prisma.notificationJob.findUnique({
      where: { id: candidate.id },
    });

    if (!claimedJob) continue;

    await dispatchClaimedJob(claimedJob);
    processedCount++;
  }

  return { processedCount, claimedCount };
}

/**
 * Initializes and starts the background notification engine worker.
 */
export function startNotificationWorker({
  pollIntervalMs = 5000,
  reminderIntervalMs = 10 * 60 * 1000,
} = {}) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  stopNotificationWorker();

  // Polling loop for pending jobs
  pollTimer = setInterval(async () => {
    if (isPollingActive) return;
    isPollingActive = true;
    try {
      await processNotificationJobs({ limit: 20 });
    } catch (err) {
      console.error('[NotificationWorker] Error processing job batch:', err.message);
    } finally {
      isPollingActive = false;
    }
  }, pollIntervalMs);
  if (pollTimer?.unref) {
    pollTimer.unref();
  }

  // Periodic loop for month-end reminders, follow-up reminders, and stale job recovery
  reminderCronTimer = setInterval(async () => {
    try {
      await recoverStaleJobs();
      await processMonthEndReminders();
      await processDueDateReminders();
      await processFollowUpReminders();
    } catch (err) {
      console.error('[NotificationWorker] Periodic reminder / recovery error:', err.message);
    }
  }, reminderIntervalMs);
  if (reminderCronTimer?.unref) {
    reminderCronTimer.unref();
  }

  // Run immediate initial pass
  processFollowUpReminders().catch(() => {});
  processNotificationJobs({ limit: 10 }).catch(() => {});
  recoverStaleJobs().catch(() => {});

  console.log('🚀 Notification Worker started (atomic queue + month-end & follow-up scheduler).');
}

/**
 * Gracefully stops the background notification engine worker.
 */
export function stopNotificationWorker() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (reminderCronTimer) {
    clearInterval(reminderCronTimer);
    reminderCronTimer = null;
  }
  isPollingActive = false;
}
