import { expect, test } from '@playwright/test';
import { E2E } from './env';
import { createAccount, expectSignedIn, fillLogin, registerViaApi, uniqueUser } from './fixtures';

const JWT_PATTERN = /eyJ[\w-]+\.[\w-]+\.[\w-]+/;

test.describe('open redirect protection', () => {
  for (const next of ['//evil.example', 'https://evil.example', '/\\evil.example']) {
    test(`?next=${next} stays on our site after login`, async ({ page }) => {
      const user = await createAccount(page);

      await page.goto(`/login?next=${encodeURIComponent(next)}`);
      await fillLogin(page, user.email, user.password);

      await expectSignedIn(page, user);
      expect(new URL(page.url()).origin).toBe(E2E.webUrl);
    });
  }

  test('a safe ?next= is honoured and kept when switching to the register page', async ({
    page,
  }) => {
    await page.goto('/login?next=%2Fgroups%3Ftab%3Dx');

    await expect(page.getByRole('link', { name: 'สมัครสมาชิก' })).toHaveAttribute(
      'href',
      '/register?next=%2Fgroups%3Ftab%3Dx',
    );
  });
});

test.describe('token storage', () => {
  test('refresh token is an HttpOnly cookie scoped to /api/auth and invisible to JavaScript', async ({
    page,
    context,
  }) => {
    const res = await page.request.post('/api/auth/register', { data: uniqueUser() });
    expect(res.status()).toBe(201);
    // SameSite ตรวจจาก header ที่ server ส่งจริง: ตอนเขียน test นี้ WebKit ของ Playwright (บน Windows)
    // รายงาน sameSite ใน cookie jar เป็น "None" ทั้งที่ server ส่ง Lax จึงไม่ใช้ค่าจาก cookie jar
    expect(res.headers()['set-cookie']).toMatch(/^refresh_token=.*;\s*SameSite=Lax/i);

    await page.goto('/groups');
    await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();

    const cookie = (await context.cookies()).find((c) => c.name === 'refresh_token');
    expect(cookie).toMatchObject({ httpOnly: true, path: '/api/auth' });
    expect(await page.evaluate(() => document.cookie)).not.toContain('refresh_token');
  });

  test('no token is stored in localStorage or sessionStorage', async ({ page }) => {
    await registerViaApi(page);
    await page.goto('/groups');
    await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();

    const stored = await page.evaluate(() =>
      [localStorage, sessionStorage].flatMap((s) =>
        Object.keys(s).map((k) => `${k}=${s.getItem(k) ?? ''}`),
      ),
    );
    for (const entry of stored) {
      expect(entry).not.toMatch(JWT_PATTERN);
      expect(entry).not.toContain('refresh');
    }
  });
});
