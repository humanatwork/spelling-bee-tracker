import { type Page, type Locator } from '@playwright/test';

export class DayPage {
  readonly page: Page;
  readonly backButton: Locator;
  readonly dateHeading: Locator;
  readonly stageBadge: Locator;
  readonly geniusButton: Locator;
  readonly geniusConfirmYes: Locator;
  readonly geniusConfirmNo: Locator;
  readonly helpButton: Locator;
  readonly deleteButton: Locator;
  readonly exportButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.backButton = page.getByTestId('back-button');
    this.dateHeading = page.getByTestId('day-date');
    this.stageBadge = page.getByTestId('stage-badge');
    this.geniusButton = page.getByTestId('genius-button');
    this.geniusConfirmYes = page.getByTestId('genius-confirm-yes');
    this.geniusConfirmNo = page.getByTestId('genius-confirm-no');
    this.helpButton = page.getByRole('button', { name: '?' });
    this.deleteButton = page.getByTestId('delete-day-button');
    this.exportButton = page.getByTestId('export-button');
  }

  async goBack() {
    await this.backButton.click();
  }

  async getStage(): Promise<string> {
    return (await this.stageBadge.textContent()) ?? '';
  }
}
