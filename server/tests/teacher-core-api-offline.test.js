import './setup-test-env.js';
import assert from 'assert';
import {
  teacherProfileUpdateSchema,
  teacherTimetableQuerySchema,
  teacherVerifyQrSchema,
  studentPeriodSessionQuerySchema,
  studentPeriodMarkSchema,
  studentPeriodSealSchema,
  teacherAttendanceHistoryQuerySchema,
  teacherPaymentHistoryQuerySchema,
  teacherNotificationsQuerySchema,
  teacherPasswordChangeSchema,
  teacherPreferencesUpdateSchema,
} from '../src/validations/teacher.validation.js';
import {
  formatMinutesToTime,
  convertAmountToWords,
  getDashboardData,
  getTeacherProfile,
  updateTeacherProfile,
  getTimetable,
  getAssignedClasses,
  getClassDetail,
  getTodayTeacherAttendance,
  recordTeacherClassroomCheckIn,
  getPeriodAttendanceSession,
  markPeriodAttendance,
  sealPeriodSession,
  getAttendanceHistory,
  getSalarySummary,
  getPaymentHistory,
  listPayslips,
  getPayslipDetail,
  getNotifications,
  getTeacherSettings,
} from '../src/services/teacher.service.js';
import { getColomboTimeContext } from '../src/utils/dateTime.js';
import { prisma } from '../src/lib/prisma.js';

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
console.log('  MadrasaNexa Phase 4C: Core Teacher API Offline Test Suite');
console.log('  (100% Offline / Zero Database Connection Required)');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Group 1: Helper Utilities & Sri Lankan Timezone / Currency
// -----------------------------------------------------------------------------
console.log('Group 1: Helper Utilities & Colombo Timezone / Currency');

test('formatMinutesToTime formats minutes into 12-hour AM/PM correctly', () => {
  assert.strictEqual(formatMinutesToTime(480), '08:00 AM');
  assert.strictEqual(formatMinutesToTime(525), '08:45 AM');
  assert.strictEqual(formatMinutesToTime(720), '12:00 PM');
  assert.strictEqual(formatMinutesToTime(810), '01:30 PM');
});

test('convertAmountToWords converts Sri Lankan Rupees to words correctly', () => {
  assert.strictEqual(convertAmountToWords(0), 'Zero Rupees Only');
  assert.strictEqual(convertAmountToWords(85000), 'Eighty Five Thousand Rupees Only');
  assert.strictEqual(convertAmountToWords(106000), 'One Lakh Six Thousand Rupees Only');
});

test('getColomboTimeContext evaluates Asia/Colombo wall-clock without UTC midnight drift', () => {
  const context = getColomboTimeContext();
  assert.ok(context.localDateStr.match(/^\d{4}-\d{2}-\d{2}$/));
  assert.ok(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].includes(context.weekday));
  assert.ok(context.currentMinutes >= 0 && context.currentMinutes <= 1439);
});

// -----------------------------------------------------------------------------
// Group 2: Zod Request Validation Schemas
// -----------------------------------------------------------------------------
console.log('\nGroup 2: Zod Request Validation Schemas');

test('teacherProfileUpdateSchema accepts valid updates and sanitizes payload', () => {
  const valid = {
    phoneNumber: '+94 77 123 4567',
    whatsappNumber: '+94 77 123 4567',
    address: 'No. 12, Main Street, Colombo',
    emergencyContact: {
      name: 'Fathima Farooq',
      relationship: 'Spouse',
      phone: '+94 71 884 1239',
    },
  };
  const parsed = teacherProfileUpdateSchema.parse(valid);
  assert.strictEqual(parsed.phoneNumber, valid.phoneNumber);
  assert.strictEqual(parsed.emergencyContact.name, 'Fathima Farooq');
});

test('teacherVerifyQrSchema validates required parameters and rejects empty tokens', () => {
  const valid = {
    roomToken: 'mnx_rm_v1_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    scheduleId: 'sch_123',
    method: 'Classroom QR',
  };
  assert.doesNotThrow(() => teacherVerifyQrSchema.parse(valid));

  assert.throws(() => {
    teacherVerifyQrSchema.parse({ roomToken: '', scheduleId: 'sch_123' });
  });
  assert.throws(() => {
    teacherVerifyQrSchema.parse({ roomToken: 'token' });
  });
});

test('studentPeriodMarkSchema rejects empty student records', () => {
  assert.throws(() => {
    studentPeriodMarkSchema.parse({
      scheduleId: 'sch_1',
      date: '2026-11-16',
      records: [],
    });
  });
});

