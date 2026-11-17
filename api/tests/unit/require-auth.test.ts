import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { HttpError, type ErrorResponse } from '../../src/lib/http-error.js';
import type { JwtService } from '../../src/lib/jwt.js';
import { errorHandler } from '../../src/middleware/error-handler.js';
import { getAuth, requireAuth } from '../../src/middleware/require-auth.js';

/** jwt ปลอม: ยอมรับเฉพาะ token "good" */
const fakeJwt: JwtService = {
  signAccessToken: () => Promise.reject(new Error('not used')),
  verifyAccessToken: (token) =>
    token === 'good'
      ? Promise.resolve({ userId: 'user-1' })
      : Promise.reject(new HttpError(401, 'INVALID_TOKEN', 'bad')),
};

function buildApp() {
  const app = express();
  app.get('/protected', requireAuth(fakeJwt), (req, res) => {
    res.json(getAuth(req));
  });
  app.get('/forgot-middleware', (req, res) => {
    res.json(getAuth(req));
  });
  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe('requireAuth', () => {
  it.each(['Bearer good', 'bearer good', 'BEARER good', 'Bearer   good', 'Bearer good  '])(
    'accepts header "%s"',
    async (header) => {
      const res = await request(app).get('/protected').set('Authorization', header);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ userId: 'user-1' });
    },
  );

  it.each(['', 'Bearer', 'Bearer ', 'good', 'Token good', 'Bearer good extra', 'Bearergood'])(
    'rejects header "%s" as UNAUTHENTICATED',
    async (header) => {
      const res = await request(app).get('/protected').set('Authorization', header);

      expect(res.status).toBe(401);
      expect((res.body as ErrorResponse).error.code).toBe('UNAUTHENTICATED');
    },
  );

  it('passes INVALID_TOKEN through from the jwt service', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Bearer bad');

    expect(res.status).toBe(401);
    expect((res.body as ErrorResponse).error.code).toBe('INVALID_TOKEN');
  });
});

describe('getAuth', () => {
  it('fails loudly (500) when a route forgot requireAuth, instead of letting it through', async () => {
    const res = await request(app).get('/forgot-middleware').set('Authorization', 'Bearer good');

    expect(res.status).toBe(500);
  });
});
