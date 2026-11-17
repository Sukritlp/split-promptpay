import { defineConfig, devices } from '@playwright/test';
import { assertE2eDatabase, E2E } from './e2e/env';

assertE2eDatabase(E2E.databaseUrl);

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI, // ลืม test.only ไว้ → CI fail
  // retry 1 ครั้งใน CI: ผ่านตอน retry จะถูกรายงานว่า "flaky" (ไม่ถูกซ่อน) และเก็บ trace ไว้ดู
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: E2E.webUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'th-TH',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // คนไทยใช้ iPhone เยอะ และ Safari (WebKit) จัดการ cookie ต่างจาก Chrome
    { name: 'mobile-safari', use: { ...devices['iPhone 15'] } },
  ],

  webServer: [
    {
      // migrate ก่อนสตาร์ท: migrate deploy สร้าง DB splitpay_e2e ให้ถ้ายังไม่มี
      command: 'npm run build && npm run db:deploy && node dist/server.js',
      cwd: '../api',
      url: `${E2E.apiUrl}/api/ready`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(E2E.apiPort),
        DATABASE_URL: E2E.databaseUrl,
        JWT_ACCESS_SECRET: E2E.jwtSecret,
        ACCESS_TOKEN_TTL: `${E2E.accessTokenTtlSeconds}s`,
        COOKIE_SAMESITE: 'lax',
      },
    },
    {
      // production build: ทดสอบของที่จะ deploy จริง
      command: `npx next build && npx next start -p ${E2E.webPort}`,
      url: E2E.webUrl,
      reuseExistingServer: !isCI,
      timeout: 240_000,
      env: {
        API_URL: E2E.apiUrl,
        NEXT_DIST_DIR: E2E.distDir,
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
});
