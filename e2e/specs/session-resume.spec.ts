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

test.describe('Session Resume (Journey 9)', () => {
  test('backfill cursor persists after navigating away and back', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInBackfill(date, STANDARD_PUZZLE.letters, ['TICK', 'TOCK', 'TAIL'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);
    await defocus(page);

    // Process first word (TICK): accept + next
    await expect(page.getByTestId('current-word')).toHaveText('TICK');
    await page.keyboard.press('a');
    await expect(page.getByTestId('judged-badge')).toHaveText('Accepted');
    await page.keyboard.press('n');

    // Process second word (TOCK): accept + next
    await expect(page.getByTestId('current-word')).toHaveText('TOCK');
    await page.keyboard.press('a');
    await expect(page.getByTestId('judged-badge')).toHaveText('Accepted');
    await page.keyboard.press('n');

    // Now at TAIL — navigate away
    await expect(page.getByTestId('current-word')).toHaveText('TAIL');
    await page.getByTestId('back-button').click();

    // Navigate back
    await dayList.clickDay(date);

    // Should resume at TAIL
    await expect(page.getByTestId('current-word')).toHaveText('TAIL');
    await expect(page.getByTestId('progress-text')).toContainText('2/4');
  });

  test('cursor persists after page refresh and re-navigation', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInBackfill(date, STANDARD_PUZZLE.letters, ['TICK', 'TOCK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);
    await defocus(page);

    // Process first word
    await expect(page.getByTestId('current-word')).toHaveText('TICK');
    await page.keyboard.press('a');
    await expect(page.getByTestId('judged-badge')).toHaveText('Accepted');
    await page.keyboard.press('n');
    await expect(page.getByTestId('current-word')).toHaveText('TOCK');

    // Refresh the page
    await page.reload();

    // Navigate to the day again (App starts on day list)
    await dayList.clickDay(date);

    // Should resume at TOCK
    await expect(page.getByTestId('current-word')).toHaveText('TOCK');
  });
});
