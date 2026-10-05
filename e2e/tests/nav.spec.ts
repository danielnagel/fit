import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('redirects the root path to /training', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/training$/);
    await expect(page.getByRole('heading', { name: 'Training' })).toBeVisible();
  });

  test('every nav link leads to the right page', async ({ page }) => {
    await page.goto('/training');
    // Nav.tsx renders the 5 links twice (desktop header + mobile bottom nav) --
    // scope to the header so the locators are unique.
    const nav = page.locator('header');

    await nav.getByRole('link', { name: 'Plans' }).click();
    await expect(page.getByRole('heading', { name: 'Training plans' })).toBeVisible();

    await nav.getByRole('link', { name: 'Methods' }).click();
    await expect(page.getByRole('heading', { name: 'Training methods' })).toBeVisible();

    await nav.getByRole('link', { name: 'Exercises' }).click();
    await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible();

    await nav.getByRole('link', { name: 'History' }).click();
    await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Training history' })).toBeVisible();

    await nav.getByRole('link', { name: 'Training' }).click();
    await expect(page.getByRole('heading', { name: 'Training' })).toBeVisible();
  });
});
