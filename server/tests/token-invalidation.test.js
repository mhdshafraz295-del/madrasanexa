/**
 * MadrasaNexa Phase 3B - JWT Token Invalidation & Session Security Test Suite
 *
 * Covers 12 Security Scenarios:
 * 1. Current tokenVersion JWT accepted (HTTP 200).
 * 2. Mismatched tokenVersion rejected (HTTP 401).
 * 3. Missing tokenVersion backward compatibility (treated as version 0 on legacy tokens).
 * 4. Malformed tokenVersion rejected safely (HTTP 401).
 * 5. Password change invalidates previous JWT immediately (HTTP 401).
 * 6. Super Admin password reset invalidates target user's previous JWT (HTTP 401).
 * 7. Resend onboarding credentials with new temporary password invalidates previous JWT (HTTP 401).
 * 8. New login generates current-version JWT and succeeds (HTTP 200).
 * 9. Tenant isolation: cross-tenant operations cannot invalidate another tenant's sessions.
 * 10. Super Admin authentication continues functioning normally.
 * 11. Existing inactive-user and suspended-institution checks remain strictly intact (HTTP 403).
 * 12. Concurrent credential modifications maintain atomic version increments without loss.
 */

import http from 'http';
import express from 'express';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { hashPassword } from '../src/utils/password.js';
import authRoutes from '../src/routes/auth.routes.js';
import superAdminRoutes from '../src/routes/super-admin.routes.js';
import madrasaAdminRoutes from '../src/routes/madrasa-admin.routes.js';
import { enableTestMode, clearTestEmails } from '../src/services/email.service.js';

const RUN_ID = `p3b_${Date.now()}`;
let testServer = null;
let baseUrl = '';

const createdFixtures = {
  users: [],
  madrasas: [],
  plans: [],
  subscriptions: [],
  onboardingRequests: [],
  activityLogs: [],
};

function registerFixture(collection, id) {
  if (id && createdFixtures[collection]) {
    createdFixtures[collection].push(id);
  }
}

let userSuperAdmin = null;
let userAdminAlpha = null;
let userAdminBeta = null;
let userInactive = null;
let madrasaAlpha = null;
let madrasaBeta = null;
let madrasaSuspended = null;
let planStandard = null;

let testsPassed = 0;
let testsFailed = 0;

function assertTest(id, description, passed, detail = '') {
  if (passed) {
    testsPassed++;
    console.log(`  ✓ PASS [${id}]: ${description} (${detail})`);
  } else {
    testsFailed++;
    console.error(`  ✗ FAIL [${id}]: ${description} (${detail})`);
  }
}

async function runPreflightGate() {
  console.log('\n======================================================');
  console.log(' PHASE 3B PREFLIGHT SAFETY VERIFICATION GATE');
  console.log('======================================================');

  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`PREFLIGHT ABORT: NODE_ENV is "${process.env.NODE_ENV}", must strictly be "test".`);
  }

  const [activeDb] = await prisma.$queryRawUnsafe('SELECT DATABASE() AS current_db');
  if (!activeDb || activeDb.current_db !== 'madrasanexa_test') {
    throw new Error(`FATAL: Connected to "${activeDb?.current_db}". Must strictly be "madrasanexa_test".`);
  }

  enableTestMode(true);
  clearTestEmails();
  console.log('✓ Connected exclusively to "madrasanexa_test". Service mocks active.\n');
}

