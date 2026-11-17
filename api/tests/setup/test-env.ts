/**
 * ค่าที่ integration test ใช้ร่วมกัน (ทั้ง globalSetup และ vitest.config)
 * - TEST_DATABASE_URL: ตั้งเองได้ (เช่นใน CI) ไม่ตั้งจะใช้ DB splitpay_test ใน docker-compose
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://splitpay:splitpay@localhost:5432/splitpay_test?schema=public';

export const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-characters';

/**
 * กันพลาด: test จะ TRUNCATE ทุกตาราง ถ้าชี้ไปที่ DB dev/production ข้อมูลจะหายหมด
 * จึงยอมรันเฉพาะ DB ที่ชื่อลงท้ายด้วย _test เท่านั้น
 */
export function assertTestDatabase(url: string): string {
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith('_test')) {
    throw new Error(
      `Refusing to run integration tests against "${name}": name must end with _test`,
    );
  }
  return name;
}
