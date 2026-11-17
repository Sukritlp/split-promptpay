import { describe, expect, it } from 'vitest';
import { generateInviteCode, isWellFormedInviteCode } from '../../src/lib/invite-code.js';

describe('invite codes', () => {
  it('are 22-character base64url strings (128 bit)', () => {
    const code = generateInviteCode();

    expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(Buffer.from(code, 'base64url')).toHaveLength(16);
  });

  it('are URL-safe without encoding', () => {
    const code = generateInviteCode();

    expect(encodeURIComponent(code)).toBe(code);
  });

  it('are different every time', () => {
    const codes = new Set(Array.from({ length: 1000 }, generateInviteCode));

    expect(codes.size).toBe(1000);
  });

  describe('isWellFormedInviteCode', () => {
    it('accepts generated codes', () => {
      expect(isWellFormedInviteCode(generateInviteCode())).toBe(true);
    });

    it.each([
      ['undefined', undefined],
      ['number', 42],
      ['empty', ''],
      ['too short', 'a'.repeat(21)],
      ['too long', 'a'.repeat(23)],
      ['padding', `${'a'.repeat(21)}=`],
      ['slash (not base64url)', `${'a'.repeat(21)}/`],
      ['path traversal', '../../../../etc/passwd'],
      ['huge', 'a'.repeat(10_000)],
    ])('rejects %s', (_label, value) => {
      expect(isWellFormedInviteCode(value)).toBe(false);
    });
  });
});
