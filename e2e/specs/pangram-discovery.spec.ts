import { test, expect } from '@playwright/test';
import { DayListPage } from '../pages/DayListPage';
import { cleanupAllDays, createDay, addWord } from '../helpers/api-setup';
import { uniqueDate, STANDARD_PUZZLE, WORDS } from '../fixtures/test-data';

test.beforeEach(async () => {
  await cleanupAllDays();
});

test.describe('Pangram Discovery & Stage Transition (Journey 3)', () => {
  test('yellow dialog appears for 7-letter word using all letters', async ({ page }) => {
    const date = uniqueDate();
    await createDay(date, STANDARD_PUZZLE.letters);

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    // Add the pangram
    const input = page.getByTestId('word-input');
    await input.fill(WORDS.pangram);
    await input.press('Enter');

    // Pangram dialog should appear
    await expect(page.getByTestId('pangram-dialog')).toBeVisible();
    await expect(page.getByTestId('pangram-dialog')).toContainText('all 7 letters');
  });

  test('input disabled during pangram dialog', async ({ page }) => {
    const date = uniqueDate();
    await createDay(date, STANDARD_PUZZLE.letters);

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    const input = page.getByTestId('word-input');
    await input.fill(WORDS.pangram);
    await input.press('Enter');

    await expect(page.getByTestId('pangram-dialog')).toBeVisible();
    await expect(input).toBeDisabled();
  });

  test('confirming pangram transitions to backfill mode', async ({ page }) => {
    const date = uniqueDate();
    await createDay(date, STANDARD_PUZZLE.letters);
    // Add a pre-pangram word first so backfill has something
    await addWord(date, 'TICK');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    const input = page.getByTestId('word-input');
    await input.fill(WORDS.pangram);
    await input.press('Enter');

    // Confirm pangram
    await page.getByRole('button', { name: /pangram/ }).click();

    // Should transition to backfill
    await expect(page.getByTestId('stage-badge')).toHaveText('Backfill');
  });

  test('rejecting pangram candidate re-enables input', async ({ page }) => {
    const date = uniqueDate();
    await createDay(date, STANDARD_PUZZLE.letters);

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    const input = page.getByTestId('word-input');
    await input.fill(WORDS.pangram);
    await input.press('Enter');

    // Reject pangram candidate
    await page.getByRole('button', { name: /No/ }).click();

    // Dialog should disappear, input re-enabled
    await expect(page.getByTestId('pangram-dialog')).not.toBeVisible();
    await expect(input).toBeEnabled();
  });
});
