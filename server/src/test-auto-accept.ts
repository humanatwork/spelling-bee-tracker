/**
 * Auto-mirror status for duplicate words tests (Issue #36).
 * Covers: accepting/rejecting mirrors duplicates, status changes cascade,
 * reverting to pending, delete reverts mirrors, PATCH on mirrored word blocked,
 * new duplicate auto-mirrors, points not double-counted, status_from_word_id in API.
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
  console.log('=== Auto-Mirror Status for Duplicate Words Tests ===\n');

  // Setup: create a day
  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2098-06-01', letters: ['T', 'I', 'A', 'O', 'L', 'K', 'C'] }),
  });

  // ── 1. Accept word → pending duplicates auto-mirror as accepted ──
  console.log('1. Accept word → pending duplicates auto-mirror...');

  const w1 = await request('/days/2098-06-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tick' }),
  });
  const w2 = await request('/days/2098-06-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tick' }),
  });
  const w3 = await request('/days/2098-06-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tick' }),
  });

  counted(w1.status === 'pending', 'Word 1 starts pending');
  counted(w2.status === 'pending', 'Word 2 starts pending');
  counted(w3.status === 'pending', 'Word 3 starts pending');

  // Accept w1 with points
  await request(`/days/2098-06-01/words/${w1.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'accepted', points: 4 }),
  });

  let words = await request('/days/2098-06-01/words');
  const tick1 = words.find((w: any) => w.id === w1.id);
  const tick2 = words.find((w: any) => w.id === w2.id);
  const tick3 = words.find((w: any) => w.id === w3.id);

  counted(tick1.status === 'accepted', 'Primary word is accepted');
  counted(tick1.points === 4, 'Primary word has 4 points');
  counted(tick1.status_from_word_id === null, 'Primary word has null status_from_word_id');

  counted(tick2.status === 'accepted', 'Duplicate 2 auto-mirrored to accepted');
  counted(tick2.points === null, 'Duplicate 2 has null points');
  counted(tick2.status_from_word_id === w1.id, 'Duplicate 2 references primary');

  counted(tick3.status === 'accepted', 'Duplicate 3 auto-mirrored to accepted');
  counted(tick3.points === null, 'Duplicate 3 has null points');
  counted(tick3.status_from_word_id === w1.id, 'Duplicate 3 references primary');

  // ── 2. Reject word → pending duplicates auto-mirror as rejected ──
  console.log('\n2. Reject word → pending duplicates auto-mirror as rejected...');

  const r1 = await request('/days/2098-06-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tock' }),
  });
  const r2 = await request('/days/2098-06-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tock' }),
  });

  await request(`/days/2098-06-01/words/${r1.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'rejected' }),
  });

  words = await request('/days/2098-06-01/words');
  const tock1 = words.find((w: any) => w.id === r1.id);
  const tock2 = words.find((w: any) => w.id === r2.id);

  counted(tock1.status === 'rejected', 'Primary TOCK is rejected');
  counted(tock2.status === 'rejected', 'Duplicate TOCK auto-mirrored to rejected');
  counted(tock2.status_from_word_id === r1.id, 'Duplicate TOCK references primary');

  // ── 3. Change primary from accepted → rejected → mirrors switch ──
  console.log('\n3. Change primary accepted → rejected → mirrors switch...');

  await request(`/days/2098-06-01/words/${w1.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'rejected' }),
  });

  words = await request('/days/2098-06-01/words');
  const t1 = words.find((w: any) => w.id === w1.id);
  const t2 = words.find((w: any) => w.id === w2.id);
  const t3 = words.find((w: any) => w.id === w3.id);

  counted(t1.status === 'rejected', 'Primary switched to rejected');
  counted(t2.status === 'rejected', 'Mirror 2 followed to rejected');
  counted(t2.status_from_word_id === w1.id, 'Mirror 2 still references primary');
  counted(t3.status === 'rejected', 'Mirror 3 followed to rejected');

  // ── 4. Change primary back to pending → mirrors revert to pending ──
  console.log('\n4. Change primary back to pending → mirrors revert...');

  await request(`/days/2098-06-01/words/${w1.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'pending' }),
  });

  words = await request('/days/2098-06-01/words');
  const p1 = words.find((w: any) => w.id === w1.id);
  const p2 = words.find((w: any) => w.id === w2.id);
  const p3 = words.find((w: any) => w.id === w3.id);

  counted(p1.status === 'pending', 'Primary reverted to pending');
  counted(p2.status === 'pending', 'Mirror 2 reverted to pending');
  counted(p2.status_from_word_id === null, 'Mirror 2 status_from_word_id cleared');
  counted(p3.status === 'pending', 'Mirror 3 reverted to pending');
  counted(p3.status_from_word_id === null, 'Mirror 3 status_from_word_id cleared');

  // ── 5. Delete primary → mirrors revert to pending ──
  console.log('\n5. Delete primary → mirrors revert to pending...');

  // First accept w1 again so mirrors are set
  await request(`/days/2098-06-01/words/${w1.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'accepted', points: 5 }),
  });

  // Delete w1
  await request(`/days/2098-06-01/words/${w1.id}`, { method: 'DELETE' });

  words = await request('/days/2098-06-01/words');
  counted(!words.find((w: any) => w.id === w1.id), 'Primary word deleted');
  const d2 = words.find((w: any) => w.id === w2.id);
  const d3 = words.find((w: any) => w.id === w3.id);
  counted(d2.status === 'pending', 'Mirror 2 reverted to pending after delete');
  counted(d2.status_from_word_id === null, 'Mirror 2 status_from_word_id cleared after delete');
  counted(d3.status === 'pending', 'Mirror 3 reverted to pending after delete');

  // ── 6. PATCH on mirrored word → 409 error ──
  console.log('\n6. PATCH on mirrored word → 409...');

  // Accept w2 so w3 becomes mirrored
  await request(`/days/2098-06-01/words/${w2.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'accepted', points: 3 }),
  });

  const mirrorPatch = await requestRaw(`/days/2098-06-01/words/${w3.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'rejected' }),
  });
  counted(mirrorPatch.status === 409, 'PATCH on mirrored word returns 409');
  counted(mirrorPatch.data.error.includes('mirrored'), '409 error message mentions mirrored');

  // ── 7. New duplicate of already-decided word auto-mirrors on creation ──
  console.log('\n7. New duplicate auto-mirrors on creation...');

  const w4 = await request('/days/2098-06-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tick' }),
  });

  counted(w4.status === 'accepted', 'New duplicate auto-mirrored to accepted on creation');
  counted(w4.status_from_word_id === w2.id, 'New duplicate references the decided word');
  counted(w4.points === null, 'New duplicate has null points');

  // ── 8. Total points not double-counted ──
  console.log('\n8. Total points not double-counted...');

  words = await request('/days/2098-06-01/words');
  const tickWords = words.filter((w: any) => w.word === 'TICK');
  const totalTickPoints = tickWords.reduce((sum: number, w: any) => sum + (w.points || 0), 0);
  counted(totalTickPoints === 3, `Total TICK points = 3 (only primary counted), got ${totalTickPoints}`);

  const withPoints = tickWords.filter((w: any) => w.points != null);
  counted(withPoints.length === 1, 'Only 1 TICK word has non-null points');

  // ── 8b. Day list total_points excludes mirrored words ──
  console.log('\n8b. Day list total_points excludes mirrored words...');

  const dayList = await request('/days');
  const mirrorDay = dayList.find((d: any) => d.date === '2098-06-01');
  counted(mirrorDay !== undefined, 'Mirror test day found in day list');
  counted(mirrorDay.total_points === 3, `total_points is 3 (only primary counted), got ${mirrorDay.total_points}`);

  // ── 9. Accept a later instance (not first by position) → others still mirror ──
  console.log('\n9. Accept later instance → others mirror correctly...');

  // Clean up: revert w2 to pending, which reverts w3 and w4
  await request(`/days/2098-06-01/words/${w2.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'pending' }),
  });

  // Now accept w3 (later instance)
  await request(`/days/2098-06-01/words/${w3.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'accepted', points: 7 }),
  });

  words = await request('/days/2098-06-01/words');
  const late2 = words.find((w: any) => w.id === w2.id);
  const late3 = words.find((w: any) => w.id === w3.id);
  const late4 = words.find((w: any) => w.id === w4.id);

  counted(late3.status === 'accepted', 'Later instance (w3) is accepted');
  counted(late3.points === 7, 'Later instance has 7 points');
  counted(late3.status_from_word_id === null, 'Later instance is the primary');
  counted(late2.status === 'accepted', 'Earlier instance (w2) mirrored');
  counted(late2.status_from_word_id === w3.id, 'Earlier instance references later primary');
  counted(late4.status === 'accepted', 'w4 mirrored');
  counted(late4.status_from_word_id === w3.id, 'w4 references later primary');

  // ── 10. status_from_word_id present in API response ──
  console.log('\n10. status_from_word_id present in API response...');

  const singleWord = await request(`/days/2098-06-01/words/${w3.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_pangram: false }),
  });
  counted('status_from_word_id' in singleWord, 'status_from_word_id present in PATCH response');

  words = await request('/days/2098-06-01/words');
  counted('status_from_word_id' in words[0], 'status_from_word_id present in list response');

  // ── Done ──
  console.log(`\n=== ALL AUTO-MIRROR TESTS PASSED (${assertionCount} assertions) ===`);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
