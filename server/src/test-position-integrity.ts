/**
 * Position integrity tests.
 * Covers: fractional position stress tests, ordering after many insertions,
 * midpoint convergence edge cases.
 * Requires a running server with a fresh database.
 */

import { request, requestRaw, assert } from './test-helpers';

let assertionCount = 0;
const _assert = assert;
function counted(condition: boolean, msg: string) {
  assertionCount++;
  _assert(condition, msg);
}

async function main() {
  console.log('=== Position Integrity Tests ===\n');

  // ── Setup: Create a day ──
  const day = await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2097-01-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });

  // ── 1. Sequential word creation produces incrementing positions ──
  console.log('1. Sequential positions...');

  const words: any[] = [];
  const wordNames = ['TICK', 'TOCK', 'TAIL', 'TOIL', 'TALK', 'LICK', 'LOCK', 'LACK', 'COAT', 'COAL'];
  for (const w of wordNames) {
    const word = await request('/days/2097-01-01/words', {
      method: 'POST',
      body: JSON.stringify({ word: w }),
    });
    words.push(word);
  }

  for (let i = 1; i < words.length; i++) {
    counted(words[i].position > words[i - 1].position,
      `Word ${i} position (${words[i].position}) > word ${i - 1} position (${words[i - 1].position})`);
  }

  // ── 2. 50 successive midpoint insertions produce distinct positions ──
  console.log('\n2. 50 midpoint insertions between two words...');

  // Create two anchor words
  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2097-02-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });
  const anchor1 = await request('/days/2097-02-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'TICK' }),
  });
  const anchor2 = await request('/days/2097-02-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'TOCK' }),
  });

  // Insert 50 words, each time inserting after the most recently inserted word
  let lastInsertedId = anchor1.id;
  const midpointWords: any[] = [];
  for (let i = 0; i < 50; i++) {
    const word = await request('/days/2097-02-01/words', {
      method: 'POST',
      body: JSON.stringify({ word: `TAIL${String(i).padStart(3, '0')}`, after_word_id: lastInsertedId }),
    });
    midpointWords.push(word);
    lastInsertedId = word.id;
  }

  // All positions should be distinct
  const positions = midpointWords.map((w: any) => w.position);
  const uniquePositions = new Set(positions);
  counted(uniquePositions.size === 50, `All 50 midpoint positions are distinct (got ${uniquePositions.size})`);

  // Positions should all be between anchor1 and anchor2
  counted(
    midpointWords.every((w: any) => w.position > anchor1.position && w.position < anchor2.position),
    'All midpoint words are between anchor1 and anchor2'
  );

  // ── 3. GET /words returns correct order after many insertions ──
  console.log('\n3. GET /words returns correct order...');

  const allWords = await request('/days/2097-02-01/words');
  for (let i = 1; i < allWords.length; i++) {
    counted(allWords[i].position > allWords[i - 1].position,
      `Word list position ordering correct at index ${i}`);
  }

  // ── 4. Position precision after deep midpoint divisions ──
  console.log('\n4. Position precision...');

  // After 50 midpoint divisions, the gap should still be > 0
  const sortedPositions = [...positions].sort((a, b) => a - b);
  let minGap = Infinity;
  for (let i = 1; i < sortedPositions.length; i++) {
    const gap = sortedPositions[i] - sortedPositions[i - 1];
    if (gap < minGap) minGap = gap;
  }
  counted(minGap > 0, `Minimum position gap (${minGap}) is positive after 50 midpoints`);
  counted(minGap > Number.EPSILON, `Minimum position gap (${minGap}) exceeds floating-point epsilon`);

  console.log(`\n=== ALL ${assertionCount} POSITION INTEGRITY TESTS PASSED ===`);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
