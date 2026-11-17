// ESLint 9+ "flat config" — ดูคุณภาพโค้ด (bug, bad practice)
// ส่วนเรื่องรูปแบบ (เว้นวรรค, quote) ปล่อยให้ Prettier ดูแล
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/', 'src/generated/'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        // ให้ ESLint ใช้ข้อมูล type จาก tsconfig → จับ bug ได้มากขึ้น เช่น Promise ที่ลืม await
        projectService: { allowDefaultProject: ['*.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  {
    // ไฟล์ config ที่เป็น .js ไม่มี type info → ปิดกฎที่ต้องใช้ type
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },

  // ต้องอยู่ท้ายสุด: ปิดกฎของ ESLint ที่ชนกับ Prettier
  prettier,
);
