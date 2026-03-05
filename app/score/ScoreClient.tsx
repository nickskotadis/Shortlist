"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import type { HealthScoreResult } from "@/lib/types";

// ── Sub-components ────────────────────────────────────────────────────────────

const SCORE_META: Record<string, { label: string; description: string }> = {
  clarity: {
    label: "Clarity",
    description: "Easy to scan, logical flow, clear sections",
  },
  impact: {
    label: "Impact",
    description: "Achievements over duties — outcomes, not tasks",
  },
  ats_friendliness: {
    label: "ATS Friendly",
    description: "Standard formatting ATS systems can parse correctly",
  },
  action_verbs: {
    label: "Action Verbs",
    description: "Bullets lead with strong, specific past-tense verbs",
  },
  quantification: {
    label: "Quantification",
    description: "Claims backed by numbers, percentages, or dollar amounts",
  },
};

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score / 10;
  const color =
    score >= 8 ? "#10b981" : score >= 6 ? "#6366f1" : score >= 4 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={6}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct)}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
    </svg>
  );
}

function DimensionCard({ dimensionKey, score }: { dimensionKey: string; score: number }) {
  const meta = SCORE_META[dimensionKey] ?? { label: dimensionKey, description: "" };
  const color =
    score >= 8 ? "text-emerald-400" : score >= 6 ? "text-indigo-400" : score >= 4 ? "text-amber-400" : "text-red-400";
  const bg =
    score >= 8 ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30" : score >= 6 ? "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/30" : score >= 4 ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30";

  return (
    <div className={`rounded-2xl border p-5 ${bg}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{meta.label}</p>
        <span className={`text-xl font-bold ${color}`}>{score}<span className="text-sm font-normal text-[var(--color-text-tertiary)]">/10</span></span>
      </div>
      <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            score >= 8 ? "bg-emerald-500" : score >= 6 ? "bg-indigo-500" : score >= 4 ? "bg-amber-500" : "bg-red-500"
          }`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">{meta.description}</p>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export default function ScoreClient({
  plan = "free",
  scoreCount = 0,
}: {
  plan?: "free" | "pro";
  scoreCount?: number;
}) {
  const posthog = usePostHog();
  const [resumeText, setResumeText] = useState("");
  const [loading, setLoading] = useState(false);

  const limitReached = plan !== "pro" && scoreCount >= 1;

  useEffect(() => {
    posthog?.capture("score_page_viewed");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [parseLoading, setParseLoading] = useState(false);
  const [result, setResult] = useState<HealthScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScore = async () => {
    if (!resumeText.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_text: resumeText }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError("sign_in_required");
          return;
        }
        setError(data.error ?? "Scoring failed — please try again.");
        return;
      }
      setResult(data as HealthScoreResult);
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

  const overallColor =
    !result ? ""
    : result.overall >= 8 ? "text-emerald-400"
    : result.overall >= 6 ? "text-indigo-400"
    : result.overall >= 4 ? "text-amber-400"
    : "text-red-400";

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 px-3 py-1.5 rounded-full mb-4">
          {plan === "pro" ? "Pro · Unlimited scores" : "Free · 1 score included"}
        </div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-3">Resume Health Score</h1>
        <p className="text-base text-[var(--color-text-secondary)] max-w-xl mx-auto">
          Paste your resume and get an instant AI critique across 5 dimensions — before you apply anywhere.
        </p>
      </div>

      {/* Limit reached gate */}
      {limitReached && (
        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 rounded-2xl p-8 mb-6 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/50 mb-4">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-[var(--color-text-primary)] mb-1">You&apos;ve used your free score</p>
          <p className="text-sm text-indigo-400/80 mb-6 max-w-sm mx-auto">
            Upgrade to Pro for unlimited resume health scores, plus AI Answer Coach, full application packages, and unlimited generations.
          </p>
          <a
            href="/pricing"
            className="inline-flex items-center bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-sm shadow-indigo-600/20 transition-all hover:-translate-y-px"
          >
            Upgrade to Pro →
          </a>
        </div>
      )}

      {/* Input card + results */}
      {!limitReached && <>
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-[var(--color-text-label)]">
            Your resume
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
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-indigo-400 bg-[var(--color-elevated)] hover:bg-indigo-100 dark:hover:bg-indigo-950/40 border border-[var(--color-border)] hover:border-indigo-300 dark:hover:border-indigo-900/50 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
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
        {parseError && <p className="text-xs text-red-400 mb-2">{parseError}</p>}
        <textarea
          value={resumeText}
          onChange={(e) => {
            setResumeText(e.target.value);
            if (result) setResult(null);
          }}
          rows={12}
          placeholder="Paste your full resume here — all sections, all roles..."
          className="w-full border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--color-elevated)] transition resize-none"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {resumeText.trim().split(/\s+/).filter(Boolean).length} words
          </p>
          <button
            onClick={handleScore}
            disabled={!resumeText.trim() || loading}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              resumeText.trim() && !loading
                ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20 hover:-translate-y-px"
                : "bg-[var(--color-disabled)] text-[var(--color-text-placeholder)] cursor-not-allowed"
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Scoring...
              </span>
            ) : (
              "Score my resume →"
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && error === "sign_in_required" && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 mb-6 text-center space-y-3">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Sign in to score your resume</p>
          <p className="text-sm text-[var(--color-text-secondary)]">A free account gives you 1 resume health score — no credit card required.</p>
          <a href="/auth/login" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all">Sign in →</a>
        </div>
      )}
      {error && error !== "sign_in_required" && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl p-5 mb-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Overall score */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-8 text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <ScoreRing score={result.overall} size={120} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-2xl font-bold ${overallColor}`}>
                    {result.overall.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
              {result.overall >= 8
                ? "Strong resume — ready to send"
                : result.overall >= 6
                ? "Solid foundation — a few improvements will help"
                : result.overall >= 4
                ? "Needs work before applying"
                : "Significant gaps to address"}
            </p>
            <p className="text-sm text-[var(--color-text-tertiary)]">{result.word_count} words</p>
          </div>

          {/* Dimension scores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(result.scores).map(([key, score]) => (
              <DimensionCard key={key} dimensionKey={key} score={score} />
            ))}
          </div>

          {/* Recommendations */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
              Actionable improvements
            </h2>
            <ul className="space-y-3">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900/50 text-indigo-400 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-[var(--color-text-output)] leading-relaxed">{rec}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 rounded-2xl p-6 text-center">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
              Ready to tailor for a specific role?
            </p>
            <p className="text-xs text-indigo-400 mb-4">
              Generate targeted resume bullets, summaries, and cover letters in 30 seconds.
            </p>
            <Link
              href="/generate"
              className="inline-flex items-center bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-sm shadow-indigo-600/20 transition-all hover:-translate-y-px"
            >
              Generate tailored content →
            </Link>
          </div>
        </div>
      )}
      </>}
    </main>
  );
}
