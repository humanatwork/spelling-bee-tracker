/**
 * Verification script for simplified Spelling Bee Tracker.
 * Tests: day CRUD, word CRUD, positioning, pangram, accept/reject with points,
 * delete word, cascade delete, total points in list.
 */

const BASE = 'http://localhost:3141/api';

async function request(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
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
  assert(Array.isArray(day.letters) && day.letters.length === 7, 'Letters array parsed');

  // 2. Add words sequentially — verify position ordering
  console.log('\n2. Adding words sequentially...');
  const wordTexts = ['tick', 'tock', 'ticktock', 'clot', 'toll'];
  const wordIds: Record<string, number> = {};

  for (const w of wordTexts) {
    const result = await request('/days/2026-02-09/words', {
      method: 'POST',
      body: JSON.stringify({ word: w }),
    });
    wordIds[result.word] = result.id;
  }

  const words = await request('/days/2026-02-09/words');
  assert(words.length === 5, '5 words created');
  const positions = words.map((w: any) => w.position);
  for (let i = 1; i < positions.length; i++) {
    assert(positions[i] > positions[i - 1], `Position ${i} > position ${i - 1}`);
  }

  // 3. Duplicate words allowed — same word twice, both persist
  console.log('\n3. Duplicate words allowed...');
  await request('/days/2026-02-09/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'tick' }),
  });
  const wordsAfterDup = await request('/days/2026-02-09/words');
  assert(wordsAfterDup.length === 6, 'Duplicate word creates second entry (6 total)');

  // 4. Mark pangram — PATCH is_pangram
  console.log('\n4. Mark pangram...');
  const cocktail = await request('/days/2026-02-09/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'cocktail', is_pangram: true }),
  });
  assert(cocktail.is_pangram === true, 'Cocktail created as pangram');
  wordIds['COCKTAIL'] = cocktail.id;

  // 5. Accept with points — PATCH status='accepted', points=5
  console.log('\n5. Accept with points...');
  const accepted = await request(`/days/2026-02-09/words/${wordIds['TICK']}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'accepted', points: 4 }),
  });
  assert(accepted.status === 'accepted', 'Word accepted');
  assert(accepted.points === 4, 'Points set to 4');

  const accepted2 = await request(`/days/2026-02-09/words/${wordIds['COCKTAIL']}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'accepted', points: 14 }),
  });
  assert(accepted2.status === 'accepted', 'Pangram accepted');
  assert(accepted2.points === 14, 'Pangram points set to 14');

  // 6. Reject word — PATCH status='rejected'
  console.log('\n6. Reject word...');
  const rejected = await request(`/days/2026-02-09/words/${wordIds['TICKTOCK']}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'rejected' }),
  });
  assert(rejected.status === 'rejected', 'Word rejected');

  // 7. Insert at position — POST with after_word_id, verify ordering
  console.log('\n7. Insert at position...');
  const inserted = await request('/days/2026-02-09/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'toil', after_word_id: wordIds['TICK'] }),
  });
  const wordsAfterInsert = await request('/days/2026-02-09/words');
  const tickIdx = wordsAfterInsert.findIndex((w: any) => w.id === wordIds['TICK']);
  const insertedIdx = wordsAfterInsert.findIndex((w: any) => w.id === inserted.id);
  const tockIdx = wordsAfterInsert.findIndex((w: any) => w.id === wordIds['TOCK']);
  assert(insertedIdx === tickIdx + 1, 'Inserted word is right after TICK');
  assert(insertedIdx < tockIdx, 'Inserted word is before TOCK');

  // Verify inserted_after_word_id tracking
  assert(inserted.inserted_after_word_id === wordIds['TICK'], 'Inserted word tracks after_word_id');
  const tickWord = wordsAfterInsert.find((w: any) => w.id === wordIds['TICK']);
  assert(tickWord.inserted_after_word_id === null, 'Appended word has null inserted_after_word_id');

  // 8. Delete word — DELETE, verify gone
  console.log('\n8. Delete word...');
  const wordsBefore = await request('/days/2026-02-09/words');
  const countBefore = wordsBefore.length;
  await request(`/days/2026-02-09/words/${inserted.id}`, { method: 'DELETE' });
  const wordsAfterDelete = await request('/days/2026-02-09/words');
  assert(wordsAfterDelete.length === countBefore - 1, 'Word count decreased by 1');
  assert(!wordsAfterDelete.find((w: any) => w.id === inserted.id), 'Deleted word is gone');

  // Verify ON DELETE SET NULL for inserted_after_word_id
  console.log('\n8b. Delete reference word sets inserted_after_word_id to null...');
  const anchorWord = await request('/days/2026-02-09/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'talc' }),
  });
  const dependentWord = await request('/days/2026-02-09/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'cola', after_word_id: anchorWord.id }),
  });
  assert(dependentWord.inserted_after_word_id === anchorWord.id, 'Dependent word references anchor');
  // Delete the anchor word
  await request(`/days/2026-02-09/words/${anchorWord.id}`, { method: 'DELETE' });
  // Re-fetch the dependent word and check that its reference is nulled
  const wordsAfterAnchorDelete = await request('/days/2026-02-09/words');
  const dependentAfter = wordsAfterAnchorDelete.find((w: any) => w.id === dependentWord.id);
  assert(dependentAfter !== undefined, 'Dependent word still exists after anchor deletion');
  assert(dependentAfter.inserted_after_word_id === null, 'inserted_after_word_id set to null after anchor deletion');
  // Clean up: delete the dependent word
  await request(`/days/2026-02-09/words/${dependentWord.id}`, { method: 'DELETE' });

  // 9. Delete day — cascade deletes all words
  console.log('\n9. Delete day cascade...');
  // Create a temp day with words, then delete
  await request('/days', {
    method: 'POST',
    body: JSON.stringify({ date: '2026-01-01', letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] }),
  });
  await request('/days/2026-01-01/words', {
    method: 'POST',
    body: JSON.stringify({ word: 'abed' }),
  });
  await request('/days/2026-01-01', { method: 'DELETE' });
  const res = await fetch(`${BASE}/days/2026-01-01`);
  assert(res.status === 404, 'Deleted day returns 404');

  // 10. Total points in day list
  console.log('\n10. Total points in day list...');
  const dayList = await request('/days');
  const mainDay = dayList.find((d: any) => d.date === '2026-02-09');
  assert(mainDay !== undefined, 'Main day in list');
  assert(mainDay.total_points === 18, `Total points is 18 (4 + 14) (got ${mainDay.total_points})`);
  assert(mainDay.word_count > 0, 'Word count present in list');
  assert(mainDay.pangram_count === 1, 'Pangram count is 1');

  console.log('\n=== ALL TESTS PASSED ===');
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
