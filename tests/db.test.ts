import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  closeDb,
  ensureCardState,
  getCardState,
  openDb,
  recordReview,
  upsertCard,
  writeCardState,
} from '../lib/db.js';
import { initialState, review } from '../lib/sm2.js';

let tmp: string;
let dbPath: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'ipd-db-'));
  dbPath = join(tmp, 'cards.db');
});

afterEach(() => {
  closeDb();
  rmSync(tmp, { recursive: true, force: true });
});

describe('db schema and ingest', () => {
  it('opens, applies WAL, and creates the three tables', () => {
    const db = openDb(dbPath);
    const journal = db.pragma('journal_mode', { simple: true });
    expect(journal).toBe('wal');

    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
      )
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain('cards');
    expect(names).toContain('card_state');
    expect(names).toContain('reviews');
  });

  it('upsertCard is idempotent', () => {
    const db = openDb(dbPath);
    const input = {
      id: 'blind75/two-sum',
      deck: 'blind75' as const,
      source_path: 'problems/two-sum.md',
      title: 'Two Sum',
      body_md: '# Two Sum\n...',
    };
    expect(upsertCard(db, input)).toBe(true);
    expect(upsertCard(db, input)).toBe(false);
    expect(upsertCard(db, { ...input, body_md: 'mutated body' })).toBe(false);

    const row = db
      .prepare(`SELECT body_md FROM cards WHERE id = ?`)
      .get(input.id) as { body_md: string } | undefined;
    // body should be the original — INSERT OR IGNORE leaves existing rows alone
    expect(row?.body_md).toBe('# Two Sum\n...');
  });

  it('ensureCardState creates an initial row once', () => {
    const db = openDb(dbPath);
    upsertCard(db, {
      id: 'blind75/two-sum',
      deck: 'blind75',
      source_path: 'problems/two-sum.md',
      title: 'Two Sum',
      body_md: '...',
    });
    const now = 1_700_000_000_000;
    ensureCardState(db, 'blind75/two-sum', now);
    ensureCardState(db, 'blind75/two-sum', now + 99999);

    const state = getCardState(db, 'blind75/two-sum');
    expect(state).not.toBeNull();
    expect(state!.ef).toBeCloseTo(2.5, 10);
    expect(state!.interval).toBe(0);
    expect(state!.reps).toBe(0);
    expect(state!.due_at).toBe(now); // second call did not overwrite
    expect(state!.last_reviewed_at).toBeNull();
  });

  it('writeCardState upserts and recordReview appends', () => {
    const db = openDb(dbPath);
    const id = 'sysdesign/url-shortener';
    upsertCard(db, {
      id,
      deck: 'sysdesign',
      source_path: 'flashcards/url-shortener.md',
      title: 'Design URL Shortener',
      body_md: '...',
    });
    const now = 1_700_000_000_000;
    ensureCardState(db, id, now);

    const before = initialState(now);
    const after = review(before, 4, now);
    writeCardState(db, id, after);
    const reviewId = recordReview(db, {
      card_id: id,
      quality: 4,
      answered_at: now,
      response_md: 'I would use a base62 encoder...',
      grade_notes: 'Hit the read/write split, missed cache TTL.',
    });
    expect(reviewId).toBeGreaterThan(0);

    const state = getCardState(db, id);
    expect(state!.reps).toBe(1);
    expect(state!.interval).toBe(1);
    expect(state!.last_reviewed_at).toBe(now);

    const reviews = db
      .prepare(`SELECT card_id, quality, response_md FROM reviews WHERE card_id = ?`)
      .all(id) as Array<{ card_id: string; quality: number; response_md: string }>;
    expect(reviews).toHaveLength(1);
    expect(reviews[0]!.quality).toBe(4);
  });
});
