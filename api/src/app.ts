import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createAuthRouter, type AuthRouterDeps } from './modules/auth/auth.routes.js';
import { createGroupsRouter, type GroupsRouterDeps } from './modules/groups/groups.routes.js';
import { createUsersRouter, type UsersRouterDeps } from './modules/users/users.routes.js';
import { createHealthRouter, type HealthDeps } from './routes/health.js';

export type AppDeps = HealthDeps & AuthRouterDeps & UsersRouterDeps & GroupsRouterDeps;

/**
 * สร้าง Express app โดย "ไม่" เรียก listen()
 * - test (Supertest) ส่ง request ใส่ app ได้ตรงๆ โดยไม่ต้องเปิด port จริง
 * - dependency ทั้งหมดถูกส่งเข้ามา (ประกอบกันที่ server.ts) → ใน test เลือกส่งของจริงหรือของปลอมได้
 */
export function createApp(deps: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by'); // ไม่บอกคนนอกว่าใช้ Express
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // ทุก route อยู่ใต้ /api: web (Next.js) rewrite /api/* มาที่นี่ตรงตัว
  // → path ที่ browser เห็นตรงกับฝั่ง API (สำคัญกับ cookie Path=/api/auth)
  const api = express.Router();
  api.use(createHealthRouter(deps));
  api.use(createAuthRouter(deps));
  api.use(createUsersRouter(deps));
  api.use(createGroupsRouter(deps));
  app.use('/api', api);

  // ต้องอยู่ท้ายสุด: ไม่มี route ไหนตรง → 404, และ error ทุกตัว → errorHandler
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
