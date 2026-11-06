import { test, expect } from '@playwright/test';
import { openUnlocked } from './helpers/vault';

/**
 * position: fixed things live inside the page wrapper, which plays an entrance animation. If that
 * animation stays applied, they stop following the viewport and land below the fold on a long page.
 */
test.describe('dialogs and the rest timer on a long page', () => {
  test.use({ viewport: { width: 390, height: 700 } });

  test('stay inside the viewport', async ({ page }) => {
    test.setTimeout(90_000);
    await openUnlocked(page, '/activity/new');
    await page.locator('#main-content').getByRole('button', { name: /new activity|nova aktivnost/i }).click();
    await expect(page).toHaveURL(/\/activity\/[0-9a-f-]{36}$/i, { timeout: 20_000 });

    const addExercise = page.locator('#main-content').getByRole('button', { name: /^add exercise$/i }).first();
    const cards = page.locator('#main-content section[aria-label]').filter({ has: page.getByRole('button', { name: /^add set$/i }) });
    for (let count = 1; count <= 6; count += 1) {
      await addExercise.click();
      await expect(cards).toHaveCount(count);
    }
    await cards.first().getByRole('button', { name: /^add set$/i }).click();
    await page.evaluate(() => scrollTo(0, 0));

    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(scrollHeight).toBeGreaterThan(1400);

    await page.getByRole('button', { name: /mark set complete/i }).first().click();
    await expect(page.getByRole('timer')).toBeInViewport({ ratio: 1 });

    await page.locator('#main-content').getByRole('button', { name: /from library/i }).click();
    const picker = page.getByRole('dialog');
    await expect(picker).toBeInViewport({ ratio: 1 });
    await expect(picker.getByRole('button', { name: /^done$/i })).toBeInViewport({ ratio: 1 });
    await page.keyboard.press('Escape');
    await expect(picker).toBeHidden();

    await page.locator('#main-content').getByRole('button', { name: /remove log/i }).click();
    const confirm = page.getByRole('dialog');
    await expect(confirm).toBeInViewport({ ratio: 1 });
    await page.keyboard.press('Escape');
    await expect(confirm).toBeHidden();
  });

  test('the type menu works from the keyboard', async ({ page }) => {
    test.setTimeout(60_000);
    await openUnlocked(page, '/activity/new');
    await page.locator('#main-content').getByRole('button', { name: /new activity|nova aktivnost/i }).click();
    await expect(page).toHaveURL(/\/activity\/[0-9a-f-]{36}$/i, { timeout: 20_000 });

    const trigger = page.getByRole('button', { name: /activity type/i });
    await trigger.click();
    const list = page.getByRole('listbox', { name: /activity type/i });
    await expect(list.getByRole('option', { name: /strength/i })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(list.getByRole('option', { name: /cardio/i })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(list).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
