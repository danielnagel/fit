import { test, expect } from '@playwright/test';

test.describe('Training plans', () => {
  test('creates a plan with a single- and a pair-scope block, shows details, edits and deletes it', async ({
    page,
  }) => {
    await page.goto('/exercises');
    for (const name of ['E2E Squat', 'E2E Pull-up heavy', 'E2E Pull-up light']) {
      await page.getByPlaceholder('Name').fill(name);
      await page.getByRole('button', { name: 'Add' }).click();
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }

    await page.goto('/plans');
    await page.getByRole('button', { name: 'New plan' }).click();

    await page.getByLabel('Name').fill('E2E full body plan');
    await page.getByPlaceholder('Training day name').fill('Day A');

    // Block 1 (single scope, already present): pick method + exercise.
    const selects = page.locator('select');
    await selects.nth(0).selectOption({ label: 'Interval set' });
    await selects.nth(1).selectOption({ label: 'E2E Squat' });

    // Add block 2 and switch it to a pair-scope method -> 2 exercise slots appear.
    await page.getByRole('button', { name: 'Add block' }).click();
    await page.locator('select').nth(2).selectOption({ label: 'Superset' });
    await page.locator('select').nth(3).selectOption({ label: 'E2E Pull-up heavy' });
    await page.locator('select').nth(4).selectOption({ label: 'E2E Pull-up light' });

    await page.getByRole('button', { name: 'Save' }).click();

    const planRow = page.locator('li').filter({ hasText: 'E2E full body plan' });
    await expect(planRow).toContainText('1 training day');

    await planRow.getByRole('button', { name: 'Details' }).click();
    await expect(planRow.getByText('Day A')).toBeVisible();
    await expect(planRow.getByText('Interval set', { exact: true })).toBeVisible();
    await expect(planRow.getByText('Superset', { exact: true })).toBeVisible();
    await expect(planRow.getByText('heavy: E2E Pull-up heavy')).toBeVisible();
    await expect(planRow.getByText('light: E2E Pull-up light')).toBeVisible();

    await planRow.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Name').fill('E2E full body plan edited');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('li').filter({ hasText: 'E2E full body plan edited' })).toBeVisible();

    const updatedRow = page.locator('li').filter({ hasText: 'E2E full body plan edited' });
    await updatedRow.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).last().click();
    await expect(page.locator('li').filter({ hasText: 'E2E full body plan edited' })).toHaveCount(0);
  });
});
