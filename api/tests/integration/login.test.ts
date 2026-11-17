import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { ErrorResponse } from '../../src/lib/http-error.js';
import type { AuthResult } from '../../src/modules/auth/auth.service.js';
import { buildTestApp } from '../helpers/app.js';
import { resetDatabase, testPrisma } from '../helpers/db.js';

const { app, jwt } = buildTestApp();

const account = { name: 'Somchai', email: 'somchai@example.com', password: 'correct-horse-1' };

function login(body: object) {
  return request(app).post('/api/auth/login').send(body);
}

async function registerAccount(overrides: Partial<typeof account> = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ ...account, ...overrides });
  expect(res.status).toBe(201);
  return res.body as AuthResult;
}

function expectInvalidCredentials(res: request.Response) {
  expect(res.status).toBe(401);
  expect(res.body as ErrorResponse).toEqual({
    error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' },
  });
}

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('POST /auth/login', () => {
  describe('success', () => {
    it('returns 200 with the user and a valid access token', async () => {
      const registered = await registerAccount();

      const res = await login({ email: account.email, password: account.password });
      const body = res.body as AuthResult;

      expect(res.status).toBe(200);
      expect(body.user).toEqual(registered.user);
      await expect(jwt.verifyAccessToken(body.accessToken)).resolves.toEqual({
        userId: registered.user.id,
      });
    });

    it('matches email regardless of case and surrounding whitespace', async () => {
      await registerAccount();

      const res = await login({ email: '  SOMCHAI@Example.com ', password: account.password });

      expect(res.status).toBe(200);
    });

    it('keeps spaces in passwords exactly as typed (not trimmed)', async () => {
      await registerAccount({ password: '  spaced pass  ' });

      expect((await login({ email: account.email, password: '  spaced pass  ' })).status).toBe(200);
      expectInvalidCredentials(await login({ email: account.email, password: 'spaced pass' }));
    });

    it('never returns the password hash', async () => {
      await registerAccount();

      const res = await login({ email: account.email, password: account.password });

      expect(res.text).not.toContain('passwordHash');
      expect(res.text).not.toContain('$argon2');
    });
  });

  describe('failure (same response for every case → no user enumeration)', () => {
    it('rejects a wrong password', async () => {
      await registerAccount();

      expectInvalidCredentials(await login({ email: account.email, password: 'wrong-password' }));
    });

    it('rejects a password with different letter case', async () => {
      await registerAccount();

      expectInvalidCredentials(await login({ email: account.email, password: 'CORRECT-HORSE-1' }));
    });

    it('rejects an email that is not registered', async () => {
      expectInvalidCredentials(await login({ email: 'nobody@example.com', password: 'whatever1' }));
    });

    it('rejects a Google-only account that has no password (and does not crash)', async () => {
      await testPrisma.user.create({ data: { name: 'Google User', email: 'g@example.com' } });

      expectInvalidCredentials(await login({ email: 'g@example.com', password: 'anything1' }));
    });

    it('rejects an account whose stored hash is corrupted (and does not crash)', async () => {
      await testPrisma.user.create({
        data: { name: 'Broken', email: 'broken@example.com', passwordHash: 'not-a-hash' },
      });

      expectInvalidCredentials(await login({ email: 'broken@example.com', password: 'anything1' }));
    });
  });

  describe('validation', () => {
    it.each([
      ['missing email', { password: 'x' }],
      ['invalid email', { email: 'nope', password: 'x' }],
      ['missing password', { email: account.email }],
      ['empty password', { email: account.email, password: '' }],
      ['password too long', { email: account.email, password: 'a'.repeat(129) }],
    ])('rejects %s with 400', async (_label, body) => {
      const res = await login(body);

      expect(res.status).toBe(400);
      expect((res.body as ErrorResponse).error.code).toBe('VALIDATION_ERROR');
    });

    it('does not enforce the 8-character minimum on login', async () => {
      // รหัสสั้นตอนล็อกอินควรได้ 401 (ผิด) ไม่ใช่ 400 ที่บอกใบ้กฎการตั้งรหัส
      expectInvalidCredentials(await login({ email: account.email, password: 'short' }));
    });
  });
});
