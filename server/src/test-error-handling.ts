/**
 * Error handling and validation tests.
 * Covers: 400/404/409/501 error paths, health check, phase 2 stubs.
 * Requires a running server with a fresh database.
 */

import { request, requestRaw, assert, BASE } from './test-helpers';

let assertionCount = 0;
const originalAssert = assert;
function countedAssert(condition: boolean, msg: string) {
  assertionCount++;
  originalAssert(condition, msg);
}

async function main() {
  console.log('=== Error Handling & Validation Tests ===\n');

  // ── Health check ──
  console.log('1. Health check...');
  const health = await request('/health');
  countedAssert(health.status === 'ok', 'Health check returns status ok');
  countedAssert(typeof health.timestamp === 'string', 'Health check includes timestamp');

  // ── Day validation (400s) ──
  console.log('\n2. Day validation errors...');

  // Missing date
  const noDate = await requestRaw('/days', {
    method: 'POST',
    body: JSON.stringify({ letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] }),
  });
  countedAssert(noDate.status === 400, 'Missing date returns 400');

  // Missing letters
  const noLetters = await requestRaw('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2099-01-01' }),
  });
  countedAssert(noLetters.status === 400, 'Missing letters returns 400');

  // Wrong letter count
  const wrongCount = await requestRaw('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2099-01-01', letters: ['A', 'B', 'C'] }),
  });
  countedAssert(wrongCount.status === 400, 'Wrong letter count returns 400');

  // Letters not an array
  const notArray = await requestRaw('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2099-01-01', letters: 'ABCDEFG' }),
  });
  countedAssert(notArray.status === 400, 'Letters as string returns 400');

  // Duplicate date (409)
  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2099-01-02', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });
  const dup = await requestRaw('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2099-01-02', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });
  countedAssert(dup.status === 409, 'Duplicate date returns 409');
  countedAssert(dup.data.error.includes('already exists'), '409 error message mentions already exists');

  // ── Day 404s ──
  console.log('\n3. Day 404 errors...');

  const fakeDate = '1900-01-01';

  const getDay404 = await requestRaw(`/days/${fakeDate}`);
  countedAssert(getDay404.status === 404, 'GET non-existent day returns 404');

  const patchDay404 = await requestRaw(`/days/${fakeDate}`, {
    method: 'PATCH',
    body: JSON.stringify({ genius_achieved: true }),
  });
  countedAssert(patchDay404.status === 404, 'PATCH non-existent day returns 404');

  const deleteDay404 = await requestRaw(`/days/${fakeDate}`, {
    method: 'DELETE',
  });
  countedAssert(deleteDay404.status === 404, 'DELETE non-existent day returns 404');

  const exportDay404 = await requestRaw(`/days/${fakeDate}/export`);
  countedAssert(exportDay404.status === 404, 'Export non-existent day returns 404');

  const attractors404 = await requestRaw(`/days/${fakeDate}/attractors`);
  countedAssert(attractors404.status === 404, 'Attractors non-existent day returns 404');

  // ── Word validation (400s) ──
  console.log('\n4. Word validation errors...');

  // Create a day for word tests
  const testDay = await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2099-02-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });

  // Missing word field
  const noWord = await requestRaw('/days/2099-02-01/words', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  countedAssert(noWord.status === 400, 'Missing word field returns 400');

  // Empty word field
  const emptyWord = await requestRaw('/days/2099-02-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: '' }),
  });
  countedAssert(emptyWord.status === 400, 'Empty word field returns 400');

  // Word on non-existent day
  const wordFakeDay = await requestRaw(`/days/${fakeDate}/words`, {
    method: 'POST',
    body: JSON.stringify({ word: 'test' }),
  });
  countedAssert(wordFakeDay.status === 404, 'Word on non-existent day returns 404');

  // GET words on non-existent day
  const getWordsFakeDay = await requestRaw(`/days/${fakeDate}/words`);
  countedAssert(getWordsFakeDay.status === 404, 'GET words non-existent day returns 404');

  // ── Word 404s ──
  console.log('\n5. Word 404 errors...');

  const fakeWordId = 99999;

  const patchWord404 = await requestRaw(`/days/2099-02-01/words/${fakeWordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'accepted' }),
  });
  countedAssert(patchWord404.status === 404, 'PATCH non-existent word returns 404');

  const inspire404 = await requestRaw(`/days/2099-02-01/words/${fakeWordId}/inspire`, {
    method: 'POST',
    body: JSON.stringify({ word: 'test' }),
  });
  countedAssert(inspire404.status === 404, 'Inspire from non-existent word returns 404');

  const attempts404 = await requestRaw(`/days/2099-02-01/words/${fakeWordId}/attempts`);
  countedAssert(attempts404.status === 404, 'Attempts for non-existent word returns 404');

  // PATCH word on non-existent day
  const patchWordFakeDay = await requestRaw(`/days/${fakeDate}/words/1`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'accepted' }),
  });
  countedAssert(patchWordFakeDay.status === 404, 'PATCH word on non-existent day returns 404');

  // Inspire missing word field
  const w = await request('/days/2099-02-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tick' }),
  });
  const inspireMissingWord = await requestRaw(`/days/2099-02-01/words/${w.id}/inspire`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  countedAssert(inspireMissingWord.status === 400, 'Inspire with missing word returns 400');

  // ── Backfill errors ──
  console.log('\n6. Backfill errors...');

  // GET backfill on day not in backfill stage
  const backfillWrongStage = await requestRaw('/days/2099-02-01/backfill');
  countedAssert(backfillWrongStage.status === 400, 'GET backfill on pre-pangram day returns 400');

  // POST advance on day not in backfill stage
  const advanceWrongStage = await requestRaw('/days/2099-02-01/backfill/advance', {
    method: 'POST',
    body: JSON.stringify({ action: 'accept' }),
  });
  countedAssert(advanceWrongStage.status === 400, 'POST advance on pre-pangram day returns 400');

  // POST advance with invalid action
  // First transition to backfill
  await request('/days/2099-02-01', {
    method: 'PATCH',
    body: JSON.stringify({ current_stage: 'backfill' }),
  });
  const invalidAction = await requestRaw('/days/2099-02-01/backfill/advance', {
    method: 'POST',
    body: JSON.stringify({ action: 'invalid' }),
  });
  countedAssert(invalidAction.status === 400, 'Invalid backfill action returns 400');

  // POST advance with missing action
  const missingAction = await requestRaw('/days/2099-02-01/backfill/advance', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  countedAssert(missingAction.status === 400, 'Missing backfill action returns 400');

  // Backfill on non-existent day
  const backfillFakeDay = await requestRaw(`/days/${fakeDate}/backfill`);
  countedAssert(backfillFakeDay.status === 404, 'GET backfill non-existent day returns 404');

  const advanceFakeDay = await requestRaw(`/days/${fakeDate}/backfill/advance`, {
    method: 'POST',
    body: JSON.stringify({ action: 'accept' }),
  });
  countedAssert(advanceFakeDay.status === 404, 'POST advance non-existent day returns 404');

  const completeFakeDay = await requestRaw(`/days/${fakeDate}/backfill/complete`, {
    method: 'POST',
  });
  countedAssert(completeFakeDay.status === 404, 'POST complete non-existent day returns 404');

  // ── Phase 2 stubs (501s) ──
  console.log('\n7. Phase 2 stub endpoints...');

  const stats501 = await requestRaw('/days/2099-02-01/stats');
  countedAssert(stats501.status === 501, 'Day stats returns 501');

  const graph501 = await requestRaw('/days/2099-02-01/graph');
  countedAssert(graph501.status === 501, 'Day graph returns 501');

  const globalStats501 = await requestRaw('/stats');
  countedAssert(globalStats501.status === 501, 'Global stats returns 501');

  console.log(`\n=== ALL ${assertionCount} ERROR HANDLING TESTS PASSED ===`);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
