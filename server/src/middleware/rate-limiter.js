import { prisma } from '../lib/prisma.js';

/**
 * Atomic Database Fixed-Window Rate Limiter
 * Safe across multiple instances without per-request table cleanup.
 */
export async function checkDatabaseRateLimit(key, maxLimit, windowMs) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.rateLimitBucket.findUnique({
      where: { key },
    });

    let points = 1;
    let bucketResetAt = resetAt;

    if (!existing || new Date(existing.resetAt) < now) {
      await tx.rateLimitBucket.upsert({
        where: { key },
        create: { key, points: 1, resetAt },
        update: { points: 1, resetAt },
      });
    } else {
      const updated = await tx.rateLimitBucket.update({
        where: { key },
        data: { points: { increment: 1 } },
        select: { points: true, resetAt: true },
      });
      points = updated.points;
      bucketResetAt = updated.resetAt;
    }

    const isAllowed = points <= maxLimit;
    const remaining = Math.max(0, maxLimit - points);
    const retryAfterSeconds = Math.max(1, Math.ceil((new Date(bucketResetAt).getTime() - now.getTime()) / 1000));

    return { isAllowed, remaining, retryAfterSeconds };
  });
}

/**
 * Factory for creating express rate limit middleware.
 *
 * @param {object} options
 * @param {string} options.prefix - Key prefix (e.g. 'alumni_search')
 * @param {number} options.maxLimit - Max requests per window
 * @param {number} options.windowMs - Window in milliseconds (e.g. 60000)
 */
export function createRateLimiter({ prefix, maxLimit, windowMs }) {
  return async (req, res, next) => {
    try {
      const tenantId = req.user?.madrasaId || req.tenant?.madrasaId || 'anon';
      const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const key = `rl:${prefix}:${tenantId}:${clientIp}`.slice(0, 190);

      const result = await checkDatabaseRateLimit(key, maxLimit, windowMs);

      res.setHeader('X-RateLimit-Limit', String(maxLimit));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));

      if (!result.isAllowed) {
        res.setHeader('Retry-After', String(result.retryAfterSeconds));
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded. Please retry after ${result.retryAfterSeconds} seconds.`,
            retryAfter: result.retryAfterSeconds,
          },
        });
      }

      next();
    } catch (err) {
      // In case of transient rate limit check error, log and fail-open to not block legitimate users
      console.error('Rate limiter check error:', err);
      next();
    }
  };
}
