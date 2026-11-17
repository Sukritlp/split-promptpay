/**
 * ก่อนรัน E2E: ล้างข้อมูลทุกตารางใน DB *_e2e ให้เริ่มจากศูนย์
 * (migration ทำไปแล้วตอนสตาร์ท api ใน webServer)
 *
 * ใช้ Prisma CLI ของ api สั่ง SQL — web จึงไม่ต้องพึ่ง driver ของ PostgreSQL เอง
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { assertE2eDatabase, E2E } from './env';

const TABLES = ['group_members', 'groups', 'refresh_tokens', 'users'];

export default function globalSetup(): void {
  assertE2eDatabase(E2E.databaseUrl);

  const sql = `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`;
  // คำสั่งคงที่ (ไม่มีค่าจากภายนอกต่อเข้าไป) ส่ง SQL ทาง stdin — ใช้ shell ได้ทั้ง Windows (npx.cmd) และ Linux
  execSync('npx prisma db execute --stdin', {
    cwd: path.resolve(__dirname, '../../api'),
    input: sql,
    env: { ...process.env, DATABASE_URL: E2E.databaseUrl },
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}
