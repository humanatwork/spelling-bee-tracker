import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router({ mergeParams: true });

function param(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

function getDay(date: string) {
  return getDb().prepare('SELECT * FROM days WHERE date = ?').get(date) as any;
}

function getWordsForDay(dayId: number, day: any) {
  const db = getDb();
  const words = db.prepare(`
    SELECT w.*,
      (SELECT json_group_array(wi.inspired_by_word_id) FROM word_inspirations wi WHERE wi.word_id = w.id) as inspired_by_ids,
      (SELECT COUNT(*) FROM word_attempts wa WHERE wa.word_id = w.id) as attempt_count
    FROM words w WHERE w.day_id = ? ORDER BY w.position
  `).all(dayId);

  return words.map((w: any) => formatWord(w, day));
}

function computeValid(word: string, day: any): boolean {
  const letters: string[] = JSON.parse(day.letters);
  const centerLetter = day.center_letter;
  const wordUpper = word.toUpperCase();
  // Must contain center letter
  if (!wordUpper.includes(centerLetter)) return false;
  // Every character must be in the day's letter set
  for (const ch of wordUpper) {
    if (!letters.includes(ch)) return false;
  }
  return true;
}

function formatWord(w: any, day?: any) {
  const result: any = {
    ...w,
    is_pangram: !!w.is_pangram,
    inspired_by_ids: JSON.parse(w.inspired_by_ids || '[]').filter((id: any) => id !== null),
  };
  if (day) {
    result.valid = computeValid(w.word, day);
  }
  return result;
}

function validatePangram(word: string, day: any): string | null {
  const letters: string[] = JSON.parse(day.letters);
  const wordUpper = word.toUpperCase();
  const missing = letters.filter(l => !wordUpper.includes(l));
  if (missing.length > 0) {
    return `A pangram must use all 7 letters (missing: ${missing.join(', ')})`;
  }
  return null;
}

function getNextPosition(dayId: number): number {
  const db = getDb();
  const result = db.prepare('SELECT MAX(position) as max_pos FROM words WHERE day_id = ?').get(dayId) as any;
  return (result?.max_pos ?? 0) + 1.0;
}

function getPositionAfter(dayId: number, afterWordId: number): number {
  const db = getDb();
  const afterWord = db.prepare('SELECT position FROM words WHERE id = ? AND day_id = ?').get(afterWordId, dayId) as any;
  if (!afterWord) return getNextPosition(dayId);

  const nextWord = db.prepare(
    'SELECT position FROM words WHERE day_id = ? AND position > ? ORDER BY position LIMIT 1'
  ).get(dayId, afterWord.position) as any;

  if (!nextWord) {
    return afterWord.position + 1.0;
  }

  return (afterWord.position + nextWord.position) / 2.0;
}

// GET /api/days/:date/words - list all words for a day
router.get('/', (req: Request, res: Response) => {
  const day = getDay(param(req.params.date));
  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }
  res.json(getWordsForDay(day.id, day));
});

