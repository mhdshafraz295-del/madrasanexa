import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { synchronizeSubscriptionStatuses } from '../services/subscription.service.js';

let cronTask = null;
let isInitialSyncInProgress = false;

// Default bounded retry backoff in ms (Attempt 1: 2s, 2: 3s, 3: 5s, 4: 8s, 5: 10s)
export const DEFAULT_RETRY_DELAYS_MS = [2000, 3000, 5000, 8000, 10000];

/**
 * Helper to safely classify Prisma connectivity / database reachability errors.
 * Distinguishes transient infrastructure issues from application bugs.
 */
export function isDatabaseConnectivityError(error) {
  if (!error) return false;
  const code = error.code;
  if (['P1001', 'P1002', 'P1008', 'P1017'].includes(code)) return true;
  if (error.name === 'PrismaClientInitializationError') return true;

  const message = error.message || '';
  return (
    message.includes("Can't reach database server") ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ENOTFOUND') ||
    message.includes('Connection refused') ||
    message.includes('Lost connection') ||
    message.includes('handshake: reading initial communication packet') ||
    message.includes('system error: 138') ||
    message.includes('Server has closed the connection')
  );
}

/**
 * Non-destructive readiness check against database using the canonical Prisma client.
 */
export async function checkDatabaseReadiness(prismaClient = prisma) {
  try {
    await prismaClient.$queryRawUnsafe('SELECT 1');
    return { ready: true };
  } catch (error) {
    return {
      ready: false,
      isConnectivityError: isDatabaseConnectivityError(error),
      error,
    };
  }
}

/**
 * Performs the initial subscription synchronization with bounded retry backoff.
 * Ensures the worker never spams stack traces or crashes the process if database is not ready.
 */
export async function performInitialSyncWithRetry({
  delaysMs = DEFAULT_RETRY_DELAYS_MS,
  prismaClient = prisma,
  syncFn = synchronizeSubscriptionStatuses,
} = {}) {
  if (isInitialSyncInProgress) {
    return { skipped: true, reason: 'Already in progress' };
  }

  isInitialSyncInProgress = true;
  let attempt = 0;
  const maxAttempts = delaysMs.length;

  try {
    // Attempt initial readiness check immediately
    let readiness = await checkDatabaseReadiness(prismaClient);

    while (!readiness.ready && attempt < maxAttempts) {
      const waitMs = delaysMs[attempt];
      attempt++;
      console.warn(
        `[Database] Database service not ready. Retrying in ${waitMs / 1000}s (Attempt ${attempt}/${maxAttempts})...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      readiness = await checkDatabaseReadiness(prismaClient);
    }

    if (!readiness.ready) {
      console.warn('[Database] Database service unavailable.');
      console.warn('[Subscription Job] Initial sync skipped; next retry will occur safely on scheduled hourly run.');
      return { success: false, attempts: attempt, skipped: true };
    }

    // Database is ready Ã¢â‚¬â€ proceed with initial synchronization
    console.log('[Database] Database connection established.');
    const result = await syncFn(new Date());
    console.log(
      `[Subscription Job] Initial status synchronization complete: ` +
      `${result.expiredCount} expired, ${result.expiringSoonCount} expiring soon, ${result.activeCount} active.`
    );
    return { success: true, attempts: attempt, result };
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      console.warn(
        '[Subscription Job] Initial synchronization skipped: database is temporarily unavailable.'
      );
    } else {
      // Non-connectivity errors (real application bugs) should not be silently swallowed
      console.error('[Subscription Job] Initial synchronization error:', error.message);
    }
    return { success: false, error: error.message };
  } finally {
    isInitialSyncInProgress = false;
  }
}

/**
 * Initializes the background scheduled subscription synchronization worker.
 *
 * Schedule: Hourly at minute 0 ('0 * * * *').
 * Ensures single registration per process and non-blocking readiness-backed initial sync.
 */
export function initSubscriptionStatusJob({
  delaysMs = DEFAULT_RETRY_DELAYS_MS,
  prismaClient = prisma,
  syncFn = synchronizeSubscriptionStatuses,
} = {}) {
  if (
    process.env.NODE_ENV === 'test' &&
    delaysMs === DEFAULT_RETRY_DELAYS_MS &&
    prismaClient === prisma &&
    syncFn === synchronizeSubscriptionStatuses
  ) {
    return null;
  }

  // Prevent duplicate cron task registrations on process reload
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }

  // 1. Initial non-blocking startup run backed by bounded readiness retries
  performInitialSyncWithRetry({ delaysMs, prismaClient, syncFn }).catch((err) => {
    console.error('[Subscription Job] Unexpected failure in initial sync runner:', err.message);
  });

  // 2. Schedule recurring hourly execution
  cronTask = cron.schedule('0 * * * *', async () => {
    try {
      const result = await syncFn(new Date());
      console.log(
        `[Subscription Job] Hourly synchronization complete: ` +
        `${result.expiredCount} expired, ${result.expiringSoonCount} expiring soon, ${result.activeCount} active.`
      );
    } catch (error) {
      if (isDatabaseConnectivityError(error)) {
        console.warn(
          '[Subscription Job] Hourly synchronization skipped: database is temporarily unavailable.'
        );
      } else {
        console.error('[Subscription Job] Hourly synchronization error:', error.message);
      }
    }
  });

  console.log('Ã¢ÂÂ° Subscription status synchronization worker scheduled (hourly: 0 * * * *).');
  return cronTask;
}

/**
 * Stops the scheduled job during graceful server shutdown.
 */
export function stopSubscriptionStatusJob() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('Subscription status synchronization worker stopped.');
  }
}

/**
 * Returns active cron task reference for inspection and testing.
 */
export function getSubscriptionStatusJob() {
  return cronTask;
}
