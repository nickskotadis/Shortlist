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
    PASS: "text-emerald-700 bg-emerald-50",
    REVISE: "text-amber-700 bg-amber-50",
    REJECT: "text-red-700 bg-red-50",
  };
  const dots: Record<ValidatorVerdict, string> = {
    PASS: "bg-emerald-500",
    REVISE: "bg-amber-500",
    REJECT: "bg-red-500",
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
    score >= 8 ? "bg-emerald-500" : score >= 6 ? "bg-indigo-400" : "bg-amber-400";
  const textColor =
    score >= 8 ? "text-emerald-700" : score >= 6 ? "text-indigo-600" : "text-amber-700";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500">{label}</span>
        <span className={`text-xs font-medium ${textColor}`}>{score}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
    <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
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
  const activeStyle = activeClass ?? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 text-indigo-700";
  const inactiveStyle = "border-slate-200 bg-white text-slate-600 hover:border-slate-300";
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header — always visible, click to expand */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-6 py-5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <VerdictBadge verdict={gen.validator_verdict} />
            <span className="text-sm font-medium text-slate-700">
              {DOC_TYPE_LABELS[gen.document_type]}
            </span>
            {gen.retry_count > 0 && (
              <span className="text-xs text-slate-400">↻ refined</span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 text-slate-400">
            {overall !== null && (
              <span className="text-xs font-medium text-slate-500">
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
        <p className={`text-sm mt-1.5 truncate ${label || gen.label ? "font-medium text-slate-900" : "text-slate-500"}`}>
          {cardTitle !== DOC_TYPE_LABELS[gen.document_type]
            ? cardTitle
            : <span className="italic text-slate-400">No label</span>}
        </p>
      </button>

      {/* Expanded: output text + label edit */}
      {expanded && (
        <>
          <div className="border-t border-slate-100 px-6 py-5">
            <pre className="font-mono text-sm text-slate-900 whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto">
              {gen.output_text}
            </pre>
          </div>

          {/* Label edit */}
          <div className="border-t border-slate-100 px-6 py-3 bg-slate-50">
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
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white transition"
              />
              {labelSaving && <MiniSpinner />}
              {labelSaved && <span className="text-xs text-emerald-600 font-medium">Saved</span>}
            </div>
          </div>

          {/* Scores + meta footer */}
          <div className="border-t border-slate-100 px-6 py-4 bg-slate-50">
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
              <div className="flex items-center gap-2 text-xs text-slate-400">
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
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportLoading.docx ? <MiniSpinner /> : <DownloadIcon />}
                  DOCX
                </button>

                {/* PDF */}
                <button
                  onClick={() => downloadExport("pdf")}
                  disabled={exportLoading.pdf}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportLoading.pdf ? <MiniSpinner /> : <DownloadIcon />}
                  PDF
                </button>

                <span className="text-slate-200">|</span>

                {/* Thumbs up */}
                <button
                  onClick={() => submitFeedback(true)}
                  disabled={feedbackLoading}
                  aria-label="Helpful"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all disabled:cursor-not-allowed ${
                    feedback === true
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600"
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
                      ? "bg-red-50 border-red-200 text-red-600"
                      : "bg-white border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                  }`}
                >
                  <ThumbsDownIcon />
                  {feedback === false ? "Not helpful" : ""}
                </button>

                <span className="text-slate-200">|</span>

                {/* Copy */}
                <button
                  onClick={handleCopy}
                  className="text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>
            {exportError && (
              <p className="text-xs text-red-500 mt-2">{exportError}</p>
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
  { value: "PASS", label: "PASS", activeClass: "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 text-emerald-700" },
  { value: "REVISE", label: "REVISE", activeClass: "border-amber-500 bg-amber-50 ring-1 ring-amber-500 text-amber-700" },
  { value: "REJECT", label: "REJECT", activeClass: "border-red-500 bg-red-50 ring-1 ring-red-500 text-red-700" },
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-base font-semibold text-slate-900 mb-2">No generations yet</p>
        <p className="text-sm text-slate-500 mb-2 max-w-sm mx-auto">
          Generate tailored resume bullets, summaries, and cover letters — all in under 30 seconds.
        </p>
        <p className="text-xs text-slate-400 mb-6">
          You need to be signed in for generations to save here.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/generate"
            className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all"
          >
            Generate now →
          </Link>
          <Link
            href="/score"
            className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium px-5 py-2.5 rounded-xl transition-all"
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
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
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
            placeholder="Search by label or job..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white transition"
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
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <span>Showing {filtered.length} of {generations.length}</span>
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

      {/* No-results state */}
      {filtered.length === 0 && isFiltered ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <p className="text-sm font-semibold text-slate-900 mb-1">No generations match your filters</p>
          <p className="text-xs text-slate-500 mb-4">Try adjusting your search or filter criteria.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-all"
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
