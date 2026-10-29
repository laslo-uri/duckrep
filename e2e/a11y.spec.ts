import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openUnlocked } from './helpers/vault';

const WIDTHS = [375, 768, 1440];
const THEMES = ['light', 'dark'] as const;

async function axe(page: Page, label: string) {
  // Let entry animations (dialogs fade in) finish: axe measures contrast as painted.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => null)),
    ),
  );
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
    .analyze();
  const summary = violations.map((v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
  expect.soft(summary).toEqual([]);
}

for (const theme of THEMES) {
  test.describe(`axe (${theme})`, () => {
    test.use({ colorScheme: theme });

    for (const width of WIDTHS) {
      test(`every page at ${width}px`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
        const consoleErrors: string[] = [];
        page.on('console', (message) => {
          if (message.type() === 'error') consoleErrors.push(message.text());
        });
        page.on('pageerror', (error) => consoleErrors.push(error.message));
        await page.goto('/journal');
        await expect(page.locator('#lock-pass')).toBeVisible({ timeout: 15_000 });
        await axe(page, `lock@${width}`);

        await openUnlocked(page, '/journal');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
        await axe(page, `journal@${width}`);

        const pages = [
          { path: '/exercises', link: /^exercises/i, title: /^exercises$/i },
          { path: '/stats', link: /^stats/i, title: /^stats$/i },
          { path: '/settings', link: /^settings/i, title: /^settings$/i },
        ];
        for (const { path, link, title } of pages) {
          await page.getByRole('link', { name: link }).first().click();
          await expect(page).toHaveURL(new RegExp(`${path}$`));
          // Lazy pages: wait for this page's own h1, not the one still on screen from the last page.
          await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({ timeout: 15_000 });
          if (path === '/exercises') {
            await expect(page.getByRole('button', { name: /^add to today's activity: /i }).first()).toBeVisible({ timeout: 20_000 });
            if (width < 1024) await page.getByRole('button', { name: /^body map/i }).click();
            await page.locator('[data-side="front"] [data-muscle="chest"] path').first().click();
          }
          await axe(page, `${path}@${width}`);
        }

        await page.getByRole('link', { name: /^(my journal|journal)$/i }).first().click();
        await page.getByRole('button', { name: /^new( activity)?$/i }).first().click();
        await expect(page).toHaveURL(/\/activity\/[0-9a-f-]{36}$/i, { timeout: 20_000 });
        await expect(page.getByRole('textbox', { name: /name this activity/i })).toBeVisible({ timeout: 15_000 });
        await axe(page, `activity@${width}`);
        await page.getByRole('button', { name: /from library/i }).first().click();
        await expect(page.getByRole('dialog').getByRole('heading', { name: /your exercises|essentials|chest/i }).first()).toBeVisible({ timeout: 15_000 });
        await axe(page, `picker@${width}`);
        await page.getByRole('dialog').getByRole('button', { name: /^done$/i }).click();
        await page.getByRole('button', { name: /search and commands/i }).first().click();
        await page.getByRole('dialog').getByRole('combobox').fill('squat');
        await expect(page.getByRole('option').first()).toBeVisible();
        await axe(page, `palette@${width}`);
        await page.keyboard.press('Escape');
        expect(consoleErrors).toEqual([]);
      });
    }
  });
}
