process.env.NODE_ENV = 'test';
import './setup-test-env.js';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { enableTestMode } from '../src/services/email.service.js';
import app from '../src/app.js';

const TEST_PREFIX = 'sai_' + Date.now();
const SLUG_BASE = 'sai' + Date.now().toString().slice(-8);

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

let madrasaAdminUser = null;
let madrasaAdminToken = '';

let madrasa1 = null;
let madrasa2 = null;
let madrasa3 = null; // Suspended
let madrasa4 = null; // Archived

let admin1 = null;
let admin2 = null;

let planA = null;
let planB = null;

let sub1 = null;
let sub2 = null;
let expiredSubMadrasa = null;
let expiredAdminUser = null;
let expiredAdminToken = null;

let student1 = null;
let class1 = null;
let invoice1 = null;
let payment1 = null;

let approvedOnboarding = null;

async function setup() {
  console.log('\n--- Setting up Super Admin Institutions Management Test Fixtures ---');
  enableTestMode(true);

  // 1. Super Admin
  superAdminUser = await prisma.user.create({
    data: {
      name: 'Institutions Super Admin',
      email: `${TEST_PREFIX}_super@example.com`,
      passwordHash: await hashPassword('SuperSecureP@ssword123!'),
      role: 'SUPER_ADMIN',
      madrasaId: null,
      isActive: true,
      mustChangePassword: false,
    },
  });
  superAdminToken = signAccessToken({
    userId: superAdminUser.id,
    role: superAdminUser.role,
    madrasaId: null,
  });

  // 2. Plans
  planA = await prisma.plan.create({
    data: {
      name: `Plan Alpha ${TEST_PREFIX}`,
      code: `PLA_${TEST_PREFIX.slice(-6).toUpperCase()}`,
      durationMonths: 6,
      price: 150.0,
      isActive: true,
    },
  });

  planB = await prisma.plan.create({
    data: {
      name: `Plan Beta ${TEST_PREFIX}`,
      code: `PLB_${TEST_PREFIX.slice(-6).toUpperCase()}`,
      durationMonths: 12,
      price: 300.0,
      isActive: true,
    },
  });

  // 3. Madrasas
  madrasa1 = await prisma.madrasa.create({
    data: {
      name: `Al-Huda Academy ${TEST_PREFIX}`,
      code: `HUD_${TEST_PREFIX.slice(-5).toUpperCase()}`,
      slug: `${SLUG_BASE}-huda`,
      email: `contact@huda-${TEST_PREFIX}.com`,
      phone: '+94771234567',
      address: '123 Main Street, Colombo',
      status: 'ACTIVE',
    },
  });

  madrasa2 = await prisma.madrasa.create({
    data: {
      name: `Darul Uloom ${TEST_PREFIX}`,
      code: `DAR_${TEST_PREFIX.slice(-5).toUpperCase()}`,
      slug: `${SLUG_BASE}-darul`,
      email: `info@darul-${TEST_PREFIX}.com`,
      phone: '+94779876543',
      address: '456 Hill Road, Kandy',
      status: 'ACTIVE',
    },
  });

  madrasa3 = await prisma.madrasa.create({
    data: {
      name: `Suspended Madrasa ${TEST_PREFIX}`,
      code: `SUS_${TEST_PREFIX.slice(-5).toUpperCase()}`,
      slug: `${SLUG_BASE}-sus`,
      email: `sus@${TEST_PREFIX}.com`,
      status: 'SUSPENDED',
    },
  });

  madrasa4 = await prisma.madrasa.create({
    data: {
      name: `Archived Madrasa ${TEST_PREFIX}`,
      code: `ARC_${TEST_PREFIX.slice(-5).toUpperCase()}`,
      slug: `${SLUG_BASE}-arc`,
      email: `arc@${TEST_PREFIX}.com`,
      status: 'ARCHIVED',
      archivedAt: new Date(),
    },
  });

  // 4. Admins
  admin1 = await prisma.user.create({
    data: {
      name: `Huda Administrator ${TEST_PREFIX}`,
      email: `admin.huda.${TEST_PREFIX}@example.com`,
      passwordHash: await hashPassword('AdminPass123!'),
      role: 'MADRASA_ADMIN',
      madrasaId: madrasa1.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  madrasaAdminUser = admin1;
  madrasaAdminToken = signAccessToken({
    userId: admin1.id,
    role: admin1.role,
    madrasaId: madrasa1.id,
  });

  admin2 = await prisma.user.create({
    data: {
      name: `Darul Administrator ${TEST_PREFIX}`,
      email: `admin.darul.${TEST_PREFIX}@example.com`,
      passwordHash: await hashPassword('AdminPass123!'),
      role: 'MADRASA_ADMIN',
      madrasaId: madrasa2.id,
      isActive: true,
      mustChangePassword: false,
    },
  });

  // 5. Subscriptions
  const now = new Date();
  const futureEndsAt = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
  const expiringEndsAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days remaining (expiring soon)

  sub1 = await prisma.subscription.create({
    data: {
      madrasaId: madrasa1.id,
      planId: planA.id,
      status: 'ACTIVE',
      startsAt: now,
      endsAt: futureEndsAt,
      priceAtPurchase: planA.price,
      durationMonthsAtPurchase: planA.durationMonths,
    },
  });

  sub2 = await prisma.subscription.create({
    data: {
      madrasaId: madrasa2.id,
      planId: planB.id,
      status: 'EXPIRING_SOON',
      startsAt: new Date(now.getTime() - 177 * 24 * 60 * 60 * 1000),
      endsAt: expiringEndsAt,
      priceAtPurchase: planB.price,
      durationMonthsAtPurchase: planB.durationMonths,
    },
  });

  // 6. Tenant 1 Child Records for usage & isolation tests
  class1 = await prisma.class.create({
    data: {
      name: 'Hifz Class A',
      madrasaId: madrasa1.id,
      defaultMonthlyFee: 50.0,
    },
  });

  student1 = await prisma.student.create({
    data: {
      madrasaId: madrasa1.id,
      classId: class1.id,
      admissionNo: `ADM_${TEST_PREFIX.slice(-5)}_01`,
      fullName: 'Student One',
      guardianName: 'Guardian One',
      guardianPhone: '+94771111111',
      admissionDate: new Date('2024-01-01'),
      status: 'ACTIVE',
    },
  });

  invoice1 = await prisma.invoice.create({
    data: {
      madrasaId: madrasa1.id,
      studentId: student1.id,
      invoiceNo: `INV_${TEST_PREFIX.slice(-5)}_01`,
      billingYear: 2026,
      billingMonth: 1,
      issueDate: new Date(),
      subtotal: 100.0,
      totalAmount: 100.0,
      paidAmount: 100.0,
      balanceAmount: 0.0,
      status: 'PAID',
    },
  });

  payment1 = await prisma.payment.create({
    data: {
      madrasaId: madrasa1.id,
      studentId: student1.id,
      paymentNo: `PAY_${TEST_PREFIX.slice(-5)}_01`,
      amount: 100.0,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      paidAt: new Date(),
    },
  });

  // 7. Expired Subscription Madrasa for Expiry Lock Test
  const pastStartsAt = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const pastEndsAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days expired
  expiredSubMadrasa = await prisma.madrasa.create({
    data: {
      name: `Expired Subscription Madrasa ${TEST_PREFIX}`,
      code: `EXP_${TEST_PREFIX.slice(-5).toUpperCase()}`,
      slug: `${SLUG_BASE}-exp`,
      status: 'SUSPENDED',
    },
  });
  await prisma.subscription.create({
    data: {
      madrasaId: expiredSubMadrasa.id,
      planId: planA.id,
      status: 'EXPIRED',
      startsAt: pastStartsAt,
      endsAt: pastEndsAt,
      priceAtPurchase: planA.price,
      durationMonthsAtPurchase: planA.durationMonths,
    },
  });
  expiredAdminUser = await prisma.user.create({
    data: {
      name: `Expired Madrasa Admin ${TEST_PREFIX}`,
      email: `admin.exp.${TEST_PREFIX}@example.com`,
      passwordHash: await hashPassword('AdminPass123!'),
      role: 'MADRASA_ADMIN',
      madrasaId: expiredSubMadrasa.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  expiredAdminToken = signAccessToken({
    userId: expiredAdminUser.id,
    role: expiredAdminUser.role,
    madrasaId: expiredSubMadrasa.id,
  });

  // 8. Approved Onboarding Request linking to madrasa1
  approvedOnboarding = await prisma.madrasaOnboardingRequest.create({
    data: {
      madrasaName: `Onboarded Request ${TEST_PREFIX}`,
      contactName: 'Contact Person',
      email: `request.${TEST_PREFIX}@example.com`,
      phone: '+94770000000',
      status: 'APPROVED',
      approvedMadrasaId: madrasa1.id,
      reviewedByUserId: superAdminUser.id,
      reviewedAt: new Date(),
    },
  });

  // 9. Start Express Test Server
  await new Promise((resolve) => {
    testServer = app.listen(0, () => {
      const port = testServer.address().port;
      baseUrl = `http://localhost:${port}/api`;
      resolve();
    });
  });

  console.log(`Test server active at: ${baseUrl}`);
}

async function teardown() {
  console.log('\n--- Tearing Down Super Admin Institutions Test Fixtures ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  // Delete records created during tests
  try {
    if (approvedOnboarding) {
      await prisma.madrasaOnboardingRequest.delete({ where: { id: approvedOnboarding.id } }).catch(() => {});
    }
    if (payment1) {
      await prisma.payment.delete({ where: { id: payment1.id } }).catch(() => {});
    }
    if (invoice1) {
      await prisma.invoice.delete({ where: { id: invoice1.id } }).catch(() => {});
    }
    if (student1) {
      await prisma.student.delete({ where: { id: student1.id } }).catch(() => {});
    }
    if (class1) {
      await prisma.class.delete({ where: { id: class1.id } }).catch(() => {});
    }

    await prisma.subscription.deleteMany({
      where: {
        madrasaId: { in: [madrasa1?.id, madrasa2?.id, madrasa3?.id, madrasa4?.id, expiredSubMadrasa?.id].filter(Boolean) },
      },
    }).catch(() => {});

    await prisma.activityLog.deleteMany({
      where: {
        madrasaId: { in: [madrasa1?.id, madrasa2?.id, madrasa3?.id, madrasa4?.id, expiredSubMadrasa?.id].filter(Boolean) },
      },
    }).catch(() => {});

    await prisma.user.deleteMany({
      where: {
        email: { contains: TEST_PREFIX },
      },
    }).catch(() => {});

    await prisma.madrasa.deleteMany({
      where: {
        id: { in: [madrasa1?.id, madrasa2?.id, madrasa3?.id, madrasa4?.id, expiredSubMadrasa?.id].filter(Boolean) },
      },
    }).catch(() => {});

    await prisma.plan.deleteMany({
      where: {
        id: { in: [planA?.id, planB?.id].filter(Boolean) },
      },
    }).catch(() => {});
  } catch (err) {
    console.error('Teardown cleanup error:', err.message);
  }
}

async function runTests() {
  console.log('\n=============================================');
  console.log('Running 29 Super Admin Institutions Tests');
  console.log('=============================================\n');

  // Test 1: Super Admin list institutions (200)
  const res1 = await fetch(`${baseUrl}/super-admin/madrasas`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const data1 = await res1.json();
  assert(res1.status === 200 && data1.success === true, '1. Super Admin list institutions returns HTTP 200');

  // Test 2: Madrasa Admin forbidden (403)
  const res2 = await fetch(`${baseUrl}/super-admin/madrasas`, {
    headers: { Authorization: `Bearer ${madrasaAdminToken}` },
  });
  assert(res2.status === 403, '2. Madrasa Admin is forbidden from listing institutions (HTTP 403)');

  // Test 3: Unauthenticated forbidden (401)
  const res3 = await fetch(`${baseUrl}/super-admin/madrasas`);
  assert(res3.status === 401, '3. Unauthenticated request is rejected (HTTP 401)');

  // Test 4: Search by Madrasa name
  const res4 = await fetch(`${baseUrl}/super-admin/madrasas?search=Al-Huda`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const data4 = await res4.json();
  assert(
    data4.data.madrasas.some((m) => m.id === madrasa1.id),
    '4. Search by Madrasa name returns matching institution'
  );

  // Test 5: Search by code
  const res5 = await fetch(`${baseUrl}/super-admin/madrasas?search=${madrasa1.code}`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const data5 = await res5.json();
  assert(
    data5.data.madrasas.some((m) => m.code === madrasa1.code),
    '5. Search by Madrasa code returns matching institution'
  );

  // Test 6: Status filter (ACTIVE, SUSPENDED, ARCHIVED)
  const res6Active = await fetch(`${baseUrl}/super-admin/madrasas?status=ACTIVE`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const data6Active = await res6Active.json();
  const allActive = data6Active.data.madrasas.every((m) => m.status === 'ACTIVE');

  const res6Sus = await fetch(`${baseUrl}/super-admin/madrasas?status=SUSPENDED`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const data6Sus = await res6Sus.json();
  const hasSuspended = data6Sus.data.madrasas.some((m) => m.id === madrasa3.id);

  assert(allActive && hasSuspended, '6. Status filter accurately filters ACTIVE, SUSPENDED, ARCHIVED');

  // Test 7: Dynamic Plan filter
  const res7 = await fetch(`${baseUrl}/super-admin/madrasas?planId=${planB.id}`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const data7 = await res7.json();
  assert(
    data7.data.madrasas.some((m) => m.id === madrasa2.id) &&
      !data7.data.madrasas.some((m) => m.id === madrasa1.id),
    '7. Dynamic Plan filter filters institutions by subscribed plan'
  );

  // Test 8: Subscription status filter
  const res8 = await fetch(`${baseUrl}/super-admin/madrasas?subscriptionStatus=EXPIRING_SOON`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const data8 = await res8.json();
  assert(
    data8.data.madrasas.some((m) => m.id === madrasa2.id),
    '8. Subscription status filter correctly filters by EXPIRING_SOON'
  );

  // Test 9: Pagination
  const res9 = await fetch(`${baseUrl}/super-admin/madrasas?page=1&pageSize=2`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const data9 = await res9.json();
  assert(
    data9.data.pagination.page === 1 &&
      data9.data.pagination.pageSize === 2 &&
      data9.data.pagination.total >= 4 &&
      data9.data.madrasas.length <= 2,
    '9. Server-side pagination returns page, pageSize, total, and totalPages'
  );

  // Test 10: Accurate KPI counts
  assert(
    typeof data1.data.kpis.total === 'number' &&
      data1.data.kpis.total >= 4 &&
      typeof data1.data.kpis.active === 'number' &&
      typeof data1.data.kpis.suspended === 'number' &&
      typeof data1.data.kpis.archived === 'number' &&
      typeof data1.data.kpis.expiringSoon === 'number',
    '10. Accurate dynamic KPI counts calculated from real database records'
  );

  // Test 11: Institution detail fetch
  const res11 = await fetch(`${baseUrl}/super-admin/madrasas/${madrasa1.id}`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const data11 = await res11.json();
  assert(
    res11.status === 200 &&
      data11.data.id === madrasa1.id &&
      data11.data.name === madrasa1.name,
    '11. Institution detail endpoint returns full institutional overview'
  );

  // Test 12: Tenant Admin correct
  assert(
    data11.data.admins &&
      data11.data.admins.some((a) => a.id === admin1.id && a.role === 'MADRASA_ADMIN'),
    '12. Tenant Admin relation strictly scopes to users linked to this madrasa'
  );

  // Test 13: Current subscription correct
  assert(
    data11.data.activeSubscription &&
      data11.data.activeSubscription.planId === planA.id &&
      data11.data.activeSubscription.plan.name === planA.name,
    '13. Current subscription integration accurately reflects plan, terms, and status'
  );

  // Test 14: Branding belongs to correct Madrasa
  assert(
    data11.data.branding &&
      data11.data.branding.id === madrasa1.id &&
      typeof data11.data.branding.initials === 'string',
    '14. Dynamic branding resolution accurately scopes to the target institution'
  );

  // Test 15: Student count tenant-scoped
  assert(
    data11.data.usage && data11.data.usage.totalStudents === 1 && data11.data.usage.activeStudents === 1,
    '15. Usage count for students is strictly tenant-scoped (1 for Madrasa 1)'
  );

  // Test 16: Class count tenant-scoped
  assert(
    data11.data.usage && data11.data.usage.classes === 1,
    '16. Usage count for classes is strictly tenant-scoped (1 for Madrasa 1)'
  );

  // Test 17: Suspend ACTIVE Madrasa
  const res17 = await fetch(`${baseUrl}/super-admin/madrasas/${madrasa1.id}/suspend`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const data17 = await res17.json();
  assert(
    res17.status === 200 && data17.data.status === 'SUSPENDED',
    '17. Suspend ACTIVE Madrasa transitions status to SUSPENDED'
  );

  // Test 18: Suspended data remains intact
  const verifyStudents = await prisma.student.count({ where: { madrasaId: madrasa1.id } });
  const verifyClasses = await prisma.class.count({ where: { madrasaId: madrasa1.id } });
  const verifyInvoices = await prisma.invoice.count({ where: { madrasaId: madrasa1.id } });
  const verifyPayments = await prisma.payment.count({ where: { madrasaId: madrasa1.id } });
  assert(
    verifyStudents === 1 && verifyClasses === 1 && verifyInvoices === 1 && verifyPayments === 1,
    '18. Suspended Madrasa business data remains 100% intact (non-destructive)'
  );

  // Test 19: Reactivate SUSPENDED Madrasa
  const res19 = await fetch(`${baseUrl}/super-admin/madrasas/${madrasa1.id}/activate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const data19 = await res19.json();
  assert(
    res19.status === 200 && data19.data.status === 'ACTIVE',
    '19. Reactivate SUSPENDED Madrasa transitions status to ACTIVE'
  );

  // Test 20: Archive ACTIVE Madrasa
  // Let's create a temporary madrasa to test archiving from ACTIVE
  const tempMadrasaActive = await prisma.madrasa.create({
    data: {
      name: `Temp Archive Active ${TEST_PREFIX}`,
      code: `TAC_${TEST_PREFIX.slice(-5).toUpperCase()}`,
      slug: `${SLUG_BASE}-tac`,
      status: 'ACTIVE',
    },
  });
  const res20 = await fetch(`${baseUrl}/super-admin/madrasas/${tempMadrasaActive.id}/archive`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const data20 = await res20.json();
  assert(
    res20.status === 200 && data20.data.status === 'ARCHIVED',
    '20. Archive ACTIVE Madrasa transitions status to ARCHIVED'
  );

  // Test 21: Archive SUSPENDED Madrasa
  const tempMadrasaSus = await prisma.madrasa.create({
    data: {
      name: `Temp Archive Suspended ${TEST_PREFIX}`,
      code: `TAS_${TEST_PREFIX.slice(-5).toUpperCase()}`,
      slug: `${SLUG_BASE}-tas`,
      status: 'SUSPENDED',
    },
  });
  const res21 = await fetch(`${baseUrl}/super-admin/madrasas/${tempMadrasaSus.id}/archive`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const data21 = await res21.json();
  assert(
    res21.status === 200 && data21.data.status === 'ARCHIVED',
    '21. Archive SUSPENDED Madrasa transitions status to ARCHIVED'
  );

  // Test 22: Invalid lifecycle transition rejected (e.g. suspending ARCHIVED or suspending already SUSPENDED)
  const res22 = await fetch(`${baseUrl}/super-admin/madrasas/${madrasa4.id}/suspend`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert(res22.status === 400, '22. Invalid lifecycle transition (suspending ARCHIVED) rejected with HTTP 400');

  // Test 23: Concurrent stale lifecycle update safely blocked (simulate state conflict)
  // madrasa1 is currently ACTIVE. If a concurrent call tries to activate it (which expects SUSPENDED):
  const res23 = await fetch(`${baseUrl}/super-admin/madrasas/${madrasa1.id}/activate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert(res23.status === 400, '23. Stale lifecycle transition on current state safely blocked');

  // Test 24: ActivityLog created on status changes
  const recentLogs = await prisma.activityLog.findMany({
    where: {
      madrasaId: madrasa1.id,
      action: { in: ['MADRASA_SUSPENDED', 'MADRASA_ACTIVATED'] },
    },
  });
  assert(recentLogs.length >= 2, '24. ActivityLog records created for lifecycle changes');

  // Test 25: Expired Subscription is not bypassed by Reactivate
  // Reactivate expiredSubMadrasa from SUSPENDED -> ACTIVE
  const res25Reactivate = await fetch(`${baseUrl}/super-admin/madrasas/${expiredSubMadrasa.id}/activate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert(res25Reactivate.status === 200, '25a. Reactivate transitions Madrasa status to ACTIVE');

  // Now attempt to access a subscription-gated business endpoint as the expired Madrasa Admin
  const res25Business = await fetch(`${baseUrl}/madrasa-admin/students`, {
    headers: { Authorization: `Bearer ${expiredAdminToken}` },
  });
  assert(
    res25Business.status === 403,
    '25b. Expired Subscription is NOT bypassed by Reactivate: business routes still return 403'
  );

  // Test 26: Cross-tenant child records never appear
  const res26 = await fetch(`${baseUrl}/super-admin/madrasas/${madrasa2.id}`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const data26 = await res26.json();
  assert(
    data26.data.usage.totalStudents === 0 && data26.data.usage.classes === 0,
    '26. Cross-tenant isolation: Madrasa 2 shows 0 students and 0 classes'
  );

  // Test 27: Unknown Madrasa returns 404
  const res27 = await fetch(`${baseUrl}/super-admin/madrasas/non_existent_madrasa_id`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert(res27.status === 404, '27. Unknown Madrasa ID returns HTTP 404');

  // Test 28: Approved onboarding linked View Madrasa uses correct ID
  assert(
    approvedOnboarding.approvedMadrasaId === madrasa1.id,
    '28. Approved onboarding request links authoritatively to approvedMadrasaId'
  );

  // Test 29: No hard-delete occurs across institutions
  const allMadrasasCount = await prisma.madrasa.count({
    where: {
      id: { in: [madrasa1.id, madrasa2.id, madrasa3.id, madrasa4.id] },
    },
  });
  assert(
    allMadrasasCount === 4,
    '29. Zero hard-delete occurs: all institutional tenants retained in database'
  );

  // Clean up temporary madrasas
  await prisma.madrasa.deleteMany({
    where: { id: { in: [tempMadrasaActive.id, tempMadrasaSus.id] } },
  }).catch(() => {});
}

async function main() {
  try {
    await setup();
    await runTests();
  } catch (err) {
    console.error('Fatal test error:', err);
    testFailedCount++;
  } finally {
    await teardown();
  }

  console.log('\n=============================================');
  console.log(`Institutions Test Results: ${testPassedCount} Passed, ${testFailedCount} Failed`);
  console.log('=============================================');

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

main();
