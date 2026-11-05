import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import http from 'http';
import { enableTestMode, getTestEmails, clearTestEmails } from '../src/services/email.service.js';
import { buildWaMeUrl, normalizeWaMeDigits } from '../src/services/ustadh.service.js';
import { doEffectiveDatesOverlap, doTimesOverlap } from '../src/services/ustadh-schedule.service.js';

const TEST_PREFIX = 'ust_test_' + Date.now();

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
let classA = null;
let subjectA1 = null;
let subjectA2 = null;

let madrasaB = null;
let adminB = null;
let tokenB = '';
let classB = null;
let subjectB = null;

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
  console.log('\n--- Setting up Ustadh Management Test Fixtures ---');
  enableTestMode(true);
  const now = new Date();

  // 1. Subscription Plan
  const plan = await prisma.plan.upsert({
    where: { code: 'PRO_USTADH_TEST' },
    create: {
      name: 'Pro Ustadh Test Plan',
      code: 'PRO_USTADH_TEST',
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
      code: `MA_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `ma-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
      startsAt: new Date(now.getTime() - 10 * 86400000),
      endsAt: new Date(now.getTime() + 300 * 86400000),
      priceAtPurchase: 1000,
      durationMonthsAtPurchase: 12,
    },
  });

  tokenA = signAccessToken({
    userId: adminA.id,
    madrasaId: madrasaA.id,
    role: 'MADRASA_ADMIN',
  });

  classA = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Hifz 01',
      code: `H01_${Date.now().toString().slice(-4)}`,
      defaultMonthlyFee: 2000,
      isActive: true,
    },
  });

  subjectA1 = await prisma.subject.create({
    data: {
      madrasaId: madrasaA.id,
      name: `Qur'an_${Date.now().toString().slice(-4)}`,
      code: `QUR_${Date.now().toString().slice(-4)}`,
      isActive: true,
    },
  });

  subjectA2 = await prisma.subject.create({
    data: {
      madrasaId: madrasaA.id,
      name: `Tajweed_${Date.now().toString().slice(-4)}`,
      code: `TAJ_${Date.now().toString().slice(-4)}`,
      isActive: true,
    },
  });

  // 3. Madrasa B (Active, Cross-Tenant)
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
  });

  classB = await prisma.class.create({
    data: {
      madrasaId: madrasaB.id,
      name: 'Class B',
      code: `CB_${Date.now().toString().slice(-4)}`,
      defaultMonthlyFee: 2000,
      isActive: true,
    },
  });

  subjectB = await prisma.subject.create({
    data: {
      madrasaId: madrasaB.id,
      name: `Subject B_${Date.now().toString().slice(-4)}`,
      code: `SB_${Date.now().toString().slice(-4)}`,
      isActive: true,
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
      startsAt: new Date(now.getTime() - 400 * 86400000),
      endsAt: new Date(now.getTime() - 10 * 86400000),
      priceAtPurchase: 1000,
      durationMonthsAtPurchase: 12,
    },
  });

  tokenExpired = signAccessToken({
    userId: adminExpired.id,
    madrasaId: madrasaExpired.id,
    role: 'MADRASA_ADMIN',
  });

  // 5. Madrasa Pending Payment
  madrasaPending = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa Pending`,
      code: `MP_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `mp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      email: `${TEST_PREFIX}_pend@example.com`,
    },
  });

  adminPending = await prisma.user.create({
    data: {
      madrasaId: madrasaPending.id,
      name: 'Admin Pending',
      email: `${TEST_PREFIX}_adminPend@example.com`,
      passwordHash: pwd,
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  tokenPending = signAccessToken({
    userId: adminPending.id,
    madrasaId: madrasaPending.id,
    role: 'MADRASA_ADMIN',
  });

  // 6. Madrasa No Subscription
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
  });

  // Start HTTP server on dynamic port
  testServer = http.createServer(app);
  await new Promise((resolve) => {
    testServer.listen(0, () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/madrasa-admin`;
      resolve();
    });
  });

  console.log(`Test server running at ${baseUrl}`);
}

async function teardown() {
  console.log('\n--- Cleaning up Test Data ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  const allMadrasaIds = [
    madrasaA?.id,
    madrasaB?.id,
    madrasaExpired?.id,
    madrasaPending?.id,
    madrasaNoSub?.id,
  ].filter(Boolean);

  if (allMadrasaIds.length > 0) {
    await prisma.notificationJob.deleteMany({ where: { madrasaId: { in: allMadrasaIds } } });
    await prisma.madrasaSetting.deleteMany({ where: { madrasaId: { in: allMadrasaIds } } });
    await prisma.ustadhAttendanceRecord.deleteMany({ where: { madrasaId: { in: allMadrasaIds } } });
    await prisma.ustadhSalary.deleteMany({ where: { madrasaId: { in: allMadrasaIds } } });
    await prisma.ustadhSchedule.deleteMany({ where: { madrasaId: { in: allMadrasaIds } } });
    await prisma.ustadh.deleteMany({ where: { madrasaId: { in: allMadrasaIds } } });
    await prisma.subject.deleteMany({ where: { madrasaId: { in: allMadrasaIds } } });
    await prisma.class.deleteMany({ where: { madrasaId: { in: allMadrasaIds } } });
    await prisma.subscription.deleteMany({ where: { madrasaId: { in: allMadrasaIds } } });
    await prisma.user.deleteMany({ where: { madrasaId: { in: allMadrasaIds } } });
    await prisma.madrasa.deleteMany({ where: { id: { in: allMadrasaIds } } });
  }

  await prisma.$disconnect();
}

