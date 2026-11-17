/**
 * Invite code ของกลุ่ม: สุ่ม 128 bit แล้ว encode เป็น base64url (22 ตัวอักษร)
 *
 * ใครได้ลิงก์ก็เข้าร่วมกลุ่มได้ → code ต้องเดาไม่ได้
 * 128 bit = 3.4 × 10^38 แบบ ต่อให้ลองวินาทีละล้านครั้งก็ใช้เวลานานกว่าอายุจักรวาล
 * จึงไม่ต้องทำ rate limit เฉพาะ endpoint นี้
 *
 * ต่างจาก refresh token ตรงที่เก็บตัวจริง (ไม่ hash): สมาชิกต้องเปิดดู/คัดลอกลิงก์ซ้ำได้
 * ความเสี่ยงต่ำกว่า (ได้แค่เข้ากลุ่ม ไม่ได้สวมรอยเป็นใคร) และ owner reset ได้ถ้าลิงก์หลุด
 */
import { randomBytes } from 'node:crypto';

const CODE_BYTES = 16; // 128 bit
const CODE_PATTERN = /^[A-Za-z0-9_-]{22}$/; // 16 bytes → base64url 22 ตัว (ไม่มี padding)

export function generateInviteCode(): string {
  return randomBytes(CODE_BYTES).toString('base64url');
}

/** ตรวจรูปแบบก่อนแตะ DB — code ขยะ/ยาวผิดปกติถูกปัดตกทันที */
export function isWellFormedInviteCode(code: unknown): code is string {
  return typeof code === 'string' && CODE_PATTERN.test(code);
}
