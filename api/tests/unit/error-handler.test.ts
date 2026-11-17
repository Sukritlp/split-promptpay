import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { HttpError, type ErrorResponse } from '../../src/lib/http-error.js';
import { errorHandler, notFoundHandler } from '../../src/middleware/error-handler.js';
import { validateBody } from '../../src/middleware/validate.js';

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '1kb' }));

  app.get('/http-error', () => {
    throw new HttpError(409, 'EMAIL_TAKEN', 'Email is already registered');
  });
  app.get('/bug', () => {
    throw new Error('database password is hunter2');
  });
  app.get('/async-bug', async () => {
    await Promise.resolve();
    throw new Error('async failure');
  });
  app.post(
    '/validated',
    validateBody(
      z.object({ email: z.string().trim().toLowerCase().pipe(z.email()), age: z.number().int() }),
    ),
    (req, res) => {
      res.json(req.body);
    },
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorHandler', () => {
  const app = buildApp();

  it('maps HttpError to its status and code', async () => {
    const res = await request(app).get('/http-error');

    expect(res.status).toBe(409);
    expect(res.body as ErrorResponse).toEqual({
      error: { code: 'EMAIL_TAKEN', message: 'Email is already registered' },
    });
  });

  it('hides details of unexpected errors behind a 500', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get('/bug');

    expect(res.status).toBe(500);
    expect(res.body as ErrorResponse).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
    expect(res.text).not.toContain('hunter2');
    expect(log).toHaveBeenCalled();
  });

  it('catches errors thrown from async handlers (Express 5)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get('/async-bug');

    expect(res.status).toBe(500);
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/nope');

    expect(res.status).toBe(404);
    expect((res.body as ErrorResponse).error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/validated')
      .set('Content-Type', 'application/json')
      .send('{"email": ');

    expect(res.status).toBe(400);
    expect((res.body as ErrorResponse).error.code).toBe('BAD_REQUEST');
  });

  it('returns 413 when the body is too large', async () => {
    const res = await request(app)
      .post('/validated')
      .send({ email: 'a@b.co', age: 1, junk: 'x'.repeat(2_000) });

    expect(res.status).toBe(413);
  });
});

describe('validateBody', () => {
  const app = buildApp();

  it('replaces req.body with parsed data and strips unknown fields', async () => {
    const res = await request(app)
      .post('/validated')
      .send({ email: '  Foo@Example.COM ', age: 20, isAdmin: true });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ email: 'foo@example.com', age: 20 });
  });

  it('returns 400 with the list of invalid fields', async () => {
    const res = await request(app).post('/validated').send({ email: 'nope', age: 1.5 });
    const body = res.body as ErrorResponse;

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'email' }),
        expect.objectContaining({ path: 'age' }),
      ]),
    );
  });

  it('returns 400 when the body is missing entirely', async () => {
    const res = await request(app).post('/validated');

    expect(res.status).toBe(400);
  });
});
