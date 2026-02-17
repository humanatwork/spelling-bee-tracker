import { test, expect } from '@playwright/test';
import { DayListPage } from '../pages/DayListPage';
import { cleanupAllDays, createDay, addWord, updateDay } from '../helpers/api-setup';

test.beforeEach(async () => {
  await cleanupAllDays();
});

test.describe('Multi-Day Management (Journey 10)', () => {
  test('day list shows days newest-first with stage badges and word counts', async ({ page }) => {
    // Create three days with different stages
    await createDay('2090-03-01', ['T', 'I', 'A', 'O', 'L', 'K', 'C']);
    await addWord('2090-03-01', 'TICK');
    await addWord('2090-03-01', 'TOCK');

    await createDay('2090-03-02', ['T', 'I', 'A', 'O', 'L', 'K', 'C']);
    await addWord('2090-03-02', 'COCKTAIL', { is_pangram: true });
    await updateDay('2090-03-02', { current_stage: 'backfill' });

    await createDay('2090-03-03', ['T', 'I', 'A', 'O', 'L', 'K', 'C']);

    const dayList = new DayListPage(page);
    await dayList.goto();

    const cards = page.getByTestId('day-card');
    await expect(cards).toHaveCount(3);

    // Newest first
    const firstCard = cards.nth(0);
    await expect(firstCard).toContainText('2090-03-03');

    // Check stage badges are present
    await expect(dayList.dayCard('2090-03-01')).toContainText('Pre-Pangram');
    await expect(dayList.dayCard('2090-03-02')).toContainText('Backfill');

    // Check word counts
    await expect(dayList.dayCard('2090-03-01')).toContainText('2 words');
  });

  test('click navigates to DayPage', async ({ page }) => {
    await createDay('2090-04-01', ['T', 'I', 'A', 'O', 'L', 'K', 'C']);

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay('2090-04-01');

    await expect(page.getByTestId('day-date')).toHaveText('2090-04-01');
  });

  test('back arrow returns to list', async ({ page }) => {
    await createDay('2090-04-02', ['T', 'I', 'A', 'O', 'L', 'K', 'C']);

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay('2090-04-02');

    await page.getByTestId('back-button').click();

    await expect(dayList.heading).toBeVisible();
    await expect(dayList.dayCard('2090-04-02')).toBeVisible();
  });
});
