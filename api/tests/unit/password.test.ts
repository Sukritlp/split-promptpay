import { describe, expect, it } from 'vitest';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../../src/lib/password.js';

describe('password hashing', () => {
  it('produces an argon2id hash with the OWASP cost parameters', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it('never contains the plain password', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(hash).not.toContain('correct horse');
  });

  it('salts each hash (same password gives different hashes)', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password'),
      hashPassword('same-password'),
    ]);

    expect(a).not.toBe(b);
  });

  it('verifies the correct password', async () => {
    const hash = await hashPassword('s3cret-pass');

    await expect(verifyPassword(hash, 's3cret-pass')).resolves.toBe(true);
  });

  it.each(['wrong-pass', 'S3cret-pass', 's3cret-pass ', ''])('rejects "%s"', async (attempt) => {
    const hash = await hashPassword('s3cret-pass');

    await expect(verifyPassword(hash, attempt)).resolves.toBe(false);
  });

  it('handles non-ASCII (Thai) passwords', async () => {
    const hash = await hashPassword('รหัสผ่านภาษาไทย123');

    await expect(verifyPassword(hash, 'รหัสผ่านภาษาไทย123')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'รหัสผ่านภาษาไทย124')).resolves.toBe(false);
  });

  it('returns false instead of throwing for a corrupted hash', async () => {
    await expect(verifyPassword('not-a-real-hash', 'anything')).resolves.toBe(false);
  });

  it('verifyAgainstDummy always returns false', async () => {
    await expect(verifyAgainstDummy('dummy-password-for-timing')).resolves.toBe(false);
  });
});
