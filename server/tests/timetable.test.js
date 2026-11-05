import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { closeSharedBrowser } from '../src/services/pdf-report.service.js';
import app from '../src/app.js';
import http from 'http';
import fs from 'fs';
import path from 'path';

const TEST_PREFIX = 'tt_test_' + Date.now();

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

// Tenant Fixtures
let madrasaA = null;
let adminA = null;
let tokenA = '';
let classA1 = null;
let classA2 = null;
let ustadhA = null; // staffType: USTADH
let teacherA = null; // staffType: SCHOOL_TEACHER
let subjectA1 = null; // Madrasa subject
let subjectA2 = null; // School subject

let madrasaB = null;
let adminB = null;
let tokenB = '';
let classB = null;

let madrasaExpired = null;
let adminExpired = null;
let tokenExpired = '';

let madrasaPending = null;
let adminPending = null;
let tokenPending = '';

let madrasaNoSub = null;
let adminNoSub = null;
let tokenNoSub = '';

async function setup() {
  console.log('\n--- Setting up Timetable Test Fixtures ---');
  const now = new Date();

  // 1. Subscription Plan
  const plan = await prisma.plan.upsert({
    where: { code: 'PRO_TIMETABLE_TEST' },
    create: {
      name: 'Pro Timetable Test Plan',
      code: 'PRO_TIMETABLE_TEST',
      price: 1000,
      durationMonths: 12,
      isActive: true,
    },
    update: {},
  });

  const pwd = await hashPassword('TestPassword123!');

  // 2. Madrasa A (Active)
  madrasaA = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa A`,
      code: `MTA_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `mta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      email: `${TEST_PREFIX}_a@example.com`,
    },
  });

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
      startsAt: new Date(now.getTime() - 30 * 86400000),
      endsAt: new Date(now.getTime() + 300 * 86400000),
      priceAtPurchase: 1000,
      durationMonthsAtPurchase: 12,
    },
  });

  tokenA = signAccessToken({
    userId: adminA.id,
    madrasaId: madrasaA.id,
    role: 'MADRASA_ADMIN',
    email: adminA.email,
  });

  classA1 = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      name: `Grade 01_${Date.now().toString().slice(-4)}`,
      code: `G1_${Date.now().toString().slice(-4)}`,
      defaultMonthlyFee: 500,
      isActive: true,
    },
  });

  classA2 = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      name: `Grade 02_${Date.now().toString().slice(-4)}`,
      code: `G2_${Date.now().toString().slice(-4)}`,
      defaultMonthlyFee: 500,
      isActive: true,
    },
  });

  subjectA1 = await prisma.subject.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'FIQH',
      code: 'FIQ',
      isActive: true,
    },
  });

  subjectA2 = await prisma.subject.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'MATHEMATICS',
      code: 'MATH',
      isActive: true,
    },
  });

  // Staff A1: Ustadh
  ustadhA = await prisma.ustadh.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhCode: `UST_${Date.now().toString().slice(-4)}`,
      staffType: 'USTADH',
      fullName: 'Ustadh Ahmad',
      email: `${TEST_PREFIX}_ahmad@example.com`,
      joinDate: new Date('2025-01-01'),
      baseMonthlySalary: 35000,
      isActive: true,
    },
  });

  // Staff A2: School Teacher
  teacherA = await prisma.ustadh.create({
    data: {
      madrasaId: madrasaA.id,
      ustadhCode: `TCH_${Date.now().toString().slice(-4)}`,
      staffType: 'SCHOOL_TEACHER',
      fullName: 'Teacher Sarah',
      email: `${TEST_PREFIX}_sarah@example.com`,
      joinDate: new Date('2025-01-01'),
      baseMonthlySalary: 30000,
      isActive: true,
    },
  });

  // 3. Madrasa B (Active, for cross-tenant tests)
  madrasaB = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa B`,
      code: `MTB_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `mtb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
      startsAt: new Date(now.getTime() - 30 * 86400000),
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

  classB = await prisma.class.create({
    data: {
      madrasaId: madrasaB.id,
      name: `Class B1_${Date.now().toString().slice(-4)}`,
      code: `CB1_${Date.now().toString().slice(-4)}`,
      defaultMonthlyFee: 400,
      isActive: true,
    },
  });

  // 4. Madrasa Expired (403 Subscription Gate)
  madrasaExpired = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa Expired`,
      code: `MTE_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `mte-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
      endsAt: new Date(now.getTime() - 10 * 86400000),
      priceAtPurchase: 1000,
      durationMonthsAtPurchase: 12,
    },
  });

  tokenExpired = signAccessToken({
    userId: adminExpired.id,
    madrasaId: madrasaExpired.id,
    role: 'MADRASA_ADMIN',
    email: adminExpired.email,
  });

  // 5. Madrasa Suspended (403)
  madrasaPending = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa Suspended`,
      code: `MTP_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `mtp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      email: `${TEST_PREFIX}_pen@example.com`,
    },
  });

  adminPending = await prisma.user.create({
    data: {
      madrasaId: madrasaPending.id,
      name: 'Admin Suspended',
      email: `${TEST_PREFIX}_adminPen@example.com`,
      passwordHash: pwd,
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaPending.id,
      planId: plan.id,
      status: 'SUSPENDED',
      startsAt: new Date(now.getTime()),
      endsAt: new Date(now.getTime() + 30 * 86400000),
      priceAtPurchase: 1000,
      durationMonthsAtPurchase: 12,
    },
  });

  tokenPending = signAccessToken({
    userId: adminPending.id,
    madrasaId: madrasaPending.id,
    role: 'MADRASA_ADMIN',
    email: adminPending.email,
  });

  // 6. Madrasa No Subscription (403)
  madrasaNoSub = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa No Sub`,
      code: `MTN_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `mtn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      email: `${TEST_PREFIX}_nosub@example.com`,
    },
  });

  adminNoSub = await prisma.user.create({
    data: {
      madrasaId: madrasaNoSub.id,
      name: 'Admin No Sub',
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

  // Start HTTP Server
  await new Promise((resolve) => {
    testServer = http.createServer(app);
    testServer.listen(0, '127.0.0.1', () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/madrasa-admin`;
      console.log(`Test server running at ${baseUrl}`);
      resolve();
    });
  });
}

