// Prisma 7: ค่าตั้งของ Prisma CLI (migrate, generate, studio) อยู่ที่ไฟล์นี้
// Prisma 7 ไม่โหลด .env ให้อัตโนมัติแล้ว จึงต้อง import 'dotenv/config' เอง
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
