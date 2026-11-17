/**
 * Hash รหัสผ่านด้วย argon2id (ค่าเริ่มต้นของ @node-rs/argon2)
 * ค่า cost ตาม OWASP Password Storage Cheat Sheet: m=19 MiB, t=2, p=1
 * - salt ถูกสุ่มให้อัตโนมัติและเก็บอยู่ในสตริง hash ($argon2id$v=19$m=...,t=...,p=...$salt$hash)
 * - ห้ามเก็บรหัสผ่านจริง และห้าม log รหัสผ่าน
 */
import { hash, verify } from '@node-rs/argon2';

const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

/** คืน false ถ้าไม่ตรง (ไม่ throw) — ถ้าสตริง hash เสียหาย ให้ถือว่าไม่ตรงด้วย */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * ใช้ตอนล็อกอินแล้ว "ไม่เจอ email": ยัง verify กับ hash ปลอมให้เสียเวลาเท่ากัน
 * ไม่งั้นคนร้ายจับเวลา response แล้วรู้ได้ว่า email ไหนมีในระบบ (user enumeration)
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword('dummy-password-for-timing');
  await verifyPassword(await dummyHash, password);
  return false;
}
