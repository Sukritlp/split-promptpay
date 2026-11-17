/**
 * Access token แบบ JWT (HS256) ด้วยไลบรารี jose
 * - อายุสั้น (ค่าเริ่มต้น 15 นาที) → ถ้าหลุดก็ใช้ได้ไม่นาน; ต่ออายุด้วย refresh token (PR ถัดไป)
 * - payload มีแค่ sub (user id) — JWT แค่ "เข้ารหัส base64" ไม่ได้ปิดบัง ใครก็อ่าน payload ได้
 *   จึงห้ามใส่ข้อมูลลับหรือข้อมูลส่วนตัว
 */
import { SignJWT, jwtVerify } from 'jose';
import { HttpError } from './http-error.js';

const ALG = 'HS256';
const ISSUER = 'split-promptpay-api';
const AUDIENCE = 'split-promptpay-web';

export interface JwtConfig {
  secret: string;
  /** รูปแบบของ jose เช่น '15m', '1h' */
  accessTokenTtl: string;
}

export interface AccessTokenPayload {
  userId: string;
}

export interface JwtService {
  signAccessToken(payload: AccessTokenPayload): Promise<string>;
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
}

export function createJwtService({ secret, accessTokenTtl }: JwtConfig): JwtService {
  const key = new TextEncoder().encode(secret);

  return {
    async signAccessToken({ userId }) {
      return new SignJWT({})
        .setProtectedHeader({ alg: ALG })
        .setSubject(userId)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(accessTokenTtl)
        .sign(key);
    },

    async verifyAccessToken(token) {
      try {
        const { payload } = await jwtVerify(token, key, {
          // บังคับ algorithm: กันการโจมตีที่แก้ header เป็น alg: none หรือ alg อื่น
          algorithms: [ALG],
          issuer: ISSUER,
          audience: AUDIENCE,
        });
        if (typeof payload.sub !== 'string' || payload.sub === '') {
          throw new Error('missing sub');
        }
        return { userId: payload.sub };
      } catch {
        // ไม่บอก client ว่าผิดเพราะอะไร (หมดอายุ/ลายเซ็นผิด) — ฝั่ง client แค่ต้องล็อกอินใหม่/refresh
        throw new HttpError(401, 'INVALID_TOKEN', 'Access token is invalid or expired');
      }
    },
  };
}
