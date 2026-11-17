import { Router } from 'express';
import { HttpError } from '../../lib/http-error.js';
import type { JwtService } from '../../lib/jwt.js';
import { getAuth, requireAuth } from '../../middleware/require-auth.js';
import type { UsersService } from './users.service.js';

export interface UsersRouterDeps {
  jwt: JwtService;
  usersService: UsersService;
}

export function createUsersRouter({ jwt, usersService }: UsersRouterDeps): Router {
  const router = Router();

  router.get('/me', requireAuth(jwt), async (req, res) => {
    const user = await usersService.findPublicById(getAuth(req).userId);
    if (!user) {
      // token ถูกต้องแต่ user ไม่มีแล้ว (ถูกลบ) → ถือว่าไม่ได้ล็อกอิน
      throw new HttpError(401, 'INVALID_TOKEN', 'Access token is invalid or expired');
    }
    res.status(200).json({ user });
  });

  return router;
}