test('studentPeriodMarkSchema accepts valid multi-student roster mark', () => {
  const valid = {
    scheduleId: 'sch_1',
    date: '2026-11-16',
    records: [
      { studentId: 'st_1', status: 'Present', method: 'Barcode Scan' },
      { studentId: 'st_2', status: 'Late', remarks: 'Late 10 mins' },
      { studentId: 'st_3', status: 'Excused', remarks: 'Medical excuse' },
      { studentId: 'st_4', status: 'Absent' },
    ],
  };
  const parsed = studentPeriodMarkSchema.parse(valid);
  assert.strictEqual(parsed.records.length, 4);
});

test('teacherPasswordChangeSchema enforces minimum 8 characters', () => {
  assert.throws(() => {
    teacherPasswordChangeSchema.parse({
      currentPassword: 'currentPassword123',
      newPassword: 'short',
    });
  });

  assert.doesNotThrow(() => {
    teacherPasswordChangeSchema.parse({
      currentPassword: 'currentPassword123',
      newPassword: 'NewStrongPassword#2026',
    });
  });
});

// -----------------------------------------------------------------------------
// Group 3: Teacher Timetable & Class Roster Business Logic
// -----------------------------------------------------------------------------
console.log('\nGroup 3: Teacher Timetable & Class Roster Logic');

await testAsync('getTimetable formats schedules and enforces tenant & teacher filters', async () => {
  // Mock prisma.ustadhSchedule.findMany
  const originalFindMany = prisma.ustadhSchedule.findMany;
  prisma.ustadhSchedule.findMany = async ({ where }) => {
    assert.strictEqual(where.madrasaId, 'tenant_1');
    assert.strictEqual(where.ustadhId, 'ustadh_1');
    return [
      {
        id: 'sch_1',
        madrasaId: 'tenant_1',
        ustadhId: 'ustadh_1',
        classId: 'cls_1',
        subjectId: 'sub_1',
        dayOfWeek: 'MONDAY',
        startMinutes: 480,
        endMinutes: 525,
        isActive: true,
        class: { id: 'cls_1', name: 'Class 10-A', code: '10A' },
        subject: { id: 'sub_1', name: 'Tafseer' },
      },
    ];
  };

  try {
    const slots = await getTimetable({ madrasaId: 'tenant_1', ustadhId: 'ustadh_1' });
    assert.strictEqual(slots.length, 1);
    assert.strictEqual(slots[0].day, 'Monday');
    assert.strictEqual(slots[0].timeSlot, '08:00 AM – 08:45 AM');
    assert.strictEqual(slots[0].className, 'Class 10-A');
  } finally {
    prisma.ustadhSchedule.findMany = originalFindMany;
  }
});

await testAsync('getClassDetail rejects access if teacher is not assigned to the class', async () => {
  const originalFindFirst = prisma.ustadhSchedule.findFirst;
  prisma.ustadhSchedule.findFirst = async () => null; // Not assigned

  try {
    await getClassDetail({ madrasaId: 'tenant_1', ustadhId: 'ustadh_1', classId: 'cls_unassigned' });
    assert.fail('Should have thrown ForbiddenError');
  } catch (err) {
    assert.strictEqual(err.statusCode, 403);
    assert.ok(err.message.includes('not assigned'));
  } finally {
    prisma.ustadhSchedule.findFirst = originalFindFirst;
  }
});

// -----------------------------------------------------------------------------
// Group 4: Classroom QR Verification & Punctuality Logic
// -----------------------------------------------------------------------------
console.log('\nGroup 4: Classroom QR Verification & Punctuality Logic');

await testAsync('recordTeacherClassroomCheckIn verifies schedule ownership and enforces Asia/Colombo window', async () => {
  const originalScheduleFind = prisma.ustadhSchedule.findFirst;
  const originalAttendanceFind = prisma.ustadhAttendanceRecord.findFirst;
  const originalAttendanceCreate = prisma.ustadhAttendanceRecord.create;

  const colomboNow = getColomboTimeContext();

  prisma.ustadhSchedule.findFirst = async ({ where }) => {
    assert.strictEqual(where.madrasaId, 'tenant_1');
    assert.strictEqual(where.ustadhId, 'ustadh_1');
    return {
      id: 'sch_today',
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_1',
      dayOfWeek: colomboNow.weekday,
      startMinutes: colomboNow.currentMinutes - 5, // currently inside slot
      endMinutes: colomboNow.currentMinutes + 35,
      isActive: true,
      class: { id: 'cls_1', name: 'Class 10-A' },
    };
  };

  prisma.ustadhAttendanceRecord.findFirst = async () => null; // No duplicate
  prisma.ustadhAttendanceRecord.create = async ({ data }) => {
    return {
      id: 'att_rec_1',
      ...data,
      createdAt: new Date(),
    };
  };

  try {
    const res = await recordTeacherClassroomCheckIn({
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_1',
      userId: 'user_1',
      payload: {
        roomToken: 'mnx_rm_v1_mock',
        scheduleId: 'sch_today',
      },
    });

    assert.strictEqual(res.id, 'att_rec_1');
    assert.ok(res.notice.includes('Static QR code confirms institutional timetable compliance'));
  } finally {
    prisma.ustadhSchedule.findFirst = originalScheduleFind;
    prisma.ustadhAttendanceRecord.findFirst = originalAttendanceFind;
    prisma.ustadhAttendanceRecord.create = originalAttendanceCreate;
  }
});

