import express, { type Express } from 'express';
import { healthRouter } from './routes/health.js';

/**
 * สร้าง Express app โดย "ไม่" เรียก listen()
 * เพื่อให้ test (Supertest) ส่ง request ใส่ app ได้ตรงๆ โดยไม่ต้องเปิด port จริง
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by'); // ไม่บอกคนนอกว่าใช้ Express
  app.use(express.json());

  app.use(healthRouter);

  return app;
}
