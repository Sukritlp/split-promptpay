/**
 * ตรวจค่า ?next= ก่อนพาผู้ใช้ไปหลังล็อกอิน (กัน open redirect)
 *
 * open redirect คืออะไร: คนร้ายส่งลิงก์ https://เว็บเรา/login?next=https://เว็บปลอม
 * ผู้ใช้เห็นโดเมนจริง กดล็อกอิน แล้วถูกพาไปเว็บปลอมที่หน้าตาเหมือนกัน → หลอกเอาข้อมูลต่อ
 *
 * รับเฉพาะ path ภายในเว็บเรา เช่น /groups/abc?tab=x — อย่างอื่นใช้ fallback
 */

const DEFAULT_REDIRECT = '/groups';
const BASE = 'https://app.invalid'; // origin สมมติ ใช้ให้ URL parser ช่วยตีความ path
const AUTH_PAGES = new Set(['/login', '/register']);
const MAX_LENGTH = 2048;

export function safeRedirect(value: unknown, fallback: string = DEFAULT_REDIRECT): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_LENGTH) {
    return fallback;
  }

  // ต้องเป็น path แบบ absolute ภายในเว็บ: ขึ้นต้นด้วย "/" ตัวเดียว
  // "//evil.com" = protocol-relative URL → ไปโดเมนอื่น
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;

  // browser ถือว่า "\" เท่ากับ "/" (/\evil.com → //evil.com)
  // และ URL parser ตัด tab/newline ทิ้ง (/\t/evil.com → //evil.com) → ไม่รับตั้งแต่แรก
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return fallback;
  }
  // ด่านสุดท้าย: หลังตีความแล้วต้องยังอยู่ origin เดิม
  if (url.origin !== BASE) return fallback;

  // ไม่พากลับไปหน้า login/register (วนไม่จบ)
  if (AUTH_PAGES.has(url.pathname)) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}
