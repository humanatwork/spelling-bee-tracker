import { test, expect } from '@playwright/test';
import { DayListPage } from '../pages/DayListPage';
import { cleanupAllDays, createDay } from '../helpers/api-setup';
import { uniqueDate, STANDARD_PUZZLE } from '../fixtures/test-data';

test.beforeEach(async () => {
  await cleanupAllDays();
});

test.describe('Pre-Pangram Brainstorming (Journey 2)', () => {
  test('input is focused on load', async ({ page }) => {
    const date = uniqueDate();
    await createDay(date, STANDARD_PUZZLE.letters);

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    await expect(page.getByTestId('word-input')).toBeFocused();
  });

  test('word appears in list after Enter', async ({ page }) => {
    const date = uniqueDate();
    await createDay(date, STANDARD_PUZZLE.letters);

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    const input = page.getByTestId('word-input');
    await input.fill('TICK');
    await input.press('Enter');

    // Word should appear in list
    await expect(page.getByTestId('word-item').filter({ hasText: 'TICK' })).toBeVisible();
    // Word count should update
    await expect(page.getByTestId('word-count')).toHaveText('1 words');
  });

  test('multiple words have incrementing count', async ({ page }) => {
    const date = uniqueDate();
    await createDay(date, STANDARD_PUZZLE.letters);

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    const input = page.getByTestId('word-input');
    await input.fill('TICK');
    await input.press('Enter');
    await input.fill('TOCK');
    await input.press('Enter');
    await input.fill('TAIL');
    await input.press('Enter');

    await expect(page.getByTestId('word-count')).toHaveText('3 words');
  });

  test('reattempt shows toast', async ({ page }) => {
    const date = uniqueDate();
    await createDay(date, STANDARD_PUZZLE.letters);

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    const input = page.getByTestId('word-input');
    await input.fill('TICK');
    await input.press('Enter');

    // Enter same word again
    await input.fill('TICK');
    await input.press('Enter');

    // Toast should appear for reattempt
    await expect(page.getByText(/already entered/)).toBeVisible();
  });

  test('soft validation warning shown for missing center letter', async ({ page }) => {
    const date = uniqueDate();
    await createDay(date, STANDARD_PUZZLE.letters);

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    const input = page.getByTestId('word-input');
    await input.fill('COIL');

    // Warning about missing center letter
    await expect(page.getByTestId('validation-warning')).toBeVisible();
    await expect(page.getByTestId('validation-warning')).toContainText('center letter');
  });
});
