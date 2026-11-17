import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { ErrorResponse } from '../../src/lib/http-error.js';
import type { AuthResult } from '../../src/modules/auth/auth.service.js';
import type { PublicUser } from '../../src/modules/users/public-user.js';
import { TEST_JWT_SECRET } from '../setup/test-env.js';
import { buildTestApp } from '../helpers/app.js';
import { resetDatabase, testPrisma } from '../helpers/db.js';

const { app, jwt } = buildTestApp();

async function registerAndGetToken(): Promise<AuthResult> {
  const res = await request(app)
    .post('/auth/register')
    .send({ name: 'Somchai', email: 'somchai@example.com', password: 'correct-horse-1' });
  return res.body as AuthResult;
}

function getMe(authorization?: string) {
  const req = request(app).get('/me');
  return authorization === undefined ? req : req.set('Authorization', authorization);
}

function expectErrorCode(res: request.Response, code: string) {
  expect(res.status).toBe(401);
  expect((res.body as ErrorResponse).error.code).toBe(code);
}

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('GET /me', () => {
  it('returns the current user for a valid token', async () => {
    const { user, accessToken } = await registerAndGetToken();

    const res = await getMe(`Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect((res.body as { user: PublicUser }).user).toEqual(user);
    expect(res.text).not.toContain('passwordHash');
  });

  it('works with a token from /auth/login too', async () => {
    await registerAndGetToken();
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'somchai@example.com', password: 'correct-horse-1' });

    const res = await getMe(`Bearer ${(login.body as AuthResult).accessToken}`);

    expect(res.status).toBe(200);
  });

  it('accepts a lowercase "bearer" scheme', async () => {
    const { accessToken } = await registerAndGetToken();

    expect((await getMe(`bearer ${accessToken}`)).status).toBe(200);
  });

  describe('missing token → 401 UNAUTHENTICATED', () => {
    it.each([
      ['no Authorization header', undefined],
      ['empty header', ''],
      ['"Bearer" with no token', 'Bearer '],
      ['a different scheme', 'Basic dXNlcjpwYXNz'],
    ])('%s', async (_label, header) => {
      expectErrorCode(await getMe(header), 'UNAUTHENTICATED');
    });

    it('token without the "Bearer" prefix', async () => {
      const { accessToken } = await registerAndGetToken();

      expectErrorCode(await getMe(accessToken), 'UNAUTHENTICATED');
    });
  });

  describe('bad token → 401 INVALID_TOKEN', () => {
    it('garbage token', async () => {
      expectErrorCode(await getMe('Bearer not.a.jwt'), 'INVALID_TOKEN');
    });

    it('expired token', async () => {
      const { user } = await registerAndGetToken();
      const expired = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(user.id)
        .setIssuer('split-promptpay-api')
        .setAudience('split-promptpay-web')
        .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
        .sign(new TextEncoder().encode(TEST_JWT_SECRET));

      expectErrorCode(await getMe(`Bearer ${expired}`), 'INVALID_TOKEN');
    });

    it('valid token for a user that was deleted', async () => {
      const { user, accessToken } = await registerAndGetToken();
      await testPrisma.user.delete({ where: { id: user.id } });

      expectErrorCode(await getMe(`Bearer ${accessToken}`), 'INVALID_TOKEN');
    });

    it('validly signed token whose sub is not a UUID (no 500)', async () => {
      const token = await jwt.signAccessToken({ userId: 'not-a-uuid' });

      expectErrorCode(await getMe(`Bearer ${token}`), 'INVALID_TOKEN');
    });
  });
});
