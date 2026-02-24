# CLAUDE.md

Instructions for Claude Code when working in this repository. Follow these exactly.

## Project Overview

A standalone desktop app for tracking NYT Spelling Bee word discovery. Captures raw word input during gameplay — date, letters, words as they come, pangram marking, and accept/reject with points. Built as an Electron app wrapping Express + React.

## Tech Stack & Structure

Monorepo with npm workspaces + Electron wrapper:

```
spelling-bee-tracker/
├── server/          # Express + better-sqlite3 (port 3141)
│   └── src/
│       ├── index.ts          # App setup, route mounting, static serving
│       ├── db.ts             # SQLite connection singleton, schema
│       ├── seed-test.ts      # Main integration test suite
│       ├── test-helpers.ts   # Shared test utilities
│       └── routes/
│           ├── days.ts       # Day CRUD, list with points
│           └── words.ts      # Word CRUD, positioning, pangram
├── client/          # React 18 + Vite + Tailwind CSS (port 5173)
│   └── src/
│       ├── api.ts            # Typed API client
│       ├── App.tsx           # Router (day list ↔ day page)
│       └── components/
│           ├── DayListPage.tsx     # Day creation & list view
│           ├── DayPage.tsx         # Unified day view (beehive + words)
│           ├── LetterHexagons.tsx  # NYT-style hexagonal beehive
│           ├── WordInput.tsx       # Controlled word input form
│           ├── WordList.tsx        # Word list with insert buttons
│           ├── KeyboardHelp.tsx    # Keyboard shortcuts modal
│           └── Toast.tsx           # Toast notifications
├── electron/        # Electron main process
│   ├── main.ts      # Window creation, Express startup
│   ├── preload.ts   # Preload script (IPC bridge placeholder)
│   └── tsconfig.json
├── refs/            # Spec and sample data (gitignored, not deployed)
└── data/            # SQLite database (gitignored, auto-created)
```

## Development Commands

```bash
npm run dev              # Start both servers (Vite proxies /api → Express)
npm run build            # Production build (client then server)
npm run build -w client  # Build client only
npm run build -w server  # Build server only
npx tsc --noEmit -p server/tsconfig.json  # Type-check server
npx tsc --noEmit -p client/tsconfig.json  # Type-check client
```

### Electron Commands

```bash
npm run electron:dev     # Launch Electron in dev mode (Vite dev server)
npm run electron:build   # Full build + package as macOS DMG
npm run electron:start   # Launch Electron with production build
```

### Running Tests

Run all test suites automatically (each gets a fresh database):

```bash
npm run test:fresh               # Run all test suites
./scripts/test-fresh.sh server/src/seed-test.ts  # Run a single suite
```

Or manually with two terminals:

```bash
rm -rf data/ && npm run dev    # Terminal 1: clean DB + start servers
npx tsx server/src/seed-test.ts  # Terminal 2: run test suite
```

All assertions must pass before any branch is considered merge-ready.

## Git Workflow

### Issue Lifecycle

Every code change maps to a GitHub issue. Follow this end-to-end lifecycle:

1. **Self-assign** — `gh issue edit <N> --add-assignee @me` before starting work
2. **One branch per issue** — branch name mirrors the issue: e.g., `fix/min-word-length-validation` for "Minimum word length violated"
3. **Implement on branch** — commit, type-check, and verify on the feature branch
4. **Create a PR** — use `gh pr create` with `Closes #N` in the body so GitHub auto-closes the issue on merge
5. **Merge via PR** — merge on GitHub (or `git merge --no-ff` locally) so each issue is a distinct merge commit on `main`
6. **Clean up** — delete the local branch (`git branch -d <branch>`), delete the remote branch (`git push origin --delete <branch>`), and verify the issue shows as closed

### Branch-Before-Change Rule

**Never commit directly to `main`.** Always:

1. Create a new branch from `main` before making any changes
2. Make changes on the branch
3. Verify all tests pass
4. Merge to `main` only after verification

### Branch Naming Convention

Use the format `<category>/<short-description>` with kebab-case:

| Category | Use for | Example |
|----------|---------|---------|
| `feat/` | New features or capabilities | `feat/electron-app` |
| `fix/` | Bug fixes | `fix/position-gap` |
| `refactor/` | Code restructuring (no behavior change) | `refactor/simplify-server` |
| `test/` | Adding or improving tests | `test/position-edge-cases` |
| `admin/` | Config, docs, CI, tooling | `admin/claude-md-update` |

