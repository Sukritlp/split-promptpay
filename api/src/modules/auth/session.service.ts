/**
 * จัดการ refresh token ("session" ของแต่ละอุปกรณ์) ใน DB
 * - 1 การล็อกอิน = 1 family; ทุกครั้งที่ refresh จะได้ token ใหม่ใน family เดิม (rotation)
 * - token ใช้ได้ครั้งเดียว ถ้ามีคนเอา token ที่ใช้แล้วมาใช้อีก (reuse) แปลว่าอาจถูกขโมย
 *   → ยกเลิกทั้ง family ทั้งคนร้ายและเจ้าของต้องล็อกอินใหม่
 */
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  isWellFormedRefreshToken,
} from '../../lib/refresh-token.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface IssuedRefreshToken {
  /** ตัวจริง — ส่งให้ client ทาง cookie เท่านั้น ห้ามเก็บ/ห้าม log */
  token: string;
  expiresAt: Date;
}

export interface RotatedSession {
  userId: string;
  refresh: IssuedRefreshToken;
}

export interface SessionService {
  /** เริ่ม session ใหม่ (family ใหม่) ตอน register/login */
  start(userId: string): Promise<IssuedRefreshToken>;
  /** แลก refresh token เก่าเป็นตัวใหม่ — throw 401 INVALID_REFRESH_TOKEN ถ้าใช้ไม่ได้ */
  rotate(rawToken: unknown): Promise<RotatedSession>;
}

export interface SessionServiceDeps {
  prisma: PrismaClient;
  ttlDays: number;
  /** inject เวลาได้ เพื่อให้ test ควบคุมได้ */
  now?: () => Date;
}

/** ข้อความเดียวทุกกรณี: ไม่บอกว่าผิดเพราะไม่มี/หมดอายุ/ถูกใช้ซ้ำ */
export const invalidRefreshToken = () =>
  new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');

type RotateOutcome =
  | { kind: 'ok'; userId: string; refresh: IssuedRefreshToken }
  | { kind: 'invalid' }
  | { kind: 'reuse'; familyId: string };

export function createSessionService({
  prisma,
  ttlDays,
  now = () => new Date(),
}: SessionServiceDeps): SessionService {
  const newToken = (): IssuedRefreshToken => ({
    token: generateRefreshToken(),
    // sliding expiration: นับใหม่ทุกครั้งที่ refresh → คนที่ใช้งานอยู่เรื่อยๆ ไม่หลุด
    expiresAt: new Date(now().getTime() + ttlDays * DAY_MS),
  });

  async function revokeFamily(familyId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now() },
    });
  }

  return {
    async start(userId) {
      const refresh = newToken();
      await prisma.refreshToken.create({
        data: {
          userId,
          familyId: randomUUID(),
          tokenHash: hashRefreshToken(refresh.token),
          expiresAt: refresh.expiresAt,
        },
      });
      return refresh;
    },

    async rotate(rawToken) {
      // cookie ขยะ ไม่ต้องไปถึง DB
      if (!isWellFormedRefreshToken(rawToken)) throw invalidRefreshToken();

      const outcome = await prisma.$transaction(async (tx): Promise<RotateOutcome> => {
        const current = await tx.refreshToken.findUnique({
          where: { tokenHash: hashRefreshToken(rawToken) },
        });
        if (!current) return { kind: 'invalid' };
        if (current.revokedAt) return { kind: 'reuse', familyId: current.familyId };
        if (current.expiresAt <= now()) return { kind: 'invalid' };

        // "จอง" token นี้แบบ atomic: ถ้ามี 2 request ใช้ token เดียวกันพร้อมกัน
        // PostgreSQL ล็อกแถวไว้ ตัวที่สองจะรอจนตัวแรก commit แล้วเห็นว่า revoked_at ไม่ใช่ null
        // → count = 0 → ถือเป็นการใช้ซ้ำ (ไม่มีทางได้ token ใหม่ 2 ตัว)
        const { count } = await tx.refreshToken.updateMany({
          where: { id: current.id, revokedAt: null },
          data: { revokedAt: now() },
        });
        if (count === 0) return { kind: 'reuse', familyId: current.familyId };

        const refresh = newToken();
        await tx.refreshToken.create({
          data: {
            userId: current.userId,
            familyId: current.familyId,
            tokenHash: hashRefreshToken(refresh.token),
            expiresAt: refresh.expiresAt,
          },
        });
        return { kind: 'ok', userId: current.userId, refresh };
      });

      if (outcome.kind === 'reuse') {
        // ทำนอก transaction ด้านบน: ต้อง commit การยกเลิกจริง ไม่ใช่ถูก rollback ไปพร้อม error
        await revokeFamily(outcome.familyId);
        throw invalidRefreshToken();
      }
      if (outcome.kind === 'invalid') throw invalidRefreshToken();

      return { userId: outcome.userId, refresh: outcome.refresh };
    },
  };
}
