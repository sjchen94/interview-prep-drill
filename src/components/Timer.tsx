"use client";

import { useEffect, useRef, useState } from "react";

interface TimerProps {
  running: boolean;
  onReset?: () => void;
}

export default function Timer({ running, onReset }: TimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  // Allow parent to reset via onReset triggering elapsed reset
  useEffect(() => {
    setElapsed(0);
  }, [onReset]);

  const mins = Math.floor(elapsed / 60)
    .toString()
    .padStart(2, "0");
  const secs = (elapsed % 60).toString().padStart(2, "0");

  const isLong = elapsed >= 120; // 2 min warning

  return (
    <div
      className={`flex items-center gap-1.5 tabular-nums font-mono text-base sm:text-lg font-semibold ${
        isLong ? "text-grade-again" : "text-slate-300"
      }`}
      aria-live="polite"
      aria-label={`Timer: ${mins}:${secs}`}
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
