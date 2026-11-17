import { createApp } from './app.js';
import { env } from './config/env.js';
import { checkDatabase, prisma } from './db/prisma.js';

const app = createApp({ checkDb: checkDatabase });

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// ปิดอย่างนุ่มนวลเมื่อ docker/Railway สั่งหยุด:
// รับ request ที่ค้างอยู่ให้จบ → ปิด connection DB → ค่อยออก
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down...`);
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}
