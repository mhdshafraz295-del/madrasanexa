import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const JWT_ALGORITHM = 'HS256';

/**
 * Signs an access token with HS256 algorithm and configured expiration.
 *
 * Supported payload claims:
 * - userId: string
 * - role: 'SUPER_ADMIN' | 'MADRASA_ADMIN'
 * - madrasaId: string | null
 *
 * @param {object} payload
 * @param {object} [options]
 * @returns {string} Signed JWT token
 */
export const signAccessToken = (payload, options = {}) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('JWT payload must be an object');
  }

  const { userId, role, madrasaId } = payload;

  if (!userId || !role) {
    throw new Error('JWT payload must include userId and role');
  }

  // Ensure no sensitive or unbounded data is included
  const safePayload = {
    userId: String(userId),
    role: String(role),
    madrasaId: madrasaId ? String(madrasaId) : null,
    tokenVersion: typeof payload.tokenVersion === 'number' ? payload.tokenVersion : 0,
  };

  return jwt.sign(safePayload, env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: options.expiresIn || env.JWT_EXPIRES_IN || '1d',
    ...options,
  });
};

/**
 * Verifies and decodes an access token using HS256.
 *
 * @param {string} token
 * @returns {{ valid: boolean, decoded?: object, error?: string }}
 */
export const verifyAccessToken = (token) => {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      error: 'Token missing or invalid format',
    };
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    });

    if (!decoded || typeof decoded !== 'object' || !decoded.userId || !decoded.role) {
      return {
        valid: false,
        error: 'Token payload missing required claims',
      };
    }

    return {
      valid: true,
      decoded,
    };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return {
        valid: false,
        error: 'Token has expired',
      };
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return {
        valid: false,
        error: 'Invalid token signature or malformed token',
      };
    }
    return {
      valid: false,
      error: 'Token verification failed',
    };
  }
};
