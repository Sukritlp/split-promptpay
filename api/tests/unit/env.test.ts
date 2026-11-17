import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/parse-env.js';

const DB = 'postgresql://user:secret@localhost:5432/app';
const SECRET = 'x'.repeat(32);
const BASE = { DATABASE_URL: DB, JWT_ACCESS_SECRET: SECRET };

function errorMessageOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return (err as Error).message;
  }
  throw new Error('expected function to throw');
}

describe('parseEnv', () => {
  it('uses defaults for optional values', () => {
    expect(parseEnv(BASE)).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      DATABASE_URL: DB,
      JWT_ACCESS_SECRET: SECRET,
      ACCESS_TOKEN_TTL: '15m',
      REFRESH_TOKEN_TTL_DAYS: 30,
      COOKIE_SAMESITE: 'lax',
    });
  });

  it('parses explicit values', () => {
    const env = parseEnv({ ...BASE, NODE_ENV: 'production', PORT: '8080', ACCESS_TOKEN_TTL: '1h' });

    expect(env.NODE_ENV).toBe('production');
    expect(env.PORT).toBe(8080);
    expect(env.ACCESS_TOKEN_TTL).toBe('1h');
  });

  it('accepts the postgres:// scheme', () => {
    expect(() => parseEnv({ ...BASE, DATABASE_URL: 'postgres://localhost/app' })).not.toThrow();
  });

  describe('NODE_ENV', () => {
    it('rejects unknown values', () => {
      expect(() => parseEnv({ ...BASE, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
    });
  });

  describe('PORT', () => {
    it.each(['abc', '0', '65536', '3000.5', '-1'])('rejects "%s"', (port) => {
      expect(() => parseEnv({ ...BASE, PORT: port })).toThrow(/PORT/);
    });

    it.each(['1', '65535'])('accepts boundary "%s"', (port) => {
      expect(parseEnv({ ...BASE, PORT: port }).PORT).toBe(Number(port));
    });
  });

  describe('DATABASE_URL', () => {
    it('is required', () => {
      expect(() => parseEnv({ JWT_ACCESS_SECRET: SECRET })).toThrow('DATABASE_URL is required');
    });

    it('rejects an empty string', () => {
      expect(() => parseEnv({ ...BASE, DATABASE_URL: '' })).toThrow('DATABASE_URL is required');
    });

    it('rejects a non-URL value', () => {
      expect(() => parseEnv({ ...BASE, DATABASE_URL: 'not a url' })).toThrow(/not a valid URL/);
    });

    it('rejects non-postgres schemes', () => {
      expect(() => parseEnv({ ...BASE, DATABASE_URL: 'mysql://localhost/app' })).toThrow(
        /postgresql/,
      );
    });

    it('does not leak the password in error messages', () => {
      for (const leaky of ['mysql://user:supersecret@localhost/app', 'supersecret not-a-url']) {
        const message = errorMessageOf(() => parseEnv({ ...BASE, DATABASE_URL: leaky }));

        expect(message).not.toContain('supersecret');
      }
    });
  });

  describe('JWT_ACCESS_SECRET', () => {
    it('is required', () => {
      expect(() => parseEnv({ DATABASE_URL: DB })).toThrow('JWT_ACCESS_SECRET is required');
    });

    it('rejects secrets shorter than 32 characters', () => {
      expect(() => parseEnv({ ...BASE, JWT_ACCESS_SECRET: 'x'.repeat(31) })).toThrow(/at least 32/);
    });

    it('does not echo the secret in error messages', () => {
      const message = errorMessageOf(() =>
        parseEnv({ ...BASE, JWT_ACCESS_SECRET: 'tooshort-secret' }),
      );

      expect(message).not.toContain('tooshort-secret');
    });
  });

  describe('ACCESS_TOKEN_TTL', () => {
    it.each(['15', 'm', '0m', '15 m', '15min', '-5m', '1.5h'])('rejects "%s"', (ttl) => {
      expect(() => parseEnv({ ...BASE, ACCESS_TOKEN_TTL: ttl })).toThrow(/ACCESS_TOKEN_TTL/);
    });

    it.each(['30s', '15m', '1h', '7d'])('accepts "%s"', (ttl) => {
      expect(parseEnv({ ...BASE, ACCESS_TOKEN_TTL: ttl }).ACCESS_TOKEN_TTL).toBe(ttl);
    });
  });

  describe('REFRESH_TOKEN_TTL_DAYS', () => {
    it.each(['0', '366', '1.5', 'abc', '-1'])('rejects "%s"', (days) => {
      expect(() => parseEnv({ ...BASE, REFRESH_TOKEN_TTL_DAYS: days })).toThrow(
        /REFRESH_TOKEN_TTL_DAYS/,
      );
    });

    it.each(['1', '365'])('accepts boundary "%s"', (days) => {
      expect(parseEnv({ ...BASE, REFRESH_TOKEN_TTL_DAYS: days }).REFRESH_TOKEN_TTL_DAYS).toBe(
        Number(days),
      );
    });
  });

  describe('COOKIE_SAMESITE', () => {
    it.each([
      ['lax', 'lax'],
      ['strict', 'strict'],
      ['none', 'none'],
      ['Lax', 'lax'],
    ])('accepts "%s"', (value, expected) => {
      expect(parseEnv({ ...BASE, COOKIE_SAMESITE: value }).COOKIE_SAMESITE).toBe(expected);
    });

    it('rejects unknown values', () => {
      expect(() => parseEnv({ ...BASE, COOKIE_SAMESITE: 'loose' })).toThrow(/COOKIE_SAMESITE/);
    });
  });
});
