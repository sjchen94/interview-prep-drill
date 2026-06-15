"use client";

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

interface GradeButtonsProps {
  onGrade: (quality: number, label: string) => void;
  disabled?: boolean;
}

export default function GradeButtons({ onGrade, disabled }: GradeButtonsProps) {
  return (
    <div className="w-full">
      <p className="text-xs text-slate-500 mb-2 text-center">Rate your recall</p>
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
