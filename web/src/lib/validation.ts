/**
 * ตรวจฟอร์มฝั่ง browser ด้วยกฎเดียวกับ API (api/src/modules/auth/auth.schemas.ts)
 * จุดประสงค์คือบอกผู้ใช้เร็วขึ้น — API ยังตรวจซ้ำเสมอ ห้ามเชื่อการตรวจฝั่ง client อย่างเดียว
 */
import { z } from 'zod';

// trim + lowercase ก่อนตรวจรูปแบบ (zod 4: z.email().trim() จะตรวจก่อน trim)
const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'กรุณากรอกอีเมล')
  .max(254, 'อีเมลยาวเกินไป')
  .pipe(z.email('รูปแบบอีเมลไม่ถูกต้อง'));

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อ').max(100, 'ชื่อยาวได้ไม่เกิน 100 ตัวอักษร'),
  email,
  // ไม่ trim: ช่องว่างเป็นส่วนหนึ่งของรหัสผ่านได้
  password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').max(128, 'รหัสผ่านยาวได้ไม่เกิน 128 ตัวอักษร'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน').max(128, 'รหัสผ่านยาวเกินไป'),
});

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** คืน { data } ถ้าผ่าน หรือ { errors } เป็นข้อความแรกของแต่ละช่อง */
export function validate<S extends z.ZodType<Record<string, unknown>>>(
  schema: S,
  input: unknown,
):
  { data: z.infer<S>; errors?: undefined } | { data?: undefined; errors: FieldErrors<z.infer<S>> } {
  const result = schema.safeParse(input);
  if (result.success) return { data: result.data };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '');
    errors[key] ??= issue.message;
  }
  return { errors: errors as FieldErrors<z.infer<S>> };
}
