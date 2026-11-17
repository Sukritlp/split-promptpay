import type { User } from '../../generated/prisma/client.js';

/** ข้อมูล user ที่ส่งให้ client ได้ — ห้ามมี passwordHash */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  promptpayId: string | null;
  createdAt: string;
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
