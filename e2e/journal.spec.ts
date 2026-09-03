import { test, expect } from '@playwright/test';

test.describe('journal flow (local)', () => {
  test('open journal and create an activity', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { level: 1, name: /my journal|moj dnevnik/i }),
    ).toBeVisible({ timeout: 15_000 });

    await page.goto('/activity/new');
    await page.getByRole('button', { name: /new activity|nova aktivnost/i }).click();

    await expect(page).toHaveURL(/\/activity\/[0-9a-f-]{36}$/i, { timeout: 20_000 });
    await expect(page.getByRole('link', { name: /cancel|otkaži/i })).toBeVisible();
  });
});
