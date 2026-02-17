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

  // Word too short (under 4 letters)
  const shortWord3 = await requestRaw('/days/2099-02-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'cat' }),
  });
  countedAssert(shortWord3.status === 400, '3-letter word returns 400');
  countedAssert(shortWord3.data.error.includes('4 letters'), 'Error message mentions 4 letters');

  // 4-letter word should succeed
  const fourLetterWord = await request('/days/2099-02-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'talk' }),
  });
  countedAssert(fourLetterWord.word === 'TALK', '4-letter word is accepted');

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

  // Inspire with too-short word
  const inspireShort = await requestRaw(`/days/2099-02-01/words/${w.id}/inspire`, {
    method: 'POST',
    body: JSON.stringify({ word: 'at' }),
  });
  countedAssert(inspireShort.status === 400, 'Inspire with 2-letter word returns 400');

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

  // ── Pangram validation ──
  console.log('\n7. Pangram validation...');

  // Create a day for pangram tests
  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2099-03-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });

  // POST: short word marked as pangram should be rejected
  const shortPangram = await requestRaw('/days/2099-03-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tick', is_pangram: true }),
  });
  countedAssert(shortPangram.status === 400, 'Short word (4 letters) rejected as pangram on POST');
  countedAssert(shortPangram.data.error.includes('pangram'), 'Error message mentions pangram');

  // POST: word missing a letter should be rejected as pangram
  const missingLetter = await requestRaw('/days/2099-03-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'ticktock', is_pangram: true }),
  });
  countedAssert(missingLetter.status === 400, 'Word missing day letters rejected as pangram on POST');

  // POST: valid pangram should be accepted
  const validPangram = await request('/days/2099-03-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'cocktail', is_pangram: true }),
  });
  countedAssert(validPangram.is_pangram === true, 'Valid pangram accepted on POST');

  // PATCH: marking a short word as pangram should be rejected
  const shortWord = await request('/days/2099-03-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'toil' }),
  });
  const patchShortPangram = await requestRaw(`/days/2099-03-01/words/${shortWord.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_pangram: true }),
  });
  countedAssert(patchShortPangram.status === 400, 'Short word rejected as pangram on PATCH');

  // ── Duplicate letter validation ──
  console.log('\n8. Duplicate letter validation...');

  const dupLetters = await requestRaw('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2099-04-01', letters: ['T', 'T', 'A', 'O', 'L', 'K', 'C'] }),
  });
  countedAssert(dupLetters.status === 400, 'Duplicate letters in array returns 400');
  countedAssert(dupLetters.data.error.includes('unique') || dupLetters.data.error.includes('duplicate'),
    'Error message mentions uniqueness or duplicates');

  // ── Stage transition validation (one-way only) ──
  console.log('\n9. Stage transition validation...');

  // Create a fresh day for stage tests
  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2099-05-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });

  // pre-pangram → new-discovery should fail (must go through backfill)
  const skipBackfill = await requestRaw('/days/2099-05-01', {
    method: 'PATCH',
    body: JSON.stringify({ current_stage: 'new-discovery' }),
  });
  countedAssert(skipBackfill.status === 400, 'pre-pangram → new-discovery returns 400');

  // pre-pangram → backfill should succeed
  const toBackfill = await requestRaw('/days/2099-05-01', {
    method: 'PATCH',
    body: JSON.stringify({ current_stage: 'backfill' }),
  });
  countedAssert(toBackfill.status === 200, 'pre-pangram → backfill succeeds');

  // backfill → pre-pangram should fail (backward transition)
  const backToPre = await requestRaw('/days/2099-05-01', {
    method: 'PATCH',
    body: JSON.stringify({ current_stage: 'pre-pangram' }),
  });
  countedAssert(backToPre.status === 400, 'backfill → pre-pangram returns 400');

  // backfill → new-discovery should succeed
  const toDiscovery = await requestRaw('/days/2099-05-01', {
    method: 'PATCH',
    body: JSON.stringify({ current_stage: 'new-discovery' }),
  });
  countedAssert(toDiscovery.status === 200, 'backfill → new-discovery succeeds');

  // new-discovery → backfill should fail (backward transition)
  const backToBackfill = await requestRaw('/days/2099-05-01', {
    method: 'PATCH',
    body: JSON.stringify({ current_stage: 'backfill' }),
  });
  countedAssert(backToBackfill.status === 400, 'new-discovery → backfill returns 400');

  // new-discovery → pre-pangram should fail (backward transition)
  const backToPre2 = await requestRaw('/days/2099-05-01', {
    method: 'PATCH',
    body: JSON.stringify({ current_stage: 'pre-pangram' }),
  });
  countedAssert(backToPre2.status === 400, 'new-discovery → pre-pangram returns 400');

  // Same stage transition should be a no-op (not an error)
  const sameStage = await requestRaw('/days/2099-05-01', {
    method: 'PATCH',
    body: JSON.stringify({ current_stage: 'new-discovery' }),
  });
  countedAssert(sameStage.status === 200, 'Same stage transition is a no-op (200)');

  // ── Word valid boolean ──
  console.log('\n10. Word valid boolean...');

  // Create a day with known letters T,I,A,O,L,K,C (center = T)
  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2099-06-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });

  // Valid word: uses center letter (T) and only day letters
  const validWord = await request('/days/2099-06-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'TALK' }),
  });
  countedAssert(validWord.valid === true, 'TALK is valid (uses center T, only day letters)');

  // Invalid word: missing center letter
  const noCenterWord = await request('/days/2099-06-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'COIL' }),
  });
  countedAssert(noCenterWord.valid === false, 'COIL is invalid (missing center letter T)');

  // Invalid word: uses letter not in day's set
  const offLetterWord = await request('/days/2099-06-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'TEST' }),
  });
  countedAssert(offLetterWord.valid === false, 'TEST is invalid (E and S not in day letters)');

  // Valid pangram
  const validPangramWord = await request('/days/2099-06-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'COCKTAIL', is_pangram: true }),
  });
  countedAssert(validPangramWord.valid === true, 'COCKTAIL is valid (all day letters, includes center)');

  // Valid word in word list
  const wordList = await request('/days/2099-06-01/words');
  const talkInList = wordList.find((w: any) => w.word === 'TALK');
  countedAssert(talkInList.valid === true, 'valid field present in word list (TALK)');
  const coilInList = wordList.find((w: any) => w.word === 'COIL');
  countedAssert(coilInList.valid === false, 'valid field present in word list (COIL = false)');

  // ── Phase 2 stubs (501s) ──
  console.log('\n11. Phase 2 stub endpoints...');

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
