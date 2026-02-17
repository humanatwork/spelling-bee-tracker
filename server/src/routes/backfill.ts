import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router({ mergeParams: true });

function param(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

function getDay(date: string) {
  return getDb().prepare('SELECT * FROM days WHERE date = ?').get(date) as any;
}

// GET /api/days/:date/backfill - get current backfill state
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const day = getDay(param(req.params.date));
  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }

  if (day.current_stage !== 'backfill') {
    res.status(400).json({ error: `Day is in ${day.current_stage} stage, not backfill` });
    return;
  }

  // Get pre-pangram words in position order
  const prePangramWords = db.prepare(`
    SELECT w.*,
      (SELECT json_group_array(wi.inspired_by_word_id) FROM word_inspirations wi WHERE wi.word_id = w.id) as inspired_by_ids
    FROM words w
    WHERE w.day_id = ? AND w.stage = 'pre-pangram'
    ORDER BY w.position
  `).all(day.id) as any[];

  // Find current cursor word
  let cursorWord = null;
  let cursorIndex = -1;

  if (day.backfill_cursor_word_id) {
    cursorWord = prePangramWords.find((w: any) => w.id === day.backfill_cursor_word_id);
    cursorIndex = prePangramWords.findIndex((w: any) => w.id === day.backfill_cursor_word_id);
  }

  // If no cursor set, find the first pending pre-pangram word
  if (!cursorWord) {
    const firstPending = prePangramWords.find((w: any) => w.status === 'pending');
    if (firstPending) {
      cursorWord = firstPending;
      cursorIndex = prePangramWords.indexOf(firstPending);
      // Update the day's cursor
      db.prepare('UPDATE days SET backfill_cursor_word_id = ? WHERE id = ?').run(firstPending.id, day.id);
    }
  }

  // Count completed
  const totalPrePangram = prePangramWords.length;
  const processedCount = prePangramWords.filter((w: any) => w.status !== 'pending').length;

  // Get backfill-stage words (inspired words added during backfill)
  const backfillWords = db.prepare(`
    SELECT w.*,
      (SELECT json_group_array(wi.inspired_by_word_id) FROM word_inspirations wi WHERE wi.word_id = w.id) as inspired_by_ids
    FROM words w
    WHERE w.day_id = ? AND w.stage = 'backfill'
    ORDER BY w.position
  `).all(day.id);

  res.json({
    current_word: cursorWord ? {
      ...cursorWord,
      is_pangram: !!cursorWord.is_pangram,
      inspired_by_ids: JSON.parse(cursorWord.inspired_by_ids || '[]').filter((id: any) => id !== null),
    } : null,
    cursor_index: cursorIndex,
    total_pre_pangram: totalPrePangram,
    processed_count: processedCount,
    is_complete: !cursorWord || processedCount >= totalPrePangram,
    backfill_words: backfillWords.map((w: any) => ({
      ...w,
      is_pangram: !!w.is_pangram,
      inspired_by_ids: JSON.parse(w.inspired_by_ids || '[]').filter((id: any) => id !== null),
    })),
  });
});

// POST /api/days/:date/backfill/advance - process current word and advance cursor
router.post('/advance', (req: Request, res: Response) => {
  const db = getDb();
  const day = getDay(param(req.params.date));
  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }

  if (day.current_stage !== 'backfill') {
    res.status(400).json({ error: `Day is in ${day.current_stage} stage, not backfill` });
    return;
  }

  const { action } = req.body; // 'accept', 'reject', 'skip'
  if (!action || !['accept', 'reject', 'skip'].includes(action)) {
    res.status(400).json({ error: 'action must be accept, reject, or skip' });
    return;
  }

  // Get current cursor word
  const prePangramWords = db.prepare(`
    SELECT * FROM words WHERE day_id = ? AND stage = 'pre-pangram' ORDER BY position
  `).all(day.id) as any[];

  let cursorIndex = -1;
  if (day.backfill_cursor_word_id) {
    cursorIndex = prePangramWords.findIndex((w: any) => w.id === day.backfill_cursor_word_id);
  }
  if (cursorIndex === -1) {
    cursorIndex = prePangramWords.findIndex((w: any) => w.status === 'pending');
  }

  if (cursorIndex === -1) {
    res.status(400).json({ error: 'No more words to process' });
    return;
  }

  const currentWord = prePangramWords[cursorIndex];

  // Update current word status
  if (action !== 'skip') {
    const statusMap: Record<string, string> = { accept: 'accepted', reject: 'rejected' };
    db.prepare('UPDATE words SET status = ? WHERE id = ?').run(statusMap[action], currentWord.id);
  }

  // Find next pending word
  let nextWord = null;
  for (let i = cursorIndex + 1; i < prePangramWords.length; i++) {
    if (prePangramWords[i].status === 'pending') {
      nextWord = prePangramWords[i];
      break;
    }
  }

  // Update cursor
  const nextCursorId = nextWord ? nextWord.id : null;
  db.prepare('UPDATE days SET backfill_cursor_word_id = ? WHERE id = ?').run(nextCursorId, day.id);

  res.json({
    processed_word: { ...currentWord, status: action === 'skip' ? currentWord.status : (action === 'accept' ? 'accepted' : 'rejected') },
    next_word: nextWord,
    is_complete: !nextWord,
  });
});

// POST /api/days/:date/backfill/complete - transition to new-discovery
router.post('/complete', (req: Request, res: Response) => {
  const db = getDb();
  const day = getDay(param(req.params.date));
  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }

  if (day.current_stage !== 'backfill') {
    res.status(400).json({ error: `Day is in ${day.current_stage} stage, not backfill` });
    return;
  }

  db.prepare(`
    UPDATE days SET current_stage = 'new-discovery', backfill_cursor_word_id = NULL, updated_at = datetime('now')
    WHERE id = ?
  `).run(day.id);

  const updated = db.prepare('SELECT * FROM days WHERE id = ?').get(day.id) as any;
  res.json({
    ...updated,
    letters: JSON.parse(updated.letters),
    genius_achieved: !!updated.genius_achieved,
  });
});

export default router;
