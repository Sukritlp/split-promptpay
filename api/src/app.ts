import express, { type Express } from 'express';
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
  app.use(express.json());

  app.use(createHealthRouter(deps));

  return app;
}
