import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { prisma } from '../lib/prisma.js';
import { escapeHtml, dispatchEmail } from './email.service.js';
import {
  getInterviewInvitationPdfBuffer,
  formatColomboDate,
  formatTime12h,
} from './interview-pdf.service.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = 'Asia/Colombo';
const LEASE_DURATION_MINUTES = 5;

/**
 * Builds the responsive HTML email template for Admissions Interview Invitations.
 */
export function buildInterviewEmailTemplate({
  madrasaName,
  applicantName,
  applicationNo,
  recipientName,
  interviewRound,
  interviewDate,
  startTime,
  endTime,
  venue,
  instructions,
  requiredDocuments,
  contactPhone,
  contactEmail,
  address,
}) {
  const safeMadrasa = escapeHtml(madrasaName || 'Madrasa Administration');
  const safeApplicant = escapeHtml(applicantName || 'Applicant');
  const safeAppNo = escapeHtml(applicationNo || 'N/A');
  const safeRecipient = escapeHtml(recipientName || 'Parent / Guardian');
  const roundLabel = interviewRound === 'SECOND' ? 'Second Round Admissions Interview' : 'First Round Admissions Interview';
  const roundBadgeColor = interviewRound === 'SECOND' ? '#7C3AED' : '#047857';
  const roundBadgeBg = interviewRound === 'SECOND' ? '#F5F3FF' : '#ECFDF5';

  const dateFormatted = formatColomboDate(interviewDate);
  const timeFormatted = `${formatTime12h(startTime)} – ${formatTime12h(endTime)}`;
  const safeVenue = escapeHtml(venue || 'Admissions Office');
  const safeInstructions = escapeHtml(instructions || '');
  const safePhone = escapeHtml(contactPhone || '');
  const safeEmail = escapeHtml(contactEmail || '');
  const safeAddress = escapeHtml(address || '');

  let docsList = [];
  if (Array.isArray(requiredDocuments)) {
    docsList = requiredDocuments;
  } else if (typeof requiredDocuments === 'string') {
    try {
      const parsed = JSON.parse(requiredDocuments);
      if (Array.isArray(parsed)) docsList = parsed;
    } catch (e) {
      docsList = [requiredDocuments];
    }
  }

  const subject = `Official Interview Call Letter: ${safeApplicant} (${safeAppNo}) - ${safeMadrasa}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #F8FAFC;
      color: #1E293B;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 600px;
      margin: 20px auto;
      background: #FFFFFF;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      border: 1px solid #E2E8F0;
    }
    .header {
      background: #064E3B;
      color: #FFFFFF;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .header p {
      margin: 4px 0 0;
      font-size: 13px;
      color: #D1FAE5;
    }
    .content {
      padding: 24px;
    }
    .greeting {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #0F172A;
    }
    .intro {
      font-size: 14px;
      line-height: 1.5;
      color: #334155;
      margin-bottom: 18px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 700;
      color: ${roundBadgeColor};
      background: ${roundBadgeBg};
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 16px;
    }
    .schedule-box {
      background: #F0FDF4;
      border: 1.5px solid #86EFAC;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .schedule-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid #DCFCE7;
      font-size: 13.5px;
    }
    .schedule-row:last-child {
      border-bottom: none;
    }
    .schedule-label {
      font-weight: 700;
      color: #166534;
      width: 35%;
    }
    .schedule-val {
      font-weight: 600;
      color: #0F172A;
      word-break: break-word;
      width: 65%;
      text-align: right;
    }
    @media only screen and (max-width: 520px) {
      .wrapper { margin: 10px !important; }
      .header { padding: 18px 16px !important; }
      .content { padding: 18px 16px !important; }
      .schedule-row { flex-direction: column !important; gap: 2px !important; }
      .schedule-label { width: 100% !important; }
      .schedule-val { width: 100% !important; text-align: left !important; }
    }
    .attachment-notice {
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 20px;
      font-size: 13px;
      color: #1E40AF;
      line-height: 1.45;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      color: #0F172A;
      margin: 16px 0 8px;
      letter-spacing: 0.4px;
    }
    .doc-list {
      margin: 0 0 16px;
      padding-left: 20px;
      font-size: 13px;
      color: #334155;
      line-height: 1.5;
    }
    .instructions {
      font-size: 13px;
      color: #475569;
      line-height: 1.5;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 20px;
    }
    .footer {
      background: #F1F5F9;
      padding: 18px 24px;
      font-size: 12px;
      color: #64748B;
      text-align: center;
      line-height: 1.5;
      border-top: 1px solid #E2E8F0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>${safeMadrasa}</h1>
      <p>Office of Admissions & Student Affairs</p>
    </div>
    <div class="content">
      <div class="greeting">Assalamu Alaikum wa Rahmatullah, ${safeRecipient}</div>
      <p class="intro">
        We are pleased to invite <strong>${safeApplicant}</strong> (Application Reference: <strong>${safeAppNo}</strong>) for an official admissions interview at <strong>${safeMadrasa}</strong>.
      </p>

      <div><span class="badge">${roundLabel}</span></div>

      <div class="schedule-box">
        <div class="schedule-row">
          <span class="schedule-label">Interview Date:</span>
          <span class="schedule-val">${dateFormatted}</span>
        </div>
        <div class="schedule-row">
          <span class="schedule-label">Time Slot:</span>
          <span class="schedule-val" style="color: #065F46;">${timeFormatted} (${TIMEZONE})</span>
        </div>
        <div class="schedule-row">
          <span class="schedule-label">Venue / Room:</span>
          <span class="schedule-val">${safeVenue}</span>
        </div>
      </div>

      <div class="attachment-notice">
        <strong>📎 Official Invitation PDF Attached:</strong><br>
        A personalized, high-resolution A4 Invitation Letter has been attached to this email. Please download and present it upon arrival at the interview desk.
      </div>

      ${
        docsList.length > 0
          ? `
        <div class="section-title">Required Documents</div>
        <ul class="doc-list">
          ${docsList.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}
        </ul>
      `
          : ''
      }

      <div class="section-title">Important Guidelines</div>
      <div class="instructions">
        &bull; <strong>Arrival:</strong> Please arrive at the reception at least 15 minutes before your allocated time slot.<br>
        &bull; <strong>Attire:</strong> Appropriate, modest Islamic dress is required for all candidates.<br>
        &bull; <strong>Guardian:</strong> At least one parent or registered guardian must accompany the applicant.<br>
        ${safeInstructions ? `&bull; <strong>Additional Note:</strong> ${safeInstructions}` : ''}
      </div>

      <p style="font-size: 13.5px; color: #334155; margin-top: 20px;">
        We wish the candidate all the best. For any urgent inquiries, please contact our admissions desk.
      </p>
    </div>
    <div class="footer">
      <strong>${safeMadrasa}</strong><br>
      ${safeAddress ? `${safeAddress}<br>` : ''}
      ${safePhone ? `Phone: ${safePhone}` : ''} ${safePhone && safeEmail ? ' | ' : ''} ${safeEmail ? `Email: ${safeEmail}` : ''}<br>
      <span style="font-size: 11px; color: #94A3B8; margin-top: 6px; display: inline-block;">This email was sent via MadrasaNexa Multi-Tenant Platform.</span>
    </div>
  </div>
</body>
</html>`;

  const text = `Assalamu Alaikum ${recipientName || 'Parent / Guardian'},

We are pleased to invite ${applicantName} (Application No: ${applicationNo}) for an admissions interview at ${madrasaName}.

Round: ${roundLabel}
Date: ${dateFormatted}
Time Slot: ${timeFormatted} (${TIMEZONE})
Venue: ${venue}

An official PDF invitation letter has been attached to this email. Please review the attached document for full candidate instructions and required document checklist.

Arrival Instructions:
- Please arrive 15 minutes prior to your scheduled time slot.
- Modest Islamic attire is required.
- At least one parent or guardian must be present.

${instructions ? `Additional Instructions: ${instructions}\n` : ''}
${contactPhone ? `Phone: ${contactPhone}` : ''}
${contactEmail ? `Email: ${contactEmail}` : ''}

Sincerely,
Office of Admissions
${madrasaName}`;

  return { subject, html, text };
}

