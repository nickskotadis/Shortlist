"use client";

import { useState, useRef, useEffect } from "react";
import { usePostHog } from "posthog-js/react";
import type { InterviewPrepResult, InterviewQuestion } from "@/lib/types";

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<
  InterviewQuestion["category"],
  { label: string; classes: string }
> = {
  behavioral: {
    label: "Behavioral",
    classes: "text-indigo-400 bg-indigo-950/40 border-indigo-900/50",
  },
  technical: {
    label: "Technical",
    classes: "text-violet-400 bg-violet-950/40 border-violet-900/50",
  },
  situational: {
    label: "Situational",
    classes: "text-amber-400 bg-amber-950/30 border-amber-900/40",
  },
  culture: {
    label: "Culture",
    classes: "text-emerald-400 bg-emerald-950/30 border-emerald-900/40",
  },
};

// ── Question card ─────────────────────────────────────────────────────────────

function QuestionCard({ q }: { q: InterviewQuestion }) {
  const [copied, setCopied] = useState(false);
  const style = CATEGORY_STYLES[q.category] ?? CATEGORY_STYLES.behavioral;

  const handleCopy = async () => {
    const text = `Q: ${q.question}\n\nHow to answer:\n${q.framework}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="bg-[#0D1122] rounded-2xl border border-[#232548] p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <span
          className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${style.classes}`}
        >
          {style.label}
        </span>
        <button
          onClick={handleCopy}
          title="Copy question + framework"
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-[#8888A8] hover:text-indigo-400 bg-[#13182C] hover:bg-indigo-950/40 border border-[#232548] hover:border-indigo-900/50 px-3 py-1.5 rounded-lg transition-all"
        >
          {copied ? (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      <p className="text-[#EEEEFC] text-base font-medium mb-4 leading-relaxed">{q.question}</p>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-[#5A5A80] uppercase tracking-wide mb-1">
            Why they ask this
          </p>
          <p className="text-sm text-[#8888A8] leading-relaxed">{q.why_asked}</p>
        </div>
        <div className="border-t border-[#1A1D38] pt-3">
          <p className="text-xs font-semibold text-[#5A5A80] uppercase tracking-wide mb-1">
            How to answer
          </p>
          <p className="text-sm text-[#C8C8F0] leading-relaxed">{q.framework}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InterviewClient({ savedResume }: { savedResume: string | null }) {
  const posthog = usePostHog();
  const [jdText, setJdText] = useState("");
  const [resumeText, setResumeText] = useState(savedResume ?? "");
  const [loading, setLoading] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [result, setResult] = useState<InterviewPrepResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    posthog?.capture("interview_prep_page_viewed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wordCount = resumeText.trim().split(/\s+/).filter(Boolean).length;

  const handleGenerate = async () => {
    if (!resumeText.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resumeText,
          ...(jdText.trim() ? { jd_text: jdText } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to generate questions — please try again.");
        return;
      }
      setResult(data as InterviewPrepResult);
      posthog?.capture("interview_prep_generated", {
        question_count: (data as InterviewPrepResult).questions?.length ?? 0,
      });
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
          Free · No generation count used
        </div>
        <h1 className="text-3xl font-bold text-[#EEEEFC] mb-3">Interview Prep</h1>
        <p className="text-base text-[#8888A8] max-w-xl mx-auto">
          Get 6–8 tailored interview questions with STAR-format answer frameworks, based on your resume and the job description.
        </p>
      </div>

      {/* Input card */}
      <div className="bg-[#0D1122] rounded-2xl border border-[#232548] p-6 mb-4">
        {/* JD input */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-[#E0E0F8] mb-1.5">
            Job description
            <span className="ml-2 text-xs font-normal text-[#5A5A80]">optional but recommended</span>
          </label>
          <textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            rows={5}
            placeholder="Paste the job description — optional but recommended for tailored questions"
            className="w-full border border-[#232548] rounded-lg px-4 py-3 text-sm text-[#EEEEFC] placeholder-[#4A4A68] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#13182C] transition resize-none"
          />
        </div>

        {/* Resume input */}
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
            placeholder="Paste your resume here — the more detail, the more tailored the questions and frameworks"
            className="w-full border border-[#232548] rounded-lg px-4 py-3 text-sm text-[#EEEEFC] placeholder-[#4A4A68] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#13182C] transition resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-[#5A5A80]">{wordCount} words</p>
          </div>
        </div>
      </div>

      {/* Generate button */}
      <div className="flex justify-end mb-6">
        <button
          onClick={handleGenerate}
          disabled={!resumeText.trim() || loading}
          className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            resumeText.trim() && !loading
              ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20 hover:-translate-y-px"
              : "bg-[#141830] text-[#4A4A68] cursor-not-allowed"
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating questions...
            </span>
          ) : (
            "Generate questions →"
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-5 mb-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && result.questions.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-[#5A5A80] text-right">
            {result.questions.length} questions generated
          </p>
          {result.questions.map((q, i) => (
            <QuestionCard key={i} q={q} />
          ))}
        </div>
      )}
    </main>
  );
}