// POST /api/days/:date/words - add a word
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const day = getDay(param(req.params.date));
  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }

  const { word, stage, status, is_pangram, after_word_id, inspired_by, inspiration_confidence, chain_depth, notes } = req.body;

  if (!word) {
    res.status(400).json({ error: 'word is required' });
    return;
  }

  const normalizedWord = word.toUpperCase().trim();

  if (normalizedWord.length < 4) {
    res.status(400).json({ error: 'Word must be at least 4 letters' });
    return;
  }

  const wordStage = stage || day.current_stage;
  const wordStatus = status || (wordStage === 'pre-pangram' ? 'pending' : 'pending');

  // Validate pangram designation
  if (is_pangram) {
    const pangramError = validatePangram(normalizedWord, day);
    if (pangramError) {
      res.status(400).json({ error: pangramError });
      return;
    }
  }

  // Check for existing word (reattempt/attractor logic)
  const existing = db.prepare('SELECT * FROM words WHERE day_id = ? AND word = ?').get(day.id, normalizedWord) as any;
  if (existing) {
    // Log a new attempt
    db.prepare(
      'INSERT INTO word_attempts (word_id, stage, context) VALUES (?, ?, ?)'
    ).run(existing.id, wordStage, req.body.context || null);

    const attemptCount = (db.prepare(
      'SELECT COUNT(*) as count FROM word_attempts WHERE word_id = ?'
    ).get(existing.id) as any).count;

    const result = formatWord(
      db.prepare(`
        SELECT w.*,
          (SELECT json_group_array(wi.inspired_by_word_id) FROM word_inspirations wi WHERE wi.word_id = w.id) as inspired_by_ids,
          (SELECT COUNT(*) FROM word_attempts wa WHERE wa.word_id = w.id) as attempt_count
        FROM words w WHERE w.id = ?
      `).get(existing.id),
      day
    );

    res.status(200).json({ ...result, is_reattempt: true, attempt_count: attemptCount });
    return;
  }

  // Wrap position calculation + insert in a transaction for concurrency safety
  const insertWord = db.transaction(() => {
    const position = after_word_id ? getPositionAfter(day.id, after_word_id) : getNextPosition(day.id);

    const result = db.prepare(`
      INSERT INTO words (day_id, word, position, stage, status, is_pangram, inspiration_confidence, chain_depth, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      day.id, normalizedWord, position, wordStage, wordStatus,
      is_pangram ? 1 : 0,
      inspiration_confidence || null,
      chain_depth || 0,
      notes || null
    );

    const wordId = result.lastInsertRowid as number;

    // Log initial attempt
    db.prepare(
      'INSERT INTO word_attempts (word_id, stage) VALUES (?, ?)'
    ).run(wordId, wordStage);

    // Create inspiration links
    if (inspired_by && Array.isArray(inspired_by)) {
      const insertLink = db.prepare(
        'INSERT OR IGNORE INTO word_inspirations (word_id, inspired_by_word_id) VALUES (?, ?)'
      );
      for (const sourceId of inspired_by) {
        insertLink.run(wordId, sourceId);
      }
    }

    return wordId;
  });

  const wordId = insertWord();

  const newWord = db.prepare(`
    SELECT w.*,
      (SELECT json_group_array(wi.inspired_by_word_id) FROM word_inspirations wi WHERE wi.word_id = w.id) as inspired_by_ids,
      (SELECT COUNT(*) FROM word_attempts wa WHERE wa.word_id = w.id) as attempt_count
    FROM words w WHERE w.id = ?
  `).get(wordId);

  res.status(201).json({ ...formatWord(newWord, day), is_reattempt: false });
});

// PATCH /api/days/:date/words/:id - update a word
router.patch('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const day = getDay(param(req.params.date));
  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }

  const wordId = parseInt(param(req.params.id));
  const existing = db.prepare('SELECT * FROM words WHERE id = ? AND day_id = ?').get(wordId, day.id);
  if (!existing) {
    res.status(404).json({ error: 'Word not found' });
    return;
  }

  // Validate pangram designation
  if (req.body.is_pangram) {
    const word = (existing as any).word;
    const pangramError = validatePangram(word, day);
    if (pangramError) {
      res.status(400).json({ error: pangramError });
      return;
    }
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (req.body.status !== undefined) {
    updates.push('status = ?');
    values.push(req.body.status);
  }
  if (req.body.is_pangram !== undefined) {
    updates.push('is_pangram = ?');
    values.push(req.body.is_pangram ? 1 : 0);
  }
  if (req.body.notes !== undefined) {
    updates.push('notes = ?');
    values.push(req.body.notes);
  }
  if (req.body.inspiration_confidence !== undefined) {
    updates.push('inspiration_confidence = ?');
    values.push(req.body.inspiration_confidence);
  }
  if (req.body.chain_depth !== undefined) {
    updates.push('chain_depth = ?');
    values.push(req.body.chain_depth);
  }

  if (updates.length > 0) {
    values.push(wordId);
    db.prepare(`UPDATE words SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  // Update inspiration links if provided
  if (req.body.inspired_by !== undefined) {
    db.prepare('DELETE FROM word_inspirations WHERE word_id = ?').run(wordId);
    if (Array.isArray(req.body.inspired_by)) {
      const insertLink = db.prepare(
        'INSERT OR IGNORE INTO word_inspirations (word_id, inspired_by_word_id) VALUES (?, ?)'
      );
      for (const sourceId of req.body.inspired_by) {
        insertLink.run(wordId, sourceId);
      }
    }
  }

  const updated = db.prepare(`
    SELECT w.*,
      (SELECT json_group_array(wi.inspired_by_word_id) FROM word_inspirations wi WHERE wi.word_id = w.id) as inspired_by_ids,
      (SELECT COUNT(*) FROM word_attempts wa WHERE wa.word_id = w.id) as attempt_count
    FROM words w WHERE w.id = ?
  `).get(wordId);

  res.json(formatWord(updated, day));
});

// POST /api/days/:date/words/:id/inspire - create an inspired word
router.post('/:id/inspire', (req: Request, res: Response) => {
  const db = getDb();
  const day = getDay(param(req.params.date));
  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }

  const sourceWordId = parseInt(param(req.params.id));
  const sourceWord = db.prepare('SELECT * FROM words WHERE id = ? AND day_id = ?').get(sourceWordId, day.id) as any;
  if (!sourceWord) {
    res.status(404).json({ error: 'Source word not found' });
    return;
  }

  const { word, status, inspiration_confidence, chain_depth } = req.body;
  if (!word) {
    res.status(400).json({ error: 'word is required' });
    return;
  }

  const normalizedWord = word.toUpperCase().trim();

  if (normalizedWord.length < 4) {
    res.status(400).json({ error: 'Word must be at least 4 letters' });
    return;
  }

  // Check for reattempt
  const existing = db.prepare('SELECT * FROM words WHERE day_id = ? AND word = ?').get(day.id, normalizedWord) as any;
  if (existing) {
    db.prepare(
      'INSERT INTO word_attempts (word_id, stage, context) VALUES (?, ?, ?)'
    ).run(existing.id, day.current_stage, `inspired by ${sourceWord.word}`);

    const result = formatWord(
      db.prepare(`
        SELECT w.*,
          (SELECT json_group_array(wi.inspired_by_word_id) FROM word_inspirations wi WHERE wi.word_id = w.id) as inspired_by_ids,
          (SELECT COUNT(*) FROM word_attempts wa WHERE wa.word_id = w.id) as attempt_count
        FROM words w WHERE w.id = ?
      `).get(existing.id),
      day
    );

    res.status(200).json({ ...result, is_reattempt: true });
    return;
  }

  const wordStage = day.current_stage;

  // Wrap position calculation + insert in a transaction for concurrency safety
  const insertInspired = db.transaction(() => {
    const position = getPositionAfter(day.id, sourceWordId);

    const result = db.prepare(`
      INSERT INTO words (day_id, word, position, stage, status, inspiration_confidence, chain_depth)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      day.id, normalizedWord, position, wordStage,
      status || 'pending',
      inspiration_confidence || 'certain',
      chain_depth || (sourceWord.chain_depth + 1)
    );

    const newWordId = result.lastInsertRowid as number;

    // Create inspiration link
    db.prepare(
      'INSERT INTO word_inspirations (word_id, inspired_by_word_id) VALUES (?, ?)'
    ).run(newWordId, sourceWordId);

    // Log initial attempt
    db.prepare(
      'INSERT INTO word_attempts (word_id, stage, context) VALUES (?, ?, ?)'
    ).run(newWordId, wordStage, `inspired by ${sourceWord.word}`);

    return newWordId;
  });

  const newWordId = insertInspired();

  const newWord = db.prepare(`
    SELECT w.*,
      (SELECT json_group_array(wi.inspired_by_word_id) FROM word_inspirations wi WHERE wi.word_id = w.id) as inspired_by_ids,
      (SELECT COUNT(*) FROM word_attempts wa WHERE wa.word_id = w.id) as attempt_count
    FROM words w WHERE w.id = ?
  `).get(newWordId);

  res.status(201).json({ ...formatWord(newWord, day), is_reattempt: false });
});

// GET /api/days/:date/words/:id/attempts - get attempt history
router.get('/:id/attempts', (req: Request, res: Response) => {
  const db = getDb();
  const day = getDay(param(req.params.date));
  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }

  const wordId = parseInt(param(req.params.id));
  const word = db.prepare('SELECT * FROM words WHERE id = ? AND day_id = ?').get(wordId, day.id);
  if (!word) {
    res.status(404).json({ error: 'Word not found' });
    return;
  }

  const attempts = db.prepare(
    'SELECT * FROM word_attempts WHERE word_id = ? ORDER BY attempted_at'
  ).all(wordId);

  res.json(attempts);
});

// GET /api/days/:date/backfill - current backfill state
router.get('/backfill', (req: Request, res: Response) => {
  // Note: this is mounted as a sibling route on the days router since it doesn't
  // have a word :id param. We handle it here for organization.
  res.status(400).json({ error: 'Use GET /api/days/:date/backfill instead' });
});

export default router;
