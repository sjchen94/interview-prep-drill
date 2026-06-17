import { NextResponse } from "next/server";
import { openDb } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

interface DailyCount {
  date: string; // ISO date "YYYY-MM-DD"
  count: number;
}

interface EfBucket {
  label: string;
  count: number;
}

interface TopicStat {
  label: string;
  avgQuality: number;
  reviewCount: number;
  avgInterval: number;
}

export interface AnalyticsPayload {
  /** Daily review counts for last 14 days (oldest first) */
  dailyCounts: DailyCount[];
  /** Current daily streak (consecutive days with >= 1 review) */
  streakDays: number;
  /** Best daily streak ever */
  bestStreakDays: number;
  /** Distribution of easiness-factor buckets across all cards with state */
  efDistribution: EfBucket[];
  /** Per-topic stats: avg grade + avg interval, sorted by avgQuality asc */
  topicStats: TopicStat[];
  /** Lifetime review count */
  totalReviews: number;
  /** Cards whose interval >= 21 days (well-learned) */
  masteredCount: number;
}

/**
 * Returns analytics data used by the AnalyticsPanel component:
 * - 14-day daily review history
 * - streak tracking
 * - EF distribution
 * - per-topic performance with average interval
 */
export async function GET() {
  try {
    const db = openDb();

    // ——— Total reviews ———
    const totalReviews = (
      db.prepare("SELECT COUNT(*) as n FROM reviews").get() as { n: number }
    ).n;

    // ——— Mastered cards (interval >= 21 days) ———
    const masteredCount = (
      db
        .prepare("SELECT COUNT(*) as n FROM card_state WHERE interval >= 21")
        .get() as { n: number }
    ).n;

    // ——— 14-day daily counts ———
    // Pull all reviews from the last 14 days, bucket by local calendar date.
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const recentReviews = db
      .prepare(
        "SELECT answered_at FROM reviews WHERE answered_at >= ? ORDER BY answered_at ASC",
      )
      .all(fourteenDaysAgo) as Array<{ answered_at: number }>;

    // Build a map date-string → count
    const countMap = new Map<string, number>();
    for (const row of recentReviews) {
      const d = new Date(row.answered_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    // Fill in all 14 days (0 for days with no reviews)
    const dailyCounts: DailyCount[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      dailyCounts.push({ date: key, count: countMap.get(key) ?? 0 });
    }

    // ——— Current streak ———
    let streakDays = 0;
    for (let i = dailyCounts.length - 1; i >= 0; i--) {
      if (dailyCounts[i].count > 0) {
        streakDays++;
      } else if (i === dailyCounts.length - 1) {
        // Today has no reviews yet — don't break the streak if yesterday does
        continue;
      } else {
        break;
      }
    }

    // ——— Best streak (scan all reviews) ———
    const allDatesRaw = db
      .prepare(
        "SELECT DISTINCT date(answered_at / 1000, 'unixepoch', 'localtime') as d FROM reviews ORDER BY d ASC",
      )
      .all() as Array<{ d: string }>;

    let bestStreak = 0;
    let runStreak = 0;
    let prevDate: Date | null = null;
    for (const { d } of allDatesRaw) {
      const curr = new Date(d);
      if (prevDate !== null) {
        const diff = Math.round(
          (curr.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000),
        );
        if (diff === 1) {
          runStreak++;
        } else {
          runStreak = 1;
        }
      } else {
        runStreak = 1;
      }
      if (runStreak > bestStreak) bestStreak = runStreak;
      prevDate = curr;
    }

    // ——— EF Distribution ———
    const efRows = db
      .prepare("SELECT ef FROM card_state")
      .all() as Array<{ ef: number }>;

    const efBuckets: Record<string, number> = {
      "1.3–1.7": 0,
      "1.7–2.1": 0,
      "2.1–2.5": 0,
      "2.5–2.9": 0,
      "2.9–3.3": 0,
      "3.3+": 0,
    };
    for (const { ef } of efRows) {
      if (ef < 1.7) efBuckets["1.3–1.7"]++;
      else if (ef < 2.1) efBuckets["1.7–2.1"]++;
      else if (ef < 2.5) efBuckets["2.1–2.5"]++;
      else if (ef < 2.9) efBuckets["2.5–2.9"]++;
      else if (ef < 3.3) efBuckets["2.9–3.3"]++;
      else efBuckets["3.3+"]++;
    }

    const efDistribution: EfBucket[] = Object.entries(efBuckets).map(
      ([label, count]) => ({ label, count }),
    );

    // ——— Per-topic stats ———
    const topicRows = db
      .prepare(
        `SELECT c.topic, c.deck,
                AVG(r.quality) as avgQuality,
                COUNT(r.id) as reviewCount,
                AVG(cs.interval) as avgInterval
         FROM reviews r
         JOIN cards c ON c.id = r.card_id
         JOIN card_state cs ON cs.card_id = c.id
         WHERE c.topic IS NOT NULL
         GROUP BY c.topic, c.deck
         HAVING reviewCount >= 2
         ORDER BY avgQuality ASC
         LIMIT 10`,
      )
      .all() as Array<{
      topic: string;
      deck: string;
      avgQuality: number;
      reviewCount: number;
      avgInterval: number;
    }>;

    const TOPIC_LABELS: Record<string, string> = {
      arrays: "Arrays",
      strings: "Strings",
      trees: "Trees",
      graphs: "Graphs",
      dp: "Dynamic Programming",
      "linked-list": "Linked Lists",
      "binary-search": "Binary Search",
      heap: "Heaps",
      trie: "Tries",
      backtracking: "Backtracking",
      storage: "Storage / DBs",
      messaging: "Messaging / Queues",
      caching: "Caching / CDN",
      "load-balancing": "Load Balancing",
      "social-feed": "Social / Feed",
      search: "Search / Autocomplete",
      behavioral: "Behavioral",
    };

    const topicStats: TopicStat[] = topicRows.map((r) => ({
      label: TOPIC_LABELS[r.topic] ?? r.topic,
      avgQuality: r.avgQuality,
      reviewCount: r.reviewCount,
      avgInterval: r.avgInterval,
    }));

    const payload: AnalyticsPayload = {
      dailyCounts,
      streakDays,
      bestStreakDays: bestStreak,
      efDistribution,
      topicStats,
      totalReviews,
      masteredCount,
    };

    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
