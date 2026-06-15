import { NextResponse } from "next/server";
import { openDb } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = openDb();
    const now = Date.now();

    const total = (
      db.prepare("SELECT COUNT(*) as n FROM cards").get() as { n: number }
    ).n;

    const due = (
      db
        .prepare(
          "SELECT COUNT(*) as n FROM card_state WHERE due_at <= ?",
        )
        .get(now) as { n: number }
    ).n;

    const reviewed = (
      db
        .prepare(
          "SELECT COUNT(*) as n FROM card_state WHERE last_reviewed_at IS NOT NULL",
        )
        .get() as { n: number }
    ).n;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const reviewedToday = (
      db
        .prepare(
          "SELECT COUNT(*) as n FROM reviews WHERE answered_at >= ?",
        )
        .get(todayStart.getTime()) as { n: number }
    ).n;

    const byDeck = db
      .prepare(
        `SELECT c.deck, COUNT(*) as total,
                SUM(CASE WHEN cs.due_at <= ? THEN 1 ELSE 0 END) as due
         FROM cards c JOIN card_state cs ON cs.card_id = c.id
         GROUP BY c.deck`,
      )
      .all(now) as Array<{ deck: string; total: number; due: number }>;

    return NextResponse.json({
      total,
      due,
      reviewed,
      reviewedToday,
      byDeck,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
