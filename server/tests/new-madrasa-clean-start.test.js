import './setup-test-env.js';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { enableTestMode } from '../src/services/email.service.js';
import app from '../src/app.js';
import http from 'http';

const TEST_PREFIX = 'clean_start_' + Date.now();
const SLUG_BASE = 'cs' + Date.now().toString().slice(-8);

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

let activePlan = null;

let madrasaA = null;
let adminA = null;
let tokenA = '';
let studentA1 = null;
let studentA2 = null;
let ustadhA1 = null;
let teacherA2 = null;
let classA1 = null;
let classA2 = null;
let sectionA = null;
let subjectA1 = null;
let subjectA2 = null;
let subjectA3 = null;
let scheduleA = null;
let breakA = null;
let attendanceSessionA = null;
let attendanceRecordA = null;
let salaryA = null;
let invoiceA = null;
let paymentA = null;
let announcementAOnly = null;
let announcementAll = null;

let onboardingRequestB = null;
let madrasaB = null;
let adminB = null;
let tokenB = '';
let temporaryPasswordB = '';

async function setup() {
  console.log('\n--- Setting up New Madrasa Clean Start Test Fixtures ---');
  enableTestMode(true);

  const now = new Date();
  const pwdHash = await hashPassword('StandardPassword123!');

  // 1. Super Admin
  superAdminUser = await prisma.user.create({
    data: {
      name: 'Clean Start Super Admin',
      email: `${TEST_PREFIX}_super@example.com`,
      passwordHash: pwdHash,
      role: 'SUPER_ADMIN',
      madrasaId: null,
      isActive: true,
      mustChangePassword: false,
    },
  });

  superAdminToken = signAccessToken({
    userId: superAdminUser.id,
    role: 'SUPER_ADMIN',
    madrasaId: null,
  });

  // 2. Active Subscription Plan
  activePlan = await prisma.plan.upsert({
    where: { code: 'CLEAN_START_GOLD' },
    create: {
      name: 'Clean Start Gold Tier',
      code: 'CLEAN_START_GOLD',
      description: 'Gold tier plan for clean start verification',
      durationMonths: 6,
      price: 15000,
      isActive: true,
    },
    update: {},
  });

  // 3. Madrasa A (Fully Populated Existing Institution)
  madrasaA = await prisma.madrasa.create({
    data: {
      name: 'Madrasa A - Established Academy',
      code: `MTA_${Date.now().toString().slice(-5)}`,
      slug: `${SLUG_BASE}-established-a`,
      email: `${TEST_PREFIX}_mta@example.com`,
      phone: '0112345678',
      status: 'ACTIVE',
    },
  });

  adminA = await prisma.user.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Admin Madrasa A',
      email: `${TEST_PREFIX}_admin_a@example.com`,
      passwordHash: pwdHash,
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  tokenA = signAccessToken({
    userId: adminA.id,
    role: 'MADRASA_ADMIN',
    madrasaId: madrasaA.id,
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaA.id,
      planId: activePlan.id,
      status: 'ACTIVE',
      startsAt: new Date(now.getTime() - 30 * 86400000),
      endsAt: new Date(now.getTime() + 150 * 86400000),
      priceAtPurchase: 15000,
      durationMonthsAtPurchase: 6,
    },
  });

  sectionA = await prisma.academicSection.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Primary Section',
      code: 'PRIM',
      isActive: true,
    },
  });

  classA1 = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      academicSectionId: sectionA.id,
      name: 'Grade 01 A',
      code: `G1A_${Date.now().toString().slice(-4)}`,
      defaultMonthlyFee: 1200,
      isActive: true,
    },
  });

  classA2 = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      academicSectionId: sectionA.id,
      name: 'Grade 02 A',
      code: `G2A_${Date.now().toString().slice(-4)}`,
      defaultMonthlyFee: 1400,
      isActive: true,
    },
  });

  studentA1 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: `ADM-A1-${Date.now().toString().slice(-4)}`,
      fullName: 'Zayd Ibn Haritha',
      guardianName: 'Haritha',
      guardianPhone: '0771112233',
      admissionDate: new Date('2026-01-01'),
      status: 'ACTIVE',
    },
  });

  studentA2 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA2.id,
      admissionNo: `ADM-A2-${Date.now().toString().slice(-4)}`,
      fullName: 'Usama Ibn Zayd',
      guardianName: 'Zayd',
      guardianPhone: '0772223344',
      admissionDate: new Date('2026-01-01'),
      status: 'ACTIVE',
    },
  });

  ustadhA1 = await prisma.ustadh.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhCode: `UST_A_${Date.now().toString().slice(-4)}`,
      staffType: 'USTADH',
      fullName: 'Ustadh Bilal Al-Habashi',
      email: `${TEST_PREFIX}_bilal@example.com`,
      phoneNumber: '0773334455',
      joinDate: new Date('2025-01-01'),
      baseMonthlySalary: 50000,
      isActive: true,
    },
  });

  teacherA2 = await prisma.ustadh.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhCode: `TCH_A_${Date.now().toString().slice(-4)}`,
      staffType: 'SCHOOL_TEACHER',
      fullName: 'Teacher Fatima Zahra',
      email: `${TEST_PREFIX}_fatima@example.com`,
      phoneNumber: '0774445566',
      joinDate: new Date('2025-01-01'),
      baseMonthlySalary: 45000,
      isActive: true,
    },
  });

  subjectA1 = await prisma.subject.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'QURAN TAFSEER',
      code: `QUR_${Date.now().toString().slice(-4)}`,
      isActive: true,
    },
  });

  subjectA2 = await prisma.subject.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'ISLAMIC FIQH',
      code: `FIQ_${Date.now().toString().slice(-4)}`,
      isActive: true,
    },
  });

  subjectA3 = await prisma.subject.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'GENERAL MATHEMATICS',
      code: `MAT_${Date.now().toString().slice(-4)}`,
      isActive: true,
    },
  });

  scheduleA = await prisma.ustadhSchedule.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      ustadhId: ustadhA1.id,
      subjectId: subjectA1.id,
      dayOfWeek: 'MONDAY',
      startMinutes: 480, // 08:00
      endMinutes: 540,   // 09:00
      effectiveFrom: new Date('2026-01-01'),
      isActive: true,
    },
  });

  breakA = await prisma.timetableBreak.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      name: 'Mid-Morning Break',
      dayOfWeek: 'MONDAY',
      startMinutes: 600, // 10:00
      endMinutes: 630,   // 10:30
      effectiveFrom: new Date('2026-01-01'),
      isActive: true,
    },
  });

  attendanceSessionA = await prisma.attendanceSession.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      academicYear: '2025/2026',
      attendanceDate: new Date('2026-03-10'),
    },
  });

  attendanceRecordA = await prisma.attendanceRecord.create({
    data: {
      madrasaId: madrasaA.id,
      sessionId: attendanceSessionA.id,
      studentId: studentA1.id,
      status: 'PRESENT',
    },
  });

  salaryA = await prisma.ustadhSalary.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhId: ustadhA1.id,
      salaryMonth: new Date('2026-02-01'),
      baseSalarySnapshot: 50000,
      payableAmount: 50000,
      status: 'PAID',
      paymentMethod: 'CASH',
      paymentDate: new Date('2026-02-28'),
      paymentReference: 'SAL-REF-001',
    },
  });

  invoiceA = await prisma.invoice.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentA1.id,
      invoiceNo: `INV-A-${Date.now().toString().slice(-4)}`,
      billingYear: 2026,
      billingMonth: 3,
      issueDate: new Date('2026-03-01'),
      subtotal: 1200,
      totalAmount: 1200,
      paidAmount: 1200,
      balanceAmount: 0,
      status: 'PAID',
    },
  });

  paymentA = await prisma.payment.create({
    data: {
      madrasaId: madrasaA.id,
      studentId: studentA1.id,
      paymentNo: `PAY-A-${Date.now().toString().slice(-4)}`,
      amount: 1200,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      paidAt: new Date('2026-03-02'),
    },
  });

  // Announcements
  announcementAll = await prisma.announcement.create({
    data: {
      title: 'Platform Maintenance Notice - All Tenants',
      message: 'Scheduled platform maintenance window this Sunday.',
      category: 'MAINTENANCE',
      priority: 'IMPORTANT',
      audience: 'ALL_MADRASAS',
      status: 'PUBLISHED',
      publishedAt: now,
      createdById: superAdminUser.id,
    },
  });

  announcementAOnly = await prisma.announcement.create({
    data: {
      title: 'Confidential Notice Strictly For Madrasa A',
      message: 'Targeted private advisory intended solely for Madrasa A.',
      category: 'GENERAL',
      priority: 'URGENT',
      audience: 'SELECTED_MADRASAS',
      status: 'PUBLISHED',
      publishedAt: now,
      createdById: superAdminUser.id,
      targets: {
        create: {
          madrasaId: madrasaA.id,
        },
      },
    },
  });

  // Start HTTP Server
  await new Promise((resolve) => {
    testServer = http.createServer(app);
    testServer.listen(0, '127.0.0.1', () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      console.log(`Test server running at ${baseUrl}`);
      resolve();
    });
  });
}

