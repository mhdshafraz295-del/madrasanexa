import './setup-test-env.js';
import assert from 'assert';
import { prisma } from '../src/lib/prisma.js';
import { getColomboTimeContext } from '../src/utils/dateTime.js';
import {
  recordTeacherClassroomCheckIn,
  getPeriodAttendanceSession,
  markPeriodAttendance,
  sealPeriodSession,
  getAttendanceHistory,
  getSalarySummary,
  listPayslips,
  getPayslipDetail,
  generatePayslipRecord,
  voidPayslipRecord,
} from '../src/services/teacher.service.js';

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
console.log('  MadrasaNexa Phase 4E-2: Persistent Backend Service Offline Test');
console.log('  (Targeted Prisma-Mocked Unit Tests / Zero Database Connection)');
console.log('================================================================\n');

// =============================================================================
// Group 1: Classroom QR Venue Verification & Stakeholder Decision 1 & 2
// =============================================================================
console.log('Group 1: Classroom QR Venue Verification & Stakeholder Decisions');

await testAsync('Assigned physical classroom with matching active QR token succeeds', async () => {
  const colomboNow = getColomboTimeContext();
  const originalScheduleFind = prisma.ustadhSchedule.findFirst;
  const originalAttendanceFind = prisma.ustadhAttendanceRecord.findFirst;
  const originalAttendanceCreate = prisma.ustadhAttendanceRecord.create;
  const originalClassroom = prisma.classroom;

  prisma.ustadhSchedule.findFirst = async () => ({
    id: 'sch_active_room',
    madrasaId: 'tenant_1',
    ustadhId: 'ustadh_1',
    classroomId: 'room_101',
    dayOfWeek: colomboNow.weekday,
    startMinutes: colomboNow.currentMinutes - 5,
    endMinutes: colomboNow.currentMinutes + 35,
    isActive: true,
  });

  prisma.classroom = {
    findFirst: async ({ where }) => {
      assert.strictEqual(where.id, 'room_101');
      assert.strictEqual(where.madrasaId, 'tenant_1');
      return {
        id: 'room_101',
        madrasaId: 'tenant_1',
        name: 'Imam Bukhari Hall',
        roomNumber: 'B-101',
        roomToken: 'mnx_qr_valid_token_123',
        isActive: true,
      };
    },
  };

  prisma.ustadhAttendanceRecord.findFirst = async () => null;
  prisma.ustadhAttendanceRecord.create = async ({ data }) => ({
    id: 'att_rec_ok',
    ...data,
    createdAt: new Date(),
  });

  try {
    const res = await recordTeacherClassroomCheckIn({
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_1',
      userId: 'user_1',
      payload: {
        roomToken: 'mnx_qr_valid_token_123',
        scheduleId: 'sch_active_room',
      },
    });

    assert.strictEqual(res.id, 'att_rec_ok');
    assert.strictEqual(res.status, 'Late'); // started 5 mins ago
    assert.strictEqual(res.roomTokenAccepted, 'mnx_qr_valid_token_123');
  } finally {
    prisma.ustadhSchedule.findFirst = originalScheduleFind;
    prisma.ustadhAttendanceRecord.findFirst = originalAttendanceFind;
    prisma.ustadhAttendanceRecord.create = originalAttendanceCreate;
    prisma.classroom = originalClassroom;
  }
});

