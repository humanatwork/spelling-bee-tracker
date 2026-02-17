import { test, expect } from '@playwright/test';
import { DayListPage } from '../pages/DayListPage';
import { cleanupAllDays, setupDayInBackfill } from '../helpers/api-setup';
import { uniqueDate, STANDARD_PUZZLE } from '../fixtures/test-data';

test.beforeEach(async () => {
  await cleanupAllDays();
});

async function defocus(page: import('@playwright/test').Page) {
  await page.getByTestId('stage-badge').click();
}

test.describe('Backfill Inspiration Chains (Journey 5)', () => {
  test('I opens inspire input', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInBackfill(date, STANDARD_PUZZLE.letters, ['TICK', 'TOCK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);
    await defocus(page);

    // Accept first, then press I
    await page.keyboard.press('a');
    await expect(page.getByTestId('judged-badge')).toHaveText('Accepted');
    await page.keyboard.press('i');

    // Inspire input should appear with prompt text
    await expect(page.getByText(/inspire/i)).toBeVisible();
    await expect(page.getByTestId('word-input')).toBeFocused();
  });

  test('Enter submits chain word and breadcrumb grows', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInBackfill(date, STANDARD_PUZZLE.letters, ['TICK', 'TOCK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);
    await defocus(page);

    // Press I to enter inspire mode (pre-judgment)
    await page.keyboard.press('i');
    await expect(page.getByText(/inspire/i)).toBeVisible();

    const input = page.getByTestId('word-input');
    await input.fill('TACO');
    await input.press('Enter');

    // Breadcrumb should show chain
    await expect(page.getByTestId('chain-breadcrumb')).toBeVisible();
    // Current word should now be the chain word
    await expect(page.getByTestId('current-word')).toHaveText('TACO');
  });

  test('accept chain word pops back to parent', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInBackfill(date, STANDARD_PUZZLE.letters, ['TICK', 'TOCK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);
    await defocus(page);

    // Enter inspire mode and add chain word
    await page.keyboard.press('i');
    const input = page.getByTestId('word-input');
    await input.fill('TACO');
    await input.press('Enter');

    await expect(page.getByTestId('current-word')).toHaveText('TACO');

    // Accept the chain word — should pop back to TICK
    await defocus(page);
    await page.keyboard.press('a');

    await expect(page.getByTestId('current-word')).toHaveText('TICK');
  });

  test('B exits chain entirely back to sequential list', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInBackfill(date, STANDARD_PUZZLE.letters, ['TICK', 'TOCK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);
    await defocus(page);

    // Add chain word
    await page.keyboard.press('i');
    const input = page.getByTestId('word-input');
    await input.fill('TACO');
    await input.press('Enter');

    await expect(page.getByTestId('chain-breadcrumb')).toBeVisible();

    // Press B to exit chain (defocus first since breadcrumb is visible)
    await defocus(page);
    await page.keyboard.press('b');

    // Should be back at TICK (the sequential word)
    await expect(page.getByTestId('current-word')).toHaveText('TICK');
    await expect(page.getByTestId('chain-breadcrumb')).not.toBeVisible();
  });
});
