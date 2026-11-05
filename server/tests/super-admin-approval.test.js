import './setup-test-env.js';
import { prisma, getPrismaDatasourceUrl } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import {
  sendApprovalEmail,
  getTestEmails,
  clearTestEmails,
  setTestEmailAdapter,
  setProviderTransport,
  enableTestMode,
  escapeHtml,
  getLoginUrl,
  isTestRecipient,
} from '../src/services/email.service.js';
import { envSchema } from '../src/config/env.js';
import app from '../src/app.js';

const TEST_PREFIX = 'sa_appr_' + Date.now();
const SLUG_BASE = 'appr' + Date.now().toString().slice(-8);

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

let activePlan = null;
let inactivePlan = null;

let pendingRequest1 = null;
let pendingRequest2 = null;

async function setup() {
  console.log('\n--- Setting up Super Admin Approval & Email Test Fixtures ---');
  enableTestMode(true);

  // 1. Create Super Admin
  superAdminUser = await prisma.user.create({
    data: {
      name: 'Approval Test Super Admin',
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

  // 2. Create Madrasa Admin
  testMadrasa = await prisma.madrasa.create({
    data: {
      name: 'Existing Approval Madrasa',
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}01`,
      slug: `${SLUG_BASE}-m1`,
      email: `${TEST_PREFIX}_m1@example.com`,
      status: 'ACTIVE',
    },
  });

  madrasaAdminUser = await prisma.user.create({
    data: {
      name: 'Regular Madrasa Admin',
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

  // 3. Create Plans
  activePlan = await prisma.plan.create({
    data: {
      name: 'Dynamic Gold Tier',
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}_GOLD`,
      description: 'Gold subscription plan for testing',
      durationMonths: 6,
      price: 15000,
      isActive: true,
    },
  });

  inactivePlan = await prisma.plan.create({
    data: {
      name: 'Discontinued Plan',
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}_INACTIVE`,
      description: 'Inactive plan',
      durationMonths: 12,
      price: 25000,
      isActive: false,
    },
  });

  // 4. Create Pending Onboarding Requests
  pendingRequest1 = await prisma.madrasaOnboardingRequest.create({
    data: {
      madrasaName: 'Al-Huda International Academy',
      contactName: 'Sheikh Zaid',
      email: `${TEST_PREFIX}_zaid@example.com`,
      phone: '+94 77 111 2222',
      district: 'Kandy',
      address: 'No. 45, Mosque Road, Kandy',
      expectedStudentCount: 150,
      message: 'Looking forward to automating our fee operations.',
      status: 'PENDING',
    },
  });

  pendingRequest2 = await prisma.madrasaOnboardingRequest.create({
    data: {
      madrasaName: 'Darul Iman Quran Institute',
      contactName: 'Moulavi Bilal',
      email: `${TEST_PREFIX}_bilal@example.com`,
      phone: '+94 77 333 4444',
      district: 'Colombo',
      address: 'No. 12, Galle Road, Colombo',
      expectedStudentCount: 80,
      status: 'PENDING',
    },
  });

  // 5. Start HTTP server
  await new Promise((resolve) => {
    testServer = app.listen(0, () => {
      const port = testServer.address().port;
      baseUrl = `http://localhost:${port}/api`;
      console.log(`Test server running at ${baseUrl}`);
      resolve();
    });
  });
}

