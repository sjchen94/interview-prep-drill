"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DeckBadge from "@/components/DeckBadge";

interface ProblemRow {
  id: string;
  deck: string;
  source_path: string;
  title: string;
  body_md: string;
  ef: number | null;
  interval: number | null;
  reps: number | null;
  due_at: number | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  arrays: "Arrays",
  strings: "Strings",
  "binary-search": "Binary Search",
  trees: "Trees",
  graphs: "Graphs",
  dp: "Dynamic Programming",
  "linked-list": "Linked List",
};

function getCategory(row: ProblemRow): string {
  if (row.deck === "sysdesign") return "System Design";
  const seg = row.source_path.split("/")[1] ?? "";
  return CATEGORY_LABELS[seg] ?? seg.replace(/-/g, " ");
}

function splitBodyMd(bodyMd: string): { question: string; answer: string | null } {
  const withoutTitle = bodyMd.replace(/^##\s[^\n]+\n+/, "");
  const match = /\n### (Solution|Hints|Key Discussion Points)/.exec(withoutTitle);
  if (!match) return { question: withoutTitle.trim(), answer: null };
  return {
    question: withoutTitle.slice(0, match.index).trim(),
    answer: withoutTitle.slice(match.index + 1).trim(),
  };
}

type DeckFilter = "all" | "blind75" | "sysdesign";

export default function ProblemsPage() {
  const [rows, setRows] = useState<ProblemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deckFilter, setDeckFilter] = useState<DeckFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/problems")
      .then((r) => r.json())
      .then((data: ProblemRow[]) => {
        setRows(data);
        setLoading(false);
      });
  }, []);

  // Derive unique categories for the selected deck
  const categories = useMemo(() => {
    const seen = new Set<string>();
    rows
      .filter((r) => deckFilter === "all" || r.deck === deckFilter)
      .forEach((r) => seen.add(getCategory(r)));
    return Array.from(seen).sort();
  }, [rows, deckFilter]);

  // Reset category filter when deck changes
  function handleDeckChange(d: DeckFilter) {
    setDeckFilter(d);
    setCategoryFilter("all");
    setExpanded(null);
    setShowAnswer(null);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (deckFilter !== "all" && r.deck !== deckFilter) return false;
      if (categoryFilter !== "all" && getCategory(r) !== categoryFilter) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, deckFilter, categoryFilter, search]);

  function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
      setShowAnswer(null);
    } else {
      setExpanded(id);
      setShowAnswer(null);
    }
  }

  const deckTabs: { value: DeckFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "blind75", label: "Blind 75" },
    { value: "sysdesign", label: "Sys Design" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-surface/90 backdrop-blur-sm border-b border-surface-border">
        <div className="flex items-center justify-between px-4 py-2 max-w-2xl mx-auto">
          <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
            Interview Prep
          </h1>
          <nav className="flex gap-1">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-surface-card transition-colors"
            >
              Drill
            </Link>
            <span className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-100 bg-surface-card">
              Browse
            </span>
          </nav>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 pb-8 space-y-4">
          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search problems..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-card border border-surface-border text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Deck filter */}
          <div className="flex gap-2">
            {deckTabs.map((t) => (
              <button
                key={t.value}
                onClick={() => handleDeckChange(t.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  deckFilter === t.value
                    ? "bg-brand text-white"
                    : "bg-surface-card text-slate-400 hover:text-slate-100 border border-surface-border"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Category filter — shown when a single deck is selected */}
          {deckFilter !== "all" && categories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  categoryFilter === "all"
                    ? "bg-brand/20 text-brand-light border border-brand/40"
                    : "bg-surface-card text-slate-400 hover:text-slate-200 border border-surface-border"
                }`}
              >
                All topics
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    categoryFilter === cat
                      ? "bg-brand/20 text-brand-light border border-brand/40"
                      : "bg-surface-card text-slate-400 hover:text-slate-200 border border-surface-border"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Count */}
          {!loading && (
            <p className="text-xs text-slate-500">
              {filtered.length} problem{filtered.length !== 1 ? "s" : ""}
              {search ? ` matching "${search}"` : ""}
            </p>
          )}

          {/* Problem list */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No problems match your filters.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((row) => {
                const isOpen = expanded === row.id;
                const isAnswered = showAnswer === row.id;
                const category = getCategory(row);
                const { question, answer } = splitBodyMd(row.body_md);

                return (
                  <div
                    key={row.id}
                    className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden"
                  >
                    {/* Row header — click to expand */}
                    <button
                      onClick={() => toggleExpand(row.id)}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                    >
                      <DeckBadge deck={row.deck} />
                      <span className="text-xs text-slate-500 hidden sm:block shrink-0">
                        {category}
                      </span>
                      <span className="flex-1 text-sm font-medium text-slate-100 truncate">
                        {row.title}
                      </span>
                      {row.reps != null && row.reps > 0 && (
                        <span className="text-xs text-slate-600 shrink-0 hidden sm:block">
                          rep {row.reps}
                        </span>
                      )}
                      <span
                        className={`text-slate-400 text-xs transition-transform duration-200 shrink-0 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      >
                        ▾
                      </span>
                    </button>

                    {/* Expanded content */}
                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-surface-border pt-3 space-y-3">
                        {/* Category chip on mobile */}
                        <span className="sm:hidden inline-block text-xs text-slate-500 bg-surface rounded px-2 py-0.5 border border-surface-border">
                          {category}
                        </span>

                        {/* Question body */}
                        <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-300 leading-relaxed">
                          {question}
                        </pre>

                        {/* Show Answer button */}
                        {answer && !isAnswered && (
                          <button
                            onClick={() => setShowAnswer(row.id)}
                            className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-medium transition-colors"
                          >
                            Show Answer
                          </button>
                        )}

                        {/* Answer section */}
                        {answer && isAnswered && (
                          <div className="border-t border-surface-border pt-3">
                            <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-300 leading-relaxed">
                              {answer}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
