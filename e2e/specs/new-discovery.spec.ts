import { test, expect } from '@playwright/test';
import { DayListPage } from '../pages/DayListPage';
import { cleanupAllDays, setupDayInNewDiscovery } from '../helpers/api-setup';
import { uniqueDate, STANDARD_PUZZLE } from '../fixtures/test-data';

test.beforeEach(async () => {
  await cleanupAllDays();
});

test.describe('New Discovery Word Finding (Journey 7)', () => {
  test('input focused and word appears after Enter', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInNewDiscovery(date, STANDARD_PUZZLE.letters, ['TICK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    await expect(page.getByTestId('word-input')).toBeFocused();

    const input = page.getByTestId('word-input');
    await input.fill('TACO');
    await input.press('Enter');

    // Word should appear in new discovery section
    await expect(page.getByTestId('new-discovery-words')).toContainText('TACO');
  });

  test('hover reveals accept/reject buttons on pending words', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInNewDiscovery(date, STANDARD_PUZZLE.letters, ['TICK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    const input = page.getByTestId('word-input');
    await input.fill('TACO');
    await input.press('Enter');

    // Find the word row and hover
    const wordRow = page.getByTestId('new-discovery-words').locator('.group').filter({ hasText: 'TACO' });
    await wordRow.hover();

    // Accept/reject buttons should become visible (they use opacity transition)
    // The check mark and X buttons
    await expect(wordRow.locator('button').first()).toBeVisible();
  });

  test('click accept changes word styling', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInNewDiscovery(date, STANDARD_PUZZLE.letters, ['TICK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    const input = page.getByTestId('word-input');
    await input.fill('TACO');
    await input.press('Enter');

    // Hover and click accept
    const wordRow = page.getByTestId('new-discovery-words').locator('.group').filter({ hasText: 'TACO' });
    await wordRow.hover();
    await wordRow.locator('button').first().click();

    // Word should now have accepted styling
    await expect(page.getByTestId('new-discovery-words').locator('.word-accepted')).toBeVisible();
  });

  test('full word list shows in collapsible details', async ({ page }) => {
    const date = uniqueDate();
    await setupDayInNewDiscovery(date, STANDARD_PUZZLE.letters, ['TICK'], 'COCKTAIL');

    const dayList = new DayListPage(page);
    await dayList.goto();
    await dayList.clickDay(date);

    // Collapsible full word list should exist
    await expect(page.getByTestId('full-word-list')).toBeVisible();
    // Click to expand
    await page.getByTestId('full-word-list').locator('summary').click();
    // Should show pre-pangram words
    await expect(page.getByTestId('full-word-list')).toContainText('TICK');
  });
});
