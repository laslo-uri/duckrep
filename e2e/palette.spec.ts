import { test, expect } from '@playwright/test';
import { openUnlocked } from './helpers/vault';

test.describe('Ctrl+K command palette', () => {
  test('adds an exercise from any page, found in any language without diacritics', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openUnlocked(page, '/stats');
    await expect(page.getByRole('heading', { level: 1, name: /^stats$/i })).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: /command menu/i });
    await expect(palette).toBeVisible();
    const input = palette.getByRole('combobox');
    await expect(input).toBeFocused();
    await input.fill('cucanj');
    await expect(palette.getByRole('option').first()).toHaveText(/^squat/i);
    await input.press('Enter');
    await expect(page).toHaveURL(/\/activity\/[0-9a-f-]{36}$/i, { timeout: 20_000 });
    await expect(palette).toHaveCount(0);
    await expect(page.getByText(/^squat$/i).first()).toBeVisible();
  });

  test('jumps to a page with the arrow keys, closes on Escape', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openUnlocked(page, '/journal');
    await page.getByRole('button', { name: /search and commands/i }).click();
    const input = page.getByRole('dialog').getByRole('combobox');
    await input.fill('go to');
    await input.press('ArrowDown');
    await expect(page.getByRole('option', { selected: true })).toHaveText(/exercises/i);
    await input.press('Enter');
    await expect(page).toHaveURL(/\/exercises$/);

    await expect(page.getByRole('heading', { level: 1, name: /^exercises$/i })).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('phones open it from the header search button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openUnlocked(page, '/journal');
    await page.getByRole('button', { name: /search and commands/i }).click();
    const input = page.getByRole('dialog').getByRole('combobox');
    await input.fill('stats');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/stats$/);
  });
});