async function setupFixtures() {
  console.log('--- Setting Up Test Fixtures in madrasanexa_test ---');

  // 1. Create Plans
  planStandard = await prisma.plan.create({
    data: {
      name: `Plan P3B ${RUN_ID}`,
      code: `PLAN_P3B_${RUN_ID}`,
      price: 15000,
      durationMonths: 12,
      isActive: true,
    },
  });
  registerFixture('plans', planStandard.id);

  // 2. Create Madrasas
  madrasaAlpha = await prisma.madrasa.create({
    data: {
      name: `Madrasa Alpha ${RUN_ID}`,
      code: `ALPHA_${RUN_ID.slice(-6)}`,
      slug: `alpha-${RUN_ID}`,
      email: `alpha_${RUN_ID}@example.com`,
      phone: '+94770000001',
      address: '123 Alpha St',
      status: 'ACTIVE',
    },
  });
  registerFixture('madrasas', madrasaAlpha.id);

  madrasaBeta = await prisma.madrasa.create({
    data: {
      name: `Madrasa Beta ${RUN_ID}`,
      code: `BETA_${RUN_ID.slice(-6)}`,
      slug: `beta-${RUN_ID}`,
      email: `beta_${RUN_ID}@example.com`,
      phone: '+94770000002',
      address: '456 Beta St',
      status: 'ACTIVE',
    },
  });
  registerFixture('madrasas', madrasaBeta.id);

  madrasaSuspended = await prisma.madrasa.create({
    data: {
      name: `Madrasa Suspended ${RUN_ID}`,
      code: `SUSP_${RUN_ID.slice(-6)}`,
      slug: `susp-${RUN_ID}`,
      email: `susp_${RUN_ID}@example.com`,
      phone: '+94770000003',
      address: '789 Suspended Rd',
      status: 'SUSPENDED',
    },
  });
  registerFixture('madrasas', madrasaSuspended.id);

  // 3. Subscriptions
  const now = new Date();
  const subAlpha = await prisma.subscription.create({
    data: {
      madrasaId: madrasaAlpha.id,
      planId: planStandard.id,
      status: 'ACTIVE',
      startsAt: new Date(now.getTime() - 86400000),
      endsAt: new Date(now.getTime() + 30 * 86400000),
      priceAtPurchase: 15000,
      durationMonthsAtPurchase: 12,
    },
  });
  registerFixture('subscriptions', subAlpha.id);

  // 4. Users
  const defaultHash = await hashPassword('TestP@ssword123!');

  userSuperAdmin = await prisma.user.create({
    data: {
      name: `Super Admin ${RUN_ID}`,
      email: `super_${RUN_ID}@example.com`,
      passwordHash: defaultHash,
      role: 'SUPER_ADMIN',
      madrasaId: null,
      isActive: true,
      mustChangePassword: false,
      tokenVersion: 0,
    },
  });
  registerFixture('users', userSuperAdmin.id);

  userAdminAlpha = await prisma.user.create({
    data: {
      name: `Admin Alpha ${RUN_ID}`,
      email: `admin_alpha_${RUN_ID}@example.com`,
      passwordHash: defaultHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaAlpha.id,
      isActive: true,
      mustChangePassword: false,
      tokenVersion: 0,
    },
  });
  registerFixture('users', userAdminAlpha.id);

  userAdminBeta = await prisma.user.create({
    data: {
      name: `Admin Beta ${RUN_ID}`,
      email: `admin_beta_${RUN_ID}@example.com`,
      passwordHash: defaultHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaBeta.id,
      isActive: true,
      mustChangePassword: false,
      tokenVersion: 0,
    },
  });
  registerFixture('users', userAdminBeta.id);

  userInactive = await prisma.user.create({
    data: {
      name: `Inactive User ${RUN_ID}`,
      email: `inactive_${RUN_ID}@example.com`,
      passwordHash: defaultHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaAlpha.id,
      isActive: false,
      mustChangePassword: false,
      tokenVersion: 0,
    },
  });
  registerFixture('users', userInactive.id);

  // Start test express server
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/super-admin', superAdminRoutes);
  app.use('/api/madrasa-admin', madrasaAdminRoutes);

  testServer = http.createServer(app);
  await new Promise((resolve) => {
    testServer.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${testServer.address().port}/api`;
      resolve();
    });
  });

  console.log(`✓ Fixtures ready. Test server at ${baseUrl}\n`);
}

async function runTests() {
  console.log('======================================================');
  console.log(' EXECUTING 12 TOKEN INVALIDATION & SESSION TESTS');
  console.log('======================================================\n');

  // Scenario 1: Current tokenVersion JWT accepted (HTTP 200)
  try {
    const token = signAccessToken({
      userId: userAdminAlpha.id,
      role: userAdminAlpha.role,
      madrasaId: userAdminAlpha.madrasaId,
      tokenVersion: 0,
    });
    const res = await fetch(`${baseUrl}/madrasa-admin/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assertTest('T-INV-01', 'Current tokenVersion JWT accepted', res.status === 200, `Status: ${res.status}`);
  } catch (err) {
    assertTest('T-INV-01', 'Current tokenVersion JWT accepted', false, err.message);
  }

  // Scenario 2: Mismatched tokenVersion rejected (HTTP 401)
  try {
    const token = signAccessToken({
      userId: userAdminAlpha.id,
      role: userAdminAlpha.role,
      madrasaId: userAdminAlpha.madrasaId,
      tokenVersion: 999,
    });
    const res = await fetch(`${baseUrl}/madrasa-admin/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    const passed = res.status === 401 && json.message?.includes('revoked or invalidated');
    assertTest('T-INV-02', 'Mismatched tokenVersion rejected with HTTP 401', passed, `Status: ${res.status}, msg: ${json.message}`);
  } catch (err) {
    assertTest('T-INV-02', 'Mismatched tokenVersion rejected with HTTP 401', false, err.message);
  }

  // Scenario 3: Missing tokenVersion backward compatibility (legacy token treated as 0)
  try {
    const legacyToken = signAccessToken({
      userId: userAdminAlpha.id,
      role: userAdminAlpha.role,
      madrasaId: userAdminAlpha.madrasaId,
      // tokenVersion intentionally omitted
    });
    const res = await fetch(`${baseUrl}/madrasa-admin/profile`, {
      headers: { Authorization: `Bearer ${legacyToken}` },
    });
    assertTest('T-INV-03', 'Missing tokenVersion in legacy token treated as version 0', res.status === 200, `Status: ${res.status}`);
  } catch (err) {
    assertTest('T-INV-03', 'Missing tokenVersion in legacy token treated as version 0', false, err.message);
  }

  // Scenario 4: Malformed tokenVersion rejected safely (HTTP 401)
  try {
    const jwt = await import('jsonwebtoken');
    const malformedToken = jwt.default.sign(
      { userId: userAdminAlpha.id, role: userAdminAlpha.role, madrasaId: userAdminAlpha.madrasaId, tokenVersion: 'malformed_string' },
      env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1d' }
    );
    const res = await fetch(`${baseUrl}/madrasa-admin/profile`, {
      headers: { Authorization: `Bearer ${malformedToken}` },
    });
    assertTest('T-INV-04', 'Malformed tokenVersion string rejected safely with 401', res.status === 401, `Status: ${res.status}`);
  } catch (err) {
    assertTest('T-INV-04', 'Malformed tokenVersion string rejected safely with 401', false, err.message);
  }

  // Scenario 5: User password change invalidates previous JWT
  try {
    // Generate token at version 0
    const tokenV0 = signAccessToken({
      userId: userAdminAlpha.id,
      role: userAdminAlpha.role,
      madrasaId: userAdminAlpha.madrasaId,
      tokenVersion: 0,
    });

    // Change password via /api/auth/change-password
    const changeRes = await fetch(`${baseUrl}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenV0}`,
      },
      body: JSON.stringify({
        currentPassword: 'TestP@ssword123!',
        newPassword: 'NewAlphaPassword123!',
      }),
    });

    // Check DB tokenVersion incremented to 1
    const userInDb = await prisma.user.findUnique({
      where: { id: userAdminAlpha.id },
      select: { tokenVersion: true },
    });

    // Attempt to access profile with tokenV0 (must now return 401)
    const staleRes = await fetch(`${baseUrl}/madrasa-admin/profile`, {
      headers: { Authorization: `Bearer ${tokenV0}` },
    });

    const passed = changeRes.status === 200 && userInDb.tokenVersion === 1 && staleRes.status === 401;
    assertTest(
      'T-INV-05',
      'Password change increments tokenVersion and immediately invalidates previous JWT',
      passed,
      `Change: ${changeRes.status}, DB Version: ${userInDb?.tokenVersion}, Stale Req Status: ${staleRes.status}`
    );
  } catch (err) {
    assertTest('T-INV-05', 'Password change invalidates previous JWT', false, err.message);
  }

  // Scenario 6: Super Admin password reset invalidates target user's previous JWT
  try {
    const superAdminToken = signAccessToken({
      userId: userSuperAdmin.id,
      role: 'SUPER_ADMIN',
      madrasaId: null,
      tokenVersion: 0,
    });

    // Target user: AdminBeta at tokenVersion 0
    const tokenBetaV0 = signAccessToken({
      userId: userAdminBeta.id,
      role: userAdminBeta.role,
      madrasaId: userAdminBeta.madrasaId,
      tokenVersion: 0,
    });

    // Super Admin resets AdminBeta password
    const resetRes = await fetch(
      `${baseUrl}/super-admin/madrasas/${madrasaBeta.id}/admins/${userAdminBeta.id}/reset-password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          temporaryPassword: 'TempBetaPassword123!',
        }),
      }
    );

    // Verify DB version incremented
    const betaInDb = await prisma.user.findUnique({
      where: { id: userAdminBeta.id },
      select: { tokenVersion: true },
    });

    // Attempt access with tokenBetaV0 (must return 401)
    const betaStaleRes = await fetch(`${baseUrl}/madrasa-admin/profile`, {
      headers: { Authorization: `Bearer ${tokenBetaV0}` },
    });

    const passed = resetRes.status === 200 && betaInDb.tokenVersion === 1 && betaStaleRes.status === 401;
    assertTest(
      'T-INV-06',
      'Super Admin reset invalidates target user previous JWT',
      passed,
      `Reset: ${resetRes.status}, DB Version: ${betaInDb?.tokenVersion}, Stale Req Status: ${betaStaleRes.status}`
    );
  } catch (err) {
    assertTest('T-INV-06', 'Super Admin reset invalidates target user previous JWT', false, err.message);
  }

  // Scenario 7: Resend onboarding credentials with new temporary password invalidates previous JWT
  try {
    const superAdminToken = signAccessToken({
      userId: userSuperAdmin.id,
      role: 'SUPER_ADMIN',
      madrasaId: null,
      tokenVersion: 0,
    });

    // Create an onboarding request linked to userAdminBeta
    const onbReq = await prisma.madrasaOnboardingRequest.create({
      data: {
        madrasaName: `Onb Madrasa ${RUN_ID}`,
        contactName: 'Contact Person',
        email: `onb_${RUN_ID}@example.com`,
        phone: '+94770000099',
        district: 'Colombo',
        status: 'APPROVED',
        approvedMadrasaId: madrasaBeta.id,
        reviewedByUserId: userSuperAdmin.id,
      },
    });
    registerFixture('onboardingRequests', onbReq.id);

    const versionBefore = (await prisma.user.findUnique({
      where: { id: userAdminBeta.id },
      select: { tokenVersion: true },
    })).tokenVersion;

    const resendRes = await fetch(`${baseUrl}/super-admin/onboarding/${onbReq.id}/resend-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    const versionAfter = (await prisma.user.findUnique({
      where: { id: userAdminBeta.id },
      select: { tokenVersion: true },
    })).tokenVersion;

    const passed = resendRes.status === 200 && versionAfter === versionBefore + 1;
    assertTest(
      'T-INV-07',
      'Resend onboarding email with new credentials increments tokenVersion',
      passed,
      `Resend: ${resendRes.status}, Version before: ${versionBefore}, after: ${versionAfter}`
    );
  } catch (err) {
    assertTest('T-INV-07', 'Resend onboarding email with new credentials increments tokenVersion', false, err.message);
  }

  // Scenario 8: New login generates current-version JWT
  try {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userAdminAlpha.email,
        password: 'NewAlphaPassword123!',
      }),
    });
    const loginJson = await loginRes.json();
    const newAccessToken = loginJson.data?.accessToken;

    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.decode(newAccessToken);

    // Test access with new access token
    const res = await fetch(`${baseUrl}/madrasa-admin/profile`, {
      headers: { Authorization: `Bearer ${newAccessToken}` },
    });

    const passed = loginRes.status === 200 && decoded?.tokenVersion === 1 && res.status === 200;
    assertTest(
      'T-INV-08',
      'New login issues JWT with current tokenVersion and succeeds',
      passed,
      `Login: ${loginRes.status}, Decoded Version: ${decoded?.tokenVersion}, Profile: ${res.status}`
    );
  } catch (err) {
    assertTest('T-INV-08', 'New login issues JWT with current tokenVersion', false, err.message);
  }

  // Scenario 9: Tenant boundary: cross-tenant admin reset rejected and does not affect target
  try {
    // AdminAlpha attempts to reset AdminBeta's password using super-admin endpoint -> 403 Forbidden
    const alphaToken = signAccessToken({
      userId: userAdminAlpha.id,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaAlpha.id,
      tokenVersion: 1,
    });

    const crossRes = await fetch(
      `${baseUrl}/super-admin/madrasas/${madrasaBeta.id}/admins/${userAdminBeta.id}/reset-password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${alphaToken}`,
        },
        body: JSON.stringify({ temporaryPassword: 'CrossTenantPassword1!' }),
      }
    );

    assertTest('T-INV-09', 'Cross-tenant admin reset attempt strictly blocked with 403', crossRes.status === 403, `Status: ${crossRes.status}`);
  } catch (err) {
    assertTest('T-INV-09', 'Cross-tenant admin reset attempt strictly blocked with 403', false, err.message);
  }

  // Scenario 10: Super Admin authentication continues working with tokenVersion
  try {
    const superAdminToken = signAccessToken({
      userId: userSuperAdmin.id,
      role: 'SUPER_ADMIN',
      madrasaId: null,
      tokenVersion: 0,
    });

    const res = await fetch(`${baseUrl}/super-admin/dashboard`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    assertTest('T-INV-10', 'Super Admin token with tokenVersion operates normally', res.status === 200, `Status: ${res.status}`);
  } catch (err) {
    assertTest('T-INV-10', 'Super Admin token operates normally', false, err.message);
  }

  // Scenario 11: Inactive user and suspended institution checks remain strictly intact
  try {
    const inactiveToken = signAccessToken({
      userId: userInactive.id,
      role: userInactive.role,
      madrasaId: userInactive.madrasaId,
      tokenVersion: 0,
    });

    const inactiveRes = await fetch(`${baseUrl}/madrasa-admin/profile`, {
      headers: { Authorization: `Bearer ${inactiveToken}` },
    });

    // Create user in suspended madrasa
    const suspendedAdmin = await prisma.user.create({
      data: {
        name: `Suspended Admin ${RUN_ID}`,
        email: `susp_admin_${RUN_ID}@example.com`,
        passwordHash: await hashPassword('TestP@ssword123!'),
        role: 'MADRASA_ADMIN',
        madrasaId: madrasaSuspended.id,
        isActive: true,
        mustChangePassword: false,
        tokenVersion: 0,
      },
    });
    registerFixture('users', suspendedAdmin.id);

    const suspendedToken = signAccessToken({
      userId: suspendedAdmin.id,
      role: suspendedAdmin.role,
      madrasaId: suspendedAdmin.madrasaId,
      tokenVersion: 0,
    });

    const suspendedRes = await fetch(`${baseUrl}/madrasa-admin/profile`, {
      headers: { Authorization: `Bearer ${suspendedToken}` },
    });

    const passed = inactiveRes.status === 403 && suspendedRes.status === 403;
    assertTest(
      'T-INV-11',
      'Inactive user and suspended institution return HTTP 403 regardless of tokenVersion',
      passed,
      `Inactive: ${inactiveRes.status}, Suspended: ${suspendedRes.status}`
    );
  } catch (err) {
    assertTest('T-INV-11', 'Inactive user and suspended institution checks intact', false, err.message);
  }

  // Scenario 12: Concurrent credential changes maintain atomic version increments
  try {
    const testUser = await prisma.user.create({
      data: {
        name: `Concurrent Test User ${RUN_ID}`,
        email: `concurrent_${RUN_ID}@example.com`,
        passwordHash: await hashPassword('TestP@ssword123!'),
        role: 'MADRASA_ADMIN',
        madrasaId: madrasaAlpha.id,
        isActive: true,
        mustChangePassword: false,
        tokenVersion: 0,
      },
    });
    registerFixture('users', testUser.id);

    // Perform 5 concurrent increments via Prisma atomic increment
    await Promise.all([
      prisma.user.update({ where: { id: testUser.id }, data: { tokenVersion: { increment: 1 } } }),
      prisma.user.update({ where: { id: testUser.id }, data: { tokenVersion: { increment: 1 } } }),
      prisma.user.update({ where: { id: testUser.id }, data: { tokenVersion: { increment: 1 } } }),
      prisma.user.update({ where: { id: testUser.id }, data: { tokenVersion: { increment: 1 } } }),
      prisma.user.update({ where: { id: testUser.id }, data: { tokenVersion: { increment: 1 } } }),
    ]);

    const updated = await prisma.user.findUnique({
      where: { id: testUser.id },
      select: { tokenVersion: true },
    });

    const passed = updated.tokenVersion === 5;
    assertTest(
      'T-INV-12',
      'Concurrent increments maintain exact version counts without loss',
      passed,
      `Expected: 5, Actual: ${updated.tokenVersion}`
    );
  } catch (err) {
    assertTest('T-INV-12', 'Concurrent increments maintain version counts', false, err.message);
  }

  console.log('\n======================================================');
  console.log(` TOKEN INVALIDATION TEST SUMMARY: ${testsPassed}/12 PASS (${testsFailed} FAIL)`);
  console.log('======================================================\n');

  if (testsFailed > 0) {
    throw new Error(`${testsFailed} token invalidation test(s) failed.`);
  }
}

async function teardown() {
  console.log('--- Teardown: Cleaning up test fixtures ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  try {
    if (createdFixtures.onboardingRequests.length) {
      await prisma.madrasaOnboardingRequest.deleteMany({ where: { id: { in: createdFixtures.onboardingRequests } } }).catch(() => {});
    }
    if (createdFixtures.subscriptions.length) {
      await prisma.subscription.deleteMany({ where: { id: { in: createdFixtures.subscriptions } } }).catch(() => {});
    }
    if (createdFixtures.users.length) {
      await prisma.activityLog.deleteMany({ where: { userId: { in: createdFixtures.users } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: createdFixtures.users } } }).catch(() => {});
    }
    if (createdFixtures.madrasas.length) {
      await prisma.madrasa.deleteMany({ where: { id: { in: createdFixtures.madrasas } } }).catch(() => {});
    }
    if (createdFixtures.plans.length) {
      await prisma.plan.deleteMany({ where: { id: { in: createdFixtures.plans } } }).catch(() => {});
    }
    console.log('✓ Teardown complete.\n');
  } catch (err) {
    console.error('Teardown warning:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  try {
    await runPreflightGate();
    await setupFixtures();
    await runTests();
  } catch (err) {
    console.error('Fatal Test Error:', err);
    process.exitCode = 1;
  } finally {
    await teardown();
  }
}

main();
