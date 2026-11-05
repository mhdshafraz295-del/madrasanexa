/**
 * Role-based authorization middleware generator.
 *
 * @param  {...string} allowedRoles - e.g. 'SUPER_ADMIN', 'MADRASA_ADMIN'
 * @returns {import('express').RequestHandler}
 */
export const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.auth || !req.auth.role) {
      return res.status(401).json({
        success: false,
        message: 'Unauthenticated request.',
      });
    }

    if (!allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient privileges for this resource.',
      });
    }

    next();
  };
};

export const requireSuperAdmin = requireRoles('SUPER_ADMIN');
export const requireMadrasaAdmin = requireRoles('MADRASA_ADMIN');
