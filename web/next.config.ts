import type { NextConfig } from 'next';

/**
 * URL ของ Express API (ฝั่ง server เท่านั้น — ไม่ใช่ NEXT_PUBLIC_ จึงไม่หลุดไปที่ browser)
 * หมายเหตุ: rewrites ถูกคำนวณตอน build → บน Vercel ต้องตั้ง API_URL ก่อน build
 */
const DEFAULT_API_URL = 'http://localhost:4000';

function resolveApiUrl(): string {
  const value = process.env.API_URL;
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(`[next.config] API_URL is not set, falling back to ${DEFAULT_API_URL}`);
    }
    return DEFAULT_API_URL;
  }
  try {
    // ตัด / ท้ายออก กัน URL กลายเป็น //api
    return new URL(value).toString().replace(/\/$/, '');
  } catch {
    throw new Error(`API_URL is not a valid URL: "${value}"`);
  }
}

const apiUrl = resolveApiUrl();

const nextConfig: NextConfig = {
  // ไม่ให้ `next dev` สร้าง/แก้ไฟล์ AGENTS.md เอง (ไม่ต้องการไฟล์นี้ใน repo)
  agentRules: false,

  // E2E build ไปอีกโฟลเดอร์ (.next-e2e) → รัน E2E ได้ระหว่างที่ `next dev` ใช้ .next อยู่
  distDir: process.env.NEXT_DIST_DIR || '.next',

  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },

  /**
   * browser เรียก /api/* ที่ origin ของเว็บเอง → Next.js ส่งต่อให้ API (proxy ฝั่ง server)
   * - origin เดียวกัน → ไม่ต้องตั้ง CORS และ cookie SameSite=Lax ใช้ได้
   * - path ไม่ถูกตัด (/api/... → /api/...) → cookie Path=/api/auth ตรงกันทั้งสองฝั่ง
   */
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
