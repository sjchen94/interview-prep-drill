"use client";

import { useEffect, useState } from "react";

interface DailyCount {
  date: string;
  count: number;
}

interface EfBucket {
  label: string;
  count: number;
}

interface TopicStat {
  label: string;
  avgQuality: number;
  reviewCount: number;
  avgInterval: number;
}

interface AnalyticsData {
  dailyCounts: DailyCount[];
  streakDays: number;
  bestStreakDays: number;
  efDistribution: EfBucket[];
  topicStats: TopicStat[];
  totalReviews: number;
  masteredCount: number;
}

function qualityColor(q: number): string {
  if (q < 2) return "text-grade-again";
  if (q < 3) return "text-grade-hard";
  if (q < 4) return "text-grade-good";
  return "text-grade-easy";
}

function qualityBg(q: number): string {
  if (q < 2) return "bg-grade-again";
  if (q < 3) return "bg-grade-hard";
  if (q < 4) return "bg-grade-good";
  return "bg-grade-easy";
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Collapsible analytics panel showing:
 * - 14-day review bar chart
 * - Streak & mastery stats
 * - EF distribution mini-bars
 * - Per-topic avg quality + avg interval table (sorted weakest first)
 */
export default function AnalyticsPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only fetch when opened for the first time
  useEffect(() => {
    if (!open || data !== null) return;
    setLoading(true);
    fetch("/api/drill/analytics")
      .then((r) => r.json())
      .then((d: AnalyticsData) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Network error");
        setLoading(false);
      });
  }, [open, data]);

  const maxDaily = data
    ? Math.max(1, ...data.dailyCounts.map((d) => d.count))
    : 1;

  const maxEf = data ? Math.max(1, ...data.efDistribution.map((b) => b.count)) : 1;

  return (
    <div className="w-full bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] hover:bg-surface-border/30 transition-colors touch-manipulation"
        aria-expanded={open}
        aria-controls="analytics-panel-body"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">Analytics</span>
          {data && (
            <span className="text-xs text-slate-500">
              {data.streakDays > 0 && (
                <span className="text-grade-good font-medium">
                  {data.streakDays}d streak ·{" "}
                </span>
              )}
              {data.totalReviews} reviews · {data.masteredCount} mastered
            </span>
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
        id="analytics-panel-body"
        className={`transition-all duration-300 overflow-hidden ${open ? "max-h-[600px]" : "max-h-0"}`}
      >
        <div className="px-4 pb-4 pt-1 space-y-5 overflow-y-auto max-h-[580px] scroll-area">
          {loading && (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <p className="text-xs text-grade-again text-center py-4">{error}</p>
          )}

          {data && !loading && (
            <>
              {/* ——— Headline stats ——— */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <StatPill
                  value={data.totalReviews}
                  label="Total Reviews"
                  color="text-slate-200"
                />
                <StatPill
                  value={`${data.streakDays}d`}
                  label="Streak"
                  color="text-grade-good"
                  sub={data.bestStreakDays > data.streakDays ? `best ${data.bestStreakDays}d` : undefined}
                />
                <StatPill
                  value={data.masteredCount}
                  label="Mastered"
                  color="text-grade-easy"
                  sub="interval ≥21d"
                />
              </div>

              {/* ——— 14-day bar chart ——— */}
              <section>
                <h3 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                  14-Day Activity
                </h3>
                <div className="flex items-end gap-[3px] h-16">
                  {data.dailyCounts.map((d, i) => {
                    const pct = (d.count / maxDaily) * 100;
                    const isToday = i === data.dailyCounts.length - 1;
                    return (
                      <div
                        key={d.date}
                        className="flex-1 flex flex-col items-center justify-end gap-0.5"
                        title={`${shortDate(d.date)}: ${d.count} review${d.count !== 1 ? "s" : ""}`}
                      >
                        <div
                          className={`w-full rounded-sm transition-all duration-300 ${
                            d.count === 0
                              ? "bg-surface-border"
                              : isToday
                              ? "bg-brand"
                              : "bg-brand/50"
                          }`}
                          style={{ height: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-slate-600 mt-1">
                  <span>{shortDate(data.dailyCounts[0].date)}</span>
                  <span>Today</span>
                </div>
              </section>

              {/* ——— EF distribution ——— */}
              {data.efDistribution.some((b) => b.count > 0) && (
                <section>
                  <h3 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                    Easiness Factor Distribution
                  </h3>
                  <div className="space-y-1.5">
                    {data.efDistribution.map((bucket) => {
                      const pct = (bucket.count / maxEf) * 100;
                      return (
                        <div key={bucket.label} className="flex items-center gap-2 text-xs">
                          <span className="w-16 shrink-0 text-slate-500 text-right">
                            {bucket.label}
                          </span>
                          <div className="flex-1 h-3 bg-surface-border rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-brand/60 transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-6 text-slate-500 shrink-0">{bucket.count}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5">
                    Low EF = cards you keep struggling with (good candidates for focused practice).
                  </p>
                </section>
              )}

              {/* ——— Per-topic stats ——— */}
              {data.topicStats.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                    Topic Performance
                  </h3>
                  <div className="space-y-1.5">
                    {data.topicStats.map((t) => (
                      <div
                        key={t.label}
                        className="flex items-center gap-3 text-xs"
                      >
                        <span className="flex-1 text-slate-300 truncate">{t.label}</span>
                        <span className={`shrink-0 font-semibold tabular-nums ${qualityColor(t.avgQuality)}`}>
                          {t.avgQuality.toFixed(1)}
                        </span>
                        <div className="w-16 h-2 bg-surface-border rounded-full overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${qualityBg(t.avgQuality)}`}
                            style={{ width: `${Math.min(100, (t.avgQuality / 5) * 100).toFixed(0)}%` }}
                          />
                        </div>
                        <span className="text-slate-600 shrink-0 w-10 text-right">
                          {Math.round(t.avgInterval)}d
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5">
                    Avg quality (0–5) · avg interval. Sorted weakest first.
                  </p>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatPill({
  value,
  label,
  color,
  sub,
}: {
  value: number | string;
  label: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-surface-border px-2 py-2">
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-600">{sub}</p>}
    </div>
  );
}
