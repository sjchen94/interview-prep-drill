import { NextResponse } from "next/server";
import { openDb } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

interface WeakSpot {
  deck: string;
  topic: string | null;
  avgQuality: number;
  reviewCount: number;
  label: string;
}

/**
 * Returns top 5 weakest areas by average grade over the last 30 reviews.
 * Groups by (deck, topic) when topic data is available, falling back to deck.
 * Lower avgQuality = weaker.
 */
export async function GET() {
  try {
    const db = openDb();

    // Fetch the last 30 reviews joined with card deck + topic info
    const rows = db
      .prepare(
        `SELECT c.deck, c.topic, r.quality
         FROM reviews r
         JOIN cards c ON c.id = r.card_id
         ORDER BY r.answered_at DESC
         LIMIT 30`,
      )
      .all() as Array<{ deck: string; topic: string | null; quality: number }>;

    if (rows.length === 0) {
      return NextResponse.json({ weakSpots: [] });
    }

    // Aggregate per (deck, topic) — use topic when available, else deck as key
    const groupMap = new Map<string, { deck: string; topic: string | null; total: number; count: number }>();
    for (const row of rows) {
      const key = row.topic ? `${row.deck}::${row.topic}` : row.deck;
      const existing = groupMap.get(key) ?? { deck: row.deck, topic: row.topic ?? null, total: 0, count: 0 };
      groupMap.set(key, {
        ...existing,
        total: existing.total + row.quality,
        count: existing.count + 1,
      });
    }

    const weakSpots: WeakSpot[] = Array.from(groupMap.values())
      .map(({ deck, topic, total, count }) => ({
        deck,
        topic,
        avgQuality: total / count,
        reviewCount: count,
        label: spotLabel(deck, topic),
      }))
      .sort((a, b) => a.avgQuality - b.avgQuality)
      .slice(0, 5);

    return NextResponse.json({ weakSpots });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function spotLabel(deck: string, topic: string | null): string {
  if (topic) {
    const topicLabels: Record<string, string> = {
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
      storage: "Storage / Databases",
      messaging: "Messaging / Queues",
      caching: "Caching / CDN",
      "load-balancing": "Load Balancing",
      "social-feed": "Social / Feed Design",
      search: "Search / Autocomplete",
      behavioral: "Behavioral (STAR)",
    };
    const tLabel = topicLabels[topic] ?? topic;
    const dLabel = deck === "blind75" ? "Algo" : deck === "sysdesign" ? "SysDesign" : deck;
    return `${dLabel} › ${tLabel}`;
  }
  if (deck === "blind75") return "Blind 75 (Algorithms)";
  if (deck === "sysdesign") return "System Design";
  return deck;
}
