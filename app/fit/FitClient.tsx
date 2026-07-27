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
  const color = score >= 80 ? "#35583F" : score >= 60 ? "#2F4A3C" : score >= 40 ? "#7A5C1E" : "#8F3A28";

  return (
    <div className="relative inline-flex items-center justify-center w-28 h-28 shrink-0">
      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r={radius} fill="none" stroke="var(--color-border-subtle)" strokeWidth="8" />
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
        <span className="block text-xs text-[var(--color-text-tertiary)]">/ 100</span>
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
      ? "bg-[var(--color-success)]"
      : pct >= 60
      ? "bg-[var(--color-accent)]"
      : pct >= 40
      ? "bg-[var(--color-warning)]"
      : "bg-[var(--color-error)]";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-[var(--color-text-label)] truncate">{label}</span>
          {dimension.gaps.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              {expanded ? "▲" : `▼ ${dimension.gaps.length} gap${dimension.gaps.length > 1 ? "s" : ""}`}
            </button>
          )}
        </div>
        <span className="text-sm font-semibold text-[var(--color-text-primary)] shrink-0">{pct}</span>
      </div>
      <div className="h-1.5 bg-[var(--color-border-subtle)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{dimension.explanation}</p>
      {expanded && dimension.gaps.length > 0 && (
        <ul className="space-y-1 pl-1">
          {dimension.gaps.map((gap, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-tertiary)]">
              <span className="text-[var(--color-warning)] shrink-0">✗</span>
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
    classes: "text-[var(--color-success)] bg-[var(--color-success-bg)] border-[var(--color-success-border)]",
    description: "Apply with confidence.",
  },
  moderate_fit: {
    label: "Moderate Fit",
    classes: "text-[var(--color-accent)] bg-[var(--color-accent-weak)] border-[var(--color-accent-weak-border)]",
    description: "Worth applying — address gaps in your cover letter.",
  },
  stretch: {
    label: "Stretch Role",
    classes: "text-[var(--color-warning)] bg-[var(--color-warning-bg)] border-[var(--color-warning-border)]",
    description: "Significant gaps — apply if you can address them head-on.",
  },
  mismatch: {
    label: "Likely Mismatch",
    classes: "text-[var(--color-error)] bg-[var(--color-error-bg)] border-[var(--color-error-border)]",
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
      <div className="bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] p-6">
        <div className="flex items-start gap-6 flex-wrap">
          <FitRing score={result.overall} />
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${rec.classes}`}
              >
                {rec.label}
              </span>
              <span className="text-xs text-[var(--color-text-tertiary)]">{rec.description}</span>
            </div>
            <p className="text-sm text-[var(--color-text-output)] leading-relaxed">{result.summary}</p>
          </div>
        </div>
      </div>

      {/* Dimensions */}
      <div className="bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] p-6 space-y-5">
        <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide">Breakdown</p>
        {(Object.keys(result.dimensions) as Array<keyof FitScoreResult["dimensions"]>).map((key) => (
          <DimensionBar key={key} label={DIMENSION_LABELS[key]} dimension={result.dimensions[key]} />
        ))}
      </div>

      {/* Top strengths + gaps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {result.top_strengths.length > 0 && (
          <div className="bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] p-5 space-y-3">
            <p className="text-xs font-semibold text-[var(--color-success)] uppercase tracking-wide">
              Top Strengths
            </p>
            <ul className="space-y-2">
              {result.top_strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-output)]">
                  <span className="text-[var(--color-success)] shrink-0 mt-0.5">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.top_gaps.length > 0 && (
          <div className="bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] p-5 space-y-3">
            <p className="text-xs font-semibold text-[var(--color-warning)] uppercase tracking-wide">
              Key Gaps to Address
            </p>
            <ul className="space-y-2">
              {result.top_gaps.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-output)]">
                  <span className="text-[var(--color-warning)] shrink-0 mt-0.5">✗</span>
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
          className="inline-flex items-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-semibold px-6 py-2.5 rounded-md shadow-sm hover:-translate-y-px transition-all"
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
        if (res.status === 401) {
          setError("sign_in_required");
          return;
        }
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
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-accent)] bg-[var(--color-accent-weak)] border border-[var(--color-accent-weak-border)] px-3 py-1.5 rounded-full mb-4">
          {plan === "pro" ? "Pro · Unlimited" : `Free · ${FREE_FIT_LIMIT} check`}
        </div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-3">Job Fit Scorer</h1>
        <p className="text-base text-[var(--color-text-secondary)] max-w-xl mx-auto">
          Check your fit before you apply. Get a score, dimension breakdown, and specific gaps — in seconds.
        </p>
      </div>

      {/* Free limit gate */}
      {limitReached && (
        <div className="bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] p-8 mb-6 text-center space-y-4">
          <svg className="w-8 h-8 text-[var(--color-text-tertiary)] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Free fit check used</p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Upgrade to Pro for unlimited fit checks — plus unlimited resume scoring, answer coaching, mock interviews, and negotiation coaching.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-semibold px-6 py-2.5 rounded-md shadow-sm hover:-translate-y-px transition-all"
          >
            Upgrade to Pro →
          </Link>
        </div>
      )}

      {!limitReached && (
        <>
          {/* Input card */}
          <div className="bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] p-6 mb-4 space-y-5">
            {/* JD */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-label)] mb-1.5">
                Job description <span className="text-[var(--color-error)]">*</span>
              </label>
              <textarea
                value={jdText}
                onChange={(e) => {
                  setJdText(e.target.value);
                  if (result) setResult(null);
                }}
                rows={7}
                placeholder="Paste the full job description — the more detail, the more accurate the score"
                className="w-full border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent bg-[var(--color-elevated)] transition resize-none"
              />
            </div>

            {/* Resume */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-[var(--color-text-label)]">
                  Your resume <span className="text-[var(--color-error)]">*</span>
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
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] bg-[var(--color-elevated)] hover:bg-[var(--color-accent-weak)] border border-[var(--color-border)] hover:border-[var(--color-accent-weak-border)] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                  >
                    {parseLoading ? (
                      <span className="w-3 h-3 border-2 border-[var(--color-text-secondary)] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    )}
                    {parseLoading ? "Parsing..." : "Upload PDF / DOCX"}
                  </button>
                </div>
              </div>
              {parseError && <p className="text-xs text-[var(--color-error)] mb-2">{parseError}</p>}
              <textarea
                value={resumeText}
                onChange={(e) => {
                  setResumeText(e.target.value);
                  if (result) setResult(null);
                }}
                rows={10}
                placeholder="Paste your resume here — or upload a PDF/DOCX above"
                className="w-full border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent bg-[var(--color-elevated)] transition resize-none"
              />
              <p className="text-xs text-[var(--color-text-tertiary)] mt-2">{wordCount} words</p>
            </div>
          </div>

          {/* Generate button */}
          <div className="flex justify-end mb-6">
            <button
              onClick={handleGenerate}
              disabled={!canSubmit}
              className={`px-6 py-2.5 rounded-md text-sm font-semibold transition-all ${
                canSubmit
                  ? "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow-sm hover:-translate-y-px"
                  : "bg-[var(--color-disabled)] text-[var(--color-text-placeholder)] cursor-not-allowed"
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
          {error && error === "sign_in_required" && (
            <div className="bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] p-6 mb-6 text-center space-y-3">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Sign in to check your fit</p>
              <p className="text-sm text-[var(--color-text-secondary)]">A free account gives you 1 job fit check — no credit card required.</p>
              <a href="/auth/login" className="inline-flex items-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-semibold px-5 py-2.5 rounded-md transition-all">Sign in →</a>
            </div>
          )}
          {error && error !== "sign_in_required" && (
            <div className="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-md p-5 mb-6 text-center">
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && <ResultPanel result={result} />}
        </>
      )}
    </main>
  );
}
