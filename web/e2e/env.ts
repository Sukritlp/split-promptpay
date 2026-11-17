/**
 * สภาพแวดล้อมของ E2E — แยกจาก dev ทั้งหมด (port, DB, build output)
 * รันได้แม้เปิด dev server (3000/4000) ค้างไว้ และ user ที่ test สร้างไม่ไปปนใน DB dev
 */
export const E2E = {
  webPort: 3100,
  apiPort: 4100,
  get webUrl() {
    return `http://localhost:${this.webPort}`;
  },
  get apiUrl() {
    return `http://localhost:${this.apiPort}`;
  },
  databaseUrl:
    process.env.E2E_DATABASE_URL ??
    'postgresql://splitpay:splitpay@localhost:5432/splitpay_e2e?schema=public',
  // ค่าสำหรับ E2E เท่านั้น ไม่ใช่ secret จริง
  jwtSecret: 'e2e-only-secret-that-is-at-least-32-characters',
  // สั้นมากเพื่อทดสอบว่า access token หมดอายุกลางการใช้งานแล้ว refresh ให้เองได้จริง
  accessTokenTtlSeconds: 5,
  distDir: '.next-e2e',
} as const;

/**
 * กันพลาด: E2E ล้างข้อมูลทุกตาราง — ยอมรันเฉพาะ DB ที่ชื่อลงท้ายด้วย _e2e
 * (เหมือน integration test ของ api ที่บังคับ _test)
 */
export function assertE2eDatabase(url: string): string {
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith('_e2e')) {
    throw new Error(`Refusing to run E2E against "${name}": database name must end with _e2e`);
  }
  return name;
}
