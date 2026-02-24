# Spelling Bee Tracker

A desktop app for tracking NYT Spelling Bee word discovery. Captures words as you play — date, letters, pangram marking, and accept/reject with points. Built as an Electron app wrapping Express + React.

## Quick Start

### Desktop App (Electron)

```bash
npm install
npm run build
npm run electron:start
```

### Development

```bash
npm install
npm run dev
# Open http://localhost:5173
```

This starts both the Vite dev server (port 5173) and the Express API (port 3141). Vite proxies `/api` requests to Express automatically.

To run the Electron shell in dev mode (hot-reloading from Vite):

```bash
npm run dev                # Start Vite + Express
npm run electron:dev       # In another terminal — opens the Electron window
```

## How It Works

1. **Create a day** — enter the date, all 7 letters, and the center letter
2. **Add words** — type words into the input field or click the hexagonal beehive to build them letter by letter
3. **Mark results** — click a word to accept (with points), reject, toggle pangram, or delete
4. **Insert anywhere** — hover between words to reveal `[+]` buttons for inserting at a specific position

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Enter | Submit word |
| Escape | Back to day list / cancel action |
| ? | Toggle shortcut help |

## Tech Stack

- **Desktop:** Electron (macOS, wraps Express + serves client build)
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Express + better-sqlite3
- **Database:** SQLite (stored in `data/spelling-bee.db` in dev, `~/Library/Application Support/Spelling Bee Tracker/` in production)

## API

Base URL: `http://localhost:3141/api`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/days` | GET | List all days (with word count, pangram count, total points) |
| `/days` | POST | Create a new day |
| `/days/:date` | GET | Get a day by date |
| `/days/:date` | DELETE | Delete a day (cascades to words) |
| `/days/:date/words` | GET | List words for a day (ordered by position) |
| `/days/:date/words` | POST | Add a word (optional `after_word_id` for insert-at-position) |
| `/days/:date/words/:id` | PATCH | Update status, points, or pangram flag |
| `/days/:date/words/:id` | DELETE | Delete a word |

## Data Model

Two SQLite tables:

- **days** — date (unique), letters (JSON array of 7), center letter
- **words** — word text, fractional position, pangram flag, status (pending/accepted/rejected), points

Duplicate words are allowed — the same word can appear multiple times in a day's list.

## Testing

Run all integration test suites (each gets a fresh database):

```bash
npm run test:fresh
```

Run a single suite:

```bash
./scripts/test-fresh.sh server/src/seed-test.ts
```

Test suites cover: day/word CRUD, fractional positioning, pangram validation, accept/reject with points, cascade delete, error handling, and edge cases.

## Building

```bash
npm run build              # Build client + server for production
npm run electron:build     # Full build + package as macOS DMG
```
