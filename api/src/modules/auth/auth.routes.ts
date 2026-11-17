import { Router, type Response } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { validateBody } from '../../middleware/validate.js';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
  type RefreshCookieConfig,
} from './auth.cookies.js';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from './auth.schemas.js';
import type { AuthResult, AuthService, AuthSession } from './auth.service.js';

export interface AuthRouterDeps {
  authService: AuthService;
  refreshCookie: RefreshCookieConfig;
}

export function createAuthRouter({ authService, refreshCookie }: AuthRouterDeps): Router {
  const router = Router();

  /** refresh token ไปทาง cookie เท่านั้น — body มีแค่ user + accessToken */
  function respondWithSession(res: Response, status: number, session: AuthSession): void {
    const { refresh, ...body } = session;
    setRefreshCookie(res, refreshCookie, refresh);
    res.status(status).json(body satisfies AuthResult);
  }

  router.post('/auth/register', validateBody(registerSchema), async (req, res) => {
    // validateBody แทน req.body ด้วยค่าที่ผ่าน schema แล้ว จึง cast ได้อย่างปลอดภัย
    respondWithSession(res, 201, await authService.register(req.body as RegisterInput));
  });

  router.post('/auth/login', validateBody(loginSchema), async (req, res) => {
    respondWithSession(res, 200, await authService.login(req.body as LoginInput));
  });

  router.post('/auth/refresh', async (req, res) => {
    let session: AuthSession;
    try {
      session = await authService.refresh(readRefreshCookie(req));
    } catch (err) {
      // cookie ใช้ไม่ได้แล้ว → สั่ง browser ลบทิ้ง จะได้ไม่ส่งมาซ้ำ
      if (err instanceof HttpError && err.status === 401) clearRefreshCookie(res, refreshCookie);
      throw err;
    }
    respondWithSession(res, 200, session);
  });

  /**
   * ไม่ต้องใช้ access token: อาจหมดอายุไปแล้วตอนกด logout ก็ต้อง logout ได้
   * ตอบ 204 เสมอ (idempotent) — กดซ้ำหรือไม่มี cookie ก็ไม่ error
   */
  router.post('/auth/logout', async (req, res) => {
    await authService.logout(readRefreshCookie(req));
    clearRefreshCookie(res, refreshCookie);
    res.status(204).end();
  });

  return router;
}
