import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError, type ErrorResponse } from '../lib/http-error.js';

/** route ที่ไม่มีอยู่ → 404 แบบ JSON (ค่า default ของ Express เป็น HTML) */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};

/** error จาก body-parser (เช่น JSON พัง) มี status และ expose: true ติดมา */
function isClientParseError(err: unknown): err is { status: number; message: string } {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { status?: unknown; expose?: unknown };
  return typeof e.status === 'number' && e.status >= 400 && e.status < 500 && e.expose === true;
}

/**
 * จุดเดียวที่แปลง error เป็น response — ทุก error ในแอปมี JSON รูปแบบเดียวกัน
 * Express 5 ส่ง error จาก async handler มาที่นี่ให้อัตโนมัติ ไม่ต้องห่อ try/catch เอง
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status: number;
  let body: ErrorResponse;

  if (err instanceof HttpError) {
    status = err.status;
    body = { error: { code: err.code, message: err.message } };
    if (err.details !== undefined) body.error.details = err.details;
  } else if (isClientParseError(err)) {
    status = err.status;
    body = { error: { code: 'BAD_REQUEST', message: err.message } };
  } else {
    // bug หรือ error ที่ไม่ได้คาดไว้: log เต็มๆ ฝั่ง server แต่ไม่ส่ง stack/ข้อความจริงให้ client
    console.error('Unhandled error:', err);
    status = 500;
    body = { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } };
  }

  res.status(status).json(body);
};
