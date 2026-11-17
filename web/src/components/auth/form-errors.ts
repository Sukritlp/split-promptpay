import { ApiError } from '@/lib/api';

/** ข้อความภาษาไทยสำหรับ error code จาก API — แปลที่ฝั่ง web ไม่ใช้ข้อความภาษาอังกฤษของ API ตรงๆ */
export function formErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'INVALID_CREDENTIALS':
        return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      case 'NETWORK_ERROR':
        return 'ติดต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง';
      case 'VALIDATION_ERROR':
        return 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
    }
  }
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
}

/** VALIDATION_ERROR จาก API มี details: [{ path, message }] → ชื่อช่องที่ผิด */
export function invalidFieldsFrom(err: unknown): string[] {
  if (
    !(err instanceof ApiError) ||
    err.code !== 'VALIDATION_ERROR' ||
    !Array.isArray(err.details)
  ) {
    return [];
  }
  return err.details
    .map((d: unknown) =>
      typeof d === 'object' && d !== null ? (d as { path?: unknown }).path : null,
    )
    .filter((p): p is string => typeof p === 'string' && p !== '');
}
