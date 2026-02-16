import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'spelling-bee.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      letters TEXT NOT NULL,
      center_letter TEXT NOT NULL,
      genius_achieved INTEGER DEFAULT 0,
      current_stage TEXT DEFAULT 'pre-pangram'
        CHECK(current_stage IN ('pre-pangram', 'backfill', 'new-discovery')),
      backfill_cursor_word_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_id INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
      word TEXT NOT NULL,
      position REAL NOT NULL,
      stage TEXT NOT NULL CHECK(stage IN ('pre-pangram', 'backfill', 'new-discovery')),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'accepted', 'rejected', 'scratch')),
      is_pangram INTEGER DEFAULT 0,
      inspiration_confidence TEXT DEFAULT NULL
        CHECK(inspiration_confidence IN (NULL, 'certain', 'uncertain')),
      chain_depth INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(day_id, word)
    );

    CREATE TABLE IF NOT EXISTS word_inspirations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      inspired_by_word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      UNIQUE(word_id, inspired_by_word_id)
    );

    CREATE TABLE IF NOT EXISTS word_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      attempted_at TEXT DEFAULT (datetime('now')),
      stage TEXT NOT NULL CHECK(stage IN ('pre-pangram', 'backfill', 'new-discovery')),
      context TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_words_day_position ON words(day_id, position);
    CREATE INDEX IF NOT EXISTS idx_words_day_stage ON words(day_id, stage);
    CREATE INDEX IF NOT EXISTS idx_inspirations_word ON word_inspirations(word_id);
    CREATE INDEX IF NOT EXISTS idx_inspirations_source ON word_inspirations(inspired_by_word_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_word ON word_attempts(word_id);
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
