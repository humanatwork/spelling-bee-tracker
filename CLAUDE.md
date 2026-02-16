# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An interactive tool for tracking NYT Spelling Bee word discovery, capturing the full ideation chain across three gameplay stages: pre-pangram brainstorming, post-pangram backfill (entering words into the game), and new discovery. The tool replaces a manual Apple Notes workflow.

## Reference Documents

The `refs/` directory contains the project spec and sample data — read these before making design decisions:

- `refs/Spelling_Bee_Tracker_Prompt.md` — Full requirements, data model, and verification criteria
- `refs/Spelling Bee "Pre-Pangram First" Words.md` — 11 days of real gameplay data showing word ordering patterns, chain behavior, and stage transitions

## Key Domain Concepts

**Three stages per day:** pre-pangram → backfill → new-discovery. The stage determines available actions and how words are tracked.

**Recursive inspiration chains:** During backfill, entering a word can inspire a new word, which can inspire another, N levels deep. The `inspired_by` field is an array supporting multiple and/or uncertain sources. The pangram itself is a node in the inspiration graph, not just a stage boundary.

**Rejected words stay in the record** — they're part of the ideation chain and retain their `inspired_by` links.

**Scratch attempts:** Optional rapid-fire low-confidence entries during new-discovery mode.

## Data Model

Each day is keyed by date + letter set. Word entries track: `word`, `timestamp`, `stage`, `status` (pending/accepted/rejected/scratch), `is_pangram`, `inspired_by` (array of word refs), `inspiration_confidence` (certain/uncertain), `position` (supports insertion), and optional `notes`.

Day-level metadata: `date`, `letters` (7), `center_letter` (first letter), `genius_achieved`, `pangram_words`.

## Architecture Notes

- Storage must support resuming partially-completed days
- Visualization/stats are phase 2 — scaffold interfaces but don't build yet (ideation graph, rejection rates, chain depth, cross-day comparison)
- Flexible insertion: "insert after current" (common) and "insert at position" (occasional)

## Verification

Use the 2/9/26 puzzle data (letters: T, I, A, O, L, K, C) from the sample doc to validate the backfill flow reproduces correct word order. Test recursive chain insertion (e.g., tick → tock → ticktock) and confirm rejected words persist with links intact.
