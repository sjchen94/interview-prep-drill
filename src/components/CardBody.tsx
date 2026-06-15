"use client";

interface CardBodyProps {
  title: string;
  bodyMd: string;
  revealed: boolean;
}

/** Split body_md into the question (always shown) and the answer section (revealed on tap).
 *  The answer starts at "### Hints" (blind75) or "### Key Discussion Points" (sysdesign).
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

export default function CardBody({ title, bodyMd, revealed }: CardBodyProps) {
  const { question, answer } = splitBody(bodyMd);

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
            ${revealed ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"}
          `}
          aria-hidden={!revealed}
        >
          <div className="border-t border-surface-border pt-3 mt-3">
            <pre className="whitespace-pre-wrap break-words font-sans text-sm sm:text-base text-slate-300 leading-relaxed">
              {answer}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
