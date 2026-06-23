import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { EF_INIT, type CardState } from './sm2';

export const DEFAULT_DB_PATH = join(
  homedir(),
  '.openclaw',
  'interview-prep-drill',
  'cards.db',
);

export type Deck = 'blind75' | 'sysdesign' | 'behavioral' | 'ml-infra';

/**
 * Derive a topic tag from a card's source_path.
 * Returns a short slug (e.g. "arrays", "trees", "caching") or null.
 */
export function topicFromSourcePath(sourcePath: string): string | null {
  const p = sourcePath.toLowerCase();
  // blind75 sub-topics
  if (p.includes('/arrays/') || p.includes('/array/')) return 'arrays';
  if (p.includes('/strings/') || p.includes('/string/')) return 'strings';
  if (p.includes('/trees/') || p.includes('/tree/')) return 'trees';
  if (p.includes('/graphs/') || p.includes('/graph/')) return 'graphs';
  if (p.includes('/dp/') || p.includes('/dynamic-programming/')) return 'dp';
  if (p.includes('/linked-list/') || p.includes('/linked_list/')) return 'linked-list';
  if (p.includes('/binary-search/')) return 'binary-search';
  if (p.includes('/heap/')) return 'heap';
  if (p.includes('/trie/')) return 'trie';
  if (p.includes('/backtracking/')) return 'backtracking';
  // sysdesign sub-topics
  if (p.includes('storage') || p.includes('key-value') || p.includes('database')) return 'storage';
  if (p.includes('messaging') || p.includes('notification') || p.includes('queue')) return 'messaging';
  if (p.includes('caching') || p.includes('cache') || p.includes('cdn')) return 'caching';
  if (p.includes('load-balanc') || p.includes('rate-limit') || p.includes('crawler')) return 'load-balancing';
  if (p.includes('chat') || p.includes('feed') || p.includes('twitter') || p.includes('social')) return 'social-feed';
  if (p.includes('ride') || p.includes('autocomplete') || p.includes('search')) return 'search';
  // behavioral
  if (p.includes('behavioral') || p.includes('star')) return 'behavioral';
  // ml-infra sub-topics
  if (p.includes('feature-store') || p.includes('feature_store')) return 'feature-stores';
  if (p.includes('model-serving') || p.includes('model_serving') || p.includes('inference')) return 'model-serving';
  if (p.includes('vector-db') || p.includes('vector_db') || p.includes('vector-search')) return 'vector-dbs';
  if (p.includes('/rag/') || p.includes('retrieval-augmented') || p.includes('retrieval_augmented')) return 'rag';
  if (p.includes('llm-infra') || p.includes('llm_infra') || p.includes('llm-scale') || p.includes('llm-inference')) return 'llm-infra';
  if (p.includes('ml-pipeline') || p.includes('ml_pipeline') || p.includes('training-infra') || p.includes('training_infra')) return 'ml-pipelines';
  if (p.includes('ml-monitoring') || p.includes('model-monitoring') || p.includes('ml-observability')) return 'ml-monitoring';
  if (p.includes('ml-infra') || p.includes('ml_infra')) return 'ml-infra';
  return null;
}

export interface CardRow {
  id: string;
  deck: Deck;
  source_path: string;
  title: string;
  body_md: string;
  created_at: number;
  topic: string | null;
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

  // Migration: add topic column if it doesn't exist yet (safe to run repeatedly)
  const cols = db
    .prepare(`PRAGMA table_info(cards)`)
    .all() as Array<{ name: string }>;
  const hasTopicCol = cols.some((c) => c.name === 'topic');
  if (!hasTopicCol) {
    db.exec(`ALTER TABLE cards ADD COLUMN topic TEXT`);
  }

  // Backfill topic for any rows that are still NULL
  const nullTopicRows = db
    .prepare(`SELECT id, source_path FROM cards WHERE topic IS NULL`)
    .all() as Array<{ id: string; source_path: string }>;
  if (nullTopicRows.length > 0) {
    const updateTopic = db.prepare(`UPDATE cards SET topic = ? WHERE id = ?`);
    const backfill = db.transaction(() => {
      for (const row of nullTopicRows) {
        const topic = topicFromSourcePath(row.source_path);
        if (topic !== null) updateTopic.run(topic, row.id);
      }
    });
    backfill();
  }
}

export interface UpsertCardInput {
  id: string;
  deck: Deck;
  source_path: string;
  title: string;
  body_md: string;
  created_at?: number;
  topic?: string | null;
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
  const topic = input.topic !== undefined ? input.topic : topicFromSourcePath(input.source_path);
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO cards (id, deck, source_path, title, body_md, created_at, topic)
    VALUES (@id, @deck, @source_path, @title, @body_md, @created_at, @topic)
  `);
  const info = stmt.run({ ...input, created_at, topic });
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