/**
 * Dispatches an individual interview invitation email with the applicant's PDF attached,
 * with atomic claiming, lease expiration handling, and socket timeout protection.
 *
 * @param {string} madrasaId
 * @param {string} appointmentId
 * @param {object} [options]
 * @param {boolean} [options.forceRetry]
 * @returns {Promise<{ success: boolean, notification: object, error?: string }>}
 */
export async function sendInterviewAppointmentEmail(madrasaId, appointmentId, { forceRetry = false } = {}) {
  const appointment = await prisma.interviewAppointment.findFirst({
    where: { id: appointmentId, madrasaId },
    include: {
      schedule: true,
      application: {
        include: {
          admissionPeriod: true,
          appliedClass: true,
        },
      },
    },
  });

  if (!appointment) {
    throw new NotFoundError('Interview appointment not found.');
  }

  const madrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
  });

  if (!madrasa) {
    throw new NotFoundError('Madrasa institution not found.');
  }

  const recipientEmail = appointment.application.guardianEmail?.trim();
  const recipientName = appointment.application.guardianName || 'Parent / Guardian';

  if (!recipientEmail || !recipientEmail.includes('@')) {
    // Cannot send email without valid recipient address; mark as FAILED
    const failedNote = await prisma.interviewNotification.create({
      data: {
        madrasaId,
        appointmentId: appointment.id,
        recipientEmail: recipientEmail || 'NO_EMAIL_PROVIDED',
        recipientName,
        pdfVersion: appointment.pdfVersion,
        status: 'FAILED',
        errorDetails: 'Guardian email address is missing or invalid in student application.',
      },
    });
    return {
      success: false,
      notification: failedNote,
      error: 'Guardian email address is missing or invalid.',
    };
  }

  // 1. Atomic Claiming & Idempotency Check
  const now = new Date();
  const leaseExpiresAt = dayjs().add(LEASE_DURATION_MINUTES, 'minute').toDate();

  // Find existing notification
  let notification = await prisma.interviewNotification.findFirst({
    where: {
      appointmentId: appointment.id,
      madrasaId,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (notification) {
    // If already sent and forceRetry is not set, protect from duplicate delivery!
    if (notification.status === 'SENT' && !forceRetry) {
      return {
        success: true,
        notification,
        message: 'Email already successfully delivered.',
      };
    }

    // If currently claimed and lease is active, another worker or process is transmitting
    if (
      notification.status === 'CLAIMED' &&
      notification.leaseExpiresAt &&
      notification.leaseExpiresAt > now &&
      !forceRetry
    ) {
      return {
        success: false,
        notification,
        error: 'Email delivery is currently in-progress by another process.',
      };
    }

    // If status is UNCERTAIN, require manual confirmation or forceRetry
    if (notification.status === 'UNCERTAIN' && !forceRetry) {
      return {
        success: false,
        notification,
        error: 'Delivery status is uncertain. Please verify SMTP logs and mark delivered or confirmed failed.',
      };
    }

    // Atomically claim existing notification
    notification = await prisma.interviewNotification.update({
      where: { id: notification.id },
      data: {
        status: 'CLAIMED',
        claimedAt: now,
        leaseExpiresAt,
        errorDetails: null,
      },
    });
  } else {
    // Create new claimed notification
    notification = await prisma.interviewNotification.create({
      data: {
        madrasaId,
        appointmentId: appointment.id,
        recipientEmail,
        recipientName,
        pdfVersion: appointment.pdfVersion,
        fileObjectId: appointment.fileObjectId,
        status: 'CLAIMED',
        claimedAt: now,
        leaseExpiresAt,
      },
    });
  }

  // 2. Fetch or Generate PDF Attachment
  let pdfBuffer = null;
  try {
    pdfBuffer = await getInterviewInvitationPdfBuffer(madrasaId, appointment.id);
  } catch (pdfErr) {
    console.error(`[interview-email.service] Failed generating PDF for ${appointment.invitationReference}:`, pdfErr.message);
    const updated = await prisma.interviewNotification.update({
      where: { id: notification.id },
      data: {
        status: 'FAILED',
        errorDetails: `PDF generation failed: ${pdfErr.message.slice(0, 300)}`,
        retryCount: { increment: 1 },
      },
    });
    return {
      success: false,
      notification: updated,
      error: `PDF generation failed: ${pdfErr.message}`,
    };
  }

  // 3. Build Email Content
  const { subject, html, text } = buildInterviewEmailTemplate({
    madrasaName: madrasa.name,
    applicantName: appointment.application.applicantName,
    applicationNo: appointment.application.applicationNo,
    recipientName,
    interviewRound: appointment.interviewRound,
    interviewDate: appointment.interviewDate,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    venue: appointment.venue,
    instructions: appointment.schedule?.instructions || appointment.rescheduleReason,
    requiredDocuments: appointment.schedule?.requiredDocuments,
    contactPhone: madrasa.phone,
    contactEmail: madrasa.email,
    address: madrasa.address,
  });

  // 4. Dispatch Email with PDF Attachment & Uncertain Timeout Protection
  const filename = `Interview_Invitation_${appointment.invitationReference}.pdf`;
  let dispatchResult = null;

  try {
    dispatchResult = await dispatchEmail({
      madrasaId,
      to: recipientEmail,
      subject,
      html,
      text,
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  } catch (smtpErr) {
    // If an unexpected crash / socket drop occurs after transmission began
    console.error(`[interview-email.service] SMTP dispatch exception for appointment ${appointment.id}:`, smtpErr.message);
    const isTimeout = smtpErr.message?.toLowerCase().includes('timeout') || smtpErr.code === 'ETIMEDOUT';
    const status = isTimeout ? 'UNCERTAIN' : 'FAILED';
    const updated = await prisma.interviewNotification.update({
      where: { id: notification.id },
      data: {
        status,
        uncertainDelivery: isTimeout,
        errorDetails: String(smtpErr.message || 'SMTP transmission error').slice(0, 300),
        retryCount: { increment: 1 },
      },
    });
    return {
      success: false,
      notification: updated,
      error: smtpErr.message,
    };
  }

  // 5. Update Notification Record with Outcome
  if (dispatchResult?.success) {
    const updated = await prisma.interviewNotification.update({
      where: { id: notification.id },
      data: {
        status: 'SENT',
        smtpMessageId: dispatchResult.messageId || `smtp-${Date.now()}`,
        sentAt: new Date(),
        errorDetails: null,
        uncertainDelivery: false,
      },
    });
    return {
      success: true,
      notification: updated,
    };
  } else {
    const isTimeout = dispatchResult?.error?.toLowerCase().includes('time out') || dispatchResult?.error?.toLowerCase().includes('timeout');
    const status = isTimeout ? 'UNCERTAIN' : 'FAILED';
    const updated = await prisma.interviewNotification.update({
      where: { id: notification.id },
      data: {
        status,
        uncertainDelivery: isTimeout,
        errorDetails: String(dispatchResult?.error || 'Email dispatch failed').slice(0, 300),
        retryCount: { increment: 1 },
      },
    });
    return {
      success: false,
      notification: updated,
      error: dispatchResult?.error || 'Email dispatch failed',
    };
  }
}

/**
 * Processes queued interview appointment emails in background for a list of appointment IDs.
 * Non-blocking for the caller.
 *
 * @param {string} madrasaId
 * @param {string[]} appointmentIds
 */
export async function processInterviewEmailsBackground(madrasaId, appointmentIds) {
  if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) return;

  // Process sequentially to be gentle on SMTP server and prevent rate limit exhaustion
  for (const appointmentId of appointmentIds) {
    try {
      await sendInterviewAppointmentEmail(madrasaId, appointmentId);
    } catch (err) {
      console.warn(`[interview-email.service] Background email error for appointment ${appointmentId}:`, err.message);
    }
  }
}

/**
 * Retries failed or selected notifications for a madrasa.
 *
 * @param {string} madrasaId
 * @param {object} payload
 * @param {string[]} [payload.notificationIds]
 * @param {string} [payload.appointmentId]
 * @param {boolean} [payload.force]
 * @returns {Promise<{ attempted: number, successful: number, failed: number }>}
 */
export async function retryFailedInterviewNotifications(madrasaId, { notificationIds, appointmentId, force = false } = {}) {
  const where = { madrasaId };
  if (notificationIds && notificationIds.length > 0) {
    where.id = { in: notificationIds };
  } else if (appointmentId) {
    where.appointmentId = appointmentId;
  } else {
    where.status = { in: ['FAILED'] };
  }

  // Unless force is true, never retry SENT or UNCERTAIN records
  if (!force) {
    where.status = { in: ['FAILED', 'PENDING'] };
  }

  const notifications = await prisma.interviewNotification.findMany({
    where,
    select: { id: true, appointmentId: true },
  });

  let successful = 0;
  let failed = 0;

  for (const note of notifications) {
    try {
      const result = await sendInterviewAppointmentEmail(madrasaId, note.appointmentId, { forceRetry: force });
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
    }
  }

  return {
    attempted: notifications.length,
    successful,
    failed,
  };
}

/**
 * Manually marks an UNCERTAIN notification as delivered after verifying external SMTP logs.
 */
export async function markUncertainNotificationAsDelivered(madrasaId, notificationId, smtpMessageId) {
  const notification = await prisma.interviewNotification.findFirst({
    where: { id: notificationId, madrasaId },
  });

  if (!notification) {
    throw new NotFoundError('Interview notification record not found.');
  }

  const updated = await prisma.interviewNotification.update({
    where: { id: notification.id },
    data: {
      status: 'SENT',
      uncertainDelivery: false,
      sentAt: new Date(),
      smtpMessageId: smtpMessageId || notification.smtpMessageId || `manual-confirmed-${Date.now()}`,
      errorDetails: 'Manually verified and confirmed delivered by administrator.',
    },
  });

  return updated;
}

/**
 * Manually confirms an UNCERTAIN notification as NOT delivered and re-queues it as FAILED for retry.
 */
export async function confirmUncertainNotificationAsFailed(madrasaId, notificationId) {
  const notification = await prisma.interviewNotification.findFirst({
    where: { id: notificationId, madrasaId },
  });

  if (!notification) {
    throw new NotFoundError('Interview notification record not found.');
  }

  const updated = await prisma.interviewNotification.update({
    where: { id: notification.id },
    data: {
      status: 'FAILED',
      uncertainDelivery: false,
      errorDetails: 'Administrator confirmed email was not received; ready for retry.',
    },
  });

  return updated;
}
