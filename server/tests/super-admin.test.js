process.env.NODE_ENV = 'test';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword, comparePassword, validatePasswordStrength } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { enableTestMode } from '../src/services/email.service.js';
import app from '../src/app.js';

const TEST_PREFIX = 'sa_test_' + Date.now();

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

// Test fixtures
let superAdminUser = null;
let superAdminToken = '';

let madrasaAdminUser = null;
let madrasaAdminToken = '';
let testMadrasa = null;

let otherMadrasa = null;
let otherMadrasaAdmin = null;

let testPlan = null;
let testOnboardingRequestId = null;
let provisionedMadrasaId = null;
let provisionedAdminId = null;
let provisionedAdminTempPassword = '';

async function setup() {
  console.log('\n--- Setting up Phase 6 Super Admin Test Fixtures ---');
  enableTestMode(true);

  // Clean any leftover records from prior test runs
  await prisma.madrasaOnboardingRequest.deleteMany({
    where: {
      OR: [
        { email: { contains: 'sa_test_' } },
        { email: { contains: 'example.com' } },
      ],
    },
  });

  // 1. Create a Super Admin
  superAdminUser = await prisma.user.create({
    data: {
      name: 'Test Super Admin',
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

  // 2. Create an initial Madrasa and Madrasa Admin
  testMadrasa = await prisma.madrasa.create({
    data: {
      name: 'Existing Test Madrasa',
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}01`,
      slug: `${TEST_PREFIX}-m1`,
      email: `${TEST_PREFIX}_m1@example.com`,
      status: 'ACTIVE',
    },
  });

  madrasaAdminUser = await prisma.user.create({
    data: {
      name: 'Existing Madrasa Admin',
      email: `${TEST_PREFIX}_madmin@example.com`,
      passwordHash: await hashPassword('MAdminSecureP@ss123!'),
      role: 'MADRASA_ADMIN',
      madrasaId: testMadrasa.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  madrasaAdminToken = signAccessToken({
    userId: madrasaAdminUser.id,
    role: madrasaAdminUser.role,
    madrasaId: testMadrasa.id,
  });

  // 3. Create another Madrasa for cross-tenant target testing
  otherMadrasa = await prisma.madrasa.create({
    data: {
      name: 'Other Test Madrasa',
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}02`,
      slug: `${TEST_PREFIX}-m2`,
      email: `${TEST_PREFIX}_m2@example.com`,
      status: 'ACTIVE',
    },
  });

  otherMadrasaAdmin = await prisma.user.create({
    data: {
      name: 'Other Madrasa Admin',
      email: `${TEST_PREFIX}_otheradmin@example.com`,
      passwordHash: await hashPassword('OtherAdminSecureP@ss123!'),
      role: 'MADRASA_ADMIN',
      madrasaId: otherMadrasa.id,
      isActive: true,
      mustChangePassword: false,
    },
  });

  // 4. Create a Plan
  testPlan = await prisma.plan.create({
    data: {
      name: 'Phase 6 Test Plan',
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}_PLAN`,
      description: 'Test subscription plan for Phase 6',
      durationMonths: 12,
      price: 250.0,
      isActive: true,
    },
  });

  // 5. Start ephemeral test server
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
  console.log('\n--- Tearing Down Phase 6 Test Fixtures ---');

  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  try {
    // Find all madrasas created during this test
    const madrasas = await prisma.madrasa.findMany({
      where: {
        OR: [
          { slug: { contains: TEST_PREFIX } },
          { email: { contains: TEST_PREFIX } },
        ],
      },
      select: { id: true },
    });
    const allMadrasaIds = [...new Set([...madrasas.map((m) => m.id), testMadrasa?.id, otherMadrasa?.id, provisionedMadrasaId].filter(Boolean))];

    await prisma.activityLog.deleteMany({
      where: {
        OR: [
          { madrasaId: { in: allMadrasaIds } },
          { userId: { in: [superAdminUser?.id, madrasaAdminUser?.id, otherMadrasaAdmin?.id, provisionedAdminId].filter(Boolean) } },
        ],
      },
    });

    await prisma.subscriptionPayment.deleteMany({
      where: {
        OR: [
          { madrasaId: { in: allMadrasaIds } },
          { subscription: { madrasaId: { in: allMadrasaIds } } },
        ],
      },
    });

    await prisma.subscription.deleteMany({
      where: {
        OR: [
          { madrasaId: { in: allMadrasaIds } },
          { planId: testPlan?.id },
        ],
      },
    });

    await prisma.madrasaSetting.deleteMany({
      where: { madrasaId: { in: allMadrasaIds } },
    });

    // Delete users
    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: { in: [superAdminUser?.id, madrasaAdminUser?.id, otherMadrasaAdmin?.id, provisionedAdminId].filter(Boolean) } },
          { email: { contains: TEST_PREFIX } },
        ],
      },
    });

    // Delete onboarding requests
    await prisma.madrasaOnboardingRequest.deleteMany({
      where: {
        email: { contains: TEST_PREFIX },
      },
    });

    // Delete madrasas
    await prisma.madrasa.deleteMany({
      where: { id: { in: allMadrasaIds } },
    });

    // Delete plan
    if (testPlan) {
      await prisma.plan.deleteMany({ where: { id: testPlan.id } });
    }
  } catch (err) {
    console.error('Error during teardown:', err);
  }

  console.log('Teardown complete.');
}

async function runTests() {
  await setup();

  try {
    // ==========================================
    // 1. PUBLIC ONBOARDING TESTS
    // ==========================================
    console.log('\n[GROUP 1] Public Onboarding Application Validation');

    // 1.1 Honeypot submission: bot fills hidden `website` field -> 201 response but drops without DB insert
    const honeypotRes = await fetch(`${baseUrl}/api/onboarding/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        madrasaName: 'Bot Institution',
        contactName: 'Bot Person',
        email: `${TEST_PREFIX}_bot@example.com`,
        phone: '+94770000000',
        website: 'http://spam-link.com',
      }),
    });
    const honeypotJson = await honeypotRes.json();
    assert(honeypotRes.status === 201, 'Honeypot submission returns HTTP 201 silently');
    const botCheck = await prisma.madrasaOnboardingRequest.findFirst({
      where: { email: `${TEST_PREFIX}_bot@example.com` },
    });
    assert(botCheck === null, 'Honeypot submission was dropped and did NOT create database record');

    // 1.2 Rejection of untrusted / malicious administrative fields
    const maliciousRes = await fetch(`${baseUrl}/api/onboarding/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        madrasaName: 'Hacker Madrasa',
        contactName: 'Evil Admin',
        email: `${TEST_PREFIX}_hacker@example.com`,
        phone: '+94771111111',
        role: 'SUPER_ADMIN', // injected
        status: 'APPROVED', // injected
        madrasaId: testMadrasa.id, // injected
      }),
    });
    assert(maliciousRes.status === 400, 'Rejects public payload containing injected role, status, or madrasaId (Zod strict)');

    // 1.3 Valid public onboarding application
    const validOnboardingRes = await fetch(`${baseUrl}/api/onboarding/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        madrasaName: 'Darul Uloom Al-Hikmah',
        contactName: 'Moulana Zahid',
        email: `${TEST_PREFIX}_applicant@example.com`,
        phone: `+9477${TEST_PREFIX.slice(-7)}`,
        whatsappNumber: `+9477${TEST_PREFIX.slice(-7)}`,
        district: 'Kandy',
        address: '123 Hill Street, Kandy',
        expectedStudentCount: 150,
        message: 'Looking forward to using MadrasaNexa.',
      }),
    });
    const validOnboardingJson = await validOnboardingRes.json();
    assert(validOnboardingRes.status === 201, 'Valid onboarding application returns HTTP 201 Created');
    assert(validOnboardingJson.data?.id, 'Returns newly created onboarding request ID');
    testOnboardingRequestId = validOnboardingJson.data?.id;

    const dbRequest = await prisma.madrasaOnboardingRequest.findUnique({
      where: { id: testOnboardingRequestId },
    });
    assert(dbRequest?.status === 'PENDING', 'Database record created with status PENDING');
    assert(dbRequest?.expectedStudentCount === 150, 'Student count recorded properly');

    // 1.4 Duplicate submission check
    const dupRes = await fetch(`${baseUrl}/api/onboarding/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        madrasaName: 'Darul Uloom Second Attempt',
        contactName: 'Moulana Zahid',
        email: `${TEST_PREFIX}_applicant@example.com`,
        phone: `+9477${TEST_PREFIX.slice(-7)}`,
      }),
    });
    assert(dupRes.status === 409, 'Duplicate pending application with same email/phone returns HTTP 409 Conflict');

    // ==========================================
    // 2. SUPER ADMIN AUTHORIZATION PROTECTION
    // ==========================================
    console.log('\n[GROUP 2] Super Admin Endpoint Role Protection');

    // 2.1 Anonymous access to /api/super-admin/dashboard
    const anonRes = await fetch(`${baseUrl}/api/super-admin/dashboard`);
    assert(anonRes.status === 401, 'Anonymous request to /api/super-admin/dashboard returns 401 Unauthorized');

    // 2.2 Madrasa Admin access to /api/super-admin/dashboard
    const madminRes = await fetch(`${baseUrl}/api/super-admin/dashboard`, {
      headers: { Authorization: `Bearer ${madrasaAdminToken}` },
    });
    assert(madminRes.status === 403, 'Madrasa Admin request to /api/super-admin/dashboard returns 403 Forbidden');

    // 2.3 Super Admin access permitted
    const sadminRes = await fetch(`${baseUrl}/api/super-admin/dashboard`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const sadminJson = await sadminRes.json();
    assert(sadminRes.status === 200, 'Super Admin request to /api/super-admin/dashboard returns 200 OK');
    assert(sadminJson.data?.counts?.totalMadrasas >= 2, 'Dashboard counts total madrasas');
    assert(sadminJson.data?.counts?.pendingOnboardings >= 1, 'Dashboard counts pending onboardings');

    // ==========================================
    // 3. ONBOARDING REVIEW, REJECTION & APPROVAL
    // ==========================================
    console.log('\n[GROUP 3] Onboarding Request Review & Approval Workflow');

    // 3.1 List onboarding requests
    const listReqRes = await fetch(`${baseUrl}/api/super-admin/onboarding?status=PENDING`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const listReqJson = await listReqRes.json();
    assert(listReqRes.status === 200, 'Super Admin can list onboarding requests');
    assert(listReqJson.data?.requests?.some((r) => r.id === testOnboardingRequestId), 'List contains our pending request');

    // 3.2 Get request details
    const getReqRes = await fetch(`${baseUrl}/api/super-admin/onboarding/${testOnboardingRequestId}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(getReqRes.status === 200, 'Super Admin can fetch single onboarding request by ID');

    // 3.3 Create a second request to test rejection
    const rejectTargetRes = await fetch(`${baseUrl}/api/onboarding/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        madrasaName: 'Reject Target Madrasa',
        contactName: 'Reject Person',
        email: `${TEST_PREFIX}_reject@example.com`,
        phone: `+9478${TEST_PREFIX.slice(-7)}`,
      }),
    });
    const rejectTargetJson = await rejectTargetRes.json();
    const rejectTargetId = rejectTargetJson.data.id;

    // Reject it
    const rejectActionRes = await fetch(`${baseUrl}/api/super-admin/onboarding/${rejectTargetId}/reject`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rejectionReason: 'Incomplete institutional registration documentation provided.',
      }),
    });
    assert(rejectActionRes.status === 200, 'Super Admin can reject onboarding request');
    const rejectedDb = await prisma.madrasaOnboardingRequest.findUnique({ where: { id: rejectTargetId } });
    assert(rejectedDb?.status === 'REJECTED', 'Onboarding request status transitioned to REJECTED');
    assert(rejectedDb?.rejectionReason?.includes('Incomplete'), 'Rejection reason saved in database');
    assert(rejectedDb?.reviewedAt !== null, 'reviewedAt timestamp recorded');
    assert(rejectedDb?.reviewedByUserId === superAdminUser.id, 'reviewedByUserId matches Super Admin');

    // 3.4 Approve the primary onboarding request
    const approveActionRes = await fetch(`${baseUrl}/api/super-admin/onboarding/${testOnboardingRequestId}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        madrasaCode: `${TEST_PREFIX.slice(-6).toUpperCase()}99`,
        madrasaSlug: `${TEST_PREFIX.replace(/_/g, '-')}-hikmah`,
        planId: testPlan.id,
        adminName: 'Moulana Zahid Provisioned',
        adminEmail: `${TEST_PREFIX}_zahid@example.com`,
        paymentMethod: 'BANK_TRANSFER',
        paymentReference: 'TXN-BANK-001',
        paymentNotes: 'Initial onboarding bank transfer verified',
        recordInitialPayment: true,
      }),
    });
    const approveActionJson = await approveActionRes.json();
    assert(approveActionRes.status === 200, 'Approve onboarding request returns 200 OK');
    assert(approveActionJson.data?.madrasa?.id, 'Returns provisioned Madrasa ID');
    assert(approveActionJson.data?.adminUser?.temporaryPassword, 'Returns one-time temporary password in response');
    assert(approveActionJson.data?.adminUser?.mustChangePassword === true, 'Admin user mustChangePassword is true');

    provisionedMadrasaId = approveActionJson.data?.madrasa?.id;
    provisionedAdminId = approveActionJson.data?.adminUser?.id;
    provisionedAdminTempPassword = approveActionJson.data?.adminUser?.temporaryPassword;

    // Verify atomic claim prevents double-approval (concurrency test)
    const secondApproveRes = await fetch(`${baseUrl}/api/super-admin/onboarding/${testOnboardingRequestId}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        madrasaCode: 'DUP001',
        madrasaSlug: 'dup-slug',
        planId: testPlan.id,
      }),
    });
    if (secondApproveRes.status !== 409) {
      console.error('Second approve unexpected status:', secondApproveRes.status, await secondApproveRes.text());
    }
    assert(secondApproveRes.status === 409, 'Attempting to approve an already approved request returns 409 Conflict (concurrency protection)');

    // Verify DB state of provisioned entities
    const provMadrasa = await prisma.madrasa.findUnique({ where: { id: provisionedMadrasaId } });
    assert(provMadrasa?.status === 'ACTIVE', 'Provisioned Madrasa is ACTIVE');

    const provSub = await prisma.subscription.findFirst({ where: { madrasaId: provisionedMadrasaId } });
    assert(provSub?.status === 'ACTIVE', 'Initial subscription created with status ACTIVE');
    assert(Number(provSub?.priceAtPurchase) === 250.0, 'Initial subscription price matches Plan');
    assert(provSub?.durationMonthsAtPurchase === 12, 'Initial subscription duration matches Plan');

    const provPayment = await prisma.subscriptionPayment.findFirst({ where: { subscriptionId: provSub?.id } });
    assert(provPayment !== null, 'Initial payment recorded because recordInitialPayment was true');
    assert(Number(provPayment?.amount) === 250.0, 'Payment amount matches Plan price');

    const provUser = await prisma.user.findUnique({ where: { id: provisionedAdminId } });
    assert(provUser?.role === 'MADRASA_ADMIN', 'Provisioned user role is MADRASA_ADMIN');
    assert(provUser?.madrasaId === provisionedMadrasaId, 'Provisioned user assigned to new Madrasa workspace');
    assert(provUser?.mustChangePassword === true, 'Provisioned user mustChangePassword set to true');

    // Verify password hash: matches temporary password and uses bcrypt cost 12
    const isTempPassValid = await comparePassword(provisionedAdminTempPassword, provUser.passwordHash);
    assert(isTempPassValid === true, 'Password hash matches generated temporary password');
    assert(provUser.passwordHash.startsWith('$2a$12$') || provUser.passwordHash.startsWith('$2b$12$'), 'Password hash uses centralized cost factor 12');

    // ==========================================
    // 4. MANDATORY PASSWORD CHANGE ENFORCEMENT
    // ==========================================
    console.log('\n[GROUP 4] Mandatory Password Change Security');

    // Log in with temporary credentials
    const provLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${TEST_PREFIX}_zahid@example.com`,
        password: provisionedAdminTempPassword,
      }),
    });
    const provLoginJson = await provLoginRes.json();
    assert(provLoginRes.status === 200, 'Provisioned admin can log in with temporary password');
    assert(provLoginJson.data?.user?.mustChangePassword === true, 'Login response flags mustChangePassword: true');
    const provToken = provLoginJson.data?.accessToken;

    // 4.1 Attempting to access protected tenant routes before changing password -> blocked!
    const blockedTenantRes = await fetch(`${baseUrl}/api/subscriptions/me`, {
      headers: { Authorization: `Bearer ${provToken}` },
    });
    assert(blockedTenantRes.status === 403, 'Tenant workspace access blocked with 403 when mustChangePassword is true');
    const blockedJson = await blockedTenantRes.json();
    assert(blockedJson.code === 'MUST_CHANGE_PASSWORD', 'Blocked response includes code MUST_CHANGE_PASSWORD');

    // 4.2 Changing password with wrong current password -> rejected
    const wrongCurrentRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'WrongPassword123!',
        newPassword: 'BrandNewSecureP@ssword123!',
      }),
    });
    assert(wrongCurrentRes.status === 400, 'Password change rejected when current password does not match');

    // 4.3 Changing password with weak new password (< 10 chars) -> rejected
    const weakPassRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: provisionedAdminTempPassword,
        newPassword: 'short',
      }),
    });
    assert(weakPassRes.status === 400, 'Password change rejected when new password < 10 characters');

    // 4.4 Changing password to the same password -> rejected
    const samePassRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: provisionedAdminTempPassword,
        newPassword: provisionedAdminTempPassword,
      }),
    });
    assert(samePassRes.status === 400, 'Password change rejected when new password equals current password');

    // 4.5 Valid password change
    const validChangeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: provisionedAdminTempPassword,
        newPassword: 'MyPermanentStrongP@ss2026!',
      }),
    });
    assert(validChangeRes.status === 200, 'Valid password change returns 200 OK');

    // Verify DB updated
    const updatedProvUser = await prisma.user.findUnique({ where: { id: provisionedAdminId } });
    assert(updatedProvUser?.mustChangePassword === false, 'mustChangePassword updated to false in database');
    const newPassMatch = await comparePassword('MyPermanentStrongP@ss2026!', updatedProvUser.passwordHash);
    assert(newPassMatch === true, 'New password hashed and verified');
    assert(updatedProvUser.passwordHash.startsWith('$2a$12$') || updatedProvUser.passwordHash.startsWith('$2b$12$'), 'New password hashed with bcrypt cost 12');

    // Re-authenticate using the new password to obtain a fresh JWT with updated tokenVersion
    const reLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${TEST_PREFIX}_zahid@example.com`,
        password: 'MyPermanentStrongP@ss2026!',
      }),
    });
    const reLoginJson = await reLoginRes.json();
    assert(reLoginRes.status === 200, 'Re-login with new password succeeds');
    const freshProvToken = reLoginJson.data?.accessToken;

    // 4.6 Verify GET /api/auth/me returns updated mustChangePassword: false
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${freshProvToken}` },
    });
    const meJson = await meRes.json();
    assert(meJson.data?.user?.mustChangePassword === false, 'GET /api/auth/me returns mustChangePassword: false');

    // 4.7 Tenant workspace access now succeeds!
    const unblockedTenantRes = await fetch(`${baseUrl}/api/subscriptions/me`, {
      headers: { Authorization: `Bearer ${freshProvToken}` },
    });
    assert(unblockedTenantRes.status === 200, 'Tenant workspace access now permitted after password change');

    // ==========================================
    // 5. SUPER ADMIN MADRASA LIFECYCLE
    // ==========================================
    console.log('\n[GROUP 5] Madrasa Lifecycle & Zero Deletion Guarantee');

    // 5.1 Update Madrasa profile
    const updateMadrasaRes = await fetch(`${baseUrl}/api/super-admin/madrasas/${testMadrasa.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Updated Test Madrasa Name',
        phone: '+94773334455',
        address: '456 New Campus Way',
      }),
    });
    assert(updateMadrasaRes.status === 200, 'Super Admin updates Madrasa details');

    // 5.2 Suspend Madrasa
    const suspendRes = await fetch(`${baseUrl}/api/super-admin/madrasas/${testMadrasa.id}/suspend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(suspendRes.status === 200, 'Super Admin suspends Madrasa workspace');
    const suspendedDb = await prisma.madrasa.findUnique({ where: { id: testMadrasa.id } });
    assert(suspendedDb?.status === 'SUSPENDED', 'Madrasa status is SUSPENDED');

    // Verify Madrasa Admin cannot log in when madrasa is suspended
    const madminBlockedLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${TEST_PREFIX}_madmin@example.com`,
        password: 'MAdminSecureP@ss123!',
      }),
    });
    assert(madminBlockedLogin.status === 403, 'Madrasa Admin login blocked when Madrasa is SUSPENDED');

    // 5.3 Archive Madrasa (timestamp consistency & zero deletion)
    const archiveRes = await fetch(`${baseUrl}/api/super-admin/madrasas/${testMadrasa.id}/archive`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(archiveRes.status === 200, 'Super Admin archives Madrasa workspace');
    const archivedDb = await prisma.madrasa.findUnique({ where: { id: testMadrasa.id } });
    assert(archivedDb?.status === 'ARCHIVED', 'Madrasa status is ARCHIVED');
    assert(archivedDb?.archivedAt !== null, 'archivedAt timestamp recorded upon archiving');

    // 5.4 Reactivate Madrasa (timestamp cleared)
    const reactivateRes = await fetch(`${baseUrl}/api/super-admin/madrasas/${testMadrasa.id}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(reactivateRes.status === 200, 'Super Admin reactivates Madrasa workspace');
    const reactivatedDb = await prisma.madrasa.findUnique({ where: { id: testMadrasa.id } });
    assert(reactivatedDb?.status === 'ACTIVE', 'Madrasa status is ACTIVE again');
    assert(reactivatedDb?.archivedAt === null, 'archivedAt timestamp cleared upon reactivation');

    // ==========================================
    // 6. MADRASA ADMIN MANAGEMENT & IDOR TARGET SAFETY
    // ==========================================
    console.log('\n[GROUP 6] Madrasa Admin Operations & Tenant-Target Security');

    // 6.1 Super Admin resets Madrasa Admin password
    const adminResetRes = await fetch(
      `${baseUrl}/api/super-admin/madrasas/${testMadrasa.id}/admins/${madrasaAdminUser.id}/reset-password`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );
    const adminResetJson = await adminResetRes.json();
    assert(adminResetRes.status === 200, 'Super Admin resets Madrasa Admin password');
    assert(adminResetJson.data?.temporaryPassword, 'Returns generated temporary password');

    const resetDbUser = await prisma.user.findUnique({ where: { id: madrasaAdminUser.id } });
    assert(resetDbUser?.mustChangePassword === true, 'Admin user mustChangePassword set to true');

    // 6.2 Target safety: attempting to reset admin using wrong madrasaId in route -> rejected
    const mismatchedTargetRes = await fetch(
      `${baseUrl}/api/super-admin/madrasas/${otherMadrasa.id}/admins/${madrasaAdminUser.id}/reset-password`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );
    assert(mismatchedTargetRes.status === 404, 'Mismatched madrasaId / adminUserId route target returns 404 Not Found');

    // 6.3 Toggle admin active / inactive
    const toggleDeactiveRes = await fetch(
      `${baseUrl}/api/super-admin/madrasas/${testMadrasa.id}/admins/${madrasaAdminUser.id}/toggle-active`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: false }),
      }
    );
    assert(toggleDeactiveRes.status === 200, 'Super Admin deactivates admin user');
    const deactivatedDbUser = await prisma.user.findUnique({ where: { id: madrasaAdminUser.id } });
    assert(deactivatedDbUser?.isActive === false, 'Admin isActive is false in database');

    // ==========================================
    // 7. PLAN MANAGEMENT (CRUD)
    // ==========================================
    console.log('\n[GROUP 7] Subscription Plan Management');

    // 7.1 Create plan
    const createPlanRes = await fetch(`${baseUrl}/api/super-admin/plans`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Quarterly Pro Plan',
        code: `${TEST_PREFIX.slice(-6).toUpperCase()}_QPRO`,
        description: '3 months full platform access',
        durationMonths: 3,
        price: 75.5,
        isActive: true,
      }),
    });
    const createPlanJson = await createPlanRes.json();
    assert(createPlanRes.status === 201, 'Super Admin creates new plan');
    const createdPlanId = createPlanJson.data?.id;

    // 7.2 Update plan
    const updatePlanRes = await fetch(`${baseUrl}/api/super-admin/plans/${createdPlanId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Quarterly Pro Updated',
        price: 79.99,
      }),
    });
    assert(updatePlanRes.status === 200, 'Super Admin updates plan details');

    // 7.3 Deactivate & Activate Plan
    const deactPlanRes = await fetch(`${baseUrl}/api/super-admin/plans/${createdPlanId}/deactivate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(deactPlanRes.status === 200, 'Super Admin deactivates plan');

    const actPlanRes = await fetch(`${baseUrl}/api/super-admin/plans/${createdPlanId}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(actPlanRes.status === 200, 'Super Admin activates plan');

    // Clean up created test plan
    await prisma.plan.delete({ where: { id: createdPlanId } });

    // ==========================================
    // 8. SUBSCRIPTION RENEWAL & HISTORY
    // ==========================================
    console.log('\n[GROUP 8] Subscription History & Renewal Integration');

    // 8.1 View Madrasa subscription history
    const subHistoryRes = await fetch(`${baseUrl}/api/super-admin/madrasas/${provisionedMadrasaId}/subscriptions`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const subHistoryJson = await subHistoryRes.json();
    assert(subHistoryRes.status === 200, 'Super Admin fetches Madrasa subscription history');
    assert(subHistoryJson.data?.subscriptions?.length >= 1, 'History includes initial subscription term');

    // 8.2 Renew subscription for Madrasa
    const renewSubRes = await fetch(`${baseUrl}/api/super-admin/madrasas/${provisionedMadrasaId}/subscriptions/renew`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: testPlan.id,
        paymentMethod: 'CASH',
        reference: 'CASH-REC-001',
        notes: 'Cash payment collected at HQ',
      }),
    });
    const renewSubJson = await renewSubRes.json();
    assert(renewSubRes.status === 200, 'Super Admin successfully renews subscription term for Madrasa');
    assert(renewSubJson.data?.subscription?.id, 'Renewal returns new subscription term');

    // 8.3 Suspend and Cancel subscription
    const renewalTermId = renewSubJson.data?.subscription?.id;
    const suspendTermRes = await fetch(`${baseUrl}/api/super-admin/subscriptions/${renewalTermId}/suspend`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(suspendTermRes.status === 200, 'Super Admin suspends subscription term');

    const cancelTermRes = await fetch(`${baseUrl}/api/super-admin/subscriptions/${renewalTermId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(cancelTermRes.status === 200, 'Super Admin cancels subscription term');

    // ==========================================
    // 9. PLATFORM ACTIVITY LOGS
    // ==========================================
    console.log('\n[GROUP 9] Platform Activity Audit Trail');

    const logsRes = await fetch(`${baseUrl}/api/super-admin/activity-logs`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const logsJson = await logsRes.json();
    assert(logsRes.status === 200, 'Super Admin fetches platform activity logs');
    const actions = logsJson.data?.logs?.map((l) => l.action);
    assert(actions.includes('ONBOARDING_REQUEST_APPROVED'), 'Log contains ONBOARDING_REQUEST_APPROVED');
    assert(actions.includes('MADRASA_SUSPENDED') || actions.includes('MADRASA_ACTIVATED'), 'Log contains Madrasa lifecycle status change');
    assert(actions.includes('PASSWORD_CHANGED'), 'Log contains PASSWORD_CHANGED');
  } catch (err) {
    console.error('Fatal test error:', err);
    testFailedCount++;
  } finally {
    await teardown();
  }

  console.log('\n=============================================');
  console.log(`Phase 6 Test Results: ${testPassedCount} Passed, ${testFailedCount} Failed`);
  console.log('=============================================\n');

  if (testFailedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
