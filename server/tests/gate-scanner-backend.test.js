import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { signAccessToken } from '../src/utils/jwt.js';
import app from '../src/app.js';
import http from 'http';
import {
  generateRawToken,
  hashToken,
  encryptToken,
  deriveTokenHint,
} from '../src/utils/scan-token-crypto.js';
import {
  processGateEmailJobs,
  recoverStaleGateEmailJobs,
  escapeHtml,
  renderGateEmailHtml,
} from '../src/jobs/gate-email-worker.job.js';
import { getTenantDateBoundaries } from '../src/services/gate-event.service.js';
import {
  clearTestEmails,
  getTestEmails,
  setTestEmailAdapter,
} from '../src/services/email.service.js';

const TEST_PREFIX = 'gate_test_' + Date.now();

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
let madrasaA = null;
let adminA = null;
let tokenA = '';
let classA = null;
let rawTokenKey = '';

let studentDayScholarA = null;
let rawTokenDayScholarA = '';

let studentBoardingA = null;
let rawTokenBoardingA = '';

let studentNullCategoryA = null;
let rawTokenNullCategoryA = '';

let studentRevokedA = null;
let rawTokenRevokedA = '';

let studentNoEmailA = null;
let rawTokenNoEmailA = '';

let madrasaB = null;
let adminB = null;
let tokenB = '';
let studentB = null;
let rawTokenB = '';

