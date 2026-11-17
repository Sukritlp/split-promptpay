import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { ErrorResponse } from '../../src/lib/http-error.js';
import { generateRefreshToken, hashRefreshToken } from '../../src/lib/refresh-token.js';
import type { AuthResult } from '../../src/modules/auth/auth.service.js';
import { buildTestApp } from '../helpers/app.js';
import { getRefreshCookie, refreshCookieHeader } from '../helpers/cookies.js';
import { resetDatabase, testPrisma } from '../helpers/db.js';

const { app, jwt } = buildTestApp();
const account = { name: 'Somchai', email: 'somchai@example.com', password: 'correct-horse-1' };

async function registerAndGetRefreshToken(): Promise<{ token: string; user: AuthResult['user'] }> {
  const res = await request(app).post('/auth/register').send(account);
  const token = getRefreshCookie(res)?.value;
  if (!token) throw new Error('register did not set a refresh cookie');
  return { token, user: (res.body as AuthResult).user };
}

function refresh(token?: string) {
  const req = request(app).post('/auth/refresh');
  return token === undefined ? req : req.set('Cookie', refreshCookieHeader(token));
}

/** refresh สำเร็จ → คืน refresh token ตัวใหม่จาก cookie */
async function refreshOk(token: string): Promise<string> {
  const res = await refresh(token);
  expect(res.status).toBe(200);
  const next = getRefreshCookie(res)?.value;
  if (!next) throw new Error('refresh did not set a new cookie');
  return next;
}

function expectRejected(res: request.Response) {
  expect(res.status).toBe(401);
  expect((res.body as ErrorResponse).error.code).toBe('INVALID_REFRESH_TOKEN');
  // สั่ง browser ลบ cookie (หมดอายุย้อนหลัง) ด้วย path เดียวกับตอนตั้ง
  const cookie = getRefreshCookie(res);
  expect(cookie?.value).toBe('');
  expect(cookie?.attributes.path).toBe('/auth');
  expect(new Date(cookie?.attributes.expires as string).getTime()).toBeLessThan(Date.now());
}

async function activeTokenCount(): Promise<number> {
  return testPrisma.refreshToken.count({ where: { revokedAt: null } });
}

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('POST /auth/refresh', () => {
  describe('success', () => {
    it('returns a new access token and the user', async () => {
      const { token, user } = await registerAndGetRefreshToken();

      const res = await refresh(token);
      const body = res.body as AuthResult;

      expect(res.status).toBe(200);
      expect(body.user).toEqual(user);
      await expect(jwt.verifyAccessToken(body.accessToken)).resolves.toEqual({
        userId: user.id,
      });
    });

    it('rotates: sets a different refresh token in the same family', async () => {
      const { token } = await registerAndGetRefreshToken();

      const next = await refreshOk(token);
      const rows = await testPrisma.refreshToken.findMany({ orderBy: { createdAt: 'asc' } });

      expect(next).not.toBe(token);
      expect(rows).toHaveLength(2);
      expect(rows[0]?.familyId).toBe(rows[1]?.familyId);
      expect(rows[0]?.revokedAt).not.toBeNull();
      expect(rows[1]?.revokedAt).toBeNull();
    });

    it('can be chained many times', async () => {
      let { token } = await registerAndGetRefreshToken();
      for (let i = 0; i < 5; i++) token = await refreshOk(token);

      await expect(activeTokenCount()).resolves.toBe(1);
    });

    it('slides the expiry forward on every refresh', async () => {
      const { token } = await registerAndGetRefreshToken();
      await testPrisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() + 60_000) }, // เหลืออีก 1 นาที
      });

      await refreshOk(token);
      const active = await testPrisma.refreshToken.findFirstOrThrow({ where: { revokedAt: null } });

      expect(active.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    });
  });

  describe('rejected → 401 INVALID_REFRESH_TOKEN and cookie cleared', () => {
    it('no cookie', async () => {
      expectRejected(await refresh());
    });

    it('malformed cookie (never reaches the database)', async () => {
      expectRejected(await refresh('not-a-token'));
    });

    it('well-formed but unknown token', async () => {
      expectRejected(await refresh(generateRefreshToken()));
    });

    it('expired token', async () => {
      const { token } = await registerAndGetRefreshToken();
      await testPrisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1) } });

      expectRejected(await refresh(token));
    });

    it('token whose user was deleted (removed by ON DELETE CASCADE)', async () => {
      const { token, user } = await registerAndGetRefreshToken();
      await testPrisma.user.delete({ where: { id: user.id } });

      await expect(testPrisma.refreshToken.count()).resolves.toBe(0);
      expectRejected(await refresh(token));
    });

    it('a token value that equals a stored hash (DB leak cannot be replayed)', async () => {
      await registerAndGetRefreshToken();
      const row = await testPrisma.refreshToken.findFirstOrThrow();

      expectRejected(await refresh(row.tokenHash));
    });
  });

  describe('reuse detection (strict)', () => {
    it('rejects a token that was already used', async () => {
      const { token } = await registerAndGetRefreshToken();
      await refreshOk(token);

      expectRejected(await refresh(token));
    });

    it('revokes the whole family when an old token is reused', async () => {
      const { token: stolen } = await registerAndGetRefreshToken();
      const legit = await refreshOk(stolen); // เจ้าของ refresh ไปแล้ว

      expectRejected(await refresh(stolen)); // คนร้ายเอาตัวเก่ามาใช้
      expectRejected(await refresh(legit)); // ตัวล่าสุดของเจ้าของก็ถูกยกเลิกด้วย
      await expect(activeTokenCount()).resolves.toBe(0);
    });

    it('does not affect other sessions (other devices) of the same user', async () => {
      const { token: deviceA } = await registerAndGetRefreshToken();
      const loginB = await request(app)
        .post('/auth/login')
        .send({ email: account.email, password: account.password });
      const deviceB = getRefreshCookie(loginB)?.value ?? '';

      await refreshOk(deviceA);
      expectRejected(await refresh(deviceA)); // reuse บนเครื่อง A

      await refreshOk(deviceB); // เครื่อง B ยังใช้ได้
    });

    it('concurrent refreshes with the same token never yield two usable tokens', async () => {
      const { token } = await registerAndGetRefreshToken();

      const results = await Promise.all([refresh(token), refresh(token)]);
      const statuses = results.map((r) => r.status).sort();

      // ตัวแรกชนะ ตัวที่สองถูกมองว่าใช้ซ้ำ → ทั้ง family ถูกยกเลิก (นโยบายแบบเข้มงวด)
      // หมายเหตุ: 2 request นี้มักไม่ได้ "ชนกันจริง" ใน DB — race จริงทดสอบที่ session-race.test.ts
      expect(statuses).toEqual([200, 401]);
      await expect(activeTokenCount()).resolves.toBe(0);
      for (const res of results) {
        const issued = getRefreshCookie(res)?.value;
        if (issued) expectRejected(await refresh(issued));
      }
    });
  });

  it('stores the new token as a hash only', async () => {
    const { token } = await registerAndGetRefreshToken();
    const next = await refreshOk(token);

    await expect(
      testPrisma.refreshToken.count({ where: { tokenHash: hashRefreshToken(next) } }),
    ).resolves.toBe(1);
    await expect(testPrisma.refreshToken.count({ where: { tokenHash: next } })).resolves.toBe(0);
  });
});
