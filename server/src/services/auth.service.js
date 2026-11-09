import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { comparePassword } from '../utils/password.js';
import { signAccessToken } from '../utils/jwt.js';
import { resolveObjectAccessUrl } from './r2.service.js';
import { normalizeEmail } from '../utils/email-normalization.js';

/**
 * Resolves active dynamic logoUrl for a madrasa tenant.
 */
async function resolveMadrasaLogoUrl(madrasaId, logoFileId) {
  if (!logoFileId) return null;
  try {
    const file = await prisma.fileObject.findFirst({
      where: { id: logoFileId, madrasaId, type: 'MADRASA_LOGO' },
      select: { objectKey: true },
    });
    if (file?.objectKey) {
      return await resolveObjectAccessUrl(file.objectKey);
    }
  } catch (e) {
    // Non-blocking fallback
  }
  return null;
}

/**
 * Authenticates user credentials, validates account and tenant statuses,
 * records audit log, updates lastLoginAt, and returns signed JWT with sanitized user info.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<{ accessToken: string, user: object }>}
 */
export const loginUser = async (email, password, ip = null, userAgent = null) => {
  const normalizedEmail = normalizeEmail(email);

  // Find user by normalized email with madrasa details
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      madrasa: {
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          logoFileId: true,
        },
      },
    },
  });

  // Generic anti-enumeration error for missing user
  if (!user) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  // Verify password hash
  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  // Check active account status
  if (!user.isActive) {
    const error = new Error('Your account is currently disabled. Please contact the administrator.');
    error.statusCode = 403;
    throw error;
  }

  // Validate Madrasa Admin constraints
  if (user.role === 'MADRASA_ADMIN') {
    if (!user.madrasaId || !user.madrasa) {
      const error = new Error('Madrasa administrator account is not linked to any institution.');
      error.statusCode = 403;
      throw error;
    }

    if (user.madrasa.status === 'ARCHIVED') {
      const error = new Error('This Madrasa account has been archived. Access is restricted.');
      error.statusCode = 403;
      throw error;
    }

    if (user.madrasa.status === 'SUSPENDED') {
      const error = new Error('This Madrasa account is currently suspended. Access is restricted.');
      error.statusCode = 403;
      throw error;
    }
  }

  // Update lastLoginAt and record ActivityLog atomically in a safe transaction
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
    prisma.activityLog.create({
      data: {
        action: 'AUTH_LOGIN_SUCCESS',
        userId: user.id,
        madrasaId: user.madrasaId || null,
        ipAddress: ip ? String(ip).slice(0, 45) : null,
        userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
        metadata: { role: user.role },
      },
    }),
  ]);

  // Sign access token (HS256)
  const accessToken = signAccessToken({
    userId: user.id,
    role: user.role,
    madrasaId: user.madrasaId,
    tokenVersion: user.tokenVersion ?? 0,
  });

  let logoUrl = null;
  if (user.madrasa?.logoFileId) {
    logoUrl = await resolveMadrasaLogoUrl(user.madrasa.id, user.madrasa.logoFileId);
  }

  // Sanitize return object - never leak passwordHash
  const sanitizedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    madrasaId: user.madrasaId,
    mustChangePassword: Boolean(user.mustChangePassword),
    ...(user.madrasa
      ? {
          madrasa: {
            id: user.madrasa.id,
            name: user.madrasa.name,
            code: user.madrasa.code,
            logoUrl,
          },
        }
      : {}),
  };

  return {
    accessToken,
    user: sanitizedUser,
  };
};

/**
 * Loads current user information for session restoration using explicit safe select.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
export const getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      madrasaId: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
      madrasa: {
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          logoFileId: true,
        },
      },
    },
  });

  if (!user || !user.isActive) {
    const error = new Error('User not found or account disabled.');
    error.statusCode = 401;
    throw error;
  }

  if (user.role === 'MADRASA_ADMIN' && user.madrasa && user.madrasa.status !== 'ACTIVE') {
    const error = new Error(`Madrasa workspace is ${user.madrasa.status.toLowerCase()}.`);
    error.statusCode = 403;
    throw error;
  }

  let logoUrl = null;
  if (user.madrasa?.logoFileId) {
    logoUrl = await resolveMadrasaLogoUrl(user.madrasa.id, user.madrasa.logoFileId);
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    madrasaId: user.madrasaId,
    mustChangePassword: Boolean(user.mustChangePassword),
    ...(user.madrasa
      ? {
          madrasa: {
            id: user.madrasa.id,
            name: user.madrasa.name,
            code: user.madrasa.code,
            logoUrl,
          },
        }
      : {}),
  };
};

/**
 * Changes user password using Phase 3 centralized password strength & hashing.
 * Clears mustChangePassword to false upon successful update.
 *
 * @param {string} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const changeUserPassword = async (userId, currentPassword, newPassword, ip = null, userAgent = null) => {
  const { hashPassword, validatePasswordStrength } = await import('../utils/password.js');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, madrasaId: true, isActive: true },
  });

  if (!user || !user.isActive) {
    const error = new Error('User account not found or deactivated.');
    error.statusCode = 401;
    throw error;
  }

  // Verify current password
  const isMatch = await comparePassword(currentPassword, user.passwordHash);
  if (!isMatch) {
    const error = new Error('Current password does not match.');
    error.statusCode = 400;
    throw error;
  }

  // Validate new password policy using centralized Phase 3 strength validator
  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) {
    const error = new Error(strength.message || 'New password does not meet security requirements.');
    error.statusCode = 400;
    throw error;
  }

  if (currentPassword === newPassword) {
    const error = new Error('New password must be different from current password.');
    error.statusCode = 400;
    throw error;
  }

  // Hash new password using centralized cost factor 12
  const newPasswordHash = await hashPassword(newPassword);

  // Update password, reset mustChangePassword, and increment tokenVersion to revoke prior JWTs
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
    }),
    prisma.activityLog.create({
      data: {
        action: 'PASSWORD_CHANGED',
        userId: user.id,
        madrasaId: user.madrasaId || null,
        ipAddress: ip ? String(ip).slice(0, 45) : null,
        userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
      },
    }),
  ]);

  return {
    success: true,
    message: 'Password changed successfully.',
  };
};

/**
 * Verifies validity of a one-time password setup token.
 * Validates expiration, single-use state, and associated user/tenant state.
 * Never leaks token hash, passwords, or session tokens.
 */
