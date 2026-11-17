import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { ErrorResponse } from '../../src/lib/http-error.js';
import type { AuthResult } from '../../src/modules/auth/auth.service.js';
import { buildTestApp } from '../helpers/app.js';
import { resetDatabase, testPrisma } from '../helpers/db.js';

const { app, jwt } = buildTestApp();

const valid = { name: 'Somchai', email: 'somchai@example.com', password: 'correct-horse-1' };

function register(body: object) {
  return request(app).post('/auth/register').send(body);
}

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('POST /auth/register', () => {
  describe('success', () => {
    it('returns 201 with the public user and an access token', async () => {
      const res = await register(valid);
      const body = res.body as AuthResult;

      expect(res.status).toBe(201);
      expect(body.user).toEqual({
        id: expect.any(String) as string,
        name: 'Somchai',
        email: 'somchai@example.com',
        promptpayId: null,
        createdAt: expect.any(String) as string,
      });
      expect(typeof body.accessToken).toBe('string');
    });

    it('issues an access token for the new user', async () => {
      const body = (await register(valid)).body as AuthResult;

      await expect(jwt.verifyAccessToken(body.accessToken)).resolves.toEqual({
        userId: body.user.id,
      });
    });

    it('never returns the password or its hash', async () => {
      const res = await register(valid);

      expect(res.text).not.toContain('passwordHash');
      expect(res.text).not.toContain(valid.password);
      expect(res.text).not.toContain('$argon2');
    });

    it('stores an argon2id hash, not the plain password', async () => {
      await register(valid);
      const user = await testPrisma.user.findUniqueOrThrow({ where: { email: valid.email } });

      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.passwordHash).not.toContain(valid.password);
    });

    it('normalizes email (trim + lowercase) and trims the name', async () => {
      const res = await register({
        ...valid,
        name: '  Somchai  ',
        email: '  SomChai@Example.COM ',
      });
      const body = res.body as AuthResult;

      expect(res.status).toBe(201);
      expect(body.user.email).toBe('somchai@example.com');
      expect(body.user.name).toBe('Somchai');
    });

    it('accepts Thai names', async () => {
      const res = await register({ ...valid, name: 'สมชาย ใจดี' });

      expect(res.status).toBe(201);
      expect((res.body as AuthResult).user.name).toBe('สมชาย ใจดี');
    });

    it('ignores fields the client is not allowed to set (mass assignment)', async () => {
      const res = await register({
        ...valid,
        id: '00000000-0000-0000-0000-000000000000',
        passwordHash: 'attacker-controlled',
        promptpayId: '0812345678',
      });
      const user = await testPrisma.user.findUniqueOrThrow({ where: { email: valid.email } });

      expect(res.status).toBe(201);
      expect(user.id).not.toBe('00000000-0000-0000-0000-000000000000');
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.promptpayId).toBeNull();
    });
  });

  describe('duplicate email', () => {
    it('returns 409 EMAIL_TAKEN', async () => {
      await register(valid);
      const res = await register({ ...valid, name: 'Other' });

      expect(res.status).toBe(409);
      expect((res.body as ErrorResponse).error.code).toBe('EMAIL_TAKEN');
    });

    it('treats different letter case and whitespace as the same email', async () => {
      await register(valid);
      const res = await register({ ...valid, email: ' SOMCHAI@example.com' });

      expect(res.status).toBe(409);
      await expect(testPrisma.user.count()).resolves.toBe(1);
    });

    it('handles two simultaneous sign-ups with the same email (race condition)', async () => {
      const results = await Promise.all([register(valid), register(valid), register(valid)]);
      const statuses = results.map((r) => r.status).sort();

      expect(statuses).toEqual([201, 409, 409]);
      await expect(testPrisma.user.count()).resolves.toBe(1);
    });
  });

  describe('validation', () => {
    it.each([
      ['missing name', { email: valid.email, password: valid.password }, 'name'],
      ['blank name', { ...valid, name: '   ' }, 'name'],
      ['name too long', { ...valid, name: 'ก'.repeat(101) }, 'name'],
      ['missing email', { name: valid.name, password: valid.password }, 'email'],
      ['invalid email', { ...valid, email: 'not-an-email' }, 'email'],
      ['email too long', { ...valid, email: `${'a'.repeat(250)}@x.co` }, 'email'],
      ['missing password', { name: valid.name, email: valid.email }, 'password'],
      ['password too short (7)', { ...valid, password: '1234567' }, 'password'],
      ['password too long (129)', { ...valid, password: 'a'.repeat(129) }, 'password'],
      ['password not a string', { ...valid, password: 12345678 }, 'password'],
    ])('rejects %s', async (_label, body, field) => {
      const res = await register(body);
      const error = (res.body as ErrorResponse).error;

      expect(res.status).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: field })]),
      );
      await expect(testPrisma.user.count()).resolves.toBe(0);
    });

    it.each([
      ['8 characters', '12345678'],
      ['128 characters', 'a'.repeat(128)],
    ])('accepts a password of exactly %s', async (_label, password) => {
      const res = await register({ ...valid, password });

      expect(res.status).toBe(201);
    });
  });
});
