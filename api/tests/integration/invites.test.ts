import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { ErrorResponse } from '../../src/lib/http-error.js';
import { generateInviteCode } from '../../src/lib/invite-code.js';
import type { GroupSummary } from '../../src/modules/groups/groups.service.js';
import type { InvitePreview } from '../../src/modules/groups/invites.service.js';
import { buildTestApp } from '../helpers/app.js';
import { resetDatabase, testPrisma } from '../helpers/db.js';
import { createTestUser, type TestUser } from '../helpers/users.js';

const { app, jwt } = buildTestApp();

async function setup() {
  const owner = await createTestUser(jwt, 'Owner');
  const friend = await createTestUser(jwt, 'Friend');
  const res = await request(app)
    .post('/api/groups')
    .set('Authorization', owner.auth)
    .send({ name: 'ทริปเชียงใหม่' });
  const group = (res.body as { group: GroupSummary }).group;
  const code = (await testPrisma.group.findUniqueOrThrow({ where: { id: group.id } })).inviteCode;
  return { owner, friend, group, code };
}

function preview(user: TestUser, code: string) {
  return request(app).get(`/api/invites/${code}`).set('Authorization', user.auth);
}

function join(user: TestUser, code: string) {
  return request(app).post(`/api/invites/${code}/join`).set('Authorization', user.auth);
}

const memberCount = (groupId: string) => testPrisma.groupMember.count({ where: { groupId } });

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('GET /api/invites/:code (preview)', () => {
  it('shows the group name and member count to a non-member', async () => {
    const { friend, group, code } = await setup();

    const res = await preview(friend, code);

    expect(res.status).toBe(200);
    expect(res.body as InvitePreview).toEqual({
      group: { id: group.id, name: 'ทริปเชียงใหม่', memberCount: 1 },
      alreadyMember: false,
    });
  });

  it('tells an existing member they are already in', async () => {
    const { owner, code } = await setup();

    expect(((await preview(owner, code)).body as InvitePreview).alreadyMember).toBe(true);
  });

  it('does not join the group', async () => {
    const { friend, group, code } = await setup();

    await preview(friend, code);

    await expect(memberCount(group.id)).resolves.toBe(1);
  });

  it('does not reveal members or the owner', async () => {
    const { friend, owner, code } = await setup();

    const res = await preview(friend, code);

    expect(res.text).not.toContain(owner.id);
    expect(res.text).not.toContain('Owner');
  });
});

describe('POST /api/invites/:code/join', () => {
  it('adds the user as a member and returns 201 with the group', async () => {
    const { friend, group, code } = await setup();

    const res = await join(friend, code);

    expect(res.status).toBe(201);
    expect((res.body as { group: GroupSummary }).group).toMatchObject({
      id: group.id,
      myRole: 'member',
      memberCount: 2,
    });
    const membership = await testPrisma.groupMember.findUniqueOrThrow({
      where: { groupId_userId: { groupId: group.id, userId: friend.id } },
    });
    expect(membership.role).toBe('member');
  });

  it('the new member can now see the group', async () => {
    const { friend, group, code } = await setup();

    await join(friend, code);
    const res = await request(app).get(`/api/groups/${group.id}`).set('Authorization', friend.auth);

    expect(res.status).toBe(200);
  });

  it('is idempotent: joining again returns 200 and does not add a second row', async () => {
    const { friend, group, code } = await setup();
    await join(friend, code);

    const res = await join(friend, code);

    expect(res.status).toBe(200);
    expect((res.body as { group: GroupSummary }).group.memberCount).toBe(2);
    await expect(memberCount(group.id)).resolves.toBe(2);
  });

  it('the owner using their own link stays owner (no downgrade)', async () => {
    const { owner, code } = await setup();

    const res = await join(owner, code);

    expect(res.status).toBe(200);
    expect((res.body as { group: GroupSummary }).group.myRole).toBe('owner');
  });

  it('several friends can join with the same link', async () => {
    const { group, code } = await setup();
    const friends = await Promise.all(['A', 'B', 'C'].map((n) => createTestUser(jwt, n)));

    for (const f of friends) expect((await join(f, code)).status).toBe(201);

    await expect(memberCount(group.id)).resolves.toBe(4);
  });

  it('a valid token for a deleted user gets 401, not 500', async () => {
    const { code } = await setup();
    const ghost = await createTestUser(jwt, 'Ghost');
    await testPrisma.user.delete({ where: { id: ghost.id } });

    expect((await join(ghost, code)).status).toBe(401);
  });
});

describe('invalid invite codes → 404 INVITE_NOT_FOUND (preview and join)', () => {
  it('after the owner resets the link, the old code stops working and the new one works', async () => {
    const { owner, friend, code: oldCode } = await setup();
    const reset = await request(app)
      .post(`/api/groups/${(await testPrisma.group.findFirstOrThrow()).id}/invite/reset`)
      .set('Authorization', owner.auth);
    const newCode = (reset.body as { code: string }).code;

    expect((await preview(friend, oldCode)).status).toBe(404);
    expect((await join(friend, oldCode)).status).toBe(404);
    expect((await join(friend, newCode)).status).toBe(201);
  });

  it.each([
    ['unknown but well-formed', generateInviteCode()],
    ['too short', 'abc'],
    ['path traversal', '..%2F..%2Fetc'],
    ['SQL-ish', encodeURIComponent("' OR 1=1 --")],
  ])('%s', async (_label, code) => {
    const { friend, group } = await setup();

    const p = await preview(friend, code);
    const j = await join(friend, code);

    for (const res of [p, j]) {
      expect(res.status).toBe(404);
      expect((res.body as ErrorResponse).error.code).toBe('INVITE_NOT_FOUND');
    }
    await expect(memberCount(group.id)).resolves.toBe(1);
  });
});

it('requires authentication for preview and join', async () => {
  const { code } = await setup();

  expect((await request(app).get(`/api/invites/${code}`)).status).toBe(401);
  expect((await request(app).post(`/api/invites/${code}/join`)).status).toBe(401);
});
