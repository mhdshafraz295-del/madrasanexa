import crypto from 'crypto';
import dns from 'dns';
import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

/**
 * Validates whether an IP address is a private, loopback, link-local, or reserved address.
 *
 * @param {string} ip
 * @returns {boolean} True if the IP is private/forbidden, false if public.
 */
export function isForbiddenIp(ip) {
  if (!ip || typeof ip !== 'string') return true;
  const cleanIp = ip.trim();

  // IPv4 Loopback (127.0.0.0/8) & Unspecified (0.0.0.0/8)
  if (cleanIp.startsWith('127.') || cleanIp.startsWith('0.') || cleanIp === '127.0.0.1') return true;

  // IPv4 Private (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  if (cleanIp.startsWith('10.')) return true;
  if (cleanIp.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp)) return true;

  // IPv4 Link-Local (169.254.0.0/16)
  if (cleanIp.startsWith('169.254.')) return true;

  // IPv6 Loopback (::1), Unspecified (::), Link-Local (fe80::/10), Unique Local (fc00::/7)
  const lowerV6 = cleanIp.toLowerCase();
  if (
    lowerV6 === '::1' ||
    lowerV6 === '::' ||
    lowerV6.startsWith('fe80:') ||
    lowerV6.startsWith('fc00:') ||
    lowerV6.startsWith('fd00:') ||
    lowerV6.startsWith('::ffff:127.') ||
    lowerV6.startsWith('::ffff:10.') ||
    lowerV6.startsWith('::ffff:192.168.') ||
    lowerV6.startsWith('::ffff:169.254.')
  ) {
    return true;
  }

  return false;
}

/**
 * Performs DNS resolution on host and verifies ALL returned IPv4/IPv6 addresses are public.
 *
 * @param {string} host
 * @returns {Promise<{ valid: boolean, reason?: string, resolvedIps?: string[] }>}
 */
export async function validatePublicSmtpHost(host) {
  if (!host || typeof host !== 'string') {
    return { valid: false, reason: 'Invalid or empty hostname.' };
  }

  const cleanHost = host.trim().toLowerCase();

  // Reject explicit localhost or local domain patterns
  if (
    cleanHost === 'localhost' ||
    cleanHost.endsWith('.local') ||
    cleanHost.endsWith('.internal') ||
    cleanHost.endsWith('.localhost')
  ) {
    return { valid: false, reason: 'Localhost and internal domain names are forbidden.' };
  }

  // If raw IP literal supplied
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanHost) || cleanHost.includes(':')) {
    if (isForbiddenIp(cleanHost)) {
      return { valid: false, reason: 'Private or loopback IP addresses are forbidden.' };
    }
    return { valid: true, resolvedIps: [cleanHost] };
  }

  try {
    const addresses = await dns.promises.lookup(cleanHost, { all: true });
    if (!addresses || addresses.length === 0) {
      return { valid: false, reason: 'Could not resolve SMTP hostname.' };
    }

    const resolvedIps = addresses.map((a) => a.address);
    for (const ip of resolvedIps) {
      if (isForbiddenIp(ip)) {
        return { valid: false, reason: `Hostname resolves to a non-public IP address (${ip}).` };
      }
    }

    return { valid: true, resolvedIps };
  } catch (err) {
    return { valid: false, reason: `DNS resolution failure for host ${cleanHost}: ${err.message}` };
  }
}

/**
 * Obtains 32-byte Buffer from EMAIL_CREDENTIAL_ENCRYPTION_KEY environment variable.
 */
