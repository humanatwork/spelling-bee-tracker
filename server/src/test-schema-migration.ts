/**
 * Schema migration test — verifies that existing databases (created before
 * new columns were added) are upgraded correctly at startup.
 *
 * Creates a SQLite database with the OLD schema (no inserted_after_word_id,
 * no letter_reorders), seeds it with data, then triggers initSchema + migrateSchema
 * via getDb(). Verifies the column is added and existing data is preserved.
 *
 * Uses its own isolated DB path to avoid interfering with other test suites.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Set DB_PATH to an isolated temp path BEFORE importing db module
const MIGRATION_DB_PATH = path.join(__dirname, '..', '..', 'data', 'migration-test.db');
process.env.DB_PATH = MIGRATION_DB_PATH;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`  OK: ${msg}`);
}

function cleanup() {
  for (const suffix of ['', '-wal', '-shm']) {
    const p = MIGRATION_DB_PATH + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

async function main() {
  console.log('=== Schema Migration Tests ===\n');

  cleanup();

  // 1. Create a database with the OLD schema (no inserted_after_word_id, no letter_reorders)
  console.log('1. Creating database with old schema...');
  fs.mkdirSync(path.dirname(MIGRATION_DB_PATH), { recursive: true });

  const oldDb = new Database(MIGRATION_DB_PATH);
  oldDb.pragma('journal_mode = WAL');
  oldDb.pragma('foreign_keys = ON');
  oldDb.exec(`
    CREATE TABLE days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      letters TEXT NOT NULL,
      center_letter TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_id INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
      word TEXT NOT NULL,
      position REAL NOT NULL,
      is_pangram INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'accepted', 'rejected')),
      points INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX idx_words_day_position ON words(day_id, position);
  `);

  // Seed data
  oldDb.prepare('INSERT INTO days (date, letters, center_letter) VALUES (?, ?, ?)')
    .run('2026-02-09', JSON.stringify(['T', 'I', 'A', 'O', 'L', 'K', 'C']), 'T');
  oldDb.prepare('INSERT INTO words (day_id, word, position, is_pangram) VALUES (?, ?, ?, ?)')
    .run(1, 'TICK', 1.0, 0);
  oldDb.prepare('INSERT INTO words (day_id, word, position, is_pangram) VALUES (?, ?, ?, ?)')
    .run(1, 'TOCK', 2.0, 0);

  // Verify old schema does NOT have the new column
  const oldCols = oldDb.prepare('PRAGMA table_info(words)').all() as Array<{ name: string }>;
  assert(
    !oldCols.some(c => c.name === 'inserted_after_word_id'),
    'Old schema does NOT have inserted_after_word_id column'
  );

  // Verify letter_reorders table does NOT exist
  const oldTables = oldDb.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='letter_reorders'"
  ).all();
  assert(oldTables.length === 0, 'Old schema does NOT have letter_reorders table');

  oldDb.close();
  assert(true, 'Old database created and seeded');

  // 2. Import db module — getDb() triggers initSchema + migrateSchema
  console.log('\n2. Running migration via getDb()...');
  const { getDb, closeDb } = await import('./db');
  const db = getDb();

  // 3. Verify the column was added
  console.log('\n3. Verifying migration results...');
  const newCols = db.prepare('PRAGMA table_info(words)').all() as Array<{ name: string }>;
  assert(
    newCols.some(c => c.name === 'inserted_after_word_id'),
    'Migration added inserted_after_word_id column'
  );

  // Verify letter_reorders table was created
  const newTables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='letter_reorders'"
  ).all();
  assert(newTables.length === 1, 'Migration created letter_reorders table');

  // 4. Verify existing data is preserved
  console.log('\n4. Verifying existing data preserved...');
  const words = db.prepare('SELECT * FROM words ORDER BY position').all() as Array<{
    id: number;
    word: string;
    inserted_after_word_id: number | null;
  }>;
  assert(words.length === 2, 'Existing words preserved (2 words)');
  assert(words[0].word === 'TICK', 'First word is TICK');
  assert(words[1].word === 'TOCK', 'Second word is TOCK');
  assert(words[0].inserted_after_word_id === null, 'Existing word has null inserted_after_word_id');

  // 5. Verify INSERT with new column works on migrated DB
  console.log('\n5. Verifying INSERT with new column on migrated DB...');
  db.prepare(`
    INSERT INTO words (day_id, word, position, is_pangram, inserted_after_word_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(1, 'TOIL', 1.5, 0, words[0].id);

  const toil = db.prepare('SELECT * FROM words WHERE word = ?').get('TOIL') as {
    inserted_after_word_id: number | null;
  };
  assert(toil.inserted_after_word_id === words[0].id, 'New word can reference inserted_after_word_id');

  // 6. Verify migration is idempotent (running again does not crash or duplicate)
  console.log('\n6. Verifying migration is idempotent...');
  closeDb();
  const db2 = getDb(); // triggers initSchema + migrateSchema again
  const cols2 = db2.prepare('PRAGMA table_info(words)').all() as Array<{ name: string }>;
  const colCount = cols2.filter(c => c.name === 'inserted_after_word_id').length;
  assert(colCount === 1, 'Migration is idempotent (column exists exactly once)');

  closeDb();
  cleanup();
  console.log('\n=== ALL MIGRATION TESTS PASSED ===');
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
