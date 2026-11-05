import { prisma } from '../src/lib/prisma.js';

async function checkMigrationState() {
  console.log('--- CHECKING UNRECORDED MIGRATION OBJECTS IN MYSQL ---');

  // 1. staffType on ustadhs
  const ustadhCols = await prisma.$queryRawUnsafe('DESCRIBE ustadhs');
  const hasStaffType = ustadhCols.some(c => c.Field === 'staffType');

  // 2. timetable_breaks table
  const timetableBreaks = await prisma.$queryRawUnsafe("SHOW TABLES LIKE 'timetable_breaks'");

  // 3. curriculumJson and staffOverviewJson on madrasa_profiles
  const profileCols = await prisma.$queryRawUnsafe('DESCRIBE madrasa_profiles');
  const hasCurriculum = profileCols.some(c => c.Field === 'curriculumJson');
  const hasStaffJson = profileCols.some(c => c.Field === 'staffOverviewJson');

  // 4. student incidents/followups
  const incidentTables = await prisma.$queryRawUnsafe("SHOW TABLES LIKE 'student_incidents'");

  // 5. madrasa email settings
  const emailSettingsTables = await prisma.$queryRawUnsafe("SHOW TABLES LIKE 'madrasa_email_settings'");

  console.log('hasStaffType on ustadhs:             ', hasStaffType);
  console.log('timetable_breaks table exists:       ', timetableBreaks.length > 0);
  console.log('hasCurriculum on madrasa_profiles:   ', hasCurriculum);
  console.log('hasStaffJson on madrasa_profiles:    ', hasStaffJson);
  console.log('student_incidents table exists:      ', incidentTables.length > 0);
  console.log('madrasa_email_settings table exists: ', emailSettingsTables.length > 0);

  // Check MySQL version
  const [versionRow] = await prisma.$queryRawUnsafe('SELECT VERSION() as ver');
  console.log('\n--- MYSQL / MARIADB VERSION ---');
  console.log('Database Version: ', versionRow.ver);

  // Check plan.id, madrasa.id, user.id data types and collations
  console.log('\n--- REFERENCED COLUMN TYPES & COLLATIONS ---');
  const planIdCol = await prisma.$queryRawUnsafe("SELECT COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'id'");
  const madrasaIdCol = await prisma.$queryRawUnsafe("SELECT COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'madrasas' AND COLUMN_NAME = 'id'");
  const userIdCol = await prisma.$queryRawUnsafe("SELECT COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'");

  console.log('plans.id:   ', planIdCol[0]);
  console.log('madrasas.id:', madrasaIdCol[0]);
  console.log('users.id:   ', userIdCol[0]);

  process.exit(0);
}

checkMigrationState().catch(e => {
  console.error(e);
  process.exit(1);
});
