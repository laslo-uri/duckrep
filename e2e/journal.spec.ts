import { test, expect } from '@playwright/test';
import { E2E_PASSPHRASE, openUnlocked } from './helpers/vault';

test.describe('journal flow (local)', () => {
  test('open journal and create an activity', async ({ page }) => {
    await openUnlocked(page, '/journal');

    await expect(
      page.getByRole('heading', { level: 1, name: /my journal|moj dnevnik/i }),
    ).toBeVisible({ timeout: 15_000 });

    await openUnlocked(page, '/activity/new');
    await page.getByRole('button', { name: /new activity|nova aktivnost/i }).click();

    await expect(page).toHaveURL(/\/activity\/[0-9a-f-]{36}$/i, { timeout: 20_000 });
    await expect(
      page.getByRole('link', { name: /back to journal|nazad na dnevnik|vissza a naplóhoz/i }),
    ).toBeVisible();
  });

  test('lock keeps the journal behind the passphrase', async ({ page }) => {
    test.setTimeout(90_000); // three unlocks, each a slow-on-purpose key derivation
    await openUnlocked(page, '/activity/new');
    await page.getByRole('button', { name: /new activity|nova aktivnost/i }).click();
    await expect(page).toHaveURL(/\/activity\/[0-9a-f-]{36}$/i, { timeout: 20_000 });
    const activityUrl = page.url();

    await page.goto('/settings#security');
    await page.locator('#lock-pass').fill(E2E_PASSPHRASE);
    await page.getByRole('button', { name: /^(unlock|otključaj|feloldás)$/i }).click();
    await page.getByRole('button', { name: /lock now|zaključaj sada|zárolás most/i }).click();

    await expect(page.locator('#lock-pass')).toBeVisible({ timeout: 15_000 });
    await page.locator('#lock-pass').fill('not the passphrase');
    await page.getByRole('button', { name: /^(unlock|otključaj|feloldás)$/i }).click();
    await expect(page.getByRole('alert')).toHaveText(/wrong passphrase|pogrešna lozinka|hibás jelmondat/i);

    await openUnlocked(page, activityUrl);
    await expect(
      page.getByRole('link', { name: /back to journal|nazad na dnevnik|vissza a naplóhoz/i }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
