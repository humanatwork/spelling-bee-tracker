/**
 * Attempts, export, inspire reattempt tests.
 * Covers: attempts endpoint (counts, ordering), multiple inspiration sources,
 * inspire reattempt, export completeness and field validation.
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
  console.log('=== Attempts, Export & Inspire Reattempt Tests ===\n');

  // Setup: create a day and move to new-discovery
  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2095-01-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });

  const w1 = await request('/days/2095-01-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tick' }),
  });
  const w2 = await request('/days/2095-01-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tock' }),
  });
  const w3 = await request('/days/2095-01-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'cocktail', is_pangram: true }),
  });

  // Transition to backfill then new-discovery
  await request('/days/2095-01-01', {
    method: 'PATCH',
    body: JSON.stringify({ current_stage: 'backfill' }),
  });
  // Accept all backfill words
  for (let i = 0; i < 3; i++) {
    await request('/days/2095-01-01/backfill/advance', {
      method: 'POST',
      body: JSON.stringify({ action: 'accept' }),
    });
  }
  await request('/days/2095-01-01/backfill/complete', { method: 'POST' });

  // ── Attempts endpoint ──
  console.log('1. Attempts endpoint...');

  // Initial entry = 1 attempt
  const attempts1 = await request(`/days/2095-01-01/words/${w1.id}/attempts`);
  counted(attempts1.length === 1, 'Initial word has 1 attempt');
  counted(attempts1[0].word_id === w1.id, 'Attempt references correct word');
  counted(typeof attempts1[0].attempted_at === 'string', 'Attempt has timestamp');
  counted(attempts1[0].stage === 'pre-pangram', 'Initial attempt has correct stage');

  // Reattempt = 2 attempts
  await request('/days/2095-01-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tick', stage: 'new-discovery' }),
  });
  const attempts2 = await request(`/days/2095-01-01/words/${w1.id}/attempts`);
  counted(attempts2.length === 2, 'After reattempt, word has 2 attempts');
  counted(attempts2[1].stage === 'new-discovery', 'Reattempt logged with new-discovery stage');

  // Third attempt = 3 attempts
  await request('/days/2095-01-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tick', stage: 'new-discovery' }),
  });
  const attempts3 = await request(`/days/2095-01-01/words/${w1.id}/attempts`);
  counted(attempts3.length === 3, 'After third entry, word has 3 attempts');

  // Verify order (chronological)
  const times = attempts3.map((a: any) => a.attempted_at);
  counted(times[0] <= times[1] && times[1] <= times[2], 'Attempts in chronological order');

  // ── Multiple inspiration sources ──
  console.log('\n2. Multiple inspiration sources...');

  const w4 = await request('/days/2095-01-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'taco', stage: 'new-discovery' }),
  });

  // Set 2 inspiration sources
  const multi = await request(`/days/2095-01-01/words/${w4.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ inspired_by: [w1.id, w2.id] }),
  });
  counted(multi.inspired_by_ids.length === 2, 'Word has 2 inspiration sources');
  counted(multi.inspired_by_ids.includes(w1.id), 'First inspiration source present');
  counted(multi.inspired_by_ids.includes(w2.id), 'Second inspiration source present');

  // Remove one source (replace with just one)
  const single = await request(`/days/2095-01-01/words/${w4.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ inspired_by: [w1.id] }),
  });
  counted(single.inspired_by_ids.length === 1, 'After removing one, word has 1 source');
  counted(single.inspired_by_ids.includes(w1.id), 'Remaining source is correct');
  counted(!single.inspired_by_ids.includes(w2.id), 'Removed source is gone');

  // ── Inspire reattempt ──
  console.log('\n3. Inspire reattempt...');

  // TOCK already exists. Inspire it from w1 (should be reattempt)
  const inspireReattempt = await request(`/days/2095-01-01/words/${w1.id}/inspire`, {
    method: 'POST',
    body: JSON.stringify({ word: 'tock' }),
  });
  counted(inspireReattempt.is_reattempt === true, 'Inspire existing word is reattempt');

  // Check TOCK now has additional attempt
  const tockAttempts = await request(`/days/2095-01-01/words/${w2.id}/attempts`);
  counted(tockAttempts.length === 2, 'TOCK has 2 attempts after inspire reattempt');

  // The reattempt context should mention the source word
  const reattemptContext = tockAttempts[1].context;
  counted(reattemptContext !== null && reattemptContext.includes('inspired by'), 'Reattempt context mentions inspiration');

  // ── Export completeness ──
  console.log('\n4. Export completeness...');

  const exported = await request('/days/2095-01-01/export');

  // Basic structure
  counted(exported.date === '2095-01-01', 'Export has correct date');
  counted(Array.isArray(exported.words), 'Export has words array');
  counted(Array.isArray(exported.attempts), 'Export has attempts array');

  // Word count
  const allWords = await request('/days/2095-01-01/words');
  counted(exported.words.length === allWords.length, `Export has all ${allWords.length} words`);

  // Pangram flag in export
  const exportedCocktail = exported.words.find((w: any) => w.word === 'COCKTAIL');
  counted(exportedCocktail.is_pangram === true, 'Export includes pangram flag');

  // inspired_by_ids in export
  const exportedTaco = exported.words.find((w: any) => w.word === 'TACO');
  counted(Array.isArray(exportedTaco.inspired_by_ids), 'Export word has inspired_by_ids array');

  // Attempts in export
  counted(exported.attempts.length > 0, 'Export has attempts');
  // All attempt word_ids should reference valid word ids in the export
  const exportWordIds = new Set(exported.words.map((w: any) => w.id));
  const allAttemptWordIdsValid = exported.attempts.every((a: any) => exportWordIds.has(a.word_id));
  counted(allAttemptWordIdsValid, 'All attempt word_ids reference valid words in export');

  console.log(`\n=== ALL ${assertionCount} ATTEMPTS & EXPORT TESTS PASSED ===`);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
