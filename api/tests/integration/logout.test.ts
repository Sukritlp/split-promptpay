import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { generateRefreshToken } from '../../src/lib/refresh-token.js';
import type { AuthResult } from '../../src/modules/auth/auth.service.js';
import { buildTestApp } from '../helpers/app.js';
import { getRefreshCookie, refreshCookieHeader } from '../helpers/cookies.js';
import { resetDatabase, testPrisma } from '../helpers/db.js';

const { app } = buildTestApp();
const account = { name: 'Somchai', email: 'somchai@example.com', password: 'correct-horse-1' };

interface Device {
  refreshToken: string;
  accessToken: string;
}

function toDevice(res: request.Response): Device {
  return {
    refreshToken: getRefreshCookie(res)?.value ?? '',
    accessToken: (res.body as AuthResult).accessToken,
  };
}

async function registerDevice(): Promise<Device> {
  return toDevice(await request(app).post('/api/auth/register').send(account));
}

async function loginDevice(): Promise<Device> {
  return toDevice(
    await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: account.password }),
  );
}

function logout(token?: string) {
  const req = request(app).post('/api/auth/logout');
  return token === undefined ? req : req.set('Cookie', refreshCookieHeader(token));
}

function refresh(token: string) {
  return request(app).post('/api/auth/refresh').set('Cookie', refreshCookieHeader(token));
}

function expectCookieCleared(res: request.Response) {
  const cookie = getRefreshCookie(res);
  expect(cookie?.value).toBe('');
  expect(cookie?.attributes).toMatchObject({ path: '/api/auth', httponly: true });
  expect(new Date(cookie?.attributes.expires as string).getTime()).toBeLessThan(Date.now());
}

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('POST /auth/logout', () => {
  it('returns 204 with no body and clears the cookie', async () => {
    const { refreshToken } = await registerDevice();

    const res = await logout(refreshToken);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expectCookieCleared(res);
  });

  it('revokes the refresh token so it can no longer be used', async () => {
    const { refreshToken } = await registerDevice();

    await logout(refreshToken);

    expect((await refresh(refreshToken)).status).toBe(401);
    await expect(testPrisma.refreshToken.count({ where: { revokedAt: null } })).resolves.toBe(0);
  });

  it('works without an access token (it may already be expired)', async () => {
    const { refreshToken } = await registerDevice();

    expect((await logout(refreshToken)).status).toBe(204);
  });

  it('logging out with an older, already-rotated token still ends the session', async () => {
    const { refreshToken: old } = await registerDevice();
    const latest = getRefreshCookie(await refresh(old))?.value ?? '';

    await logout(old);

    expect((await refresh(latest)).status).toBe(401);
  });

  describe('only this device', () => {
    it('keeps other devices signed in', async () => {
      const phone = await registerDevice();
      const laptop = await loginDevice();

      await logout(phone.refreshToken);

      expect((await refresh(phone.refreshToken)).status).toBe(401);
      expect((await refresh(laptop.refreshToken)).status).toBe(200);
    });
  });

  describe('idempotent: always 204 and clears the cookie', () => {
    it('when called twice', async () => {
      const { refreshToken } = await registerDevice();
      await logout(refreshToken);

      const res = await logout(refreshToken);

      expect(res.status).toBe(204);
      expectCookieCleared(res);
    });

    it.each([
      ['no cookie', undefined],
      ['malformed cookie', 'garbage'],
      ['unknown token', generateRefreshToken()],
    ])('with %s', async (_label, token) => {
      const res = await logout(token);

      expect(res.status).toBe(204);
      expectCookieCleared(res);
    });

    it('a stranger cannot log someone else out without their token', async () => {
      const victim = await registerDevice();

      await logout(generateRefreshToken());

      expect((await refresh(victim.refreshToken)).status).toBe(200);
    });
  });

  it('access token keeps working until it expires (by design: JWTs are stateless)', async () => {
    // การ logout ยกเลิกได้แค่ refresh token — access token (อายุ 15 นาที) ยังใช้ได้จนหมดอายุ
    // นี่คือ trade-off ที่ตั้งใจ: ไม่ต้องค้น DB ทุก request แลกกับช่วงเวลาสั้นๆ ที่ token ยังใช้ได้
    const { refreshToken, accessToken } = await registerDevice();

    await logout(refreshToken);
    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${accessToken}`);

    expect(me.status).toBe(200);
  });
});
