import { NextRequest, NextResponse } from "next/server";
import { deleteReview, isLatestReview, openDb, writeCardState } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

interface UndoBody {
  card_id: string;
  review_id: number;
  prev_state: {
    ef: number;
    interval: number;
    reps: number;
    due_at: number;
    last_reviewed_at: number | null;
  };
}

/**
 * Reverts the most recent grade for a card: deletes its review row and
 * restores card_state to the snapshot taken before that grade was applied
 * (returned as `prevState` by POST /api/drill/grade). Only allowed when the
 * review being undone is still the latest one for the card — protects
 * against undoing a stale grade after the card has already been reviewed
 * again (e.g. from another tab/device).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<UndoBody>;
    const { card_id, review_id, prev_state } = body;

    if (!card_id || !review_id || !prev_state) {
      return NextResponse.json(
        { error: "card_id, review_id, and prev_state are required" },
        { status: 400 },
      );
    }

    const db = openDb();

    if (!isLatestReview(db, card_id, review_id)) {
      return NextResponse.json(
        { error: "Can only undo the most recent grade for this card" },
        { status: 409 },
      );
    }

    deleteReview(db, review_id);
    writeCardState(db, card_id, {
      ef: prev_state.ef,
      interval: prev_state.interval,
      reps: prev_state.reps,
      due_at_ms: prev_state.due_at,
      last_reviewed_at_ms: prev_state.last_reviewed_at,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
