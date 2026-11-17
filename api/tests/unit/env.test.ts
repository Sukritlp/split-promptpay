import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/parse-env.js';

const DB = 'postgresql://user:secret@localhost:5432/app';

describe('parseEnv', () => {
  it('uses defaults for NODE_ENV and PORT', () => {
    expect(parseEnv({ DATABASE_URL: DB })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: DB,
    });
  });

  it('parses explicit values', () => {
    const env = parseEnv({ NODE_ENV: 'production', PORT: '8080', DATABASE_URL: DB });

    expect(env.NODE_ENV).toBe('production');
    expect(env.PORT).toBe(8080);
  });

  it('accepts the postgres:// scheme', () => {
    expect(() => parseEnv({ DATABASE_URL: 'postgres://localhost/app' })).not.toThrow();
  });

  describe('NODE_ENV', () => {
    it('rejects unknown values', () => {
      expect(() => parseEnv({ NODE_ENV: 'staging', DATABASE_URL: DB })).toThrow(/NODE_ENV/);
    });
  });

  describe('PORT', () => {
    it.each(['abc', '0', '65536', '3000.5', '-1'])('rejects "%s"', (port) => {
      expect(() => parseEnv({ PORT: port, DATABASE_URL: DB })).toThrow(/PORT/);
    });

    it.each(['1', '65535'])('accepts boundary "%s"', (port) => {
      expect(parseEnv({ PORT: port, DATABASE_URL: DB }).PORT).toBe(Number(port));
    });
  });

  describe('DATABASE_URL', () => {
    it('is required', () => {
      expect(() => parseEnv({})).toThrow('DATABASE_URL is required');
    });

    it('rejects an empty string', () => {
      expect(() => parseEnv({ DATABASE_URL: '' })).toThrow('DATABASE_URL is required');
    });

    it('rejects a non-URL value', () => {
      expect(() => parseEnv({ DATABASE_URL: 'not a url' })).toThrow(/not a valid URL/);
    });

    it('rejects non-postgres schemes', () => {
      expect(() => parseEnv({ DATABASE_URL: 'mysql://localhost/app' })).toThrow(/postgresql/);
    });

    it('does not leak the password in error messages', () => {
      for (const leaky of ['mysql://user:supersecret@localhost/app', 'supersecret not-a-url']) {
        let message = '';
        try {
          parseEnv({ DATABASE_URL: leaky });
        } catch (err) {
          message = (err as Error).message;
        }

        expect(message).not.toBe(''); // ต้อง throw จริง
        expect(message).not.toContain('supersecret');
      }
    });
  });
});
