# Spelling Bee Tracker

An interactive tool for tracking NYT Spelling Bee word discovery, capturing the full ideation chain across three gameplay stages: pre-pangram brainstorming, post-pangram backfill, and new discovery.

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:5173
```

This starts both the Vite dev server (port 5173) and the Express API (port 3141). Vite proxies `/api` requests to Express automatically.

## How It Works

The tracker models three stages per puzzle day:

### Stage 1: Pre-Pangram
Brainstorm words without entering them into the game. Type and hit Enter to build a running list. When you find the pangram, click it (or press `P` on the last word) to transition.

### Stage 2: Backfill
Walk through your pre-pangram list one word at a time, marking each as accepted or rejected by the game. During backfill, entering a word can inspire a new word, which can inspire another — the tracker supports N-depth recursive chains. Rejected words stay in the record with their inspiration links intact.

### Stage 3: New Discovery
Continue finding new words with accept/reject tracking. Toggle scratch mode (`T`) for rapid-fire low-confidence entries.

## Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| Enter | Any (input focused) | Submit word |
| A / R / S | Backfill | Accept / Reject / Skip |
| I | Backfill / New Discovery | Add inspired word |
| Escape | Backfill chain | Pop up one chain level |
| B | Backfill chain | Back to sequential list |
| P | Pre-Pangram | Mark last word as pangram |
| G | Any | Toggle genius |
| T | New Discovery | Toggle scratch mode |
| ? | Any | Show shortcut help |

## Key Features

- **Recursive inspiration chains** — words can inspire other words N levels deep, with full link tracking
- **Attractor detection** — entering a word that already exists logs a reattempt instead of creating a duplicate; words with multiple attempts are flagged as "attractors"
- **Fractional positioning** — inserting between existing words uses fractional positions to avoid renumbering
- **Soft letter validation** — warns about invalid letters but doesn't block submission
- **Session resume** — pick up a partially-completed day where you left off

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Express + better-sqlite3
- **Database:** SQLite (stored in `data/spelling-bee.db`, auto-created on first run)

## API

Base URL: `http://localhost:3141/api`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/days` | GET | List all days |
| `/days` | POST | Create a new day |
| `/days/:date` | GET | Get a day |
| `/days/:date` | PATCH | Update stage, genius, cursor |
| `/days/:date/words` | GET | List words for a day |
| `/days/:date/words` | POST | Add a word (handles reattempts) |
| `/days/:date/words/:id` | PATCH | Update word status/notes/links |
| `/days/:date/words/:id/inspire` | POST | Create inspired word + link |
| `/days/:date/backfill` | GET | Current backfill state |
| `/days/:date/backfill/advance` | POST | Accept/reject/skip current word |
| `/days/:date/backfill/complete` | POST | Transition to new-discovery |
| `/days/:date/attractors` | GET | Words with multiple attempts |
| `/days/:date/export` | GET | Full day data as JSON |

## Data Model

Four SQLite tables:

- **days** — date, letters, center letter, current stage, genius flag
- **words** — word text, position (fractional), stage, status, pangram flag, chain depth
- **word_inspirations** — many-to-many links between words (supports multiple/uncertain sources)
- **word_attempts** — every encounter with a word, including reattempts across stages

## Verification

Run the test script against the 2/9/26 puzzle data (T, I, A, O, L, K, C):

```bash
npm run dev  # in one terminal
npx tsx server/src/seed-test.ts  # in another
```

This validates: word ordering, recursive chains (tick → tock → ticktock), rejected word persistence, pangram-as-inspiration-source, attractor/reattempt behavior, and stage transitions.

## Phase 2 (Not Yet Implemented)

The following endpoints return 501 and are scaffolded for future work:

- **Stats:** words-before-pangram, rejection rates, chain depth, cross-day comparison
- **Inspiration graph:** directed graph visualization of word relationships
- **Attractor analysis:** attempt frequency, heat maps, letter pattern clustering
