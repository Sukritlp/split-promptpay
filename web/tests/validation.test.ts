import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema, validate } from '@/lib/validation';

const valid = { name: 'สมชาย', email: 'somchai@example.com', password: 'correct-horse-1' };

describe('registerSchema', () => {
  it('accepts valid input and normalizes email and name', () => {
    expect(
      validate(registerSchema, { ...valid, name: '  สมชาย ', email: ' SomChai@Example.COM ' }),
    ).toEqual({
      data: { name: 'สมชาย', email: 'somchai@example.com', password: 'correct-horse-1' },
    });
  });

  it('keeps spaces in the password', () => {
    expect(validate(registerSchema, { ...valid, password: '  spaced  ' }).data?.password).toBe(
      '  spaced  ',
    );
  });

  it.each([
    ['blank name', { ...valid, name: '   ' }, 'name', 'กรุณากรอกชื่อ'],
    ['name > 100', { ...valid, name: 'ก'.repeat(101) }, 'name', 'ชื่อยาวได้ไม่เกิน 100 ตัวอักษร'],
    ['empty email', { ...valid, email: '' }, 'email', 'กรุณากรอกอีเมล'],
    ['bad email', { ...valid, email: 'nope' }, 'email', 'รูปแบบอีเมลไม่ถูกต้อง'],
    ['password 7', { ...valid, password: '1234567' }, 'password', 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'],
    [
      'password 129',
      { ...valid, password: 'a'.repeat(129) },
      'password',
      'รหัสผ่านยาวได้ไม่เกิน 128 ตัวอักษร',
    ],
  ])('rejects %s with a Thai message', (_label, input, field, message) => {
    expect(validate(registerSchema, input).errors).toEqual({ [field]: message });
  });

  it.each([8, 128])('accepts a password of exactly %i characters', (n) => {
    expect(validate(registerSchema, { ...valid, password: 'a'.repeat(n) }).errors).toBeUndefined();
  });

  it('reports one message per field (the first problem)', () => {
    const { errors } = validate(registerSchema, { name: '', email: '', password: '' });

    expect(Object.keys(errors ?? {}).sort()).toEqual(['email', 'name', 'password']);
    expect(errors?.email).toBe('กรุณากรอกอีเมล');
  });
});

describe('loginSchema', () => {
  it('does not enforce the 8-character minimum (do not hint the password rules)', () => {
    expect(validate(loginSchema, { email: valid.email, password: 'short' }).errors).toBeUndefined();
  });

  it('requires a password', () => {
    expect(validate(loginSchema, { email: valid.email, password: '' }).errors).toEqual({
      password: 'กรุณากรอกรหัสผ่าน',
    });
  });
});
