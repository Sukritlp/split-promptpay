import { describe, expect, it } from 'vitest';
import {
  generateRefreshToken,
  hashRefreshToken,
  isWellFormedRefreshToken,
} from '../../src/lib/refresh-token.js';

describe('refresh token helpers', () => {
  it('generates 43-character base64url tokens (256 bit)', () => {
    const token = generateRefreshToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('generates a different token every time', () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateRefreshToken));

    expect(tokens.size).toBe(1000);
  });

  it('hashes deterministically with SHA-256', () => {
    const token = generateRefreshToken();

    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(Buffer.from(hashRefreshToken(token), 'base64url')).toHaveLength(32);
  });

  it('hash never equals or contains the token', () => {
    const token = generateRefreshToken();

    expect(hashRefreshToken(token)).not.toContain(token);
  });

  it('different tokens produce different hashes', () => {
    expect(hashRefreshToken(generateRefreshToken())).not.toBe(
      hashRefreshToken(generateRefreshToken()),
    );
  });

  describe('isWellFormedRefreshToken', () => {
    it('accepts generated tokens', () => {
      expect(isWellFormedRefreshToken(generateRefreshToken())).toBe(true);
    });

    it.each([
      ['undefined', undefined],
      ['number', 123],
      ['empty', ''],
      ['too short', 'a'.repeat(42)],
      ['too long', 'a'.repeat(44)],
      ['base64 padding/symbols', `${'a'.repeat(42)}=`],
      ['contains a dot', `${'a'.repeat(42)}.`],
      ['huge string', 'a'.repeat(10_000)],
    ])('rejects %s', (_label, value) => {
      expect(isWellFormedRefreshToken(value)).toBe(false);
    });
  });
});
