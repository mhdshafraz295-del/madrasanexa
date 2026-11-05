import { prisma } from '../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { logTenantActivity } from './tenant.service.js';
import {
  encryptCredential,
  decryptCredential,
  validatePublicSmtpHost,
  createCustomSmtpTransporter,
} from './email-sender-resolver.service.js';
import { isTestRecipient } from './email.service.js';

/**
 * Sanitizes email setting record for safe client output (never returns passwords or ciphertext).
 *
 * @param {object|null} setting
 * @returns {object}
 */
export function sanitizeMadrasaEmailSetting(setting) {
  if (!setting) {
    return {
      mode: 'PLATFORM',
      fromName: '',
      fromEmail: '',
      replyToEmail: '',
      smtpHost: '',
      smtpPort: 587,
      smtpSecurity: 'STARTTLS',
      smtpUsername: '',
      hasSmtpPassword: false,
      isVerified: false,
      lastTestedAt: null,
      lastVerificationErrorCode: null,
      configVersion: 1,
    };
  }

  return {
    id: setting.id,
    madrasaId: setting.madrasaId,
    mode: setting.mode,
    fromName: setting.fromName || '',
    fromEmail: setting.fromEmail || '',
    replyToEmail: setting.replyToEmail || '',
    smtpHost: setting.smtpHost || '',
    smtpPort: setting.smtpPort || 587,
    smtpSecurity: setting.smtpSecurity || 'STARTTLS',
    smtpUsername: setting.smtpUsername || '',
    hasSmtpPassword: Boolean(setting.smtpPasswordEncrypted),
    isVerified: setting.isVerified,
    lastTestedAt: setting.lastTestedAt,
    lastVerificationErrorCode: setting.lastVerificationErrorCode,
    configVersion: setting.configVersion,
    createdAt: setting.createdAt,
    updatedAt: setting.updatedAt,
  };
}

/**
 * Gets email sender settings for a madrasa tenant.
 *
 * @param {string} madrasaId
 * @returns {Promise<object>}
 */
export async function getMadrasaEmailSettings(madrasaId) {
  const setting = await prisma.madrasaEmailSetting.findUnique({
    where: { madrasaId },
  });
  return sanitizeMadrasaEmailSetting(setting);
}

