import { escapeHtml } from './email.service.js';
import { dispatchEmail } from './email.service.js';

/**
 * Builds a professional, mobile-responsive, email-client-compatible HTML email
 * and plain-text alternative for Madrasa admission events.
 *
 * Designed specifically for AL/MAHMOODHIYYA ARABIC COLLAGE and multi-tenant MadrasaNexa institutions.
 *
 * @param {Object} options
 * @param {'SUBMITTED'|'APPROVED'|'REJECTED'|'CONVERTED'|string} options.subType
 * @param {string} options.madrasaName - Official Institution Name
 * @param {string} [options.logoUrl] - Publicly accessible URL for the institution logo
 * @param {string} [options.recipientName] - Parent/Guardian Name
 * @param {string} options.applicantName - Student/Applicant Full Name
 * @param {string} options.applicationNo - Official Application Reference (e.g. APP-2026-12345)
 * @param {string} [options.admissionNo] - Official Enrolled Admission Number (only if converted)
 * @param {string} [options.intakeName] - Intake Period Name
 * @param {number|string} [options.academicYear] - Academic Year
 * @param {string} [options.className] - Requested or Assigned Class
 * @param {string} [options.status] - Raw status string
 * @param {string} [options.decisionText] - Decision description text
 * @param {string} [options.remarks] - Review remarks from administrator
 * @param {Date|string} [options.submittedAt] - Submission date timestamp
 * @param {string} [options.contactPhone] - Official Madrasa phone
 * @param {string} [options.contactEmail] - Official Madrasa email
 * @param {string} [options.address] - Official Madrasa physical address
 * @returns {{ subject: string, html: string, text: string }}
 */
