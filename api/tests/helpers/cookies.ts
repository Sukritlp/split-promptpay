import type { Response } from 'supertest';
import { REFRESH_COOKIE_NAME } from '../../src/modules/auth/auth.cookies.js';

export interface ParsedCookie {
  value: string;
  /** ชื่อ attribute เป็นตัวเล็กทั้งหมด เช่น httponly, path, samesite, expires */
  attributes: Record<string, string | true>;
}

function setCookieHeaders(res: Response): string[] {
  const raw = res.headers['set-cookie'] as string[] | string | undefined;
  if (raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/** อ่าน Set-Cookie ของ refresh_token จาก response (undefined ถ้าไม่ได้ตั้ง) */
export function getRefreshCookie(res: Response): ParsedCookie | undefined {
  const header = setCookieHeaders(res).find((h) => h.startsWith(`${REFRESH_COOKIE_NAME}=`));
  if (!header) return undefined;

  const [pair = '', ...attrs] = header.split(';').map((s) => s.trim());
  const attributes: Record<string, string | true> = {};
  for (const attr of attrs) {
    const i = attr.indexOf('=');
    if (i === -1) attributes[attr.toLowerCase()] = true;
    else attributes[attr.slice(0, i).toLowerCase()] = attr.slice(i + 1);
  }
  return { value: decodeURIComponent(pair.slice(REFRESH_COOKIE_NAME.length + 1)), attributes };
}

/** ค่าสำหรับใส่ header Cookie ตอนส่ง request ถัดไป */
export function refreshCookieHeader(token: string): string {
  return `${REFRESH_COOKIE_NAME}=${encodeURIComponent(token)}`;
}
