"use client";

import { useState, useEffect, useCallback } from "react";
import { usePostHog } from "posthog-js/react";
import type { GenerateStatus, GenerateResult } from "@/hooks/useGenerate";
import type { JdAnalysis, ValidatorIssue, DocumentType } from "@/lib/types";

interface OutputPanelProps {
  status: GenerateStatus;
  streamText: string;
  jdAnalysis: JdAnalysis | null;
  result: GenerateResult | null;
  error: string | null;
  documentType: DocumentType;
  tailoringSuggestions?: string[];
}

const scoreLabels: Record<string, string> = {
  specificity: "Specificity",
  relevance: "Relevance",
  authenticity: "Authenticity",
  impact: "Impact",
  clean: "Clean",
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = (score / 10) * 100;
  const color =
    score >= 8 ? "bg-emerald-500" : score >= 6 ? "bg-indigo-500" : "bg-amber-500";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[var(--color-text-secondary)] w-24 shrink-0">{label}</span>
      <div className="flex-1 bg-[var(--color-border)] rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-[var(--color-text-label)] w-8 text-right">{score}/10</span>
    </div>
  );
}

function StatusBadge({ verdict }: { verdict: string }) {
  if (verdict === "PASS")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 px-2.5 py-1 rounded-full">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
        Passed quality check
      </span>
    );
  if (verdict === "REVISE")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 px-2.5 py-1 rounded-full">
        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
        Review before using
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
      Needs editing
    </span>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function Spinner() {
  return (
    <span className="w-4 h-4 border-2 border-[var(--color-text-placeholder)] border-t-transparent rounded-full animate-spin" />
  );
}

function ThumbsUpIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function ThumbsDownIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z" />
      <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  );
}

// ── Keyword gap panel ────────────────────────────────────────────────────────

function KeywordGap({ keywords, output }: { keywords: string[]; output: string }) {
  if (keywords.length === 0) return null;

  const outputLower = output.toLowerCase();
  const matched = keywords.filter((k) => outputLower.includes(k.toLowerCase()));
  const missing = keywords.filter((k) => !outputLower.includes(k.toLowerCase()));

  if (matched.length === 0 && missing.length === 0) return null;

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
          Keyword match
        </p>
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          {matched.length}/{keywords.length} keywords
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {matched.map((k) => (
          <span
            key={k}
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 px-2 py-0.5 rounded-full"
          >
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            {k}
          </span>
        ))}
        {missing.map((k) => (
          <span
            key={k}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-tertiary)] bg-[var(--color-elevated)] border border-[var(--color-border)] px-2 py-0.5 rounded-full"
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {k}
          </span>
        ))}
      </div>
      {missing.length > 0 && (
        <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
          Missing keywords can be added to your resume or cover letter where accurate.
        </p>
      )}
    </div>
  );
}

// ── Label input ──────────────────────────────────────────────────────────────

function LabelInput({ generationId }: { generationId: string }) {
  const [label, setLabel] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = useCallback(async (value: string) => {
    if (saving) return;
    setSaving(true);
    try {
      await fetch(`/api/generations/${generationId}/label`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: value }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Silent — non-critical
    } finally {
      setSaving(false);
    }
  }, [generationId, saving]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") save(label);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        placeholder="Add a label (e.g. 'Stripe PM')"
        value={label}
        onChange={(e) => {
          setLabel(e.target.value);
          setSaved(false);
        }}
        onBlur={() => label && save(label)}
        onKeyDown={handleKeyDown}
        maxLength={200}
        className="flex-1 border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--color-elevated)] transition"
      />
      {saving && (
        <span className="w-3.5 h-3.5 border-2 border-[var(--color-text-placeholder)] border-t-transparent rounded-full animate-spin" />
      )}
      {saved && (
        <span className="text-xs text-emerald-400 font-medium">Saved</span>
      )}
    </div>
  );
}

function QualityRing({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score * 10));
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (pct / 100) * circumference;
  const color = score >= 8 ? "#10b981" : score >= 6 ? "#6366f1" : "#f59e0b";

  return (
    <div className="relative inline-flex items-center justify-center" title="Generation quality score (1–10)">
      <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90">
        <circle cx="26" cy="26" r={radius} fill="none" stroke="var(--color-border)" strokeWidth="4" />
        <circle
          cx="26" cy="26" r={radius} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.7s ease" }}
        />
      </svg>
      <span className="absolute text-xs font-bold text-[var(--color-text-label)]">{score.toFixed(1)}</span>
    </div>
  );
}

