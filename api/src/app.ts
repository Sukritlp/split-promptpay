import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createHealthRouter, type HealthDeps } from './routes/health.js';

export type AppDeps = HealthDeps;

/**
 * สร้าง Express app โดย "ไม่" เรียก listen()
 * - test (Supertest) ส่ง request ใส่ app ได้ตรงๆ โดยไม่ต้องเปิด port จริง
 * - dependency (เช่น การเช็ค DB) ถูกส่งเข้ามา → ใน test ส่งของปลอมแทนได้ ไม่ต้องมี DB จริง
 */
export function createApp(deps: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by'); // ไม่บอกคนนอกว่าใช้ Express
  app.use(express.json({ limit: '100kb' }));

  app.use(createHealthRouter(deps));

  // ต้องอยู่ท้ายสุด: ไม่มี route ไหนตรง → 404, และ error ทุกตัว → errorHandler
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
