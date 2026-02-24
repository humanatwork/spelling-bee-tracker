import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Resolve relative to project root (two levels up from server/src/), not process.cwd(),
// so the DB location is the same regardless of how the server is started.
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DB_PATH = process.env.DB_PATH || path.join(PROJECT_ROOT, 'data', 'spelling-bee.db');

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
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS words (
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

    CREATE INDEX IF NOT EXISTS idx_words_day_position ON words(day_id, position);
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
