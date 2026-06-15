import { NextResponse } from "next/server";
import { openDb } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

const MASTERED_EASY_THRESHOLD = 3;
const AUDIT_CHANCE = 0.10;
const VALID_DECKS = new Set(["blind75", "sysdesign"]);

type CardRow = {
  id: string;
  deck: string;
  title: string;
  body_md: string;
  ef: number;
  interval: number;
  reps: number;
  due_at: number;
  last_reviewed_at: number | null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawDeck = searchParams.get("deck") ?? "all";
    const deck = VALID_DECKS.has(rawDeck) ? rawDeck : null; // null = all decks

    const db = openDb();
    const now = Date.now();
    const deckClause = deck ? "AND c.deck = ?" : "";
    const withDeck = <T>(base: T[]) => (deck ? ([...base, deck] as [...T[], string]) : base);

    const countDue = () =>
      (
        db
          .prepare(
            `SELECT COUNT(*) as n FROM card_state cs JOIN cards c ON c.id = cs.card_id WHERE cs.due_at <= ? ${deckClause}`,
          )
          .get(...withDeck([now])) as { n: number }
      ).n;

    const countTotal = () =>
      (
        db
          .prepare(`SELECT COUNT(*) as n FROM cards${deck ? " WHERE deck = ?" : ""}`)
          .get(...(deck ? [deck] : [])) as { n: number }
      ).n;

    // Mastered-card audit: 10% chance to resurface a well-known card
    if (Math.random() < AUDIT_CHANCE) {
      const masteredRow = db
        .prepare(
          `SELECT c.id, c.deck, c.title, c.body_md,
                  cs.ef, cs.interval, cs.reps, cs.due_at, cs.last_reviewed_at
           FROM cards c
           JOIN card_state cs ON cs.card_id = c.id
           WHERE cs.due_at > ? ${deckClause}
             AND (
               SELECT COUNT(*) FROM reviews r
               WHERE r.card_id = c.id AND r.quality = 5
             ) >= ?
           ORDER BY RANDOM()
           LIMIT 1`,
        )
        .get(...withDeck([now]), MASTERED_EASY_THRESHOLD) as CardRow | undefined;

      if (masteredRow) {
        return NextResponse.json({
          card: { ...masteredRow, overdue: false, audit: true },
          dueCount: countDue(),
          totalCards: countTotal(),
        });
      }
    }

    // Normal: pick earliest due card
    const row = db
      .prepare(
        `SELECT c.id, c.deck, c.title, c.body_md,
                cs.ef, cs.interval, cs.reps, cs.due_at, cs.last_reviewed_at
         FROM cards c
         JOIN card_state cs ON cs.card_id = c.id
         WHERE cs.due_at <= ? ${deckClause}
         ORDER BY cs.due_at ASC
         LIMIT 1`,
      )
      .get(...withDeck([now])) as CardRow | undefined;

    if (!row) {
      // No cards due — return next upcoming
      const next = db
        .prepare(
          `SELECT c.id, c.deck, c.title, c.body_md,
                  cs.ef, cs.interval, cs.reps, cs.due_at, cs.last_reviewed_at
           FROM cards c
           JOIN card_state cs ON cs.card_id = c.id
           ${deck ? "WHERE c.deck = ?" : ""}
           ORDER BY cs.due_at ASC
           LIMIT 1`,
        )
        .get(...(deck ? [deck] : [])) as CardRow | undefined;

      if (!next) {
        return NextResponse.json({ card: null, dueCount: 0, totalCards: 0 });
      }
      return NextResponse.json({
        card: { ...next, overdue: false },
        dueCount: 0,
        totalCards: countTotal(),
        nextDueAt: next.due_at,
      });
    }

    return NextResponse.json({
      card: { ...row, overdue: true },
      dueCount: countDue(),
      totalCards: countTotal(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
