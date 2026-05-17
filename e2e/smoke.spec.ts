import { test, expect } from '@playwright/test'

test.describe('public shell', () => {
  test('auth page loads with sign-in affordance', async ({ page }) => {
    await page.goto('/auth')
    await expect(page).toHaveTitle(/YouPeak/i)
    await expect(page.getByRole('button', { name: /sign in|prijavi se/i })).toBeVisible()
  })

  test('unauthenticated root redirects to auth', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/auth$/)
  })

  test('public feed route renders feed heading', async ({ page }) => {
    await page.goto('/feed')
    await expect(page.getByRole('heading', { level: 1, name: /public feed|javni prikaz/i })).toBeVisible({
      timeout: 15_000,
    })
  })
})
