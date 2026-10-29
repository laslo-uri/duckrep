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

  test('a curated exercise shows both photos, every step and where to watch it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openUnlocked(page, '/exercises');
    await page.getByRole('searchbox', { name: /search exercises/i }).fill('bench press');
    await page.getByRole('button', { name: /^bench press barbell chest$/i }).click();
    const detail = page.getByRole('article', { name: /^bench press$/i });
    await expect(detail.getByRole('img', { name: /bench press, start position/i })).toHaveAttribute('src', /Barbell_Bench_Press_-_Medium_Grip\/0\.jpg$/);
    await expect(detail.getByRole('img', { name: /bench press, end position/i })).toHaveAttribute('src', /\/1\.jpg$/);
    await expect(detail.getByRole('listitem').nth(3)).toBeVisible();
    await expect(detail.getByRole('link', { name: /watch how/i })).toHaveAttribute('href', /youtube\.com\/results\?search_query=Bench%20Press/);
    await expect(detail.getByText(/^barbell$/i)).toBeVisible();
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

test.describe('exercise content in Hungarian and Serbian', () => {
  test('names, search and steps follow the app language', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openUnlocked(page, '/exercises');
    await page.getByRole('button', { name: /switch language to sr/i }).last().click();
    await page.getByRole('button', { name: /promeni jezik na hu/i }).last().click();
    await page.getByRole('searchbox').fill('fekvenyomás');
    await page.getByRole('button', { name: /^fekvenyomás bench press/i }).click();
    const detail = page.getByRole('article', { name: /^fekvenyomás$/i });
    await expect(detail.locator('ol[lang="hu"] li').first()).toContainText(/feküdj/i);

    // Search still finds an exercise by its English name, and an untranslated one says its steps are English.
    await page.getByRole('searchbox').fill('Anterior Tibialis-SMR');
    await page.getByRole('button', { name: /anterior tibialis-smr/i }).first().click();
    await expect(page.getByRole('article').getByText('(angolul)')).toBeVisible();
  });
});

test.describe('exercises open on what matters, not the whole library', () => {
  test('home shows yours and the essentials; the picker stays open for several adds', async ({ page }) => {
    await page.setViewportSize({ width: 945, height: 1000 });
    await openUnlocked(page, '/exercises');
    await expect(page.getByRole('heading', { level: 2, name: /^chest$/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^add to today's activity: 3\/4 sit-up$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^all 917$/i })).toBeVisible();

    await page.getByRole('searchbox').fill('bench press');
    await page.getByRole('button', { name: /^add to today's activity: bench press$/i }).click();
    await page.getByRole('button', { name: /^clear$/i }).click();
    await expect(page.getByRole('heading', { level: 2, name: /^your exercises$/i })).toBeVisible();

    await page.getByRole('status').getByRole('link', { name: /^open$/i }).click();
    await page.getByRole('button', { name: /from library/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('searchbox').fill('squat');
    await dialog.getByRole('button', { name: /^add exercise: squat$/i }).click();
    await dialog.getByRole('searchbox').fill('lat pulldown');
    await dialog.getByRole('button', { name: /^add exercise: lat pulldown$/i }).click();
    await expect(dialog.getByRole('status')).toHaveText(/2 added/i);
    await dialog.getByRole('button', { name: /^done$/i }).click();
    await expect(page.getByText(/^exercises\s*3$/i).first()).toBeVisible();
  });
});
