import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`SMOKE FAIL: ${msg}`);
    process.exit(1);
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'ipd-smoke-'));
const dbPath = join(tmp, 'cards.db');

try {
  const db = openDb(dbPath);

  const id = 'blind75/two-sum';
  const inserted = upsertCard(db, {
    id,
    deck: 'blind75',
    source_path: 'problems/two-sum.md',
    title: 'Two Sum',
    body_md: '# Two Sum\n\nGiven an array of integers...\n',
  });
  assert(inserted, 'first upsertCard should insert');

  const repeat = upsertCard(db, {
    id,
    deck: 'blind75',
    source_path: 'problems/two-sum.md',
    title: 'Two Sum',
    body_md: '# Two Sum\n\nGiven an array of integers...\n',
  });
  assert(repeat === false, 'second upsertCard should be a no-op');

  const now = Date.now();
  ensureCardState(db, id, now);

  const before = getCardState(db, id);
  assert(before !== null, 'card_state row should exist after ensureCardState');
  assert(before!.reps === 0, 'fresh state should have reps=0');

  const next = review(initialState(now), 4, now);
  writeCardState(db, id, next);
  const reviewId = recordReview(db, {
    card_id: id,
    quality: 4,
    answered_at: now,
    response_md: 'used a hashmap',
    grade_notes: 'correct',
  });
  assert(reviewId > 0, 'recordReview returns positive rowid');

  const after = getCardState(db, id);
  assert(after !== null, 'card_state row exists post-review');
  assert(after!.reps === 1, `reps should be 1, got ${after!.reps}`);
  assert(after!.interval === 1, `interval should be 1, got ${after!.interval}`);
  assert(
    after!.last_reviewed_at === now,
    `last_reviewed_at mismatch: ${after!.last_reviewed_at}`,
  );

  const reviewCount = (
    db.prepare(`SELECT COUNT(*) as c FROM reviews WHERE card_id = ?`).get(id) as {
      c: number;
    }
  ).c;
  assert(reviewCount === 1, `expected 1 review row, got ${reviewCount}`);

  closeDb();
  console.log('SMOKE OK');
} finally {
  closeDb();
  rmSync(tmp, { recursive: true, force: true });
}
