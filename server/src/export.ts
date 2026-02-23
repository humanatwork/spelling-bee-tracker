import fs from 'fs';
import path from 'path';
import { getDb } from './db';

// Resolve to project root (two levels up from server/src/), same as db.ts
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const EXPORTS_DIR = path.join(PROJECT_ROOT, 'data', 'exports');

/**
 * Write a day's full data to data/exports/{date}.json after any mutation.
 * Uses word text (not IDs) for inspiration references so files are human-readable.
 */
export function writeExport(date: string): void {
  const db = getDb();

  const day = db.prepare('SELECT * FROM days WHERE date = ?').get(date) as any;
  if (!day) return;

  // Build a word ID → word text map for resolving inspiration references
  const words = db.prepare(`
    SELECT w.*,
      (SELECT json_group_array(wi.inspired_by_word_id)
       FROM word_inspirations wi WHERE wi.word_id = w.id) as inspired_by_ids
    FROM words w WHERE w.day_id = ? ORDER BY w.position
  `).all(day.id) as any[];

  const idToWord: Record<number, string> = {};
  for (const w of words) {
    idToWord[w.id] = w.word;
  }

  const attempts = db.prepare(`
    SELECT wa.*, w.word FROM word_attempts wa
    JOIN words w ON wa.word_id = w.id
    WHERE w.day_id = ? ORDER BY wa.attempted_at
  `).all(day.id) as any[];

  const exportData = {
    date: day.date,
    letters: JSON.parse(day.letters) as string[],
    center_letter: day.center_letter,
    current_stage: day.current_stage,
    genius_achieved: !!day.genius_achieved,
    words: words.map((w: any) => {
      const inspiredByIds: number[] = JSON.parse(w.inspired_by_ids || '[]').filter((id: any) => id !== null);
      return {
        word: w.word,
        position: w.position,
        stage: w.stage,
        status: w.status,
        is_pangram: !!w.is_pangram,
        chain_depth: w.chain_depth,
        inspiration_confidence: w.inspiration_confidence,
        notes: w.notes,
        inspired_by: inspiredByIds.map((id: number) => idToWord[id]).filter(Boolean),
        created_at: w.created_at,
      };
    }),
    attempts: attempts.map((a: any) => ({
      word: a.word,
      attempted_at: a.attempted_at,
      stage: a.stage,
      context: a.context,
    })),
  };

  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(EXPORTS_DIR, `${date}.json`),
    JSON.stringify(exportData, null, 2) + '\n'
  );
}

/**
 * Remove a day's export file when the day is deleted.
 */
export function removeExport(date: string): void {
  const filePath = path.join(EXPORTS_DIR, `${date}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
