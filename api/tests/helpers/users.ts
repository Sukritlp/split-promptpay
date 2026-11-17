import { randomUUID } from 'node:crypto';
import type { JwtService } from '../../src/lib/jwt.js';
import { testPrisma } from './db.js';

export interface TestUser {
  id: string;
  name: string;
  /** ค่าสำหรับ header Authorization */
  auth: string;
}

/** สร้าง user ใน DB ตรงๆ พร้อม access token — เร็วกว่าสมัครผ่าน API สำหรับ test ที่ไม่ได้ทดสอบ auth */
export async function createTestUser(jwt: JwtService, name = 'Somchai'): Promise<TestUser> {
  const user = await testPrisma.user.create({
    data: { name, email: `${randomUUID()}@example.com` },
  });
  const token = await jwt.signAccessToken({ userId: user.id });
  return { id: user.id, name: user.name, auth: `Bearer ${token}` };
}
