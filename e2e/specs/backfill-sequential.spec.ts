import { test, expect } from '@playwright/test';
import { DayListPage } from '../pages/DayListPage';
import { cleanupAllDays, setupDayInBackfill } from '../helpers/api-setup';
import { uniqueDate, STANDARD_PUZZLE } from '../fixtures/test-data';

test.beforeEach(async () => {
  await cleanupAllDays();
});

/** Helper to defocus any input by clicking the page heading area */
async function defocus(page: import('@playwright/test').Page) {
  await page.getByTestId('stage-badge').click();
}

test.describe('Backfill Sequential Processing (Journey 4)', () => {
  test('two-panel layout visible', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInBackfill(date, STANDARD_PUZZLE.letters, ['TICK', 'TOCK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    await expect(page.getByTestId('current-word')).toBeVisible();
    await expect(page.getByTestId('progress-bar')).toBeVisible();
    await expect(page.getByTestId('backfill-word-list')).toBeVisible();
  });

  test('A keyboard shortcut accepts word and shows badge', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInBackfill(date, STANDARD_PUZZLE.letters, ['TICK', 'TOCK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);
    await expect(page.getByTestId('current-word')).toHaveText('TICK');

    // Backfill doesn't have autofocus on word input, shortcuts should work
    // But click stage badge to be safe
    await defocus(page);
    await page.keyboard.press('a');
    await expect(page.getByTestId('judged-badge')).toHaveText('Accepted');
  });

  test('R keyboard shortcut rejects word', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInBackfill(date, STANDARD_PUZZLE.letters, ['TICK', 'TOCK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);
    await defocus(page);

    await page.keyboard.press('r');
    await expect(page.getByTestId('judged-badge')).toHaveText('Rejected');
  });

  test('N advances cursor after judgment', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInBackfill(date, STANDARD_PUZZLE.letters, ['TICK', 'TOCK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);
    await defocus(page);

    await expect(page.getByTestId('current-word')).toHaveText('TICK');

    await page.keyboard.press('a');
    await expect(page.getByTestId('judged-badge')).toHaveText('Accepted');
    await page.keyboard.press('n');
    await expect(page.getByTestId('current-word')).toHaveText('TOCK');
  });

  test('progress text updates as words are processed', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInBackfill(date, STANDARD_PUZZLE.letters, ['TICK', 'TOCK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);
    await defocus(page);

    await expect(page.getByTestId('progress-text')).toContainText('0/3');

    await page.keyboard.press('a');
    await expect(page.getByTestId('judged-badge')).toHaveText('Accepted');
    await page.keyboard.press('n');
    await expect(page.getByTestId('progress-text')).toContainText('1/3');
  });
});
