import { expect, type Page } from '@playwright/test';

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

/** user ไม่ซ้ำกันต่อ test → test รันขนานกันได้โดยไม่ชนกัน */
export function uniqueUser(): TestUser {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return { name: `ทดสอบ ${id}`, email: `e2e-${id}@example.com`, password: 'e2e-password-123' };
}

/**
 * สมัครผ่าน API ตรงๆ (เร็วกว่าผ่านฟอร์ม) — ใช้กับ test ที่ไม่ได้ทดสอบฟอร์มสมัคร
 * page.request ใช้ cookie ร่วมกับเบราว์เซอร์ → ได้ refresh cookie เหมือนสมัครผ่านหน้าเว็บ
 */
export async function registerViaApi(page: Page, user: TestUser = uniqueUser()): Promise<TestUser> {
  const res = await page.request.post('/api/auth/register', { data: user });
  expect(res.status(), await res.text()).toBe(201);
  return user;
}

/** สมัครผ่าน API แล้วล้าง cookie ทิ้ง → ได้บัญชีที่ยังไม่ได้ล็อกอิน */
export async function createAccount(page: Page): Promise<TestUser> {
  const user = await registerViaApi(page);
  await page.context().clearCookies();
  return user;
}

export async function fillLogin(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel('อีเมล').fill(email);
  await page.getByLabel('รหัสผ่าน').fill(password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
}

/** ยืนยันว่าอยู่หน้า /groups และล็อกอินอยู่ */
export async function expectSignedIn(page: Page, user: TestUser): Promise<void> {
  await expect(page).toHaveURL(/\/groups$/);
  await expect(page.getByRole('heading', { name: `สวัสดี ${user.name}` })).toBeVisible();
}
