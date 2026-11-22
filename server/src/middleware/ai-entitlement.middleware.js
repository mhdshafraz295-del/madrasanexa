import { prisma } from '../lib/prisma.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

/**
 * Middleware ensuring Madrasa tenant has an active, unexpired AI Assistant subscription.
 * Permitted for:
 * - SUPER_ADMIN (always allowed)
 * - MADRASA_ADMIN (must have active tenant subscription)
 * - TEACHER (must have active tenant subscription)
 */
export const requireActiveAiSubscription = async (req, res, next) => {
  try {
    if (!req.auth || !req.auth.userId) {
      throw new UnauthorizedError('Authentication token is required to access AI Assistant.');
    }

    // Super Admin has global platform privilege
    if (req.auth.role === 'SUPER_ADMIN') {
      return next();
    }

    if (req.auth.role !== 'MADRASA_ADMIN' && req.auth.role !== 'TEACHER') {
      throw new ForbiddenError('AI Assistant is strictly reserved for Madrasa Administrators and Ustadhs.');
    }

    const madrasaId = req.auth.madrasaId;
    if (!madrasaId) {
      throw new ForbiddenError('User is not associated with an active Madrasa tenant.');
    }

    const madrasa = await prisma.madrasa.findUnique({
      where: { id: madrasaId },
      select: {
        id: true,
        status: true,
        aiEnabled: true,
        aiExpiresAt: true,
        name: true,
        code: true,
      },
    });

    if (!madrasa || madrasa.status !== 'ACTIVE') {
      throw new ForbiddenError('Madrasa workspace is not active.');
    }

    const now = new Date();
    const isExpired = Boolean(madrasa.aiExpiresAt && new Date(madrasa.aiExpiresAt) <= now);
    const isActive = Boolean(madrasa.aiEnabled && !isExpired);

    if (!isActive) {
      return res.status(403).json({
        success: false,
        code: 'AI_LOCKED',
        message: 'AI Assistant is currently disabled or expired for this Madrasa.',
        isExpired,
        aiExpiresAt: madrasa.aiExpiresAt,
      });
    }

    // Attach tenant context
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

export const requireAiEnabled = requireActiveAiSubscription;
