import { SignJWT, UnsecuredJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../../src/lib/http-error.js';
import { createJwtService } from '../../src/lib/jwt.js';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
const USER_ID = '6f1c2a3e-7b4d-4c8e-9f10-1a2b3c4d5e6f';
const jwt = createJwtService({ secret: SECRET, accessTokenTtl: '15m' });
const key = new TextEncoder().encode(SECRET);

interface Claims {
  sub?: string;
  iss?: string;
  aud?: string;
  exp?: number | string;
}

function sign(claims: Claims): Promise<string> {
  const token = new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(claims.iss ?? 'split-promptpay-api')
    .setAudience(claims.aud ?? 'split-promptpay-web')
    .setExpirationTime(claims.exp ?? '15m');
  if (claims.sub !== undefined) token.setSubject(claims.sub);
  return token.sign(key);
}

async function expectInvalid(token: string): Promise<void> {
  const err: unknown = await jwt.verifyAccessToken(token).catch((e: unknown) => e);

  expect(err).toBeInstanceOf(HttpError);
  expect(err).toMatchObject({ status: 401, code: 'INVALID_TOKEN' });
}

function decodePayload(token: string): Record<string, unknown> {
  const part = token.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(part, 'base64url').toString()) as Record<string, unknown>;
}

describe('JwtService', () => {
  it('round-trips the user id', async () => {
    const token = await jwt.signAccessToken({ userId: USER_ID });

    await expect(jwt.verifyAccessToken(token)).resolves.toEqual({ userId: USER_ID });
  });

  it('puts only standard claims in the payload', async () => {
    const token = await jwt.signAccessToken({ userId: USER_ID });

    expect(Object.keys(decodePayload(token)).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'sub']);
  });

  it('rejects an expired token', async () => {
    await expectInvalid(await sign({ sub: USER_ID, exp: Math.floor(Date.now() / 1000) - 10 }));
  });

  it('rejects a token signed with a different secret', async () => {
    const other = createJwtService({
      secret: 'another-secret-that-is-also-32-chars-long',
      accessTokenTtl: '15m',
    });

    await expectInvalid(await other.signAccessToken({ userId: USER_ID }));
  });

  it('rejects a tampered payload', async () => {
    const [header, , signature] = (await jwt.signAccessToken({ userId: USER_ID })).split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'someone-else' })).toString('base64url');

    await expectInvalid(`${header}.${forged}.${signature}`);
  });

  it('rejects alg: none', async () => {
    const unsigned = new UnsecuredJWT({})
      .setSubject(USER_ID)
      .setIssuer('split-promptpay-api')
      .setAudience('split-promptpay-web')
      .setExpirationTime('15m')
      .encode();

    await expectInvalid(unsigned);
  });

  it('rejects the wrong issuer or audience', async () => {
    await expectInvalid(await sign({ sub: USER_ID, iss: 'evil' }));
    await expectInvalid(await sign({ sub: USER_ID, aud: 'evil' }));
  });

  it('rejects a token without sub', async () => {
    await expectInvalid(await sign({}));
  });

  it.each(['', 'garbage', 'a.b.c'])('rejects malformed token "%s"', async (token) => {
    await expectInvalid(token);
  });
});
