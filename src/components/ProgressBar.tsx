"use client";

interface ProgressBarProps {
  due: number;
  total: number;
  reviewedToday: number;
}

export default function ProgressBar({
  due,
  total,
  reviewedToday,
}: ProgressBarProps) {
  const donePct = total > 0 ? Math.round(((total - due) / total) * 100) : 0;

  return (
    <div className="w-full px-4 py-3 bg-surface-card border-b border-surface-border">
      {/* Stats row — wraps gracefully on narrow screens */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-sm">
        <span className="text-slate-400">
          Due:{" "}
          <span className="font-semibold text-brand-light">{due}</span>
        </span>
        <span className="text-slate-400">
          Total:{" "}
          <span className="font-semibold text-slate-200">{total}</span>
        </span>
        <span className="text-slate-400">
          Today:{" "}
          <span className="font-semibold text-grade-good">{reviewedToday}</span>
        </span>
        <span className="ml-auto text-slate-400 tabular-nums">
          {donePct}% done
        </span>
      </div>

      {/* Progress rail */}
      <div className="h-2 w-full rounded-full bg-surface-border overflow-hidden">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${donePct}%` }}
        />
      </div>
    </div>
  );
}
