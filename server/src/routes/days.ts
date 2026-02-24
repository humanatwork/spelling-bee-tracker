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
      COUNT(w.id) as word_count,
      SUM(CASE WHEN w.is_pangram = 1 THEN 1 ELSE 0 END) as pangram_count,
      COALESCE(SUM(CASE WHEN w.status = 'accepted' THEN w.points ELSE 0 END), 0) as total_points
    FROM days d LEFT JOIN words w ON w.day_id = d.id
    GROUP BY d.id ORDER BY d.date DESC
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

// POST /api/days/:date/reorder - reorder letters and track the change
router.post('/:date/reorder', (req: Request, res: Response) => {
  const db = getDb();
  const date = param(req.params.date);
  const { letters } = req.body;

  // Validate letters is an array of 7 strings
  if (!letters || !Array.isArray(letters) || letters.length !== 7 ||
      !letters.every((l: unknown) => typeof l === 'string')) {
    res.status(400).json({ error: 'letters must be an array of 7 strings' });
    return;
  }

  const day = db.prepare('SELECT * FROM days WHERE date = ?').get(date) as Record<string, unknown> | undefined;
  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }

  const normalizedNew = (letters as string[]).map((l: string) => l.toUpperCase().trim());
  const dayLetters = JSON.parse(day.letters as string) as string[];

  // Center letter must remain at index 0
  if (normalizedNew[0] !== day.center_letter) {
    res.status(400).json({ error: 'Center letter must remain at index 0' });
    return;
  }

  // Must be the same set of letters
  const sortedExisting = [...dayLetters].sort().join(',');
  const sortedNew = [...normalizedNew].sort().join(',');
  if (sortedExisting !== sortedNew) {
    res.status(400).json({ error: 'Reordered letters must be the same set as the original' });
    return;
  }

  // Update the day's letters column
  db.prepare('UPDATE days SET letters = ? WHERE id = ?')
    .run(JSON.stringify(normalizedNew), day.id as number);

  // Record the reorder in history
  db.prepare('INSERT INTO letter_reorders (day_id, letter_order) VALUES (?, ?)')
    .run(day.id as number, JSON.stringify(normalizedNew));

  const updated = db.prepare('SELECT * FROM days WHERE id = ?').get(day.id as number);
  res.json(formatDay(updated));
});

// DELETE /api/days/:date - delete a day
router.delete('/:date', (req: Request, res: Response) => {
  const db = getDb();
  const date = param(req.params.date);
  const result = db.prepare('DELETE FROM days WHERE date = ?').run(date);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }
  res.status(204).send();
});

function formatDay(day: any) {
  return {
    ...day,
    letters: JSON.parse(day.letters),
  };
}

export default router;
