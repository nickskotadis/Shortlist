"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { useGenerate } from "@/hooks/useGenerate";
import { useBatchGenerate } from "@/hooks/useBatchGenerate";
import OutputPanel from "@/components/OutputPanel";
import UserMenu from "@/components/UserMenu";
import NavMobileMenu from "@/components/NavMobileMenu";
import type { DocumentType, UserType, UserData, ToneType } from "@/lib/types";
import { FREE_MONTHLY_LIMIT, TONES } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanUsage {
  plan: "free" | "pro";
  usedThisMonth: number;
  limit: number | null;
}

// ─── User type config ─────────────────────────────────────────────────────────

const USER_TYPES: { value: UserType; label: string; description: string }[] = [
  {
    value: "career_switcher",
    label: "Career Switcher",
    description: "Transitioning from one industry or field to another",
  },
  {
    value: "mid_career",
    label: "Mid-Career",
    description: "5–15 years of experience, targeting a step up or lateral move",
  },
  {
    value: "student",
    label: "Student / New Grad",
    description: "0–2 years experience, internships, projects, campus roles",
  },
  {
    value: "executive",
    label: "Executive",
    description: "VP, C-suite, or Board-level roles",
  },
];

const DOC_TYPES: { value: DocumentType; label: string; description: string; noJd?: boolean }[] = [
  { value: "bullets", label: "Resume Bullets", description: "5 tailored bullets for your most relevant role" },
  { value: "summary", label: "Professional Summary", description: "A 3–4 sentence header for your resume" },
  { value: "cover_letter", label: "Cover Letter", description: "A specific, non-templated 300-word letter" },
  { value: "linkedin_about", label: "LinkedIn About", description: "2,600-char profile section optimized for search", noJd: true },
  { value: "linkedin_headline", label: "LinkedIn Headline", description: "220-char punchy headline with keywords", noJd: true },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-[var(--color-text-label)] mb-1.5">
      {children}
    </label>
  );
}

function Input({
  placeholder,
  value,
  onChange,
}: {
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent bg-[var(--color-elevated)] transition"
    />
  );
}

function Textarea({
  placeholder,
  value,
  onChange,
  rows = 5,
  hint,
}: {
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <div>
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent bg-[var(--color-elevated)] transition resize-none"
      />
      {hint && <p className="text-xs text-[var(--color-text-tertiary)] mt-1.5">{hint}</p>}
    </div>
  );
}