export function buildAdmissionEmailTemplate({
  subType = 'SUBMITTED',
  madrasaName = 'AL/MAHMOODHIYYA ARABIC COLLAGE',
  logoUrl = null,
  recipientName = '',
  applicantName = '',
  applicationNo = '',
  admissionNo = null,
  intakeName = '',
  academicYear = '',
  className = '',
  status = '',
  decisionText = '',
  remarks = '',
  submittedAt = null,
  contactPhone = '',
  contactEmail = '',
  address = '',
}) {
  const currentYear = new Date().getFullYear();
  const safeMadrasaName = escapeHtml(madrasaName || 'AL/MAHMOODHIYYA ARABIC COLLAGE');
  const safeRecipientName = escapeHtml(recipientName || 'Parent / Guardian');
  const safeApplicantName = escapeHtml(applicantName || 'Applicant');
  const safeApplicationNo = escapeHtml(applicationNo || 'N/A');
  const safeAdmissionNo = admissionNo ? escapeHtml(String(admissionNo)) : null;
  const safeIntakeName = intakeName ? escapeHtml(String(intakeName)) : '';
  const safeAcademicYear = academicYear ? escapeHtml(String(academicYear)) : '';
  const safeClassName = className ? escapeHtml(String(className)) : '';
  const safeRemarks = remarks ? escapeHtml(String(remarks)) : '';
  const safePhone = contactPhone ? escapeHtml(String(contactPhone)) : '';
  const safeEmail = contactEmail ? escapeHtml(String(contactEmail)) : '';
  const safeAddress = address ? escapeHtml(String(address)) : '';

  // Generate fallback initials for branding if logo image is unavailable
  const words = (madrasaName || 'AM')
    .split(/[\s\/-]+/)
    .filter(Boolean);
  const initials = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : (words[0] ? words[0].slice(0, 2).toUpperCase() : 'AM');

  // Normalize subType
  const normalizedType = String(subType || '').toUpperCase();
  const isApproved = normalizedType === 'APPROVED';
  const isConverted = normalizedType === 'CONVERTED';
  const isRejected = normalizedType === 'REJECTED';
  const isSubmitted = normalizedType === 'SUBMITTED' || (!isApproved && !isConverted && !isRejected);

  // Subject and Event Titles
  let emailTitle = 'Admission Status Update';
  let badgeText = 'Status Update';
  let badgeBg = '#f1f5f9';
  let badgeColor = '#334155';
  let badgeBorder = '#cbd5e1';
  let heroMessageHtml = '';
  let nextStepsText = '';
  let plainTextAction = '';

  if (isSubmitted) {
    emailTitle = 'Application Received';
    badgeText = 'Under Review';
    badgeBg = '#ecfdf5';
    badgeColor = '#065f46';
    badgeBorder = '#a7f3d0';
    heroMessageHtml = `Thank you for submitting an online admission application for <strong>${safeApplicantName}</strong>. Your application has been registered into our admissions system and is currently awaiting review by the admissions committee.`;
    nextStepsText = 'Our admissions desk reviews incoming applications in order of submission. All updates, baseline readiness assessments, and decisions will be sent strictly to this email address. Please retain your reference number for all future correspondence.';
    plainTextAction = 'Your application has been received and registered. Our admissions desk will review your details.';
  } else if (isApproved) {
    emailTitle = 'Admission Approved';
    badgeText = 'Approved';
    badgeBg = '#ecfdf5';
    badgeColor = '#065f46';
    badgeBorder = '#a7f3d0';
    heroMessageHtml = `<span style="font-size: 16px; font-weight: 700; color: #047857; display: block; margin-bottom: 6px;">Congratulations!</span> The admission application for <strong>${safeApplicantName}</strong> has been formally <strong>approved</strong> by the admissions administration.`;
    nextStepsText = 'The administration is finalizing enrollment allocations. Please watch your email for official student enrollment confirmation and onboarding guidance.';
    plainTextAction = 'Congratulations! The admission application has been approved.';
  } else if (isConverted) {
    emailTitle = 'Enrollment Confirmed';
    badgeText = 'Officially Enrolled';
    badgeBg = '#ecfdf5';
    badgeColor = '#065f46';
    badgeBorder = '#a7f3d0';
    heroMessageHtml = `<span style="font-size: 16px; font-weight: 700; color: #047857; display: block; margin-bottom: 6px;">Congratulations!</span> <strong>${safeApplicantName}</strong> has been officially accepted and enrolled as a student at <strong>${safeMadrasaName}</strong>.`;
    nextStepsText = 'Official student records have been created. Please contact our administrative office regarding student onboarding, orientation, and class schedule details.';
    plainTextAction = `Congratulations! ${applicantName} has been officially enrolled at ${madrasaName}.`;
  } else if (isRejected) {
    emailTitle = 'Admission Status Update';
    badgeText = 'Application Not Accepted';
    badgeBg = '#fef2f2';
    badgeColor = '#991b1b';
    badgeBorder = '#fecaca';
    heroMessageHtml = `We have completed the formal review of the admission application for <strong>${safeApplicantName}</strong>.<br><br><strong>Decision:</strong> ${escapeHtml(decisionText || 'We regret to inform you that we are unable to offer admission for this intake cycle.')}`;
    nextStepsText = 'If you have any questions or require additional clarification regarding this review decision, please contact our admissions office directly.';
    plainTextAction = `Review decision: ${decisionText || 'Application Not Accepted'}.`;
  }

  // Format submission date if provided
  let formattedDate = '';
  if (submittedAt) {
    try {
      const d = new Date(submittedAt);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }
    } catch (_) {
      formattedDate = '';
    }
  }

  // Build subject line
  let subject = '';
  if (isSubmitted) {
    subject = `Admission Application Received - ${applicationNo} - ${madrasaName}`;
  } else if (isApproved) {
    subject = `Admission Approved: ${applicantName} (${applicationNo}) - ${madrasaName}`;
  } else if (isConverted) {
    subject = `Enrollment Confirmed: ${applicantName} - ${madrasaName}`;
  } else {
    subject = `Application Status Update: ${applicantName} (${applicationNo}) - ${madrasaName}`;
  }

  // Structured Information Rows (strictly omitting missing values)
  const detailRowsHtml = [];
  const detailRowsText = [];

  detailRowsHtml.push(`
    <tr>
      <td style="padding: 9px 12px; font-size: 13px; color: #64748b; font-weight: 500; border-bottom: 1px solid #f1f5f9; width: 40%;">Applicant Name</td>
      <td style="padding: 9px 12px; font-size: 13px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #f1f5f9; text-align: right;">${safeApplicantName}</td>
    </tr>
  `);
  detailRowsText.push(`- Applicant Name: ${applicantName}`);

  if (safeAdmissionNo) {
    detailRowsHtml.push(`
      <tr>
        <td style="padding: 9px 10px; font-size: 13px; color: #047857; font-weight: 600; border-bottom: 1px solid #f1f5f9; vertical-align: top; width: 42%;">Official Admission No.</td>
        <td style="padding: 9px 10px; font-size: 13px; color: #047857; font-weight: 800; font-family: 'Courier New', monospace; border-bottom: 1px solid #f1f5f9; text-align: right; vertical-align: top; word-break: break-word;">${safeAdmissionNo}</td>
      </tr>
    `);
    detailRowsText.push(`- Official Admission Number: ${admissionNo}`);
  }

  detailRowsHtml.push(`
    <tr>
      <td style="padding: 9px 10px; font-size: 13px; color: #64748b; font-weight: 500; border-bottom: 1px solid #f1f5f9; vertical-align: top; width: 42%;">Application Reference</td>
      <td style="padding: 9px 10px; font-size: 13px; color: #064e3b; font-weight: 700; font-family: 'Courier New', monospace; border-bottom: 1px solid #f1f5f9; text-align: right; vertical-align: top; word-break: break-word;">${safeApplicationNo}</td>
    </tr>
  `);
  detailRowsText.push(`- Application Reference: ${applicationNo}`);

  if (safeClassName) {
    detailRowsHtml.push(`
      <tr>
        <td style="padding: 9px 10px; font-size: 13px; color: #64748b; font-weight: 500; border-bottom: 1px solid #f1f5f9; vertical-align: top; width: 42%;">Class / Level</td>
        <td style="padding: 9px 10px; font-size: 13px; color: #0f172a; font-weight: 600; border-bottom: 1px solid #f1f5f9; text-align: right; vertical-align: top; word-break: break-word;">${safeClassName}</td>
      </tr>
    `);
    detailRowsText.push(`- Class: ${className}`);
  }

  if (safeIntakeName || safeAcademicYear) {
    const intakeLabel = safeIntakeName && safeAcademicYear
      ? `${safeIntakeName} (${safeAcademicYear})`
      : safeIntakeName || safeAcademicYear;
    detailRowsHtml.push(`
      <tr>
        <td style="padding: 9px 10px; font-size: 13px; color: #64748b; font-weight: 500; border-bottom: 1px solid #f1f5f9; vertical-align: top; width: 42%;">Intake Cycle</td>
        <td style="padding: 9px 10px; font-size: 13px; color: #0f172a; font-weight: 600; border-bottom: 1px solid #f1f5f9; text-align: right; vertical-align: top; word-break: break-word;">${intakeLabel}</td>
      </tr>
    `);
    detailRowsText.push(`- Intake Cycle: ${intakeLabel}`);
  }

  if (formattedDate) {
    detailRowsHtml.push(`
      <tr>
        <td style="padding: 9px 10px; font-size: 13px; color: #64748b; font-weight: 500; border-bottom: 1px solid #f1f5f9; vertical-align: top; width: 42%;">Submission Date</td>
        <td style="padding: 9px 10px; font-size: 13px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #f1f5f9; text-align: right; vertical-align: top; word-break: break-word;">${escapeHtml(formattedDate)}</td>
      </tr>
    `);
    detailRowsText.push(`- Submission Date: ${formattedDate}`);
  }

  if (safeRemarks) {
    detailRowsHtml.push(`
      <tr>
        <td style="padding: 9px 10px; font-size: 13px; color: #64748b; font-weight: 500; border-bottom: 1px solid #f1f5f9; vertical-align: top; width: 42%;">Review Remarks</td>
        <td style="padding: 9px 10px; font-size: 13px; color: #334155; font-style: italic; border-bottom: 1px solid #f1f5f9; text-align: right; vertical-align: top; word-break: break-word;">${safeRemarks}</td>
      </tr>
    `);
    detailRowsText.push(`- Review Remarks: ${remarks}`);
  }

  detailRowsHtml.push(`
    <tr>
      <td style="padding: 9px 12px; font-size: 13px; color: #64748b; font-weight: 500;">Application Status</td>
      <td style="padding: 9px 12px; font-size: 12px; font-weight: 700; text-align: right;">
        <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">${escapeHtml(badgeText)}</span>
      </td>
    </tr>
  `);
  detailRowsText.push(`- Status: ${badgeText}`);

  // Logo Markup: Real Image or Initials Monogram
  const logoMarkup = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${safeMadrasaName}" width="60" height="60" style="display: inline-block; width: 60px; height: 60px; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; padding: 2px; background-color: #ffffff;" />`
    : `<div style="display: inline-block; width: 54px; height: 54px; line-height: 54px; border-radius: 12px; background-color: #047857; color: #ffffff; font-size: 19px; font-weight: bold; text-align: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">${initials}</div>`;

  // Contact Details in Footer
  const contactPartsHtml = [];
  const contactPartsText = [];
  if (safePhone) {
    contactPartsHtml.push(`<span>Phone: <strong>${safePhone}</strong></span>`);
    contactPartsText.push(`Phone: ${contactPhone}`);
  }
  if (safeEmail) {
    contactPartsHtml.push(`<span>Email: <a href="mailto:${safeEmail}" style="color: #047857; text-decoration: none; font-weight: 600;">${safeEmail}</a></span>`);
    contactPartsText.push(`Email: ${contactEmail}`);
  }
  if (safeAddress) {
    contactPartsHtml.push(`<span>Address: ${safeAddress}</span>`);
    contactPartsText.push(`Address: ${address}`);
  }

  const contactHtmlSnippet = contactPartsHtml.length > 0
    ? `<div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6;">${contactPartsHtml.join(' &nbsp;•&nbsp; ')}</div>`
    : '';

  // Clean Plain-Text Version
  const text = `
============================================================
${madrasaName.toUpperCase()}
ONLINE ADMISSION DESK
${emailTitle.toUpperCase()}
============================================================

Dear ${recipientName || 'Parent / Guardian'},

${plainTextAction}

APPLICATION DETAILS:
${detailRowsText.join('\n')}

APPLICATION REFERENCE NUMBER:
[ ${applicationNo} ]
Please retain this reference number for all future inquiries.

NEXT STEPS:
${nextStepsText}

COMMUNICATION NOTICE:
All admission updates and official selection decisions are communicated strictly via email. Please check your inbox and spam folder regularly.

${contactPartsText.length > 0 ? `CONTACT US:\n${contactPartsText.join('\n')}\n` : ''}
---
© ${currentYear} ${madrasaName}. All rights reserved.
Official Electronic Communication • MadrasaNexa Online Admissions System
`.trim();

  // Premium, Responsive, Email-Client-Safe HTML Email
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">

          <!-- Institutional Header -->
          <tr>
            <td style="padding: 28px 28px 20px 28px; text-align: center; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    ${logoMarkup}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 12px;">
                    <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.01em; line-height: 1.3;">
                      ${safeMadrasaName}
                    </h1>
                    <div style="margin-top: 4px; font-size: 11px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 0.06em;">
                      Online Admissions Desk
                    </div>
                  </td>
                </tr>
              </table>
              <!-- Subtle Islamic Green Accent Bar -->
              <div style="height: 3px; background: linear-gradient(90deg, #047857 0%, #10b981 50%, #047857 100%); margin: 16px auto 0 auto; border-radius: 2px; max-width: 120px;"></div>
            </td>
          </tr>

          <!-- Title & Greeting -->
          <tr>
            <td style="padding: 24px 28px 12px 28px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display: inline-block; padding: 3px 10px; border-radius: 9999px; background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px;">
                      ${emailTitle}
                    </div>
                    <p style="margin: 0 0 14px 0; font-size: 15px; color: #1e293b; line-height: 1.5;">
                      Dear <strong>${safeRecipientName}</strong>,
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.6;">
                      ${heroMessageHtml}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Prominent Reference Number Card -->
          <tr>
            <td style="padding: 12px 28px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border: 1.5px dashed #86efac; border-radius: 12px; text-align: center;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <div style="font-size: 11px; font-weight: 700; color: #065f46; text-transform: uppercase; letter-spacing: 0.06em;">
                      Application Reference Number
                    </div>
                    <div style="font-size: 22px; font-weight: 900; font-family: 'Courier New', Courier, monospace; color: #064e3b; letter-spacing: 0.06em; margin: 6px 0; word-break: break-all;">
                      ${safeApplicationNo}
                    </div>
                    ${safeAdmissionNo ? `
                      <div style="margin-top: 4px; font-size: 13px; font-weight: 700; color: #047857;">
                        Official Admission Number: <span style="font-family: monospace; font-size: 15px; letter-spacing: 0.04em;">${safeAdmissionNo}</span>
                      </div>
                    ` : ''}
                    <p style="margin: 6px 0 0 0; font-size: 11px; color: #475569; line-height: 1.4;">
                      Please retain this reference number for all status inquiries and institutional correspondence.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Details Card -->
          <tr>
            <td style="padding: 12px 28px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 12px 16px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">
                      Application & Enrollment Details
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 6px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      ${detailRowsHtml.join('')}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Next Steps & Strict Email Policy Callout -->
          <tr>
            <td style="padding: 12px 28px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #047857; border-radius: 8px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
                      Next Steps & Instructions
                    </div>
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #475569; line-height: 1.5;">
                      ${nextStepsText}
                    </p>
                    <div style="font-size: 11px; color: #047857; font-weight: 600; line-height: 1.4;">
                      All admission updates and official decisions are communicated strictly via email. Please check your inbox and spam folder regularly.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Institutional Contact Info -->
          <tr>
            <td style="padding: 12px 28px 24px 28px;">
              ${contactHtmlSnippet}
            </td>
          </tr>

          <!-- Official Footer -->
          <tr>
            <td style="padding: 20px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.5;">
                © ${currentYear} <strong>${safeMadrasaName}</strong>. All rights reserved.
              </p>
              <p style="margin: 4px 0 0 0; font-size: 10px; color: #94a3b8; font-family: monospace;">
                Official Electronic Communication • MadrasaNexa Online Admissions Desk
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * Dispatches a formatted admission notification email through the existing email service.
 */
export async function sendAdmissionNotificationEmail({
  madrasaId,
  to,
  subject,
  html,
  text,
}) {
  return dispatchEmail({
    madrasaId,
    to,
    subject,
    html,
    text,
  });
}