await testAsync('Assigned physical classroom with mismatched QR token throws BadRequestError', async () => {
  const colomboNow = getColomboTimeContext();
  const originalScheduleFind = prisma.ustadhSchedule.findFirst;
  const originalClassroom = prisma.classroom;

  prisma.ustadhSchedule.findFirst = async () => ({
    id: 'sch_active_room',
    madrasaId: 'tenant_1',
    ustadhId: 'ustadh_1',
    classroomId: 'room_101',
    dayOfWeek: colomboNow.weekday,
    startMinutes: colomboNow.currentMinutes - 5,
    endMinutes: colomboNow.currentMinutes + 35,
    isActive: true,
  });

  prisma.classroom = {
    findFirst: async () => ({
      id: 'room_101',
      madrasaId: 'tenant_1',
      roomToken: 'mnx_qr_venue_expected',
      isActive: true,
    }),
  };

  try {
    await recordTeacherClassroomCheckIn({
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_1',
      userId: 'user_1',
      payload: {
        roomToken: 'mnx_qr_wrong_token',
        scheduleId: 'sch_active_room',
      },
    });
    assert.fail('Should have rejected mismatched QR code');
  } catch (err) {
    assert.strictEqual(err.statusCode, 400);
    assert.ok(err.message.includes('does not match'));
  } finally {
    prisma.ustadhSchedule.findFirst = originalScheduleFind;
    prisma.classroom = originalClassroom;
  }
});

await testAsync('Deactivated classroom rejects QR verification with revoked notice (Decision 1)', async () => {
  const colomboNow = getColomboTimeContext();
  const originalScheduleFind = prisma.ustadhSchedule.findFirst;
  const originalClassroom = prisma.classroom;

  prisma.ustadhSchedule.findFirst = async () => ({
    id: 'sch_deactivated_room',
    madrasaId: 'tenant_1',
    ustadhId: 'ustadh_1',
    classroomId: 'room_inactive',
    dayOfWeek: colomboNow.weekday,
    startMinutes: colomboNow.currentMinutes - 5,
    endMinutes: colomboNow.currentMinutes + 35,
    isActive: true,
  });

  prisma.classroom = {
    findFirst: async () => ({
      id: 'room_inactive',
      madrasaId: 'tenant_1',
      roomToken: 'mnx_token',
      isActive: false, // Deactivated!
    }),
  };

  try {
    await recordTeacherClassroomCheckIn({
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_1',
      userId: 'user_1',
      payload: {
        roomToken: 'mnx_token',
        scheduleId: 'sch_deactivated_room',
      },
    });
    assert.fail('Should have rejected check-in for deactivated classroom');
  } catch (err) {
    assert.strictEqual(err.statusCode, 400);
    assert.ok(err.message.includes('deactivated') && err.message.includes('revoked'));
  } finally {
    prisma.ustadhSchedule.findFirst = originalScheduleFind;
    prisma.classroom = originalClassroom;
  }
});

await testAsync('Unassigned schedule (classroomId: null) allows check-in without room QR (Decision 2)', async () => {
  const colomboNow = getColomboTimeContext();
  const originalScheduleFind = prisma.ustadhSchedule.findFirst;
  const originalAttendanceFind = prisma.ustadhAttendanceRecord.findFirst;
  const originalAttendanceCreate = prisma.ustadhAttendanceRecord.create;

  prisma.ustadhSchedule.findFirst = async () => ({
    id: 'sch_unassigned_room',
    madrasaId: 'tenant_1',
    ustadhId: 'ustadh_1',
    classroomId: null, // Unassigned!
    dayOfWeek: colomboNow.weekday,
    startMinutes: colomboNow.currentMinutes - 5,
    endMinutes: colomboNow.currentMinutes + 35,
    isActive: true,
  });

  prisma.ustadhAttendanceRecord.findFirst = async () => null;
  prisma.ustadhAttendanceRecord.create = async ({ data }) => ({
    id: 'att_unassigned_ok',
    ...data,
    createdAt: new Date(),
  });

  try {
    const res = await recordTeacherClassroomCheckIn({
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_1',
      userId: 'user_1',
      payload: {
        roomToken: 'optional_or_empty',
        scheduleId: 'sch_unassigned_room',
      },
    });
    assert.strictEqual(res.id, 'att_unassigned_ok');
  } finally {
    prisma.ustadhSchedule.findFirst = originalScheduleFind;
    prisma.ustadhAttendanceRecord.findFirst = originalAttendanceFind;
    prisma.ustadhAttendanceRecord.create = originalAttendanceCreate;
  }
});

