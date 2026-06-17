"use client";

import { useEffect, useRef, useState } from "react";

interface TimerProps {
  running: boolean;
  /** Passing a new value here resets the timer (use a counter that increments) */
  onReset?: number | undefined;
  /**
   * When set, the timer counts DOWN from this many seconds instead of counting up.
   * When it reaches 0, `onExpire` is called (once).
   */
  countdownSeconds?: number;
  /** Called once when a countdown reaches 0. */
  onExpire?: () => void;
}

export default function Timer({
  running,
  onReset,
  countdownSeconds,
  onExpire,
}: TimerProps) {
  const isCountdown = typeof countdownSeconds === "number" && countdownSeconds > 0;
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiredRef = useRef(false);

  // Reset when onReset changes
  useEffect(() => {
    setElapsed(0);
    expiredRef.current = false;
  }, [onReset]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((e) => {
          const next = e + 1;
          // Countdown expire
          if (isCountdown && next >= countdownSeconds! && !expiredRef.current) {
            expiredRef.current = true;
            // Fire expire after render cycle
            setTimeout(() => onExpire?.(), 0);
          }
          return next;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, isCountdown, countdownSeconds]);

  const displaySeconds = isCountdown
    ? Math.max(0, countdownSeconds! - elapsed)
    : elapsed;

  const mins = Math.floor(displaySeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (displaySeconds % 60).toString().padStart(2, "0");

  // Colour logic:
  // - Stopwatch: red when >= 2 min
  // - Countdown: green when > 50%, amber when 25–50%, red when < 25%
  let colorClass = "text-slate-300";
  if (isCountdown) {
    const ratio = displaySeconds / countdownSeconds!;
    if (ratio > 0.5) colorClass = "text-grade-good";
    else if (ratio > 0.25) colorClass = "text-grade-hard";
    else colorClass = "text-grade-again";
    if (displaySeconds === 0) colorClass = "text-grade-again animate-pulse";
  } else if (elapsed >= 120) {
    colorClass = "text-grade-again";
  }

  return (
    <div
      className={`flex items-center gap-1.5 tabular-nums font-mono text-base sm:text-lg font-semibold ${colorClass}`}
      aria-live="polite"
      aria-label={`Timer: ${mins}:${secs}${isCountdown ? " remaining" : ""}`}
    >
      <svg
        className="w-4 h-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span>
        {mins}:{secs}
      </span>
    </div>
  );
}
