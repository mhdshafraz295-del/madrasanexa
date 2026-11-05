import { prisma } from '../src/lib/prisma.js';
import {
  formatDateOnly,
  formatTime,
  formatDateTime,
  isValidTimezone,
  isValidTimeString,
  timeStringToMinutes,
} from '../src/utils/dateTime.js';
import { updateSettingsSchema } from '../src/validations/madrasa-admin.validation.js';
import { getMadrasaSettings, updateMadrasaSettings } from '../src/services/madrasa-admin.service.js';

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

async function runTests() {
  console.log('\n======================================================');
  console.log('  MADRASANEXA V2: DATE & TIME CONFIGURATION TEST SUITE');
  console.log('======================================================\n');

  // -------------------------------------------------------------------------
  // 1. Timezone Validation & Helpers
  // -------------------------------------------------------------------------
  console.log('--- 1. Timezone Validation Tests ---');
  assert(isValidTimezone('Asia/Colombo') === true, 'Asia/Colombo is recognized as valid IANA timezone');
  assert(isValidTimezone('Asia/Kolkata') === true, 'Asia/Kolkata is recognized as valid IANA timezone');
  assert(isValidTimezone('Asia/Riyadh') === true, 'Asia/Riyadh is recognized as valid IANA timezone');
  assert(isValidTimezone('UTC') === true, 'UTC is recognized as valid IANA timezone');
  assert(isValidTimezone('Invalid/Not_A_Timezone_123') === false, 'Invalid timezone string is rejected');
  assert(isValidTimezone('') === false, 'Empty timezone string is rejected');
  assert(isValidTimezone(null) === false, 'Null timezone is safely handled');

  // -------------------------------------------------------------------------
  // 2. Date-Only Data Safety (Zero Calendar Date Shift)
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Date-Only Safety Tests ---');
  const sampleIsoDate = '2026-10-30';
  assert(formatDateOnly(sampleIsoDate, 'DD/MM/YYYY') === '30/10/2026', 'formatDateOnly correctly formats DD/MM/YYYY');
  assert(formatDateOnly(sampleIsoDate, 'MM/DD/YYYY') === '10/30/2026', 'formatDateOnly correctly formats MM/DD/YYYY');
  assert(formatDateOnly(sampleIsoDate, 'YYYY-MM-DD') === '2026-10-30', 'formatDateOnly correctly formats YYYY-MM-DD');

  // Verify Date object from MySQL @db.Date (UTC midnight) does NOT shift calendar date
  const dbDateObj = new Date('2026-10-30T00:00:00.000Z');
  assert(formatDateOnly(dbDateObj, 'DD/MM/YYYY') === '30/10/2026', 'DB Date object preserves exact calendar day in DD/MM/YYYY');
  assert(formatDateOnly(dbDateObj, 'YYYY-MM-DD') === '2026-10-30', 'DB Date object preserves exact calendar day in YYYY-MM-DD');

  // -------------------------------------------------------------------------
  // 3. Time Formatting (12-Hour vs 24-Hour)
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Time Formatting Tests ---');
  assert(isValidTimeString('07:30') === true, '"07:30" is a valid 24h time string');
  assert(isValidTimeString('23:59') === true, '"23:59" is a valid 24h time string');
  assert(isValidTimeString('24:00') === false, '"24:00" is rejected');
  assert(isValidTimeString('7:30') === false, '"7:30" without leading zero is rejected');

  assert(timeStringToMinutes('07:30') === 450, '07:30 converts to 450 minutes from midnight');
  assert(timeStringToMinutes('16:30') === 990, '16:30 converts to 990 minutes from midnight');

  assert(formatTime('07:30', '12_HOUR') === '07:30 AM', '07:30 formats to 07:30 AM');
  assert(formatTime('16:45', '12_HOUR') === '04:45 PM', '16:45 formats to 04:45 PM');
  assert(formatTime('12:00', '12_HOUR') === '12:00 PM', '12:00 formats to 12:00 PM (noon)');
  assert(formatTime('00:15', '12_HOUR') === '12:15 AM', '00:15 formats to 12:15 AM (midnight)');
  assert(formatTime('16:45', '24_HOUR') === '16:45', '16:45 formats to 16:45 in 24_HOUR mode');

  // -------------------------------------------------------------------------
  // 4. Zod Schema Validation & Logical Rules
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Schema Validation & Logical Rules Tests ---');
  const validPayload = {
    timezone: 'Asia/Colombo',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12_HOUR',
    workingHoursStart: '07:30',
    workingHoursEnd: '16:30',
    workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
    weeklyHolidays: ['SUNDAY'],
    attendanceStartTime: '07:30',
    lateMarkingTime: '08:00',
    attendanceClosingTime: '08:30',
    attendanceGracePeriodMinutes: 15,
    autoAttendanceClosing: false,
    timetableSlotDurationMinutes: 45,
  };

  const validResult = updateSettingsSchema.safeParse(validPayload);
  assert(validResult.success === true, 'Valid settings payload passes schema validation');

  // Reject workingHoursStart >= workingHoursEnd
  const invalidWorkingHours = updateSettingsSchema.safeParse({
    workingHoursStart: '16:30',
    workingHoursEnd: '07:30',
  });
  assert(invalidWorkingHours.success === false, 'Rejects workingHoursStart >= workingHoursEnd');

  // Reject attendance timings where lateMarkingTime < attendanceStartTime
  const invalidAttendanceOrder = updateSettingsSchema.safeParse({
    attendanceStartTime: '08:30',
    lateMarkingTime: '07:30',
  });
  assert(invalidAttendanceOrder.success === false, 'Rejects lateMarkingTime < attendanceStartTime');

  // Reject attendanceClosingTime < lateMarkingTime
  const invalidClosingOrder = updateSettingsSchema.safeParse({
    lateMarkingTime: '08:30',
    attendanceClosingTime: '08:00',
  });
  assert(invalidClosingOrder.success === false, 'Rejects attendanceClosingTime < lateMarkingTime');

  // Reject overlapping working days and holidays
  const overlappingDays = updateSettingsSchema.safeParse({
    workingDays: ['MONDAY', 'FRIDAY', 'SUNDAY'],
    weeklyHolidays: ['SUNDAY'],
  });
  assert(overlappingDays.success === false, 'Rejects days listed as both working days and holidays');

  // Reject invalid timezone in update schema
  const invalidTz = updateSettingsSchema.safeParse({
    timezone: 'Moon/Base_Alpha',
  });
  assert(invalidTz.success === false, 'Rejects invalid timezone identifier in updateSettingsSchema');

  // -------------------------------------------------------------------------
  // 5. Database Integration & Multi-Tenant Isolation
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Database Integration & Multi-Tenant Tests ---');
  // Find an existing active madrasa to test settings service
  const existingMadrasa = await prisma.madrasa.findFirst({
    where: { status: 'ACTIVE' },
  });

  if (existingMadrasa) {
    const madrasaId = existingMadrasa.id;

    // Fetch initial settings
    const initial = await getMadrasaSettings(madrasaId);
    assert(initial && initial.settings, 'getMadrasaSettings retrieves settings object');
    assert(initial.settings.timezone === 'Asia/Colombo', 'Default timezone is preserved as Asia/Colombo');
    assert(initial.settings.dateFormat === 'DD/MM/YYYY', 'Default date format is DD/MM/YYYY');
    assert(initial.settings.timeFormat === '12_HOUR', 'Default time format is 12_HOUR');

    // Update settings via service
    const updated = await updateMadrasaSettings(madrasaId, {
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '24_HOUR',
      workingHoursStart: '08:00',
      workingHoursEnd: '17:00',
      attendanceStartTime: '08:00',
      lateMarkingTime: '08:15',
      attendanceClosingTime: '09:00',
      attendanceGracePeriodMinutes: 20,
      timetableSlotDurationMinutes: 50,
    });

    assert(updated.settings.dateFormat === 'YYYY-MM-DD', 'Updated dateFormat persisted in database');
    assert(updated.settings.timeFormat === '24_HOUR', 'Updated timeFormat persisted in database');
    assert(updated.settings.workingHoursStart === '08:00', 'Updated workingHoursStart persisted');
    assert(updated.settings.timetableSlotDurationMinutes === 50, 'Updated timetableSlotDurationMinutes persisted');

    // Verify ActivityLog entry was recorded
    const auditLog = await prisma.activityLog.findFirst({
      where: {
        madrasaId,
        action: 'MADRASA_SETTINGS_UPDATED',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(auditLog !== null, 'ActivityLog created for MADRASA_SETTINGS_UPDATED');
    assert(auditLog?.metadata?.updatedSettingFields?.includes('dateFormat'), 'Audit log contains updated setting fields');

    // Revert settings back to clean institutional defaults
    await updateMadrasaSettings(madrasaId, {
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12_HOUR',
      workingHoursStart: '07:30',
      workingHoursEnd: '16:30',
      attendanceStartTime: '07:30',
      lateMarkingTime: '08:00',
      attendanceClosingTime: '08:30',
      attendanceGracePeriodMinutes: 15,
      timetableSlotDurationMinutes: 45,
    });
    console.log('  ✓ Reverted test settings back to original clean defaults.');
  } else {
    console.log('  [SKIP] No active madrasa found for database integration check.');
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`TOTAL TESTS: ${testPassedCount + testFailedCount}`);
  console.log(`PASSED: ${testPassedCount}`);
  console.log(`FAILED: ${testFailedCount}`);
  console.log('======================================================\n');

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error('Fatal test execution error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
