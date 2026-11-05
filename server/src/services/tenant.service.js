import { prisma } from '../lib/prisma.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors.js';
import { assertValidTenantId } from '../lib/tenant-prisma.js';

/**
 * Tenant Service Layer for MadrasaNexa.
 *
 * Provides centralized tenant lifecycle assertions and secure tenant-aware audit logging.
 */

/**
 * Asserts a Madrasa exists and has status ACTIVE.
 * Throws ForbiddenError if SUSPENDED or ARCHIVED.
 * Throws NotFoundError if not found.
 *
 * @param {string} trustedMadrasaId
 * @returns {Promise<object>}
 */
export const getActiveMadrasaOrThrow = async (trustedMadrasaId) => {
  const madrasaId = assertValidTenantId(trustedMadrasaId);

  const madrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
  });

  if (!madrasa) {
    throw new NotFoundError('Madrasa not found.');
  }

  if (madrasa.status !== 'ACTIVE') {
    throw new ForbiddenError(`Madrasa status is ${madrasa.status.toLowerCase()}. Operation forbidden.`);
  }

  return madrasa;
};

/**
 * Asserts a Madrasa exists in the database.
 *
 * @param {string} madrasaId
 * @returns {Promise<object>}
 */
export const assertMadrasaExists = async (madrasaId) => {
  const cleanId = assertValidTenantId(madrasaId);

  const madrasa = await prisma.madrasa.findUnique({
    where: { id: cleanId },
  });

  if (!madrasa) {
    throw new NotFoundError('Madrasa not found.');
  }

  return madrasa;
};

/**
 * Creates an audit ActivityLog entry strictly binding to a trusted tenant or platform context.
 * For Madrasa Admins: madrasaId MUST be derived from server auth/tenant context (never client input).
 * For Super Admins: madrasaId can be null (platform-level) or an explicitly targeted madrasaId.
 *
 * @param {object} params
 * @param {string|null} [params.madrasaId=null] - Server-trusted madrasaId or null for platform
 * @param {string|null} [params.userId=null] - Server-authenticated userId
 * @param {string} params.action - Action string e.g.  STUDENT_UPDATED
 * @param {string|null} [params.entityType=null]
 * @param {string|null} [params.entityId=null]
 * @param {object|null} [params.metadata=null]
 * @param {string|null} [params.ipAddress=null]
 * @param {string|null} [params.userAgent=null]
 * @returns {Promise<object>}
 */
export const logTenantActivity = async ({
  madrasaId = null,
  userId = null,
  action,
  entityType = null,
  entityId = null,
  metadata = null,
  ipAddress = null,
  userAgent = null,
}) => {
  if (!action || typeof action !== 'string') {
    throw new BadRequestError('Activity action is required.');
  }

  // Ensure madrasaId is either null or a non-empty string
  const safeMadrasaId = madrasaId ? String(madrasaId).trim() : null;

  return await prisma.activityLog.create({
    data: {
      madrasaId: safeMadrasaId,
      userId: userId ? String(userId) : null,
      action: action.trim(),
      entityType: entityType ? String(entityType) : null,
      entityId: entityId ? String(entityId) : null,
      metadata: metadata || undefined,
      ipAddress: ipAddress ? String(ipAddress) : null,
      userAgent: userAgent ? String(userAgent) : null,
    },
  });
};
