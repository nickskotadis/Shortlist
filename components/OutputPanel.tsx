"use client";

import { useState } from "react";
import type { GenerateStatus, GenerateResult } from "@/hooks/useGenerate";
import type { JdAnalysis, ValidatorIssue, DocumentType } from "@/lib/types";

interface OutputPanelProps {
  status: GenerateStatus;
  streamText: string;
  jdAnalysis: JdAnalysis | null;
  result: GenerateResult | null;
  error: string | null;
  documentType: DocumentType;
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
      <span className="text-xs text-slate-500 w-24 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-slate-700 w-8 text-right">{score}/10</span>
    </div>
  );
}

function StatusBadge({ verdict }: { verdict: string }) {
  if (verdict === "PASS")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
        Passed quality check
      </span>
    );
  if (verdict === "REVISE")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
        Review before using
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 px-2.5 py-1 rounded-full">
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
    <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
  );
}

export default function OutputPanel({
  status,
  streamText,
  jdAnalysis,
  result,
  error,
  documentType,
}: OutputPanelProps) {
  const [copied, setCopied] = useState(false);
  const [exportLoading, setExportLoading] = useState<{ docx: boolean; pdf: boolean }>({
    docx: false,
    pdf: false,
  });

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
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shortlist-${documentType}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExportLoading((prev) => ({ ...prev, [format]: false }));
    }
  };

  // ── Idle state ─────────────────────────────────────────────────────────────
  if (status === "idle") {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-80 text-center px-8 py-16 rounded-2xl border-2 border-dashed border-slate-200 bg-white">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-500">Your output will appear here</p>
        <p className="text-xs text-slate-400 mt-1">Fill in the form and click Generate</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-80 text-center px-8 py-16 rounded-2xl border border-red-100 bg-red-50">
        <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-red-800">Something went wrong</p>
        <p className="text-xs text-red-500 mt-1 max-w-xs">{error}</p>
      </div>
    );
  }

  // ── Parsing state ──────────────────────────────────────────────────────────
  if (status === "parsing") {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-80 text-center px-8 py-16 rounded-2xl border border-slate-200 bg-white">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-600">Analyzing job description...</p>
        <p className="text-xs text-slate-400 mt-1">Extracting role signals and requirements</p>
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
          <span className="text-xs text-slate-500">Targeting:</span>
          <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
            {jdAnalysis.role_title}
          </span>
          {jdAnalysis.seniority_level && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full capitalize">
              {jdAnalysis.seniority_level}
            </span>
          )}
          {jdAnalysis.company_type && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full capitalize">
              {jdAnalysis.company_type}
            </span>
          )}
        </div>
      )}

      {/* Status bar */}
      {(isStreaming || isValidating) && (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="text-xs text-slate-500">
            {isValidating ? "Checking quality..." : "Generating..."}
          </span>
        </div>
      )}

      {/* Output text */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div
          className={`text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-mono ${isStreaming ? "cursor-blink" : ""}`}
        >
          {displayText || (
            <span className="text-slate-300 italic">Generating...</span>
          )}
        </div>
      </div>

      {/* Scores — shown when done */}
      {status === "done" && result && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Quality scores
              </p>
              <div className="flex items-center gap-2">
                <StatusBadge verdict={result.verdict} />
                <span className="text-sm font-bold text-slate-900">
                  {result.overall.toFixed(1)}/10
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {Object.entries(result.scores).map(([key, score]) => (
                <ScoreBar key={key} label={scoreLabels[key] ?? key} score={score} />
              ))}
            </div>
            {result.retryCount > 0 && (
              <p className="text-xs text-slate-400 mt-3">
                ↻ Refined once to improve quality
              </p>
            )}
          </div>

          {/* Hallucination / skill inflation flags */}
          {(() => {
            const flags = result.issues.filter(
              (i: ValidatorIssue) => i.type === "hallucination" || i.type === "skill_inflation"
            );
            if (flags.length === 0) return null;
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs font-semibold text-amber-800">Verify before submitting</p>
                </div>
                <div className="space-y-3">
                  {flags.map((flag: ValidatorIssue, i: number) => (
                    <div key={i}>
                      <p className="text-xs font-mono text-amber-900 bg-amber-100 px-2 py-1 rounded mb-1 break-words">
                        &ldquo;{flag.location}&rdquo;
                      </p>
                      <p className="text-xs text-amber-700 leading-relaxed">{flag.fix}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Copy */}
            <button
              onClick={copy}
              className="flex items-center gap-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg transition-colors"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="flex items-center gap-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportLoading.docx ? <Spinner /> : <DownloadIcon />}
              DOCX
            </button>

            {/* PDF */}
            <button
              onClick={() => downloadExport("pdf")}
              disabled={exportLoading.pdf}
              className="flex items-center gap-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportLoading.pdf ? <Spinner /> : <DownloadIcon />}
              PDF
            </button>

            {/* Hiring manager worry */}
            {jdAnalysis?.hiring_manager_worry && (
              <div className="flex-1 bg-slate-50 rounded-lg px-4 py-2 border border-slate-100">
                <p className="text-xs text-slate-400 font-medium mb-0.5">What they worry about</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {jdAnalysis.hiring_manager_worry}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