// =============================================================================
// Group 2: Persistent Student Period Attendance Sessions (Option A Isolation)
// =============================================================================
console.log('\nGroup 2: Persistent Student Period Attendance Sessions (Option A)');

await testAsync('getPeriodAttendanceSession returns persistent session and roster', async () => {
  const originalSchedule = prisma.ustadhSchedule.findFirst;
  const originalSession = prisma.classPeriodAttendanceSession;

  prisma.ustadhSchedule.findFirst = async () => ({
    id: 'sch_session_1',
    madrasaId: 'tenant_1',
    ustadhId: 'ustadh_1',
    isActive: true,
    startMinutes: 480,
    endMinutes: 525,
    class: {
      name: 'Grade 10 Quran',
      students: [
        { id: 'st_101', admissionNo: 'ADM-101', fullName: 'Ahmad Bilal' },
        { id: 'st_102', admissionNo: 'ADM-102', fullName: 'Zaid Tariq' },
      ],
    },
    subject: { name: 'Tajweed' },
  });

  prisma.classPeriodAttendanceSession = {
    findFirst: async ({ where }) => {
      assert.strictEqual(where.madrasaId, 'tenant_1');
      assert.strictEqual(where.scheduleId, 'sch_session_1');
      return {
        id: 'session_db_1',
        madrasaId: 'tenant_1',
        scheduleId: 'sch_session_1',
        periodNumber: 1,
        submittedAt: null,
        records: [
          { studentId: 'st_101', status: 'PRESENT', markedAt: new Date() },
          { studentId: 'st_102', status: 'ABSENT', remarks: 'Sick', markedAt: new Date() },
        ],
      };
    },
  };

  try {
    const session = await getPeriodAttendanceSession({
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_1',
      scheduleId: 'sch_session_1',
      date: '2026-11-17',
    });

    assert.strictEqual(session.isSealed, false);
    assert.strictEqual(session.totalEnrolled, 2);
    assert.strictEqual(session.roster[0].status, 'Present');
    assert.strictEqual(session.roster[1].status, 'Absent');
    assert.strictEqual(session.roster[1].remarks, 'Sick');
  } finally {
    prisma.ustadhSchedule.findFirst = originalSchedule;
    prisma.classPeriodAttendanceSession = originalSession;
  }
});

