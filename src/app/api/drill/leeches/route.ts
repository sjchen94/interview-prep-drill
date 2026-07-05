import { NextResponse } from "next/server";
import { computeLeeches, openDb, type LeechReviewRow } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

/**
 * Surfaces "leech" cards — problems that keep coming back despite repeated
 * drilling. See lib/db.ts `computeLeeches` for the aggregation rules
 * (lifetime lapse threshold + consecutive-lapse streak).
 */
export async function GET() {
  try {
    const db = openDb();

    // Pull every review, oldest-first per card, joined with card/state info
    // so computeLeeches can derive lifetime + consecutive lapse counts.
    const rows = db
      .prepare(
        `SELECT r.card_id, r.quality,
                c.deck, c.title, c.topic,
                cs.ef, cs.last_reviewed_at
         FROM reviews r
         JOIN cards c ON c.id = r.card_id
         JOIN card_state cs ON cs.card_id = r.card_id
         ORDER BY r.card_id, r.answered_at ASC`,
      )
      .all() as LeechReviewRow[];

    const leeches = computeLeeches(rows);

    return NextResponse.json({ leeches });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
