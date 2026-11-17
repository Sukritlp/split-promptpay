import type { Request, RequestHandler } from 'express';
import { HttpError } from '../lib/http-error.js';
import type { JwtService } from '../lib/jwt.js';

/** อ่าน token จาก header `Authorization: Bearer <token>` (คำว่า Bearer ไม่สนตัวพิมพ์ใหญ่เล็ก) */
function readBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match?.[1] ?? null;
}

/**
 * ใส่หน้า route ที่ต้องล็อกอิน: ตรวจ access token แล้วใส่ req.auth = { userId }
 * - ไม่มี token → 401 UNAUTHENTICATED
 * - token ผิด/หมดอายุ → 401 INVALID_TOKEN (ฝั่ง web ใช้ code นี้ตัดสินใจว่าจะ refresh token)
 */
export function requireAuth(jwt: JwtService): RequestHandler {
  return async (req, _res, next) => {
    const token = readBearerToken(req.headers.authorization);
    if (!token) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Missing bearer token');
    }
    req.auth = await jwt.verifyAccessToken(token);
    next();
  };
}

/** ใช้ใน handler ที่อยู่หลัง requireAuth — ถ้าลืมใส่ requireAuth จะ throw แทนที่จะปล่อยผ่านเงียบๆ */
export function getAuth(req: Request): { userId: string } {
  if (!req.auth) {
    throw new Error('getAuth() called on a route without requireAuth');
  }
  return req.auth;
}
