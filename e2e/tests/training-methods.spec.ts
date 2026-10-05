import { test, expect } from '@playwright/test';

test.describe('Training methods', () => {
  test('creates a method for every timing family, edits and deletes one of them', async ({ page }) => {
    await page.goto('/training-methods');

    // 1) fixed-window-remainder stays on the form defaults (scope/stop condition unchanged).
    await page.getByLabel('Name').fill('E2E window method');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.locator('li').filter({ hasText: 'E2E window method' })).toContainText('Fixed time window per round');

    // 2) fixed-work-rest
    await page.getByLabel('Name').fill('E2E work method');
    await page.getByLabel('Timing').selectOption({ label: 'Fixed work/rest per round' });
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.locator('li').filter({ hasText: 'E2E work method' })).toContainText(
      'Fixed work/rest per round',
    );

    // 3) self-paced
    await page.getByLabel('Name').fill('E2E tempo method');
    await page.getByLabel('Timing').selectOption({ label: 'Self-paced' });
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.locator('li').filter({ hasText: 'E2E tempo method' })).toContainText('Self-paced');

    // Edit -- after switching into edit mode the <li> only contains the name as an input
    // value, no longer as text, so scope via the "Save" button here instead of
    // hasText (otherwise the row locator no longer matches anything after the mode switch).
    const windowRow = page.locator('li').filter({ hasText: 'E2E window method' });
    await windowRow.getByRole('button', { name: 'Edit' }).click();
    const editingRow = page.locator('li').filter({ has: page.getByRole('button', { name: 'Save' }) });
    await editingRow.getByLabel('Name').fill('E2E window method edited');
    await editingRow.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('li').filter({ hasText: 'E2E window method edited' })).toBeVisible();

    // Delete (unused, may be deleted without conflict)
    const tempoRow = page.locator('li').filter({ hasText: 'E2E tempo method' });
    await tempoRow.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).last().click();
    await expect(page.locator('li').filter({ hasText: 'E2E tempo method' })).toHaveCount(0);
  });
});
