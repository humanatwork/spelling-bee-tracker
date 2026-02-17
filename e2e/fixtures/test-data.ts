/** Standard puzzle data for E2E tests: 2/9/26 puzzle (T,I,A,O,L,K,C) */

export const STANDARD_PUZZLE = {
  date: '2026-02-09',
  letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'],
  centerLetter: 'T',
  letterString: 'TIAOLKC',
};

/** Unique date generator to avoid conflicts between tests */
let dateCounter = 0;
export function uniqueDate(): string {
  dateCounter++;
  const day = String(dateCounter).padStart(2, '0');
  return `2090-01-${day}`;
}

/** Sample words for various test scenarios */
export const WORDS = {
  valid: ['TICK', 'TOCK', 'TAIL', 'TOIL', 'TALK', 'TACO', 'COAT', 'ALTO'],
  pangram: 'COCKTAIL',
  short: 'CAT',
  missingCenter: 'COIL',
  offLetters: 'TEST',
  scratch: ['TACIT', 'ATTIC'],
};