### PR Creation

Always create a PR rather than merging locally — PRs provide an audit trail and link to issues.

Use `gh pr create` with a body following this format:

```
## Summary
- <1-3 bullet points describing the change>

## Test plan
- [ ] <verification steps>

Closes #N
```

Include `Closes #N` (or `Fixes #N`) as the last line of the body so GitHub auto-closes the issue when the PR merges.

### Commit Messages

- Use imperative mood: "Add word delete endpoint" not "Added" or "Adds"
- First line: concise summary under 72 characters
- Body (when needed): explain *why*, not *what* — the diff shows what changed
- Always include the `Co-Authored-By` trailer

### Merge Checklist

Before merging any branch to `main`, confirm all of the following:

1. **TypeScript compiles cleanly** — `npx tsc --noEmit` passes for both server and client with zero errors
2. **Vite build succeeds** — `npm run build -w client` produces output without errors
3. **Integration tests pass** — all suites in `npm run test:fresh` pass against a fresh database
4. **No regressions** — if the change touches API routes, manually verify the affected endpoint returns expected data

Do not merge with known failures. If a test needs to be updated because behavior intentionally changed, update the test *in the same branch* before merging.

### Branch Cleanup

Delete feature branches immediately after merge — the merge commit on `main` is the permanent record.

```bash
git branch -d <branch>              # Delete merged local branch
git push origin --delete <branch>   # Delete remote branch
git fetch --prune                   # Clean stale remote refs
git branch --merged main            # List branches safe to delete
```

Never accumulate merged branches. Clean up after every merge.

## Multi-Issue Workflow

When handling multiple GitHub issues in one session, delegate to sub-agents to avoid context window bloat and enable parallel execution.

### When to Delegate

- **1 issue** — implement inline in the main conversation
- **2+ independent issues** (no shared files) — delegate each to a sub-agent, run in parallel
- **2+ issues with shared files** — delegate in dependency order: sequential within conflict groups, parallel across groups

Determine independence by mapping each issue to the files it will touch. If two issues modify the same file, they conflict and must be sequenced.

### Orchestration vs. Implementation

The **parent conversation** orchestrates:
- Analyze issues and map file impacts
- Detect conflicts between issues
- Launch sub-agents (parallel when independent)
- Run `npm run test:fresh` after each sub-agent completes (centralized — only one test server can run at a time on port 3141)
- Merge branches to `main` via PR
- Clean up branches and verify issues are closed

**Sub-agents** implement:
- Read relevant files
- Make code changes
- Type-check (`npx tsc --noEmit`)
- Commit on the feature branch

Sub-agents do **not**: run integration tests, merge to `main`, or modify files outside their assigned scope.

### Sub-Agent Briefing

Sub-agents start with zero context. Every briefing must be self-contained and include:

1. **CLAUDE.md contents** (or the relevant sections) — code conventions, commit message format, Co-Authored-By trailer
2. **Issue description** — copy the full issue body, not just the title
3. **Target files** — list the specific files to read and modify
4. **Branch name** — pre-created by the parent, following the naming convention
5. **Explicit constraints** — no tests, no merging, no out-of-scope edits

### Execution Pattern

```
Parent: analyze issues → group by independence
  │
  ├─ Independent group A ──→ Sub-agent 1 (branch, implement, commit)
  ├─ Independent group B ──→ Sub-agent 2 (branch, implement, commit)
  │
  ├─ Wait for all sub-agents ─→ For each branch:
  │     1. Check out branch
  │     2. npm run test:fresh
  │     3. Create PR with "Closes #N"
  │     4. Merge PR
  │     5. Delete branch (local + remote)
  │
  └─ Final integration test on main
```

### Conflict Resolution

When sub-agent branches conflict at merge time:
- Resolve in the parent context (which has visibility into both sides)
- Re-run `npm run test:fresh` after resolution
- Never force-push or discard changes without understanding the conflict

## Testing Strategy

### Test-Driven Development

When adding new features or fixing bugs:

1. **Write or update the test first** — add assertions to `seed-test.ts` (or a new test file) that describe the expected behavior before writing the implementation
2. **Watch it fail** — run the test to confirm it fails for the right reason
3. **Implement the minimum** — write only enough code to make the test pass
4. **Refactor** — clean up while keeping tests green

### Test Organization

