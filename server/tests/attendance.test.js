import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import http from 'http';
import {
  calculateDailySummary,
  calculateStudentAttendancePercentage,
  calculateMonthlyClassAttendanceRate,
  calculateAverageDailyAttendanceRate,
} from '../src/services/attendance-calculation.service.js';
import { escapeCsvCell } from '../src/services/csv-report.service.js';
import { parseDateOnly, formatDateOnly } from '../src/services/attendance.service.js';
import { closeSharedBrowser } from '../src/services/pdf-report.service.js';

const TEST_PREFIX = 'att_test_' + Date.now();

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
let studentA3 = null; // Joined later
let studentA4 = null; // Left class later

let madrasaB = null;
let adminB = null;
let tokenB = '';
let classB1 = null;
let studentB1 = null;

let madrasaExpired = null;
let adminExpired = null;
let tokenExpired = '';

let madrasaNoSub = null;
let adminNoSub = null;
let tokenNoSub = '';

async function setup() {
  console.log('\n--- Setting up Attendance Test Fixtures ---');
  const now = new Date();

  // 1. Subscription Plan
  const plan = await prisma.plan.upsert({
    where: { code: 'PRO_ATTENDANCE_TEST' },
    create: {
      name: 'Pro Attendance Test Plan',
      code: 'PRO_ATTENDANCE_TEST',
      price: 1000,
      durationMonths: 12,
      isActive: true,
    },
    update: {},
  });

  // 2. Madrasa A (Active)
  madrasaA = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa A`,
      code: `MA_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `ma-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      email: `${TEST_PREFIX}_a@example.com`,
    },
  });

  const pwd = await hashPassword('TestPassword123!');
  adminA = await prisma.user.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Admin A',
      email: `${TEST_PREFIX}_adminA@example.com`,
      passwordHash: pwd,
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaA.id,
      planId: plan.id,
      status: 'ACTIVE',
      startsAt: new Date(now.getTime() - 10 * 86400000),
      endsAt: new Date(now.getTime() + 300 * 86400000),
      priceAtPurchase: 1000,
      durationMonthsAtPurchase: 12,
    },
  });

  await prisma.madrasaSetting.create({
    data: {
      madrasaId: madrasaA.id,
      academicYear: '2025/2026',
    },
  });

  tokenA = signAccessToken({
    userId: adminA.id,
    madrasaId: madrasaA.id,
    role: 'MADRASA_ADMIN',
    email: adminA.email,
  });

  // Classes for Madrasa A
  classA1 = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Class Grade 7',
      code: `G7_${Date.now().toString().slice(-8)}`,
      defaultMonthlyFee: 500,
    },
  });

  classA2 = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Class Grade 8',
      code: `G8_${Date.now().toString().slice(-8)}`,
      defaultMonthlyFee: 500,
    },
  });

  // Students for Class A1:
  // studentA1: admitted on 2026-09-01
  studentA1 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: `${TEST_PREFIX}_ST01`,
      fullName: 'Ahmed Ali',
      guardianName: 'Ali Senior',
      admissionDate: new Date('2026-09-01T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  });

  // studentA2: admitted on 2026-09-01
  studentA2 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: `${TEST_PREFIX}_ST02`,
      fullName: 'Bilal Hassan',
      guardianName: 'Hassan Senior',
      admissionDate: new Date('2026-09-01T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  });

  // studentA3: admitted later on 2026-09-15 (New student rule test)
  studentA3 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: `${TEST_PREFIX}_ST03`,
      fullName: 'Zayd late-joiner',
      guardianName: 'Zayd Senior',
      admissionDate: new Date('2026-09-15T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  });

  // studentA4: admitted on 2026-09-01, but will be moved or archived later
  studentA4 = await prisma.student.create({
    data: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      admissionNo: `${TEST_PREFIX}_ST04`,
      fullName: 'Tariq leaves-later',
      guardianName: 'Tariq Senior',
      admissionDate: new Date('2026-09-01T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  });

  // 3. Madrasa B (Tenant Isolation)
  madrasaB = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa B`,
      code: `MB_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `mb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      email: `${TEST_PREFIX}_b@example.com`,
    },
  });

  adminB = await prisma.user.create({
    data: {
      madrasaId: madrasaB.id,
      name: 'Admin B',
      email: `${TEST_PREFIX}_adminB@example.com`,
      passwordHash: pwd,
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaB.id,
      planId: plan.id,
      status: 'ACTIVE',
      startsAt: new Date(now.getTime() - 10 * 86400000),
      endsAt: new Date(now.getTime() + 300 * 86400000),
      priceAtPurchase: 1000,
      durationMonthsAtPurchase: 12,
    },
  });

  tokenB = signAccessToken({
    userId: adminB.id,
    madrasaId: madrasaB.id,
    role: 'MADRASA_ADMIN',
    email: adminB.email,
  });

  classB1 = await prisma.class.create({
    data: {
      madrasaId: madrasaB.id,
      name: 'Class Grade 7 - Madrasa B',
      code: `B7_${Date.now().toString().slice(-8)}`,
      defaultMonthlyFee: 600,
    },
  });

  studentB1 = await prisma.student.create({
    data: {
      madrasaId: madrasaB.id,
      classId: classB1.id,
      admissionNo: `${TEST_PREFIX}_BST01`,
      fullName: 'Foreign Student B',
      guardianName: 'Guardian B',
      admissionDate: new Date('2026-09-01T00:00:00.000Z'),
      status: 'ACTIVE',
    },
  });

  // 4. Madrasa Expired
  madrasaExpired = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa Expired`,
      code: `ME_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `me-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      email: `${TEST_PREFIX}_exp@example.com`,
    },
  });

  adminExpired = await prisma.user.create({
    data: {
      madrasaId: madrasaExpired.id,
      name: 'Admin Expired',
      email: `${TEST_PREFIX}_adminExp@example.com`,
      passwordHash: pwd,
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaExpired.id,
      planId: plan.id,
      status: 'EXPIRED',
      startsAt: new Date(now.getTime() - 60 * 86400000),
      endsAt: new Date(now.getTime() - 5 * 86400000),
      priceAtPurchase: 1000,
      durationMonthsAtPurchase: 1,
    },
  });

  tokenExpired = signAccessToken({
    userId: adminExpired.id,
    madrasaId: madrasaExpired.id,
    role: 'MADRASA_ADMIN',
    email: adminExpired.email,
  });

  // 5. Madrasa No Subscription
  madrasaNoSub = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa NoSub`,
      code: `MN_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `mn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      email: `${TEST_PREFIX}_nosub@example.com`,
    },
  });

  adminNoSub = await prisma.user.create({
    data: {
      madrasaId: madrasaNoSub.id,
      name: 'Admin NoSub',
      email: `${TEST_PREFIX}_adminNoSub@example.com`,
      passwordHash: pwd,
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  tokenNoSub = signAccessToken({
    userId: adminNoSub.id,
    madrasaId: madrasaNoSub.id,
    role: 'MADRASA_ADMIN',
    email: adminNoSub.email,
  });

  // Start HTTP server
  await new Promise((resolve) => {
    testServer = http.createServer(app);
    testServer.listen(0, '127.0.0.1', () => {
      const addr = testServer.address();
      baseUrl = `http://127.0.0.1:${addr.port}/api/madrasa-admin`;
      console.log(`Test server running at: ${baseUrl}`);
      resolve();
    });
  });
}

async function teardown() {
  console.log('\n--- Cleaning up Test Data ---');
  if (testServer) {
    if (typeof testServer.closeAllConnections === 'function') {
      testServer.closeAllConnections();
    }
    await new Promise((res) => testServer.close(res));
  }
  await closeSharedBrowser();

  // Cleanup attendance records and sessions
  await prisma.attendanceRecord.deleteMany({
    where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id, madrasaExpired?.id, madrasaNoSub?.id].filter(Boolean) } },
  });
  await prisma.attendanceSession.deleteMany({
    where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id, madrasaExpired?.id, madrasaNoSub?.id].filter(Boolean) } },
  });

  // Cleanup students, classes, users, settings, subscriptions, madrasas
  await prisma.student.deleteMany({
    where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id, madrasaExpired?.id, madrasaNoSub?.id].filter(Boolean) } },
  });
  await prisma.class.deleteMany({
    where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id, madrasaExpired?.id, madrasaNoSub?.id].filter(Boolean) } },
  });
  await prisma.madrasaSetting.deleteMany({
    where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id, madrasaExpired?.id, madrasaNoSub?.id].filter(Boolean) } },
  });
  await prisma.subscription.deleteMany({
    where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id, madrasaExpired?.id, madrasaNoSub?.id].filter(Boolean) } },
  });
  await prisma.user.deleteMany({
    where: { madrasaId: { in: [madrasaA?.id, madrasaB?.id, madrasaExpired?.id, madrasaNoSub?.id].filter(Boolean) } },
  });
  await prisma.madrasa.deleteMany({
    where: { id: { in: [madrasaA?.id, madrasaB?.id, madrasaExpired?.id, madrasaNoSub?.id].filter(Boolean) } },
  });
}

