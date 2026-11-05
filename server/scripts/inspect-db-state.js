import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const [dbRes] = await prisma.$queryRawUnsafe('SELECT DATABASE() as dbName');
    const tables = await prisma.$queryRawUnsafe('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
    const tableNames = tables.map(t => Object.values(t)[0]);

    let migrations = [];
    try {
      migrations = await prisma.$queryRawUnsafe('SELECT id, migration_name, finished_at, rolled_back_at, applied_steps_count FROM _prisma_migrations ORDER BY finished_at ASC');
    } catch (e) {
      migrations = [{ error: e.message }];
    }

    const fileObjTypeCol = await prisma.$queryRawUnsafe('SHOW COLUMNS FROM file_objects LIKE "type"');
    const notifEventCol = await prisma.$queryRawUnsafe('SHOW COLUMNS FROM notification_jobs LIKE "eventType"');

    console.log(JSON.stringify({
      database: dbRes.dbName,
      tableCount: tableNames.length,
      tables: tableNames,
      migrationCount: migrations.length,
      migrations: migrations.map(m => m.migration_name || m),
      fileObjectTypeCol: fileObjTypeCol[0],
      notificationEventTypeCol: notifEventCol[0],
    }, null, 2));
  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
