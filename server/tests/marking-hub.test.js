import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import http from 'http';
import {
  DEFAULT_GPA_SCALE,
  validateGpaScale,
  calculateStudentGpa,
  calculateStudentResults,
  calculateClassPositions,
  calculateClassAnalytics,
} from '../src/services/marking-calculation.service.js';
import { escapeCsvCell } from '../src/services/csv-report.service.js';
import { closeSharedBrowser } from '../src/services/pdf-report.service.js';

const TEST_PREFIX = 'mh_test_' + Date.now();

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
let classA1 = null;
let classA2 = null;
let studentA1 = null;
let studentA2 = null;
let studentA3 = null;

let madrasaB = null;
let adminB = null;
let tokenB = '';
let classB1 = null;
let studentB1 = null;

let madrasaC = null;
let adminC = null;
let tokenC = '';

async function setup() {
  console.log('\n--- Setting up Marking Hub Test Fixtures ---');
  const now = new Date();

  // Subscription Plan
  const plan = await prisma.plan.upsert({
    where: { code: 'PRO_MARKING_TEST' },
    update: {},
    create: {
      name: 'Pro Marking Test Plan',
      code: 'PRO_MARKING_TEST',
      description: 'Test Plan',
      durationMonths: 12,
      price: 15000,
      isActive: true,
    },
  });

  // 1. Madrasa A (Active)
  madrasaA = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_MDA`,
      name: 'Madrasa A Marking Test',
      slug: `${TEST_PREFIX}_mda`,
      status: 'ACTIVE',
      settings: {
        create: {
          currency: 'LKR',
          timezone: 'Asia/Colombo',
          academicYear: '2026',
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

  const pwdHash = await hashPassword('TestPassword123!');
  adminA = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}_adminA@test.com`,
      name: 'Admin A',
      passwordHash: pwdHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaA.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  tokenA = signAccessToken({ userId: adminA.id, role: adminA.role, madrasaId: madrasaA.id });

  // Class A1 and Class A2
  classA1 = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Grade 7 - Hifz',
      code: `${TEST_PREFIX}_G7H`,
      defaultMonthlyFee: 2500,
      isActive: true,
    },
  });

  classA2 = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Grade 8 - Kitab',
      code: `${TEST_PREFIX}_G8K`,
      defaultMonthlyFee: 3000,
      isActive: true,
    },
  });

  // Students in Class A1
  studentA1 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: `${TEST_PREFIX}_ADM001`,
      fullName: 'Ahmed Farooq',
      guardianName: 'Farooq Ali',
      admissionDate: now,
      status: 'ACTIVE',
    },
  });

  studentA2 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: `${TEST_PREFIX}_ADM002`,
      fullName: 'Bilal Hassan',
      guardianName: 'Hassan Omar',
      admissionDate: now,
      status: 'ACTIVE',
    },
  });

  studentA3 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: `${TEST_PREFIX}_ADM003`,
      fullName: '=Danger Formula Student',
      guardianName: 'Formula Guardian',
      admissionDate: now,
      status: 'ACTIVE',
    },
  });

  // 2. Madrasa B (Active Tenant for isolation tests)
  madrasaB = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_MDB`,
      name: 'Madrasa B Marking Test',
      slug: `${TEST_PREFIX}_mdb`,
      status: 'ACTIVE',
      settings: {
        create: {
          currency: 'LKR',
          timezone: 'Asia/Colombo',
          academicYear: '2026',
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
      email: `${TEST_PREFIX}_adminB@test.com`,
      name: 'Admin B',
      passwordHash: pwdHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaB.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  tokenB = signAccessToken({ userId: adminB.id, role: adminB.role, madrasaId: madrasaB.id });

  classB1 = await prisma.class.create({
    data: {
      madrasaId: madrasaB.id,
      name: 'Grade 9 - Madrasa B',
      code: `${TEST_PREFIX}_G9B`,
      defaultMonthlyFee: 2000,
      isActive: true,
    },
  });

  studentB1 = await prisma.student.create({
    data: {
      madrasaId: madrasaB.id,
      classId: classB1.id,
      admissionNo: `${TEST_PREFIX}_ADMB01`,
      fullName: 'Zayd B',
      guardianName: 'Guardian B',
      admissionDate: now,
      status: 'ACTIVE',
    },
  });

  // 3. Madrasa C (EXPIRED subscription for gate test)
  madrasaC = await prisma.madrasa.create({
    data: {
      code: `${TEST_PREFIX}_MDC`,
      name: 'Madrasa C Expired Test',
      slug: `${TEST_PREFIX}_mdc`,
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
          status: 'EXPIRED',
          startsAt: new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000),
          endsAt: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
          priceAtPurchase: 15000,
          durationMonthsAtPurchase: 12,
        },
      },
    },
  });

  adminC = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}_adminC@test.com`,
      name: 'Admin C',
      passwordHash: pwdHash,
      role: 'MADRASA_ADMIN',
      madrasaId: madrasaC.id,
      isActive: true,
      mustChangePassword: false,
    },
  });
  tokenC = signAccessToken({ userId: adminC.id, role: adminC.role, madrasaId: madrasaC.id });

  // Start HTTP Server
  await new Promise((resolve) => {
    testServer = http.createServer(app);
    testServer.listen(0, () => {
      const port = testServer.address().port;
      baseUrl = `http://localhost:${port}/api/madrasa-admin`;
      console.log(`Test server running on port ${port}`);
      resolve();
    });
  });
}

