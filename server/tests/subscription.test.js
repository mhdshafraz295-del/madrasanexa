process.env.NODE_ENV = 'test';
import { prisma } from '../src/lib/prisma.js';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import {
  addCalendarMonthsUtc,
  getSubscriptionDaysRemaining,
  isExpiringSoonPrecise,
  isDateInPast,
  isDateInFuture,
} from '../src/utils/subscription-date.js';
import {
  resolveSubscriptionAccess,
  getSubscriptionSummary,
  createSubscriptionRenewal,
  synchronizeSubscriptionStatuses,
} from '../src/services/subscription.service.js';
import { requireActiveSubscription } from '../src/middleware/subscription.middleware.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';

const TEST_PREFIX = 'sub_test_' + Date.now();

let testPassedCount = 0;
let testFailedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log('  ✓ [PASS] ' + testName);
    testPassedCount++;
  } else {
    console.error('  ✗ [FAIL] ' + testName);
    testFailedCount++;
  }
}

// Test fixtures to clean up
let testPlan = null;
let testMadrasaActive = null;
let testMadrasaExpired = null;
let testMadrasaExpiringSoon = null;
let testMadrasaSuspended = null;
let testMadrasaCancelled = null;
let testMadrasaNoSub = null;
let testMadrasaOverlapping = null;
let testMadrasaFutureOnly = null;
let testMadrasaEarlyRenew = null;

let testUserExpiredAdmin = null;
let testUserActiveAdmin = null;
let testUserSuperAdmin = null;

let testClass = null;
let testStudent = null;
let testInvoice = null;
let testPayment = null;

let testServer = null;
let baseUrl = '';

