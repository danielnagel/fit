import { test, expect } from '@playwright/test';

test.describe('Complete training flow', () => {
  test('create a plan, start a week, run a training and see it in the history', async ({ page }) => {
    await page.goto('/exercises');
    await page.getByPlaceholder('Name').fill('E2E Push-up');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('E2E Push-up', { exact: true })).toBeVisible();

    // Plan with the catalog method "Interval set" (fixed-window-remainder, 3 rounds, default seed of the user).
    await page.goto('/plans');
    await page.getByRole('button', { name: 'New plan' }).click();
    await page.getByLabel('Name').fill('E2E Flow-Plan');
    await page.getByPlaceholder('Training day name').fill('Day A');
    await page.locator('select').nth(0).selectOption({ label: 'Interval set' });
    await page.locator('select').nth(1).selectOption({ label: 'E2E Push-up' });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('li').filter({ hasText: 'E2E Flow-Plan' })).toBeVisible();

    // Start the week.
    await page.goto('/training');
    await page.getByLabel('Plan').selectOption({ label: 'E2E Flow-Plan' });
    await page.getByRole('button', { name: 'Start week' }).click();
    await expect(page.getByText('E2E Flow-Plan')).toBeVisible();

    // Pick the training day and start the training.
    await page.getByLabel('Training day').selectOption({ label: 'Day A (Interval set)' });
    await page.getByRole('button', { name: 'Start training' }).click();

    // Go through 3 rounds (fixed-count, rounds=3) -- enter reps and click "Next"
    // instead of waiting for the real 180s window timer.
    for (let round = 1; round <= 3; round++) {
      await expect(page.getByText(`set ${round}/3`)).toBeVisible();
      await page.getByLabel('Reps').fill('10');
      await page.getByRole('button', { name: 'Next' }).click();
    }

    // After the last round the session completes automatically and you're back at
    // SessionStart; the week stays active (the window elapses as soon as it is visible).
    await expect(page.getByRole('button', { name: 'End week' })).toBeVisible();

    await page.goto('/history');
    await page.getByRole('button', { name: 'Show week' }).click();
    // The week <li> wraps the session <li>, both contain "Day A" as text --
    // .last() picks the inner (more specific) session entry.
    const sessionRow = page.locator('li').filter({ hasText: 'Day A' }).last();
    await expect(sessionRow).toContainText('Completed');

    await sessionRow.getByRole('button', { name: 'Details' }).click();
    await expect(sessionRow.getByText('E2E Push-up').first()).toBeVisible();
    await expect(sessionRow.getByRole('cell', { name: '10' }).first()).toBeVisible();

    // Clean up: end the week again so no global state is left behind for other specs.
    await page.goto('/training');
    await page.getByRole('button', { name: 'End week' }).click();
    await page.getByRole('button', { name: 'End', exact: true }).click();
    await expect(page.getByLabel('Plan')).toBeVisible();
  });
});