| File | Type | What it covers |
|------|------|----------------|
| `server/src/seed-test.ts` | Integration | Day/word CRUD, positioning, pangram, accept/reject with points, delete, cascade |
| `server/src/test-error-handling.ts` | Integration | 400/404/409 error paths, validation, pangram validation |
| `server/src/test-word-updates.ts` | Integration | PATCH status/points/pangram, normalization, positioning |
| `server/src/test-cascade-and-list.ts` | Integration | Day list ordering/counts/points, cascade delete |
| `server/src/test-position-integrity.ts` | Integration | Fractional positions, 50-deep midpoint stress test |

When adding new test files, follow the same pattern: HTTP requests against the running server, `assert()` with descriptive messages, nonzero exit on failure.

### What Must Be Tested

Every new feature or bug fix should have test coverage for:

- **Happy path** — the expected use case works
- **Edge cases** — empty inputs, boundary values, duplicate data
- **Persistence** — data survives a read-back (no in-memory-only state)
- **Referential integrity** — cascade deletes behave correctly

## Architecture & Design Principles

### Single Responsibility

Each route file owns one resource. Each React component owns one concern:

- `days.ts` handles day-level CRUD — it does not contain word logic
- `words.ts` handles word CRUD, positioning, and pangram validation
- Each React component in `components/` renders one UI element

When a file grows beyond ~300 lines or starts mixing concerns, extract a new module.

### Dependency Inversion

- Route handlers call `getDb()` to get a database connection — they don't construct it
- The client talks to the server exclusively through `api.ts` — components never use `fetch` directly
- If adding a new service (e.g., a validation layer), inject it rather than importing it directly into route handlers

### Interface Segregation

- API responses should return only the fields the client needs — avoid dumping raw DB rows when a subset will do
- React components receive only the props they use — don't pass the entire `Day` object when only `letters` and `center_letter` are needed

### Don't Repeat Yourself

- The `param()` helper in each route file handles Express v5 param typing — if adding a new route file, include it
- `formatWord()` and `formatDay()` are the single source of truth for API response shaping — use them consistently
- Fractional position logic (`getNextPosition`, `getPositionAfter`) lives in `words.ts` — don't reimplement elsewhere

## Key Domain Concepts

**Words are the core unit.** Each day has a list of words ordered by fractional position. Words can be pending, accepted (with points), or rejected.

**Pangrams** use all 7 of the day's letters. Validated server-side on both create and update.

**Fractional positions:** Inserting between position 5.0 and 6.0 assigns 5.5. A `renormalizePositions()` utility should be added if gaps ever become too small (< 0.001).

**Duplicate words are allowed** — the same word can appear multiple times in a day's list (no UNIQUE constraint on day_id + word).

## Data Model

Two SQLite tables:

- **days** — date (unique key), letters (JSON array of 7), center_letter, created_at
- **words** — day_id (FK cascade), word text, fractional position (REAL), is_pangram, status (pending/accepted/rejected), points, created_at

## Code Conventions

- **TypeScript strict mode** in both server and client — no `any` in new code (existing `any` casts in route handlers are tech debt to reduce over time)
- **Words are stored uppercase** — normalize with `.toUpperCase().trim()` at the API boundary, not in the client
- **API responses use camelCase** except for database column names which use snake_case — the `format*` functions handle the translation
- **Tailwind utility classes** for styling — no inline styles, no CSS modules
- **Keyboard shortcuts** documented in `KeyboardHelp.tsx` — update this component when adding new shortcuts

## Reference Documents

The `refs/` directory contains the original spec and sample data. Read these before making design decisions:

- `refs/Spelling_Bee_Tracker_Prompt.md` — Full requirements, data model, and verification criteria
- `refs/Spelling_Bee_Pre-Pangram_First_Words.md` — 11 days of real gameplay data

## Verification

Use the 2/9/26 puzzle data (T, I, A, O, L, K, C) from the sample doc to validate:

1. Day creation with 7 letters and center letter
2. Sequential word entry with correct position ordering
3. Duplicate words create separate entries
4. Pangram marking and validation
5. Accept with points, reject word
6. Insert at position (after specific word)
7. Word and day deletion (cascade)
8. Total points in day list

## Future Features (Not Implemented)

- **Stats:** word count trends, rejection rates, points analysis
- **Attractor analysis:** track which words the user's mind returns to
- **Inspiration graph:** directed graph visualization of word relationships
