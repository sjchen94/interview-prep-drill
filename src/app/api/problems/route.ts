import { NextResponse } from "next/server";
import { openDb } from "../../../../lib/db";

export function GET() {
  const db = openDb();
  const rows = db
    .prepare(
      `SELECT c.id, c.deck, c.source_path, c.title, c.body_md,
              cs.ef, cs.interval, cs.reps, cs.due_at, cs.last_reviewed_at
       FROM cards c
       LEFT JOIN card_state cs ON cs.card_id = c.id
       ORDER BY c.deck, c.source_path`,
    )
    .all();
  return NextResponse.json(rows);
}
