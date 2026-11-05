import { prisma } from '../src/lib/prisma.js';

async function checkMarking() {
  const rows = await prisma.$queryRawUnsafe("SELECT id, migration_name, finished_at, rolled_back_at FROM _prisma_migrations");
  console.log('Total rows in _prisma_migrations:', rows.length);
  for (const r of rows) {
    console.log(`- ${r.migration_name} (finished: ${r.finished_at ? 'YES' : 'NO'}, rolled_back: ${r.rolled_back_at})`);
  }
  process.exit(0);
}

checkMarking().catch(e => {
  console.error(e);
  process.exit(1);
});
