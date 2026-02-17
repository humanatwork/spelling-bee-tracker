import { test, expect } from '@playwright/test';
import { DayListPage } from '../pages/DayListPage';
import { cleanupAllDays, setupDayInBackfill, setupDayInNewDiscovery, createDay } from '../helpers/api-setup';
import { uniqueDate, STANDARD_PUZZLE } from '../fixtures/test-data';

test.beforeEach(async () => {
  await cleanupAllDays();
});

async function defocus(page: import('@playwright/test').Page) {
  await page.getByTestId('stage-badge').click();
}

test.describe('Keyboard-Only Navigation (Journey 20)', () => {
  test('pre-pangram: Enter submits word', async ({ page }) => {
    const date = uniqueDate();
    await createDay(date, STANDARD_PUZZLE.letters);

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    const input = page.getByTestId('word-input');
    await input.fill('TICK');
    await input.press('Enter');

    await expect(page.getByTestId('word-item').filter({ hasText: 'TICK' })).toBeVisible();
  });

  test('backfill: A/R/S shortcuts work, N advances', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInBackfill(date, STANDARD_PUZZLE.letters, ['TICK', 'TOCK', 'TAIL'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);
    await defocus(page);

    // A to accept
    await expect(page.getByTestId('current-word')).toHaveText('TICK');
    await page.keyboard.press('a');
    await expect(page.getByTestId('judged-badge')).toHaveText('Accepted');

    // N to advance
    await page.keyboard.press('n');
    await expect(page.getByTestId('current-word')).toHaveText('TOCK');

    // R to reject
    await page.keyboard.press('r');
    await expect(page.getByTestId('judged-badge')).toHaveText('Rejected');

    // N to advance
    await page.keyboard.press('n');
    await expect(page.getByTestId('current-word')).toHaveText('TAIL');

    // S to skip (should advance immediately)
    await page.keyboard.press('s');
    // After skip, cursor advances to COCKTAIL
    await expect(page.getByTestId('current-word')).toHaveText('COCKTAIL');
  });

  test('backfill: I/Esc chain navigation', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInBackfill(date, STANDARD_PUZZLE.letters, ['TICK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);
    await defocus(page);

    // I to start inspire
    await page.keyboard.press('i');
    await expect(page.getByText(/inspire/i)).toBeVisible();

    // Esc to cancel inspire input
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('current-word')).toHaveText('TICK');
  });

  test('global: ? button toggles keyboard help', async ({ page }) => {
    const date = uniqueDate();
    await createDay(date, STANDARD_PUZZLE.letters);

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    // Click the ? button in the header
    await page.getByRole('button', { name: '?' }).click();
    await expect(page.getByText(/Keyboard Shortcuts/i)).toBeVisible();

    // Click the overlay to close
    await page.locator('.fixed.inset-0').click({ position: { x: 10, y: 10 } });
    await expect(page.getByText(/Keyboard Shortcuts/i)).not.toBeVisible();
  });

  test('shortcuts do not fire when input is focused', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInBackfill(date, STANDARD_PUZZLE.letters, ['TICK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);
    await defocus(page);

    // I to enter inspire mode
    await page.keyboard.press('i');

    // Type 'a' in the input — should NOT trigger accept
    const input = page.getByTestId('word-input');
    await input.fill('a');

    // Current word should still be TICK (not accepted)
    await expect(page.getByTestId('current-word')).toHaveText('TICK');
  });

  test('new-discovery: T toggles scratch mode', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInNewDiscovery(date, STANDARD_PUZZLE.letters, ['TICK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    // Defocus input
    await defocus(page);

    // T to toggle scratch
    await page.keyboard.press('t');
    await expect(page.getByTestId('scratch-toggle')).toContainText('Scratch ON');

    await page.keyboard.press('t');
    await expect(page.getByTestId('scratch-toggle')).toContainText('Scratch OFF');
  });
});
