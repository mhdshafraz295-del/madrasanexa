/**
 * Centralized Application Error Classes for MadrasaNexa
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 Not Found
 * Generic message to prevent tenant resource enumeration/IDOR leakage.
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found.') {
    super(message, 404);
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden.') {
    super(message, 403);
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required.') {
    super(message, 401);
  }
}

/**
 * 400 Bad Request
 * Used for syntactical/validation payload errors, never for tenant IDOR discovery.
 */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request.', errors = null) {
    super(message, 400, errors);
  }
}

/**
 * 409 Conflict
 * Used for duplicate entries or state conflicts (e.g. concurrent approval).
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource conflict.') {
    super(message, 409);
  }
}

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable. Please retry.') {
    super(message, 503);
  }
}
