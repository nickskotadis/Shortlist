"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import type {
  InterviewPrepResult,
  InterviewQuestion,
  AnswerCoachResult,
  MockInterviewMessage,
  MockInterviewDebrief,
} from "@/lib/types";

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

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score, maxScore = 10 }: { score: number; maxScore?: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(score, maxScore)) / maxScore;
  const offset = circumference * (1 - pct);
  const color = score >= maxScore * 0.8 ? "#34d399" : score >= maxScore * 0.6 ? "#818cf8" : "#fbbf24";

  return (
    <div className="relative inline-flex items-center justify-center w-16 h-16 shrink-0">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="var(--color-border-subtle)" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-base font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ── Question card (Question Bank mode) ────────────────────────────────────────

function QuestionCard({
  q,
  plan,
  resumeText,
  jdText,
}: {
  q: InterviewQuestion;
  plan: "free" | "pro";
  resumeText: string;
  jdText: string;
}) {
  const posthog = usePostHog();
  const [copied, setCopied] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<AnswerCoachResult | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
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

  const handleEvaluate = async () => {
    if (!answerText.trim() || evaluating) return;
    setEvaluating(true);
    setEvalError(null);
    setEvalResult(null);

    try {
      const res = await fetch("/api/interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.question,
          user_answer: answerText,
          framework: q.framework,
          ...(resumeText.trim() ? { resume_text: resumeText } : {}),
          ...(jdText.trim() ? { jd_text: jdText } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEvalError(data.error ?? "Evaluation failed — please try again.");
        return;
      }
      setEvalResult(data as AnswerCoachResult);
      posthog?.capture("interview_answer_evaluated", { score: (data as AnswerCoachResult).score });
    } catch {
      setEvalError("Something went wrong — please try again.");
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <span
          className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${style.classes}`}
        >
          {style.label}
        </span>
        <button
          onClick={handleCopy}
          title="Copy question + framework"
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-indigo-400 bg-[var(--color-elevated)] hover:bg-indigo-950/40 border border-[var(--color-border)] hover:border-indigo-900/50 px-3 py-1.5 rounded-lg transition-all"
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

      <p className="text-[var(--color-text-primary)] text-base font-medium mb-4 leading-relaxed">{q.question}</p>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide mb-1">
            Why they ask this
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{q.why_asked}</p>
        </div>
        <div className="border-t border-[var(--color-border-subtle)] pt-3">
          <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide mb-1">
            How to answer
          </p>
          <p className="text-sm text-[var(--color-text-output)] leading-relaxed">{q.framework}</p>
        </div>

        {/* Answer coach section */}
        <div className="border-t border-[var(--color-border-subtle)] pt-3">
          {plan === "pro" ? (
            <>
              <button
                onClick={() => {
                  setPracticeOpen((o) => !o);
                  if (practiceOpen) {
                    setEvalResult(null);
                    setEvalError(null);
                  }
                }}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {practiceOpen ? "Hide practice" : "Practice your answer"}
                <span className="ml-1">{practiceOpen ? "↑" : "↓"}</span>
              </button>

              {practiceOpen && (
                <div className="mt-3 space-y-3">
                  <textarea
                    value={answerText}
                    onChange={(e) => {
                      setAnswerText(e.target.value);
                      if (evalResult) setEvalResult(null);
                      if (evalError) setEvalError(null);
                    }}
                    rows={4}
                    placeholder="Type your answer here..."
                    className="w-full border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--color-elevated)] transition resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-tertiary)]">{answerText.trim().length} / 3000 chars</span>
                    <button
                      onClick={handleEvaluate}
                      disabled={!answerText.trim() || evaluating || answerText.trim().length < 10}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                        answerText.trim().length >= 10 && !evaluating
                          ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20 hover:-translate-y-px"
                          : "bg-[var(--color-disabled)] text-[var(--color-text-placeholder)] cursor-not-allowed"
                      }`}
                    >
                      {evaluating ? (
                        <>
                          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Evaluating...
                        </>
                      ) : (
                        "Get AI feedback →"
                      )}
                    </button>
                  </div>

                  {evalError && (
                    <p className="text-xs text-red-400">{evalError}</p>
                  )}

                  {evalResult && (
                    <div className="bg-[var(--color-inset)] rounded-xl border border-[var(--color-border)] p-4 space-y-4">
                      <div className="flex items-start gap-4">
                        <ScoreRing score={evalResult.score} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide mb-1">
                            Feedback
                          </p>
                          <p className="text-sm text-[var(--color-text-output)] leading-relaxed">{evalResult.feedback}</p>
                        </div>
                      </div>

                      {evalResult.what_worked.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2">
                            What worked
                          </p>
                          <ul className="space-y-1">
                            {evalResult.what_worked.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-output)]">
                                <span className="text-emerald-400 shrink-0 mt-0.5">•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {evalResult.what_to_improve.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
                            What to improve
                          </p>
                          <ul className="space-y-1">
                            {evalResult.what_to_improve.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-output)]">
                                <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <svg className="w-3 h-3 text-[var(--color-text-tertiary)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-xs text-[var(--color-text-tertiary)]">
                Pro ·{" "}
                <Link href="/pricing" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                  Practice your answer
                </Link>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mock Interview conversation ────────────────────────────────────────────────

type MockPhase = "setup" | "running" | "debrief";
type CategoryFocus = "all" | "behavioral" | "technical" | "situational";

const CATEGORY_FOCUS_OPTIONS: { value: CategoryFocus; label: string; description: string }[] = [
  { value: "all", label: "Mixed", description: "Behavioral, technical, situational & culture" },
  { value: "behavioral", label: "Behavioral", description: "STAR-format past experience" },
  { value: "technical", label: "Technical", description: "Role-specific skills & knowledge" },
  { value: "situational", label: "Situational", description: "Hypothetical scenarios" },
];

function MockInterview({
  plan,
  resumeText,
  jdText,
}: {
  plan: "free" | "pro";
  resumeText: string;
  jdText: string;
}) {
  const posthog = usePostHog();
  const [phase, setPhase] = useState<MockPhase>("setup");
  const [categoryFocus, setCategoryFocus] = useState<CategoryFocus>("all");
  const [conversation, setConversation] = useState<MockInterviewMessage[]>([]);
  const [pendingAnswer, setPendingAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [debrief, setDebrief] = useState<MockInterviewDebrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation]);

  const candidateTurns = conversation.filter((m) => m.role === "candidate").length;
  const canEndSession = candidateTurns >= 3;

  const callMockApi = async (
    action: "turn" | "debrief",
    currentConversation: MockInterviewMessage[]
  ) => {
    const res = await fetch("/api/interview/mock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        conversation: currentConversation,
        resume_text: resumeText,
        jd_text: jdText,
        category_focus: categoryFocus,
      }),
    });
    return res;
  };

  const handleStart = async () => {
    if (!resumeText.trim() || loading) return;
    setLoading(true);
    setError(null);
    setConversation([]);

    try {
      const res = await callMockApi("turn", []);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start — please try again.");
        return;
      }
      setConversation([{ role: "interviewer", content: data.message }]);
      setPhase("running");
      posthog?.capture("mock_interview_started", { category_focus: categoryFocus });
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendAnswer = async () => {
    const trimmed = pendingAnswer.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);

    const newConversation: MockInterviewMessage[] = [
      ...conversation,
      { role: "candidate", content: trimmed },
    ];
    setConversation(newConversation);
    setPendingAnswer("");

    try {
      const res = await callMockApi("turn", newConversation);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to generate follow-up — please try again.");
        return;
      }
      setConversation([...newConversation, { role: "interviewer", content: data.message }]);
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await callMockApi("debrief", conversation);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to generate debrief — please try again.");
        return;
      }
      setDebrief(data as MockInterviewDebrief);
      setPhase("debrief");
      posthog?.capture("mock_interview_completed", {
        turns: candidateTurns,
        overall_score: (data as MockInterviewDebrief).overall_score,
      });
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPhase("setup");
    setConversation([]);
    setPendingAnswer("");
    setDebrief(null);
    setError(null);
    setLoading(false);
  };

  // ── Pro gate ─────────────────────────────────────────────────────────────
  if (plan !== "pro") {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-8 text-center space-y-4">
        <svg className="w-8 h-8 text-[var(--color-text-tertiary)] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 bg-indigo-950/40 border border-indigo-900/50 px-3 py-1.5 rounded-full">
          Pro feature
        </div>
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Mock Interview Simulator</p>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto">
          Practice with an AI interviewer in real back-and-forth conversation. Get a full debrief with scores and specific coaching after each session.
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-sm shadow-indigo-600/20 hover:-translate-y-px transition-all"
        >
          Upgrade to Pro →
        </Link>
      </div>
    );
  }

  // ── Setup phase ───────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 space-y-5">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Mock Interview Simulator</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Real back-and-forth with an AI interviewer. 4–6 exchanges, then a full debrief with scores and coaching.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide mb-3">
            Focus area
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORY_FOCUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setCategoryFocus(opt.value)}
                className={`text-left px-3 py-3 rounded-xl border text-sm transition-all ${
                  categoryFocus === opt.value
                    ? "border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500"
                    : "border-[var(--color-border)] bg-[var(--color-elevated)] hover:border-[var(--color-border-strong)]"
                }`}
              >
                <span
                  className={`block font-semibold mb-0.5 ${
                    categoryFocus === opt.value ? "text-indigo-400" : "text-[var(--color-text-primary)]"
                  }`}
                >
                  {opt.label}
                </span>
                <span className="block text-xs text-[var(--color-text-tertiary)]">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>

        {!resumeText.trim() && (
          <p className="text-xs text-amber-400">
            Add your resume above for tailored questions and more specific coaching.
          </p>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          onClick={handleStart}
          disabled={loading}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
            !loading
              ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20 hover:-translate-y-px"
              : "bg-[var(--color-disabled)] text-[var(--color-text-placeholder)] cursor-not-allowed"
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Starting...
            </span>
          ) : (
            "Start Mock Interview →"
          )}
        </button>
      </div>
    );
  }

  // ── Running phase ─────────────────────────────────────────────────────────
  if (phase === "running") {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 bg-indigo-950/40 border border-indigo-900/50 px-2.5 py-1 rounded-full">
              Mock Interview
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)]">{candidateTurns} answer{candidateTurns !== 1 ? "s" : ""} given</span>
          </div>
          <div className="flex items-center gap-2">
            {canEndSession && (
              <button
                onClick={handleEndSession}
                disabled={loading}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/30 hover:bg-emerald-950/50 border border-emerald-900/40 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              >
                End session + get debrief
              </button>
            )}
            <button
              onClick={handleReset}
              className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              Restart
            </button>
          </div>
        </div>

        {/* Conversation */}
        <div ref={scrollRef} className="p-5 space-y-4 max-h-[480px] overflow-y-auto">
          {conversation.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "candidate" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "interviewer" && (
                <div className="w-7 h-7 rounded-full bg-[var(--color-elevated)] border border-[var(--color-border)] flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "interviewer"
                    ? "bg-[var(--color-elevated)] border border-[var(--color-border)] text-[var(--color-text-output)]"
                    : "bg-indigo-600/20 border border-indigo-500/30 text-[var(--color-text-primary)]"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-full bg-[var(--color-elevated)] border border-[var(--color-border)] flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="bg-[var(--color-elevated)] border border-[var(--color-border)] rounded-2xl px-4 py-3">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[var(--color-text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-[var(--color-text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-[var(--color-text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Answer input */}
        <div className="px-5 pb-5 border-t border-[var(--color-border-subtle)] pt-4">
          {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
          <div className="flex gap-3">
            <textarea
              value={pendingAnswer}
              onChange={(e) => setPendingAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendAnswer();
                }
              }}
              rows={2}
              placeholder="Type your answer... (Enter to send, Shift+Enter for new line)"
              disabled={loading}
              className="flex-1 border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--color-elevated)] transition resize-none disabled:opacity-50"
            />
            <button
              onClick={handleSendAnswer}
              disabled={!pendingAnswer.trim() || loading}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all self-end ${
                pendingAnswer.trim() && !loading
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20"
                  : "bg-[var(--color-disabled)] text-[var(--color-text-placeholder)] cursor-not-allowed"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          {!canEndSession && (
            <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
              Answer {3 - candidateTurns} more question{3 - candidateTurns !== 1 ? "s" : ""} to unlock the debrief
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Debrief phase ─────────────────────────────────────────────────────────
  if (phase === "debrief" && debrief) {
    const dimLabels: Record<keyof MockInterviewDebrief["dimension_scores"], string> = {
      structure: "STAR Structure",
      specificity: "Specificity",
      confidence: "Confidence",
      relevance: "Relevance",
    };

    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">Session Debrief</span>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-elevated)] hover:bg-indigo-950/40 border border-[var(--color-border)] hover:border-indigo-900/50 px-3 py-1.5 rounded-lg transition-all"
          >
            Practice again →
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Overall score */}
          <div className="flex items-start gap-5">
            <ScoreRing score={debrief.overall_score} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide mb-1">
                Overall Performance
              </p>
              <p className="text-sm text-[var(--color-text-output)] leading-relaxed">{debrief.summary}</p>
            </div>
          </div>

          {/* Dimension scores */}
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide mb-3">
              Dimension Scores
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(debrief.dimension_scores) as Array<keyof MockInterviewDebrief["dimension_scores"]>).map((key) => {
                const score = debrief.dimension_scores[key];
                const color = score >= 8 ? "#34d399" : score >= 6 ? "#818cf8" : "#fbbf24";
                return (
                  <div key={key} className="bg-[var(--color-inset)] rounded-xl border border-[var(--color-border)] p-3">
                    <p className="text-xs text-[var(--color-text-tertiary)] mb-1">{dimLabels[key]}</p>
                    <p className="text-xl font-bold" style={{ color }}>{score}<span className="text-xs font-normal text-[var(--color-text-tertiary)]">/10</span></p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strengths + improvements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {debrief.strengths.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                  What worked
                </p>
                <ul className="space-y-2">
                  {debrief.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-output)]">
                      <span className="text-emerald-400 shrink-0 mt-0.5">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {debrief.areas_to_improve.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
                  What to improve
                </p>
                <ul className="space-y-2">
                  {debrief.areas_to_improve.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-output)]">
                      <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Next steps */}
          {debrief.next_steps.length > 0 && (
            <div className="bg-[var(--color-inset)] rounded-xl border border-[var(--color-border)] p-4 space-y-2">
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">
                Next steps before your real interview
              </p>
              <ul className="space-y-1.5">
                {debrief.next_steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-output)]">
                    <span className="text-indigo-400 shrink-0 mt-0.5">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

type InterviewMode = "questions" | "mock";

export default function InterviewClient({
  savedResume,
  plan,
}: {
  savedResume: string | null;
  plan: "free" | "pro";
}) {
  const posthog = usePostHog();
  const [mode, setMode] = useState<InterviewMode>("questions");
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
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-3">Interview Prep</h1>
        <p className="text-base text-[var(--color-text-secondary)] max-w-xl mx-auto">
          Tailored questions with STAR frameworks, or practice in a real back-and-forth mock interview.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-1 mb-6 w-fit mx-auto">
        <button
          onClick={() => setMode("questions")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === "questions"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          Question Bank
          <span className="ml-2 text-xs font-normal opacity-70">Free</span>
        </button>
        <button
          onClick={() => setMode("mock")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === "mock"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          Mock Interview
          <span className="ml-2 text-xs font-normal opacity-70">Pro</span>
        </button>
      </div>

      {/* Input card */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 mb-4">
        {/* JD input */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-[var(--color-text-label)] mb-1.5">
            Job description
            <span className="ml-2 text-xs font-normal text-[var(--color-text-tertiary)]">optional but recommended</span>
          </label>
          <textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            rows={5}
            placeholder="Paste the job description — optional but recommended for tailored questions"
            className="w-full border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--color-elevated)] transition resize-none"
          />
        </div>

        {/* Resume input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-[var(--color-text-label)]">
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
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-indigo-400 bg-[var(--color-elevated)] hover:bg-indigo-950/40 border border-[var(--color-border)] hover:border-indigo-900/50 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
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
            rows={10}
            placeholder="Paste your resume here — the more detail, the more tailored the questions and frameworks"
            className="w-full border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--color-elevated)] transition resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-[var(--color-text-tertiary)]">{wordCount} words</p>
          </div>
        </div>
      </div>

      {/* Question Bank mode */}
      {mode === "questions" && (
        <>
          <div className="flex items-center justify-between mb-6">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 bg-indigo-950/40 border border-indigo-900/50 px-3 py-1.5 rounded-full">
              Free · No generation count used
            </span>
            <button
              onClick={handleGenerate}
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
                  Generating questions...
                </span>
              ) : (
                "Generate questions →"
              )}
            </button>
          </div>

          {error && (
            <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-5 mb-6 text-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {result && result.questions.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--color-text-tertiary)] text-right">
                {result.questions.length} questions generated
              </p>
              {result.questions.map((q, i) => (
                <QuestionCard key={i} q={q} plan={plan} resumeText={resumeText} jdText={jdText} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Mock Interview mode */}
      {mode === "mock" && (
        <MockInterview plan={plan} resumeText={resumeText} jdText={jdText} />
      )}
    </main>
  );
}
