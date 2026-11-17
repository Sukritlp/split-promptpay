/**
 * Logic ของการสมัคร/ล็อกอิน — ไม่รู้จัก Express (ไม่มี req/res)
 * route แค่แปลง HTTP ↔ เรียก service → test logic ได้ตรงๆ และย้ายไป NestJS ได้ง่าย
 */
import { Prisma, type PrismaClient, type User } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import type { JwtService } from '../../lib/jwt.js';
import { hashPassword } from '../../lib/password.js';
import type { RegisterInput } from './auth.schemas.js';

/** ข้อมูล user ที่ส่งให้ client ได้ — ห้ามมี passwordHash */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  promptpayId: string | null;
  createdAt: string;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
}

export interface AuthService {
  register(input: RegisterInput): Promise<AuthResult>;
}

export interface AuthServiceDeps {
  prisma: PrismaClient;
  jwt: JwtService;
}

/** เลือก field แบบ whitelist: field ใหม่ใน User จะไม่หลุดออกไปเองโดยไม่ตั้งใจ */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    promptpayId: user.promptpayId,
    createdAt: user.createdAt.toISOString(),
  };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export function createAuthService({ prisma, jwt }: AuthServiceDeps): AuthService {
  async function issueTokens(user: User): Promise<AuthResult> {
    const accessToken = await jwt.signAccessToken({ userId: user.id });
    return { user: toPublicUser(user), accessToken };
  }

  return {
    async register({ name, email, password }) {
      const passwordHash = await hashPassword(password);

      try {
        // ไม่ต้อง findUnique เช็คก่อน: 2 request พร้อมกันจะผ่านการเช็คทั้งคู่ (race condition)
        // ให้ unique constraint ของ DB เป็นตัวตัดสินแทน — DB รับประกันว่าผ่านได้แค่ตัวเดียว
        const user = await prisma.user.create({ data: { name, email, passwordHash } });
        return await issueTokens(user);
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new HttpError(409, 'EMAIL_TAKEN', 'Email is already registered');
        }
        throw err;
      }
    },
  };
}