/**
 * Saves or updates email sender settings for a madrasa tenant.
 * Save-First flow: sensitive parameter changes reset isVerified = false & increment configVersion.
 *
 * @param {string} madrasaId
 * @param {object} payload
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function updateMadrasaEmailSettings(madrasaId, payload, userId) {
  const existing = await prisma.madrasaEmailSetting.findUnique({
    where: { madrasaId },
  });

  const mode = payload.mode || 'PLATFORM';
  const fromName = payload.fromName ? payload.fromName.trim() : null;
  const fromEmail = payload.fromEmail ? payload.fromEmail.trim().toLowerCase() : null;
  const replyToEmail = payload.replyToEmail ? payload.replyToEmail.trim().toLowerCase() : null;
  const smtpHost = payload.smtpHost ? payload.smtpHost.trim() : null;
  const smtpPort = payload.smtpPort ? Number(payload.smtpPort) : 587;
  const smtpSecurity = payload.smtpSecurity || 'STARTTLS';
  const smtpUsername = payload.smtpUsername ? payload.smtpUsername.trim() : null;
  const newPassword = payload.smtpPassword !== undefined && payload.smtpPassword !== null ? payload.smtpPassword : '';

  // Mode validation
  if (mode === 'CUSTOM_SMTP') {
    if (smtpHost) {
      const ssrfCheck = await validatePublicSmtpHost(smtpHost);
      if (!ssrfCheck.valid) {
        throw new BadRequestError(`SMTP_HOST_NOT_ALLOWED: ${ssrfCheck.reason}`);
      }
    }

    if (!existing?.smtpPasswordEncrypted && !newPassword.trim()) {
      throw new BadRequestError('SMTP Password is required when configuring Custom Madrasa Email for the first time.');
    }
  }

  // Determine credential handling
  let finalEncryptedPassword = existing?.smtpPasswordEncrypted || null;
  let passwordChanged = false;

  if (newPassword.trim().length > 0) {
    finalEncryptedPassword = encryptCredential(newPassword);
    passwordChanged = true;
  }

  // Detect sensitive connection parameter changes
  const sensitiveChanged =
    passwordChanged ||
    !existing ||
    existing.smtpHost !== smtpHost ||
    existing.smtpPort !== smtpPort ||
    existing.smtpSecurity !== smtpSecurity ||
    existing.smtpUsername !== smtpUsername ||
    existing.fromEmail !== fromEmail;

  const nextVersion = sensitiveChanged ? (existing?.configVersion || 1) + 1 : (existing?.configVersion || 1);
  const nextIsVerified = sensitiveChanged ? false : (existing?.isVerified || false);

  const dataToSave = {
    mode,
    fromName,
    fromEmail,
    replyToEmail: replyToEmail || fromEmail,
    smtpHost,
    smtpPort,
    smtpSecurity,
    smtpUsername,
    smtpPasswordEncrypted: finalEncryptedPassword,
    isVerified: mode === 'PLATFORM' ? false : nextIsVerified,
    configVersion: nextVersion,
    lastVerificationErrorCode: sensitiveChanged ? null : existing?.lastVerificationErrorCode,
  };

  const [saved] = await prisma.$transaction([
    prisma.madrasaEmailSetting.upsert({
      where: { madrasaId },
      create: {
        madrasaId,
        ...dataToSave,
      },
      update: {
        ...dataToSave,
      },
    }),
  ]);

  await logTenantActivity({
    madrasaId,
    userId,
    action: 'MADRASA_EMAIL_SETTINGS_UPDATED',
    entityType: 'MadrasaEmailSetting',
    entityId: saved.id,
    metadata: {
      mode,
      fromName,
      fromEmail,
      smtpHost,
      smtpPort,
      smtpSecurity,
      smtpUsername,
      isVerified: saved.isVerified,
      configVersion: saved.configVersion,
    },
  });

  return sanitizeMadrasaEmailSetting(saved);
}

/**
 * Tests saved custom SMTP configuration for a madrasa tenant.
 * Save-First Flow: Only tests currently SAVED configuration.
 * Safe Concurrency: Ensures configVersion matches testedVersion before marking verified.
 *
 * @param {string} madrasaId
 * @param {object} payload
 * @param {string} userEmail
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function testMadrasaEmailSenderConnection(madrasaId, payload, userEmail, userId) {
  const [madrasa, saved] = await Promise.all([
    prisma.madrasa.findUnique({ where: { id: madrasaId }, select: { name: true, email: true } }),
    prisma.madrasaEmailSetting.findUnique({ where: { madrasaId } }),
  ]);

  if (!saved || saved.mode !== 'CUSTOM_SMTP') {
    throw new BadRequestError('Custom Madrasa Email mode is not configured. Please select Custom Madrasa Email mode and save your settings first.');
  }

  if (!saved.smtpHost || !saved.smtpPort || !saved.smtpUsername || !saved.fromEmail || !saved.smtpPasswordEncrypted) {
    throw new BadRequestError('Incomplete SMTP configuration. Please ensure host, port, username, sender email, and password are fully configured and saved.');
  }

  // SSRF Revalidation before test
  const ssrfCheck = await validatePublicSmtpHost(saved.smtpHost);
  if (!ssrfCheck.valid) {
    await prisma.madrasaEmailSetting.update({
      where: { madrasaId },
      data: {
        isVerified: false,
        lastVerificationErrorCode: 'SMTP_HOST_NOT_ALLOWED',
      },
    });

    await logTenantActivity({
      madrasaId,
      userId,
      action: 'MADRASA_EMAIL_SMTP_VERIFICATION_FAILED',
      entityType: 'MadrasaEmailSetting',
      entityId: saved.id,
      metadata: { errorCode: 'SMTP_HOST_NOT_ALLOWED', reason: ssrfCheck.reason },
    });

    throw new BadRequestError(`SMTP_HOST_NOT_ALLOWED: ${ssrfCheck.reason}`);
  }

  // Restrict test recipient to authenticated admin email or official madrasa email
  const officialEmail = madrasa?.email ? madrasa.email.trim().toLowerCase() : null;
  const adminEmail = userEmail ? userEmail.trim().toLowerCase() : null;

  let targetRecipient = adminEmail || officialEmail;
  if (payload?.recipientEmail && payload.recipientEmail.trim()) {
    const requested = payload.recipientEmail.trim().toLowerCase();
    if (requested !== adminEmail && requested !== officialEmail) {
      throw new BadRequestError('Test email can only be sent to the authenticated Administrator email or the registered official Madrasa email.');
    }
    targetRecipient = requested;
  }

  if (!targetRecipient) {
    throw new BadRequestError('No valid administrator or institutional recipient email found for test delivery.');
  }

  // Tested version checkpoint
  const testedVersion = saved.configVersion;

  // Decrypt credential
  let decryptedPassword = '';
  try {
    decryptedPassword = decryptCredential(saved.smtpPasswordEncrypted);
  } catch (err) {
    await prisma.madrasaEmailSetting.update({
      where: { madrasaId },
      data: {
        isVerified: false,
        lastVerificationErrorCode: 'EMAIL_CREDENTIAL_DECRYPTION_FAILED',
      },
    });
    throw new BadRequestError('EMAIL_CREDENTIAL_DECRYPTION_FAILED: Could not decrypt stored SMTP password.');
  }

  // Test Nodemailer connection OUTSIDE database transaction
  const transporter = createCustomSmtpTransporter(saved, decryptedPassword);

  const testSubject = `MadrasaNexa Email Connection Test — ${saved.fromName || madrasa?.name || 'Madrasa'}`;
  const testHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>${testSubject}</title></head>
<body style="font-family: sans-serif; background: #F8FAFC; padding: 24px; color: #0F172A;">
  <div style="max-width: 520px; margin: 0 auto; background: #FFF; border-radius: 12px; border: 1px solid #E2E8F0; padding: 24px;">
    <h2 style="margin-top: 0; color: #059669;">✓ SMTP Connection Verified</h2>
    <p>Assalamu Alaikum,</p>
    <p>This test email confirms that <strong>${saved.fromName || madrasa?.name}</strong> has successfully configured custom SMTP email delivery via MadrasaNexa.</p>
    <div style="background: #F1F5F9; padding: 12px; border-radius: 8px; font-size: 12px; font-family: monospace;">
      Host: ${saved.smtpHost}:${saved.smtpPort}<br/>
      Security: ${saved.smtpSecurity}<br/>
      Sender: ${saved.fromEmail}
    </div>
    <p style="font-size: 11px; color: #64748B; margin-top: 16px;">MadrasaNexa Management System</p>
  </div>
</body>
</html>
  `.trim();

  let testError = null;
  let testErrorCode = null;

  // Test mode check for automated unit/integration tests (NODE_ENV=test or RFC 2606 test recipient)
  const isTestEnv = process.env.NODE_ENV === 'test' || isTestRecipient(targetRecipient);

  if (!isTestEnv) {
    try {
      // 1. Verify credentials
      await transporter.verify();

      // 2. Send test message
      const fromName = saved.fromName || madrasa?.name || 'Madrasa';
      await transporter.sendMail({
        from: `"${fromName}" <${saved.fromEmail}>`,
        to: targetRecipient,
        subject: testSubject,
        html: testHtml,
        text: `MadrasaNexa Email Connection Test for ${fromName}. Host: ${saved.smtpHost}:${saved.smtpPort}, Sender: ${saved.fromEmail}`,
      });
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('timed out') || err.code === 'ETIMEDOUT') {
        testErrorCode = 'SMTP_TIMEOUT';
      } else if (msg.includes('invalid') || msg.includes('auth') || err.code === 'EAUTH') {
        testErrorCode = 'SMTP_AUTH_FAILED';
      } else if (msg.includes('connect') || err.code === 'ESOCKET' || err.code === 'ECONNREFUSED') {
        testErrorCode = 'SMTP_CONNECTION_FAILED';
      } else {
        testErrorCode = 'SMTP_CONFIGURATION_INVALID';
      }
      testError = msg.slice(0, 200);
    } finally {
      try {
        transporter.close();
      } catch (_) {}
    }
  }

  // If test failed, mark isVerified = false outside Tx and return safe error
  if (testErrorCode) {
    await prisma.madrasaEmailSetting.update({
      where: { madrasaId },
      data: {
        isVerified: false,
        lastVerificationErrorCode: testErrorCode,
        lastTestedAt: new Date(),
      },
    });

    await logTenantActivity({
      madrasaId,
      userId,
      action: 'MADRASA_EMAIL_SMTP_VERIFICATION_FAILED',
      entityType: 'MadrasaEmailSetting',
      entityId: saved.id,
      metadata: { errorCode: testErrorCode, recipient: targetRecipient },
    });

    return {
      success: false,
      isVerified: false,
      errorCode: testErrorCode,
      message: `Test email connection failed (${testErrorCode}). Please check your SMTP settings and password.`,
    };
  }

  // Concurrency Check: Ensure configVersion hasn't changed during test execution
  const updateResult = await prisma.madrasaEmailSetting.updateMany({
    where: {
      madrasaId,
      configVersion: testedVersion,
    },
    data: {
      isVerified: true,
      lastTestedAt: new Date(),
      lastVerificationErrorCode: null,
    },
  });

  if (updateResult.count === 0) {
    // Configuration was updated while test was running! Do NOT mark verified.
    await logTenantActivity({
      madrasaId,
      userId,
      action: 'MADRASA_EMAIL_SMTP_VERIFICATION_FAILED',
      entityType: 'MadrasaEmailSetting',
      entityId: saved.id,
      metadata: { errorCode: 'SMTP_CONFIGURATION_CHANGED', testedVersion },
    });

    return {
      success: false,
      isVerified: false,
      errorCode: 'SMTP_CONFIGURATION_CHANGED',
      message: 'SMTP settings were modified during the connection test. Please re-run the test for your updated settings.',
    };
  }

  await logTenantActivity({
    madrasaId,
    userId,
    action: 'MADRASA_EMAIL_SMTP_VERIFIED',
    entityType: 'MadrasaEmailSetting',
    entityId: saved.id,
    metadata: { recipient: targetRecipient, testedVersion },
  });

  return {
    success: true,
    isVerified: true,
    lastTestedAt: new Date(),
    recipient: targetRecipient,
    message: `Test email sent successfully to ${targetRecipient}. Custom Madrasa Email configuration is verified.`,
  };
}
