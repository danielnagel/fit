import { test, expect } from '@playwright/test';

test.describe('Exercises', () => {
  test('creates, edits and deletes an exercise', async ({ page }) => {
    await page.goto('/exercises');

    await page.getByPlaceholder('Name').fill('E2E Squat');
    await page.getByPlaceholder('Description (optional)').fill('deep and slow');
    await page.getByRole('button', { name: 'Add' }).click();

    const row = page.locator('li').filter({ hasText: 'E2E Squat' });
    await expect(row).toBeVisible();
    await expect(row.getByText('deep and slow')).toBeVisible();

    await row.getByRole('button', { name: 'Edit' }).click();
    // In edit mode both the edited row and the (still visible) add form have a field with
    // placeholder "Name" -- scope via the "Save" button.
    const editingRow = page.locator('li').filter({ has: page.getByRole('button', { name: 'Save' }) });
    await editingRow.getByPlaceholder('Name').fill('E2E deep squat');
    await editingRow.getByRole('button', { name: 'Save' }).click();

    const updatedRow = page.locator('li').filter({ hasText: 'E2E deep squat' });
    await expect(updatedRow).toBeVisible();

    await updatedRow.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).last().click();

    await expect(page.locator('li').filter({ hasText: 'E2E deep squat' })).toHaveCount(0);
  });
});
