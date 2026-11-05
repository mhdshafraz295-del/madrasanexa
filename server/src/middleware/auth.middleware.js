import { verifyAccessToken } from '../utils/jwt.js';
import { prisma } from '../lib/prisma.js';

/**
 * Authentication middleware:
 * 1. Validates Bearer token format and signature via verifyAccessToken
 * 2. Queries database in real-time to verify user exists and isActive
 * 3. Verifies role matches current database record
 * 4. For MADRASA_ADMIN, verifies associated Madrasa is ACTIVE
 * 5. Attaches minimal authenticated context (req.auth) without passwordHash
 */
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token is required.',
    });
  }

  const token = authHeader.split(' ')[1];
  const verification = verifyAccessToken(token);

  if (!verification.valid) {
    return res.status(401).json({
      success: false,
      message: verification.error || 'Invalid or expired token.',
    });
  }

  const { userId, role } = verification.decoded;

  try {
    // Real-time database check
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        madrasaId: true,
        isActive: true,
        mustChangePassword: true,
        tokenVersion: true,
        madrasa: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'User account is deactivated.',
      });
    }

    // Validate tokenVersion: JWT tokenVersion must match current database tokenVersion
    const decodedTokenVersion = verification.decoded.tokenVersion;
    const tokenVersionInToken = typeof decodedTokenVersion === 'number' && Number.isInteger(decodedTokenVersion) && decodedTokenVersion >= 0
      ? decodedTokenVersion
      : (decodedTokenVersion === undefined ? 0 : -1);

    if (tokenVersionInToken === -1 || user.tokenVersion !== tokenVersionInToken) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked or invalidated. Please re-authenticate.',
      });
    }

    // Ensure role in token matches current database role
    if (user.role !== role) {
      return res.status(401).json({
        success: false,
        message: 'Token role authorization mismatch. Please re-authenticate.',
      });
    }

    // Madrasa Admin checks
    if (user.role === 'MADRASA_ADMIN') {
      if (!user.madrasaId || !user.madrasa) {
        return res.status(403).json({
          success: false,
          message: 'Madrasa Admin is not associated with an active Madrasa.',
        });
      }

      if (user.madrasa.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: `Madrasa workspace is ${user.madrasa.status.toLowerCase()}. Access restricted.`,
        });
      }
    }

    // Attach minimal authenticated context (NEVER include passwordHash)
    req.auth = {
      userId: user.id,
      role: user.role,
      madrasaId: user.madrasaId,
      mustChangePassword: Boolean(user.mustChangePassword),
    };

    next();
  } catch (error) {
    console.error('Auth middleware database verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal authentication validation error.',
    });
  }
};

/**
 * Reusable middleware ensuring user has completed mandatory password change.
 * Blocks access with 403 and code PASSWORD_CHANGE_REQUIRED if mustChangePassword is true.
 */
export const requirePasswordChanged = (req, res, next) => {
  if (!req.auth) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
  }

  if (req.auth.mustChangePassword) {
    return res.status(403).json({
      success: false,
      code: 'MUST_CHANGE_PASSWORD',
      message: 'Mandatory password change required before accessing platform or workspace modules.',
    });
  }

  next();
};
