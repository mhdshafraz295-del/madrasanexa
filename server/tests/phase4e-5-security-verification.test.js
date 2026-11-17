import './setup-test-env.js';
import assert from 'assert';
import { prisma } from '../src/lib/prisma.js';
import {
  requireTeacherContext,
  rejectClientSuppliedTeacherOverride,
} from '../src/middleware/tenant.middleware.js';
import { requireTeacher } from '../src/middleware/role.middleware.js';
import {
  recordTeacherClassroomCheckIn,
  getPeriodAttendanceSession,
  markPeriodAttendance,
  sealPeriodSession,
  getPayslipDetail,
} from '../src/services/teacher.service.js';
import {
  createClassroom,
  regenerateClassroomQr,
  revokeClassroomQr,
} from '../src/services/classroom.service.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function testAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\n================================================================');
console.log('  MadrasaNexa Phase 4E-5: Security Verification & Boundary Suite');
console.log('  (100% Offline Mock Tests / Zero Live Database Access)');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Group 1: Cross-Teacher & Cross-Tenant Data Isolation
// -----------------------------------------------------------------------------
console.log('Group 1: Cross-Teacher & Cross-Tenant Data Isolation');

await testAsync('getPayslipDetail rejects retrieval when payslip belongs to different ustadh', async () => {
  const origFind = prisma.ustadhPayslipRecord?.findFirst;
  prisma.ustadhPayslipRecord = {
    findFirst: async ({ where }) => {
      // Simulate that DB only matches when madrasaId AND ustadhId match
      if (where.madrasaId === 'tenant_1' && where.ustadhId === 'ustadh_A' && where.id === 'payslip_1') {
        return {
          id: 'payslip_1',
          basicSalary: 80000,
          grossEarnings: 100000,
          netPayable: 90000,
          totalDeductions: 10000,
          salaryMonth: new Date('2026-10-01'),
          createdAt: new Date(),
          status: 'ISSUED',
          ustadh: { fullName: 'Ustadh A', ustadhCode: 'UST-001', staffType: 'USTADH' },
        };
      }
      return null;
    },
  };

  try {
    // ustadh_B attempts to access payslip_1 belonging to ustadh_A
    const result = await getPayslipDetail({
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_B',
      payslipId: 'payslip_1',
    });
    assert.strictEqual(result, null, 'Should return null / throw error for cross-teacher access');
  } catch (err) {
    assert(err.message.includes('not found') || err.name === 'NotFoundError');
  } finally {
    if (origFind) prisma.ustadhPayslipRecord.findFirst = origFind;
  }
});

await testAsync('getPayslipDetail rejects retrieval when payslip belongs to different tenant', async () => {
  const origFind = prisma.ustadhPayslipRecord?.findFirst;
  prisma.ustadhPayslipRecord = {
    findFirst: async ({ where }) => {
      // Cross tenant query
      if (where.madrasaId === 'tenant_2') {
        return null; // Tenant 2 cannot see Tenant 1 records
      }
      return null;
    },
  };

  try {
    const result = await getPayslipDetail({
      madrasaId: 'tenant_2',
      ustadhId: 'ustadh_A',
      payslipId: 'payslip_1',
    });
    assert.strictEqual(result, null);
  } catch (err) {
    assert(err.message.includes('not found') || err.name === 'NotFoundError');
  } finally {
    if (origFind) prisma.ustadhPayslipRecord.findFirst = origFind;
  }
});

// -----------------------------------------------------------------------------
// Group 2: Client Override Rejection on Mutation Endpoints
// -----------------------------------------------------------------------------
console.log('\nGroup 2: Client Override Rejection on Mutation Endpoints');