// User-type-specific background fields
function UserDataFields({
  userType,
  userData,
  setUserData,
}: {
  userType: UserType;
  userData: UserData;
  setUserData: (d: UserData) => void;
}) {
  const set = (key: keyof UserData) => (value: string) =>
    setUserData({ ...userData, [key]: value });

  if (userType === "career_switcher") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Current role</Label>
          <Input placeholder="e.g. High school teacher" value={userData.from_role ?? ""} onChange={set("from_role")} />
        </div>
        <div>
          <Label>Current industry</Label>
          <Input placeholder="e.g. Education" value={userData.from_industry ?? ""} onChange={set("from_industry")} />
        </div>
        <div>
          <Label>Target role</Label>
          <Input placeholder="e.g. Product Manager" value={userData.to_role ?? ""} onChange={set("to_role")} />
        </div>
        <div>
          <Label>Target industry</Label>
          <Input placeholder="e.g. B2B SaaS" value={userData.to_industry ?? ""} onChange={set("to_industry")} />
        </div>
        <div>
          <Label>Years of experience</Label>
          <Input placeholder="e.g. 7" value={userData.years_experience ?? ""} onChange={set("years_experience")} />
        </div>
      </div>
    );
  }

  if (userType === "mid_career") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Current title</Label>
          <Input placeholder="e.g. Senior Marketing Manager" value={userData.current_job_title ?? ""} onChange={set("current_job_title")} />
        </div>
        <div>
          <Label>Target title</Label>
          <Input placeholder="e.g. Director of Marketing" value={userData.target_job_title ?? ""} onChange={set("target_job_title")} />
        </div>
        <div>
          <Label>Current level</Label>
          <Input placeholder="e.g. Senior Manager" value={userData.current_level ?? ""} onChange={set("current_level")} />
        </div>
        <div>
          <Label>Target level</Label>
          <Input placeholder="e.g. Director" value={userData.target_level ?? ""} onChange={set("target_level")} />
        </div>
        <div>
          <Label>Industry</Label>
          <Input placeholder="e.g. B2B SaaS" value={userData.industry ?? ""} onChange={set("industry")} />
        </div>
        <div>
          <Label>Years of experience</Label>
          <Input placeholder="e.g. 9" value={userData.years_experience ?? ""} onChange={set("years_experience")} />
        </div>
      </div>
    );
  }

  if (userType === "student") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Degree</Label>
          <Input placeholder="e.g. B.S. Computer Science" value={userData.degree ?? ""} onChange={set("degree")} />
        </div>
        <div>
          <Label>School</Label>
          <Input placeholder="e.g. University of Michigan" value={userData.school ?? ""} onChange={set("school")} />
        </div>
        <div>
          <Label>Grad year</Label>
          <Input placeholder="e.g. 2025" value={userData.grad_year ?? ""} onChange={set("grad_year")} />
        </div>
        <div>
          <Label>GPA (optional)</Label>
          <Input placeholder="e.g. 3.7" value={userData.gpa ?? ""} onChange={set("gpa")} />
        </div>
        <div>
          <Label>Target role</Label>
          <Input placeholder="e.g. Software Engineer" value={userData.target_role ?? ""} onChange={set("target_role")} />
        </div>
        <div>
          <Label>Target industry</Label>
          <Input placeholder="e.g. Fintech" value={userData.target_industry ?? ""} onChange={set("target_industry")} />
        </div>
      </div>
    );
  }

  if (userType === "executive") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Most recent title</Label>
          <Input placeholder="e.g. SVP of Operations" value={userData.most_recent_role ?? ""} onChange={set("most_recent_role")} />
        </div>
        <div>
          <Label>Company context</Label>
          <Input placeholder="e.g. Series D logistics startup, 500 employees" value={userData.most_recent_company_type ?? ""} onChange={set("most_recent_company_type")} />
        </div>
        <div>
          <Label>Target role</Label>
          <Input placeholder="e.g. Chief Operating Officer" value={userData.target_role ?? ""} onChange={set("target_role")} />
        </div>
        <div>
          <Label>Years of experience</Label>
          <Input placeholder="e.g. 22" value={userData.years_experience ?? ""} onChange={set("years_experience")} />
        </div>
      </div>
    );
  }

  return null;
}

// ─── Usage meter ──────────────────────────────────────────────────────────────

