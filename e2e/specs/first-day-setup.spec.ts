import { test, expect } from '@playwright/test';
import { DayListPage } from '../pages/DayListPage';
import { cleanupAllDays } from '../helpers/api-setup';
import { uniqueDate, STANDARD_PUZZLE } from '../fixtures/test-data';

test.beforeEach(async () => {
  await cleanupAllDays();
});

test.describe('First Day Setup (Journey 1)', () => {
  test('empty app shows empty state and + New Day button', async ({ page }) => {
    const dayList = new DayListPage(page);
    await dayList.goto();

    await expect(dayList.heading).toBeVisible();
    await expect(dayList.newDayButton).toBeVisible();
    await expect(dayList.emptyState).toBeVisible();
  });

  test('create day form appears on button click', async ({ page }) => {
    const dayList = new DayListPage(page);
    await dayList.goto();

    await dayList.newDayButton.click();
    await expect(dayList.createForm).toBeVisible();
    await expect(dayList.dateInput).toBeVisible();
    await expect(dayList.letterInput).toBeVisible();
    await expect(dayList.startDayButton).toBeVisible();
  });

  test('submit disabled with < 7 letters', async ({ page }) => {
    const dayList = new DayListPage(page);
    await dayList.goto();

    await dayList.newDayButton.click();
    await dayList.letterInput.fill('TIA');
    await expect(dayList.startDayButton).toBeDisabled();
  });

  test('submit enabled with exactly 7 letters', async ({ page }) => {
    const dayList = new DayListPage(page);
    await dayList.goto();

    await dayList.newDayButton.click();
    await dayList.letterInput.fill(STANDARD_PUZZLE.letterString);
    await expect(dayList.startDayButton).toBeEnabled();
  });

  test('successful creation navigates to DayPage in pre-pangram mode', async ({ page }) => {
    const dayList = new DayListPage(page);
    await dayList.goto();

    const date = uniqueDate();
    await dayList.createDay(date, STANDARD_PUZZLE.letterString);

    // Should navigate to DayPage
    await expect(page.getByTestId('day-date')).toHaveText(date);
    await expect(page.getByTestId('stage-badge')).toHaveText('Pre-Pangram');

    // Input should be focused
    await expect(page.getByTestId('word-input')).toBeFocused();
  });

  test('day appears in list on back-nav', async ({ page }) => {
    const dayList = new DayListPage(page);
    await dayList.goto();

    const date = uniqueDate();
    await dayList.createDay(date, STANDARD_PUZZLE.letterString);

    // Navigate back
    await page.getByTestId('back-button').click();

    // Day should appear in list
    await expect(dayList.dayCard(date)).toBeVisible();
    await expect(dayList.emptyState).not.toBeVisible();
  });
});
