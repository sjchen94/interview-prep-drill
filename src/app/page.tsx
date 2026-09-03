"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import CardBody, { countHintSteps } from "@/components/CardBody";
import DeckBadge from "@/components/DeckBadge";
import GradeButtons from "@/components/GradeButtons";
import LeechPanel from "@/components/LeechPanel";
import PeerPanel from "@/components/PeerPanel";
import ProgressBar from "@/components/ProgressBar";
import Timer from "@/components/Timer";
import WeakSpotsPanel from "@/components/WeakSpotsPanel";

// Grade label → quality mapping (mirrors GradeButtons)
const GRADE_QUALITIES: Record<string, number> = {
  Again: 0,
  Hard: 1,
  Good: 3,
  Easy: 5,
};
const GRADE_KEYS = ["Again", "Hard", "Good", "Easy"] as const;

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
type DeckFilter = "all" | "blind75" | "sysdesign" | "behavioral" | "ml-infra";
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
  sysdesign: "Sys Design",
  behavioral: "Behavioral",
  "ml-infra": "ML Infra",
};

const VALID_DECK_FILTERS = new Set<DeckFilter>([
  "all",
  "blind75",
  "sysdesign",
  "behavioral",
  "ml-infra",
]);

/**
 * Read initial deck/topic/focus filters from the URL query string so links
 * like "?deck=behavioral&topic=trees" from WeakSpotsPanel/LeechPanel actually
 * land on a filtered queue instead of silently opening the unfiltered deck.
 * Safe to call during render (client component) — falls back to defaults
 * during SSR/when window is unavailable.
 */
function readInitialFiltersFromUrl(): {
  deck: DeckFilter;
  topic: string | null;
  focusHard: boolean;
} {
  if (typeof window === "undefined") {
    return { deck: "all", topic: null, focusHard: false };
  }
  const params = new URLSearchParams(window.location.search);
  const rawDeck = params.get("deck") ?? "all";
  const deck = VALID_DECK_FILTERS.has(rawDeck as DeckFilter) ? (rawDeck as DeckFilter) : "all";
  const topic = params.get("topic");
  const focusHard = params.get("focus") === "hard";
  return { deck, topic: topic && topic.trim() ? topic.trim() : null, focusHard };
}