function UsageMeter({ usage }: { usage: PlanUsage }) {
  if (usage.plan === "pro") {
    return (
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full text-[var(--color-accent)] bg-[var(--color-accent-weak)] border border-[var(--color-accent-weak-border)]">
          <span className="w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full" />
          Pro · Unlimited
        </span>
      </div>
    );
  }

  const limit = usage.limit ?? FREE_MONTHLY_LIMIT;
  const used = usage.usedThisMonth;
  const atLimit = used >= limit;
  const pct = Math.min((used / limit) * 100, 100);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-medium ${atLimit ? "text-[var(--color-warning)]" : "text-[var(--color-text-secondary)]"}`}>
          {used} of {limit} used this month
        </span>
        <Link
          href="/pricing"
          className="text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
        >
          Upgrade to Pro →
        </Link>
      </div>
      <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${atLimit ? "bg-[var(--color-warning)]" : "bg-[var(--color-accent)]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Batch output panel ───────────────────────────────────────────────────────

const BATCH_DOC_LABELS: Record<string, string> = {
  bullets: "Resume Bullets",
  cover_letter: "Cover Letter",
  linkedin_about: "LinkedIn About",
};

function BatchOutputPanel({
  states,
  onDownloadZip,
  zipLoading,
  isAuthenticated,
}: {
  states: import("@/hooks/useBatchGenerate").BatchState[];
  onDownloadZip: () => void;
  zipLoading: boolean;
  isAuthenticated: boolean;
}) {
  const [activeTab, setActiveTab] = useState<DocumentType>("bullets");

  const active = states.find((s) => s.docType === activeTab) ?? states[0];
  const allDone = states.every((s) => s.status === "done");

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-[var(--color-elevated)] p-1 rounded-md border border-[var(--color-border)]">
        {states.map((s) => {
          const done = s.status === "done";
          const running = s.status === "parsing" || s.status === "generating" || s.status === "validating";
          return (
            <button
              key={s.docType}
              onClick={() => setActiveTab(s.docType)}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-2 rounded-lg transition-all ${
                activeTab === s.docType
                  ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {running && (
                <span className="w-2.5 h-2.5 border border-[var(--color-accent)] border-t-transparent rounded-full animate-spin shrink-0" />
              )}
              {done && (
                <span className="w-2.5 h-2.5 bg-[var(--color-success)] rounded-full shrink-0" />
              )}
              {!running && !done && (
                <span className="w-2.5 h-2.5 bg-[var(--color-border-strong)] rounded-full shrink-0" />
              )}
              <span>{BATCH_DOC_LABELS[s.docType] ?? s.docType}</span>
            </button>
          );
        })}
      </div>

      {/* Active tab output */}
      {active && (
        <OutputPanel
          status={active.status}
          streamText={active.streamText}
          jdAnalysis={null}
          isAuthenticated={isAuthenticated}
          result={active.result
            ? {
                output: active.result.output,
                jdAnalysis: null as never,
                scores: active.result.scores,
                overall: active.result.overall,
                verdict: active.result.verdict,
                validationUnavailable: active.result.validationUnavailable,
                retryCount: 0,
                issues: active.result.issues,
                generationId: active.result.generationId,
                keywords: active.result.keywords,
                tailoringSuggestions: [],
              }
            : null}
          error={null}
          documentType={active.docType}
        />
      )}

      {/* ZIP download — shown when all done */}
      {allDone && (
        <button
          onClick={onDownloadZip}
          disabled={zipLoading}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md border border-[var(--color-accent-weak-border)] text-sm font-semibold text-[var(--color-accent)] bg-[var(--color-accent-weak)] hover:brightness-95 transition-all disabled:opacity-50"
        >
          {zipLoading ? (
            <span className="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
          Download full package (.zip)
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GenerateForm({
  initialUsage,
  savedResume,
  userEmail,
}: {
  initialUsage: PlanUsage | null;
  savedResume: string | null;
  userEmail?: string | null;
}) {
  const posthog = usePostHog();
  const [userType, setUserType] = useState<UserType | null>(null);
  const [userData, setUserData] = useState<UserData>({});
  const [jdText, setJdText] = useState("");
  const [candidateInput, setCandidateInput] = useState(savedResume ?? "");
  const [documentType, setDocumentType] = useState<DocumentType>("bullets");
  const [tone, setTone] = useState<ToneType>("professional");
  const [batchMode, setBatchMode] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);

  // Saved resume state
  const [resumeSaved, setResumeSaved] = useState(!!savedResume);
  const [resumeSaving, setResumeSaving] = useState(false);

  // PDF upload state
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generatingRef = useRef(false);

  const { generate, status, streamText, jdAnalysis, result, error, limitReached, sessionExpired, tailoringSuggestions } = useGenerate();
  const { generateBatch, running: batchRunning, states: batchStates, limitReached: batchLimitReached, sessionExpired: batchSessionExpired } = useBatchGenerate();

  const isRunning = batchMode
    ? batchRunning
    : status === "parsing" || status === "generating" || status === "validating";
  const effectiveLimitReached = batchMode ? batchLimitReached : limitReached;
  const effectiveSessionExpired = batchMode ? batchSessionExpired : sessionExpired;

  // JD is optional for LinkedIn doc types
  const selectedDocType = DOC_TYPES.find((d) => d.value === documentType);
  const jdRequired = !selectedDocType?.noJd;

  const canGenerate =
    userType !== null &&
    (batchMode ? jdText.trim().length > 0 : (jdRequired ? jdText.trim().length > 0 : true)) &&
    candidateInput.trim().length > 0 &&
    !isRunning &&
    !effectiveLimitReached;

  // Release the generation lock once the run finishes (done, error, or idle)
  useEffect(() => {
    if (!isRunning) generatingRef.current = false;
  }, [isRunning]);

  // Pre-fill JD from URL params (Chrome extension integration)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jd = params.get("jd");
    // BUG-17: cap URL param length before decoding to avoid excessive state work
    if (jd && jd.length <= 20_000) setJdText(decodeURIComponent(jd));
  }, []);

  const handleGenerate = () => {
    if (!canGenerate || !userType || generatingRef.current) return;
    generatingRef.current = true;
    const request = {
      document_type: documentType,
      jd_text: jdRequired ? jdText : undefined,
      user_type: userType,
      user_data: userData,
      candidate_input: candidateInput,
      tone,
    };
    posthog?.capture("generation_started", {
      doc_type: batchMode ? "batch" : documentType,
      tone,
      user_type: userType,
      batch_mode: batchMode,
    });
    if (batchMode) {
      generateBatch({ ...request, jd_text: jdText });
    } else {
      generate(request);
    }
  };

  const handleDownloadZip = useCallback(async () => {
    const doneDocs = batchStates.filter((s) => s.status === "done" && s.result);
    if (doneDocs.length === 0) return;
    setZipLoading(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "zip",
          batch: doneDocs.map((s) => ({
            output_text: s.result!.output,
            document_type: s.docType,
          })),
        }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "shortlist-application-package.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silent
    } finally {
      setZipLoading(false);
    }
  }, [batchStates]);

  // ── PDF / DOCX upload ───────────────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    setParseLoading(true);
    setParseError(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/parse-resume", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({} as { error?: string; text?: string }));
      if (!res.ok) {
        setParseError(data.error ?? `Couldn't read that file (error ${res.status}) — try pasting instead.`);
        return;
      }
      if (!data.text) {
        setParseError("No text found in that file — try pasting your resume instead.");
        return;
      }
      setCandidateInput(data.text);
      setResumeSaved(false); // content changed, not yet saved
    } catch {
      setParseError("Failed to parse file — try pasting manually.");
    } finally {
      setParseLoading(false);
    }
  };

  // ── Save resume ─────────────────────────────────────────────────────────────
  const handleSaveResume = async () => {
    if (!candidateInput.trim() || resumeSaving) return;
    setResumeSaving(true);
    try {
      const res = await fetch("/api/profile/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_text: candidateInput }),
      });
      if (res.ok) {
        setResumeSaved(true);
      }
    } catch {
      // Silent — non-critical
    } finally {
      setResumeSaving(false);
    }
  };

  const sectionNum = (base: number) => {
    let n = base;
    if (!userType) n--; // background section hidden
    if (selectedDocType?.noJd) n--; // JD section hidden
    return n;
  };

  return (
    <div className="min-h-screen bg-[var(--color-page)]">
      {/* Nav */}
      <nav className="bg-[var(--color-nav-bg)] backdrop-blur-xl border-b border-[var(--color-border-subtle)] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-1">
            <Link href="/" className="font-serif text-xl text-[var(--color-text-primary)] tracking-tight hover:text-[var(--color-accent)] transition-colors mr-4">
              Shortlist
            </Link>
            <div className="hidden sm:flex items-center gap-0.5">
              <Link href="/dashboard" className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)] transition-all">Dashboard</Link>
              <Link href="/applications" className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)] transition-all">Applications</Link>
              <span className="px-3 py-1.5 rounded text-sm font-medium text-[var(--color-accent)] bg-[var(--color-accent-weak)] border border-[var(--color-accent-weak-border)]">Generate</span>
              <Link href="/fit" className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)] transition-all">Fit</Link>
              <Link href="/score" className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)] transition-all">Score</Link>
              <Link href="/interview" className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)] transition-all">Interview</Link>
              <Link href="/negotiate" className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)] transition-all">Negotiate</Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userEmail ? (
              <>
                <UserMenu email={userEmail} />
                <NavMobileMenu activePage="generate" />
              </>
            ) : (
              <Link href="/auth/login" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Two-column layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:grid lg:grid-cols-[1fr_1fr] lg:gap-8 lg:items-start">

        {/* ── LEFT: Form ──────────────────────────────────────────────────── */}
        <div className="space-y-6 mb-8 lg:mb-0">

          {/* Section 1: Who are you? */}
          <div className="bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] p-6">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
              1. Who are you?
            </h2>
            <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
              This shapes how your experience is framed and what tone we use.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {USER_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    setUserType(t.value);
                    setUserData({});
                  }}
                  className={`text-left rounded-md border px-4 py-3.5 transition-all ${
                    userType === t.value
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-weak)] ring-1 ring-[var(--color-accent)]"
                      : "border-[var(--color-border)] bg-[var(--color-elevated)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <p className={`text-sm font-medium mb-0.5 ${userType === t.value ? "text-[var(--color-accent)]" : "text-[var(--color-text-primary)]"}`}>
                    {t.label}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Your background (only when type selected) */}
          {userType && (
            <div className="bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] p-6">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                2. Your background
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
                Used to calibrate framing, tone, and level of ownership claimed.
              </p>
              <UserDataFields
                userType={userType}
                userData={userData}
                setUserData={setUserData}
              />
            </div>
          )}

          {/* Section: The job */}
          {!selectedDocType?.noJd && (
            <div className="bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] p-6">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                {userType ? "3." : "2."} The job
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
                Paste the full job description. More detail = better output.
              </p>
              <Textarea
                placeholder="Paste the full job description here..."
                value={jdText}
                onChange={setJdText}
                rows={8}
                hint="Include the full posting — responsibilities, requirements, about the company."
              />
            </div>
          )}

          {/* Section: Your resume / experience */}
          <div className="bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {sectionNum(4)}. Your resume
              </h2>
              <div className="flex items-center gap-2">
                {/* Save resume badge */}
                {resumeSaved && candidateInput.trim() && (
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--color-success)] bg-[var(--color-success-bg)] border border-[var(--color-success-border)] px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-[var(--color-success)] rounded-full" />
                    Saved
                  </span>
                )}
                {/* Upload PDF/DOCX */}
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
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] bg-[var(--color-elevated)] hover:bg-[var(--color-accent-weak)] border border-[var(--color-border)] hover:border-[var(--color-accent-weak-border)] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {parseLoading ? (
                    <span className="w-3 h-3 border-2 border-[var(--color-text-placeholder)] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  )}
                  {parseLoading ? "Parsing..." : "Upload PDF / DOCX"}
                </button>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
              Paste your resume or upload a file. No need to make it perfect — raw bullet points work great.
            </p>
            {parseError && (
              <p className="text-xs text-[var(--color-error)] mb-2">{parseError}</p>
            )}
            <Textarea
              placeholder="Paste your resume or describe your experience...&#10;&#10;e.g. I managed a team of 5 engineers and shipped 3 major features that grew ARR from $2M to $8M. Previously at Acme Corp where I led the migration to microservices..."
              value={candidateInput}
              onChange={(v) => {
                setCandidateInput(v);
                if (resumeSaved) setResumeSaved(false);
              }}
              rows={8}
              hint="Include numbers where you have them — even rough ones (team size, revenue, % improvement, time saved)."
            />
            {/* Save as default button */}
            {initialUsage && candidateInput.trim() && (
              <div className="mt-3 flex items-center justify-end">
                <button
                  onClick={handleSaveResume}
                  disabled={resumeSaving || resumeSaved}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                    resumeSaved
                      ? "text-[var(--color-success)] bg-[var(--color-success-bg)] border-[var(--color-success-border)] cursor-default"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] bg-[var(--color-elevated)] hover:bg-[var(--color-accent-weak)] border-[var(--color-border)] hover:border-[var(--color-accent-weak-border)]"
                  } disabled:opacity-50`}
                >
                  {resumeSaving ? "Saving..." : resumeSaved ? "✓ Saved as default" : "Save as default resume"}
                </button>
              </div>
            )}
          </div>

          {/* Section: What to generate */}
          <div className="bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] p-6">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
              {sectionNum(5)}. What to generate
            </h2>
            <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
              Start with bullets — they feed the summary and cover letter.
            </p>

            {/* Doc type grid — 3+2 layout */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
              {DOC_TYPES.slice(0, 3).map((d) => (
                <button
                  key={d.value}
                  onClick={() => {
                    setDocumentType(d.value);
                    posthog?.capture("document_type_selected", { doc_type: d.value });
                  }}
                  className={`text-left rounded-md border px-3 py-3 transition-all ${
                    documentType === d.value
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-weak)] ring-1 ring-[var(--color-accent)]"
                      : "border-[var(--color-border)] bg-[var(--color-elevated)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <p className={`text-sm font-medium mb-0.5 ${documentType === d.value ? "text-[var(--color-accent)]" : "text-[var(--color-text-primary)]"}`}>
                    {d.label}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{d.description}</p>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
              {DOC_TYPES.slice(3).map((d) => (
                <button
                  key={d.value}
                  onClick={() => {
                    setDocumentType(d.value);
                    posthog?.capture("document_type_selected", { doc_type: d.value });
                  }}
                  className={`text-left rounded-md border px-3 py-3 transition-all ${
                    documentType === d.value
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-weak)] ring-1 ring-[var(--color-accent)]"
                      : "border-[var(--color-border)] bg-[var(--color-elevated)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-sm font-medium ${documentType === d.value ? "text-[var(--color-accent)]" : "text-[var(--color-text-primary)]"}`}>
                      {d.label}
                    </p>
                    <span className="text-xs text-[var(--color-accent)] bg-[var(--color-accent-weak)] border border-[var(--color-accent-weak-border)] px-1.5 py-0.5 rounded-full font-medium">
                      LinkedIn
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)]">{d.description}</p>
                </button>
              ))}
            </div>

            {/* Batch mode toggle */}
            {initialUsage?.plan === "pro" ? (
              <div className="mb-4 flex items-start justify-between gap-3 bg-[var(--color-accent-weak)] border border-[var(--color-accent-weak-border)] rounded-md px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">Full application package</p>
                  <p className="text-xs text-[var(--color-ink-secondary)] mt-0.5">Generate resume bullets, cover letter, and LinkedIn About at once. Counts as 3 generations.</p>
                </div>
                <button
                  onClick={() => setBatchMode((b) => !b)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    batchMode ? "bg-[var(--color-accent)]" : "bg-[var(--color-border-strong)]"
                  }`}
                  role="switch"
                  aria-checked={batchMode}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${batchMode ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            ) : (
              <Link href="/pricing" className="mb-4 flex items-start justify-between gap-3 bg-[var(--color-accent-weak)] border border-[var(--color-accent-weak-border)] rounded-md px-4 py-3 hover:border-[var(--color-rule-strong)] transition-colors">
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">Full application package</p>
                  <p className="text-xs text-[var(--color-ink-secondary)] mt-0.5">Generate resume bullets, cover letter, and LinkedIn About at once. Counts as 3 generations.</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-[var(--color-accent)] bg-[var(--color-accent-weak)] border border-[var(--color-accent-weak-border)] px-2 py-0.5 rounded-full self-center">Pro</span>
              </Link>
            )}

            {/* Tone selector */}
            <div className="mb-6">
              <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Writing tone</p>
              <div className="flex gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => {
                      setTone(t.value as ToneType);
                      posthog?.capture("tone_selected", { tone: t.value });
                    }}
                    title={t.description}
                    className={`flex-1 text-center rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      tone === t.value
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-weak)] text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]"
                        : "border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1.5">
                {TONES.find((t) => t.value === tone)?.description}
              </p>
            </div>

            {/* Usage meter — only for authenticated users */}
            {initialUsage && <UsageMeter usage={initialUsage} />}

            {/* Session expired */}
            {effectiveSessionExpired && (
              <div className="mb-4 bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-md p-4 text-center">
                <p className="text-sm font-medium text-[var(--color-warning)] mb-2">Session expired</p>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)] text-sm font-semibold px-5 py-2.5 rounded-md shadow-sm transition-all"
                >
                  Log in again →
                </Link>
              </div>
            )}

            {/* Limit reached — replace button with upgrade CTA */}
            {effectiveLimitReached ? (
              <div className="bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-md p-4 text-center">
                <p className="text-sm font-medium text-[var(--color-warning)] mb-1">
                  Monthly limit reached
                </p>
                <p className="text-xs text-[var(--color-warning)]/80 mb-3">
                  You&apos;ve used {FREE_MONTHLY_LIMIT} of {FREE_MONTHLY_LIMIT} free generations this month.
                </p>
                <Link
                  href="/pricing"
                  onClick={() => posthog?.capture("upgrade_clicked", { source: "generate_limit" })}
                  className="inline-flex items-center bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)] text-sm font-semibold px-5 py-2.5 rounded-md shadow-sm transition-all"
                >
                  Upgrade to Pro →
                </Link>
              </div>
            ) : (
              <>
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className={`w-full py-3.5 rounded-md text-sm font-semibold transition-all ${
                    canGenerate
                      ? "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-contrast)] hover:brightness-95 cursor-pointer"
                      : "bg-[var(--color-disabled)] text-[var(--color-text-placeholder)] cursor-not-allowed"
                  }`}
                >
                  {isRunning ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                      {status === "parsing"
                        ? "Analyzing job description..."
                        : status === "validating"
                        ? "Checking quality..."
                        : "Generating..."}
                    </span>
                  ) : (
                    "Generate →"
                  )}
                </button>

                {!userType && (
                  <p className="text-xs text-[var(--color-text-tertiary)] text-center mt-3">
                    Select who you are to get started
                  </p>
                )}
                {userType && !canGenerate && !isRunning && (
                  <p className="text-xs text-[var(--color-text-tertiary)] text-center mt-3">
                    {jdRequired && !jdText.trim()
                      ? "Paste a job description and describe your experience to continue"
                      : "Describe your experience to continue"}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT: Output ──────────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-24">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {batchMode ? "Application Package" : "Output"}
            </h2>
            {!batchMode && status === "done" && (
              <button
                onClick={() =>
                  generate({
                    document_type: documentType,
                    jd_text: jdRequired ? jdText : undefined,
                    user_type: userType!,
                    user_data: userData,
                    candidate_input: candidateInput,
                    tone,
                  })
                }
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors font-medium"
              >
                ↻ Regenerate
              </button>
            )}
          </div>

          {batchMode ? (
            <BatchOutputPanel
              states={batchStates}
              onDownloadZip={handleDownloadZip}
              zipLoading={zipLoading}
              isAuthenticated={!!userEmail}
            />
          ) : (
            <OutputPanel
              status={status}
              streamText={streamText}
              jdAnalysis={jdAnalysis}
              result={result}
              error={error}
              documentType={documentType}
              tailoringSuggestions={tailoringSuggestions}
              isAuthenticated={!!userEmail}
            />
          )}
        </div>
      </div>
    </div>
  );
}
