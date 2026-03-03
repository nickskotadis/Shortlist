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
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm mb-4">
          {/* Search row */}
          <div className="relative mb-3">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
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
              className="w-full border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white transition"
            />
          </div>

          {/* Variant pills row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["all", "A", "B"] as VariantFilter[]).map((v) => {
              const activeClass =
                v === "B"
                  ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 text-indigo-700"
                  : v === "A"
                  ? "border-slate-400 bg-slate-50 ring-1 ring-slate-400 text-slate-700"
                  : "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 text-indigo-700";
              const label = v === "all" ? `All (${stats.length})` : `Variant ${v}`;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVariantFilter(v)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    variantFilter === v
                      ? activeClass
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Result count + clear */}
          {isFiltered && (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span>Showing {filtered.length} of {stats.length}</span>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={clearFilters}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Clear filters ×
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Prompt Version
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Variant
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Count
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Avg Score
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Pass Rate
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                👍 Rate
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-slate-700">
                  {row.prompt_version}
                </td>
                <td className="px-6 py-4">
                  {row.ab_variant ? (
                    <span
                      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                        row.ab_variant === "B"
                          ? "text-indigo-700 bg-indigo-50"
                          : "text-slate-500 bg-slate-100"
                      }`}
                    >
                      {row.ab_variant}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right text-slate-600">{row.count}</td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={`font-medium ${
                      row.avg_overall >= 7
                        ? "text-emerald-600"
                        : row.avg_overall >= 5.5
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  >
                    {row.avg_overall}/10
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={`font-medium ${
                      row.pass_rate >= 80
                        ? "text-emerald-600"
                        : row.pass_rate >= 60
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  >
                    {row.pass_rate}%
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={`font-medium ${
                      row.feedback_positive_rate >= 70 ? "text-emerald-600" : "text-slate-500"
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
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">
                  {isFiltered ? (
                    <span>
                      No rows match your filters.{" "}
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-indigo-600 hover:text-indigo-700 font-medium"
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
