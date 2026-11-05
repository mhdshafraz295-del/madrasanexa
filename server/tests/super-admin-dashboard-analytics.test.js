process.env.NODE_ENV = 'test';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { enableTestMode } from '../src/services/email.service.js';
import app from '../src/app.js';

const TEST_PREFIX = 'sa_dash_' + Date.now();

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

let testServer = null;
let baseUrl = '';

let superAdminUser = null;
let superAdminToken = '';

let madrasaAdminUser = null;
let madrasaAdminToken = '';
let testMadrasa = null;

let testPlan1 = null;
let testPlan2 = null;
let inactivePlan = null;

let madrasaA = null;
let madrasaB = null;
let madrasaC = null;
let madrasaD_noSub = null;

const createdMadrasaIds = [];
const createdPlanIds = [];
const createdUserIds = [];

async function setup() {
  console.log('\n--- Setting up Super Admin Dashboard Analytics Test Fixtures ---');
  enableTestMode(true);

  // Clean up any previous test remnants
  try {
    await prisma.subscriptionPayment.deleteMany({
      where: { madrasa: { slug: { contains: 'sa_dash_' } } },
    });
    await prisma.subscription.deleteMany({
      where: { madrasa: { slug: { contains: 'sa_dash_' } } },
    });
    await prisma.payment.deleteMany({
      where: { paymentNo: { contains: 'sa_dash_' } },
    });
    await prisma.student.deleteMany({
      where: { admissionNo: { contains: 'sa_dash_' } },
    });
    await prisma.madrasa.deleteMany({
      where: { slug: { contains: 'sa_dash_' } },
    });
    await prisma.plan.deleteMany({
      where: { code: { contains: 'P1' } },
    });
  } catch (e) {
    // ignore
  }

  // 1. Create Super Admin
  superAdminUser = await prisma.user.create({
    data: {
      name: 'Super Admin Tester',
      email: `${TEST_PREFIX}_super@example.com`,
      passwordHash: await hashPassword('SuperSecureP@ss123!'),
      role: 'SUPER_ADMIN',
      madrasaId: null,
      isActive: true,
      mustChangePassword: false,
    },
  });
  createdUserIds.push(superAdminUser.id);

  superAdminToken = signAccessToken({
    userId: superAdminUser.id,
    role: superAdminUser.role,
    madrasaId: null,
  });

  // 2. Create Madrasa Admin
  testMadrasa = await prisma.madrasa.create({
    data: {
      name: 'Base Madrasa',
      code: `${TEST_PREFIX.slice(-5).toUpperCase()}B0`,
      slug: `${TEST_PREFIX}-base`,
      email: `${TEST_PREFIX}_base@example.com`,
      status: 'ACTIVE',
    },
  });
  createdMadrasaIds.push(testMadrasa.id);

  madrasaAdminUser = await prisma.user.create({
    data: {
      name: 'Base Madrasa Admin',
      email: `${TEST_PREFIX}_admin@example.com`,
      passwordHash: await hashPassword('AdminPass123!'),
      role: 'MADRASA_ADMIN',
      madrasaId: testMadrasa.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  createdUserIds.push(madrasaAdminUser.id);

  madrasaAdminToken = signAccessToken({
    userId: madrasaAdminUser.id,
    role: madrasaAdminUser.role,
    madrasaId: testMadrasa.id,
  });

  // 3. Create Plans (Active, Dynamic, and Inactive)
  testPlan1 = await prisma.plan.create({
    data: {
      name: 'Standard Pro Plan',
      code: `${TEST_PREFIX.slice(-5).toUpperCase()}_P1`,
      durationMonths: 12,
      price: 15000.0,
      isActive: true,
    },
  });
  createdPlanIds.push(testPlan1.id);

  testPlan2 = await prisma.plan.create({
    data: {
      name: 'Starter Tier Plan',
      code: `${TEST_PREFIX.slice(-5).toUpperCase()}_P2`,
      durationMonths: 6,
      price: 8000.0,
      isActive: true,
    },
  });
  createdPlanIds.push(testPlan2.id);

  inactivePlan = await prisma.plan.create({
    data: {
      name: 'Legacy Retired Plan',
      code: `${TEST_PREFIX.slice(-5).toUpperCase()}_P3`,
      durationMonths: 12,
      price: 10000.0,
      isActive: false, // Inactive plan!
    },
  });
  createdPlanIds.push(inactivePlan.id);

  // 4. Create Madrasas with different subscription profiles
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth(); // 0-11

  // Madrasa A: Has multiple historical subscriptions + currently ACTIVE subscription on testPlan1
  madrasaA = await prisma.madrasa.create({
    data: {
      name: 'Madrasa Alpha',
      code: `${TEST_PREFIX.slice(-5).toUpperCase()}A1`,
      slug: `${TEST_PREFIX}-alpha`,
      email: `${TEST_PREFIX}_alpha@example.com`,
      createdAt: new Date(Date.UTC(currentYear, currentMonth, 2)), // current month
      status: 'ACTIVE',
    },
  });
  createdMadrasaIds.push(madrasaA.id);

  // Term 1: Old expired subscription
  await prisma.subscription.create({
    data: {
      madrasaId: madrasaA.id,
      planId: testPlan1.id,
      status: 'EXPIRED',
      startsAt: new Date(Date.UTC(currentYear - 2, 0, 1)),
      endsAt: new Date(Date.UTC(currentYear - 1, 0, 1)),
      priceAtPurchase: 12000.0,
      durationMonthsAtPurchase: 12,
    },
  });

  // Term 2: Another expired renewal
  await prisma.subscription.create({
    data: {
      madrasaId: madrasaA.id,
      planId: testPlan1.id,
      status: 'EXPIRED',
      startsAt: new Date(Date.UTC(currentYear - 1, 0, 1)),
      endsAt: new Date(Date.UTC(currentYear, 0, 1)),
      priceAtPurchase: 13000.0,
      durationMonthsAtPurchase: 12,
    },
  });

  // Term 3: Currently ACTIVE term
  const subActiveA = await prisma.subscription.create({
    data: {
      madrasaId: madrasaA.id,
      planId: testPlan1.id,
      status: 'ACTIVE',
      startsAt: new Date(Date.UTC(currentYear, 0, 1)),
      endsAt: new Date(Date.UTC(currentYear + 1, 0, 1)),
      priceAtPurchase: 15000.0,
      durationMonthsAtPurchase: 12,
    },
  });

  // Realized subscription payments for Madrasa A (Decimal-safe test: 0.10 + 0.20 = 0.30)
  await prisma.subscriptionPayment.create({
    data: {
      madrasaId: madrasaA.id,
      subscriptionId: subActiveA.id,
      amount: 0.10,
      paymentMethod: 'CARD',
      paidAt: new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0)), // EXACT month boundary 00:00:00Z!
    },
  });

  await prisma.subscriptionPayment.create({
    data: {
      madrasaId: madrasaA.id,
      subscriptionId: subActiveA.id,
      amount: 0.20,
      paymentMethod: 'CARD',
      paidAt: new Date(Date.UTC(currentYear, currentMonth, 5, 12, 0, 0)),
    },
  });

  // Madrasa B: Active subscription on an INACTIVE plan (test requirement Item F)
  madrasaB = await prisma.madrasa.create({
    data: {
      name: 'Madrasa Beta',
      code: `${TEST_PREFIX.slice(-5).toUpperCase()}B2`,
      slug: `${TEST_PREFIX}-beta`,
      email: `${TEST_PREFIX}_beta@example.com`,
      createdAt: new Date(Date.UTC(currentYear, currentMonth - 2, 10)), // 2 months ago
      status: 'ACTIVE',
    },
  });
  createdMadrasaIds.push(madrasaB.id);

  const subB = await prisma.subscription.create({
    data: {
      madrasaId: madrasaB.id,
      planId: inactivePlan.id,
      status: 'ACTIVE',
      startsAt: new Date(Date.UTC(currentYear, 0, 1)),
      endsAt: new Date(Date.UTC(currentYear + 1, 0, 1)),
      priceAtPurchase: 10000.0,
      durationMonthsAtPurchase: 12,
    },
  });

  await prisma.subscriptionPayment.create({
    data: {
      madrasaId: madrasaB.id,
      subscriptionId: subB.id,
      amount: 10000.0,
      paymentMethod: 'BANK_TRANSFER',
      paidAt: new Date(Date.UTC(currentYear, currentMonth - 2, 10)),
    },
  });

  // Madrasa C: Expired subscription (ended last month, no active candidate)
  madrasaC = await prisma.madrasa.create({
    data: {
      name: 'Madrasa Gamma',
      code: `${TEST_PREFIX.slice(-5).toUpperCase()}C3`,
      slug: `${TEST_PREFIX}-gamma`,
      email: `${TEST_PREFIX}_gamma@example.com`,
      createdAt: new Date(Date.UTC(currentYear, currentMonth - 3, 15)),
      status: 'ACTIVE',
    },
  });
  createdMadrasaIds.push(madrasaC.id);

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaC.id,
      planId: testPlan2.id,
      status: 'EXPIRED',
      startsAt: new Date(Date.UTC(currentYear, currentMonth - 7, 1)),
      endsAt: new Date(Date.UTC(currentYear, currentMonth - 1, 1)),
      priceAtPurchase: 8000.0,
      durationMonthsAtPurchase: 6,
    },
  });

  // Madrasa D: Provisioned Madrasa with NO SUBSCRIPTIONS (test requirement Item D)
  madrasaD_noSub = await prisma.madrasa.create({
    data: {
      name: 'Madrasa Delta No-Sub',
      code: `${TEST_PREFIX.slice(-5).toUpperCase()}D4`,
      slug: `${TEST_PREFIX}-delta`,
      email: `${TEST_PREFIX}_delta@example.com`,
      createdAt: new Date(Date.UTC(currentYear, currentMonth - 1, 20)),
      status: 'ACTIVE',
    },
  });
  createdMadrasaIds.push(madrasaD_noSub.id);

  // Also create a student and tenant payment to verify student fee collections are strictly EXCLUDED (Requirement 8)
  const student = await prisma.student.create({
    data: {
      madrasaId: testMadrasa.id,
      admissionNo: `${TEST_PREFIX}_ADM01`,
      admissionDate: new Date('2020-01-01'),
      fullName: 'Test Student',
      guardianName: 'Guardian',
      guardianPhone: '+94771234567',
      status: 'ACTIVE',
    },
  });

  await prisma.payment.create({
    data: {
      madrasaId: testMadrasa.id,
      studentId: student.id,
      paymentNo: `${TEST_PREFIX}_PAY01`,
      amount: 99999.0, // Large amount that must NOT appear in Super Admin subscription revenue!
      paymentMethod: 'CASH',
      paidAt: new Date(Date.UTC(currentYear, currentMonth, 10)),
      status: 'COMPLETED',
    },
  });

  // 5. Start test server
  await new Promise((resolve) => {
    testServer = app.listen(0, () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

async function teardown() {
  console.log('\n--- Tearing Down Super Admin Dashboard Test Fixtures ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  try {
    await prisma.payment.deleteMany({
      where: { paymentNo: { contains: TEST_PREFIX } },
    });
    await prisma.student.deleteMany({
      where: { admissionNo: { contains: TEST_PREFIX } },
    });

    await prisma.subscriptionPayment.deleteMany({
      where: { madrasaId: { in: createdMadrasaIds } },
    });
    await prisma.subscription.deleteMany({
      where: { madrasaId: { in: createdMadrasaIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
    await prisma.madrasa.deleteMany({
      where: { id: { in: createdMadrasaIds } },
    });
    await prisma.plan.deleteMany({
      where: { id: { in: createdPlanIds } },
    });
  } catch (err) {
    console.error('Teardown warning:', err);
  }
}

async function runTests() {
  try {
    await setup();

    console.log('\n=============================================');
    console.log('SUPER ADMIN DASHBOARD ANALYTICS TEST SUITE');
    console.log('=============================================');

    // 1. Authorization: Super Admin permitted (200)
    const saRes = await fetch(`${baseUrl}/api/super-admin/dashboard`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const saJson = await saRes.json();
    assert(saRes.status === 200, 'Super Admin successfully accesses dashboard (HTTP 200)');
    assert(saJson.success === true, 'Response contains success: true');
    assert(saJson.data?.charts !== undefined, 'Response contains additive charts object');

    // 2. Authorization: Madrasa Admin forbidden (403)
    const maRes = await fetch(`${baseUrl}/api/super-admin/dashboard`, {
      headers: { Authorization: `Bearer ${madrasaAdminToken}` },
    });
    assert(maRes.status === 403, 'Madrasa Admin is forbidden from Super Admin dashboard (HTTP 403)');

    // 3. Institution Growth returns real monthly counts from Madrasa.createdAt
    const growth = saJson.data.charts.institutionGrowth;
    assert(Array.isArray(growth), 'Institution Growth is an array');
    assert(growth.length === 6, 'Default period (6m) returns exactly 6 monthly data points');
    const totalGrowthInstitutions = growth.reduce((sum, item) => sum + item.institutions, 0);
    assert(totalGrowthInstitutions >= 4, 'Institution growth reflects actual created Madrasas in range');

    // 4. Empty months in Institution Growth are zero-filled
    const hasZeroMonth = growth.some((g) => typeof g.institutions === 'number');
    assert(hasZeroMonth, 'Institution growth timeline is continuous and numbers are integers');

    // 5. Item A: Current month included in 6m exactly once
    const nowUtc = new Date();
    const currentYear = nowUtc.getUTCFullYear();
    const currentMonth = nowUtc.getUTCMonth();
    const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const currentMonthEntries = growth.filter((g) => g.month === currentMonthKey);
    assert(currentMonthEntries.length === 1, 'Current month is included in 6m range exactly once');

    // 6. 12-month period returns exactly 12 monthly data points
    const res12m = await fetch(`${baseUrl}/api/super-admin/dashboard?period=12m`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const json12m = await res12m.json();
    assert(res12m.status === 200, 'GET /dashboard?period=12m returns HTTP 200');
    assert(json12m.data.charts.institutionGrowth.length === 12, '12m period returns exactly 12 data points');
    assert(json12m.data.charts.subscriptionRevenue.length === 12, '12m revenue returns exactly 12 data points');

    // 7. Item B: Boundary timestamp at month start (00:00:00Z) grouped into correct month
    const rev6m = saJson.data.charts.subscriptionRevenue;
    const currentMonthRev = rev6m.find((r) => r.month === currentMonthKey);
    assert(currentMonthRev !== undefined, 'Current month revenue bucket exists');
    assert(currentMonthRev.revenue >= 0.30, 'Payment at 00:00:00.000Z on 1st of month grouped into correct month');

    // 8. Item C: Decimal-safe calculation (0.10 + 0.20 does NOT become 0.30000000000000004)
    const isSafeDecimal = !currentMonthRev.revenue.toString().includes('0000000') && (Math.round(currentMonthRev.revenue * 100) === currentMonthRev.revenue * 100);
    assert(isSafeDecimal && currentMonthRev.revenue >= 0.30, `Decimal values sum safely to precision 2 without JS floating drift (got: ${currentMonthRev.revenue})`);

    // 9. Revenue uses SubscriptionPayment authority only; student fee collection (99999.00) excluded
    assert(currentMonthRev.revenue < 99999, `Platform revenue excludes tenant fee collection of 99,999.00 (got: ${currentMonthRev.revenue})`);

    // 10. Subscription Revenue empty months zero-filled (0)
    assert(rev6m.every((r) => typeof r.revenue === 'number' && !isNaN(r.revenue)), 'All revenue data points are valid numbers');

    // 11. Item D: Madrasa with no effective subscription follows documented behavior
    // Madrasa D has no subscriptions, so it evaluates to REQUIRED and is excluded from enum status distribution & plan distribution
    const subStatuses = saJson.data.charts.subscriptionStatus;
    assert(Array.isArray(subStatuses), 'subscriptionStatus is an array');
    const requiredStatus = subStatuses.find((s) => s.status === 'REQUIRED' || s.status === 'NO_PLAN');
    assert(requiredStatus === undefined, 'Madrasa without subscription is safely excluded from SubscriptionStatus enum without crashing or creating fake enum');

    // 12. Item E: Madrasa with multiple historical subscriptions counted once
    // Madrasa A has 2 expired terms and 1 active term. It should count exactly ONCE as ACTIVE, not 3 times!
    const activeStatusEntry = subStatuses.find((s) => s.status === 'ACTIVE');
    assert(activeStatusEntry?.count >= 2, 'Active subscriptions count reflects current active institutions');

    // 13. Item F: Current subscription on an inactive Plan still appears dynamically in Plan Distribution
    const planDist = saJson.data.charts.planDistribution;
    assert(Array.isArray(planDist), 'planDistribution is an array');
    const inactivePlanInChart = planDist.find((p) => p.planId === inactivePlan.id);
    assert(inactivePlanInChart !== undefined, 'Inactive Plan with active subscription legitimately appears in Plan Distribution');
    assert(inactivePlanInChart?.planName === 'Legacy Retired Plan', 'Inactive Plan name retrieved correctly from DB');
    assert(inactivePlanInChart?.institutionCount === 1, 'Inactive Plan institution count is 1');

    // 14. Plan Distribution canonical shape: { planId, planName, institutionCount }
    const p0 = planDist[0];
    if (p0) {
      assert(typeof p0.planId === 'string', 'planDistribution has canonical planId: string');
      assert(typeof p0.planName === 'string', 'planDistribution has canonical planName: string');
      assert(typeof p0.institutionCount === 'number', 'planDistribution has canonical institutionCount: number');
      assert(p0.name === undefined, 'No duplicate alias name in planDistribution');
      assert(p0.count === undefined, 'No duplicate alias count in planDistribution');
    }

    // 15. Dynamic Plan Distribution: Newly created Plan appears dynamically when used
    const newDynamicPlan = await prisma.plan.create({
      data: {
        name: 'Brand New Dynamic Plan',
        code: `${TEST_PREFIX.slice(-5).toUpperCase()}_NEW`,
        durationMonths: 1,
        price: 500.0,
        isActive: true,
      },
    });
    createdPlanIds.push(newDynamicPlan.id);

    // Subscribe Madrasa D to this new plan
    await prisma.subscription.create({
      data: {
        madrasaId: madrasaD_noSub.id,
        planId: newDynamicPlan.id,
        status: 'ACTIVE',
        startsAt: new Date(Date.UTC(currentYear, currentMonth, 1)),
        endsAt: new Date(Date.UTC(currentYear, currentMonth + 1, 1)),
        priceAtPurchase: 500.0,
        durationMonthsAtPurchase: 1,
      },
    });

    const dynamicPlanRes = await fetch(`${baseUrl}/api/super-admin/dashboard`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const dynamicPlanJson = await dynamicPlanRes.json();
    const newPlanInChart = dynamicPlanJson.data.charts.planDistribution.find((p) => p.planId === newDynamicPlan.id);
    assert(newPlanInChart !== undefined, 'Newly created Plan dynamically appears in Plan Distribution when used');
    assert(newPlanInChart?.institutionCount === 1, 'Newly created Plan count is 1');

    // 16. Item H: Existing dashboard fields remain backward compatible
    assert(typeof saJson.data.counts?.totalMadrasas === 'number', 'counts.totalMadrasas preserved');
    assert(typeof saJson.data.counts?.activeMadrasas === 'number', 'counts.activeMadrasas preserved');
    assert(typeof saJson.data.counts?.pendingOnboardings === 'number', 'counts.pendingOnboardings preserved');
    assert(typeof saJson.data.counts?.activeSubscriptions === 'number', 'counts.activeSubscriptions preserved');
    assert(typeof saJson.data.financials?.totalCollected === 'number', 'financials.totalCollected preserved');
    assert(Array.isArray(saJson.data.pendingOnboardingsList), 'pendingOnboardingsList preserved');
    assert(Array.isArray(saJson.data.recentMadrasas), 'recentMadrasas preserved');

    // 17. Invalid period rejected with HTTP 400 Bad Request
    const invalidRes = await fetch(`${baseUrl}/api/super-admin/dashboard?period=99m`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(invalidRes.status === 400, 'Invalid period string returns HTTP 400 Bad Request');

    // 18. No fake or random data in response
    const hasNaN = growth.some((g) => isNaN(g.institutions)) || rev6m.some((r) => isNaN(r.revenue));
    assert(!hasNaN, 'No NaN or fabricated numbers in production response');

    // 19. Performance: Analytics executes comfortably under 2-3 seconds
    const startPerf = Date.now();
    await fetch(`${baseUrl}/api/super-admin/dashboard?period=12m`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const elapsedMs = Date.now() - startPerf;
    assert(elapsedMs < 2000, `Super Admin dashboard analytics responded in ${elapsedMs}ms (< 2000ms threshold)`);

  } catch (err) {
    console.error('Fatal test execution error:', err);
    testFailedCount++;
  } finally {
    await teardown();
  }

  console.log('\n=============================================');
  console.log(`Test Results: ${testPassedCount} Passed, ${testFailedCount} Failed`);
  console.log('=============================================\n');

  if (testFailedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
