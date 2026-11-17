import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { getColomboTimeContext } from '../utils/dateTime.js';

let cronTask = null;

/**
 * Finds any ClassPeriodAttendanceSession where submittedAt is null (unsealed)
 * and sessionDate is strictly prior to today's date in Asia/Colombo,
 * and seals them by setting submittedAt to new Date().
 *
 * @returns {Promise<{ updatedCount: number }>}
 */
export async function autoSealPastPeriodSessions() {
  try {
    const colomboNow = getColomboTimeContext();
    const today = new Date(`${colomboNow.localDateStr}T00:00:00.000Z`);

    if (!prisma.classPeriodAttendanceSession) {
      return { updatedCount: 0 };
    }

    const result = await prisma.classPeriodAttendanceSession.updateMany({
      where: {
        submittedAt: null,
        sessionDate: {
          lt: today,
        },
      },
      data: {
        submittedAt: new Date(),
      },
    });

    if (result.count > 0) {
      console.log(`[AutoSealJob] Successfully auto-sealed ${result.count} unsealed past period attendance session(s).`);
    }

    return { updatedCount: result.count };
  } catch (error) {
    console.error('[AutoSealJob] Error auto-sealing past period attendance sessions:', error);
    return { updatedCount: 0, error: error.message };
  }
}

/**
 * Initializes and starts the nightly cron job scheduled for 23:59 Asia/Colombo.
 * Safe against multiple invocations.
 */
export function startAutoSealPeriodAttendanceJob() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }

  // 59 23 * * * = 11:59 PM every night in Asia/Colombo timezone
  cronTask = cron.schedule(
    '59 23 * * *',
    async () => {
      await autoSealPastPeriodSessions();
    },
    {
      timezone: 'Asia/Colombo',
    }
  );

  return cronTask;
}

/**
 * Stops the active auto-seal cron task gracefully.
 */
export function stopAutoSealPeriodAttendanceJob() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}

/**
 * Returns active cron task reference for testing and status checks.
 */
export function getAutoSealJobTask() {
  return cronTask;
}
