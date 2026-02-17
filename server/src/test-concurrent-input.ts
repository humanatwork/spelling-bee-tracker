/**
 * Concurrent input tests.
 * Covers: parallel word submissions, race condition on positions,
 * concurrent reattempt detection.
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
  console.log('=== Concurrent Input Tests ===\n');

  // ── 1. 10 parallel POST requests all succeed with unique positions ──
  console.log('1. 10 parallel word creations...');

  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2098-01-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });

  const wordNames = ['TICK', 'TOCK', 'TAIL', 'TOIL', 'TALK', 'LICK', 'LOCK', 'LACK', 'COAT', 'COAL'];
  const results = await Promise.all(
    wordNames.map(w =>
      request('/days/2098-01-01/words', {
        method: 'POST',
        body: JSON.stringify({ word: w }),
      })
    )
  );

  // All should succeed (status 201 — request() throws on non-ok)
  counted(results.length === 10, `All 10 parallel requests returned results`);

  // All should have unique positions
  const positions = results.map((r: any) => r.position);
  const uniquePositions = new Set(positions);
  counted(uniquePositions.size === 10, `All 10 words have unique positions (got ${uniquePositions.size})`);

  // All should not be reattempts
  counted(
    results.every((r: any) => r.is_reattempt === false),
    'No word flagged as reattempt'
  );

  // Verify read-back: GET returns all 10 in position order
  const allWords = await request('/days/2098-01-01/words');
  counted(allWords.length === 10, `GET returns all 10 words`);
  for (let i = 1; i < allWords.length; i++) {
    counted(allWords[i].position > allWords[i - 1].position,
      `Read-back position order correct at index ${i}`);
  }

  // ── 2. Same word submitted concurrently: one creates, rest are reattempts ──
  console.log('\n2. Same word submitted 5 times concurrently...');

  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2098-02-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });

  const dupResults = await Promise.all(
    Array(5).fill(null).map(() =>
      requestRaw('/days/2098-02-01/words', {
        method: 'POST',
        body: JSON.stringify({ word: 'TICK' }),
      })
    )
  );

  // All should succeed (200 or 201)
  counted(
    dupResults.every(r => r.status === 200 || r.status === 201),
    'All 5 concurrent same-word requests succeeded'
  );

  // Exactly one should be 201 (creation), rest 200 (reattempts)
  const creates = dupResults.filter(r => r.status === 201);
  const reattempts = dupResults.filter(r => r.status === 200);
  counted(creates.length === 1, `Exactly 1 creation (got ${creates.length})`);
  counted(reattempts.length === 4, `Exactly 4 reattempts (got ${reattempts.length})`);

  // Only one word should exist
  const wordsAfter = await request('/days/2098-02-01/words');
  counted(wordsAfter.length === 1, `Only 1 word in DB after concurrent same-word submissions`);

  // ── 3. Concurrent inspire requests from same source ──
  console.log('\n3. Concurrent inspire requests from same source...');

  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2098-03-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });

  const source = await request('/days/2098-03-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'TICK' }),
  });

  const inspireWords = ['TOCK', 'TAIL', 'TOIL', 'TALK', 'LICK'];
  const inspireResults = await Promise.all(
    inspireWords.map(w =>
      request(`/days/2098-03-01/words/${source.id}/inspire`, {
        method: 'POST',
        body: JSON.stringify({ word: w }),
      })
    )
  );

  // All should succeed with unique positions
  counted(inspireResults.length === 5, `All 5 concurrent inspires returned results`);

  const inspirePositions = inspireResults.map((r: any) => r.position);
  const uniqueInspirePositions = new Set(inspirePositions);
  counted(uniqueInspirePositions.size === 5,
    `All 5 inspired words have unique positions (got ${uniqueInspirePositions.size})`);

  // All should have chain_depth = 1 (inspired by source at depth 0)
  counted(
    inspireResults.every((r: any) => r.chain_depth === 1),
    'All inspired words have chain_depth = 1'
  );

  console.log(`\n=== ALL ${assertionCount} CONCURRENT INPUT TESTS PASSED ===`);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
