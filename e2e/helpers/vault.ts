import { expect, type Page } from '@playwright/test';

/** Test-only passphrase: each Playwright context starts with an empty browser profile. */
export const E2E_PASSPHRASE = 'e2e duck lifts daily';

/**
 * Opens `path` and gets past the lock screen: creates the passphrase on a fresh profile,
 * types it on a locked one. Every full page load locks the journal again.
 */
export async function openUnlocked(page: Page, path: string): Promise<void> {
  await page.goto(path);
  const create = page.getByRole('button', { name: /create and unlock|napravi i otključaj|létrehozás és feloldás/i });
  const unlock = page.getByRole('button', { name: /^(unlock|otključaj|feloldás)$/i });
  await expect(create.or(unlock)).toBeVisible({ timeout: 15_000 });
  if (await create.isVisible()) {
    await page.locator('#lock-pass').fill(E2E_PASSPHRASE);
    await page.locator('#lock-confirm').fill(E2E_PASSPHRASE);
    await create.click();
  } else {
    await page.locator('#lock-pass').fill(E2E_PASSPHRASE);
    await unlock.click();
  }
  await expect(page.locator('#lock-pass')).toBeHidden({ timeout: 15_000 });
}
