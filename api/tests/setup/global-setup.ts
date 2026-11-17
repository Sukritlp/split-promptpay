/**
 * รันครั้งเดียวก่อน integration test ทั้งหมด:
 * 1) สร้าง database *_test ถ้ายังไม่มี
 * 2) รัน migration ทั้งหมดด้วย `prisma migrate deploy` (ตัวเดียวกับที่ใช้บน production)
 */
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { TEST_DATABASE_URL, assertTestDatabase } from './test-env.js';

export default async function globalSetup(): Promise<void> {
  const dbName = assertTestDatabase(TEST_DATABASE_URL);

  // ต่อเข้า DB "postgres" (มีอยู่เสมอ) เพื่อสร้าง DB ทดสอบ
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      dbName,
    ]);
    if (rowCount === 0) {
      // ชื่อ DB ใส่เป็น parameter ($1) ไม่ได้ → ผ่าน assertTestDatabase แล้ว และ quote ด้วย ""
      await admin.query(`CREATE DATABASE "${dbName.replaceAll('"', '""')}"`);
    }
  } finally {
    await admin.end();
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
    shell: process.platform === 'win32', // Windows ต้องใช้ shell ถึงจะหา npx.cmd เจอ
  });
}
