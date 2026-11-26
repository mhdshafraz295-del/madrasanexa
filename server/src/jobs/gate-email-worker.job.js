import { prisma } from '../lib/prisma.js';
import { dispatchEmail } from '../services/email.service.js';
import { getTenantLocalDateString } from '../services/gate-attendance.service.js';
import { sendSms, normalizePhoneNumber } from '../services/sms.service.js';

let workerIntervalId = null;
let isProcessingBatch = false;

/**
 * Formats a timestamp into human-readable 12-hour local time in the specified timezone.
 *
 * @param {Date} date
 * @param {string} timezone
 * @returns {string} e.g. "07:45 AM"
 */
function formatLocalTime(date, timezone = 'Asia/Colombo') {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'Asia/Colombo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return formatter.format(date);
  } catch (_err) {
    return date.toISOString();
  }
}

/**
 * Safely escapes dynamic text strings for HTML injection prevention.
 *
 * @param {unknown} val - Value to escape
 * @returns {string} HTML-escaped string
 */
export function escapeHtml(val) {
  if (val === null || val === undefined) {
    return '';
  }
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders HTML email template for parent gate event notification.
 */
export function renderGateEmailHtml({
  madrasaName,
  studentName,
  admissionNo,
  className,
  eventType,
  timeStr,
  dateStr,
}) {
  const safeMadrasaName = escapeHtml(madrasaName);
  const safeStudentName = escapeHtml(studentName);
  const safeAdmissionNo = escapeHtml(admissionNo);
  const safeClassName = className ? escapeHtml(className) : null;
  const safeDateStr = escapeHtml(dateStr);
  const safeTimeStr = escapeHtml(timeStr);

  const isEntry = eventType === 'ENTRY';
  const actionColor = isEntry ? '#16a34a' : '#2563eb';
  const actionText = isEntry ? 'Checked IN (Entry)' : 'Checked OUT (Exit)';

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; color: #1f2937;">
      <div style="background-color: #0f172a; color: #ffffff; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 600;">${safeMadrasaName}</h2>
        <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">Automated Gate Movement Notification</p>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 15px; line-height: 1.5; margin: 0 0 16px;">
          Assalamu Alaikum / Dear Parent / Guardian,
        </p>
        <p style="font-size: 15px; line-height: 1.5; margin: 0 0 20px;">
          This is an official automated notification to inform you that your child has passed through the institution's gate.
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 140px;">Student Name:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${safeStudentName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Admission No:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${safeAdmissionNo}</td>
            </tr>
            ${safeClassName ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Class:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${safeClassName}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Movement:</td>
              <td style="padding: 6px 0; font-weight: 700; color: ${actionColor}; font-size: 15px;">${actionText}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Date:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${safeDateStr}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Recorded Time:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${safeTimeStr}</td>
            </tr>
          </table>
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">
          If you have any questions or did not expect this movement, please contact the institution administration promptly.
        </p>
      </div>
      <div style="background-color: #f1f5f9; padding: 12px 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        Powered by MadrasaNexa Gate Intelligence System &bull; Please do not reply directly to this automated email.
      </div>
    </div>
  `;
}

/**
 * Recovers stale events that have remained in PROCESSING status for more than 5 minutes.
 * Prevents worker crashes or network timeouts from permanently wedging queued notifications.
 *
 * Concurrency Safety:
 * Uses atomic conditional updateMany with (id, emailStatus: 'PROCESSING', processingStartedAt <= staleCutoff)
 * to eliminate race conditions between concurrent worker threads.
 *
 * Error Handling:
 * Does not write synthetic stale recovery text into emailError.
 *
 * @param {number} [staleThresholdMs=300000] - 5 minutes default
 * @returns {Promise<number>} Number of recovered events
 */
export async function recoverStaleGateEmailJobs(staleThresholdMs = 5 * 60 * 1000) {
  const staleCutoff = new Date(Date.now() - staleThresholdMs);

  const staleEvents = await prisma.studentGateEvent.findMany({
    where: {
      emailStatus: 'PROCESSING',
      processingStartedAt: {
        lte: staleCutoff,
      },
    },
    take: 50,
  });

  if (staleEvents.length === 0) {
    return 0;
  }

  let recoveredCount = 0;

  for (const event of staleEvents) {
    if (event.attemptCount < 3) {
      // Atomic conditional recovery: only update if STILL in PROCESSING and processingStartedAt <= staleCutoff
      const updateResult = await prisma.studentGateEvent.updateMany({
        where: {
          id: event.id,
          emailStatus: 'PROCESSING',
          processingStartedAt: {
            lte: staleCutoff,
          },
        },
        data: {
          emailStatus: 'QUEUED',
          processingStartedAt: null,
          nextAttemptAt: new Date(), // Immediate retry
        },
      });

      if (updateResult.count > 0) {
        recoveredCount++;
      }
    } else {
      // Atomic conditional recovery for exhausted attempts: transition to FAILED
      const updateResult = await prisma.studentGateEvent.updateMany({
        where: {
          id: event.id,
          emailStatus: 'PROCESSING',
          processingStartedAt: {
            lte: staleCutoff,
          },
        },
        data: {
          emailStatus: 'FAILED',
          processingStartedAt: null,
          nextAttemptAt: null,
        },
      });

      if (updateResult.count > 0) {
        recoveredCount++;
      }
    }
  }

  return recoveredCount;
}

/**
 * Claims and processes a batch of QUEUED gate email notifications.
 *
 * Features:
 * - Atomic Compare-And-Swap (CAS) lease claim.
 * - Tenant opt-out cutoff check at claim time.
 * - Strict 0s, 30s, 120s retry schedule (max 3 attempts).
 * - Retry status strictly remains 'QUEUED' (never PENDING_RETRY).
 * - Reuses existing dispatchEmail with custom/tenant SMTP or test mode.
 *
 * @param {object} [options]
 * @param {number} [options.limit=20] - Batch size
 * @param {string} [options.madrasaId] - Optional tenant filter for targeted processing
 * @returns {Promise<{ processed: number, sent: number, failed: number, skipped: number }>}
 */
export async function processGateEmailJobs({ limit = 20, madrasaId = null } = {}) {
  const now = new Date();
  const summary = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  // 1. Recover any stale leases (> 5 mins) before processing current queue
  try {
    await recoverStaleGateEmailJobs();
  } catch (recoverErr) {
    console.error('[gate-email-worker] Error recovering stale jobs:', recoverErr.message);
  }

  // 2. Find eligible QUEUED candidates
  const where = {
    emailStatus: 'QUEUED',
    OR: [
      { nextAttemptAt: null },
      { nextAttemptAt: { lte: now } },
    ],
  };

  if (madrasaId) {
    where.madrasaId = madrasaId;
  }

  const candidates = await prisma.studentGateEvent.findMany({
    where,
    orderBy: {
      scannedAt: 'asc',
    },
    take: limit,
    select: {
      id: true,
      madrasaId: true,
      studentId: true,
      eventType: true,
      category: true,
      scannedAt: true,
      attemptCount: true,
    },
  });

  if (candidates.length === 0) {
    return summary;
  }

  // 3. Process candidate jobs
  for (const candidate of candidates) {
    // Atomic CAS claim: Update status from QUEUED -> PROCESSING
    const claimResult = await prisma.studentGateEvent.updateMany({
      where: {
        id: candidate.id,
        emailStatus: 'QUEUED',
      },
      data: {
        emailStatus: 'PROCESSING',
        processingStartedAt: now,
        attemptCount: { increment: 1 },
      },
    });

    // If another worker thread already claimed it, skip
    if (claimResult.count === 0) {
      continue;
    }

    summary.processed++;
    const currentAttempt = candidate.attemptCount + 1;

    try {
      // Fetch full event relations and tenant settings
      const event = await prisma.studentGateEvent.findUnique({
        where: { id: candidate.id },
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              admissionNo: true,
              guardianEmail: true,
              guardianPhone: true,
              whatsappNumber: true,
              guardianName: true,
              category: true,
              class: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          madrasa: {
            select: { id: true, name: true },
          },
        },
      });

      if (!event) {
        continue;
      }

      // Check tenant settings at claim time (Tenant Opt-out Cutoff Rule)
      const settings = await prisma.madrasaSetting.findUnique({
        where: { madrasaId: event.madrasaId },
      });

      if (!settings?.gateParentEmailNotificationsEnabled) {
        // Institutional opt-out cutoff: Transition from PROCESSING -> NOT_APPLICABLE
        await prisma.studentGateEvent.update({
          where: { id: event.id },
          data: {
            emailStatus: 'NOT_APPLICABLE',
            emailSkipReason: 'TENANT_NOTIFICATIONS_DISABLED_AT_DISPATCH',
            processingStartedAt: null,
            nextAttemptAt: null,
          },
        });
        summary.skipped++;
        continue;
      }

      // Verify student category eligibility (strictly DAY_SCHOLAR)
      if (event.category === 'BOARDING') {
        await prisma.studentGateEvent.update({
          where: { id: event.id },
          data: {
            emailStatus: 'NOT_APPLICABLE',
            emailSkipReason: 'BOARDING_STUDENT_EXEMPT',
            processingStartedAt: null,
            nextAttemptAt: null,
          },
        });
        summary.skipped++;
        continue;
      }

      // Resolve contact channels
      const guardianEmail = event.student?.guardianEmail?.trim() || null;
      const rawPhone = event.student?.guardianPhone || event.student?.whatsappNumber || null;
      const normalizedPhone = normalizePhoneNumber(rawPhone);

      // Verify at least one recipient channel is registered
      if (!guardianEmail && !rawPhone) {
        await prisma.studentGateEvent.update({
          where: { id: event.id },
          data: {
            emailStatus: 'SKIPPED_NO_RECIPIENT',
            emailSkipReason: 'NO_GUARDIAN_EMAIL_REGISTERED',
            processingStartedAt: null,
            nextAttemptAt: null,
          },
        });
        summary.skipped++;
        continue;
      }

      // Prepare notification payloads
      const tenantTimezone = settings?.timezone || 'Asia/Colombo';
      const timeStr = formatLocalTime(event.scannedAt, tenantTimezone);
      const dateStr = getTenantLocalDateString(event.scannedAt, tenantTimezone);
      const madrasaName = event.madrasa?.name || 'Madrasa Institution';
      const studentName = event.student?.fullName || 'Student';
      const admissionNo = event.student?.admissionNo || 'N/A';
      const className = event.student?.class?.name || null;

      // 1. Dispatch Text.lk SMS alert alongside Gate Entry/Exit Email (deduplicated: attempt 1 only)
      if (rawPhone && currentAttempt === 1) {
        console.log('[SmsService] Gate alert triggered:', {
          admissionNo,
          rawPhone,
          normalizedPhone,
        });

        const actionWord = event.eventType === 'ENTRY' ? 'entered' : 'exited';
        const smsMessage = `[${madrasaName}] Attendance Alert: ${studentName} (${admissionNo}) has ${actionWord} the campus at ${timeStr}.`;

        try {
          const smsResult = await sendSms({
            to: rawPhone,
            message: smsMessage,
            madrasaId: event.madrasaId,
          });
          console.log('[SmsService] Text.lk API response:', smsResult);
        } catch (smsErr) {
          console.error('[SmsService] Text.lk SMS delivery error in gate worker:', smsErr?.message || smsErr);
        }
      }

      // 2. Dispatch through email service if guardianEmail is present
      let dispatchResult = null;
      if (guardianEmail) {
        const actionSubject = event.eventType === 'ENTRY' ? 'Entry Alert' : 'Exit Alert';
        const subject = `[${madrasaName}] Gate ${actionSubject}: ${studentName}`;

        const html = renderGateEmailHtml({
          madrasaName,
          studentName,
          admissionNo,
          className,
          eventType: event.eventType,
          timeStr,
          dateStr,
        });

        const text = `Assalamu Alaikum / Dear Parent,\n\nYour child ${studentName} (${admissionNo}) has recorded a gate ${event.eventType} at ${madrasaName} on ${dateStr} at ${timeStr}.\n\nThis is an automated notification.`;

        dispatchResult = await dispatchEmail({
          madrasaId: event.madrasaId,
          to: guardianEmail,
          subject,
          html,
          text,
        });
      } else {
        // SMS-only delivery (no email registered)
        dispatchResult = { success: true, status: 'SENT', smsOnly: true };
      }

      if (dispatchResult && dispatchResult.success && dispatchResult.status === 'SENT') {
        // Success: Mark as SENT
        await prisma.studentGateEvent.update({
          where: { id: event.id },
          data: {
            emailStatus: 'SENT',
            sentAt: new Date(),
            processingStartedAt: null,
            nextAttemptAt: null,
            emailResponse: JSON.stringify(dispatchResult),
            emailError: null,
          },
        });
        summary.sent++;
      } else {
        // Delivery failed: Apply retry schedule or mark FAILED
        const rawError = dispatchResult?.error || 'Email dispatch failed';
        const errorMsg = String(rawError).slice(0, 500);

        if (currentAttempt < 3) {
          // Schedule retry: Attempt 1 -> 30s delay, Attempt 2 -> 120s delay
          const delaySeconds = currentAttempt === 1 ? 30 : 120;
          const retryTime = new Date(Date.now() + delaySeconds * 1000);

          await prisma.studentGateEvent.update({
            where: { id: event.id },
            data: {
              emailStatus: 'QUEUED', // Status remains QUEUED, never PENDING_RETRY
              processingStartedAt: null,
              nextAttemptAt: retryTime,
              emailError: errorMsg,
            },
          });
        } else {
          // Maximum attempts (3) exhausted: Mark as FAILED
          await prisma.studentGateEvent.update({
            where: { id: event.id },
            data: {
              emailStatus: 'FAILED',
              processingStartedAt: null,
              nextAttemptAt: null,
              emailError: errorMsg,
            },
          });
        }
        summary.failed++;
      }
    } catch (jobErr) {
      console.error(`[gate-email-worker] Error processing gate event ${candidate.id}:`, jobErr);
      const errorMsg = String(jobErr.message || jobErr).slice(0, 500);

      if (currentAttempt < 3) {
        const delaySeconds = currentAttempt === 1 ? 30 : 120;
        await prisma.studentGateEvent.update({
          where: { id: candidate.id },
          data: {
            emailStatus: 'QUEUED',
            processingStartedAt: null,
            nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
            emailError: errorMsg,
          },
        });
      } else {
        await prisma.studentGateEvent.update({
          where: { id: candidate.id },
          data: {
            emailStatus: 'FAILED',
            processingStartedAt: null,
            nextAttemptAt: null,
            emailError: errorMsg,
          },
        });
      }
      summary.failed++;
    }
  }

  return summary;
}

/**
 * Worker tick handler with concurrency guard.
 */
async function workerTick() {
  if (isProcessingBatch) {
    return;
  }

  isProcessingBatch = true;
  try {
    await processGateEmailJobs({ limit: 20 });
  } catch (err) {
    console.error('[gate-email-worker] Tick error:', err.message);
  } finally {
    isProcessingBatch = false;
  }
}

/**
 * Starts the automatic gate email outbox worker.
 *
 * @param {object} [options]
 * @param {number} [options.intervalMs=10000] - Polling interval in ms (default 10s)
 */
export function startGateEmailWorker({ intervalMs = 10000 } = {}) {
  if (workerIntervalId) {
    console.warn('[gate-email-worker] Worker is already running. Duplicate startup prevented.');
    return;
  }

  console.log(`📬 [gate-email-worker] Starting Gate Email Outbox Worker (interval: ${intervalMs}ms)...`);
  workerIntervalId = setInterval(workerTick, intervalMs);

  // Trigger initial pass after a short 2s warmup
  setTimeout(workerTick, 2000);
}

/**
 * Gracefully stops the gate email outbox worker.
 */
export function stopGateEmailWorker() {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
    console.log('🛑 [gate-email-worker] Gate Email Outbox Worker stopped gracefully.');
  }
}
