import { resolveSubscriptionAccess } from '../services/subscription.service.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

/**
 * Subscription Guard Middleware for MadrasaNexa Tenant Routes.
 *
 * Rules:
 * 1. Must run AFTER authenticateToken and requireTenantContext.
 * 2. Intended exclusively for tenant business modules (e.g. Students, Classes, Fees).
 * 3. Super Admin platform routes MUST NOT mount this middleware.
 *    If erroneously mounted without tenant context or for Super Admin, it rejects explicitly.
 * 4. Resolves subscription status dynamically at request-time via server UTC.
 * 5. Returns structured 403 with machine-readable code (SUBSCRIPTION_EXPIRED, SUBSCRIPTION_REQUIRED, etc.).
 * 6. Never triggers user session logout or deletes any data.
 */
export const requireActiveSubscription = async (req, res, next) => {
  try {
    if (!req.auth || !req.auth.userId) {
      throw new UnauthorizedError('Authentication required before subscription evaluation.');
    }

    // Explicit rejection if mistakenly mounted on Super Admin platform routes
    if (req.auth.role === 'SUPER_ADMIN') {
      throw new ForbiddenError('Super Admin platform routes must not mount tenant subscription guard.');
    }

    // Require tenant context
    if (!req.tenant || !req.tenant.madrasaId) {
      throw new ForbiddenError('Tenant context is required for subscription validation.');
    }

    const access = await resolveSubscriptionAccess(req.tenant.madrasaId, new Date());

    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        message: access.reason || 'Active subscription required to access this workspace module.',
        code: access.code,
        subscription: access.subscription ? {
          id: access.subscription.id,
          status: access.status,
          startsAt: access.subscription.startsAt,
          endsAt: access.subscription.endsAt,
          plan: access.subscription.plan ? {
            id: access.subscription.plan.id,
            name: access.subscription.plan.name,
            code: access.subscription.plan.code,
          } : null,
        } : null,
      });
    }

    // Attach resolved subscription context to request
    req.subscription = Object.freeze(access);
    next();
  } catch (error) {
    next(error);
  }
};
