import type { AuthService } from '../../src/modules/auth/auth.service.js';

/**
 * service ปลอมสำหรับ unit test ที่ "ไม่ควร" เรียก service นี้เลย
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

export const unusedAuthService = unused<AuthService>('authService');
