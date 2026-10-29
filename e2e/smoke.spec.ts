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

test.describe('journal and stats open on this week', () => {
  test('journal leads with this week, stats with this week against last week', async ({ page }) => {
    await openUnlocked(page, '/activity/new');
    await page.locator('#main-content').getByRole('button', { name: /new activity/i }).click();
    await expect(page).toHaveURL(/\/activity\/[0-9a-f-]{36}$/i, { timeout: 20_000 });
    await page.getByRole('link', { name: /^my journal$/i }).first().click();
    await expect(page.getByRole('heading', { level: 2, name: /^this week/i })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: /^today/i })).toBeVisible();

    await page.getByRole('link', { name: /^stats$/i }).first().click();
    await expect(page.getByRole('heading', { level: 2, name: /^this week$/i })).toBeVisible();
    await expect(page.getByText(/vs last week|same as last week/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /settings → profile/i })).toHaveAttribute('href', '/settings#profile');
  });
});
