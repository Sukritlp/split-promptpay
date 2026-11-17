/**
 * กดเข้าร่วมซ้อนกัน (ดับเบิลคลิก / 2 tab) แบบ "ชนกันจริง"
 * หน่วง findUnique ของ groupMember จนทั้งสอง request เห็นว่า "ยังไม่เป็นสมาชิก" แล้วค่อยปล่อย
 * → ทั้งคู่พยายาม INSERT → PK คู่ใน DB ให้ผ่านแค่ตัวเดียว อีกตัวได้ P2002 ซึ่งต้องไม่กลายเป็น 500
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createInvitesService } from '../../src/modules/groups/invites.service.js';
import { generateInviteCode } from '../../src/lib/invite-code.js';
import { resetDatabase, testPrisma } from '../helpers/db.js';

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

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('InvitesService.join under a real race', () => {
  it('two simultaneous joins by the same user: one 201, one 200, exactly one membership row', async () => {
    const owner = await testPrisma.user.create({ data: { name: 'O', email: 'o@example.com' } });
    const friend = await testPrisma.user.create({ data: { name: 'F', email: 'f@example.com' } });
    const code = generateInviteCode();
    const group = await testPrisma.group.create({
      data: {
        name: 'ทริป',
        ownerId: owner.id,
        inviteCode: code,
        members: { create: { userId: owner.id, role: 'owner' } },
      },
    });

    // หน่วงเฉพาะการเช็คครั้งแรก (ก่อน INSERT) ของทั้งสอง request
    const barrier = createBarrier(2);
    let paused = 0;
    const racingPrisma = testPrisma.$extends({
      query: {
        groupMember: {
          async findUnique({ args, query }) {
            const result = await query(args);
            if (paused < 2) {
              paused += 1;
              await barrier();
            }
            return result;
          },
        },
      },
    }) as unknown as PrismaClient;
    const invites = createInvitesService({ prisma: racingPrisma });

    const results = await Promise.allSettled([
      invites.join(friend.id, code),
      invites.join(friend.id, code),
    ]);

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    const joined = results.map(
      (r) => (r as PromiseFulfilledResult<{ joined: boolean }>).value.joined,
    );
    expect(joined.sort()).toEqual([false, true]);
    await expect(
      testPrisma.groupMember.count({ where: { groupId: group.id, userId: friend.id } }),
    ).resolves.toBe(1);
  });
});
