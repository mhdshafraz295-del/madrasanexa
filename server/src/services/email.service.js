import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { resolveEmailSenderForMadrasa } from './email-sender-resolver.service.js';

/**
 * Escapes HTML characters in user-controlled strings to prevent HTML/script injection in email templates.
 *
 * @param {string} str
 * @returns {string} Sanitized string
 */
export function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Normalizes the application login URL from the FRONTEND_URL environment variable.
 * Safely removes trailing slashes to prevent double-slashes (e.g., https://app.example.com//login).
 *
 * @returns {string} Normalized login URL
 */
export function getLoginUrl() {
  const base = (env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');
  return `${base}/login`;
}

/**
 * Constructs the secure one-time password setup URL from the FRONTEND_URL environment variable.
 *
 * @param {string} token Cryptographic setup token
 * @returns {string} Fully qualified setup URL
 */
export function getSetupPasswordUrl(token) {
  const base = (env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');
  return `${base}/setup-password?token=${encodeURIComponent(token)}`;
}

/**
 * In-memory test mailbox for automated test assertions.
 */
let testEmails = [];
let customTestAdapter = null;
let testModeEnabled = false;
let providerTransportOverride = null;

export function enableTestMode(enabled = true) {
  testModeEnabled = enabled;
}

export function getTestEmails() {
  return [...testEmails];
}

export function clearTestEmails() {
  testEmails = [];
  customTestAdapter = null;
  providerTransportOverride = null;
}

export function setTestEmailAdapter(adapter) {
  customTestAdapter = adapter;
}

export function setProviderTransport(transport) {
  providerTransportOverride = transport;
}

/**
 * Checks if the email provider or test mock is configured.
 */
export function isEmailConfigured() {
  if (testModeEnabled || Boolean(customTestAdapter)) return true;
  const isTest =
    (process.env.NODE_ENV !== undefined ? process.env.NODE_ENV === 'test' : env.NODE_ENV === 'test') ||
    (process.env.EMAIL_PROVIDER !== undefined ? process.env.EMAIL_PROVIDER === 'test' : env.EMAIL_PROVIDER === 'test');
  if (isTest) return true;
  return Boolean(env.SMTP_HOST && env.EMAIL_FROM);
}

/**
 * Safety helper: Detects test domains (RFC 2606) or test fixture email patterns.
 */
export function isTestRecipient(email) {
  if (!email || typeof email !== 'string') return false;
  const lower = email.toLowerCase().trim();
  return (
    lower.endsWith('@example.com') ||
    lower.endsWith('.example.com') ||
    lower.endsWith('@example.org') ||
    lower.endsWith('@example.net') ||
    lower.endsWith('.test') ||
    lower.endsWith('.example')
  );
}

/**
 * Core internal dispatcher with timeout protection, test adapter, and safe error sanitization.
 */
export async function dispatchEmail({ madrasaId, to, subject, html, text, attachments, customTransporter, from, replyTo }) {
  // 1. Check custom test adapter
  if (customTestAdapter) {
    try {
      const res = await customTestAdapter({ madrasaId, to, subject, html, text, attachments });
      return res;
    } catch (err) {
      return {
        success: false,
        status: 'FAILED',
        error: String(err.message || err).slice(0, 200),
      };
    }
  }

  // 2. Check test mode
  const isTest =
    testModeEnabled ||
    isTestRecipient(to) ||
    (process.env.NODE_ENV !== undefined ? process.env.NODE_ENV === 'test' : env.NODE_ENV === 'test') ||
    (process.env.EMAIL_PROVIDER !== undefined ? process.env.EMAIL_PROVIDER === 'test' : env.EMAIL_PROVIDER === 'test');

  if (isTest) {
    const messageId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    testEmails.push({
      madrasaId,
      to,
      subject,
      html,
      text,
      attachments,
      sentAt: new Date(),
      messageId,
    });
    return {
      success: true,
      status: 'SENT',
      messageId,
    };
  }

  // 3. Resolve tenant sender if madrasaId is supplied and no override is present
  let resolvedTransporter = customTransporter || providerTransportOverride;
  let resolvedFrom = from;
  let resolvedReplyTo = replyTo;

  if (madrasaId && !resolvedTransporter) {
    try {
      const sender = await resolveEmailSenderForMadrasa(madrasaId);
      if (sender.isCustom && sender.transporter) {
        resolvedTransporter = sender.transporter;
        resolvedFrom = sender.from;
        resolvedReplyTo = sender.replyTo;
      } else {
        if (!resolvedFrom) resolvedFrom = sender.from;
        if (!resolvedReplyTo) resolvedReplyTo = sender.replyTo;
      }
    } catch (err) {
      console.warn(`[email.service] Error resolving email sender for madrasa ${madrasaId}:`, err.message);
    }
  }

  // Fallback to platform settings
  if (!resolvedFrom) {
    resolvedFrom = env.EMAIL_FROM;
  }

  if (!resolvedTransporter) {
    if (!env.SMTP_HOST || !env.EMAIL_FROM) {
      return {
        success: false,
        status: 'NOT_CONFIGURED',
        error: 'Email provider not configured (missing SMTP_HOST or EMAIL_FROM in environment).',
      };
    }
    resolvedTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER && env.SMTP_PASS ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      } : undefined,
      connectionTimeout: 7000,
      greetingTimeout: 7000,
      socketTimeout: 9000,
    });
  }

  const mailOptions = {
    from: resolvedFrom,
    to,
    subject,
    text,
    html,
    ...(resolvedReplyTo ? { replyTo: resolvedReplyTo } : {}),
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
  };

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Email provider connection timed out.')), 10000)
    );

    const info = await Promise.race([
      resolvedTransporter.sendMail(mailOptions),
      timeoutPromise,
    ]);

    return {
      success: true,
      status: 'SENT',
      messageId: info?.messageId || `msg-${Date.now()}`,
    };
  } catch (err) {
    try {
      if (typeof resolvedTransporter.close === 'function') {
        resolvedTransporter.close();
      }
    } catch (_) {
      // Safe close ignore
    }
    const sanitizedError = err?.message?.includes('timed out')
      ? 'Email provider connection timed out.'
      : String(err.message || 'Unknown SMTP error').replace(/[\r\n\t]+/g, ' ').slice(0, 200);
    return {
      success: false,
      status: 'FAILED',
      error: sanitizedError,
    };
  }
}

