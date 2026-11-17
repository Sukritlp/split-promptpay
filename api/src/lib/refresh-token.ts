/**
 * Refresh token แบบ opaque: สตริงสุ่ม 256 bit ไม่ใช่ JWT
 * - ไม่มีข้อมูลข้างใน → ต้องค้น DB ทุกครั้ง จึง "ยกเลิก" ได้จริง (JWT ทำไม่ได้จนกว่าจะหมดอายุ)
 * - DB เก็บแค่ SHA-256 ของ token
 *
 * ทำไม SHA-256 ไม่ใช่ argon2 แบบรหัสผ่าน?
 * รหัสผ่านคนตั้งเองจึงเดาง่าย ต้องใช้ hash ที่ "ช้า" ให้เดาแพง
 * แต่ token นี้สุ่ม 256 bit เดาไม่ได้อยู่แล้ว hash เร็วก็พอ และค้นใน DB ด้วย hash ได้ตรงๆ
 */
import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32; // 256 bit
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/; // 32 bytes → base64url ยาว 43 ตัว (ไม่มี padding)

export function generateRefreshToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

/** ตรวจรูปแบบก่อนแตะ DB — cookie ขยะ/ยาวผิดปกติถูกปัดตกทันที */
export function isWellFormedRefreshToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}