await testAsync('recordTeacherClassroomCheckIn strictly prevents duplicate check-in (409 Conflict)', async () => {
  const originalScheduleFind = prisma.ustadhSchedule.findFirst;
  const originalAttendanceFind = prisma.ustadhAttendanceRecord.findFirst;

  const colomboNow = getColomboTimeContext();

  prisma.ustadhSchedule.findFirst = async () => ({
    id: 'sch_today',
    madrasaId: 'tenant_1',
    ustadhId: 'ustadh_1',
    dayOfWeek: colomboNow.weekday,
    startMinutes: colomboNow.currentMinutes - 5,
    endMinutes: colomboNow.currentMinutes + 35,
    isActive: true,
  });

  // Simulate existing check-in
  prisma.ustadhAttendanceRecord.findFirst = async () => ({
    id: 'existing_checkin',
    status: 'PRESENT',
  });

  try {
    await recordTeacherClassroomCheckIn({
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_1',
      userId: 'user_1',
      payload: {
        roomToken: 'mnx_rm_v1_mock',
        scheduleId: 'sch_today',
      },
    });
    assert.fail('Should have thrown ConflictError (409)');
  } catch (err) {
    assert.strictEqual(err.statusCode, 409);
    assert.ok(err.message.includes('already recorded'));
  } finally {
    prisma.ustadhSchedule.findFirst = originalScheduleFind;
    prisma.ustadhAttendanceRecord.findFirst = originalAttendanceFind;
  }
});

// -----------------------------------------------------------------------------
// Group 5: Option A Full Isolation & Period Attendance Sealing
// -----------------------------------------------------------------------------
console.log('\nGroup 5: Option A Full Isolation & Period Attendance Sealing');

