import { z } from 'zod';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { toPublicUser, type PublicUser } from './public-user.js';

export interface UsersService {
  /** คืน null ถ้าไม่มี user นี้ (เช่น ถูกลบไปแล้วแต่ token ยังไม่หมดอายุ) */
  findPublicById(id: string): Promise<PublicUser | null>;
}

export interface UsersServiceDeps {
  prisma: PrismaClient;
}

const uuid = z.uuid();

export function createUsersService({ prisma }: UsersServiceDeps): UsersService {
  return {
    async findPublicById(id) {
      // คอลัมน์ id เป็น uuid: ถ้าส่งค่าที่ไม่ใช่ uuid ไป PostgreSQL จะ error → กลายเป็น 500
      if (!uuid.safeParse(id).success) return null;

      const user = await prisma.user.findUnique({ where: { id } });
      return user ? toPublicUser(user) : null;
    },
  };
}
