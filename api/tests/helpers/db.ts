import { prisma } from '../../src/db/prisma.js';
import { TEST_DATABASE_URL, assertTestDatabase } from '../setup/test-env.js';

assertTestDatabase(TEST_DATABASE_URL);

export { prisma as testPrisma };

/** ล้างข้อมูลทุกตาราง (ยกเว้นประวัติ migration) ให้แต่ละ test เริ่มจาก DB ว่าง */
export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;

  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
