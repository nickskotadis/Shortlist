"use client";

import { useState } from "react";
import type { DocumentType, ValidatorVerdict } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Generation {
  id: string;
  document_type: DocumentType;
  output_text: string;
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

// ── Generation card ───────────────────────────────────────────────────────────

function GenerationCard({ gen }: { gen: Generation }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const jobTitle = gen.job_applications?.job_title;
  const company = gen.job_applications?.company_name;
  const context = [jobTitle, company].filter(Boolean).join(" at ");

  const scores = gen.validator_scores;
  const overall = scores ? computeOverall(scores) : null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(gen.output_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <p className="text-sm text-slate-500 mt-1.5 truncate">
          {context ? context : <span className="italic text-slate-400">No job context</span>}
        </p>
      </button>

      {/* Expanded: output text */}
      {expanded && (
        <>
          <div className="border-t border-slate-100 px-6 py-5">
            <pre className="font-mono text-sm text-slate-900 whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto">
              {gen.output_text}
            </pre>
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
              <button
                onClick={handleCopy}
                className="text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors"
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GenerationsClient({ generations }: { generations: Generation[] }) {
  if (generations.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
        <p className="text-sm font-medium text-slate-900 mb-1">No generations yet</p>
        <p className="text-sm text-slate-500 mb-6">
          Generate something and it&apos;ll appear here. You need to be signed in for saves to work.
        </p>
        <a
          href="/generate"
          className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all"
        >
          Generate now →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {generations.map((gen) => (
        <GenerationCard key={gen.id} gen={gen} />
      ))}
    </div>
  );
}
