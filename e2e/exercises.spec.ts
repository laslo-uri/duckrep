import { test, expect, type Page } from '@playwright/test';
import { openUnlocked } from './helpers/vault';

const libraryRows = (page: Page) => page.getByRole('button', { name: /^add to today's activity: /i });

test.describe('exercise search with the body map', () => {
  test('body map and equipment filter the offline library; one click adds to today', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openUnlocked(page, '/exercises');
    await expect(page.getByRole('heading', { level: 1, name: /exercises/i })).toBeVisible({ timeout: 15_000 });
    await expect(libraryRows(page).first()).toBeVisible({ timeout: 20_000 });

    const biceps = page.locator('[data-side="front"] [data-muscle="biceps"]');
    await biceps.locator('path').first().click();
    await expect(biceps).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: /^dumbbell$/i }).click();
    await page.getByRole('searchbox', { name: /search exercises/i }).fill('hammer');
    await expect(page.getByRole('button', { name: /add to today's activity: hammer curls/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add to today's activity: bench press$/i })).toHaveCount(0);

    await page.getByRole('button', { name: /add to today's activity: hammer curls/i }).click();
    const status = page.getByRole('status').filter({ hasText: /hammer curls/i });
    await expect(status).toContainText(/new activity for today/i);
    await page.getByRole('button', { name: /add to today's activity: hammer curls/i }).click();
    await expect(status).toContainText(/added to today's activity/i);

    await status.getByRole('link', { name: /^open$/i }).click();
    await expect(page).toHaveURL(/\/activity\/[0-9a-f-]{36}$/i);
    await expect(page.getByText(/hammer curls/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('MuscleWiki results come through the proxy and file under the library', async ({ page }) => {
    await page.route('**/api/musclewiki?**', async (route) => {
      const path = new URL(route.request().url()).searchParams.get('path') ?? '';
      const body = path.startsWith('/categories')
        ? [{ name: 'dumbbells', display_name: 'Dumbbells' }]
        : path.startsWith('/muscles')
          ? [{ name: 'Biceps' }, { name: 'Chest' }]
          : path.startsWith('/exercises/42')
            ? { id: 42, name: 'Dumbbell Spider Curl', primary_muscles: ['Biceps'], steps: ['Lie on the bench.'], videos: [] }
            : { total: 1, results: [{ id: 42, name: 'Dumbbell Spider Curl' }] };
      if (path.startsWith('/exercises?') || path.startsWith('/search')) {
        expect(path).toContain('muscles=Biceps');
      }
      await route.fulfill({ json: body });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await openUnlocked(page, '/exercises');
    await page.locator('[data-side="front"] [data-muscle="biceps"] path').first().click();
    await page.getByRole('button', { name: /^musclewiki$/i }).click();
    await expect(page.getByRole('button', { name: /^dumbbells$/i })).toBeVisible();
    await page.getByRole('button', { name: /^dumbbell spider curl$/i }).click();
    await expect(page.getByText('Lie on the bench.')).toBeVisible();
    await expect(page.getByRole('link', { name: /provided by musclewiki\.com/i })).toBeVisible();

    await page.getByRole('button', { name: /add to today's activity: dumbbell spider curl/i }).click();
    await expect(page.getByRole('status').filter({ hasText: /dumbbell spider curl/i })).toBeVisible();

    await page.getByRole('button', { name: /^library$/i }).click();
    await page.getByRole('searchbox', { name: /search exercises/i }).fill('spider curl');
    await expect(page.getByRole('button', { name: /add to today's activity: dumbbell spider curl/i })).toBeVisible();
  });

  test('without a server key MuscleWiki says so and the library stays usable', async ({ page }) => {
    await page.route('**/api/musclewiki?**', (route) =>
      route.fulfill({ status: 503, json: { error: 'not_configured' } }),
    );
    await page.setViewportSize({ width: 375, height: 812 });
    await openUnlocked(page, '/exercises');
    await page.getByRole('button', { name: /^musclewiki$/i }).click();
    await expect(page.getByText(/needs a server key/i)).toBeVisible();
    await page.getByRole('button', { name: /^library$/i }).click();
    await page.getByRole('button', { name: /^body map/i }).click();
    await page.locator('[data-side="back"] [data-muscle="glutes"] path').first().click();
    await expect(libraryRows(page).first()).toBeVisible({ timeout: 20_000 });
  });
});
