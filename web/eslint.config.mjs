import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'coverage/**',
    '.next-e2e/**',
    'playwright-report/**',
    'test-results/**',
  ]),
  // ต้องอยู่ท้ายสุด: ปิดกฎของ ESLint ที่ชนกับ Prettier
  prettier,
]);

export default eslintConfig;