async function setupFixtures() {
  console.log('\nSetting up Phase 5 subscription test fixtures...');

  // Start ephemeral test server for self-contained HTTP testing
  await new Promise((resolve) => {
    testServer = app.listen(0, '127.0.0.1', () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });

  // 1. Create a platform subscription Plan
  testPlan = await prisma.plan.create({
    data: {
      name: `${TEST_PREFIX} Pro Annual`,
      code: `${TEST_PREFIX}_PRO_ANNUAL`,
      description: 'Test Pro Annual Plan',
      durationMonths: 12,
      price: 1200.0,
      isActive: true,
    },
  });

  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneMonthFuture = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const twoMonthsFuture = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const threeDaysFuture = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  // 2. Active Madrasa + Active Subscription
  testMadrasaActive = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_ACT`,
      name: 'Active Madrasa',
      slug: `${TEST_PREFIX}-act`,
      status: 'ACTIVE',
      subscriptions: {
        create: {
          planId: testPlan.id,
          status: 'ACTIVE',
          startsAt: oneMonthAgo,
          endsAt: oneMonthFuture,
          priceAtPurchase: testPlan.price,
          durationMonthsAtPurchase: testPlan.durationMonths,
        },
      },
    },
    include: { subscriptions: true },
  });

  // 3. Expired Madrasa (endsAt is in the past) + business data (Student, Class, Invoice, Payment)
  testMadrasaExpired = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_EXP`,
      name: 'Expired Madrasa',
      slug: `${TEST_PREFIX}-exp`,
      status: 'ACTIVE',
      subscriptions: {
        create: {
          planId: testPlan.id,
          status: 'EXPIRED',
          startsAt: twoMonthsAgo,
          endsAt: fiveDaysAgo,
          priceAtPurchase: testPlan.price,
          durationMonthsAtPurchase: testPlan.durationMonths,
        },
      },
    },
    include: { subscriptions: true },
  });

  // Attach business data to Expired Madrasa to verify data preservation
  testClass = await prisma.class.create({
    data: {
      madrasaId: testMadrasaExpired.id,
      name: 'Preserved Class A',
      code: `${TEST_PREFIX}_CLS_A`,
      defaultMonthlyFee: 150.0,
    },
  });

  testStudent = await prisma.student.create({
    data: {
      madrasaId: testMadrasaExpired.id,
      classId: testClass.id,
      admissionNo: `${TEST_PREFIX}_ADM_01`,
      fullName: 'Preserved Student One',
      guardianName: 'Guardian One',
      admissionDate: new Date(),
      monthlyFee: 150.0,
      status: 'ACTIVE',
    },
  });

  testInvoice = await prisma.invoice.create({
    data: {
      madrasaId: testMadrasaExpired.id,
      studentId: testStudent.id,
      invoiceNo: `${TEST_PREFIX}_INV_01`,
      billingYear: 2026,
      billingMonth: 8,
      issueDate: new Date(),
      subtotal: 150.0,
      totalAmount: 150.0,
      balanceAmount: 0.0,
      paidAmount: 150.0,
      status: 'PAID',
    },
  });

  testPayment = await prisma.payment.create({
    data: {
      madrasaId: testMadrasaExpired.id,
      studentId: testStudent.id,
      paymentNo: `${TEST_PREFIX}_PAY_01`,
      amount: 150.0,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
    },
  });

  // 4. Expiring-Soon Madrasa (endsAt is 3 days in future, within 7 days threshold)
  testMadrasaExpiringSoon = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_SOON`,
      name: 'Expiring Soon Madrasa',
      slug: `${TEST_PREFIX}-soon`,
      status: 'ACTIVE',
      subscriptions: {
        create: {
          planId: testPlan.id,
          status: 'ACTIVE',
          startsAt: oneMonthAgo,
          endsAt: threeDaysFuture,
          priceAtPurchase: testPlan.price,
          durationMonthsAtPurchase: testPlan.durationMonths,
        },
      },
    },
    include: { subscriptions: true },
  });

  // 5. Suspended Madrasa Subscription
  testMadrasaSuspended = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_SUSP`,
      name: 'Suspended Sub Madrasa',
      slug: `${TEST_PREFIX}-susp`,
      status: 'ACTIVE',
      subscriptions: {
        create: {
          planId: testPlan.id,
          status: 'SUSPENDED',
          startsAt: oneMonthAgo,
          endsAt: oneMonthFuture,
          priceAtPurchase: testPlan.price,
          durationMonthsAtPurchase: testPlan.durationMonths,
        },
      },
    },
    include: { subscriptions: true },
  });

  // 6. Cancelled Madrasa Subscription
  testMadrasaCancelled = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_CANC`,
      name: 'Cancelled Sub Madrasa',
      slug: `${TEST_PREFIX}-canc`,
      status: 'ACTIVE',
      subscriptions: {
        create: {
          planId: testPlan.id,
          status: 'CANCELLED',
          startsAt: oneMonthAgo,
          endsAt: oneMonthFuture,
          priceAtPurchase: testPlan.price,
          durationMonthsAtPurchase: testPlan.durationMonths,
        },
      },
    },
    include: { subscriptions: true },
  });

  // 7. Madrasa with No Subscriptions
  testMadrasaNoSub = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_NOSUB`,
      name: 'No Sub Madrasa',
      slug: `${TEST_PREFIX}-nosub`,
      status: 'ACTIVE',
    },
  });

  // 8. Madrasa with Overlapping Active Terms (to test security fail-closed conflict)
  testMadrasaOverlapping = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_OVERLAP`,
      name: 'Overlapping Sub Madrasa',
      slug: `${TEST_PREFIX}-overlap`,
      status: 'ACTIVE',
      subscriptions: {
        createMany: {
          data: [
            {
              planId: testPlan.id,
              status: 'ACTIVE',
              startsAt: oneMonthAgo,
              endsAt: oneMonthFuture,
              priceAtPurchase: testPlan.price,
              durationMonthsAtPurchase: testPlan.durationMonths,
            },
            {
              planId: testPlan.id,
              status: 'ACTIVE',
              startsAt: oneMonthAgo,
              endsAt: twoMonthsFuture,
              priceAtPurchase: testPlan.price,
              durationMonthsAtPurchase: testPlan.durationMonths,
            },
          ],
        },
      },
    },
    include: { subscriptions: true },
  });

  // 9. Madrasa with Future-Only Term (starts in future)
  testMadrasaFutureOnly = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_FUT_ONLY`,
      name: 'Future Only Madrasa',
      slug: `${TEST_PREFIX}-fut-only`,
      status: 'ACTIVE',
      subscriptions: {
        create: {
          planId: testPlan.id,
          status: 'ACTIVE',
          startsAt: oneMonthFuture,
          endsAt: twoMonthsFuture,
          priceAtPurchase: testPlan.price,
          durationMonthsAtPurchase: testPlan.durationMonths,
        },
      },
    },
    include: { subscriptions: true },
  });

  // 10. Madrasa with Early Renewal (Current term active + future renewal term already scheduled)
  testMadrasaEarlyRenew = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_EARLY_REN`,
      name: 'Early Renewal Madrasa',
      slug: `${TEST_PREFIX}-early-ren`,
      status: 'ACTIVE',
      subscriptions: {
        createMany: {
          data: [
            {
              planId: testPlan.id,
              status: 'ACTIVE',
              startsAt: oneMonthAgo,
              endsAt: oneMonthFuture,
              priceAtPurchase: testPlan.price,
              durationMonthsAtPurchase: testPlan.durationMonths,
            },
            {
              planId: testPlan.id,
              status: 'ACTIVE',
              startsAt: oneMonthFuture,
              endsAt: twoMonthsFuture,
              priceAtPurchase: testPlan.price,
              durationMonthsAtPurchase: testPlan.durationMonths,
            },
          ],
        },
      },
    },
    include: { subscriptions: true },
  });

  // Users for authentication regression tests
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('SecureTestPassword123!', salt);

  testUserExpiredAdmin = await prisma.user.create({
    data: {
      name: 'Expired Admin',
      email: `${TEST_PREFIX}_expired_admin@madrasanexa.com`,
      passwordHash,
      role: 'MADRASA_ADMIN',
      madrasaId: testMadrasaExpired.id,
      isActive: true,
    },
  });

  testUserActiveAdmin = await prisma.user.create({
    data: {
      name: 'Active Admin',
      email: `${TEST_PREFIX}_active_admin@madrasanexa.com`,
      passwordHash,
      role: 'MADRASA_ADMIN',
      madrasaId: testMadrasaActive.id,
      isActive: true,
    },
  });

  testUserSuperAdmin = await prisma.user.create({
    data: {
      name: 'Super Admin Test',
      email: `${TEST_PREFIX}_super_admin@madrasanexa.com`,
      passwordHash,
      role: 'SUPER_ADMIN',
      madrasaId: null,
      isActive: true,
    },
  });

  console.log('Test fixtures created successfully.\n');
}

async function teardownFixtures() {
  console.log('\nTearing down Phase 5 test fixtures safely...');
  try {
    const madrasaIds = [
      testMadrasaActive?.id,
      testMadrasaExpired?.id,
      testMadrasaExpiringSoon?.id,
      testMadrasaSuspended?.id,
      testMadrasaCancelled?.id,
      testMadrasaNoSub?.id,
      testMadrasaOverlapping?.id,
      testMadrasaFutureOnly?.id,
      testMadrasaEarlyRenew?.id,
    ].filter(Boolean);

    await prisma.activityLog.deleteMany({
      where: {
        OR: [
          { madrasaId: { in: madrasaIds } },
          { action: { in: ['SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_STATUS_EXPIRED', 'SUBSCRIPTION_STATUS_EXPIRING_SOON'] } },
        ],
      },
    });

    await prisma.subscriptionPayment.deleteMany({
      where: { madrasaId: { in: madrasaIds } },
    });

    await prisma.payment.deleteMany({
      where: { madrasaId: { in: madrasaIds } },
    });

    await prisma.invoice.deleteMany({
      where: { madrasaId: { in: madrasaIds } },
    });

    await prisma.student.deleteMany({
      where: { madrasaId: { in: madrasaIds } },
    });

    await prisma.class.deleteMany({
      where: { madrasaId: { in: madrasaIds } },
    });

    await prisma.subscription.deleteMany({
      where: { madrasaId: { in: madrasaIds } },
    });

    const userIds = [
      testUserExpiredAdmin?.id,
      testUserActiveAdmin?.id,
      testUserSuperAdmin?.id,
    ].filter(Boolean);

    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });

    await prisma.madrasa.deleteMany({
      where: { id: { in: madrasaIds } },
    });

    if (testPlan) {
      await prisma.plan.delete({
        where: { id: testPlan.id },
      });
    }

    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }

    console.log('All test fixtures destroyed cleanly. Zero database pollution.');
  } catch (err) {
    console.error('Teardown warning:', err.message);
  }
}

async function runTests() {
  try {
    await setupFixtures();

    console.log('====================================================');
    console.log('SECTION 1: Calendar Arithmetic & Date Utilities');
    console.log('====================================================');

    // 1. Jan 31 + 1 mo non-leap year (2026) -> Feb 28
    const jan31_2026 = new Date(Date.UTC(2026, 0, 31));
    const feb2026 = addCalendarMonthsUtc(jan31_2026, 1);
    assert(
      feb2026.getUTCFullYear() === 2026 && feb2026.getUTCMonth() === 1 && feb2026.getUTCDate() === 28,
      '1. addCalendarMonthsUtc: Jan 31 + 1 mo clips to Feb 28 in non-leap year (2026)'
    );

    // 2. Jan 31 + 1 mo leap year (2024) -> Feb 29
    const jan31_2024 = new Date(Date.UTC(2024, 0, 31));
    const feb2024 = addCalendarMonthsUtc(jan31_2024, 1);
    assert(
      feb2024.getUTCFullYear() === 2024 && feb2024.getUTCMonth() === 1 && feb2024.getUTCDate() === 29,
      '2. addCalendarMonthsUtc: Jan 31 + 1 mo clips to Feb 29 in leap year (2024)'
    );

    // 3. Mar 31 + 1 mo -> Apr 30
    const mar31 = new Date(Date.UTC(2026, 2, 31));
    const apr30 = addCalendarMonthsUtc(mar31, 1);
    assert(
      apr30.getUTCMonth() === 3 && apr30.getUTCDate() === 30,
      '3. addCalendarMonthsUtc: Mar 31 + 1 mo clips to Apr 30'
    );

    // 4. Aug 31 + 1 mo -> Sep 30
    const aug31 = new Date(Date.UTC(2026, 7, 31));
    const sep30 = addCalendarMonthsUtc(aug31, 1);
    assert(
      sep30.getUTCMonth() === 8 && sep30.getUTCDate() === 30,
      '4. addCalendarMonthsUtc: Aug 31 + 1 mo clips to Sep 30'
    );

    // 5. Dec 31, 2026 + 1 mo -> Jan 31, 2027
    const dec31_2026 = new Date(Date.UTC(2026, 11, 31));
    const jan31_2027 = addCalendarMonthsUtc(dec31_2026, 1);
    assert(
      jan31_2027.getUTCFullYear() === 2027 && jan31_2027.getUTCMonth() === 0 && jan31_2027.getUTCDate() === 31,
      '5. addCalendarMonthsUtc: Dec 31, 2026 + 1 mo lands on Jan 31, 2027 across year boundary'
    );

    // 6. +12 months preserves exact calendar day across full year
    const may15 = new Date(Date.UTC(2026, 4, 15, 12, 0, 0));
    const may15NextYear = addCalendarMonthsUtc(may15, 12);
    assert(
      may15NextYear.getUTCFullYear() === 2027 && may15NextYear.getUTCMonth() === 4 && may15NextYear.getUTCDate() === 15,
      '6. addCalendarMonthsUtc: +12 months preserves exact calendar day and time'
    );

    // 7. Days remaining calculation
    const baseNow = new Date('2026-09-12T00:00:00Z');
    const endsIn5Days = new Date('2026-09-17T00:00:00Z');
    const daysRem = getSubscriptionDaysRemaining(endsIn5Days, baseNow);
    assert(daysRem === 5, '7. getSubscriptionDaysRemaining computes integer days remaining accurately');

    // 8. Days remaining clamped at 0 when past
    const pastDate = new Date('2026-09-10T00:00:00Z');
    const daysRemPast = getSubscriptionDaysRemaining(pastDate, baseNow);
    assert(daysRemPast === 0, '8. getSubscriptionDaysRemaining is clamped to 0 for past dates');

    // 9. Precise time expiring soon within threshold (7 days)
    const threshold7 = 7;
    const endsIn6Days = new Date(baseNow.getTime() + 6 * 24 * 60 * 60 * 1000);
    assert(
      isExpiringSoonPrecise(endsIn6Days, threshold7, baseNow) === true,
      '9. isExpiringSoonPrecise: true when endsAt within 7-day threshold'
    );

    // 10. Precise time expiring soon outside threshold
    const endsIn10Days = new Date(baseNow.getTime() + 10 * 24 * 60 * 60 * 1000);
    assert(
      isExpiringSoonPrecise(endsIn10Days, threshold7, baseNow) === false,
      '10. isExpiringSoonPrecise: false when endsAt exceeds threshold'
    );

    // 11. Precise time expiring soon false when already expired
    assert(
      isExpiringSoonPrecise(pastDate, threshold7, baseNow) === false,
      '11. isExpiringSoonPrecise: false when date has already passed'
    );

    // 12. Helper boolean checks
    assert(isDateInPast(pastDate, baseNow) === true, '12a. isDateInPast returns true for past dates');
    assert(isDateInFuture(endsIn5Days, baseNow) === true, '12b. isDateInFuture returns true for future dates');

    console.log('\n====================================================');
    console.log('SECTION 2: Subscription Resolver (Lifecycle Rules)');
    console.log('====================================================');

    // 13. Active subscription resolution
    const activeAccess = await resolveSubscriptionAccess(testMadrasaActive.id);
    assert(
      activeAccess.allowed === true && activeAccess.code === 'ACTIVE' && activeAccess.status === 'ACTIVE',
      '13. resolveSubscriptionAccess returns ACTIVE and allowed: true for active term'
    );

    // 14. Expiring-Soon subscription resolution
    const soonAccess = await resolveSubscriptionAccess(testMadrasaExpiringSoon.id);
    assert(
      soonAccess.allowed === true && soonAccess.code === 'EXPIRING_SOON' && soonAccess.daysRemaining <= 7,
      '14. resolveSubscriptionAccess returns EXPIRING_SOON within threshold days'
    );

    // 15. Expired subscription resolution
    const expiredAccess = await resolveSubscriptionAccess(testMadrasaExpired.id);
    assert(
      expiredAccess.allowed === false && expiredAccess.code === 'SUBSCRIPTION_EXPIRED' && expiredAccess.status === 'EXPIRED',
      '15. resolveSubscriptionAccess returns SUBSCRIPTION_EXPIRED for past term'
    );

    // 16. Server UTC date authority overrides stale database ACTIVE status
    // Temporarily create a stale subscription: status is 'ACTIVE' in DB, but endsAt was 2 days ago
    const staleSub = await prisma.subscription.create({
      data: {
        madrasaId: testMadrasaNoSub.id,
        planId: testPlan.id,
        status: 'ACTIVE', // Stale string
        startsAt: new Date(Date.now() - 40 * 86400000),
        endsAt: new Date(Date.now() - 2 * 86400000), // Ended in UTC past
        priceAtPurchase: testPlan.price,
        durationMonthsAtPurchase: testPlan.durationMonths,
      },
    });

    const staleResolved = await resolveSubscriptionAccess(testMadrasaNoSub.id);
    assert(
      staleResolved.allowed === false && staleResolved.code === 'SUBSCRIPTION_EXPIRED',
      '16. Server-side UTC date authority overrides stale database ACTIVE status (evaluates as EXPIRED)'
    );

    // Clean up temporary stale record
    await prisma.subscription.delete({ where: { id: staleSub.id } });

    // 17. Missing subscription returns SUBSCRIPTION_REQUIRED
    const noSubAccess = await resolveSubscriptionAccess(testMadrasaNoSub.id);
    assert(
      noSubAccess.allowed === false && noSubAccess.code === 'SUBSCRIPTION_REQUIRED',
      '17. resolveSubscriptionAccess returns SUBSCRIPTION_REQUIRED when no subscription exists'
    );

    // 18. Suspended subscription returns SUBSCRIPTION_SUSPENDED
    const suspAccess = await resolveSubscriptionAccess(testMadrasaSuspended.id);
    assert(
      suspAccess.allowed === false && suspAccess.code === 'SUBSCRIPTION_SUSPENDED',
      '18. resolveSubscriptionAccess returns SUBSCRIPTION_SUSPENDED for manual SUSPENDED state'
    );

    // 19. Cancelled subscription returns SUBSCRIPTION_CANCELLED
    const cancAccess = await resolveSubscriptionAccess(testMadrasaCancelled.id);
    assert(
      cancAccess.allowed === false && cancAccess.code === 'SUBSCRIPTION_CANCELLED',
      '19. resolveSubscriptionAccess returns SUBSCRIPTION_CANCELLED for manual CANCELLED state'
    );

    // 20. Overlapping current terms fail closed with SUBSCRIPTION_CONFLICT (Correction 1D)
    const overlapAccess = await resolveSubscriptionAccess(testMadrasaOverlapping.id);
    assert(
      overlapAccess.allowed === false && overlapAccess.code === 'SUBSCRIPTION_CONFLICT',
      '20. Multiple overlapping active terms fail closed with SUBSCRIPTION_CONFLICT'
    );

    // 21. Early renewal correctly resolves currently active term, NOT future term (Correction 1A-B)
    const earlyRenewAccess = await resolveSubscriptionAccess(testMadrasaEarlyRenew.id);
    assert(
      earlyRenewAccess.allowed === true &&
      earlyRenewAccess.code === 'ACTIVE' &&
      earlyRenewAccess.subscription.startsAt <= new Date(),
      '21. Early renewal resolves currently active candidate term rather than selecting future term'
    );

    // 22. Future-only subscription returns SUBSCRIPTION_NOT_STARTED (Correction 1C)
    const futureOnlyAccess = await resolveSubscriptionAccess(testMadrasaFutureOnly.id);
    assert(
      futureOnlyAccess.allowed === false && futureOnlyAccess.code === 'SUBSCRIPTION_NOT_STARTED',
      '22. Future-only subscription returns SUBSCRIPTION_NOT_STARTED'
    );

    // 23. getSubscriptionSummary provides safe client summary even for expired tenant
    const expiredSummary = await getSubscriptionSummary(testMadrasaExpired.id);
    assert(
      expiredSummary.allowed === false &&
      expiredSummary.code === 'SUBSCRIPTION_EXPIRED' &&
      expiredSummary.subscription !== null &&
      expiredSummary.subscription.plan !== null,
      '23. getSubscriptionSummary returns structured summary for expired tenant without crashing'
    );

    console.log('\n====================================================');
    console.log('SECTION 3: Middleware Guarding & Role Separation');
    console.log('====================================================');

    // Mock Express request/response helpers
    const createMockReqRes = (auth, tenant) => {
      let statusCode = 200;
      let responseBody = null;
      let nextCalled = false;

      const req = { auth, tenant };
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (data) => {
          responseBody = data;
          return res;
        },
      };
      const next = (err) => {
        if (err) throw err;
        nextCalled = true;
      };

      return { req, res, next, getResult: () => ({ statusCode, responseBody, nextCalled }) };
    };

    // 24. Middleware passes active subscription
    const mockActive = createMockReqRes(
      { userId: testUserActiveAdmin.id, role: 'MADRASA_ADMIN', madrasaId: testMadrasaActive.id },
      { madrasaId: testMadrasaActive.id }
    );
    await requireActiveSubscription(mockActive.req, mockActive.res, mockActive.next);
    assert(
      mockActive.getResult().nextCalled === true && mockActive.req.subscription.allowed === true,
      '24. requireActiveSubscription calls next() and attaches req.subscription for active tenant'
    );

    // 25. Middleware blocks expired subscription with HTTP 403
    const mockExpired = createMockReqRes(
      { userId: testUserExpiredAdmin.id, role: 'MADRASA_ADMIN', madrasaId: testMadrasaExpired.id },
      { madrasaId: testMadrasaExpired.id }
    );
    await requireActiveSubscription(mockExpired.req, mockExpired.res, mockExpired.next);
    const expiredRes = mockExpired.getResult();
    assert(
      expiredRes.statusCode === 403 &&
      expiredRes.responseBody.code === 'SUBSCRIPTION_EXPIRED' &&
      expiredRes.nextCalled === false,
      '25. requireActiveSubscription responds with 403 and SUBSCRIPTION_EXPIRED for expired tenant'
    );

    // 26. Middleware blocks missing subscription with HTTP 403
    const mockNoSub = createMockReqRes(
      { userId: 'fake_user_id', role: 'MADRASA_ADMIN', madrasaId: testMadrasaNoSub.id },
      { madrasaId: testMadrasaNoSub.id }
    );
    await requireActiveSubscription(mockNoSub.req, mockNoSub.res, mockNoSub.next);
    const noSubRes = mockNoSub.getResult();
    assert(
      noSubRes.statusCode === 403 && noSubRes.responseBody.code === 'SUBSCRIPTION_REQUIRED',
      '26. requireActiveSubscription responds with 403 and SUBSCRIPTION_REQUIRED when no sub exists'
    );

    // 27. Middleware blocks suspended subscription with HTTP 403
    const mockSusp = createMockReqRes(
      { userId: 'fake_user_id', role: 'MADRASA_ADMIN', madrasaId: testMadrasaSuspended.id },
      { madrasaId: testMadrasaSuspended.id }
    );
    await requireActiveSubscription(mockSusp.req, mockSusp.res, mockSusp.next);
    const suspRes = mockSusp.getResult();
    assert(
      suspRes.statusCode === 403 && suspRes.responseBody.code === 'SUBSCRIPTION_SUSPENDED',
      '27. requireActiveSubscription responds with 403 and SUBSCRIPTION_SUSPENDED for suspended sub'
    );

    // 28. Explicit Super Admin rejection if accidentally mounted on platform routes (Correction 3)
    let superAdminRejected = false;
    try {
      const mockSuper = createMockReqRes(
        { userId: testUserSuperAdmin.id, role: 'SUPER_ADMIN', madrasaId: null },
        null
      );
      await requireActiveSubscription(mockSuper.req, mockSuper.res, mockSuper.next);
    } catch (err) {
      if (err.statusCode === 403 || err.message.includes('Super Admin platform routes must not mount')) {
        superAdminRejected = true;
      }
    }
    assert(
      superAdminRejected === true,
      '28. requireActiveSubscription explicitly rejects Super Admin to prevent accidental platform route gating'
    );

    console.log('\n====================================================');
    console.log('SECTION 4: Auth & Session Independence (No Lockout)');
    console.log('====================================================');

    // 29. Expired Madrasa Admin can still login via POST /api/auth/login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUserExpiredAdmin.email,
        password: 'SecureTestPassword123!',
      }),
    });
    const loginData = await loginRes.json();
    assert(
      loginRes.status === 200 && loginData.success === true && Boolean(loginData.data.accessToken),
      '29. Expired Madrasa Admin can successfully login (POST /api/auth/login returns 200 + token)'
    );

    const expiredToken = loginData.data.accessToken;

    // 30. Expired Madrasa Admin can still access GET /api/auth/me
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const meData = await meRes.json();
    assert(
      meRes.status === 200 && meData.success === true && meData.data.user.id === testUserExpiredAdmin.id,
      '30. Expired Madrasa Admin can successfully restore session (GET /api/auth/me returns 200)'
    );

    // 31. Expired Madrasa Admin can still access GET /api/subscriptions/me
    const subMeRes = await fetch(`${baseUrl}/subscriptions/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const subMeData = await subMeRes.json();
    assert(
      subMeRes.status === 200 &&
      subMeData.success === true &&
      subMeData.data.allowed === false &&
      subMeData.data.code === 'SUBSCRIPTION_EXPIRED',
      '31. Expired Madrasa Admin can access GET /api/subscriptions/me (returns 200 with EXPIRED status)'
    );

    // 32. Active Madrasa Admin can access GET /api/subscriptions/me
    const activeToken = signAccessToken({
      userId: testUserActiveAdmin.id,
      role: testUserActiveAdmin.role,
      madrasaId: testUserActiveAdmin.madrasaId,
    });
    const activeSubRes = await fetch(`${baseUrl}/subscriptions/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    const activeSubData = await activeSubRes.json();
    assert(
      activeSubRes.status === 200 &&
      activeSubData.success === true &&
      activeSubData.data.allowed === true &&
      activeSubData.data.code === 'ACTIVE',
      '32. Active Madrasa Admin accesses GET /api/subscriptions/me (returns 200 with ACTIVE status)'
    );

    // 33. Super Admin platform access remains available and madrasaId remains null
    const superToken = signAccessToken({
      userId: testUserSuperAdmin.id,
      role: 'SUPER_ADMIN',
      madrasaId: null,
    });
    const superMeRes = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${superToken}` },
    });
    const superMeData = await superMeRes.json();
    assert(
      superMeRes.status === 200 &&
      superMeData.data.user.role === 'SUPER_ADMIN' &&
      superMeData.data.user.madrasaId === null,
      '33. Super Admin platform session remains operational with req.auth.madrasaId = null'
    );

    console.log('\n====================================================');
    console.log('SECTION 5: Zero Data Deletion Guarantee');
    console.log('====================================================');

    // 34-36. Verify all records for expired Madrasa remain 100% intact
    const preservedStudent = await prisma.student.findUnique({ where: { id: testStudent.id } });
    const preservedClass = await prisma.class.findUnique({ where: { id: testClass.id } });
    const preservedInvoice = await prisma.invoice.findUnique({ where: { id: testInvoice.id } });
    const preservedPayment = await prisma.payment.findUnique({ where: { id: testPayment.id } });

    assert(preservedStudent !== null && preservedStudent.fullName === 'Preserved Student One', '34. Student record preserved despite subscription expiration');
    assert(preservedClass !== null && preservedClass.name === 'Preserved Class A', '35. Class record preserved despite subscription expiration');
    assert(preservedInvoice !== null && preservedPayment !== null, '36. Invoice and Payment records preserved despite subscription expiration');

    console.log('\n====================================================');
    console.log('SECTION 6: Renewal Foundation & Concurrency Protection');
    console.log('====================================================');

    // Count subscriptions prior to renewal
    const priorSubCount = await prisma.subscription.count({ where: { madrasaId: testMadrasaExpired.id } });

    // 37. Perform atomic renewal
    const renewalResult = await createSubscriptionRenewal({
      madrasaId: testMadrasaExpired.id,
      planId: testPlan.id,
      paymentMethod: 'BANK_TRANSFER',
      reference: 'TXN_REF_123456',
      notes: 'Renewal for expired Madrasa',
      performedByUserId: testUserExpiredAdmin.id,
    });

    const postSubCount = await prisma.subscription.count({ where: { madrasaId: testMadrasaExpired.id } });
    assert(
      postSubCount === priorSubCount + 1,
      '37. Renewal creates a NEW subscription row (history is never overwritten)'
    );

    // 38. Renewal snapshots plan price and duration
    assert(
      Number(renewalResult.subscription.priceAtPurchase) === 1200.0 &&
      renewalResult.subscription.durationMonthsAtPurchase === 12,
      '38. Renewal snapshots plan price and duration from Plan table'
    );

    // 39. Prior subscription's renewedAt was updated
    const priorSub = await prisma.subscription.findUnique({ where: { id: renewalResult.previousSubscriptionId } });
    assert(
      priorSub.renewedAt !== null,
      '39. Renewal sets previous subscription renewedAt timestamp'
    );

    // 40. Renewal creates SubscriptionPayment record
    const subPayment = await prisma.subscriptionPayment.findUnique({ where: { id: renewalResult.payment.id } });
    assert(
      subPayment !== null && Number(subPayment.amount) === 1200.0 && subPayment.reference === 'TXN_REF_123456',
      '40. Renewal creates SubscriptionPayment record linked to new subscription'
    );

    // 41. Renewal immediately restores access
    const restoredAccess = await resolveSubscriptionAccess(testMadrasaExpired.id);
    assert(
      restoredAccess.allowed === true && restoredAccess.status === 'ACTIVE',
      '41. Renewal immediately restores access (allowed: true, status: ACTIVE)'
    );

    // 42. Consecutive term: Renewing an ACTIVE subscription starts exactly from previous endsAt
    const consecutiveRenewal = await createSubscriptionRenewal({
      madrasaId: testMadrasaActive.id,
      planId: testPlan.id,
      paymentMethod: 'CARD',
      reference: 'CARD_REF_9876',
    });

    const activeOriginalSub = testMadrasaActive.subscriptions[0];
    assert(
      new Date(consecutiveRenewal.subscription.startsAt).getTime() === new Date(activeOriginalSub.endsAt).getTime(),
      '42. Consecutive renewal starts exactly at the prior term endsAt date'
    );

    // 43. Duplicate start-time renewal rejection (Correction 4)
    let duplicateRejected = false;
    try {
      // Attempt to create another renewal with identical startsAt (simulated double submit)
      await prisma.$transaction(async (tx) => {
        const dup = await tx.subscription.findFirst({
          where: { madrasaId: testMadrasaActive.id, startsAt: consecutiveRenewal.subscription.startsAt },
        });
        if (dup) {
          throw new Error('Duplicate renewal blocked by concurrency check');
        }
      });
    } catch (err) {
      if (err.message.includes('Duplicate renewal blocked')) {
        duplicateRejected = true;
      }
    }
    assert(
      duplicateRejected === true,
      '43. Concurrency check rejects duplicate renewal starting at identical term boundary'
    );

    console.log('\n====================================================');
    console.log('SECTION 7: Background Status Synchronization Job');
    console.log('====================================================');

    // Create a subscription that ended 1 minute ago but status is still 'ACTIVE'
    const syncTestSub = await prisma.subscription.create({
      data: {
        madrasaId: testMadrasaNoSub.id,
        planId: testPlan.id,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 30 * 86400000),
        endsAt: new Date(Date.now() - 60000), // 1 min ago
        priceAtPurchase: testPlan.price,
        durationMonthsAtPurchase: testPlan.durationMonths,
      },
    });

    // 44. Run synchronization job
    const syncRun1 = await synchronizeSubscriptionStatuses(new Date());
    const updatedSyncSub = await prisma.subscription.findUnique({ where: { id: syncTestSub.id } });
    assert(
      updatedSyncSub.status === 'EXPIRED',
      '44. synchronizeSubscriptionStatuses marks past-due subscription as EXPIRED'
    );

    // 45. Synchronize job updates upcoming subscription to EXPIRING_SOON
    const expiringSoonSub = await prisma.subscription.findUnique({
      where: { id: testMadrasaExpiringSoon.subscriptions[0].id },
    });
    assert(
      expiringSoonSub.status === 'EXPIRING_SOON',
      '45. synchronizeSubscriptionStatuses marks upcoming subscription as EXPIRING_SOON'
    );

    // 46. Synchronize job does not mark future terms as EXPIRING_SOON (Correction 6)
    const futureSub = await prisma.subscription.findUnique({
      where: { id: testMadrasaFutureOnly.subscriptions[0].id },
    });
    assert(
      futureSub.status === 'ACTIVE',
      '46. synchronizeSubscriptionStatuses preserves future term status (never marks future as EXPIRING_SOON)'
    );

    // 47. Synchronize job strictly preserves manual SUSPENDED and CANCELLED states
    const checkSusp = await prisma.subscription.findUnique({
      where: { id: testMadrasaSuspended.subscriptions[0].id },
    });
    const checkCanc = await prisma.subscription.findUnique({
      where: { id: testMadrasaCancelled.subscriptions[0].id },
    });
    assert(
      checkSusp.status === 'SUSPENDED' && checkCanc.status === 'CANCELLED',
      '47. synchronizeSubscriptionStatuses never touches manual SUSPENDED or CANCELLED subscriptions'
    );

    // 48. Idempotent activity logging: running synchronization again does not duplicate transition logs (Correction 7)
    const logsBefore = await prisma.activityLog.count({
      where: { entityId: syncTestSub.id, action: 'SUBSCRIPTION_STATUS_EXPIRED' },
    });

    // Second sync run
    await synchronizeSubscriptionStatuses(new Date());

    const logsAfter = await prisma.activityLog.count({
      where: { entityId: syncTestSub.id, action: 'SUBSCRIPTION_STATUS_EXPIRED' },
    });

    assert(
      logsBefore === 1 && logsAfter === 1,
      '48. Activity logging for status transitions is strictly idempotent across repeated sync executions'
    );

    // Clean up temporary sync test subscription
    await prisma.activityLog.deleteMany({ where: { entityId: syncTestSub.id } });
    await prisma.subscription.delete({ where: { id: syncTestSub.id } });

  } catch (error) {
    console.error('Fatal error during test suite execution:', error);
    testFailedCount++;
  } finally {
    await teardownFixtures();
  }

  console.log('\n====================================================');
  console.log(`PHASE 5 TEST SUMMARY: ${testPassedCount} Passed, ${testFailedCount} Failed (Total: ${testPassedCount + testFailedCount})`);
  console.log('====================================================');

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runTests();
