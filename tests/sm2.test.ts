import { describe, expect, it } from 'vitest';

import {
  DAY_MS,
  EF_FLOOR,
  EF_INIT,
  initialState,
  review,
  type CardState,
  type Quality,
} from '../lib/sm2.js';

const NOW = 1_700_000_000_000;

describe('SM-2 first review', () => {
  it('q=4 on a new card schedules in 1 day, reps=1, EF unchanged', () => {
    const start = initialState(NOW);
    expect(start).toEqual({
      ef: EF_INIT,
      interval: 0,
      reps: 0,
      due_at_ms: NOW,
      last_reviewed_at_ms: null,
    });

    const next = review(start, 4, NOW);
    expect(next.reps).toBe(1);
    expect(next.interval).toBe(1);
    expect(next.ef).toBeCloseTo(2.5, 10);
    expect(next.due_at_ms).toBe(NOW + DAY_MS);
    expect(next.last_reviewed_at_ms).toBe(NOW);
  });

  it('q=5 on a new card schedules in 1 day and bumps EF by 0.1', () => {
    const next = review(initialState(NOW), 5, NOW);
    expect(next.reps).toBe(1);
    expect(next.interval).toBe(1);
    expect(next.ef).toBeCloseTo(2.6, 10);
  });

  it('second successful review (reps was 1) jumps to 6 days', () => {
    const afterFirst = review(initialState(NOW), 4, NOW);
    const afterSecond = review(afterFirst, 4, NOW + DAY_MS);
    expect(afterSecond.reps).toBe(2);
    expect(afterSecond.interval).toBe(6);
    expect(afterSecond.due_at_ms).toBe(NOW + DAY_MS + 6 * DAY_MS);
  });

  it('third+ successful review multiplies prev interval by current EF', () => {
    let s: CardState = initialState(NOW);
    s = review(s, 5, NOW);                 // reps 0 -> 1, interval 1, EF 2.6
    s = review(s, 5, NOW + DAY_MS);        // reps 1 -> 2, interval 6, EF 2.7
    const before = s;
    s = review(s, 5, NOW + 7 * DAY_MS);    // reps 2 -> 3, interval round(6*2.8)=17
    expect(before.ef).toBeCloseTo(2.7, 10);
    expect(s.ef).toBeCloseTo(2.8, 10);
    expect(s.reps).toBe(3);
    expect(s.interval).toBe(Math.round(6 * 2.8));
  });
});

describe('SM-2 lapses (q < 3)', () => {
  it('q=2 resets reps to 0 and interval to 1, EF still drops', () => {
    let s = initialState(NOW);
    s = review(s, 5, NOW);              // EF 2.6, reps 1, interval 1
    s = review(s, 5, NOW + DAY_MS);     // EF 2.7, reps 2, interval 6
    const beforeLapse = s;

    const lapsed = review(s, 2, NOW + 7 * DAY_MS);
    expect(lapsed.reps).toBe(0);
    expect(lapsed.interval).toBe(1);
    // EF update for q=2: delta = 0.1 - 3*(0.08 + 3*0.02) = -0.32
    expect(lapsed.ef).toBeCloseTo(beforeLapse.ef - 0.32, 10);
    expect(lapsed.due_at_ms).toBe(NOW + 7 * DAY_MS + DAY_MS);
  });

  it('q=0 also resets reps and interval and drops EF the most', () => {
    const s = initialState(NOW);
    const next = review(s, 0, NOW);
    expect(next.reps).toBe(0);
    expect(next.interval).toBe(1);
    // delta for q=0: 0.1 - 5*(0.08 + 5*0.02) = 0.1 - 5*0.18 = -0.8
    // 2.5 - 0.8 = 1.7
    expect(next.ef).toBeCloseTo(1.7, 10);
  });

  it('q=3 still passes (reps increments) but EF dips slightly', () => {
    const s = initialState(NOW);
    const next = review(s, 3, NOW);
    expect(next.reps).toBe(1);
    expect(next.interval).toBe(1);
    // delta for q=3: 0.1 - 2*(0.08 + 2*0.02) = -0.14
    expect(next.ef).toBeCloseTo(2.36, 10);
  });
});

describe('SM-2 EF floor', () => {
  it('repeated lapses cannot push EF below 1.3', () => {
    let s = initialState(NOW);
    let t = NOW;
    for (let i = 0; i < 30; i++) {
      s = review(s, 0, t);
      t += DAY_MS;
    }
    expect(s.ef).toBe(EF_FLOOR);
  });

  it('a single q=0 from EF=1.5 floors at 1.3 (would otherwise be 0.7)', () => {
    const s: CardState = {
      ef: 1.5,
      interval: 10,
      reps: 4,
      due_at_ms: NOW,
      last_reviewed_at_ms: NOW - DAY_MS,
    };
    const next = review(s, 0, NOW);
    expect(next.ef).toBe(EF_FLOOR);
  });
});

describe('SM-2 long sequences', () => {
  it('long all-q=4 streak grows interval roughly geometrically', () => {
    let s = initialState(NOW);
    let t = NOW;
    const intervals: number[] = [];
    for (let i = 0; i < 8; i++) {
      s = review(s, 4, t);
      intervals.push(s.interval);
      t += s.interval * DAY_MS;
    }
    // For q=4, EF stays at 2.5 (delta = 0).
    // Expected sequence: 1, 6, round(6*2.5)=15, round(15*2.5)=38, round(38*2.5)=95, ...
    expect(intervals[0]).toBe(1);
    expect(intervals[1]).toBe(6);
    expect(intervals[2]).toBe(15);
    expect(intervals[3]).toBe(38);
    expect(intervals[4]).toBe(95);
    expect(s.ef).toBeCloseTo(2.5, 10);
  });

  it('rejects out-of-range quality', () => {
    const s = initialState(NOW);
    expect(() => review(s, 6 as Quality, NOW)).toThrow(RangeError);
    expect(() => review(s, -1 as Quality, NOW)).toThrow(RangeError);
    expect(() => review(s, 2.5 as unknown as Quality, NOW)).toThrow(RangeError);
  });
});
