"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { FREE_FIT_LIMIT } from "@/lib/constants";
import type { FitScoreResult, FitDimension } from "@/lib/types";

// ── Score ring (0–100 scale) ──────────────────────────────────────────────────

function FitRing({ score }: { score: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(score, 100)) / 100;
  const offset = circumference * (1 - pct);
  const color = score >= 80 ? "#34d399" : score >= 60 ? "#818cf8" : score >= 40 ? "#fbbf24" : "#f87171";

  return (
    <div className="relative inline-flex items-center justify-center w-28 h-28 shrink-0">
      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r={radius} fill="none" stroke="#1A1D38" strokeWidth="8" />
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="block text-xs text-[#5A5A80]">/ 100</span>
      </div>
    </div>
  );
}

// ── Dimension bar ─────────────────────────────────────────────────────────────

function DimensionBar({
  label,
  dimension,
}: {
  label: string;
  dimension: FitDimension;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.max(0, Math.min(dimension.score, 100));
  const color =
    pct >= 80
      ? "bg-emerald-500"
      : pct >= 60
      ? "bg-indigo-500"
      : pct >= 40
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-[#E0E0F8] truncate">{label}</span>
          {dimension.gaps.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 text-xs text-[#5A5A80] hover:text-[#8888A8] transition-colors"
            >
              {expanded ? "▲" : `▼ ${dimension.gaps.length} gap${dimension.gaps.length > 1 ? "s" : ""}`}
            </button>
          )}
        </div>
        <span className="text-sm font-semibold text-[#EEEEFC] shrink-0">{pct}</span>
      </div>
      <div className="h-1.5 bg-[#1A1D38] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-[#8888A8] leading-relaxed">{dimension.explanation}</p>
      {expanded && dimension.gaps.length > 0 && (
        <ul className="space-y-1 pl-1">
          {dimension.gaps.map((gap, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-[#5A5A80]">
              <span className="text-amber-400 shrink-0">✗</span>
              {gap}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Recommendation badge ──────────────────────────────────────────────────────

const RECOMMENDATION_CONFIG = {
  strong_fit: {
    label: "Strong Fit",
    classes: "text-emerald-400 bg-emerald-950/30 border-emerald-900/40",
    description: "Apply with confidence.",
  },
  moderate_fit: {
    label: "Moderate Fit",
    classes: "text-indigo-400 bg-indigo-950/40 border-indigo-900/50",
    description: "Worth applying — address gaps in your cover letter.",
  },
  stretch: {
    label: "Stretch Role",
    classes: "text-amber-400 bg-amber-950/30 border-amber-900/40",
    description: "Significant gaps — apply if you can address them head-on.",
  },
  mismatch: {
    label: "Likely Mismatch",
    classes: "text-red-400 bg-red-950/30 border-red-900/40",
    description: "Fundamental misalignment on core requirements.",
  },
};

// ── Result panel ──────────────────────────────────────────────────────────────

function ResultPanel({ result }: { result: FitScoreResult }) {
  const rec = RECOMMENDATION_CONFIG[result.recommendation] ?? RECOMMENDATION_CONFIG.moderate_fit;

  const DIMENSION_LABELS: Record<keyof FitScoreResult["dimensions"], string> = {
    skills_match: "Skills Match",
    experience_level: "Experience Level",
    must_haves: "Must-Have Requirements",
    nice_to_haves: "Nice-to-Haves",
  };

  return (
    <div className="space-y-4">
      {/* Overall score card */}
      <div className="bg-[#0D1122] rounded-2xl border border-[#232548] p-6">
        <div className="flex items-start gap-6 flex-wrap">
          <FitRing score={result.overall} />
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${rec.classes}`}
              >
                {rec.label}
              </span>
              <span className="text-xs text-[#5A5A80]">{rec.description}</span>
            </div>
            <p className="text-sm text-[#C8C8F0] leading-relaxed">{result.summary}</p>
          </div>
        </div>
      </div>

      {/* Dimensions */}
      <div className="bg-[#0D1122] rounded-2xl border border-[#232548] p-6 space-y-5">
        <p className="text-xs font-semibold text-[#5A5A80] uppercase tracking-wide">Breakdown</p>
        {(Object.keys(result.dimensions) as Array<keyof FitScoreResult["dimensions"]>).map((key) => (
          <DimensionBar key={key} label={DIMENSION_LABELS[key]} dimension={result.dimensions[key]} />
        ))}
      </div>

      {/* Top strengths + gaps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {result.top_strengths.length > 0 && (
          <div className="bg-[#0D1122] rounded-2xl border border-[#232548] p-5 space-y-3">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
              Top Strengths
            </p>
            <ul className="space-y-2">
              {result.top_strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#C8C8F0]">
                  <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.top_gaps.length > 0 && (
          <div className="bg-[#0D1122] rounded-2xl border border-[#232548] p-5 space-y-3">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
              Key Gaps to Address
            </p>
            <ul className="space-y-2">
              {result.top_gaps.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#C8C8F0]">
                  <span className="text-amber-400 shrink-0 mt-0.5">✗</span>
                  {g}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="text-center py-2">
        <Link
          href="/generate"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-sm shadow-indigo-600/20 hover:-translate-y-px transition-all"
        >
          Tailor your resume for this role →
        </Link>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FitClient({
  plan,
  fitCount,
  savedResume,
}: {
  plan: "free" | "pro";
  fitCount: number;
  savedResume: string | null;
}) {
  const [jdText, setJdText] = useState("");
  const [resumeText, setResumeText] = useState(savedResume ?? "");
  const [loading, setLoading] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [result, setResult] = useState<FitScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(
    plan !== "pro" && fitCount >= FREE_FIT_LIMIT
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wordCount = resumeText.trim().split(/\s+/).filter(Boolean).length;
  const canSubmit = resumeText.trim().length >= 100 && jdText.trim().length >= 50 && !loading;

  const handleGenerate = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resumeText.trim(),
          jd_text: jdText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "fit_limit_reached") {
          setLimitReached(true);
          return;
        }
        setError(data.error ?? "Failed to score — please try again.");
        return;
      }
      setResult(data as FitScoreResult);
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setParseLoading(true);
    setParseError(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/parse-resume", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data.error ?? "Failed to parse file");
        return;
      }
      setResumeText(data.text);
      setResult(null);
    } catch {
      setParseError("Failed to parse file — try pasting manually.");
    } finally {
      setParseLoading(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 bg-indigo-950/40 border border-indigo-900/50 px-3 py-1.5 rounded-full mb-4">
          {plan === "pro" ? "Pro · Unlimited" : `Free · ${FREE_FIT_LIMIT} check`}
        </div>
        <h1 className="text-3xl font-bold text-[#EEEEFC] mb-3">Job Fit Scorer</h1>
        <p className="text-base text-[#8888A8] max-w-xl mx-auto">
          Check your fit before you apply. Get a score, dimension breakdown, and specific gaps — in seconds.
        </p>
      </div>

      {/* Free limit gate */}
      {limitReached && (
        <div className="bg-[#0D1122] rounded-2xl border border-[#232548] p-8 mb-6 text-center space-y-4">
          <svg className="w-8 h-8 text-[#5A5A80] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-sm font-semibold text-[#EEEEFC]">Free fit check used</p>
          <p className="text-sm text-[#8888A8]">
            Upgrade to Pro for unlimited fit checks — plus unlimited resume scoring, answer coaching, mock interviews, and negotiation coaching.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-sm shadow-indigo-600/20 hover:-translate-y-px transition-all"
          >
            Upgrade to Pro →
          </Link>
        </div>
      )}

      {!limitReached && (
        <>
          {/* Input card */}
          <div className="bg-[#0D1122] rounded-2xl border border-[#232548] p-6 mb-4 space-y-5">
            {/* JD */}
            <div>
              <label className="block text-sm font-medium text-[#E0E0F8] mb-1.5">
                Job description <span className="text-red-400">*</span>
              </label>
              <textarea
                value={jdText}
                onChange={(e) => {
                  setJdText(e.target.value);
                  if (result) setResult(null);
                }}
                rows={7}
                placeholder="Paste the full job description — the more detail, the more accurate the score"
                className="w-full border border-[#232548] rounded-lg px-4 py-3 text-sm text-[#EEEEFC] placeholder-[#4A4A68] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#13182C] transition resize-none"
              />
            </div>

            {/* Resume */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-[#E0E0F8]">
                  Your resume <span className="text-red-400">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={parseLoading}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8888A8] hover:text-indigo-400 bg-[#13182C] hover:bg-indigo-950/40 border border-[#232548] hover:border-indigo-900/50 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                  >
                    {parseLoading ? (
                      <span className="w-3 h-3 border-2 border-[#8888A8] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    )}
                    {parseLoading ? "Parsing..." : "Upload PDF / DOCX"}
                  </button>
                </div>
              </div>
              {parseError && <p className="text-xs text-red-400 mb-2">{parseError}</p>}
              <textarea
                value={resumeText}
                onChange={(e) => {
                  setResumeText(e.target.value);
                  if (result) setResult(null);
                }}
                rows={10}
                placeholder="Paste your resume here — or upload a PDF/DOCX above"
                className="w-full border border-[#232548] rounded-lg px-4 py-3 text-sm text-[#EEEEFC] placeholder-[#4A4A68] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#13182C] transition resize-none"
              />
              <p className="text-xs text-[#5A5A80] mt-2">{wordCount} words</p>
            </div>
          </div>

          {/* Generate button */}
          <div className="flex justify-end mb-6">
            <button
              onClick={handleGenerate}
              disabled={!canSubmit}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                canSubmit
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20 hover:-translate-y-px"
                  : "bg-[#141830] text-[#4A4A68] cursor-not-allowed"
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Scoring fit...
                </span>
              ) : (
                "Score my fit →"
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-5 mb-6 text-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && <ResultPanel result={result} />}
        </>
      )}
    </main>
  );
}
