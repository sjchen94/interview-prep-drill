import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { EF_INIT, type CardState } from './sm2.js';

export const DEFAULT_DB_PATH = join(
  homedir(),
  '.openclaw',
  'interview-prep-drill',
  'cards.db',
);

export type Deck = 'blind75' | 'sysdesign';

export interface CardRow {
  id: string;
  deck: Deck;
  source_path: string;
  title: string;
  body_md: string;
  created_at: number;
}

export interface CardStateRow {
  card_id: string;
  ef: number;
  interval: number;
  reps: number;
  due_at: number;
  last_reviewed_at: number | null;
}

export interface ReviewRow {
  id: number;
  card_id: string;
  quality: number;
  answered_at: number;
  response_md: string | null;
  grade_notes: string | null;
}

let cached: Database.Database | null = null;
let cachedPath: string | null = null;

export function openDb(path: string = DEFAULT_DB_PATH): Database.Database {
  if (cached && cachedPath === path) return cached;
  if (cached && cachedPath !== path) {
    cached.close();
    cached = null;
    cachedPath = null;
  }

  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  applySchema(db);

  cached = db;
  cachedPath = path;
  return db;
}

export function closeDb(): void {
  if (cached) {
    cached.close();
    cached = null;
    cachedPath = null;
  }
}

function applySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id          TEXT PRIMARY KEY,
      deck        TEXT NOT NULL,
      source_path TEXT NOT NULL,
      title       TEXT NOT NULL,
      body_md     TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS card_state (
      card_id          TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
      ef               REAL    NOT NULL,
      interval         INTEGER NOT NULL,
      reps             INTEGER NOT NULL,
      due_at           INTEGER NOT NULL,
      last_reviewed_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_card_state_due_at ON card_state(due_at);

    CREATE TABLE IF NOT EXISTS reviews (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id     TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      quality     INTEGER NOT NULL,
      answered_at INTEGER NOT NULL,
      response_md TEXT,
      grade_notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_card_id ON reviews(card_id);
  `);
}

export interface UpsertCardInput {
  id: string;
  deck: Deck;
  source_path: string;
  title: string;
  body_md: string;
  created_at?: number;
}

/**
 * Idempotent insert. If a card with the same id already exists, no fields
 * are mutated. Returns true if a new row was inserted, false if it existed.
 */
export function upsertCard(
  db: Database.Database,
  input: UpsertCardInput,
): boolean {
  const created_at = input.created_at ?? Date.now();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO cards (id, deck, source_path, title, body_md, created_at)
    VALUES (@id, @deck, @source_path, @title, @body_md, @created_at)
  `);
  const info = stmt.run({ ...input, created_at });
  return info.changes === 1;
}

/**
 * Initialize an SM-2 row for a card if one does not exist. Idempotent.
 * Initial state: EF=2.5, interval=0, reps=0, due now (i.e., immediately due).
 */
export function ensureCardState(
  db: Database.Database,
  cardId: string,
  now: number = Date.now(),
): void {
  db.prepare(`
    INSERT OR IGNORE INTO card_state
      (card_id, ef, interval, reps, due_at, last_reviewed_at)
    VALUES (?, ?, 0, 0, ?, NULL)
  `).run(cardId, EF_INIT, now);
}

export function getCardState(
  db: Database.Database,
  cardId: string,
): CardStateRow | null {
  const row = db
    .prepare(
      `SELECT card_id, ef, interval, reps, due_at, last_reviewed_at
       FROM card_state WHERE card_id = ?`,
    )
    .get(cardId) as CardStateRow | undefined;
  return row ?? null;
}

export function writeCardState(
  db: Database.Database,
  cardId: string,
  state: CardState,
): void {
  db.prepare(`
    INSERT INTO card_state (card_id, ef, interval, reps, due_at, last_reviewed_at)
    VALUES (@card_id, @ef, @interval, @reps, @due_at, @last_reviewed_at)
    ON CONFLICT(card_id) DO UPDATE SET
      ef               = excluded.ef,
      interval         = excluded.interval,
      reps             = excluded.reps,
      due_at           = excluded.due_at,
      last_reviewed_at = excluded.last_reviewed_at
  `).run({
    card_id: cardId,
    ef: state.ef,
    interval: state.interval,
    reps: state.reps,
    due_at: state.due_at_ms,
    last_reviewed_at: state.last_reviewed_at_ms,
  });
}

export interface RecordReviewInput {
  card_id: string;
  quality: number;
  answered_at?: number;
  response_md?: string | null;
  grade_notes?: string | null;
}

export function recordReview(
  db: Database.Database,
  input: RecordReviewInput,
): number {
  const answered_at = input.answered_at ?? Date.now();
  const info = db.prepare(`
    INSERT INTO reviews (card_id, quality, answered_at, response_md, grade_notes)
    VALUES (@card_id, @quality, @answered_at, @response_md, @grade_notes)
  `).run({
    card_id: input.card_id,
    quality: input.quality,
    answered_at,
    response_md: input.response_md ?? null,
    grade_notes: input.grade_notes ?? null,
  });
  return Number(info.lastInsertRowid);
}