async function teardown() {
  console.log('\n--- Cleaning up Clean Start Test Fixtures ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  const madrasaIds = [madrasaA?.id, madrasaB?.id].filter(Boolean);

  for (const mid of madrasaIds) {
    try {
      await prisma.timetableBreak.deleteMany({ where: { madrasaId: mid } });
      await prisma.ustadhSchedule.deleteMany({ where: { madrasaId: mid } });
      await prisma.ustadhAttendanceRecord.deleteMany({ where: { madrasaId: mid } });
      await prisma.ustadhSalary.deleteMany({ where: { madrasaId: mid } });
      await prisma.ustadh.deleteMany({ where: { madrasaId: mid } });
      await prisma.attendanceRecord.deleteMany({ where: { madrasaId: mid } });
      await prisma.attendanceSession.deleteMany({ where: { madrasaId: mid } });
      await prisma.studentMark.deleteMany({ where: { madrasaId: mid } });
      await prisma.markingAssessmentSubject.deleteMany({ where: { madrasaId: mid } });
      await prisma.markingAssessment.deleteMany({ where: { madrasaId: mid } });
      await prisma.subject.deleteMany({ where: { madrasaId: mid } });
      await prisma.paymentAllocation.deleteMany({ where: { madrasaId: mid } });
      await prisma.payment.deleteMany({ where: { madrasaId: mid } });
      await prisma.invoiceItem.deleteMany({ where: { madrasaId: mid } });
      await prisma.invoice.deleteMany({ where: { madrasaId: mid } });
      await prisma.studentFeeSetting.deleteMany({ where: { madrasaId: mid } });
      await prisma.student.deleteMany({ where: { madrasaId: mid } });
      await prisma.class.deleteMany({ where: { madrasaId: mid } });
      await prisma.academicSection.deleteMany({ where: { madrasaId: mid } });
      await prisma.madrasaSetting.deleteMany({ where: { madrasaId: mid } });
      await prisma.subscriptionPaymentSubmission.deleteMany({ where: { madrasaId: mid } });
      await prisma.subscriptionPayment.deleteMany({ where: { madrasaId: mid } });
      await prisma.subscription.deleteMany({ where: { madrasaId: mid } });
      await prisma.activityLog.deleteMany({ where: { madrasaId: mid } });
      await prisma.user.deleteMany({ where: { madrasaId: mid } });
      await prisma.announcementMadrasa.deleteMany({ where: { madrasaId: mid } });
      await prisma.madrasaOnboardingRequest.deleteMany({ where: { approvedMadrasaId: mid } });
      await prisma.madrasa.delete({ where: { id: mid } });
    } catch (e) {
      // ignore teardown errors
    }
  }

  if (superAdminUser) {
    try {
      if (announcementAOnly) await prisma.announcement.delete({ where: { id: announcementAOnly.id } });
      if (announcementAll) await prisma.announcement.delete({ where: { id: announcementAll.id } });
      await prisma.user.delete({ where: { id: superAdminUser.id } });
    } catch (e) {}
  }
}

async function apiRequest(endpoint, { method = 'GET', body = null, token = tokenB } = {}) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/pdf')) {
    const arrayBuffer = await res.arrayBuffer();
    return {
      status: res.status,
      buffer: Buffer.from(arrayBuffer),
      headers: res.headers,
    };
  }

  let resBody = null;
  try {
    resBody = await res.json();
  } catch (e) {
    resBody = null;
  }

  return {
    status: res.status,
    body: resBody,
    headers: res.headers,
  };
}