async function runTests() {
  await setup();

  let createdUstadhA = null;
  let createdUstadhA2 = null;
  let scheduleFriday = null;
  let scheduleSaturday = null;

  console.log('\n--- SECTION 1: USTADH PROFILE TESTS ---');

  // 1. Create Ustadh Ahmed
  {
    const res = await fetch(`${baseUrl}/ustadhs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        fullName: 'Ustadh Ahmed Al-Farsi',
        phoneNumber: '+94771234567',
        whatsappNumber: '+94783254552',
        email: 'ahmed.test@example.com',
        joinDate: '2026-01-01',
        baseMonthlySalary: 25000.00,
        notes: 'Senior Hifz Teacher',
      }),
    });

    const json = await res.json();
    assert(res.status === 201, 'POST /ustadhs returns 201 Created');
    assert(json.data.ustadhCode === 'UST001', 'First Ustadh receives code UST001');
    assert(json.data.baseMonthlySalary === 25000, 'baseMonthlySalary stored precisely as Decimal');
    assert(json.data.normalizedWhatsApp === '94783254552', 'normalizedWhatsApp strips + and keeps international digits');
    createdUstadhA = json.data;
  }

  // 2. Reject non-international local WhatsApp number
  {
    const res = await fetch(`${baseUrl}/ustadhs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        fullName: 'Invalid Phone Ustadh',
        whatsappNumber: '0783254552', // Non-E.164 missing country code
        joinDate: '2026-01-01',
        baseMonthlySalary: 20000,
      }),
    });

    assert(res.status === 400, 'Local non-international WhatsApp number rejected with HTTP 400');
  }

  // 3. Reject leaveDate before joinDate
  {
    const res = await fetch(`${baseUrl}/ustadhs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        fullName: 'Invalid Dates Ustadh',
        joinDate: '2026-06-01',
        leaveDate: '2026-05-01', // Before joinDate!
        baseMonthlySalary: 20000,
      }),
    });

    assert(res.status === 400, 'leaveDate before joinDate rejected with HTTP 400');
  }

  // 4. Concurrency-safe Ustadh code generation
  {
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/ustadhs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ fullName: 'Concurrent Ustadh 1', joinDate: '2026-01-01', baseMonthlySalary: 22000 }),
      }),
      fetch(`${baseUrl}/ustadhs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ fullName: 'Concurrent Ustadh 2', joinDate: '2026-01-01', baseMonthlySalary: 22000 }),
      }),
    ]);

    const json1 = await res1.json();
    const json2 = await res2.json();

    assert(res1.status === 201 && res2.status === 201, 'Concurrent Ustadh creations both succeed (201)');
    assert(json1.data.ustadhCode !== json2.data.ustadhCode, 'Concurrent Ustadhs get distinct unique codes');
    assert(
      (json1.data.ustadhCode === 'UST002' && json2.data.ustadhCode === 'UST003') ||
      (json1.data.ustadhCode === 'UST003' && json2.data.ustadhCode === 'UST002'),
      'Codes sequentially advance to UST002 and UST003 without collision'
    );
    createdUstadhA2 = json1.data.ustadhCode === 'UST002' ? json1.data : json2.data;
  }

  // 5. Update Ustadh profile
  {
    const res = await fetch(`${baseUrl}/ustadhs/${createdUstadhA.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        notes: 'Updated Senior Hifz Teacher notes',
      }),
    });

    const json = await res.json();
    assert(res.status === 200, 'PATCH /ustadhs/:id returns 200 OK');
    assert(json.data.notes === 'Updated Senior Hifz Teacher notes', 'Notes updated successfully');
  }

  // 6. Cross-tenant Ustadh access returns 404
  {
    const res = await fetch(`${baseUrl}/ustadhs/${createdUstadhA.id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    assert(res.status === 404, 'Madrasa B accessing Madrasa A Ustadh returns generic 404');
  }

  console.log('\n--- SECTION 2: WEEKLY TEACHING SCHEDULE TESTS ---');

  // 7. Create Friday 4:00 PM – 6:00 PM schedule (start: 960, end: 1080)
  {
    const res = await fetch(`${baseUrl}/ustadh-schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        ustadhId: createdUstadhA.id,
        classId: classA.id,
        subjectId: subjectA1.id,
        dayOfWeek: 'FRIDAY',
        startMinutes: 960, // 16:00
        endMinutes: 1080,  // 18:00
        effectiveFrom: '2026-01-01',
      }),
    });

    const json = await res.json();
    assert(res.status === 201, 'POST /ustadh-schedules creates Friday schedule (201)');
    assert(json.data.dayOfWeek === 'FRIDAY', 'Friday schedule confirmed');
    scheduleFriday = json.data;
  }

  // 8. Create Saturday 8:00 AM – 10:00 AM schedule (start: 480, end: 600)
  {
    const res = await fetch(`${baseUrl}/ustadh-schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        ustadhId: createdUstadhA.id,
        classId: classA.id,
        subjectId: subjectA2.id,
        dayOfWeek: 'SATURDAY',
        startMinutes: 480, // 08:00
        endMinutes: 600,   // 10:00
        effectiveFrom: '2026-01-01',
      }),
    });

    const json = await res.json();
    assert(res.status === 201, 'POST /ustadh-schedules creates Saturday schedule (201)');
    scheduleSaturday = json.data;
  }

  // 9. Reject invalid schedule times (start >= end)
  {
    const res = await fetch(`${baseUrl}/ustadh-schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        ustadhId: createdUstadhA.id,
        classId: classA.id,
        subjectId: subjectA1.id,
        dayOfWeek: 'MONDAY',
        startMinutes: 600,
        endMinutes: 500, // end < start!
        effectiveFrom: '2026-01-01',
      }),
    });

    assert(res.status === 400, 'startMinutes >= endMinutes rejected with HTTP 400');
  }

  // 10. Reject schedule conflict (same Ustadh, Friday 5:00 PM – 7:00 PM overlapping 4:00 PM – 6:00 PM)
  {
    const res = await fetch(`${baseUrl}/ustadh-schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        ustadhId: createdUstadhA.id,
        classId: classA.id,
        subjectId: subjectA2.id,
        dayOfWeek: 'FRIDAY',
        startMinutes: 1020, // 17:00 (overlaps 16:00-18:00)
        endMinutes: 1140,  // 19:00
        effectiveFrom: '2026-01-01',
      }),
    });

    assert(res.status === 400, 'Overlapping Friday schedule for same Ustadh rejected with HTTP 400');
  }

  // 11. Allow non-overlapping effective periods with same day & time
  {
    const res = await fetch(`${baseUrl}/ustadh-schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        ustadhId: createdUstadhA.id,
        classId: classA.id,
        subjectId: subjectA1.id,
        dayOfWeek: 'SUNDAY',
        startMinutes: 500,
        endMinutes: 600,
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-06-30',
      }),
    });
    assert(res.status === 201, 'Sunday schedule for Jan-June created (201)');

    const res2 = await fetch(`${baseUrl}/ustadh-schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        ustadhId: createdUstadhA.id,
        classId: classA.id,
        subjectId: subjectA1.id,
        dayOfWeek: 'SUNDAY',
        startMinutes: 500,
        endMinutes: 600, // Same time, but non-overlapping effective period
        effectiveFrom: '2026-07-01',
        effectiveTo: '2026-12-31',
      }),
    });
    assert(res2.status === 201, 'Same time allowed when effective dates do not overlap (201)');
  }

  // 12. Reject cross-tenant class or subject in schedule
  {
    const res = await fetch(`${baseUrl}/ustadh-schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        ustadhId: createdUstadhA.id,
        classId: classB.id, // Belong to Madrasa B
        subjectId: subjectA1.id,
        dayOfWeek: 'MONDAY',
        startMinutes: 600,
        endMinutes: 700,
        effectiveFrom: '2026-01-01',
      }),
    });

    assert(res.status === 404, 'Cross-tenant class in schedule returns 404');
  }

  console.log('\n--- SECTION 3: STAFF ATTENDANCE TESTS ---');

  // 13. Load Friday attendance (Friday 2026-09-18)
  {
    const res = await fetch(`${baseUrl}/ustadh-attendance?date=2026-09-18`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const json = await res.json();
    assert(res.status === 200, 'GET /ustadh-attendance for Friday returns 200 OK');
    assert(json.data.weekday === 'FRIDAY', 'Date correctly identified as FRIDAY');
    assert(json.data.sessions.length >= 1, 'Loads Friday scheduled sessions');
    assert(json.data.sessions.some((s) => s.scheduleId === scheduleFriday.id), 'Contains Ahmed Friday 4PM-6PM session');
  }

  // 14. Bulk Save Attendance (Ahmed: PRESENT)
  {
    const res = await fetch(`${baseUrl}/ustadh-attendance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        date: '2026-09-18',
        records: [
          { scheduleId: scheduleFriday.id, status: 'PRESENT' },
        ],
      }),
    });

    const json = await res.json();
    assert(res.status === 200, 'PUT /ustadh-attendance returns 200 OK');
    assert(json.data.isSaved === true, 'isSaved is now true');
    assert(json.data.summary.presentCount === 1, 'presentCount is 1');
  }

  // 15. Re-save updates existing attendance idempotently
  {
    const res = await fetch(`${baseUrl}/ustadh-attendance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        date: '2026-09-18',
        records: [
          { scheduleId: scheduleFriday.id, status: 'ABSENT' }, // Changed to ABSENT
        ],
      }),
    });

    const json = await res.json();
    assert(res.status === 200, 'Re-saving attendance returns 200 OK');
    assert(json.data.summary.absentCount === 1, 'absentCount updated to 1');
    assert(json.data.summary.presentCount === 0, 'presentCount updated to 0');

    // Switch back to PRESENT for subsequent tests
    await fetch(`${baseUrl}/ustadh-attendance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        date: '2026-09-18',
        records: [{ scheduleId: scheduleFriday.id, status: 'PRESENT' }],
      }),
    });
  }

  // 16. Record a Saturday attendance (Saturday 2026-09-19: ABSENT)
  {
    const res = await fetch(`${baseUrl}/ustadh-attendance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        date: '2026-09-19',
        records: [
          { scheduleId: scheduleSaturday.id, status: 'ABSENT' },
        ],
      }),
    });

    assert(res.status === 200, 'Saturday attendance recorded as ABSENT (200)');
  }

  // 17. Monthly Attendance Summary: Denominator uses recorded sessions only, missing != absent
  {
    const res = await fetch(`${baseUrl}/ustadh-attendance/monthly-summary?month=2026-09`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const json = await res.json();
    assert(res.status === 200, 'GET /ustadh-attendance/monthly-summary returns 200 OK');
    const ahmedSummary = json.data.items.find((i) => i.ustadhId === createdUstadhA.id);
    assert(Boolean(ahmedSummary), 'Ahmed summary found in monthly summary');
    assert(ahmedSummary.recordedSessions === 2, 'Total recorded sessions is 2 (1 Present, 1 Absent)');
    assert(ahmedSummary.presentSessions === 1, 'Present sessions is 1');
    assert(ahmedSummary.absentSessions === 1, 'Absent sessions is 1');
    assert(ahmedSummary.attendancePercentage === 50, 'Attendance % is exactly 50% (1/2 * 100)');
  }

  // 18. Historical Schedule Update Protection: Editing a schedule with attendance creates a new one and end-dates old one
  {
    const res = await fetch(`${baseUrl}/ustadh-schedules/${scheduleFriday.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        startMinutes: 1020, // Move to 5PM
        endMinutes: 1140,  // 7PM
        effectiveFrom: '2026-10-01',
      }),
    });

    const json = await res.json();
    assert(res.status === 200, 'PATCH schedule with existing attendance returns 200 OK');
    assert(json.data.id !== scheduleFriday.id, 'New schedule row created to protect history');

    // Check old schedule still exists and is inactive with effectiveTo
    const oldSchedule = await prisma.ustadhSchedule.findUnique({ where: { id: scheduleFriday.id } });
    assert(oldSchedule.isActive === false, 'Old historical schedule is deactivated');
    assert(oldSchedule.startMinutes === 960, 'Old historical schedule keeps 4PM start time');
  }

  // 19. Historical attendance still loads old schedule info
  {
    const res = await fetch(`${baseUrl}/ustadh-attendance?date=2026-09-18`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const json = await res.json();
    const fridaySession = json.data.sessions.find((s) => s.scheduleId === scheduleFriday.id);
    assert(Boolean(fridaySession), 'Historical September session still present');
    assert(fridaySession.startMinutes === 960, 'Historical session retains original 4:00 PM time');
    assert(fridaySession.status === 'PRESENT', 'Historical session retains saved status');
  }

  console.log('\n--- SECTION 4: MONTHLY SALARY & SLIP TESTS ---');

  let salaryAhmed = null;

  // 20. Generate September 2026 salaries
  {
    const res = await fetch(`${baseUrl}/ustadh-salaries/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ month: '2026-09' }),
    });

    const json = await res.json();
    assert(res.status === 200, 'POST /ustadh-salaries/generate returns 200 OK');
    salaryAhmed = json.data.items.find((s) => s.ustadhId === createdUstadhA.id);
    assert(Boolean(salaryAhmed), 'Salary record created for Ahmed');
    assert(salaryAhmed.baseSalarySnapshot === 25000, 'Base salary snapshot captured as 25,000');
    assert(salaryAhmed.payableAmount === 25000, 'Default payableAmount equals snapshot (25,000)');
    assert(salaryAhmed.status === 'PENDING', 'Initial status is PENDING');
    assert(salaryAhmed.attendance.recordedSessions === 2, 'Attendance stats attached (2 recorded)');
    assert(salaryAhmed.attendance.attendancePercentage === 50, 'Attendance % is 50%');
    assert(salaryAhmed.payableAmount === 25000, 'Salary NOT automatically deducted despite 1 absence');
  }

  // 21. Generation Idempotency & Snapshot Immutability
  {
    // Update Ustadh profile salary to 30,000
    await prisma.ustadh.update({
      where: { id: createdUstadhA.id },
      data: { baseMonthlySalary: 30000 },
    });

    // Re-generate September salary
    const res = await fetch(`${baseUrl}/ustadh-salaries/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ month: '2026-09' }),
    });

    const json = await res.json();
    const regeneratedAhmed = json.data.items.find((s) => s.ustadhId === createdUstadhA.id);
    assert(regeneratedAhmed.baseSalarySnapshot === 25000, 'Re-generation does NOT overwrite existing baseSalarySnapshot');
    assert(regeneratedAhmed.payableAmount === 25000, 'Re-generation does NOT overwrite existing payableAmount');
  }

  // 22. Manual Payable Adjustment: requires reason if amount differs
  {
    // Attempt adjustment without reason
    const resBad = await fetch(`${baseUrl}/ustadh-salaries/${salaryAhmed.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        payableAmount: 20000, // Differs from 25,000
        adjustmentReason: '', // Empty reason!
      }),
    });

    assert(resBad.status === 400, 'Adjustment without reason rejected with HTTP 400');

    // With valid reason
    const resGood = await fetch(`${baseUrl}/ustadh-salaries/${salaryAhmed.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        payableAmount: 22000,
        adjustmentReason: 'Approved half-month unpaid leave deduction',
      }),
    });

    const jsonGood = await resGood.json();
    assert(resGood.status === 200, 'Adjustment with reason succeeds (200 OK)');
    assert(jsonGood.data.payableAmount === 22000, 'Payable amount updated to 22,000');
    assert(jsonGood.data.adjustmentReason === 'Approved half-month unpaid leave deduction', 'Reason stored');
  }

  // 23. Pay Salary (Atomic transition from PENDING -> PAID + post-commit email)
  {
    clearTestEmails();

    const res = await fetch(`${baseUrl}/ustadh-salaries/${salaryAhmed.id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        paymentMethod: 'BANK_TRANSFER',
        paymentDate: '2026-09-30',
        paymentReference: 'TXN-987654321',
        paymentNote: 'Settled via Commercial Bank online transfer',
      }),
    });

    const json = await res.json();
    assert(res.status === 200, 'POST /pay returns 200 OK');
    assert(json.data.status === 'PAID', 'Status transitioned to PAID');
    assert(json.emailSent === true || json.emailQueued === true, 'Post-commit email was dispatched');

    let emails = getTestEmails();
    if (emails.length === 0) {
      const { processNotificationJobs } = await import('../src/jobs/notification-worker.job.js');
      await processNotificationJobs({ limit: 10 });
      emails = getTestEmails();
    }
    assert(emails.length === 1, 'Exactly one salary-paid email received in mailbox');
    assert(emails[0].to === 'ahmed.test@example.com', 'Email sent to Ustadh email address');
    assert(emails[0].subject.includes('2026-09') && emails[0].subject.includes('Salary'), 'Email subject mentions month');
  }

  // 24. Double-click payment protection: already-paid returns safe status and does NOT send second email
  {
    clearTestEmails();

    const resRepeat = await fetch(`${baseUrl}/ustadh-salaries/${salaryAhmed.id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        paymentMethod: 'CASH',
        paymentDate: '2026-09-30',
      }),
    });

    const jsonRepeat = await resRepeat.json();
    assert(resRepeat.status === 200, 'Repeat payment request returns 200');
    assert(jsonRepeat.alreadyPaid === true, 'Response indicates salary was already paid');
    assert(jsonRepeat.emailSent === false, 'Duplicate email was NOT sent');
    assert(getTestEmails().length === 0, 'No email added on repeat payment');
  }

  // 25. Paid Salary is Immutable
  {
    const resEdit = await fetch(`${baseUrl}/ustadh-salaries/${salaryAhmed.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ payableAmount: 18000, adjustmentReason: 'Hack' }),
    });

    assert(resEdit.status === 400, 'Editing PAID salary rejected with HTTP 400');
  }

  // 26. Download Salary Slip PDF
  {
    const res = await fetch(`${baseUrl}/ustadh-salaries/${salaryAhmed.id}/slip`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    assert(res.status === 200, 'GET /slip returns HTTP 200');
    assert(res.headers.get('content-type') === 'application/pdf', 'Content-Type is application/pdf');
    const buffer = await res.arrayBuffer();
    assert(buffer.byteLength > 1000, 'Valid PDF buffer generated (> 1000 bytes)');
  }

  console.log('\n--- SECTION 5: NOTIFICATIONS & WHATSAPP TESTS ---');

  // 27. Direct Email sending (strictly to Ustadh's stored email)
  {
    clearTestEmails();

    const res = await fetch(`${baseUrl}/ustadhs/${createdUstadhA.id}/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        subject: 'Upcoming Staff Meeting',
        message: 'Assalamu Alaikum Ustadh, please attend the staff meeting this Saturday at 11 AM.',
      }),
    });

    const json = await res.json();
    assert(res.status === 200, 'POST /ustadhs/:id/email returns 200 OK');
    const emails = getTestEmails();
    assert(emails.length === 1, 'Direct email dispatched to Ustadh');
    assert(emails[0].to === 'ahmed.test@example.com', 'Direct email routed strictly to Ustadh profile email');
  }

  // 28. WhatsApp link formatting
  {
    const url = buildWaMeUrl('+94783254552', 'Assalamu Alaikum Ustadh Ahmed, salary paid.');
    assert(url.startsWith('https://wa.me/94783254552?text='), 'wa.me URL formatted with digits-only and international prefix');
    assert(url.includes('salary%20paid'), 'Message text properly URI encoded');
  }

  console.log('\n--- SECTION 6: SUBSCRIPTION GATE & TENANT ISOLATION TESTS ---');

  // 29. Block PENDING Subscription
  {
    const res = await fetch(`${baseUrl}/ustadhs`, {
      headers: { Authorization: `Bearer ${tokenPending}` },
    });
    assert(res.status === 403, 'PENDING subscription blocked with HTTP 403');
  }

  // 30. Block EXPIRED Subscription
  {
    const res = await fetch(`${baseUrl}/ustadhs`, {
      headers: { Authorization: `Bearer ${tokenExpired}` },
    });
    assert(res.status === 403, 'EXPIRED subscription blocked with HTTP 403');
  }

  // 31. Block NO Subscription
  {
    const res = await fetch(`${baseUrl}/ustadhs`, {
      headers: { Authorization: `Bearer ${tokenNoSub}` },
    });
    assert(res.status === 403, 'NO subscription blocked with HTTP 403');
  }

  // 32. Multi-Tenant Isolation
  {
    const resSalaryB = await fetch(`${baseUrl}/ustadh-salaries/${salaryAhmed.id}/slip`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(resSalaryB.status === 404, 'Madrasa B cannot download Madrasa A salary slip (404)');

    const resPayB = await fetch(`${baseUrl}/ustadh-salaries/${salaryAhmed.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ paymentMethod: 'CASH', paymentDate: '2026-09-30' }),
    });
    assert(resPayB.status === 404, 'Madrasa B cannot pay Madrasa A salary (404)');
  }

  console.log('\n--- SECTION 7: TEACHING STAFF TYPE (USTADH & SCHOOL_TEACHER) + SCHEDULE CLASS INTEGRATION ---');

  let teacherJohn = null;
  let ustadhBilal = null;
  let staffDefault = null;

  // 33. Create SCHOOL_TEACHER profile
  {
    const res = await fetch(`${baseUrl}/ustadhs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        fullName: 'John Perera',
        staffType: 'SCHOOL_TEACHER',
        phoneNumber: '+94712345678',
        email: 'john.teacher@example.com',
        baseMonthlySalary: 35000,
        joinDate: '2026-01-10',
      }),
    });
    const json = await res.json();
    assert(res.status === 201, 'POST /ustadhs creates SCHOOL_TEACHER with HTTP 201');
    assert(json.data.staffType === 'SCHOOL_TEACHER', 'staffType correctly stored as SCHOOL_TEACHER');
    assert(json.data.fullName === 'John Perera', 'Full name stored correctly');
    teacherJohn = json.data;
  }

  // 34. Create explicit USTADH profile
  {
    const res = await fetch(`${baseUrl}/ustadhs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        fullName: 'Moulavi Bilal',
        staffType: 'USTADH',
        phoneNumber: '+94772345679',
        baseMonthlySalary: 40000,
        joinDate: '2026-01-15',
      }),
    });
    const json = await res.json();
    assert(res.status === 201, 'POST /ustadhs creates USTADH with HTTP 201');
    assert(json.data.staffType === 'USTADH', 'staffType correctly stored as USTADH');
    ustadhBilal = json.data;
  }

  // 35. Create profile without staffType - defaults to USTADH
  {
    const res = await fetch(`${baseUrl}/ustadhs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        fullName: 'Moulavi Tariq',
        phoneNumber: '+94773345680',
        baseMonthlySalary: 28000,
        joinDate: '2026-02-01',
      }),
    });
    const json = await res.json();
    assert(res.status === 201, 'POST /ustadhs without staffType defaults to 201 OK');
    assert(json.data.staffType === 'USTADH', 'Default staffType is USTADH');
    staffDefault = json.data;
  }

  // 36. Reject creation with invalid 3rd staff type (e.g. PRINCIPAL)
  {
    const res = await fetch(`${baseUrl}/ustadhs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        fullName: 'Principal Sir',
        staffType: 'PRINCIPAL',
        baseMonthlySalary: 50000,
        joinDate: '2026-01-01',
      }),
    });
    assert(res.status === 400, 'POST /ustadhs rejects invalid 3rd staffType (PRINCIPAL) with HTTP 400');
  }

  // 37. Reject update with invalid 3rd staff type (e.g. CLERK)
  {
    const res = await fetch(`${baseUrl}/ustadhs/${teacherJohn.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        staffType: 'CLERK',
      }),
    });
    assert(res.status === 400, 'PATCH /ustadhs/:id rejects invalid 3rd staffType (CLERK) with HTTP 400');
  }

  // 38. Filter directory by staffType=SCHOOL_TEACHER
  {
    const res = await fetch(`${baseUrl}/ustadhs?staffType=SCHOOL_TEACHER`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const json = await res.json();
    assert(res.status === 200, 'GET /ustadhs?staffType=SCHOOL_TEACHER returns 200 OK');
    assert(json.data.items.every(u => u.staffType === 'SCHOOL_TEACHER'), 'All returned items have staffType SCHOOL_TEACHER');
    assert(json.data.items.some(u => u.id === teacherJohn.id), 'Directory includes created SCHOOL_TEACHER John Perera');
  }

  // 39. Filter directory by staffType=USTADH
  {
    const res = await fetch(`${baseUrl}/ustadhs?staffType=USTADH`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const json = await res.json();
    assert(res.status === 200, 'GET /ustadhs?staffType=USTADH returns 200 OK');
    assert(json.data.items.every(u => u.staffType === 'USTADH'), 'All returned items have staffType USTADH');
    assert(json.data.items.some(u => u.id === ustadhBilal.id), 'Directory includes created USTADH Moulavi Bilal');
  }

  // 40. Schedule creation with Class for SCHOOL_TEACHER
  let scheduleTeacher = null;
  {
    const res = await fetch(`${baseUrl}/ustadh-schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        ustadhId: teacherJohn.id,
        classId: classA.id,
        subjectId: subjectA1.id,
        dayOfWeek: 'THURSDAY',
        startMinutes: 480,
        endMinutes: 540,
        effectiveFrom: '2026-09-01',
      }),
    });
    const json = await res.json();
    assert(res.status === 201, 'POST /ustadh-schedules creates schedule with valid Class for SCHOOL_TEACHER');
    assert(json.data.classId === classA.id, 'Schedule correctly stores classId');
    assert(json.data.class.name === classA.name, 'Schedule response includes class name');
    assert(json.data.ustadh.staffType === 'SCHOOL_TEACHER', 'Schedule response includes ustadh staffType');
    scheduleTeacher = json.data;
  }

  // 41. Schedule creation with Cross-Tenant Class is rejected (HTTP 404)
  {
    const res = await fetch(`${baseUrl}/ustadh-schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        ustadhId: teacherJohn.id,
        classId: classB.id,
        subjectId: subjectA1.id,
        dayOfWeek: 'FRIDAY',
        startMinutes: 540,
        endMinutes: 600,
        effectiveFrom: '2026-09-01',
      }),
    });
    assert(res.status === 404, 'Schedule creation with cross-tenant classId is rejected with HTTP 404');
  }

  // 42. Monthly salary generation includes SCHOOL_TEACHER
  let salaryTeacher = null;
  {
    const res = await fetch(`${baseUrl}/ustadh-salaries/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ month: '2026-10' }),
    });
    const json = await res.json();
    assert(res.status === 200, 'POST /ustadh-salaries/generate generates October payroll');
    salaryTeacher = json.data.items.find((s) => s.ustadhId === teacherJohn.id);
    assert(!!salaryTeacher, 'October payroll includes SCHOOL_TEACHER John Perera');
    assert(salaryTeacher.baseSalarySnapshot === 35000, 'Base salary snapshot correctly stored for SCHOOL_TEACHER');
  }

  // 43. Filter salaries by staffType=SCHOOL_TEACHER
  {
    const res = await fetch(`${baseUrl}/ustadh-salaries?month=2026-10&staffType=SCHOOL_TEACHER`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const json = await res.json();
    assert(res.status === 200, 'GET /ustadh-salaries?staffType=SCHOOL_TEACHER returns 200 OK');
    assert(json.data.items.every(s => s.ustadh.staffType === 'SCHOOL_TEACHER'), 'Filtered salaries contain only SCHOOL_TEACHER');
    assert(json.data.items.some(s => s.id === salaryTeacher.id), 'Filtered salaries include John Perera');
  }

  // 44. Download salary slip PDF for SCHOOL_TEACHER
  {
    // Mark paid first
    const payRes = await fetch(`${baseUrl}/ustadh-salaries/${salaryTeacher.id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        paymentMethod: 'BANK_TRANSFER',
        paymentDate: '2026-10-31',
        referenceNote: 'October salary for teacher John',
      }),
    });
    assert(payRes.status === 200, 'POST /ustadh-salaries/:id/pay marks salary PAID');

    const res = await fetch(`${baseUrl}/ustadh-salaries/${salaryTeacher.id}/slip`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(res.status === 200, 'GET /ustadh-salaries/:id/slip for SCHOOL_TEACHER returns 200 OK');
    assert(res.headers.get('content-type')?.includes('application/pdf'), 'Salary slip PDF Content-Type is application/pdf');
  }

  // =========================================================================
  // 45. Monthly Salary Send Email Action Tests
  // =========================================================================
  console.log('\n--- 45. Monthly Salary Send Email Action Tests ---');

  // 45.1 Send Email for PAID salary of SCHOOL_TEACHER succeeds
  clearTestEmails();
  {
    const res = await fetch(`${baseUrl}/ustadh-salaries/${salaryTeacher.id}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ injectedRecipient: 'attacker@evil.com' }),
    });
    const json = await res.json();
    assert(res.status === 200, '45.1 POST /ustadh-salaries/:id/send-email returns 200 OK');
    assert(json.success === true, '45.1 Response reports success: true');
    assert(json.recipient === teacherJohn.email.toLowerCase(), '45.1 Response recipient strictly matches teacher profile email');

    // Inspect delivered test email
    const emails = getTestEmails();
    const sent = emails.find((e) => e.to === teacherJohn.email.toLowerCase());
    assert(!!sent, '45.2 Email delivered to test mailbox with correct recipient');
    assert(sent.subject.includes('2026-10') || sent.subject.includes('October'), '45.3 Email subject contains correct salary month');
    assert(sent.text.includes('35,000') || sent.html.includes('35,000'), '45.4 Email contains correct historical paid amount (LKR 35,000)');
    assert(sent.subject.includes(madrasaA.name) || sent.html.includes(madrasaA.name), '45.5 Email contains dynamic Madrasa name');
    assert(Array.isArray(sent.attachments) && sent.attachments.length > 0, '45.6 Email includes salary slip PDF attachment');
  }

  // 45.7 Send Email for PAID salary of USTADH succeeds
  {
    const bilalEmail = `${TEST_PREFIX}_bilal@example.com`;
    await prisma.ustadh.update({
      where: { id: ustadhBilal.id },
      data: { email: bilalEmail },
    });

    // Generate and pay November salary for Ustadh Bilal
    await fetch(`${baseUrl}/ustadh-salaries/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ month: '2026-11' }),
    });

    const listRes = await fetch(`${baseUrl}/ustadh-salaries?month=2026-11&ustadhId=${ustadhBilal.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const listJson = await listRes.json();
    const bilalSalary = listJson.data.items.find((s) => s.ustadhId === ustadhBilal.id);
    assert(!!bilalSalary, '45.7 Found generated November salary for Ustadh Bilal');

    // Mark paid
    await fetch(`${baseUrl}/ustadh-salaries/${bilalSalary.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        paymentMethod: 'CASH',
        paymentDate: '2026-11-30',
      }),
    });

    clearTestEmails();
    const emailRes = await fetch(`${baseUrl}/ustadh-salaries/${bilalSalary.id}/send-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const emailJson = await emailRes.json();
    assert(emailRes.status === 200, '45.7 Send Email for PAID USTADH returns 200 OK');
    assert(emailJson.success === true, '45.7 USTADH email send success: true');

    const emails = getTestEmails();
    const sent = emails.find((e) => e.to === bilalEmail.toLowerCase());
    assert(!!sent, '45.7 Email delivered to USTADH email address');
  }

  // 45.8 PENDING salary Send Email is rejected with HTTP 400
  {
    // Create an unpaid salary for December
    await fetch(`${baseUrl}/ustadh-salaries/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ month: '2026-12' }),
    });

    const listRes = await fetch(`${baseUrl}/ustadh-salaries?month=2026-12&ustadhId=${teacherJohn.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const listJson = await listRes.json();
    const pendingSalary = listJson.data.items.find((s) => s.ustadhId === teacherJohn.id);
    assert(pendingSalary.status === 'PENDING', '45.8 Verified salary is PENDING');

    const res = await fetch(`${baseUrl}/ustadh-salaries/${pendingSalary.id}/send-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(res.status === 400, '45.8 Send Email for PENDING salary rejected with HTTP 400');
  }

  // 45.9 Staff without email returns HTTP 400
  {
    const staffNoEmail = await prisma.ustadh.create({
      data: {
        madrasaId: madrasaA.id,
        fullName: `${TEST_PREFIX} Staff No Email`,
        ustadhCode: `NO_EMAIL_${Date.now().toString().slice(-5)}`,
        staffType: 'USTADH',
        phoneNumber: '+94770001111',
        email: null,
        baseMonthlySalary: 20000,
        joinDate: new Date('2026-01-01'),
        isActive: true,
      },
    });

    const salaryNoEmail = await prisma.ustadhSalary.create({
      data: {
        madrasaId: madrasaA.id,
        ustadhId: staffNoEmail.id,
        salaryMonth: new Date(Date.UTC(2026, 9, 1)),
        baseSalarySnapshot: 20000,
        payableAmount: 20000,
        status: 'PAID',
        paymentMethod: 'CASH',
        paymentDate: new Date('2026-10-31'),
      },
    });

    const res = await fetch(`${baseUrl}/ustadh-salaries/${salaryNoEmail.id}/send-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const json = await res.json();
    assert(res.status === 400, '45.9 Staff without email returns HTTP 400');
    assert(json.message?.includes('No email address'), '45.9 Error clearly indicates missing email');
  }

  // 45.10 Staff with malformed email returns HTTP 400
  {
    const staffBadEmail = await prisma.ustadh.create({
      data: {
        madrasaId: madrasaA.id,
        fullName: `${TEST_PREFIX} Staff Bad Email`,
        ustadhCode: `BAD_EMAIL_${Date.now().toString().slice(-5)}`,
        staffType: 'USTADH',
        phoneNumber: '+94770002222',
        email: 'not-an-email',
        baseMonthlySalary: 20000,
        joinDate: new Date('2026-01-01'),
        isActive: true,
      },
    });

    const salaryBadEmail = await prisma.ustadhSalary.create({
      data: {
        madrasaId: madrasaA.id,
        ustadhId: staffBadEmail.id,
        salaryMonth: new Date(Date.UTC(2026, 9, 1)),
        baseSalarySnapshot: 20000,
        payableAmount: 20000,
        status: 'PAID',
        paymentMethod: 'CASH',
        paymentDate: new Date('2026-10-31'),
      },
    });

    const res = await fetch(`${baseUrl}/ustadh-salaries/${salaryBadEmail.id}/send-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(res.status === 400, '45.10 Staff with malformed email returns HTTP 400');
  }

  // 45.11 Cross-tenant salaryId returns HTTP 404
  {
    const res = await fetch(`${baseUrl}/ustadh-salaries/${salaryTeacher.id}/send-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(res.status === 404, '45.11 Madrasa B calling Madrasa A salaryId returns HTTP 404');
  }

  // 45.12 Arbitrary recipient injection rejected / ignored
  {
    clearTestEmails();
    const res = await fetch(`${baseUrl}/ustadh-salaries/${salaryTeacher.id}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        to: 'injected_hacker@example.com',
        recipient: 'injected_hacker@example.com',
        email: 'injected_hacker@example.com',
      }),
    });
    assert(res.status === 200, '45.12 Send Email succeeds');
    const emails = getTestEmails();
    assert(!emails.some((e) => e.to === 'injected_hacker@example.com'), '45.12 Arbitrary recipient was NOT used');
    assert(emails.some((e) => e.to === teacherJohn.email.toLowerCase()), '45.12 Authoritative profile email was used');
  }

  // 45.13 Manual resend does not mutate salary or create duplicate payments
  {
    const salaryBefore = await prisma.ustadhSalary.findUnique({ where: { id: salaryTeacher.id } });
    const countBefore = await prisma.ustadhSalary.count({ where: { madrasaId: madrasaA.id } });

    await fetch(`${baseUrl}/ustadh-salaries/${salaryTeacher.id}/send-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const salaryAfter = await prisma.ustadhSalary.findUnique({ where: { id: salaryTeacher.id } });
    const countAfter = await prisma.ustadhSalary.count({ where: { madrasaId: madrasaA.id } });

    assert(salaryBefore.status === salaryAfter.status, '45.13 Salary status remains unchanged (PAID)');
    assert(Number(salaryBefore.payableAmount) === Number(salaryAfter.payableAmount), '45.13 Payable amount remains unchanged');
    assert(salaryBefore.paymentMethod === salaryAfter.paymentMethod, '45.13 Payment method remains unchanged');
    assert(countBefore === countAfter, '45.14 Total salary records count unchanged (zero duplicates created)');
  }

  // 45.15 Historical salary snapshot: Base salary changed later, historical email uses snapshot
  {
    // 1. Create a historical staff member with baseMonthlySalary = 25000
    const histStaff = await prisma.ustadh.create({
      data: {
        madrasaId: madrasaA.id,
        fullName: `${TEST_PREFIX} Hist Staff`,
        ustadhCode: `HIST_${Date.now().toString().slice(-5)}`,
        staffType: 'USTADH',
        phoneNumber: '+94770003333',
        email: `${TEST_PREFIX}_hist_staff@example.com`,
        baseMonthlySalary: 25000,
        joinDate: new Date('2026-01-01'),
        isActive: true,
      },
    });

    // 2. September salary paid at 25000
    const histSalary = await prisma.ustadhSalary.create({
      data: {
        madrasaId: madrasaA.id,
        ustadhId: histStaff.id,
        salaryMonth: new Date(Date.UTC(2026, 8, 1)), // September 2026
        baseSalarySnapshot: 25000,
        payableAmount: 25000,
        status: 'PAID',
        paymentMethod: 'BANK_TRANSFER',
        paymentDate: new Date('2026-09-30'),
      },
    });

    // 3. Later, base salary in profile is bumped to 45000
    await prisma.ustadh.update({
      where: { id: histStaff.id },
      data: { baseMonthlySalary: 45000 },
    });

    // 4. Send email for historical September salary
    clearTestEmails();
    const res = await fetch(`${baseUrl}/ustadh-salaries/${histSalary.id}/send-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(res.status === 200, '45.15 Historical salary Send Email returns 200 OK');

    const emails = getTestEmails();
    const sent = emails.find((e) => e.to === histStaff.email.toLowerCase());
    assert(!!sent, '45.15 Historical email delivered');
    assert(sent.text.includes('25,000') || sent.html.includes('25,000'), '45.15 Historical email contains snapshot amount (25,000)');
    assert(!sent.text.includes('45,000') && !sent.html.includes('45,000'), '45.15 Historical email does NOT contain modified profile salary (45,000)');
  }

  // 45.16 Activity Log records SALARY_EMAIL_SENT
  {
    const log = await prisma.activityLog.findFirst({
      where: {
        madrasaId: madrasaA.id,
        action: 'SALARY_EMAIL_SENT',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!log, '45.16 ActivityLog recorded SALARY_EMAIL_SENT');
  }

  // 45.17 Custom Subject and Message in POST /ustadh-salaries/:id/send-email delivered correctly
  {
    clearTestEmails();
    const customSubject = 'Payment Advice - Custom Subject Test';
    const customMessage = 'Dear Ustadh,\n\nWe appreciate your dedication.\nYour salary has been transferred.';
    const res = await fetch(`${baseUrl}/ustadh-salaries/${salaryTeacher.id}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        subject: customSubject,
        message: customMessage,
      }),
    });
    const json = await res.json();
    assert(res.status === 200, '45.17 Custom subject/message send email returns HTTP 200');
    assert(json.success === true, '45.17 Response indicates success');
    const emails = getTestEmails();
    const sent = emails.find((e) => e.to === teacherJohn.email.toLowerCase());
    assert(!!sent, '45.17 Email delivered to test store');
    assert(sent.subject === customSubject, '45.17 Sent email subject matches custom subject');
    assert(sent.text.includes('We appreciate your dedication.'), '45.17 Sent plain text includes custom message body');
    assert(sent.html.includes('We appreciate your dedication.'), '45.17 Sent HTML includes custom message body');
    assert(sent.html.includes('<br/>') || sent.html.includes('<br />') || sent.html.includes('<br>'), '45.17 Sent HTML preserves line breaks as HTML breaks');
    assert(sent.attachments && sent.attachments.length === 1, '45.17 Salary Slip PDF attachment preserved');
  }

  // 45.18 Subject with CRLF injection rejected with HTTP 400
  {
    const res = await fetch(`${baseUrl}/ustadh-salaries/${salaryTeacher.id}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        subject: 'Header Injection\r\nBcc: evil@attacker.com',
        message: 'Valid message body here.',
      }),
    });
    assert(res.status === 400, '45.18 Subject containing CRLF rejected with HTTP 400');
  }

  // 45.19 Empty or whitespace-only message rejected with HTTP 400
  {
    const res = await fetch(`${baseUrl}/ustadh-salaries/${salaryTeacher.id}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        subject: 'Valid Subject',
        message: '   \n   ',
      }),
    });
    assert(res.status === 400, '45.19 Empty or whitespace-only message rejected with HTTP 400');
  }

  // 45.20 Oversized subject (>200 chars) rejected with HTTP 400
  {
    const res = await fetch(`${baseUrl}/ustadh-salaries/${salaryTeacher.id}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        subject: 'A'.repeat(201),
        message: 'Valid message body.',
      }),
    });
    assert(res.status === 400, '45.20 Oversized subject (>200 chars) rejected with HTTP 400');
  }

  console.log(`\n======================================================`);
  console.log(`USTADH MANAGEMENT TEST RESULTS: ${testPassedCount} PASSED, ${testFailedCount} FAILED`);
  console.log(`======================================================\n`);

  await teardown();

  if (testFailedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test execution fatal error:', err);
  teardown().then(() => process.exit(1));
});
