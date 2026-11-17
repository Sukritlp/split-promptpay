import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { ErrorResponse } from '../../src/lib/http-error.js';
import type { GroupSummary } from '../../src/modules/groups/groups.service.js';
import { buildTestApp } from '../helpers/app.js';
import { resetDatabase, testPrisma } from '../helpers/db.js';
import { createTestUser, type TestUser } from '../helpers/users.js';

const { app, jwt } = buildTestApp();

async function setup() {
  const owner = await createTestUser(jwt, 'Owner');
  const member = await createTestUser(jwt, 'Member');
  const stranger = await createTestUser(jwt, 'Stranger');
  const res = await request(app)
    .post('/api/groups')
    .set('Authorization', owner.auth)
    .send({ name: 'ทริป' });
  const group = (res.body as { group: GroupSummary }).group;
  await testPrisma.groupMember.create({ data: { groupId: group.id, userId: member.id } });
  return { owner, member, stranger, group };
}

function getInvite(user: TestUser, groupId: string) {
  return request(app).get(`/api/groups/${groupId}/invite`).set('Authorization', user.auth);
}

function resetInvite(user: TestUser, groupId: string) {
  return request(app).post(`/api/groups/${groupId}/invite/reset`).set('Authorization', user.auth);
}

async function storedCode(groupId: string): Promise<string> {
  return (await testPrisma.group.findUniqueOrThrow({ where: { id: groupId } })).inviteCode;
}

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('GET /api/groups/:id/invite', () => {
  it.each(['owner', 'member'] as const)('the %s can get the invite code', async (who) => {
    const ctx = await setup();

    const res = await getInvite(ctx[who], ctx.group.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ code: await storedCode(ctx.group.id) });
  });

  it('a non-member gets 404', async () => {
    const { stranger, group } = await setup();

    const res = await getInvite(stranger, group.id);

    expect(res.status).toBe(404);
    expect((res.body as ErrorResponse).error.code).toBe('GROUP_NOT_FOUND');
  });

  it('a malformed group id gets 404', async () => {
    const { owner } = await setup();

    expect((await getInvite(owner, 'nope')).status).toBe(404);
  });

  it('requires authentication', async () => {
    const { group } = await setup();

    expect((await request(app).get(`/api/groups/${group.id}/invite`)).status).toBe(401);
  });
});

describe('POST /api/groups/:id/invite/reset', () => {
  it('the owner gets a new code and the old one is replaced', async () => {
    const { owner, group } = await setup();
    const before = await storedCode(group.id);

    const res = await resetInvite(owner, group.id);
    const { code } = res.body as { code: string };

    expect(res.status).toBe(200);
    expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(code).not.toBe(before);
    await expect(storedCode(group.id)).resolves.toBe(code);
  });

  it('keeps existing members', async () => {
    const { owner, group } = await setup();

    await resetInvite(owner, group.id);

    await expect(testPrisma.groupMember.count({ where: { groupId: group.id } })).resolves.toBe(2);
  });

  it('a member (not owner) gets 403 and the code does not change', async () => {
    const { member, group } = await setup();
    const before = await storedCode(group.id);

    const res = await resetInvite(member, group.id);

    expect(res.status).toBe(403);
    expect((res.body as ErrorResponse).error.code).toBe('FORBIDDEN');
    await expect(storedCode(group.id)).resolves.toBe(before);
  });

  it('a non-member gets 404 (not 403) and the code does not change', async () => {
    const { stranger, group } = await setup();
    const before = await storedCode(group.id);

    const res = await resetInvite(stranger, group.id);

    expect(res.status).toBe(404);
    await expect(storedCode(group.id)).resolves.toBe(before);
  });

  it('requires authentication', async () => {
    const { group } = await setup();

    expect((await request(app).post(`/api/groups/${group.id}/invite/reset`)).status).toBe(401);
  });
});
