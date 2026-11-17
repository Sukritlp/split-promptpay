import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { ErrorResponse } from '../../src/lib/http-error.js';
import type { GroupDetail, GroupSummary } from '../../src/modules/groups/groups.service.js';
import { buildTestApp } from '../helpers/app.js';
import { resetDatabase, testPrisma } from '../helpers/db.js';
import { createTestUser, type TestUser } from '../helpers/users.js';

const { app, jwt } = buildTestApp();

async function createGroupOk(user: TestUser, name = 'ทริปเชียงใหม่'): Promise<GroupSummary> {
  const res = await request(app).post('/api/groups').set('Authorization', user.auth).send({ name });
  expect(res.status).toBe(201);
  return (res.body as { group: GroupSummary }).group;
}

function getGroup(user: TestUser, id: string) {
  return request(app).get(`/api/groups/${id}`).set('Authorization', user.auth);
}

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('GET /api/groups/:id', () => {
  it('returns the group and its members (in join order) to a member', async () => {
    const owner = await createTestUser(jwt, 'สมชาย');
    const member = await createTestUser(jwt, 'สมศรี');
    const group = await createGroupOk(owner);
    await testPrisma.groupMember.create({
      data: { groupId: group.id, userId: member.id, joinedAt: new Date(Date.now() + 1000) },
    });

    const res = await getGroup(member, group.id);
    const detail = (res.body as { group: GroupDetail }).group;

    expect(res.status).toBe(200);
    expect(detail).toMatchObject({
      id: group.id,
      name: 'ทริปเชียงใหม่',
      currency: 'THB',
      ownerId: owner.id,
      myRole: 'member',
    });
    expect(detail.members).toEqual([
      { userId: owner.id, name: 'สมชาย', role: 'owner', joinedAt: expect.any(String) as string },
      { userId: member.id, name: 'สมศรี', role: 'member', joinedAt: expect.any(String) as string },
    ]);
  });

  it("does not expose members' emails or the invite code", async () => {
    const owner = await createTestUser(jwt);
    const group = await createGroupOk(owner);

    const res = await getGroup(owner, group.id);

    expect(res.text).not.toContain('@example.com');
    expect(res.text).not.toContain('email');
    expect(res.text).not.toContain('inviteCode');
  });

  describe('non-members get the same 404 as a group that does not exist (no id probing)', () => {
    it('non-member', async () => {
      const owner = await createTestUser(jwt);
      const stranger = await createTestUser(jwt, 'Stranger');
      const group = await createGroupOk(owner);

      const res = await getGroup(stranger, group.id);

      expect(res.status).toBe(404);
      expect(res.body as ErrorResponse).toEqual({
        error: { code: 'GROUP_NOT_FOUND', message: 'Group not found' },
      });
    });

    it('non-existent group', async () => {
      const somchai = await createTestUser(jwt);

      const res = await getGroup(somchai, '7c9e6679-7425-40de-944b-e07fc1f90ae7');

      expect(res.status).toBe(404);
      expect((res.body as ErrorResponse).error.code).toBe('GROUP_NOT_FOUND');
    });

    it.each(['not-a-uuid', '1', "1' OR '1'='1", '%00'])(
      'malformed id "%s" (no 500)',
      async (id) => {
        const somchai = await createTestUser(jwt);

        const res = await getGroup(somchai, encodeURIComponent(id));

        expect(res.status).toBe(404);
      },
    );
  });

  it('requires authentication', async () => {
    const owner = await createTestUser(jwt);
    const group = await createGroupOk(owner);

    expect((await request(app).get(`/api/groups/${group.id}`)).status).toBe(401);
  });
});
