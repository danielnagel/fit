import { test, expect } from '@playwright/test';

test.describe('Trainingsmethoden', () => {
  test('legt für jede Timing-Familie eine Methode an, bearbeitet und löscht eine davon', async ({ page }) => {
    await page.goto('/training-methods');

    // 1) fixed-window-remainder bleibt auf den Formular-Defaults (Umfang/Stopp-Bedingung unveraendert).
    await page.getByLabel('Name').fill('E2E Fenstermethode');
    await page.getByRole('button', { name: 'Hinzufügen' }).click();
    await expect(page.locator('li').filter({ hasText: 'E2E Fenstermethode' })).toContainText('Festes Zeitfenster je Runde');

    // 2) fixed-work-rest
    await page.getByLabel('Name').fill('E2E Belastungsmethode');
    await page.getByLabel('Timing').selectOption({ label: 'Feste Belastung/Pause je Runde' });
    await page.getByRole('button', { name: 'Hinzufügen' }).click();
    await expect(page.locator('li').filter({ hasText: 'E2E Belastungsmethode' })).toContainText(
      'Feste Belastung/Pause je Runde',
    );

    // 3) self-paced
    await page.getByLabel('Name').fill('E2E Tempomethode');
    await page.getByLabel('Timing').selectOption({ label: 'Selbstbestimmtes Tempo' });
    await page.getByRole('button', { name: 'Hinzufügen' }).click();
    await expect(page.locator('li').filter({ hasText: 'E2E Tempomethode' })).toContainText('Selbstbestimmtes Tempo');

    // Bearbeiten -- nach dem Umschalten in den Edit-Modus enthaelt das <li> den Namen nur noch
    // als Input-Value, nicht mehr als Text, daher hier ueber den "Speichern"-Button scopen statt
    // ueber hasText (sonst matcht der Row-Locator nach dem Moduswechsel nichts mehr).
    const windowRow = page.locator('li').filter({ hasText: 'E2E Fenstermethode' });
    await windowRow.getByRole('button', { name: 'Bearbeiten' }).click();
    const editingRow = page.locator('li').filter({ has: page.getByRole('button', { name: 'Speichern' }) });
    await editingRow.getByLabel('Name').fill('E2E Fenstermethode bearbeitet');
    await editingRow.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.locator('li').filter({ hasText: 'E2E Fenstermethode bearbeitet' })).toBeVisible();

    // Löschen (unbenutzt, darf ohne Konflikt geloescht werden)
    const tempoRow = page.locator('li').filter({ hasText: 'E2E Tempomethode' });
    await tempoRow.getByRole('button', { name: 'Löschen' }).click();
    await page.getByRole('button', { name: 'Löschen' }).last().click();
    await expect(page.locator('li').filter({ hasText: 'E2E Tempomethode' })).toHaveCount(0);
  });
});
