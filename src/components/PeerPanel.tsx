"use client";

import { useRef, useState } from "react";

interface PeerMessage {
  role: "peer" | "you";
  text: string;
  ts: string;
}

interface PeerPanelProps {
  cardTitle?: string;
  cardBody?: string;
}

type Persona = "supportive" | "hiring-manager" | "faang" | "startup" | "stress";

interface PersonaOption {
  value: Persona;
  label: string;
  description: string;
}

const PERSONAS: PersonaOption[] = [
  {
    value: "supportive",
    label: "Peer",
    description: "Supportive fellow candidate",
  },
  {
    value: "hiring-manager",
    label: "Hiring Manager",
    description: "Strict — surfaces rejection reasons",
  },
  {
    value: "faang",
    label: "FAANG Direct",
    description: "Terse, highly technical",
  },
  {
    value: "startup",
    label: "Startup",
    description: "Relaxed, curious, practical",
  },
  {
    value: "stress",
    label: "Stress Test",
    description: "Interrupts and challenges everything",
  },
];

function formatTs(): string {
  return new Date().toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PERSONA_TAG_COLORS: Record<Persona, string> = {
  supportive: "text-brand",
  "hiring-manager": "text-grade-again",
  faang: "text-grade-hard",
  startup: "text-grade-good",
  stress: "text-orange-400",
};

/**
 * Collapsible peer-agent chat panel.
 * On mobile: collapses to a header toggle (saves vertical space).
 * Sends messages to /api/peer with persona selection.
 */
export default function PeerPanel({ cardTitle, cardBody }: PeerPanelProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<PeerMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [persona, setPersona] = useState<Persona>("supportive");
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentPersona = PERSONAS.find((p) => p.value === persona)!;

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || typing) return;

    const youMsg: PeerMessage = { role: "you", text, ts: formatTs() };
    // Capture history before adding new message (last 6 prior turns for rolling context)
    const priorMessages = messages;
    setMessages((prev) => [...prev, youMsg]);
    setInput("");
    setTyping(true);
    scrollToBottom();

    // Build history payload: map "you" → "user", "peer" → "assistant"
    const history = priorMessages.slice(-6).map((m) => ({
      role: m.role === "you" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    }));

    try {
      const res = await fetch("/api/peer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardTitle, cardBody, message: text, persona, history }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      const replyText = data.reply ?? data.error ?? "No response.";
      const peerMsg: PeerMessage = {
        role: "peer",
        text: replyText,
        ts: formatTs(),
      };
      setMessages((prev) => [...prev, peerMsg]);
    } catch {
      const peerMsg: PeerMessage = {
        role: "peer",
        text: "Network error — couldn't reach the peer agent.",
        ts: formatTs(),
      };
      setMessages((prev) => [...prev, peerMsg]);
    } finally {
      setTyping(false);
      scrollToBottom();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePersonaChange = (next: Persona) => {
    setPersona(next);
    setShowPersonaPicker(false);
    // Clear history when switching persona — context shifts
    if (messages.length > 0) {
      setMessages([]);
    }
  };

  return (
    <div className="w-full bg-surface-card border border-surface-border rounded-xl overflow-hidden">
      {/* Header / toggle — always visible, tap to expand on mobile */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="
          w-full flex items-center justify-between
          px-4 py-3 text-left
          min-h-[44px]
          hover:bg-surface-border/30 transition-colors
          touch-manipulation
        "
        aria-expanded={open}
        aria-controls="peer-panel-body"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-200">
            Peer Review
          </span>
          <span
            className={`text-xs font-medium px-1.5 py-0.5 rounded bg-surface-border/60 ${PERSONA_TAG_COLORS[persona]}`}
          >
            {currentPersona.label}
          </span>
          {messages.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand text-white text-xs font-bold">
              {messages.length}
            </span>
          )}
          {typing && (
            <span className="text-xs text-slate-400 italic">typing…</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expandable body */}
      <div
        id="peer-panel-body"
        className={`transition-all duration-300 overflow-hidden ${
          open ? "max-h-[36rem]" : "max-h-0"
        }`}
      >
        {/* Persona picker toolbar */}
        <div className="px-4 pt-2 pb-1 border-b border-surface-border/40">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 shrink-0">Mode:</span>
            {PERSONAS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePersonaChange(p.value)}
                title={p.description}
                className={`
                  text-xs px-2 py-0.5 rounded-full border transition-all duration-150 touch-manipulation
                  ${
                    persona === p.value
                      ? `border-current font-semibold ${PERSONA_TAG_COLORS[p.value]} bg-surface-border/40`
                      : "border-surface-border text-slate-500 hover:text-slate-300 hover:border-slate-500"
                  }
                `}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-1 italic">
            {currentPersona.description}
            {messages.length > 0 && persona !== "supportive" && (
              <span className="ml-1 text-slate-500">(history cleared on switch)</span>
            )}
          </p>
        </div>

        {/* Message list */}
        <div className="px-4 pt-2 pb-2 space-y-3 overflow-y-auto max-h-52 scroll-area">
          {messages.length === 0 && !typing ? (
            <p className="text-slate-500 text-sm text-center py-3">
              {persona === "hiring-manager"
                ? "Share your answer — the hiring manager will tell you why it falls short."
                : persona === "stress"
                ? "Start talking. Be ready to defend every word."
                : "Ask your peer anything about this problem."}
              {cardTitle && (
                <>
                  <br />
                  <span className="text-xs mt-1 block text-slate-600">
                    Topic: {cardTitle}
                  </span>
                </>
              )}
            </p>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "you" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "you"
                      ? "bg-brand/30 text-slate-100 rounded-br-sm"
                      : "bg-surface-border text-slate-300 rounded-bl-sm"
                  }`}
                >
                  <p>{msg.text}</p>
                  <p className="text-xs text-slate-500 mt-1 text-right">
                    {msg.ts}
                  </p>
                </div>
              </div>
            ))
          )}

          {/* Typing indicator */}
          {typing && (
            <div className="flex justify-start">
              <div className="bg-surface-border rounded-2xl rounded-bl-sm px-3 py-2">
                <span className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input row */}
        <div className="px-4 pb-4 pt-1 flex items-end gap-2 border-t border-surface-border/50">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              persona === "hiring-manager"
                ? "Share your answer… (Enter to send)"
                : persona === "stress"
                ? "State your approach… (Enter to send)"
                : "Ask your peer… (Enter to send)"
            }
            rows={1}
            disabled={typing}
            className="
              flex-1 resize-none rounded-xl px-3 py-2
              min-h-[44px] max-h-24
              bg-surface border border-surface-border
              text-sm text-slate-200 placeholder-slate-500
              focus:outline-none focus:border-brand/60
              transition-colors
              disabled:opacity-50
              touch-manipulation
            "
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || typing}
            aria-label="Send message"
            className="
              flex-shrink-0 min-h-[44px] min-w-[44px]
              flex items-center justify-center
              rounded-xl bg-brand hover:bg-brand-dark active:scale-95
              text-white
              transition-all duration-150
              disabled:opacity-40 disabled:pointer-events-none
              touch-manipulation
            "
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="w-4 h-4 rotate-90"
              aria-hidden="true"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
