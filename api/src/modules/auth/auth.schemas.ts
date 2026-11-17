import { z } from 'zod';

/**
 * email: trim + lowercase "ก่อน" ตรวจรูปแบบ
 * (zod 4 ถ้าเขียน z.email().trim() จะตรวจรูปแบบก่อน trim → "  a@b.co " ไม่ผ่าน)
 * 254 = ความยาวสูงสุดของ email ตาม RFC 5321
 */
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());

/**
 * password: ไม่ trim — ช่องว่างเป็นส่วนหนึ่งของรหัสผ่านได้
 * จำกัดสูงสุด 128 ตัวอักษร กันคนส่งข้อความยาวมากให้ server hash จนช้า (DoS)
 */
const password = z.string().min(8).max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email,
  password,
});

export const loginSchema = z.object({
  email,
  // ตอนล็อกอินไม่เช็คความยาวขั้นต่ำ: กฎอาจเปลี่ยนในอนาคต และไม่ควรบอกใบ้กฎให้คนเดารหัส
  password: z.string().min(1).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
