import type { AppDeps } from '../../src/app.js';

/**
 * dependency ปลอมสำหรับ unit test ที่ "ไม่ควร" เรียก dependency นั้นเลย
 * ถ้าโค้ดเผลอเรียก test จะ fail พร้อมบอกชื่อ method ทันที
 */
function unused<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      return () => {
        throw new Error(`${name}.${String(prop)} should not be called in this test`);
      };
    },
  });
}

/** ประกอบ AppDeps โดยใส่เฉพาะตัวที่ test สนใจ ที่เหลือเป็น unused */
export function fakeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    checkDb: () => Promise.reject(new Error('checkDb should not be called in this test')),
    authService: unused('authService'),
    usersService: unused('usersService'),
    jwt: unused('jwt'),
    ...overrides,
  };
}