// ==========================================
// TEST SUITES
// ==========================================

async function runTests() {
  console.log('\n======================================================');
  console.log('MADRASA NEXA — CLASS-BASED ATTENDANCE AUTOMATED TESTS');
  console.log('======================================================\n');

  // --------------------------------------------------
  // 1. Pure Calculation Formula Tests
  // --------------------------------------------------
  console.log('1. Pure Calculation Formula Tests');

  // 1.1 Daily Summary Formula
  const sampleRecords = [
    { status: 'PRESENT' },
    { status: 'PRESENT' },
    { status: 'ABSENT' },
    { status: 'PRESENT' },
  ];
  const dailyCalc = calculateDailySummary(sampleRecords);
  assert(dailyCalc.totalStudents === 4, 'daily summary: totalStudents is 4');
  assert(dailyCalc.presentCount === 3, 'daily summary: presentCount is 3');
  assert(dailyCalc.absentCount === 1, 'daily summary: absentCount is 1');
  assert(dailyCalc.attendanceRate === 75.0, 'daily summary: attendanceRate is 75.00%');

  // Example test from prompt: 100 students, 97 present, 3 absent => 97.00%
  const hundredRecords = Array(97).fill({ status: 'PRESENT' }).concat(Array(3).fill({ status: 'ABSENT' }));
  const hundredCalc = calculateDailySummary(hundredRecords);
  assert(hundredCalc.totalStudents === 100, 'example test: 100 students total');
  assert(hundredCalc.presentCount === 97, 'example test: 97 present');
  assert(hundredCalc.absentCount === 3, 'example test: 3 absent');
  assert(hundredCalc.attendanceRate === 97.0, 'example test: 97.00% attendance rate');

  // 1.2 Student Attendance Percentage Formula (protects new students)
  // Ahmed records: 4 present, 1 absent => 80.00%
  const ahmedPct = calculateStudentAttendancePercentage(4, 5);
  assert(ahmedPct === 80.0, 'student percentage: 4 / 5 = 80.00%');

  // New Student Test from prompt: Class had 20 previous sessions. Student has 10 records (9 present, 1 absent).
  const newStudentPct = calculateStudentAttendancePercentage(9, 10);
  assert(newStudentPct === 90.0, 'new student percentage: 9 / 10 = 90.00% (NOT divided by historical class days)');

  // 1.3 Monthly Weighted Class Rate vs Average Daily Rate
  // Day 1: 10 students, 10 present (100.00%)
  // Day 2: 100 students, 50 present (50.00%)
  // Total present = 60, total recorded = 110 => 60/110 * 100 = 54.55%
  // Average daily rate = (100 + 50) / 2 = 75.00%
  const monthlyWeighted = calculateMonthlyClassAttendanceRate(60, 110);
  assert(monthlyWeighted === 54.55, 'monthly weighted class rate: 60/110 = 54.55%');
  const avgDaily = calculateAverageDailyAttendanceRate([100.0, 50.0]);
  assert(avgDaily === 75.0, 'average daily rate: (100 + 50) / 2 = 75.00%');
  assert(monthlyWeighted !== avgDaily, 'monthly weighted rate is mathematically distinct from average daily rate');

  // 1.4 Date-Only Parsing & Timezone Safety
  const parsedDate = parseDateOnly('2026-09-19');
  assert(parsedDate.getUTCFullYear() === 2026, 'parsed date year is 2026');
  assert(parsedDate.getUTCMonth() === 8, 'parsed date month is 8 (September)');
  assert(parsedDate.getUTCDate() === 19, 'parsed date day is 19');
  assert(formatDateOnly(parsedDate) === '2026-09-19', 'formatDateOnly produces exact calendar date 2026-09-19');

  // --------------------------------------------------
  // 2. Subscription Gate Enforcement
  // --------------------------------------------------
  console.log('\n2. Subscription Gate Enforcement');

  // 2.1 ACTIVE subscription allowed
  const resActive = await fetch(`${baseUrl}/attendance?classId=${classA1.id}&academicYear=2025/2026&date=2026-09-10`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(resActive.status === 200, 'active subscription allowed access (HTTP 200)');

  // 2.2 EXPIRED subscription blocked
  const resExpired = await fetch(`${baseUrl}/attendance?classId=${classA1.id}&academicYear=2025/2026&date=2026-09-10`, {
    headers: { Authorization: `Bearer ${tokenExpired}` },
  });
  assert(resExpired.status === 403, 'expired subscription blocked (HTTP 403)');

  // 2.3 NO subscription blocked
  const resNoSub = await fetch(`${baseUrl}/attendance?classId=${classA1.id}&academicYear=2025/2026&date=2026-09-10`, {
    headers: { Authorization: `Bearer ${tokenNoSub}` },
  });
  assert(resNoSub.status === 403, 'no subscription blocked (HTTP 403)');

  // --------------------------------------------------
  // 3. Date-Aware Student Eligibility
  // --------------------------------------------------
  console.log('\n3. Date-Aware Student Eligibility');

  // 3.1 On 2026-09-10: studentA1, studentA2, studentA4 are enrolled (admissionDate 2026-09-01).
  // studentA3 enrolled on 2026-09-15. So studentA3 MUST NOT appear on 2026-09-10!
  const resEligibleEarly = await fetch(
    `${baseUrl}/attendance?classId=${classA1.id}&academicYear=2025/2026&date=2026-09-10`,
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  const dataEligibleEarly = await resEligibleEarly.json();
  assert(dataEligibleEarly.success === true, 'get attendance returned success');
  assert(dataEligibleEarly.data.isSaved === false, 'session is not saved yet');
  assert(dataEligibleEarly.data.students.length === 3, 'only 3 students eligible on 2026-09-10');
  const studentIdsEarly = dataEligibleEarly.data.students.map((s) => s.studentId);
  assert(!studentIdsEarly.includes(studentA3.id), 'student joining on 2026-09-15 is NOT eligible for 2026-09-10');

  // 3.2 On 2026-09-20: all 4 students are enrolled
  const resEligibleLate = await fetch(
    `${baseUrl}/attendance?classId=${classA1.id}&academicYear=2025/2026&date=2026-09-20`,
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  const dataEligibleLate = await resEligibleLate.json();
  assert(dataEligibleLate.data.students.length === 4, 'all 4 students eligible on 2026-09-20');

  // --------------------------------------------------
  // 4. Bulk Save Attendance & Completeness Validation
  // --------------------------------------------------
  console.log('\n4. Bulk Save Attendance & Completeness Validation');

  // 4.1 Missing eligible student is rejected
  const resMissingStudent = await fetch(`${baseUrl}/attendance`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      classId: classA1.id,
      academicYear: '2025/2026',
      date: '2026-09-10',
      records: [
        { studentId: studentA1.id, status: 'PRESENT' },
        // studentA2 and studentA4 missing!
      ],
    }),
  });
  assert(resMissingStudent.status === 400, 'missing eligible students in bulk save rejected with HTTP 400');

  // 4.2 Duplicate student ID in payload is rejected
  const resDuplicateStudent = await fetch(`${baseUrl}/attendance`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      classId: classA1.id,
      academicYear: '2025/2026',
      date: '2026-09-10',
      records: [
        { studentId: studentA1.id, status: 'PRESENT' },
        { studentId: studentA1.id, status: 'ABSENT' },
        { studentId: studentA2.id, status: 'PRESENT' },
        { studentId: studentA4.id, status: 'PRESENT' },
      ],
    }),
  });
  assert(resDuplicateStudent.status === 400, 'duplicate student ID in payload rejected with HTTP 400');

  // 4.3 Ineligible student (studentA3 who joined 2026-09-15) is rejected for 2026-09-10
  const resIneligibleStudent = await fetch(`${baseUrl}/attendance`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      classId: classA1.id,
      academicYear: '2025/2026',
      date: '2026-09-10',
      records: [
        { studentId: studentA1.id, status: 'PRESENT' },
        { studentId: studentA2.id, status: 'PRESENT' },
        { studentId: studentA3.id, status: 'PRESENT' }, // Ineligible for this date!
      ],
    }),
  });
  assert(resIneligibleStudent.status === 400, 'ineligible student (joined later) rejected with HTTP 400');

  // 4.4 Invalid status rejected (e.g. LATE or NOT_MARKED)
  const resInvalidStatus = await fetch(`${baseUrl}/attendance`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      classId: classA1.id,
      academicYear: '2025/2026',
      date: '2026-09-10',
      records: [
        { studentId: studentA1.id, status: 'PRESENT' },
        { studentId: studentA2.id, status: 'PRESENT' },
        { studentId: studentA4.id, status: 'LATE' }, // Invalid!
      ],
    }),
  });
  assert(resInvalidStatus.status === 400, 'invalid status (LATE) rejected with HTTP 400');

  // 4.5 Successful complete save for 2026-09-10 (3 students: 2 PRESENT, 1 ABSENT)
  const resSaveSuccess = await fetch(`${baseUrl}/attendance`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      classId: classA1.id,
      academicYear: '2025/2026',
      date: '2026-09-10',
      records: [
        { studentId: studentA1.id, status: 'PRESENT' },
        { studentId: studentA2.id, status: 'PRESENT' },
        { studentId: studentA4.id, status: 'ABSENT' },
      ],
    }),
  });
  const dataSaveSuccess = await resSaveSuccess.json();
  assert(resSaveSuccess.status === 200, 'bulk attendance saved successfully (HTTP 200)');
  assert(dataSaveSuccess.data.isSaved === true, 'session status is now saved');
  assert(dataSaveSuccess.data.summary.totalStudents === 3, 'summary totalStudents is 3');
  assert(dataSaveSuccess.data.summary.presentCount === 2, 'summary presentCount is 2');
  assert(dataSaveSuccess.data.summary.absentCount === 1, 'summary absentCount is 1');
  assert(dataSaveSuccess.data.summary.attendanceRate === 66.67, 'summary attendanceRate is 66.67%');

  // --------------------------------------------------
  // 5. Idempotency & Re-Save Without Duplicate Session
  // --------------------------------------------------
  console.log('\n5. Idempotency & Re-Save Without Duplicate Session');

  // 5.1 Re-saving the same date updates statuses and does NOT create a second session
  const resResave = await fetch(`${baseUrl}/attendance`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      classId: classA1.id,
      academicYear: '2025/2026',
      date: '2026-09-10',
      records: [
        { studentId: studentA1.id, status: 'PRESENT' },
        { studentId: studentA2.id, status: 'ABSENT' }, // Changed to ABSENT
        { studentId: studentA4.id, status: 'PRESENT' }, // Changed to PRESENT
      ],
    }),
  });
  const dataResave = await resResave.json();
  assert(resResave.status === 200, 're-saving existing session returned HTTP 200');
  assert(dataResave.data.summary.presentCount === 2, 'updated presentCount is 2');

  const sessionCount = await prisma.attendanceSession.count({
    where: {
      madrasaId: madrasaA.id,
      classId: classA1.id,
      attendanceDate: parseDateOnly('2026-09-10'),
    },
  });
  assert(sessionCount === 1, 'idempotent: exactly 1 AttendanceSession exists for Madrasa + Class + Date');

  // 5.2 Historical Preservation: studentA3 (joined 2026-09-15) is STILL NOT in 2026-09-10
  const resReloadEarly = await fetch(
    `${baseUrl}/attendance?classId=${classA1.id}&academicYear=2025/2026&date=2026-09-10`,
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  const dataReloadEarly = await resReloadEarly.json();
  assert(dataReloadEarly.data.students.length === 3, 'historical session preserves original 3 students');
  assert(!dataReloadEarly.data.students.some((s) => s.studentId === studentA3.id), 'later joiner not injected into old session');

  // --------------------------------------------------
  // 6. Cross-Tenant Isolation
  // --------------------------------------------------
  console.log('\n6. Cross-Tenant Isolation');

  // 6.1 Madrasa B cannot view Madrasa A daily attendance
  const resCrossGet = await fetch(
    `${baseUrl}/attendance?classId=${classA1.id}&academicYear=2025/2026&date=2026-09-10`,
    { headers: { Authorization: `Bearer ${tokenB}` } }
  );
  assert(resCrossGet.status === 404, 'cross-tenant class query returns generic 404');

  // 6.2 Madrasa B cannot save attendance for Madrasa A class
  const resCrossSave = await fetch(`${baseUrl}/attendance`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({
      classId: classA1.id,
      academicYear: '2025/2026',
      date: '2026-09-10',
      records: [{ studentId: studentB1.id, status: 'PRESENT' }],
    }),
  });
  assert(resCrossSave.status === 404, 'cross-tenant class save returns generic 404');

  // 6.3 Madrasa A cannot mark Madrasa B student
  const resCrossStudent = await fetch(`${baseUrl}/attendance`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      classId: classA1.id,
      academicYear: '2025/2026',
      date: '2026-09-10',
      records: [
        { studentId: studentA1.id, status: 'PRESENT' },
        { studentId: studentA2.id, status: 'PRESENT' },
        { studentId: studentB1.id, status: 'PRESENT' }, // Foreign student!
      ],
    }),
  });
  assert(resCrossStudent.status === 400, 'foreign student in payload rejected with HTTP 400');

  // --------------------------------------------------
  // 7. Create Session 2 & Monthly Analytics
  // --------------------------------------------------
  console.log('\n7. Create Session 2 & Monthly Analytics');

  // Save attendance for 2026-09-20 (all 4 students eligible)
  // studentA1: PRESENT, studentA2: PRESENT, studentA3: PRESENT, studentA4: ABSENT
  await fetch(`${baseUrl}/attendance`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      classId: classA1.id,
      academicYear: '2025/2026',
      date: '2026-09-20',
      records: [
        { studentId: studentA1.id, status: 'PRESENT' },
        { studentId: studentA2.id, status: 'PRESENT' },
        { studentId: studentA3.id, status: 'PRESENT' },
        { studentId: studentA4.id, status: 'ABSENT' },
      ],
    }),
  });

  // 7.1 Attendance History
  const resHistory = await fetch(`${baseUrl}/attendance/history?classId=${classA1.id}&academicYear=2025/2026`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataHistory = await resHistory.json();
  assert(dataHistory.success === true, 'history fetched successfully');
  assert(dataHistory.data.total === 2, 'history contains exactly 2 sessions');
  assert(dataHistory.data.items[0].date === '2026-09-20', 'latest session is first (2026-09-20)');

  // 7.2 Monthly Summary
  const resMonthly = await fetch(`${baseUrl}/attendance/monthly-summary?classId=${classA1.id}&month=2026-09`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataMonthly = await resMonthly.json();
  assert(dataMonthly.success === true, 'monthly summary fetched successfully');
  assert(dataMonthly.data.summary.totalAttendanceDays === 2, 'monthly totalAttendanceDays is 2');
  assert(dataMonthly.data.summary.totalStudents === 4, 'monthly totalStudents count is 4 unique students');

  // Total records across month:
  // Session 1 (2026-09-10): 3 students (2 Present, 1 Absent)
  // Session 2 (2026-09-20): 4 students (3 Present, 1 Absent)
  // Total present = 5, Total recorded = 7 => 5/7 * 100 = 71.43%
  assert(dataMonthly.data.summary.totalPresentRecords === 5, 'monthly totalPresentRecords is 5');
  assert(dataMonthly.data.summary.totalRecordedRecords === 7, 'monthly totalRecordedRecords is 7');
  assert(dataMonthly.data.summary.monthlyClassRate === 71.43, 'monthlyClassRate is 71.43%');

  // Session rates: 66.67% and 75.00% => Average = (66.67 + 75.00)/2 = 70.84%
  assert(dataMonthly.data.summary.averageDailyRate === 70.84, 'averageDailyRate is 70.84%');

  // Check studentA3 in monthly table: recordedDays = 1, presentDays = 1, attendance = 100.00% (NOT 1/2 = 50%)
  const st3Summary = dataMonthly.data.students.find((s) => s.studentId === studentA3.id);
  assert(st3Summary.recordedDays === 1, 'studentA3 has exactly 1 recorded day');
  assert(st3Summary.attendancePercentage === 100.0, 'studentA3 attendance is 100.00% (not penalized for earlier session)');

  // Check studentA1 in monthly table: recordedDays = 2, presentDays = 2, attendance = 100.00%
  const st1Summary = dataMonthly.data.students.find((s) => s.studentId === studentA1.id);
  assert(st1Summary.recordedDays === 2, 'studentA1 has 2 recorded days');
  assert(st1Summary.presentDays === 2, 'studentA1 has 2 present days');
  assert(st1Summary.attendancePercentage === 100.0, 'studentA1 attendance is 100.00%');

  // 7.3 Individual Student Attendance Profile
  const resStudent = await fetch(`${baseUrl}/attendance/students/${studentA3.id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataStudent = await resStudent.json();
  assert(dataStudent.success === true, 'individual student attendance profile fetched');
  assert(dataStudent.data.summary.recordedDays === 1, 'student profile shows 1 recorded day');
  assert(dataStudent.data.summary.attendancePercentage === 100.0, 'student profile shows 100.00%');

  // --------------------------------------------------
  // 8. PDF & CSV Export Tests
  // --------------------------------------------------
  console.log('\n8. PDF & CSV Export Tests');

  // 8.1 Daily PDF Export
  const resDailyPdf = await fetch(
    `${baseUrl}/attendance/export/daily/pdf?classId=${classA1.id}&academicYear=2025/2026&date=2026-09-10`,
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  assert(resDailyPdf.status === 200, 'daily PDF export returns HTTP 200');
  assert(resDailyPdf.headers.get('content-type') === 'application/pdf', 'content-type is application/pdf');
  const dailyPdfBuf = await resDailyPdf.arrayBuffer();
  assert(dailyPdfBuf.byteLength > 1000, 'daily PDF buffer size is non-empty');

  // 8.2 Monthly PDF Export
  const resMonthlyPdf = await fetch(
    `${baseUrl}/attendance/export/monthly/pdf?classId=${classA1.id}&academicYear=2025/2026&month=2026-09`,
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  assert(resMonthlyPdf.status === 200, 'monthly PDF export returns HTTP 200');
  assert(resMonthlyPdf.headers.get('content-type') === 'application/pdf', 'monthly PDF content-type is application/pdf');
  const monthlyPdfBuf = await resMonthlyPdf.arrayBuffer();
  assert(monthlyPdfBuf.byteLength > 1000, 'monthly PDF buffer size is non-empty');

  // 8.3 Daily CSV Export with UTF-8 BOM & Formula Defense
  const resDailyCsv = await fetch(
    `${baseUrl}/attendance/export/daily/csv?classId=${classA1.id}&academicYear=2025/2026&date=2026-09-10`,
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  assert(resDailyCsv.status === 200, 'daily CSV export returns HTTP 200');
  const dailyCsvBuf = await resDailyCsv.arrayBuffer();
  const dailyBytes = new Uint8Array(dailyCsvBuf);
  const dailyHasBom = dailyBytes[0] === 0xef && dailyBytes[1] === 0xbb && dailyBytes[2] === 0xbf;
  assert(dailyHasBom, 'daily CSV starts with UTF-8 BOM');
  const csvDailyText = new TextDecoder('utf-8').decode(dailyBytes);
  assert(csvDailyText.includes('Student ID,Student Name,Status'), 'daily CSV contains correct header');
  assert(csvDailyText.includes('Ahmed Ali'), 'daily CSV contains student name');

  // 8.4 Monthly CSV Export with UTF-8 BOM
  const resMonthlyCsv = await fetch(
    `${baseUrl}/attendance/export/monthly/csv?classId=${classA1.id}&academicYear=2025/2026&month=2026-09`,
    { headers: { Authorization: `Bearer ${tokenA}` } }
  );
  assert(resMonthlyCsv.status === 200, 'monthly CSV export returns HTTP 200');
  const monthlyCsvBuf = await resMonthlyCsv.arrayBuffer();
  const monthlyBytes = new Uint8Array(monthlyCsvBuf);
  const monthlyHasBom = monthlyBytes[0] === 0xef && monthlyBytes[1] === 0xbb && monthlyBytes[2] === 0xbf;
  assert(monthlyHasBom, 'monthly CSV starts with UTF-8 BOM');
  const csvMonthlyText = new TextDecoder('utf-8').decode(monthlyBytes);
  assert(csvMonthlyText.includes('Present Days,Absent Days,Recorded Days,Attendance Percentage'), 'monthly CSV contains header');

  // 8.5 CSV Formula Defense Unit Test
  assert(escapeCsvCell('=1+1') === "'=1+1", 'formula injection = is escaped with leading apostrophe');
  assert(escapeCsvCell('+cmd') === "'+cmd", 'formula injection + is escaped with leading apostrophe');
  assert(escapeCsvCell('-calc') === "'-calc", 'formula injection - is escaped with leading apostrophe');
  assert(escapeCsvCell('@sum(A1)') === "'@sum(A1)", 'formula injection @ is escaped with leading apostrophe');

  // --------------------------------------------------
  // Summary
  // --------------------------------------------------
  console.log('\n======================================================');
  console.log(`ATTENDANCE TEST RESULTS: ${testPassedCount} PASSED, ${testFailedCount} FAILED`);
  console.log('======================================================\n');

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

async function main() {
  try {
    await setup();
    await runTests();
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    await teardown();
  }
}

main();
