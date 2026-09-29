import { test, expect } from '@playwright/test';

test.describe('Übungen', () => {
  test('legt eine Übung an, bearbeitet und löscht sie', async ({ page }) => {
    await page.goto('/exercises');

    await page.getByPlaceholder('Name').fill('E2E Kniebeuge');
    await page.getByPlaceholder('Beschreibung (optional)').fill('tief und langsam');
    await page.getByRole('button', { name: 'Hinzufügen' }).click();

    const row = page.locator('li').filter({ hasText: 'E2E Kniebeuge' });
    await expect(row).toBeVisible();
    await expect(row.getByText('tief und langsam')).toBeVisible();

    await row.getByRole('button', { name: 'Bearbeiten' }).click();
    // Waehrend des Edit-Modus hat sowohl die bearbeitete Zeile als auch das (weiterhin sichtbare)
    // Hinzufuegen-Formular ein Feld mit Placeholder "Name" -- ueber den "Speichern"-Button scopen.
    const editingRow = page.locator('li').filter({ has: page.getByRole('button', { name: 'Speichern' }) });
    await editingRow.getByPlaceholder('Name').fill('E2E Kniebeuge tief');
    await editingRow.getByRole('button', { name: 'Speichern' }).click();

    const updatedRow = page.locator('li').filter({ hasText: 'E2E Kniebeuge tief' });
    await expect(updatedRow).toBeVisible();

    await updatedRow.getByRole('button', { name: 'Löschen' }).click();
    await page.getByRole('button', { name: 'Löschen' }).last().click();

    await expect(page.locator('li').filter({ hasText: 'E2E Kniebeuge tief' })).toHaveCount(0);
  });
});