async function teardown() {
  console.log('\n--- Cleaning up Timetable Test Fixtures ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  const madrasaIds = [
    madrasaA?.id,
    madrasaB?.id,
    madrasaExpired?.id,
    madrasaPending?.id,
    madrasaNoSub?.id,
  ].filter(Boolean);

  for (const mid of madrasaIds) {
    try {
      await prisma.notificationJob.deleteMany({ where: { madrasaId: mid } });
      await prisma.timetablePublication.deleteMany({ where: { madrasaId: mid } });
      await prisma.activityLog.deleteMany({ where: { madrasaId: mid } });
      await prisma.timetableBreak.deleteMany({ where: { madrasaId: mid } });
      await prisma.ustadhSchedule.deleteMany({ where: { madrasaId: mid } });
      await prisma.ustadh.deleteMany({ where: { madrasaId: mid } });
      await prisma.subject.deleteMany({ where: { madrasaId: mid } });
      await prisma.class.deleteMany({ where: { madrasaId: mid } });
      await prisma.academicSection.deleteMany({ where: { madrasaId: mid } });
      await prisma.subscription.deleteMany({ where: { madrasaId: mid } });
      await prisma.user.deleteMany({ where: { madrasaId: mid } });
      await prisma.madrasa.delete({ where: { id: mid } });
    } catch (e) {
      // ignore
    }
  }

  await closeSharedBrowser();
  await prisma.$disconnect();
}

