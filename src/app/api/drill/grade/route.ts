import { NextRequest, NextResponse } from "next/server";
import { openDb, writeCardState, recordReview, getCardState } from "../../../../../lib/db";
import { review, type Quality } from "../../../../../lib/sm2";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      card_id: string;
      quality: number;
      response_md?: string;
    };

    const { card_id, quality, response_md } = body;

    if (!card_id || quality === undefined) {
      return NextResponse.json(
        { error: "card_id and quality are required" },
        { status: 400 },
      );
    }

    if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
      return NextResponse.json(
        { error: "quality must be integer 0..5" },
        { status: 400 },
      );
    }

    const db = openDb();
    const existing = getCardState(db, card_id);
    if (!existing) {
      return NextResponse.json({ error: "card not found" }, { status: 404 });
    }

    const state = {
      ef: existing.ef,
      interval: existing.interval,
      reps: existing.reps,
      due_at_ms: existing.due_at,
      last_reviewed_at_ms: existing.last_reviewed_at,
    };

    const nextState = review(state, quality as Quality);
    writeCardState(db, card_id, nextState);
    const reviewId = recordReview(db, {
      card_id,
      quality,
      response_md: response_md ?? null,
    });

    return NextResponse.json({
      reviewId,
      nextState: {
        ef: nextState.ef,
        interval: nextState.interval,
        reps: nextState.reps,
        due_at: nextState.due_at_ms,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