async function runTests() {
  try {
    await setup();

    // =========================================================================
    // GROUP 1: CANONICAL ONBOARDING & SUPER ADMIN APPROVAL OF MADRASA B
    // =========================================================================
    console.log('\n[GROUP 1] Canonical Onboarding Request & Super Admin Approval for Madrasa B');

    onboardingRequestB = await prisma.madrasaOnboardingRequest.create({
      data: {
        madrasaName: 'Brand New Clean Academy B',
        contactName: 'Moulavi Clean Admin',
        email: `${TEST_PREFIX}_b_admin@example.com`,
        phone: '0779991122',
        address: '123 New Road, Colombo',
        status: 'PENDING',
      },
    });

    const bCode = `MTB_${Date.now().toString().slice(-5)}`;
    const bSlug = `${SLUG_BASE}-clean-b`;

    const approveRes = await fetch(`${baseUrl}/super-admin/onboarding/${onboardingRequestB.id}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        madrasaCode: bCode,
        madrasaSlug: bSlug,
        adminName: 'Moulavi Clean Admin',
        adminEmail: `${TEST_PREFIX}_b_admin@example.com`,
      }),
    });

    assert(approveRes.status === 200, '1.1 Canonical Super Admin approval returns HTTP 200 OK');
    const approveData = await approveRes.json();
    madrasaB = approveData.data.madrasa;
    temporaryPasswordB = approveData.data.adminUser.temporaryPassword;

    assert(Boolean(madrasaB?.id), '1.2 Madrasa B successfully created via canonical approval');
    assert(Boolean(temporaryPasswordB), '1.3 Temporary password delivered securely on approval');

    // First Login as Madrasa B Admin
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${TEST_PREFIX}_b_admin@example.com`,
        password: temporaryPasswordB,
      }),
    });

    assert(loginRes.status === 200, '1.4 First login with temporary password succeeds');
    const loginData = await loginRes.json();
    const tempToken = loginData.data.accessToken;
    assert(loginData.data.user.mustChangePassword === true, '1.5 Login correctly reflects mustChangePassword = true');

    // Complete Mandatory Password Change
    const newPassword = 'NewCleanSecurePassword456!';
    const changePwdRes = await fetch(`${baseUrl}/auth/change-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tempToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: temporaryPasswordB,
        newPassword,
      }),
    });

    assert(changePwdRes.status === 200, '1.6 Password change succeeds');

    // Authenticate with New Password
    const secondLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${TEST_PREFIX}_b_admin@example.com`,
        password: newPassword,
      }),
    });

    assert(secondLoginRes.status === 200, '1.7 Login with updated password succeeds');
    const secondLoginData = await secondLoginRes.json();
    tokenB = secondLoginData.data.accessToken;
    adminB = secondLoginData.data.user;
    assert(adminB.mustChangePassword === false, '1.8 mustChangePassword is now false');

    // =========================================================================
    // GROUP 2: ZERO TENANT BUSINESS DATA IN DATABASE FOR NEW MADRASA B
    // =========================================================================
    console.log('\n[GROUP 2] Direct DB Zero-Business-Data Audit for Madrasa B');

    const [
      bStudentsCount,
      bStaffCount,
      bClassesCount,
      bSubjectsCount,
      bSchedulesCount,
      bBreaksCount,
      bAttSessionsCount,
      bAttRecordsCount,
      bStaffAttCount,
      bSalariesCount,
      bAssessmentsCount,
      bMarksCount,
      bInvoicesCount,
      bPaymentsCount,
      bSectionsCount,
    ] = await Promise.all([
      prisma.student.count({ where: { madrasaId: madrasaB.id } }),
      prisma.ustadh.count({ where: { madrasaId: madrasaB.id } }),
      prisma.class.count({ where: { madrasaId: madrasaB.id } }),
      prisma.subject.count({ where: { madrasaId: madrasaB.id } }),
      prisma.ustadhSchedule.count({ where: { madrasaId: madrasaB.id } }),
      prisma.timetableBreak.count({ where: { madrasaId: madrasaB.id } }),
      prisma.attendanceSession.count({ where: { madrasaId: madrasaB.id } }),
      prisma.attendanceRecord.count({ where: { madrasaId: madrasaB.id } }),
      prisma.ustadhAttendanceRecord.count({ where: { madrasaId: madrasaB.id } }),
      prisma.ustadhSalary.count({ where: { madrasaId: madrasaB.id } }),
      prisma.markingAssessment.count({ where: { madrasaId: madrasaB.id } }),
      prisma.studentMark.count({ where: { madrasaId: madrasaB.id } }),
      prisma.invoice.count({ where: { madrasaId: madrasaB.id } }),
      prisma.payment.count({ where: { madrasaId: madrasaB.id } }),
      prisma.academicSection.count({ where: { madrasaId: madrasaB.id } }),
    ]);

    assert(bStudentsCount === 0, '2.1 Direct DB: Student count is exactly 0');
    assert(bStaffCount === 0, '2.2 Direct DB: Teaching Staff count is exactly 0');
    assert(bClassesCount === 0, '2.3 Direct DB: Class count is exactly 0');
    assert(bSubjectsCount === 0, '2.4 Direct DB: Subject count is exactly 0');
    assert(bSchedulesCount === 0, '2.5 Direct DB: Teaching Schedule count is exactly 0');
    assert(bBreaksCount === 0, '2.6 Direct DB: Timetable Break count is exactly 0');
    assert(bAttSessionsCount === 0 && bAttRecordsCount === 0, '2.7 Direct DB: Student Attendance count is exactly 0');
    assert(bStaffAttCount === 0, '2.8 Direct DB: Staff Attendance count is exactly 0');
    assert(bSalariesCount === 0, '2.9 Direct DB: Salary records count is exactly 0');
    assert(bAssessmentsCount === 0 && bMarksCount === 0, '2.10 Direct DB: Marking records count is exactly 0');
    assert(bInvoicesCount === 0 && bPaymentsCount === 0, '2.11 Direct DB: Tenant financial records count is exactly 0');
    assert(bSectionsCount === 0, '2.12 Direct DB: Academic sections count is exactly 0');

    // =========================================================================
    // GROUP 3: PLATFORM METADATA & SUBSCRIPTION GATE BEFORE ACTIVATION
    // =========================================================================
    console.log('\n[GROUP 3] Platform Metadata & Subscription Gate Verification');

    // 3.1 Unsubscribed B Admin checking subscription summary
    const subRes = await apiRequest('/madrasa-admin/subscription', { token: tokenB });
    assert(subRes.status === 200, '3.1 Subscription summary is accessible without active subscription');
    assert(subRes.body.data.currentAccess.allowed === false, '3.2 Subscription status reports allowed = false');
    assert(subRes.body.data.currentAccess.code === 'SUBSCRIPTION_REQUIRED', '3.3 Subscription status reports SUBSCRIPTION_REQUIRED');

    // 3.2 B Admin viewing available plans & bank details
    const plansRes = await apiRequest('/madrasa-admin/subscription/plans', { token: tokenB });
    assert(plansRes.status === 200, '3.4 Available plans list is accessible to new Madrasa B');
    assert(plansRes.body.data.some((p) => p.id === activePlan.id), '3.5 Platform active plans are visible');

    const bankRes = await apiRequest('/madrasa-admin/subscription/bank-details', { token: tokenB });
    assert(bankRes.status === 200, '3.6 Bank details endpoint accessible');

    // 3.3 Branding isolation before logo upload
    const brandingRes = await apiRequest('/madrasa-admin/branding', { token: tokenB });
    assert(brandingRes.status === 200, '3.7 Branding endpoint accessible');
    assert(brandingRes.body.data.logoUrl === null && brandingRes.body.data.logoFileId === null, '3.8 New Madrasa B has no logo configured');
    assert(brandingRes.body.data.logoUrl === null, '3.9 New Madrasa B logoUrl is null (not Madrasa A logo)');
    assert(brandingRes.body.data.name === 'Brand New Clean Academy B', '3.10 Branding reflects B name');

    // 3.4 Announcements: ALL_MADRASAS vs Targeted
    const announcementsRes = await apiRequest('/madrasa-admin/announcements', { token: tokenB });
    assert(announcementsRes.status === 200, '3.11 Announcements list accessible to new Madrasa B');
    const annItems = announcementsRes.body.data.announcements;
    assert(
      annItems.some((a) => a.id === announcementAll.id),
      '3.12 Madrasa B CAN see ALL_MADRASAS broadcast announcement'
    );
    assert(
      !annItems.some((a) => a.id === announcementAOnly.id),
      '3.13 Madrasa B CANNOT see Madrasa A-targeted private announcement'
    );

    // Direct access to A-only announcement ID
    const aOnlyDirectRes = await apiRequest(`/madrasa-admin/announcements/${announcementAOnly.id}`, { token: tokenB });
    assert(aOnlyDirectRes.status === 404, '3.14 Direct ID access to Madrasa A announcement returns 404 Not Found');

    // 3.5 Attempting business workspace prior to subscription
    const preSubStudents = await apiRequest('/madrasa-admin/students', { token: tokenB });
    assert(preSubStudents.status === 403, '3.15 Business workspace (/students) gated with 403 before subscription');

    const preSubDashboard = await apiRequest('/madrasa-admin/dashboard', { token: tokenB });
    assert(preSubDashboard.status === 403, '3.16 Business workspace (/dashboard) gated with 403 before subscription');

    // =========================================================================
    // GROUP 4: SUBSCRIPTION ACTIVATION WITHOUT BUSINESS AUTO-SEEDING
    // =========================================================================
    console.log('\n[GROUP 4] Subscription Activation Without Auto-Seeding (Zero Side Effects)');

    const nowUtc = new Date();
    await prisma.subscription.create({
      data: {
        madrasaId: madrasaB.id,
        planId: activePlan.id,
        status: 'ACTIVE',
        startsAt: nowUtc,
        endsAt: new Date(nowUtc.getTime() + 180 * 86400000),
        priceAtPurchase: 15000,
        durationMonthsAtPurchase: 6,
      },
    });

    // Verify Business Modules Unlock
    const postSubStudents = await apiRequest('/madrasa-admin/students', { token: tokenB });
    assert(postSubStudents.status === 200, '4.1 Students module unlocks with 200 OK after subscription activation');

    // Verify NO business data was seeded during activation
    const [bStudentsPostSub, bClassesPostSub, bStaffPostSub, bSchedulesPostSub] = await Promise.all([
      prisma.student.count({ where: { madrasaId: madrasaB.id } }),
      prisma.class.count({ where: { madrasaId: madrasaB.id } }),
      prisma.ustadh.count({ where: { madrasaId: madrasaB.id } }),
      prisma.ustadhSchedule.count({ where: { madrasaId: madrasaB.id } }),
    ]);

    assert(bStudentsPostSub === 0, '4.2 Subscription activation did not auto-seed students (count = 0)');
    assert(bClassesPostSub === 0, '4.3 Subscription activation did not auto-seed classes (count = 0)');
    assert(bStaffPostSub === 0, '4.4 Subscription activation did not auto-seed staff (count = 0)');
    assert(bSchedulesPostSub === 0, '4.5 Subscription activation did not auto-seed schedules (count = 0)');

    // =========================================================================
    // GROUP 5: DASHBOARD ZERO STATE FOR MADRASA B
    // =========================================================================
    console.log('\n[GROUP 5] Madrasa B Dashboard Zero-State Verification');

    const dashRes = await apiRequest('/madrasa-admin/dashboard', { token: tokenB });
    assert(dashRes.status === 200, '5.1 Dashboard endpoint returns 200 OK for Madrasa B');
    const dash = dashRes.body.data;

    assert(dash.kpis.totalStudents === 0, '5.2 Dashboard KPI: totalStudents is 0');
    assert(dash.kpis.activeStudents === 0, '5.3 Dashboard KPI: activeStudents is 0');
    assert(dash.kpis.activeClasses === 0, '5.4 Dashboard KPI: activeClasses is 0');
    assert(dash.kpis.currentMonthExpectedFees === 0, '5.5 Dashboard KPI: expectedFees is 0');
    assert(dash.kpis.currentMonthCollectedFees === 0, '5.6 Dashboard KPI: collectedFees is 0');
    assert(dash.kpis.currentMonthPendingFees === 0, '5.7 Dashboard KPI: pendingFees is 0');
    assert(dash.kpis.totalOutstandingBalance === 0, '5.8 Dashboard KPI: outstandingBalance is 0');

    assert(
      dash.charts.studentStatusDistribution.active === 0 &&
      dash.charts.studentStatusDistribution.inactive === 0 &&
      dash.charts.studentStatusDistribution.archived === 0,
      '5.9 Dashboard: studentStatusDistribution all 0'
    );

    assert(
      dash.charts.invoiceStatusDistribution.pending === 0 &&
      dash.charts.invoiceStatusDistribution.paid === 0 &&
      dash.charts.invoiceStatusDistribution.overdue === 0,
      '5.10 Dashboard: invoiceStatusDistribution all 0'
    );

    // Recent activity must contain ZERO Madrasa A entries
    assert(
      dash.recentActivity.every((act) => act.metadata?.madrasaId !== madrasaA.id),
      '5.11 Dashboard: recentActivity contains ZERO records from Madrasa A'
    );

    // =========================================================================
    // GROUP 6: EMPTY LIST API RESPONSES FOR MADRASA B
    // =========================================================================
    console.log('\n[GROUP 6] Empty List API Endpoints for Madrasa B');

    const [
      studentsListRes,
      classesListRes,
      sectionsListRes,
      subjectsListRes,
      ustadhsListRes,
      schedulesListRes,
      breaksListRes,
      fullTimetableRes,
      invoicesListRes,
      paymentsListRes,
      salariesListRes,
      assessmentsListRes,
    ] = await Promise.all([
      apiRequest('/madrasa-admin/students', { token: tokenB }),
      apiRequest('/madrasa-admin/classes', { token: tokenB }),
      apiRequest('/madrasa-admin/academic-sections', { token: tokenB }),
      apiRequest('/madrasa-admin/subjects', { token: tokenB }),
      apiRequest('/madrasa-admin/ustadhs', { token: tokenB }),
      apiRequest('/madrasa-admin/ustadh-schedules', { token: tokenB }),
      apiRequest('/madrasa-admin/timetable/breaks', { token: tokenB }),
      apiRequest('/madrasa-admin/timetable/full', { token: tokenB }),
      apiRequest('/madrasa-admin/invoices', { token: tokenB }),
      apiRequest('/madrasa-admin/payments', { token: tokenB }),
      apiRequest('/madrasa-admin/ustadh-salaries', { token: tokenB }),
      apiRequest('/madrasa-admin/marking-hub/assessments', { token: tokenB }),
    ]);

    assert(studentsListRes.status === 200 && studentsListRes.body.data.items.length === 0, '6.1 GET /students returns items: []');
    assert(classesListRes.status === 200 && classesListRes.body.data.items.length === 0, '6.2 GET /classes returns items: []');
    assert(sectionsListRes.status === 200 && sectionsListRes.body.data.items.length === 0, '6.3 GET /academic-sections returns items: []');
    assert(subjectsListRes.status === 200 && subjectsListRes.body.data.length === 0, '6.4 GET /subjects returns []');
    assert(ustadhsListRes.status === 200 && ustadhsListRes.body.data.items.length === 0, '6.5 GET /ustadhs returns items: []');
    assert(schedulesListRes.status === 200 && schedulesListRes.body.data.items.length === 0, '6.6 GET /ustadh-schedules returns items: []');
    assert(breaksListRes.status === 200 && breaksListRes.body.data.items.length === 0, '6.7 GET /timetable/breaks returns items: []');
    assert(fullTimetableRes.status === 200 && fullTimetableRes.body.data.items.length === 0, '6.8 GET /timetable/full returns items: []');
    assert(invoicesListRes.status === 200 && invoicesListRes.body.data.items.length === 0, '6.9 GET /invoices returns items: []');
    assert(paymentsListRes.status === 200 && paymentsListRes.body.data.items.length === 0, '6.10 GET /payments returns items: []');
    assert(salariesListRes.status === 200 && salariesListRes.body.data.items.length === 0, '6.11 GET /ustadh-salaries returns items: []');
    assert(assessmentsListRes.status === 200 && assessmentsListRes.body.data.length === 0, '6.12 GET /marking-hub/assessments returns []');

    // =========================================================================
    // GROUP 7: SEARCH & FILTER ISOLATION (ZERO LEAKS OF MADRASA A DATA)
    // =========================================================================
    console.log('\n[GROUP 7] Search & Filter Isolation');

    // Search by Madrasa A student's exact name
    const searchStudentRes = await apiRequest(`/madrasa-admin/students?search=${encodeURIComponent('Zayd Ibn Haritha')}`, { token: tokenB });
    assert(searchStudentRes.status === 200, '7.1 Student search returns 200');
    assert(searchStudentRes.body.data.items.length === 0, '7.2 Searching for Madrasa A student name returns 0 results');

    // Search by Madrasa A student's exact admission number
    const searchAdmRes = await apiRequest(`/madrasa-admin/students?search=${encodeURIComponent(studentA1.admissionNo)}`, { token: tokenB });
    assert(searchAdmRes.body.data.items.length === 0, '7.3 Searching for Madrasa A admission number returns 0 results');

    // Search by Madrasa A ustadh's name
    const searchUstadhRes = await apiRequest(`/madrasa-admin/ustadhs?search=${encodeURIComponent('Bilal Al-Habashi')}`, { token: tokenB });
    assert(searchUstadhRes.status === 200 && searchUstadhRes.body.data.items.length === 0, '7.4 Searching for Madrasa A ustadh name returns 0 results');

    // Filter ustadhs by staffType
    const filterStaffRes = await apiRequest('/madrasa-admin/ustadhs?staffType=SCHOOL_TEACHER', { token: tokenB });
    assert(filterStaffRes.body.data.items.length === 0, '7.5 Filtering by staffType returns 0 results for Madrasa B');

    // =========================================================================
    // GROUP 8: DIRECT CROSS-TENANT ID ACCESS (GENERIC 404 ENFORCEMENT)
    // =========================================================================
    console.log('\n[GROUP 8] Direct Cross-Tenant ID Access (Anti-Enumeration 404)');

    const [
      directStudentRes,
      directClassRes,
      directSectionRes,
      directUstadhRes,
      directInvoiceRes,
      directPaymentRes,
      directSalarySlipRes,
      directBreakPatchRes,
    ] = await Promise.all([
      apiRequest(`/madrasa-admin/students/${studentA1.id}`, { token: tokenB }),
      apiRequest(`/madrasa-admin/classes/${classA1.id}`, { token: tokenB }),
      apiRequest(`/madrasa-admin/academic-sections/${sectionA.id}`, { token: tokenB }),
      apiRequest(`/madrasa-admin/ustadhs/${ustadhA1.id}`, { token: tokenB }),
      apiRequest(`/madrasa-admin/invoices/${invoiceA.id}`, { token: tokenB }),
      apiRequest(`/madrasa-admin/payments/${paymentA.id}`, { token: tokenB }),
      apiRequest(`/madrasa-admin/ustadh-salaries/${salaryA.id}/slip`, { token: tokenB }),
      apiRequest(`/madrasa-admin/timetable/breaks/${breakA.id}`, {
        method: 'PATCH',
        body: { name: 'Unauthorized Modify' },
        token: tokenB,
      }),
    ]);

    assert(directStudentRes.status === 404, '8.1 Direct GET /students/:id (Madrasa A student) returns 404');
    assert(directClassRes.status === 404, '8.2 Direct GET /classes/:id (Madrasa A class) returns 404');
    assert(directSectionRes.status === 404, '8.3 Direct GET /academic-sections/:id (Madrasa A section) returns 404');
    assert(directUstadhRes.status === 404, '8.4 Direct GET /ustadhs/:id (Madrasa A ustadh) returns 404');
    assert(directInvoiceRes.status === 404, '8.5 Direct GET /invoices/:id (Madrasa A invoice) returns 404');
    assert(directPaymentRes.status === 404, '8.6 Direct GET /payments/:id (Madrasa A payment) returns 404');
    assert(directSalarySlipRes.status === 404, '8.7 Direct GET /ustadh-salaries/:id/slip (Madrasa A salary) returns 404');
    assert(directBreakPatchRes.status === 404, '8.8 Direct PATCH /timetable/breaks/:id (Madrasa A break) returns 404');

    // Verify response body does not reveal ownership or foreign data
    const resString = JSON.stringify(directStudentRes.body);
    assert(!resString.includes('Madrasa A') && !resString.includes(madrasaA.id), '8.9 404 response has zero Madrasa A metadata leakage');

    // =========================================================================
    // GROUP 9: CROSS-TENANT FOREIGN KEY INJECTION REJECTION
    // =========================================================================
    console.log('\n[GROUP 9] Cross-Tenant Foreign Key Injection Rejection');

    // 9.1 B attempts to create student referencing Madrasa A's classId
    const fkStudentRes = await apiRequest('/madrasa-admin/students', {
      method: 'POST',
      body: {
        admissionNo: 'ADM-B-001',
        fullName: 'New Student B',
        guardianName: 'Guardian B',
        classId: classA1.id,
      },
      token: tokenB,
    });
    assert(fkStudentRes.status === 404, '9.1 Student create referencing Madrasa A classId rejected with 404');

    // 9.2 B attempts to create schedule referencing Madrasa A's ustadhId
    const fkSchedUstadhRes = await apiRequest('/madrasa-admin/ustadh-schedules', {
      method: 'POST',
      body: {
        ustadhId: ustadhA1.id,
        classId: classA1.id,
        subjectId: subjectA1.id,
        dayOfWeek: 'MONDAY',
        startMinutes: 480,
        endMinutes: 540,
        effectiveFrom: '2026-01-01',
      },
      token: tokenB,
    });
    assert(fkSchedUstadhRes.status === 404, '9.2 Schedule create referencing Madrasa A ustadhId rejected with 404');

    // 9.3 B attempts to create break referencing Madrasa A's classId
    const fkBreakClassRes = await apiRequest('/madrasa-admin/timetable/breaks', {
      method: 'POST',
      body: {
        classId: classA1.id,
        name: 'Injected Break',
        dayOfWeek: 'MONDAY',
        startMinutes: 600,
        endMinutes: 630,
        effectiveFrom: '2026-01-01',
      },
      token: tokenB,
    });
    assert(fkBreakClassRes.status === 404, '9.3 Break create referencing Madrasa A classId rejected with 404');

    // =========================================================================
    // GROUP 10: PDF & REPORT EXPORT ISOLATION
    // =========================================================================
    console.log('\n[GROUP 10] PDF & Report Export Isolation');

    // 10.1 B attempts to export Class Timetable PDF using Madrasa A's classId
    const expClassPdf = await apiRequest(`/madrasa-admin/timetable/export/class/pdf?classId=${classA1.id}&referenceDate=2026-03-15`, { token: tokenB });
    assert(expClassPdf.status === 404, '10.1 Class Timetable PDF export with Madrasa A classId returns 404');

    // 10.2 B attempts to export Staff Timetable PDF using Madrasa A's ustadhId
    const expStaffPdf = await apiRequest(`/madrasa-admin/timetable/export/staff/pdf?ustadhId=${ustadhA1.id}&referenceDate=2026-03-15`, { token: tokenB });
    assert(expStaffPdf.status === 404, '10.2 Staff Timetable PDF export with Madrasa A ustadhId returns 404');

    // 10.3 B attempts to export Daily Attendance PDF using Madrasa A's classId
    const expAttPdf = await apiRequest(`/madrasa-admin/attendance/export/daily/pdf?classId=${classA1.id}&academicYear=2025/2026&date=2026-03-10`, { token: tokenB });
    assert(expAttPdf.status === 404, '10.3 Daily Attendance PDF export with Madrasa A classId returns 404');

    // 10.4 B attempts to export Salary Slip PDF using Madrasa A's salaryId
    const expSalaryPdf = await apiRequest(`/madrasa-admin/ustadh-salaries/${salaryA.id}/slip`, { token: tokenB });
    assert(expSalaryPdf.status === 404, '10.4 Salary slip PDF export with Madrasa A salaryId returns 404');

    // =========================================================================
    // GROUP 11: GLOBAL PUBLIC CMS / ABOUT US & ACTIVE PLANS ACCESS
    // =========================================================================
    console.log('\n[GROUP 11] Global Public Content Accessibility');

    const publicAboutRes = await apiRequest('/public/about-us');
    assert(publicAboutRes.status === 200, '11.1 Public About Us endpoint returns 200 OK');

    const publicHomeRes = await apiRequest('/public/homepage');
    assert(publicHomeRes.status === 200, '11.2 Public Homepage endpoint returns 200 OK');

  } catch (err) {
    console.error('Test execution exception:', err);
    testFailedCount++;
  } finally {
    await teardown();
  }

  console.log('\n==================================================');
  console.log(`CLEAN START TEST RESULTS: ${testPassedCount} PASSED, ${testFailedCount} FAILED`);
  console.log('==================================================\n');

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runTests();