async function teardown() {
  console.log('\n--- Teardown Test Fixtures ---');
  if (testServer) {
    if (typeof testServer.closeAllConnections === 'function') {
      testServer.closeAllConnections();
    }
    await new Promise((resolve) => testServer.close(resolve));
  }
  await closeSharedBrowser();
  // Cleanup test records
  try {
    await prisma.studentMark.deleteMany({ where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id, madrasaC?.id].filter(Boolean) } } });
    await prisma.markingAssessmentSubject.deleteMany({ where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id, madrasaC?.id].filter(Boolean) } } });
    await prisma.markingAssessment.deleteMany({ where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id, madrasaC?.id].filter(Boolean) } } });
    await prisma.subject.deleteMany({ where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id, madrasaC?.id].filter(Boolean) } } });
    await prisma.student.deleteMany({ where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id, madrasaC?.id].filter(Boolean) } } });
    await prisma.class.deleteMany({ where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id, madrasaC?.id].filter(Boolean) } } });
    await prisma.activityLog.deleteMany({ where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id, madrasaC?.id].filter(Boolean) } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminA?.id, adminB?.id, adminC?.id].filter(Boolean) } } });
    await prisma.subscription.deleteMany({ where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id, madrasaC?.id].filter(Boolean) } } });
    await prisma.madrasaSetting.deleteMany({ where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id, madrasaC?.id].filter(Boolean) } } });
    await prisma.madrasa.deleteMany({ where: { id: { in: [madrasaA?.id, madrasaB?.id, madrasaC?.id].filter(Boolean) } } });
  } catch (err) {
    console.error('Teardown error:', err.message);
  }
  await prisma.$disconnect();
}

