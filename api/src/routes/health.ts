import { Router } from 'express';

/**
 * GET /health — ใช้ให้ load balancer / Railway / Render / docker เช็คว่า process ยังทำงานอยู่
 * ตอนนี้เช็คแค่ตัว process ก่อน พอต่อ DB แล้วค่อยเพิ่มการเช็ค DB (หรือแยกเป็น /ready)
 */
export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});