async function setupFixtures() {
  console.log('\n--- Setting up Gate Scanner Test Fixtures ---');

  // Encryption key (64 hex chars = 32 bytes)
  rawTokenKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.STUDENT_CARD_TOKEN_KEY = rawTokenKey;

  // 1. Madrasa A (Active with Subscription & Active Plan)
  madrasaA = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa A`,
      code: `MA_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `ma-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      email: `${TEST_PREFIX}_adminA@test.com`,
      status: 'ACTIVE',
    },
  });

  const pwdHash = await hashPassword('TestPassword123!');
  adminA = await prisma.user.create({
    data: {
      madrasaId: madrasaA.id,
      email: `${TEST_PREFIX}_adminA@test.com`,
      passwordHash: pwdHash,
      name: 'Admin User A',
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });
  tokenA = signAccessToken({ userId: adminA.id, role: adminA.role });

  // Plan & Active Subscription for Madrasa A
  const planA = await prisma.plan.findFirst() || await prisma.plan.create({
    data: {
      code: `PLAN_${Date.now()}`,
      name: 'Standard Plan',
      price: 1000,
      originalPrice: 1000,
      billingCycle: 'MONTHLY',
      maxStudents: 500,
      maxUstadhs: 50,
      status: 'ACTIVE',
    },
  });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaA.id,
      planId: planA.id,
      status: 'ACTIVE',
      startsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      priceAtPurchase: 1000,
      durationMonthsAtPurchase: 1,
    },
  });

  // Settings for Madrasa A (auto attendance and notifications initially enabled)
  await prisma.madrasaSetting.upsert({
    where: { madrasaId: madrasaA.id },
    update: {
      gateParentEmailNotificationsEnabled: true,
      autoGateAttendanceReconciliation: true,
      timezone: 'Asia/Colombo',
      academicYear: '2026-2027',
    },
    create: {
      madrasaId: madrasaA.id,
      gateParentEmailNotificationsEnabled: true,
      autoGateAttendanceReconciliation: true,
      timezone: 'Asia/Colombo',
      academicYear: '2026-2027',
    },
  });

  // Class in Madrasa A
  classA = await prisma.class.create({
    data: {
      madrasaId: madrasaA.id,
      name: 'Class Grade 1',
      code: `G1_${Date.now()}`.slice(0, 10),
      defaultMonthlyFee: 500,
    },
  });

  async function createScanTokenRecord({ madrasaId, studentId, rawToken, revoked = false }) {
    const tokenH = hashToken(rawToken);
    const enc = encryptToken(rawToken, rawTokenKey);
    const hint = deriveTokenHint(rawToken);

    return await prisma.studentScanToken.create({
      data: {
        madrasaId,
        studentId,
        tokenHash: tokenH,
        tokenEncrypted: enc.tokenEncrypted,
        tokenIv: enc.tokenIv,
        tokenAuthTag: enc.tokenAuthTag,
        keyVersion: enc.keyVersion,
        tokenHint: hint,
        isActive: !revoked,
        activeStudentId: revoked ? null : studentId,
        revokedAt: revoked ? new Date() : null,
        revokeReason: revoked ? 'Test revocation' : null,
      },
    });
  }

  // Helper to create a student with scan token
  async function createStudentWithToken({
    admissionNo,
    fullName,
    category,
    guardianEmail,
    revoked = false,
  }) {
    const student = await prisma.student.create({
      data: {
        madrasaId: madrasaA.id,
        classId: classA.id,
        admissionNo,
        fullName,
        guardianName: 'Guardian of ' + fullName,
        guardianEmail,
        admissionDate: new Date('2026-01-01'),
        status: 'ACTIVE',
        category,
      },
    });

    const rawToken = generateRawToken();
    await createScanTokenRecord({
      madrasaId: madrasaA.id,
      studentId: student.id,
      rawToken,
      revoked,
    });

    return { student, rawToken };
  }

  // 1. Day Scholar Student (valid guardian email)
  const ds = await createStudentWithToken({
    admissionNo: `DS_${Date.now()}`.slice(0, 10),
    fullName: 'Zaid Day Scholar',
    category: 'DAY_SCHOLAR',
    guardianEmail: 'zaid.parent@test.com',
  });
  studentDayScholarA = ds.student;
  rawTokenDayScholarA = ds.rawToken;

  // 2. Boarding Student
  const bd = await createStudentWithToken({
    admissionNo: `BD_${Date.now()}`.slice(0, 10),
    fullName: 'Bilal Boarding',
    category: 'BOARDING',
    guardianEmail: 'bilal.parent@test.com',
  });
  studentBoardingA = bd.student;
  rawTokenBoardingA = bd.rawToken;

  // 3. Student with NULL category (for fail-closed 422 test)
  const nc = await createStudentWithToken({
    admissionNo: `NC_${Date.now()}`.slice(0, 10),
    fullName: 'Tariq NullCategory',
    category: null,
    guardianEmail: 'tariq.parent@test.com',
  });
  studentNullCategoryA = nc.student;
  rawTokenNullCategoryA = nc.rawToken;

  // 4. Revoked Token Student
  const rv = await createStudentWithToken({
    admissionNo: `RV_${Date.now()}`.slice(0, 10),
    fullName: 'Rashid Revoked',
    category: 'DAY_SCHOLAR',
    guardianEmail: 'rashid.parent@test.com',
    revoked: true,
  });
  studentRevokedA = rv.student;
  rawTokenRevokedA = rv.rawToken;

  // 5. Day Scholar with NO guardian email
  const ne = await createStudentWithToken({
    admissionNo: `NE_${Date.now()}`.slice(0, 10),
    fullName: 'Nasir NoEmail',
    category: 'DAY_SCHOLAR',
    guardianEmail: null,
  });
  studentNoEmailA = ne.student;
  rawTokenNoEmailA = ne.rawToken;

  // Madrasa B (Tenant Isolation Fixture)
  madrasaB = await prisma.madrasa.create({
    data: {
      name: `${TEST_PREFIX} Madrasa B`,
      code: `MB_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 6)}`,
      slug: `mb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      email: `${TEST_PREFIX}_adminB@test.com`,
      status: 'ACTIVE',
    },
  });

  adminB = await prisma.user.create({
    data: {
      madrasaId: madrasaB.id,
      email: `${TEST_PREFIX}_adminB@test.com`,
      passwordHash: pwdHash,
      name: 'Admin User B',
      role: 'MADRASA_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });
  tokenB = signAccessToken({ userId: adminB.id, role: adminB.role });

  await prisma.subscription.create({
    data: {
      madrasaId: madrasaB.id,
      planId: planA.id,
      status: 'ACTIVE',
      startsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      priceAtPurchase: 1000,
      durationMonthsAtPurchase: 1,
    },
  });

  const sb = await prisma.student.create({
    data: {
      madrasaId: madrasaB.id,
      admissionNo: `SB_${Date.now()}`.slice(0, 10),
      fullName: 'Salim Madrasa B',
      guardianName: 'Guardian B',
      admissionDate: new Date('2026-01-01'),
      status: 'ACTIVE',
      category: 'DAY_SCHOLAR',
    },
  });
  studentB = sb;
  rawTokenB = generateRawToken();
  await createScanTokenRecord({
    madrasaId: madrasaB.id,
    studentId: studentB.id,
    rawToken: rawTokenB,
  });

  // Start HTTP Test Server
  testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, resolve));
  const port = testServer.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`✓ Test HTTP server listening on ${baseUrl}`);
}

async function cleanupFixtures() {
  console.log('\n--- Cleaning up Test Fixtures ---');
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }
  clearTestEmails();
}

