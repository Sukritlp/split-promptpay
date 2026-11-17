import { createApp } from '../../src/app.js';
import { checkDatabase } from '../../src/db/prisma.js';
import { createJwtService } from '../../src/lib/jwt.js';
import type { RefreshCookieConfig } from '../../src/modules/auth/auth.cookies.js';
import { createAuthService } from '../../src/modules/auth/auth.service.js';
import { createSessionService } from '../../src/modules/auth/session.service.js';
import { createUsersService } from '../../src/modules/users/users.service.js';
import { TEST_JWT_SECRET } from '../setup/test-env.js';
import { testPrisma } from './db.js';

export interface TestAppOptions {
  refreshCookie?: Partial<RefreshCookieConfig>;
  refreshTtlDays?: number;
}

/** app ที่ใช้ dependency จริงทั้งหมด (DB ทดสอบ) สำหรับ integration test */
export function buildTestApp(options: TestAppOptions = {}) {
  const jwt = createJwtService({ secret: TEST_JWT_SECRET, accessTokenTtl: '15m' });
  const sessions = createSessionService({
    prisma: testPrisma,
    ttlDays: options.refreshTtlDays ?? 30,
  });
  const authService = createAuthService({ prisma: testPrisma, jwt, sessions });
  const usersService = createUsersService({ prisma: testPrisma });
  const app = createApp({
    checkDb: checkDatabase,
    authService,
    usersService,
    jwt,
    refreshCookie: { sameSite: 'lax', secure: false, ...options.refreshCookie },
  });
  return { app, jwt, sessions };
}
