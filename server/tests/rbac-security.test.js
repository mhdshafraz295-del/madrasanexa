/**
 * MadrasaNexa – Phase 2 Role-Based Access Control (RBAC) & Tenant Security Test Suite
 *
 * Scope: 52 Test Cases across 10 Distinct Functional & Security Groups (Groups A through J).
 * Safety Architecture:
 * - Fail-closed preflight database gate targeting exclusively `madrasanexa_test`.
 * - In-memory Exact-ID fixture tracking across 24 foreign-key dependent collections.
 * - Strict reverse foreign-key teardown executed in an unavoidable finally block.
 * - Complete in-memory external service mocks (Email, SMS, Cloudflare R2 Storage).
 * - Distinct result classification for policy-compliant PASS, KNOWN_SECURITY_GAP, and DOCUMENTED_LIMITATION.
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
import { enableTestMode, clearTestEmails, getTestEmails } from '../src/services/email.service.js';
import { clearSentSmsMessages, getSentSmsMessages } from '../src/services/sms.service.js';
import { setTestStorageAdapter } from '../src/services/r2.service.js';

// Unique test run identifier to namespace all created fixture data
const RUN_ID = `p2_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

// Result classification constants
export const RESULT_STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  KNOWN_SECURITY_GAP: 'KNOWN_SECURITY_GAP',
  DOCUMENTED_LIMITATION: 'DOCUMENTED_LIMITATION',
};

// ============================================================================
// 1. EXACT-ID FIXTURE REGISTRY (24 Collections in Dependency Hierarchy)
// ============================================================================
export const createdFixtureIds = {
  receipts: [],
  payments: [],
  invoices: [],
  interviewAppointments: [],
  interviewSchedules: [],
  studentApplications: [],
  attendanceRecords: [],
  attendanceSessions: [],
  studentQualifications: [],
  alumniProfiles: [],
  students: [],
  admissionPeriods: [],
  markingAssessments: [],
  ustadhSalaries: [],
  ustadhs: [],
  classes: [],
  madrasaFeatureOverrides: [],
  subscriptions: [],
  planFeatures: [],
  plans: [],
  users: [],
  notificationJobs: [],
  fileObjects: [],
  madrasaProfiles: [],
  madrasas: [],
};

export function registerFixture(collection, id) {
  if (createdFixtureIds[collection] && id) {
    if (!createdFixtureIds[collection].includes(id)) {
      createdFixtureIds[collection].push(id);
    }
  }
}

// Test metrics tracking
let testPassedCount = 0;
let testGapCount = 0;
let testLimitationCount = 0;
let testFailedCount = 0;
const testResults = [];

function recordTestResult(testId, name, status, detail = '') {
  testResults.push({ testId, name, status, detail });
  switch (status) {
    case RESULT_STATUS.PASS:
      console.log(`  ✓ [PASS] [${testId}] ${name}`);
      testPassedCount++;
      break;
    case RESULT_STATUS.KNOWN_SECURITY_GAP:
      console.warn(`  ⚠ [KNOWN_SECURITY_GAP] [${testId}] ${name} - ${detail}`);
      testGapCount++;
      break;
    case RESULT_STATUS.DOCUMENTED_LIMITATION:
      console.info(`  ℹ [DOCUMENTED_LIMITATION] [${testId}] ${name} - ${detail}`);
      testLimitationCount++;
      break;
    default:
      console.error(`  ✗ [FAIL] [${testId}] ${name} - ${detail}`);
      testFailedCount++;
      break;
  }
}

// Server & Fixture References
let testServer = null;
let baseUrl = '';

// Shared Institutional & User Fixtures
let madrasaAlpha = null;
let madrasaBeta = null;
let madrasaSuspended = null;
let madrasaArchived = null;
let madrasaExpired = null;

let planStandard = null;
let planTierWithInterview = null;
let planTierWithoutInterview = null;

let userSuperAdmin = null;
let tokenSuperAdmin = '';

let userAdminAlpha = null;
let tokenAdminAlpha = '';

let userAdminBeta = null;
let tokenAdminBeta = '';

let userInactive = null;
let tokenInactive = '';

let userMustChangePassword = null;
let tokenMustChangePassword = '';

let userAdminExpired = null;
let tokenAdminExpired = '';

let userAdminSuspended = null;
let tokenAdminSuspended = '';

let userAdminArchived = null;
let tokenAdminArchived = '';

let classAlpha = null;
let classBeta = null;

let studentAlpha = null;
let studentBeta = null;

let admissionPeriodAlpha = null;
let admissionPeriodBeta = null;

let applicationAlpha = null;
let applicationBeta = null;

let scheduleAlpha = null;
let scheduleBeta = null;

let appointmentAlpha = null;
let appointmentBeta = null;

let invoiceAlpha = null;
let invoiceBeta = null;

let paymentAlpha = null;
let paymentBeta = null;

let receiptAlpha = null;
let receiptBeta = null;

let ustadhAlpha = null;
let ustadhBeta = null;

let salaryAlpha = null;
let salaryBeta = null;

let assessmentAlpha = null;
let assessmentBeta = null;

let alumniAlpha = null;
let alumniBeta = null;

let fileBeta = null;
let qualificationBeta = null;

// ============================================================================
// 2. PREFLIGHT SAFETY GATE & ENVIRONMENT INITIALIZATION
// ============================================================================
async function runPreflightSafetyGate() {
  console.log('\n======================================================');
  console.log(' PHASE 2 PREFLIGHT SAFETY VERIFICATION GATE');
  console.log('======================================================');

  // 1. Environment mode checks
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`PREFLIGHT ABORT: NODE_ENV is "${process.env.NODE_ENV}", must strictly be "test".`);
  }
  if (process.env.MOCK_SMS !== 'true') {
    throw new Error(`PREFLIGHT ABORT: MOCK_SMS is "${process.env.MOCK_SMS}", must strictly be "true".`);
  }
  if (process.env.EMAIL_PROVIDER !== 'test') {
    throw new Error(`PREFLIGHT ABORT: EMAIL_PROVIDER is "${process.env.EMAIL_PROVIDER}", must strictly be "test".`);
  }

  // 2. Direct MySQL Connection Target Verification
  const [activeDb] = await prisma.$queryRawUnsafe('SELECT DATABASE() AS current_db');
  if (!activeDb || activeDb.current_db !== 'madrasanexa_test') {
    throw new Error(
      `FATAL DATABASE ISOLATION ABORT: Active MySQL connection resolved to "${activeDb?.current_db}". Expected "madrasanexa_test". Aborting!`
    );
  }

  // 3. Process Environment URI Verification
  const testDbUrl = process.env.DATABASE_TEST_URL || env.DATABASE_TEST_URL || '';
  if (!testDbUrl.includes('madrasanexa_test')) {
    throw new Error('FATAL DATABASE ISOLATION ABORT: DATABASE_TEST_URL does not target "madrasanexa_test".');
  }

  // 4. In-Memory Mock Services Activation
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

  console.log('✓ Preflight Check Passed: Connected exclusively to "madrasanexa_test". All external service mocks active.\n');
}

// ============================================================================
// 3. FAIL-VISIBLE REVERSE-FK TEARDOWN PROTOCOL
// ============================================================================
export async function teardownExactFixtures() {
  console.log('\n======================================================');
  console.log(' TEARDOWN: PURGING FIXTURES IN REVERSE FOREIGN-KEY ORDER');
  console.log('======================================================');

  const unremovedIds = {};
  const cleanupErrors = [];

  const safeDelete = async (stepName, modelDelegate, idArray) => {
    if (!idArray || idArray.length === 0) return;
    try {
      await modelDelegate.deleteMany({
        where: { id: { in: idArray } },
      });
      idArray.length = 0;
    } catch (err) {
      unremovedIds[stepName] = [...idArray];
      cleanupErrors.push({ step: stepName, error: err.message });
      console.error(`  ✗ Teardown error on [${stepName}]:`, err.message);
    }
  };

  try {
    // 1. Receipts (foreign keys to payments and invoices)
    await safeDelete('receipts', prisma.receipt, createdFixtureIds.receipts);

    // 2. Payments (foreign keys to invoices and students)
    await safeDelete('payments', prisma.payment, createdFixtureIds.payments);

    // 3. Invoices (foreign keys to students and madrasas)
    await safeDelete('invoices', prisma.invoice, createdFixtureIds.invoices);

    // 4. Interview Appointments (foreign keys to studentApplications & interviewSchedules)
    await safeDelete('interviewAppointments', prisma.interviewAppointment, createdFixtureIds.interviewAppointments);

    // 5. Interview Schedules (foreign keys to admissionPeriods & users)
    await safeDelete('interviewSchedules', prisma.interviewSchedule, createdFixtureIds.interviewSchedules);

    // 6. Student Applications (foreign keys to admissionPeriods & classes)
    await safeDelete('studentApplications', prisma.studentApplication, createdFixtureIds.studentApplications);

    // 7. Attendance Records (foreign keys to attendanceSessions & students)
    await safeDelete('attendanceRecords', prisma.attendanceRecord, createdFixtureIds.attendanceRecords);

    // 8. Attendance Sessions (foreign keys to classes & madrasas)
    await safeDelete('attendanceSessions', prisma.attendanceSession, createdFixtureIds.attendanceSessions);

    // 9. Student Qualifications (foreign keys to students, fileObjects, users, madrasas - Restrict)
    await safeDelete('studentQualifications', prisma.studentQualification, createdFixtureIds.studentQualifications);

    // 10. Alumni Profiles (foreign key to students - Restrict - and madrasas)
    await safeDelete('alumniProfiles', prisma.alumniProfile, createdFixtureIds.alumniProfiles);

    // 11. Students (foreign keys to classes & madrasas)
    await safeDelete('students', prisma.student, createdFixtureIds.students);

    // 12. Admission Periods (foreign key to madrasas)
    await safeDelete('admissionPeriods', prisma.admissionPeriod, createdFixtureIds.admissionPeriods);

    // 13. Marking Assessments (foreign keys to classes & madrasas)
    await safeDelete('markingAssessments', prisma.markingAssessment, createdFixtureIds.markingAssessments);

    // 14. Ustadh Salaries (foreign keys to ustadhs & madrasas)
    await safeDelete('ustadhSalaries', prisma.ustadhSalary, createdFixtureIds.ustadhSalaries);

    // 15. Ustadhs (foreign key to madrasas)
    await safeDelete('ustadhs', prisma.ustadh, createdFixtureIds.ustadhs);

    // 16. Classes (foreign key to madrasas)
    await safeDelete('classes', prisma.class, createdFixtureIds.classes);

    // 17. Madrasa Feature Overrides (foreign keys to madrasas & users)
    await safeDelete('madrasaFeatureOverrides', prisma.madrasaFeatureOverride, createdFixtureIds.madrasaFeatureOverrides);

    // 18. Subscriptions (foreign keys to madrasas & plans - Restrict)
    await safeDelete('subscriptions', prisma.subscription, createdFixtureIds.subscriptions);

    // 19. Plan Features (foreign key to plans - Cascade)
    await safeDelete('planFeatures', prisma.planFeature, createdFixtureIds.planFeatures);

    // 20. Plans (base catalog entity)
    await safeDelete('plans', prisma.plan, createdFixtureIds.plans);

    // 21. Users (foreign key to madrasas)
    await safeDelete('users', prisma.user, createdFixtureIds.users);

    // 22. Notification Jobs (foreign key to madrasas - Restrict)
    await safeDelete('notificationJobs', prisma.notificationJob, createdFixtureIds.notificationJobs);

    // 23. File Objects (foreign key to madrasas - SetNull)
    await safeDelete('fileObjects', prisma.fileObject, createdFixtureIds.fileObjects);

    // 23b. Madrasa Profiles (foreign key to madrasas - Cascade)
    await safeDelete('madrasaProfiles', prisma.madrasaProfile, createdFixtureIds.madrasaProfiles);

    // 24. Madrasas (root tenant records)
    await safeDelete('madrasas', prisma.madrasa, createdFixtureIds.madrasas);
  } finally {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }

    if (cleanupErrors.length > 0) {
      process.exitCode = 1;
      const errorMsg = `CRITICAL TEARDOWN FAILURE: Could not remove all created fixtures!\n${JSON.stringify({ unremovedIds, cleanupErrors }, null, 2)}`;
      throw new Error(errorMsg);
    }

    console.log('✓ Teardown Successful: 100% of created fixtures purged by exact ID. Pre-existing records preserved.\n');
  }
}

// ============================================================================
// 4. FIXTURE SETUP
// ============================================================================
async function setupFixtures() {
  console.log('--- Setting Up Isolated Test Fixtures in madrasanexa_test ---');

  // 1. Root Madrasa Entities
  madrasaAlpha = await prisma.madrasa.create({
    data: {
      code: `ALPHA_${RUN_ID}`,
      name: `Madrasa Alpha ${RUN_ID}`,
      slug: `alpha-${RUN_ID}`,
      status: 'ACTIVE',
    },
  });
  registerFixture('madrasas', madrasaAlpha.id);

  // Published portal profile for Madrasa Alpha (required for public CMS and admissions endpoints)
  const profileAlpha = await prisma.madrasaProfile.create({
    data: {
      madrasaId: madrasaAlpha.id,
      isPublished: true,
      publishedAt: new Date(),
      introduction: 'Welcome to Madrasa Alpha',
    },
  });
  registerFixture('madrasaProfiles', profileAlpha.id);

  madrasaBeta = await prisma.madrasa.create({
    data: {
      code: `BETA_${RUN_ID}`,
      name: `Madrasa Beta ${RUN_ID}`,
      slug: `beta-${RUN_ID}`,
      status: 'ACTIVE',
    },
  });
  registerFixture('madrasas', madrasaBeta.id);

  madrasaSuspended = await prisma.madrasa.create({
    data: {
      code: `SUSP_${RUN_ID}`,
      name: `Madrasa Suspended ${RUN_ID}`,
      slug: `susp-${RUN_ID}`,
      status: 'SUSPENDED',
    },
  });
  registerFixture('madrasas', madrasaSuspended.id);

  madrasaArchived = await prisma.madrasa.create({
    data: {
      code: `ARCH_${RUN_ID}`,
      name: `Madrasa Archived ${RUN_ID}`,
      slug: `arch-${RUN_ID}`,
      status: 'ARCHIVED',
    },
  });
  registerFixture('madrasas', madrasaArchived.id);

  madrasaExpired = await prisma.madrasa.create({
    data: {
      code: `EXP_${RUN_ID}`,
      name: `Madrasa Expired ${RUN_ID}`,
      slug: `exp-${RUN_ID}`,
      status: 'ACTIVE',
    },
  });
  registerFixture('madrasas', madrasaExpired.id);

  // 2. Plans & Features
  planStandard = await prisma.plan.create({
    data: {
      code: `PLAN_STD_${RUN_ID}`,
      name: `Standard Plan ${RUN_ID}`,
      durationMonths: 12,
      price: 1000.0,
      isActive: true,
    },
  });
  registerFixture('plans', planStandard.id);

  planTierWithInterview = await prisma.plan.create({
    data: {
      code: `PLAN_WITH_INT_${RUN_ID}`,
      name: `Plan With Interview ${RUN_ID}`,
      durationMonths: 12,
      price: 2500.0,
      isActive: true,
    },
  });
  registerFixture('plans', planTierWithInterview.id);

  const featInterview = await prisma.planFeature.create({
    data: {
      planId: planTierWithInterview.id,
      featureKey: 'ADMISSIONS_INTERVIEW',
      isEnabled: true,
    },
  });
  registerFixture('planFeatures', featInterview.id);

  planTierWithoutInterview = await prisma.plan.create({
    data: {
      code: `PLAN_NO_INT_${RUN_ID}`,
      name: `Plan Without Interview ${RUN_ID}`,
      durationMonths: 12,
      price: 800.0,
      isActive: true,
    },
  });
  registerFixture('plans', planTierWithoutInterview.id);

  // 3. Subscriptions
  const subAlpha = await prisma.subscription.create({
    data: {
      madrasaId: madrasaAlpha.id,
      planId: planTierWithInterview.id,
      status: 'ACTIVE',
      startsAt: new Date(Date.now() - 86400000 * 30),
      endsAt: new Date(Date.now() + 86400000 * 335),
      priceAtPurchase: 2500.0,
      durationMonthsAtPurchase: 12,
    },
  });
  registerFixture('subscriptions', subAlpha.id);

  const subBeta = await prisma.subscription.create({
    data: {
      madrasaId: madrasaBeta.id,
      planId: planStandard.id,
      status: 'ACTIVE',
      startsAt: new Date(Date.now() - 86400000 * 30),
      endsAt: new Date(Date.now() + 86400000 * 335),
      priceAtPurchase: 1000.0,
      durationMonthsAtPurchase: 12,
    },
  });
  registerFixture('subscriptions', subBeta.id);

  const subExpired = await prisma.subscription.create({
    data: {
      madrasaId: madrasaExpired.id,
      planId: planStandard.id,
      status: 'EXPIRED',
      startsAt: new Date(Date.now() - 86400000 * 400),
      endsAt: new Date(Date.now() - 86400000 * 35),
      priceAtPurchase: 1000.0,
      durationMonthsAtPurchase: 12,
    },
  });
  registerFixture('subscriptions', subExpired.id);

  // 4. Authenticated Users
  const defaultPwHash = await hashPassword('TestP@ssword123!');

  userSuperAdmin = await prisma.user.create({
    data: {
      name: `Super Admin ${RUN_ID}`,
      email: `super_${RUN_ID}@example.com`,
      passwordHash: defaultPwHash,
      role: 'SUPER_ADMIN',
      madrasaId: null,
      isActive: true,
      mustChangePassword: false,
    },
  });
  registerFixture('users', userSuperAdmin.id);
  tokenSuperAdmin = signAccessToken({ userId: userSuperAdmin.id, role: 'SUPER_ADMIN', madrasaId: null });

  userAdminAlpha = await prisma.user.create({
    data: {
      name: `Admin Alpha ${RUN_ID}`,
      email: `alpha_${RUN_ID}@example.com`,
      passwordHash: defaultPwHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaAlpha.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  registerFixture('users', userAdminAlpha.id);
  tokenAdminAlpha = signAccessToken({ userId: userAdminAlpha.id, role: 'MADRASA_ADMIN', madrasaId: madrasaAlpha.id });

  userAdminBeta = await prisma.user.create({
    data: {
      name: `Admin Beta ${RUN_ID}`,
      email: `beta_${RUN_ID}@example.com`,
      passwordHash: defaultPwHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaBeta.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  registerFixture('users', userAdminBeta.id);
  tokenAdminBeta = signAccessToken({ userId: userAdminBeta.id, role: 'MADRASA_ADMIN', madrasaId: madrasaBeta.id });

  userInactive = await prisma.user.create({
    data: {
      name: `Inactive Admin ${RUN_ID}`,
      email: `inactive_${RUN_ID}@example.com`,
      passwordHash: defaultPwHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaAlpha.id,
      isActive: false,
      mustChangePassword: false,
    },
  });
  registerFixture('users', userInactive.id);
  tokenInactive = signAccessToken({ userId: userInactive.id, role: 'MADRASA_ADMIN', madrasaId: madrasaAlpha.id });

  userMustChangePassword = await prisma.user.create({
    data: {
      name: `Change PW Admin ${RUN_ID}`,
      email: `changepw_${RUN_ID}@example.com`,
      passwordHash: defaultPwHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaAlpha.id,
      isActive: true,
      mustChangePassword: true,
    },
  });
  registerFixture('users', userMustChangePassword.id);
  tokenMustChangePassword = signAccessToken({ userId: userMustChangePassword.id, role: 'MADRASA_ADMIN', madrasaId: madrasaAlpha.id });

  userAdminExpired = await prisma.user.create({
    data: {
      name: `Admin Expired ${RUN_ID}`,
      email: `expired_${RUN_ID}@example.com`,
      passwordHash: defaultPwHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaExpired.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  registerFixture('users', userAdminExpired.id);
  tokenAdminExpired = signAccessToken({ userId: userAdminExpired.id, role: 'MADRASA_ADMIN', madrasaId: madrasaExpired.id });

  userAdminSuspended = await prisma.user.create({
    data: {
      name: `Admin Suspended ${RUN_ID}`,
      email: `suspended_${RUN_ID}@example.com`,
      passwordHash: defaultPwHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaSuspended.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  registerFixture('users', userAdminSuspended.id);
  tokenAdminSuspended = signAccessToken({ userId: userAdminSuspended.id, role: 'MADRASA_ADMIN', madrasaId: madrasaSuspended.id });

  userAdminArchived = await prisma.user.create({
    data: {
      name: `Admin Archived ${RUN_ID}`,
      email: `archived_${RUN_ID}@example.com`,
      passwordHash: defaultPwHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaArchived.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  registerFixture('users', userAdminArchived.id);
  tokenAdminArchived = signAccessToken({ userId: userAdminArchived.id, role: 'MADRASA_ADMIN', madrasaId: madrasaArchived.id });

  // 5. Classes & Students
  classAlpha = await prisma.class.create({
    data: {
      madrasaId: madrasaAlpha.id,
      name: `Class 1 Alpha ${RUN_ID}`,
      code: `C1A_${RUN_ID}`,
      defaultMonthlyFee: 500.00,
    },
  });
  registerFixture('classes', classAlpha.id);

  classBeta = await prisma.class.create({
    data: {
      madrasaId: madrasaBeta.id,
      name: `Class 1 Beta ${RUN_ID}`,
      code: `C1B_${RUN_ID}`,
      defaultMonthlyFee: 500.00,
    },
  });
  registerFixture('classes', classBeta.id);

  studentAlpha = await prisma.student.create({
    data: {
      madrasaId: madrasaAlpha.id,
      classId: classAlpha.id,
      admissionNo: `A-${RUN_ID}-01`,
      fullName: `Student Alpha ${RUN_ID}`,
      guardianName: `Guardian Alpha ${RUN_ID}`,
      admissionDate: new Date(),
    },
  });
  registerFixture('students', studentAlpha.id);

  studentBeta = await prisma.student.create({
    data: {
      madrasaId: madrasaBeta.id,
      classId: classBeta.id,
      admissionNo: `B-${RUN_ID}-01`,
      fullName: `Student Beta ${RUN_ID}`,
      guardianName: `Guardian Beta ${RUN_ID}`,
      admissionDate: new Date(),
    },
  });
  registerFixture('students', studentBeta.id);

  // 6. Admissions, Applications & Interviews
  admissionPeriodAlpha = await prisma.admissionPeriod.create({
    data: {
      madrasaId: madrasaAlpha.id,
      code: `PER_A_${RUN_ID}`,
      name: `Academic Year 2026 Alpha`,
      academicYear: 2026,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isOpen: true,
    },
  });
  registerFixture('admissionPeriods', admissionPeriodAlpha.id);

  admissionPeriodBeta = await prisma.admissionPeriod.create({
    data: {
      madrasaId: madrasaBeta.id,
      code: `PER_B_${RUN_ID}`,
      name: `Academic Year 2026 Beta`,
      academicYear: 2026,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isOpen: true,
    },
  });
  registerFixture('admissionPeriods', admissionPeriodBeta.id);

  applicationAlpha = await prisma.studentApplication.create({
    data: {
      madrasaId: madrasaAlpha.id,
      admissionPeriodId: admissionPeriodAlpha.id,
      applicationNo: `APP_A_${RUN_ID}`,
      applicantName: `Applicant Alpha ${RUN_ID}`,
      dateOfBirth: new Date('2015-05-15'),
      gender: 'MALE',
      guardianName: 'Guardian Alpha',
      guardianRelationship: 'Father',
      guardianPhone: '+94771112233',
      address: 'Colombo, Sri Lanka',
      status: 'PENDING',
    },
  });
  registerFixture('studentApplications', applicationAlpha.id);

  applicationBeta = await prisma.studentApplication.create({
    data: {
      madrasaId: madrasaBeta.id,
      admissionPeriodId: admissionPeriodBeta.id,
      applicationNo: `APP_B_${RUN_ID}`,
      applicantName: `Applicant Beta ${RUN_ID}`,
      dateOfBirth: new Date('2015-06-20'),
      gender: 'MALE',
      guardianName: 'Guardian Beta',
      guardianRelationship: 'Father',
      guardianPhone: '+94774445566',
      address: 'Kandy, Sri Lanka',
      status: 'PENDING',
    },
  });
  registerFixture('studentApplications', applicationBeta.id);

  scheduleAlpha = await prisma.interviewSchedule.create({
    data: {
      madrasaId: madrasaAlpha.id,
      admissionPeriodId: admissionPeriodAlpha.id,
      createdByUserId: userAdminAlpha.id,
      interviewRound: 'FIRST',
      schedulingMethod: 'SAME_TIME',
      title: `Interview Round 1 Alpha ${RUN_ID}`,
      interviewDate: new Date('2026-11-20'),
      defaultStartTime: '09:00',
      defaultEndTime: '12:00',
      venue: 'Main Hall Alpha',
    },
  });
  registerFixture('interviewSchedules', scheduleAlpha.id);

  scheduleBeta = await prisma.interviewSchedule.create({
    data: {
      madrasaId: madrasaBeta.id,
      admissionPeriodId: admissionPeriodBeta.id,
      createdByUserId: userAdminBeta.id,
      interviewRound: 'FIRST',
      schedulingMethod: 'SAME_TIME',
      title: `Interview Round 1 Beta ${RUN_ID}`,
      interviewDate: new Date('2026-11-21'),
      defaultStartTime: '09:00',
      defaultEndTime: '12:00',
      venue: 'Main Hall Beta',
    },
  });
  registerFixture('interviewSchedules', scheduleBeta.id);

  appointmentAlpha = await prisma.interviewAppointment.create({
    data: {
      madrasaId: madrasaAlpha.id,
      scheduleId: scheduleAlpha.id,
      applicationId: applicationAlpha.id,
      interviewRound: 'FIRST',
      invitationReference: `INV_A_${RUN_ID}`,
      interviewDate: new Date('2026-11-20'),
      startTime: '09:00',
      endTime: '09:30',
      venue: 'Main Hall Alpha',
      status: 'SCHEDULED',
      createdByUserId: userAdminAlpha.id,
    },
  });
  registerFixture('interviewAppointments', appointmentAlpha.id);

  appointmentBeta = await prisma.interviewAppointment.create({
    data: {
      madrasaId: madrasaBeta.id,
      scheduleId: scheduleBeta.id,
      applicationId: applicationBeta.id,
      interviewRound: 'FIRST',
      invitationReference: `INV_B_${RUN_ID}`,
      interviewDate: new Date('2026-11-21'),
      startTime: '09:00',
      endTime: '09:30',
      venue: 'Main Hall Beta',
      status: 'SCHEDULED',
      createdByUserId: userAdminBeta.id,
    },
  });
  registerFixture('interviewAppointments', appointmentBeta.id);

  // 7. Finance, Invoices, Payments & Receipts
  invoiceAlpha = await prisma.invoice.create({
    data: {
      madrasaId: madrasaAlpha.id,
      studentId: studentAlpha.id,
      invoiceNo: `INV_A_${RUN_ID}`,
      billingYear: 2026,
      billingMonth: 11,
      issueDate: new Date(),
      subtotal: 500.0,
      totalAmount: 500.0,
      balanceAmount: 0.0,
      paidAmount: 500.0,
      status: 'PAID',
    },
  });
  registerFixture('invoices', invoiceAlpha.id);

  invoiceBeta = await prisma.invoice.create({
    data: {
      madrasaId: madrasaBeta.id,
      studentId: studentBeta.id,
      invoiceNo: `INV_B_${RUN_ID}`,
      billingYear: 2026,
      billingMonth: 11,
      issueDate: new Date(),
      subtotal: 500.0,
      totalAmount: 500.0,
      balanceAmount: 0.0,
      paidAmount: 500.0,
      status: 'PAID',
    },
  });
  registerFixture('invoices', invoiceBeta.id);

  paymentAlpha = await prisma.payment.create({
    data: {
      madrasaId: madrasaAlpha.id,
      studentId: studentAlpha.id,
      paymentNo: `PAY_A_${RUN_ID}`,
      amount: 500.0,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
    },
  });
  registerFixture('payments', paymentAlpha.id);

  paymentBeta = await prisma.payment.create({
    data: {
      madrasaId: madrasaBeta.id,
      studentId: studentBeta.id,
      paymentNo: `PAY_B_${RUN_ID}`,
      amount: 500.0,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
    },
  });
  registerFixture('payments', paymentBeta.id);

  receiptAlpha = await prisma.receipt.create({
    data: {
      madrasaId: madrasaAlpha.id,
      paymentId: paymentAlpha.id,
      receiptNo: `REC_A_${RUN_ID}`,
      issuedAt: new Date(),
    },
  });
  registerFixture('receipts', receiptAlpha.id);

  receiptBeta = await prisma.receipt.create({
    data: {
      madrasaId: madrasaBeta.id,
      paymentId: paymentBeta.id,
      receiptNo: `REC_B_${RUN_ID}`,
      issuedAt: new Date(),
    },
  });
  registerFixture('receipts', receiptBeta.id);

  // 8. Staff (Ustadh) & Salaries
  ustadhAlpha = await prisma.ustadh.create({
    data: {
      madrasaId: madrasaAlpha.id,
      ustadhCode: `UST_A_${RUN_ID}`,
      fullName: `Ustadh Alpha ${RUN_ID}`,
      phoneNumber: '+94770001111',
      joinDate: new Date('2025-01-01'),
      baseMonthlySalary: 15000.00,
    },
  });
  registerFixture('ustadhs', ustadhAlpha.id);

  ustadhBeta = await prisma.ustadh.create({
    data: {
      madrasaId: madrasaBeta.id,
      ustadhCode: `UST_B_${RUN_ID}`,
      fullName: `Ustadh Beta ${RUN_ID}`,
      phoneNumber: '+94770002222',
      joinDate: new Date('2025-01-01'),
      baseMonthlySalary: 15000.00,
    },
  });
  registerFixture('ustadhs', ustadhBeta.id);

  salaryAlpha = await prisma.ustadhSalary.create({
    data: {
      madrasaId: madrasaAlpha.id,
      ustadhId: ustadhAlpha.id,
      salaryMonth: new Date('2026-11-01'),
      baseSalarySnapshot: 15000.0,
      payableAmount: 15000.0,
      status: 'PAID',
    },
  });
  registerFixture('ustadhSalaries', salaryAlpha.id);

  salaryBeta = await prisma.ustadhSalary.create({
    data: {
      madrasaId: madrasaBeta.id,
      ustadhId: ustadhBeta.id,
      salaryMonth: new Date('2026-11-01'),
      baseSalarySnapshot: 15000.0,
      payableAmount: 15000.0,
      status: 'PAID',
    },
  });
  registerFixture('ustadhSalaries', salaryBeta.id);

  // 9. Marking Assessments
  assessmentAlpha = await prisma.markingAssessment.create({
    data: {
      madrasaId: madrasaAlpha.id,
      classId: classAlpha.id,
      name: `Term 1 Assessment Alpha ${RUN_ID}`,
      term: 'Term 1',
      academicYear: '2026',
      status: 'DRAFT',
    },
  });
  registerFixture('markingAssessments', assessmentAlpha.id);

  assessmentBeta = await prisma.markingAssessment.create({
    data: {
      madrasaId: madrasaBeta.id,
      classId: classBeta.id,
      name: `Term 1 Assessment Beta ${RUN_ID}`,
      term: 'Term 1',
      academicYear: '2026',
      status: 'DRAFT',
    },
  });
  registerFixture('markingAssessments', assessmentBeta.id);

  // 10. Alumni Network Profiles
  alumniAlpha = await prisma.alumniProfile.create({
    data: {
      madrasaId: madrasaAlpha.id,
      studentId: studentAlpha.id,
      alumniIndexNumber: `ALM_A_${RUN_ID}`,
      admissionDate: new Date('2020-01-01'),
      leavingDate: new Date('2025-12-31'),
    },
  });
  registerFixture('alumniProfiles', alumniAlpha.id);

  alumniBeta = await prisma.alumniProfile.create({
    data: {
      madrasaId: madrasaBeta.id,
      studentId: studentBeta.id,
      alumniIndexNumber: `ALM_B_${RUN_ID}`,
      admissionDate: new Date('2020-01-01'),
      leavingDate: new Date('2025-12-31'),
    },
  });
  registerFixture('alumniProfiles', alumniBeta.id);

  // Real qualification & certificate file fixture for studentBeta (used by TC-FILE-05)
  fileBeta = await prisma.fileObject.create({
    data: {
      madrasaId: madrasaBeta.id,
      type: 'STUDENT_DOCUMENT',
      objectKey: `beta_cert_${RUN_ID}.pdf`,
      originalName: 'certificate.pdf',
      mimeType: 'application/pdf',
      size: 1024,
    },
  });
  registerFixture('fileObjects', fileBeta.id);

  qualificationBeta = await prisma.studentQualification.create({
    data: {
      madrasaId: madrasaBeta.id,
      studentId: studentBeta.id,
      title: `Beta Qualification ${RUN_ID}`,
      createdByUserId: userAdminBeta.id,
      certificateFileId: fileBeta.id,
      verificationStatus: 'PENDING',
    },
  });
  registerFixture('studentQualifications', qualificationBeta.id);

  // 11. Start Test Server on dynamic ephemeral port
  testServer = http.createServer(app);
  await new Promise((resolve) => {
    testServer.listen(0, '127.0.0.1', () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });

  console.log(`✓ All Fixtures Initialized. Ephemeral Test Server active at ${baseUrl}\n`);
}

// ============================================================================
// 5. THE 52 TEST IMPLEMENTATIONS (GROUPS A THROUGH J)
// ============================================================================

export async function runGroupA_Authentication() {
  console.log('\n--- Group A: Core Authentication & Token Lifecycle (10 Tests) ---');

  // TC-AUTH-01: Valid Madrasa Admin login
  try {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userAdminAlpha.email, password: 'TestP@ssword123!' }),
    });
    const json = await res.json();
    const token = json.token || json.accessToken || json.data?.accessToken || json.data?.token;
    const ok = res.status === 200 && Boolean(token);
    recordTestResult('TC-AUTH-01', 'Valid Madrasa Admin login returns 200 and JWT', ok ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-AUTH-01', 'Valid Madrasa Admin login returns 200 and JWT', RESULT_STATUS.FAIL, err.message);
  }

  // TC-AUTH-02: Valid Super Admin login
  try {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userSuperAdmin.email, password: 'TestP@ssword123!' }),
    });
    const json = await res.json();
    const token = json.token || json.accessToken || json.data?.accessToken || json.data?.token;
    const ok = res.status === 200 && Boolean(token);
    recordTestResult('TC-AUTH-02', 'Valid Super Admin login returns 200 and JWT', ok ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-AUTH-02', 'Valid Super Admin login returns 200 and JWT', RESULT_STATUS.FAIL, err.message);
  }

  // TC-AUTH-03: Invalid password for existing user
  try {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userAdminAlpha.email, password: 'WrongPassword999!' }),
    });
    recordTestResult('TC-AUTH-03', 'Invalid password returns 401 Unauthorized', res.status === 401 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-AUTH-03', 'Invalid password returns 401 Unauthorized', RESULT_STATUS.FAIL, err.message);
  }

  // TC-AUTH-04: Non-existent user email
  try {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `nonexistent_${Date.now()}@example.com`, password: 'AnyPassword123!' }),
    });
    recordTestResult('TC-AUTH-04', 'Non-existent email returns 401 Unauthorized', res.status === 401 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-AUTH-04', 'Non-existent email returns 401 Unauthorized', RESULT_STATUS.FAIL, err.message);
  }

  // TC-AUTH-05: Missing Authorization header
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/profile`);
    recordTestResult('TC-AUTH-05', 'Missing Authorization header returns 401 Unauthorized', res.status === 401 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-AUTH-05', 'Missing Authorization header returns 401 Unauthorized', RESULT_STATUS.FAIL, err.message);
  }

  // TC-AUTH-06: Malformed Authorization header
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/profile`, {
      headers: { Authorization: 'Bearer this.is.malformed' },
    });
    recordTestResult('TC-AUTH-06', 'Malformed Authorization token returns 401 Unauthorized', res.status === 401 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-AUTH-06', 'Malformed Authorization token returns 401 Unauthorized', RESULT_STATUS.FAIL, err.message);
  }

  // TC-AUTH-07: Expired JWT token
  try {
    const expiredToken = signAccessToken(
      { userId: userAdminAlpha.id, role: 'MADRASA_ADMIN', madrasaId: madrasaAlpha.id },
      { expiresIn: '-10s' }
    );
    const res = await fetch(`${baseUrl}/madrasa-admin/profile`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    recordTestResult('TC-AUTH-07', 'Expired JWT returns 401 Unauthorized', res.status === 401 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-AUTH-07', 'Expired JWT returns 401 Unauthorized', RESULT_STATUS.FAIL, err.message);
  }

  // TC-AUTH-08: JWT signed with wrong secret key
  try {
    const wrongSecretToken = jwt.sign(
      { userId: userAdminAlpha.id, role: 'MADRASA_ADMIN', madrasaId: madrasaAlpha.id },
      'completely-wrong-secret-key-at-least-32-chars-long!',
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    const res = await fetch(`${baseUrl}/madrasa-admin/profile`, {
      headers: { Authorization: `Bearer ${wrongSecretToken}` },
    });
    recordTestResult('TC-AUTH-08', 'Wrong secret JWT returns 401 Unauthorized', res.status === 401 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-AUTH-08', 'Wrong secret JWT returns 401 Unauthorized', RESULT_STATUS.FAIL, err.message);
  }

  // TC-AUTH-09: JWT signature stripped (alg: none)
  try {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ userId: userAdminAlpha.id, role: 'MADRASA_ADMIN', madrasaId: madrasaAlpha.id })).toString('base64url');
    const strippedToken = `${header}.${payload}.`;
    const res = await fetch(`${baseUrl}/madrasa-admin/profile`, {
      headers: { Authorization: `Bearer ${strippedToken}` },
    });
    recordTestResult('TC-AUTH-09', 'Stripped signature (alg: none) returns 401 Unauthorized', res.status === 401 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-AUTH-09', 'Stripped signature (alg: none) returns 401 Unauthorized', RESULT_STATUS.FAIL, err.message);
  }

  // TC-AUTH-10: Token role claim does not match DB role
  try {
    const mismatchedRoleToken = signAccessToken({ userId: userAdminAlpha.id, role: 'SUPER_ADMIN', madrasaId: null });
    const res = await fetch(`${baseUrl}/super-admin/dashboard`, {
      headers: { Authorization: `Bearer ${mismatchedRoleToken}` },
    });
    const isRejected = res.status === 401 || res.status === 403;
    recordTestResult('TC-AUTH-10', 'Role claim mismatch with DB record rejected (401/403)', isRejected ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-AUTH-10', 'Role claim mismatch with DB record rejected', RESULT_STATUS.FAIL, err.message);
  }
}

export async function runGroupB_Revocation() {
  console.log('\n--- Group B: Real-Time Revocation & JWT Invalidation (5 Tests) ---');

  // TC-REV-01: Valid JWT for user set to isActive: false
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/profile`, {
      headers: { Authorization: `Bearer ${tokenInactive}` },
    });
    recordTestResult('TC-REV-01', 'Inactive user JWT returns 403 Forbidden', res.status === 403 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-REV-01', 'Inactive user JWT returns 403 Forbidden', RESULT_STATUS.FAIL, err.message);
  }

  // TC-REV-02: User with mustChangePassword: true attempts business route
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/students`, {
      headers: { Authorization: `Bearer ${tokenMustChangePassword}` },
    });
    recordTestResult('TC-REV-02', 'mustChangePassword=true on business route returns 403 Forbidden', res.status === 403 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-REV-02', 'mustChangePassword=true on business route returns 403 Forbidden', RESULT_STATUS.FAIL, err.message);
  }

  // TC-REV-03: User with mustChangePassword: true accesses profile/status (exempt route)
  try {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenMustChangePassword}` },
    });
    recordTestResult('TC-REV-03', 'mustChangePassword=true accesses /auth/me returns 200 OK', res.status === 200 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-REV-03', 'mustChangePassword=true accesses /auth/me returns 200 OK', RESULT_STATUS.FAIL, err.message);
  }

  // TC-REV-04: User updates password via /api/auth/change-password
  // Directly verifies that passwordHash changed in DB and mustChangePassword became false
  try {
    const initialUser = await prisma.user.findUnique({
      where: { id: userMustChangePassword.id },
      select: { passwordHash: true, mustChangePassword: true },
    });

    const res = await fetch(`${baseUrl}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenMustChangePassword}`,
      },
      body: JSON.stringify({
        currentPassword: 'TestP@ssword123!',
        newPassword: 'BrandNewP@ssword2026!',
      }),
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: userMustChangePassword.id },
      select: { passwordHash: true, mustChangePassword: true },
    });

    const isHttpOk = res.status === 200;
    const isHashChanged = Boolean(initialUser && updatedUser && updatedUser.passwordHash !== initialUser.passwordHash);
    const isFlagCleared = Boolean(updatedUser && updatedUser.mustChangePassword === false);
    const passed = isHttpOk && isHashChanged && isFlagCleared;

    recordTestResult(
      'TC-REV-04',
      'Password change updates password hash in DB and clears mustChangePassword flag',
      passed ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL,
      `Status: ${res.status}, Hash changed: ${isHashChanged}, Flag cleared: ${isFlagCleared}`
    );
  } catch (err) {
    recordTestResult('TC-REV-04', 'Password change updates password and clears flag', RESULT_STATUS.FAIL, err.message);
  }

  // TC-REV-05: Old JWT used after password changed
  // Architecture Verification: Database-backed tokenVersion invalidates previously issued tokens on password change.
  // Result Classification Rules (Phase 3B):
  // - HTTP 401 on old token AND HTTP 200 on new login token: PASS
  // - HTTP 200 on old token: FAIL (Security vulnerability: old token not revoked)
  // - Other: FAIL
  try {
    // 1. Verify old token is rejected immediately with HTTP 401
    const resOld = await fetch(`${baseUrl}/madrasa-admin/profile`, {
      headers: { Authorization: `Bearer ${tokenMustChangePassword}` },
    });

    const isOldRevoked = resOld.status === 401;

    // 2. Verify new login with updated password succeeds and newly issued token works
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userMustChangePassword.email,
        password: 'BrandNewP@ssword2026!',
      }),
    });

    const loginJson = await loginRes.json();
    const newToken = loginJson.data?.accessToken;

    let isNewTokenValid = false;
    if (newToken) {
      const resNew = await fetch(`${baseUrl}/madrasa-admin/profile`, {
        headers: { Authorization: `Bearer ${newToken}` },
      });
      isNewTokenValid = resNew.status === 200;
    }

    if (isOldRevoked && isNewTokenValid) {
      recordTestResult(
        'TC-REV-05',
        'Old JWT rejected with 401 after password change and new login token accepted with 200 OK',
        RESULT_STATUS.PASS,
        `Old Token Status: ${resOld.status} (Revoked), New Token Status: 200 (Active)`
      );
    } else if (resOld.status === 200) {
      recordTestResult(
        'TC-REV-05',
        'Old JWT remained valid after password change',
        RESULT_STATUS.FAIL,
        `Status: ${resOld.status} (Security failure: old token was not invalidated)`
      );
    } else {
      recordTestResult(
        'TC-REV-05',
        'Old JWT after password change',
        RESULT_STATUS.FAIL,
        `Old Token Status: ${resOld.status}, New Token Valid: ${isNewTokenValid}`
      );
    }
  } catch (err) {
    recordTestResult('TC-REV-05', 'Old JWT after password change', RESULT_STATUS.FAIL, err.message);
  }
}

export async function runGroupC_RoleBoundary() {
  console.log('\n--- Group C: Role Boundary & Privilege Escalation (5 Tests) ---');

  // TC-ROLE-01: Madrasa Admin attempts Super Admin route
  try {
    const res = await fetch(`${baseUrl}/super-admin/dashboard`, {
      headers: { Authorization: `Bearer ${tokenAdminAlpha}` },
    });
    recordTestResult('TC-ROLE-01', 'Madrasa Admin on /super-admin/dashboard returns 403 Forbidden', res.status === 403 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-ROLE-01', 'Madrasa Admin on /super-admin/dashboard returns 403 Forbidden', RESULT_STATUS.FAIL, err.message);
  }

  // TC-ROLE-02: Madrasa Admin attempts creating a Madrasa / onboarding
  try {
    const res = await fetch(`${baseUrl}/super-admin/madrasas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminAlpha}`,
      },
      body: JSON.stringify({ name: 'Malicious Madrasa' }),
    });
    recordTestResult('TC-ROLE-02', 'Madrasa Admin on Super Admin POST returns 403 Forbidden', res.status === 403 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-ROLE-02', 'Madrasa Admin on Super Admin POST returns 403 Forbidden', RESULT_STATUS.FAIL, err.message);
  }

  // TC-ROLE-03: Madrasa Admin attempts status modification
  try {
    const res = await fetch(`${baseUrl}/super-admin/madrasas/${madrasaBeta.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminAlpha}`,
      },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    recordTestResult('TC-ROLE-03', 'Madrasa Admin on status patch returns 403 Forbidden', res.status === 403 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-ROLE-03', 'Madrasa Admin on status patch returns 403 Forbidden', RESULT_STATUS.FAIL, err.message);
  }

  // TC-ROLE-04: Madrasa Admin attempts Super Admin plan management
  try {
    const res = await fetch(`${baseUrl}/super-admin/plans`, {
      headers: { Authorization: `Bearer ${tokenAdminAlpha}` },
    });
    recordTestResult('TC-ROLE-04', 'Madrasa Admin on /super-admin/plans returns 403 Forbidden', res.status === 403 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-ROLE-04', 'Madrasa Admin on /super-admin/plans returns 403 Forbidden', RESULT_STATUS.FAIL, err.message);
  }

  // TC-ROLE-05: Super Admin calls Madrasa Admin route directly without tenant header
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/profile`, {
      headers: { Authorization: `Bearer ${tokenSuperAdmin}` },
    });
    recordTestResult('TC-ROLE-05', 'Super Admin direct call to madrasa-admin returns 403 Forbidden', res.status === 403 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-ROLE-05', 'Super Admin direct call to madrasa-admin returns 403 Forbidden', RESULT_STATUS.FAIL, err.message);
  }
}

export async function runGroupD_TenantIsolation() {
  console.log('\n--- Group D: Multi-Tenant Query & Mutation Isolation (6 Tests) ---');

  // TC-TEN-01: Admin Alpha queries student list -> returns ONLY Alpha students
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/students`, {
      headers: { Authorization: `Bearer ${tokenAdminAlpha}` },
    });
    const json = await res.json();
    const students = json.data?.students || json.data || [];
    // 1. Verify client DTO intentionally strips internal tenant foreign key madrasaId
    const dtoStripsMadrasaId = students.length > 0 && students.every((s) => s.madrasaId === undefined);
    // 2. Query database to confirm all returned student records belong strictly to madrasaAlpha
    const returnedIds = students.map((s) => s.id);
    const dbStudents = await prisma.student.findMany({
      where: { id: { in: returnedIds } },
      select: { id: true, madrasaId: true },
    });
    const hasOnlyAlpha = dbStudents.length > 0 && dbStudents.every((s) => s.madrasaId === madrasaAlpha.id) && !returnedIds.includes(studentBeta.id);
    const passed = res.status === 200 && dtoStripsMadrasaId && hasOnlyAlpha;
    recordTestResult('TC-TEN-01', 'Admin Alpha student list contains strictly Alpha students and strips internal madrasaId', passed ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Count: ${students.length}, Strips madrasaId: ${dtoStripsMadrasaId}, DB isolated: ${hasOnlyAlpha}`);
  } catch (err) {
    recordTestResult('TC-TEN-01', 'Admin Alpha student list contains strictly Alpha students', RESULT_STATUS.FAIL, err.message);
  }

  // TC-TEN-02: Admin Alpha direct GET on Beta student -> 404 Not Found
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/students/${studentBeta.id}`, {
      headers: { Authorization: `Bearer ${tokenAdminAlpha}` },
    });
    recordTestResult('TC-TEN-02', 'Admin Alpha GET on Beta student returns 404 Not Found', res.status === 404 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-TEN-02', 'Admin Alpha GET on Beta student returns 404 Not Found', RESULT_STATUS.FAIL, err.message);
  }

  // TC-TEN-03: Admin Alpha PATCH on Beta student -> 404 Not Found
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/students/${studentBeta.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminAlpha}`,
      },
      body: JSON.stringify({ fullName: 'Malicious Update' }),
    });
    recordTestResult('TC-TEN-03', 'Admin Alpha PATCH on Beta student returns 404 Not Found', res.status === 404 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-TEN-03', 'Admin Alpha PATCH on Beta student returns 404 Not Found', RESULT_STATUS.FAIL, err.message);
  }

  // TC-TEN-04: Admin Alpha DELETE on Beta student -> 404 Not Found
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/students/${studentBeta.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminAlpha}` },
    });
    recordTestResult('TC-TEN-04', 'Admin Alpha DELETE on Beta student returns 404 Not Found', res.status === 404 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-TEN-04', 'Admin Alpha DELETE on Beta student returns 404 Not Found', RESULT_STATUS.FAIL, err.message);
  }

  // TC-TEN-05: Admin Alpha supplies foreign madrasaId: beta in request body
  // Correction: Uses unique admission number to guarantee registration and validates persisted DB ownership
  try {
    const injectedAdmNo = `INJ_${RUN_ID}`;
    const res = await fetch(`${baseUrl}/madrasa-admin/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminAlpha}`,
      },
      body: JSON.stringify({
        fullName: `Injected Student ${RUN_ID}`,
        admissionNo: injectedAdmNo,
        guardianName: 'Injected Guardian',
        madrasaId: madrasaBeta.id, // Injected foreign tenant
      }),
    });

    // Locate created record directly in database by unique admissionNo regardless of API response shape
    const createdStudent = await prisma.student.findFirst({
      where: { admissionNo: injectedAdmNo },
    });
    if (createdStudent) {
      registerFixture('students', createdStudent.id);
    }

    const isHttpOk = res.status === 201;
    const isOwnerAlpha = createdStudent !== null && createdStudent.madrasaId === madrasaAlpha.id;
    const passed = isHttpOk && isOwnerAlpha;

    recordTestResult(
      'TC-TEN-05',
      'Supplied madrasaId in body is ignored; forced to authenticated tenant',
      passed ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL,
      `Status: ${res.status}, Persisted madrasaId: ${createdStudent?.madrasaId} (Expected: ${madrasaAlpha.id})`
    );
  } catch (err) {
    recordTestResult('TC-TEN-05', 'Supplied madrasaId in body is handled securely', RESULT_STATUS.FAIL, err.message);
  }

  // TC-TEN-06: Admin Alpha attempts mutating madrasaId to Beta on existing student
  // Correction: Validates BOTH the HTTP response (200) AND persisted DB ownership (madrasaAlpha)
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/students/${studentAlpha.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminAlpha}`,
      },
      body: JSON.stringify({ madrasaId: madrasaBeta.id, fullName: `Updated Alpha ${RUN_ID}` }),
    });

    const check = await prisma.student.findUnique({ where: { id: studentAlpha.id } });
    const isHttpOk = res.status === 200;
    const isOwnershipRetained = check !== null && check.madrasaId === madrasaAlpha.id;
    const passed = isHttpOk && isOwnershipRetained;

    recordTestResult(
      'TC-TEN-06',
      'Attempted tenant mutation in PATCH body is ignored; response is 200 and ownership retained',
      passed ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL,
      `Status: ${res.status}, Persisted madrasaId: ${check?.madrasaId} (Expected: ${madrasaAlpha.id})`
    );
  } catch (err) {
    recordTestResult('TC-TEN-06', 'Attempted tenant mutation in PATCH body is ignored', RESULT_STATUS.FAIL, err.message);
  }
}

export async function runGroupE_BulkOperations() {
  console.log('\n--- Group E: Cross-Tenant Bulk Operations & IDOR Defense (5 Tests) ---');

  // TC-BULK-01: Admin Alpha supplies Beta student IDs in attendance
  // Tracks AttendanceSession and AttendanceRecord independently: detects creations, modifications, and deletions
  try {
    const testDate = '2026-11-02';
    const targetDateObj = new Date('2026-11-02');

    // Separate global ID-only snapshot of existing AttendanceRecord IDs before request
    // Used to protect pre-existing records from teardown if moved across sessions
    const beforeAllAttendanceRecords = await prisma.attendanceRecord.findMany({
      select: { id: true },
    });
    const beforeAllAttendanceRecordIds = new Set(beforeAllAttendanceRecords.map((r) => r.id));

    // Independent before snapshot for AttendanceSessions
    const beforeSessions = await prisma.attendanceSession.findMany({
      where: { classId: classAlpha.id, attendanceDate: targetDateObj },
    });
    const beforeSessionIds = beforeSessions.map((s) => s.id);

    // Independent before snapshot for AttendanceRecords: covers studentBeta records
    // AND all existing records linked to targeted pre-existing attendance session IDs
    const beforeRecordsWhere = beforeSessionIds.length > 0
      ? { OR: [{ studentId: studentBeta.id }, { sessionId: { in: beforeSessionIds } }] }
      : { studentId: studentBeta.id };

    const beforeRecords = await prisma.attendanceRecord.findMany({
      where: beforeRecordsWhere,
    });

    const res = await fetch(`${baseUrl}/madrasa-admin/attendance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminAlpha}`,
      },
      body: JSON.stringify({
        classId: classAlpha.id,
        academicYear: '2026',
        date: testDate,
        records: [{ studentId: studentBeta.id, status: 'PRESENT' }],
      }),
    });

    // Independent after snapshot for AttendanceSessions
    const afterSessions = await prisma.attendanceSession.findMany({
      where: { classId: classAlpha.id, attendanceDate: targetDateObj },
    });

    // 1. Newly created sessions
    const newSessions = afterSessions.filter((as) => !beforeSessions.some((bs) => bs.id === as.id));
    for (const s of newSessions) {
      registerFixture('attendanceSessions', s.id);
    }

    // 2. Disappeared / deleted sessions
    const deletedSessions = beforeSessions.filter((bs) => !afterSessions.some((as) => as.id === bs.id));

    // 3. Modified existing sessions
    const modifiedSessions = beforeSessions.filter((bs) => {
      const match = afterSessions.find((as) => as.id === bs.id);
      return match && JSON.stringify(match) !== JSON.stringify(bs);
    });

    // Union of pre-request and post-request targeted session IDs
    const allSessionIds = Array.from(new Set([...beforeSessions.map((s) => s.id), ...afterSessions.map((s) => s.id)]));

    // Independent after snapshot for AttendanceRecords: covers studentBeta records
    // AND all records linked to the union of pre-request and post-request targeted session IDs
    const afterRecordsWhere = allSessionIds.length > 0
      ? { OR: [{ studentId: studentBeta.id }, { sessionId: { in: allSessionIds } }] }
      : { studentId: studentBeta.id };

    const afterRecords = await prisma.attendanceRecord.findMany({
      where: afterRecordsWhere,
    });

    // 1. Newly created attendance records (scoped detection)
    const newRecords = afterRecords.filter((ar) => !beforeRecords.some((br) => br.id === ar.id));

    // Genuinely created records check: only register IDs that did not exist anywhere before request
    const genuinelyCreatedRecords = newRecords.filter((r) => !beforeAllAttendanceRecordIds.has(r.id));
    for (const r of genuinelyCreatedRecords) {
      registerFixture('attendanceRecords', r.id);
      if (r.sessionId && newSessions.some((s) => s.id === r.sessionId)) {
        registerFixture('attendanceSessions', r.sessionId);
      }
    }

    // 2. Disappeared / deleted attendance records
    const deletedRecords = beforeRecords.filter((br) => !afterRecords.some((ar) => ar.id === br.id));

    // 3. Modified existing attendance records
    const modifiedRecords = beforeRecords.filter((br) => {
      const match = afterRecords.find((ar) => ar.id === br.id);
      return match && JSON.stringify(match) !== JSON.stringify(br);
    });

    const isRejected = res.status === 400 || res.status === 404;
    const noUnauthorizedSideEffects =
      newSessions.length === 0 &&
      newRecords.length === 0 &&
      modifiedSessions.length === 0 &&
      modifiedRecords.length === 0 &&
      deletedSessions.length === 0 &&
      deletedRecords.length === 0;
    const passed = isRejected && noUnauthorizedSideEffects;

    recordTestResult(
      'TC-BULK-01',
      'Cross-tenant student IDs in attendance rejected (400/404) and no unauthorized creations, modifications, or deletions occurred',
      passed ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL,
      `Status: ${res.status}, New sessions: ${newSessions.length}, New records: ${newRecords.length}, Modified sessions: ${modifiedSessions.length}, Modified records: ${modifiedRecords.length}, Deleted sessions: ${deletedSessions.length}, Deleted records: ${deletedRecords.length}, Side-effects clean: ${noUnauthorizedSideEffects}`
    );
  } catch (err) {
    recordTestResult('TC-BULK-01', 'Cross-tenant student IDs in attendance rejected', RESULT_STATUS.FAIL, err.message);
  }

  // TC-BULK-02: Admin Alpha submits marks for class belonging to Beta
  // Correction: Locates and registers any leaked assessments by unique name
  try {
    const assessmentTitle = `Hacked Assessment ${RUN_ID}`;
    const res = await fetch(`${baseUrl}/madrasa-admin/marking-hub/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminAlpha}`,
      },
      body: JSON.stringify({
        classId: classBeta.id,
        name: assessmentTitle,
        term: 'Term 1',
        academicYear: '2026',
      }),
    });

    const leakedAssessment = await prisma.markingAssessment.findFirst({
      where: { name: assessmentTitle },
    });
    if (leakedAssessment) {
      registerFixture('markingAssessments', leakedAssessment.id);
    }

    const isRejected = res.status === 404 || res.status === 400;
    const passed = isRejected && leakedAssessment === null;

    recordTestResult(
      'TC-BULK-02',
      'Cross-tenant class in assessment rejected (404/400) and no assessment created',
      passed ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL,
      `Status: ${res.status}, Leaked assessment: ${Boolean(leakedAssessment)}`
    );
  } catch (err) {
    recordTestResult('TC-BULK-02', 'Cross-tenant class in assessment rejected', RESULT_STATUS.FAIL, err.message);
  }

  // TC-BULK-03: Admin Alpha schedules interview for Beta applicant
  // Tracks InterviewSchedule records independently from InterviewAppointment using unique venue criteria
  try {
    const uniqueVenue = `Alpha Bulk Hall ${RUN_ID}`;
    const appBetaBefore = await prisma.studentApplication.findUnique({
      where: { id: applicationBeta.id },
    });

    const beforeSchedules = await prisma.interviewSchedule.findMany({
      where: { madrasaId: madrasaAlpha.id, venue: uniqueVenue },
    });

    const res = await fetch(`${baseUrl}/madrasa-admin/admissions/interviews/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminAlpha}`,
      },
      body: JSON.stringify({
        admissionPeriodId: admissionPeriodAlpha.id,
        interviewRound: 'FIRST',
        scheduleDate: '2026-11-25',
        startTime: '10:00',
        durationMinutes: 15,
        venue: uniqueVenue,
        applicantIds: [applicationBeta.id],
      }),
    });

    // Track newly created InterviewSchedule records independently
    const afterSchedules = await prisma.interviewSchedule.findMany({
      where: { madrasaId: madrasaAlpha.id, venue: uniqueVenue },
    });
    const newSchedules = afterSchedules.filter((as) => !beforeSchedules.some((bs) => bs.id === as.id));
    for (const s of newSchedules) {
      registerFixture('interviewSchedules', s.id);
    }

    // Check if any appointment was created for applicationBeta
    const leakedAppts = await prisma.interviewAppointment.findMany({
      where: { applicationId: applicationBeta.id, venue: uniqueVenue },
    });
    for (const a of leakedAppts) {
      registerFixture('interviewAppointments', a.id);
      if (a.scheduleId) registerFixture('interviewSchedules', a.scheduleId);
    }

    const appBetaAfter = await prisma.studentApplication.findUnique({
      where: { id: applicationBeta.id },
    });
    const statusUnchanged = appBetaBefore && appBetaAfter && appBetaBefore.status === appBetaAfter.status;
    const isRejected = res.status === 404 || res.status === 400;
    const passed = isRejected && leakedAppts.length === 0 && newSchedules.length === 0 && statusUnchanged;

    recordTestResult(
      'TC-BULK-03',
      'Cross-tenant applicant in interview rejected (404/400) and applicant state preserved',
      passed ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL,
      `Status: ${res.status}, Leaked appts: ${leakedAppts.length}, New schedules: ${newSchedules.length}, Status preserved: ${statusUnchanged}`
    );
  } catch (err) {
    recordTestResult('TC-BULK-03', 'Cross-tenant applicant in interview rejected', RESULT_STATUS.FAIL, err.message);
  }

  // TC-BULK-04: Admin Alpha generates invoice referencing Beta student
  // Correction: Captures before/after invoices; registers any new invoices for cleanup
  try {
    const beforeInvoices = await prisma.invoice.findMany({
      where: { studentId: studentBeta.id },
    });

    const res = await fetch(`${baseUrl}/madrasa-admin/invoices/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminAlpha}`,
      },
      body: JSON.stringify({
        studentIds: [studentBeta.id],
        billingMonth: 12,
        billingYear: 2026,
      }),
    });

    const afterInvoices = await prisma.invoice.findMany({
      where: { studentId: studentBeta.id },
    });
    const newInvoices = afterInvoices.filter((ai) => !beforeInvoices.some((bi) => bi.id === ai.id));
    for (const inv of newInvoices) {
      registerFixture('invoices', inv.id);
    }

    const isRejected = res.status === 404 || res.status === 400;
    const passed = isRejected && newInvoices.length === 0;

    recordTestResult(
      'TC-BULK-04',
      'Cross-tenant student invoice generation rejected (404/400) and no invoices created',
      passed ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL,
      `Status: ${res.status}, New foreign invoices: ${newInvoices.length}`
    );
  } catch (err) {
    recordTestResult('TC-BULK-04', 'Cross-tenant student invoice generation rejected', RESULT_STATUS.FAIL, err.message);
  }

  // TC-BULK-05: Admin Alpha generates salary referencing Beta Ustadh
  // Correction: Captures before/after state of salaryBeta to prove no state modification occurred
  try {
    const salaryBetaBefore = await prisma.ustadhSalary.findUnique({
      where: { id: salaryBeta.id },
    });

    const res = await fetch(`${baseUrl}/madrasa-admin/ustadh-salaries/${salaryBeta.id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminAlpha}`,
      },
      body: JSON.stringify({
        paymentMethod: 'CASH',
        paymentDate: '2026-11-03',
      }),
    });

    const salaryBetaAfter = await prisma.ustadhSalary.findUnique({
      where: { id: salaryBeta.id },
    });
    // Check if any NotificationJob was created for this salary
    const leakedSalaryJob = await prisma.notificationJob.findFirst({
      where: { relatedEntityType: 'UstadhSalary', relatedEntityId: salaryBeta.id },
      select: { id: true },
    });
    if (leakedSalaryJob) {
      registerFixture('notificationJobs', leakedSalaryJob.id);
    }

    const isStateUnchanged =
      salaryBetaBefore &&
      salaryBetaAfter &&
      salaryBetaBefore.status === salaryBetaAfter.status &&
      salaryBetaBefore.paidAt === salaryBetaAfter.paidAt;
    const isRejected = res.status === 404;
    const passed = isRejected && isStateUnchanged && leakedSalaryJob === null;

    recordTestResult(
      'TC-BULK-05',
      'Cross-tenant salary processing rejected (404 Not Found) and salary state preserved',
      passed ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL,
      `Status: ${res.status}, State unchanged: ${isStateUnchanged}, Leaked job: ${Boolean(leakedSalaryJob)}`
    );
  } catch (err) {
    recordTestResult('TC-BULK-05', 'Cross-tenant salary processing rejected', RESULT_STATUS.FAIL, err.message);
  }
}

export async function runGroupF_ExportsAndFiles() {
  console.log('\n--- Group F: Cross-Tenant Exports, Downloads & Private Files (5 Tests) ---');

  // TC-FILE-01: Admin Alpha attempts downloading Beta receipt
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/receipts/${receiptBeta.id}`, {
      headers: { Authorization: `Bearer ${tokenAdminAlpha}` },
    });
    recordTestResult('TC-FILE-01', 'Cross-tenant receipt access returns 404 Not Found', res.status === 404 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-FILE-01', 'Cross-tenant receipt access returns 404 Not Found', RESULT_STATUS.FAIL, err.message);
  }

  // TC-FILE-02: Admin Alpha attempts exporting Beta marksheet PDF
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/marking-hub/assessments/${assessmentBeta.id}/export/pdf`, {
      headers: { Authorization: `Bearer ${tokenAdminAlpha}` },
    });
    recordTestResult('TC-FILE-02', 'Cross-tenant assessment PDF returns 404 Not Found', res.status === 404 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-FILE-02', 'Cross-tenant assessment PDF returns 404 Not Found', RESULT_STATUS.FAIL, err.message);
  }

  // TC-FILE-03: Admin Alpha requests daily attendance PDF passing Beta classId
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/attendance/export/daily/pdf?classId=${classBeta.id}&date=2026-11-02&academicYear=2026`, {
      headers: { Authorization: `Bearer ${tokenAdminAlpha}` },
    });
    recordTestResult('TC-FILE-03', 'Cross-tenant class attendance PDF returns 404 Not Found', res.status === 404 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-FILE-03', 'Cross-tenant class attendance PDF returns 404 Not Found', RESULT_STATUS.FAIL, err.message);
  }

  // TC-FILE-04: Admin Alpha attempts exporting Beta Ustadh payslip
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/ustadh-salaries/${salaryBeta.id}/slip`, {
      headers: { Authorization: `Bearer ${tokenAdminAlpha}` },
    });
    recordTestResult('TC-FILE-04', 'Cross-tenant salary slip PDF returns 404 Not Found', res.status === 404 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-FILE-04', 'Cross-tenant salary slip PDF returns 404 Not Found', RESULT_STATUS.FAIL, err.message);
  }

  // TC-FILE-05: Admin Alpha attempts generating certificate for Beta alumni
  // Uses a real qualification fixture belonging to Beta to strictly verify tenant isolation
  try {
    if (!qualificationBeta) {
      recordTestResult('TC-FILE-05', 'Cross-tenant alumni certificate access unverified (fixture missing)', RESULT_STATUS.FAIL, 'Fixture qualificationBeta was not created');
    } else {
      const res = await fetch(`${baseUrl}/madrasa-admin/alumni-network/${alumniBeta.id}/qualifications/${qualificationBeta.id}/certificate/stream`, {
        headers: { Authorization: `Bearer ${tokenAdminAlpha}` },
      });
      // Cross-tenant access is rejected with 403 Forbidden (consent/tenant boundary) or 404 Not Found
      const passed = res.status === 403 || res.status === 404;
      recordTestResult(
        'TC-FILE-05',
        'Cross-tenant alumni certificate returns 403 Forbidden or 404 Not Found on real Beta qualification',
        passed ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL,
        `Status: ${res.status}`
      );
    }
  } catch (err) {
    recordTestResult('TC-FILE-05', 'Cross-tenant alumni certificate returns 403/404', RESULT_STATUS.FAIL, err.message);
  }
}

export async function runGroupG_Lifecycle() {
  console.log('\n--- Group G: Institution Lifecycle & Inactive Tenant Access (3 Tests) ---');

  // TC-LIFE-01: Admin of Madrasa with status: SUSPENDED attempts access
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/students`, {
      headers: { Authorization: `Bearer ${tokenAdminSuspended}` },
    });
    recordTestResult('TC-LIFE-01', 'Suspended Madrasa access returns 403 Forbidden', res.status === 403 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-LIFE-01', 'Suspended Madrasa access returns 403 Forbidden', RESULT_STATUS.FAIL, err.message);
  }

  // TC-LIFE-02: Admin of Madrasa with status: ARCHIVED attempts access
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/students`, {
      headers: { Authorization: `Bearer ${tokenAdminArchived}` },
    });
    recordTestResult('TC-LIFE-02', 'Archived Madrasa access returns 403 Forbidden', res.status === 403 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-LIFE-02', 'Archived Madrasa access returns 403 Forbidden', RESULT_STATUS.FAIL, err.message);
  }

  // TC-LIFE-03: Public visitor attempts viewing CMS of suspended Madrasa
  try {
    const res = await fetch(`${baseUrl}/public/madrasa/${madrasaSuspended.slug}`);
    recordTestResult('TC-LIFE-03', 'Public CMS of suspended Madrasa returns 404 Not Found', res.status === 404 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-LIFE-03', 'Public CMS of suspended Madrasa returns 404 Not Found', RESULT_STATUS.FAIL, err.message);
  }
}

export async function runGroupH_Subscriptions() {
  console.log('\n--- Group H: Subscription Status Boundaries & Exemptions (4 Tests) ---');

  // TC-SUB-01: Admin of Madrasa with EXPIRED subscription calls core route
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/students`, {
      headers: { Authorization: `Bearer ${tokenAdminExpired}` },
    });
    recordTestResult('TC-SUB-01', 'Expired subscription on core route returns 403 Forbidden', res.status === 403 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-SUB-01', 'Expired subscription on core route returns 403 Forbidden', RESULT_STATUS.FAIL, err.message);
  }

  // TC-SUB-02: Admin of Madrasa with EXPIRED subscription calls finance route
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/invoices`, {
      headers: { Authorization: `Bearer ${tokenAdminExpired}` },
    });
    recordTestResult('TC-SUB-02', 'Expired subscription on finance route returns 403 Forbidden', res.status === 403 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-SUB-02', 'Expired subscription on finance route returns 403 Forbidden', RESULT_STATUS.FAIL, err.message);
  }

  // TC-SUB-03: Admin with EXPIRED subscription checks subscription status (exempt route)
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/subscription`, {
      headers: { Authorization: `Bearer ${tokenAdminExpired}` },
    });
    recordTestResult('TC-SUB-03', 'Expired subscription accesses /subscription returns 200 OK', res.status === 200 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-SUB-03', 'Expired subscription accesses /subscription returns 200 OK', RESULT_STATUS.FAIL, err.message);
  }

  // TC-SUB-04: Admin with EXPIRED subscription checks platform notices (exempt route)
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/announcements`, {
      headers: { Authorization: `Bearer ${tokenAdminExpired}` },
    });
    recordTestResult('TC-SUB-04', 'Expired subscription accesses /announcements returns 200 OK', res.status === 200 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-SUB-04', 'Expired subscription accesses /announcements returns 200 OK', RESULT_STATUS.FAIL, err.message);
  }
}

export async function runGroupI_FeatureEntitlements() {
  console.log('\n--- Group I: Feature Entitlement & Plan Overrides (Feature Entitlement Gap) (5 Tests) ---');

  // TC-FEAT-01: Active subscription containing ADMISSIONS_INTERVIEW feature
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/admissions/interviews/appointments`, {
      headers: { Authorization: `Bearer ${tokenAdminAlpha}` },
    });
    recordTestResult('TC-FEAT-01', 'Active subscription with feature returns 200 OK', res.status === 200 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-FEAT-01', 'Active subscription with feature returns 200 OK', RESULT_STATUS.FAIL, err.message);
  }

  // TC-FEAT-02: Active subscription WITHOUT ADMISSIONS_INTERVIEW feature
  // Requirement 6: Classified as KNOWN_SECURITY_GAP when observed behavior (200 OK) violates policy (403 Forbidden)
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/admissions/interviews/appointments`, {
      headers: { Authorization: `Bearer ${tokenAdminBeta}` },
    });
    if (res.status === 200) {
      recordTestResult(
        'TC-FEAT-02',
        'Active subscription without feature (ADMISSIONS_INTERVIEW)',
        RESULT_STATUS.KNOWN_SECURITY_GAP,
        `Observed Status: ${res.status} (Expected Platform Policy: 403 Forbidden)`
      );
    } else if (res.status === 403) {
      recordTestResult('TC-FEAT-02', 'Active subscription without feature properly rejected with 403', RESULT_STATUS.PASS, `Status: ${res.status}`);
    } else {
      recordTestResult('TC-FEAT-02', 'Active subscription without feature', RESULT_STATUS.FAIL, `Unexpected Status: ${res.status}`);
    }
  } catch (err) {
    recordTestResult('TC-FEAT-02', 'Active subscription without feature', RESULT_STATUS.FAIL, err.message);
  }

  // TC-FEAT-05: Direct API write to feature disabled by tier plan
  // Safe Exact-ID Cleanup & Persistence Check: executed before TC-FEAT-03 creates GRANT override for Madrasa Beta
  try {
    const uniqueVenue = `Beta Hall ${RUN_ID}`;

    // Independent before snapshots for appointments and schedules
    const beforeAppts = await prisma.interviewAppointment.findMany({
      where: { madrasaId: madrasaBeta.id, venue: uniqueVenue },
      select: { id: true, scheduleId: true },
    });
    const beforeSchedules = await prisma.interviewSchedule.findMany({
      where: { madrasaId: madrasaBeta.id, venue: uniqueVenue },
      select: { id: true },
    });

    const res = await fetch(`${baseUrl}/madrasa-admin/admissions/interviews/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminBeta}`,
      },
      body: JSON.stringify({
        admissionPeriodId: admissionPeriodBeta.id,
        interviewRound: 'FIRST',
        scheduleDate: '2026-11-28',
        startTime: '09:00',
        durationMinutes: 20,
        venue: uniqueVenue,
        applicantIds: [applicationBeta.id],
      }),
    });

    // Independent after snapshots for appointments and schedules
    const afterAppts = await prisma.interviewAppointment.findMany({
      where: { madrasaId: madrasaBeta.id, venue: uniqueVenue },
      select: { id: true, scheduleId: true },
    });
    const afterSchedules = await prisma.interviewSchedule.findMany({
      where: { madrasaId: madrasaBeta.id, venue: uniqueVenue },
      select: { id: true },
    });

    // Compare before/after records and identify only newly created record IDs
    const newAppts = afterAppts.filter((aa) => !beforeAppts.some((ba) => ba.id === aa.id));
    for (const a of newAppts) {
      registerFixture('interviewAppointments', a.id);
      if (a.scheduleId) registerFixture('interviewSchedules', a.scheduleId);
    }

    const newSchedules = afterSchedules.filter((as) => !beforeSchedules.some((bs) => bs.id === as.id));
    for (const s of newSchedules) {
      registerFixture('interviewSchedules', s.id);
    }

    const unauthorizedPersisted = newAppts.length > 0 || newSchedules.length > 0;

    if (unauthorizedPersisted) {
      recordTestResult(
        'TC-FEAT-05',
        'Direct API write to unentitled feature bypasses feature gate (unauthorized records persisted)',
        RESULT_STATUS.KNOWN_SECURITY_GAP,
        `Observed Status: ${res.status}, Persisted Appointments: ${newAppts.length}, Persisted Schedules: ${newSchedules.length} (Expected Platform Policy: 403 Forbidden)`
      );
    } else if (res.status === 403 && !unauthorizedPersisted) {
      recordTestResult(
        'TC-FEAT-05',
        'Direct API write to unentitled feature properly rejected with 403 and no records persisted',
        RESULT_STATUS.PASS,
        `Status: ${res.status}, Persisted Appointments: ${newAppts.length}, Persisted Schedules: ${newSchedules.length}`
      );
    } else if (res.status === 400) {
      recordTestResult(
        'TC-FEAT-05',
        'Direct API write returned 400 Bad Request (Validation failure does not prove feature-entitlement bypass)',
        RESULT_STATUS.FAIL,
        `Status: ${res.status} (Validation failure does not demonstrate entitlement bypass)`
      );
    } else {
      recordTestResult(
        'TC-FEAT-05',
        'Direct API write to unentitled feature resulted in unexpected or inconclusive response',
        RESULT_STATUS.FAIL,
        `Unexpected Status: ${res.status}, Persisted Appointments: ${newAppts.length}, Persisted Schedules: ${newSchedules.length}`
      );
    }
  } catch (err) {
    recordTestResult('TC-FEAT-05', 'Direct API write to unentitled feature', RESULT_STATUS.FAIL, err.message);
  }

  // TC-FEAT-03: Subscription without feature, but has explicit GRANT override
  try {
    const overrideGrant = await prisma.madrasaFeatureOverride.create({
      data: {
        madrasaId: madrasaBeta.id,
        featureKey: 'ADMISSIONS_INTERVIEW',
        overrideType: 'GRANT',
        reason: 'Temporary promo grant for testing',
      },
    });
    registerFixture('madrasaFeatureOverrides', overrideGrant.id);

    // 1. Verify access is granted when active GRANT override exists
    const res = await fetch(`${baseUrl}/madrasa-admin/admissions/interviews/appointments`, {
      headers: { Authorization: `Bearer ${tokenAdminBeta}` },
    });

    // 2. Remove override and verify route immediately reverts to 403 Forbidden
    await prisma.madrasaFeatureOverride.delete({ where: { id: overrideGrant.id } }).catch(() => {});
    const resAfterRemoval = await fetch(`${baseUrl}/madrasa-admin/admissions/interviews/appointments`, {
      headers: { Authorization: `Bearer ${tokenAdminBeta}` },
    });

    const isGrantedWithOverride = res.status === 200;
    const isDeniedWithoutOverride = resAfterRemoval.status === 403;
    const passed = isGrantedWithOverride && isDeniedWithoutOverride;

    recordTestResult(
      'TC-FEAT-03',
      'Feature GRANT override permits access to unentitled plan; reverts to 403 upon removal',
      passed ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL,
      `With GRANT: ${res.status}, Without GRANT: ${resAfterRemoval.status}`
    );
  } catch (err) {
    recordTestResult('TC-FEAT-03', 'Feature GRANT override permits access', RESULT_STATUS.FAIL, err.message);
  }

  // TC-FEAT-04: Subscription has feature, but has explicit DENY override
  // Requirement 6: Classified as KNOWN_SECURITY_GAP when observed behavior (200 OK) violates policy (403 Forbidden)
  try {
    const overrideDeny = await prisma.madrasaFeatureOverride.create({
      data: {
        madrasaId: madrasaAlpha.id,
        featureKey: 'ADMISSIONS_INTERVIEW',
        overrideType: 'DENY',
        reason: 'Administrative restriction',
      },
    });
    registerFixture('madrasaFeatureOverrides', overrideDeny.id);

    const res = await fetch(`${baseUrl}/madrasa-admin/admissions/interviews/appointments`, {
      headers: { Authorization: `Bearer ${tokenAdminAlpha}` },
    });
    if (res.status === 200) {
      recordTestResult(
        'TC-FEAT-04',
        'Feature DENY override ignored by route middleware',
        RESULT_STATUS.KNOWN_SECURITY_GAP,
        `Observed Status: ${res.status} (Expected Platform Policy: 403 Forbidden)`
      );
    } else if (res.status === 403) {
      recordTestResult('TC-FEAT-04', 'Feature DENY override properly rejected with 403', RESULT_STATUS.PASS, `Status: ${res.status}`);
    } else {
      recordTestResult('TC-FEAT-04', 'Feature DENY override', RESULT_STATUS.FAIL, `Unexpected Status: ${res.status}`);
    }
  } catch (err) {
    recordTestResult('TC-FEAT-04', 'Feature DENY override', RESULT_STATUS.FAIL, err.message);
  }
}

export async function runGroupJ_PublicEndpoints() {
  console.log('\n--- Group J: Public Endpoints & Unauthenticated Access (4 Tests) ---');

  // TC-PUB-01: Unauthenticated public request for valid active madrasa profile
  try {
    const res = await fetch(`${baseUrl}/public/madrasa/${madrasaAlpha.slug}`);
    recordTestResult('TC-PUB-01', 'Public profile of active Madrasa returns 200 OK', res.status === 200 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-PUB-01', 'Public profile of active Madrasa returns 200 OK', RESULT_STATUS.FAIL, err.message);
  }

  // TC-PUB-02: Unauthenticated public request for non-existent madrasa slug
  try {
    const res = await fetch(`${baseUrl}/public/madrasa/nonexistent-madrasa-slug-${Date.now()}`);
    recordTestResult('TC-PUB-02', 'Public profile for non-existent slug returns 404 Not Found', res.status === 404 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-PUB-02', 'Public profile for non-existent slug returns 404 Not Found', RESULT_STATUS.FAIL, err.message);
  }

  // TC-PUB-03: Direct call without auth to protected madrasa route
  try {
    const res = await fetch(`${baseUrl}/madrasa-admin/students`);
    recordTestResult('TC-PUB-03', 'Unauthenticated call to /madrasa-admin/students returns 401 Unauthorized', res.status === 401 ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL, `Status: ${res.status}`);
  } catch (err) {
    recordTestResult('TC-PUB-03', 'Unauthenticated call to /madrasa-admin/students returns 401 Unauthorized', RESULT_STATUS.FAIL, err.message);
  }

  // TC-PUB-04: Public admission application submission
  // Source-verified fields: guardianEmail is an existing searchable field on StudentApplication model.
  // Tracks exact created studentApplication ID and associated notificationJob ID for clean teardown.
  try {
    const publicApplicantEmail = `guardian_${RUN_ID}@example.com`;
    const res = await fetch(`${baseUrl}/public/madrasa/${madrasaAlpha.slug}/admissions/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admissionPeriodId: admissionPeriodAlpha.id,
        applicantName: `Public Applicant ${RUN_ID}`,
        dateOfBirth: '2016-01-15',
        gender: 'MALE',
        guardianName: 'Public Guardian',
        guardianRelationship: 'Father',
        guardianPhone: '+94778889999',
        guardianEmail: publicApplicantEmail,
        address: 'Colombo, Sri Lanka',
      }),
    });

    const json = await res.json().catch(() => ({}));

    // Locate created application by response id or unique guardian email directly in DB
    const createdApp = json.data?.id
      ? await prisma.studentApplication.findUnique({ where: { id: json.data.id } })
      : await prisma.studentApplication.findFirst({ where: { guardianEmail: publicApplicantEmail } });

    const appId = createdApp?.id || json.data?.id;
    if (appId) {
      registerFixture('studentApplications', appId);

      // Track any notificationJob generated by public application submission
      const notifJob = await prisma.notificationJob.findFirst({
        where: { relatedEntityType: 'StudentApplication', relatedEntityId: appId },
        select: { id: true },
      });
      if (notifJob) {
        registerFixture('notificationJobs', notifJob.id);
      }
    }

    const isCreated = res.status === 201;
    const isPersisted = createdApp !== null && createdApp.madrasaId === madrasaAlpha.id;
    const passed = isCreated && isPersisted;

    recordTestResult(
      'TC-PUB-04',
      'Public admission application submission returns 201 Created and persists under target madrasa',
      passed ? RESULT_STATUS.PASS : RESULT_STATUS.FAIL,
      `Status: ${res.status}, Persisted ID: ${createdApp?.id}, Madrasa: ${createdApp?.madrasaId}`
    );
  } catch (err) {
    recordTestResult('TC-PUB-04', 'Public admission application submission returns 201 Created', RESULT_STATUS.FAIL, err.message);
  }
}

// ============================================================================
// 6. MAIN TEST RUNNER ORCHESTRATION
// ============================================================================
export async function main() {
  console.log('\n======================================================');
  console.log(' STARTING PHASE 2 RBAC TEST SUITE (52 TEST CASES)');
  console.log('======================================================\n');

  try {
    // 1. Enforce Preflight Isolation Gate
    await runPreflightSafetyGate();

    // 2. Set up fixtures in madrasanexa_test
    await setupFixtures();

    // 3. Execute Groups A through J
    await runGroupA_Authentication();
    await runGroupB_Revocation();
    await runGroupC_RoleBoundary();
    await runGroupD_TenantIsolation();
    await runGroupE_BulkOperations();
    await runGroupF_ExportsAndFiles();
    await runGroupG_Lifecycle();
    await runGroupH_Subscriptions();
    await runGroupI_FeatureEntitlements();
    await runGroupJ_PublicEndpoints();

    console.log('\n======================================================');
    console.log(' TEST SUITE EXECUTION SUMMARY');
    console.log('======================================================');
    console.log(` Policy Compliant Passes:  ${testPassedCount}`);
    console.log(` Known Security Gaps:      ${testGapCount}`);
    console.log(` Documented Limitations:   ${testLimitationCount}`);
    console.log(` Unexpected Failures:      ${testFailedCount}`);
    console.log(` Total Scenarios Evaluated: ${testPassedCount + testGapCount + testLimitationCount + testFailedCount}/52`);
    console.log('======================================================\n');

    if (testFailedCount > 0) {
      throw new Error(`${testFailedCount} test(s) failed unexpectedly in Phase 2 RBAC suite.`);
    }
  } catch (err) {
    console.error('Test execution encountered fatal error:', err);
    process.exitCode = 1;
  } finally {
    // 4. Guaranteed Teardown: ensure prisma.$disconnect() runs even if fixture cleanup throws
    try {
      await teardownExactFixtures();
    } catch (cleanupErr) {
      console.error('Teardown encountered critical failure:', cleanupErr.message);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Execute runner if invoked directly from CLI
if (process.argv[1] && process.argv[1].endsWith('rbac-security.test.js')) {
  main();
}
