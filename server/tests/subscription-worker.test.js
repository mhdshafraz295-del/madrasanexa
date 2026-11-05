import './setup-test-env.js';
import {
  isDatabaseConnectivityError,
  checkDatabaseReadiness,
  performInitialSyncWithRetry,
  initSubscriptionStatusJob,
  stopSubscriptionStatusJob,
  getSubscriptionStatusJob,
} from '../src/jobs/subscription-status.job.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    failed++;
  }
}

async function runWorkerTests() {
  console.log('\n--- Running Subscription Status Worker & DB Readiness Tests ---');

  // Test 1: Error Classification for Connectivity Errors
  const p1001Error = { code: 'P1001', message: "Can't reach database server at 127.0.0.1:3306" };
  assert(isDatabaseConnectivityError(p1001Error), '1.1 P1001 classified as connectivity error');

  const p1002Error = { code: 'P1002', message: 'Connection timed out' };
  assert(isDatabaseConnectivityError(p1002Error), '1.2 P1002 classified as connectivity error');

  const initError = { name: 'PrismaClientInitializationError', message: 'Unable to connect' };
  assert(isDatabaseConnectivityError(initError), '1.3 PrismaClientInitializationError classified as connectivity error');

  const refusedError = new Error('connect ECONNREFUSED 127.0.0.1:3306');
  assert(isDatabaseConnectivityError(refusedError), '1.4 ECONNREFUSED classified as connectivity error');

  // Test 2: Error Classification for Unrelated Application Errors (Must not be silenced)
  const appSyntaxError = new TypeError('Cannot read properties of undefined');
  assert(!isDatabaseConnectivityError(appSyntaxError), '2.1 Application TypeError is NOT classified as connectivity error');

  const validationError = { code: 'P2002', message: 'Unique constraint failed on the fields: (`code`)' };
  assert(!isDatabaseConnectivityError(validationError), '2.2 P2002 unique constraint is NOT classified as connectivity error');

  // Test 3: DB Ready → Initial Subscription Sync Runs Once
  let syncCount = 0;
  const mockPrismaReady = {
    $queryRawUnsafe: async () => [{ 1: 1 }],
  };
  const mockSyncFn = async () => {
    syncCount++;
    return { expiredCount: 0, expiringSoonCount: 0, activeCount: 5 };
  };

  const readyRes = await performInitialSyncWithRetry({
    delaysMs: [10, 10],
    prismaClient: mockPrismaReady,
    syncFn: mockSyncFn,
  });
  assert(readyRes.success === true, '3.1 Returns success: true when DB is ready');
  assert(syncCount === 1, '3.2 Sync function executed exactly once on ready DB');

  // Test 4: DB Temporarily Unavailable → Retry Occurs and Succeeds
  let queryAttempts = 0;
  let retrySyncCount = 0;
  const mockPrismaFlaky = {
    $queryRawUnsafe: async () => {
      queryAttempts++;
      if (queryAttempts < 3) {
        const err = new Error("Can't reach database server at 127.0.0.1:3306");
        err.code = 'P1001';
        throw err;
      }
      return [{ 1: 1 }];
    },
  };
  const mockFlakySyncFn = async () => {
    retrySyncCount++;
    return { expiredCount: 1, expiringSoonCount: 0, activeCount: 2 };
  };

  const flakyRes = await performInitialSyncWithRetry({
    delaysMs: [20, 20, 20],
    prismaClient: mockPrismaFlaky,
    syncFn: mockFlakySyncFn,
  });
  assert(flakyRes.success === true, '4.1 Recovers and succeeds when DB becomes available on retry');
  assert(queryAttempts === 3, '4.2 Exactly 3 readiness attempts performed before succeeding');
  assert(retrySyncCount === 1, '4.3 Sync function executed once after DB becomes reachable');

  // Test 5: DB Stays Unavailable → Graceful Skip (No Crash, No Unhandled Rejection)
  let failAttempts = 0;
  const mockPrismaDown = {
    $queryRawUnsafe: async () => {
      failAttempts++;
      const err = new Error("Can't reach database server at 127.0.0.1:3306");
      err.code = 'P1001';
      throw err;
    },
  };
  let failedSyncCalled = false;
  const mockNeverCalledSync = async () => {
    failedSyncCalled = true;
    return {};
  };

  const downRes = await performInitialSyncWithRetry({
    delaysMs: [10, 10, 10],
    prismaClient: mockPrismaDown,
    syncFn: mockNeverCalledSync,
  });
  assert(downRes.success === false && downRes.skipped === true, '5.1 Gracefully skipped when DB remains unavailable');
  assert(failAttempts === 4, '5.2 Initial check + 3 retries performed (total 4 attempts)');
  assert(!failedSyncCalled, '5.3 Business sync function NOT called when DB is down');

  // Test 6: Hourly Cron Remains Registered Exactly Once (Duplicate Protection)
  stopSubscriptionStatusJob();
  assert(getSubscriptionStatusJob() === null, '6.1 Initial cron task is null after stop');

  initSubscriptionStatusJob({
    delaysMs: [10],
    prismaClient: mockPrismaReady,
    syncFn: mockSyncFn,
  });
  const task1 = getSubscriptionStatusJob();
  assert(task1 !== null, '6.2 Worker scheduled successfully');

  // Call again (e.g. simulated hot-reload)
  initSubscriptionStatusJob({
    delaysMs: [10],
    prismaClient: mockPrismaReady,
    syncFn: mockSyncFn,
  });
  const task2 = getSubscriptionStatusJob();
  assert(task2 !== null, '6.3 Worker recreated on second init');
  stopSubscriptionStatusJob();
  assert(getSubscriptionStatusJob() === null, '6.4 Stopped cleanly without lingering tasks');
  await new Promise((r) => setTimeout(r, 50));

  // Test 7: Non-connectivity Error in Sync Fn is Caught and Reported (Not Swallowed)
  let appErrorLogged = false;
  const origConsoleError = console.error;
  console.error = (...args) => {
    if (args[0]?.includes('[Subscription Job] Initial synchronization error:')) {
      appErrorLogged = true;
    }
    origConsoleError(...args);
  };

  const mockAppErrorSync = async () => {
    throw new Error('Specific application logic error inside sync');
  };

  const appErrRes = await performInitialSyncWithRetry({
    delaysMs: [10],
    prismaClient: mockPrismaReady,
    syncFn: mockAppErrorSync,
  });
  console.error = origConsoleError;

  assert(appErrRes.success === false, '7.1 Application error returns success: false');
  assert(appErrorLogged, '7.2 Application error was logged via console.error for developer visibility');

  console.log(`\n========================================`);
  console.log(`WORKER READINESS TEST RESULTS:`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runWorkerTests().catch((err) => {
  console.error('Fatal worker test error:', err);
  process.exit(1);
});
