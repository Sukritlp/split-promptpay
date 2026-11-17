/**
 * PrismaClient ตัวเดียวใช้ทั้งแอป
 * ห้ามสร้าง `new PrismaClient()` ซ้ำในแต่ละไฟล์ — แต่ละตัวมี connection pool ของตัวเอง
 * สร้างหลายตัวจะเปลือง connection จน PostgreSQL ปฏิเสธ (too many connections)
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  // ถ้าต่อ DB ไม่ได้ภายใน 5 วิ ให้ error เลย ไม่ค้างไปเรื่อยๆ (สำคัญกับ /ready)
  connectionTimeoutMillis: 5_000,
});

export const prisma = new PrismaClient({ adapter });

/** ใช้กับ /ready: ถ้า DB ตอบ SELECT 1 ได้ แปลว่าพร้อม */
export async function checkDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
