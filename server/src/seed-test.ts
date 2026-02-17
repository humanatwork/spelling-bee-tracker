/**
 * Verification script for 2/9/26 puzzle data (T,I,A,O,L,K,C)
 * Tests: full workflow, recursive chains, inspiration links, reattempts, persistence
 */

const BASE = 'http://localhost:3141/api';

async function request(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${data.error}`);
  return data;
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`  OK: ${msg}`);
}

async function main() {
  console.log('=== Spelling Bee Tracker Verification ===\n');

  // 1. Create day
  console.log('1. Creating day 2026-02-09 (T,I,A,O,L,K,C)...');
  const day = await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2026-02-09', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });
  assert(day.date === '2026-02-09', 'Day created');
  assert(day.center_letter === 'T', 'Center letter is T');
  assert(day.current_stage === 'pre-pangram', 'Stage is pre-pangram');

  // 2. Enter 11 pre-pangram words
  console.log('\n2. Entering pre-pangram words...');
  const prePangramWords = [
    'tick', 'tock', 'ticktock', 'clot', 'toll', 'lotto', 'colt', 'total',
    'cockatoo', 'tall', 'tail',
  ];
  const wordIds: Record<string, number> = {};

  for (const word of prePangramWords) {
    const result = await request('/days/2026-02-09/words', {
      method: 'POST',
      body: JSON.stringify({ word }),
    });
    wordIds[word.toUpperCase()] = result.id;
  }
  assert(Object.keys(wordIds).length === 11, '11 pre-pangram words created');

  // 3. Mark cocktail as pangram
  console.log('\n3. Adding COCKTAIL and marking as pangram...');
  const cocktail = await request('/days/2026-02-09/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'cocktail', is_pangram: true }),
  });
  wordIds['COCKTAIL'] = cocktail.id;
  assert(cocktail.is_pangram === true, 'Cocktail marked as pangram');

  // Transition to backfill
  const updatedDay = await request('/days/2026-02-09', {
    method: 'PATCH',
    body: JSON.stringify({ current_stage: 'backfill' }),
  });
  assert(updatedDay.current_stage === 'backfill', 'Stage transitioned to backfill');

  // 4. Backfill: walk through pre-pangram words
  console.log('\n4. Walking through backfill...');
  let backfill = await request('/days/2026-02-09/backfill');
  assert(backfill.current_word !== null, 'Backfill has a current word');
  assert(backfill.current_word.word === 'TICK', 'First backfill word is TICK');

  // Accept TICK
  let advance = await request('/days/2026-02-09/backfill/advance', {
    method: 'POST',
    body: JSON.stringify({ action: 'accept' }),
  });
  assert(advance.processed_word.word === 'TICK', 'Processed TICK');

  // Accept TOCK
  advance = await request('/days/2026-02-09/backfill/advance', {
    method: 'POST',
    body: JSON.stringify({ action: 'accept' }),
  });
  assert(advance.processed_word.word === 'TOCK', 'Processed TOCK');

  // Reject TICKTOCK (testing rejected words persist)
  advance = await request('/days/2026-02-09/backfill/advance', {
    method: 'POST',
    body: JSON.stringify({ action: 'reject' }),
  });
  assert(advance.processed_word.word === 'TICKTOCK', 'Processed TICKTOCK');

  // Accept remaining pre-pangram words
  for (let i = 0; i < 8; i++) {
    advance = await request('/days/2026-02-09/backfill/advance', {
      method: 'POST',
      body: JSON.stringify({ action: 'accept' }),
    });
  }

  // Accept COCKTAIL (the pangram)
  advance = await request('/days/2026-02-09/backfill/advance', {
    method: 'POST',
    body: JSON.stringify({ action: 'accept' }),
  });
  assert(advance.is_complete === true, 'Backfill complete after processing all words');

  // 5. Add inspiration links
  console.log('\n5. Adding inspiration links...');

  // tock <- tick
  await request(`/days/2026-02-09/words/${wordIds['TOCK']}`, {
    method: 'PATCH',
    body: JSON.stringify({ inspired_by: [wordIds['TICK']], inspiration_confidence: 'certain' }),
  });

  // ticktock <- tock
  await request(`/days/2026-02-09/words/${wordIds['TICKTOCK']}`, {
    method: 'PATCH',
    body: JSON.stringify({ inspired_by: [wordIds['TOCK']], inspiration_confidence: 'certain' }),
  });

  // Verify links
  const tock = (await request('/days/2026-02-09/words')).find((w: any) => w.word === 'TOCK');
  assert(tock.inspired_by_ids.includes(wordIds['TICK']), 'TOCK inspired by TICK');

  const ticktock = (await request('/days/2026-02-09/words')).find((w: any) => w.word === 'TICKTOCK');
  assert(ticktock.inspired_by_ids.includes(wordIds['TOCK']), 'TICKTOCK inspired by TOCK');

  // 6. Complete backfill and enter new-discovery
  console.log('\n6. Transitioning to new-discovery...');
  await request('/days/2026-02-09/backfill/complete', { method: 'POST' });
  const dayAfterBackfill = await request('/days/2026-02-09');
  assert(dayAfterBackfill.current_stage === 'new-discovery', 'Stage is new-discovery');

  // 7. Add post-backfill words
  console.log('\n7. Adding post-backfill (new-discovery) words...');
  const postWords = [
    'toil', 'iota', 'tack', 'allot', 'lilt', 'kilt', 'atoll', 'tool',
    'tilt', 'till', 'talk', 'catcall', 'cattail', 'coattail', 'octal',
    'tallit', 'tacit', 'lactic', 'alit', 'attack', 'cacti', 'toot',
    'coot', 'loot', 'alto', 'took', 'tattoo', 'illicit', 'attic', 'tactic', 'tactical',
  ];

  for (const word of postWords) {
    const result = await request('/days/2026-02-09/words', {
      method: 'POST',
      body: JSON.stringify({ word, stage: 'new-discovery', status: 'accepted' }),
    });
    wordIds[word.toUpperCase()] = result.id;
  }

  // 8. Mark cattail and coattail as inspired by cocktail
  console.log('\n8. Adding pangram-as-source inspiration links...');
  await request(`/days/2026-02-09/words/${wordIds['CATTAIL']}`, {
    method: 'PATCH',
    body: JSON.stringify({ inspired_by: [wordIds['COCKTAIL']], inspiration_confidence: 'certain' }),
  });
  await request(`/days/2026-02-09/words/${wordIds['COATTAIL']}`, {
    method: 'PATCH',
    body: JSON.stringify({ inspired_by: [wordIds['COCKTAIL']], inspiration_confidence: 'certain' }),
  });

  // Verify pangram-as-source
  const cattail = (await request('/days/2026-02-09/words')).find((w: any) => w.word === 'CATTAIL');
  assert(cattail.inspired_by_ids.includes(wordIds['COCKTAIL']), 'CATTAIL inspired by COCKTAIL (pangram)');
  const coattail = (await request('/days/2026-02-09/words')).find((w: any) => w.word === 'COATTAIL');
  assert(coattail.inspired_by_ids.includes(wordIds['COCKTAIL']), 'COATTAIL inspired by COCKTAIL (pangram)');

  // 9. Verify total words
  console.log('\n9. Verifying final state...');
  const allWords = await request('/days/2026-02-09/words');
  assert(allWords.length === 43, `43 total words (got ${allWords.length})`);

  // Verify rejected word persists with links
  const rejectedTicktock = allWords.find((w: any) => w.word === 'TICKTOCK');
  assert(rejectedTicktock.status === 'rejected', 'TICKTOCK is rejected');
  assert(rejectedTicktock.inspired_by_ids.length > 0, 'Rejected TICKTOCK retains inspiration links');

  // Verify position order
  const positions = allWords.map((w: any) => w.position);
  const sorted = [...positions].sort((a: number, b: number) => a - b);
  assert(JSON.stringify(positions) === JSON.stringify(sorted), 'Words in correct position order');

  // 10. Recursive chain test with inspire endpoint
  console.log('\n10. Testing recursive chain via inspire endpoint...');
  // Add a fresh word to chain from
  const baseWord = await request('/days/2026-02-09/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'coil', stage: 'new-discovery' }),
  });
  // depth 1
  const inspired1 = await request(`/days/2026-02-09/words/${baseWord.id}/inspire`, {
    method: 'POST',
    body: JSON.stringify({ word: 'coal' }),
  });
  assert(inspired1.chain_depth === 1, 'First inspiration has chain_depth 1');
  assert(inspired1.inspired_by_ids.includes(baseWord.id), 'COAL inspired by COIL');

  // depth 2
  const inspired2 = await request(`/days/2026-02-09/words/${inspired1.id}/inspire`, {
    method: 'POST',
    body: JSON.stringify({ word: 'cloak' }),
  });
  assert(inspired2.chain_depth === 2, 'Second inspiration has chain_depth 2');
  assert(inspired2.inspired_by_ids.includes(inspired1.id), 'CLOAK inspired by COAL');

  // Verify position ordering (should be: ...coil, coal, cloak, ...)
  const finalWords = await request('/days/2026-02-09/words');
  const coilIdx = finalWords.findIndex((w: any) => w.word === 'COIL');
  const coalIdx = finalWords.findIndex((w: any) => w.word === 'COAL');
  const cloakIdx = finalWords.findIndex((w: any) => w.word === 'CLOAK');
  assert(coilIdx < coalIdx && coalIdx < cloakIdx, 'Chain words in correct position order');

  // 11. Attractor/reattempt test
  console.log('\n11. Testing attractor/reattempt behavior...');
  // TACK was already entered. Enter it again.
  const reattempt1 = await request('/days/2026-02-09/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tack', stage: 'new-discovery' }),
  });
  assert(reattempt1.is_reattempt === true, 'TACK second entry is reattempt');

  // Enter TACK a third time (scratch mode)
  const reattempt2 = await request('/days/2026-02-09/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tack', stage: 'new-discovery', status: 'scratch' }),
  });
  assert(reattempt2.is_reattempt === true, 'TACK third entry is reattempt');
  assert(reattempt2.attempt_count === 3, `TACK has 3 attempts (got ${reattempt2.attempt_count})`);

  // Check attractors endpoint
  const attractors = await request('/days/2026-02-09/attractors');
  const tackAttractor = attractors.find((a: any) => a.word === 'TACK');
  assert(tackAttractor !== undefined, 'TACK appears in attractors');
  assert(tackAttractor.attempt_count === 3, 'TACK attractor has 3 attempts');

  // 12. Persistence test (read back from DB)
  console.log('\n12. Testing persistence (read back)...');
  const reloadedDay = await request('/days/2026-02-09');
  assert(reloadedDay.current_stage === 'new-discovery', 'Stage persisted');
  const reloadedWords = await request('/days/2026-02-09/words');
  assert(reloadedWords.length === 46, `46 total words after chains (got ${reloadedWords.length})`);

  // 13. Export test
  console.log('\n13. Testing export...');
  const exported = await request('/days/2026-02-09/export');
  assert(exported.words.length === reloadedWords.length, 'Export has all words');

  // Mark genius
  await request('/days/2026-02-09', {
    method: 'PATCH',
    body: JSON.stringify({ genius_achieved: true }),
  });
  const geniusDay = await request('/days/2026-02-09');
  assert(geniusDay.genius_achieved === true, 'Genius achievement persisted');

  console.log('\n=== ALL TESTS PASSED ===');
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
