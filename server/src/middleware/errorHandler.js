import { ZodError } from 'zod';
import { env } from '../config/env.js';

export const errorHandler = (err, req, res, _next) => {
  // Always log original error to the terminal for debugging
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  // 1. Handle Zod validation errors (Zod v4 uses `issues`, fallback to `errors` or empty array)
  const isZodError =
    err instanceof ZodError ||
    err?.name === 'ZodError' ||
    Boolean(err?._isZodError);

  if (isZodError) {
    const rawIssues = Array.isArray(err?.issues)
      ? err.issues
      : Array.isArray(err?.errors)
      ? err.errors
      : [];

    const formattedErrors = rawIssues.map((issue) => ({
      path: Array.isArray(issue?.path)
        ? issue.path.join('.')
        : typeof issue?.path === 'string'
        ? issue.path
        : '',
      message: issue?.message || 'Invalid value',
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors,
    });
  }

  // 2. Handle JSON parse errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Malformed JSON payload',
    });
  }

  // 3. Handle Prisma database errors
  if (err?.name === 'PrismaClientKnownRequestError') {
    let statusCode = 400;
    let message = 'Database request failed';

    if (err.code === 'P2002') {
      statusCode = 409;
      const target = Array.isArray(err.meta?.target)
        ? err.meta.target.join(', ')
        : err.meta?.target || 'field';
      message = `A record with this ${target} already exists.`;
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Resource not found.';
    } else if (err.code === 'P2003') {
      statusCode = 400;
      message = 'Related resource not found or invalid foreign key.';
    }

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  if (err?.name === 'PrismaClientValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid database query parameters.',
    });
  }

  // 4. Handle authentication / JWT errors
  if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message:
        err.name === 'TokenExpiredError'
          ? 'Token expired. Please log in again.'
          : 'Invalid or malformed authentication token.',
    });
  }

  // 5. Generic application and unknown errors
  const statusCode = Number.isInteger(err?.statusCode)
    ? err.statusCode
    : Number.isInteger(err?.status)
    ? err.status
    : 500;

  const clientMessage =
    statusCode >= 500 && env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err?.message || 'Internal Server Error';

  const responseBody = {
    success: false,
    message: clientMessage,
  };

  if (Array.isArray(err?.errors)) {
    responseBody.errors = err.errors;
  }

  if (env.NODE_ENV === 'development' && err?.stack) {
    responseBody.stack = err.stack;
  }

  return res.status(statusCode).json(responseBody);
};
