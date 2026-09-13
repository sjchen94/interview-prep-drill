"use client";

import { useEffect, useState } from "react";

interface LeechCard {
  id: string;
  deck: string;
  title: string;
  topic: string | null;
  totalLapses: number;
  consecutiveLapses: number;
  reviewCount: number;
  ef: number;
  lastReviewedAt: number | null;
}

interface LeechData {
  leeches: LeechCard[];
}

function deckLabel(deck: string): string {
  if (deck === "blind75") return "Blind 75";
  if (deck === "sysdesign") return "Sys Design";
  if (deck === "behavioral") return "Behavioral";
  if (deck === "ml-infra") return "ML Infra";
  return deck;
}

/**
 * Surfaces "leech" cards — problems that keep coming back despite repeated
 * drilling (Anki-style: total lapses >= 4, or a live streak of 3+ lapses in
 * a row). Passive re-drilling of these rarely works; the panel nudges the
 * user to actively re-learn (re-read the solution/notes) instead of just
 * grinding the same card through SM-2 again.
 *
 * Hidden entirely when there are no leeches yet.
 */
export default function LeechPanel() {
  const [data, setData] = useState<LeechData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/drill/leeches")
      .then((r) => r.json())
      .then((d: LeechData) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : "Network error"));
  }, []);

  if (error || !data) return null;

  const visible = data.leeches.filter((l) => !dismissed.has(l.id));
  if (visible.length === 0) return null;

  return (
    <div className="bg-surface-card border border-orange-800/50 rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-orange-400">⚠</span>
        <h2 className="text-sm font-semibold text-slate-200">Leeches</h2>
        <span className="text-xs text-slate-500">
          (stuck cards — consider re-reading the solution instead of re-drilling)
        </span>
      </div>

      <ul className="space-y-2">
        {visible.map((l) => (
          <li
            key={l.id}
            className="flex items-center justify-between gap-2 text-xs bg-surface rounded-xl border border-surface-border px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-slate-200 font-medium truncate">{l.title}</p>
              <p className="text-slate-500">
                {deckLabel(l.deck)}
                {l.topic ? ` · ${l.topic}` : ""} · {l.totalLapses} lapse
                {l.totalLapses === 1 ? "" : "s"}
                {l.consecutiveLapses >= 3 && (
                  <span className="text-orange-400">
                    {" "}
                    · {l.consecutiveLapses} in a row
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => setDismissed((prev) => new Set(prev).add(l.id))}
              title="Dismiss (until next page load)"
              className="shrink-0 px-2 py-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-surface-border transition-colors"
            >
              Dismiss
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
