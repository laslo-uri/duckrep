import { test, expect } from '@playwright/test';

test.describe('local app shell', () => {
  test('journal loads without auth', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/YouPeak/i);
    await expect(page.getByRole('heading', { level: 1, name: /my journal|moj dnevnik/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('auth route redirects to journal', async ({ page }) => {
    await page.goto('/auth');
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
  });

  test('exercises library loads', async ({ page }) => {
    await page.goto('/exercises');
    await expect(page.getByRole('heading', { level: 1, name: /exercises|vežbe/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});
