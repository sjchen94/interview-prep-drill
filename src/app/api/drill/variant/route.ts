import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { openDb } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

const client = new Anthropic();

export type VariantMutation = "constraints" | "domain" | "invariant" | "surprise";

const MUTATION_INSTRUCTIONS: Record<VariantMutation, string> = {
  constraints: `Swap or tighten the constraints so the canonical solution no longer fits: change input size limits, allow negatives, allow duplicates when originally unique (or vice versa), require O(1) auxiliary space, forbid sorting, or forbid hash tables.`,
  domain: `Reframe the problem in a novel domain while preserving the underlying algorithmic shape. Examples: an "arrays" problem becomes a streaming log of events, a "trees" problem becomes an org-chart or a filesystem walk, a "graph" problem becomes a microservice dependency graph, a "system design" problem targets an unfamiliar user (rural low-bandwidth, satellite links, edge devices).`,
  invariant: `Introduce one extra invariant or requirement that forces the candidate to adapt: e.g. answer must stream results as they become available, algorithm must be online / incremental, must support undo, must be thread-safe under concurrent readers, must degrade gracefully when memory is bounded.`,
  surprise: `Freely pick ONE of the above mutation styles that would trip up a candidate who has only memorized the canonical form. Prefer whichever produces the sharpest test of true understanding.`,
};

const SYSTEM_PROMPT = `You are an adversarial interviewer designing a NOVEL variant of a well-known interview problem.
Your goal is to test pattern recognition and true understanding, not memorization. Interviewers in 2026
assume candidates have already seen the canonical Blind 75 / NeetCode 150 / system-design classics, so
you must mutate the problem enough that the memorized answer no longer directly applies — while keeping
the underlying skill being tested the same.

Rules:
- Keep the mutated problem SOLVABLE within the same interview time budget.
- Do NOT reveal the underlying canonical problem or the solution.
- Do NOT include hints, approaches, or answer sketches.
- Preserve the core skill (graph traversal, DP, sliding window, sharding, caching, etc.).
- Output only the mutated problem statement.

Respond with ONLY valid JSON in this exact shape:
{"title": "<short title, <=80 chars>", "prompt": "<the mutated problem statement, 2-5 short paragraphs>", "mutation_note": "<one sentence naming what you changed vs the canonical form>"}`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      card_id?: string;
      mutation?: VariantMutation;
    };

    const { card_id, mutation = "surprise" } = body;

    if (!card_id) {
      return NextResponse.json({ error: "card_id is required" }, { status: 400 });
    }

    const db = openDb();
    const card = db
      .prepare(`SELECT title, body_md, deck FROM cards WHERE id = ?`)
      .get(card_id) as { title: string; body_md: string; deck: string } | undefined;

    if (!card) {
      return NextResponse.json({ error: "card not found" }, { status: 404 });
    }

    const instruction =
      MUTATION_INSTRUCTIONS[mutation] ?? MUTATION_INSTRUCTIONS.surprise;

    const userContent = `## Canonical Problem
Title: ${card.title}
Deck: ${card.deck}

${card.body_md.slice(0, 1200)}

## Mutation Style
${instruction}

Now write the adversarial variant as JSON per the system instructions.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : "";

    let title: string;
    let prompt: string;
    let mutationNote: string;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      const parsed = JSON.parse(jsonMatch[0]) as {
        title?: string;
        prompt?: string;
        mutation_note?: string;
      };
      if (!parsed.title || !parsed.prompt) {
        throw new Error("Missing title or prompt");
      }
      title = String(parsed.title).slice(0, 120);
      prompt = String(parsed.prompt);
      mutationNote = String(parsed.mutation_note ?? "");
    } catch {
      return NextResponse.json(
        { error: "Failed to parse variant response", raw: text },
        { status: 502 },
      );
    }

    return NextResponse.json({
      title,
      prompt,
      mutationNote,
      mutation,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
