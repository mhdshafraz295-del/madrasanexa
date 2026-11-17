import './setup-test-env.js';
import assert from 'assert';
import { prisma } from '../src/lib/prisma.js';
import { generateRoomToken, regenerateClassroomQr, revokeClassroomQr } from '../src/services/classroom.service.js';
import { getSalarySummary, getPayslipDetail, recordTeacherClassroomCheckIn, markPeriodAttendance } from '../src/services/teacher.service.js';
import { getColomboTimeContext } from '../src/utils/dateTime.js';

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
console.log('  MadrasaNexa Phase 4E-5.1: Production Cleanup & QR Security Tests');
console.log('  (100% Offline / Zero Database Connection Required)');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Group 1: 256-Bit Cryptographically Secure Classroom QR Token Format
// -----------------------------------------------------------------------------
console.log('Group 1: Classroom QR Token Security Specification');

test('QR token format starts with mnx_rm_v1_ prefix', () => {
  const token = generateRoomToken();
  assert.ok(token.startsWith('mnx_rm_v1_'));
});

test('QR token total length is exactly 74 characters', () => {
  const token = generateRoomToken();
  assert.strictEqual(token.length, 74, `Expected length 74, got ${token.length}`);
});

test('QR secret contains exactly 64 hexadecimal characters after prefix', () => {
  const token = generateRoomToken();
  const secretPart = token.slice(10); // After 'mnx_rm_v1_'
  assert.strictEqual(secretPart.length, 64);
  assert.ok(/^[0-9a-f]{64}$/.test(secretPart), 'Secret part must be 64 valid lowercase hex characters');
});

test('QR token generation produces 256-bit cryptographically distinct tokens', () => {
  const tokens = new Set();
  for (let i = 0; i < 100; i++) {
    tokens.add(generateRoomToken());
  }
  assert.strictEqual(tokens.size, 100, 'All 100 generated tokens must be cryptographically distinct');
});

// -----------------------------------------------------------------------------
// Group 2: Token Invalidation upon Regeneration & Revocation
// -----------------------------------------------------------------------------
console.log('\nGroup 2: Classroom QR Invalidation & Revocation Lifecycle');

await testAsync('Old QR token is immediately invalidated when classroom QR is regenerated', async () => {
  const initialToken = generateRoomToken();
  let currentDbToken = initialToken;

  const origClassroom = prisma.classroom;
  prisma.classroom = {
    findFirst: async () => ({
      id: 'cr_101',
      madrasaId: 'm_1',
      roomNumber: '101',
      name: 'Hall 101',
      roomToken: currentDbToken,
      isActive: true,
    }),
    update: async ({ data }) => {
      currentDbToken = data.roomToken;
      return {
        id: 'cr_101',
        name: 'Hall 101',
        roomNumber: '101',
        roomToken: currentDbToken,
        isActive: true,
      };
    },
  };

  try {
    const regenResult = await regenerateClassroomQr('m_1', 'cr_101', 'admin_1');
    assert.strictEqual(regenResult.previousToken, initialToken);
    assert.notStrictEqual(regenResult.roomToken, initialToken);
    assert.strictEqual(regenResult.roomToken, currentDbToken);
    assert.strictEqual(regenResult.roomToken.length, 74);
    assert.ok(regenResult.roomToken.startsWith('mnx_rm_v1_'));
  } finally {
    prisma.classroom = origClassroom;
  }
});

await testAsync('Revoked classroom QR (isActive = false) is strictly rejected during teacher check-in', async () => {
  const colomboNow = getColomboTimeContext();
  const origSchedule = prisma.ustadhSchedule.findFirst;
  const origAttendance = prisma.ustadhAttendanceRecord.findFirst;
  const origClassroom = prisma.classroom;

  const validToken = generateRoomToken();

  prisma.ustadhSchedule.findFirst = async () => ({
    id: 'sch_active',
    madrasaId: 'm_1',
    ustadhId: 'u_1',
    classroomId: 'cr_revoked',
    dayOfWeek: colomboNow.weekday,
    startMinutes: colomboNow.currentMinutes - 5,
    endMinutes: colomboNow.currentMinutes + 40,
    isActive: true,
  });

  prisma.ustadhAttendanceRecord.findFirst = async () => null;

  prisma.classroom = {
    findFirst: async () => ({
      id: 'cr_revoked',
      madrasaId: 'm_1',
      roomToken: validToken,
      isActive: false, // REVOKED / DEACTIVATED
    }),
  };

  try {
    await recordTeacherClassroomCheckIn({
      madrasaId: 'm_1',
      ustadhId: 'u_1',
      userId: 'usr_1',
      payload: {
        scheduleId: 'sch_active',
        roomToken: validToken,
        method: 'Classroom QR',
      },
    });
    assert.fail('Should have rejected deactivated classroom QR');
  } catch (err) {
    assert.strictEqual(err.statusCode, 400);
    assert.ok(err.message.includes('deactivated') && err.message.includes('revoked'));
  } finally {
    prisma.ustadhSchedule.findFirst = origSchedule;
    prisma.ustadhAttendanceRecord.findFirst = origAttendance;
    prisma.classroom = origClassroom;
  }
});

// -----------------------------------------------------------------------------
// Group 3: Financial Remediation — Zero Sample Allowances & Bank/EPF Cleanliness
// -----------------------------------------------------------------------------
console.log('\nGroup 3: Financial Remediation — Zero Fabricated Figures');

