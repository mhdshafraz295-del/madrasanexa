process.env.NODE_ENV = 'test';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';

const TEST_PREFIX = 'u1_dash_' + Date.now();

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${name}`);
    failed++;
  }
}

let testServer = null;
let baseUrl = '';

let superAdminUser = null;
let superAdminToken = '';

let madrasaA = null;
let madrasaAdminA = null;
let tokenA = '';

let madrasaB = null;
let madrasaAdminB = null;
let tokenB = '';

let planA = null;
let subA = null;
let subB = null;

async function setup() {
  console.log('\n--- Setting up Unit 1 Dashboard Test Fixtures ---');

  // 1. Create Super Admin
  superAdminUser = await prisma.user.create({
    data: {
      name: 'U1 Super Admin',
      email: `${TEST_PREFIX}_super@example.com`,
      passwordHash: await hashPassword('SuperSecureP@ss123!'),
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

  // 2. Create Plan
  planA = await prisma.plan.create({
    data: {
      name: 'U1 Plan 1',
      code: `${TEST_PREFIX}_P1`,
      price: 1500.0,
      durationMonths: 12,
      isActive: true,
    },
  });

  const now = new Date();

  // 3. Create Madrasa A & Admin
  madrasaA = await prisma.madrasa.create({
    data: {
      name: 'U1 Madrasa A',
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}A1`,
      slug: `${TEST_PREFIX}-m-a`,
      email: `${TEST_PREFIX}_a@example.com`,
      status: 'ACTIVE',
      settings: {
        create: {
          invoicePrefix: 'INVA-',
          receiptPrefix: 'RECA-',
          currency: 'LKR',
          timezone: 'Asia/Colombo',
        },
      },
    },
  });

  madrasaAdminA = await prisma.user.create({
    data: {
      name: 'U1 Admin A',
      email: `${TEST_PREFIX}_admin_a@example.com`,
      passwordHash: await hashPassword('AdminSecureP@ss123!'),
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaA.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  tokenA = signAccessToken({
    userId: madrasaAdminA.id,
    role: madrasaAdminA.role,
    madrasaId: madrasaA.id,
  });

  subA = await prisma.subscription.create({
    data: {
      madrasaId: madrasaA.id,
      planId: planA.id,
      status: 'ACTIVE',
      startsAt: now,
      endsAt: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
      priceAtPurchase: 1500.0,
      durationMonthsAtPurchase: 12,
    },
  });

  // 4. Create Madrasa B & Admin
  madrasaB = await prisma.madrasa.create({
    data: {
      name: 'U1 Madrasa B',
      code: `${TEST_PREFIX.slice(-6).toUpperCase()}B1`,
      slug: `${TEST_PREFIX}-m-b`,
      email: `${TEST_PREFIX}_b@example.com`,
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

  madrasaAdminB = await prisma.user.create({
    data: {
      name: 'U1 Admin B',
      email: `${TEST_PREFIX}_admin_b@example.com`,
      passwordHash: await hashPassword('AdminSecureP@ss123!'),
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaB.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  tokenB = signAccessToken({
    userId: madrasaAdminB.id,
    role: madrasaAdminB.role,
    madrasaId: madrasaB.id,
  });

  subB = await prisma.subscription.create({
    data: {
      madrasaId: madrasaB.id,
      planId: planA.id,
      status: 'ACTIVE',
      startsAt: now,
      endsAt: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
      priceAtPurchase: 1500.0,
      durationMonthsAtPurchase: 12,
    },
  });

  // 5. Start ephemeral test server
  await new Promise((resolve) => {
    testServer = app.listen(0, () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

async function runTests() {
  console.log('\n=============================================');
  console.log('UNIT 1: DASHBOARD ENHANCEMENTS TEST SUITE');
  console.log('=============================================');

  // ----------------------------------------------------
  // TEST GROUP 1: Madrasa Admin Dashboard Empty States
  // ----------------------------------------------------
  console.log('\n[GROUP 1] Madrasa Admin Dashboard - Teacher & Section Empty States');
  const emptyDashRes = await fetch(`${baseUrl}/api/madrasa-admin/dashboard`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const emptyDashJson = await emptyDashRes.json();

  assert(emptyDashRes.status === 200, 'GET /madrasa-admin/dashboard returns 200 OK');
  assert(emptyDashJson.success === true, 'Response contains success: true');
  assert(emptyDashJson.data?.teacherStats !== undefined, 'Response contains teacherStats');
  assert(emptyDashJson.data?.teacherStats?.totalTeachers === 0, 'Empty totalTeachers is 0');
  assert(emptyDashJson.data?.teacherStats?.activeTeachers === 0, 'Empty activeTeachers is 0');
  assert(emptyDashJson.data?.teacherStats?.ustadhCount === 0, 'Empty ustadhCount is 0');
  assert(emptyDashJson.data?.teacherStats?.schoolTeacherCount === 0, 'Empty schoolTeacherCount is 0');
  assert(emptyDashJson.data?.teacherStats?.teachersWithClasses === 0, 'Empty teachersWithClasses is 0');
  assert(emptyDashJson.data?.academicGroupStats !== undefined, 'Response contains academicGroupStats');
  assert(emptyDashJson.data?.academicGroupStats?.totalSections === 0, 'Empty totalSections is 0');
  assert(Array.isArray(emptyDashJson.data?.academicGroupStats?.sections), 'sections is an array');

  // ----------------------------------------------------
  // TEST GROUP 2: Teacher & Student Groups with Data
  // ----------------------------------------------------
  console.log('\n[GROUP 2] Teacher & Section Group Calculations with Tenant Data');

  // Create Teachers in Madrasa A
  const ustadhA1 = await prisma.ustadh.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhCode: `${TEST_PREFIX}_U01`,
      fullName: 'Ustadh Zayd',
      staffType: 'USTADH',
      joinDate: new Date('2026-01-01'),
      baseMonthlySalary: 30000.0,
      isActive: true,
    },
  });

  const teacherA2 = await prisma.ustadh.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhCode: `${TEST_PREFIX}_U02`,
      fullName: 'Teacher Bilal',
      staffType: 'SCHOOL_TEACHER',
      joinDate: new Date('2026-02-01'),
      baseMonthlySalary: 25000.0,
      isActive: true,
    },
  });

  // Create Inactive Teacher in Madrasa A
  const teacherA3Inactive = await prisma.ustadh.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhCode: `${TEST_PREFIX}_U03`,
      fullName: 'Former Ustadh',
      staffType: 'USTADH',
      joinDate: new Date('2025-01-01'),
      leaveDate: new Date('2026-01-01'),
      baseMonthlySalary: 20000.0,
      isActive: false,
    },
  });

  // Create Section & Class in Madrasa A
  const sectionA1 = await prisma.academicSection.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Hifz Section',
      code: 'HIFZ',
      sortOrder: 1,
      isActive: true,
    },
  });

  const classA1 = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      academicSectionId: sectionA1.id,
      name: 'Hifz Class 1',
      code: 'HIFZ1',
      defaultMonthlyFee: 2000.0,
      isActive: true,
    },
  });

  // Create Student in Madrasa A under Section A1
  const studentA1 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: `${TEST_PREFIX}_ADM01`,
      fullName: 'Talib Ilm 1',
      guardianName: 'Wali 1',
      admissionDate: new Date('2026-01-01'),
      monthlyFee: 2000.0,
      status: 'ACTIVE',
    },
  });

  // Assign Schedule to Ustadh A1 for Class A1
  const subjectA1 = await prisma.subject.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Quran Memorization',
      code: 'QURAN_MEM',
      isActive: true,
    },
  });

  const scheduleA1 = await prisma.ustadhSchedule.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhId: ustadhA1.id,
      classId: classA1.id,
      subjectId: subjectA1.id,
      dayOfWeek: 'MONDAY',
      startMinutes: 480, // 08:00
      endMinutes: 540,   // 09:00
      effectiveFrom: new Date('2026-01-01'),
      isActive: true,
    },
  });

  // Create Teacher and Section in Madrasa B to test tenant isolation
  const ustadhB1 = await prisma.ustadh.create({
    data: {
      madrasaId: madrasaB.id,
      ustadhCode: `${TEST_PREFIX}_UB1`,
      fullName: 'Ustadh Tariq Madrasa B',
      staffType: 'USTADH',
      joinDate: new Date('2026-01-01'),
      baseMonthlySalary: 35000.0,
      isActive: true,
    },
  });

  // Fetch Madrasa A Dashboard
  const dashARes = await fetch(`${baseUrl}/api/madrasa-admin/dashboard`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dashAJson = await dashARes.json();
  const tStats = dashAJson.data?.teacherStats;
  const gStats = dashAJson.data?.academicGroupStats;

  assert(tStats?.totalTeachers === 3, 'Counts exactly 3 teachers for Madrasa A (excludes Madrasa B)');
  assert(tStats?.activeTeachers === 2, 'Counts exactly 2 active teachers for Madrasa A');
  assert(tStats?.ustadhCount === 2, 'Counts 2 USTADH staff (1 active + 1 inactive)');
  assert(tStats?.schoolTeacherCount === 1, 'Counts 1 SCHOOL_TEACHER staff');
  assert(tStats?.teachersWithClasses === 1, 'Counts exactly 1 teacher with assigned active schedule');
  assert(tStats?.classesWithTeachers === 1, 'Counts exactly 1 class assigned to a teacher');
  assert(gStats?.totalSections === 1, 'Counts 1 active section for Madrasa A');
  assert(gStats?.sections?.length === 1, 'Sections list has 1 item');
  assert(gStats?.sections?.[0]?.studentCount === 1, 'Section student count reflects active student');
  assert(gStats?.sections?.[0]?.classCount === 1, 'Section class count reflects active class');

  // ----------------------------------------------------
  // TEST GROUP 3: Super Admin Dashboard - Bank Verification Stats
  // ----------------------------------------------------
  console.log('\n[GROUP 3] Super Admin Dashboard - Bank Submission Stats');

  // Verify non-Super Admin is blocked
  const forbiddenRes = await fetch(`${baseUrl}/api/super-admin/dashboard`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(forbiddenRes.status === 403, 'Madrasa Admin request to Super Admin dashboard rejected with 403 Forbidden');

  // Create FileObject for receipt
  const receiptFile = await prisma.fileObject.create({
    data: {
      madrasaId: madrasaA.id,
      type: 'SUBSCRIPTION_RECEIPT',
      objectKey: `madrasas/${madrasaA.id}/receipts/${TEST_PREFIX}_receipt.png`,
      originalName: 'receipt.png',
      mimeType: 'image/png',
      size: 1024,
    },
  });

  // Create SubscriptionPaymentSubmissions (1 PENDING, 1 APPROVED)
  const now = new Date();
  const subPending = await prisma.subscriptionPaymentSubmission.create({
    data: {
      madrasaId: madrasaA.id,
      planId: planA.id,
      submittedAmount: 1500.0,
      paymentDate: now,
      reference: 'TXN12345',
      receiptFileId: receiptFile.id,
      status: 'PENDING',
    },
  });

  const subApproved = await prisma.subscriptionPaymentSubmission.create({
    data: {
      madrasaId: madrasaB.id,
      planId: planA.id,
      submittedAmount: 1500.0,
      paymentDate: now,
      reference: 'TXN67890',
      receiptFileId: receiptFile.id,
      status: 'APPROVED',
      reviewedByUserId: superAdminUser.id,
      reviewedAt: now,
    },
  });

  // Super Admin requests dashboard
  const saDashRes = await fetch(`${baseUrl}/api/super-admin/dashboard`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const saDashJson = await saDashRes.json();

  assert(saDashRes.status === 200, 'Super Admin GET /super-admin/dashboard returns 200 OK');
  assert(saDashJson.success === true, 'Response contains success: true');
  assert(saDashJson.data?.bankSubmissions !== undefined, 'Response contains bankSubmissions object');
  assert(typeof saDashJson.data?.bankSubmissions?.total === 'number', 'bankSubmissions.total is a number');
  assert(typeof saDashJson.data?.bankSubmissions?.pending === 'number', 'bankSubmissions.pending is a number');
  assert(typeof saDashJson.data?.bankSubmissions?.approved === 'number', 'bankSubmissions.approved is a number');
  assert(typeof saDashJson.data?.bankSubmissions?.rejected === 'number', 'bankSubmissions.rejected is a number');
  assert(saDashJson.data?.bankSubmissions?.pending >= 1, 'bankSubmissions.pending reflects at least 1 pending submission');
  assert(saDashJson.data?.bankSubmissions?.approved >= 1, 'bankSubmissions.approved reflects at least 1 approved submission');
  assert(saDashJson.data?.counts?.pendingBankSubmissions !== undefined, 'counts includes pendingBankSubmissions');
}

async function teardown() {
  console.log('\n--- Tearing Down Test Fixtures ---');
  if (testServer) {
    testServer.close();
  }

  try {
    // Delete in reverse foreign key order
    await prisma.subscriptionPaymentSubmission.deleteMany({
      where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id].filter(Boolean) } },
    });
    await prisma.fileObject.deleteMany({
      where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id].filter(Boolean) } },
    });
    await prisma.ustadhSchedule.deleteMany({
      where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id].filter(Boolean) } },
    });
    await prisma.subject.deleteMany({
      where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id].filter(Boolean) } },
    });
    await prisma.student.deleteMany({
      where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id].filter(Boolean) } },
    });
    await prisma.class.deleteMany({
      where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id].filter(Boolean) } },
    });
    await prisma.academicSection.deleteMany({
      where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id].filter(Boolean) } },
    });
    await prisma.ustadh.deleteMany({
      where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id].filter(Boolean) } },
    });
    await prisma.subscription.deleteMany({
      where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id].filter(Boolean) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [superAdminUser?.id, madrasaAdminA?.id, madrasaAdminB?.id].filter(Boolean) } },
    });
    await prisma.madrasaSetting.deleteMany({
      where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id].filter(Boolean) } },
    });
    await prisma.madrasa.deleteMany({
      where: { id: { in: [madrasaA?.id, madrasaB?.id].filter(Boolean) } },
    });
    await prisma.plan.deleteMany({
      where: { id: planA?.id },
    });
  } catch (e) {
    console.error('Teardown error:', e.message);
  }

  console.log('\n=============================================');
  console.log(`Unit 1 Results: ${passed} Passed, ${failed} Failed`);
  console.log('=============================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

async function main() {
  try {
    await setup();
    await runTests();
  } catch (err) {
    console.error('Fatal error during test run:', err);
    failed++;
  } finally {
    await teardown();
  }
}

main();
