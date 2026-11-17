import { expect, test, type Page } from '@playwright/test';
import { E2E } from './env';
import { expectSignedIn, registerViaApi } from './fixtures';

function countRefreshes(page: Page): { readonly count: number; statuses: number[] } {
  const statuses: number[] = [];
  page.on('response', (res) => {
    if (res.url().endsWith('/api/auth/refresh')) statuses.push(res.status());
  });
  return {
    statuses,
    get count() {
      return statuses.length;
    },
  };
}

test.describe('session across tabs', () => {
  test('two tabs reloading at the same moment both stay signed in (Web Locks)', async ({
    context,
    page,
  }) => {
    // API ใช้ reuse detection แบบเข้มงวด: ถ้าสอง tab refresh ด้วย cookie เดียวกันพร้อมกัน
    // ตัวที่สองจะถูกมองว่า "ใช้ token ซ้ำ" แล้วทั้ง session ถูกยกเลิก
    // Web Locks ทำให้ tab ที่สองรอจน tab แรก rotate เสร็จ แล้วใช้ cookie ตัวใหม่
    const user = await registerViaApi(page);
    const tabA = page;
    const tabB = await context.newPage();

    await Promise.all([tabA.goto('/groups'), tabB.goto('/groups')]);
    await Promise.all([expectSignedIn(tabA, user), expectSignedIn(tabB, user)]);

    for (let round = 0; round < 3; round++) {
      await Promise.all([tabA.reload(), tabB.reload()]);
      await Promise.all([expectSignedIn(tabA, user), expectSignedIn(tabB, user)]);
    }

    // session ยังใช้ได้จริงฝั่ง server (ไม่ถูกยกเลิกเพราะ reuse detection)
    const res = await tabA.request.post('/api/auth/refresh');
    expect(res.status()).toBe(200);
  });
});

test.describe('access token expiry', () => {
  test('an expired access token is refreshed silently and the request is retried', async ({
    page,
  }) => {
    const user = await registerViaApi(page);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'ไปที่กลุ่มของฉัน' })).toBeVisible();
    const refreshes = countRefreshes(page);

    // รอให้ access token ใน memory หมดอายุ (E2E ตั้ง ACCESS_TOKEN_TTL = 5s)
    await page.waitForTimeout((E2E.accessTokenTtlSeconds + 1.5) * 1000);

    // เปลี่ยนหน้าแบบ client-side (token ยังอยู่ใน memory แต่หมดอายุแล้ว) → /groups เรียก /api/me
    const me = page.waitForResponse((r) => r.url().endsWith('/api/me') && r.status() === 200);
    await page.getByRole('link', { name: 'ไปที่กลุ่มของฉัน' }).click();
    await me;

    await expectSignedIn(page, user);
    await expect(page.getByText(user.email)).toBeVisible();
    expect(refreshes.statuses).toEqual([200]); // refresh 1 ครั้ง สำเร็จ แล้วลองใหม่ผ่าน
  });
});