function TailoringPanel({ suggestions }: { suggestions: string[] }) {
  const [open, setOpen] = useState(false);
  if (suggestions.length === 0) return null;

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[var(--color-elevated)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">Resume Tailoring Checklist</span>
          <span className="text-xs font-medium text-indigo-700 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 px-2 py-0.5 rounded-full">{suggestions.length} actions</span>
        </div>
        <svg className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-[var(--color-border-subtle)] pt-3">
          <p className="text-xs text-[var(--color-text-tertiary)] mb-3">Specific changes to make in your base resume to better match this role:</p>
          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-label)]">
                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function OutputPanel({
  status,
  streamText,
  jdAnalysis,
  result,
  error,
  documentType,
  tailoringSuggestions,
}: OutputPanelProps) {
  const posthog = usePostHog();
  const [copied, setCopied] = useState(false);
  const [exportLoading, setExportLoading] = useState<{ docx: boolean; pdf: boolean }>({
    docx: false,
    pdf: false,
  });
  const [exportError, setExportError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Reset per-result state when a new generation starts
  useEffect(() => {
    if (status === "parsing") {
      setFeedback(null);
      setExportError(null);
    }
    if (status === "done" && result) {
      posthog?.capture("generation_completed", {
        doc_type: documentType,
        verdict: result.verdict,
        overall_score: result.overall,
        retry_count: result.retryCount,
        keyword_count: result.keywords?.length ?? 0,
      });
    }
  }, [status, result, documentType, posthog]);

  const copy = async () => {
    const text = result?.output ?? streamText;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadExport = async (format: "docx" | "pdf") => {
    if (!result?.output) return;
    setExportLoading((prev) => ({ ...prev, [format]: true }));
    setExportError(null);
    posthog?.capture("export_clicked", { format, doc_type: documentType });
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          output_text: result.output,
          document_type: documentType,
          format,
        }),
      });
      if (!res.ok) {
        setExportError("Export failed — please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shortlist-${documentType}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export failed — please try again.");
    } finally {
      setExportLoading((prev) => ({ ...prev, [format]: false }));
    }
  };

  const submitFeedback = async (positive: boolean) => {
    if (!result?.generationId || feedback === positive || feedbackLoading) return;
    const prev = feedback;
    setFeedback(positive);
    setFeedbackLoading(true);
    try {
      const res = await fetch(`/api/generations/${result.generationId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positive }),
      });
      if (!res.ok) setFeedback(prev);
    } catch {
      setFeedback(prev);
    } finally {
      setFeedbackLoading(false);
    }
  };

  // ── Idle state ─────────────────────────────────────────────────────────────
  if (status === "idle") {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-80 text-center px-8 py-16 rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">Your output will appear here</p>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Fill in the form and click Generate</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-80 text-center px-8 py-16 rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20">
        <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-red-300">Something went wrong</p>
        <p className="text-xs text-red-400/80 mt-1 max-w-xs">{error}</p>
      </div>
    );
  }

  // ── Parsing state ──────────────────────────────────────────────────────────
  if (status === "parsing") {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-80 text-center px-8 py-16 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-[var(--color-text-label)]">Analyzing job description...</p>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Extracting role signals and requirements</p>
      </div>
    );
  }

  // ── Generating / validating / done ────────────────────────────────────────
  const displayText = result?.output ?? streamText;
  const isStreaming = status === "generating";
  const isValidating = status === "validating";

  return (
    <div className="flex flex-col gap-4">
      {/* JD Analysis chip — shown once parsed */}
      {jdAnalysis?.role_title && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--color-text-secondary)]">Targeting:</span>
          <span className="text-xs font-medium text-indigo-700 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 px-2.5 py-1 rounded-full">
            {jdAnalysis.role_title}
          </span>
          {jdAnalysis.seniority_level && (
            <span className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-elevated)] border border-[var(--color-border)] px-2.5 py-1 rounded-full capitalize">
              {jdAnalysis.seniority_level}
            </span>
          )}
          {jdAnalysis.company_type && (
            <span className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-elevated)] border border-[var(--color-border)] px-2.5 py-1 rounded-full capitalize">
              {jdAnalysis.company_type}
            </span>
          )}
        </div>
      )}

      {/* Status bar */}
      {(isStreaming || isValidating) && (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="text-xs text-[var(--color-text-secondary)]">
            {isValidating ? "Checking quality..." : "Generating..."}
          </span>
        </div>
      )}

      {/* Output text */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6">
        <div
          className={`text-sm text-[var(--color-text-output)] leading-relaxed whitespace-pre-wrap font-mono ${isStreaming ? "cursor-blink" : ""}`}
        >
          {displayText || (
            <span className="text-[#3A3A55] italic">Generating...</span>
          )}
        </div>
      </div>

      {/* Scores — shown when done */}
      {status === "done" && result && (
        <>
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <QualityRing score={result.overall} />
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Generation quality</p>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">Shortlist grades every generation for accuracy, relevance, and impact</p>
                </div>
              </div>
              <StatusBadge verdict={result.verdict} />
            </div>
            <div className="space-y-3">
              {Object.entries(result.scores).map(([key, score]) => (
                <ScoreBar key={key} label={scoreLabels[key] ?? key} score={score} />
              ))}
            </div>
            {result.retryCount > 0 && (
              <p className="text-xs text-[var(--color-text-tertiary)] mt-3">
                ↻ Refined once to improve quality
              </p>
            )}
            {result.overall < 7 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Consider adjusting your inputs and regenerating for a higher score.
              </div>
            )}
          </div>

          {/* Keyword gap analysis */}
          {result.keywords && result.keywords.length > 0 && (
            <KeywordGap keywords={result.keywords} output={result.output} />
          )}

          {/* Hallucination / skill inflation flags */}
          {(() => {
            const flags = result.issues.filter(
              (i: ValidatorIssue) => i.type === "hallucination" || i.type === "skill_inflation"
            );
            if (flags.length === 0) return null;
            return (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs font-semibold text-amber-300">Verify before submitting</p>
                </div>
                <div className="space-y-3">
                  {flags.map((flag: ValidatorIssue, i: number) => (
                    <div key={i}>
                      <p className="text-xs font-mono text-amber-800 bg-amber-50 dark:text-amber-200 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/40 px-2 py-1 rounded mb-1 break-words">
                        &ldquo;{flag.location}&rdquo;
                      </p>
                      <p className="text-xs text-amber-400/80 leading-relaxed">{flag.fix}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Tailoring recommendations */}
          {tailoringSuggestions && tailoringSuggestions.length > 0 && (
            <TailoringPanel suggestions={tailoringSuggestions} />
          )}

          {/* Label this generation */}
          {result.generationId && (
            <LabelInput generationId={result.generationId} />
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Copy */}
            <button
              onClick={copy}
              className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-label)] bg-[var(--color-elevated)] hover:bg-[var(--color-border)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] px-4 py-2 rounded-lg transition-colors"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>

            {/* DOCX */}
            <button
              onClick={() => downloadExport("docx")}
              disabled={exportLoading.docx}
              className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-label)] bg-[var(--color-elevated)] hover:bg-[var(--color-border)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportLoading.docx ? <Spinner /> : <DownloadIcon />}
              DOCX
            </button>

            {/* PDF */}
            <button
              onClick={() => downloadExport("pdf")}
              disabled={exportLoading.pdf}
              className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-label)] bg-[var(--color-elevated)] hover:bg-[var(--color-border)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportLoading.pdf ? <Spinner /> : <DownloadIcon />}
              PDF
            </button>

            {/* Feedback — only shown for authenticated users (generationId present) */}
            {result.generationId && (
              <>
                <span className="text-[var(--color-border)] text-sm">|</span>

                <button
                  onClick={() => submitFeedback(true)}
                  disabled={feedbackLoading}
                  aria-label="Helpful"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all disabled:cursor-not-allowed ${
                    feedback === true
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-400"
                      : "bg-transparent border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:border-emerald-300 dark:hover:border-emerald-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-emerald-400"
                  }`}
                >
                  <ThumbsUpIcon />
                  {feedback === true ? "Helpful" : ""}
                </button>

                <button
                  onClick={() => submitFeedback(false)}
                  disabled={feedbackLoading}
                  aria-label="Not helpful"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all disabled:cursor-not-allowed ${
                    feedback === false
                      ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40 text-red-400"
                      : "bg-transparent border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:border-red-300 dark:hover:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-400"
                  }`}
                >
                  <ThumbsDownIcon />
                  {feedback === false ? "Not helpful" : ""}
                </button>
              </>
            )}
          </div>

          {/* Hiring manager worry */}
          {jdAnalysis?.hiring_manager_worry && (
            <div className="bg-[var(--color-inset)] rounded-lg px-4 py-3 border border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-tertiary)] font-medium mb-0.5">What they worry about</p>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {jdAnalysis.hiring_manager_worry}
              </p>
            </div>
          )}

          {/* Export error */}
          {exportError && (
            <p className="text-xs text-red-400">{exportError}</p>
          )}
        </>
      )}
    </div>
  );
}
