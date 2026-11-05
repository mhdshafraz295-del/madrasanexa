import { resolveFeatureEntitlement } from '../services/feature-entitlement.service.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

/**
 * Feature Entitlement Guard Middleware for MadrasaNexa.
 *
 * Rules:
 * 1. Must run AFTER authenticateToken, requirePasswordChanged, requireMadrasaAdmin,
 *    requireTenantContext, and requireActiveSubscription.
 * 2. Uses exclusively the authenticated tenant ID (req.tenant.madrasaId).
 * 3. Never trusts req.body.madrasaId, req.query.madrasaId, or headers.
 * 4. Calls resolveFeatureEntitlement() to enforce strict precedence:
 *    Institution Status -> Subscription Status -> DENY Override -> GRANT Override -> Plan Feature.
 * 5. Rejects unentitled requests with HTTP 403 and machine-readable error codes.
 * 6. Attaches immutable req.entitlement to the request object.
 *
 * @param {string} featureKey - Canonical feature key required for this route
 * @returns {import('express').RequestHandler}
 */
export const requireFeature = (featureKey) => {
  if (!featureKey || typeof featureKey !== 'string') {
    throw new Error('requireFeature middleware requires a non-empty string featureKey.');
  }

  return async (req, res, next) => {
    try {
      // 1. Verify authenticated user
      if (!req.auth || !req.auth.userId) {
        throw new UnauthorizedError('Authentication required before feature entitlement evaluation.');
      }

      // 2. Verify tenant context
      if (!req.tenant || !req.tenant.madrasaId) {
        throw new ForbiddenError('Tenant context is required for feature validation.');
      }

      // 3. Authoritative tenant ID strictly from req.tenant.madrasaId
      const trustedMadrasaId = req.tenant.madrasaId;

      // 4. Resolve feature entitlement
      const entitlement = await resolveFeatureEntitlement(trustedMadrasaId, featureKey, new Date());

      // 5. Fail-closed: reject if not explicitly allowed
      if (!entitlement.allowed) {
        return res.status(403).json({
          success: false,
          code: entitlement.code || 'FEATURE_NOT_IN_PLAN',
          message: entitlement.reason || `Access denied: institution is not entitled to feature "${featureKey}".`,
          featureKey,
        });
      }

      // 6. Attach immutable entitlement context
      req.entitlement = Object.freeze(entitlement);
      next();
    } catch (error) {
      next(error);
    }
  };
};
