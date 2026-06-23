"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import CardBody from "@/components/CardBody";
import DeckBadge from "@/components/DeckBadge";
import GradeButtons from "@/components/GradeButtons";
import PeerPanel from "@/components/PeerPanel";
import ProgressBar from "@/components/ProgressBar";
import Timer from "@/components/Timer";
import WeakSpotsPanel from "@/components/WeakSpotsPanel";

interface Card {
  id: string;
  deck: string;
  title: string;
  body_md: string;
  ef: number;
  interval: number;
  reps: number;
  due_at: number;
  last_reviewed_at: number | null;
  overdue: boolean;
  audit?: boolean;
}

interface DrillState {
  card: Card | null;
  dueCount: number;
  totalCards: number;
  nextDueAt?: number;
  error?: string;
}

interface Stats {
  total: number;
  due: number;
  reviewed: number;
  reviewedToday: number;
  byDeck: Array<{ deck: string; total: number; due: number }>;
}

type Phase = "question" | "answer" | "grading" | "done";
type DeckFilter = "all" | "blind75" | "sysdesign";
type TimedMode = 0 | 30 | 60 | 90; // 0 = stopwatch (off)

const TIMED_MODE_LABELS: Record<TimedMode, string> = {
  0: "∞",
  30: "0:30",
  60: "1:00",
  90: "1:30",
};

const DECK_LABELS: Record<DeckFilter, string> = {
  all: "All",
  blind75: "Blind 75",
  sysdesign: "System Design",
};

