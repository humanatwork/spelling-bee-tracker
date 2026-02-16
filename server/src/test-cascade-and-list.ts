/**
 * Cascade delete and day list tests.
 * Covers: GET /api/days list (empty, ordering, counts), DELETE cascade
 * (words, inspirations, attempts all removed), re-creation after delete.
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
  console.log('=== Cascade Delete & Day List Tests ===\n');

  // ── GET /api/days list on empty DB ──
  console.log('1. Day list on empty DB...');
  const emptyList = await request('/days');
  counted(Array.isArray(emptyList), 'GET /api/days returns an array');
  counted(emptyList.length === 0, 'Empty DB returns empty list');

  // ── Create days and verify list ──
  console.log('\n2. Create days and verify list...');

  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2097-03-01', letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] }),
  });
  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2097-03-02', letters: ['H', 'I', 'J', 'K', 'L', 'M', 'N'] }),
  });
  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2097-03-03', letters: ['O', 'P', 'Q', 'R', 'S', 'T', 'U'] }),
  });

  const list = await request('/days');
  counted(list.length === 3, 'List has 3 days after creating 3');

  // Order should be DESC by date
  counted(list[0].date === '2097-03-03', 'Most recent date is first');
  counted(list[2].date === '2097-03-01', 'Oldest date is last');

  // word_count and pangram_count should be present
  counted(list[0].word_count === 0, 'New day has word_count 0');
  counted(list[0].pangram_count === 0, 'New day has pangram_count 0');

  // Add words to verify counts
  await request('/days/2097-03-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'ace' }),
  });
  await request('/days/2097-03-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'badge', is_pangram: true }),
  });

  const listWithWords = await request('/days');
  const day01 = listWithWords.find((d: any) => d.date === '2097-03-01');
  counted(day01.word_count === 2, 'Day with 2 words shows word_count 2');
  counted(day01.pangram_count === 1, 'Day with 1 pangram shows pangram_count 1');

  // ── Cascade delete ──
  console.log('\n3. Cascade delete...');

  // Build up a day with words, inspiration links, and attempts
  const cascadeDay = await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2097-04-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });

  const cw1 = await request('/days/2097-04-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tick' }),
  });
  const cw2 = await request('/days/2097-04-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tock' }),
  });

  // Add inspiration link: tock <- tick
  await request(`/days/2097-04-01/words/${cw2.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ inspired_by: [cw1.id] }),
  });

  // Add a reattempt to create an additional word_attempts row
  await request('/days/2097-04-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tick' }),
  });

  // Verify data exists before delete
  const wordsBeforeDelete = await request('/days/2097-04-01/words');
  counted(wordsBeforeDelete.length === 2, 'Cascade day has 2 words before delete');
  const tockBefore = wordsBeforeDelete.find((w: any) => w.word === 'TOCK');
  counted(tockBefore.inspired_by_ids.length === 1, 'Inspiration link exists before delete');

  const attemptsBefore = await request(`/days/2097-04-01/words/${cw1.id}/attempts`);
  counted(attemptsBefore.length === 2, 'TICK has 2 attempts before delete');

  // DELETE the day
  const deleteResult = await requestRaw('/days/2097-04-01', { method: 'DELETE' });
  counted(deleteResult.status === 204, 'DELETE returns 204');

  // Verify day is gone
  const dayGone = await requestRaw('/days/2097-04-01');
  counted(dayGone.status === 404, 'Day is gone after delete');

  // Verify words are gone
  const wordsGone = await requestRaw('/days/2097-04-01/words');
  counted(wordsGone.status === 404, 'Words endpoint returns 404 for deleted day');

  // ── Re-create after delete ──
  console.log('\n4. Re-create after delete...');

  const recreated = await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2097-04-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });
  counted(recreated.date === '2097-04-01', 'Same date can be reused after deletion');

  // Verify it's truly fresh (no leftover words)
  const freshWords = await request('/days/2097-04-01/words');
  counted(freshWords.length === 0, 'Recreated day has no leftover words');

  console.log(`\n=== ALL ${assertionCount} CASCADE & LIST TESTS PASSED ===`);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
