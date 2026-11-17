import { createApp } from '../../src/app.js';
import { checkDatabase } from '../../src/db/prisma.js';
import { createJwtService } from '../../src/lib/jwt.js';
import { createAuthService } from '../../src/modules/auth/auth.service.js';
import { TEST_JWT_SECRET } from '../setup/test-env.js';
import { testPrisma } from './db.js';

/** app ที่ใช้ dependency จริงทั้งหมด (DB ทดสอบ) สำหรับ integration test */
export function buildTestApp() {
  const jwt = createJwtService({ secret: TEST_JWT_SECRET, accessTokenTtl: '15m' });
  const authService = createAuthService({ prisma: testPrisma, jwt });
  const app = createApp({ checkDb: checkDatabase, authService });
  return { app, jwt };
}
