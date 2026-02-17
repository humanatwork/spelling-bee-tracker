import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

function param(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

// GET /api/days - list all days
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const days = db.prepare(`
    SELECT d.*,
      (SELECT COUNT(*) FROM words w WHERE w.day_id = d.id) as word_count,
      (SELECT COUNT(*) FROM words w WHERE w.day_id = d.id AND w.is_pangram = 1) as pangram_count
    FROM days d ORDER BY d.date DESC
  `).all();

  res.json(days.map(formatDay));
});

// POST /api/days - create a new day
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { date, letters } = req.body;

  if (!date || !letters || !Array.isArray(letters) || letters.length !== 7) {
    res.status(400).json({ error: 'date and letters (array of 7) are required' });
    return;
  }

  const normalizedLetters = letters.map((l: string) => l.toUpperCase());
  const center_letter = normalizedLetters[0];

  // Check for duplicate letters
  const uniqueLetters = new Set(normalizedLetters);
  if (uniqueLetters.size !== 7) {
    res.status(400).json({ error: 'All 7 letters must be unique (duplicate letters found)' });
    return;
  }

  try {
    const result = db.prepare(`
      INSERT INTO days (date, letters, center_letter) VALUES (?, ?, ?)
    `).run(date, JSON.stringify(normalizedLetters), center_letter);

    const day = db.prepare('SELECT * FROM days WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(formatDay(day));
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint')) {
      res.status(409).json({ error: 'Day already exists for this date' });
      return;
    }
    throw e;
  }
});

// GET /api/days/:date - get a single day
router.get('/:date', (req: Request, res: Response) => {
  const db = getDb();
  const day = db.prepare('SELECT * FROM days WHERE date = ?').get(param(req.params.date));

  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }

  res.json(formatDay(day));
});

// PATCH /api/days/:date - update a day
router.patch('/:date', (req: Request, res: Response) => {
  const db = getDb();
  const day = db.prepare('SELECT * FROM days WHERE date = ?').get(param(req.params.date)) as any;

  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (req.body.current_stage !== undefined) {
    const stageOrder: Record<string, number> = {
      'pre-pangram': 0,
      'backfill': 1,
      'new-discovery': 2,
    };
    const currentOrder = stageOrder[day.current_stage];
    const newOrder = stageOrder[req.body.current_stage];
    if (newOrder === undefined) {
      res.status(400).json({ error: `Invalid stage: ${req.body.current_stage}` });
      return;
    }
    if (newOrder < currentOrder) {
      res.status(400).json({ error: `Cannot transition backward from ${day.current_stage} to ${req.body.current_stage}` });
      return;
    }
    if (newOrder > currentOrder + 1) {
      res.status(400).json({ error: `Cannot skip stages: ${day.current_stage} to ${req.body.current_stage}` });
      return;
    }
    // Same stage is a no-op, but we still add the update (harmless)
    updates.push('current_stage = ?');
    values.push(req.body.current_stage);
  }
  if (req.body.genius_achieved !== undefined) {
    updates.push('genius_achieved = ?');
    values.push(req.body.genius_achieved ? 1 : 0);
  }
  if (req.body.backfill_cursor_word_id !== undefined) {
    updates.push('backfill_cursor_word_id = ?');
    values.push(req.body.backfill_cursor_word_id);
  }

  if (updates.length === 0) {
    res.json(formatDay(day));
    return;
  }

  updates.push("updated_at = datetime('now')");
  values.push(day.id);

  db.prepare(`UPDATE days SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM days WHERE id = ?').get(day.id);
  res.json(formatDay(updated));
});

// DELETE /api/days/:date - delete a day
router.delete('/:date', (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM days WHERE date = ?').run(param(req.params.date));
  if (result.changes === 0) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }
  res.status(204).send();
});

// GET /api/days/:date/export - full day data as clean JSON
router.get('/:date/export', (req: Request, res: Response) => {
  const db = getDb();
  const day = db.prepare('SELECT * FROM days WHERE date = ?').get(param(req.params.date)) as any;

  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }

  const words = db.prepare(`
    SELECT w.*,
      (SELECT json_group_array(wi.inspired_by_word_id) FROM word_inspirations wi WHERE wi.word_id = w.id) as inspired_by_ids
    FROM words w WHERE w.day_id = ? ORDER BY w.position
  `).all(day.id);

  const attempts = db.prepare(`
    SELECT wa.* FROM word_attempts wa
    JOIN words w ON wa.word_id = w.id
    WHERE w.day_id = ? ORDER BY wa.attempted_at
  `).all(day.id);

  const letters: string[] = JSON.parse(day.letters);
  const centerLetter = day.center_letter;

  res.json({
    ...formatDay(day),
    words: words.map((w: any) => {
      const wordUpper = (w.word as string).toUpperCase();
      const hasCenterLetter = wordUpper.includes(centerLetter);
      const allLettersValid = [...wordUpper].every(ch => letters.includes(ch));
      return {
        ...w,
        is_pangram: !!w.is_pangram,
        inspired_by_ids: JSON.parse(w.inspired_by_ids).filter((id: any) => id !== null),
        valid: hasCenterLetter && allLettersValid,
      };
    }),
    attempts,
  });
});

// GET /api/days/:date/attractors - words with multiple attempts
router.get('/:date/attractors', (req: Request, res: Response) => {
  const db = getDb();
  const day = db.prepare('SELECT * FROM days WHERE date = ?').get(param(req.params.date)) as any;

  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }

  const attractors = db.prepare(`
    SELECT w.*, COUNT(wa.id) as attempt_count
    FROM words w
    JOIN word_attempts wa ON wa.word_id = w.id
    WHERE w.day_id = ?
    GROUP BY w.id
    HAVING attempt_count > 1
    ORDER BY attempt_count DESC
  `).all(day.id);

  res.json(attractors.map((a: any) => ({
    ...a,
    is_pangram: !!a.is_pangram,
  })));
});

// Phase 2 stubs
router.get('/:date/stats', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Stats not implemented yet (phase 2)' });
});
router.get('/:date/graph', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Graph not implemented yet (phase 2)' });
});

function formatDay(day: any) {
  return {
    ...day,
    letters: JSON.parse(day.letters),
    genius_achieved: !!day.genius_achieved,
  };
}

export default router;
