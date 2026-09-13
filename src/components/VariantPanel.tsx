"use client";

import { useCallback, useEffect, useState } from "react";

export type VariantMutation = "constraints" | "domain" | "invariant" | "surprise";

interface Variant {
  title: string;
  prompt: string;
  mutationNote: string;
  mutation: VariantMutation;
}

interface VariantPanelProps {
  cardId: string;
  /**
   * Bumping this value tells the panel to auto-fetch a fresh variant on the
   * next render — used when the user auto-loads variants for every new card.
   */
  autoFetchKey?: number;
}

const MUTATION_OPTIONS: { value: VariantMutation; label: string; hint: string }[] = [
  { value: "surprise", label: "Surprise", hint: "LLM picks the sharpest mutation" },
  { value: "constraints", label: "Constraints", hint: "Swap or tighten the constraints" },
  { value: "domain", label: "Reframe", hint: "Same shape, unfamiliar domain" },
  { value: "invariant", label: "Invariant", hint: "Add one extra requirement" },
];

export default function VariantPanel({ cardId, autoFetchKey }: VariantPanelProps) {
  const [variant, setVariant] = useState<Variant | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutation, setMutation] = useState<VariantMutation>("surprise");

  const fetchVariant = useCallback(
    async (mode: VariantMutation) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/drill/variant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ card_id: cardId, mutation: mode }),
        });
        const data = (await res.json()) as
          | { title: string; prompt: string; mutationNote: string; mutation: VariantMutation }
          | { error: string };
        if ("error" in data) {
          setError(data.error);
        } else {
          setVariant({
            title: data.title,
            prompt: data.prompt,
            mutationNote: data.mutationNote,
            mutation: data.mutation,
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
      } finally {
        setLoading(false);
      }
    },
    [cardId],
  );

  // Reset when the card changes
  useEffect(() => {
    setVariant(null);
    setError(null);
  }, [cardId]);

  // Auto-fetch when the parent bumps autoFetchKey (i.e. auto-variant mode is on
  // and a new card just loaded). Runs once per (card, key) combination.
  useEffect(() => {
    if (autoFetchKey === undefined || autoFetchKey === 0) return;
    // Kick off the fetch with whatever mutation mode is currently selected.
    fetchVariant(mutation);
    // Intentional: we only want to react to autoFetchKey / cardId, not mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetchKey, cardId]);

  return (
    <div className="bg-surface-card border border-brand/40 rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-brand-light">
            Adversarial Variant
          </h3>
          <p className="text-xs text-slate-500">
            Same skill, mutated framing. Tests recognition, not memorization.
          </p>
        </div>
      </div>

      {/* Mutation picker */}
      <div className="flex flex-wrap gap-1.5">
        {MUTATION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setMutation(opt.value)}
            title={opt.hint}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              mutation === opt.value
                ? "bg-brand text-white"
                : "bg-surface border border-surface-border text-slate-400 hover:text-slate-100"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Generate button */}
      <button
        type="button"
        onClick={() => fetchVariant(mutation)}
        disabled={loading}
        className="
          w-full min-h-[40px] rounded-xl
          bg-brand/20 border border-brand/60 text-brand-light
          hover:bg-brand hover:text-white active:scale-95
          font-medium text-sm
          transition-all duration-150 touch-manipulation disabled:opacity-50
        "
      >
        {loading
          ? "Generating variant…"
          : variant
            ? "Regenerate variant"
            : "Generate variant"}
      </button>

      {error && (
        <p className="text-xs text-grade-again bg-grade-again/10 border border-grade-again/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {variant && (
        <div className="border-t border-surface-border pt-3 space-y-2">
          <h4 className="text-sm sm:text-base font-semibold text-slate-100">
            {variant.title}
          </h4>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-300 leading-relaxed">
            {variant.prompt}
          </pre>
          {variant.mutationNote && (
            <p className="text-xs text-slate-500 italic pt-1">
              Mutation: {variant.mutationNote}
            </p>
          )}
          <p className="text-xs text-slate-600">
            Answer this variant, then grade the underlying card normally — the
            SM-2 scheduler is unchanged.
          </p>
        </div>
      )}
    </div>
  );
}
