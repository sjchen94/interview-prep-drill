"use client";

interface CardBodyProps {
  title: string;
  bodyMd: string;
  revealed: boolean;
  /**
   * Graduated disclosure step: 0 = question only, 1 = hint1, 2 = hint2,
   * 3 = full answer. Ignored (treated as full reveal) when `revealed` is
   * false or when the card has no parseable hint steps.
   */
  hintStep?: number;
}

interface AnswerParts {
  /** Short progressive hints shown before the full answer (0-2 entries). */
  hints: string[];
  /** The full answer text (always the final disclosure step). */
  full: string;
}

/** Split body_md into the question (always shown) and the answer section (revealed on tap).
 *  The answer starts at "### Solution" (blind75/ml-infra), "### Hints" (legacy seed data),
 *  or "### Key Discussion Points" (sysdesign).
 *  Other ### headings like "### Example" and "### Constraints" stay in the question.
 *  The leading ## Title heading is stripped since the title is already rendered separately.
 */
function splitBody(bodyMd: string): { question: string; answer: string | null } {
  const withoutTitle = bodyMd.replace(/^##\s[^\n]+\n+/, "");
  const match = /\n### (Solution|Hints|Key Discussion Points)/.exec(withoutTitle);
  if (!match) return { question: withoutTitle.trim(), answer: null };
  return {
    question: withoutTitle.slice(0, match.index).trim(),
    answer: withoutTitle.slice(match.index + 1).trim(),
  };
}

/**
 * Derive progressive hint steps from the answer section so the answer can be
 * revealed gradually instead of all at once.
 *
 * - "### Solution" (blind75/ml-infra): hint1 = the **Approach** line,
 *   hint2 = the **Key insight** line (if present). Code block + full text
 *   are reserved for the final "full" step.
 * - "### Key Discussion Points" (sysdesign): hint1 = point 1, hint2 = points 1-2.
 * - "### Hints" (legacy bullet-list hints): each bullet is its own step,
 *   capped at 2 progressive hints.
 * - Anything else: no progressive hints — single-step reveal.
 */
function deriveHints(answer: string): AnswerParts {
  const approachMatch = /\*\*Approach:\*\*\s*([^\n]+)/.exec(answer);
  const insightMatch = /\*\*Key insight:\*\*\s*([^\n]+)/.exec(answer);
  if (approachMatch) {
    const hints: string[] = [`Approach: ${approachMatch[1]!.trim()}`];
    if (insightMatch) hints.push(`Key insight: ${insightMatch[1]!.trim()}`);
    return { hints, full: answer };
  }

  // "### Key Discussion Points" — numbered list, e.g. "1. **Data model:** ..."
  const bulletLines = answer
    .split("\n")
    .filter((l) => /^\d+\.\s/.test(l.trim()) || /^-\s/.test(l.trim()));
  if (bulletLines.length >= 2) {
    const hints: string[] = [
      bulletLines[0]!.trim(),
      `${bulletLines[0]!.trim()}\n${bulletLines[1]!.trim()}`,
    ];
    return { hints, full: answer };
  }

  // Legacy "### Hints" bullet list — each bullet already IS a hint.
  if (bulletLines.length === 1) {
    return { hints: [bulletLines[0]!.trim()], full: answer };
  }

  // No structure we recognize — single-step reveal (no progressive hints).
  return { hints: [], full: answer };
}

export default function CardBody({ title, bodyMd, revealed, hintStep }: CardBodyProps) {
  const { question, answer } = splitBody(bodyMd);
  const { hints, full } = answer ? deriveHints(answer) : { hints: [], full: "" };

  // Determine what to show at the current hintStep.
  // step 0: nothing (pre-reveal); step 1..hints.length: that hint; beyond: full.
  const step = hintStep ?? (hints.length + 1); // default: full reveal if not specified
  const showingHintOnly = step > 0 && step <= hints.length;
  const displayText = showingHintOnly ? hints[step - 1]! : full;

  return (
    <div className="w-full">
      {/* Question heading */}
      <h2 className="text-base sm:text-xl font-semibold leading-snug text-slate-100 mb-3">
        {title}
      </h2>

      {/* Question body — always visible */}
      {question && (
        <pre className="whitespace-pre-wrap break-words font-sans text-sm sm:text-base text-slate-300 leading-relaxed mb-1">
          {question}
        </pre>
      )}

      {/* Answer / hints — revealed on tap */}
      {answer && (
        <div
          className={`
            transition-all duration-300 overflow-hidden
            ${revealed ? "max-h-[3000px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"}
          `}
          aria-hidden={!revealed}
        >
          <div className="border-t border-surface-border pt-3 mt-3">
            {showingHintOnly && (
              <p className="text-xs font-semibold text-brand-light mb-2 uppercase tracking-wide">
                Hint {step} of {hints.length}
              </p>
            )}
            <pre className="whitespace-pre-wrap break-words font-sans text-sm sm:text-base text-slate-300 leading-relaxed">
              {displayText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/** Number of progressive hint steps available for a card (0 = no hints, straight to full). */
export function countHintSteps(bodyMd: string): number {
  const { answer } = splitBody(bodyMd);
  if (!answer) return 0;
  return deriveHints(answer).hints.length;
}
