import { createApp } from './app.js';
import { env } from './config/env.js';
import { checkDatabase, prisma } from './db/prisma.js';
import { createJwtService } from './lib/jwt.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createSessionService } from './modules/auth/session.service.js';
import { createUsersService } from './modules/users/users.service.js';

// composition root: จุดเดียวที่ประกอบ dependency จริงเข้าด้วยกัน
const jwt = createJwtService({
  secret: env.JWT_ACCESS_SECRET,
  accessTokenTtl: env.ACCESS_TOKEN_TTL,
});
const sessions = createSessionService({ prisma, ttlDays: env.REFRESH_TOKEN_TTL_DAYS });
const authService = createAuthService({ prisma, jwt, sessions });
const usersService = createUsersService({ prisma });

const app = createApp({
  checkDb: checkDatabase,
  authService,
  usersService,
  jwt,
  refreshCookie: {
    sameSite: env.COOKIE_SAMESITE,
    secure: env.NODE_ENV === 'production',
  },
});

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// ปิดอย่างนุ่มนวลเมื่อ docker/Railway สั่งหยุด:
// รับ request ที่ค้างอยู่ให้จบ → ปิด connection DB → ค่อยออก
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down...`);
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}
