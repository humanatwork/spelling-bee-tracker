import { type Page, type Locator } from '@playwright/test';

export class BackfillMode {
  readonly page: Page;
  readonly currentWord: Locator;
  readonly progressBar: Locator;
  readonly progressText: Locator;
  readonly acceptButton: Locator;
  readonly rejectButton: Locator;
  readonly skipButton: Locator;
  readonly inspireButton: Locator;
  readonly nextButton: Locator;
  readonly inspireInput: Locator;
  readonly chainBreadcrumb: Locator;
  readonly completeButton: Locator;
  readonly skipRemainingButton: Locator;
  readonly wordList: Locator;
  readonly judgedBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.currentWord = page.getByTestId('current-word');
    this.progressBar = page.getByTestId('progress-bar');
    this.progressText = page.getByTestId('progress-text');
    this.acceptButton = page.getByRole('button', { name: /Accept/ });
    this.rejectButton = page.getByRole('button', { name: /Reject/ });
    this.skipButton = page.getByRole('button', { name: /Skip/ });
    this.inspireButton = page.getByRole('button', { name: /Inspire/ });
    this.nextButton = page.getByRole('button', { name: /Next/ });
    this.inspireInput = page.getByTestId('word-input');
    this.chainBreadcrumb = page.getByTestId('chain-breadcrumb');
    this.completeButton = page.getByRole('button', { name: /Continue to New Discovery/ });
    this.skipRemainingButton = page.getByRole('button', { name: /Skip remaining/ });
    this.wordList = page.getByTestId('backfill-word-list');
    this.judgedBadge = page.getByTestId('judged-badge');
  }

  async getCurrentWordText(): Promise<string> {
    return (await this.currentWord.textContent()) ?? '';
  }

  async accept() {
    await this.acceptButton.click();
  }

  async reject() {
    await this.rejectButton.click();
  }

  async skip() {
    await this.skipButton.click();
  }

  async next() {
    await this.nextButton.click();
  }

  async inspire(word: string) {
    await this.inspireButton.click();
    await this.inspireInput.fill(word);
    await this.inspireInput.press('Enter');
  }
}