await testAsync('Missing salary components return empty array (zero sample allowances)', async () => {
  const origUstadh = prisma.ustadh.findFirst;
  const origSalary = prisma.ustadhSalary.findMany;
  const origComp = prisma.ustadhSalaryComponent;

  prisma.ustadh.findFirst = async () => ({
    id: 'u_1',
    fullName: 'Ustadh Zaid',
    baseMonthlySalary: 75000,
  });

  prisma.ustadhSalaryComponent = {
    findMany: async () => [], // Zero configured components in DB
  };
  prisma.ustadhSalary.findMany = async () => [];

  try {
    const summary = await getSalarySummary({ madrasaId: 'm_1', ustadhId: 'u_1' });

    assert.strictEqual(summary.basicSalary, 75000);
    assert.strictEqual(summary.allowances.length, 0, 'Must NOT return hardcoded sample allowances');
    assert.deepStrictEqual(summary.allowances, []);
    assert.strictEqual(summary.grossSalary, 75000); // basic + 0 allowances
    assert.strictEqual(summary.totalDeductions, 6000); // 8% statutory EPF on 75,000 = 6,000
    assert.strictEqual(summary.netSalary, 69000); // 75,000 - 6,000

    // Verify bankDetails and epfNumber return null (no fabricated bank info)
    assert.strictEqual(summary.epfNumber, null, 'Must not return SAMPLE-EPF-7841');
    assert.strictEqual(summary.bankDetails, null, 'Must not return sample Bank of Ceylon info');
  } finally {
    prisma.ustadh.findFirst = origUstadh;
    prisma.ustadhSalary.findMany = origSalary;
    prisma.ustadhSalaryComponent = origComp;
  }
});

await testAsync('getPayslipDetail returns null for missing bank details and signatory', async () => {
  const origPayslip = prisma.ustadhPayslipRecord;

  prisma.ustadhPayslipRecord = {
    findFirst: async () => ({
      id: 'ps_real_1',
      madrasaId: 'm_1',
      ustadhId: 'u_1',
      payslipNumber: 'PAY-202610-001',
      revision: 1,
      status: 'ISSUED',
      salaryMonth: new Date('2026-10-01'),
      basicSalary: '80000.00',
      totalAllowances: '0.00',
      totalDeductions: '6400.00',
      grossEarnings: '80000.00',
      netPayable: '73600.00',
      allowancesJson: null,
      deductionsJson: null,
      employeeEpfAmount: '6400.00',
      disbursementMethod: null,
      disbursementRef: null,
      createdAt: new Date(),
      ustadh: { fullName: 'Ustadh Zaid', ustadhCode: 'UST-002', staffType: 'USTADH' },
      madrasa: { name: 'Al-Huda Institute', code: 'AHI' },
    }),
  };

  try {
    const detail = await getPayslipDetail({ madrasaId: 'm_1', ustadhId: 'u_1', payslipId: 'ps_real_1' });

    assert.strictEqual(detail.allowances.length, 0);
    assert.strictEqual(detail.bankName, null, 'Must not return hardcoded Bank of Ceylon');
    assert.strictEqual(detail.accountNumber, null, 'Must not return hardcoded account number');
    assert.strictEqual(detail.authorizedSignatory, null, 'Must not return Director of Academic Finance');
    assert.strictEqual(detail.authorizedTitle, null, 'Must not return Registrar & Bursar');
  } finally {
    prisma.ustadhPayslipRecord = origPayslip;
  }
});

// -----------------------------------------------------------------------------
// Group 4: Option A Attendance Isolation Preservation
// -----------------------------------------------------------------------------
console.log('\nGroup 4: Option A Attendance Isolation Preservation');

await testAsync('markPeriodAttendance continues to strictly isolate from daily attendance', async () => {
  let dailyTouched = false;
  const origDailyAttendance = prisma.attendanceRecord;
  prisma.attendanceRecord = {
    create: async () => { dailyTouched = true; },
    upsert: async () => { dailyTouched = true; },
  };

  const origSchedule = prisma.ustadhSchedule.findFirst;
  prisma.ustadhSchedule.findFirst = async () => ({
    id: 'sch_p1',
    madrasaId: 'm_1',
    ustadhId: 'u_1',
    isActive: true,
  });

  const origPeriodSession = prisma.classPeriodAttendanceSession;
  prisma.classPeriodAttendanceSession = {
    findFirst: async () => null,
    create: async () => ({ id: 'ses_1', submittedAt: null }),
  };

  const origPeriodRecord = prisma.classPeriodAttendanceRecord;
  let recordMarked = false;
  prisma.classPeriodAttendanceRecord = {
    upsert: async () => { recordMarked = true; },
  };

  try {
    const res = await markPeriodAttendance({
      madrasaId: 'm_1',
      ustadhId: 'u_1',
      userId: 'usr_1',
      payload: {
        scheduleId: 'sch_p1',
        date: '2026-11-17',
        records: [{ studentId: 's_1', status: 'PRESENT' }],
      },
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(recordMarked, true);
    assert.strictEqual(dailyTouched, false, 'Option A: Daily attendance must remain 100% untouched');
    assert.ok(res.optionAIsolationNotice.includes('isolated and unaffected'));
  } finally {
    prisma.attendanceRecord = origDailyAttendance;
    prisma.ustadhSchedule.findFirst = origSchedule;
    prisma.classPeriodAttendanceSession = origPeriodSession;
    prisma.classPeriodAttendanceRecord = origPeriodRecord;
  }
});

console.log('\n================================================================');
console.log(`  Tests Executed: ${totalTests}`);
console.log(`  Passed:         ${passedTests}`);
console.log(`  Failed:         ${failedTests}`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('  All Phase 4E-5.1 cleanup & security tests PASSED (100%).\n');
}
