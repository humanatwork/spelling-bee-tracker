/**
 * Backfill edge case tests.
 * Covers: skip action, minimal backfill (pangram only), cursor persistence,
 * advance after all processed, post-complete state.
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
  console.log('=== Backfill Edge Case Tests ===\n');

  // ── Skip action ──
  console.log('1. Skip action...');

  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2096-01-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });
  // Add words
  await request('/days/2096-01-01/words', { method: 'POST', body: JSON.stringify({ word: 'tick' }) });
  await request('/days/2096-01-01/words', { method: 'POST', body: JSON.stringify({ word: 'tock' }) });
  await request('/days/2096-01-01/words', { method: 'POST', body: JSON.stringify({ word: 'cocktail', is_pangram: true }) });

  // Transition to backfill
  await request('/days/2096-01-01', {
    method: 'PATCH',
    body: JSON.stringify({ current_stage: 'backfill' }),
  });

  // Get initial backfill state
  const bf1 = await request('/days/2096-01-01/backfill');
  counted(bf1.current_word.word === 'TICK', 'First backfill word is TICK');

  // Skip TICK
  const skipResult = await request('/days/2096-01-01/backfill/advance', {
    method: 'POST',
    body: JSON.stringify({ action: 'skip' }),
  });
  counted(skipResult.processed_word.word === 'TICK', 'Skip processes TICK');
  counted(skipResult.processed_word.status === 'pending', 'Skip does NOT change status (stays pending)');

  // Verify TICK is still pending after skip
  const wordsAfterSkip = await request('/days/2096-01-01/words');
  const tickAfterSkip = wordsAfterSkip.find((w: any) => w.word === 'TICK');
  counted(tickAfterSkip.status === 'pending', 'TICK still pending in DB after skip');

  // Cursor should have advanced to TOCK
  counted(skipResult.next_word !== null, 'Skip advances cursor to next word');
  counted(skipResult.next_word.word === 'TOCK', 'Next word after skip is TOCK');

  // Accept TOCK
  await request('/days/2096-01-01/backfill/advance', {
    method: 'POST',
    body: JSON.stringify({ action: 'accept' }),
  });

  // Accept COCKTAIL (pangram)
  const lastAdvance = await request('/days/2096-01-01/backfill/advance', {
    method: 'POST',
    body: JSON.stringify({ action: 'accept' }),
  });
  counted(lastAdvance.is_complete === true, 'Backfill is complete after processing all words');

  // ── Minimal backfill (only pangram) ──
  console.log('\n2. Minimal backfill (only a pangram)...');

  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2096-02-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });
  await request('/days/2096-02-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'cocktail', is_pangram: true }),
  });

  await request('/days/2096-02-01', {
    method: 'PATCH',
    body: JSON.stringify({ current_stage: 'backfill' }),
  });

  const minBf = await request('/days/2096-02-01/backfill');
  counted(minBf.current_word !== null, 'Minimal backfill has a current word');
  counted(minBf.current_word.word === 'COCKTAIL', 'Current word is the pangram');
  counted(minBf.total_pre_pangram === 1, 'Total pre-pangram count is 1');

  // Process the single word
  const minAdvance = await request('/days/2096-02-01/backfill/advance', {
    method: 'POST',
    body: JSON.stringify({ action: 'accept' }),
  });
  counted(minAdvance.processed_word.word === 'COCKTAIL', 'Processed the pangram');
  counted(minAdvance.is_complete === true, 'Backfill complete after single word');

  // ── Cursor persistence (session resume) ──
  console.log('\n3. Cursor persistence (session resume)...');

  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2096-03-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });
  await request('/days/2096-03-01/words', { method: 'POST', body: JSON.stringify({ word: 'tick' }) });
  await request('/days/2096-03-01/words', { method: 'POST', body: JSON.stringify({ word: 'tock' }) });
  await request('/days/2096-03-01/words', { method: 'POST', body: JSON.stringify({ word: 'tail' }) });

  await request('/days/2096-03-01', {
    method: 'PATCH',
    body: JSON.stringify({ current_stage: 'backfill' }),
  });

  // Advance past first word
  await request('/days/2096-03-01/backfill/advance', {
    method: 'POST',
    body: JSON.stringify({ action: 'accept' }),
  });

  // Re-fetch backfill state (simulating session resume)
  const resumed = await request('/days/2096-03-01/backfill');
  counted(resumed.current_word.word === 'TOCK', 'Cursor persists at TOCK after resume');
  counted(resumed.processed_count === 1, 'Processed count is 1 after accepting one word');
  counted(resumed.cursor_index === 1, 'Cursor index is 1 (second word)');

  // Advance one more
  await request('/days/2096-03-01/backfill/advance', {
    method: 'POST',
    body: JSON.stringify({ action: 'accept' }),
  });

  // Resume again
  const resumed2 = await request('/days/2096-03-01/backfill');
  counted(resumed2.current_word.word === 'TAIL', 'Cursor advances to TAIL on second resume');
  counted(resumed2.processed_count === 2, 'Processed count is 2 after second accept');

  // ── Advance after all processed ──
  console.log('\n4. Advance after all processed...');

  // Accept the last word
  await request('/days/2096-03-01/backfill/advance', {
    method: 'POST',
    body: JSON.stringify({ action: 'accept' }),
  });

  // Try to advance again
  const advanceAfterDone = await requestRaw('/days/2096-03-01/backfill/advance', {
    method: 'POST',
    body: JSON.stringify({ action: 'accept' }),
  });
  counted(advanceAfterDone.status === 400, 'Advance after all processed returns 400');

  // ── Post-complete state ──
  console.log('\n5. Post-complete state...');

  // Complete the backfill
  await request('/days/2096-03-01/backfill/complete', { method: 'POST' });

  const dayAfterComplete = await request('/days/2096-03-01');
  counted(dayAfterComplete.current_stage === 'new-discovery', 'Stage is new-discovery after complete');

  // GET backfill should fail (not in backfill stage)
  const getBackfillAfter = await requestRaw('/days/2096-03-01/backfill');
  counted(getBackfillAfter.status === 400, 'GET backfill after complete returns 400');

  // POST advance should fail
  const advanceAfterComplete = await requestRaw('/days/2096-03-01/backfill/advance', {
    method: 'POST',
    body: JSON.stringify({ action: 'accept' }),
  });
  counted(advanceAfterComplete.status === 400, 'POST advance after complete returns 400');

  // ── Zero pre-pangram words ──
  console.log('\n6. Zero pre-pangram words backfill...');

  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2096-04-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });
  // Transition directly to backfill with no words added
  await request('/days/2096-04-01', {
    method: 'PATCH',
    body: JSON.stringify({ current_stage: 'backfill' }),
  });

  const zeroBf = await request('/days/2096-04-01/backfill');
  counted(zeroBf.is_complete === true, 'Zero words → backfill is_complete = true');
  counted(zeroBf.current_word === null, 'Zero words → current_word is null');
  counted(zeroBf.total_pre_pangram === 0, 'Zero words → total_pre_pangram = 0');
  counted(zeroBf.processed_count === 0, 'Zero words → processed_count = 0');

  // ── Backfill complete requires backfill stage ──
  console.log('\n7. Backfill complete without backfill stage...');

  // Create a day in pre-pangram stage
  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2096-05-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });

  const completePre = await requestRaw('/days/2096-05-01/backfill/complete', {
    method: 'POST',
  });
  counted(completePre.status === 400, 'POST /backfill/complete on pre-pangram day returns 400');

  // Also test on a day already in new-discovery
  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2096-06-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });
  await request('/days/2096-06-01', {
    method: 'PATCH',
    body: JSON.stringify({ current_stage: 'backfill' }),
  });
  await request('/days/2096-06-01/backfill/complete', { method: 'POST' });

  const completeAgain = await requestRaw('/days/2096-06-01/backfill/complete', {
    method: 'POST',
  });
  counted(completeAgain.status === 400, 'POST /backfill/complete on new-discovery day returns 400');

  console.log(`\n=== ALL ${assertionCount} BACKFILL EDGE CASE TESTS PASSED ===`);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