async function runTests() {
  let assessmentA1 = null;
  let subQuran = null;
  let subArabic = null;
  let subFiqh = null;
  let subHadith = null;
  let asQuran = null;
  let asArabic = null;
  let asFiqh = null;
  let asHadith = null;

  console.log('\n=== SECTION 1: PURE CALCULATION ENGINE TESTS ===');
  {
    // GPA Scale Validation
    const validCheck = validateGpaScale(DEFAULT_GPA_SCALE);
    assert(validCheck.valid === true, 'validateGpaScale accepts standard 7-tier default scale');

    const invalidCheck = validateGpaScale([
      { minPercentage: 80, maxPercentage: 100, gpa: 4.0 },
      { minPercentage: 70, maxPercentage: 85, gpa: 3.5 }, // overlap!
    ]);
    assert(invalidCheck.valid === false, 'validateGpaScale rejects overlapping percentage bands');

    // GPA Mapping
    assert(calculateStudentGpa(71.25, DEFAULT_GPA_SCALE) === 3.00, 'calculateStudentGpa maps 71.25% to 3.00');
    assert(calculateStudentGpa(88.50, DEFAULT_GPA_SCALE) === 4.00, 'calculateStudentGpa maps 88.50% to 4.00');
    assert(calculateStudentGpa(63.75, DEFAULT_GPA_SCALE) === 2.50, 'calculateStudentGpa maps 63.75% to 2.50');
    assert(calculateStudentGpa(35.00, DEFAULT_GPA_SCALE) === 0.00, 'calculateStudentGpa maps 35.00% to 0.00');
    assert(calculateStudentGpa(null, DEFAULT_GPA_SCALE) === null, 'calculateStudentGpa returns null for null/blank');

    // Competition Tie Ranking
    const rankTest = calculateClassPositions([
      { studentId: 's1', isComplete: true, overallPercentage: 91.50 },
      { studentId: 's2', isComplete: true, overallPercentage: 88.00 },
      { studentId: 's3', isComplete: true, overallPercentage: 88.00 },
      { studentId: 's4', isComplete: true, overallPercentage: 82.00 },
      { studentId: 's5', isComplete: false, overallPercentage: null },
    ]);
    const r1 = rankTest.find((s) => s.studentId === 's1');
    const r2 = rankTest.find((s) => s.studentId === 's2');
    const r3 = rankTest.find((s) => s.studentId === 's3');
    const r4 = rankTest.find((s) => s.studentId === 's4');
    const r5 = rankTest.find((s) => s.studentId === 's5');
    assert(r1.position === 1, 'Rank 1 is assigned to 91.50%');
    assert(r2.position === 2, 'Rank 2 is assigned to first 88.00%');
    assert(r3.position === 2, 'Rank 2 is assigned to tied 88.00%');
    assert(r4.position === 4, 'Rank 4 is assigned to 82.00% (competition ranking skips 3)');
    assert(r5.position === null, 'Incomplete student receives null position');
  }

  console.log('\n=== SECTION 2: CANONICAL SUBJECT & ASSESSMENT CREATION ===');
  {
    // 1. Create canonical subjects via API
    const resQ = await fetch(`${baseUrl}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Qur\'an', code: 'QUR' }),
    });
    const dataQ = await resQ.json();
    assert(resQ.status === 201 && dataQ.data.name === 'Qur\'an', 'POST /subjects creates canonical Qur\'an subject');
    subQuran = dataQ.data;

    const resA = await fetch(`${baseUrl}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Arabic', code: 'ARB' }),
    });
    const dataA = await resA.json();
    subArabic = dataA.data;

    const resF = await fetch(`${baseUrl}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Fiqh', code: 'FIQ' }),
    });
    const dataF = await resF.json();
    subFiqh = dataF.data;

    const resH = await fetch(`${baseUrl}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Hadith', code: 'HAD' }),
    });
    const dataH = await resH.json();
    subHadith = dataH.data;

    // Reject duplicate subject name in same Madrasa
    const dupSub = await fetch(`${baseUrl}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Qur\'an' }),
    });
    assert(dupSub.status === 409, 'Duplicate subject name in same Madrasa is rejected with 409 Conflict');

    // 2. Create Assessment for Class A1
    const resAss = await fetch(`${baseUrl}/marking-hub/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        classId: classA1.id,
        academicYear: '2026',
        term: 'Term 2',
        name: 'Mid Term Examination',
      }),
    });
    const dataAss = await resAss.json();
    assert(resAss.status === 201 && dataAss.data.status === 'DRAFT', 'POST /marking-hub/assessments creates assessment in DRAFT status');
    assessmentA1 = dataAss.data;

    // Reject duplicate assessment context
    const dupAss = await fetch(`${baseUrl}/marking-hub/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        classId: classA1.id,
        academicYear: '2026',
        term: 'Term 2',
        name: 'Mid Term Examination',
      }),
    });
    assert(dupAss.status === 409, 'Duplicate assessment in same class, year, term is rejected with 409 Conflict');

    // Reject assessment with cross-tenant class
    const crossClassAss = await fetch(`${baseUrl}/marking-hub/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        classId: classB1.id,
        academicYear: '2026',
        term: 'Term 1',
        name: 'Illegal Cross Class',
      }),
    });
    assert(crossClassAss.status === 404, 'Assessment with cross-tenant class ID is rejected with 404 Not Found');

    // 3. Add Subjects to Assessment A1
    const addQ = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ subjectId: subQuran.id, maxMark: 100, passMark: 40, sortOrder: 1 }),
    });
    const dataAddQ = await addQ.json();
    assert(addQ.status === 201, 'POST /assessments/:id/subjects adds Qur\'an (Max 100, Pass 40)');
    asQuran = dataAddQ.data;

    const addAr = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ subjectId: subArabic.id, maxMark: 100, passMark: 40, sortOrder: 2 }),
    });
    const dataAddAr = await addAr.json();
    asArabic = dataAddAr.data;

    const addFq = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ subjectId: subFiqh.id, maxMark: 100, passMark: 40, sortOrder: 3 }),
    });
    const dataAddFq = await addFq.json();
    asFiqh = dataAddFq.data;

    const addHd = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ subjectId: subHadith.id, maxMark: 100, passMark: 40, sortOrder: 4 }),
    });
    const dataAddHd = await addHd.json();
    asHadith = dataAddHd.data;

    // Reject duplicate subject in same assessment
    const dupSubAss = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ subjectId: subQuran.id, maxMark: 100, passMark: 40 }),
    });
    assert(dupSubAss.status === 409, 'Adding existing subject again to same assessment is rejected with 409 Conflict');

    // Reject pass mark > max mark
    const badMarks = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        newSubject: { name: 'Invalid Marks Sub' },
        maxMark: 50,
        passMark: 60, // 60 > 50!
      }),
    });
    assert(badMarks.status === 400, 'Pass mark > Max mark is rejected with 400 Bad Request');
  }

  console.log('\n=== SECTION 3: NUMERIC MARK SAVE, VALIDATION & CALCULATIONS ===');
  {
    // Reject mark > maxMark
    const badMarkVal = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/marks`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        marks: [
          { studentId: studentA1.id, assessmentSubjectId: asQuran.id, mark: 105 }, // 105 > 100
        ],
      }),
    });
    assert(badMarkVal.status === 400, 'Mark exceeding maximum mark (105 > 100) is rejected with 400 Bad Request');

    // Reject negative mark
    const negMark = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/marks`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        marks: [
          { studentId: studentA1.id, assessmentSubjectId: asQuran.id, mark: -1 },
        ],
      }),
    });
    assert(negMark.status === 400, 'Negative mark (-1) is rejected with 400 Bad Request');

    // Reject student from another class
    const wrongStudent = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/marks`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        marks: [
          { studentId: studentB1.id, assessmentSubjectId: asQuran.id, mark: 80 },
        ],
      }),
    });
    assert(wrongStudent.status === 400, 'Mark for student not enrolled in selected Class is rejected with 400 Bad Request');

    // Safe bulk save:
    // Student A1: 75, 60, 70, 80 (All pass -> Total 285 / 400 = 71.25%, GPA 3.00, PASS)
    // Student A2: 75, 30, 70, 80 (Arabic 30 < 40 -> Total 255 / 400 = 63.75%, GPA 2.50, FAIL)
    // Student A3: 75, blank, 70, 80 (Arabic missing -> INCOMPLETE, Position null, GPA null)
    const saveRes = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/marks`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        marks: [
          { studentId: studentA1.id, assessmentSubjectId: asQuran.id, mark: 75 },
          { studentId: studentA1.id, assessmentSubjectId: asArabic.id, mark: 60 },
          { studentId: studentA1.id, assessmentSubjectId: asFiqh.id, mark: 70 },
          { studentId: studentA1.id, assessmentSubjectId: asHadith.id, mark: 80 },

          { studentId: studentA2.id, assessmentSubjectId: asQuran.id, mark: 75 },
          { studentId: studentA2.id, assessmentSubjectId: asArabic.id, mark: 30 },
          { studentId: studentA2.id, assessmentSubjectId: asFiqh.id, mark: 70 },
          { studentId: studentA2.id, assessmentSubjectId: asHadith.id, mark: 80 },

          { studentId: studentA3.id, assessmentSubjectId: asQuran.id, mark: 75 },
          { studentId: studentA3.id, assessmentSubjectId: asArabic.id, mark: null }, // Blank!
          { studentId: studentA3.id, assessmentSubjectId: asFiqh.id, mark: 70 },
          { studentId: studentA3.id, assessmentSubjectId: asHadith.id, mark: 80 },
        ],
      }),
    });
    const saveData = await saveRes.json();
    assert(saveRes.status === 200, 'PUT /marking-hub/assessments/:id/marks safely saves marks in transaction');

    // Verify calculated results
    const results = saveData.data.results;
    const rA1 = results.find((s) => s.studentId === studentA1.id);
    const rA2 = results.find((s) => s.studentId === studentA2.id);
    const rA3 = results.find((s) => s.studentId === studentA3.id);

    assert(rA1.totalObtained === 285 && rA1.maxPossible === 400, 'Student A1 Total is 285 / 400');
    assert(rA1.overallPercentage === 71.25, 'Student A1 Average is 71.25%');
    assert(rA1.gpa === 3.00, 'Student A1 GPA is 3.00');
    assert(rA1.overallStatus === 'PASS', 'Student A1 Status is PASS');
    assert(rA1.position === 1, 'Student A1 Position is 1');

    assert(rA2.totalObtained === 255 && rA2.maxPossible === 400, 'Student A2 Total is 255 / 400');
    assert(rA2.overallPercentage === 63.75, 'Student A2 Average is 63.75%');
    assert(rA2.gpa === 2.50, 'Student A2 GPA is 2.50');
    assert(rA2.overallStatus === 'FAIL', 'Student A2 Status is FAIL due to Arabic < 40');
    assert(rA2.position === 2, 'Student A2 Position is 2');

    assert(rA3.overallStatus === 'INCOMPLETE', 'Student A3 Status is INCOMPLETE due to blank Arabic mark');
    assert(rA3.gpa === null, 'Incomplete Student A3 GPA is null (not fabricated)');
    assert(rA3.position === null, 'Incomplete Student A3 Position is null (not ranked)');

    // Verify no letter grades or credits exist in response
    const jsonStr = JSON.stringify(saveData.data);
    assert(!jsonStr.includes('"letterGrade"'), 'No letterGrade field exists in result payload');
    assert(!jsonStr.includes('"credit"'), 'No credit field exists in result payload');

    // Class Analytics Denominators
    const analytics = saveData.data.analytics;
    assert(analytics.summary.totalStudents === 3, 'Total students is 3');
    assert(analytics.summary.completedStudents === 2, 'Completed students is 2');
    assert(analytics.summary.incompleteStudents === 1, 'Incomplete students is 1');
    // Class average: (71.25 + 63.75) / 2 = 67.50% (A3 excluded!)
    assert(analytics.summary.classAverage === 67.50, 'Class average is 67.50% (incomplete students excluded)');
    // Average GPA: (3.00 + 2.50) / 2 = 2.75
    assert(analytics.summary.averageGpa === 2.75, 'Average GPA is 2.75 (incomplete students excluded)');
    // Pass rate: 1 pass / (1 pass + 1 fail) = 50.00% (A3 excluded!)
    assert(analytics.summary.passRate === 50.00, 'Class pass rate is 50.00% (incomplete students excluded from denominator)');

    // Subject Arabic Analytics: 2 entered marks (60 and 30) -> average = 45.00
    const arabicAnalytics = analytics.subjectAnalytics.find((s) => s.subjectId === subArabic.id);
    assert(arabicAnalytics.enteredCount === 2, 'Arabic entered count is 2 (blank mark excluded)');
    assert(arabicAnalytics.averageMark === 45.00, 'Arabic average mark is 45.00');
    assert(arabicAnalytics.passCount === 1 && arabicAnalytics.failCount === 1, 'Arabic pass count is 1, fail count is 1');
    assert(arabicAnalytics.passRate === 50.00, 'Arabic pass rate is 50.00%');
  }

  console.log('\n=== SECTION 4: FINALIZATION, READ-ONLY & GPA SNAPSHOT IMMUNITY ===');
  {
    // Finalize assessment
    const finRes = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    });
    const finData = await finRes.json();
    assert(finRes.status === 200 && finData.data.status === 'FINALIZED', 'POST /finalize marks assessment FINALIZED');
    assert(Array.isArray(finData.data.gpaScaleSnapshot) && finData.data.gpaScaleSnapshot.length > 0, 'gpaScaleSnapshot is captured atomically on finalization');

    // Finalized blocks mark edits
    const editBlocked = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/marks`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        marks: [{ studentId: studentA1.id, assessmentSubjectId: asQuran.id, mark: 90 }],
      }),
    });
    assert(editBlocked.status === 400, 'Editing marks on FINALIZED assessment is blocked with 400 Bad Request');

    // Finalized blocks adding subject
    const addSubBlocked = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        newSubject: { name: 'Late Subject' },
        maxMark: 100,
        passMark: 40,
      }),
    });
    assert(addSubBlocked.status === 400, 'Adding subject to FINALIZED assessment is blocked with 400 Bad Request');

    // Changing tenant GPA settings after finalization must NOT change finalized result GPA
    const newBands = [
      { minPercentage: 85.00, maxPercentage: 100.00, gpa: 4.00 },
      { minPercentage: 75.00, maxPercentage: 84.99, gpa: 3.50 },
      { minPercentage: 65.00, maxPercentage: 74.99, gpa: 2.75 }, // Changed from 3.00 to 2.75!
      { minPercentage: 55.00, maxPercentage: 64.99, gpa: 2.20 },
      { minPercentage: 45.00, maxPercentage: 54.99, gpa: 1.80 },
      { minPercentage: 40.00, maxPercentage: 44.99, gpa: 1.00 },
      { minPercentage: 0.00, maxPercentage: 39.99, gpa: 0.00 },
    ];
    const updateGpaRes = await fetch(`${baseUrl}/marking-hub/gpa-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ bands: newBands }),
    });
    assert(updateGpaRes.status === 200, 'PUT /marking-hub/gpa-settings updates tenant GPA settings');

    // Check finalized assessment marks: Student A1 (71.25%) MUST STILL HAVE GPA 3.00 from snapshot!
    const finMarksRes = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/marks`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const finMarksData = await finMarksRes.json();
    const stA1After = finMarksData.data.results.find((s) => s.studentId === studentA1.id);
    assert(stA1After.gpa === 3.00, 'Historical finalized result GPA remains 3.00 (immune to tenant GPA scale changes)');

    // Reopen assessment
    const reopenRes = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    });
    const reopenData = await reopenRes.json();
    assert(reopenRes.status === 200 && reopenData.data.status === 'DRAFT', 'POST /reopen successfully reverts assessment to DRAFT');
  }

  console.log('\n=== SECTION 5: MULTI-TENANT ISOLATION TESTS ===');
  {
    // Admin B accessing Madrasa A assessment -> 404
    const bAccessA = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(bAccessA.status === 404, 'Madrasa B cannot access Madrasa A assessment (HTTP 404)');

    // Admin B attempting to save marks on Madrasa A assessment -> 404
    const bMarksA = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/marks`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        marks: [{ studentId: studentB1.id, assessmentSubjectId: asQuran.id, mark: 50 }],
      }),
    });
    assert(bMarksA.status === 404, 'Madrasa B cannot save marks to Madrasa A assessment (HTTP 404)');

    // Admin B attempting to add subject to Madrasa A assessment -> 404
    const bAddSubA = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ maxMark: 100, passMark: 40, newSubject: { name: 'Hack Sub' } }),
    });
    assert(bAddSubA.status === 404, 'Madrasa B cannot add subject to Madrasa A assessment (HTTP 404)');

    // Admin B attempting to export Madrasa A PDF -> 404
    const bPdfA = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/export/pdf`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(bPdfA.status === 404, 'Madrasa B cannot export Madrasa A PDF (HTTP 404)');

    // Admin B attempting to export Madrasa A CSV -> 404
    const bCsvA = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/export/csv`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(bCsvA.status === 404, 'Madrasa B cannot export Madrasa A CSV (HTTP 404)');
  }

  console.log('\n=== SECTION 6: SUBSCRIPTION GATEWAY TESTS ===');
  {
    // Admin C (Expired subscription)
    const cAssessments = await fetch(`${baseUrl}/marking-hub/assessments`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    assert(cAssessments.status === 403, 'Expired subscription blocks GET /marking-hub/assessments with 403 Forbidden');

    const cGpa = await fetch(`${baseUrl}/marking-hub/gpa-settings`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    assert(cGpa.status === 403, 'Expired subscription blocks GET /marking-hub/gpa-settings with 403 Forbidden');
  }

  console.log('\n=== SECTION 7: PDF & CSV EXPORT WITH SECURITY GUARDS ===');
  {
    // 1. PDF Export
    const pdfRes = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/export/pdf`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(pdfRes.status === 200, 'GET /marking-hub/assessments/:id/export/pdf returns HTTP 200');
    const contentType = pdfRes.headers.get('content-type');
    assert(contentType && contentType.includes('application/pdf'), 'PDF export returns application/pdf content-type');
    const pdfBuf = await pdfRes.arrayBuffer();
    assert(pdfBuf.byteLength > 1000, `Generated PDF buffer is valid and non-empty (${pdfBuf.byteLength} bytes)`);

    // 2. CSV Export
    const csvRes = await fetch(`${baseUrl}/marking-hub/assessments/${assessmentA1.id}/export/csv`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(csvRes.status === 200, 'GET /marking-hub/assessments/:id/export/csv returns HTTP 200');
    const arrayBuf = await csvRes.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    assert(hasBom, 'CSV export begins with UTF-8 BOM (\\uFEFF) for Excel compatibility');
    const csvText = new TextDecoder('utf-8').decode(bytes);

    // Check header columns
    assert(csvText.includes('Student ID,Student Name'), 'CSV contains standard student identifier columns');
    assert(csvText.includes('Qur\'an,Arabic,Fiqh,Hadith'), 'CSV contains dynamic subject columns in configured order');
    assert(csvText.includes('Obtained Total,Maximum Total,Average Percentage,GPA,Passed Subjects,Failed Subjects,Overall Status,Position'), 'CSV contains authoritative calculation headers');

    // Incomplete student formatting: blank marks and empty GPA/Position
    assert(csvText.includes('INCOMPLETE'), 'CSV contains INCOMPLETE status for Student A3');

    // Formula injection defense test
    // Student A3 name is '=Danger Formula Student'. In CSV it MUST be prefixed with '\'' -> '\'=Danger Formula Student'
    assert(csvText.includes('\'=Danger Formula Student'), 'Formula injection defense correctly prefixes \' to cells starting with =');

    // Unit test escapeCsvCell defense
    assert(escapeCsvCell('=1+1') === '\'=1+1', 'escapeCsvCell prefixes = with \'');
    assert(escapeCsvCell('+cmd') === '\'+cmd', 'escapeCsvCell prefixes + with \'');
    assert(escapeCsvCell('-calc') === '\'-calc', 'escapeCsvCell prefixes - with \'');
    assert(escapeCsvCell('@sum') === '\'@sum', 'escapeCsvCell prefixes @ with \'');
    assert(escapeCsvCell(75.5) === '75.5', 'escapeCsvCell preserves pure numbers intact');
  }

  console.log('\n========================================');
  console.log(`TEST SUMMARY: ${testPassedCount} PASSED, ${testFailedCount} FAILED`);
  console.log('========================================\n');

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

async function main() {
  try {
    await setup();
    await runTests();
  } catch (err) {
    console.error('Fatal test runner error:', err);
    process.exit(1);
  } finally {
    await teardown();
  }
}

main();
