import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { HttpError } from '../lib/http-error.js';

/**
 * ตรวจ req.body ด้วย zod schema
 * - ผ่าน: แทน req.body ด้วยค่าที่ parse แล้ว (เช่น email ที่ trim + lowercase แล้ว) และตัด field แปลกปลอมทิ้ง
 * - ไม่ผ่าน: 400 พร้อมรายการช่องที่ผิด
 */
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      throw new HttpError(400, 'VALIDATION_ERROR', 'Request body is invalid', details);
    }
    req.body = result.data;
    next();
  };
}
