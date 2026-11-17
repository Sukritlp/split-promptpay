import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { ErrorResponse } from '../../src/lib/http-error.js';
import type { GroupSummary } from '../../src/modules/groups/groups.service.js';
import { buildTestApp } from '../helpers/app.js';
import { resetDatabase, testPrisma } from '../helpers/db.js';
import { createTestUser, type TestUser } from '../helpers/users.js';

const { app, jwt } = buildTestApp();

function createGroup(user: TestUser, body: object) {
  return request(app).post('/api/groups').set('Authorization', user.auth).send(body);
}

async function createGroupOk(user: TestUser, name = 'ทริปเชียงใหม่'): Promise<GroupSummary> {
  const res = await createGroup(user, { name });
  expect(res.status).toBe(201);
  return (res.body as { group: GroupSummary }).group;
}

function listGroups(user: TestUser) {
  return request(app).get('/api/groups').set('Authorization', user.auth);
}

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('POST /api/groups', () => {
  it('creates a group with the creator as the only member and owner', async () => {
    const somchai = await createTestUser(jwt);

    const res = await createGroup(somchai, { name: 'ทริปเชียงใหม่' });

    expect(res.status).toBe(201);
    expect((res.body as { group: GroupSummary }).group).toEqual({
      id: expect.any(String) as string,
      name: 'ทริปเชียงใหม่',
      currency: 'THB',
      myRole: 'owner',
      memberCount: 1,
      createdAt: expect.any(String) as string,
    });
    const members = await testPrisma.groupMember.findMany();
    expect(members).toEqual([expect.objectContaining({ userId: somchai.id, role: 'owner' })]);
  });

  it('generates a well-formed, unique invite code (not returned on create)', async () => {
    const somchai = await createTestUser(jwt);

    const res = await createGroup(somchai, { name: 'A' });
    await createGroupOk(somchai, 'B');
    const codes = (await testPrisma.group.findMany()).map((g) => g.inviteCode);

    expect(res.text).not.toContain('inviteCode');
    expect(codes.every((c) => /^[A-Za-z0-9_-]{22}$/.test(c))).toBe(true);
    expect(new Set(codes).size).toBe(2);
  });

  it('trims the name and accepts Thai and emoji', async () => {
    const somchai = await createTestUser(jwt);

    const group = await createGroupOk(somchai, '  บ้านเช่า 🏠  ');

    expect(group.name).toBe('บ้านเช่า 🏠');
  });

  it('ignores fields the client must not set (mass assignment)', async () => {
    const somchai = await createTestUser(jwt);
    const other = await createTestUser(jwt, 'Other');

    const res = await createGroup(somchai, {
      name: 'ทริป',
      ownerId: other.id,
      inviteCode: 'attacker-chosen-code-xx',
      id: '00000000-0000-0000-0000-000000000000',
    });
    const group = await testPrisma.group.findFirstOrThrow();

    expect(res.status).toBe(201);
    expect(group.ownerId).toBe(somchai.id);
    expect(group.inviteCode).not.toBe('attacker-chosen-code-xx');
    expect(group.id).not.toBe('00000000-0000-0000-0000-000000000000');
  });

  it.each([
    ['missing name', {}],
    ['blank name', { name: '   ' }],
    ['name too long (61)', { name: 'ก'.repeat(61) }],
    ['name not a string', { name: 123 }],
    ['unsupported currency', { name: 'ทริป', currency: 'USD' }],
  ])('rejects %s with 400', async (_label, body) => {
    const somchai = await createTestUser(jwt);

    const res = await createGroup(somchai, body);

    expect(res.status).toBe(400);
    expect((res.body as ErrorResponse).error.code).toBe('VALIDATION_ERROR');
    await expect(testPrisma.group.count()).resolves.toBe(0);
  });

  it('accepts a name of exactly 60 characters', async () => {
    const somchai = await createTestUser(jwt);

    expect((await createGroup(somchai, { name: 'ก'.repeat(60) })).status).toBe(201);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/groups').send({ name: 'ทริป' });

    expect(res.status).toBe(401);
  });

  it('a valid token for a deleted user gets 401, not 500, and nothing is written', async () => {
    const ghost = await createTestUser(jwt);
    await testPrisma.user.delete({ where: { id: ghost.id } });

    const res = await createGroup(ghost, { name: 'ทริป' });

    expect(res.status).toBe(401);
    await expect(testPrisma.group.count()).resolves.toBe(0);
    await expect(testPrisma.groupMember.count()).resolves.toBe(0);
  });
});

describe('GET /api/groups', () => {
  it('lists only groups the user belongs to, newest membership first, with role and count', async () => {
    const somchai = await createTestUser(jwt);
    const somsri = await createTestUser(jwt, 'Somsri');
    const first = await createGroupOk(somchai, 'แรก');
    const second = await createGroupOk(somchai, 'สอง');
    await createGroupOk(somsri, 'ของสมศรี');
    // ตั้งเวลาให้ห่างกันชัดเจน: สร้างติดกันอาจได้ joined_at มิลลิวินาทีเดียวกัน
    await testPrisma.groupMember.update({
      where: { groupId_userId: { groupId: first.id, userId: somchai.id } },
      data: { joinedAt: new Date('2026-01-01T00:00:00Z') },
    });

    const res = await listGroups(somchai);
    const { groups } = res.body as { groups: GroupSummary[] };

    expect(res.status).toBe(200);
    expect(groups.map((g) => g.id)).toEqual([second.id, first.id]);
    expect(groups.every((g) => g.myRole === 'owner' && g.memberCount === 1)).toBe(true);
  });

  it('shows member role and the real member count for groups joined as a member', async () => {
    const owner = await createTestUser(jwt);
    const member = await createTestUser(jwt, 'Member');
    const group = await createGroupOk(owner);
    await testPrisma.groupMember.create({ data: { groupId: group.id, userId: member.id } });

    const { groups } = (await listGroups(member)).body as { groups: GroupSummary[] };

    expect(groups).toEqual([
      expect.objectContaining({ id: group.id, myRole: 'member', memberCount: 2 }),
    ]);
  });

  it('returns an empty list for a user with no groups', async () => {
    const somchai = await createTestUser(jwt);

    expect((await listGroups(somchai)).body).toEqual({ groups: [] });
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/groups')).status).toBe(401);
  });
});

describe('database rules', () => {
  it('a user who owns a group cannot be deleted (RESTRICT)', async () => {
    const owner = await createTestUser(jwt);
    await createGroupOk(owner);

    await expect(testPrisma.user.delete({ where: { id: owner.id } })).rejects.toMatchObject({
      code: expect.stringMatching(/^P20(03|14)$/) as string,
    });
  });

  it('the same user cannot be a member of the same group twice (composite PK)', async () => {
    const owner = await createTestUser(jwt);
    const group = await createGroupOk(owner);

    await expect(
      testPrisma.groupMember.create({ data: { groupId: group.id, userId: owner.id } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('deleting a group removes its memberships (CASCADE)', async () => {
    const owner = await createTestUser(jwt);
    const group = await createGroupOk(owner);

    await testPrisma.group.delete({ where: { id: group.id } });

    await expect(testPrisma.groupMember.count()).resolves.toBe(0);
  });
});

it('unknown /api paths still return 404 (auth is only applied to group routes)', async () => {
  expect((await request(app).get('/api/nope')).status).toBe(404);
});
