"use client";

import { useState } from "react";

export type GradeLabel = "Again" | "Hard" | "Good" | "Easy";

interface Grade {
  label: GradeLabel;
  quality: 0 | 1 | 3 | 5;
  colorClass: string;
  description: string;
}

const GRADES: Grade[] = [
  {
    label: "Again",
    quality: 0,
    colorClass:
      "bg-grade-again/20 border-grade-again text-grade-again hover:bg-grade-again hover:text-white active:scale-95",
    description: "Total blackout",
  },
  {
    label: "Hard",
    quality: 1,
    colorClass:
      "bg-grade-hard/20 border-grade-hard text-grade-hard hover:bg-grade-hard hover:text-white active:scale-95",
    description: "Incorrect but close",
  },
  {
    label: "Good",
    quality: 3,
    colorClass:
      "bg-grade-good/20 border-grade-good text-grade-good hover:bg-grade-good hover:text-white active:scale-95",
    description: "Correct with effort",
  },
  {
    label: "Easy",
    quality: 5,
    colorClass:
      "bg-grade-easy/20 border-grade-easy text-grade-easy hover:bg-grade-easy hover:text-white active:scale-95",
    description: "Perfect recall",
  },
];

// Map AI quality (0-5) back to the nearest grade bucket
function qualityToGrade(q: number): Grade {
  if (q <= 0) return GRADES[0]!; // Again
  if (q <= 2) return GRADES[1]!; // Hard
  if (q <= 3) return GRADES[2]!; // Good
  return GRADES[3]!;             // Easy
}

interface GradeButtonsProps {
  onGrade: (quality: number, label: string) => void;
  disabled?: boolean;
  /** Card id + response text for AI grading (both required to show the button). */
  cardId?: string;
  responseMd?: string;
}

export default function GradeButtons({
  onGrade,
  disabled,
  cardId,
  responseMd,
}: GradeButtonsProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    quality: number;
    gaps: string[];
    suggested: Grade;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const canAiGrade =
    !!cardId && !!responseMd && responseMd.trim().length > 0;

  const handleAiGrade = async () => {
    if (!canAiGrade || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const res = await fetch("/api/drill/ai-grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: cardId, response_md: responseMd }),
      });
      const data = (await res.json()) as {
        quality?: number;
        gaps?: string[];
        error?: string;
      };
      if (data.error || data.quality === undefined) {
        setAiError(data.error ?? "Unexpected response");
      } else {
        const suggested = qualityToGrade(data.quality);
        setAiResult({
          quality: data.quality,
          gaps: data.gaps ?? [],
          suggested,
        });
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Network error");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      <p className="text-xs text-slate-500 mb-2 text-center">Rate your recall</p>

      {/* AI Grade button (only shown when a response is present) */}
      {canAiGrade && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleAiGrade}
            disabled={disabled || aiLoading}
            className="
              flex-1 min-h-[40px] rounded-xl border-2
              border-brand/60 bg-brand/10 text-brand-light
              hover:bg-brand/20 hover:border-brand
              active:scale-95 font-medium text-sm
              transition-all duration-150 touch-manipulation
              disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center justify-center gap-1.5
            "
          >
            {aiLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-brand/60 border-t-transparent rounded-full animate-spin" />
                AI grading…
              </>
            ) : (
              <>
                <span aria-hidden="true">✦</span> AI Grade
              </>
            )}
          </button>
        </div>
      )}

      {/* AI result banner */}
      {aiResult && (
        <div className="rounded-xl border border-brand/30 bg-brand/5 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-300">
              AI suggests:
              <span className="ml-1.5 text-brand-light font-bold">
                {aiResult.suggested.label}
              </span>
              <span className="ml-1 text-slate-500 font-normal">
                ({aiResult.quality}/5)
              </span>
            </span>
            <button
              onClick={() => onGrade(aiResult.suggested.quality, aiResult.suggested.label)}
              disabled={disabled}
              className="
                shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold
                bg-brand hover:bg-brand-dark text-white
                transition-colors disabled:opacity-40
              "
            >
              Accept
            </button>
          </div>
          {aiResult.gaps.length > 0 && (
            <ul className="space-y-0.5">
              {aiResult.gaps.map((gap, i) => (
                <li key={i} className="text-xs text-slate-400 flex items-start gap-1">
                  <span className="text-grade-again shrink-0 mt-0.5">•</span>
                  {gap}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-600 italic">You can override below.</p>
        </div>
      )}

      {aiError && (
        <p className="text-xs text-grade-again text-center">{aiError}</p>
      )}

      {/* 2-col grid on mobile, 4-col on sm+ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {GRADES.map((g) => (
          <button
            key={g.label}
            onClick={() => onGrade(g.quality, g.label)}
            disabled={disabled}
            className={`
              flex flex-col items-center justify-center
              min-h-[56px] sm:min-h-[64px]
              px-2 py-3
              rounded-xl border-2 font-semibold text-sm
              transition-all duration-150
              touch-manipulation select-none
              disabled:opacity-40 disabled:cursor-not-allowed
              ${g.colorClass}
            `}
            aria-label={`${g.label} — ${g.description}`}
          >
            <span className="text-base sm:text-lg">{g.label}</span>
            <span className="text-xs font-normal opacity-70 mt-0.5 hidden sm:block">
              {g.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
