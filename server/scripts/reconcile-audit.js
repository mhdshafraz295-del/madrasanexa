import { prisma } from '../src/lib/prisma.js';

async function auditAllMigrations() {
  console.log('================================================================');
  console.log('   MADRASANEXA v2 — HISTORICAL MIGRATION RECONCILIATION AUDIT   ');
  console.log('================================================================\n');

  const results = {};

  // Helper functions
  const checkTable = async (tableName) => {
    const rows = await prisma.$queryRawUnsafe(`SHOW TABLES LIKE '${tableName}'`);
    return rows.length > 0;
  };

  const getColumns = async (tableName) => {
    try {
      const rows = await prisma.$queryRawUnsafe(`DESCRIBE \`${tableName}\``);
      return rows;
    } catch (e) {
      return [];
    }
  };

  const getIndexes = async (tableName) => {
    try {
      const rows = await prisma.$queryRawUnsafe(`SHOW INDEX FROM \`${tableName}\``);
      return rows;
    } catch (e) {
      return [];
    }
  };

  const getForeignKeys = async (tableName) => {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' AND REFERENCED_TABLE_NAME IS NOT NULL`
      );
      return rows;
    } catch (e) {
      return [];
    }
  };

  // -------------------------------------------------------------
  // MIGRATION 1: 20260919213000_add_teaching_staff_type
  // -------------------------------------------------------------
  console.log('[Migration 1] 20260919213000_add_teaching_staff_type');
  const ustadhCols = await getColumns('ustadhs');
  const staffTypeCol = ustadhCols.find(c => c.Field === 'staffType');
  const ustadhIndexes = await getIndexes('ustadhs');
  const staffTypeIdx = ustadhIndexes.find(i => i.Key_name === 'ustadhs_madrasaId_staffType_idx');
  results['20260919213000_add_teaching_staff_type'] = {
    expected: 'ALTER TABLE ustadhs ADD COLUMN staffType; INDEX ustadhs_madrasaId_staffType_idx',
    columnFound: !!staffTypeCol,
    columnDetails: staffTypeCol ? `${staffTypeCol.Type}, default: ${staffTypeCol.Default}` : null,
    indexFound: !!staffTypeIdx,
    status: (staffTypeCol && staffTypeIdx) ? 'FULLY_APPLIED' : 'PARTIALLY_APPLIED'
  };

  // -------------------------------------------------------------
  // MIGRATION 2: 20260919223000_add_timetable_breaks
  // -------------------------------------------------------------
  console.log('[Migration 2] 20260919223000_add_timetable_breaks');
  const tbExists = await checkTable('timetable_breaks');
  const tbCols = tbExists ? await getColumns('timetable_breaks') : [];
  const tbIndexes = tbExists ? await getIndexes('timetable_breaks') : [];
  const tbFks = tbExists ? await getForeignKeys('timetable_breaks') : [];
  results['20260919223000_add_timetable_breaks'] = {
    expected: 'CREATE TABLE timetable_breaks (13 cols), 3 indexes, 2 FKs (madrasas, classes)',
    tableExists: tbExists,
    columnCount: tbCols.length,
    columns: tbCols.map(c => c.Field),
    indexes: [...new Set(tbIndexes.map(i => i.Key_name))],
    fks: tbFks.map(f => `${f.CONSTRAINT_NAME} (${f.COLUMN_NAME} -> ${f.REFERENCED_TABLE_NAME}.${f.REFERENCED_COLUMN_NAME})`),
    status: (tbExists && tbCols.length === 13 && tbFks.length >= 2) ? 'FULLY_APPLIED' : 'PARTIALLY_APPLIED'
  };

  // -------------------------------------------------------------
  // MIGRATION 3: 20260921074500_add_expense_analysis
  // -------------------------------------------------------------
  console.log('[Migration 3] 20260921074500_add_expense_analysis');
  const ecExists = await checkTable('expense_categories');
  const expExists = await checkTable('expenses');
  const ebExists = await checkTable('expense_budgets');
  const emiExists = await checkTable('expense_monthly_insights');
  const expFks = expExists ? await getForeignKeys('expenses') : [];
  results['20260921074500_add_expense_analysis'] = {
    expected: '4 tables: expense_categories, expenses, expense_budgets, expense_monthly_insights + FKs',
    tablesFound: { expense_categories: ecExists, expenses: expExists, expense_budgets: ebExists, expense_monthly_insights: emiExists },
    expensesFks: expFks.map(f => `${f.CONSTRAINT_NAME} (${f.COLUMN_NAME} -> ${f.REFERENCED_TABLE_NAME})`),
    status: (ecExists && expExists && ebExists && emiExists) ? 'FULLY_APPLIED' : 'PARTIALLY_APPLIED'
  };

  // -------------------------------------------------------------
  // MIGRATION 4: 20260921170000_add_automatic_notification_engine
  // -------------------------------------------------------------
  console.log('[Migration 4] 20260921170000_add_automatic_notification_engine');
  const studentCols = await getColumns('students');
  const guardianEmailCol = studentCols.find(c => c.Field === 'guardianEmail');
  const msCols = await getColumns('madrasa_settings');
  const autoFeePaymentSms = msCols.find(c => c.Field === 'autoFeePaymentSmsEnabled');
  const feeReminderSendTime = msCols.find(c => c.Field === 'feeReminderSendTime');
  const njExists = await checkTable('notification_jobs');
  const tpExists = await checkTable('timetable_publications');
  results['20260921170000_add_automatic_notification_engine'] = {
    expected: 'students.guardianEmail, 8 cols on madrasa_settings, notification_jobs, timetable_publications',
    studentGuardianEmail: !!guardianEmailCol,
    madrasaSettingsColsFound: !!(autoFeePaymentSms && feeReminderSendTime),
    notificationJobsExists: njExists,
    timetablePublicationsExists: tpExists,
    status: (guardianEmailCol && autoFeePaymentSms && njExists && tpExists) ? 'FULLY_APPLIED' : 'PARTIALLY_APPLIED'
  };

  // -------------------------------------------------------------
  // MIGRATION 5: 20261005133000_add_madrasa_email_settings
  // -------------------------------------------------------------
  console.log('[Migration 5] 20261005133000_add_madrasa_email_settings');
  const mesExists = await checkTable('madrasa_email_settings');
  const mesCols = mesExists ? await getColumns('madrasa_email_settings') : [];
  const mesFks = mesExists ? await getForeignKeys('madrasa_email_settings') : [];
  results['20261005133000_add_madrasa_email_settings'] = {
    expected: 'CREATE TABLE madrasa_email_settings (18 cols) + FK to madrasas',
    tableExists: mesExists,
    columnCount: mesCols.length,
    fks: mesFks.map(f => `${f.CONSTRAINT_NAME} (${f.COLUMN_NAME} -> ${f.REFERENCED_TABLE_NAME})`),
    status: (mesExists && mesCols.length === 18) ? 'FULLY_APPLIED' : 'PARTIALLY_APPLIED'
  };

  // -------------------------------------------------------------
  // MIGRATION 6: 20261006153000_add_about_us_translations
  // -------------------------------------------------------------
  console.log('[Migration 6] 20261006153000_add_about_us_translations');
  const autExists = await checkTable('about_us_translations');
  const autCols = autExists ? await getColumns('about_us_translations') : [];
  const autFks = autExists ? await getForeignKeys('about_us_translations') : [];
  results['20261006153000_add_about_us_translations'] = {
    expected: 'CREATE TABLE about_us_translations (15 cols) + FK to about_us',
    tableExists: autExists,
    columnCount: autCols.length,
    fks: autFks.map(f => `${f.CONSTRAINT_NAME} (${f.COLUMN_NAME} -> ${f.REFERENCED_TABLE_NAME})`),
    status: (autExists && autCols.length === 15) ? 'FULLY_APPLIED' : 'PARTIALLY_APPLIED'
  };

  // -------------------------------------------------------------
  // MIGRATION 7: 20261016190000_add_student_records_and_followup_system
  // -------------------------------------------------------------
  console.log('[Migration 7] 20261016190000_add_student_records_and_followup_system');
  const sqExists = await checkTable('student_qualifications');
  const siExists = await checkTable('student_incidents');
  const smExists = await checkTable('student_meetings');
  const sfuExists = await checkTable('student_follow_ups');
  // Check enum modification on notification_jobs.eventType
  const njCols = await getColumns('notification_jobs');
  const eventTypeCol = njCols.find(c => c.Field === 'eventType');
  // Check file_objects composite unique (id, madrasaId)
  const foIdxs = await getIndexes('file_objects');
  const foComposite = foIdxs.find(i => i.Key_name === 'file_objects_id_madrasaId_key');
  results['20261016190000_add_student_records_and_followup_system'] = {
    expected: 'student_qualifications, student_incidents, student_meetings, student_follow_ups, updated eventType enum, composite keys on file_objects & ustadhs',
    studentQualifications: sqExists,
    studentIncidents: siExists,
    studentMeetings: smExists,
    studentFollowUps: sfuExists,
    notificationEventTypeCol: eventTypeCol ? eventTypeCol.Type : null,
    fileObjectsCompositeIdx: !!foComposite,
    status: (sqExists && siExists && smExists && sfuExists && foComposite) ? 'FULLY_APPLIED' : 'PARTIALLY_APPLIED'
  };

  // -------------------------------------------------------------
  // MIGRATION 8: 20261030090000_add_madrasa_profile_curriculum_json
  // -------------------------------------------------------------
  console.log('[Migration 8] 20261030090000_add_madrasa_profile_curriculum_json');
  const mpCols = await getColumns('madrasa_profiles');
  const curriculumJsonCol = mpCols.find(c => c.Field === 'curriculumJson');
  results['20261030090000_add_madrasa_profile_curriculum_json'] = {
    expected: 'madrasa_profiles.curriculumJson LONGTEXT NULL',
    columnFound: !!curriculumJsonCol,
    columnDetails: curriculumJsonCol ? curriculumJsonCol.Type : null,
    status: curriculumJsonCol ? 'FULLY_APPLIED' : 'NOT_APPLIED'
  };

  // -------------------------------------------------------------
  // MIGRATION 9: 20261030130000_add_madrasa_profile_staff_json
  // -------------------------------------------------------------
  console.log('[Migration 9] 20261030130000_add_madrasa_profile_staff_json');
  const staffJsonCol = mpCols.find(c => c.Field === 'staffJson');
  results['20261030130000_add_madrasa_profile_staff_json'] = {
    expected: 'madrasa_profiles.staffJson LONGTEXT NULL',
    columnFound: !!staffJsonCol,
    columnDetails: staffJsonCol ? staffJsonCol.Type : null,
    status: staffJsonCol ? 'FULLY_APPLIED' : 'NOT_APPLIED'
  };

  console.log('\n--- AUDIT SUMMARY REPORT ---');
  console.log(JSON.stringify(results, null, 2));

  process.exit(0);
}

auditAllMigrations().catch(e => {
  console.error(e);
  process.exit(1);
});
