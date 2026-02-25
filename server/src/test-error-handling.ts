/**
 * Error handling and validation tests.
 * Covers: 400/404/409 error paths, health check.
 * Requires a running server with a fresh database.
 */

import { request, requestRaw, assert } from './test-helpers';

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

  const deleteDay404 = await requestRaw(`/days/${fakeDate}`, {
    method: 'DELETE',
  });
  countedAssert(deleteDay404.status === 404, 'DELETE non-existent day returns 404');

  // ── Word validation (400s) ──
  console.log('\n4. Word validation errors...');

  // Create a day for word tests
  await request('/days', {
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

  const deleteWord404 = await requestRaw(`/days/2099-02-01/words/${fakeWordId}`, {
    method: 'DELETE',
  });
  countedAssert(deleteWord404.status === 404, 'DELETE non-existent word returns 404');

  // PATCH word on non-existent day
  const patchWordFakeDay = await requestRaw(`/days/${fakeDate}/words/1`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'accepted' }),
  });
  countedAssert(patchWordFakeDay.status === 404, 'PATCH word on non-existent day returns 404');

  // ── Pangram validation ──
  console.log('\n6. Pangram validation...');

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
  console.log('\n7. Duplicate letter validation...');

  const dupLetters = await requestRaw('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2099-04-01', letters: ['T', 'T', 'A', 'O', 'L', 'K', 'C'] }),
  });
  countedAssert(dupLetters.status === 400, 'Duplicate letters in array returns 400');
  countedAssert(dupLetters.data.error.includes('unique') || dupLetters.data.error.includes('duplicate'),
    'Error message mentions uniqueness or duplicates');

  // ── PATCH field validation ──
  console.log('\n8. PATCH field validation...');

  // Add a word for PATCH tests
  const patchTestWord = await request('/days/2099-02-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'toil' }),
  });

  // Invalid status value
  const badStatus = await requestRaw(`/days/2099-02-01/words/${patchTestWord.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'invalid' }),
  });
  countedAssert(badStatus.status === 400, 'Invalid status value returns 400');

  // Negative points
  const negPoints = await requestRaw(`/days/2099-02-01/words/${patchTestWord.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ points: -5 }),
  });
  countedAssert(negPoints.status === 400, 'Negative points returns 400');

  // Float points
  const floatPoints = await requestRaw(`/days/2099-02-01/words/${patchTestWord.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ points: 3.5 }),
  });
  countedAssert(floatPoints.status === 400, 'Float points returns 400');

  // String points
  const strPoints = await requestRaw(`/days/2099-02-01/words/${patchTestWord.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ points: 'five' }),
  });
  countedAssert(strPoints.status === 400, 'String points returns 400');

  // Non-numeric word ID in PATCH
  const nanPatch = await requestRaw('/days/2099-02-01/words/abc', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'accepted' }),
  });
  countedAssert(nanPatch.status === 400, 'Non-numeric word ID in PATCH returns 400');

  // Non-numeric word ID in DELETE
  const nanDelete = await requestRaw('/days/2099-02-01/words/abc', {
    method: 'DELETE',
  });
  countedAssert(nanDelete.status === 400, 'Non-numeric word ID in DELETE returns 400');

  console.log(`\n=== ALL ${assertionCount} ERROR HANDLING TESTS PASSED ===`);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
