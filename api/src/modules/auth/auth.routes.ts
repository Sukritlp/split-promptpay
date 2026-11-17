import { Router, type Response } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { setRefreshCookie, type RefreshCookieConfig } from './auth.cookies.js';
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

  return router;
}
