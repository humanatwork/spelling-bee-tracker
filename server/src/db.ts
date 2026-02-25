import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Resolve relative to project root (two levels up from server/src/), not process.cwd(),
// so the DB location is the same regardless of how the server is started.
// In Electron production builds, use the app's user data directory.
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
function getDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  if (process.env.ELECTRON_USER_DATA) {
    return path.join(process.env.ELECTRON_USER_DATA, 'spelling-bee.db');
  }
  return path.join(PROJECT_ROOT, 'data', 'spelling-bee.db');
}
const DB_PATH = getDbPath();

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
      inserted_after_word_id INTEGER REFERENCES words(id) ON DELETE SET NULL,
      status_from_word_id INTEGER REFERENCES words(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_words_day_position ON words(day_id, position);

    CREATE TABLE IF NOT EXISTS letter_reorders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_id INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
      letter_order TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrations for existing databases — CREATE TABLE IF NOT EXISTS does not
  // add new columns to tables that already exist.
  migrateSchema(db);
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some(c => c.name === column);
}

function migrateSchema(db: Database.Database): void {
  if (!hasColumn(db, 'words', 'inserted_after_word_id')) {
    db.exec('ALTER TABLE words ADD COLUMN inserted_after_word_id INTEGER REFERENCES words(id) ON DELETE SET NULL');
  }
  if (!hasColumn(db, 'words', 'status_from_word_id')) {
    db.exec('ALTER TABLE words ADD COLUMN status_from_word_id INTEGER REFERENCES words(id) ON DELETE SET NULL');
  }

  // Backfill: mirror existing pending duplicates of already-decided words.
  // Idempotent — only touches rows that are pending with no status_from_word_id.
  db.exec(`
    UPDATE words
    SET status = (
      SELECT w2.status FROM words w2
      WHERE w2.day_id = words.day_id AND w2.word = words.word
        AND w2.status != 'pending' AND w2.status_from_word_id IS NULL AND w2.id != words.id
      LIMIT 1
    ),
    status_from_word_id = (
      SELECT w2.id FROM words w2
      WHERE w2.day_id = words.day_id AND w2.word = words.word
        AND w2.status != 'pending' AND w2.status_from_word_id IS NULL AND w2.id != words.id
      LIMIT 1
    ),
    points = NULL
    WHERE status = 'pending' AND status_from_word_id IS NULL
      AND EXISTS (
        SELECT 1 FROM words w2
        WHERE w2.day_id = words.day_id AND w2.word = words.word
          AND w2.status != 'pending' AND w2.status_from_word_id IS NULL AND w2.id != words.id
      )
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
