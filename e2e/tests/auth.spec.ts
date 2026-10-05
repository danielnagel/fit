import { test, expect } from '@playwright/test';
import { E2E_USER } from '../global-setup';

// Start without the stored login cookie.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login', () => {
  test('redirects to /login without a login and back to the requested page afterwards', async ({ page }) => {
    await page.goto('/plans');
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Username').fill(E2E_USER.username);
    await page.getByLabel('Password').fill(E2E_USER.password);
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(/\/plans$/);
    await expect(page.getByRole('heading', { name: 'Training plans' })).toBeVisible();
  });

  test('shows an error for a wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill(E2E_USER.username);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByRole('alert')).toHaveText('Wrong username or password');
  });

  test('logs out and blocks access afterwards', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill(E2E_USER.username);
    await page.getByLabel('Password').fill(E2E_USER.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('heading', { name: 'Training' })).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/exercises');
    await expect(page).toHaveURL(/\/login$/);
  });
});
