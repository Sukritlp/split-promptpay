import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { fakeDeps } from '../helpers/fakes.js';
import type { HealthResponse, ReadyResponse } from '../../src/routes/health.js';

const dbUp = () => Promise.resolve();
const dbDown = () => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:5432'));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /health', () => {
  const app = createApp(fakeDeps({ checkDb: dbUp }));

  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('includes uptime and an ISO timestamp', async () => {
    const res = await request(app).get('/api/health');
    // Supertest ให้ body เป็น any — ระบุ type เองเพื่อให้ ESLint/TS ช่วยเช็ค
    const body = res.body as HealthResponse;

    expect(typeof body.uptime).toBe('number');
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('does not touch the database', async () => {
    const checkDb = vi.fn(dbDown);
    const res = await request(createApp(fakeDeps({ checkDb }))).get('/api/health');

    expect(res.status).toBe(200);
    expect(checkDb).not.toHaveBeenCalled();
  });

  it('does not expose the x-powered-by header', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
  });

  it.each(['/health', '/ready'])('is not served outside /api (%s → 404)', async (path) => {
    const res = await request(app).get(path);

    expect(res.status).toBe(404);
  });
});

describe('GET /ready', () => {
  it('returns 200 when the database is up', async () => {
    const res = await request(createApp(fakeDeps({ checkDb: dbUp }))).get('/api/ready');

    expect(res.status).toBe(200);
    expect(res.body as ReadyResponse).toEqual({ status: 'ok', checks: { database: 'up' } });
  });

  it('returns 503 when the database is down', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(createApp(fakeDeps({ checkDb: dbDown }))).get('/api/ready');

    expect(res.status).toBe(503);
    expect(res.body as ReadyResponse).toEqual({
      status: 'unavailable',
      checks: { database: 'down' },
    });
  });

  it('does not leak the underlying error to the client', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(createApp(fakeDeps({ checkDb: dbDown }))).get('/api/ready');

    expect(res.text).not.toContain('ECONNREFUSED');
    expect(res.text).not.toContain('5432');
  });

  it('logs the underlying error on the server', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await request(createApp(fakeDeps({ checkDb: dbDown }))).get('/api/ready');

    expect(log).toHaveBeenCalledWith('Readiness check failed:', expect.any(Error));
  });
});
