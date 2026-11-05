import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import http from 'http';

const TEST_PREFIX = 'acad_test_' + Date.now();

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

// Fixtures
let madrasaA = null;
let adminA = null;
let tokenA = '';

let madrasaB = null;
let adminB = null;
let tokenB = '';

async function setup() {
  console.log('\n--- Setting up Academic Structure Test Fixtures ---');
  const now = new Date();

  // 1. Subscription Plan
  const plan = await prisma.plan.upsert({
    where: { code: 'PRO_ACADEMIC_TEST' },
    update: {},
    create: {
      name: 'Pro Academic Test Plan',
      code: 'PRO_ACADEMIC_TEST',
      description: 'Academic Test Plan',
      durationMonths: 12,
      price: 15000,
      isActive: true,
    },
  });

  // 2. Tenant A
  madrasaA = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_MDA`,
      name: 'Academic Test Madrasa A',
      slug: `${TEST_PREFIX}_mda`,
      status: 'ACTIVE',
      settings: {
        create: {
          currency: 'LKR',
          timezone: 'Asia/Colombo',
        },
      },
      subscriptions: {
        create: {
          planId: plan.id,
          status: 'ACTIVE',
          startsAt: now,
          endsAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          priceAtPurchase: 15000,
          durationMonthsAtPurchase: 12,
        },
      },
    },
  });

  const pwdHash = await hashPassword('TestPass123!');
  adminA = await prisma.user.create({
    data: {
      name: 'Admin A',
      email: `${TEST_PREFIX}_adminA@test.com`,
      passwordHash: pwdHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaA.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  tokenA = signAccessToken({ userId: adminA.id, role: adminA.role, madrasaId: madrasaA.id });

  // 3. Tenant B
  madrasaB = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_MDB`,
      name: 'Academic Test Madrasa B',
      slug: `${TEST_PREFIX}_mdb`,
      status: 'ACTIVE',
      settings: {
        create: {
          currency: 'LKR',
          timezone: 'Asia/Colombo',
        },
      },
      subscriptions: {
        create: {
          planId: plan.id,
          status: 'ACTIVE',
          startsAt: now,
          endsAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          priceAtPurchase: 15000,
          durationMonthsAtPurchase: 12,
        },
      },
    },
  });

  adminB = await prisma.user.create({
    data: {
      name: 'Admin B',
      email: `${TEST_PREFIX}_adminB@test.com`,
      passwordHash: pwdHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaB.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  tokenB = signAccessToken({ userId: adminB.id, role: adminB.role, madrasaId: madrasaB.id });

  // Start HTTP Server on an ephemeral port
  await new Promise((resolve) => {
    testServer = http.createServer(app);
    testServer.listen(0, () => {
      const port = testServer.address().port;
      baseUrl = `http://localhost:${port}/api`;
      resolve();
    });
  });

  console.log(`Test server running at ${baseUrl}`);
}

async function teardown() {
  console.log('\n--- Tearing down Academic Structure Test Fixtures ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  // Cleanup DB fixtures
  const madrasaIds = [madrasaA?.id, madrasaB?.id].filter(Boolean);
  if (madrasaIds.length > 0) {
    await prisma.activityLog.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.receipt.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.paymentAllocation.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.payment.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.invoiceItem.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.invoice.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.studentFeeSetting.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.student.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.class.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.academicSection.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.subscriptionPayment.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.subscription.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.madrasaSetting.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.user.deleteMany({ where: { madrasaId: { in: madrasaIds } } });
    await prisma.madrasa.deleteMany({ where: { id: { in: madrasaIds } } });
  }

  await prisma.$disconnect();
}

async function runTests() {
  await setup();

  let sectionHifzId = '';
  let sectionKitabId = '';
  let classHifz1Id = '';
  let classKitab1Id = '';
  let legacyClassId = '';
  let student1Id = '';

  console.log('\n=== SUITE 1: DYNAMIC ACADEMIC SECTIONS CRUD ===');

  // Test 1: Create Academic Section
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/academic-sections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Hifz Section',
        code: 'HIFZ',
        description: 'Quran Memorization Division',
        sortOrder: 1,
      }),
    });
    const body = await res.json();
    assert(res.status === 201, 'POST /academic-sections returns 201 Created');
    assert(body.data.name === 'Hifz Section', 'Section name is set correctly');
    assert(body.data.code === 'HIFZ', 'Section code is set correctly');
    assert(body.data.isActive === true, 'New section is active by default');
    sectionHifzId = body.data.id;
  }

  // Test 2: Section name uniqueness within tenant
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/academic-sections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Hifz Section',
        code: 'HIFZ2',
      }),
    });
    assert(res.status === 409, 'Duplicate section name within same madrasa returns 409 Conflict');
  }

  // Test 3: Multi-tenant section name isolation (Madrasa B CAN create "Hifz Section")
  let sectionHifzBId = '';
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/academic-sections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        name: 'Hifz Section',
        code: 'HIFZ',
      }),
    });
    assert(res.status === 201, 'Madrasa B can create section with same name without collision (Multi-tenant isolation)');
    const body = await res.json();
    sectionHifzBId = body.data.id;
  }

  // Test 4: Create second section in Madrasa A (Kitab)
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/academic-sections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Kitab Section',
        code: 'KITAB',
        sortOrder: 2,
      }),
    });
    const body = await res.json();
    assert(res.status === 201, 'Created second section (Kitab) in Madrasa A');
    sectionKitabId = body.data.id;
  }

  // Test 5: List sections
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/academic-sections`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const body = await res.json();
    assert(res.status === 200, 'GET /academic-sections returns 200 OK');
    assert(body.data.items.length === 2, 'Lists both sections in Madrasa A');
    assert(body.data.items[0].name === 'Hifz Section', 'Sorted by sortOrder asc');
  }

  // Test 6: Cross-tenant access protection
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/academic-sections/${sectionHifzId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(res.status === 404, 'Madrasa B cannot access Madrasa A section (returns 404 NotFound)');
  }

  // Test 7: Update Section
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/academic-sections/${sectionHifzId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        description: 'Updated Quran Memorization Description',
      }),
    });
    const body = await res.json();
    assert(res.status === 200, 'PATCH /academic-sections/:id returns 200 OK');
    assert(body.data.description === 'Updated Quran Memorization Description', 'Section description updated');
  }

  // Test 8: Deactivate Section
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/academic-sections/${sectionKitabId}/deactivate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(res.status === 200, 'POST /academic-sections/:id/deactivate returns 200 OK');
  }

  // Test 9: Reactivate Section
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/academic-sections/${sectionKitabId}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(res.status === 200, 'POST /academic-sections/:id/activate returns 200 OK');
  }

  console.log('\n=== SUITE 2: DYNAMIC CLASSES UNDER SECTIONS ===');

  // Test 10: New class requires academicSectionId
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/classes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Class Without Section',
        defaultMonthlyFee: '2500',
      }),
    });
    assert(res.status === 400, 'Creating class without academicSectionId rejected with 400 Bad Request');
  }

  // Test 11: Create class under cross-tenant section rejected
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/classes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        name: 'Cross Tenant Class',
        academicSectionId: sectionHifzId, // belongs to A!
        defaultMonthlyFee: '2500',
      }),
    });
    assert(res.status === 404, 'Creating class with cross-tenant academicSectionId rejected with 404 NotFound');
  }

  // Test 12: Create class under Hifz Section
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/classes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        academicSectionId: sectionHifzId,
        name: 'Year 1',
        code: 'HIFZ-Y1',
        defaultMonthlyFee: '3000',
      }),
    });
    const body = await res.json();
    assert(res.status === 201, 'Class created under Hifz section successfully');
    assert(body.data.academicSectionId === sectionHifzId, 'Class stores academicSectionId');
    assert(body.data.sectionName === 'Hifz Section', 'Class returns sectionName');
    classHifz1Id = body.data.id;
  }

  // Test 13: Duplicate class name within same section rejected
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/classes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        academicSectionId: sectionHifzId,
        name: 'Year 1',
        code: 'HIFZ-Y1-ALT',
        defaultMonthlyFee: '3000',
      }),
    });
    assert(res.status === 409, 'Duplicate class name within same section rejected with 409 Conflict');
  }

  // Test 14: Same class name in a DIFFERENT section allowed
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/classes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        academicSectionId: sectionKitabId,
        name: 'Year 1', // Same name, different section!
        code: 'KITAB-Y1',
        defaultMonthlyFee: '4000',
      }),
    });
    assert(res.status === 201, 'Same class name allowed in different section within same Madrasa');
    const body = await res.json();
    classKitab1Id = body.data.id;
  }

  // Test 14b: Madrasa A and Madrasa B can each independently create: Hifz → Year 1 (Class A)
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/classes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        academicSectionId: sectionHifzBId,
        name: 'Year 1', // Same name as Madrasa A's class under Hifz!
        code: 'HIFZ-Y1-MDB',
        defaultMonthlyFee: '3500',
      }),
    });
    assert(res.status === 201, 'Madrasa A and B independently create Hifz → Class A without collision');
  }

  // Test 15: Legacy class with null section compatibility & unassigned prevention
  {
    // Create a legacy class directly in DB with academicSectionId: null
    const legacy = await prisma.class.create({
      data: {
        madrasaId: madrasaA.id,
        name: 'Legacy Unassigned Class',
        code: 'LEGACY',
        defaultMonthlyFee: 2000,
        isActive: true,
      },
    });
    legacyClassId = legacy.id;

    // List classes filtered by section
    const res = await fetch(`${baseUrl}/madrasa-admin/classes?academicSectionId=${sectionHifzId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const body = await res.json();
    assert(res.status === 200, 'Filter classes by academicSectionId works');
    assert(body.data.items.length === 1 && body.data.items[0].id === classHifz1Id, 'Only Hifz classes returned');

    // List unassigned classes
    const resUnassigned = await fetch(`${baseUrl}/madrasa-admin/classes?academicSectionId=UNASSIGNED`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const bodyUnassigned = await resUnassigned.json();
    assert(bodyUnassigned.data.items.some((c) => c.id === legacyClassId), 'UNASSIGNED filter returns legacy class');

    // Assign legacy class to Kitab section
    const resAssign = await fetch(`${baseUrl}/madrasa-admin/classes/${legacyClassId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        academicSectionId: sectionKitabId,
      }),
    });
    assert(resAssign.status === 200, 'Legacy unassigned class can be assigned to an active section');

    // Invariant: Once assigned, cannot reset academicSectionId to null
    const resUnassign = await fetch(`${baseUrl}/madrasa-admin/classes/${legacyClassId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        academicSectionId: null,
      }),
    });
    assert(resUnassign.status === 400, 'Assigned class cannot be unassigned back to null (rejected with 400)');
  }

  console.log('\n=== SUITE 3: STUDENT ENROLLMENT & CASCADING SELECTION ===');

  // Test 16: Create Student with class belonging to Hifz
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        admissionNo: `${TEST_PREFIX}_STU1`,
        fullName: 'Zayd ibn Thabit',
        academicSectionId: sectionHifzId,
        classId: classHifz1Id,
        guardianName: 'Thabit',
        guardianPhone: '0771234567',
      }),
    });
    const body = await res.json();
    assert(res.status === 201, 'Student created with section-compatible class');
    assert(body.data.classId === classHifz1Id, 'Student classId stored');
    assert(body.data.class.academicSectionId === sectionHifzId, 'Student class has correct academicSectionId');
    assert(body.data.sectionName === 'Hifz Section', 'Student returns sectionName');
    assert(body.data.effectiveMonthlyFee === '3000.00', 'Student fee resolved from class default');
    student1Id = body.data.id;
  }

  // Test 17: Mismatch between academicSectionId and classId rejected
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        admissionNo: `${TEST_PREFIX}_STU2`,
        fullName: 'Ali ibn Abi Talib',
        academicSectionId: sectionKitabId, // Kitab selected...
        classId: classHifz1Id, // ...but class belongs to Hifz!
        guardianName: 'Abu Talib',
      }),
    });
    assert(res.status === 400, 'Student creation with mismatching section and class rejected with 400 Bad Request');
  }

  // Test 18: Filter students by academicSectionId
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/students?academicSectionId=${sectionHifzId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const body = await res.json();
    assert(res.status === 200, 'GET /students?academicSectionId=... returns 200 OK');
    assert(body.data.items.some((s) => s.id === student1Id), 'Student 1 present in Hifz section filter');
  }

  // Test 19: Fee POS search returns student with academic section info
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/pos/search?q=Zayd`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const body = await res.json();
    assert(res.status === 200, 'GET /pos/search returns 200 OK');
    assert(body.data.length > 0, 'POS search finds student');
    assert(body.data[0].class?.academicSectionId === sectionHifzId, 'POS student result includes section details');
    assert(body.data[0].sectionName === 'Hifz Section', 'POS student result includes sectionName');
  }

  console.log('\n=== SUITE 4: SECTION METRICS & ACTIVITY AUDIT LOGGING ===');

  // Test 20: Section details include classCount and studentCount metrics
  {
    const res = await fetch(`${baseUrl}/madrasa-admin/academic-sections/${sectionHifzId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const body = await res.json();
    assert(res.status === 200, 'GET /academic-sections/:id returns 200 OK');
    assert(body.data.classCount === 1, 'Hifz section reports classCount = 1');
    assert(body.data.totalStudents === 1, 'Hifz section reports totalStudents = 1');
    assert(body.data.classes[0].name === 'Year 1', 'Hifz section lists child classes');
  }

  // Test 21: Activity logs created for section actions
  {
    const logs = await prisma.activityLog.findMany({
      where: {
        madrasaId: madrasaA.id,
        entityType: 'ACADEMIC_SECTION',
      },
    });
    assert(logs.length >= 2, 'Activity logs recorded for SECTION_CREATED, SECTION_UPDATED');
    assert(logs.some((l) => l.action === 'SECTION_CREATED'), 'SECTION_CREATED action logged');
  }

  // Test 22: Student.classId remains unchanged for existing students
  {
    const studentCheck = await prisma.student.findUnique({
      where: { id: student1Id },
      select: { id: true, classId: true },
    });
    assert(studentCheck.classId === classHifz1Id, 'Student.classId remains strictly unchanged for existing students');
  }

  // Test 23: Section deactivation does not remove existing Classes/Students
  {
    // Deactivate Hifz section
    await fetch(`${baseUrl}/madrasa-admin/academic-sections/${sectionHifzId}/deactivate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const classStillExists = await prisma.class.findUnique({
      where: { id: classHifz1Id },
      select: { id: true, academicSectionId: true },
    });
    assert(classStillExists !== null, 'Child class remains intact after section deactivation');
    assert(classStillExists.academicSectionId === sectionHifzId, 'Child class maintains section link after section deactivation');

    const studentStillExists = await prisma.student.findUnique({
      where: { id: student1Id },
      select: { id: true, classId: true },
    });
    assert(studentStillExists !== null, 'Enrolled student remains intact after section deactivation');
    assert(studentStillExists.classId === classHifz1Id, 'Enrolled student maintains class link after section deactivation');
  }

  // Test 24: Existing Class IDs remain unchanged
  {
    const hifzClass = await prisma.class.findUnique({
      where: { id: classHifz1Id },
      select: { id: true, name: true, code: true },
    });
    const kitabClass = await prisma.class.findUnique({
      where: { id: classKitab1Id },
      select: { id: true, name: true, code: true },
    });
    const legacyClass = await prisma.class.findUnique({
      where: { id: legacyClassId },
      select: { id: true, name: true, code: true },
    });
    assert(hifzClass && hifzClass.id === classHifz1Id, 'Hifz Class ID is strictly unchanged');
    assert(kitabClass && kitabClass.id === classKitab1Id, 'Kitab Class ID is strictly unchanged');
    assert(legacyClass && legacyClass.id === legacyClassId, 'Legacy Class ID is strictly unchanged');
  }

  console.log(`\n-----------------------------------------`);
  console.log(`Total Passed: ${testPassedCount}`);
  console.log(`Total Failed: ${testFailedCount}`);
  console.log(`-----------------------------------------`);

  await teardown();

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(async (err) => {
  console.error('Fatal test error:', err);
  await teardown();
  process.exit(1);
});
