import { type Page, type Locator } from '@playwright/test';

export class PrePangramMode {
  readonly page: Page;
  readonly wordInput: Locator;
  readonly addButton: Locator;
  readonly wordList: Locator;
  readonly wordCount: Locator;
  readonly pangramDialog: Locator;
  readonly pangramYes: Locator;
  readonly pangramNo: Locator;
  readonly validationWarning: Locator;

  constructor(page: Page) {
    this.page = page;
    this.wordInput = page.getByTestId('word-input');
    this.addButton = page.getByRole('button', { name: 'Add' });
    this.wordList = page.getByTestId('word-list');
    this.wordCount = page.getByTestId('word-count');
    this.pangramDialog = page.getByTestId('pangram-dialog');
    this.pangramYes = page.getByRole('button', { name: /pangram/ });
    this.pangramNo = page.getByRole('button', { name: /No/ });
    this.validationWarning = page.getByTestId('validation-warning');
  }

  async addWord(word: string) {
    await this.wordInput.fill(word);
    await this.wordInput.press('Enter');
  }

  async getWordItems(): Promise<Locator> {
    return this.page.getByTestId('word-item');
  }
}
