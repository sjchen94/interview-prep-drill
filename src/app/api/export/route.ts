import { NextResponse } from "next/server";
import { openDb } from "../../../../lib/db";

export const dynamic = "force-dynamic";

/**
 * Full data backup as a downloadable JSON file: every card, its SM-2
 * scheduling state, and the append-only review log. Lets the user keep an
 * off-device snapshot of their progress (the DB otherwise only lives at
 * ~/.openclaw/interview-prep-drill/cards.db).
 */
export function GET() {
  const db = openDb();
  const cards = db
    .prepare(`SELECT id, deck, source_path, title, body_md, created_at, topic FROM cards ORDER BY deck, source_path`)
    .all();
  const cardState = db
    .prepare(`SELECT card_id, ef, interval, reps, due_at, last_reviewed_at FROM card_state`)
    .all();
  const reviews = db
    .prepare(`SELECT id, card_id, quality, answered_at, response_md, grade_notes, hints_used FROM reviews ORDER BY id`)
    .all();

  const payload = {
    exportedAt: new Date().toISOString(),
    counts: { cards: cards.length, reviews: reviews.length },
    cards,
    cardState,
    reviews,
  };

  const filename = `interview-prep-drill-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
