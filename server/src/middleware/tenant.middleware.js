import { prisma } from '../lib/prisma.js';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../utils/errors.js';

/**
 * Tenant Context Middleware for Madrasa Admins.
 *
 * Strict Tenant Isolation Rules:
 * 1. Must run AFTER authenticateToken.
 * 2. Authenticated user role must be MADRASA_ADMIN.
 * 3. The ONLY authoritative tenant source is req.auth.madrasaId.
 * 4. Never trusts req.body.madrasaId, req.query.madrasaId, req.params.madrasaId, or headers.
 * 5. Does NOT mutate req.query (compatible with Express 5).
 * 6. Verifies tenant Madrasa exists and is ACTIVE.
 * 7. Attaches normalized req.tenant = { madrasaId }.
 */
export const requireTenantContext = async (req, res, next) => {
  try {
    if (!req.auth || !req.auth.userId) {
      throw new UnauthorizedError('Authentication token is required before establishing tenant context.');
    }

    if (req.auth.role !== 'MADRASA_ADMIN') {
      throw new ForbiddenError('Tenant workspace requires Madrasa Admin privileges.');
    }

    if (req.auth.mustChangePassword) {
      return res.status(403).json({
        success: false,
        code: 'MUST_CHANGE_PASSWORD',
        message: 'Mandatory password change required before accessing tenant workspace.',
      });
    }

    const trustedMadrasaId = req.auth.madrasaId;
    if (!trustedMadrasaId) {
      throw new ForbiddenError('User is not associated with an authorized Madrasa.');
    }

    // Live verification that the Madrasa exists and remains ACTIVE
    const madrasa = await prisma.madrasa.findUnique({
      where: { id: trustedMadrasaId },
      select: { id: true, status: true, code: true, name: true },
    });

    if (!madrasa) {
      throw new NotFoundError('Madrasa workspace not found.');
    }

    if (madrasa.status !== 'ACTIVE') {
      throw new ForbiddenError(`Madrasa workspace is ${madrasa.status.toLowerCase()}. Access restricted.`);
    }

    // Attach immutable server-derived tenant context
    req.tenant = Object.freeze({
      madrasaId: madrasa.id,
      code: madrasa.code,
      name: madrasa.name,
    });

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Platform Target Resolution Middleware for Super Admins ONLY.
 *
 * Strict Platform Rules:
 * 1. Must run AFTER authenticateToken and requireRoles('SUPER_ADMIN').
 * 2. Does NOT modify req.auth.madrasaId (which strictly remains null).
 * 3. Validates an explicit target Madrasa ID supplied via route parameters (e.g. :madrasaId).
 * 4. Attaches normalized req.platformTarget = { madrasaId, ... }.
 */
export const resolvePlatformTargetMadrasa = (paramName = 'madrasaId') => {
  return async (req, res, next) => {
    try {
      if (!req.auth || req.auth.role !== 'SUPER_ADMIN') {
        throw new ForbiddenError('Platform target resolution requires Super Admin privileges.');
      }

      const targetMadrasaId = req.params[paramName];
      if (!targetMadrasaId) {
        throw new NotFoundError('Target Madrasa identifier is required in route parameter.');
      }

      const madrasa = await prisma.madrasa.findUnique({
        where: { id: targetMadrasaId },
        select: { id: true, status: true, code: true, name: true },
      });

      if (!madrasa) {
        throw new NotFoundError('Target Madrasa not found.');
      }

      // Attach platform target context without altering Super Admin auth state
      req.platformTarget = Object.freeze({
        madrasaId: madrasa.id,
        code: madrasa.code,
        name: madrasa.name,
        status: madrasa.status,
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Rejects client-supplied tenant overrides in req.body for tenant-scoped routes.
 * Does NOT mutate req.query. Ensures callers do not attempt to supply foreign madrasaId.
 */
export const rejectClientSuppliedTenantOverride = (req, res, next) => {
  if (req.body && typeof req.body === 'object' && 'madrasaId' in req.body) {
    // If client supplied a madrasaId that doesn't match their authenticated tenant, or attempt to override
    if (req.auth && req.auth.role === 'MADRASA_ADMIN' && req.auth.madrasaId) {
      if (req.body.madrasaId !== req.auth.madrasaId) {
        return res.status(403).json({
          success: false,
          message: 'Specifying or altering tenant ownership is not permitted.',
        });
      }
    }
  }
  next();
};
