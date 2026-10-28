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

  test('unlocking lands straight on the journal, no greeting page', async ({ page }) => {
    for (const path of ['/', '/auth']) {
      await openUnlocked(page, path);
      await expect(page).toHaveURL(/\/journal$/, { timeout: 10_000 });
      await expect(page.getByRole('heading', { level: 1, name: /my journal|moj dnevnik|naplóm/i })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(/^(hello|zdravo|szia),/i)).toHaveCount(0);
    }
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
