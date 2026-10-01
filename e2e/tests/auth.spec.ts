import { test, expect } from '@playwright/test';
import { E2E_USER } from '../global-setup';

// Ohne das gespeicherte Login-Cookie starten.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Anmeldung', () => {
  test('leitet ohne Login auf /login um und danach zur angefragten Seite zurück', async ({ page }) => {
    await page.goto('/plans');
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Benutzername').fill(E2E_USER.username);
    await page.getByLabel('Passwort').fill(E2E_USER.password);
    await page.getByRole('button', { name: 'Anmelden' }).click();

    await expect(page).toHaveURL(/\/plans$/);
    await expect(page.getByRole('heading', { name: 'Trainingspläne' })).toBeVisible();
  });

  test('zeigt einen Fehler bei falschem Passwort', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Benutzername').fill(E2E_USER.username);
    await page.getByLabel('Passwort').fill('falsches-passwort');
    await page.getByRole('button', { name: 'Anmelden' }).click();

    await expect(page.getByRole('alert')).toHaveText('Benutzername oder Passwort falsch');
  });

  test('meldet ab und sperrt danach den Zugriff', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Benutzername').fill(E2E_USER.username);
    await page.getByLabel('Passwort').fill(E2E_USER.password);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByRole('heading', { name: 'Training' })).toBeVisible();

    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/exercises');
    await expect(page).toHaveURL(/\/login$/);
  });
});
