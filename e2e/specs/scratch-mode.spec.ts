import { test, expect } from '@playwright/test';
import { DayListPage } from '../pages/DayListPage';
import { cleanupAllDays, setupDayInNewDiscovery } from '../helpers/api-setup';
import { uniqueDate, STANDARD_PUZZLE } from '../fixtures/test-data';

test.beforeEach(async () => {
  await cleanupAllDays();
});

async function defocus(page: import('@playwright/test').Page) {
  await page.getByTestId('stage-badge').click();
}

test.describe('Scratch Mode (Journey 8)', () => {
  test('T toggles scratch mode button state', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInNewDiscovery(date, STANDARD_PUZZLE.letters, ['TICK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    const toggle = page.getByTestId('scratch-toggle');
    await expect(toggle).toContainText('Scratch OFF');

    // Defocus input, then press T
    await defocus(page);
    await page.keyboard.press('t');
    await expect(toggle).toContainText('Scratch ON');

    // Toggle back
    await page.keyboard.press('t');
    await expect(toggle).toContainText('Scratch OFF');
  });

  test('scratch words have muted styling', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInNewDiscovery(date, STANDARD_PUZZLE.letters, ['TICK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    // Enable scratch mode via button click
    await page.getByTestId('scratch-toggle').click();
    await expect(page.getByTestId('scratch-toggle')).toContainText('Scratch ON');

    // Add a scratch word
    const input = page.getByTestId('word-input');
    await input.fill('TACIT');
    await input.press('Enter');

    // Word should appear with scratch styling
    const scratchWord = page.getByTestId('new-discovery-words').locator('.word-scratch');
    await expect(scratchWord).toBeVisible();
  });

  test('button click toggles scratch mode', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInNewDiscovery(date, STANDARD_PUZZLE.letters, ['TICK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    const toggle = page.getByTestId('scratch-toggle');
    await toggle.click();
    await expect(toggle).toContainText('Scratch ON');
    await toggle.click();
    await expect(toggle).toContainText('Scratch OFF');
  });
});
