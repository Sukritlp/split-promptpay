import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { resetDatabase, testPrisma } from '../helpers/db.js';

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('test database', () => {
  it('is migrated and starts empty', async () => {
    await expect(testPrisma.user.count()).resolves.toBe(0);
  });

  it('enforces unique email at the database level', async () => {
    await testPrisma.user.create({ data: { name: 'A', email: 'a@example.com' } });

    await expect(
      testPrisma.user.create({ data: { name: 'B', email: 'a@example.com' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('is reset between tests', async () => {
    await expect(testPrisma.user.count()).resolves.toBe(0);
  });

  it('GET /ready returns 200 against a real database', async () => {
    const res = await request(buildTestApp().app).get('/api/ready');

    expect(res.status).toBe(200);
  });
});
