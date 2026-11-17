import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { hashRefreshToken } from '../../src/lib/refresh-token.js';
import { buildTestApp } from '../helpers/app.js';
import { getRefreshCookie } from '../helpers/cookies.js';
import { resetDatabase, testPrisma } from '../helpers/db.js';

const account = { name: 'Somchai', email: 'somchai@example.com', password: 'correct-horse-1' };
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('refresh token cookie on register and login', () => {
  const { app } = buildTestApp();

  const flows = {
    register: () => request(app).post('/auth/register').send(account),
    login: async () => {
      await request(app).post('/auth/register').send(account);
      await testPrisma.refreshToken.deleteMany(); // ให้เหลือเฉพาะ token จาก login
      return request(app)
        .post('/auth/login')
        .send({ email: account.email, password: account.password });
    },
  };

  describe.each(Object.entries(flows))('%s', (_name, flow) => {
    it('sets an HttpOnly, Path=/auth, SameSite=Lax cookie', async () => {
      const cookie = getRefreshCookie(await flow());

      expect(cookie).toBeDefined();
      expect(cookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(cookie?.attributes).toMatchObject({ httponly: true, path: '/auth', samesite: 'Lax' });
    });

    it('is not Secure in development (so it works on http://localhost)', async () => {
      expect(getRefreshCookie(await flow())?.attributes.secure).toBeUndefined();
    });

    it('expires in about 30 days', async () => {
      const cookie = getRefreshCookie(await flow());
      const expires = new Date(cookie?.attributes.expires as string).getTime();

      expect(Math.abs(expires - (Date.now() + 30 * DAY_MS))).toBeLessThan(60_000);
    });

    it('does not put the refresh token in the JSON body', async () => {
      const res = await flow();
      const cookie = getRefreshCookie(res);

      expect(Object.keys(res.body as object).sort()).toEqual(['accessToken', 'user']);
      expect(res.text).not.toContain(cookie?.value);
    });

    it('stores only the SHA-256 hash in the database', async () => {
      const cookie = getRefreshCookie(await flow());
      const rows = await testPrisma.refreshToken.findMany();

      expect(rows).toHaveLength(1);
      expect(rows[0]?.tokenHash).toBe(hashRefreshToken(cookie?.value ?? ''));
      expect(JSON.stringify(rows)).not.toContain(cookie?.value);
    });
  });

  it('each login starts a separate session (new family)', async () => {
    await request(app).post('/auth/register').send(account);
    const creds = { email: account.email, password: account.password };
    await request(app).post('/auth/login').send(creds);
    await request(app).post('/auth/login').send(creds);

    const families = new Set((await testPrisma.refreshToken.findMany()).map((r) => r.familyId));

    expect(families.size).toBe(3);
  });

  it('does not set a cookie when login fails', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever1' });

    expect(res.status).toBe(401);
    expect(getRefreshCookie(res)).toBeUndefined();
  });
});

describe('cookie options', () => {
  it('adds Secure in production', async () => {
    const { app } = buildTestApp({ refreshCookie: { secure: true } });

    const cookie = getRefreshCookie(await request(app).post('/auth/register').send(account));

    expect(cookie?.attributes.secure).toBe(true);
  });

  it('forces Secure when SameSite=None (browsers reject it otherwise)', async () => {
    const { app } = buildTestApp({ refreshCookie: { sameSite: 'none', secure: false } });

    const cookie = getRefreshCookie(await request(app).post('/auth/register').send(account));

    expect(cookie?.attributes).toMatchObject({ samesite: 'None', secure: true });
  });

  it('uses REFRESH_TOKEN_TTL_DAYS for the expiry', async () => {
    const { app } = buildTestApp({ refreshTtlDays: 7 });

    await request(app).post('/auth/register').send(account);
    const row = await testPrisma.refreshToken.findFirstOrThrow();

    expect(Math.abs(row.expiresAt.getTime() - (Date.now() + 7 * DAY_MS))).toBeLessThan(60_000);
  });
});