async function teardown() {
  console.log('\n--- Tearing Down Super Admin Approval Test Fixtures ---');

  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  clearTestEmails();

  try {
    await prisma.activityLog.deleteMany({
      where: {
        OR: [
          ...(superAdminUser?.id ? [{ userId: superAdminUser.id }] : []),
          { madrasa: { slug: { contains: SLUG_BASE } } },
          { madrasa: { slug: { contains: TEST_PREFIX } } },
          { madrasa: { code: { startsWith: TEST_PREFIX.slice(-6).toUpperCase() } } },
        ],
      },
    });

    await prisma.subscriptionPayment.deleteMany({
      where: {
        subscription: {
          planId: { in: [activePlan?.id, inactivePlan?.id].filter(Boolean) },
        },
      },
    });

    await prisma.subscription.deleteMany({
      where: {
        planId: { in: [activePlan?.id, inactivePlan?.id].filter(Boolean) },
      },
    });

    await prisma.madrasaSetting.deleteMany({
      where: {
        madrasa: {
          OR: [
            { slug: { contains: SLUG_BASE } },
            { slug: { contains: TEST_PREFIX } },
            { code: { contains: TEST_PREFIX.slice(-5).toUpperCase() } },
            { code: { contains: TEST_PREFIX.slice(-6).toUpperCase() } },
          ],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: { contains: TEST_PREFIX },
      },
    });

    await prisma.madrasaOnboardingRequest.deleteMany({
      where: {
        email: { contains: TEST_PREFIX },
      },
    });

    await prisma.madrasa.deleteMany({
      where: {
        OR: [
          { slug: { contains: SLUG_BASE } },
          { slug: { contains: TEST_PREFIX } },
          { code: { contains: TEST_PREFIX.slice(-5).toUpperCase() } },
          { code: { contains: TEST_PREFIX.slice(-6).toUpperCase() } },
        ],
      },
    });

    await prisma.plan.deleteMany({
      where: {
        id: { in: [activePlan?.id, inactivePlan?.id].filter(Boolean) },
      },
    });
  } catch (err) {
    console.warn('Teardown cleanup notice:', err.message);
  }

  console.log('Teardown complete.');
}

async function runTests() {
  console.log('\n=============================================');
  console.log('Running Super Admin Approval & Email Tests');
  console.log('=============================================');

  // -------------------------------------------------------------
  // Test 1: HTML Escaping & Normalized Login URL
  // -------------------------------------------------------------
  console.log('\n[GROUP 1] Security Utilities (HTML Sanitization & URL Normalization)');
  const escaped = escapeHtml('<script>alert("XSS & Injection")</script>');
  assert(
    !escaped.includes('<') && !escaped.includes('>') && escaped.includes('&lt;script&gt;'),
    'escapeHtml sanitizes script tags and HTML injection'
  );

  const loginUrl = getLoginUrl();
  assert(
    loginUrl.endsWith('/login') && !loginUrl.includes('//login'),
    'getLoginUrl normalizes trailing slash correctly'
  );

  // -------------------------------------------------------------
  // Test 2: Role Security
  // -------------------------------------------------------------
  console.log('\n[GROUP 2] Role Security Protection');
  const unauthRes = await fetch(`${baseUrl}/super-admin/onboarding`);
  assert(unauthRes.status === 401, 'Unauthenticated request rejected with 401');

  const madrasaAdminRes = await fetch(`${baseUrl}/super-admin/onboarding`, {
    headers: { Authorization: `Bearer ${madrasaAdminToken}` },
  });
  assert(madrasaAdminRes.status === 403, 'MADRASA_ADMIN access forbidden with 403');

  const superAdminRes = await fetch(`${baseUrl}/super-admin/onboarding`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert(superAdminRes.status === 200, 'SUPER_ADMIN access permitted with 200');

  // -------------------------------------------------------------
  // Test 3: List & Status Contract (NOT_SENT before approval)
  // -------------------------------------------------------------
  console.log('\n[GROUP 3] Onboarding List & Canonical NOT_SENT Status');
  const listData = await superAdminRes.json();
  assert(Array.isArray(listData.data.requests), 'listOnboardings returns requests array');
  assert(listData.data.kpi && typeof listData.data.kpi.pending === 'number', 'listOnboardings returns dynamic KPI counts');

  const foundPending = listData.data.requests.find((r) => r.id === pendingRequest1.id);
  assert(foundPending !== undefined, 'Found created pending request in list');
  assert(foundPending.emailStatus === 'NOT_SENT', 'Pending request has emailStatus = NOT_SENT');

  // -------------------------------------------------------------
  // Test 4: Inactive Plan Rejection
  // -------------------------------------------------------------
  console.log('\n[GROUP 4] Dynamic Plan Validation');
  const inactivePlanApproveRes = await fetch(`${baseUrl}/super-admin/onboarding/${pendingRequest1.id}/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${superAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      madrasaCode: `${TEST_PREFIX.slice(-5).toUpperCase()}A1`,
      madrasaSlug: `${SLUG_BASE}-inactive`,
      planId: inactivePlan.id,
    }),
  });
  assert(inactivePlanApproveRes.status === 400, 'Inactive plan rejected with 400 Bad Request');

  // -------------------------------------------------------------
  // Test 5: Successful Atomic Approval + Automatic Email Dispatch
  // -------------------------------------------------------------
  console.log('\n[GROUP 5] Atomic Approval & Post-Commit Email Dispatch');
  clearTestEmails();

  const code1 = `${TEST_PREFIX.slice(-5).toUpperCase()}A1`;
  const slug1 = `${SLUG_BASE}-alhuda`;

  const approveRes = await fetch(`${baseUrl}/super-admin/onboarding/${pendingRequest1.id}/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${superAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      madrasaCode: code1,
      madrasaSlug: slug1,
      planId: activePlan.id,
      adminName: 'Sheikh Zaid Approvee',
      adminEmail: `${TEST_PREFIX}_zaid_approved@example.com`,
      paymentMethod: 'BANK_TRANSFER',
      recordInitialPayment: false,
    }),
  });

  assert(approveRes.status === 200, 'Approval request succeeds with 200');
  const approveJson = await approveRes.json();
  const provisioned = approveJson.data;

  // Verify provisioning outputs
  assert(provisioned.madrasa?.code === code1, 'Madrasa created with correct code');
  assert(provisioned.adminUser?.mustChangePassword === true, 'Admin User provisioned with mustChangePassword = true');
  assert(Boolean(provisioned.adminUser?.temporaryPassword), 'Temporary password returned once in response');
  assert(provisioned.subscription?.planId === activePlan.id, 'Subscription created linked to selected Plan');
  assert(provisioned.subscription?.durationMonthsAtPurchase === 6, 'Subscription duration derived from Plan durationMonths');
  assert(provisioned.emailDelivery?.status === 'SENT', 'emailDelivery.status is SENT');

  // Verify email dispatch in test mailbox
  const emails = getTestEmails();
  assert(emails.length === 1, 'Exactly one approval email dispatched');
  const email = emails[0];
  assert(email.to === `${TEST_PREFIX}_zaid_approved@example.com`, 'Email sent to authoritative provisioned admin email');
  assert(email.subject.includes('Al-Huda International Academy'), 'Email subject contains dynamic Madrasa Name');
  assert(email.html.includes('Dynamic Gold Tier'), 'Email HTML contains dynamic Plan Name');
  assert(email.html.includes(loginUrl), 'Email HTML contains normalized login URL');
  assert(!email.html.includes(provisioned.adminUser.temporaryPassword), 'Temporary password NOT leaked in email HTML');
  assert(!email.text.includes(provisioned.adminUser.temporaryPassword), 'Temporary password NOT leaked in plain text');

  // Verify DB state
  const updatedReq1 = await prisma.madrasaOnboardingRequest.findUnique({
    where: { id: pendingRequest1.id },
  });
  assert(updatedReq1.status === 'APPROVED', 'Request status updated to APPROVED in DB');
  assert(updatedReq1.approvedMadrasaId === provisioned.madrasa.id, 'Request linked to provisioned Madrasa ID');

  // Verify ActivityLog
  const emailSentLog = await prisma.activityLog.findFirst({
    where: {
      entityType: 'MadrasaOnboardingRequest',
      entityId: pendingRequest1.id,
      action: 'APPROVAL_EMAIL_SENT',
    },
  });
  assert(emailSentLog !== null, 'APPROVAL_EMAIL_SENT logged in ActivityLog');
  assert(!JSON.stringify(emailSentLog.metadata).includes(provisioned.adminUser.temporaryPassword), 'ActivityLog metadata has zero plaintext passwords');

  // -------------------------------------------------------------
  // Test 6: Concurrent / Duplicate Approval Blocked (409 Conflict)
  // -------------------------------------------------------------
  console.log('\n[GROUP 6] Concurrency & Idempotency Protection');
  const secondApproveRes = await fetch(`${baseUrl}/super-admin/onboarding/${pendingRequest1.id}/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${superAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      madrasaCode: `${TEST_PREFIX.slice(-5).toUpperCase()}A2`,
      madrasaSlug: `${SLUG_BASE}-alhuda-dup`,
      planId: activePlan.id,
    }),
  });
  assert(secondApproveRes.status === 409, 'Concurrent / second approval attempt safely rejected with 409 Conflict');

  // -------------------------------------------------------------
  // Test 7: Partial Success (Email Failure Does NOT Rollback Approval)
  // -------------------------------------------------------------
  console.log('\n[GROUP 7] Partial Success: Email Failure Never Rollbacks DB Approval');
  // Inject simulated email provider failure
  setTestEmailAdapter(async () => {
    throw new Error('Simulated SMTP connection timeout or DNS error');
  });

  const code2 = `${TEST_PREFIX.slice(-5).toUpperCase()}B2`;
  const slug2 = `${SLUG_BASE}-daruliman`;

  const failEmailApproveRes = await fetch(`${baseUrl}/super-admin/onboarding/${pendingRequest2.id}/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${superAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      madrasaCode: code2,
      madrasaSlug: slug2,
      planId: activePlan.id,
      adminName: 'Moulavi Bilal Approvee',
      adminEmail: `${TEST_PREFIX}_bilal_approved@example.com`,
    }),
  });

  assert(failEmailApproveRes.status === 200, 'Approval request returns 200 even when email delivery fails');
  const failEmailJson = await failEmailApproveRes.json();

  // Verify provisioning still succeeded
  assert(failEmailJson.data.madrasa?.code === code2, 'Madrasa provisioned successfully despite email failure');
  assert(Boolean(failEmailJson.data.adminUser?.temporaryPassword), 'Temporary password still delivered to Super Admin');
  assert(failEmailJson.data.emailDelivery?.status === 'FAILED', 'emailDelivery.status reports FAILED');
  assert(failEmailJson.data.emailDelivery?.error.includes('Simulated SMTP'), 'Sanitized error message returned');

  // Verify DB state is APPROVED
  const dbReq2 = await prisma.madrasaOnboardingRequest.findUnique({
    where: { id: pendingRequest2.id },
  });
  assert(dbReq2.status === 'APPROVED', 'DB request remains APPROVED despite email failure');

  // Verify ActivityLog recorded failure
  const failLog = await prisma.activityLog.findFirst({
    where: {
      entityType: 'MadrasaOnboardingRequest',
      entityId: pendingRequest2.id,
      action: 'APPROVAL_EMAIL_FAILED',
    },
  });
  assert(failLog !== null, 'APPROVAL_EMAIL_FAILED recorded in ActivityLog');
  assert(failLog.metadata?.errorMessage.includes('Simulated SMTP'), 'ActivityLog contains sanitized error');

  // -------------------------------------------------------------
  // Test 8: Resend Approval Email
  // -------------------------------------------------------------
  console.log('\n[GROUP 8] Resend Approval Email');
  // Reset test adapter to succeed
  clearTestEmails();

  // Backdate the previous activity log by 35s to satisfy cooldown for Test 8
  await prisma.activityLog.updateMany({
    where: {
      entityType: 'MadrasaOnboardingRequest',
      entityId: pendingRequest2.id,
    },
    data: {
      createdAt: new Date(Date.now() - 35000),
    },
  });

  const resendRes = await fetch(`${baseUrl}/super-admin/onboarding/${pendingRequest2.id}/resend-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${superAdminToken}`,
    },
  });

  assert(resendRes.status === 200, 'Resend approval email returns 200');
  const resendJson = await resendRes.json();
  assert(resendJson.data?.emailDelivery?.status === 'SENT', 'Resend reports emailDelivery.status = SENT');

  const resendEmails = getTestEmails();
  assert(resendEmails.length === 1, 'Resend email delivered to test store');
  assert(resendEmails[0].to === `${TEST_PREFIX}_bilal_approved@example.com`, 'Resend delivered to authoritative admin email');

  // Verify NO duplicate resources were created
  const madrasaCount = await prisma.madrasa.count({
    where: { code: code2 },
  });
  assert(madrasaCount === 1, 'Resend did NOT duplicate Madrasa record');

  const adminCount = await prisma.user.count({
    where: { email: `${TEST_PREFIX}_bilal_approved@example.com` },
  });
  assert(adminCount === 1, 'Resend did NOT duplicate Admin user record');

  // -------------------------------------------------------------
  // Test 9: Resend Rate Safety Cooldown (HTTP 429)
  // -------------------------------------------------------------
  console.log('\n[GROUP 9] Resend Rate Limiting (30s Cooldown)');
  const rapidResendRes = await fetch(`${baseUrl}/super-admin/onboarding/${pendingRequest2.id}/resend-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${superAdminToken}`,
    },
  });
  assert(rapidResendRes.status === 429, 'Rapid repeated resend blocked with HTTP 429');
  const rapidResendJson = await rapidResendRes.json();
  assert(rapidResendJson.message.includes('wait'), 'Cooldown error message returned');

  // -------------------------------------------------------------
  // Test 10: Request Detail & Timeline Verification
  // -------------------------------------------------------------
  console.log('\n[GROUP 10] Dynamic Request Detail & Audit Timeline');
  const detailRes = await fetch(`${baseUrl}/super-admin/onboarding/${pendingRequest2.id}`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert(detailRes.status === 200, 'getOnboardingById returns 200');
  const detailJson = await detailRes.json();
  const detailData = detailJson.data;

  assert(detailData.emailStatus === 'SENT', 'Detail emailStatus reflects latest successful resend = SENT');
  assert(Array.isArray(detailData.timeline), 'Detail contains timeline array');
  const timelineActions = detailData.timeline.map((t) => t.action);
  assert(timelineActions.includes('SUBMITTED'), 'Timeline includes SUBMITTED event');
  assert(timelineActions.includes('APPROVED'), 'Timeline includes APPROVED event');
  assert(timelineActions.includes('EMAIL_FAILED'), 'Timeline includes original EMAIL_FAILED attempt');
  assert(timelineActions.includes('EMAIL_RESENT'), 'Timeline includes EMAIL_RESENT event');

  // -------------------------------------------------------------
  // Test 11: Rejection Flow
  // -------------------------------------------------------------
  console.log('\n[GROUP 11] Rejection Flow');
  const rejectPending = await prisma.madrasaOnboardingRequest.create({
    data: {
      madrasaName: 'Invalid Application Madrasa',
      contactName: 'Fake Contact',
      email: `${TEST_PREFIX}_fake@example.com`,
      phone: '+94 77 999 0000',
      status: 'PENDING',
    },
  });

  const rejectRes = await fetch(`${baseUrl}/super-admin/onboarding/${rejectPending.id}/reject`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${superAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rejectionReason: 'Incomplete administrative documentation and contact number unverified.',
    }),
  });
  assert(rejectRes.status === 200, 'Reject request returns 200');

  const rejectedInDb = await prisma.madrasaOnboardingRequest.findUnique({
    where: { id: rejectPending.id },
  });
  assert(rejectedInDb.status === 'REJECTED', 'Status in DB is REJECTED');
  assert(rejectedInDb.rejectionReason.includes('Incomplete administrative documentation'), 'Rejection reason persisted');

  // Verify cannot approve a rejected request
  const approveRejectedRes = await fetch(`${baseUrl}/super-admin/onboarding/${rejectPending.id}/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${superAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      madrasaCode: `${TEST_PREFIX.slice(-5).toUpperCase()}REJ`,
      madrasaSlug: `${SLUG_BASE}-rej`,
      planId: activePlan.id,
    }),
  });
  assert(approveRejectedRes.status === 409, 'Rejected request cannot be approved (409 Conflict)');

  // -------------------------------------------------------------
  // Test 12: Canonical NOT_CONFIGURED to SENT Refresh Lifecycle
  // -------------------------------------------------------------
  console.log('\n[GROUP 12] NOT_CONFIGURED to SENT Page Refresh & Resend Lifecycle');
  const unconfiguredPending = await prisma.madrasaOnboardingRequest.create({
    data: {
      madrasaName: 'Unconfigured Email Madrasa',
      contactName: 'Usthad Umar',
      email: `${TEST_PREFIX}_umar@example.com`,
      phone: '+94 77 888 1111',
      status: 'PENDING',
    },
  });

  // 1. Simulate unconfigured SMTP provider
  setTestEmailAdapter(async () => {
    return {
      success: false,
      status: 'NOT_CONFIGURED',
      error: 'Email provider not configured (missing SMTP_HOST in environment).',
    };
  });

  const unconfigCode = `${TEST_PREFIX.slice(-5).toUpperCase()}U1`;
  const unconfigSlug = `${SLUG_BASE}-unconfig`;

  const unconfigApproveRes = await fetch(`${baseUrl}/super-admin/onboarding/${unconfiguredPending.id}/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${superAdminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      madrasaCode: unconfigCode,
      madrasaSlug: unconfigSlug,
      planId: activePlan.id,
      adminName: 'Usthad Umar Approvee',
      adminEmail: `${TEST_PREFIX}_umar_approved@example.com`,
    }),
  });

  assert(unconfigApproveRes.status === 200, 'Approve succeeds while SMTP unconfigured');
  const unconfigApproveJson = await unconfigApproveRes.json();
  assert(unconfigApproveJson.data?.emailDelivery?.status === 'NOT_CONFIGURED', 'Immediate response status is NOT_CONFIGURED');

  // 2. Page refresh 1 (simulate fresh list & detail fetch from DB)
  const listRefresh1 = await fetch(`${baseUrl}/super-admin/onboarding?search=${TEST_PREFIX}_umar`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const listRefresh1Json = await listRefresh1.json();
  const matchedReq1 = listRefresh1Json.data.requests.find((r) => r.id === unconfiguredPending.id);
  assert(matchedReq1?.emailStatus === 'NOT_CONFIGURED', 'List query after refresh preserves emailStatus = NOT_CONFIGURED');

  const detailRefresh1 = await fetch(`${baseUrl}/super-admin/onboarding/${unconfiguredPending.id}`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const detailRefresh1Json = await detailRefresh1.json();
  assert(detailRefresh1Json.data?.emailStatus === 'NOT_CONFIGURED', 'Detail query after refresh preserves emailStatus = NOT_CONFIGURED');
  const hasNotConfigTimeline = detailRefresh1Json.data?.timeline?.some((t) => t.title.includes('Not Configured'));
  assert(hasNotConfigTimeline === true, 'Detail timeline contains "Email Not Configured" entry');

  // 3. Configure SMTP (restore working provider) and trigger Resend Approval Email
  clearTestEmails(); // Resets custom test adapter to normal test mode

  // Backdate previous log by 35s to satisfy rate limiting cooldown
  await prisma.activityLog.updateMany({
    where: {
      entityType: 'MadrasaOnboardingRequest',
      entityId: unconfiguredPending.id,
    },
    data: {
      createdAt: new Date(Date.now() - 35000),
    },
  });

  const resendAfterConfigRes = await fetch(`${baseUrl}/super-admin/onboarding/${unconfiguredPending.id}/resend-email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert(resendAfterConfigRes.status === 200, 'Resend succeeds after SMTP is configured');
  const resendAfterConfigJson = await resendAfterConfigRes.json();
  assert(resendAfterConfigJson.data?.emailDelivery?.status === 'SENT', 'Resend response reports emailDelivery.status = SENT');

  // 4. Page refresh 2 (simulate fresh list & detail fetch from DB after resend)
  const listRefresh2 = await fetch(`${baseUrl}/super-admin/onboarding?search=${TEST_PREFIX}_umar`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const listRefresh2Json = await listRefresh2.json();
  const matchedReq2 = listRefresh2Json.data.requests.find((r) => r.id === unconfiguredPending.id);
  assert(matchedReq2?.emailStatus === 'SENT', 'List query after second refresh preserves emailStatus = SENT');

  const detailRefresh2 = await fetch(`${baseUrl}/super-admin/onboarding/${unconfiguredPending.id}`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const detailRefresh2Json = await detailRefresh2.json();
  assert(detailRefresh2Json.data?.emailStatus === 'SENT', 'Detail query after second refresh preserves emailStatus = SENT');
  const hasResentTimeline = detailRefresh2Json.data?.timeline?.some((t) => t.action === 'EMAIL_RESENT');
  assert(hasResentTimeline === true, 'Detail timeline contains EMAIL_RESENT entry');

  // -------------------------------------------------------------
  // Test 13: SMTP TLS/SSL Configuration & Boolean Parsing Safety
  // -------------------------------------------------------------
  console.log('\n[GROUP 13] SMTP TLS/SSL Configuration & Boolean Parsing Safety');

  // Case 1: "false" -> false
  const falseParse = envSchema.shape.SMTP_SECURE.parse('false');
  assert(falseParse === false, '"false" string strictly parses to boolean false');

  // Case 2: "true" -> true
  const trueParse = envSchema.shape.SMTP_SECURE.parse('true');
  assert(trueParse === true, '"true" string strictly parses to boolean true');

  // Case 3: 587 + false -> valid
  const valid587 = envSchema.safeParse({
    DATABASE_URL: 'mysql://localhost:3306/db',
    JWT_SECRET: 'supersecretstringthatisatleast32chars!',
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
  });
  assert(valid587.success === true, '587 + false is valid (STARTTLS)');

  // Case 4: 465 + true -> valid
  const valid465 = envSchema.safeParse({
    DATABASE_URL: 'mysql://localhost:3306/db',
    JWT_SECRET: 'supersecretstringthatisatleast32chars!',
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
  });
  assert(valid465.success === true, '465 + true is valid (direct TLS)');

  // Case 5: 587 + true -> rejected / clear configuration error
  const invalid587 = envSchema.safeParse({
    DATABASE_URL: 'mysql://localhost:3306/db',
    JWT_SECRET: 'supersecretstringthatisatleast32chars!',
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '587',
    SMTP_SECURE: 'true',
  });
  assert(invalid587.success === false, '587 + true is rejected');
  assert(invalid587.error?.issues[0]?.message.includes('Port 587 requires SMTP_SECURE=false'), '587 + true returns clear configuration error message');

  // Case 6: 465 + false -> rejected / clear configuration error
  const invalid465 = envSchema.safeParse({
    DATABASE_URL: 'mysql://localhost:3306/db',
    JWT_SECRET: 'supersecretstringthatisatleast32chars!',
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '465',
    SMTP_SECURE: 'false',
  });
  assert(invalid465.success === false, '465 + false is rejected');
  assert(invalid465.error?.issues[0]?.message.includes('Port 465 requires SMTP_SECURE=true'), '465 + false returns clear configuration error message');

  console.log('\n[GROUP 14] Strict Email Isolation & Anti-Leakage (Mandatory Safety Tests)');
  // 26A: NODE_ENV=test + recipient real@gmail.com -> in-memory only
  clearTestEmails();
  enableTestMode(true);
  const testResA = await sendApprovalEmail({
    to: 'real@gmail.com',
    applicantName: 'Real Applicant',
    madrasaName: 'Real Madrasa',
    planName: 'Gold Plan',
    subscriptionStart: new Date(),
    subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    adminEmail: 'real@gmail.com',
  });
  assert(testResA.status === 'SENT' && testResA.success === true, '26A. NODE_ENV=test + real@gmail.com routes to in-memory only');
  const capturedA = getTestEmails();
  assert(capturedA.length === 1 && capturedA[0].to === 'real@gmail.com', '26A. In-memory test store captured real@gmail.com');

  // 26B: NODE_ENV=development + recipient user@test.com -> follows real configured provider path, NOT test adapter
  clearTestEmails();
  enableTestMode(false);
  const origEnv = process.env.NODE_ENV;
  const origEmailProvider = process.env.EMAIL_PROVIDER;
  process.env.NODE_ENV = 'development';
  process.env.EMAIL_PROVIDER = 'smtp';
  let providerSentUser = null;
  setProviderTransport({
    sendMail: async (opts) => {
      providerSentUser = opts;
      return { messageId: 'provider-user-test-123' };
    },
  });
  const testResDevUser = await sendApprovalEmail({
    to: 'user@test.com',
    applicantName: 'User Test',
    madrasaName: 'Test Academy',
    planName: 'Basic Plan',
    adminEmail: 'user@test.com',
  });
  assert(testResDevUser.success === true && testResDevUser.messageId === 'provider-user-test-123', '26B. NODE_ENV=development + user@test.com executes configured provider path');
  assert(getTestEmails().length === 0, '26B. user@test.com was NOT routed to in-memory test adapter');
  assert(providerSentUser?.to === 'user@test.com', '26B. Configured provider transport received user@test.com');
  setProviderTransport(null);
  process.env.NODE_ENV = origEnv;
  process.env.EMAIL_PROVIDER = origEmailProvider;
  enableTestMode(true);

  // 26C: NODE_ENV=development + recipient sa_test_realuser@gmail.com -> follows real configured provider path
  clearTestEmails();
  enableTestMode(false);
  process.env.NODE_ENV = 'development';
  process.env.EMAIL_PROVIDER = 'smtp';
  let providerSentPrefix = null;
  setProviderTransport({
    sendMail: async (opts) => {
      providerSentPrefix = opts;
      return { messageId: 'provider-prefix-test-456' };
    },
  });
  const testResDevPrefix = await sendApprovalEmail({
    to: 'sa_test_realuser@gmail.com',
    applicantName: 'Prefix User',
    madrasaName: 'Prefix Madrasa',
    planName: 'Basic Plan',
    adminEmail: 'sa_test_realuser@gmail.com',
  });
  assert(testResDevPrefix.success === true && testResDevPrefix.messageId === 'provider-prefix-test-456', '26C. NODE_ENV=development + sa_test_realuser@gmail.com executes configured provider path');
  assert(getTestEmails().length === 0, '26C. sa_test_realuser@gmail.com was NOT intercepted by test adapter');
  assert(providerSentPrefix?.to === 'sa_test_realuser@gmail.com', '26C. Configured provider transport received sa_test_realuser@gmail.com');
  setProviderTransport(null);
  process.env.NODE_ENV = origEnv;
  process.env.EMAIL_PROVIDER = origEmailProvider;
  enableTestMode(true);

  // 26D: NODE_ENV=test + recipient anything@example.com -> in-memory
  clearTestEmails();
  enableTestMode(true);
  const testResEx = await sendApprovalEmail({
    to: 'anything@example.com',
    applicantName: 'Example User',
    madrasaName: 'Example Madrasa',
    planName: 'Silver Plan',
    adminEmail: 'anything@example.com',
  });
  assert(testResEx.success === true && testResEx.status === 'SENT', '26D. NODE_ENV=test + anything@example.com routes to in-memory');
  const capturedEx = getTestEmails();
  assert(capturedEx.length === 1 && capturedEx[0].to === 'anything@example.com', '26D. In-memory test mailbox captured anything@example.com');

  // 26E: test Prisma instance points to DATABASE_TEST_URL
  const testDatasource = getPrismaDatasourceUrl(true);
  assert(testDatasource.includes('madrasanexa_test'), '26E. Test Prisma instance URL resolves to DATABASE_TEST_URL / madrasanexa_test');
  const [dbResult] = await prisma.$queryRawUnsafe('SELECT DATABASE() as db');
  assert(dbResult.db === 'madrasanexa_test', '26E. Connected test Prisma instance database is madrasanexa_test');

  // 26F: Verify that isolation guard strictly rejects the actual protected production database name 'madrasanexa'
  // without opening any connection to it
  const origTestUrl = process.env.DATABASE_TEST_URL;
  try {
    process.env.DATABASE_TEST_URL = 'mysql://root:secret@127.0.0.1:3306/madrasanexa';
    let isolationThrew = false;
    let isolationErrorMessage = '';
    try {
      getPrismaDatasourceUrl(true);
    } catch (err) {
      isolationThrew = true;
      isolationErrorMessage = err.message;
    }
    assert(isolationThrew === true, '26F. Isolation guard strictly rejects production database "madrasanexa"');
    assert(
      isolationErrorMessage.includes('FATAL SAFETY VIOLATION: Target test database is "madrasanexa"'),
      '26F. Guard explicitly aborts when production database "madrasanexa" is targeted'
    );
  } finally {
    process.env.DATABASE_TEST_URL = origTestUrl;
  }

  // 26G: Reserved-domain safety helper test
  assert(isTestRecipient('sheikh@example.com') === true, '26G. isTestRecipient identifies example.com test domain');
  assert(isTestRecipient('user@test.com') === false, '26G. user@test.com is NOT flagged as RFC reserved test recipient');
  assert(isTestRecipient('realuser@gmail.com') === false, '26G. realuser@gmail.com is NOT flagged as test recipient');
}

async function main() {
  try {
    await setup();
    await runTests();
  } catch (err) {
    console.error('Test runner fatal error:', err);
    testFailedCount++;
  } finally {
    await teardown();
  }

  console.log('\n=============================================');
  console.log(`Approval Center Test Results: ${testPassedCount} Passed, ${testFailedCount} Failed`);
  console.log('=============================================');

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

main();
