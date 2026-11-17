/**
 * Logic ของการสมัคร/ล็อกอิน — ไม่รู้จัก Express (ไม่มี req/res)
 * route แค่แปลง HTTP ↔ เรียก service → test logic ได้ตรงๆ และย้ายไป NestJS ได้ง่าย
 */
import { Prisma, type PrismaClient, type User } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import type { JwtService } from '../../lib/jwt.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../../lib/password.js';
import { toPublicUser, type PublicUser } from '../users/public-user.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
}

export interface AuthService {
  register(input: RegisterInput): Promise<AuthResult>;
  login(input: LoginInput): Promise<AuthResult>;
}

/**
 * error เดียวกันทุกกรณีที่ล็อกอินไม่ผ่าน (ไม่มี email นี้ / รหัสผิด / บัญชี Google ที่ไม่มีรหัส)
 * ถ้าแยกข้อความ คนร้ายจะรู้ได้ว่า email ไหนสมัครไว้แล้ว (user enumeration)
 */
const invalidCredentials = () =>
  new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');

export interface AuthServiceDeps {
  prisma: PrismaClient;
  jwt: JwtService;
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

    async login({ email, password }) {
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user?.passwordHash) {
        // ไม่เจอ user หรือเป็นบัญชีที่ไม่มีรหัสผ่าน (สมัครผ่าน Google)
        // ยัง hash ให้เสียเวลาเท่ากับกรณีรหัสผิด → จับเวลา response แล้วแยกไม่ออก
        await verifyAgainstDummy(password);
        throw invalidCredentials();
      }

      if (!(await verifyPassword(user.passwordHash, password))) {
        throw invalidCredentials();
      }

      return issueTokens(user);
    },
  };
}
