/**
 * เข้าร่วมกลุ่มผ่านลิงก์เชิญ (/join/<code>)
 * - preview: ดูชื่อกลุ่มก่อนกดเข้าร่วม (ต้องล็อกอิน — คนที่ยังไม่ล็อกอินจะถูกพาไป /login?next=...)
 * - join: idempotent — เป็นสมาชิกอยู่แล้วก็ตอบสำเร็จ ไม่ error
 */
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import { isWellFormedInviteCode } from '../../lib/invite-code.js';
import { toSummary, withMemberCount, type GroupSummary } from './groups.service.js';

export interface InvitePreview {
  group: { id: string; name: string; memberCount: number };
  alreadyMember: boolean;
}

export interface JoinResult {
  group: GroupSummary;
  /** true = เพิ่งเข้าร่วม, false = เป็นสมาชิกอยู่แล้ว */
  joined: boolean;
}

export interface InvitesService {
  preview(userId: string, code: string): Promise<InvitePreview>;
  join(userId: string, code: string): Promise<JoinResult>;
}

export interface InvitesServiceDeps {
  prisma: PrismaClient;
}

/** code ผิดรูปแบบ / ไม่มี / ถูก reset ไปแล้ว → ข้อความเดียวกัน */
const inviteNotFound = () =>
  new HttpError(404, 'INVITE_NOT_FOUND', 'Invite link is invalid or has been reset');

function isPrismaError(err: unknown, code: string): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}

export function createInvitesService({ prisma }: InvitesServiceDeps): InvitesService {
  async function findGroupByCode(code: string) {
    if (!isWellFormedInviteCode(code)) throw inviteNotFound();
    const group = await prisma.group.findUnique({
      where: { inviteCode: code },
      include: withMemberCount,
    });
    if (!group) throw inviteNotFound();
    return group;
  }

  async function findMembership(groupId: string, userId: string) {
    return prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { role: true },
    });
  }

  return {
    async preview(userId, code) {
      const group = await findGroupByCode(code);
      const membership = await findMembership(group.id, userId);
      return {
        group: { id: group.id, name: group.name, memberCount: group._count.members },
        alreadyMember: membership !== null,
      };
    },

    async join(userId, code) {
      const group = await findGroupByCode(code);

      const existing = await findMembership(group.id, userId);
      if (existing) return { group: toSummary(group, existing.role), joined: false };

      try {
        await prisma.groupMember.create({ data: { groupId: group.id, userId, role: 'member' } });
      } catch (err) {
        // P2002 = PK (group_id, user_id) ซ้ำ: อีก request (กดปุ่มซ้ำ/2 tab) เพิ่งเข้าร่วมไปก่อนหน้านี้นิดเดียว
        // → ผลลัพธ์ที่ผู้ใช้ต้องการเกิดขึ้นแล้ว ตอบว่าเป็นสมาชิกอยู่แล้ว (ไม่ใช่ 500)
        if (isPrismaError(err, 'P2002')) {
          return { group: await refreshedSummary(group.id, userId), joined: false };
        }
        // P2003 = user ไม่มีแล้ว (token ยังไม่หมดอายุแต่ user ถูกลบ)
        if (isPrismaError(err, 'P2003')) {
          throw new HttpError(401, 'INVALID_TOKEN', 'Access token is invalid or expired');
        }
        throw err;
      }

      return { group: await refreshedSummary(group.id, userId), joined: true };
    },
  };

  /** อ่านใหม่หลังเข้าร่วม → memberCount นับรวมคนที่เพิ่งเข้า */
  async function refreshedSummary(groupId: string, userId: string): Promise<GroupSummary> {
    const membership = await prisma.groupMember.findUniqueOrThrow({
      where: { groupId_userId: { groupId, userId } },
      include: { group: { include: withMemberCount } },
    });
    return toSummary(membership.group, membership.role);
  }
}
