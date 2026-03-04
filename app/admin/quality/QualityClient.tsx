"use client";

import { useState } from "react";

export interface VersionStats {
  prompt_version: string;
  ab_variant: string | null;
  count: number;
  avg_overall: number;
  pass_rate: number;
  feedback_positive_rate: number;
}

type VariantFilter = "all" | "A" | "B";

export default function QualityClient({
  stats,
  totalGens,
}: {
  stats: VersionStats[];
  totalGens: number;
}) {
  const [search, setSearch] = useState("");
  const [variantFilter, setVariantFilter] = useState<VariantFilter>("all");

  const clearFilters = () => {
    setSearch("");
    setVariantFilter("all");
  };

  const filtered = stats.filter((row) => {
    if (search && !row.prompt_version.toLowerCase().includes(search.toLowerCase())) return false;
    if (variantFilter !== "all") {
      const effective = row.ab_variant ?? "A";
      if (effective !== variantFilter) return false;
    }
    return true;
  });

  const isFiltered = search !== "" || variantFilter !== "all";

  return (
    <>
      {/* Filter toolbar */}
      {stats.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4 mb-4">
          {/* Search row */}
          <div className="relative mb-3">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)] pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by prompt version..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-[var(--color-border)] rounded-lg pl-9 pr-4 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--color-elevated)] transition"
            />
          </div>

          {/* Variant pills row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["all", "A", "B"] as VariantFilter[]).map((v) => {
              const activeClass =
                v === "B"
                  ? "border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500 text-indigo-400"
                  : v === "A"
                  ? "border-[var(--color-text-tertiary)] bg-[var(--color-elevated)] ring-1 ring-[var(--color-text-tertiary)] text-[var(--color-text-secondary)]"
                  : "border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500 text-indigo-400";
              const label = v === "all" ? `All (${stats.length})` : `Variant ${v}`;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVariantFilter(v)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    variantFilter === v
                      ? activeClass
                      : "border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Result count + clear */}
          {isFiltered && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <span>Showing {filtered.length} of {stats.length}</span>
              <span className="text-[var(--color-separator)]">·</span>
              <button
                type="button"
                onClick={clearFilters}
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Clear filters ×
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border-subtle)]">
              <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Prompt Version
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Variant
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Count
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Avg Score
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Pass Rate
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                👍 Rate
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {filtered.map((row, i) => (
              <tr key={i} className="hover:bg-[var(--color-elevated)] transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-[var(--color-text-output)]">
                  {row.prompt_version}
                </td>
                <td className="px-6 py-4">
                  {row.ab_variant ? (
                    <span
                      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${
                        row.ab_variant === "B"
                          ? "text-indigo-400 bg-indigo-950/40 border-indigo-900/50"
                          : "text-[var(--color-text-secondary)] bg-[var(--color-elevated)] border-[var(--color-border)]"
                      }`}
                    >
                      {row.ab_variant}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--color-text-tertiary)]">—</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right text-[var(--color-text-secondary)]">{row.count}</td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={`font-medium ${
                      row.avg_overall >= 7
                        ? "text-emerald-400"
                        : row.avg_overall >= 5.5
                        ? "text-amber-400"
                        : "text-red-400"
                    }`}
                  >
                    {row.avg_overall}/10
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={`font-medium ${
                      row.pass_rate >= 80
                        ? "text-emerald-400"
                        : row.pass_rate >= 60
                        ? "text-amber-400"
                        : "text-red-400"
                    }`}
                  >
                    {row.pass_rate}%
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={`font-medium ${
                      row.feedback_positive_rate >= 70 ? "text-emerald-400" : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {row.feedback_positive_rate > 0
                      ? `${row.feedback_positive_rate}%`
                      : "—"}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-[var(--color-text-tertiary)]">
                  {isFiltered ? (
                    <span>
                      No rows match your filters.{" "}
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                      >
                        Clear filters
                      </button>
                    </span>
                  ) : (
                    "No generation data yet."
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
