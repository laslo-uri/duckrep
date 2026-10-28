import { test, expect } from '@playwright/test';
import { openUnlocked } from './helpers/vault';

test.describe('local app shell', () => {
  test('journal loads without auth', async ({ page }) => {
    await openUnlocked(page, '/journal');
    await expect(page).toHaveTitle(/Duckrep/i);
    await expect(page.getByRole('heading', { level: 1, name: /my journal|moj dnevnik/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('auth route redirects to the lobby', async ({ page }) => {
    await openUnlocked(page, '/auth');
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /what should we call you|kako da te zovemo|hogyan szólítsunk/i,
      }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('the old food page now lands on the journal', async ({ page }) => {
    await openUnlocked(page, '/food');
    await expect(page).toHaveURL(/\/journal$/, { timeout: 10_000 });
    await expect(page.getByRole('link', { name: /^(food|ishrana|étkezés)$/i })).toHaveCount(0);
  });

  test('exercises library loads', async ({ page }) => {
    await openUnlocked(page, '/exercises');
    await expect(page.getByRole('heading', { level: 1, name: /exercises|vežbe/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});
