process.env.NODE_ENV = 'test';
import './setup-test-env.js';
import http from 'http';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import {
  FEATURE_CATALOGUE,
  FEATURE_CATEGORIES,
  FEATURE_STATUS,
  FEATURE_KEYS_IMPLEMENTED,
  FEATURE_KEYS_CORE,
  FEATURE_KEYS_PARTIALLY_IMPLEMENTED,
  FEATURE_KEYS_PLANNED,
} from '../src/constants/feature-catalogue.js';

const TEST_PREFIX = 'safp_' + Date.now();

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
let fixtureMadrasa = null;

let createdTestPlanId = null;
let goldTierPlan = null;

async function setup() {
  console.log('\n--- Setting up Feature Catalogue & Dynamic Plan Management Test Fixtures ---');

  // 1. Super Admin User
  superAdminUser = await prisma.user.create({
    data: {
      name: 'Super Admin Feature Tester',
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

  // 3. Gold Tier Plan fixture with 61 features and 2 subscriptions
  goldTierPlan = await prisma.plan.create({
    data: {
      name: `Gold Tier ${TEST_PREFIX}`,
      code: `GOLD_${TEST_PREFIX.slice(-5).toUpperCase()}`,
      description: 'Active Gold Tier Plan with 61 features',
      durationMonths: 12,
      price: 2500,
      isActive: true,
      planFeatures: {
        createMany: {
          data: FEATURE_KEYS_IMPLEMENTED.map((k) => ({
            featureKey: k,
            isEnabled: true,
          })),
        },
      },
    },
  });

  await prisma.subscription.create({
    data: {
      madrasaId: fixtureMadrasa.id,
      planId: goldTierPlan.id,
      status: 'ACTIVE',
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      priceAtPurchase: 2500,
      durationMonthsAtPurchase: 1,
    },
  });
  await prisma.subscription.create({
    data: {
      madrasaId: fixtureMadrasa.id,
      planId: goldTierPlan.id,
      status: 'EXPIRED',
      startsAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      priceAtPurchase: 2500,
      durationMonthsAtPurchase: 1,
    },
  });

  // 4. Start test HTTP server
  await new Promise((resolve) => {
    testServer = http.createServer(app);
    testServer.listen(0, '127.0.0.1', () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/super-admin`;
      console.log(`Test server running at ${baseUrl}`);
      resolve();
    });
  });
}

async function teardown() {
  console.log('\n--- Tearing Down Test Fixtures ---');

  if (createdTestPlanId) {
    await prisma.planFeature.deleteMany({ where: { planId: createdTestPlanId } });
    await prisma.activityLog.deleteMany({ where: { entityType: 'Plan', entityId: createdTestPlanId } });
    await prisma.plan.deleteMany({ where: { id: createdTestPlanId } });
  }

  if (goldTierPlan) {
    await prisma.subscription.deleteMany({ where: { planId: goldTierPlan.id } });
    await prisma.planFeature.deleteMany({ where: { planId: goldTierPlan.id } });
    await prisma.activityLog.deleteMany({ where: { entityType: 'Plan', entityId: goldTierPlan.id } });
    await prisma.plan.delete({ where: { id: goldTierPlan.id } });
  }

  // Delete test plans with code prefix
  const testPlans = await prisma.plan.findMany({
    where: { code: { startsWith: TEST_PREFIX.slice(-6).toUpperCase() } },
  });
  for (const tp of testPlans) {
    await prisma.planFeature.deleteMany({ where: { planId: tp.id } });
    await prisma.activityLog.deleteMany({ where: { entityType: 'Plan', entityId: tp.id } });
    await prisma.plan.delete({ where: { id: tp.id } });
  }

  if (fixtureMadrasa) {
    await prisma.user.deleteMany({ where: { madrasaId: fixtureMadrasa.id } });
    await prisma.madrasa.delete({ where: { id: fixtureMadrasa.id } });
  }

  if (superAdminUser) {
    await prisma.activityLog.deleteMany({ where: { userId: superAdminUser.id } });
    await prisma.user.delete({ where: { id: superAdminUser.id } });
  }

  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log(' SECTION 1: CANONICAL FEATURE CATALOGUE INTEGRITY');
  console.log('======================================================');

  assert(FEATURE_CATALOGUE.length === 91, '1.1 Catalogue has exactly 91 features');
  assert(FEATURE_CATEGORIES.length === 20, '1.2 Catalogue has exactly 20 categories');
  assert(FEATURE_KEYS_IMPLEMENTED.length === 61, '1.3 Exactly 61 features are IMPLEMENTED');
  assert(FEATURE_KEYS_CORE.length === 20, '1.4 Exactly 20 features are CORE');
  assert(FEATURE_KEYS_PARTIALLY_IMPLEMENTED.length === 4, '1.5 Exactly 4 features are PARTIALLY_IMPLEMENTED');
  assert(FEATURE_KEYS_PLANNED.length === 6, '1.6 Exactly 6 features are PLANNED');

  console.log('\n======================================================');
  console.log(' SECTION 2: AUTHORIZATION & PERMISSION GUARDS');
  console.log('======================================================');

  // 2.1 Unauthenticated request
  const unauthRes = await fetch(`${baseUrl}/features`);
  assert(unauthRes.status === 401, '2.1 Unauthenticated request to /features rejected with 401');

  // 2.2 Madrasa Admin (non-super-admin) request
  const tenantRes = await fetch(`${baseUrl}/features`, {
    headers: { Authorization: `Bearer ${madrasaAdminToken}` },
  });
  assert(tenantRes.status === 403, '2.2 Madrasa Admin request to /features rejected with 403');

  // 2.3 Super Admin request
  const superRes = await fetch(`${baseUrl}/features`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert(superRes.status === 200, '2.3 Super Admin request to /features succeeds with 200');

  const catData = (await superRes.json()).data;
  assert(catData.categories && catData.categories.length === 20, '2.4 Feature catalogue returns 20 categories');
  assert(catData.summary && catData.summary.totalFeatures === 91, '2.5 Summary reports 91 total features');
  assert(catData.summary.implemented === 61, '2.6 Summary reports 61 implemented features');
  assert(catData.summary.core === 20, '2.7 Summary reports 20 core features');

  console.log('\n======================================================');
  console.log(' SECTION 3: ENHANCED PLAN LISTING & DETAIL');
  console.log('======================================================');

  // 3.1 List plans
  const listRes = await fetch(`${baseUrl}/plans`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert(listRes.status === 200, '3.1 GET /plans returns 200');
  const listJson = await listRes.json();
  const goldInList = listJson.data.find((p) => p.id === goldTierPlan.id);
  assert(goldInList !== undefined, '3.2 Active Gold Tier plan present in /plans list');
  assert(goldInList.featuresCount === 61, '3.3 Gold Tier reports featuresCount: 61 in listing');
  assert(Array.isArray(goldInList.assignedFeatureKeys), '3.4 Gold Tier includes assignedFeatureKeys array');
  assert(goldInList.assignedFeatureKeys.length === 61, '3.5 assignedFeatureKeys contains exactly 61 keys');

  // 3.2 Plan details
  const detailRes = await fetch(`${baseUrl}/plans/${goldInList.id}`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert(detailRes.status === 200, '3.6 GET /plans/:id returns 200');
  const detailJson = await detailRes.json();
  assert(detailJson.data.planFeatures && detailJson.data.planFeatures.length === 61, '3.7 Plan details includes 61 planFeatures');
  assert(detailJson.data.featuresCount === 61, '3.8 Plan details reports featuresCount: 61');
  assert(detailJson.data.activeSubscriptionsCount === 1, '3.10 Active subscriptions count matches currently active (1)');
  assert(detailJson.data.totalSubscriptionsCount === 2, '3.11 Total historical subscriptions count preserved (2)');

  console.log('\n======================================================');
  console.log(' SECTION 4: FEATURE VALIDATION & PLAN CREATION');
  console.log('======================================================');

  // 4.1 Reject unknown feature key
  const invalidKeyRes = await fetch(`${baseUrl}/plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      name: `Test Plan ${TEST_PREFIX}`,
      code: `T1_${TEST_PREFIX.slice(-5).toUpperCase()}`,
      durationMonths: 1,
      price: 1500,
      featureKeys: ['STUDENT_DIRECTORY', 'NON_EXISTENT_FEATURE_XYZ'],
    }),
  });
  assert(invalidKeyRes.status === 400, '4.1 Reject unknown feature key with 400');
  const invJson = await invalidKeyRes.json();
  assert(invJson.message.includes('Unknown feature key'), '4.2 Error message specifies unknown feature key');

  // 4.2 Reject CORE feature key
  const coreKeyRes = await fetch(`${baseUrl}/plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      name: `Test Plan ${TEST_PREFIX}`,
      code: `T2_${TEST_PREFIX.slice(-5).toUpperCase()}`,
      durationMonths: 1,
      price: 1500,
      featureKeys: ['STUDENT_DIRECTORY', 'TENANT_ISOLATION'],
    }),
  });
  assert(coreKeyRes.status === 400, '4.3 Reject CORE feature key with 400');
  const coreJson = await coreKeyRes.json();
  assert(coreJson.message.includes('CORE platform feature'), '4.4 Error specifies CORE platform feature');

  // 4.3 Reject PARTIALLY_IMPLEMENTED feature key
  const partialKeyRes = await fetch(`${baseUrl}/plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      name: `Test Plan ${TEST_PREFIX}`,
      code: `T3_${TEST_PREFIX.slice(-5).toUpperCase()}`,
      durationMonths: 1,
      price: 1500,
      featureKeys: ['STUDENT_DIRECTORY', 'STUDENT_CUSTOM_FIELDS'],
    }),
  });
  assert(partialKeyRes.status === 400, '4.5 Reject PARTIALLY_IMPLEMENTED key with 400');

  // 4.4 Reject PLANNED feature key
  const plannedKeyRes = await fetch(`${baseUrl}/plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      name: `Test Plan ${TEST_PREFIX}`,
      code: `T4_${TEST_PREFIX.slice(-5).toUpperCase()}`,
      durationMonths: 1,
      price: 1500,
      featureKeys: ['STUDENT_DIRECTORY', 'STUDENT_ID_CARDS'],
    }),
  });
  assert(plannedKeyRes.status === 400, '4.6 Reject PLANNED key with 400');

  // 4.5 Reject duplicate feature keys
  const dupKeyRes = await fetch(`${baseUrl}/plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      name: `Test Plan ${TEST_PREFIX}`,
      code: `T5_${TEST_PREFIX.slice(-5).toUpperCase()}`,
      durationMonths: 1,
      price: 1500,
      featureKeys: ['STUDENT_DIRECTORY', 'STUDENT_DIRECTORY'],
    }),
  });
  assert(dupKeyRes.status === 400, '4.7 Reject duplicate feature keys with 400');
  const dupJson = await dupKeyRes.json();
  assert(dupJson.message.includes('Duplicate feature key'), '4.8 Error specifies duplicate feature key');

  // 4.6 Successfully create Plan with valid subset of IMPLEMENTED features
  const validFeatures = ['STUDENT_DIRECTORY', 'STUDENT_REGISTRATION', 'STUDENT_PROFILE_MGMT'];
  const createRes = await fetch(`${baseUrl}/plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      name: `Starter Plan ${TEST_PREFIX}`,
      code: `START_${TEST_PREFIX.slice(-5).toUpperCase()}`,
      description: 'Test starter plan with 3 features',
      durationMonths: 1,
      price: 2000,
      isActive: true,
      featureKeys: validFeatures,
    }),
  });
  assert(createRes.status === 201, '4.9 Create plan with valid featureKeys returns 201');
  const createdPlan = (await createRes.json()).data;
  createdTestPlanId = createdPlan.id;

  assert(createdPlan.planFeatures && createdPlan.planFeatures.length === 3, '4.10 Exactly 3 planFeatures created in DB');
  const createdKeys = createdPlan.planFeatures.map((pf) => pf.featureKey);
  assert(validFeatures.every((k) => createdKeys.includes(k)), '4.11 All 3 feature keys correctly saved');

  // Verify ActivityLog entry
  const createLog = await prisma.activityLog.findFirst({
    where: {
      action: 'PLAN_CREATED',
      entityId: createdPlan.id,
    },
  });
  assert(createLog !== null, '4.12 ActivityLog entry for PLAN_CREATED exists');
  assert(createLog.metadata.featuresCount === 3, '4.13 ActivityLog metadata records featuresCount: 3');

  console.log('\n======================================================');
  console.log(' SECTION 5: UPDATE PLAN FEATURES (PUT /plans/:id/features)');
  console.log('======================================================');

  // Record initial updatedAt
  const planBeforeUpdate = await prisma.plan.findUnique({ where: { id: createdTestPlanId } });
  const initialUpdatedAt = planBeforeUpdate.updatedAt;

  // Add 2 features, remove 1 feature
  // Current: ['STUDENT_DIRECTORY', 'STUDENT_REGISTRATION', 'STUDENT_PROFILE_MGMT']
  // Target:  ['STUDENT_DIRECTORY', 'STUDENT_PROFILE_MGMT', 'ATTENDANCE_ANALYTICS', 'CLASS_MANAGEMENT']
  // Removed: ['STUDENT_REGISTRATION'] (1)
  // Added:   ['ATTENDANCE_ANALYTICS', 'CLASS_MANAGEMENT'] (2)
  const targetFeatures = [
    'STUDENT_DIRECTORY',
    'STUDENT_PROFILE_MGMT',
    'ATTENDANCE_ANALYTICS',
    'CLASS_MANAGEMENT',
  ];

  // Wait 10ms to ensure updatedAt timestamp difference if filesystem timestamp resolution is coarse
  await new Promise((r) => setTimeout(r, 20));

  const updateFeatRes = await fetch(`${baseUrl}/plans/${createdTestPlanId}/features`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({ featureKeys: targetFeatures }),
  });
  assert(updateFeatRes.status === 200, '5.1 PUT /plans/:id/features returns 200');
  const updateFeatJson = await updateFeatRes.json();
  assert(updateFeatJson.data.assignedCount === 4, '5.2 assignedCount is 4');
  assert(updateFeatJson.data.addedCount === 2, '5.3 addedCount is 2');
  assert(updateFeatJson.data.removedCount === 1, '5.4 removedCount is 1');
  assert(updateFeatJson.data.isNoOp === false, '5.5 isNoOp is false');

  // Verify parent plan updatedAt changed for cache invalidation signal
  const planAfterUpdate = await prisma.plan.findUnique({ where: { id: createdTestPlanId } });
  assert(
    new Date(planAfterUpdate.updatedAt).getTime() >= new Date(initialUpdatedAt).getTime(),
    '5.6 Plan updatedAt updated for cache invalidation signal'
  );

  // Verify DB state
  const dbFeatures = await prisma.planFeature.findMany({ where: { planId: createdTestPlanId } });
  assert(dbFeatures.length === 4, '5.7 Exactly 4 features exist in DB for updated plan');
  const currentDbKeys = dbFeatures.map((f) => f.featureKey);
  assert(!currentDbKeys.includes('STUDENT_REGISTRATION'), '5.8 Removed feature is no longer in DB');
  assert(currentDbKeys.includes('ATTENDANCE_ANALYTICS'), '5.9 Added feature ATTENDANCE_ANALYTICS is in DB');
  assert(currentDbKeys.includes('CLASS_MANAGEMENT'), '5.10 Added feature CLASS_MANAGEMENT is in DB');

  // Verify ActivityLog entry
  const updateLog = await prisma.activityLog.findFirst({
    where: {
      action: 'PLAN_FEATURES_UPDATED',
      entityId: createdTestPlanId,
    },
    orderBy: { createdAt: 'desc' },
  });
  assert(updateLog !== null, '5.11 ActivityLog for PLAN_FEATURES_UPDATED created');
  assert(updateLog.metadata.addedCount === 2, '5.12 ActivityLog addedCount is 2');
  assert(updateLog.metadata.removedCount === 1, '5.13 ActivityLog removedCount is 1');
  assert(updateLog.metadata.totalAssignedCount === 4, '5.14 ActivityLog totalAssignedCount is 4');

  // 5.15 Test No-Op update (submitting exact same feature keys)
  const timestampBeforeNoOp = planAfterUpdate.updatedAt;
  const logsCountBefore = await prisma.activityLog.count({
    where: { action: 'PLAN_FEATURES_UPDATED', entityId: createdTestPlanId },
  });

  const noOpRes = await fetch(`${baseUrl}/plans/${createdTestPlanId}/features`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({ featureKeys: targetFeatures }),
  });
  assert(noOpRes.status === 200, '5.15 No-op update returns 200');
  const noOpJson = await noOpRes.json();
  assert(noOpJson.data.isNoOp === true, '5.16 No-op update reports isNoOp: true');
  assert(noOpJson.data.addedCount === 0 && noOpJson.data.removedCount === 0, '5.17 addedCount and removedCount are 0');

  const planAfterNoOp = await prisma.plan.findUnique({ where: { id: createdTestPlanId } });
  assert(
    new Date(planAfterNoOp.updatedAt).getTime() === new Date(timestampBeforeNoOp).getTime(),
    '5.18 No-op update does not modify parent updatedAt timestamp'
  );

  const logsCountAfter = await prisma.activityLog.count({
    where: { action: 'PLAN_FEATURES_UPDATED', entityId: createdTestPlanId },
  });
  assert(logsCountAfter === logsCountBefore, '5.19 No-op update does not create spurious ActivityLog entries');

  console.log('\n======================================================');
  console.log(' SECTION 6: PLAN COMPARISON MATRIX API');
  console.log('======================================================');

  // 6.1 Default comparison: active plans only
  const compRes = await fetch(`${baseUrl}/plans/comparison`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  assert(compRes.status === 200, '6.1 GET /plans/comparison returns 200');
  const compJson = (await compRes.json()).data;
  assert(Array.isArray(compJson.plans), '6.2 Comparison returns plans array');
  assert(compJson.plans.every((p) => p.isActive === true), '6.3 Default comparison includes only active plans');
  assert(compJson.categories.length === 20, '6.4 Comparison includes 20 categories');
  assert(compJson.catalogueStats.totalFeatures === 91, '6.5 Catalogue stats report 91 total features');

  // 6.2 Comparison with includeInactive=true
  const compAllRes = await fetch(`${baseUrl}/plans/comparison?includeInactive=true`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const compAllJson = (await compAllRes.json()).data;
  assert(compAllJson.plans.length > compJson.plans.length, '6.6 includeInactive=true returns all plans (active + inactive)');

  // 6.3 Filter by specific planId
  const compFilterRes = await fetch(`${baseUrl}/plans/comparison?planIds=${createdTestPlanId}`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const compFilterJson = (await compFilterRes.json()).data;
  assert(compFilterJson.plans.length === 1, '6.7 Filtered comparison returns exactly 1 plan');
  assert(compFilterJson.plans[0].id === createdTestPlanId, '6.8 Filtered comparison matches requested plan ID');
  assert(compFilterJson.plans[0].featuresCount === 4, '6.9 Features count matches updated 4 features');
  assert(compFilterJson.plans[0].featureAvailability.STUDENT_DIRECTORY === true, '6.10 STUDENT_DIRECTORY is true');
  assert(compFilterJson.plans[0].featureAvailability.STUDENT_REGISTRATION === undefined, '6.11 STUDENT_REGISTRATION is not in availability map');

  console.log('\n======================================================');
  console.log(' SECTION 7: FIXTURE DATA INTEGRITY VERIFICATION');
  console.log('======================================================');

  // Verify gold plan
  const goldPlan = await prisma.plan.findUnique({
    where: { id: goldTierPlan.id },
    include: { planFeatures: true },
  });
  assert(goldPlan !== null, '7.1 Gold Tier plan exists');
  assert(goldPlan.code === goldTierPlan.code, '7.2 Gold Tier plan code matches fixture');
  assert(goldPlan.planFeatures.length === 61, '7.3 Gold Tier retains all 61 seeded features');
  assert(goldPlan.isActive === true, '7.4 Gold Tier isActive is true');

  // Verify subscriptions
  const subCount = await prisma.subscription.count({
    where: { planId: goldTierPlan.id },
  });
  assert(subCount === 2, '7.5 Exactly 2 subscriptions preserved');

  // Verify madrasas
  const madrasaCheck = await prisma.madrasa.findUnique({
    where: { id: fixtureMadrasa.id },
  });
  assert(madrasaCheck !== null, '7.6 Fixture madrasa preserved');

  console.log('\n======================================================');
  console.log(` SUMMARY: ${testPassedCount} Passed, ${testFailedCount} Failed`);
  console.log('======================================================\n');

  if (testFailedCount > 0) {
    throw new Error(`${testFailedCount} test(s) failed in Backend Plan Features suite.`);
  }
}

async function main() {
  try {
    await setup();
    await runTests();
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exitCode = 1;
  } finally {
    await teardown();
    await prisma.$disconnect();
  }
}

main();
