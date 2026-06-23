import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { openDb } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

const client = new Anthropic();

const RUBRIC_PROMPT = `You are an expert technical interviewer. Grade the following candidate response on a 0–5 scale using this rubric:

0 — Complete blackout / no answer / fundamentally wrong
1 — Incorrect; shows some awareness but missing key concepts
2 — Partially correct; major gaps or errors
3 — Correct with effort; covers the core but misses subtleties or edge cases
4 — Good; covers core + most edge cases, clear communication
5 — Perfect; complete, precise, mentions time/space complexity and tradeoffs where relevant

Respond with ONLY valid JSON in this exact shape:
{"quality": <integer 0-5>, "gaps": [<string>, ...]}

"gaps" should be an array of 1–3 short strings (each ≤15 words) naming the most important missing concepts or errors. If the answer is perfect, use an empty array.`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      card_id: string;
      response_md: string;
    };

    const { card_id, response_md } = body;

    if (!card_id || !response_md || !response_md.trim()) {
      return NextResponse.json(
        { error: "card_id and response_md are required" },
        { status: 400 },
      );
    }

    // Look up the card so we can include the question in the grading prompt
    const db = openDb();
    const card = db
      .prepare(`SELECT title, body_md FROM cards WHERE id = ?`)
      .get(card_id) as { title: string; body_md: string } | undefined;

    if (!card) {
      return NextResponse.json({ error: "card not found" }, { status: 404 });
    }

    const userContent = `## Question\n${card.title}\n\n${card.body_md.slice(0, 800)}\n\n## Candidate Response\n${response_md.trim().slice(0, 1200)}`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 150,
      system: RUBRIC_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : "";

    // Parse the JSON response
    let quality: number;
    let gaps: string[];
    try {
      // Extract JSON even if there's surrounding whitespace or markdown fences
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      const parsed = JSON.parse(jsonMatch[0]) as { quality: number; gaps: string[] };
      quality = Math.max(0, Math.min(5, Math.round(Number(parsed.quality))));
      gaps = Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 3).map(String) : [];
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI grading response", raw: text },
        { status: 502 },
      );
    }

    return NextResponse.json({ quality, gaps });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
