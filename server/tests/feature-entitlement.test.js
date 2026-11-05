/**
 * MadrasaNexa – Phase 2A Feature Entitlement Test Suite
 *
 * Scope: 20 Test Scenarios validating:
 * - Centralized feature resolution logic (Precedence: Institution -> Subscription -> DENY -> GRANT -> Plan)
 * - Middleware enforcement (requireFeature)
 * - All 15 Admissions Interview routes
 * - Strict tenant isolation and fail-closed safety
 *
 * Target Database: strictly `madrasanexa_test`.
 */

process.env.NODE_ENV = 'test';
import './setup-test-env.js';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import { enableTestMode, clearTestEmails } from '../src/services/email.service.js';
import { clearSentSmsMessages } from '../src/services/sms.service.js';
import { setTestStorageAdapter } from '../src/services/r2.service.js';
import { resolveFeatureEntitlement } from '../src/services/feature-entitlement.service.js';

const RUN_ID = `p2a_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

// Exact-ID Fixture Registry for clean teardown
const createdFixtureIds = {
  interviewNotifications: [],
  interviewAppointments: [],
  interviewSchedules: [],
  studentApplications: [],
  admissionPeriods: [],
  madrasaFeatureOverrides: [],
  subscriptions: [],
  planFeatures: [],
  plans: [],
  users: [],
  madrasas: [],
};

function registerFixture(collection, id) {
  if (createdFixtureIds[collection] && id) {
    if (!createdFixtureIds[collection].includes(id)) {
      createdFixtureIds[collection].push(id);
    }
  }
}

let testServer = null;
let baseUrl = '';

let madrasaActiveWithFeature = null;
let madrasaActiveWithoutFeature = null;
let madrasaExpired = null;
let madrasaFuture = null;
let madrasaSuspended = null;
let madrasaArchived = null;

let planWithFeature = null;
let planWithoutFeature = null;

let userAdminWithFeature = null;
let tokenAdminWithFeature = '';

let userAdminWithoutFeature = null;
let tokenAdminWithoutFeature = '';

let userAdminExpired = null;
let tokenAdminExpired = '';

let userAdminSuspended = null;
let tokenAdminSuspended = '';

let admissionPeriodWithFeature = null;
let applicationWithFeature = null;

let admissionPeriodWithoutFeature = null;
let applicationWithoutFeature = null;

let passCount = 0;
let failCount = 0;
const testResults = [];

function recordResult(testId, name, passed, detail = '') {
  testResults.push({ testId, name, passed, detail });
  if (passed) {
    console.log(`  ✓ [PASS] [${testId}] ${name}`);
    passCount++;
  } else {
    console.error(`  ✗ [FAIL] [${testId}] ${name} - ${detail}`);
    failCount++;
  }
}

async function runPreflightSafetyGate() {
  console.log('\n======================================================');
  console.log(' PHASE 2A PREFLIGHT SAFETY VERIFICATION GATE');
  console.log('======================================================');

  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`PREFLIGHT ABORT: NODE_ENV is "${process.env.NODE_ENV}", must strictly be "test".`);
  }

  const [activeDb] = await prisma.$queryRawUnsafe('SELECT DATABASE() AS current_db');
  if (!activeDb || activeDb.current_db !== 'madrasanexa_test') {
    throw new Error(
      `FATAL DATABASE ISOLATION ABORT: Active MySQL connection resolved to "${activeDb?.current_db}". Expected "madrasanexa_test". Aborting!`
    );
  }

  enableTestMode(true);
  clearTestEmails();
  clearSentSmsMessages();

  const testStorageMemory = new Map();
  setTestStorageAdapter({
    upload: async (key, buffer) => {
      testStorageMemory.set(key, buffer);
      return `https://test-r2.madrasanexa.internal/${key}`;
    },
    getDownloadUrl: async (key) => `https://test-r2.madrasanexa.internal/${key}`,
    delete: async (key) => { testStorageMemory.delete(key); },
  });

  console.log('✓ Preflight Check Passed: Connected exclusively to "madrasanexa_test". All mocks active.\n');
}