export default function DrillPage() {
  const [drillState, setDrillState] = useState<DrillState | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [phase, setPhase] = useState<Phase>("question");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerResetKey, setTimerResetKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [, setLastGrade] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  // Undo support: snapshot of the review + prior SM-2 state returned by the
  // grade endpoint, so a misclick can be reverted before moving to the next
  // card. Cleared whenever a new card loads.
  const [undoInfo, setUndoInfo] = useState<{
    reviewId: number;
    cardId: string;
    prevState: { ef: number; interval: number; reps: number; due_at: number; last_reviewed_at: number | null };
  } | null>(null);
  const [undoing, setUndoing] = useState(false);
  // Response textarea — user types their answer; passed to AI grader
  const [responseMd, setResponseMd] = useState<string>("");

  // Graduated disclosure: 0 = nothing revealed, 1..N = hint N shown, N+1 = full answer.
  // Reset to 0 whenever a new card loads.
  const [hintStep, setHintStep] = useState(0);

  // Timed drill mode (countdown per card, 0 = stopwatch)
  const [timedMode, setTimedMode] = useState<TimedMode>(0);
  // True when the countdown expired and auto-revealed this card
  const [timedOut, setTimedOut] = useState(false);

  // Deck + topic filter — initialized from the URL (?deck=&topic=) so
  // "Drill" shortcuts from WeakSpotsPanel/LeechPanel actually filter the
  // queue instead of landing on the unfiltered "all" view.
  const initialFilters = useRef(readInitialFiltersFromUrl()).current;
  const [deckFilter, setDeckFilter] = useState<DeckFilter>(initialFilters.deck);
  const deckFilterRef = useRef<DeckFilter>(initialFilters.deck);
  const [topicFilter, setTopicFilter] = useState<string | null>(initialFilters.topic);
  const topicFilterRef = useRef<string | null>(initialFilters.topic);

  // Focus mode: hard-first queues lowest-EF due cards first
  const [focusHard, setFocusHard] = useState(initialFilters.focusHard);
  const focusHardRef = useRef(initialFilters.focusHard);

  // Interleave mode: round-robin due cards by topic to avoid consecutive same-topic cards
  const [interleave, setInterleave] = useState(false);
  const interleaveRef = useRef(false);

  // Session history for prev/next navigation
  const sessionCardsRef = useRef<Card[]>([]);
  const [historyPos, setHistoryPos] = useState(-1);
  const [sessionCount, setSessionCount] = useState(0);

  // Track grades given during this session for the summary panel
  const [sessionGrades, setSessionGrades] = useState<string[]>([]);

  // Are we browsing a past card (read-only), or at the live drill tip?
  const isBrowsingHistory =
    historyPos >= 0 && historyPos < sessionCardsRef.current.length - 1;
  const browseCard = isBrowsingHistory
    ? sessionCardsRef.current[historyPos]
    : null;

  const cardRef = useRef<HTMLDivElement>(null);

  // Refs for keyboard shortcut handler (avoids stale closure on handlers)
  const phaseRef = useRef<Phase>("question");
  const submittingRef = useRef(false);
  const activeCardRef = useRef<Card | null>(null);
  const handleRevealRef = useRef<() => void>(() => {});
  const handleGradeRef = useRef<(quality: number, label: string) => void>(() => {});
  const handleNextRef = useRef<() => void>(() => {});
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { submittingRef.current = submitting; }, [submitting]);

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
    setHintStep(0);
    setUndoInfo(null);

    const deck = deckFilterRef.current;
    const topic = topicFilterRef.current;
    const focus = focusHardRef.current;
    const interleaveOn = interleaveRef.current;
    const params = new URLSearchParams();
    if (deck !== "all") params.set("deck", deck);
    if (topic) params.set("topic", topic);
    if (focus) params.set("focus", "hard");
    if (interleaveOn) params.set("strategy", "interleave");
    const deckParam = params.toString() ? `?${params.toString()}` : "";

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

  // Fetch on mount and whenever deck, topic, focus mode, or interleave mode
  // changes (resets session history)
  useEffect(() => {
    deckFilterRef.current = deckFilter;
    topicFilterRef.current = topicFilter;
    focusHardRef.current = focusHard;
    interleaveRef.current = interleave;
    sessionCardsRef.current = [];
    setSessionCount(0);
    setHistoryPos(-1);
    setSessionGrades([]);
    fetchNext();
  }, [deckFilter, topicFilter, focusHard, interleave, fetchNext]);

  // Number of progressive hint steps available for the active card (0 = none).
  const activeHintSteps = drillState?.card ? countHintSteps(drillState.card.body_md) : 0;

  const handleReveal = () => {
    setPhase("answer");
    setTimerRunning(false);
    // "Show Answer" jumps straight to the full reveal (skips hint steps).
    setHintStep(activeHintSteps + 1);
    setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };
  // Keep ref current so keyboard handler always calls the latest version
  handleRevealRef.current = handleReveal;

  // "Hint (N remaining)" — advances one hint step at a time; entering the
  // answer phase but capping at hints (not the full answer) until exhausted.
  const handleHint = () => {
    setPhase("answer");
    setTimerRunning(false);
    setHintStep((s) => Math.min(s + 1, activeHintSteps + 1));
    setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleGrade = async (quality: number, label: string) => {
    if (!drillState?.card || submitting) return;
    setSubmitting(true);
    setPhase("grading");
    setLastGrade(label);
    setSessionGrades((prev) => [...prev, label]);
    // Hints used = number of hint steps actually shown (excludes the final full-answer step).
    const hintsUsed = Math.min(hintStep, activeHintSteps);

    try {
      const res = await fetch("/api/drill/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_id: drillState.card.id,
          quality,
          response_md: responseMd.trim() || null,
          hints_used: hintsUsed,
        }),
      });
      const data = (await res.json()) as {
        reviewId?: number;
        nextState?: { interval: number };
        prevState?: { ef: number; interval: number; reps: number; due_at: number; last_reviewed_at: number | null };
        error?: string;
      };
      if (data.error) {
        setFeedback(`Error: ${data.error}`);
      } else {
        const days = data.nextState?.interval ?? 1;
        setFeedback(
          `Graded "${label}". Next review in ${days} day${days === 1 ? "" : "s"}.`,
        );
        if (data.reviewId && data.prevState) {
          setUndoInfo({
            reviewId: data.reviewId,
            cardId: drillState.card.id,
            prevState: data.prevState,
          });
        }
      }
    } catch {
      setFeedback("Failed to submit grade. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  };
  // Keep ref current
  handleGradeRef.current = handleGrade;

  // Reverts the grade just submitted (before "Next Card" is pressed): drops
  // the review row server-side, restores the prior SM-2 state, pops the
  // grade off the session summary, and drops back into the answer phase so
  // the user can re-grade.
  const handleUndo = async () => {
    if (!undoInfo || undoing) return;
    setUndoing(true);
    try {
      const res = await fetch("/api/drill/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_id: undoInfo.cardId,
          review_id: undoInfo.reviewId,
          prev_state: undoInfo.prevState,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setSessionGrades((prev) => prev.slice(0, -1));
        setUndoInfo(null);
        setFeedback(null);
        setPhase("answer");
      } else {
        setFeedback(`Undo failed: ${data.error ?? "unknown error"}`);
      }
    } catch (e) {
      setFeedback(`Undo failed: ${e instanceof Error ? e.message : "network error"}`);
    } finally {
      setUndoing(false);
    }
  };

  const handleNext = () => fetchNext();
  // Keep ref current
  handleNextRef.current = handleNext;

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

  // ——— Keyboard shortcuts ———
  // Space/Enter → reveal answer (question phase)
  // 1/2/3/4     → grade Again/Hard/Good/Easy (answer phase)
  // n           → next card (grading phase, after feedback)
  // Disabled when focus is inside a text input/textarea to avoid conflicts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't fire shortcuts when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      const phase = phaseRef.current;
      const card = activeCardRef.current;
      const busy = submittingRef.current;

      if (phase === "question" && card) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          handleRevealRef.current();
        }
      } else if (phase === "answer" && card && !busy) {
        const gradeMap: Record<string, string> = { "1": "Again", "2": "Hard", "3": "Good", "4": "Easy" };
        const label = gradeMap[e.key];
        if (label) {
          e.preventDefault();
          const quality = GRADE_QUALITIES[label]!;
          handleGradeRef.current(quality, label);
        }
      } else if (phase === "grading" && !busy) {
        if (e.key === "n" || e.key === "Enter") {
          e.preventDefault();
          handleNextRef.current();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // handleReveal, handleGrade, handleNext are stable (no deps that change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-deck due/total from stats
  function deckStats(d: DeckFilter) {
    if (!stats) return { due: 0, total: 0 };
    if (d === "all") return { due: stats.due, total: stats.total };
    const row = stats.byDeck.find((b) => b.deck === d);
    return { due: row?.due ?? 0, total: row?.total ?? 0 };
  }

  const activeCard = isBrowsingHistory ? null : (drillState?.card ?? null);
  // Keep ref in sync for keyboard handler
  useEffect(() => { activeCardRef.current = activeCard; }, [activeCard]);

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

          {/* ——— Deck filter tabs ——— */}
          <div className="flex gap-2 flex-wrap">
            {(["all", "blind75", "sysdesign", "behavioral", "ml-infra"] as DeckFilter[]).map((d) => {
              const ds = deckStats(d);
              const active = deckFilter === d;
              return (
                <button
                  key={d}
                  onClick={() => {
                    setDeckFilter(d);
                    // Switching decks manually clears any topic scope from a
                    // "Drill" deep link — topic is a narrower filter than deck.
                    setTopicFilter(null);
                  }}
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

          {/* ——— Active topic filter chip (from a weak-spot/leech "Drill" deep link) ——— */}
          {topicFilter && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Topic filter:</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand/20 text-brand-light border border-brand/40">
                {topicFilter}
                <button
                  onClick={() => setTopicFilter(null)}
                  aria-label="Clear topic filter"
                  className="hover:text-white"
                >
                  ✕
                </button>
              </span>
            </div>
          )}

          {/* ——— Timed Mode + Focus Mode toggles ——— */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Timed mode picker */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Timer:</span>
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

            {/* Focus mode toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFocusHard((f) => !f)}
                title={focusHard ? "Disable focus mode — return to earliest-due order" : "Focus mode: drill hardest cards (lowest EF) first"}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  focusHard
                    ? "bg-grade-again/20 border-grade-again/60 text-grade-again"
                    : "bg-surface-card border-surface-border text-slate-500 hover:text-slate-200"
                }`}
              >
                <span aria-hidden="true">{focusHard ? "◉" : "○"}</span>
                Focus: Hard
              </button>

              {/* Interleave mode toggle */}
              <button
                onClick={() => setInterleave((v) => !v)}
                title={interleave ? "Disable interleaving — return to normal due order" : "Interleave mode: mix topics to avoid consecutive same-topic cards"}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  interleave
                    ? "bg-brand/20 border-brand/60 text-brand-light"
                    : "bg-surface-card border-surface-border text-slate-500 hover:text-slate-200"
                }`}
              >
                <span aria-hidden="true">{interleave ? "◉" : "○"}</span>
                Interleave
              </button>
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

          {/* ——— Leeches (hidden while browsing history) ——— */}
          {!isBrowsingHistory && <LeechPanel />}

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
              sessionGrades={sessionGrades}
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
                  hintStep={hintStep}
                />

                {phase === "question" && (
                  <div className="space-y-1.5">
                    {activeHintSteps > 0 && (
                      <button
                        onClick={handleHint}
                        className="
                          w-full min-h-[44px] rounded-xl
                          bg-surface border border-brand/50 text-brand-light
                          hover:bg-brand/10 active:scale-95
                          font-medium text-sm
                          transition-all duration-150 touch-manipulation
                        "
                      >
                        Hint ({activeHintSteps} remaining)
                      </button>
                    )}
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
                    <p className="text-center text-xs text-slate-600 select-none">
                      Press <kbd className="px-1 py-0.5 rounded bg-surface-border text-slate-400 font-mono text-xs">Space</kbd> to reveal
                    </p>
                  </div>
                )}
                {phase === "answer" && hintStep > 0 && hintStep <= activeHintSteps && (
                  <button
                    onClick={handleHint}
                    className="
                      w-full min-h-[40px] rounded-xl
                      bg-surface border border-brand/50 text-brand-light
                      hover:bg-brand/10 active:scale-95
                      font-medium text-sm
                      transition-all duration-150 touch-manipulation
                    "
                  >
                    {hintStep < activeHintSteps
                      ? `Next Hint (${activeHintSteps - hintStep} remaining)`
                      : "Show Full Answer"}
                  </button>
                )}
              </div>

              {/* Response textarea + grade buttons */}
              {(phase === "answer" || phase === "grading") && (
                <div className="bg-surface-card border border-surface-border rounded-2xl p-4 sm:p-6 space-y-3">
                  {phase === "answer" && (
                    <p className="text-center text-xs text-slate-600 select-none -mb-1">
                      Press <kbd className="px-1 py-0.5 rounded bg-surface-border text-slate-400 font-mono text-xs">1</kbd>–<kbd className="px-1 py-0.5 rounded bg-surface-border text-slate-400 font-mono text-xs">4</kbd> to grade
                    </p>
                  )}
                  {phase === "answer" && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="response-textarea"
                        className="text-xs font-medium text-slate-400"
                      >
                        Your answer{" "}
                        <span className="text-slate-600 font-normal">(optional — enables AI grading)</span>
                      </label>

                      {/* STAR scaffold hint for behavioral cards */}
                      {activeCard.deck === "behavioral" && (
                        <div className="grid grid-cols-2 gap-1.5 mb-2">
                          {(["Situation", "Task", "Action", "Result"] as const).map((part) => (
                            <button
                              key={part}
                              type="button"
                              onClick={() =>
                                setResponseMd((prev) => {
                                  const prefix = `${part}: `;
                                  if (prev.includes(prefix)) return prev;
                                  return prev ? `${prev}\n\n${prefix}` : prefix;
                                })
                              }
                              className="text-left px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-xs text-slate-400 hover:text-slate-100 hover:border-brand/50 transition-colors"
                            >
                              + {part}
                            </button>
                          ))}
                        </div>
                      )}

                      <textarea
                        id="response-textarea"
                        value={responseMd}
                        onChange={(e) => setResponseMd(e.target.value)}
                        placeholder={
                          activeCard.deck === "behavioral"
                            ? "Situation: …\nTask: …\nAction: …\nResult: …"
                            : "Summarise your approach…"
                        }
                        rows={activeCard.deck === "behavioral" ? 6 : 3}
                        className="
                          w-full resize-y rounded-xl px-3 py-2
                          min-h-[72px] max-h-64
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
                    isBehavioral={activeCard.deck === "behavioral"}
                    hintsUsed={Math.min(hintStep, activeHintSteps)}
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
                  {undoInfo && (
                    <button
                      onClick={handleUndo}
                      disabled={undoing}
                      className="
                        w-full min-h-[36px] rounded-lg
                        text-xs text-slate-500 hover:text-slate-200
                        border border-transparent hover:border-surface-border
                        transition-colors disabled:opacity-40
                      "
                    >
                      {undoing ? "Undoing…" : "Misgraded? Undo"}
                    </button>
                  )}
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

const GRADE_COLORS: Record<string, string> = {
  Again: "text-grade-again",
  Hard: "text-grade-hard",
  Good: "text-grade-good",
  Easy: "text-grade-easy",
};

const GRADE_BG: Record<string, string> = {
  Again: "bg-grade-again",
  Hard: "bg-grade-hard",
  Good: "bg-grade-good",
  Easy: "bg-grade-easy",
};

function SessionSummary({ grades }: { grades: string[] }) {
  if (grades.length === 0) return null;

  const counts: Record<string, number> = { Again: 0, Hard: 0, Good: 0, Easy: 0 };
  for (const g of grades) if (g in counts) counts[g]++;

  const retentionPct = Math.round(
    ((counts.Good + counts.Easy) / grades.length) * 100,
  );

  return (
    <div className="w-full bg-surface rounded-xl border border-surface-border p-4 space-y-3 text-left">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">Session Summary</h3>
        <span className="text-xs text-slate-500">{grades.length} card{grades.length !== 1 ? "s" : ""} reviewed</span>
      </div>

      {/* Grade breakdown bars */}
      <div className="space-y-1.5">
        {GRADE_KEYS.map((label) => {
          const n = counts[label] ?? 0;
          const pct = grades.length > 0 ? (n / grades.length) * 100 : 0;
          return (
            <div key={label} className="flex items-center gap-2 text-xs">
              <span className={`w-10 shrink-0 font-medium ${GRADE_COLORS[label]}`}>{label}</span>
              <div className="flex-1 h-2.5 bg-surface-border rounded-full overflow-hidden">
                {pct > 0 && (
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${GRADE_BG[label]}`}
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
              <span className="w-5 text-right text-slate-500 shrink-0">{n}</span>
            </div>
          );
        })}
      </div>

      {/* Retention rate */}
      <p className="text-xs text-slate-500">
        Recall rate:{" "}
        <span
          className={
            retentionPct >= 70
              ? "text-grade-good font-semibold"
              : retentionPct >= 40
              ? "text-grade-hard font-semibold"
              : "text-grade-again font-semibold"
          }
        >
          {retentionPct}%
        </span>{" "}
        Good + Easy
      </p>
    </div>
  );
}

function AllDonePanel({
  dueCount,
  nextDueAt,
  onRefresh,
  sessionGrades,
}: {
  dueCount: number;
  nextDueAt?: number;
  onRefresh: () => void;
  sessionGrades: string[];
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
    <div className="flex flex-col items-center bg-surface-card border border-surface-border rounded-2xl p-6 sm:p-8 space-y-4 mt-8">
      <div className="text-4xl" aria-hidden="true">🎉</div>
      <div className="text-center space-y-1">
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
      </div>

      {/* Session grade summary */}
      <SessionSummary grades={sessionGrades} />

      <button
        onClick={onRefresh}
        className="mt-2 min-h-[44px] px-6 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-medium text-sm transition-colors touch-manipulation"
      >
        Refresh
      </button>
    </div>
  );
}