/**
 * Builds dynamic approval email subject, HTML, and plain-text fallback.
 */
export function buildApprovalEmailTemplate({
  applicantName,
  madrasaName,
  planName,
  subscriptionStart = '',
  subscriptionEnd = '',
  adminEmail,
  loginUrl,
  temporaryPassword = null,
  setupUrl = null,
}) {
  const safeApplicant = escapeHtml(applicantName);
  const safeMadrasa = escapeHtml(madrasaName);
  const safePlan = escapeHtml(planName || 'Plan Selection Pending');
  const safeAdminEmail = escapeHtml(adminEmail);
  const safeLoginUrl = escapeHtml(loginUrl);
  const safeSetupUrl = setupUrl ? escapeHtml(setupUrl) : null;
  const safeStart = escapeHtml(subscriptionStart);
  const safeEnd = escapeHtml(subscriptionEnd);
  const safePassword = temporaryPassword ? escapeHtml(temporaryPassword) : null;

  const subject = `Your MadrasaNexa Registration Has Been Approved - ${madrasaName}`;

  const textLines = [
    `Assalamu Alaikum ${applicantName},`,
    '',
    `We are pleased to inform you that your registration for ${madrasaName} has been approved successfully.`,
    '',
    `Institution: ${madrasaName}`,
    `Selected Plan: ${planName || 'Pending Plan Selection'}`,
    subscriptionStart && subscriptionEnd ? `Subscription Term: ${subscriptionStart} – ${subscriptionEnd}` : '',
    `Administrator Login Email: ${adminEmail}`,
    temporaryPassword ? `Temporary Password: ${temporaryPassword}` : '',
    setupUrl ? `Password Setup Link: ${setupUrl}` : `Login Portal: ${loginUrl}`,
    '',
    setupUrl
      ? `IMPORTANT: Please use the single-use setup link above to configure your administrator password. This link will expire in 24 hours.`
      : temporaryPassword
      ? `IMPORTANT: For security purposes, you will be prompted to create a new, permanent password upon your first sign-in.`
      : `Your MadrasaNexa workspace is now provisioned. Please sign in with your administrator email.`,
    '',
    `Regards,`,
    `MadrasaNexa Platform Administration`,
  ];

  const text = textLines.filter(Boolean).join('\n');

  const actionUrl = safeSetupUrl || safeLoginUrl;
  const actionButtonText = safeSetupUrl ? 'Set Up Administrator Password' : 'Sign In to MadrasaNexa';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F7F6F1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; }
    .container { max-width: 580px; margin: 30px auto; background: #FFFFFF; border: 1px solid #E7E9EE; border-radius: 16px; overflow: hidden; }
    .header { background: #0F172A; padding: 28px 32px; text-align: left; }
    .header h1 { margin: 0; color: #FFFFFF; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .header .subtitle { color: #37C6A3; font-size: 12px; font-weight: 600; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .body { padding: 32px; font-size: 14px; line-height: 1.6; color: #334155; }
    .greeting { font-size: 16px; font-weight: 600; color: #0F172A; margin-bottom: 16px; }
    .info-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #E2E8F0; font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748B; font-weight: 500; }
    .info-value { color: #0F172A; font-weight: 600; text-align: right; }
    .password-card { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px 16px; margin: 16px 0; }
    .setup-card { background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 12px 16px; margin: 16px 0; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #0F172A; color: #FFFFFF !important; text-decoration: none; padding: 12px 28px; font-size: 13px; font-weight: 700; border-radius: 10px; }
    .footer { padding: 24px 32px; background: #F8FAFC; border-top: 1px solid #E7E9EE; font-size: 11px; color: #94A3B8; text-align: center; }
    @media only screen and (max-width: 520px) {
      .container { margin: 12px !important; border-radius: 12px !important; }
      .header { padding: 20px 18px !important; }
      .body { padding: 20px 18px !important; }
      .info-row { flex-direction: column !important; gap: 2px !important; }
      .info-value { text-align: left !important; word-break: break-word !important; }
      .btn { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .footer { padding: 18px !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MadrasaNexa</h1>
      <div class="subtitle">Platform Registration Approved</div>
    </div>
    <div class="body">
      <div class="greeting">Assalamu Alaikum ${safeApplicant},</div>
      <p>We are pleased to inform you that your registration application for <strong>${safeMadrasa}</strong> has been officially approved by the Platform Administrator.</p>
      <p>Your tenant workspace and administrator account have been provisioned.</p>

      <div class="info-card">
        <div class="info-row">
          <span class="info-label">Institution</span>
          <span class="info-value">${safeMadrasa}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Selected Plan</span>
          <span class="info-value">${safePlan}</span>
        </div>
        ${safeStart && safeEnd ? `
        <div class="info-row">
          <span class="info-label">Subscription Term</span>
          <span class="info-value">${safeStart} – ${safeEnd}</span>
        </div>
        ` : ''}
        <div class="info-row">
          <span class="info-label">Login Email</span>
          <span class="info-value">${safeAdminEmail}</span>
        </div>
        ${safePassword ? `
        <div class="info-row" style="background: #FEF3C7; padding: 8px; border-radius: 6px; margin-top: 6px;">
          <span class="info-label" style="color: #92400E; font-weight: 600;">Temporary Password</span>
          <span class="info-value" style="color: #92400E; font-family: monospace; font-size: 14px; font-weight: 700;">${safePassword}</span>
        </div>
        ` : ''}
      </div>

      ${safeSetupUrl ? `
      <div class="setup-card">
        <strong style="color: #065F46;">Password Setup Required:</strong>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #047857;">Please click the button below to set up your administrator password. This secure single-use link will expire in 24 hours.</p>
      </div>
      ` : ''}

      ${safePassword ? `
      <div class="password-card">
        <strong style="color: #B45309;">Mandatory Security Notice:</strong>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #92400E;">You will be prompted to set your permanent password upon your initial sign-in. Please choose your subscription plan to unlock your full dashboard.</p>
      </div>
      ` : ''}

      <div class="btn-container">
        <a href="${actionUrl}" class="btn" target="_blank" rel="noopener noreferrer">${actionButtonText}</a>
      </div>
    </div>
    <div class="footer">
      This is an automated notification from MadrasaNexa Management System.<br />
      If you did not apply for this registration, please contact your platform administrator.
    </div>
  </div>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * Sends the Madrasa Admin approval notification email.
 */
export async function sendApprovalEmail({
  to,
  applicantName,
  madrasaName,
  planName,
  subscriptionStart,
  subscriptionEnd,
  adminEmail,
  temporaryPassword = null,
  setupUrl = null,
}) {
  const loginUrl = getLoginUrl();

  const { subject, html, text } = buildApprovalEmailTemplate({
    applicantName,
    madrasaName,
    planName,
    subscriptionStart,
    subscriptionEnd,
    adminEmail,
    loginUrl,
    temporaryPassword,
    setupUrl,
  });

  return dispatchEmail({ to, subject, html, text });
}

/**
 * Sends payment pending confirmation email to Madrasa Admin upon receipt upload.
 */
export async function sendPaymentPendingEmail({
  to,
  applicantName,
  madrasaName,
  planName,
  amount,
  reference,
}) {
  const safeApplicant = escapeHtml(applicantName || 'Administrator');
  const safeMadrasa = escapeHtml(madrasaName);
  const safePlan = escapeHtml(planName);
  const safeRef = escapeHtml(reference || 'N/A');
  const hasValidAmount =
    amount !== null && amount !== undefined && amount !== '' && Number.isFinite(Number(amount));
  const formattedAmount = hasValidAmount
    ? Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';

  const subject = `Payment Submission Received — ${madrasaName}`;

  const text = [
    `Assalamu Alaikum ${applicantName || 'Administrator'},`,
    '',
    `We have received your bank transfer payment receipt for ${madrasaName}.`,
    '',
    `Plan: ${planName}`,
    `Submitted Amount: LKR ${formattedAmount}`,
    `Reference: ${reference || 'N/A'}`,
    `Status: Under Review (PENDING)`,
    '',
    `Our administration team will review your receipt and verify the bank transfer. Once approved, your full dashboard access and subscription will be immediately unlocked.`,
    '',
    `Regards,`,
    `MadrasaNexa Platform Administration`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F7F6F1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; }
    .container { max-width: 580px; margin: 30px auto; background: #FFFFFF; border: 1px solid #E7E9EE; border-radius: 16px; overflow: hidden; }
    .header { background: #0F172A; padding: 28px 32px; text-align: left; }
    .header h1 { margin: 0; color: #FFFFFF; font-size: 20px; font-weight: 700; }
    .header .subtitle { color: #F59E0B; font-size: 12px; font-weight: 600; margin-top: 4px; text-transform: uppercase; }
    .body { padding: 32px; font-size: 14px; line-height: 1.6; color: #334155; }
    .info-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #E2E8F0; font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748B; font-weight: 500; }
    .info-value { color: #0F172A; font-weight: 600; text-align: right; }
    .footer { padding: 24px 32px; background: #F8FAFC; border-top: 1px solid #E7E9EE; font-size: 11px; color: #94A3B8; text-align: center; }
    @media only screen and (max-width: 520px) {
      .container { margin: 12px !important; border-radius: 12px !important; }
      .header { padding: 20px 18px !important; }
      .body { padding: 20px 18px !important; }
      .info-row { flex-direction: column !important; gap: 2px !important; }
      .info-value { text-align: left !important; word-break: break-word !important; }
      .btn { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .footer { padding: 18px !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MadrasaNexa</h1>
      <div class="subtitle">Payment Submission Under Review</div>
    </div>
    <div class="body">
      <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Assalamu Alaikum ${safeApplicant},</div>
      <p>Thank you for submitting your subscription bank transfer receipt for <strong>${safeMadrasa}</strong>.</p>

      <div class="info-card">
        <div class="info-row">
          <span class="info-label">Plan</span>
          <span class="info-value">${safePlan}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Amount</span>
          <span class="info-value">LKR ${formattedAmount}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Reference</span>
          <span class="info-value">${safeRef}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Verification Status</span>
          <span class="info-value" style="color: #D97706; font-weight: 700;">Pending Review</span>
        </div>
      </div>

      <p>Our administration team is reviewing the payment details. You will receive an immediate notification once your submission is verified and your workspace is fully activated.</p>
    </div>
    <div class="footer">MadrasaNexa Platform Administration</div>
  </div>
</body>
</html>`;

  return dispatchEmail({ to, subject, html, text });
}

/**
 * Sends payment approved & subscription activated email to Madrasa Admin.
 */
export async function sendPaymentApprovedEmail({
  to,
  applicantName,
  madrasaName,
  planName,
  startsAt,
  endsAt,
}) {
  const safeApplicant = escapeHtml(applicantName || 'Administrator');
  const safeMadrasa = escapeHtml(madrasaName);
  const safePlan = escapeHtml(planName);
  const formattedStart = startsAt ? new Date(startsAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  const formattedEnd = endsAt ? new Date(endsAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  const loginUrl = getLoginUrl();

  const subject = `Subscription Activated — ${madrasaName}`;

  const text = [
    `Assalamu Alaikum ${applicantName || 'Administrator'},`,
    '',
    `Great news! Your payment for ${madrasaName} has been verified and approved.`,
    '',
    `Plan: ${planName}`,
    `Subscription Term: ${formattedStart} – ${formattedEnd}`,
    `Dashboard Status: FULLY UNLOCKED`,
    '',
    `All student management, classes, fee tracking, and institutional tools are now accessible.`,
    `Login Portal: ${loginUrl}`,
    '',
    `Regards,`,
    `MadrasaNexa Platform Administration`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F7F6F1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; }
    .container { max-width: 580px; margin: 30px auto; background: #FFFFFF; border: 1px solid #E7E9EE; border-radius: 16px; overflow: hidden; }
    .header { background: #0F172A; padding: 28px 32px; text-align: left; }
    .header h1 { margin: 0; color: #FFFFFF; font-size: 20px; font-weight: 700; }
    .header .subtitle { color: #10B981; font-size: 12px; font-weight: 600; margin-top: 4px; text-transform: uppercase; }
    .body { padding: 32px; font-size: 14px; line-height: 1.6; color: #334155; }
    .info-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #E2E8F0; font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748B; font-weight: 500; }
    .info-value { color: #0F172A; font-weight: 600; text-align: right; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #0F172A; color: #FFFFFF !important; text-decoration: none; padding: 12px 28px; font-size: 13px; font-weight: 700; border-radius: 10px; }
    .footer { padding: 24px 32px; background: #F8FAFC; border-top: 1px solid #E7E9EE; font-size: 11px; color: #94A3B8; text-align: center; }
    @media only screen and (max-width: 520px) {
      .container { margin: 12px !important; border-radius: 12px !important; }
      .header { padding: 20px 18px !important; }
      .body { padding: 20px 18px !important; }
      .info-row { flex-direction: column !important; gap: 2px !important; }
      .info-value { text-align: left !important; word-break: break-word !important; }
      .btn { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .footer { padding: 18px !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MadrasaNexa</h1>
      <div class="subtitle">Subscription Activated</div>
    </div>
    <div class="body">
      <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Assalamu Alaikum ${safeApplicant},</div>
      <p>We are delighted to confirm that your subscription payment for <strong>${safeMadrasa}</strong> has been officially verified and approved.</p>

      <div class="info-card">
        <div class="info-row">
          <span class="info-label">Plan</span>
          <span class="info-value">${safePlan}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Subscription Term</span>
          <span class="info-value">${formattedStart} – ${formattedEnd}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Account Status</span>
          <span class="info-value" style="color: #059669; font-weight: 700;">Active / Unlocked</span>
        </div>
      </div>

      <div class="btn-container">
        <a href="${escapeHtml(loginUrl)}" class="btn" target="_blank" rel="noopener noreferrer">Access Your Dashboard</a>
      </div>
    </div>
    <div class="footer">MadrasaNexa Platform Administration</div>
  </div>
</body>
</html>`;

  return dispatchEmail({ to, subject, html, text });
}

/**
 * Sends payment rejected email with reason to Madrasa Admin.
 */
export async function sendPaymentRejectedEmail({
  to,
  applicantName,
  madrasaName,
  planName,
  rejectionReason,
}) {
  const safeApplicant = escapeHtml(applicantName || 'Administrator');
  const safeMadrasa = escapeHtml(madrasaName);
  const safePlan = escapeHtml(planName);
  const safeReason = escapeHtml(rejectionReason);
  const loginUrl = getLoginUrl();

  const subject = `Action Required: Subscription Payment Receipt Update — ${madrasaName}`;

  const text = [
    `Assalamu Alaikum ${applicantName || 'Administrator'},`,
    '',
    `We were unable to approve your subscription payment submission for ${madrasaName}.`,
    '',
    `Plan: ${planName}`,
    `Reason for Rejection:`,
    `${rejectionReason}`,
    '',
    `Please log in to your MadrasaNexa portal, review the bank account details, and upload a new or corrected bank transfer receipt.`,
    `Login Portal: ${loginUrl}`,
    '',
    `Regards,`,
    `MadrasaNexa Platform Administration`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F7F6F1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; }
    .container { max-width: 580px; margin: 30px auto; background: #FFFFFF; border: 1px solid #E7E9EE; border-radius: 16px; overflow: hidden; }
    .header { background: #0F172A; padding: 28px 32px; text-align: left; }
    .header h1 { margin: 0; color: #FFFFFF; font-size: 20px; font-weight: 700; }
    .header .subtitle { color: #EF4444; font-size: 12px; font-weight: 600; margin-top: 4px; text-transform: uppercase; }
    .body { padding: 32px; font-size: 14px; line-height: 1.6; color: #334155; }
    .reason-box { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 16px; margin: 20px 0; color: #991B1B; font-size: 13px; line-height: 1.5; word-break: break-word; overflow-wrap: anywhere; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #0F172A; color: #FFFFFF !important; text-decoration: none; padding: 12px 28px; font-size: 13px; font-weight: 700; border-radius: 10px; }
    .footer { padding: 24px 32px; background: #F8FAFC; border-top: 1px solid #E7E9EE; font-size: 11px; color: #94A3B8; text-align: center; }
    @media only screen and (max-width: 520px) {
      .container { margin: 12px !important; border-radius: 12px !important; }
      .header { padding: 20px 18px !important; }
      .body { padding: 20px 18px !important; }
      .info-row { flex-direction: column !important; gap: 2px !important; }
      .info-value { text-align: left !important; word-break: break-word !important; }
      .btn { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .footer { padding: 18px !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MadrasaNexa</h1>
      <div class="subtitle">Payment Submission Notice</div>
    </div>
    <div class="body">
      <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Assalamu Alaikum ${safeApplicant},</div>
      <p>We were unable to approve your subscription payment submission for <strong>${safeMadrasa}</strong> (${safePlan}).</p>

      <div class="reason-box">
        <strong>Reason for rejection:</strong><br />
        ${safeReason}
      </div>

      <p>Please check your payment transfer details and upload a clear, corrected receipt from your Subscription management page.</p>

      <div class="btn-container">
        <a href="${escapeHtml(loginUrl)}" class="btn" target="_blank" rel="noopener noreferrer">Go to Subscription Page</a>
      </div>
    </div>
    <div class="footer">MadrasaNexa Platform Administration</div>
  </div>
</body>
</html>`;

  return dispatchEmail({ to, subject, html, text });
}

/**
 * Sends salary payment notification email to Ustadh.
 * Uses dynamic Madrasa details as the employer.
 */
export async function sendUstadhSalaryPaidEmail({
  madrasaId,
  to,
  ustadhName,
  madrasaName,
  salaryMonth,
  amount,
  paymentDate,
  paymentMethod,
  attachments,
  subject: customSubject,
  message: customMessage,
}) {
  const safeUstadh = escapeHtml(ustadhName || 'Ustadh');
  const safeMadrasa = escapeHtml(madrasaName || 'Madrasa Administration');
  const safeMonth = escapeHtml(salaryMonth);
  const safeAmount = escapeHtml(amount);
  const safeDate = escapeHtml(paymentDate);
  const safeMethod = escapeHtml(paymentMethod);

  // Subject: prevent header injection by stripping CR/LF
  const resolvedSubject = customSubject && typeof customSubject === 'string' && customSubject.trim()
    ? customSubject.replace(/[\r\n]/g, ' ').trim()
    : `${salaryMonth} Salary Payment — ${madrasaName}`;

  let text = '';
  let html = '';

  if (customMessage && typeof customMessage === 'string' && customMessage.trim()) {
    text = customMessage.trim();
    const safeBodyHtml = escapeHtml(customMessage.trim()).replace(/\n/g, '<br/>');
    html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(resolvedSubject)}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F7F6F1; margin: 0; padding: 24px; color: #0F172A; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E7E9EE; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0F172A; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; }
    .header .subtitle { font-size: 12px; color: #37C6A3; font-weight: 600; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
    .body { padding: 28px 24px; font-size: 14px; line-height: 1.6; color: #334155; }
    .footer { text-align: center; padding: 18px; font-size: 11px; color: #7C8A9A; background: #FAFAFA; border-top: 1px solid #E7E9EE; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${safeMadrasa}</h1>
      <div class="subtitle">Salary Disbursement Advice</div>
    </div>
    <div class="body">
      ${safeBodyHtml}
    </div>
    <div class="footer">${safeMadrasa}</div>
  </div>
</body>
</html>`;
  } else {
    text = [
      `Assalamu Alaikum ${ustadhName},`,
      '',
      `Your salary payment for ${salaryMonth} has been processed.`,
      '',
      `Amount: ${amount}`,
      `Payment Date: ${paymentDate}`,
      `Payment Method: ${paymentMethod}`,
      `Status: Paid`,
      '',
      `Thank you.`,
      '',
      madrasaName,
    ].join('\n');

    html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeMonth} Salary Payment</title>
  <style>
    body { font-family: 'Noto Sans Tamil', 'Noto Sans', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F7F6F1; margin: 0; padding: 24px; color: #0F172A; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E7E9EE; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0F172A; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; }
    .header .subtitle { font-size: 12px; color: #37C6A3; font-weight: 600; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
    .body { padding: 28px 24px; }
    .salutation { font-size: 16px; font-weight: 700; margin-bottom: 12px; color: #0F172A; }
    .info-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 16px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #EDF2F7; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748B; font-weight: 500; }
    .info-value { color: #0F172A; font-weight: 700; }
    .badge-paid { display: inline-block; background-color: #DEF7EC; color: #03543F; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; }
    .footer { text-align: center; padding: 18px; font-size: 11px; color: #7C8A9A; background: #FAFAFA; border-top: 1px solid #E7E9EE; }
    @media only screen and (max-width: 520px) {
      body { padding: 12px !important; }
      .body { padding: 20px 16px !important; }
      .info-row { flex-direction: column !important; gap: 2px !important; }
      .info-value { text-align: left !important; word-break: break-word !important; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${safeMadrasa}</h1>
      <div class="subtitle">Salary Disbursement Advice</div>
    </div>
    <div class="body">
      <div class="salutation">Assalamu Alaikum ${safeUstadh},</div>
      <p style="font-size: 14px; line-height: 1.5; color: #334155; margin: 0 0 16px 0;">
        Your salary payment for <strong>${safeMonth}</strong> has been successfully processed.
      </p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Salary Month</span>
          <span class="info-value">${safeMonth}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Amount Paid</span>
          <span class="info-value" style="font-size: 15px; color: #059669;">${safeAmount}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Payment Date</span>
          <span class="info-value">${safeDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Payment Method</span>
          <span class="info-value">${safeMethod}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Status</span>
          <span class="info-value"><span class="badge-paid">Paid</span></span>
        </div>
      </div>

      <p style="font-size: 13px; color: #64748B; margin: 16px 0 0 0;">
        May Allah bless your noble efforts in teaching and guiding our students.
      </p>
    </div>
    <div class="footer">${safeMadrasa}</div>
  </div>
</body>
</html>`;
  }

  return dispatchEmail({ madrasaId, to, subject: resolvedSubject, html, text, attachments });
}

/**
 * Sends a direct administrative communication email to an Ustadh.
 */
export async function sendUstadhDirectEmail({
  madrasaId,
  to,
  ustadhName,
  madrasaName,
  subject,
  message,
}) {
  const safeUstadh = escapeHtml(ustadhName || 'Ustadh');
  const safeMadrasa = escapeHtml(madrasaName || 'Madrasa Administration');
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br />');

  const text = [
    `Assalamu Alaikum ${ustadhName},`,
    '',
    message,
    '',
    `Regards,`,
    madrasaName,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F7F6F1; margin: 0; padding: 24px; color: #0F172A; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E7E9EE; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0F172A; color: #ffffff; padding: 20px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 18px; font-weight: 700; color: #ffffff; }
    .body { padding: 24px; }
    .salutation { font-size: 15px; font-weight: 700; margin-bottom: 12px; color: #0F172A; }
    .content { font-size: 14px; line-height: 1.6; color: #334155; }
    .footer { text-align: center; padding: 16px; font-size: 11px; color: #7C8A9A; background: #FAFAFA; border-top: 1px solid #E7E9EE; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${safeMadrasa}</h1>
    </div>
    <div class="body">
      <div class="salutation">Assalamu Alaikum ${safeUstadh},</div>
      <div class="content">${safeMessage}</div>
    </div>
    <div class="footer">${safeMadrasa}</div>
  </div>
</body>
</html>`;

  return dispatchEmail({ madrasaId, to, subject, html, text });
}

/**
 * Sends a student fee payment confirmation email.
 */
export async function sendStudentFeePaymentEmail({ madrasaId, to, subject, html, text }) {
  return dispatchEmail({ madrasaId, to, subject, html, text });
}

/**
 * Sends a finalized teaching timetable email to a staff member with PDF attachment.
 */
export async function sendStaffTimetableEmail({
  madrasaId,
  to,
  staffName,
  madrasaName,
  effectiveDate,
  subject: customSubject,
  message: customMessage,
  attachments,
}) {
  const safeStaff = escapeHtml(staffName || 'Staff Member');
  const safeMadrasa = escapeHtml(madrasaName || 'Madrasa Administration');
  const safeDate = escapeHtml(effectiveDate || 'Immediately');
  const subject = customSubject || `Academic Timetable Finalized — Effective ${safeDate} — ${madrasaName}`;

  const text = [
    `Assalamu Alaikum ${staffName},`,
    '',
    customMessage || `Please find attached your finalized teaching timetable for ${madrasaName}, effective from ${safeDate}.`,
    '',
    `Please review your assigned teaching sessions. If you have any scheduling concerns, please contact the administration office.`,
    '',
    `Regards,`,
    madrasaName,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #0F172A; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0F172A; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; }
    .body { padding: 24px; font-size: 14px; line-height: 1.6; }
    .notice { background: #F1F5F9; border-radius: 8px; padding: 14px; margin: 16px 0; border-left: 4px solid #0F172A; }
    .footer { text-align: center; padding: 16px; font-size: 11px; color: #94A3B8; background: #FAFAFA; border-top: 1px solid #E2E8F0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${safeMadrasa}</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #94A3B8;">Official Teaching Timetable Publication</p>
    </div>
    <div class="body">
      <div style="font-weight: 700; margin-bottom: 12px;">Assalamu Alaikum ${safeStaff},</div>
      <p>${customMessage ? escapeHtml(customMessage) : `Your teaching schedule has been finalized and published by the administration.`}</p>

      <div class="notice">
        <strong>Effective Date:</strong> ${safeDate}<br />
        <strong>Attachment:</strong> Individual Personalized Schedule PDF
      </div>

      <p>Your complete schedule with classroom assignments and class times is attached to this email as a PDF document for your records.</p>
    </div>
    <div class="footer">${safeMadrasa} &bull; Academic Administration</div>
  </div>
</body>
</html>`;

  return dispatchEmail({ madrasaId, to, subject, html, text, attachments });
}

export { buildAdmissionEmailTemplate, sendAdmissionNotificationEmail } from './admission-email.service.js';