export const verifyPasswordSetupToken = async (rawToken) => {
  if (!rawToken || typeof rawToken !== 'string') {
    const error = new Error('Setup token is required.');
    error.statusCode = 400;
    throw error;
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const tokenRecord = await prisma.passwordSetupToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          role: true,
          madrasaId: true,
          madrasa: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!tokenRecord) {
    const error = new Error('Invalid or unrecognized setup token.');
    error.statusCode = 400;
    throw error;
  }

  if (tokenRecord.usedAt) {
    const error = new Error('This setup link has already been used.');
    error.statusCode = 400;
    throw error;
  }

  if (new Date() > new Date(tokenRecord.expiresAt)) {
    const error = new Error('This setup link has expired. Please contact your platform administrator for a new link.');
    error.statusCode = 400;
    throw error;
  }

  const user = tokenRecord.user;
  if (!user || !user.isActive) {
    const error = new Error('The account associated with this setup link is disabled.');
    error.statusCode = 403;
    throw error;
  }

  if (user.role === 'MADRASA_ADMIN' && user.madrasa && user.madrasa.status !== 'ACTIVE') {
    const error = new Error(`Madrasa workspace is ${user.madrasa.status.toLowerCase()}.`);
    error.statusCode = 403;
    throw error;
  }

  return {
    valid: true,
    email: user.email,
    name: user.name,
    madrasaName: user.madrasa?.name || null,
  };
};

/**
 * Sets new password using a verified single-use setup token.
 * Enforces single-use token consumption, clears mustChangePassword,
 * increments tokenVersion to revoke stale JWTs, and records non-sensitive ActivityLog.
 */
export const setupPasswordWithToken = async ({ rawToken, newPassword, ip = null, userAgent = null }) => {
  const { hashPassword, validatePasswordStrength } = await import('../utils/password.js');

  if (!rawToken || typeof rawToken !== 'string') {
    const error = new Error('Setup token is required.');
    error.statusCode = 400;
    throw error;
  }

  // Validate new password strength
  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) {
    const error = new Error(strength.message || 'Password does not meet security requirements.');
    error.statusCode = 400;
    throw error;
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const tokenRecord = await prisma.passwordSetupToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          isActive: true,
          role: true,
          madrasaId: true,
          madrasa: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!tokenRecord) {
    const error = new Error('Invalid or unrecognized setup token.');
    error.statusCode = 400;
    throw error;
  }

  if (tokenRecord.usedAt) {
    const error = new Error('This setup link has already been used.');
    error.statusCode = 400;
    throw error;
  }

  if (new Date() > new Date(tokenRecord.expiresAt)) {
    const error = new Error('This setup link has expired. Please contact your platform administrator for a new link.');
    error.statusCode = 400;
    throw error;
  }

  const user = tokenRecord.user;
  if (!user || !user.isActive) {
    const error = new Error('The account associated with this setup link is disabled.');
    error.statusCode = 403;
    throw error;
  }

  if (user.role === 'MADRASA_ADMIN' && user.madrasa && user.madrasa.status !== 'ACTIVE') {
    const error = new Error(`Madrasa workspace is ${user.madrasa.status.toLowerCase()}.`);
    error.statusCode = 403;
    throw error;
  }

  const newPasswordHash = await hashPassword(newPassword);
  const now = new Date();

  // Atomically update user, mark token used, invalidate prior setup tokens, and log activity
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
    }),
    prisma.passwordSetupToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: now },
    }),
    prisma.passwordSetupToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    }),
    prisma.activityLog.create({
      data: {
        action: 'PASSWORD_SETUP_COMPLETED',
        userId: user.id,
        madrasaId: user.madrasaId || null,
        metadata: {
          email: user.email,
        },
        ipAddress: ip ? String(ip).slice(0, 45) : null,
        userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
      },
    }),
  ]);

  return {
    success: true,
    message: 'Password set up successfully. You may now sign in with your administrator email.',
  };
};
