import { expect, test } from '@playwright/test';
import { createAccount, expectSignedIn, fillLogin, registerViaApi, uniqueUser } from './fixtures';

test.describe('sign up', () => {
  test('registers through the form, lands on /groups and stays signed in after reload', async ({
    page,
  }) => {
    const user = uniqueUser();
    await page.goto('/register');

    await page.getByLabel('ชื่อ').fill(user.name);
    await page.getByLabel('อีเมล').fill(user.email);
    await page.getByLabel(/รหัสผ่าน/).fill(user.password);
    await page.getByRole('button', { name: 'สมัครสมาชิก' }).click();

    await expectSignedIn(page, user);
    await expect(page.getByText(user.email)).toBeVisible(); // จาก /api/me

    await page.reload(); // access token ใน memory หาย → กู้ด้วย refresh cookie
    await expectSignedIn(page, user);
  });

  test('shows a field error when the email is already registered', async ({ page }) => {
    const existing = await createAccount(page);
    await page.goto('/register');

    await page.getByLabel('ชื่อ').fill('อีกคน');
    await page.getByLabel('อีเมล').fill(existing.email.toUpperCase());
    await page.getByLabel(/รหัสผ่าน/).fill('another-password-1');
    await page.getByRole('button', { name: 'สมัครสมาชิก' }).click();

    await expect(page.getByText('อีเมลนี้ถูกใช้สมัครแล้ว')).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });
});

test.describe('log in', () => {
  test('wrong password shows one generic message; correct password signs in', async ({ page }) => {
    const user = await createAccount(page);
    await page.goto('/login');

    await fillLogin(page, user.email, 'wrong-password');
    // ระบุว่าอยู่ใน form: Next.js มี route announcer ที่เป็น role="alert" อยู่บนทุกหน้าด้วย
    await expect(page.locator('form').getByRole('alert')).toHaveText('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    await expect(page.getByLabel('รหัสผ่าน')).toHaveValue('');

    await fillLogin(page, user.email, user.password);
    await expectSignedIn(page, user);
  });

  test('signed-in users visiting /login are sent to /groups', async ({ page }) => {
    const user = await registerViaApi(page);

    await page.goto('/login');

    await expectSignedIn(page, user);
  });
});

test.describe('protected page', () => {
  test('anonymous visit to /groups → /login?next=/groups → back to /groups after login', async ({
    page,
  }) => {
    const user = await createAccount(page);

    await page.goto('/groups');
    await expect(page).toHaveURL(/\/login\?next=%2Fgroups$/);

    await fillLogin(page, user.email, user.password);
    await expectSignedIn(page, user);
  });
});

test.describe('log out', () => {
  test('logs out, and /groups is no longer reachable (also via the back button)', async ({
    page,
  }) => {
    const user = await registerViaApi(page);
    await page.goto('/');
    await page.getByRole('link', { name: 'ไปที่กลุ่มของฉัน' }).click();
    await expectSignedIn(page, user);

    await page.getByRole('button', { name: 'ออกจากระบบ' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goBack();
    await expect(page.getByRole('heading', { name: /สวัสดี/ })).toHaveCount(0);

    await page.goto('/groups');
    await expect(page).toHaveURL(/\/login\?next=%2Fgroups$/);

    // refresh cookie ถูกยกเลิกฝั่ง server แล้ว ไม่ใช่แค่ลบในเบราว์เซอร์
    const res = await page.request.post('/api/auth/refresh');
    expect(res.status()).toBe(401);
  });
});