async function setupFixtures() {
  console.log('--- Setting Up Test Fixtures in madrasanexa_test ---');

  // 1. Madrasas
  madrasaActiveWithFeature = await prisma.madrasa.create({
    data: {
      code: `M_FEAT_${RUN_ID}`,
      name: `Madrasa With Feature ${RUN_ID}`,
      slug: `m-feat-${RUN_ID}`,
      status: 'ACTIVE',
    },
  });
  registerFixture('madrasas', madrasaActiveWithFeature.id);

  madrasaActiveWithoutFeature = await prisma.madrasa.create({
    data: {
      code: `M_NOFEAT_${RUN_ID}`,
      name: `Madrasa Without Feature ${RUN_ID}`,
      slug: `m-nofeat-${RUN_ID}`,
      status: 'ACTIVE',
    },
  });
  registerFixture('madrasas', madrasaActiveWithoutFeature.id);

  madrasaExpired = await prisma.madrasa.create({
    data: {
      code: `M_EXP_${RUN_ID}`,
      name: `Madrasa Expired ${RUN_ID}`,
      slug: `m-exp-${RUN_ID}`,
      status: 'ACTIVE',
    },
  });
  registerFixture('madrasas', madrasaExpired.id);

  madrasaFuture = await prisma.madrasa.create({
    data: {
      code: `M_FUT_${RUN_ID}`,
      name: `Madrasa Future ${RUN_ID}`,
      slug: `m-fut-${RUN_ID}`,
      status: 'ACTIVE',
    },
  });
  registerFixture('madrasas', madrasaFuture.id);

  madrasaSuspended = await prisma.madrasa.create({
    data: {
      code: `M_SUSP_${RUN_ID}`,
      name: `Madrasa Suspended ${RUN_ID}`,
      slug: `m-susp-${RUN_ID}`,
      status: 'SUSPENDED',
    },
  });
  registerFixture('madrasas', madrasaSuspended.id);

  madrasaArchived = await prisma.madrasa.create({
    data: {
      code: `M_ARCH_${RUN_ID}`,
      name: `Madrasa Archived ${RUN_ID}`,
      slug: `m-arch-${RUN_ID}`,
      status: 'ARCHIVED',
    },
  });
  registerFixture('madrasas', madrasaArchived.id);

  // 2. Plans & Features
  planWithFeature = await prisma.plan.create({
    data: {
      code: `PLAN_INT_YES_${RUN_ID}`,
      name: `Plan With Interview ${RUN_ID}`,
      durationMonths: 12,
      price: 2000.0,
      isActive: true,
    },
  });
  registerFixture('plans', planWithFeature.id);

  const featInterview = await prisma.planFeature.create({
    data: {
      planId: planWithFeature.id,
      featureKey: 'ADMISSIONS_INTERVIEW',
      isEnabled: true,
    },
  });
  registerFixture('planFeatures', featInterview.id);

  planWithoutFeature = await prisma.plan.create({
    data: {
      code: `PLAN_INT_NO_${RUN_ID}`,
      name: `Plan Without Interview ${RUN_ID}`,
      durationMonths: 12,
      price: 1000.0,
      isActive: true,
    },
  });
  registerFixture('plans', planWithoutFeature.id);

  // 3. Subscriptions
  const now = Date.now();

  const subWithFeature = await prisma.subscription.create({
    data: {
      madrasaId: madrasaActiveWithFeature.id,
      planId: planWithFeature.id,
      status: 'ACTIVE',
      startsAt: new Date(now - 86400000 * 30),
      endsAt: new Date(now + 86400000 * 335),
      priceAtPurchase: 2000.0,
      durationMonthsAtPurchase: 12,
    },
  });
  registerFixture('subscriptions', subWithFeature.id);

  const subWithoutFeature = await prisma.subscription.create({
    data: {
      madrasaId: madrasaActiveWithoutFeature.id,
      planId: planWithoutFeature.id,
      status: 'ACTIVE',
      startsAt: new Date(now - 86400000 * 30),
      endsAt: new Date(now + 86400000 * 335),
      priceAtPurchase: 1000.0,
      durationMonthsAtPurchase: 12,
    },
  });
  registerFixture('subscriptions', subWithoutFeature.id);

  const subExpired = await prisma.subscription.create({
    data: {
      madrasaId: madrasaExpired.id,
      planId: planWithFeature.id,
      status: 'ACTIVE',
      startsAt: new Date(now - 86400000 * 60),
      endsAt: new Date(now - 86400000 * 1), // Expired yesterday
      priceAtPurchase: 2000.0,
      durationMonthsAtPurchase: 12,
    },
  });
  registerFixture('subscriptions', subExpired.id);

  const subFuture = await prisma.subscription.create({
    data: {
      madrasaId: madrasaFuture.id,
      planId: planWithFeature.id,
      status: 'ACTIVE',
      startsAt: new Date(now + 86400000 * 10), // Starts in 10 days
      endsAt: new Date(now + 86400000 * 375),
      priceAtPurchase: 2000.0,
      durationMonthsAtPurchase: 12,
    },
  });
  registerFixture('subscriptions', subFuture.id);

  // 4. Users & Auth Tokens
  const passwordHash = await hashPassword('TestP@ssword123!');

  userAdminWithFeature = await prisma.user.create({
    data: {
      name: `Admin Feat ${RUN_ID}`,
      email: `admin_feat_${RUN_ID}@example.com`,
      passwordHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaActiveWithFeature.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  registerFixture('users', userAdminWithFeature.id);
  tokenAdminWithFeature = signAccessToken({
    userId: userAdminWithFeature.id,
    role: 'MADRASA_ADMIN',
    madrasaId: madrasaActiveWithFeature.id,
  });

  userAdminWithoutFeature = await prisma.user.create({
    data: {
      name: `Admin No Feat ${RUN_ID}`,
      email: `admin_nofeat_${RUN_ID}@example.com`,
      passwordHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaActiveWithoutFeature.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  registerFixture('users', userAdminWithoutFeature.id);
  tokenAdminWithoutFeature = signAccessToken({
    userId: userAdminWithoutFeature.id,
    role: 'MADRASA_ADMIN',
    madrasaId: madrasaActiveWithoutFeature.id,
  });

  userAdminExpired = await prisma.user.create({
    data: {
      name: `Admin Exp ${RUN_ID}`,
      email: `admin_exp_${RUN_ID}@example.com`,
      passwordHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaExpired.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  registerFixture('users', userAdminExpired.id);
  tokenAdminExpired = signAccessToken({
    userId: userAdminExpired.id,
    role: 'MADRASA_ADMIN',
    madrasaId: madrasaExpired.id,
  });

  userAdminSuspended = await prisma.user.create({
    data: {
      name: `Admin Susp ${RUN_ID}`,
      email: `admin_susp_${RUN_ID}@example.com`,
      passwordHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaSuspended.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  registerFixture('users', userAdminSuspended.id);
  tokenAdminSuspended = signAccessToken({
    userId: userAdminSuspended.id,
    role: 'MADRASA_ADMIN',
    madrasaId: madrasaSuspended.id,
  });

  // 5. Admission Periods & Applications for HTTP testing
  admissionPeriodWithFeature = await prisma.admissionPeriod.create({
    data: {
      madrasaId: madrasaActiveWithFeature.id,
      code: `PER_FEAT_${RUN_ID}`,
      name: `Admission Period Feat ${RUN_ID}`,
      academicYear: 2026,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isOpen: true,
    },
  });
  registerFixture('admissionPeriods', admissionPeriodWithFeature.id);

  applicationWithFeature = await prisma.studentApplication.create({
    data: {
      madrasaId: madrasaActiveWithFeature.id,
      admissionPeriodId: admissionPeriodWithFeature.id,
      applicationNo: `APP_FEAT_${RUN_ID}`,
      applicantName: `Applicant Feat ${RUN_ID}`,
      dateOfBirth: new Date('2015-05-15'),
      gender: 'MALE',
      guardianName: 'Guardian Feat',
      guardianRelationship: 'Father',
      guardianPhone: '+94771112233',
      address: 'Colombo, Sri Lanka',
      status: 'PENDING',
    },
  });
  registerFixture('studentApplications', applicationWithFeature.id);

  admissionPeriodWithoutFeature = await prisma.admissionPeriod.create({
    data: {
      madrasaId: madrasaActiveWithoutFeature.id,
      code: `PER_NOFEAT_${RUN_ID}`,
      name: `Admission Period No Feat ${RUN_ID}`,
      academicYear: 2026,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isOpen: true,
    },
  });
  registerFixture('admissionPeriods', admissionPeriodWithoutFeature.id);

  applicationWithoutFeature = await prisma.studentApplication.create({
    data: {
      madrasaId: madrasaActiveWithoutFeature.id,
      admissionPeriodId: admissionPeriodWithoutFeature.id,
      applicationNo: `APP_NOFEAT_${RUN_ID}`,
      applicantName: `Applicant No Feat ${RUN_ID}`,
      dateOfBirth: new Date('2015-06-15'),
      gender: 'MALE',
      guardianName: 'Guardian No Feat',
      guardianRelationship: 'Father',
      guardianPhone: '+94774445566',
      address: 'Kandy, Sri Lanka',
      status: 'PENDING',
    },
  });
  registerFixture('studentApplications', applicationWithoutFeature.id);

  // 6. Start HTTP test server
  testServer = http.createServer(app);
  await new Promise((resolve) => {
    testServer.listen(0, '127.0.0.1', () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });

  console.log(`✓ All Fixtures Initialized. Test Server listening at ${baseUrl}\n`);
}

async function teardownExactFixtures() {
  console.log('\n======================================================');
  console.log(' TEARDOWN: PURGING FIXTURES IN REVERSE FOREIGN-KEY ORDER');
  console.log('======================================================');

  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  const safeDelete = async (name, delegate, ids) => {
    if (!ids || ids.length === 0) return;
    try {
      await delegate.deleteMany({ where: { id: { in: ids } } });
      console.log(`  ✓ Purged ${ids.length} records from ${name}`);
    } catch (err) {
      console.error(`  ✗ Error purging ${name}:`, err.message);
    }
  };

  await safeDelete('InterviewNotification', prisma.interviewNotification, createdFixtureIds.interviewNotifications);
  await safeDelete('InterviewAppointment', prisma.interviewAppointment, createdFixtureIds.interviewAppointments);
  await safeDelete('InterviewSchedule', prisma.interviewSchedule, createdFixtureIds.interviewSchedules);
  await safeDelete('StudentApplication', prisma.studentApplication, createdFixtureIds.studentApplications);
  await safeDelete('AdmissionPeriod', prisma.admissionPeriod, createdFixtureIds.admissionPeriods);
  await safeDelete('MadrasaFeatureOverride', prisma.madrasaFeatureOverride, createdFixtureIds.madrasaFeatureOverrides);
  await safeDelete('Subscription', prisma.subscription, createdFixtureIds.subscriptions);
  await safeDelete('PlanFeature', prisma.planFeature, createdFixtureIds.planFeatures);
  await safeDelete('Plan', prisma.plan, createdFixtureIds.plans);
  await safeDelete('User', prisma.user, createdFixtureIds.users);
  await safeDelete('Madrasa', prisma.madrasa, createdFixtureIds.madrasas);

  console.log('✓ Teardown Complete. Pre-existing records preserved.\n');
}

// ============================================================================
// THE 20 TEST SCENARIOS
// ============================================================================
async function runTests() {
  console.log('======================================================');
  console.log(' EXECUTING 20 FEATURE ENTITLEMENT SCENARIOS');
  console.log('======================================================\n');

  // Scenario 1: Active institution + active subscription + enabled feature
  try {
    const res = await resolveFeatureEntitlement(madrasaActiveWithFeature.id, 'ADMISSIONS_INTERVIEW');
    const passed = res.allowed === true && res.code === 'FEATURE_PLAN_ENABLED' && res.source === 'PLAN';
    recordResult('SCENARIO-01', 'Active institution, active subscription, enabled feature -> ALLOW (PLAN)', passed, `Code: ${res.code}`);
  } catch (err) {
    recordResult('SCENARIO-01', 'Active institution, active subscription, enabled feature', false, err.message);
  }

  // Scenario 2: Active institution + active subscription + missing feature
  try {
    const res = await resolveFeatureEntitlement(madrasaActiveWithoutFeature.id, 'ADMISSIONS_INTERVIEW');
    const passed = res.allowed === false && res.code === 'FEATURE_NOT_IN_PLAN';
    recordResult('SCENARIO-02', 'Active institution, active subscription, missing feature -> DENY (FEATURE_NOT_IN_PLAN)', passed, `Code: ${res.code}`);
  } catch (err) {
    recordResult('SCENARIO-02', 'Active institution, active subscription, missing feature', false, err.message);
  }

  // Scenario 3: Expired subscription
  try {
    const res = await resolveFeatureEntitlement(madrasaExpired.id, 'ADMISSIONS_INTERVIEW');
    const passed = res.allowed === false && res.code === 'SUBSCRIPTION_EXPIRED';
    recordResult('SCENARIO-03', 'Active institution, expired subscription -> DENY (SUBSCRIPTION_EXPIRED)', passed, `Code: ${res.code}`);
  } catch (err) {
    recordResult('SCENARIO-03', 'Active institution, expired subscription', false, err.message);
  }

  // Scenario 4: Future subscription
  try {
    const res = await resolveFeatureEntitlement(madrasaFuture.id, 'ADMISSIONS_INTERVIEW');
    const passed = res.allowed === false && res.code === 'SUBSCRIPTION_NOT_STARTED';
    recordResult('SCENARIO-04', 'Active institution, future subscription -> DENY (SUBSCRIPTION_NOT_STARTED)', passed, `Code: ${res.code}`);
  } catch (err) {
    recordResult('SCENARIO-04', 'Active institution, future subscription', false, err.message);
  }

  // Scenario 5: Suspended institution
  try {
    const res = await resolveFeatureEntitlement(madrasaSuspended.id, 'ADMISSIONS_INTERVIEW');
    const passed = res.allowed === false && res.code === 'INSTITUTION_INACTIVE';
    recordResult('SCENARIO-05', 'Suspended institution -> DENY (INSTITUTION_INACTIVE)', passed, `Code: ${res.code}`);
  } catch (err) {
    recordResult('SCENARIO-05', 'Suspended institution', false, err.message);
  }

  // Scenario 6: Archived institution
  try {
    const res = await resolveFeatureEntitlement(madrasaArchived.id, 'ADMISSIONS_INTERVIEW');
    const passed = res.allowed === false && res.code === 'INSTITUTION_INACTIVE';
    recordResult('SCENARIO-06', 'Archived institution -> DENY (INSTITUTION_INACTIVE)', passed, `Code: ${res.code}`);
  } catch (err) {
    recordResult('SCENARIO-06', 'Archived institution', false, err.message);
  }

  // Scenario 7: Active GRANT override
  let grantOverride = null;
  try {
    grantOverride = await prisma.madrasaFeatureOverride.create({
      data: {
        madrasaId: madrasaActiveWithoutFeature.id,
        featureKey: 'ADMISSIONS_INTERVIEW',
        overrideType: 'GRANT',
        reason: 'Promo grant test',
        startsAt: new Date(Date.now() - 3600000),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    registerFixture('madrasaFeatureOverrides', grantOverride.id);

    const res = await resolveFeatureEntitlement(madrasaActiveWithoutFeature.id, 'ADMISSIONS_INTERVIEW');
    const passed = res.allowed === true && res.code === 'FEATURE_OVERRIDE_GRANTED' && res.source === 'OVERRIDE';
    recordResult('SCENARIO-07', 'Active GRANT override on plan lacking feature -> ALLOW (OVERRIDE)', passed, `Code: ${res.code}`);
  } catch (err) {
    recordResult('SCENARIO-07', 'Active GRANT override', false, err.message);
  }

  // Clean up grant override for subsequent tests
  if (grantOverride) {
    await prisma.madrasaFeatureOverride.delete({ where: { id: grantOverride.id } }).catch(() => {});
  }

  // Scenario 8: Active DENY override
  let denyOverride = null;
  try {
    denyOverride = await prisma.madrasaFeatureOverride.create({
      data: {
        madrasaId: madrasaActiveWithFeature.id,
        featureKey: 'ADMISSIONS_INTERVIEW',
        overrideType: 'DENY',
        reason: 'Disciplinary block',
        startsAt: new Date(Date.now() - 3600000),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    registerFixture('madrasaFeatureOverrides', denyOverride.id);

    const res = await resolveFeatureEntitlement(madrasaActiveWithFeature.id, 'ADMISSIONS_INTERVIEW');
    const passed = res.allowed === false && res.code === 'FEATURE_OVERRIDE_DENIED';
    recordResult('SCENARIO-08', 'Active DENY override on plan with feature -> DENY (FEATURE_OVERRIDE_DENIED)', passed, `Code: ${res.code}`);
  } catch (err) {
    recordResult('SCENARIO-08', 'Active DENY override', false, err.message);
  }

  // Clean up deny override for subsequent tests
  if (denyOverride) {
    await prisma.madrasaFeatureOverride.delete({ where: { id: denyOverride.id } }).catch(() => {});
  }

  // Scenario 9: Expired GRANT override falls back to plan
  let expiredGrant = null;
  try {
    expiredGrant = await prisma.madrasaFeatureOverride.create({
      data: {
        madrasaId: madrasaActiveWithoutFeature.id,
        featureKey: 'ADMISSIONS_INTERVIEW',
        overrideType: 'GRANT',
        reason: 'Expired promo',
        startsAt: new Date(Date.now() - 86400000 * 10),
        expiresAt: new Date(Date.now() - 86400000 * 1), // Expired yesterday
      },
    });
    registerFixture('madrasaFeatureOverrides', expiredGrant.id);

    const res = await resolveFeatureEntitlement(madrasaActiveWithoutFeature.id, 'ADMISSIONS_INTERVIEW');
    // Because plan lacks feature, fallback must DENY
    const passed = res.allowed === false && res.code === 'FEATURE_NOT_IN_PLAN';
    recordResult('SCENARIO-09', 'Expired GRANT override falls back to plan -> DENY (FEATURE_NOT_IN_PLAN)', passed, `Code: ${res.code}`);
  } catch (err) {
    recordResult('SCENARIO-09', 'Expired GRANT override', false, err.message);
  }

  if (expiredGrant) {
    await prisma.madrasaFeatureOverride.delete({ where: { id: expiredGrant.id } }).catch(() => {});
  }

  // Scenario 10: Expired DENY override falls back to plan
  let expiredDeny = null;
  try {
    expiredDeny = await prisma.madrasaFeatureOverride.create({
      data: {
        madrasaId: madrasaActiveWithFeature.id,
        featureKey: 'ADMISSIONS_INTERVIEW',
        overrideType: 'DENY',
        reason: 'Expired restriction',
        startsAt: new Date(Date.now() - 86400000 * 10),
        expiresAt: new Date(Date.now() - 86400000 * 1), // Expired yesterday
      },
    });
    registerFixture('madrasaFeatureOverrides', expiredDeny.id);

    const res = await resolveFeatureEntitlement(madrasaActiveWithFeature.id, 'ADMISSIONS_INTERVIEW');
    // Because plan has feature enabled, fallback must ALLOW
    const passed = res.allowed === true && res.code === 'FEATURE_PLAN_ENABLED';
    recordResult('SCENARIO-10', 'Expired DENY override falls back to plan -> ALLOW (FEATURE_PLAN_ENABLED)', passed, `Code: ${res.code}`);
  } catch (err) {
    recordResult('SCENARIO-10', 'Expired DENY override', false, err.message);
  }

  if (expiredDeny) {
    await prisma.madrasaFeatureOverride.delete({ where: { id: expiredDeny.id } }).catch(() => {});
  }

  // Scenario 11: DENY override against enabled plan feature (Strict precedence)
  let precedenceDeny = null;
  try {
    precedenceDeny = await prisma.madrasaFeatureOverride.create({
      data: {
        madrasaId: madrasaActiveWithFeature.id,
        featureKey: 'ADMISSIONS_INTERVIEW',
        overrideType: 'DENY',
        reason: 'Precedence test',
        startsAt: new Date(Date.now() - 3600000),
      },
    });
    registerFixture('madrasaFeatureOverrides', precedenceDeny.id);

    const res = await resolveFeatureEntitlement(madrasaActiveWithFeature.id, 'ADMISSIONS_INTERVIEW');
    const passed = res.allowed === false && res.code === 'FEATURE_OVERRIDE_DENIED';
    recordResult('SCENARIO-11', 'DENY override trumps enabled plan feature -> DENY (FEATURE_OVERRIDE_DENIED)', passed, `Code: ${res.code}`);
  } catch (err) {
    recordResult('SCENARIO-11', 'DENY override precedence', false, err.message);
  }

  if (precedenceDeny) {
    await prisma.madrasaFeatureOverride.delete({ where: { id: precedenceDeny.id } }).catch(() => {});
  }

  // Scenario 12: GRANT override against disabled plan feature
  let disabledPlan = null;
  let disabledPlanSub = null;
  let disabledGrantMadrasa = null;
  let disabledGrantOverride = null;
  try {
    disabledGrantMadrasa = await prisma.madrasa.create({
      data: {
        code: `M_DIS_G_${RUN_ID}`,
        name: `Madrasa Dis Grant ${RUN_ID}`,
        slug: `m-dis-g-${RUN_ID}`,
        status: 'ACTIVE',
      },
    });
    registerFixture('madrasas', disabledGrantMadrasa.id);

    disabledPlan = await prisma.plan.create({
      data: {
        code: `PLAN_DIS_${RUN_ID}`,
        name: `Plan Dis ${RUN_ID}`,
        durationMonths: 12,
        price: 500,
      },
    });
    registerFixture('plans', disabledPlan.id);

    const disabledPf = await prisma.planFeature.create({
      data: {
        planId: disabledPlan.id,
        featureKey: 'ADMISSIONS_INTERVIEW',
        isEnabled: false, // Explicitly disabled
      },
    });
    registerFixture('planFeatures', disabledPf.id);

    disabledPlanSub = await prisma.subscription.create({
      data: {
        madrasaId: disabledGrantMadrasa.id,
        planId: disabledPlan.id,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 86400000),
        endsAt: new Date(Date.now() + 86400000 * 365),
        priceAtPurchase: 500,
        durationMonthsAtPurchase: 12,
      },
    });
    registerFixture('subscriptions', disabledPlanSub.id);

    disabledGrantOverride = await prisma.madrasaFeatureOverride.create({
      data: {
        madrasaId: disabledGrantMadrasa.id,
        featureKey: 'ADMISSIONS_INTERVIEW',
        overrideType: 'GRANT',
        reason: 'Override disabled plan feature',
        startsAt: new Date(Date.now() - 3600000),
      },
    });
    registerFixture('madrasaFeatureOverrides', disabledGrantOverride.id);

    const res = await resolveFeatureEntitlement(disabledGrantMadrasa.id, 'ADMISSIONS_INTERVIEW');
    const passed = res.allowed === true && res.code === 'FEATURE_OVERRIDE_GRANTED';
    recordResult('SCENARIO-12', 'GRANT override on plan with isEnabled=false -> ALLOW (FEATURE_OVERRIDE_GRANTED)', passed, `Code: ${res.code}`);
  } catch (err) {
    recordResult('SCENARIO-12', 'GRANT override on disabled plan feature', false, err.message);
  }

  // Scenario 13: Missing tenant context in HTTP request
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/admissions/interviews/appointments`);
    const passed = res.status === 401; // Blocked at auth before tenant
    recordResult('SCENARIO-13', 'Missing auth/tenant context on interview route returns 401 Unauthorized', passed, `Status: ${res.status}`);
  } catch (err) {
    recordResult('SCENARIO-13', 'Missing tenant context', false, err.message);
  }

  // Scenario 14: Unauthorized request (malformed token)
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/admissions/interviews/appointments`, {
      headers: { Authorization: 'Bearer invalid.token.format' },
    });
    const passed = res.status === 401;
    recordResult('SCENARIO-14', 'Malformed token on interview route returns 401 Unauthorized', passed, `Status: ${res.status}`);
  } catch (err) {
    recordResult('SCENARIO-14', 'Unauthorized request', false, err.message);
  }

  // Scenario 15: Cross-tenant feature access attempt
  // Admin Without Feature sends madrasaId of Madrasa With Feature in query/body
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/admissions/interviews/appointments?madrasaId=${madrasaActiveWithFeature.id}`, {
      headers: { Authorization: `Bearer ${tokenAdminWithoutFeature}` },
    });
    const json = await res.json().catch(() => ({}));
    // Middleware must reject based on req.tenant.madrasaId (madrasaActiveWithoutFeature), ignoring query param
    const passed = res.status === 403 && json.code === 'FEATURE_NOT_IN_PLAN';
    recordResult('SCENARIO-15', 'Cross-tenant madrasaId spoofing in query ignored; rejected with 403', passed, `Status: ${res.status}, Code: ${json.code}`);
  } catch (err) {
    recordResult('SCENARIO-15', 'Cross-tenant feature access attempt', false, err.message);
  }

  // Scenario 16: Invalid feature key
  try {
    const res = await resolveFeatureEntitlement(madrasaActiveWithFeature.id, 'TOTALLY_INVALID_KEY_XYZ');
    const passed = res.allowed === false && res.code === 'FEATURE_NOT_IN_PLAN';
    recordResult('SCENARIO-16', 'Invalid / unknown feature key -> DENY (FEATURE_NOT_IN_PLAN)', passed, `Code: ${res.code}`);
  } catch (err) {
    recordResult('SCENARIO-16', 'Invalid feature key', false, err.message);
  }

  // Scenario 17: Database lookup failure / safe error handling
  try {
    const res = await resolveFeatureEntitlement(null, 'ADMISSIONS_INTERVIEW');
    const passed = res.allowed === false && res.code === 'ENTITLEMENT_RESOLUTION_ERROR';
    recordResult('SCENARIO-17', 'Null madrasaId fails closed safely (ENTITLEMENT_RESOLUTION_ERROR)', passed, `Code: ${res.code}`);
  } catch (err) {
    recordResult('SCENARIO-17', 'Safe error handling', false, err.message);
  }

  // Scenario 18: Interview endpoint with feature enabled
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/admissions/interviews/appointments`, {
      headers: { Authorization: `Bearer ${tokenAdminWithFeature}` },
    });
    const passed = res.status === 200;
    recordResult('SCENARIO-18', 'Entitled tenant accesses GET /admissions/interviews/appointments -> 200 OK', passed, `Status: ${res.status}`);
  } catch (err) {
    recordResult('SCENARIO-18', 'Interview endpoint with feature enabled', false, err.message);
  }

  // Scenario 19: Interview endpoint with feature disabled
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/admissions/interviews/appointments`, {
      headers: { Authorization: `Bearer ${tokenAdminWithoutFeature}` },
    });
    const json = await res.json().catch(() => ({}));
    const passed = res.status === 403 && json.code === 'FEATURE_NOT_IN_PLAN';
    recordResult('SCENARIO-19', 'Unentitled tenant accesses GET /admissions/interviews/appointments -> 403 Forbidden', passed, `Status: ${res.status}, Code: ${json.code}`);
  } catch (err) {
    recordResult('SCENARIO-19', 'Interview endpoint with feature disabled', false, err.message);
  }

  // Scenario 20: Comprehensive verification that ALL 15 Admissions Interview endpoints reject unentitled tenant with 403
  try {
    const dummyId = 'cmw0dummyid0000000000000000';
    const endpointsToTest = [
      { method: 'GET', path: '/madrasa-admin/admissions/interviews/eligible-applicants' },
      { method: 'POST', path: '/madrasa-admin/admissions/interviews/schedule', body: {} },
      { method: 'GET', path: '/madrasa-admin/admissions/interviews/appointments' },
      { method: 'GET', path: `/madrasa-admin/admissions/interviews/appointments/${dummyId}` },
      { method: 'POST', path: `/madrasa-admin/admissions/interviews/appointments/${dummyId}/reschedule`, body: {} },
      { method: 'POST', path: `/madrasa-admin/admissions/interviews/appointments/${dummyId}/cancel`, body: {} },
      { method: 'POST', path: `/madrasa-admin/admissions/interviews/appointments/${dummyId}/evaluate`, body: {} },
      { method: 'GET', path: '/madrasa-admin/admissions/interviews/stats' },
      { method: 'GET', path: `/madrasa-admin/admissions/interviews/history/${dummyId}` },
      { method: 'GET', path: `/madrasa-admin/admissions/interviews/appointments/${dummyId}/preview-pdf` },
      { method: 'GET', path: `/madrasa-admin/admissions/interviews/appointments/${dummyId}/download-pdf` },
      { method: 'POST', path: `/madrasa-admin/admissions/interviews/appointments/${dummyId}/send-email`, body: {} },
      { method: 'POST', path: '/madrasa-admin/admissions/interviews/notifications/retry', body: {} },
      { method: 'POST', path: `/madrasa-admin/admissions/interviews/notifications/${dummyId}/mark-delivered`, body: {} },
      { method: 'POST', path: `/madrasa-admin/admissions/interviews/notifications/${dummyId}/confirm-failed`, body: {} },
    ];

    let allProtected = true;
    const failures = [];

    for (const ep of endpointsToTest) {
      const opts = {
        method: ep.method,
        headers: {
          Authorization: `Bearer ${tokenAdminWithoutFeature}`,
          'Content-Type': 'application/json',
        },
      };
      if (ep.body) opts.body = JSON.stringify(ep.body);

      const res = await fetch(`${baseUrl}${ep.path}`, opts);
      const json = await res.json().catch(() => ({}));

      // Must be 403 with code FEATURE_NOT_IN_PLAN
      if (res.status !== 403 || json.code !== 'FEATURE_NOT_IN_PLAN') {
        allProtected = false;
        failures.push(`${ep.method} ${ep.path} returned status ${res.status} (code: ${json.code})`);
      }
    }

    recordResult(
      'SCENARIO-20',
      'All 15 Admissions Interview routes reject unentitled requests with 403 FEATURE_NOT_IN_PLAN',
      allProtected,
      allProtected ? '15/15 endpoints verified' : `Failures: ${failures.join('; ')}`
    );
  } catch (err) {
    recordResult('SCENARIO-20', 'All 15 Admissions Interview routes protected', false, err.message);
  }
}

export async function main() {
  console.log('\n======================================================');
  console.log(' STARTING PHASE 2A FEATURE ENTITLEMENT TEST SUITE');
  console.log('======================================================\n');

  try {
    await runPreflightSafetyGate();
    await setupFixtures();
    await runTests();

    console.log('\n======================================================');
    console.log(' FEATURE ENTITLEMENT TEST SUMMARY');
    console.log('======================================================');
    console.log(` PASSED: ${passCount}/20`);
    console.log(` FAILED: ${failCount}/20`);
    console.log('======================================================\n');

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Fatal test execution error:', err);
    process.exitCode = 1;
  } finally {
    try {
      await teardownExactFixtures();
    } catch (cleanupErr) {
      console.error('Teardown error:', cleanupErr);
    } finally {
      await prisma.$disconnect();
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('feature-entitlement.test.js')) {
  main();
}