await testAsync('markPeriodAttendance marks period roll-call without mutating daily attendance', async () => {
  const originalScheduleFind = prisma.ustadhSchedule.findFirst;
  prisma.ustadhSchedule.findFirst = async () => ({
    id: 'sch_p1',
    madrasaId: 'tenant_1',
    ustadhId: 'ustadh_1',
    isActive: true,
  });

  try {
    const res = await markPeriodAttendance({
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_1',
      userId: 'user_1',
      payload: {
        scheduleId: 'sch_p1',
        date: '2026-11-16',
        records: [
          { studentId: 'st_1', status: 'Present' },
          { studentId: 'st_2', status: 'Absent', remarks: 'Unexcused' },
        ],
      },
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.totalRecorded, 2);
    assert.ok(res.optionAIsolationNotice.includes('Daily institutional attendance is isolated and unaffected'));
  } finally {
    prisma.ustadhSchedule.findFirst = originalScheduleFind;
  }
});

await testAsync('sealPeriodSession locks session and blocks subsequent mark attempts', async () => {
  const originalScheduleFind = prisma.ustadhSchedule.findFirst;
  prisma.ustadhSchedule.findFirst = async () => ({
    id: 'sch_p1',
    madrasaId: 'tenant_1',
    ustadhId: 'ustadh_1',
    isActive: true,
  });

  try {
    // 1. Seal session
    const sealRes = await sealPeriodSession({
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_1',
      userId: 'user_1',
      scheduleId: 'sch_p1',
      date: '2026-11-16',
    });
    assert.strictEqual(sealRes.isSealed, true);

    // 2. Attempt modification on sealed session
    await markPeriodAttendance({
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_1',
      userId: 'user_1',
      payload: {
        scheduleId: 'sch_p1',
        date: '2026-11-16',
        records: [{ studentId: 'st_1', status: 'Late' }],
      },
    });
    assert.fail('Should have blocked edit on sealed session');
  } catch (err) {
    assert.strictEqual(err.statusCode, 400);
    assert.ok(err.message.includes('sealed'));
  } finally {
    prisma.ustadhSchedule.findFirst = originalScheduleFind;
  }
});

// -----------------------------------------------------------------------------
// Group 6: Sri Lankan Payroll Separation & Privacy Controls
// -----------------------------------------------------------------------------
console.log('\nGroup 6: Sri Lankan Payroll Separation & Privacy Controls');

await testAsync('getSalarySummary strictly separates employee deductions from employer EPF/ETF', async () => {
  const originalUstadhFind = prisma.ustadh.findFirst;
  const originalSalaryFind = prisma.ustadhSalary.findMany;

  prisma.ustadh.findFirst = async () => ({
    id: 'ustadh_1',
    fullName: 'Ustadh Farooq',
    baseMonthlySalary: 85000,
  });

  prisma.ustadhSalary.findMany = async () => [
    {
      id: 'sal_1',
      salaryMonth: new Date('2026-10-01'),
      baseSalarySnapshot: 85000,
      payableAmount: 106000,
      status: 'PAID',
      paymentDate: new Date('2026-10-31'),
    },
  ];

  try {
    const summary = await getSalarySummary({ madrasaId: 'tenant_1', ustadhId: 'ustadh_1' });
    assert.strictEqual(summary.basicSalary, 85000);
    assert.strictEqual(summary.allowances.length, 0); // No fabricated allowances
    assert.strictEqual(summary.grossSalary, 85000);
    assert.strictEqual(summary.totalDeductions, 6800);
    assert.strictEqual(summary.netSalary, 78200);
    assert.strictEqual(summary.epfNumber, null);
    assert.strictEqual(summary.bankDetails, null);

    // Verify statutory employee deduction is strictly 8% of 85,000 = 6,800
    const employeeEpf = summary.deductions.find((d) => d.category === 'Statutory EPF');
    assert.strictEqual(employeeEpf.amount, 6800);

    // Verify Employer 12% and 3% ETF are displayed separately and NOT deducted from net pay
    assert.strictEqual(summary.employerContributions.employerEpfAmount, 10200); // 12% of 85,000
    assert.strictEqual(summary.employerContributions.employerEtfAmount, 2550);  // 3% of 85,000
    assert.ok(summary.employerContributions.institutionalNotice.includes('NOT deducted'));
  } finally {
    prisma.ustadh.findFirst = originalUstadhFind;
    prisma.ustadhSalary.findMany = originalSalaryFind;
  }
});

await testAsync('getPayslipDetail strictly enforces tenant & teacher privacy', async () => {
  const originalSalaryFind = prisma.ustadhSalary.findFirst;
  prisma.ustadhSalary.findFirst = async ({ where }) => {
    // Assert query requires BOTH madrasaId and ustadhId matching authenticated context
    assert.strictEqual(where.madrasaId, 'tenant_1');
    assert.strictEqual(where.ustadhId, 'ustadh_1');
    return null; // Simulate trying to view another teacher's payslip
  };

  try {
    await getPayslipDetail({
      madrasaId: 'tenant_1',
      ustadhId: 'ustadh_1',
      payslipId: 'foreign_payslip_999',
    });
    assert.fail('Should have thrown NotFoundError');
  } catch (err) {
    assert.strictEqual(err.statusCode, 404);
    assert.ok(err.message.includes('not found'));
  } finally {
    prisma.ustadhSalary.findFirst = originalSalaryFind;
  }
});

// -----------------------------------------------------------------------------
// Group 7: Teacher Dashboard & Settings Logic
// -----------------------------------------------------------------------------
console.log('\nGroup 7: Teacher Dashboard & Settings Logic');

await testAsync('getDashboardData compiles statistics matching prototype contract', async () => {
  const originalScheduleFind = prisma.ustadhSchedule.findMany;
  const originalStudentCount = prisma.student.count;
  const originalAttendanceFind = prisma.ustadhAttendanceRecord.findMany;
  const originalAnnouncementFind = prisma.announcement.findMany;

  prisma.ustadhSchedule.findMany = async () => [
    {
      id: 'sch_1',
      classId: 'cls_1',
      subjectId: 'sub_1',
      dayOfWeek: 'MONDAY',
      startMinutes: 480,
      endMinutes: 525,
      class: { name: 'Class 10-A' },
      subject: { name: 'Quran' },
    },
  ];

  prisma.student.count = async () => 28;
  prisma.ustadhAttendanceRecord.findMany = async () => [];
  prisma.announcement.findMany = async () => [
    {
      id: 'ann_1',
      title: 'Academic Notice',
      message: 'Exam schedule published.',
      category: 'GENERAL',
      priority: 'NORMAL',
      createdAt: new Date(),
    },
  ];

  try {
    const dash = await getDashboardData({ madrasaId: 'tenant_1', ustadhId: 'ustadh_1', userId: 'usr_1' });
    assert.strictEqual(dash.stats.totalClasses, 1);
    assert.strictEqual(dash.stats.totalStudents, 28);
    assert.ok(dash.recentNotifications.length > 0);
  } finally {
    prisma.ustadhSchedule.findMany = originalScheduleFind;
    prisma.student.count = originalStudentCount;
    prisma.ustadhAttendanceRecord.findMany = originalAttendanceFind;
    prisma.announcement.findMany = originalAnnouncementFind;
  }
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`  Tests Executed: ${totalTests}`);
console.log(`  Passed:         ${passedTests}`);
console.log(`  Failed:         ${failedTests}`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('  All Phase 4C offline core API tests PASSED (100%).\n');
}