async function runTests() {
  await setupFixtures();

  try {
    console.log('\n--- Running MNX-P02 Gate Scanner Backend Tests ---');

    // --------------------------------------------------------------------------
    // Test 1: Valid DAY_SCHOLAR ENTRY scan
    // --------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/api/gate/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          token: rawTokenDayScholarA,
          eventType: 'ENTRY',
        }),
      });

      const json = await res.json();
      assert(res.status === 201, 'Test 1.1: Valid DAY_SCHOLAR ENTRY returns HTTP 201');
      assert(json.success === true, 'Test 1.2: Response success is true');
      assert(json.data?.event?.eventType === 'ENTRY', 'Test 1.3: Event type is ENTRY');
      assert(json.data?.event?.category === 'DAY_SCHOLAR', 'Test 1.4: Category is DAY_SCHOLAR');
      assert(json.data?.event?.emailStatus === 'QUEUED', 'Test 1.5: Email status is QUEUED');
      assert(json.data?.event?.emailSkipReason === null, 'Test 1.6: Email skip reason is NULL');
      assert(json.data?.attendance?.reconciled === true, 'Test 1.7: Auto-attendance was reconciled');
      assert(json.data?.attendance?.status === 'PRESENT', 'Test 1.8: Attendance status is PRESENT');
    }

    // --------------------------------------------------------------------------
    // Test 2: Valid BOARDING ENTRY scan
    // --------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/api/gate/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          token: rawTokenBoardingA,
          eventType: 'ENTRY',
        }),
      });

      const json = await res.json();
      assert(res.status === 201, 'Test 2.1: Valid BOARDING ENTRY returns HTTP 201');
      assert(json.data?.event?.category === 'BOARDING', 'Test 2.2: Category is BOARDING');
      assert(json.data?.event?.emailStatus === 'NOT_APPLICABLE', 'Test 2.3: Email status is NOT_APPLICABLE');
      assert(json.data?.event?.emailSkipReason === 'BOARDING_STUDENT_EXEMPT', 'Test 2.4: Skip reason is BOARDING_STUDENT_EXEMPT');
    }

    // --------------------------------------------------------------------------
    // Test 3: Option A Fail-Closed Rule (category === null)
    // --------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/api/gate/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          token: rawTokenNullCategoryA,
          eventType: 'ENTRY',
        }),
      });

      const json = await res.json();
      assert(res.status === 422, 'Test 3.1: Null student category returns HTTP 422');
      assert(json.message?.includes('Student category unset'), 'Test 3.2: Message indicates unset category');

      const count = await prisma.studentGateEvent.count({
        where: { studentId: studentNullCategoryA.id },
      });
      assert(count === 0, 'Test 3.3: Zero StudentGateEvent records created for rejected scan');
    }

    // --------------------------------------------------------------------------
    // Test 4: Revoked token rejection
    // --------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/api/gate/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          token: rawTokenRevokedA,
          eventType: 'ENTRY',
        }),
      });

      assert(res.status === 403, 'Test 4.1: Revoked token returns HTTP 403 Forbidden');
    }

    // --------------------------------------------------------------------------
    // Test 5: Invalid token format rejection
    // --------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/api/gate/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          token: 'INVALID_TOKEN_FORMAT_123',
          eventType: 'ENTRY',
        }),
      });

      assert(res.status === 400, 'Test 5.1: Malformed token format returns HTTP 400');
    }

    // --------------------------------------------------------------------------
    // Test 6: Cross-tenant token rejection (Anti-enumeration: 404)
    // --------------------------------------------------------------------------
    {
      // Madrasa A admin tries to scan Madrasa B student token
      const res = await fetch(`${baseUrl}/api/gate/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          token: rawTokenB,
          eventType: 'ENTRY',
        }),
      });

      assert(res.status === 404, 'Test 6.1: Cross-tenant token returns HTTP 404 Not Found');
    }

    // --------------------------------------------------------------------------
    // Test 7: Idempotency Key - Same key and identical payload returns 200 replay
    // --------------------------------------------------------------------------
    const idempotencyUuid = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    {
      // First scan with idempotency key (using EXIT for DayScholar to bypass 60s ENTRY debounce)
      const res1 = await fetch(`${baseUrl}/api/gate/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          token: rawTokenDayScholarA,
          eventType: 'EXIT',
          idempotencyKey: idempotencyUuid,
        }),
      });

      assert(res1.status === 201, 'Test 7.1: First scan with idempotencyKey returns HTTP 201');

      // Second scan with same key and same payload
      const res2 = await fetch(`${baseUrl}/api/gate/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          token: rawTokenDayScholarA,
          eventType: 'EXIT',
          idempotencyKey: idempotencyUuid,
        }),
      });

      const json2 = await res2.json();
      assert(res2.status === 200, 'Test 7.2: Idempotent replay returns HTTP 200');
      assert(json2.data?.idempotentReplay === true, 'Test 7.3: idempotentReplay flag is true');
    }

    // --------------------------------------------------------------------------
    // Test 8: Idempotency Key - Same key with divergent payload returns 409
    // --------------------------------------------------------------------------
    {
      // Attempt to reuse same idempotency key with different eventType (ENTRY)
      const res = await fetch(`${baseUrl}/api/gate/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          token: rawTokenDayScholarA,
          eventType: 'ENTRY',
          idempotencyKey: idempotencyUuid,
        }),
      });

      assert(res.status === 409, 'Test 8.1: Idempotency key payload mismatch returns HTTP 409 Conflict');
    }

    // --------------------------------------------------------------------------
    // Test 9: Same-direction 60-second debounce
    // --------------------------------------------------------------------------
    {
      // Student Boarding was scanned ENTRY earlier (< 60s). Scanning ENTRY again should be debounced
      const res = await fetch(`${baseUrl}/api/gate/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          token: rawTokenBoardingA,
          eventType: 'ENTRY',
        }),
      });

      const json = await res.json();
      assert(res.status === 429, 'Test 9.1: Consecutive same-direction scan within 60s returns HTTP 429');
      assert(json.message?.includes('debounced'), 'Test 9.2: Debounce error message confirmed');
    }

    // --------------------------------------------------------------------------
    // Test 10: Attendance reconciliation with setting disabled
    // --------------------------------------------------------------------------
    {
      // Disable auto attendance reconciliation temporarily
      await prisma.madrasaSetting.update({
        where: { madrasaId: madrasaA.id },
        data: { autoGateAttendanceReconciliation: false },
      });

      // Create a fresh DayScholar student to scan without debounce conflict
      const { student: freshStudent, rawToken: freshToken } = await (async () => {
        const s = await prisma.student.create({
          data: {
            madrasaId: madrasaA.id,
            classId: classA.id,
            admissionNo: `FRESH_${Date.now()}`.slice(0, 10),
            fullName: 'Farhan Fresh',
            guardianName: 'Guardian Fresh',
            guardianEmail: 'farhan.parent@test.com',
            admissionDate: new Date('2026-01-01'),
            status: 'ACTIVE',
            category: 'DAY_SCHOLAR',
          },
        });
        const rt = generateRawToken();
        const enc = encryptToken(rt, rawTokenKey);
        await prisma.studentScanToken.create({
          data: {
            madrasaId: madrasaA.id,
            studentId: s.id,
            tokenHash: hashToken(rt),
            tokenEncrypted: enc.tokenEncrypted,
            tokenIv: enc.tokenIv,
            tokenAuthTag: enc.tokenAuthTag,
            keyVersion: enc.keyVersion,
            tokenHint: deriveTokenHint(rt),
            isActive: true,
            activeStudentId: s.id,
          },
        });
        return { student: s, rawToken: rt };
      })();

      const res = await fetch(`${baseUrl}/api/gate/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          token: freshToken,
          eventType: 'ENTRY',
        }),
      });

      const json = await res.json();
      assert(res.status === 201, 'Test 10.1: Scan succeeds with reconciliation disabled');
      assert(json.data?.attendance?.reconciled === false, 'Test 10.2: Attendance was not reconciled');
      assert(
        json.data?.attendance?.reason === 'AUTO_RECONCILIATION_DISABLED',
        'Test 10.3: Reason is AUTO_RECONCILIATION_DISABLED'
      );

      // Re-enable setting for subsequent tests
      await prisma.madrasaSetting.update({
        where: { madrasaId: madrasaA.id },
        data: { autoGateAttendanceReconciliation: true },
      });
    }

    // --------------------------------------------------------------------------
    // Test 11: EXIT scan never modifies AttendanceRecord
    // --------------------------------------------------------------------------
    {
      // Scan EXIT for studentBoardingA (first EXIT scan for him)
      const res = await fetch(`${baseUrl}/api/gate/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          token: rawTokenBoardingA,
          eventType: 'EXIT',
        }),
      });

      const json = await res.json();
      assert(res.status === 201, 'Test 11.1: EXIT scan recorded successfully');
      assert(json.data?.attendance?.reconciled === false, 'Test 11.2: EXIT scan did not reconcile attendance');
      assert(
        json.data?.attendance?.reason === 'EXIT_SCAN_EXEMPT_FROM_ATTENDANCE',
        'Test 11.3: Reason indicates EXIT scan is exempt'
      );
    }

    // --------------------------------------------------------------------------
    // Test 12: Missing guardian email produces SKIPPED_NO_RECIPIENT
    // --------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/api/gate/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          token: rawTokenNoEmailA,
          eventType: 'ENTRY',
        }),
      });

      const json = await res.json();
      assert(res.status === 201, 'Test 12.1: Scan with no guardian email succeeds');
      assert(json.data?.event?.emailStatus === 'SKIPPED_NO_RECIPIENT', 'Test 12.2: Email status is SKIPPED_NO_RECIPIENT');
      assert(json.data?.event?.emailSkipReason === 'NO_GUARDIAN_EMAIL_REGISTERED', 'Test 12.3: Skip reason is NO_GUARDIAN_EMAIL_REGISTERED');
    }

    // --------------------------------------------------------------------------
    // Test 13: Tenant Email Opt-Out produces NOTIFICATIONS_DISABLED_BY_TENANT
    // --------------------------------------------------------------------------
    {
      await prisma.madrasaSetting.update({
        where: { madrasaId: madrasaA.id },
        data: { gateParentEmailNotificationsEnabled: false },
      });

      // Create new student
      const { rawToken: optOutToken } = await (async () => {
        const s = await prisma.student.create({
          data: {
            madrasaId: madrasaA.id,
            classId: classA.id,
            admissionNo: `OPTOUT_${Date.now()}`.slice(0, 10),
            fullName: 'Omar OptOut',
            guardianName: 'Guardian Omar',
            guardianEmail: 'omar.parent@test.com',
            admissionDate: new Date('2026-01-01'),
            status: 'ACTIVE',
            category: 'DAY_SCHOLAR',
          },
        });
        const rt = generateRawToken();
        const enc = encryptToken(rt, rawTokenKey);
        await prisma.studentScanToken.create({
          data: {
            madrasaId: madrasaA.id,
            studentId: s.id,
            tokenHash: hashToken(rt),
            tokenEncrypted: enc.tokenEncrypted,
            tokenIv: enc.tokenIv,
            tokenAuthTag: enc.tokenAuthTag,
            keyVersion: enc.keyVersion,
            tokenHint: deriveTokenHint(rt),
            isActive: true,
            activeStudentId: s.id,
          },
        });
        return { student: s, rawToken: rt };
      })();

      const res = await fetch(`${baseUrl}/api/gate/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          token: optOutToken,
          eventType: 'ENTRY',
        }),
      });

      const json = await res.json();
      assert(res.status === 201, 'Test 13.1: Scan succeeds with tenant notifications disabled');
      assert(json.data?.event?.emailStatus === 'NOT_APPLICABLE', 'Test 13.2: Email status is NOT_APPLICABLE');
      assert(
        json.data?.event?.emailSkipReason === 'NOTIFICATIONS_DISABLED_BY_TENANT',
        'Test 13.3: Skip reason is NOTIFICATIONS_DISABLED_BY_TENANT'
      );

      // Re-enable setting
      await prisma.madrasaSetting.update({
        where: { madrasaId: madrasaA.id },
        data: { gateParentEmailNotificationsEnabled: true },
      });
    }

    // --------------------------------------------------------------------------
    // Test 14: Outbox Worker Dispatch (QUEUED -> PROCESSING -> SENT)
    // --------------------------------------------------------------------------
    {
      clearTestEmails();
      const summary = await processGateEmailJobs({ madrasaId: madrasaA.id, limit: 10 });

      assert(summary.processed >= 1, 'Test 14.1: Worker claimed and processed at least 1 job');
      assert(summary.sent >= 1, 'Test 14.2: Worker sent at least 1 email');

      const dispatchedEmails = getTestEmails();
      assert(dispatchedEmails.length >= 1, 'Test 14.3: Test email adapter received email');
      assert(
        dispatchedEmails.some((e) => e.to === 'zaid.parent@test.com'),
        'Test 14.4: Recipient matches student guardian email'
      );
    }

    // --------------------------------------------------------------------------
    // Test 15: Outbox Retry Schedule (30s, 120s, FAILED on max 3 attempts)
    // --------------------------------------------------------------------------
    {
      // Create a test event in QUEUED state
      const retryEvent = await prisma.studentGateEvent.create({
        data: {
          madrasaId: madrasaA.id,
          studentId: studentDayScholarA.id,
          recordedByUserId: adminA.id,
          eventType: 'ENTRY',
          category: 'DAY_SCHOLAR',
          emailStatus: 'QUEUED',
          attemptCount: 0,
          nextAttemptAt: new Date(),
        },
      });

      // Configure mock adapter to simulate SMTP failure
      setTestEmailAdapter(async () => {
        throw new Error('Simulated SMTP Socket Timeout (ECONNREFUSED)');
      });

      // Attempt 1: Should set delay to 30s and status remains QUEUED
      await processGateEmailJobs({ madrasaId: madrasaA.id, limit: 10 });
      let updated = await prisma.studentGateEvent.findUnique({ where: { id: retryEvent.id } });

      assert(updated.attemptCount === 1, 'Test 15.1: Attempt count is 1 after first failure');
      assert(updated.emailStatus === 'QUEUED', 'Test 15.2: Status remains QUEUED (never PENDING_RETRY)');
      assert(updated.nextAttemptAt !== null, 'Test 15.3: nextAttemptAt is scheduled');
      assert(updated.emailError?.includes('ECONNREFUSED'), 'Test 15.4: emailError captures socket failure');

      // Force nextAttemptAt to past to simulate 30s elapsed for Attempt 2
      await prisma.studentGateEvent.update({
        where: { id: retryEvent.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) },
      });

      // Attempt 2: Should set delay to 120s and status remains QUEUED
      await processGateEmailJobs({ madrasaId: madrasaA.id, limit: 10 });
      updated = await prisma.studentGateEvent.findUnique({ where: { id: retryEvent.id } });

      assert(updated.attemptCount === 2, 'Test 15.5: Attempt count is 2 after second failure');
      assert(updated.emailStatus === 'QUEUED', 'Test 15.6: Status remains QUEUED after 2nd attempt');

      // Force nextAttemptAt to past to simulate 120s elapsed for Attempt 3
      await prisma.studentGateEvent.update({
        where: { id: retryEvent.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) },
      });

      // Attempt 3: Exhausted maximum 3 attempts -> FAILED
      await processGateEmailJobs({ madrasaId: madrasaA.id, limit: 10 });
      updated = await prisma.studentGateEvent.findUnique({ where: { id: retryEvent.id } });

      assert(updated.attemptCount === 3, 'Test 15.7: Attempt count reached 3');
      assert(updated.emailStatus === 'FAILED', 'Test 15.8: Status transitions to FAILED on 3rd failure');
      assert(updated.nextAttemptAt === null, 'Test 15.9: nextAttemptAt is cleared on permanent failure');

      // Reset mock email adapter
      clearTestEmails();
    }

    // --------------------------------------------------------------------------
    // Test 16: Stale PROCESSING Recovery (> 5 minutes timeout)
    // --------------------------------------------------------------------------
    {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);

      // Create a stale event (attempt 1)
      const staleEvent = await prisma.studentGateEvent.create({
        data: {
          madrasaId: madrasaA.id,
          studentId: studentDayScholarA.id,
          recordedByUserId: adminA.id,
          eventType: 'ENTRY',
          category: 'DAY_SCHOLAR',
          emailStatus: 'PROCESSING',
          processingStartedAt: sixMinutesAgo,
          attemptCount: 1,
        },
      });

      const recovered = await recoverStaleGateEmailJobs(5 * 60 * 1000);
      assert(recovered >= 1, 'Test 16.1: Recovered at least 1 stale job');

      const rechecked = await prisma.studentGateEvent.findUnique({ where: { id: staleEvent.id } });
      assert(rechecked.emailStatus === 'QUEUED', 'Test 16.2: Stale job returned to QUEUED');
      assert(rechecked.processingStartedAt === null, 'Test 16.3: processingStartedAt reset to NULL');
      assert(
        rechecked.emailError === null,
        'Test 16.4: emailError remains null (no synthetic stale recovery description written)'
      );

      // Test 16.5: Race Condition Prevention: Active processing (< 5 mins) must NOT be recovered
      const activeProcessingEvent = await prisma.studentGateEvent.create({
        data: {
          madrasaId: madrasaA.id,
          studentId: studentDayScholarA.id,
          recordedByUserId: adminA.id,
          eventType: 'ENTRY',
          category: 'DAY_SCHOLAR',
          emailStatus: 'PROCESSING',
          processingStartedAt: new Date(Date.now() - 60 * 1000), // 1 minute ago (active lease)
          attemptCount: 1,
        },
      });

      await recoverStaleGateEmailJobs(5 * 60 * 1000);
      const activeRechecked = await prisma.studentGateEvent.findUnique({ where: { id: activeProcessingEvent.id } });
      assert(activeRechecked.emailStatus === 'PROCESSING', 'Test 16.5: Active processing event (<5m) is NOT recovered');
      assert(activeRechecked.processingStartedAt !== null, 'Test 16.6: Active processingStartedAt remains intact');

      // Test 16.7: Atomic Condition: If event status changed (e.g. SENT), conditional update prevents overwrite
      const sentEvent = await prisma.studentGateEvent.create({
        data: {
          madrasaId: madrasaA.id,
          studentId: studentDayScholarA.id,
          recordedByUserId: adminA.id,
          eventType: 'ENTRY',
          category: 'DAY_SCHOLAR',
          emailStatus: 'SENT',
          sentAt: new Date(),
          processingStartedAt: null,
          attemptCount: 1,
        },
      });

      await recoverStaleGateEmailJobs(5 * 60 * 1000);
      const sentRechecked = await prisma.studentGateEvent.findUnique({ where: { id: sentEvent.id } });
      assert(sentRechecked.emailStatus === 'SENT', 'Test 16.7: SENT event is untouched by stale recovery');
    }

    // --------------------------------------------------------------------------
    // Test 17: Tenant Opt-Out Cutoff before Worker Dispatch
    // --------------------------------------------------------------------------
    {
      // Create a QUEUED event when notifications are technically queued
      const cutoffEvent = await prisma.studentGateEvent.create({
        data: {
          madrasaId: madrasaA.id,
          studentId: studentDayScholarA.id,
          recordedByUserId: adminA.id,
          eventType: 'ENTRY',
          category: 'DAY_SCHOLAR',
          emailStatus: 'QUEUED',
          attemptCount: 0,
          nextAttemptAt: new Date(),
        },
      });

      // Admin turns off setting before worker runs
      await prisma.madrasaSetting.update({
        where: { madrasaId: madrasaA.id },
        data: { gateParentEmailNotificationsEnabled: false },
      });

      await processGateEmailJobs({ madrasaId: madrasaA.id, limit: 10 });

      const checked = await prisma.studentGateEvent.findUnique({ where: { id: cutoffEvent.id } });
      assert(checked.emailStatus === 'NOT_APPLICABLE', 'Test 17.1: Queued event cutoff to NOT_APPLICABLE');
      assert(
        checked.emailSkipReason === 'TENANT_NOTIFICATIONS_DISABLED_AT_DISPATCH',
        'Test 17.2: Skip reason is TENANT_NOTIFICATIONS_DISABLED_AT_DISPATCH'
      );

      // Restore setting
      await prisma.madrasaSetting.update({
        where: { madrasaId: madrasaA.id },
        data: { gateParentEmailNotificationsEnabled: true },
      });
    }

    // --------------------------------------------------------------------------
    // Test 18: Tenant Settings GET and PATCH Endpoints
    // --------------------------------------------------------------------------
    {
      // GET settings
      const getRes = await fetch(`${baseUrl}/api/gate/settings`, {
        headers: {
          Authorization: `Bearer ${tokenA}`,
        },
      });
      const getJson = await getRes.json();
      assert(getRes.status === 200, 'Test 18.1: GET /api/gate/settings returns HTTP 200');
      assert(getJson.data?.gateParentEmailNotificationsEnabled === true, 'Test 18.2: Settings match current DB');

      // PATCH settings without admin auth
      const unauthPatch = await fetch(`${baseUrl}/api/gate/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gateParentEmailNotificationsEnabled: false,
        }),
      });
      assert(unauthPatch.status === 401, 'Test 18.3: Unauthenticated PATCH /settings returns HTTP 401');

      // Authorized PATCH settings
      const patchRes = await fetch(`${baseUrl}/api/gate/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          gateParentEmailNotificationsEnabled: false,
          autoGateAttendanceReconciliation: false,
        }),
      });
      const patchJson = await patchRes.json();
      assert(patchRes.status === 200, 'Test 18.4: Authorized PATCH /settings returns HTTP 200');
      assert(patchJson.data?.gateParentEmailNotificationsEnabled === false, 'Test 18.5: Setting updated to false');
    }

    // --------------------------------------------------------------------------
    // Test 19: GET /api/gate/events Paginated Query & Filter
    // --------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/api/gate/events?page=1&limit=5&eventType=ENTRY`, {
        headers: {
          Authorization: `Bearer ${tokenA}`,
        },
      });
      const json = await res.json();
      assert(res.status === 200, 'Test 19.1: GET /api/gate/events returns HTTP 200');
      assert(Array.isArray(json.data?.events), 'Test 19.2: Events array returned');
      assert(json.data?.pagination?.page === 1, 'Test 19.3: Pagination metadata present');
      assert(
        json.data.events.every((e) => e.eventType === 'ENTRY'),
        'Test 19.4: Filtered events all match eventType=ENTRY'
      );
    }

    // --------------------------------------------------------------------------
    // Test 20: Tenant Isolation on GET /api/gate/events
    // --------------------------------------------------------------------------
    {
      // Madrasa B queries events; must see 0 events from Madrasa A
      const resB = await fetch(`${baseUrl}/api/gate/events`, {
        headers: {
          Authorization: `Bearer ${tokenB}`,
        },
      });
      const jsonB = await resB.json();
      assert(resB.status === 200, 'Test 20.1: Madrasa B can query its events');
      assert(
        jsonB.data.events.every((e) => e.madrasaId === madrasaB.id),
        'Test 20.2: Madrasa B sees zero events belonging to Madrasa A'
      );
    }

    // --------------------------------------------------------------------------
    // Test 21: Parent Notification Email HTML Escaping & Injection Protection
    // --------------------------------------------------------------------------
    {
      // 21.1: Direct escapeHtml unit checks
      assert(
        escapeHtml('<script>alert("xss")</script>&"\'') ===
          '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;&quot;&#39;',
        'Test 21.1: escapeHtml correctly encodes special characters (&, <, >, ", \')'
      );
      assert(escapeHtml(null) === '', 'Test 21.2: escapeHtml handles null safely');
      assert(escapeHtml(undefined) === '', 'Test 21.3: escapeHtml handles undefined safely');
      assert(escapeHtml(12345) === '12345', 'Test 21.4: escapeHtml handles numeric inputs safely');

      // 21.5: Injection attempt in renderGateEmailHtml
      const maliciousHtml = renderGateEmailHtml({
        madrasaName: 'Al-Huda <script>alert(1)</script>',
        studentName: 'Zaid <b onmouseover="alert(\'xss\')">Malicious</b>',
        admissionNo: 'ADM" onfocus="evil()"',
        className: 'Class 5 & 6',
        eventType: 'ENTRY',
        timeStr: '08:00 AM <style>body{display:none}</style>',
        dateStr: '2026-11-15',
      });

      assert(!maliciousHtml.includes('<script>'), 'Test 21.5: Email HTML does not contain raw <script> tag');
      assert(maliciousHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'Test 21.6: Script tags properly encoded');
      assert(!maliciousHtml.includes('<b onmouseover'), 'Test 21.7: Event handlers are neutralised');
      assert(maliciousHtml.includes('Class 5 &amp; 6'), 'Test 21.8: Ampersand in class name properly encoded');
      assert(maliciousHtml.includes('Checked IN (Entry)'), 'Test 21.9: Design and wording preserved');
    }

    // --------------------------------------------------------------------------
    // Test 22: Tenant-Local Date Filtering Across Timezone Boundaries
    // --------------------------------------------------------------------------
    {
      // 22.1: Unit verification of boundary derivation for Asia/Colombo (+05:30)
      const boundaries = getTenantDateBoundaries('2026-11-15', 'Asia/Colombo');
      assert(
        boundaries.startOfDay.toISOString() === '2026-11-14T18:30:00.000Z',
        'Test 22.1: Start of day in Asia/Colombo converts to previous day 18:30 UTC'
      );
      assert(
        boundaries.endOfDay.toISOString() === '2026-11-15T18:29:59.999Z',
        'Test 22.2: End of day in Asia/Colombo converts to 18:29:59.999 UTC'
      );

      // 22.3: Fallback timezone behavior
      const fallbackBoundaries = getTenantDateBoundaries('2026-11-15', null);
      assert(
        fallbackBoundaries.startOfDay.toISOString() === '2026-11-14T18:30:00.000Z',
        'Test 22.3: Fallback timezone defaults to Asia/Colombo'
      );

      // 22.4: Integration test via GET /api/gate/events?date=YYYY-MM-DD
      const targetDate = '2026-11-15';

      // Event 1: 00:30 AM local time on Nov 15 -> Nov 14 19:00 UTC (inside Nov 15 local)
      const eventEarlyLocal = await prisma.studentGateEvent.create({
        data: {
          madrasaId: madrasaA.id,
          studentId: studentDayScholarA.id,
          recordedByUserId: adminA.id,
          eventType: 'ENTRY',
          category: 'DAY_SCHOLAR',
          scannedAt: new Date('2026-11-14T19:00:00.000Z'),
        },
      });

      // Event 2: 23:50 PM local time on Nov 15 -> Nov 15 18:20 UTC (inside Nov 15 local)
      const eventLateLocal = await prisma.studentGateEvent.create({
        data: {
          madrasaId: madrasaA.id,
          studentId: studentDayScholarA.id,
          recordedByUserId: adminA.id,
          eventType: 'EXIT',
          category: 'DAY_SCHOLAR',
          scannedAt: new Date('2026-11-15T18:20:00.000Z'),
        },
      });

      // Event 3: 23:50 PM local time on Nov 14 -> Nov 14 18:20 UTC (outside Nov 15 local, falls on Nov 14)
      const eventPreviousDayLocal = await prisma.studentGateEvent.create({
        data: {
          madrasaId: madrasaA.id,
          studentId: studentDayScholarA.id,
          recordedByUserId: adminA.id,
          eventType: 'ENTRY',
          category: 'DAY_SCHOLAR',
          scannedAt: new Date('2026-11-14T18:20:00.000Z'),
        },
      });

      const filterRes = await fetch(`${baseUrl}/api/gate/events?date=${targetDate}`, {
        headers: {
          Authorization: `Bearer ${tokenA}`,
        },
      });
      const filterJson = await filterRes.json();

      assert(filterRes.status === 200, 'Test 22.4: GET /api/gate/events with date filter returns HTTP 200');
      const filteredIds = filterJson.data.events.map((e) => e.id);
      assert(filteredIds.includes(eventEarlyLocal.id), 'Test 22.5: Early local event (previous day UTC) is included');
      assert(filteredIds.includes(eventLateLocal.id), 'Test 22.6: Late local event is included');
      assert(
        !filteredIds.includes(eventPreviousDayLocal.id),
        'Test 22.7: Previous local day event is excluded from date filter'
      );
    }
  } finally {
    await cleanupFixtures();
  }

  console.log('\n======================================================');
  console.log(`Gate Scanner Test Suite Complete: ${testPassedCount} Passed, ${testFailedCount} Failed`);
  console.log('======================================================\n');

  if (testFailedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Execution Error:', err);
  process.exit(1);
});
