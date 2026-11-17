import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL, TEST_JWT_SECRET } from './tests/setup/test-env.js';

export default defineConfig({
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/setup/global-setup.ts'],
          // ทุกไฟล์ใช้ DB เดียวกัน → รันทีละไฟล์ ไม่งั้นไฟล์หนึ่ง TRUNCATE ข้อมูลของอีกไฟล์
          fileParallelism: false,
          env: {
            NODE_ENV: 'test',
            DATABASE_URL: TEST_DATABASE_URL,
            JWT_ACCESS_SECRET: TEST_JWT_SECRET,
          },
        },
      },
    ],
  },
});
