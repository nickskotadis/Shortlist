"use client";

import { useState } from "react";
import Link from "next/link";
import { useGenerate } from "@/hooks/useGenerate";
import OutputPanel from "@/components/OutputPanel";
import type { DocumentType, UserType, UserData } from "@/lib/types";

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

const DOC_TYPES: { value: DocumentType; label: string; description: string }[] = [
  { value: "bullets", label: "Resume Bullets", description: "5 tailored bullets for your most relevant role" },
  { value: "summary", label: "Professional Summary", description: "A 3–4 sentence header for your resume" },
  { value: "cover_letter", label: "Cover Letter", description: "A specific, non-templated 300-word letter" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700 mb-1.5">
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
      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white transition"
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
        className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white transition resize-none"
      />
      {hint && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GeneratePage() {
  const [userType, setUserType] = useState<UserType | null>(null);
  const [userData, setUserData] = useState<UserData>({});
  const [jdText, setJdText] = useState("");
  const [candidateInput, setCandidateInput] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("bullets");

  const { generate, status, streamText, jdAnalysis, result, error } = useGenerate();

  const isRunning = status === "parsing" || status === "generating" || status === "validating";

  const canGenerate =
    userType !== null &&
    jdText.trim().length > 0 &&
    candidateInput.trim().length > 0 &&
    !isRunning;

  const handleGenerate = () => {
    if (!canGenerate || !userType) return;
    generate({
      document_type: documentType,
      jd_text: jdText,
      user_type: userType,
      user_data: userData,
      candidate_input: candidateInput,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-base font-semibold text-slate-900 tracking-tight hover:text-indigo-600 transition-colors">
            Shortlist
          </Link>
          <span className="text-xs text-slate-400 hidden sm:block">
            Fill in the form → click Generate
          </span>
        </div>
      </nav>

      {/* Two-column layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:grid lg:grid-cols-[1fr_1fr] lg:gap-8 lg:items-start">

        {/* ── LEFT: Form ──────────────────────────────────────────────────── */}
        <div className="space-y-6 mb-8 lg:mb-0">

          {/* Section 1: Who are you? */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">
              1. Who are you?
            </h2>
            <p className="text-xs text-slate-400 mb-4">
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
                  className={`text-left rounded-xl border px-4 py-3.5 transition-all ${
                    userType === t.value
                      ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <p className={`text-sm font-medium mb-0.5 ${userType === t.value ? "text-indigo-700" : "text-slate-900"}`}>
                    {t.label}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Your background (only when type selected) */}
          {userType && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">
                2. Your background
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Used to calibrate framing, tone, and level of ownership claimed.
              </p>
              <UserDataFields
                userType={userType}
                userData={userData}
                setUserData={setUserData}
              />
            </div>
          )}

          {/* Section 3: The job */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">
              {userType ? "3." : "2."} The job
            </h2>
            <p className="text-xs text-slate-400 mb-4">
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

          {/* Section 4: Your experience */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">
              {userType ? "4." : "3."} Your experience
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Describe your relevant experience in plain language. No need to make it perfect.
            </p>
            <Textarea
              placeholder="e.g. I managed a team of 5 and grew pipeline from $2M to $8M over 2 years. I also launched a new product line that became 30% of revenue..."
              value={candidateInput}
              onChange={setCandidateInput}
              rows={7}
              hint="Include numbers where you have them — even rough ones (team size, revenue, % improvement, time saved). Don't overthink it."
            />
          </div>

          {/* Section 5: Document type + Generate */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">
              {userType ? "5." : "4."} What to generate
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Start with bullets — they feed the summary and cover letter.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 mb-6">
              {DOC_TYPES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDocumentType(d.value)}
                  className={`flex-1 text-left rounded-xl border px-4 py-3 transition-all ${
                    documentType === d.value
                      ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <p className={`text-sm font-medium mb-0.5 ${documentType === d.value ? "text-indigo-700" : "text-slate-900"}`}>
                    {d.label}
                  </p>
                  <p className="text-xs text-slate-500">{d.description}</p>
                </button>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all ${
                canGenerate
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm cursor-pointer"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              {isRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
              <p className="text-xs text-slate-400 text-center mt-3">
                Select who you are to get started
              </p>
            )}
            {userType && !canGenerate && !isRunning && (
              <p className="text-xs text-slate-400 text-center mt-3">
                Paste a job description and describe your experience to continue
              </p>
            )}
          </div>
        </div>

        {/* ── RIGHT: Output ──────────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-24">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Output</h2>
            {(status === "done") && (
              <button
                onClick={() =>
                  generate({
                    document_type: documentType,
                    jd_text: jdText,
                    user_type: userType!,
                    user_data: userData,
                    candidate_input: candidateInput,
                  })
                }
                className="text-xs text-slate-500 hover:text-indigo-600 transition-colors font-medium"
              >
                ↻ Regenerate
              </button>
            )}
          </div>
          <OutputPanel
            status={status}
            streamText={streamText}
            jdAnalysis={jdAnalysis}
            result={result}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}
