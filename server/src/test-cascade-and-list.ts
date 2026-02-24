/**
 * Cascade delete and day list tests.
 * Covers: GET /api/days list (empty, ordering, counts, total_points),
 * DELETE cascade (words removed), re-creation after delete.
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
    body: JSON.stringify({ date: '2097-03-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
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

  // word_count, pangram_count, and total_points should be present
  counted(list[0].word_count === 0, 'New day has word_count 0');
  counted(list[0].pangram_count === 0, 'New day has pangram_count 0');
  counted(list[0].total_points === 0, 'New day has total_points 0');

  // Add words and set points to verify counts
  const w1 = await request('/days/2097-03-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tick' }),
  });
  await request(`/days/2097-03-01/words/${w1.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'accepted', points: 4 }),
  });
  const w2 = await request('/days/2097-03-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'cocktail', is_pangram: true }),
  });
  await request(`/days/2097-03-01/words/${w2.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'accepted', points: 14 }),
  });

  const listWithWords = await request('/days');
  const day01 = listWithWords.find((d: any) => d.date === '2097-03-01');
  counted(day01.word_count === 2, 'Day with 2 words shows word_count 2');
  counted(day01.pangram_count === 1, 'Day with 1 pangram shows pangram_count 1');
  counted(day01.total_points === 18, 'Day with accepted words shows total_points 18');

  // ── Cascade delete ──
  console.log('\n3. Cascade delete...');

  // Build up a day with words
  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2097-04-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });

  await request('/days/2097-04-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tick' }),
  });
  await request('/days/2097-04-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tock' }),
  });

  // Verify data exists before delete
  const wordsBeforeDelete = await request('/days/2097-04-01/words');
  counted(wordsBeforeDelete.length === 2, 'Cascade day has 2 words before delete');

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
