/**
 * ค่า cookie ของ refresh token อยู่ที่เดียว
 * สำคัญ: ตอนลบ cookie ต้องใช้ path/sameSite/secure ตรงกับตอนตั้ง ไม่งั้น browser จะไม่ลบให้
 */
import type { CookieOptions, Request, Response } from 'express';
import type { CookieSameSite } from '../../config/parse-env.js';
import type { IssuedRefreshToken } from './session.service.js';

export const REFRESH_COOKIE_NAME = 'refresh_token';

export interface RefreshCookieConfig {
  sameSite: CookieSameSite;
  /** true บน production (HTTPS) — SameSite=None บังคับให้เป็น true เสมอตามกฎของ browser */
  secure: boolean;
}

function baseOptions({ sameSite, secure }: RefreshCookieConfig): CookieOptions {
  return {
    httpOnly: true, // JavaScript ฝั่ง browser อ่านไม่ได้ → XSS ขโมย token ไม่ได้
    secure: secure || sameSite === 'none',
    sameSite,
    path: '/auth', // browser แนบ cookie เฉพาะ request ไป /auth/* เท่านั้น
  };
}

export function setRefreshCookie(
  res: Response,
  config: RefreshCookieConfig,
  { token, expiresAt }: IssuedRefreshToken,
): void {
  res.cookie(REFRESH_COOKIE_NAME, token, { ...baseOptions(config), expires: expiresAt });
}

export function clearRefreshCookie(res: Response, config: RefreshCookieConfig): void {
  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions(config));
}

export function readRefreshCookie(req: Request): unknown {
  // req.cookies มาจาก cookie-parser (type เป็น any) — ตรวจรูปแบบต่อที่ session service
  return (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE_NAME];
}