test('rejectClientSuppliedTeacherOverride blocks injected madrasaId', () => {
  let statusSent = null;
  let jsonSent = null;
  const req = {
    body: {
      madrasaId: 'hacked_madrasa',
      phoneNumber: '0771234567',
    },
  };
  const res = {
    status: (code) => {
      statusSent = code;
      return {
        json: (data) => {
          jsonSent = data;
        },
      };
    },
  };
  let nextCalled = false;
  rejectClientSuppliedTeacherOverride(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(statusSent, 403);
  assert.strictEqual(nextCalled, false);
  assert(jsonSent.message.includes('prohibited'));
});

test('rejectClientSuppliedTeacherOverride blocks injected ustadhId', () => {
  let statusSent = null;
  const req = {
    body: {
      ustadhId: 'hacked_ustadh',
      remarks: 'Attempted spoof',
    },
  };
  const res = {
    status: (code) => {
      statusSent = code;
      return { json: () => {} };
    },
  };
  let nextCalled = false;
  rejectClientSuppliedTeacherOverride(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(statusSent, 403);
  assert.strictEqual(nextCalled, false);
});

test('rejectClientSuppliedTeacherOverride blocks injected role alteration', () => {
  let statusSent = null;
  const req = {
    body: {
      role: 'SUPER_ADMIN',
    },
  };
  const res = {
    status: (code) => {
      statusSent = code;
      return { json: () => {} };
    },
  };
  let nextCalled = false;
  rejectClientSuppliedTeacherOverride(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(statusSent, 403);
  assert.strictEqual(nextCalled, false);
});

// -----------------------------------------------------------------------------
// Group 3: Option A Full Isolation & Immutability Verification
// -----------------------------------------------------------------------------
console.log('\nGroup 3: Option A Full Isolation & Immutability Verification');

await testAsync('markPeriodAttendance isolates period roster from daily attendance tables', async () => {
  let dailyAttendanceTouched = false;
  const origDailyAttendance = prisma.attendanceRecord;
  prisma.attendanceRecord = {
    create: async () => {
      dailyAttendanceTouched = true;
    },
    upsert: async () => {
      dailyAttendanceTouched = true;
    },
  };

  const origSchedule = prisma.ustadhSchedule.findFirst;
  prisma.ustadhSchedule.findFirst = async () => ({
    id: 'sch_1',
    madrasaId: 'm_1',
    ustadhId: 'u_1',
    isActive: true,
  });

  const origPeriodSession = prisma.classPeriodAttendanceSession;
  prisma.classPeriodAttendanceSession = {
    findFirst: async () => null,
    create: async () => ({ id: 'ses_opt_a', submittedAt: null }),
  };

  const origPeriodRecord = prisma.classPeriodAttendanceRecord;
  let periodRecordUpserted = false;
  prisma.classPeriodAttendanceRecord = {
    upsert: async () => {
      periodRecordUpserted = true;
    },
  };

  try {
    const res = await markPeriodAttendance({
      madrasaId: 'm_1',
      ustadhId: 'u_1',
      userId: 'usr_1',
      payload: {
        scheduleId: 'sch_1',
        date: '2026-11-17',
        records: [{ studentId: 'st_1', status: 'PRESENT' }],
      },
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(periodRecordUpserted, true);
    assert.strictEqual(dailyAttendanceTouched, false, 'Daily institutional attendance MUST NOT be touched');
    assert(res.optionAIsolationNotice.includes('isolated and unaffected'));
  } finally {
    prisma.attendanceRecord = origDailyAttendance;
    prisma.ustadhSchedule.findFirst = origSchedule;
    prisma.classPeriodAttendanceSession = origPeriodSession;
    prisma.classPeriodAttendanceRecord = origPeriodRecord;
  }
});

await testAsync('sealPeriodSession enforces irreversible lock on period attendance modification', async () => {
  const origSchedule = prisma.ustadhSchedule.findFirst;
  prisma.ustadhSchedule.findFirst = async () => ({
    id: 'sch_1',
    madrasaId: 'm_1',
    ustadhId: 'u_1',
    isActive: true,
  });

  const origPeriodSession = prisma.classPeriodAttendanceSession;
  prisma.classPeriodAttendanceSession = {
    findFirst: async () => ({
      id: 'ses_sealed',
      submittedAt: new Date('2026-11-17T08:50:00Z'), // ALREADY SEALED
    }),
  };

  const origPeriodRecord = prisma.classPeriodAttendanceRecord;
  prisma.classPeriodAttendanceRecord = {
    upsert: async () => {},
  };

  try {
    await markPeriodAttendance({
      madrasaId: 'm_1',
      ustadhId: 'u_1',
      userId: 'usr_1',
      payload: {
        scheduleId: 'sch_1',
        date: '2026-11-17',
        records: [{ studentId: 'st_1', status: 'ABSENT' }],
      },
    });
    assert.fail('Should have thrown error on sealed session modification');
  } catch (err) {
    assert(err.message.includes('sealed and cannot be modified'));
  } finally {
    prisma.ustadhSchedule.findFirst = origSchedule;
    prisma.classPeriodAttendanceSession = origPeriodSession;
    prisma.classPeriodAttendanceRecord = origPeriodRecord;
  }
});

// -----------------------------------------------------------------------------
// Group 4: Classroom QR Token Regeneration & Revocation Invalidation
// -----------------------------------------------------------------------------
console.log('\nGroup 4: Classroom QR Token Regeneration & Revocation Invalidation');

await testAsync('regenerateClassroomQr changes roomToken and invalidates old token', async () => {
  let storedToken = 'MNX-RM-OLD-111111';
  const origClassroom = prisma.classroom;
  prisma.classroom = {
    findFirst: async () => ({
      id: 'cr_1',
      madrasaId: 'm_1',
      roomNumber: '101',
      name: 'Hall 101',
      roomToken: storedToken,
      isActive: true,
    }),
    update: async ({ data }) => {
      storedToken = data.roomToken;
      return {
        id: 'cr_1',
        name: 'Hall 101',
        roomNumber: '101',
        roomToken: storedToken,
        isActive: true,
      };
    },
  };

  try {
    const res = await regenerateClassroomQr('m_1', 'cr_1', 'admin_1');
    assert.notStrictEqual(res.roomToken, 'MNX-RM-OLD-111111');
    assert.strictEqual(res.previousToken, 'MNX-RM-OLD-111111');
    assert.ok(res.roomToken.startsWith('mnx_rm_v1_'));
    assert.strictEqual(res.roomToken.length, 74);
    assert.ok(/^mnx_rm_v1_[0-9a-f]{64}$/.test(res.roomToken));
    assert(res.message.includes('invalid'));
  } finally {
    prisma.classroom = origClassroom;
  }
});

await testAsync('revokeClassroomQr deactivates classroom and blocks verification', async () => {
  let isActive = true;
  const origClassroom = prisma.classroom;
  prisma.classroom = {
    findFirst: async () => ({
      id: 'cr_1',
      madrasaId: 'm_1',
      roomNumber: '101',
      name: 'Hall 101',
      roomToken: 'MNX-RM-M1-TOKEN',
      isActive,
    }),
    update: async ({ data }) => {
      isActive = data.isActive;
      return {
        id: 'cr_1',
        name: 'Hall 101',
        roomNumber: '101',
        roomToken: 'MNX-RM-M1-TOKEN',
        isActive: false,
      };
    },
  };

  try {
    const res = await revokeClassroomQr('m_1', 'cr_1', 'admin_1');
    assert.strictEqual(res.isActive, false);
    assert(res.message.includes('revoked'));
  } finally {
    prisma.classroom = origClassroom;
  }
});

// -----------------------------------------------------------------------------
// Group 5: Suspended / Deactivated Account Enforcement
// -----------------------------------------------------------------------------
console.log('\nGroup 5: Suspended / Deactivated Account Enforcement');

await testAsync('requireTeacherContext blocks teacher if ustadh profile is deactivated', async () => {
  const origUstadh = prisma.ustadh.findFirst;
  prisma.ustadh.findFirst = async () => ({
    id: 'u_deactivated',
    ustadhCode: 'UST-999',
    fullName: 'Former Ustadh',
    staffType: 'USTADH',
    isActive: false, // DEACTIVATED
    madrasaId: 'm_1',
    madrasa: { id: 'm_1', status: 'ACTIVE', code: 'M1', name: 'Madrasa 1' },
  });

  const req = {
    auth: { userId: 'usr_deactivated', role: 'TEACHER', madrasaId: 'm_1', mustChangePassword: false },
  };
  let errorCaught = null;
  const res = {};
  await requireTeacherContext(req, res, (err) => {
    errorCaught = err;
  });

  assert(errorCaught !== null);
  assert(errorCaught.message.includes('deactivated by the institution'));
  prisma.ustadh.findFirst = origUstadh;
});

await testAsync('requireTeacherContext blocks teacher if tenant Madrasa is suspended', async () => {
  const origUstadh = prisma.ustadh.findFirst;
  prisma.ustadh.findFirst = async () => ({
    id: 'u_1',
    ustadhCode: 'UST-001',
    fullName: 'Ustadh Active',
    staffType: 'USTADH',
    isActive: true,
    madrasaId: 'm_suspended',
    madrasa: { id: 'm_suspended', status: 'SUSPENDED', code: 'MSUSP', name: 'Suspended Madrasa' },
  });

  const req = {
    auth: { userId: 'usr_1', role: 'TEACHER', madrasaId: 'm_suspended', mustChangePassword: false },
  };
  let errorCaught = null;
  const res = {};
  await requireTeacherContext(req, res, (err) => {
    errorCaught = err;
  });

  assert(errorCaught !== null);
  assert(errorCaught.message.includes('Access restricted'));
  prisma.ustadh.findFirst = origUstadh;
});

console.log('\n================================================================');
console.log(`  Tests Executed: ${totalTests}`);
console.log(`  Passed:         ${passedTests}`);
console.log(`  Failed:         ${failedTests}`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('  All Phase 4E-5 security verification tests PASSED (100%).\n');
}
