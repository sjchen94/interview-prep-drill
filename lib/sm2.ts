/**
 * Canonical SM-2 spaced repetition algorithm.
 *
 * Pure function: (state, quality, now?) -> nextState. No side effects.
 *
 * Reference: Wozniak, P.A. (1990). Optimization of repetition spacing in the
 * practice of learning. The version implemented here matches the description
 * widely cited in Anki / SuperMemo write-ups:
 *
 *   EF' = max(1.3, EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
 *
 *   if q < 3:  reps -> 0, interval -> 1 (lapse; EF still drops via the formula)
 *   else:
 *     reps == 0 -> interval = 1
 *     reps == 1 -> interval = 6
 *     reps >= 2 -> interval = round(prevInterval * EF')
 *     reps += 1
 */

export const EF_INIT = 2.5;
export const EF_FLOOR = 1.3;
export const DAY_MS = 24 * 60 * 60 * 1000;

export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

export interface CardState {
  /** Easiness factor. Initial 2.5, floored at 1.3. */
  ef: number;
  /** Current scheduling interval in days. 0 for a never-reviewed card. */
  interval: number;
  /** Successful repetitions in a row. Reset to 0 on a lapse (q < 3). */
  reps: number;
  /** Epoch ms when this card is next due for review. */
  due_at_ms: number;
  /** Epoch ms of the most recent review. null if never reviewed. */
  last_reviewed_at_ms: number | null;
}

export function initialState(now: number = Date.now()): CardState {
  return {
    ef: EF_INIT,
    interval: 0,
    reps: 0,
    due_at_ms: now,
    last_reviewed_at_ms: null,
  };
}

function updateEf(prevEf: number, q: number): number {
  const delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  const next = prevEf + delta;
  return next < EF_FLOOR ? EF_FLOOR : next;
}

export function review(
  state: CardState,
  quality: Quality,
  now: number = Date.now(),
): CardState {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new RangeError(`SM-2 quality must be integer 0..5, got ${quality}`);
  }

  const nextEf = updateEf(state.ef, quality);

  let nextReps: number;
  let nextInterval: number;

  if (quality < 3) {
    nextReps = 0;
    nextInterval = 1;
  } else {
    nextReps = state.reps + 1;
    if (state.reps === 0) {
      nextInterval = 1;
    } else if (state.reps === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(state.interval * nextEf);
    }
  }

  return {
    ef: nextEf,
    interval: nextInterval,
    reps: nextReps,
    due_at_ms: now + nextInterval * DAY_MS,
    last_reviewed_at_ms: now,
  };
}
