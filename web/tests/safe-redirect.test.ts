import { describe, expect, it } from 'vitest';
import { safeRedirect } from '@/lib/safe-redirect';

describe('safeRedirect', () => {
  it.each([
    ['/groups', '/groups'],
    ['/groups/abc', '/groups/abc'],
    ['/groups?tab=members', '/groups?tab=members'],
    ['/groups#settle', '/groups#settle'],
    ['/join/abc123?ref=line', '/join/abc123?ref=line'],
    ['/กลุ่ม', '/%E0%B8%81%E0%B8%A5%E0%B8%B8%E0%B9%88%E0%B8%A1'], // ถูก encode เป็น path ปกติ
    ['/groups/../me', '/me'], // normalize แล้วยังอยู่ในเว็บ
  ])('allows internal path %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });

  it.each([
    ['absolute URL', 'https://evil.com'],
    ['http URL', 'http://evil.com/groups'],
    ['protocol-relative', '//evil.com'],
    ['protocol-relative with path', '//evil.com/groups'],
    ['backslash trick', '/\\evil.com'],
    ['backslash in middle', '/groups\\..\\..\\evil.com'],
    ['tab trick', '/\t/evil.com'],
    ['newline trick', '/\n/evil.com'],
    ['javascript: URL', 'javascript:alert(1)'],
    ['data: URL', 'data:text/html,<script>alert(1)</script>'],
    ['relative path', 'groups'],
    ['empty', ''],
    ['very long', `/${'a'.repeat(3000)}`],
    ['back to login (loop)', '/login'],
    ['back to login with query', '/login?next=/groups'],
    ['back to register', '/register'],
  ])('rejects %s', (_label, input) => {
    expect(safeRedirect(input)).toBe('/groups');
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['number', 42],
    ['array (repeated ?next=)', ['/a', '/b']],
  ])('rejects non-string %s', (_label, input) => {
    expect(safeRedirect(input)).toBe('/groups');
  });

  it('uses a custom fallback', () => {
    expect(safeRedirect('https://evil.com', '/')).toBe('/');
  });
});
