import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { HealthResponse } from '../src/routes/health.js';

describe('GET /health', () => {
  const app = createApp();

  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('includes uptime and an ISO timestamp', async () => {
    const res = await request(app).get('/health');
    // Supertest ให้ body เป็น any — ระบุ type เองเพื่อให้ ESLint/TS ช่วยเช็ค
    const body = res.body as HealthResponse;

    expect(typeof body.uptime).toBe('number');
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('does not expose the x-powered-by header', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/does-not-exist');

    expect(res.status).toBe(404);
  });
});
