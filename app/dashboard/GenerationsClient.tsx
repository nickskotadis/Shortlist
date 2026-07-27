"use client";

import { useState } from "react";
import Link from "next/link";
import type { DocumentType, ValidatorVerdict } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Generation {
  id: string;
  document_type: DocumentType;
  output_text: string;
  label: string | null;
  validator_scores: {
    specificity: number;
    relevance: number;
    authenticity: number;
    impact: number;
    clean: number;
  } | null;
  validator_verdict: ValidatorVerdict | null;
  retry_count: number;
  created_at: string;
  prompt_version: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  feedback_positive: boolean | null;
  job_applications: {
    company_name: string | null;
    job_title: string | null;
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  bullets: "Resume Bullets",
  summary: "Summary",
  cover_letter: "Cover Letter",
  linkedin_about: "LinkedIn About",
  linkedin_headline: "LinkedIn Headline",
};

function relativeDate(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function computeOverall(scores: NonNullable<Generation["validator_scores"]>): number {
  return (
    (scores.specificity + scores.relevance + scores.authenticity + scores.impact + scores.clean) /
    5
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: ValidatorVerdict | null }) {
  if (!verdict) return null;
  const styles: Record<ValidatorVerdict, string> = {
    PASS: "text-[var(--color-success)] bg-[var(--color-success-bg)] border border-[var(--color-success-border)]",
    REVISE: "text-[var(--color-warning)] bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]",
    REJECT: "text-[var(--color-error)] bg-[var(--color-error-bg)] border border-[var(--color-error-border)]",
  };
  const dots: Record<ValidatorVerdict, string> = {
    PASS: "bg-[var(--color-success)]",
    REVISE: "bg-[var(--color-warning)]",
    REJECT: "bg-[var(--color-error)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${styles[verdict]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dots[verdict]}`} />
      {verdict}
    </span>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const barColor =
    score >= 8 ? "bg-[var(--color-success)]" : score >= 6 ? "bg-[var(--color-accent)]" : "bg-[var(--color-warning)]";
  const textColor =
    score >= 8 ? "text-[var(--color-success)]" : score >= 6 ? "text-[var(--color-accent)]" : "text-[var(--color-warning)]";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
        <span className={`text-xs font-medium ${textColor}`}>{score}</span>
      </div>
      <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
    </div>
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

function DownloadIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function MiniSpinner() {
  return (
    <span className="w-3.5 h-3.5 border-2 border-[var(--color-text-placeholder)] border-t-transparent rounded-full animate-spin" />
  );
}

// ── FilterPill ────────────────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  activeClass,
  onClick,
}: {
  label: string;
  active: boolean;
  activeClass?: string;
  onClick: () => void;
}) {
  const base = "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer";
  const activeStyle = activeClass ?? "border-[var(--color-accent)] bg-[var(--color-accent-weak)] ring-1 ring-[var(--color-accent)] text-[var(--color-accent)]";
  const inactiveStyle = "border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${active ? activeStyle : inactiveStyle}`}
    >
      {label}
    </button>
  );
}

// ── Generation card ───────────────────────────────────────────────────────────

function GenerationCard({ gen }: { gen: Generation }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<boolean | null>(gen.feedback_positive);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState<{ docx: boolean; pdf: boolean }>({
    docx: false,
    pdf: false,
  });
  const [exportError, setExportError] = useState<string | null>(null);
  const [label, setLabel] = useState(gen.label ?? "");
  const [labelSaved, setLabelSaved] = useState(!!gen.label);
  const [labelSaving, setLabelSaving] = useState(false);

  const jobTitle = gen.job_applications?.job_title;
  const company = gen.job_applications?.company_name;
  const jobContext = [jobTitle, company].filter(Boolean).join(" at ");

  // Card title: label > job context > doc type
  const cardTitle = label || gen.label || jobContext || DOC_TYPE_LABELS[gen.document_type];

  const scores = gen.validator_scores;
  const overall = scores ? computeOverall(scores) : null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(gen.output_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submitFeedback = async (positive: boolean) => {
    if (feedback === positive || feedbackLoading) return;
    const prev = feedback;
    setFeedback(positive); // optimistic
    setFeedbackLoading(true);
    try {
      const res = await fetch(`/api/generations/${gen.id}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positive }),
      });
      if (!res.ok) setFeedback(prev); // revert on error
    } catch {
      setFeedback(prev);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const saveLabel = async (value: string) => {
    if (labelSaving) return;
    setLabelSaving(true);
    try {
      await fetch(`/api/generations/${gen.id}/label`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: value }),
      });
      setLabelSaved(true);
      setTimeout(() => setLabelSaved(false), 1500);
    } catch {
      // Silent
    } finally {
      setLabelSaving(false);
    }
  };

  const downloadExport = async (format: "docx" | "pdf") => {
    setExportLoading((prev) => ({ ...prev, [format]: true }));
    setExportError(null);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          output_text: gen.output_text,
          document_type: gen.document_type,
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
      a.download = `shortlist-${gen.document_type}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export failed — please try again.");
    } finally {
      setExportLoading((prev) => ({ ...prev, [format]: false }));
    }
  };

  return (
    <div className="bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-border-strong)] transition-colors">
      {/* Header — always visible, click to expand */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-6 py-5 hover:bg-[var(--color-elevated)] transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <VerdictBadge verdict={gen.validator_verdict} />
            <span className="text-sm font-medium text-[var(--color-text-label)]">
              {DOC_TYPE_LABELS[gen.document_type]}
            </span>
            {gen.retry_count > 0 && (
              <span className="text-xs text-[var(--color-text-tertiary)]">↻ refined</span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 text-[var(--color-text-tertiary)]">
            {overall !== null && (
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                {overall.toFixed(1)}/10
              </span>
            )}
            <span className="text-xs">{relativeDate(gen.created_at)}</span>
            <span
              className="text-xs transition-transform duration-200"
              style={{ display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              ↓
            </span>
          </div>
        </div>
        {/* Card title: label or job context */}
        <p className={`text-sm mt-1.5 truncate ${label || gen.label ? "font-medium text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
          {cardTitle !== DOC_TYPE_LABELS[gen.document_type]
            ? cardTitle
            : <span className="italic text-[var(--color-text-tertiary)]">No label</span>}
        </p>
      </button>

      {/* Expanded: output text + label edit */}
      {expanded && (
        <>
          <div className="border-t border-[var(--color-border-subtle)] px-6 py-5">
            <pre className="font-mono text-sm text-[var(--color-text-output)] whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto">
              {gen.output_text}
            </pre>
          </div>

          {/* Label edit */}
          <div className="border-t border-[var(--color-border-subtle)] px-6 py-3 bg-[var(--color-inset)]">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add a label (e.g. 'Stripe PM')"
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  setLabelSaved(false);
                }}
                onBlur={() => saveLabel(label)}
                onKeyDown={(e) => { if (e.key === "Enter") saveLabel(label); }}
                maxLength={200}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent bg-[var(--color-surface)] transition"
              />
              {labelSaving && <MiniSpinner />}
              {labelSaved && <span className="text-xs text-[var(--color-success)] font-medium">Saved</span>}
            </div>
          </div>

          {/* Scores + meta footer */}
          <div className="border-t border-[var(--color-border-subtle)] px-6 py-4 bg-[var(--color-inset)]">
            {scores && (
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4">
                <ScoreBar label="Specificity" score={scores.specificity} />
                <ScoreBar label="Relevance" score={scores.relevance} />
                <ScoreBar label="Authenticity" score={scores.authenticity} />
                <ScoreBar label="Impact" score={scores.impact} />
                <ScoreBar label="Clean" score={scores.clean} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                {gen.prompt_version && <span>{gen.prompt_version}</span>}
                {gen.latency_ms != null && (
                  <span>· {(gen.latency_ms / 1000).toFixed(1)}s</span>
                )}
                {gen.input_tokens != null && gen.output_tokens != null && (
                  <span>
                    · {(gen.input_tokens + gen.output_tokens).toLocaleString()} tokens
                  </span>
                )}
              </div>

              {/* Actions: export + feedback + copy */}
              <div className="flex items-center gap-3">
                {/* DOCX */}
                <button
                  onClick={() => downloadExport("docx")}
                  disabled={exportLoading.docx}
                  className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportLoading.docx ? <MiniSpinner /> : <DownloadIcon />}
                  DOCX
                </button>

                {/* PDF */}
                <button
                  onClick={() => downloadExport("pdf")}
                  disabled={exportLoading.pdf}
                  className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportLoading.pdf ? <MiniSpinner /> : <DownloadIcon />}
                  PDF
                </button>

                <span className="text-[var(--color-border)]">|</span>

                {/* Thumbs up */}
                <button
                  onClick={() => submitFeedback(true)}
                  disabled={feedbackLoading}
                  aria-label="Helpful"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all disabled:cursor-not-allowed ${
                    feedback === true
                      ? "bg-[var(--color-success-bg)] border-[var(--color-success-border)] text-[var(--color-success)]"
                      : "bg-transparent border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:border-[var(--color-success-border)] hover:bg-[var(--color-success-bg)] hover:text-[var(--color-success)]"
                  }`}
                >
                  <ThumbsUpIcon />
                  {feedback === true ? "Helpful" : ""}
                </button>

                {/* Thumbs down */}
                <button
                  onClick={() => submitFeedback(false)}
                  disabled={feedbackLoading}
                  aria-label="Not helpful"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all disabled:cursor-not-allowed ${
                    feedback === false
                      ? "bg-[var(--color-error-bg)] border-[var(--color-error-border)] text-[var(--color-error)]"
                      : "bg-transparent border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:border-[var(--color-error-border)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"
                  }`}
                >
                  <ThumbsDownIcon />
                  {feedback === false ? "Not helpful" : ""}
                </button>

                <span className="text-[var(--color-border)]">|</span>

                {/* Copy */}
                <button
                  onClick={handleCopy}
                  className="text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>
            {exportError && (
              <p className="text-xs text-[var(--color-error)] mt-2">{exportError}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const DOC_TYPE_FILTER_OPTIONS: Array<{ value: DocumentType | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "bullets", label: "Bullets" },
  { value: "summary", label: "Summary" },
  { value: "cover_letter", label: "Cover Letter" },
  { value: "linkedin_about", label: "LI About" },
  { value: "linkedin_headline", label: "LI Headline" },
];

const VERDICT_FILTER_OPTIONS: Array<{
  value: ValidatorVerdict | "all";
  label: string;
  activeClass?: string;
}> = [
  { value: "all", label: "All" },
  { value: "PASS", label: "PASS", activeClass: "border-[var(--color-success-border)] bg-[var(--color-success-bg)] ring-1 ring-[var(--color-success)] text-[var(--color-success)]" },
  { value: "REVISE", label: "REVISE", activeClass: "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] ring-1 ring-[var(--color-warning)] text-[var(--color-warning)]" },
  { value: "REJECT", label: "REJECT", activeClass: "border-[var(--color-error-border)] bg-[var(--color-error-bg)] ring-1 ring-[var(--color-error)] text-[var(--color-error)]" },
];

export default function GenerationsClient({ generations }: { generations: Generation[] }) {
  const [search, setSearch] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState<DocumentType | "all">("all");
  const [verdictFilter, setVerdictFilter] = useState<ValidatorVerdict | "all">("all");

  const clearFilters = () => {
    setSearch("");
    setDocTypeFilter("all");
    setVerdictFilter("all");
  };

  const filtered = generations.filter((gen) => {
    if (search) {
      const q = search.toLowerCase();
      const label = gen.label?.toLowerCase() ?? "";
      const jobTitle = gen.job_applications?.job_title?.toLowerCase() ?? "";
      const company = gen.job_applications?.company_name?.toLowerCase() ?? "";
      if (!label.includes(q) && !jobTitle.includes(q) && !company.includes(q)) return false;
    }
    if (docTypeFilter !== "all" && gen.document_type !== docTypeFilter) return false;
    if (verdictFilter !== "all" && gen.validator_verdict !== verdictFilter) return false;
    return true;
  });

  const isFiltered = search !== "" || docTypeFilter !== "all" || verdictFilter !== "all";

  if (generations.length === 0) {
    return (
      <div className="bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] p-16 text-center">
        <div className="w-16 h-16 rounded-md bg-[var(--color-accent-weak)] flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-base font-semibold text-[var(--color-text-primary)] mb-2">No generations yet</p>
        <p className="text-sm text-[var(--color-text-secondary)] mb-2 max-w-sm mx-auto">
          Generate tailored resume bullets, summaries, and cover letters — all in under 30 seconds.
        </p>
        <p className="text-xs text-[var(--color-text-tertiary)] mb-6">
          You need to be signed in for generations to save here.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/generate"
            className="inline-flex items-center gap-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-semibold px-5 py-2.5 rounded-md shadow-sm transition-all"
          >
            Generate now →
          </Link>
          <Link
            href="/score"
            className="inline-flex items-center gap-1 bg-[var(--color-elevated)] border border-[var(--color-border)] hover:bg-[var(--color-border)] text-[var(--color-text-label)] text-sm font-medium px-5 py-2.5 rounded-md transition-all"
          >
            Score my resume
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter toolbar */}
      <div className="bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] p-4">
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
            placeholder="Search by label or job..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-[var(--color-border)] rounded-lg pl-9 pr-4 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent bg-[var(--color-elevated)] transition"
          />
        </div>

        {/* Pills row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Doc type pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {DOC_TYPE_FILTER_OPTIONS.map((opt) => (
              <FilterPill
                key={opt.value}
                label={opt.label}
                active={docTypeFilter === opt.value}
                onClick={() => setDocTypeFilter(opt.value)}
              />
            ))}
          </div>

          {/* Verdict pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {VERDICT_FILTER_OPTIONS.map((opt) => (
              <FilterPill
                key={opt.value}
                label={opt.label}
                active={verdictFilter === opt.value}
                activeClass={opt.activeClass}
                onClick={() => setVerdictFilter(opt.value as ValidatorVerdict | "all")}
              />
            ))}
          </div>
        </div>

        {/* Result count + clear */}
        {isFiltered && (
          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <span>Showing {filtered.length} of {generations.length}</span>
            <span className="text-[var(--color-separator)]">·</span>
            <button
              type="button"
              onClick={clearFilters}
              className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium"
            >
              Clear filters ×
            </button>
          </div>
        )}
      </div>

      {/* No-results state */}
      {filtered.length === 0 && isFiltered ? (
        <div className="bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] p-12 text-center">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">No generations match your filters</p>
          <p className="text-xs text-[var(--color-text-secondary)] mb-4">Try adjusting your search or filter criteria.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-semibold px-4 py-2 rounded-md shadow-sm transition-all"
          >
            Clear filters
          </button>
        </div>
      ) : (
        filtered.map((gen) => (
          <GenerationCard key={gen.id} gen={gen} />
        ))
      )}
    </div>
  );
}
