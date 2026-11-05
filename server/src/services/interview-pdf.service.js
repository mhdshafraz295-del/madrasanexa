import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { prisma } from '../lib/prisma.js';
import {
  uploadBufferToR2,
  getObjectBufferFromR2,
  deleteObjectFromR2,
  resolveObjectAccessUrl,
} from './r2.service.js';
import { resolveLogoDataUri, generateInitials } from './branding.service.js';
import { renderRawHtmlToPdf, embeddedFontsCss, escapeHtml } from './pdf-report.service.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = 'Asia/Colombo';

/**
 * Formats a 24h time string (HH:mm) into a 12h AM/PM string.
 */
export function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return timeStr;
  const period = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Formats a Date object or YYYY-MM-DD string in Asia/Colombo.
 */
export function formatColomboDate(dateVal, format = 'dddd, MMMM D, YYYY') {
  if (!dateVal) return '';
  return dayjs(dateVal).tz(TIMEZONE).format(format);
}

/**
 * Builds the HTML template for the official Admissions Interview Invitation Letter.
 */
export function buildInterviewInvitationHtml({
  madrasa,
  appointment,
  application,
  schedule,
  logoDataUri,
}) {
  const madrasaName = escapeHtml(madrasa.name || 'Madrasa Institution');
  const madrasaCode = escapeHtml(madrasa.code || '');
  const madrasaPhone = escapeHtml(madrasa.phone || '');
  const madrasaEmail = escapeHtml(madrasa.email || '');
  const madrasaAddress = escapeHtml(madrasa.address || '');

  const applicantName = escapeHtml(application.applicantName || 'Applicant');
  const applicationNo = escapeHtml(application.applicationNo || 'N/A');
  const guardianName = escapeHtml(application.guardianName || 'Guardian');
  const guardianRelation = escapeHtml(application.guardianRelationship || 'Guardian');
  const guardianPhone = escapeHtml(application.guardianPhone || '');
  const appliedClassName = escapeHtml(application.appliedClass?.name || 'General Intake');

  const refNo = escapeHtml(appointment.invitationReference);
  const roundLabel = appointment.interviewRound === 'SECOND' ? 'Second Round Interview' : 'First Round Interview';
  const roundBadgeColor = appointment.interviewRound === 'SECOND' ? '#7C3AED' : '#047857';
  const roundBadgeBg = appointment.interviewRound === 'SECOND' ? '#F5F3FF' : '#ECFDF5';

  const interviewDateFormatted = formatColomboDate(appointment.interviewDate);
  const timeFormatted = `${formatTime12h(appointment.startTime)} – ${formatTime12h(appointment.endTime)}`;
  const venue = escapeHtml(appointment.venue || schedule?.venue || 'Main Administrative Office');

  const initials = generateInitials(madrasa.name);
  const instructions = escapeHtml(schedule?.instructions || appointment.rescheduleReason || '');

  // Parse required documents list
  let requiredDocs = [];
  if (schedule?.requiredDocuments) {
    if (Array.isArray(schedule.requiredDocuments)) {
      requiredDocs = schedule.requiredDocuments;
    } else if (typeof schedule.requiredDocuments === 'string') {
      try {
        const parsed = JSON.parse(schedule.requiredDocuments);
        if (Array.isArray(parsed)) requiredDocs = parsed;
      } catch (e) {
        requiredDocs = [schedule.requiredDocuments];
      }
    }
  }

  if (requiredDocs.length === 0) {
    requiredDocs = [
      'Original Birth Certificate of the Applicant (plus 1 photocopy)',
      'Previous School Progress Reports / Leaving Certificate (if applicable)',
      'National Identity Card (NIC) copy of Parent / Guardian',
      'Two (2) recent passport-sized color photographs',
    ];
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Admissions Interview Invitation - ${refNo}</title>
  <style>
    ${embeddedFontsCss}

    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Noto Sans Local', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1E293B;
      background: #FFFFFF;
      padding: 0;
    }

    .container {
      width: 100%;
      margin: 0 auto;
    }

    /* Header */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }

    .header-logo-cell {
      width: 75px;
      vertical-align: top;
      padding-right: 12px;
    }

    .header-logo-img {
      width: 65px;
      height: 65px;
      object-fit: contain;
      border-radius: 6px;
    }

    .header-logo-placeholder {
      width: 65px;
      height: 65px;
      background: #064E3B;
      color: #FFFFFF;
      font-weight: 700;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      text-align: center;
      line-height: 65px;
    }

    .header-text-cell {
      vertical-align: top;
    }

    .header-title {
      font-size: 16pt;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: 0.2px;
      margin-bottom: 2px;
    }

    .header-subtitle {
      font-size: 9pt;
      color: #475569;
      line-height: 1.35;
    }

    .header-meta-cell {
      width: 180px;
      vertical-align: top;
      text-align: right;
      font-size: 8.5pt;
      color: #475569;
    }

    .ref-badge {
      display: inline-block;
      padding: 3px 8px;
      font-family: monospace;
      font-size: 9.5pt;
      font-weight: 700;
      color: #0F172A;
      background: #F1F5F9;
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      margin-top: 4px;
    }

    /* Document Title Banner */
    .title-banner {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-left: 5px solid #047857;
      padding: 10px 14px;
      margin-bottom: 16px;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .title-banner-main {
      font-size: 12pt;
      font-weight: 700;
      color: #0F172A;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .title-banner-round {
      display: inline-block;
      padding: 2px 10px;
      font-size: 8.5pt;
      font-weight: 700;
      color: ${roundBadgeColor};
      background: ${roundBadgeBg};
      border: 1px solid ${roundBadgeColor}33;
      border-radius: 12px;
      text-transform: uppercase;
    }

    /* Recipient & Schedule Details */
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }

    .grid-table td {
      vertical-align: top;
      padding: 6px 10px;
      border: 1px solid #E2E8F0;
    }

    .grid-label {
      width: 30%;
      font-size: 9pt;
      font-weight: 700;
      color: #475569;
      background: #F8FAFC;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .grid-value {
      font-size: 10pt;
      color: #0F172A;
      font-weight: 500;
    }

    .highlight-box {
      background: #F0FDF4;
      border: 1.5px solid #86EFAC;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }

    .highlight-box-title {
      font-size: 10pt;
      font-weight: 800;
      color: #166534;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 8px;
    }

    .highlight-grid {
      width: 100%;
      border-collapse: collapse;
    }

    .highlight-grid td {
      padding: 4px 6px;
      vertical-align: top;
    }

    .hl-label {
      width: 25%;
      font-size: 9pt;
      font-weight: 700;
      color: #166534;
    }

    .hl-value {
      font-size: 11pt;
      font-weight: 700;
      color: #0F172A;
    }

    /* Section Headings */
    .section-title {
      font-size: 10.5pt;
      font-weight: 800;
      color: #0F172A;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border-bottom: 1px solid #CBD5E1;
      padding-bottom: 4px;
      margin-top: 14px;
      margin-bottom: 8px;
    }

    /* Checklist */
    .checklist {
      margin-left: 0;
      padding-left: 0;
      list-style-type: none;
      margin-bottom: 14px;
    }

    .checklist-item {
      font-size: 9.5pt;
      color: #1E293B;
      padding: 3px 0;
      display: flex;
      align-items: flex-start;
    }

    .check-box-icon {
      display: inline-block;
      width: 13px;
      height: 13px;
      border: 1.5px solid #047857;
      border-radius: 2px;
      margin-right: 8px;
      margin-top: 2px;
      flex-shrink: 0;
    }

    /* Instructions */
    .instructions-p {
      font-size: 9.5pt;
      color: #334155;
      line-height: 1.45;
      margin-bottom: 8px;
    }

    /* Sign-off */
    .signature-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 26px;
    }

    .signature-cell {
      width: 50%;
      vertical-align: top;
    }

    .sig-line {
      width: 200px;
      border-top: 1px solid #0F172A;
      margin-top: 40px;
      margin-bottom: 4px;
    }

    .sig-label {
      font-size: 8.5pt;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
    }

    .sig-title {
      font-size: 8pt;
      color: #64748B;
    }

    /* Footer Note */
    .footer-note {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px dashed #CBD5E1;
      font-size: 7.5pt;
      color: #64748B;
      text-align: center;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header Table -->
    <table class="header-table">
      <tr>
        <td class="header-logo-cell">
          ${
            logoDataUri
              ? `<img src="${logoDataUri}" alt="${madrasaName}" class="header-logo-img" />`
              : `<div class="header-logo-placeholder">${initials}</div>`
          }
        </td>
        <td class="header-text-cell">
          <div class="header-title">${madrasaName}</div>
          <div class="header-subtitle">
            ${madrasaAddress ? `${madrasaAddress}<br>` : ''}
            ${madrasaPhone ? `Tel: ${madrasaPhone}` : ''}
            ${madrasaPhone && madrasaEmail ? ' &bull; ' : ''}
            ${madrasaEmail ? `Email: ${madrasaEmail}` : ''}
          </div>
        </td>
        <td class="header-meta-cell">
          <div><strong>Date:</strong> ${dayjs().tz(TIMEZONE).format('DD MMM YYYY')}</div>
          <div><strong>Round:</strong> ${roundLabel}</div>
          <div class="ref-badge">${refNo}</div>
        </td>
      </tr>
    </table>

    <!-- Document Title Banner -->
    <div class="title-banner">
      <span class="title-banner-main">Admissions Interview Call Letter</span>
      <span class="title-banner-round">${roundLabel}</span>
    </div>

    <!-- Applicant & Guardian Information -->
    <table class="grid-table">
      <tr>
        <td class="grid-label">Applicant Name</td>
        <td class="grid-value" style="font-weight: 700; font-size: 11pt; color: #0F172A;">${applicantName}</td>
      </tr>
      <tr>
        <td class="grid-label">Application Reference</td>
        <td class="grid-value"><code style="font-weight: 700;">${applicationNo}</code></td>
      </tr>
      <tr>
        <td class="grid-label">Parent / Guardian</td>
        <td class="grid-value">${guardianName} (${guardianRelation}) ${guardianPhone ? `&bull; ${guardianPhone}` : ''}</td>
      </tr>
      <tr>
        <td class="grid-label">Intake Class / Academic Year</td>
        <td class="grid-value">${appliedClassName} &bull; Academic Year ${application.admissionPeriod?.academicYear || dayjs().year()}</td>
      </tr>
    </table>

    <!-- Scheduled Appointment Highlight Box -->
    <div class="highlight-box">
      <div class="highlight-box-title">&bull; Confirmed Interview Schedule</div>
      <table class="highlight-grid">
        <tr>
          <td class="hl-label">Interview Date:</td>
          <td class="hl-value">${interviewDateFormatted}</td>
        </tr>
        <tr>
          <td class="hl-label">Allocated Time Slot:</td>
          <td class="hl-value" style="color: #065F46;">${timeFormatted} (${TIMEZONE})</td>
        </tr>
        <tr>
          <td class="hl-label">Interview Venue:</td>
          <td class="hl-value">${venue}</td>
        </tr>
      </table>
    </div>

    <!-- Required Documents Checklist -->
    <div class="section-title">Required Documents to Bring</div>
    <ul class="checklist">
      ${requiredDocs
        .map(
          (doc) => `
        <li class="checklist-item">
          <span class="check-box-icon"></span>
          <span>${escapeHtml(doc)}</span>
        </li>
      `
        )
        .join('')}
    </ul>

    <!-- Important Instructions -->
    <div class="section-title">Important Candidate Instructions</div>
    <p class="instructions-p">
      1. <strong>Arrival Time:</strong> The applicant and parent/guardian must report to the admissions reception at least <strong>15 minutes prior</strong> to the scheduled time slot.
    </p>
    <p class="instructions-p">
      2. <strong>Dress Code:</strong> Applicants are required to attend in proper Islamic attire suitable for a formal academic interview.
    </p>
    <p class="instructions-p">
      3. <strong>Parent / Guardian Accompaniment:</strong> At least one parent or registered guardian must accompany the applicant throughout the interview session.
    </p>
    ${
      instructions
        ? `
      <p class="instructions-p">
        4. <strong>Special Instructions from Admissions Office:</strong> ${instructions}
      </p>
    `
        : ''
    }

    <!-- Sign-off Block -->
    <table class="signature-table">
      <tr>
        <td class="signature-cell">
          <div class="sig-line"></div>
          <div class="sig-label">Authorized Admissions Officer</div>
          <div class="sig-title">${madrasaName}</div>
        </td>
        <td class="signature-cell" style="text-align: right;">
          <div class="sig-line" style="margin-left: auto;"></div>
          <div class="sig-label">Official Institutional Stamp</div>
          <div class="sig-title">Office of Admissions</div>
        </td>
      </tr>
    </table>

    <!-- Footer Security Notice -->
    <div class="footer-note">
      This is an official computer-generated document issued by the MadrasaNexa Multi-Tenant SaaS platform on behalf of ${madrasaName}.<br>
      Reference No: <strong>${refNo}</strong> &bull; Generated: ${dayjs().tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss')} (${TIMEZONE}) &bull; Verification available via Admissions Office.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates an A4 PDF buffer for an InterviewAppointment, uploads to R2,
 * creates/updates the FileObject record, and links to the appointment.
 *
 * Includes compensatory rollback on R2 if the database update fails.
 *
 * @param {string} madrasaId
 * @param {string} appointmentId
 * @returns {Promise<{ buffer: Buffer, fileObjectId: string, objectKey: string }>}
 */
export async function generateAndStoreInterviewInvitationPdf(madrasaId, appointmentId) {
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

  // Resolve base64 logo
  let logoDataUri = null;
  try {
    logoDataUri = await resolveLogoDataUri(madrasaId);
  } catch (err) {
    console.warn(`[interview-pdf.service] Could not resolve logo for madrasa ${madrasaId}:`, err.message);
  }

  // Build HTML
  const html = buildInterviewInvitationHtml({
    madrasa,
    appointment,
    application: appointment.application,
    schedule: appointment.schedule,
    logoDataUri,
  });

  // Render to PDF buffer
  const pdfBuffer = await renderRawHtmlToPdf({ html, landscape: false });

  // Target object key
  const objectKey = `madrasas/${madrasaId}/documents/interview-invitations/${appointment.invitationReference}.pdf`;
  const originalName = `Interview_Invitation_${appointment.invitationReference}.pdf`;

  // Upload to Cloudflare R2
  await uploadBufferToR2(objectKey, pdfBuffer, 'application/pdf');

  // Register in database with compensatory cleanup if DB fails
  let fileObjectId = null;
  try {
    const fileObject = await prisma.$transaction(async (tx) => {
      // Upsert FileObject
      const fileObj = await tx.fileObject.upsert({
        where: { objectKey },
        create: {
          madrasaId,
          type: 'STUDENT_DOCUMENT',
          objectKey,
          originalName,
          mimeType: 'application/pdf',
          size: pdfBuffer.length,
        },
        update: {
          size: pdfBuffer.length,
          originalName,
        },
      });

      // Link to appointment
      await tx.interviewAppointment.update({
        where: { id: appointment.id },
        data: {
          fileObjectId: fileObj.id,
        },
      });

      return fileObj;
    });

    fileObjectId = fileObject.id;
  } catch (dbErr) {
    // Compensatory catch: cleanup uploaded R2 object if DB write fails
    console.error(`[interview-pdf.service] DB commit failed for ${objectKey}, rolling back R2 upload:`, dbErr.message);
    try {
      await deleteObjectFromR2(objectKey);
    } catch (cleanupErr) {
      console.warn(`[interview-pdf.service] Failed compensatory R2 cleanup for ${objectKey}:`, cleanupErr.message);
    }
    throw dbErr;
  }

  return {
    buffer: pdfBuffer,
    fileObjectId,
    objectKey,
  };
}

/**
 * Retrieves the PDF buffer for an appointment, generating and caching it if not already present.
 *
 * @param {string} madrasaId
 * @param {string} appointmentId
 * @returns {Promise<Buffer>}
 */
export async function getInterviewInvitationPdfBuffer(madrasaId, appointmentId) {
  const appointment = await prisma.interviewAppointment.findFirst({
    where: { id: appointmentId, madrasaId },
    select: {
      id: true,
      fileObjectId: true,
      fileObject: {
        select: {
          id: true,
          objectKey: true,
        },
      },
    },
  });

  if (!appointment) {
    throw new NotFoundError('Interview appointment not found.');
  }

  if (appointment.fileObject?.objectKey) {
    try {
      const buffer = await getObjectBufferFromR2(appointment.fileObject.objectKey);
      if (buffer && buffer.length > 0) {
        return buffer;
      }
    } catch (r2Err) {
      console.warn(`[interview-pdf.service] R2 retrieval failed for ${appointment.fileObject.objectKey}, regenerating:`, r2Err.message);
    }
  }

  // Generate, store, and return buffer
  const result = await generateAndStoreInterviewInvitationPdf(madrasaId, appointmentId);
  return result.buffer;
}

/**
 * Resolves a secure presigned download URL for the interview invitation PDF.
 *
 * @param {string} madrasaId
 * @param {string} appointmentId
 * @returns {Promise<{ downloadUrl: string, filename: string }>}
 */
export async function resolveInterviewInvitationPdfUrl(madrasaId, appointmentId) {
  const appointment = await prisma.interviewAppointment.findFirst({
    where: { id: appointmentId, madrasaId },
    select: {
      id: true,
      invitationReference: true,
      fileObjectId: true,
      fileObject: {
        select: {
          id: true,
          objectKey: true,
          originalName: true,
        },
      },
    },
  });

  if (!appointment) {
    throw new NotFoundError('Interview appointment not found.');
  }

  let objectKey = appointment.fileObject?.objectKey;
  let filename = appointment.fileObject?.originalName || `Interview_Invitation_${appointment.invitationReference}.pdf`;

  if (!objectKey) {
    const generated = await generateAndStoreInterviewInvitationPdf(madrasaId, appointmentId);
    objectKey = generated.objectKey;
  }

  const downloadUrl = await resolveObjectAccessUrl(objectKey, 3600);
  return {
    downloadUrl,
    filename,
  };
}
