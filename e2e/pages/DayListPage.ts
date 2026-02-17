import { type Page, type Locator } from '@playwright/test';

export class DayListPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly newDayButton: Locator;
  readonly createForm: Locator;
  readonly dateInput: Locator;
  readonly letterInput: Locator;
  readonly startDayButton: Locator;
  readonly dayCards: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Spelling Bee Tracker' });
    this.newDayButton = page.getByTestId('new-day-button');
    this.createForm = page.getByTestId('create-day-form');
    this.dateInput = page.getByTestId('date-input');
    this.letterInput = page.getByTestId('letter-input');
    this.startDayButton = page.getByRole('button', { name: 'Start Day' });
    this.dayCards = page.getByTestId('day-card');
    this.emptyState = page.getByText('No puzzle days yet');
  }

  async goto() {
    await this.page.goto('/');
  }

  async createDay(date: string, letters: string) {
    await this.newDayButton.click();
    await this.dateInput.fill(date);
    await this.letterInput.fill(letters);
    await this.startDayButton.click();
  }

  async clickDay(date: string) {
    await this.page.getByTestId('day-card').filter({ hasText: date }).click();
  }

  dayCard(date: string): Locator {
    return this.page.getByTestId('day-card').filter({ hasText: date });
  }
}
