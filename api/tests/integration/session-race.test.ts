/**
 * ทดสอบ race condition ของ rotate แบบ "บังคับให้ชนกันจริง"
 *
 * ถ้ายิง 2 request พร้อมกันเฉยๆ มักไม่ชนกันจริง (ตัวที่สองอ่าน DB หลังตัวแรก commit ไปแล้ว)
 * test จึงผ่านแม้โค้ดจะมีบั๊ก ที่นี่เลยหน่วง findUnique ไว้จนทั้งสองตัว "อ่านแถวเดียวกันเสร็จ"
 * แล้วค่อยปล่อยไปอัปเดตพร้อมกัน — ถ้าไม่มีการจองแบบ atomic จะได้ token ใหม่ 2 ตัว
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createSessionService } from '../../src/modules/auth/session.service.js';
import { resetDatabase, testPrisma } from '../helpers/db.js';

/** รอจนมีคนมาถึงครบ n คน (หรือครบ timeout) แล้วปล่อยทุกคนพร้อมกัน */
function createBarrier(n: number, timeoutMs = 2_000): () => Promise<void> {
  let arrived = 0;
  let release!: () => void;
  const allArrived = new Promise<void>((resolve) => (release = resolve));
  return async () => {
    arrived += 1;
    if (arrived >= n) release();
    await Promise.race([allArrived, new Promise((r) => setTimeout(r, timeoutMs))]);
  };
}

function prismaThatPausesAfterReadingToken(barrier: () => Promise<void>): PrismaClient {
  return testPrisma.$extends({
    query: {
      refreshToken: {
        async findUnique({ args, query }) {
          const result = await query(args);
          await barrier();
          return result;
        },
      },
    },
  }) as unknown as PrismaClient;
}

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('SessionService.rotate under a real race', () => {
  it('two rotations that read the same token at the same moment yield at most one live token', async () => {
    const user = await testPrisma.user.create({ data: { name: 'A', email: 'a@example.com' } });
    const setup = createSessionService({ prisma: testPrisma, ttlDays: 30 });
    const { token } = await setup.start(user.id);

    const racing = createSessionService({
      prisma: prismaThatPausesAfterReadingToken(createBarrier(2)),
      ttlDays: 30,
    });
    const results = await Promise.allSettled([racing.rotate(token), racing.rotate(token)]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      status: 401,
      code: 'INVALID_REFRESH_TOKEN',
    });

    // นโยบายเข้มงวด: ตัวที่แพ้ถูกมองว่าเป็นการใช้ซ้ำ → ยกเลิกทั้ง family
    await expect(testPrisma.refreshToken.count({ where: { revokedAt: null } })).resolves.toBe(0);
  });
});
