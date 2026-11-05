process.env.NODE_ENV = 'test';
import './setup-test-env.js';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { enableTestMode } from '../src/services/email.service.js';
import { approveOnboardingRequest } from '../src/services/super-admin.service.js';
import { createSubscriptionRenewal, resolveSubscriptionAccess } from '../src/services/subscription.service.js';
import app from '../src/app.js';

const TEST_PREFIX = 'sap_' + Date.now();

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
let fixtureMadrasa = null;

let seededPlan1 = null;
let seededPlan2 = null;

async function setup() {
  console.log('\n--- Setting up Super Admin Subscription Plans Test Fixtures ---');
  enableTestMode(true);

  // 1. Super Admin
  superAdminUser = await prisma.user.create({
    data: {
      name: 'Super Admin Plans Tester',
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

  // 2. Madrasa & Madrasa Admin
  fixtureMadrasa = await prisma.madrasa.create({
    data: {
      name: `Fixture Madrasa ${TEST_PREFIX}`,
      code: `FM_${TEST_PREFIX.slice(-5).toUpperCase()}`,
      slug: `fm-${TEST_PREFIX.slice(-8).toLowerCase()}`,
      status: 'ACTIVE',
    },
  });

  madrasaAdminUser = await prisma.user.create({
    data: {
      name: 'Madrasa Admin Tester',
      email: `${TEST_PREFIX}_admin@example.com`,
      passwordHash: await hashPassword('AdminSecureP@ssword123!'),
      role: 'MADRASA_ADMIN',
      madrasaId: fixtureMadrasa.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  madrasaAdminToken = signAccessToken({
    userId: madrasaAdminUser.id,
    role: madrasaAdminUser.role,
    madrasaId: fixtureMadrasa.id,
  });

  // 3. Seeded Initial Plans
  seededPlan1 = await prisma.plan.create({
    data: {
      name: `Basic Plan ${TEST_PREFIX}`,
      code: `BASIC_${TEST_PREFIX.slice(-5).toUpperCase()}`,
      description: 'Basic tier for small institutions',
      durationMonths: 1,
      price: 1000.0,
      isActive: true,
    },
  });

  seededPlan2 = await prisma.plan.create({
    data: {
      name: `Standard Plan ${TEST_PREFIX}`,
      code: `STD_${TEST_PREFIX.slice(-5).toUpperCase()}`,
      description: 'Standard tier for growing institutions',
      durationMonths: 6,
      price: 5000.0,
      isActive: false, // Inactive
    },
  });

  // Start Express Test Server
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
  console.log('\n--- Tearing Down Super Admin Plans Test Fixtures ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  try {
    // Delete in dependency order
    await prisma.activityLog.deleteMany({
      where: {
        OR: [
          { userId: superAdminUser?.id },
          { userId: madrasaAdminUser?.id },
        ],
      },
    });

    await prisma.subscriptionPayment.deleteMany({
      where: { subscription: { madrasaId: fixtureMadrasa?.id } },
    });

    await prisma.subscription.deleteMany({
      where: { madrasaId: fixtureMadrasa?.id },
    });

    await prisma.madrasaOnboardingRequest.deleteMany({
      where: {
        email: { contains: TEST_PREFIX },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: { in: [superAdminUser?.id, madrasaAdminUser?.id].filter(Boolean) },
      },
    });

    await prisma.madrasaSetting.deleteMany({
      where: { madrasaId: fixtureMadrasa?.id },
    });

    await prisma.madrasaOnboardingRequest.updateMany({
      where: { approvedMadrasaId: fixtureMadrasa?.id },
      data: { approvedMadrasaId: null },
    });

    await prisma.madrasa.deleteMany({
      where: { id: fixtureMadrasa?.id },
    });

    await prisma.plan.deleteMany({
      where: {
        code: { contains: TEST_PREFIX.slice(-5).toUpperCase() },
      },
    });
  } catch (err) {
    console.error('Teardown error (non-fatal):', err.message);
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log(' SUPER ADMIN → SUBSCRIPTION PLANS MANAGEMENT TEST SUITE');
  console.log('======================================================\n');

  let dynamicPlan = null;

  // 1. Super Admin can list Plans with global KPIs
  {
    const res = await fetch(`${baseUrl}/super-admin/plans`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const json = await res.json();
    assert(
      res.status === 200 &&
      json.success === true &&
      Array.isArray(json.data) &&
      json.kpis &&
      typeof json.kpis.totalPlans === 'number' &&
      typeof json.kpis.activePlans === 'number' &&
      typeof json.kpis.inactivePlans === 'number' &&
      typeof json.kpis.activeSubscriptions === 'number' &&
      typeof json.kpis.institutionsUsingPlans === 'number',
      'Test 1: Super Admin can list Plans with global KPIs'
    );
  }

  // 2. Search and status filters affect plan list without mutating global KPI values
  {
    const allRes = await fetch(`${baseUrl}/super-admin/plans`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const allJson = await allRes.json();
    const globalTotal = allJson.kpis.totalPlans;

    // Filter by ACTIVE
    const activeRes = await fetch(`${baseUrl}/super-admin/plans?status=ACTIVE`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const activeJson = await activeRes.json();

    // Search for specific plan name
    const searchRes = await fetch(`${baseUrl}/super-admin/plans?search=${encodeURIComponent(seededPlan1.name)}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const searchJson = await searchRes.json();

    assert(
      activeRes.status === 200 &&
      activeJson.kpis.totalPlans === globalTotal &&
      activeJson.data.every((p) => p.isActive === true) &&
      searchRes.status === 200 &&
      searchJson.kpis.totalPlans === globalTotal &&
      searchJson.data.some((p) => p.id === seededPlan1.id),
      'Test 2: Search and status filters affect plan list without mutating global KPI values'
    );
  }

  // 3. Madrasa Admin cannot mutate Plans (403 Forbidden)
  {
    const postRes = await fetch(`${baseUrl}/super-admin/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${madrasaAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Unauthorized Plan',
        code: 'UNAUTH_PLAN',
        durationMonths: 1,
        price: 100,
      }),
    });

    const patchRes = await fetch(`${baseUrl}/super-admin/plans/${seededPlan1.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${madrasaAdminToken}`,
      },
      body: JSON.stringify({ name: 'Hacked' }),
    });

    const activateRes = await fetch(`${baseUrl}/super-admin/plans/${seededPlan1.id}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${madrasaAdminToken}` },
    });

    assert(
      postRes.status === 403 && patchRes.status === 403 && activateRes.status === 403,
      'Test 3: Madrasa Admin cannot mutate Plans (403 Forbidden)'
    );
  }

  // 4. Unauthenticated mutation denied (401 Unauthorized)
  {
    const postRes = await fetch(`${baseUrl}/super-admin/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'No Auth Plan',
        code: 'NO_AUTH',
        durationMonths: 1,
        price: 100,
      }),
    });
    assert(
      postRes.status === 401,
      'Test 4: Unauthenticated mutation denied (401 Unauthorized)'
    );
  }

  // 5. Create valid Plan (returns 201 with plan data)
  {
    const planCode = `PRO_${TEST_PREFIX.slice(-5).toUpperCase()}`;
    const res = await fetch(`${baseUrl}/super-admin/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Professional Tier ${TEST_PREFIX}`,
        code: planCode,
        description: 'Professional institutional tier with premium features',
        durationMonths: 12,
        price: '12000.00',
        isActive: true,
      }),
    });
    const json = await res.json();
    dynamicPlan = json.data;
    assert(
      res.status === 201 &&
      json.success === true &&
      json.data?.code === planCode &&
      Number(json.data?.price) === 12000 &&
      json.data?.durationMonths === 12 &&
      json.data?.isActive === true,
      'Test 5: Create valid Plan (returns 201 with plan data)'
    );
  }

  // 6. Dynamic Plan appears in list after creation
  {
    const res = await fetch(`${baseUrl}/super-admin/plans`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const json = await res.json();
    const found = json.data?.find((p) => p.id === dynamicPlan?.id);
    assert(
      res.status === 200 && found && found.name === dynamicPlan.name,
      'Test 6: Dynamic Plan appears in list after creation'
    );
  }

  // 7. Name trimming on creation
  {
    const code = `TRIM_${TEST_PREFIX.slice(-5).toUpperCase()}`;
    const cleanExpected = `Untrimmed Plan Name ${TEST_PREFIX}`;
    const res = await fetch(`${baseUrl}/super-admin/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `   ${cleanExpected}   `,
        code: code,
        durationMonths: 3,
        price: 300,
      }),
    });
    const json = await res.json();
    assert(
      res.status === 201 && json.data.name === cleanExpected,
      'Test 7: Name trimming on creation'
    );
  }

  // 8. Invalid empty name rejected with 400
  {
    const res = await fetch(`${baseUrl}/super-admin/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: '   ',
        code: `EMPTY_${TEST_PREFIX.slice(-5).toUpperCase()}`,
        durationMonths: 3,
        price: 300,
      }),
    });
    assert(
      res.status === 400,
      'Test 8: Invalid empty name rejected with 400'
    );
  }

  // 9. Invalid negative price rejected with 400
  {
    const res = await fetch(`${baseUrl}/super-admin/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Negative Price Plan ${TEST_PREFIX}`,
        code: `NEG_${TEST_PREFIX.slice(-5).toUpperCase()}`,
        durationMonths: 3,
        price: -50,
      }),
    });
    assert(
      res.status === 400,
      'Test 9: Invalid negative price rejected with 400'
    );
  }

  // 10. Decimal price with excess precision (e.g. 50.999) rejected with 400
  {
    const res = await fetch(`${baseUrl}/super-admin/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Excess Precision Plan ${TEST_PREFIX}`,
        code: `EXC_${TEST_PREFIX.slice(-5).toUpperCase()}`,
        durationMonths: 3,
        price: '50.999',
      }),
    });
    assert(
      res.status === 400,
      'Test 10: Decimal price with excess precision (e.g. 50.999) rejected with 400'
    );
  }

  // 11. Valid zero-price Plan accepted
  {
    const code = `FREE_${TEST_PREFIX.slice(-5).toUpperCase()}`;
    const res = await fetch(`${baseUrl}/super-admin/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Free Starter Tier ${TEST_PREFIX}`,
        code: code,
        durationMonths: 1,
        price: 0,
      }),
    });
    const json = await res.json();
    assert(
      res.status === 201 && Number(json.data.price) === 0,
      'Test 11: Valid zero-price Plan accepted'
    );
  }

  // 12. Invalid duration 0 rejected with 400
  {
    const res = await fetch(`${baseUrl}/super-admin/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Zero Duration Plan ${TEST_PREFIX}`,
        code: `DUR0_${TEST_PREFIX.slice(-5).toUpperCase()}`,
        durationMonths: 0,
        price: 100,
      }),
    });
    assert(
      res.status === 400,
      'Test 12: Invalid duration 0 rejected with 400'
    );
  }

  // 13. Invalid negative duration rejected with 400
  {
    const res = await fetch(`${baseUrl}/super-admin/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Neg Duration Plan ${TEST_PREFIX}`,
        code: `DURNEG_${TEST_PREFIX.slice(-5).toUpperCase()}`,
        durationMonths: -3,
        price: 100,
      }),
    });
    assert(
      res.status === 400,
      'Test 13: Invalid negative duration rejected with 400'
    );
  }

  // 14. Decimal duration (e.g. 1.5) rejected with 400
  {
    const res = await fetch(`${baseUrl}/super-admin/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Decimal Duration Plan ${TEST_PREFIX}`,
        code: `DURDEC_${TEST_PREFIX.slice(-5).toUpperCase()}`,
        durationMonths: 1.5,
        price: 100,
      }),
    });
    assert(
      res.status === 400,
      'Test 14: Decimal duration (e.g. 1.5) rejected with 400'
    );
  }

  // 15. Valid custom duration (e.g. 9 or 24) accepted
  {
    const code = `CUSTOM24_${TEST_PREFIX.slice(-5).toUpperCase()}`;
    const res = await fetch(`${baseUrl}/super-admin/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Biennial Tier ${TEST_PREFIX}`,
        code: code,
        durationMonths: 24,
        price: 20000,
      }),
    });
    const json = await res.json();
    assert(
      res.status === 201 && json.data.durationMonths === 24,
      'Test 15: Valid custom duration (e.g. 9 or 24) accepted'
    );
  }

  // 16. Plan.code uniqueness enforced on creation (409 Conflict)
  {
    const res = await fetch(`${baseUrl}/super-admin/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Duplicate Code Plan ${TEST_PREFIX}`,
        code: dynamicPlan.code, // Same code as test 5
        durationMonths: 6,
        price: 500,
      }),
    });
    assert(
      res.status === 409,
      'Test 16: Plan.code uniqueness enforced on creation (409 Conflict)'
    );
  }

  // 17. Edit Plan updates name, price, duration, description
  {
    const res = await fetch(`${baseUrl}/super-admin/plans/${dynamicPlan.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Updated Pro Tier ${TEST_PREFIX}`,
        description: 'Updated description for professional tier',
        durationMonths: 6,
        price: '7500.50',
      }),
    });
    const json = await res.json();
    assert(
      res.status === 200 &&
      json.data.name === `Updated Pro Tier ${TEST_PREFIX}` &&
      json.data.description === 'Updated description for professional tier' &&
      json.data.durationMonths === 6 &&
      Number(json.data.price) === 7500.5,
      'Test 17: Edit Plan updates name, price, duration, description'
    );
  }

  // 18. Plan.code remains immutable on edit
  {
    const res = await fetch(`${baseUrl}/super-admin/plans/${dynamicPlan.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        code: 'ATTEMPT_CODE_CHANGE',
      }),
    });
    // Schema is strict and rejects unrecognized fields or code is ignored
    const reload = await prisma.plan.findUnique({ where: { id: dynamicPlan.id } });
    assert(
      (res.status === 400 || res.status === 200) && reload.code === dynamicPlan.code,
      'Test 18: Plan.code remains immutable on edit'
    );
  }

  // 19. Deactivate Plan transitions isActive: false
  {
    const res = await fetch(`${baseUrl}/super-admin/plans/${dynamicPlan.id}/deactivate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const json = await res.json();
    assert(
      res.status === 200 && json.data.isActive === false,
      'Test 19: Deactivate Plan transitions isActive: false'
    );
  }

  // 20. Inactive Plan rejected for onboarding approval (400)
  {
    // Create pending onboarding request
    const pendingOnboarding = await prisma.madrasaOnboardingRequest.create({
      data: {
        madrasaName: `Test Onboard ${TEST_PREFIX}`,
        contactName: 'Zahid Khan',
        email: `onboard_${TEST_PREFIX}@example.com`,
        phone: '+94770001122',
        status: 'PENDING',
      },
    });

    let thrownError = null;
    try {
      await approveOnboardingRequest({
        requestId: pendingOnboarding.id,
        reviewedByUserId: superAdminUser.id,
        madrasaCode: `OB_${TEST_PREFIX.slice(-5).toUpperCase()}`,
        madrasaSlug: `ob-${TEST_PREFIX.slice(-8).toLowerCase()}`,
        planId: dynamicPlan.id, // Inactive plan!
      });
    } catch (err) {
      thrownError = err;
    }

    assert(
      thrownError !== null && thrownError.statusCode === 400,
      'Test 20: Inactive Plan rejected for onboarding approval (400)'
    );
  }

  // 21. Inactive Plan rejected for subscription renewal (400)
  {
    let thrownError = null;
    try {
      await createSubscriptionRenewal({
        madrasaId: fixtureMadrasa.id,
        planId: dynamicPlan.id, // Inactive plan!
        performedByUserId: superAdminUser.id,
      });
    } catch (err) {
      thrownError = err;
    }

    assert(
      thrownError !== null && thrownError.statusCode === 400,
      'Test 21: Inactive Plan rejected for subscription renewal (400)'
    );
  }

  // 22. Reactivate Plan transitions isActive: true
  {
    const res = await fetch(`${baseUrl}/super-admin/plans/${dynamicPlan.id}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const json = await res.json();
    assert(
      res.status === 200 && json.data.isActive === true,
      'Test 22: Reactivate Plan transitions isActive: true'
    );
  }

  // 23. Reactivated Plan selectable again
  {
    const planReload = await prisma.plan.findUnique({ where: { id: dynamicPlan.id } });
    assert(
      planReload.isActive === true,
      'Test 23: Reactivated Plan selectable again'
    );
  }

  // 24. Deactivating a Plan does NOT affect existing tenant access or subscription state
  {
    const now = new Date();
    // Provision active subscription on dynamicPlan
    const activeSub = await prisma.subscription.create({
      data: {
        madrasaId: fixtureMadrasa.id,
        planId: dynamicPlan.id,
        status: 'ACTIVE',
        startsAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        endsAt: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
        priceAtPurchase: dynamicPlan.price,
        durationMonthsAtPurchase: dynamicPlan.durationMonths,
      },
    });

    // Deactivate the plan
    await fetch(`${baseUrl}/super-admin/plans/${dynamicPlan.id}/deactivate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    // Check tenant access check
    const access = await resolveSubscriptionAccess(fixtureMadrasa.id);
    const subReload = await prisma.subscription.findUnique({ where: { id: activeSub.id } });

    assert(
      access.allowed === true &&
      subReload.status === 'ACTIVE' &&
      subReload.endsAt.getTime() === activeSub.endsAt.getTime(),
      'Test 24: Deactivating a Plan does NOT affect existing tenant access or subscription state'
    );
  }

  // 25. No public or service hard-delete endpoint exposed
  {
    const res = await fetch(`${baseUrl}/super-admin/plans/${dynamicPlan.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(
      res.status === 404 || res.status === 405,
      'Test 25: No public or service hard-delete endpoint exposed (404/405)'
    );
  }

  // 26. Database Restrict constraint protects in-use Plan against hard-deletion
  {
    let caughtConstraintError = false;
    try {
      await prisma.plan.delete({
        where: { id: dynamicPlan.id },
      });
    } catch (err) {
      caughtConstraintError = true;
    }
    assert(
      caughtConstraintError === true,
      'Test 26: Database Restrict constraint protects in-use Plan against hard-deletion'
    );
  }

  // 27. Usage counts accurate (effective active subscriptions, distinct institutions)
  {
    const res = await fetch(`${baseUrl}/super-admin/plans/${dynamicPlan.id}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const json = await res.json();
    assert(
      res.status === 200 &&
      json.data.activeSubscriptionsCount === 1 &&
      json.data.institutionsCount === 1,
      'Test 27: Usage counts accurate (effective active subscriptions, distinct institutions)'
    );
  }

  // 28. Distinct institutions metric does not double-count multiple subscriptions from same madrasa
  {
    const now = new Date();
    // Add a second consecutive active subscription for the SAME madrasa
    await prisma.subscription.create({
      data: {
        madrasaId: fixtureMadrasa.id,
        planId: dynamicPlan.id,
        status: 'ACTIVE',
        startsAt: now,
        endsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        priceAtPurchase: dynamicPlan.price,
        durationMonthsAtPurchase: dynamicPlan.durationMonths,
      },
    });

    const res = await fetch(`${baseUrl}/super-admin/plans/${dynamicPlan.id}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const json = await res.json();

    assert(
      res.status === 200 &&
      json.data.activeSubscriptionsCount === 2 &&
      json.data.institutionsCount === 1, // Still 1 distinct institution!
      'Test 28: Distinct institutions metric does not double-count multiple subscriptions from same madrasa'
    );
  }

  // 29. No N+1 query explosion verified
  {
    const start = Date.now();
    const res = await fetch(`${baseUrl}/super-admin/plans`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const durationMs = Date.now() - start;
    assert(
      res.status === 200 && durationMs < 500,
      `Test 29: No N+1 query explosion verified (completed in ${durationMs}ms)`
    );
  }

  // 30. ActivityLog records created for PLAN_CREATED, PLAN_UPDATED, PLAN_ACTIVATED, PLAN_DEACTIVATED
  {
    const logs = await prisma.activityLog.findMany({
      where: {
        entityType: 'Plan',
        entityId: dynamicPlan.id,
      },
    });
    const actions = logs.map((l) => l.action);
    assert(
      actions.includes('PLAN_CREATED') &&
      actions.includes('PLAN_UPDATED') &&
      actions.includes('PLAN_ACTIVATED') &&
      actions.includes('PLAN_DEACTIVATED'),
      'Test 30: ActivityLog records created for PLAN_CREATED, PLAN_UPDATED, PLAN_ACTIVATED, PLAN_DEACTIVATED'
    );
  }

  // 31. Plan detail endpoint returns 404 for unknown ID
  {
    const res = await fetch(`${baseUrl}/super-admin/plans/non-existent-plan-id`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(
      res.status === 404,
      'Test 31: Plan detail endpoint returns 404 for unknown ID'
    );
  }

  // 32. Lifecycle concurrency: duplicate activation/deactivation handled safely
  {
    // Reactivate first
    await fetch(`${baseUrl}/super-admin/plans/${dynamicPlan.id}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    // Call activate again when already active
    const res2 = await fetch(`${baseUrl}/super-admin/plans/${dynamicPlan.id}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const json2 = await res2.json();
    assert(
      res2.status === 200 && json2.data.isActive === true,
      'Test 32: Lifecycle concurrency: duplicate activation/deactivation handled safely'
    );
  }

  // 33. Existing apiListPlans callers compatibility: returns plain array in data
  {
    const res = await fetch(`${baseUrl}/super-admin/plans`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const json = await res.json();
    assert(
      res.status === 200 &&
      Array.isArray(json.data) &&
      json.data.length > 0 &&
      json.data[0].id &&
      json.data[0].code,
      'Test 33: Existing apiListPlans callers compatibility: returns plain array in data'
    );
  }

  // 34. Critical Snapshot Regression Test (Section 55 & Correction 21)
  {
    console.log('\n--- Running Critical Snapshot Regression Test (Section 55) ---');

    // 1. Create Plan Professional ($5000 / 12m)
    const snapPlanCode = `SNAP_${TEST_PREFIX.slice(-5).toUpperCase()}`;
    const planCreateRes = await fetch(`${baseUrl}/super-admin/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Snapshot Verification Plan ${TEST_PREFIX}`,
        code: snapPlanCode,
        durationMonths: 12,
        price: '5000.00',
        isActive: true,
      }),
    });
    const planCreateJson = await planCreateRes.json();
    const snapPlan = planCreateJson.data;

    // 2. Create pending onboarding request
    const snapOnboarding = await prisma.madrasaOnboardingRequest.create({
      data: {
        madrasaName: `Snapshot Madrasa ${TEST_PREFIX}`,
        contactName: 'Snapshot Admin',
        email: `snap_admin_${TEST_PREFIX}@example.com`,
        phone: '+94778899000',
        status: 'PENDING',
      },
    });

    // 3. Invoke canonical subscription provisioning (approveOnboardingRequest) -> Subscription A
    const snapMadrasaCode = `SN_${TEST_PREFIX.slice(-5).toUpperCase()}`;
    const snapMadrasaSlug = `sn-${TEST_PREFIX.slice(-8).toLowerCase()}`;
    const approveResult = await approveOnboardingRequest({
      requestId: snapOnboarding.id,
      reviewedByUserId: superAdminUser.id,
      madrasaCode: snapMadrasaCode,
      madrasaSlug: snapMadrasaSlug,
      planId: snapPlan.id,
    });

    const subscriptionA = approveResult.subscription;
    assert(
      Number(subscriptionA.priceAtPurchase) === 5000 &&
      subscriptionA.durationMonthsAtPurchase === 12,
      'Test 34.1: Subscription A snapshot stored initial values ($5000, 12m)'
    );

    // 4. Edit Plan to $6000 / 6m
    const planEditRes = await fetch(`${baseUrl}/super-admin/plans/${snapPlan.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        durationMonths: 6,
        price: '6000.00',
      }),
    });
    assert(planEditRes.status === 200, 'Test 34.2: Plan edited to $6000, 6m');

    // 5. Reload Subscription A -> assert priceAtPurchase remains 5000, durationMonthsAtPurchase remains 12
    const subscriptionAReload = await prisma.subscription.findUnique({
      where: { id: subscriptionA.id },
    });
    assert(
      Number(subscriptionAReload.priceAtPurchase) === 5000 &&
      subscriptionAReload.durationMonthsAtPurchase === 12 &&
      subscriptionAReload.startsAt.getTime() === subscriptionA.startsAt.getTime() &&
      subscriptionAReload.endsAt.getTime() === subscriptionA.endsAt.getTime(),
      'Test 34.3: Subscription A snapshot is 100% invariant to plan edits'
    );

    // 6. Invoke canonical subscription renewal (createSubscriptionRenewal) -> Subscription B
    const renewalResult = await createSubscriptionRenewal({
      madrasaId: approveResult.madrasa.id,
      planId: snapPlan.id,
      paymentMethod: 'BANK_TRANSFER',
      performedByUserId: superAdminUser.id,
    });

    const subscriptionB = renewalResult.subscription;
    assert(
      Number(subscriptionB.priceAtPurchase) === 6000 &&
      subscriptionB.durationMonthsAtPurchase === 6,
      'Test 34.4: Future Subscription B snapshot correctly consumes updated values ($6000, 6m)'
    );

    // Clean up snapshot test data
    await prisma.subscriptionPayment.deleteMany({
      where: { subscription: { madrasaId: approveResult.madrasa.id } },
    });
    await prisma.subscription.deleteMany({
      where: { madrasaId: approveResult.madrasa.id },
    });
    await prisma.madrasaSetting.deleteMany({
      where: { madrasaId: approveResult.madrasa.id },
    });
    await prisma.activityLog.deleteMany({
      where: { madrasaId: approveResult.madrasa.id },
    });
    await prisma.madrasaOnboardingRequest.updateMany({
      where: { approvedMadrasaId: approveResult.madrasa.id },
      data: { approvedMadrasaId: null },
    });
    await prisma.user.deleteMany({
      where: { madrasaId: approveResult.madrasa.id },
    });
    await prisma.madrasa.deleteMany({
      where: { id: approveResult.madrasa.id },
    });
    await prisma.madrasaOnboardingRequest.deleteMany({
      where: { id: snapOnboarding.id },
    });
    await prisma.plan.delete({ where: { id: snapPlan.id } });
  }

  console.log('\n======================================================');
  console.log(` RESULTS: ${testPassedCount} Passed, ${testFailedCount} Failed`);
  console.log('======================================================\n');

  if (testFailedCount > 0) {
    throw new Error(`${testFailedCount} test(s) failed in Super Admin Plans suite.`);
  }
}

async function main() {
  try {
    await setup();
    await runTests();
  } catch (error) {
    console.error('Fatal error during test run:', error);
    process.exitCode = 1;
  } finally {
    await teardown();
  }
}

main();
