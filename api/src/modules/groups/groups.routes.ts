import { Router } from 'express';
import type { JwtService } from '../../lib/jwt.js';
import { getAuth, requireAuth } from '../../middleware/require-auth.js';
import { validateBody } from '../../middleware/validate.js';
import { createGroupSchema, type CreateGroupInput } from './groups.schemas.js';
import type { GroupsService } from './groups.service.js';
import type { InvitesService } from './invites.service.js';

export interface GroupsRouterDeps {
  jwt: JwtService;
  groupsService: GroupsService;
  invitesService: InvitesService;
}

export function createGroupsRouter({
  jwt,
  groupsService,
  invitesService,
}: GroupsRouterDeps): Router {
  const router = Router();

  // ต้องล็อกอินทุก route ของกลุ่ม — ใส่แบบระบุ path
  // (ถ้าใส่ทั้ง router จะทำให้ path ที่ไม่มีอยู่จริงได้ 401 แทน 404)
  router.use(['/groups', '/invites'], requireAuth(jwt));

  router.post('/groups', validateBody(createGroupSchema), async (req, res) => {
    const group = await groupsService.create(getAuth(req).userId, req.body as CreateGroupInput);
    res.status(201).json({ group });
  });

  router.get('/groups', async (req, res) => {
    const groups = await groupsService.listMine(getAuth(req).userId);
    res.status(200).json({ groups });
  });

  router.get('/groups/:groupId', async (req, res) => {
    const group = await groupsService.getForMember(getAuth(req).userId, req.params.groupId);
    res.status(200).json({ group });
  });

  router.get('/groups/:groupId/invite', async (req, res) => {
    const code = await groupsService.getInviteCode(getAuth(req).userId, req.params.groupId);
    res.status(200).json({ code });
  });

  router.post('/groups/:groupId/invite/reset', async (req, res) => {
    const code = await groupsService.resetInviteCode(getAuth(req).userId, req.params.groupId);
    res.status(200).json({ code });
  });

  router.get('/invites/:code', async (req, res) => {
    res.status(200).json(await invitesService.preview(getAuth(req).userId, req.params.code));
  });

  router.post('/invites/:code/join', async (req, res) => {
    const { group, joined } = await invitesService.join(getAuth(req).userId, req.params.code);
    // 201 = เพิ่งเข้าร่วม, 200 = เป็นสมาชิกอยู่แล้ว (idempotent: กดซ้ำได้ ไม่ error)
    res.status(joined ? 201 : 200).json({ group });
  });

  return router;
}
