"use client";

import { useEffect, useState } from "react";

interface WeakSpot {
  deck: string;
  topic: string | null;
  avgQuality: number;
  reviewCount: number;
  label: string;
}

interface WeakSpotsData {
  weakSpots: WeakSpot[];
}

function qualityBar(avgQuality: number): { width: string; color: string } {
  // avgQuality is 0..5. Below 2 = red, 2–3 = amber, 3+ = green
  const pct = Math.min(100, (avgQuality / 5) * 100);
  const color =
    avgQuality < 2
      ? "bg-grade-again"
      : avgQuality < 3
      ? "bg-grade-hard"
      : "bg-grade-good";
  return { width: `${pct.toFixed(0)}%`, color };
}

function qualityLabel(avgQuality: number): string {
  if (avgQuality < 1.5) return "Struggling";
  if (avgQuality < 2.5) return "Shaky";
  if (avgQuality < 3.5) return "Developing";
  return "Solid";
}

/**
 * Shows top 5 weakest topic areas based on average grade over last 30 reviews.
 * Groups by (deck, topic) when topic data is available, else by deck.
 * Each row has a "Drill" shortcut that navigates to the drill page filtered
 * to that deck. Collapses when no review data yet.
 */
export default function WeakSpotsPanel() {
  const [data, setData] = useState<WeakSpotsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/drill/weakspots")
      .then((r) => r.json())
      .then((d: WeakSpotsData) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : "Network error"));
  }, []);

  if (error || !data || data.weakSpots.length === 0) {
    // Silently hidden when no data yet
    return null;
  }

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Weak Spots</h2>
        <span className="text-xs text-slate-500">(last 30 reviews, by topic)</span>
      </div>

      <ul className="space-y-2.5">
        {data.weakSpots.map((spot) => {
          const bar = qualityBar(spot.avgQuality);
          // Build a drill URL: filter by deck (deepest filter we have without topic routing)
          const drillHref =
            spot.deck === "blind75" || spot.deck === "sysdesign"
              ? `/?deck=${spot.deck}`
              : "/";
          return (
            <li key={`${spot.deck}::${spot.topic ?? "all"}`} className="space-y-1">
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="text-slate-300 font-medium truncate">{spot.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-500">
                    {qualityLabel(spot.avgQuality)} &middot; {spot.reviewCount}
                  </span>
                  <a
                    href={drillHref}
                    className="
                      px-2 py-0.5 rounded-full
                      bg-brand/20 text-brand-light border border-brand/30
                      hover:bg-brand/40 hover:text-white
                      transition-colors text-xs font-medium
                    "
                    title={`Drill ${spot.label}`}
                  >
                    Drill
                  </a>
                </div>
              </div>
              <div className="h-1.5 w-full bg-surface-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${bar.color}`}
                  style={{ width: bar.width }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-slate-600">
        Lower bar = lower average grade. Focus here to improve.
      </p>
    </div>
  );
}