async function apiRequest(endpoint, { method = 'GET', body = null, token = tokenA } = {}) {
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

  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function runTests() {
  await setup();

  try {
    // =========================================================================
    // 1. TEACHING SCHEDULE REUSE & INTEGRATION (Ustadh + School Teacher)
    // =========================================================================
    console.log('\n--- 1. Teaching Schedule Creation (Ustadh & School Teacher) ---');

    // 1.1 Create Monday 08:00 - 09:00 for Ustadh Ahmad (FIQH) in Grade 01
    const createSched1 = await apiRequest('/ustadh-schedules', {
      method: 'POST',
      body: {
        ustadhId: ustadhA.id,
        classId: classA1.id,
        subjectId: subjectA1.id,
        dayOfWeek: 'MONDAY',
        startMinutes: 480, // 08:00
        endMinutes: 540,   // 09:00
        effectiveFrom: '2026-01-01',
      },
    });
    assert(createSched1.status === 201, '1.1 Can create teaching session for Ustadh (FIQH, 08:00-09:00)');
    const sched1Id = createSched1.body.data.id;

    // 1.2 Create Monday 09:00 - 10:00 for Teacher Sarah (MATH) in Grade 01
    const createSched2 = await apiRequest('/ustadh-schedules', {
      method: 'POST',
      body: {
        ustadhId: teacherA.id,
        classId: classA1.id,
        subjectId: subjectA2.id,
        dayOfWeek: 'MONDAY',
        startMinutes: 540, // 09:00
        endMinutes: 600,   // 10:00
        effectiveFrom: '2026-01-01',
      },
    });
    assert(createSched2.status === 201, '1.2 Can create teaching session for School Teacher (MATH, 09:00-10:00)');

    // 1.3 Create Monday 10:30 - 11:30 for Ustadh Ahmad in Grade 02
    const createSched3 = await apiRequest('/ustadh-schedules', {
      method: 'POST',
      body: {
        ustadhId: ustadhA.id,
        classId: classA2.id,
        subjectId: subjectA1.id,
        dayOfWeek: 'MONDAY',
        startMinutes: 630, // 10:30
        endMinutes: 690,   // 11:30
        effectiveFrom: '2026-01-01',
      },
    });
    assert(createSched3.status === 201, '1.3 Can create teaching session for Ustadh in Grade 02 (10:30-11:30)');

    // =========================================================================
    // 2. INTERVAL / BREAK MANAGEMENT & CONFLICT ENGINE
    // =========================================================================
    console.log('\n--- 2. Interval / Break Management & Conflicts ---');

    // 2.1 Create Morning Interval for Grade 01 (Monday 10:00 - 10:30)
    const createBreak1 = await apiRequest('/timetable/breaks', {
      method: 'POST',
      body: {
        classId: classA1.id,
        name: 'Morning Interval',
        dayOfWeek: 'MONDAY',
        startMinutes: 600, // 10:00
        endMinutes: 630,   // 10:30
        effectiveFrom: '2026-01-01',
      },
    });
    assert(createBreak1.status === 201, '2.1 Can create TimetableBreak for Grade 01 (10:00-10:30)');
    assert(createBreak1.body.data.name === 'Morning Interval', '2.1 Break name matches');
    const break1Id = createBreak1.body.data.id;

    // 2.2 Conflict: Break vs Break overlap for the same class and day
    const breakVsBreak = await apiRequest('/timetable/breaks', {
      method: 'POST',
      body: {
        classId: classA1.id,
        name: 'Second Break',
        dayOfWeek: 'MONDAY',
        startMinutes: 615, // 10:15 - 10:45 (overlaps 10:00 - 10:30)
        endMinutes: 645,
        effectiveFrom: '2026-01-01',
      },
    });
    assert(breakVsBreak.status === 400, '2.2 Conflict: Break vs Break overlap rejected with 400');
    assert(breakVsBreak.body.message.includes('overlaps with existing break'), '2.2 Error message mentions existing break');

    // 2.3 Conflict: Break vs Teaching session overlap (Break attempted at 08:30 - 09:30 overlapping FIQH)
    const breakVsTeaching = await apiRequest('/timetable/breaks', {
      method: 'POST',
      body: {
        classId: classA1.id,
        name: 'Conflict Break',
        dayOfWeek: 'MONDAY',
        startMinutes: 510, // 08:30 - 09:30
        endMinutes: 570,
        effectiveFrom: '2026-01-01',
      },
    });
    assert(breakVsTeaching.status === 400, '2.3 Conflict: Break vs Teaching overlap rejected with 400');
    assert(breakVsTeaching.body.message.includes('overlaps with teaching session'), '2.3 Error message mentions teaching session');

    // 2.4 Conflict: Teaching session vs Break overlap (New teaching session attempted at 10:15 - 11:00)
    const teachingVsBreak = await apiRequest('/ustadh-schedules', {
      method: 'POST',
      body: {
        ustadhId: teacherA.id,
        classId: classA1.id,
        subjectId: subjectA2.id,
        dayOfWeek: 'MONDAY',
        startMinutes: 615, // 10:15 - 11:00 (overlaps break 10:00 - 10:30)
        endMinutes: 660,
        effectiveFrom: '2026-01-01',
      },
    });
    assert(teachingVsBreak.status === 400, '2.4 Conflict: Teaching session vs Break overlap rejected with 400');
    assert(teachingVsBreak.body.message.includes('Morning Interval'), '2.4 Error message mentions break name (Morning Interval)');

    // 2.5 Conflict: Class Teaching Overlap (Different teacher, same class, overlapping 08:30 - 09:30)
    const classTeachingOverlap = await apiRequest('/ustadh-schedules', {
      method: 'POST',
      body: {
        ustadhId: teacherA.id,
        classId: classA1.id,
        subjectId: subjectA2.id,
        dayOfWeek: 'MONDAY',
        startMinutes: 510, // 08:30 - 09:30 (Class Grade 01 already has FIQH 08:00 - 09:00)
        endMinutes: 570,
        effectiveFrom: '2026-01-01',
      },
    });
    assert(classTeachingOverlap.status === 400, '2.5 Conflict: Class Teaching overlap rejected with 400');

    // 2.6 Conflict: Teacher Overlap (Same teacher teaching in 2 classes at once)
    const teacherOverlap = await apiRequest('/ustadh-schedules', {
      method: 'POST',
      body: {
        ustadhId: ustadhA.id,
        classId: classA1.id, // Ahmad is already teaching Grade 02 at 10:30 - 11:30
        subjectId: subjectA1.id,
        dayOfWeek: 'MONDAY',
        startMinutes: 630, // 10:30 - 11:30
        endMinutes: 690,
        effectiveFrom: '2026-01-01',
      },
    });
    assert(teacherOverlap.status === 400, '2.6 Conflict: Teacher overlap rejected with 400');

    // 2.7 Update Break
    const updateBreakRes = await apiRequest(`/timetable/breaks/${break1Id}`, {
      method: 'PATCH',
      body: {
        name: 'Morning Tea Break',
      },
    });
    assert(updateBreakRes.status === 200, '2.7 Can update Break name');
    assert(updateBreakRes.body.data.name === 'Morning Tea Break', '2.7 Updated name persisted');

    // 2.8 List Breaks
    const listBreaksRes = await apiRequest(`/timetable/breaks?classId=${classA1.id}`);
    assert(listBreaksRes.status === 200, '2.8 Can list breaks for class');
    assert(listBreaksRes.body.data.items.length === 1, '2.8 One break found');

    // =========================================================================
    // 3. UNIFIED CLASS TIMETABLE QUERY & CHRONOLOGICAL MERGE
    // =========================================================================
    console.log('\n--- 3. Unified Class Timetable Query ---');

    const classTimetableRes = await apiRequest(`/timetable/class?classId=${classA1.id}&referenceDate=2026-03-15`);
    assert(classTimetableRes.status === 200, '3.1 Can get Class Timetable for Grade 01');
    const items = classTimetableRes.body.data.items;
    assert(items.length === 3, '3.2 Total 3 items on Monday: 2 teaching + 1 break');
    assert(items[0].type === 'TEACHING' && items[0].startMinutes === 480, '3.3 First slot is Teaching (08:00-09:00)');
    assert(items[1].type === 'TEACHING' && items[1].startMinutes === 540, '3.4 Second slot is Teaching (09:00-10:00)');
    assert(items[2].type === 'BREAK' && items[2].startMinutes === 600, '3.5 Third slot is Break (10:00-10:30)');
    assert(items[2].name === 'Morning Tea Break', '3.6 Break name is properly merged');

    // =========================================================================
    // 4. HISTORICAL TIMETABLE QUERY (Reference Date Authority)
    // =========================================================================
    console.log('\n--- 4. Historical Timetable Query Authority ---');

    // Create an old historical session effective only for January 2026 (ended 2026-01-31, isActive: false)
    const oldSchedule = await prisma.ustadhSchedule.create({
      data: {
        madrasaId: madrasaA.id,
        ustadhId: ustadhA.id,
        classId: classA1.id,
        subjectId: subjectA1.id,
        dayOfWeek: 'FRIDAY',
        startMinutes: 960, // 16:00
        endMinutes: 1080,  // 18:00
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: new Date('2026-01-31'),
        isActive: false, // Closed out in February
      },
    });

    // 4.1 Query for January 15, 2026 -> Old Friday session MUST appear
    const janQuery = await apiRequest(`/timetable/class?classId=${classA1.id}&referenceDate=2026-01-15`);
    assert(janQuery.status === 200, '4.1 Query for 2026-01-15 succeeds');
    const janFriday = janQuery.body.data.items.find((it) => it.dayOfWeek === 'FRIDAY');
    assert(janFriday && janFriday.id === oldSchedule.id, '4.2 Historically closed schedule appears on referenceDate within its window');

    // 4.2 Query for March 15, 2026 -> Old Friday session MUST NOT appear
    const marQuery = await apiRequest(`/timetable/class?classId=${classA1.id}&referenceDate=2026-03-15`);
    const marFriday = marQuery.body.data.items.find((it) => it.dayOfWeek === 'FRIDAY');
    assert(!marFriday, '4.3 Historically closed schedule does NOT appear on referenceDate after effectiveTo');

    // =========================================================================
    // 5. STAFF TIMETABLE & SEPARATION RULE
    // =========================================================================
    console.log('\n--- 5. Staff Timetable View & Separation Rule ---');

    // 5.1 Ustadh Ahmad Timetable
    const ahmadTimetable = await apiRequest(`/timetable/staff?ustadhId=${ustadhA.id}&referenceDate=2026-03-15`);
    assert(ahmadTimetable.status === 200, '5.1 Can query staff timetable for Ustadh Ahmad');
    assert(ahmadTimetable.body.data.items.length === 2, '5.2 Shows Ahmad 2 teaching sessions');
    // Mandatory separation rule: NO breaks in staff timetable
    const hasBreaksInStaff = ahmadTimetable.body.data.items.some((it) => it.type === 'BREAK');
    assert(!hasBreaksInStaff, '5.3 Mandatory rule: Staff timetable contains ZERO breaks');

    // 5.2 Teacher Sarah Timetable
    const sarahTimetable = await apiRequest(`/timetable/staff?ustadhId=${teacherA.id}&referenceDate=2026-03-15`);
    assert(sarahTimetable.status === 200, '5.4 Can query staff timetable for Teacher Sarah');
    assert(sarahTimetable.body.data.items.length === 1, '5.5 Shows Sarah 1 teaching session');
    assert(sarahTimetable.body.data.items[0].subject.name === 'MATHEMATICS', '5.6 Subject is MATHEMATICS');

    // 5.3 Filter by staffType = 'SCHOOL_TEACHER'
    const schoolTeachersTimetable = await apiRequest('/timetable/staff?staffType=SCHOOL_TEACHER&referenceDate=2026-03-15');
    assert(schoolTeachersTimetable.status === 200, '5.7 Can filter timetable by staffType=SCHOOL_TEACHER');
    assert(
      schoolTeachersTimetable.body.data.items.every((it) => it.staff.staffType === 'SCHOOL_TEACHER'),
      '5.8 All returned sessions belong to School Teachers'
    );

    // =========================================================================
    // 6. FULL MASTER TIMETABLE
    // =========================================================================
    console.log('\n--- 6. Full Master Timetable ---');

    const fullTimetable = await apiRequest('/timetable/full?referenceDate=2026-03-15');
    assert(fullTimetable.status === 200, '6.1 Can fetch full master timetable across Madrasa');
    assert(fullTimetable.body.data.items.length === 4, '6.2 Full master timetable contains 4 total active items (3 teaching + 1 break)');

    // =========================================================================
    // 7. MULTI-TENANT ISOLATION
    // =========================================================================
    console.log('\n--- 7. Multi-Tenant Isolation ---');

    // Madrasa B admin attempts to query class timetable of Madrasa A
    const crossClassQuery = await apiRequest(`/timetable/class?classId=${classA1.id}`, { token: tokenB });
    assert(crossClassQuery.status === 404, '7.1 Cross-tenant Class query returns 404');

    // Madrasa B admin attempts to query staff timetable of Madrasa A
    const crossStaffQuery = await apiRequest(`/timetable/staff?ustadhId=${ustadhA.id}`, { token: tokenB });
    assert(crossStaffQuery.status === 404, '7.2 Cross-tenant Staff query returns 404');

    // Madrasa B admin attempts to update break of Madrasa A
    const crossBreakUpdate = await apiRequest(`/timetable/breaks/${break1Id}`, {
      method: 'PATCH',
      body: { name: 'Hacked Break' },
      token: tokenB,
    });
    assert(crossBreakUpdate.status === 404, '7.3 Cross-tenant Break update returns 404');

    // =========================================================================
    // 8. SUBSCRIPTION GATE VERIFICATION
    // =========================================================================
    console.log('\n--- 8. Subscription Gates ---');

    // 8.1 Expired Subscription -> 403 Forbidden
    const expRes = await apiRequest('/timetable/full', { token: tokenExpired });
    assert(expRes.status === 403, '8.1 Expired subscription rejected with 403 Forbidden');

    // 8.2 Suspended Subscription -> 403 Forbidden
    const penRes = await apiRequest('/timetable/full', { token: tokenPending });
    assert(penRes.status === 403, '8.2 Suspended subscription rejected with 403 Forbidden');

    // 8.3 No Subscription -> 403 Forbidden
    const noSubRes = await apiRequest('/timetable/full', { token: tokenNoSub });
    assert(noSubRes.status === 403, '8.3 No subscription rejected with 403 Forbidden');

    // =========================================================================
    // 9. PDF EXPORTS & VISUAL VERIFICATION ARTIFACT
    // =========================================================================
    console.log('\n--- 9. PDF Exports (Puppeteer) ---');

    // 9.1 Export Class Timetable PDF
    const classPdfRes = await apiRequest(`/timetable/export/class/pdf?classId=${classA1.id}&referenceDate=2026-03-15`);
    assert(classPdfRes.status === 200, '9.1 Class Timetable PDF returns 200 OK');
    assert(Buffer.isBuffer(classPdfRes.buffer), '9.2 Returned data is binary Buffer');
    assert(classPdfRes.buffer.toString('utf8', 0, 5) === '%PDF-', '9.3 Class PDF has valid %PDF- header');

    // 9.2 Export Staff Timetable PDF
    const staffPdfRes = await apiRequest(`/timetable/export/staff/pdf?ustadhId=${ustadhA.id}&referenceDate=2026-03-15`);
    assert(staffPdfRes.status === 200, '9.4 Staff Timetable PDF returns 200 OK');
    assert(staffPdfRes.buffer.toString('utf8', 0, 5) === '%PDF-', '9.5 Staff PDF has valid %PDF- header');

    // 9.3 Export Full Master Timetable PDF (Landscape)
    const fullPdfRes = await apiRequest('/timetable/export/full/pdf?referenceDate=2026-03-15');
    assert(fullPdfRes.status === 200, '9.6 Full Master Timetable PDF returns 200 OK');
    assert(fullPdfRes.buffer.toString('utf8', 0, 5) === '%PDF-', '9.7 Full PDF has valid %PDF- header');

    // Save a sample Full Master Timetable PDF to scratch/artifacts directory for verification
    const artifactsDir = path.resolve('C:/Users/mhdna/.gemini/antigravity/brain/558e064b-69cc-49f4-a155-8925ab51d8cd');
    const scratchDir = path.join(artifactsDir, 'scratch');
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }
    const samplePdfPath = path.join(scratchDir, 'Sample_Full_Master_Timetable.pdf');
    fs.writeFileSync(samplePdfPath, fullPdfRes.buffer);
    console.log(`  ✓ Sample Full Master Timetable PDF saved to: ${samplePdfPath} (${fullPdfRes.buffer.length} bytes)`);

    // 9.4 Delete/Deactivate Break
    const deleteBreakRes = await apiRequest(`/timetable/breaks/${break1Id}`, { method: 'DELETE' });
    assert(deleteBreakRes.status === 200, '9.8 Break successfully deactivated');

    // =========================================================================
    // 10. MULTI-PERIOD DAY & WEEKLY GRID PDF VERIFICATION
    // =========================================================================
    console.log('\n--- 10. Multi-Period Day & Weekly Grid PDF Refinements ---');

    // 10.1 Dedicated Multi-Period Class & Staff
    const classMulti = await prisma.class.create({
      data: {
        madrasaId: madrasaA.id,
        name: `Grade 05_Multi_${Date.now().toString().slice(-4)}`,
        code: `G5_${Date.now().toString().slice(-4)}`,
        defaultMonthlyFee: 600,
        isActive: true,
      },
    });

    const staffM1 = await prisma.ustadh.create({
      data: {
        madrasaId: madrasaA.id,
        ustadhCode: `UST_M1_${Date.now().toString().slice(-4)}`,
        staffType: 'USTADH',
        fullName: 'Ustadh Tariq Aziz',
        email: `${TEST_PREFIX}_tariq@example.com`,
        joinDate: new Date('2025-01-01'),
        baseMonthlySalary: 45000,
        isActive: true,
      },
    });

    const staffM2 = await prisma.ustadh.create({
      data: {
        madrasaId: madrasaA.id,
        ustadhCode: `TCH_M2_${Date.now().toString().slice(-4)}`,
        staffType: 'SCHOOL_TEACHER',
        fullName: 'Teacher Zaid Omar',
        email: `${TEST_PREFIX}_zaid@example.com`,
        joinDate: new Date('2025-01-01'),
        baseMonthlySalary: 40000,
        isActive: true,
      },
    });

    const subjArabic = await prisma.subject.create({
      data: {
        madrasaId: madrasaA.id,
        name: 'ARABIC LANGUAGE',
        code: 'ARB',
        isActive: true,
      },
    });

    const subjQuran = await prisma.subject.create({
      data: {
        madrasaId: madrasaA.id,
        name: 'QURAN RECITATION',
        code: 'QUR',
        isActive: true,
      },
    });

    // Schedule 7 periods on MONDAY for Grade 05:
    // Period 1: 08:00 - 08:40 (480 - 520) - QURAN
    // Period 2: 08:40 - 09:20 (520 - 560) - FIQH
    // Period 3: 09:20 - 10:00 (560 - 600) - ARABIC
    // [Morning Break: 10:00 - 10:20 (600 - 620)]
    // Period 4: 10:20 - 11:00 (620 - 660) - MATHEMATICS
    // Period 5: 11:00 - 11:40 (660 - 700) - QURAN
    // Period 6: 11:40 - 12:20 (700 - 740) - ARABIC
    // Period 7: 12:20 - 13:00 (740 - 780) - MATHEMATICS

    const mondayPeriods = [
      { start: 480, end: 520, staff: staffM1.id, subject: subjQuran.id },
      { start: 520, end: 560, staff: staffM1.id, subject: subjectA1.id },
      { start: 560, end: 600, staff: staffM1.id, subject: subjArabic.id },
      { start: 620, end: 660, staff: staffM2.id, subject: subjectA2.id },
      { start: 660, end: 700, staff: staffM1.id, subject: subjQuran.id },
      { start: 700, end: 740, staff: staffM1.id, subject: subjArabic.id },
      { start: 740, end: 780, staff: staffM2.id, subject: subjectA2.id },
    ];

    for (const p of mondayPeriods) {
      await prisma.ustadhSchedule.create({
        data: {
          madrasaId: madrasaA.id,
          classId: classMulti.id,
          ustadhId: p.staff,
          subjectId: p.subject,
          dayOfWeek: 'MONDAY',
          startMinutes: p.start,
          endMinutes: p.end,
          effectiveFrom: new Date('2026-01-01'),
          isActive: true,
        },
      });
    }

    // Interval on MONDAY (10:00 - 10:20)
    await prisma.timetableBreak.create({
      data: {
        madrasaId: madrasaA.id,
        classId: classMulti.id,
        name: 'Morning Interval',
        dayOfWeek: 'MONDAY',
        startMinutes: 600,
        endMinutes: 620,
        effectiveFrom: new Date('2026-01-01'),
        isActive: true,
      },
    });

    // Schedule 7 periods on TUESDAY for Grade 05:
    const tuesdayPeriods = [
      { start: 480, end: 520, staff: staffM1.id, subject: subjQuran.id },
      { start: 520, end: 560, staff: staffM1.id, subject: subjectA1.id },
      { start: 560, end: 600, staff: staffM1.id, subject: subjArabic.id },
      { start: 620, end: 660, staff: staffM2.id, subject: subjectA2.id },
      { start: 660, end: 700, staff: staffM1.id, subject: subjQuran.id },
      { start: 700, end: 740, staff: staffM1.id, subject: subjArabic.id },
      { start: 740, end: 780, staff: staffM2.id, subject: subjectA2.id },
    ];

    for (const p of tuesdayPeriods) {
      await prisma.ustadhSchedule.create({
        data: {
          madrasaId: madrasaA.id,
          classId: classMulti.id,
          ustadhId: p.staff,
          subjectId: p.subject,
          dayOfWeek: 'TUESDAY',
          startMinutes: p.start,
          endMinutes: p.end,
          effectiveFrom: new Date('2026-01-01'),
          isActive: true,
        },
      });
    }

    // Interval on TUESDAY (10:00 - 10:20)
    await prisma.timetableBreak.create({
      data: {
        madrasaId: madrasaA.id,
        classId: classMulti.id,
        name: 'Morning Interval',
        dayOfWeek: 'TUESDAY',
        startMinutes: 600,
        endMinutes: 620,
        effectiveFrom: new Date('2026-01-01'),
        isActive: true,
      },
    });

    // Schedule 4 periods on WEDNESDAY for Grade 05:
    const wednesdayPeriods = [
      { start: 480, end: 520, staff: staffM1.id, subject: subjQuran.id },
      { start: 520, end: 560, staff: staffM1.id, subject: subjectA1.id },
      { start: 560, end: 600, staff: staffM1.id, subject: subjArabic.id },
      { start: 620, end: 660, staff: staffM2.id, subject: subjectA2.id },
    ];

    for (const p of wednesdayPeriods) {
      await prisma.ustadhSchedule.create({
        data: {
          madrasaId: madrasaA.id,
          classId: classMulti.id,
          ustadhId: p.staff,
          subjectId: p.subject,
          dayOfWeek: 'WEDNESDAY',
          startMinutes: p.start,
          endMinutes: p.end,
          effectiveFrom: new Date('2026-01-01'),
          isActive: true,
        },
      });
    }

    // 10.2 Verify Class Timetable API returns all 8 items on Monday & Tuesday, and 4 on Wednesday
    const multiTimetableRes = await apiRequest(`/timetable/class?classId=${classMulti.id}&referenceDate=2026-03-15`);
    assert(multiTimetableRes.status === 200, '10.1 Multi-period Class Timetable query returns 200 OK');
    const multiItems = multiTimetableRes.body.data.items;

    const monItems = multiItems.filter((it) => it.dayOfWeek === 'MONDAY');
    const tueItems = multiItems.filter((it) => it.dayOfWeek === 'TUESDAY');
    const wedItems = multiItems.filter((it) => it.dayOfWeek === 'WEDNESDAY');

    assert(monItems.length === 8, '10.2 Monday contains exactly 8 items (7 teaching periods + 1 interval)');
    assert(tueItems.length === 8, '10.3 Tuesday contains exactly 8 items (7 teaching periods + 1 interval)');
    assert(wedItems.length === 4, '10.4 Wednesday contains exactly 4 teaching periods');

    // 10.3 Verify chronological ordering & break placement between periods 3 and 4
    assert(monItems[0].type === 'TEACHING' && monItems[0].startMinutes === 480, '10.5 Mon Item 0: Period 1 (08:00 - 08:40)');
    assert(monItems[1].type === 'TEACHING' && monItems[1].startMinutes === 520, '10.6 Mon Item 1: Period 2 (08:40 - 09:20)');
    assert(monItems[2].type === 'TEACHING' && monItems[2].startMinutes === 560, '10.7 Mon Item 2: Period 3 (09:20 - 10:00)');
    assert(monItems[3].type === 'BREAK' && monItems[3].startMinutes === 600 && monItems[3].endMinutes === 620, '10.8 Mon Item 3: Morning Interval (10:00 - 10:20) positioned exactly between periods 3 and 4');
    assert(monItems[4].type === 'TEACHING' && monItems[4].startMinutes === 620, '10.9 Mon Item 4: Period 4 (10:20 - 11:00)');
    assert(monItems[5].type === 'TEACHING' && monItems[5].startMinutes === 660, '10.10 Mon Item 5: Period 5 (11:00 - 11:40)');
    assert(monItems[6].type === 'TEACHING' && monItems[6].startMinutes === 700, '10.11 Mon Item 6: Period 6 (11:40 - 12:20)');
    assert(monItems[7].type === 'TEACHING' && monItems[7].startMinutes === 740, '10.12 Mon Item 7: Period 7 (12:20 - 13:00)');

    assert(tueItems[3].type === 'BREAK' && tueItems[3].startMinutes === 600 && tueItems[3].endMinutes === 620, '10.13 Tue Item 3: Morning Interval positioned between periods 3 and 4');

    // 10.4 Export PDF for Multi-Period Class & Inspect Generated Binary
    const multiPdfRes = await apiRequest(`/timetable/export/class/pdf?classId=${classMulti.id}&referenceDate=2026-03-15`);
    assert(multiPdfRes.status === 200, '10.14 Multi-period Class Timetable PDF export returns 200 OK');
    assert(Buffer.isBuffer(multiPdfRes.buffer), '10.15 Exported Class Timetable is binary Buffer');
    assert(multiPdfRes.buffer.toString('utf8', 0, 5) === '%PDF-', '10.16 Multi-period Class PDF has valid %PDF- header');

    const sampleClassPdfPath = path.join(scratchDir, 'Sample_Class_Timetable_Grid.pdf');
    fs.writeFileSync(sampleClassPdfPath, multiPdfRes.buffer);
    console.log(`  ✓ Sample Class Timetable Grid PDF saved to: ${sampleClassPdfPath} (${multiPdfRes.buffer.length} bytes)`);
  } catch (err) {
    console.error('Test execution error:', err);
    testFailedCount++;
  } finally {
    await teardown();
  }

  console.log('\n==================================================');
  console.log(`TIMETABLE TEST RESULTS: ${testPassedCount} PASSED, ${testFailedCount} FAILED`);
  console.log('==================================================\n');

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runTests();
