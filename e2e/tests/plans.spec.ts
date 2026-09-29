import { test, expect } from '@playwright/test';

test.describe('Trainingspläne', () => {
  test('legt einen Plan mit Single- und Pair-Scope-Block an, zeigt Details, bearbeitet und löscht ihn', async ({
    page,
  }) => {
    await page.goto('/exercises');
    for (const name of ['E2E Kniebeuge', 'E2E Klimmzug schwer', 'E2E Klimmzug leicht']) {
      await page.getByPlaceholder('Name').fill(name);
      await page.getByRole('button', { name: 'Hinzufügen' }).click();
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }

    await page.goto('/plans');
    await page.getByRole('button', { name: 'Neuer Plan' }).click();

    await page.getByLabel('Name').fill('E2E Ganzkörperplan');
    await page.getByPlaceholder('Trainingstag-Name').fill('Tag A');

    // Block 1 (single scope, bereits vorhanden): Methode + Übung waehlen.
    const selects = page.locator('select');
    await selects.nth(0).selectOption({ label: 'Intervallsatz' });
    await selects.nth(1).selectOption({ label: 'E2E Kniebeuge' });

    // Block 2 hinzufuegen und auf eine Pair-Scope-Methode umstellen -> 2 Uebungs-Slots erscheinen.
    await page.getByRole('button', { name: 'Block hinzufügen' }).click();
    await page.locator('select').nth(2).selectOption({ label: 'Supersatz' });
    await page.locator('select').nth(3).selectOption({ label: 'E2E Klimmzug schwer' });
    await page.locator('select').nth(4).selectOption({ label: 'E2E Klimmzug leicht' });

    await page.getByRole('button', { name: 'Speichern' }).click();

    const planRow = page.locator('li').filter({ hasText: 'E2E Ganzkörperplan' });
    await expect(planRow).toContainText('1 Trainingstag(e)');

    await planRow.getByRole('button', { name: 'Details' }).click();
    await expect(planRow.getByText('Tag A')).toBeVisible();
    await expect(planRow.getByText('Intervallsatz')).toBeVisible();
    await expect(planRow.getByText('Supersatz')).toBeVisible();
    await expect(planRow.getByText('schwer: E2E Klimmzug schwer')).toBeVisible();
    await expect(planRow.getByText('leicht: E2E Klimmzug leicht')).toBeVisible();

    await planRow.getByRole('button', { name: 'Bearbeiten' }).click();
    await page.getByLabel('Name').fill('E2E Ganzkörperplan bearbeitet');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.locator('li').filter({ hasText: 'E2E Ganzkörperplan bearbeitet' })).toBeVisible();

    const updatedRow = page.locator('li').filter({ hasText: 'E2E Ganzkörperplan bearbeitet' });
    await updatedRow.getByRole('button', { name: 'Löschen' }).click();
    await page.getByRole('button', { name: 'Löschen' }).last().click();
    await expect(page.locator('li').filter({ hasText: 'E2E Ganzkörperplan bearbeitet' })).toHaveCount(0);
  });
});
