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

test.describe('Backfill Completion (Journey 6)', () => {
  test('processing all words and pressing N auto-transitions to new-discovery', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInBackfill(date, STANDARD_PUZZLE.letters, ['TICK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    // Wait for backfill to load
    await expect(page.getByTestId('current-word')).toHaveText('TICK');
    await defocus(page);

    // Accept TICK
    await page.keyboard.press('a');
    await expect(page.getByTestId('judged-badge')).toHaveText('Accepted');
    await page.keyboard.press('n');

    // Accept COCKTAIL
    await expect(page.getByTestId('current-word')).toHaveText('COCKTAIL');
    await page.keyboard.press('a');
    await expect(page.getByTestId('judged-badge')).toHaveText('Accepted');

    // N after last word triggers auto-complete → transitions to new-discovery
    await page.keyboard.press('n');

    // Stage should now be new-discovery (auto-transitioned)
    await expect(page.getByTestId('stage-badge')).toHaveText('New Discovery');
  });

  test('skip remaining button works mid-backfill', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInBackfill(date, STANDARD_PUZZLE.letters, ['TICK', 'TOCK', 'TAIL'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);
    await defocus(page);

    // Process only one word
    await page.keyboard.press('a');
    await expect(page.getByTestId('judged-badge')).toHaveText('Accepted');
    await page.keyboard.press('n');

    // Skip remaining
    await page.getByRole('button', { name: /Skip remaining/ }).click();
    await expect(page.getByTestId('stage-badge')).toHaveText('New Discovery');
  });

  test('completion shown when backfill has zero remaining words', async ({ page }) => {
    const date = uniqueDate();
    // Setup with zero pre-pangram words — just the pangram
    await setupDayInBackfill(date, STANDARD_PUZZLE.letters, [], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    // With only pangram, first word should be COCKTAIL
    // Accept it
    await defocus(page);
    await page.keyboard.press('a');
    await expect(page.getByTestId('judged-badge')).toHaveText('Accepted');
    await page.keyboard.press('n');

    // Should auto-complete
    await expect(page.getByTestId('stage-badge')).toHaveText('New Discovery');
  });
});
