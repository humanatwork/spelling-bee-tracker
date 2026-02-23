/**
 * CLI import script for restoring day data from JSON export files.
 *
 * Usage:
 *   npx tsx server/src/import.ts data/exports/2026-02-09.json   # single file
 *   npx tsx server/src/import.ts data/exports/                  # whole directory
 */

import fs from 'fs';
import path from 'path';
import { getDb, closeDb } from './db';

interface ExportWord {
  word: string;
  position: number;
  stage: string;
  status: string;
  is_pangram: boolean;
  chain_depth: number;
  inspiration_confidence: string | null;
  notes: string | null;
  inspired_by: string[];
  created_at: string;
}

interface ExportAttempt {
  word: string;
  attempted_at: string;
  stage: string;
  context: string | null;
}

interface ExportDay {
  date: string;
  letters: string[];
  center_letter: string;
  current_stage: string;
  genius_achieved: boolean;
  words: ExportWord[];
  attempts: ExportAttempt[];
}

function importFile(filePath: string): boolean {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data: ExportDay = JSON.parse(raw);
  const db = getDb();

  // Skip if day already exists
  const existing = db.prepare('SELECT id FROM days WHERE date = ?').get(data.date);
  if (existing) {
    console.log(`  SKIP: ${data.date} (already exists)`);
    return false;
  }

  const importTransaction = db.transaction(() => {
    // 1. Insert day
    const dayResult = db.prepare(`
      INSERT INTO days (date, letters, center_letter, current_stage, genius_achieved)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      data.date,
      JSON.stringify(data.letters),
      data.center_letter,
      data.current_stage,
      data.genius_achieved ? 1 : 0
    );
    const dayId = dayResult.lastInsertRowid as number;

    // 2. Insert words in position order, building word text → ID map
    const wordTextToId: Record<string, number> = {};
    const insertWord = db.prepare(`
      INSERT INTO words (day_id, word, position, stage, status, is_pangram, chain_depth, inspiration_confidence, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const w of data.words) {
      const result = insertWord.run(
        dayId,
        w.word,
        w.position,
        w.stage,
        w.status,
        w.is_pangram ? 1 : 0,
        w.chain_depth,
        w.inspiration_confidence,
        w.notes,
        w.created_at
      );
      wordTextToId[w.word] = result.lastInsertRowid as number;
    }

    // 3. Insert inspiration links using text references
    const insertLink = db.prepare(
      'INSERT OR IGNORE INTO word_inspirations (word_id, inspired_by_word_id) VALUES (?, ?)'
    );
    for (const w of data.words) {
      if (w.inspired_by && w.inspired_by.length > 0) {
        const wordId = wordTextToId[w.word];
        for (const sourceText of w.inspired_by) {
          const sourceId = wordTextToId[sourceText];
          if (sourceId) {
            insertLink.run(wordId, sourceId);
          } else {
            console.log(`  WARN: ${data.date} — inspiration source "${sourceText}" not found for "${w.word}"`);
          }
        }
      }
    }

    // 4. Insert word attempts using text references
    const insertAttempt = db.prepare(
      'INSERT INTO word_attempts (word_id, attempted_at, stage, context) VALUES (?, ?, ?, ?)'
    );
    for (const a of data.attempts) {
      const wordId = wordTextToId[a.word];
      if (wordId) {
        insertAttempt.run(wordId, a.attempted_at, a.stage, a.context);
      } else {
        console.log(`  WARN: ${data.date} — attempt word "${a.word}" not found`);
      }
    }

    // 5. Set backfill cursor if day was mid-backfill
    if (data.current_stage === 'backfill') {
      // Find the first pending pre-pangram word to set as cursor
      const firstPending = data.words.find(w => w.stage === 'pre-pangram' && w.status === 'pending');
      if (firstPending) {
        const cursorId = wordTextToId[firstPending.word];
        if (cursorId) {
          db.prepare('UPDATE days SET backfill_cursor_word_id = ? WHERE id = ?').run(cursorId, dayId);
        }
      }
    }
  });

  importTransaction();
  console.log(`  OK: ${data.date} imported (${data.words.length} words, ${data.attempts.length} attempts)`);
  return true;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npx tsx server/src/import.ts <file.json | directory>');
    process.exit(1);
  }

  const target = args[0];
  let files: string[] = [];

  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    files = fs.readdirSync(target)
      .filter(f => f.endsWith('.json'))
      .sort()
      .map(f => path.join(target, f));
  } else {
    files = [target];
  }

  if (files.length === 0) {
    console.log('No JSON files found.');
    process.exit(0);
  }

  console.log(`Importing ${files.length} file(s)...\n`);

  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    try {
      if (importFile(file)) {
        imported++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      console.error(`  FAIL: ${file} — ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\nDone: ${imported} imported, ${skipped} skipped.`);
  closeDb();
}

main();