function getEncryptionKeyBuffer() {
  const keyHex = process.env.EMAIL_CREDENTIAL_ENCRYPTION_KEY || env.EMAIL_CREDENTIAL_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error('Server configuration error: EMAIL_CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts SMTP credential using AES-256-GCM.
 * @param {string} plaintext
 * @returns {string} iv:authTag:ciphertext
 */
export function encryptCredential(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return '';
  const key = getEncryptionKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts SMTP credential from iv:authTag:ciphertext.
 * @param {string} encryptedString
 * @returns {string} plaintext
 */
export function decryptCredential(encryptedString) {
  if (!encryptedString || typeof encryptedString !== 'string') return '';
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted credential format.');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getEncryptionKeyBuffer();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Creates a tenant-aware Nodemailer transporter with SSRF protection and strict TLS validation.
 *
 * @param {object} settings
 * @param {string} decryptedPassword
 * @returns {object} Nodemailer Transporter instance
 */
export function createCustomSmtpTransporter(settings, decryptedPassword) {
  const isSslTls = settings.smtpSecurity === 'SSL_TLS';

  // Custom safe Nodemailer lookup function that re-validates DNS at connect-time
  const safeLookup = (hostname, options, callback) => {
    dns.lookup(hostname, options, (err, address, family) => {
      if (err) return callback(err);

      const ipList = Array.isArray(address) ? address.map(a => a.address || a) : [address];
      for (const ip of ipList) {
        if (isForbiddenIp(ip)) {
          return callback(new Error(`SSRF Blocked: ${hostname} resolved to forbidden IP (${ip})`));
        }
      }

      if (Array.isArray(address)) {
        return callback(null, address);
      }
      return callback(null, address, family);
    });
  };

  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort || (isSslTls ? 465 : 587),
    secure: isSslTls,
    requireTLS: !isSslTls, // Force STARTTLS for 587/STARTTLS mode
    auth: {
      user: settings.smtpUsername,
      pass: decryptedPassword,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: true, // Strictly preserve TLS certificate validation
      servername: settings.smtpHost, // Preserve hostname for TLS SNI
    },
    lookup: safeLookup,
  });
}

/**
 * Resolves email transport and sender identity for a given madrasa tenant.
 *
 * @param {string} madrasaId
 * @returns {Promise<{ isCustom: boolean, from: string, replyTo: string, transporter: object|null, settings?: object }>}
 */
export async function resolveEmailSenderForMadrasa(madrasaId) {
  if (!madrasaId) {
    return {
      isCustom: false,
      from: env.EMAIL_FROM || 'notifications@madrasanexa.com',
      replyTo: env.EMAIL_FROM || 'notifications@madrasanexa.com',
      transporter: null,
    };
  }

  const [madrasa, emailSettings] = await Promise.all([
    prisma.madrasa.findUnique({ where: { id: madrasaId }, select: { name: true, email: true } }),
    prisma.madrasaEmailSetting.findUnique({ where: { madrasaId } }),
  ]);

  const fallbackFrom = madrasa?.name
    ? `"${madrasa.name}" <${env.EMAIL_FROM}>`
    : env.EMAIL_FROM;
  const fallbackReplyTo = madrasa?.email || env.EMAIL_FROM;

  // Clean-start / no row / PLATFORM mode / unverified -> use platform sender
  if (!emailSettings || emailSettings.mode !== 'CUSTOM_SMTP' || !emailSettings.isVerified) {
    return {
      isCustom: false,
      from: fallbackFrom,
      replyTo: fallbackReplyTo,
      transporter: null,
      settings: emailSettings || null,
    };
  }

  // Pre-send SSRF revalidation
  const ssrfCheck = await validatePublicSmtpHost(emailSettings.smtpHost);
  if (!ssrfCheck.valid) {
    console.warn(`[EmailSenderResolver] CUSTOM_SMTP host for madrasa ${madrasaId} failed SSRF check: ${ssrfCheck.reason}. Falling back to platform sender.`);
    return {
      isCustom: false,
      from: fallbackFrom,
      replyTo: fallbackReplyTo,
      transporter: null,
      settings: emailSettings,
    };
  }

  let decryptedPassword = '';
  try {
    decryptedPassword = decryptCredential(emailSettings.smtpPasswordEncrypted);
  } catch (err) {
    console.error(`[EmailSenderResolver] Failed to decrypt SMTP password for madrasa ${madrasaId}:`, err.message);
    return {
      isCustom: false,
      from: fallbackFrom,
      replyTo: fallbackReplyTo,
      transporter: null,
      settings: emailSettings,
    };
  }

  try {
    const customTransporter = createCustomSmtpTransporter(emailSettings, decryptedPassword);
    const fromName = emailSettings.fromName || madrasa?.name || 'Madrasa';
    const fromEmail = emailSettings.fromEmail;
    const replyTo = emailSettings.replyToEmail || fromEmail;

    return {
      isCustom: true,
      from: `"${fromName}" <${fromEmail}>`,
      replyTo,
      transporter: customTransporter,
      settings: emailSettings,
    };
  } catch (err) {
    console.error(`[EmailSenderResolver] Error building custom transporter for madrasa ${madrasaId}:`, err.message);
    return {
      isCustom: false,
      from: fallbackFrom,
      replyTo: fallbackReplyTo,
      transporter: null,
      settings: emailSettings,
    };
  }
}
