import { Router } from 'express';

export interface HealthResponse {
  status: 'ok';
  uptime: number;
  timestamp: string;
}

export interface ReadyResponse {
  status: 'ok' | 'unavailable';
  checks: { database: 'up' | 'down' };
}

export interface HealthDeps {
  /** resolve = DB พร้อม, reject = DB มีปัญหา */
  checkDb: () => Promise<void>;
}

/**
 * - GET /health (liveness): process ยังทำงานอยู่ไหม — ไม่แตะ DB
 *   ถ้า DB ล่มแล้ว /health พังด้วย platform จะ restart API วนไปทั้งที่ API ไม่ได้ผิด
 * - GET /ready (readiness): พร้อมรับ request จริงไหม — เช็ค DB ด้วย
 */
export function createHealthRouter({ checkDb }: HealthDeps): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
    res.status(200).json(body);
  });

  router.get('/ready', async (_req, res) => {
    try {
      await checkDb();
      const body: ReadyResponse = { status: 'ok', checks: { database: 'up' } };
      res.status(200).json(body);
    } catch (err) {
      // log รายละเอียดไว้ฝั่ง server แต่ไม่ส่ง error จริงให้ client (อาจมีข้อมูล DB หลุด)
      console.error('Readiness check failed:', err);
      const body: ReadyResponse = { status: 'unavailable', checks: { database: 'down' } };
      res.status(503).json(body);
    }
  });

  return router;
}
