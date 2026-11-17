import { Router } from 'express';
import { validateBody } from '../../middleware/validate.js';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from './auth.schemas.js';
import type { AuthService } from './auth.service.js';

export interface AuthRouterDeps {
  authService: AuthService;
}

export function createAuthRouter({ authService }: AuthRouterDeps): Router {
  const router = Router();

  router.post('/auth/register', validateBody(registerSchema), async (req, res) => {
    // validateBody แทน req.body ด้วยค่าที่ผ่าน schema แล้ว จึง cast ได้อย่างปลอดภัย
    const result = await authService.register(req.body as RegisterInput);
    res.status(201).json(result);
  });

  router.post('/auth/login', validateBody(loginSchema), async (req, res) => {
    const result = await authService.login(req.body as LoginInput);
    res.status(200).json(result);
  });

  return router;
}
