import { expect, test } from '@playwright/test';

test('home page loads and reaches the API and database through the proxy', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'split-promptpay' })).toBeVisible();
  await expect(page.getByText('API พร้อมใช้งาน')).toBeVisible();
});
