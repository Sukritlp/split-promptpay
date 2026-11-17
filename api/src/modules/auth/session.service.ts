/**
 * จัดการ refresh token ("session" ของแต่ละอุปกรณ์) ใน DB
 * - 1 การล็อกอิน = 1 family; ทุกครั้งที่ refresh จะได้ token ใหม่ใน family เดิม
 */
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { generateRefreshToken, hashRefreshToken } from '../../lib/refresh-token.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface IssuedRefreshToken {
  /** ตัวจริง — ส่งให้ client ทาง cookie เท่านั้น ห้ามเก็บ/ห้าม log */
  token: string;
  expiresAt: Date;
}

export interface SessionService {
  /** เริ่ม session ใหม่ (family ใหม่) ตอน register/login */
  start(userId: string): Promise<IssuedRefreshToken>;
}

export interface SessionServiceDeps {
  prisma: PrismaClient;
  ttlDays: number;
  /** inject เวลาได้ เพื่อให้ test ควบคุมได้ */
  now?: () => Date;
}

export function createSessionService({
  prisma,
  ttlDays,
  now = () => new Date(),
}: SessionServiceDeps): SessionService {
  const expiry = () => new Date(now().getTime() + ttlDays * DAY_MS);

  return {
    async start(userId) {
      const token = generateRefreshToken();
      const expiresAt = expiry();
      await prisma.refreshToken.create({
        data: {
          userId,
          familyId: randomUUID(),
          tokenHash: hashRefreshToken(token),
          expiresAt,
        },
      });
      return { token, expiresAt };
    },
  };
}
