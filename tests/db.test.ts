import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  closeDb,
  computeLeeches,
  deleteReview,
  ensureCardState,
  getCardState,
  isLatestReview,
  openDb,
  recordReview,
  upsertCard,
  writeCardState,
  type LeechReviewRow,
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

  it('isLatestReview/deleteReview support undoing the most recent grade only', () => {
    const db = openDb(dbPath);
    const id = 'blind75/undo-me';
    upsertCard(db, {
      id,
      deck: 'blind75',
      source_path: 'problems/undo-me.md',
      title: 'Undo Me',
      body_md: '...',
    });
    const now = 1_700_000_000_000;
    ensureCardState(db, id, now);

    const first = recordReview(db, { card_id: id, quality: 1, answered_at: now });
    const second = recordReview(db, { card_id: id, quality: 4, answered_at: now + 1000 });

    // The stale (first) review is no longer the latest — must not be undoable.
    expect(isLatestReview(db, id, first)).toBe(false);
    // The most recent review is undoable.
    expect(isLatestReview(db, id, second)).toBe(true);

    deleteReview(db, second);
    const remaining = db
      .prepare(`SELECT id FROM reviews WHERE card_id = ?`)
      .all(id) as Array<{ id: number }>;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe(first);
    // After deleting the second review, the first is once again the latest.
    expect(isLatestReview(db, id, first)).toBe(true);
  });
});

describe('computeLeeches', () => {
  function row(
    card_id: string,
    quality: number,
    overrides: Partial<LeechReviewRow> = {},
  ): LeechReviewRow {
    return {
      card_id,
      quality,
      deck: 'blind75',
      title: `Title for ${card_id}`,
      topic: 'arrays',
      ef: 1.8,
      last_reviewed_at: 1_700_000_000_000,
      ...overrides,
    };
  }

  it('flags a card once lifetime lapses reach the threshold, even if not consecutive', () => {
    // 4 lapses (q<3) interspersed with a couple of good grades — no live streak of 3.
    const rows: LeechReviewRow[] = [
      row('leech-1', 1),
      row('leech-1', 4),
      row('leech-1', 2),
      row('leech-1', 4),
      row('leech-1', 0),
      row('leech-1', 1),
    ];
    const leeches = computeLeeches(rows);
    expect(leeches).toHaveLength(1);
    expect(leeches[0]!.id).toBe('leech-1');
    expect(leeches[0]!.totalLapses).toBe(4);
    expect(leeches[0]!.consecutiveLapses).toBe(2); // last two reviews were lapses
  });

  it('flags a card on a live 3-lapse streak even below the lifetime threshold', () => {
    const rows: LeechReviewRow[] = [
      row('leech-2', 4),
      row('leech-2', 1),
      row('leech-2', 2),
      row('leech-2', 0),
    ];
    const leeches = computeLeeches(rows);
    expect(leeches).toHaveLength(1);
    expect(leeches[0]!.totalLapses).toBe(3);
    expect(leeches[0]!.consecutiveLapses).toBe(3);
  });

  it('does not flag a healthy card with only occasional lapses', () => {
    const rows: LeechReviewRow[] = [
      row('healthy-1', 4),
      row('healthy-1', 1),
      row('healthy-1', 4),
      row('healthy-1', 5),
    ];
    expect(computeLeeches(rows)).toHaveLength(0);
  });

  it('resets the consecutive streak after a passing grade', () => {
    const rows: LeechReviewRow[] = [
      row('recovered-1', 1),
      row('recovered-1', 2),
      row('recovered-1', 3), // streak resets here
      row('recovered-1', 1),
    ];
    const leeches = computeLeeches(rows);
    // 3 total lapses, but consecutive streak is only 1 (the last review) — below both thresholds
    expect(leeches).toHaveLength(0);
  });

  it('sorts worst offenders first (consecutive, then total lapses, then EF)', () => {
    const rows: LeechReviewRow[] = [
      // card A: 3 consecutive lapses (meets consecutive threshold)
      row('a', 1, { ef: 1.5 }),
      row('a', 2, { ef: 1.5 }),
      row('a', 0, { ef: 1.5 }),
      // card B: 4 lifetime lapses but currently on a passing grade (consecutive=0)
      row('b', 1, { ef: 1.3 }),
      row('b', 1, { ef: 1.3 }),
      row('b', 1, { ef: 1.3 }),
      row('b', 1, { ef: 1.3 }),
      row('b', 5, { ef: 1.3 }),
    ];
    const leeches = computeLeeches(rows);
    expect(leeches.map((l) => l.id)).toEqual(['a', 'b']);
  });
});
