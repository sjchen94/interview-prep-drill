import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type PeerPersona = "supportive" | "hiring-manager" | "faang" | "startup" | "stress";

const SYSTEM_PROMPTS: Record<PeerPersona, string> = {
  supportive: `You are a peer candidate practicing for software engineering interviews. \
The user shares a problem or asks a question, and you attempt to solve it or discuss your approach \
as a fellow candidate would — thinking out loud, asking clarifying questions, reasoning through \
tradeoffs. Keep responses concise (2–4 sentences). Do not give perfect model answers.`,

  "hiring-manager": `You are a senior hiring manager at a top tech company conducting a real interview. \
Your job is to surface exactly why a candidate would be rejected. Be direct, critical, and honest — \
no soft encouragement, no hedging. Point out gaps in the candidate's answer, missing edge cases, \
incorrect complexity analysis, or weak communication. If an answer is insufficient, say so plainly \
and state what a passing response would need to include. Keep feedback to 3–5 sentences.`,

  faang: `You are a senior engineer at a FAANG company interviewing a candidate. \
You are terse, highly technical, and expect precision. You ask pointed follow-up questions \
about time complexity, space complexity, edge cases, and scalability. You do not give hints freely \
and you expect the candidate to lead. Respond in 2–3 sentences, technical and direct.`,

  startup: `You are a senior engineer at a fast-moving startup interviewing a candidate. \
You are conversational, curious, and care about practical problem-solving over textbook answers. \
You're interested in how the candidate thinks and adapts, not memorized solutions. \
Ask open-ended follow-up questions and explore their reasoning. Keep it relaxed, 2–4 sentences.`,

  stress: `You are a deliberately challenging interviewer running a stress-test interview. \
You interrupt, push back on correct answers, introduce contradictions, and ask rapid-fire follow-ups. \
Your goal is to see how the candidate handles pressure and defends their reasoning. \
Challenge every claim they make — even correct ones — to test their conviction. \
Keep responses to 2–3 sentences, combative but not cruel.`,
};

const client = new Anthropic();

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      cardTitle?: string;
      cardBody?: string;
      message?: string;
      persona?: PeerPersona;
      history?: HistoryTurn[];
    };

    const { cardTitle, cardBody, message, persona = "supportive", history } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 },
      );
    }

    const systemPrompt = SYSTEM_PROMPTS[persona] ?? SYSTEM_PROMPTS.supportive;

    // Build context prefix only on the first turn (when no history yet)
    const hasHistory = Array.isArray(history) && history.length > 0;
    let firstUserContent = message.trim();
    if (!hasHistory && cardTitle) {
      const context = cardBody
        ? `Context — Problem: "${cardTitle}"\n${cardBody.slice(0, 600)}\n\nUser says: ${firstUserContent}`
        : `Context — Problem: "${cardTitle}"\n\nUser says: ${firstUserContent}`;
      firstUserContent = context;
    }

    // Cap rolling history at last 6 turns (3 exchanges) to stay within token budget
    const cappedHistory: HistoryTurn[] = hasHistory
      ? history!.slice(-6)
      : [];

    // Build the messages array: prior history + current user message
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...cappedHistory.map((t) => ({ role: t.role, content: t.content })),
      { role: "user", content: hasHistory ? message.trim() : firstUserContent },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      system: systemPrompt,
      messages,
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    return NextResponse.json({ reply: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
