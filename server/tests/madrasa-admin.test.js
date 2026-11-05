import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';

const TEST_PREFIX = 'ma_test_' + Date.now();

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

// Test Fixtures
let superAdminUser = null;
let superAdminToken = '';

let madrasaA = null;
let adminA = null;
let tokenA = null;
let planA = null;
let subA = null;

let madrasaB = null;
let adminB = null;
let tokenB = null;
let planB = null;
let subB = null;

let expiredMadrasa = null;
let expiredAdmin = null;
let expiredToken = null;
let expiredSub = null;

let expiringSoonMadrasa = null;
let expiringSoonAdmin = null;
let expiringSoonToken = null;
let expiringSoonSub = null;

async function setup() {
  console.log('\n--- Setting up Phase 7 Madrasa Admin Test Fixtures ---');

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  // 1. Super Admin fixture
  superAdminUser = await prisma.user.create({
    data: {
      name: 'Super Admin Test',
      email: `${TEST_PREFIX}_sadmin@example.com`,
      passwordHash: await hashPassword('SuperAdminSecureP@ss123!'),
      role: 'SUPER_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });
  superAdminToken = signAccessToken({
    userId: superAdminUser.id,
    role: superAdminUser.role,
    madrasaId: null,
  });

  // 2. Shared Plan
  planA = await prisma.plan.create({
    data: {
      name: 'Madrasa Standard Plan',
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}_STD`,
      description: 'Standard plan for Phase 7 testing',
      durationMonths: 12,
      price: 300.0,
      isActive: true,
    },
  });

  // 3. Madrasa A (Active subscription)
  madrasaA = await prisma.madrasa.create({
    data: {
      name: 'Madrasa A Testing Institute',
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}01`,
      slug: `${TEST_PREFIX}-m-a`,
      email: `${TEST_PREFIX}_ma@example.com`,
      phone: '+94771111111',
      status: 'ACTIVE',
      settings: {
        create: {
          invoicePrefix: 'INVA-',
          receiptPrefix: 'RECA-',
          currency: 'LKR',
          timezone: 'Asia/Colombo',
          academicYear: '2026',
        },
      },
    },
  });

  adminA = await prisma.user.create({
    data: {
      name: 'Administrator A',
      email: `${TEST_PREFIX}_admin_a@example.com`,
      passwordHash: await hashPassword('AdminASecureP@ss123!'),
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaA.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  tokenA = signAccessToken({
    userId: adminA.id,
    role: adminA.role,
    madrasaId: madrasaA.id,
  });

  subA = await prisma.subscription.create({
    data: {
      madrasaId: madrasaA.id,
      planId: planA.id,
      status: 'ACTIVE',
      startsAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 300 * 24 * 60 * 60 * 1000),
      priceAtPurchase: 300.0,
      durationMonthsAtPurchase: 12,
    },
  });

  // 4. Madrasa B (Active subscription, separate tenant)
  madrasaB = await prisma.madrasa.create({
    data: {
      name: 'Madrasa B Testing Institute',
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}02`,
      slug: `${TEST_PREFIX}-m-b`,
      email: `${TEST_PREFIX}_mb@example.com`,
      phone: '+94772222222',
      status: 'ACTIVE',
      settings: {
        create: {
          invoicePrefix: 'INVB-',
          receiptPrefix: 'RECB-',
          currency: 'LKR',
          timezone: 'Asia/Colombo',
        },
      },
    },
  });

  adminB = await prisma.user.create({
    data: {
      name: 'Administrator B',
      email: `${TEST_PREFIX}_admin_b@example.com`,
      passwordHash: await hashPassword('AdminBSecureP@ss123!'),
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaB.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  tokenB = signAccessToken({
    userId: adminB.id,
    role: adminB.role,
    madrasaId: madrasaB.id,
  });

  subB = await prisma.subscription.create({
    data: {
      madrasaId: madrasaB.id,
      planId: planA.id,
      status: 'ACTIVE',
      startsAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 300 * 24 * 60 * 60 * 1000),
      priceAtPurchase: 300.0,
      durationMonthsAtPurchase: 12,
    },
  });

  // 5. Expired Madrasa (Ended 5 days ago)
  expiredMadrasa = await prisma.madrasa.create({
    data: {
      name: 'Expired Madrasa Institute',
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}03`,
      slug: `${TEST_PREFIX}-m-exp`,
      email: `${TEST_PREFIX}_exp@example.com`,
      status: 'ACTIVE',
      settings: {
        create: {
          invoicePrefix: 'INVX-',
          receiptPrefix: 'RECX-',
          currency: 'LKR',
          timezone: 'Asia/Colombo',
        },
      },
    },
  });

  expiredAdmin = await prisma.user.create({
    data: {
      name: 'Expired Administrator',
      email: `${TEST_PREFIX}_admin_exp@example.com`,
      passwordHash: await hashPassword('ExpiredAdminSecureP@ss123!'),
      role: 'MADRASA_ADMIN',
      madrasaId: expiredMadrasa.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  expiredToken = signAccessToken({
    userId: expiredAdmin.id,
    role: expiredAdmin.role,
    madrasaId: expiredMadrasa.id,
  });

  expiredSub = await prisma.subscription.create({
    data: {
      madrasaId: expiredMadrasa.id,
      planId: planA.id,
      status: 'EXPIRED',
      startsAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      priceAtPurchase: 300.0,
      durationMonthsAtPurchase: 12,
    },
  });

  // 6. Expiring-Soon Madrasa (Expires in 3 days)
  expiringSoonMadrasa = await prisma.madrasa.create({
    data: {
      name: 'Expiring Soon Madrasa',
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}04`,
      slug: `${TEST_PREFIX}-m-soon`,
      email: `${TEST_PREFIX}_soon@example.com`,
      status: 'ACTIVE',
      settings: {
        create: {
          invoicePrefix: 'INVS-',
          receiptPrefix: 'RECS-',
          currency: 'LKR',
          timezone: 'Asia/Colombo',
        },
      },
    },
  });

  expiringSoonAdmin = await prisma.user.create({
    data: {
      name: 'Expiring Soon Administrator',
      email: `${TEST_PREFIX}_admin_soon@example.com`,
      passwordHash: await hashPassword('SoonAdminSecureP@ss123!'),
      role: 'MADRASA_ADMIN',
      madrasaId: expiringSoonMadrasa.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  expiringSoonToken = signAccessToken({
    userId: expiringSoonAdmin.id,
    role: expiringSoonAdmin.role,
    madrasaId: expiringSoonMadrasa.id,
  });

  expiringSoonSub = await prisma.subscription.create({
    data: {
      madrasaId: expiringSoonMadrasa.id,
      planId: planA.id,
      status: 'EXPIRING_SOON',
      startsAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      priceAtPurchase: 300.0,
      durationMonthsAtPurchase: 12,
    },
  });

  // Start test server
  await new Promise((resolve) => {
    testServer = app.listen(0, () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Ephemeral test server running at ${baseUrl}`);
      resolve();
    });
  });
}

async function teardown() {
  console.log('\n--- Tearing Down Phase 7 Test Fixtures ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  const allMadrasaIds = [madrasaA?.id, madrasaB?.id, expiredMadrasa?.id, expiringSoonMadrasa?.id].filter(Boolean);
  const allUserIds = [superAdminUser?.id, adminA?.id, adminB?.id, expiredAdmin?.id, expiringSoonAdmin?.id].filter(Boolean);

  try {
    await prisma.activityLog.deleteMany({
      where: {
        OR: [
          { madrasaId: { in: allMadrasaIds } },
          { userId: { in: allUserIds } },
        ],
      },
    });

    await prisma.receipt.deleteMany({
      where: { madrasaId: { in: allMadrasaIds } },
    });

    await prisma.paymentAllocation.deleteMany({
      where: { madrasaId: { in: allMadrasaIds } },
    });

    await prisma.payment.deleteMany({
      where: { madrasaId: { in: allMadrasaIds } },
    });

    await prisma.invoiceItem.deleteMany({
      where: { madrasaId: { in: allMadrasaIds } },
    });

    await prisma.invoice.deleteMany({
      where: { madrasaId: { in: allMadrasaIds } },
    });

    await prisma.studentFeeSetting.deleteMany({
      where: { madrasaId: { in: allMadrasaIds } },
    });

    await prisma.student.deleteMany({
      where: { madrasaId: { in: allMadrasaIds } },
    });

    await prisma.class.deleteMany({
      where: { madrasaId: { in: allMadrasaIds } },
    });

    await prisma.subscriptionPayment.deleteMany({
      where: { madrasaId: { in: allMadrasaIds } },
    });

    await prisma.subscription.deleteMany({
      where: { madrasaId: { in: allMadrasaIds } },
    });

    await prisma.madrasaSetting.deleteMany({
      where: { madrasaId: { in: allMadrasaIds } },
    });

    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: { in: allUserIds } },
          { email: { contains: TEST_PREFIX } },
        ],
      },
    });

    await prisma.madrasa.deleteMany({
      where: { id: { in: allMadrasaIds } },
    });

    if (planA) {
      await prisma.plan.deleteMany({ where: { id: planA.id } });
    }
  } catch (err) {
    console.error('Error during teardown:', err);
  }

  console.log('Teardown complete.');
}