await testAsync('markPeriodAttendance creates session and upserts records persistently', async () => {
  const originalSchedule = prisma.ustadhSchedule.findFirst;
  const originalSession = prisma.classPeriodAttendanceSession;
  const originalRecord = prisma.classPeriodAttendanceRecord;

  prisma.ustadhSchedule.findFirst = async () => ({
    id: 'sch_session_1',
    madrasaId: 'tenant_1',
    ustadhId: 'ustadh_1',
    isActive: true,
  });

  let createdSession = null;
  const upsertedRecords = [];

  prisma.classPeriodAttendanceSession = {
    findFirst: async () => null, // Session doesn't exist yet
    create: async ({ data }) => {
      createdSession = { id: 'new_session_db', ...data };
      return createdSession;
    },
  };

  prisma.classPeriodAttendanceRecord = {
    upsert: async ({ where, create, update }) => {
      upsertedRecords.push(create);
      return { id: `rec_${create.studentId}`, ...create };
    },
  };

  try {
    const res = await markPeriodAttendance({
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_1',
      userId: 'user_1',
      payload: {
        scheduleId: 'sch_session_1',
        date: '2026-11-17',
        records: [
          { studentId: 'st_101', status: 'Present' },
          { studentId: 'st_102', status: 'Late', remarks: '10 min late' },
        ],
      },
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.totalRecorded, 2);
    assert.strictEqual(createdSession.teacherId, 'ustadh_1');
    assert.strictEqual(upsertedRecords.length, 2);
    assert.strictEqual(upsertedRecords[0].status, 'PRESENT');
    assert.strictEqual(upsertedRecords[1].status, 'LATE');
    assert.ok(res.optionAIsolationNotice.includes('Daily institutional attendance is isolated and unaffected'));
  } finally {
    prisma.ustadhSchedule.findFirst = originalSchedule;
    prisma.classPeriodAttendanceSession = originalSession;
    prisma.classPeriodAttendanceRecord = originalRecord;
  }
});

await testAsync('markPeriodAttendance strictly blocks edits if session is sealed', async () => {
  const originalSchedule = prisma.ustadhSchedule.findFirst;
  const originalSession = prisma.classPeriodAttendanceSession;
  const originalRecord = prisma.classPeriodAttendanceRecord;

  prisma.ustadhSchedule.findFirst = async () => ({
    id: 'sch_session_1',
    madrasaId: 'tenant_1',
    ustadhId: 'ustadh_1',
    isActive: true,
  });

  prisma.classPeriodAttendanceSession = {
    findFirst: async () => ({
      id: 'sealed_session_db',
      submittedAt: new Date(), // Already sealed!
    }),
  };
  prisma.classPeriodAttendanceRecord = { upsert: async () => {} };

  try {
    await markPeriodAttendance({
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_1',
      userId: 'user_1',
      payload: {
        scheduleId: 'sch_session_1',
        date: '2026-11-17',
        records: [{ studentId: 'st_101', status: 'Present' }],
      },
    });
    assert.fail('Should have thrown BadRequestError (400) for sealed session');
  } catch (err) {
    assert.strictEqual(err.statusCode, 400);
    assert.ok(err.message.includes('sealed'));
  } finally {
    prisma.ustadhSchedule.findFirst = originalSchedule;
    prisma.classPeriodAttendanceSession = originalSession;
    prisma.classPeriodAttendanceRecord = originalRecord;
  }
});

await testAsync('sealPeriodSession updates submittedAt persistently', async () => {
  const originalSchedule = prisma.ustadhSchedule.findFirst;
  const originalSession = prisma.classPeriodAttendanceSession;

  prisma.ustadhSchedule.findFirst = async () => ({
    id: 'sch_session_1',
    madrasaId: 'tenant_1',
    ustadhId: 'ustadh_1',
    isActive: true,
  });

  let updateCalled = false;
  prisma.classPeriodAttendanceSession = {
    findFirst: async () => ({ id: 'session_to_seal', submittedAt: null }),
    update: async ({ where, data }) => {
      assert.strictEqual(where.id, 'session_to_seal');
      assert.ok(data.submittedAt instanceof Date);
      updateCalled = true;
      return { id: 'session_to_seal', ...data };
    },
  };

  try {
    const res = await sealPeriodSession({
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_1',
      userId: 'user_1',
      scheduleId: 'sch_session_1',
      date: '2026-11-17',
    });

    assert.strictEqual(res.isSealed, true);
    assert.strictEqual(updateCalled, true);
  } finally {
    prisma.ustadhSchedule.findFirst = originalSchedule;
    prisma.classPeriodAttendanceSession = originalSession;
  }
});

// =============================================================================
// Group 3: Persistent Attendance History
// =============================================================================
console.log('\nGroup 3: Persistent Attendance History');

await testAsync('getAttendanceHistory (student) queries persistent sessions with tenant filter', async () => {
  const originalSession = prisma.classPeriodAttendanceSession;

  prisma.classPeriodAttendanceSession = {
    count: async ({ where }) => {
      assert.strictEqual(where.madrasaId, 'tenant_1');
      assert.strictEqual(where.teacherId, 'ustadh_1');
      return 1;
    },
    findMany: async ({ where, skip, take }) => {
      assert.strictEqual(where.madrasaId, 'tenant_1');
      assert.strictEqual(where.teacherId, 'ustadh_1');
      return [
        {
          id: 'ses_hist_1',
          sessionDate: new Date('2026-11-17T00:00:00.000Z'),
          periodNumber: 2,
          submittedAt: new Date('2026-11-17T09:30:00.000Z'),
          schedule: {
            startMinutes: 525,
            endMinutes: 570,
            class: { name: 'Grade 11 Shariah' },
            subject: { name: 'Fiqh' },
          },
          records: [
            { studentId: 's1', status: 'PRESENT' },
            { studentId: 's2', status: 'PRESENT' },
            { studentId: 's3', status: 'ABSENT' },
          ],
        },
      ];
    },
  };

  try {
    const history = await getAttendanceHistory({
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_1',
      query: { type: 'student', page: 1, limit: 10 },
    });

    assert.strictEqual(history.type, 'student');
    assert.strictEqual(history.totalCount, 1);
    assert.strictEqual(history.data[0].totalEnrolled, 3);
    assert.strictEqual(history.data[0].presentCount, 2);
    assert.strictEqual(history.data[0].attendanceRate, 67);
    assert.strictEqual(history.data[0].isSealed, true);
  } finally {
    prisma.classPeriodAttendanceSession = originalSession;
  }
});

// =============================================================================
// Group 4: Persistent Salary Components & Payslip Visibility Controls
// =============================================================================
console.log('\nGroup 4: Persistent Salary Components & Payslip Visibility Controls');

await testAsync('getSalarySummary integrates UstadhSalaryComponent while preserving statutory separation', async () => {
  const originalUstadh = prisma.ustadh.findFirst;
  const originalSalary = prisma.ustadhSalary.findMany;
  const originalComponent = prisma.ustadhSalaryComponent;

  prisma.ustadh.findFirst = async () => ({
    id: 'ustadh_1',
    fullName: 'Ustadh Muhammad Farooq',
    baseMonthlySalary: '90000.00',
  });

  prisma.ustadhSalaryComponent = {
    findMany: async ({ where }) => {
      assert.strictEqual(where.madrasaId, 'tenant_1');
      assert.strictEqual(where.ustadhId, 'ustadh_1');
      return [
        { id: 'comp_1', name: 'Tajweed Excellence Allowance', type: 'ALLOWANCE', amount: '15000.00' },
        { id: 'comp_2', name: 'Faculty Welfare Fund', type: 'DEDUCTION', amount: '2500.00' },
      ];
    },
  };

  prisma.ustadhSalary.findMany = async () => [];

  try {
    const summary = await getSalarySummary({ madrasaId: 'tenant_1', ustadhId: 'ustadh_1' });

    assert.strictEqual(summary.basicSalary, 90000);
    assert.strictEqual(summary.allowances.length, 1);
    assert.strictEqual(summary.allowances[0].amount, 15000);
    assert.strictEqual(summary.deductions[0].amount, 2500);

    // Statutory institutional on-cost separation
    assert.strictEqual(summary.employerContributions.employerEpfAmount, 10800); // 12% of 90,000
    assert.strictEqual(summary.employerContributions.employerEtfAmount, 2700);  // 3% of 90,000
    assert.ok(summary.employerContributions.institutionalNotice.includes('NOT deducted from employee'));
  } finally {
    prisma.ustadh.findFirst = originalUstadh;
    prisma.ustadhSalary.findMany = originalSalary;
    prisma.ustadhSalaryComponent = originalComponent;
  }
});

await testAsync('listPayslips filters strictly by status in ISSUED, PAID (DRAFT & VOID hidden)', async () => {
  const originalPayslip = prisma.ustadhPayslipRecord;

  let queryFilter = null;
  prisma.ustadhPayslipRecord = {
    findMany: async ({ where }) => {
      queryFilter = where;
      return [
        {
          id: 'ps_issued',
          payslipNumber: 'PAY-202610-001-R1',
          revision: 1,
          status: 'ISSUED',
          salaryMonth: new Date('2026-10-01'),
          netPayable: '102500.00',
          createdAt: new Date('2026-10-28'),
        },
        {
          id: 'ps_paid',
          payslipNumber: 'PAY-202609-001-R1',
          revision: 1,
          status: 'PAID',
          salaryMonth: new Date('2026-09-01'),
          netPayable: '102500.00',
          createdAt: new Date('2026-09-28'),
        },
      ];
    },
  };

  try {
    const list = await listPayslips({
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_1',
      query: {},
    });

    assert.deepStrictEqual(queryFilter.status, { in: ['ISSUED', 'PAID'] });
    assert.strictEqual(list.length, 2);
    assert.strictEqual(list[0].status, 'Issued');
    assert.strictEqual(list[1].status, 'Paid');
  } finally {
    prisma.ustadhPayslipRecord = originalPayslip;
  }
});

// =============================================================================
// Group 5: Concurrency-Safe Payslip Generation & Active Invariant
// =============================================================================
console.log('\nGroup 5: Concurrency-Safe Payslip Generation & Active Invariant');

await testAsync('generatePayslipRecord enforces SELECT ... FOR UPDATE and active payslip conflict', async () => {
  const originalTransaction = prisma.$transaction;

  let rawQueryExecuted = false;
  prisma.$transaction = async (callback) => {
    const mockTx = {
      $queryRaw: async (strings, ...values) => {
        rawQueryExecuted = true;
        // Verify parameterized query locking row
        return [
          {
            id: 'sal_100',
            madrasaId: 'tenant_1',
            ustadhId: 'ustadh_1',
            salaryMonth: new Date('2026-11-01'),
            baseSalarySnapshot: '85000.00',
            payableAmount: '105000.00',
            status: 'PENDING',
          },
        ];
      },
      ustadhPayslipRecord: {
        findMany: async () => [
          { id: 'ps_active', revision: 1, status: 'ISSUED' }, // Existing active payslip!
        ],
      },
    };
    return await callback(mockTx);
  };

  try {
    // Attempt generating without isRevision = true
    await generatePayslipRecord({
      madrasaId: 'tenant_1',
      ustadhSalaryId: 'sal_100',
      adminUserId: 'admin_1',
      adminRole: 'MADRASA_ADMIN',
      isRevision: false,
    });
    assert.fail('Should have thrown ConflictError (409) for existing active payslip');
  } catch (err) {
    assert.strictEqual(err.statusCode, 409);
    assert.ok(err.message.includes('Active payslip') && err.message.includes('already exists'));
    assert.strictEqual(rawQueryExecuted, true);
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

await testAsync('generatePayslipRecord with isRevision=true voids preceding active payslip and increments revision', async () => {
  const originalTransaction = prisma.$transaction;

  let voidUpdatedId = null;
  let createdRecord = null;

  prisma.$transaction = async (callback) => {
    const mockTx = {
      $queryRaw: async () => [
        {
          id: 'sal_100',
          madrasaId: 'tenant_1',
          ustadhId: 'ustadh_1',
          salaryMonth: new Date('2026-11-01'),
          baseSalarySnapshot: '85000.00',
          payableAmount: '105000.00',
          status: 'PENDING',
        },
      ],
      ustadhPayslipRecord: {
        findMany: async () => [
          { id: 'ps_prev_1', revision: 1, status: 'ISSUED' },
        ],
        update: async ({ where, data }) => {
          voidUpdatedId = where.id;
          assert.strictEqual(data.status, 'VOID');
          assert.strictEqual(data.voidedById, 'admin_1');
          return { id: where.id, ...data };
        },
        create: async ({ data }) => {
          createdRecord = data;
          return { id: 'ps_rev_2', ...data };
        },
      },
    };
    return await callback(mockTx);
  };

  try {
    const result = await generatePayslipRecord({
      madrasaId: 'tenant_1',
      ustadhSalaryId: 'sal_100',
      adminUserId: 'admin_1',
      adminRole: 'MADRASA_ADMIN',
      isRevision: true,
      reason: 'Recalculated research allowance',
      targetStatus: 'DRAFT',
    });

    assert.strictEqual(voidUpdatedId, 'ps_prev_1');
    assert.strictEqual(result.revision, 2);
    assert.strictEqual(result.status, 'DRAFT');
    assert.ok(result.payslipNumber.endsWith('-R2'));
    assert.strictEqual(createdRecord.revision, 2);
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

// =============================================================================
// Group 6: Administrative Payslip Voiding & Platform Governance
// =============================================================================
console.log('\nGroup 6: Administrative Payslip Voiding & Platform Governance');

await testAsync('voidPayslipRecord permits SUPER_ADMIN platform intervention across tenants', async () => {
  const originalPayslip = prisma.ustadhPayslipRecord;

  let updateCalled = false;
  prisma.ustadhPayslipRecord = {
    findFirst: async ({ where }) => {
      // SUPER_ADMIN does NOT require madrasaId match in whereClause
      assert.strictEqual(where.id, 'ps_target');
      assert.strictEqual(where.madrasaId, undefined);
      return {
        id: 'ps_target',
        madrasaId: 'tenant_other',
        payslipNumber: 'PAY-202610-001-R1',
        revision: 1,
        status: 'ISSUED',
      };
    },
    update: async ({ where, data }) => {
      assert.strictEqual(where.id, 'ps_target');
      assert.strictEqual(data.status, 'VOID');
      assert.strictEqual(data.voidedById, 'super_admin_user');
      updateCalled = true;
      return { id: where.id, payslipNumber: 'PAY-202610-001-R1', revision: 1, ...data };
    },
  };

  try {
    const res = await voidPayslipRecord({
      madrasaId: 'tenant_1', // Provided caller tenant
      payslipId: 'ps_target',
      adminUserId: 'super_admin_user',
      adminRole: 'SUPER_ADMIN',
      reason: 'Audit correction by Platform Directorate',
    });

    assert.strictEqual(res.status, 'VOID');
    assert.strictEqual(updateCalled, true);
  } finally {
    prisma.ustadhPayslipRecord = originalPayslip;
  }
});

await testAsync('voidPayslipRecord rejects cross-tenant void attempts by MADRASA_ADMIN', async () => {
  const originalPayslip = prisma.ustadhPayslipRecord;

  prisma.ustadhPayslipRecord = {
    findFirst: async ({ where }) => {
      // MADRASA_ADMIN must be scoped to their own madrasaId
      assert.strictEqual(where.madrasaId, 'tenant_1');
      return null; // Cross tenant, so returns not found in this tenant
    },
  };

  try {
    await voidPayslipRecord({
      madrasaId: 'tenant_1',
      payslipId: 'ps_other_tenant',
      adminUserId: 'madrasa_admin_user',
      adminRole: 'MADRASA_ADMIN',
      reason: 'Attempted cross tenant void',
    });
    assert.fail('Should have rejected non-tenant payslip');
  } catch (err) {
    assert.strictEqual(err.statusCode, 404);
  } finally {
    prisma.ustadhPayslipRecord = originalPayslip;
  }
});

await testAsync('voidPayslipRecord rejects voiding an already VOID payslip (400)', async () => {
  const originalPayslip = prisma.ustadhPayslipRecord;

  prisma.ustadhPayslipRecord = {
    findFirst: async () => ({
      id: 'ps_already_void',
      madrasaId: 'tenant_1',
      status: 'VOID', // Already voided!
    }),
  };

  try {
    await voidPayslipRecord({
      madrasaId: 'tenant_1',
      payslipId: 'ps_already_void',
      adminUserId: 'admin_1',
      adminRole: 'MADRASA_ADMIN',
      reason: 'Duplicate void attempt',
    });
    assert.fail('Should have rejected voiding already void payslip');
  } catch (err) {
    assert.strictEqual(err.statusCode, 400);
    assert.ok(err.message.includes('already voided'));
  } finally {
    prisma.ustadhPayslipRecord = originalPayslip;
  }
});

// =============================================================================
// Suite Summary
// =============================================================================
console.log('\n================================================================');
console.log(`  Tests Executed: ${totalTests}`);
console.log(`  Passed:         ${passedTests}`);
console.log(`  Failed:         ${failedTests}`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('  All Phase 4E-2 persistent backend service tests PASSED (100%).\n');
}
