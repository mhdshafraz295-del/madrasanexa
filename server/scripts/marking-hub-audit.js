import { prisma } from '../src/lib/prisma.js';
import fs from 'fs';

async function auditMarkingHub() {
  console.log('=== MARKING HUB MIGRATION RECOVERY AUDIT (READ-ONLY) ===\n');

  // 1. Inspect _prisma_migrations for 20260919100500_add_marking_hub
  const migrationRecords = await prisma.$queryRawUnsafe(
    "SELECT id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count FROM _prisma_migrations WHERE migration_name LIKE '%marking_hub%'"
  );
  console.log('--- 1. _PRISMA_MIGRATIONS RECORDS & CHECKSUMS ---');
  import('crypto').then(crypto => {
    const sql = fs.readFileSync('prisma/migrations/20260919100500_add_marking_hub/migration.sql', 'utf8');
    const fileHash = crypto.createHash('sha256').update(sql).digest('hex');
    console.log(`migration.sql SHA256: ${fileHash}`);
    for (const r of migrationRecords) {
      console.log(`ID: ${r.id}`);
      console.log(`  checksum:       ${r.checksum} (matches file: ${r.checksum === fileHash})`);
      console.log(`  started_at:     ${r.started_at?.toISOString()}`);
      console.log(`  finished_at:    ${r.finished_at?.toISOString()}`);
      console.log(`  rolled_back_at: ${r.rolled_back_at?.toISOString()}`);
      console.log(`  applied_steps:  ${r.applied_steps_count}`);
      console.log('----------------------------------------------------');
    }
  });

  // Also check neighboring migrations in _prisma_migrations
  const allChronological = await prisma.$queryRawUnsafe(
    "SELECT id, migration_name, started_at, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at ASC"
  );
  console.log('\n--- 2. CHRONOLOGICAL MIGRATION TIMELINE ---');
  for (const m of allChronological) {
    console.log(`${m.started_at?.toISOString()} | ${m.migration_name} | finished: ${m.finished_at ? 'YES' : 'NO'} | rolled_back: ${m.rolled_back_at?.toISOString() || 'NONE'}`);
  }

  // 3. Compare each expected DB object
  console.log('\n--- 3. DATABASE OBJECT COMPARISON ---');

  // A. Column: madrasa_settings.gpaScale
  const settingsCols = await prisma.$queryRawUnsafe("DESCRIBE madrasa_settings");
  const gpaScaleCol = settingsCols.find(c => c.Field === 'gpaScale');
  console.log('madrasa_settings.gpaScale exists:', !!gpaScaleCol, gpaScaleCol ? `Type: ${gpaScaleCol.Type}, Null: ${gpaScaleCol.Null}` : '');

  // Helper functions
  const checkTable = async (t) => {
    const res = await prisma.$queryRawUnsafe(`SHOW TABLES LIKE '${t}'`);
    return res.length > 0;
  };
  const getCols = async (t) => {
    return await prisma.$queryRawUnsafe(`DESCRIBE \`${t}\``);
  };
  const getIndexes = async (t) => {
    return await prisma.$queryRawUnsafe(`SHOW INDEX FROM \`${t}\``);
  };
  const getFks = async (t) => {
    return await prisma.$queryRawUnsafe(
      `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${t}' AND REFERENCED_TABLE_NAME IS NOT NULL`
    );
  };

  // B. Table: subjects
  const subjectsExists = await checkTable('subjects');
  console.log('\nTable `subjects` exists:', subjectsExists);
  if (subjectsExists) {
    const cols = await getCols('subjects');
    const idxs = await getIndexes('subjects');
    const fks = await getFks('subjects');
    console.log('  Columns:', cols.map(c => `${c.Field} (${c.Type})`).join(', '));
    console.log('  Indexes:', [...new Set(idxs.map(i => i.Key_name))].join(', '));
    console.log('  Foreign Keys:', fks.map(f => `${f.CONSTRAINT_NAME}: ${f.COLUMN_NAME} -> ${f.REFERENCED_TABLE_NAME}(${f.REFERENCED_COLUMN_NAME})`).join(', '));
  }

  // C. Table: marking_assessments
  const maExists = await checkTable('marking_assessments');
  console.log('\nTable `marking_assessments` exists:', maExists);
  if (maExists) {
    const cols = await getCols('marking_assessments');
    const idxs = await getIndexes('marking_assessments');
    const fks = await getFks('marking_assessments');
    console.log('  Columns:', cols.map(c => `${c.Field} (${c.Type})`).join(', '));
    console.log('  Indexes:', [...new Set(idxs.map(i => i.Key_name))].join(', '));
    console.log('  Foreign Keys:', fks.map(f => `${f.CONSTRAINT_NAME}: ${f.COLUMN_NAME} -> ${f.REFERENCED_TABLE_NAME}(${f.REFERENCED_COLUMN_NAME})`).join(', '));
  }

  // D. Table: marking_assessment_subjects
  const masExists = await checkTable('marking_assessment_subjects');
  console.log('\nTable `marking_assessment_subjects` exists:', masExists);
  if (masExists) {
    const cols = await getCols('marking_assessment_subjects');
    const idxs = await getIndexes('marking_assessment_subjects');
    const fks = await getFks('marking_assessment_subjects');
    console.log('  Columns:', cols.map(c => `${c.Field} (${c.Type})`).join(', '));
    console.log('  Indexes:', [...new Set(idxs.map(i => i.Key_name))].join(', '));
    console.log('  Foreign Keys:', fks.map(f => `${f.CONSTRAINT_NAME}: ${f.COLUMN_NAME} -> ${f.REFERENCED_TABLE_NAME}(${f.REFERENCED_COLUMN_NAME})`).join(', '));
  }

  // E. Table: student_marks
  const smExists = await checkTable('student_marks');
  console.log('\nTable `student_marks` exists:', smExists);
  if (smExists) {
    const cols = await getCols('student_marks');
    const idxs = await getIndexes('student_marks');
    const fks = await getFks('student_marks');
    console.log('  Columns:', cols.map(c => `${c.Field} (${c.Type})`).join(', '));
    console.log('  Indexes:', [...new Set(idxs.map(i => i.Key_name))].join(', '));
    console.log('  Foreign Keys:', fks.map(f => `${f.CONSTRAINT_NAME}: ${f.COLUMN_NAME} -> ${f.REFERENCED_TABLE_NAME}(${f.REFERENCED_COLUMN_NAME})`).join(', '));
  }

  // 4. Check data in these tables
  console.log('\n--- 4. EXISTING DATA IN MARKING HUB TABLES ---');
  if (subjectsExists) {
    const [sc] = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM subjects');
    console.log('  subjects count:', sc.count);
  }
  if (maExists) {
    const [mac] = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM marking_assessments');
    console.log('  marking_assessments count:', mac.count);
  }
  if (masExists) {
    const [masc] = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM marking_assessment_subjects');
    console.log('  marking_assessment_subjects count:', masc.count);
  }
  if (smExists) {
    const [smc] = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM student_marks');
    console.log('  student_marks count:', smc.count);
  }

  // 5. Check backups
  console.log('\n--- 5. BACKUP VERIFICATION ---');
  const b1 = 'backups/pre_feature_access_backup_20261031_115200.sql';
  const b2 = 'backups/pre_feature_access_backup_20261031_portable.sql';
  console.log(`Backup 1 (${b1}):`, fs.existsSync(b1), fs.statSync(b1).size, 'bytes');
  console.log(`Backup 2 (${b2}):`, fs.existsSync(b2), fs.statSync(b2).size, 'bytes');

  process.exit(0);
}

auditMarkingHub().catch(e => {
  console.error(e);
  process.exit(1);
});