async function runTests() {
  await setup();

  try {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;

    // ==========================================
    // GROUP 1: AUTHENTICATION & ROLE ENFORCEMENT
    // ==========================================
    console.log('\n[GROUP 1] Authentication & Role Authorization');

    // 1.1 Anonymous request to dashboard -> 401
    const anonRes = await fetch(`${baseUrl}/api/madrasa-admin/dashboard`);
    assert(anonRes.status === 401, 'Anonymous request to /dashboard returns 401 Unauthorized');

    // 1.2 Anonymous request to subscription -> 401
    const anonSubRes = await fetch(`${baseUrl}/api/madrasa-admin/subscription`);
    assert(anonSubRes.status === 401, 'Anonymous request to /subscription returns 401 Unauthorized');

    // 1.3 Super Admin token to tenant dashboard -> 403 Forbidden
    const sadminDashRes = await fetch(`${baseUrl}/api/madrasa-admin/dashboard`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(sadminDashRes.status === 403, 'Super Admin request to /dashboard returns 403 Forbidden (requires MADRASA_ADMIN)');

    // 1.4 Super Admin token to tenant subscription overview -> 403 Forbidden
    const sadminSubRes = await fetch(`${baseUrl}/api/madrasa-admin/subscription`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(sadminSubRes.status === 403, 'Super Admin request to /subscription returns 403 Forbidden');

    // 1.5 User with mustChangePassword = true is blocked
    const pendingPassUser = await prisma.user.create({
      data: {
        name: 'Pending Pass Admin',
        email: `${TEST_PREFIX}_pending_pass@example.com`,
        passwordHash: await hashPassword('TemporaryP@ss123!'),
        role: 'MADRASA_ADMIN',
        madrasaId: madrasaA.id,
        isActive: true,
        mustChangePassword: true,
      },
    });
    const pendingPassToken = signAccessToken({
      userId: pendingPassUser.id,
      role: pendingPassUser.role,
      madrasaId: madrasaA.id,
    });

    const pendingPassRes = await fetch(`${baseUrl}/api/madrasa-admin/dashboard`, {
      headers: { Authorization: `Bearer ${pendingPassToken}` },
    });
    const pendingPassJson = await pendingPassRes.json();
    assert(pendingPassRes.status === 403, 'mustChangePassword = true blocks dashboard with 403');
    assert(pendingPassJson.code === 'MUST_CHANGE_PASSWORD', 'Blocked response returns code MUST_CHANGE_PASSWORD');

    // Cleanup temporary user
    await prisma.user.delete({ where: { id: pendingPassUser.id } });

    // ==========================================
    // GROUP 2: ROUTE-LEVEL SUBSCRIPTION EXEMPTION (CORRECTION 1 & 2)
    // ==========================================
    console.log('\n[GROUP 2] Route-Level Subscription Exemption & Gating');

    // 2.1 Expired Madrasa Admin CAN access GET /subscription
    const expSubRes = await fetch(`${baseUrl}/api/madrasa-admin/subscription`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const expSubJson = await expSubRes.json();
    assert(expSubRes.status === 200, 'Expired Madrasa Admin can access GET /subscription (returns 200)');
    assert(expSubJson.data?.currentAccess?.allowed === false, 'Current access allowed is false');
    assert(expSubJson.data?.currentAccess?.code === 'SUBSCRIPTION_EXPIRED', 'Code is SUBSCRIPTION_EXPIRED');
    assert(expSubJson.data?.terms?.length >= 1, 'Historical terms returned for expired tenant');

    // 2.2 Expired Madrasa Admin BLOCKED from GET /dashboard
    const expDashRes = await fetch(`${baseUrl}/api/madrasa-admin/dashboard`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const expDashJson = await expDashRes.json();
    assert(expDashRes.status === 403, 'Expired Madrasa Admin blocked from GET /dashboard (returns 403)');
    assert(expDashJson.code === 'SUBSCRIPTION_EXPIRED', 'Blocked dashboard code is SUBSCRIPTION_EXPIRED');

    // 2.3 Expired Madrasa Admin BLOCKED from GET /settings
    const expSettingsRes = await fetch(`${baseUrl}/api/madrasa-admin/settings`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(expSettingsRes.status === 403, 'Expired Madrasa Admin blocked from GET /settings (returns 403)');

    // 2.4 Active Madrasa Admin CAN access GET /dashboard
    const activeDashRes = await fetch(`${baseUrl}/api/madrasa-admin/dashboard`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const activeDashJson = await activeDashRes.json();
    assert(activeDashRes.status === 200, 'Active Madrasa Admin accesses GET /dashboard successfully (200)');
    assert(activeDashJson.data?.subscription?.allowed === true, 'Subscription status allowed is true');
    assert(activeDashJson.data?.subscription?.status === 'ACTIVE', 'Subscription status is ACTIVE');

    // 2.5 Expiring-Soon Madrasa Admin CAN access GET /dashboard with warning flag
    const soonDashRes = await fetch(`${baseUrl}/api/madrasa-admin/dashboard`, {
      headers: { Authorization: `Bearer ${expiringSoonToken}` },
    });
    const soonDashJson = await soonDashRes.json();
    assert(soonDashRes.status === 200, 'Expiring-Soon Madrasa Admin accesses GET /dashboard (returns 200)');
    assert(soonDashJson.data?.subscription?.isExpiringSoon === true, 'Dashboard flags isExpiringSoon = true');
    assert(soonDashJson.data?.subscription?.status === 'EXPIRING_SOON', 'Dashboard status is EXPIRING_SOON');

    // ==========================================
    // GROUP 3: TENANT ISOLATION & SCOPE PROTECTION
    // ==========================================
    console.log('\n[GROUP 3] Strict Tenant Scope & Cross-Tenant Isolation');

    // 3.1 Madrasa A settings does not show Madrasa B
    const settingsARes = await fetch(`${baseUrl}/api/madrasa-admin/settings`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const settingsAJson = await settingsARes.json();
    assert(settingsAJson.data?.madrasa?.id === madrasaA.id, 'Settings GET strictly returns Madrasa A ID');
    assert(settingsAJson.data?.settings?.invoicePrefix === 'INVA-', 'Settings returns Madrasa A invoicePrefix');

    // 3.2 Client cannot override tenant scope via query or body
    const overrideAttemptRes = await fetch(`${baseUrl}/api/madrasa-admin/dashboard?madrasaId=${madrasaB.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const overrideJson = await overrideAttemptRes.json();
    assert(overrideAttemptRes.status === 200, 'Request succeeds but ignores client madrasaId parameter');
    assert(overrideJson.data?.subscription?.subscription?.id === subA.id, 'Tenant data resolves to authenticated token Madrasa A, not B');

    // 3.3 Madrasa A cannot patch Madrasa B settings
    const crossPatchRes = await fetch(`${baseUrl}/api/madrasa-admin/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        madrasaId: madrasaB.id,
        name: 'Hacked Name For Madrasa B',
        invoicePrefix: 'HACK-',
      }),
    });
    assert(crossPatchRes.status === 200, 'PATCH succeeds on caller Madrasa');
    const dbCheckB = await prisma.madrasa.findUnique({ where: { id: madrasaB.id } });
    assert(dbCheckB?.name === 'Madrasa B Testing Institute', 'Madrasa B name was NOT modified by Madrasa A request');
    const dbCheckA = await prisma.madrasa.findUnique({ where: { id: madrasaA.id } });
    assert(dbCheckA?.name === 'Hacked Name For Madrasa B', 'Only caller Madrasa A was updated');

    // Restore Madrasa A name
    await prisma.madrasa.update({ where: { id: madrasaA.id }, data: { name: 'Madrasa A Testing Institute' } });

    // ==========================================
    // GROUP 4: DASHBOARD KPIS, ANALYTICS & EMPTY STATES (CORRECTIONS 3, 5, 6, 7)
    // ==========================================
    console.log('\n[GROUP 4] Real Financial Analytics & Empty State Handling');

    // 4.1 True Empty State: verify clean zeros and empty distributions before data is added
    const emptyDashRes = await fetch(`${baseUrl}/api/madrasa-admin/dashboard`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const emptyDashJson = await emptyDashRes.json();
    assert(emptyDashJson.data?.kpis?.totalStudents === 0, 'Empty state: totalStudents is 0');
    assert(emptyDashJson.data?.kpis?.activeClasses === 0, 'Empty state: activeClasses is 0');
    assert(emptyDashJson.data?.kpis?.currentMonthExpectedFees === 0, 'Empty state: currentMonthExpectedFees is 0');
    assert(emptyDashJson.data?.kpis?.currentMonthCollectedFees === 0, 'Empty state: currentMonthCollectedFees is 0');
    assert(emptyDashJson.data?.kpis?.currentMonthPendingFees === 0, 'Empty state: currentMonthPendingFees is 0');
    assert(emptyDashJson.data?.kpis?.totalOutstandingBalance === 0, 'Empty state: totalOutstandingBalance is 0');
    assert(emptyDashJson.data?.charts?.studentStatusDistribution?.active === 0, 'Empty state: student distribution active is 0');
    assert(emptyDashJson.data?.charts?.invoiceStatusDistribution?.pending === 0, 'Empty state: invoice distribution pending is 0');

    // 4.2 Populate test data for Madrasa A (Student, Class, Invoices, Payments)
    const testClass = await prisma.class.create({
      data: {
        madrasaId: madrasaA.id,
        name: 'Hifz Class 1',
        code: 'HIFZ01',
        defaultMonthlyFee: 2500.0,
        isActive: true,
      },
    });

    const testStudent = await prisma.student.create({
      data: {
        madrasaId: madrasaA.id,
        classId: testClass.id,
        admissionNo: 'ADM-001',
        fullName: 'Talib Ilm Test',
        guardianName: 'Wali Test',
        admissionDate: now,
        monthlyFee: 2500.0,
        status: 'ACTIVE',
      },
    });

    // Populate a student for Madrasa B to verify strict isolation
    const studentB = await prisma.student.create({
      data: {
        madrasaId: madrasaB.id,
        admissionNo: 'ADM-002-B',
        fullName: 'Talib B',
        guardianName: 'Wali B',
        admissionDate: now,
        status: 'ACTIVE',
      },
    });

    // 4.3 Create current month collectible Invoice: 1,500.00
    const inv1 = await prisma.invoice.create({
      data: {
        madrasaId: madrasaA.id,
        studentId: testStudent.id,
        invoiceNo: 'INV-2026-001',
        billingYear: currentYear,
        billingMonth: currentMonth,
        issueDate: now,
        subtotal: 1500.0,
        totalAmount: 1500.0,
        paidAmount: 1000.0,
        balanceAmount: 500.0,
        status: 'PARTIAL',
      },
    });

    // Completed student payment of 1,000.00 allocated to inv1
    const pay1 = await prisma.payment.create({
      data: {
        madrasaId: madrasaA.id,
        studentId: testStudent.id,
        paymentNo: 'PAY-001',
        amount: 1000.0,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        paidAt: now,
      },
    });

    const alloc1 = await prisma.paymentAllocation.create({
      data: {
        madrasaId: madrasaA.id,
        paymentId: pay1.id,
        invoiceId: inv1.id,
        amount: 1000.0,
      },
    });

    // 4.4 Create a VOID Payment (500.00) with allocation to inv1 -> MUST NOT be counted in collected fees
    const voidPay = await prisma.payment.create({
      data: {
        madrasaId: madrasaA.id,
        studentId: testStudent.id,
        paymentNo: 'PAY-VOID-001',
        amount: 500.0,
        paymentMethod: 'CASH',
        status: 'VOID',
        paidAt: now,
        voidedAt: now,
        voidReason: 'Mistaken entry',
      },
    });

    await prisma.paymentAllocation.create({
      data: {
        madrasaId: madrasaA.id,
        paymentId: voidPay.id,
        invoiceId: inv1.id,
        amount: 500.0,
      },
    });

    // 4.5 Create a second student and a VOID Invoice (700.00) -> MUST NOT be counted in expected or outstanding balance
    const voidStudent = await prisma.student.create({
      data: {
        madrasaId: madrasaA.id,
        admissionNo: 'ADM-VOID-002',
        fullName: 'Void Invoice Student',
        guardianName: 'Guardian Void',
        admissionDate: now,
        status: 'ACTIVE',
      },
    });

    await prisma.invoice.create({
      data: {
        madrasaId: madrasaA.id,
        studentId: voidStudent.id,
        invoiceNo: 'INV-VOID-999',
        billingYear: currentYear,
        billingMonth: currentMonth,
        issueDate: now,
        subtotal: 700.0,
        totalAmount: 700.0,
        balanceAmount: 700.0,
        status: 'VOID',
      },
    });

    // 4.6 Verify Dashboard Analytics with real fixtures
    const realDashRes = await fetch(`${baseUrl}/api/madrasa-admin/dashboard`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const realDashJson = await realDashRes.json();

    assert(realDashJson.data?.kpis?.totalStudents === 2, 'Counts exactly 2 students for Madrasa A (ignores Madrasa B)');
    assert(realDashJson.data?.kpis?.activeClasses === 1, 'Counts 1 active class for Madrasa A');
    assert(realDashJson.data?.kpis?.currentMonthExpectedFees === 1500.0, 'Expected fees matches non-VOID invoice totalAmount (1500.00)');
    assert(realDashJson.data?.kpis?.currentMonthCollectedFees === 1000.0, 'Collected fees uses PaymentAllocation from COMPLETED payment only (1000.00)');
    assert(realDashJson.data?.kpis?.currentMonthPendingFees === 500.0, 'Pending fees calculated as max(Expected - Collected, 0) = 500.00');
    assert(realDashJson.data?.kpis?.totalOutstandingBalance === 500.0, 'Outstanding balance matches collectible balanceAmount (500.00, excludes VOID)');

    // 4.7 Monthly Fee Performance Chart vs Monthly Cash Collection Chart
    const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const feePoint = realDashJson.data?.charts?.monthlyFeePerformance?.find((p) => p.month === currentMonthKey);
    assert(feePoint?.expected === 1500.0, 'Monthly fee chart shows expected 1500.00 for billing month');
    assert(feePoint?.collected === 1000.0, 'Monthly fee chart shows collected 1000.00 via allocation');
    assert(feePoint?.pending === 500.0, 'Monthly fee chart shows pending 500.00');

    const cashPoint = realDashJson.data?.charts?.monthlyCashCollection?.find((p) => p.month === currentMonthKey);
    assert(cashPoint?.collected === 1000.0, 'Monthly cash chart shows 1000.00 received in paidAt month');

    // 4.8 Status distributions
    assert(realDashJson.data?.charts?.studentStatusDistribution?.active === 2, 'Student distribution has 2 active');
    assert(realDashJson.data?.charts?.invoiceStatusDistribution?.partial === 1, 'Invoice distribution has 1 partial');
    assert(realDashJson.data?.charts?.invoiceStatusDistribution?.void === 1, 'Invoice distribution tracks 1 void');

    // ==========================================
    // GROUP 5: SETTINGS & PROFILE CRUD & VALIDATIONS
    // ==========================================
    console.log('\n[GROUP 5] Tenant Settings & Administrator Profile Management');

    // 5.1 Valid settings update
    const patchSettingsRes = await fetch(`${baseUrl}/api/madrasa-admin/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Darul Uloom Al-Hikmah Updated',
        phone: '+94778889900',
        address: '123 Campus Lane, Colombo 03',
        invoicePrefix: 'DUA-',
        receiptPrefix: 'REC-DUA-',
        currency: 'LKR',
        timezone: 'Asia/Colombo',
        academicYear: '2026/2027',
        receiptHeader: 'Thank you for supporting islamic education',
        receiptFooter: 'Official receipt generated by MadrasaNexa',
      }),
    });
    const patchSettingsJson = await patchSettingsRes.json();
    assert(patchSettingsRes.status === 200, 'Settings PATCH returns HTTP 200');
    assert(patchSettingsJson.data?.madrasa?.name === 'Darul Uloom Al-Hikmah Updated', 'Institution name updated');
    assert(patchSettingsJson.data?.settings?.invoicePrefix === 'DUA-', 'Invoice prefix updated');
    assert(patchSettingsJson.data?.settings?.academicYear === '2026/2027', 'Academic year updated');

    // 5.2 Attempt to change protected fields (code, slug, status) is ignored/immutable
    const tamperSettingsRes = await fetch(`${baseUrl}/api/madrasa-admin/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: 'HACKCODE',
        slug: 'hack-slug',
        status: 'SUSPENDED',
      }),
    });
    assert(tamperSettingsRes.status === 200, 'Tamper attempt request completes safely');
    const verifiedMadrasaA = await prisma.madrasa.findUnique({ where: { id: madrasaA.id } });
    assert(verifiedMadrasaA?.code === `${TEST_PREFIX.slice(-6).toUpperCase()}01`, 'Madrasa code was NOT altered');
    assert(verifiedMadrasaA?.slug === `${TEST_PREFIX}-m-a`, 'Madrasa slug was NOT altered');
    assert(verifiedMadrasaA?.status === 'ACTIVE', 'Madrasa status was NOT altered');

    // 5.3 Invalid timezone rejected
    const badTzRes = await fetch(`${baseUrl}/api/madrasa-admin/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timezone: 'Fake/Timezone_Mars',
      }),
    });
    assert(badTzRes.status === 400, 'Invalid IANA timezone rejected with 400 Bad Request');

    // 5.4 Invalid invoice prefix rejected
    const badPrefixRes = await fetch(`${baseUrl}/api/madrasa-admin/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoicePrefix: 'BAD@#$$%^&*',
      }),
    });
    assert(badPrefixRes.status === 400, 'Malformed invoice prefix rejected with 400 Bad Request');

    // 5.5 Admin Profile GET
    const profileRes = await fetch(`${baseUrl}/api/madrasa-admin/profile`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const profileJson = await profileRes.json();
    assert(profileRes.status === 200, 'Admin profile GET returns 200');
    assert(profileJson.data?.name === 'Administrator A', 'Profile returns admin name');
    assert(profileJson.data?.passwordHash === undefined, 'passwordHash is NOT exposed');

    // 5.6 Admin Profile PATCH
    const patchProfileRes = await fetch(`${baseUrl}/api/madrasa-admin/profile`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Moulana Zahid Updated',
        email: `${TEST_PREFIX}_new_email@example.com`,
      }),
    });
    const patchProfileJson = await patchProfileRes.json();
    assert(patchProfileRes.status === 200, 'Admin profile PATCH returns 200');
    assert(patchProfileJson.data?.name === 'Moulana Zahid Updated', 'Admin name updated');
    assert(patchProfileJson.data?.email === `${TEST_PREFIX}_new_email@example.com`, 'Admin email updated');

    // 5.7 Duplicate email collision rejected
    const dupEmailRes = await fetch(`${baseUrl}/api/madrasa-admin/profile`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: `${TEST_PREFIX}_admin_b@example.com`, // already belongs to adminB
      }),
    });
    assert(dupEmailRes.status === 409, 'Duplicate admin email returns 409 Conflict');

    // ==========================================
    // GROUP 6: TENANT ACTIVITY AUDIT TRAIL
    // ==========================================
    console.log('\n[GROUP 6] Tenant Activity Audit Trail');

    const activityRes = await fetch(`${baseUrl}/api/madrasa-admin/activity`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const activityJson = await activityRes.json();
    assert(activityRes.status === 200, 'Tenant activity GET returns 200');
    assert(activityJson.data?.logs?.length >= 2, 'Activity log contains recorded tenant actions');
    assert(activityJson.data?.logs?.some((l) => l.action === 'MADRASA_SETTINGS_UPDATED'), 'Contains MADRASA_SETTINGS_UPDATED');
    assert(activityJson.data?.logs?.some((l) => l.action === 'ADMIN_PROFILE_UPDATED'), 'Contains ADMIN_PROFILE_UPDATED');

    // Activity isolation: Madrasa A logs contain only Madrasa A records
    const hasLeak = activityJson.data?.logs?.some((l) => l.madrasaId && l.madrasaId !== madrasaA.id);
    assert(!hasLeak, 'Zero cross-tenant activity logs leaked');

  } catch (err) {
    console.error('Fatal error during test run:', err);
    testFailedCount++;
  } finally {
    await teardown();
  }

  console.log('\n=============================================');
  console.log(`Phase 7 Test Results: ${testPassedCount} Passed, ${testFailedCount} Failed`);
  console.log('=============================================\n');

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runTests();
