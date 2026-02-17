import { type Page, type Locator } from '@playwright/test';

export class NewDiscoveryMode {
  readonly page: Page;
  readonly wordInput: Locator;
  readonly scratchToggle: Locator;
  readonly wordList: Locator;
  readonly fullWordList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.wordInput = page.getByTestId('word-input');
    this.scratchToggle = page.getByTestId('scratch-toggle');
    this.wordList = page.getByTestId('new-discovery-words');
    this.fullWordList = page.getByTestId('full-word-list');
  }

  async addWord(word: string) {
    await this.wordInput.fill(word);
    await this.wordInput.press('Enter');
  }

  async toggleScratch() {
    await this.scratchToggle.click();
  }
}
