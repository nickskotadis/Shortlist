"use client";

import { useState } from "react";
import Link from "next/link";
import type { NegotiationResult } from "@/lib/types";

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8888A8] hover:text-indigo-400 bg-[#13182C] hover:bg-indigo-950/40 border border-[#232548] hover:border-indigo-900/50 px-3 py-1.5 rounded-lg transition-all shrink-0"
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

// ── Result panel ──────────────────────────────────────────────────────────────

type Tab = "strategy" | "email" | "script" | "objections";

function ResultPanel({ result, currentOffer, targetOffer }: { result: NegotiationResult; currentOffer: number; targetOffer: number }) {
  const [activeTab, setActiveTab] = useState<Tab>("strategy");

  const delta = targetOffer - currentOffer;
  const deltaPct = Math.round((delta / currentOffer) * 100);

  const tabs: { id: Tab; label: string }[] = [
    { id: "strategy", label: "Strategy" },
    { id: "email", label: "Counter Email" },
    { id: "script", label: "Phone Script" },
    { id: "objections", label: "Handle Objections" },
  ];

  return (
    <div className="bg-[#0D1122] rounded-2xl border border-[#232548] overflow-hidden">
      {/* Summary bar */}
      <div className="px-6 py-4 border-b border-[#1A1D38] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-2.5 py-1 rounded-full">
            +{delta.toLocaleString()} ({deltaPct}% ask)
          </span>
          <span className="text-xs text-[#5A5A80]">
            {currentOffer.toLocaleString()} → {targetOffer.toLocaleString()}
          </span>
        </div>
        <CopyButton
          text={
            activeTab === "strategy"
              ? result.strategy
              : activeTab === "email"
              ? result.counter_email
              : activeTab === "script"
              ? result.phone_script
              : result.pushback_responses.map((r) => `${r.objection}\n→ ${r.response}`).join("\n\n")
          }
          label={`Copy ${tabs.find((t) => t.id === activeTab)?.label}`}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1A1D38]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-3 text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? "text-indigo-400 border-b-2 border-indigo-500 bg-indigo-950/20"
                : "text-[#5A5A80] hover:text-[#8888A8] hover:bg-[#13182C]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === "strategy" && (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-[#5A5A80] uppercase tracking-wide">
              Your Negotiation Strategy
            </p>
            <div className="text-sm text-[#C8C8F0] leading-relaxed whitespace-pre-wrap">
              {result.strategy}
            </div>
          </div>
        )}

        {activeTab === "email" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#5A5A80] uppercase tracking-wide">
              Counter-Offer Email — Ready to Send
            </p>
            <div className="bg-[#0B0E1E] rounded-xl border border-[#232548] p-4">
              <pre className="text-sm text-[#C8C8F0] leading-relaxed whitespace-pre-wrap font-mono">
                {result.counter_email}
              </pre>
            </div>
          </div>
        )}

        {activeTab === "script" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#5A5A80] uppercase tracking-wide">
              Phone Call Script
            </p>
            <div className="bg-[#0B0E1E] rounded-xl border border-[#232548] p-4">
              <p className="text-sm text-[#C8C8F0] leading-relaxed whitespace-pre-wrap">
                {result.phone_script}
              </p>
            </div>
          </div>
        )}

        {activeTab === "objections" && (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-[#5A5A80] uppercase tracking-wide">
              Common Pushback — How to Respond
            </p>
            <div className="space-y-3">
              {result.pushback_responses.map((item, i) => (
                <div key={i} className="bg-[#0B0E1E] rounded-xl border border-[#232548] p-4 space-y-2">
                  <p className="text-xs font-semibold text-amber-400">
                    {`"${item.objection}"`}
                  </p>
                  <p className="text-sm text-[#C8C8F0] leading-relaxed">{item.response}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NegotiateClient({
  plan,
  savedResume,
  isAuthed,
}: {
  plan: "free" | "pro";
  savedResume: string | null;
  isAuthed: boolean;
}) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [currentOffer, setCurrentOffer] = useState("");
  const [targetOffer, setTargetOffer] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [bonus, setBonus] = useState("");
  const [equity, setEquity] = useState("");
  const [competingOffer, setCompetingOffer] = useState("");
  const [notes, setNotes] = useState("");
  const [resumeText, setResumeText] = useState(savedResume ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NegotiationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsedCurrent = parseFloat(currentOffer.replace(/,/g, "")) || 0;
  const parsedTarget = parseFloat(targetOffer.replace(/,/g, "")) || 0;
  const canSubmit =
    company.trim() &&
    role.trim() &&
    parsedCurrent > 0 &&
    parsedTarget > parsedCurrent &&
    !loading;

  const handleGenerate = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          role: role.trim(),
          current_offer: parsedCurrent,
          target_offer: parsedTarget,
          currency,
          bonus: bonus.trim(),
          equity: equity.trim(),
          competing_offer: competingOffer.trim(),
          notes: notes.trim(),
          resume_text: resumeText.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "pro_required") {
          setError("pro_required");
        } else {
          setError(data.error ?? "Failed to generate — please try again.");
        }
        return;
      }
      setResult(data as NegotiationResult);
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Pro gate ───────────────────────────────────────────────────────────────
  if (!isAuthed) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="bg-[#0D1122] rounded-2xl border border-[#232548] p-10 space-y-5">
          <svg className="w-10 h-10 text-[#5A5A80] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-bold text-[#EEEEFC]">Sign in to use Negotiation Coach</h2>
          <p className="text-sm text-[#8888A8] max-w-sm mx-auto">
            The Salary Negotiation Coach is a Pro feature. Sign in and upgrade to get your complete negotiation package.
          </p>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-sm shadow-indigo-600/20 hover:-translate-y-px transition-all"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  if (plan !== "pro") {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="bg-[#0D1122] rounded-2xl border border-[#232548] p-10 space-y-5">
          <svg className="w-10 h-10 text-[#5A5A80] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 bg-indigo-950/40 border border-indigo-900/50 px-3 py-1.5 rounded-full">
            Pro feature
          </div>
          <h2 className="text-xl font-bold text-[#EEEEFC]">Salary Negotiation Coach</h2>
          <p className="text-sm text-[#8888A8] max-w-md mx-auto">
            The average successful negotiation adds $5–15k/year. Get a complete package: negotiation strategy, counter-offer email, phone script, and responses to every pushback.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-sm shadow-indigo-600/20 hover:-translate-y-px transition-all"
          >
            Upgrade to Pro →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 bg-indigo-950/40 border border-indigo-900/50 px-3 py-1.5 rounded-full mb-4">
          Pro · Salary Negotiation Coach
        </div>
        <h1 className="text-3xl font-bold text-[#EEEEFC] mb-3">Negotiate Your Offer</h1>
        <p className="text-base text-[#8888A8] max-w-xl mx-auto">
          Get a complete negotiation package: strategy, counter-offer email, phone script, and responses to every pushback.
        </p>
      </div>

      {/* Form card */}
      <div className="bg-[#0D1122] rounded-2xl border border-[#232548] p-6 mb-4 space-y-5">

        {/* Offer details */}
        <div>
          <p className="text-sm font-semibold text-[#EEEEFC] mb-1">1. Offer details</p>
          <p className="text-xs text-[#5A5A80] mb-4">Enter the current offer and what you want to achieve.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#E0E0F8] mb-1.5">
                Company <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme Corp"
                maxLength={200}
                className="w-full border border-[#232548] rounded-lg px-4 py-2.5 text-sm text-[#EEEEFC] placeholder-[#4A4A68] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#13182C] transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#E0E0F8] mb-1.5">
                Role <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Senior Product Manager"
                maxLength={200}
                className="w-full border border-[#232548] rounded-lg px-4 py-2.5 text-sm text-[#EEEEFC] placeholder-[#4A4A68] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#13182C] transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#E0E0F8] mb-1.5">
                Current offer (base) <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="border border-[#232548] rounded-lg px-3 py-2.5 text-sm text-[#EEEEFC] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#13182C] transition"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CAD">CAD</option>
                  <option value="AUD">AUD</option>
                </select>
                <input
                  type="text"
                  inputMode="numeric"
                  value={currentOffer}
                  onChange={(e) => setCurrentOffer(e.target.value)}
                  placeholder="120,000"
                  className="flex-1 border border-[#232548] rounded-lg px-4 py-2.5 text-sm text-[#EEEEFC] placeholder-[#4A4A68] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#13182C] transition"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#E0E0F8] mb-1.5">
                Your target (base) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={targetOffer}
                onChange={(e) => setTargetOffer(e.target.value)}
                placeholder="135,000"
                className="w-full border border-[#232548] rounded-lg px-4 py-2.5 text-sm text-[#EEEEFC] placeholder-[#4A4A68] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#13182C] transition"
              />
              {parsedCurrent > 0 && parsedTarget > 0 && parsedTarget <= parsedCurrent && (
                <p className="text-xs text-amber-400 mt-1">Target must be higher than current offer</p>
              )}
            </div>
          </div>
        </div>

        {/* Optional details */}
        <div className="border-t border-[#1A1D38] pt-5">
          <p className="text-sm font-semibold text-[#EEEEFC] mb-1">2. Additional details</p>
          <p className="text-xs text-[#5A5A80] mb-4">The more context you provide, the more specific your negotiation package.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#E0E0F8] mb-1.5">Bonus</label>
              <input
                type="text"
                value={bonus}
                onChange={(e) => setBonus(e.target.value)}
                placeholder="e.g. 10% target, up to 20%"
                maxLength={200}
                className="w-full border border-[#232548] rounded-lg px-4 py-2.5 text-sm text-[#EEEEFC] placeholder-[#4A4A68] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#13182C] transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#E0E0F8] mb-1.5">Equity</label>
              <input
                type="text"
                value={equity}
                onChange={(e) => setEquity(e.target.value)}
                placeholder="e.g. 50 RSUs over 4 years"
                maxLength={200}
                className="w-full border border-[#232548] rounded-lg px-4 py-2.5 text-sm text-[#EEEEFC] placeholder-[#4A4A68] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#13182C] transition"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-[#E0E0F8] mb-1.5">
                Competing offer / market data
                <span className="ml-2 text-xs font-normal text-[#5A5A80]">optional but powerful</span>
              </label>
              <input
                type="text"
                value={competingOffer}
                onChange={(e) => setCompetingOffer(e.target.value)}
                placeholder="e.g. competing offer at $140k, or market rate from Levels.fyi"
                maxLength={300}
                className="w-full border border-[#232548] rounded-lg px-4 py-2.5 text-sm text-[#EEEEFC] placeholder-[#4A4A68] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#13182C] transition"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-[#E0E0F8] mb-1.5">
                Any other context
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. they seem very interested, I'm currently employed, I have another final-round interview"
                maxLength={500}
                className="w-full border border-[#232548] rounded-lg px-4 py-3 text-sm text-[#EEEEFC] placeholder-[#4A4A68] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#13182C] transition resize-none"
              />
            </div>
          </div>
        </div>

        {/* Resume */}
        <div className="border-t border-[#1A1D38] pt-5">
          <p className="text-sm font-semibold text-[#EEEEFC] mb-1">3. Your resume</p>
          <p className="text-xs text-[#5A5A80] mb-4">
            Optional — adds personalization to the strategy and email.
          </p>
          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            rows={6}
            placeholder="Paste your resume here for more personalized advice..."
            className="w-full border border-[#232548] rounded-lg px-4 py-3 text-sm text-[#EEEEFC] placeholder-[#4A4A68] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#13182C] transition resize-none"
          />
        </div>
      </div>

      {/* Generate button */}
      <div className="flex justify-end mb-6">
        <button
          onClick={handleGenerate}
          disabled={!canSubmit}
          className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            canSubmit
              ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20 hover:-translate-y-px"
              : "bg-[#141830] text-[#4A4A68] cursor-not-allowed"
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Building your package...
            </span>
          ) : (
            "Build negotiation package →"
          )}
        </button>
      </div>

      {/* Error */}
      {error && error !== "pro_required" && (
        <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-5 mb-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <ResultPanel
          result={result}
          currentOffer={parsedCurrent}
          targetOffer={parsedTarget}
        />
      )}
    </main>
  );
}
