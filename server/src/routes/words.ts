import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router({ mergeParams: true });

function param(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

function getDay(date: string) {
  return getDb().prepare('SELECT * FROM days WHERE date = ?').get(date) as any;
}

function formatWord(w: any) {
  return {
    ...w,
    is_pangram: !!w.is_pangram,
  };
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
  const db = getDb();
  const words = db.prepare('SELECT * FROM words WHERE day_id = ? ORDER BY position').all(day.id);
  res.json(words.map(formatWord));
});

// POST /api/days/:date/words - add a word
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const day = getDay(param(req.params.date));
  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }

  const { word, is_pangram, after_word_id } = req.body;

  if (!word) {
    res.status(400).json({ error: 'word is required' });
    return;
  }

  const normalizedWord = word.toUpperCase().trim();

  if (normalizedWord.length < 4) {
    res.status(400).json({ error: 'Word must be at least 4 letters' });
    return;
  }

  // Validate pangram designation
  if (is_pangram) {
    const pangramError = validatePangram(normalizedWord, day);
    if (pangramError) {
      res.status(400).json({ error: pangramError });
      return;
    }
  }

  // Wrap position calculation + insert in a transaction for concurrency safety
  const insertWord = db.transaction(() => {
    const position = after_word_id ? getPositionAfter(day.id, after_word_id) : getNextPosition(day.id);

    const result = db.prepare(`
      INSERT INTO words (day_id, word, position, is_pangram)
      VALUES (?, ?, ?, ?)
    `).run(day.id, normalizedWord, position, is_pangram ? 1 : 0);

    return result.lastInsertRowid as number;
  });

  const wordId = insertWord();

  const newWord = db.prepare('SELECT * FROM words WHERE id = ?').get(wordId);
  res.status(201).json(formatWord(newWord));
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
    const w = (existing as any).word;
    const pangramError = validatePangram(w, day);
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
  if (req.body.points !== undefined) {
    updates.push('points = ?');
    values.push(req.body.points);
  }

  if (updates.length > 0) {
    values.push(wordId);
    db.prepare(`UPDATE words SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  const updated = db.prepare('SELECT * FROM words WHERE id = ?').get(wordId);
  res.json(formatWord(updated));
});

// DELETE /api/days/:date/words/:id - delete a word
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const day = getDay(param(req.params.date));
  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }

  const wordId = parseInt(param(req.params.id));
  const result = db.prepare('DELETE FROM words WHERE id = ? AND day_id = ?').run(wordId, day.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Word not found' });
    return;
  }
  res.status(204).send();
});

export default router;
