/**
 * Logic ของกลุ่ม — ทุกเมธอดรับ userId ของคนที่เรียก แล้วตรวจสิทธิ์ที่นี่ (ไม่ใช่ที่ route)
 * → ตรวจสิทธิ์จุดเดียว ลืมใส่ไม่ได้ และ test ได้ตรงๆ
 */
import { z } from 'zod';
import { Prisma, type GroupRole, type PrismaClient } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import { generateInviteCode } from '../../lib/invite-code.js';
import type { CreateGroupInput } from './groups.schemas.js';

export interface GroupSummary {
  id: string;
  name: string;
  currency: string;
  myRole: GroupRole;
  memberCount: number;
  createdAt: string;
}

export interface GroupMemberView {
  userId: string;
  name: string;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  currency: string;
  ownerId: string;
  myRole: GroupRole;
  createdAt: string;
  /** เรียงตามลำดับที่เข้าร่วม — ไม่มี email (สมาชิกคนอื่นไม่จำเป็นต้องเห็น) */
  members: GroupMemberView[];
}

export interface GroupsService {
  create(userId: string, input: CreateGroupInput): Promise<GroupSummary>;
  /** กลุ่มที่ user เป็นสมาชิก เรียงจากที่เข้าร่วมล่าสุด */
  listMine(userId: string): Promise<GroupSummary[]>;
  /** รายละเอียดกลุ่ม — 404 ถ้าไม่มีกลุ่มนี้ หรือ user ไม่ได้เป็นสมาชิก */
  getForMember(userId: string, groupId: string): Promise<GroupDetail>;
}

export interface GroupsServiceDeps {
  prisma: PrismaClient;
}

const uuid = z.uuid();

/** id ไม่ใช่ uuid → PostgreSQL error ตอน query (กลายเป็น 500) → ปัดเป็น "ไม่เจอ" ตั้งแต่ต้น */
export function isUuid(value: string): boolean {
  return uuid.safeParse(value).success;
}

/** ไม่บอกว่า "มีกลุ่มนี้แต่คุณไม่ใช่สมาชิก" (403) — ตอบเหมือนไม่มีกลุ่มนี้ (404) กันการเดา id */
export const groupNotFound = () => new HttpError(404, 'GROUP_NOT_FOUND', 'Group not found');

export function toSummary(
  group: {
    id: string;
    name: string;
    currency: string;
    createdAt: Date;
    _count: { members: number };
  },
  myRole: GroupRole,
): GroupSummary {
  return {
    id: group.id,
    name: group.name,
    currency: group.currency,
    myRole,
    memberCount: group._count.members,
    createdAt: group.createdAt.toISOString(),
  };
}

export const withMemberCount = { _count: { select: { members: true } } } as const;

export function createGroupsService({ prisma }: GroupsServiceDeps): GroupsService {
  return {
    async create(userId, { name, currency }) {
      try {
        // nested create = INSERT กลุ่ม + INSERT สมาชิก ใน transaction เดียว
        // → ไม่มีทางได้กลุ่มที่ไม่มี owner เป็นสมาชิก
        const group = await prisma.group.create({
          data: {
            name,
            currency,
            ownerId: userId,
            inviteCode: generateInviteCode(),
            members: { create: { userId, role: 'owner' } },
          },
          include: withMemberCount,
        });
        return toSummary(group, 'owner');
      } catch (err) {
        // P2003 = foreign key ไม่เจอ: token ยังไม่หมดอายุแต่ user ถูกลบไปแล้ว
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
          throw new HttpError(401, 'INVALID_TOKEN', 'Access token is invalid or expired');
        }
        throw err;
      }
    },

    async listMine(userId) {
      const memberships = await prisma.groupMember.findMany({
        where: { userId },
        include: { group: { include: withMemberCount } },
        // groupId เป็นตัวตัดสินรองเมื่อ joinedAt เท่ากัน (ความละเอียดระดับ ms) → ลำดับคงที่ทุกครั้ง
        orderBy: [{ joinedAt: 'desc' }, { groupId: 'asc' }],
      });
      return memberships.map((m) => toSummary(m.group, m.role));
    },

    async getForMember(userId, groupId) {
      if (!isUuid(groupId)) throw groupNotFound();

      // ค้นจาก membership ของคนที่เรียก: ไม่ใช่สมาชิก = ไม่เจอแถว = 404 (ตรวจสิทธิ์ในคำสั่งเดียว)
      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
        include: {
          group: {
            include: {
              members: {
                include: { user: { select: { name: true } } },
                orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
              },
            },
          },
        },
      });
      if (!membership) throw groupNotFound();

      const { group } = membership;
      return {
        id: group.id,
        name: group.name,
        currency: group.currency,
        ownerId: group.ownerId,
        myRole: membership.role,
        createdAt: group.createdAt.toISOString(),
        members: group.members.map((m) => ({
          userId: m.userId,
          name: m.user.name,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
        })),
      };
    },
  };
}
