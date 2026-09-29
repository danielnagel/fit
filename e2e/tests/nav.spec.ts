import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('redirects the root path to /training', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/training$/);
    await expect(page.getByRole('heading', { name: 'Training' })).toBeVisible();
  });

  test('every nav link leads to the right page', async ({ page }) => {
    await page.goto('/training');
    // Nav.tsx rendert die 5 Links zweimal (Desktop-Header + Mobile-Bottom-Nav) --
    // auf den Header scopen, damit die Locators eindeutig sind.
    const nav = page.locator('header');

    await nav.getByRole('link', { name: 'Pläne' }).click();
    await expect(page.getByRole('heading', { name: 'Trainingspläne' })).toBeVisible();

    await nav.getByRole('link', { name: 'Methoden' }).click();
    await expect(page.getByRole('heading', { name: 'Trainingsmethoden' })).toBeVisible();

    await nav.getByRole('link', { name: 'Übungen' }).click();
    await expect(page.getByRole('heading', { name: 'Übungen' })).toBeVisible();

    await nav.getByRole('link', { name: 'Historie' }).click();
    await expect(page.getByRole('heading', { name: 'Fortschritt' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trainingshistorie' })).toBeVisible();

    await nav.getByRole('link', { name: 'Training' }).click();
    await expect(page.getByRole('heading', { name: 'Training' })).toBeVisible();
  });
});
