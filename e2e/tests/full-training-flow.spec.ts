import { test, expect } from '@playwright/test';

test.describe('Kompletter Trainingsablauf', () => {
  test('Plan anlegen, Woche starten, Training durchführen und in der Historie sehen', async ({ page }) => {
    await page.goto('/exercises');
    await page.getByPlaceholder('Name').fill('E2E Liegestütz');
    await page.getByRole('button', { name: 'Hinzufügen' }).click();
    await expect(page.getByText('E2E Liegestütz', { exact: true })).toBeVisible();

    // Plan mit der Katalog-Methode "Intervallsatz" (fixed-window-remainder, 3 Runden, Seed aus Migration 0011).
    await page.goto('/plans');
    await page.getByRole('button', { name: 'Neuer Plan' }).click();
    await page.getByLabel('Name').fill('E2E Flow-Plan');
    await page.getByPlaceholder('Trainingstag-Name').fill('Tag A');
    await page.locator('select').nth(0).selectOption({ label: 'Intervallsatz' });
    await page.locator('select').nth(1).selectOption({ label: 'E2E Liegestütz' });
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.locator('li').filter({ hasText: 'E2E Flow-Plan' })).toBeVisible();

    // Woche starten.
    await page.goto('/training');
    await page.getByLabel('Plan').selectOption({ label: 'E2E Flow-Plan' });
    await page.getByRole('button', { name: 'Woche starten' }).click();
    await expect(page.getByText('E2E Flow-Plan')).toBeVisible();

    // Trainingstag waehlen und Training starten.
    await page.getByLabel('Trainingstag').selectOption({ label: 'Tag A (Intervallsatz)' });
    await page.getByRole('button', { name: 'Training starten' }).click();

    // 3 Runden durchlaufen (fixed-count, rounds=3) -- Wiederholungen eintragen und "Weiter"
    // klicken statt auf den echten 180s-Fenster-Timer zu warten.
    for (let round = 1; round <= 3; round++) {
      await expect(page.getByText(`Satz ${round}/3`)).toBeVisible();
      await page.getByLabel('Wiederholungen').fill('10');
      await page.getByRole('button', { name: 'Weiter' }).click();
    }

    // Nach der letzten Runde schliesst die Session automatisch ab und man landet zurueck bei
    // SessionStart; die Woche ist weiterhin aktiv (Fenster verstreicht, sobald sie sichtbar ist).
    await expect(page.getByRole('button', { name: 'Woche beenden' })).toBeVisible();

    await page.goto('/history');
    await page.getByRole('button', { name: 'Woche anzeigen' }).click();
    // Der Wochen-<li> umschliesst den Session-<li>, beide enthalten "Tag A" als Text --
    // .last() greift den inneren (spezifischeren) Session-Eintrag.
    const sessionRow = page.locator('li').filter({ hasText: 'Tag A' }).last();
    await expect(sessionRow).toContainText('Abgeschlossen');

    await sessionRow.getByRole('button', { name: 'Details' }).click();
    await expect(sessionRow.getByText('E2E Liegestütz').first()).toBeVisible();
    await expect(sessionRow.getByRole('cell', { name: '10' }).first()).toBeVisible();

    // Aufraeumen: Woche wieder beenden, damit kein globaler Zustand fuer andere Specs haengen bleibt.
    await page.goto('/training');
    await page.getByRole('button', { name: 'Woche beenden' }).click();
    await page.getByRole('button', { name: 'Beenden', exact: true }).click();
    await expect(page.getByLabel('Plan')).toBeVisible();
  });
});