export default function DrillPage() {
  const [drillState, setDrillState] = useState<DrillState | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [phase, setPhase] = useState<Phase>("question");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerResetKey, setTimerResetKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastGrade, setLastGrade] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  // Response textarea — user types their answer; passed to AI grader
  const [responseMd, setResponseMd] = useState<string>("");

  // Timed drill mode (countdown per card, 0 = stopwatch)
  const [timedMode, setTimedMode] = useState<TimedMode>(0);
  // True when the countdown expired and auto-revealed this card
  const [timedOut, setTimedOut] = useState(false);

  // Deck filter
  const [deckFilter, setDeckFilter] = useState<DeckFilter>("all");
  const deckFilterRef = useRef<DeckFilter>("all");

  // Session history for prev/next navigation
  const sessionCardsRef = useRef<Card[]>([]);
  const [historyPos, setHistoryPos] = useState(-1);
  const [sessionCount, setSessionCount] = useState(0);

  // Are we browsing a past card (read-only), or at the live drill tip?
  const isBrowsingHistory =
    historyPos >= 0 && historyPos < sessionCardsRef.current.length - 1;
  const browseCard = isBrowsingHistory
    ? sessionCardsRef.current[historyPos]
    : null;

  const cardRef = useRef<HTMLDivElement>(null);

  function appendToSession(card: Card) {
    const next = [...sessionCardsRef.current, card];
    sessionCardsRef.current = next;
    setSessionCount(next.length);
    setHistoryPos(next.length - 1);
  }

  const fetchNext = useCallback(async () => {
    setLoading(true);
    setPhase("question");
    setLastGrade(null);
    setFeedback(null);
    setResponseMd("");
    setTimerRunning(false);
    setTimerResetKey((k) => k + 1);
    setTimedOut(false);

    const deck = deckFilterRef.current;
    const deckParam = deck !== "all" ? `?deck=${deck}` : "";

    try {
      const [drillRes, statsRes] = await Promise.all([
        fetch(`/api/drill/next${deckParam}`),
        fetch("/api/drill/stats"),
      ]);
      const drill = (await drillRes.json()) as DrillState;
      const st = (await statsRes.json()) as Stats;
      setDrillState(drill);
      setStats(st);
      if (!drill.card) {
        setPhase("done");
      } else {
        setPhase("question");
        setTimerRunning(true);
        appendToSession(drill.card);
      }
    } catch (e) {
      setDrillState({
        card: null,
        dueCount: 0,
        totalCards: 0,
        error: e instanceof Error ? e.message : "Network error",
      });
      setPhase("done");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and whenever deck changes (resets session history)
  useEffect(() => {
    deckFilterRef.current = deckFilter;
    sessionCardsRef.current = [];
    setSessionCount(0);
    setHistoryPos(-1);
    fetchNext();
  }, [deckFilter, fetchNext]);

  const handleReveal = () => {
    setPhase("answer");
    setTimerRunning(false);
    setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleGrade = async (quality: number, label: string) => {
    if (!drillState?.card || submitting) return;
    setSubmitting(true);
    setPhase("grading");
    setLastGrade(label);
    try {
      const res = await fetch("/api/drill/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_id: drillState.card.id,
          quality,
          response_md: responseMd.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        nextState?: { interval: number };
        error?: string;
      };
      if (data.error) {
        setFeedback(`Error: ${data.error}`);
      } else {
        const days = data.nextState?.interval ?? 1;
        setFeedback(
          `Graded "${label}". Next review in ${days} day${days === 1 ? "" : "s"}.`,
        );
      }
    } catch {
      setFeedback("Failed to submit grade. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => fetchNext();

  // Navigate back through session history
  const handlePrev = () => {
    if (historyPos > 0) setHistoryPos((p) => p - 1);
  };

  // Navigate forward through session history (or return to drill tip)
  const handleHistoryForward = () => {
    if (historyPos < sessionCardsRef.current.length - 1) {
      setHistoryPos((p) => p + 1);
    }
  };

  // Per-deck due/total from stats
  function deckStats(d: DeckFilter) {
    if (!stats) return { due: 0, total: 0 };
    if (d === "all") return { due: stats.due, total: stats.total };
    const row = stats.byDeck.find((b) => b.deck === d);
    return { due: row?.due ?? 0, total: row?.total ?? 0 };
  }

  const activeCard = isBrowsingHistory ? null : (drillState?.card ?? null);
  const displayCard = browseCard ?? activeCard;

  const dueCount = deckStats(deckFilter).due;
  const totalCards = deckStats(deckFilter).total;
  const reviewedToday = stats?.reviewedToday ?? 0;

  // ——— Render ———

  if (loading && sessionCount === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading cards…</p>
        </div>
      </div>
    );
  }

  if (drillState?.error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-sm w-full bg-surface-card border border-grade-again/40 rounded-2xl p-6 text-center space-y-3">
          <p className="text-grade-again font-semibold">Error</p>
          <p className="text-slate-400 text-sm">{drillState.error}</p>
          <p className="text-slate-500 text-xs">
            Make sure the SQLite DB has been seeded at{" "}
            <code className="text-slate-300">~/.openclaw/interview-prep-drill/cards.db</code>
          </p>
          <button
            onClick={fetchNext}
            className="mt-2 px-4 py-2 min-h-[44px] rounded-xl bg-brand hover:bg-brand-dark text-white font-medium text-sm transition-colors touch-manipulation"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-surface/90 backdrop-blur-sm border-b border-surface-border">
        <div className="flex items-center justify-between px-4 py-2 max-w-2xl mx-auto">
          <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
            Interview Prep
          </h1>
          <div className="flex items-center gap-2">
            <nav className="flex gap-1">
              <span className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-100 bg-surface-card">
                Drill
              </span>
              <Link
                href="/problems"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-surface-card transition-colors"
              >
                Browse
              </Link>
            </nav>
            <Timer
              running={timerRunning}
              onReset={timerResetKey}
              countdownSeconds={timedMode > 0 ? timedMode : undefined}
              onExpire={() => {
                if (phase === "question") {
                  setTimedOut(true);
                  handleReveal();
                }
              }}
            />
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <ProgressBar due={dueCount} total={totalCards} reviewedToday={reviewedToday} />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto scroll-area">
        <div className="max-w-2xl mx-auto px-4 py-4 pb-8 space-y-4">

          {/* ——— Deck filter tabs + Timed Mode toggle ——— */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2 flex-wrap">
            {(["all", "blind75", "sysdesign"] as DeckFilter[]).map((d) => {
              const ds = deckStats(d);
              const active = deckFilter === d;
              return (
                <button
                  key={d}
                  onClick={() => setDeckFilter(d)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    active
                      ? "bg-brand text-white"
                      : "bg-surface-card text-slate-400 hover:text-slate-100 border border-surface-border"
                  }`}
                >
                  {DECK_LABELS[d]}
                  {stats && (
                    <span
                      className={`text-xs rounded-full px-1.5 py-0.5 ${
                        active
                          ? "bg-white/20 text-white"
                          : ds.due > 0
                          ? "bg-brand/20 text-brand-light"
                          : "bg-surface-border text-slate-600"
                      }`}
                    >
                      {ds.due}
                    </span>
                  )}
                </button>
              );
            })}
            </div>

            {/* Timed mode picker */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-slate-500 hidden sm:block">Timer:</span>
              {([0, 30, 60, 90] as TimedMode[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimedMode(t)}
                  title={t === 0 ? "Stopwatch (no limit)" : `${t}s countdown`}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                    timedMode === t
                      ? "bg-brand text-white"
                      : "bg-surface-card text-slate-400 hover:text-slate-200 border border-surface-border"
                  }`}
                >
                  {TIMED_MODE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* ——— History navigation banner ——— */}
          {isBrowsingHistory && (
            <div className="flex items-center justify-between bg-surface-card border border-surface-border rounded-xl px-4 py-2.5 text-sm">
              <button
                onClick={handlePrev}
                disabled={historyPos === 0}
                className="flex items-center gap-1 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <span className="text-slate-500 text-xs">
                Reviewing {historyPos + 1} / {sessionCount}
              </span>
              <button
                onClick={handleHistoryForward}
                className="flex items-center gap-1 text-slate-400 hover:text-slate-100 transition-colors"
              >
                Next →
              </button>
            </div>
          )}

          {/* ——— Weak spots (hidden while browsing history) ——— */}
          {!isBrowsingHistory && <WeakSpotsPanel />}

          {/* ——— Analytics (hidden while browsing history) ——— */}
          {!isBrowsingHistory && <AnalyticsPanel />}

          {/* ——— All done state ——— */}
          {!isBrowsingHistory && phase === "done" && !activeCard && (
            <AllDonePanel
              dueCount={dueCount}
              nextDueAt={drillState?.nextDueAt}
              onRefresh={fetchNext}
            />
          )}

          {/* ——— History card (read-only, fully revealed) ——— */}
          {isBrowsingHistory && browseCard && (
            <div
              ref={cardRef}
              className="bg-surface-card border border-surface-border rounded-2xl p-4 sm:p-6 space-y-4"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <DeckBadge deck={browseCard.deck} />
                <span className="text-xs text-slate-500 ml-auto">
                  EF {browseCard.ef.toFixed(2)} · rep {browseCard.reps}
                </span>
              </div>
              <CardBody
                title={browseCard.title}
                bodyMd={browseCard.body_md}
                revealed={true}
              />
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={handlePrev}
                  disabled={historyPos === 0}
                  className="px-3 py-2 rounded-xl bg-surface border border-surface-border text-slate-400 hover:text-slate-100 disabled:opacity-30 text-sm transition-colors"
                >
                  ← Prev
                </button>
                <button
                  onClick={handleHistoryForward}
                  className="px-3 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-medium transition-colors"
                >
                  Back to Drill →
                </button>
              </div>
            </div>
          )}

          {/* ——— Active drill card ——— */}
          {!isBrowsingHistory && activeCard && (
            <>
              <div
                ref={cardRef}
                className="bg-surface-card border border-surface-border rounded-2xl p-4 sm:p-6 space-y-4"
              >
                {/* Card meta row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <DeckBadge deck={activeCard.deck} />
                  {activeCard.audit && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-grade-easy/20 text-grade-easy border border-grade-easy/40">
                      Retention Audit
                    </span>
                  )}
                  {timedOut && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-grade-again/20 text-grade-again border border-grade-again/40">
                      Time&apos;s Up
                    </span>
                  )}
                  <span className="text-xs text-slate-500 ml-auto">
                    EF {activeCard.ef.toFixed(2)} · rep {activeCard.reps}
                  </span>
                </div>

                <CardBody
                  title={activeCard.title}
                  bodyMd={activeCard.body_md}
                  revealed={phase === "answer" || phase === "grading"}
                />

                {phase === "question" && (
                  <button
                    onClick={handleReveal}
                    className="
                      w-full min-h-[52px] rounded-xl
                      bg-brand hover:bg-brand-dark active:scale-95
                      text-white font-semibold text-base
                      transition-all duration-150 touch-manipulation
                    "
                  >
                    Show Answer
                  </button>
                )}
              </div>

              {/* Response textarea + grade buttons */}
              {(phase === "answer" || phase === "grading") && (
                <div className="bg-surface-card border border-surface-border rounded-2xl p-4 sm:p-6 space-y-3">
                  {phase === "answer" && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="response-textarea"
                        className="text-xs font-medium text-slate-400"
                      >
                        Your answer{" "}
                        <span className="text-slate-600 font-normal">(optional — enables AI grading)</span>
                      </label>
                      <textarea
                        id="response-textarea"
                        value={responseMd}
                        onChange={(e) => setResponseMd(e.target.value)}
                        placeholder="Summarise your approach…"
                        rows={3}
                        className="
                          w-full resize-y rounded-xl px-3 py-2
                          min-h-[72px] max-h-48
                          bg-surface border border-surface-border
                          text-sm text-slate-200 placeholder-slate-500
                          focus:outline-none focus:border-brand/60
                          transition-colors
                        "
                      />
                    </div>
                  )}
                  <GradeButtons
                    onGrade={handleGrade}
                    disabled={submitting || phase === "grading"}
                    cardId={activeCard.id}
                    responseMd={responseMd}
                  />
                </div>
              )}

              {/* Feedback + next / prev */}
              {phase === "grading" && feedback && (
                <div className="bg-surface-card border border-surface-border rounded-2xl p-4 text-center space-y-3">
                  <p className="text-sm text-slate-300">{feedback}</p>
                  <div className="flex gap-2 justify-center">
                    {sessionCount > 1 && (
                      <button
                        onClick={handlePrev}
                        className="
                          flex-1 min-h-[52px] rounded-xl
                          bg-surface border border-surface-border text-slate-400
                          hover:text-slate-100 hover:border-slate-500
                          font-medium text-base transition-all duration-150 touch-manipulation
                        "
                      >
                        ← Prev
                      </button>
                    )}
                    <button
                      onClick={handleNext}
                      disabled={submitting}
                      className="
                        flex-[2] min-h-[52px] rounded-xl
                        bg-grade-good/20 border-2 border-grade-good text-grade-good
                        hover:bg-grade-good hover:text-white active:scale-95
                        font-semibold text-base
                        transition-all duration-150 touch-manipulation disabled:opacity-50
                      "
                    >
                      Next Card →
                    </button>
                  </div>
                </div>
              )}

              {/* Prev button during question/answer phase */}
              {phase !== "grading" && sessionCount > 1 && (
                <button
                  onClick={handlePrev}
                  className="text-sm text-slate-500 hover:text-slate-300 transition-colors pl-1"
                >
                  ← Previous card
                </button>
              )}

              <PeerPanel cardTitle={activeCard.title} cardBody={activeCard.body_md} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ——— Sub-components ———

function AllDonePanel({
  dueCount,
  nextDueAt,
  onRefresh,
}: {
  dueCount: number;
  nextDueAt?: number;
  onRefresh: () => void;
}) {
  const nextLabel = nextDueAt
    ? new Date(nextDueAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="flex flex-col items-center text-center bg-surface-card border border-surface-border rounded-2xl p-6 sm:p-8 space-y-4 mt-8">
      <div className="text-4xl" aria-hidden="true">🎉</div>
      <h2 className="text-xl font-bold text-slate-100">
        {dueCount === 0 ? "All caught up!" : "No more due cards"}
      </h2>
      <p className="text-slate-400 text-sm max-w-xs">
        {dueCount === 0
          ? "No cards are due right now. Great work!"
          : `${dueCount} cards are due — they may have just been seeded.`}
      </p>
      {nextLabel && (
        <p className="text-xs text-slate-500">
          Next card due: <span className="text-slate-300">{nextLabel}</span>
        </p>
      )}
      <button
        onClick={onRefresh}
        className="mt-2 min-h-[44px] px-6 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-medium text-sm transition-colors touch-manipulation"
      >
        Refresh
      </button>
    </div>
  );
}
