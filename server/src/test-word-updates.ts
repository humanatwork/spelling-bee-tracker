/**
 * Word updates and normalization tests.
 * Covers: PATCH status/metadata, inspiration links via PATCH, word normalization,
 * after_word_id positioning, no-op PATCH.
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
  console.log('=== Word Updates & Normalization Tests ===\n');

  // Setup: create a day
  const day = await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2098-01-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });

  // ── PATCH word status ──
  console.log('1. PATCH word status...');

  const w1 = await request('/days/2098-01-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tick' }),
  });
  counted(w1.status === 'pending', 'New pre-pangram word starts as pending');

  // pending → accepted
  const accepted = await request(`/days/2098-01-01/words/${w1.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'accepted' }),
  });
  counted(accepted.status === 'accepted', 'PATCH status to accepted works');

  // Verify persistence
  const words = await request('/days/2098-01-01/words');
  const tickReadBack = words.find((w: any) => w.word === 'TICK');
  counted(tickReadBack.status === 'accepted', 'Status persists on read-back');

  // pending → rejected
  const w2 = await request('/days/2098-01-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tock' }),
  });
  const rejected = await request(`/days/2098-01-01/words/${w2.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'rejected' }),
  });
  counted(rejected.status === 'rejected', 'PATCH status to rejected works');

  // Set scratch
  const w3 = await request('/days/2098-01-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'taco' }),
  });
  const scratched = await request(`/days/2098-01-01/words/${w3.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'scratch' }),
  });
  counted(scratched.status === 'scratch', 'PATCH status to scratch works');

  // ── PATCH word metadata ──
  console.log('\n2. PATCH word metadata...');

  // Set notes
  const withNotes = await request(`/days/2098-01-01/words/${w1.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ notes: 'first word I thought of' }),
  });
  counted(withNotes.notes === 'first word I thought of', 'Set notes via PATCH');

  // Update notes
  const updatedNotes = await request(`/days/2098-01-01/words/${w1.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ notes: 'updated note' }),
  });
  counted(updatedNotes.notes === 'updated note', 'Update notes via PATCH');

  // is_pangram toggle (must use a word that contains all 7 letters)
  const cocktailWord = await request('/days/2098-01-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'cocktail' }),
  });
  const pangram = await request(`/days/2098-01-01/words/${cocktailWord.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_pangram: true }),
  });
  counted(pangram.is_pangram === true, 'Set is_pangram to true on valid pangram');

  const notPangram = await request(`/days/2098-01-01/words/${cocktailWord.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_pangram: false }),
  });
  counted(notPangram.is_pangram === false, 'Set is_pangram back to false');

  // chain_depth
  const depth = await request(`/days/2098-01-01/words/${w1.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ chain_depth: 3 }),
  });
  counted(depth.chain_depth === 3, 'Set chain_depth via PATCH');

  // inspiration_confidence
  const conf = await request(`/days/2098-01-01/words/${w1.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ inspiration_confidence: 'uncertain' }),
  });
  counted(conf.inspiration_confidence === 'uncertain', 'Set inspiration_confidence via PATCH');

  // ── PATCH inspiration links ──
  console.log('\n3. PATCH inspiration links...');

  // Set single inspiration
  const linked = await request(`/days/2098-01-01/words/${w2.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ inspired_by: [w1.id] }),
  });
  counted(linked.inspired_by_ids.includes(w1.id), 'Set single inspiration link');
  counted(linked.inspired_by_ids.length === 1, 'Exactly one inspiration link');

  // Set multiple inspirations
  const multiLinked = await request(`/days/2098-01-01/words/${w2.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ inspired_by: [w1.id, w3.id] }),
  });
  counted(multiLinked.inspired_by_ids.includes(w1.id), 'Multiple links: first present');
  counted(multiLinked.inspired_by_ids.includes(w3.id), 'Multiple links: second present');
  counted(multiLinked.inspired_by_ids.length === 2, 'Exactly two inspiration links');

  // Clear to empty
  const cleared = await request(`/days/2098-01-01/words/${w2.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ inspired_by: [] }),
  });
  counted(cleared.inspired_by_ids.length === 0, 'Clear inspiration links to empty');

  // Set back
  const relinked = await request(`/days/2098-01-01/words/${w2.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ inspired_by: [w1.id] }),
  });
  counted(relinked.inspired_by_ids.includes(w1.id), 'Re-set inspiration link after clearing');

  // ── Word normalization ──
  console.log('\n4. Word normalization...');

  // Lowercase → UPPER
  const lower = await request('/days/2098-01-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tall' }),
  });
  counted(lower.word === 'TALL', 'Lowercase word normalized to uppercase');

  // Mixed case
  const mixed = await request('/days/2098-01-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'CoCkTaIl' }),
  });
  counted(mixed.word === 'COCKTAIL', 'Mixed case normalized to uppercase');

  // Leading/trailing whitespace
  const whitespace = await request('/days/2098-01-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: '  loot  ' }),
  });
  counted(whitespace.word === 'LOOT', 'Whitespace trimmed from word');

  // Reattempt still matches normalized form
  const reattempt = await request('/days/2098-01-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tall' }),
  });
  counted(reattempt.is_reattempt === true, 'Reattempt matches case-insensitively');

  // ── after_word_id positioning ──
  console.log('\n5. Positioning with after_word_id...');

  // Create a day with known word order
  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2098-01-02', letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] }),
  });
  const first = await request('/days/2098-01-02/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'ace' }),
  });
  const third = await request('/days/2098-01-02/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'bag' }),
  });
  // Insert between first and third
  const between = await request('/days/2098-01-02/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'bad', after_word_id: first.id }),
  });
  counted(between.position > first.position, 'Inserted word has position > after_word');
  counted(between.position < third.position, 'Inserted word has position < next word');

  // Verify final order
  const orderedWords = await request('/days/2098-01-02/words');
  const wordOrder = orderedWords.map((w: any) => w.word);
  counted(wordOrder[0] === 'ACE' && wordOrder[1] === 'BAD' && wordOrder[2] === 'BAG',
    'Words in correct position order after insert-between');

  // ── No-op PATCH ──
  console.log('\n6. No-op PATCH...');

  const beforeList = await request('/days/2098-01-01/words');
  const before = beforeList.find((w: any) => w.id === w1.id);
  // PATCH with empty body -- this goes through the PATCH handler, no fields match so no SQL update
  const noop = await request(`/days/2098-01-01/words/${w1.id}`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
  counted(noop.id === before.id, 'No-op PATCH returns word unchanged (same id)');
  counted(noop.status === before.status, 'No-op PATCH returns word unchanged (same status)');

  console.log(`\n=== ALL ${assertionCount} WORD UPDATE TESTS PASSED ===`);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
